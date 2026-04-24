import nodePath from 'node:path';
import {
  nowIso,
  readJsonFile,
  scheduleNextRunAt,
  writeJsonFile,
} from './common';
import { evaluateGate } from './gate';
import { loadProjectProfile } from './profile';
import { runWorkerProvider } from './providers';
import {
  appendRun,
  findFirstTaskByStatus,
  loadSchedulerState,
  loadTaskIndex,
  saveSchedulerState,
} from './storage';
import { toFinalStatus, updateTaskRecord, writeTaskCompletionArtifacts } from './tasks';
import { processCompletedOptimizationTaskFromFS } from '../autonomous/InsightIntegrationLayer';
import type { ProviderCooldownState, TaskContract, TaskResult, WorkerTickOutcome } from './types';

interface WorkerTickOptions {
  force?: boolean;
}

function buildRunId(): string {
  return `worker-${Date.now()}`;
}

function isStale(lastOutputAt: string | null, thresholdMinutes: number): boolean {
  if (!lastOutputAt) return false;
  const ageMs = Date.now() - new Date(lastOutputAt).getTime();
  return ageMs > thresholdMinutes * 60_000;
}

function getRateLimitCooldownMinutes(): number {
  const raw = Number(process.env.AGENT_ORCHESTRATOR_RATE_LIMIT_COOLDOWN_MINUTES ?? '15');
  return Number.isFinite(raw) && raw > 0 ? raw : 15;
}

function buildProviderCooldown(provider: ProviderCooldownState['provider'], taskId: number, finalMessage: string, resetHint: string | null): ProviderCooldownState {
  const blockedUntil = new Date(Date.now() + getRateLimitCooldownMinutes() * 60_000).toISOString();
  return {
    provider,
    blockedUntil,
    reason: 'rate_limit',
    resetHint,
    finalMessage,
    lastTaskId: taskId,
    updatedAt: nowIso(),
  };
}

function readActiveCooldown(state: Awaited<ReturnType<typeof loadSchedulerState>>['state']): ProviderCooldownState | null {
  const cooldown = state.providerCooldowns?.[state.workerProvider] ?? null;
  if (!cooldown) return null;
  if (Date.parse(cooldown.blockedUntil) <= Date.now()) {
    delete state.providerCooldowns?.[state.workerProvider];
    return null;
  }
  return cooldown;
}

async function finalizeWorkerRun(
  paths: Awaited<ReturnType<typeof loadSchedulerState>>['paths'],
  state: Awaited<ReturnType<typeof loadSchedulerState>>['state'],
  startedAtIso: string,
  status: 'success' | 'failed' | 'skipped',
  reason: string,
  taskId: number | null,
): Promise<void> {
  await appendRun(paths, {
    runId: buildRunId(),
    tickType: 'worker',
    startedAt: startedAtIso,
    finishedAt: nowIso(),
    status,
    reason,
    taskId,
  });
  state.lastWorkerRunAt = nowIso();
  state.nextWorkerRunAt = scheduleNextRunAt(state.scheduleMinutes);
  await saveSchedulerState(paths, state);
}

