import nodePath from 'node:path';
import {
  nowIso,
  readJsonFile,
  scheduleNextRunAt,
  writeJsonFile,
} from './common';
import { evaluateGate } from './gate';
import { loadProjectProfile } from './profile';
import { resolveWorkerCommand, runWorkerProvider } from './providers';
import {
  appendRun,
  findFirstTaskByStatus,
  loadSchedulerState,
  loadTaskIndex,
  saveSchedulerState,
} from './storage';
import { toFinalStatus, updateTaskRecord, writeTaskCompletionArtifacts } from './tasks';
import { attemptAutoCommit } from './autoCommit';
import { processCompletedOptimizationTaskFromFS } from '../autonomous/InsightIntegrationLayer';
import { evaluateExecutionPolicy, getPolicySkipMessage, type LlmCallerContext } from './llmExecutionPolicy';
import { logProviderPreflight } from './llmUsageLogger';
import { evaluateLaneGuard, resolveTaskLane, writeLaneHeartbeat, writeLaneLockFile, writeSchedulerHeartbeatFile } from './laneGuard';
import type { ProviderCooldownState, SchedulerLane, TaskContract, TaskResult, WorkerTickOutcome } from './types';
import { DEFAULT_LANE, SCHEDULER_LANES } from './types';

interface WorkerTickOptions {
  force?: boolean;
  callerContext?: LlmCallerContext;
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

async function applyAutoCommitIfEligible(
  paths: Awaited<ReturnType<typeof loadSchedulerState>>['paths'],
  index: Awaited<ReturnType<typeof loadTaskIndex>>,
  task: NonNullable<ReturnType<typeof findFirstTaskByStatus>>,
  gateResult: TaskResult,
  finalStatus: string,
): Promise<void> {
  if (finalStatus !== 'COMPLETED') return;
  const commitResult = attemptAutoCommit(task, gateResult);
  if (!commitResult.committed) return;
  await updateTaskRecord(paths, index, task.taskId, {
    status: 'PENDING_REVIEW',
    latestProgressSummary: `Auto-committed ${commitResult.committedFiles.length} file(s) (sha: ${commitResult.sha ?? 'unknown'}). Awaiting CTO review.`,
    lastOutputAt: nowIso(),
  });
}

async function finalizeWorkerRun(
  paths: Awaited<ReturnType<typeof loadSchedulerState>>['paths'],
  state: Awaited<ReturnType<typeof loadSchedulerState>>['state'],
  startedAtIso: string,
  status: 'success' | 'failed' | 'skipped',
  reason: string,
  taskId: number | null,
  lane?: SchedulerLane,
): Promise<void> {
  await appendRun(paths, {
    runId: buildRunId(),
    tickType: 'worker',
    startedAt: startedAtIso,
    finishedAt: nowIso(),
    status,
    reason,
    taskId,
    lane,
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

/**
 * Lane-based active-task guard (replaces single_active_task global lock).
 *
 * - Resolves the lane of the first QUEUED task (or DEFAULT_LANE when no queued task).
 * - Checks whether that lane is already locked by a RUNNING task.
 * - If locked and stale: auto-finalizes (same as previous single_active_task + finalize_on_stale).
 * - If locked and not stale: returns 'skipped'.
 * - If not locked: returns null (caller may proceed).
 * - Also writes a heartbeat for the lane.
 *
 * Falls back to global single-task if single_active_task=true and all tasks are L-ONDEMAND
 * (backwards-compatible: without lane field, all tasks share L-ONDEMAND).
 */
async function handleLaneGuard(
  paths: Awaited<ReturnType<typeof loadSchedulerState>>['paths'],
  state: Awaited<ReturnType<typeof loadSchedulerState>>['state'],
  index: Awaited<ReturnType<typeof loadTaskIndex>>,
  profile: Awaited<ReturnType<typeof loadProjectProfile>>,
  startedAtIso: string,
  targetLane: SchedulerLane,
): Promise<WorkerTickOutcome | null> {
  if (!profile.worker_rules.single_active_task) {
    // Guard disabled — write heartbeat only (no running task)
    writeLaneHeartbeat(state, targetLane, null);
    return null;
  }

  const staleThresholdMs = profile.worker_rules.finalize_on_stale_output_minutes * 60_000;
  const guardResult = evaluateLaneGuard(index.tasks, targetLane, staleThresholdMs);

  // Write heartbeat regardless of guard outcome
  writeLaneHeartbeat(state, targetLane, guardResult.lockHolder?.taskId ?? null);

  if (guardResult.decision === 'allowed') return null;

  const lockHolder = guardResult.lockHolder!;
  if (guardResult.decision === 'stale_finalize' && profile.worker_rules.finalize_on_permission_block) {
    return finalizeStaleRunningTask(
      paths,
      state,
      index,
      lockHolder,
      startedAtIso,
      profile.worker_rules.finalize_on_stale_output_minutes,
    );
  }

  await finalizeWorkerRun(
    paths, state, startedAtIso, 'skipped',
    `Lane ${targetLane}: task #${lockHolder.taskId} is already RUNNING.`,
    lockHolder.taskId,
    targetLane,
  );
  return { status: 'skipped', reason: 'already_running', taskId: lockHolder.taskId };
}

function scheduleOptimizationInsights(
  finalStatus: string,
  task: NonNullable<ReturnType<typeof findFirstTaskByStatus>>,
): void {
  if (finalStatus !== 'COMPLETED') return;
  const plannerCtx = task.plannerContext as unknown as Record<string, unknown> | undefined;
  const regimeState = plannerCtx?.regimeState as string | undefined;
  const regimeTaskType = plannerCtx?.regimeTaskType as string | undefined;
  const isOptimizationTask = regimeState === 'OPTIMIZATION' || regimeTaskType === 'price_analysis_quality';
  if (!isOptimizationTask) return;
  const dedupeKey = plannerCtx?.dedupeKey as string | undefined;
  if (!dedupeKey) return;
  processCompletedOptimizationTaskFromFS(dedupeKey, { regimeContext: 'OPTIMIZATION' }).catch(() => { /* non-blocking */ });
}

export async function runWorkerTick(options: WorkerTickOptions = {}): Promise<WorkerTickOutcome> {
  const profile = await loadProjectProfile();
  const { paths, state } = await loadSchedulerState(profile);
  const index = await loadTaskIndex(paths);
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();
  const policyDecision = await evaluateExecutionPolicy({
    caller: 'worker',
    callerContext: options.callerContext ?? 'background',
    provider: state.workerProvider,
    model: state.workerCopilotModel ?? '',
    taskId: null,
  });

  if (!policyDecision.allowed) {
    await finalizeWorkerRun(paths, state, startedAtIso, 'skipped', getPolicySkipMessage(policyDecision.skip_reason), null);
    // Non-blocking: write heartbeat reflecting disabled/blocked status
    writeSchedulerHeartbeatFile(paths.orchestratorRoot, state, index.tasks).catch(() => { /* non-blocking */ });
    return { status: 'skipped', reason: policyDecision.skip_reason ?? 'SCHEDULER_DISABLED', taskId: null };
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

  // Resolve target lane from the first QUEUED task, defaulting to L-ONDEMAND.
  const firstQueued = index.tasks
    .filter((t) => t.status === 'QUEUED')
    .sort((a, b) => a.taskId - b.taskId)[0];
  const targetLane = firstQueued ? resolveTaskLane(firstQueued) : DEFAULT_LANE;

  const laneGuardResult = await handleLaneGuard(paths, state, index, profile, startedAtIso, targetLane);
  if (laneGuardResult) return laneGuardResult;

  // Guard: if no worker command is configured (neither process.env nor launchd.env),
  // skip the entire tick rather than claiming a QUEUED task and immediately marking
  // it REPLAN_REQUIRED in a loop.
  const workerCmd = resolveWorkerCommand();
  if (!workerCmd) {
    await finalizeWorkerRun(paths, state, startedAtIso, 'skipped', 'AGENT_ORCHESTRATOR_WORKER_CMD is not configured — worker tick skipped.', null, targetLane);
    return { status: 'skipped', reason: 'worker_not_configured', taskId: null };
  }

  const queuedTasks = index.tasks
    .filter((task) => task.status === 'QUEUED')
    .sort((a, b) => a.taskId - b.taskId);

  const task = queuedTasks[0];
  if (!task) {
    await finalizeWorkerRun(paths, state, startedAtIso, 'skipped', 'No queued task.', null, targetLane);
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
    workerCopilotModel: state.workerCopilotModel ?? '',
    callerContext: options.callerContext ?? 'background',
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
  scheduleOptimizationInsights(finalStatus, task);

  // Auto-commit: stage and commit changed code files when gate passes
  await applyAutoCommitIfEligible(paths, index, task, gateResult, finalStatus);

  await finalizeWorkerRun(
    paths,
    state,
    startedAtIso,
    finalStatus === 'COMPLETED' ? 'success' : 'failed',
    `Task #${task.taskId} finalized with ${gateResult.gate_verdict}.`,
    task.taskId,
    resolveTaskLane(task),
  );

  // Non-blocking: persist lane locks + heartbeat after tick completes
  const leaseDurationMs = profile.worker_rules.finalize_on_stale_output_minutes * 60_000;
  writeLaneLockFile(paths.orchestratorRoot, index.tasks, state, state.schedulerEnabled, leaseDurationMs).catch(() => { /* non-blocking */ });
  writeSchedulerHeartbeatFile(paths.orchestratorRoot, state, index.tasks).catch(() => { /* non-blocking */ });

  return {
    status: finalStatus === 'COMPLETED' ? 'success' : 'failed',
    reason: gateResult.gate_verdict,
    taskId: task.taskId,
  };
}