async function finalizeStaleRunningTask(
  paths: Awaited<ReturnType<typeof loadSchedulerState>>['paths'],
  state: Awaited<ReturnType<typeof loadSchedulerState>>['state'],
  index: Awaited<ReturnType<typeof loadTaskIndex>>,
  task: NonNullable<ReturnType<typeof findFirstTaskByStatus>>,
  startedAtIso: string,
  staleMinutes: number,
): Promise<WorkerTickOutcome> {
  const fallbackResult: TaskResult = {
    version: '1.0',
    task_id: task.taskId,
    status: 'REPLAN_REQUIRED',
    gate_verdict: 'WORKER_RUNTIME_FAILED',
    gate_reason: `Task became stale for over ${staleMinutes} minutes.`,
    duration_seconds: 0,
    changed_files: [],
    error_markers_hit: ['stale_running_task'],
    missing_required_outputs: ['completed_markdown', 'task_result_json'],
    forbidden_change_violations: [],
    acceptance_results: [
      {
        name: 'Worker output freshness',
        passed: false,
        evidence: 'No output update observed within stale threshold.',
      },
    ],
    next_action: 'Planner should replan this task with narrower scope.',
  };

  const parsed = nodePath.parse(task.promptPath);
  const baseName = parsed.name.replace(/-prompt$/, '');
  const resultPath = nodePath.join(parsed.dir, `${baseName}-result.json`);
  await writeJsonFile(resultPath, fallbackResult);

  await updateTaskRecord(paths, index, task.taskId, {
    status: 'REPLAN_REQUIRED',
    gateVerdict: 'WORKER_RUNTIME_FAILED',
    resultPath,
    latestProgressSummary: 'Task auto-finalized due to stale RUNNING output.',
    lastOutputAt: nowIso(),
  });

  await finalizeWorkerRun(paths, state, startedAtIso, 'failed', `Finalized stale RUNNING task #${task.taskId}.`, task.taskId);
  return { status: 'failed', reason: 'stale_running_finalized', taskId: task.taskId };
}

function buildTaskProgressSummary(finalStatus: TaskResult['status'], provider: string, gateResult: TaskResult): string {
  if (finalStatus === 'COMPLETED') {
    return 'Worker finished task and gate passed.';
  }
  if (finalStatus === 'FAILED_RATE_LIMIT') {
    return `額度限制：${gateResult.failure_provider ?? provider} 遇到 rate limit。${gateResult.reset_hint ?? '請等待 reset 或改用其他 provider。'}`;
  }
  return `Worker finished task but gate=${gateResult.gate_verdict}.`;
}

export async function runWorkerTick(options: WorkerTickOptions = {}): Promise<WorkerTickOutcome> {
  const profile = await loadProjectProfile();
  const { paths, state } = await loadSchedulerState(profile);
  const index = await loadTaskIndex(paths);
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();

  if (!options.force && !state.schedulerEnabled) {
    await finalizeWorkerRun(paths, state, startedAtIso, 'skipped', 'Scheduler is disabled.', null);
    return { status: 'skipped', reason: 'scheduler_disabled', taskId: null };
  }

  state.providerCooldowns ??= {};
  const activeCooldown = readActiveCooldown(state);
  if (activeCooldown) {
    await finalizeWorkerRun(
      paths,
      state,
      startedAtIso,
      'skipped',
      `Worker provider ${state.workerProvider} is rate limited until ${activeCooldown.blockedUntil}. ${activeCooldown.resetHint ?? 'Wait for reset or switch provider.'}`,
      activeCooldown.lastTaskId,
    );
    return { status: 'skipped', reason: 'provider_rate_limited', taskId: activeCooldown.lastTaskId };
  }

  const activeTask = findFirstTaskByStatus(index, 'RUNNING');
  if (activeTask && profile.worker_rules.single_active_task) {
    if (
      profile.worker_rules.finalize_on_permission_block &&
      isStale(activeTask.lastOutputAt, profile.worker_rules.finalize_on_stale_output_minutes)
    ) {
      return finalizeStaleRunningTask(
        paths,
        state,
        index,
        activeTask,
        startedAtIso,
        profile.worker_rules.finalize_on_stale_output_minutes,
      );
    }

    await finalizeWorkerRun(paths, state, startedAtIso, 'skipped', `Task #${activeTask.taskId} is already RUNNING.`, activeTask.taskId);
    return { status: 'skipped', reason: 'already_running', taskId: activeTask.taskId };
  }

  const queuedTasks = index.tasks
    .filter((task) => task.status === 'QUEUED')
    .sort((a, b) => a.taskId - b.taskId);

  const task = queuedTasks[0];
  if (!task) {
    await finalizeWorkerRun(paths, state, startedAtIso, 'skipped', 'No queued task.', null);
    return { status: 'skipped', reason: 'no_queued_task', taskId: null };
  }

  const contract = await readJsonFile<TaskContract>(task.contractPath);
  await updateTaskRecord(paths, index, task.taskId, {
    status: 'RUNNING',
    latestProgressSummary: 'Worker claimed task and started execution.',
    lastOutputAt: nowIso(),
  });

  const workerOutput = await runWorkerProvider({
    workerProvider: state.workerProvider,
    taskId: task.taskId,
    promptPath: task.promptPath,
    contractPath: task.contractPath,
    objective: contract.objective,
    profile,
  });

  const draftResult: TaskResult = {
    version: '1.0',
    task_id: task.taskId,
    status: workerOutput.runtimeFailed ? 'FAILED' : 'COMPLETED',
    gate_verdict: workerOutput.runtimeFailed ? 'WORKER_RUNTIME_FAILED' : 'PASS',
    gate_reason: workerOutput.runtimeErrorMessage ?? '',
    duration_seconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
    changed_files: workerOutput.changedFiles,
    error_markers_hit: workerOutput.errorMarkersHit,
    missing_required_outputs: [],
    forbidden_change_violations: [],
    acceptance_results: workerOutput.acceptanceResults,
    next_action: workerOutput.runtimeFailed
      ? 'Planner should inspect runtime failure and replan.'
      : 'Continue to next planned task.',
  };

  const artifacts = await writeTaskCompletionArtifacts(
    task,
    workerOutput.completedMarkdown,
    draftResult,
    workerOutput.workerStdout,
  );

  const gateResult = await evaluateGate({
    taskId: task.taskId,
    durationSeconds: (Date.now() - startedAt.getTime()) / 1000,
    contract,
    completedPath: artifacts.completedPath,
    resultPath: artifacts.resultPath,
    changedFiles: workerOutput.changedFiles,
    acceptanceResults: workerOutput.acceptanceResults,
    gateReasonHint: workerOutput.runtimeErrorMessage,
    errorMarkersHit: workerOutput.errorMarkersHit,
    runtimeFailed: workerOutput.runtimeFailed,
    failureProvider: workerOutput.failureProvider ?? null,
    failureReason: workerOutput.failureReason ?? null,
    resetHint: workerOutput.resetHint ?? null,
    finalMessage: workerOutput.runtimeErrorMessage ?? null,
    httpStatus: workerOutput.httpStatus ?? null,
  });

  await writeJsonFile(artifacts.resultPath, gateResult);
  const finalStatus = toFinalStatus(gateResult.gate_verdict);

  if (gateResult.gate_verdict === 'PROVIDER_RATE_LIMITED' && gateResult.failure_provider) {
    state.providerCooldowns[gateResult.failure_provider] = buildProviderCooldown(
      gateResult.failure_provider,
      task.taskId,
      gateResult.final_message ?? gateResult.gate_reason,
      gateResult.reset_hint ?? null,
    );
  }

  await updateTaskRecord(paths, index, task.taskId, {
    status: finalStatus,
    gateVerdict: gateResult.gate_verdict,
    completedPath: artifacts.completedPath,
    resultPath: artifacts.resultPath,
    workerLogPath: artifacts.workerLogPath,
    latestProgressSummary: buildTaskProgressSummary(finalStatus, state.workerProvider, gateResult),
    lastOutputAt: nowIso(),
  });

  // Non-blocking: extract insights from optimization task output files
  if (finalStatus === 'COMPLETED' && task.plannerContext?.regimeState === 'OPTIMIZATION') {
    const dedupeKey = (task.plannerContext as unknown as Record<string, unknown>)?.dedupeKey as string | undefined;
    if (dedupeKey) {
      processCompletedOptimizationTaskFromFS(dedupeKey).catch(() => { /* non-blocking */ });
    }
  }

  await finalizeWorkerRun(
    paths,
    state,
    startedAtIso,
    finalStatus === 'COMPLETED' ? 'success' : 'failed',
    `Task #${task.taskId} finalized with ${gateResult.gate_verdict}.`,
    task.taskId,
  );

  return {
    status: finalStatus === 'COMPLETED' ? 'success' : 'failed',
    reason: gateResult.gate_verdict,
    taskId: task.taskId,
  };
}
