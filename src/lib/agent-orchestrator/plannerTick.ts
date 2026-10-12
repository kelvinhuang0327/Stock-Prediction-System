import { BACKLOG_PATH, BACKLOG_RESEARCH_PATH, fileExists, nowIso, readJsonFile, readTextFile, scheduleNextRunAt } from './common';
import { evaluateExecutionPolicy, getPolicySkipMessage, type LlmCallerContext } from './llmExecutionPolicy';
import { loadProjectProfile } from './profile';
import { buildColdRegimePayload, buildPlannerDraft, buildSaturatedPayload, pickResearchBacklogItem } from './providers';
import { classifySignalState } from './signalStateClassifier';
import {
  appendRun,
  getLatestTask,
  loadSchedulerState,
  loadTaskIndex,
  saveSchedulerState,
} from './storage';
import { createQueuedTask } from './tasks';
import { buildRecentTaskReference, evaluatePlannerDraftQuality } from './taskQualityGate';
import { runCompositeOptimizationMiner, runOptimizationMiner } from './optimizationMiner';
import { getSystemHealthStatus, emitHealthWarningIfDegraded } from './systemHealth';
import { shouldWarnOnDispatch, shouldAnnotateTask, logGuardDecision } from './systemHealthGuard';
import type { PlannerDraft } from './providers';
import type { PlannerTaskFingerprint, PlannerTickOutcome, ResearchBacklog, TaskContract, TaskRecord, TaskResult } from './types';

interface PlannerTickOptions {
  force?: boolean;
  callerContext?: LlmCallerContext;
}

interface PlannerRuntimeContext {
  startedAt: string;
  paths: Awaited<ReturnType<typeof loadSchedulerState>>['paths'];
  state: Awaited<ReturnType<typeof loadSchedulerState>>['state'];
}

interface DraftBuildResult {
  draft: PlannerDraft;
  classifyReason: string | null;
}

const DEFAULT_TASK_COOLDOWN_MINUTES = 30;

/** Maximum REPLAN_REQUIRED retries allowed per dedupeKey before the planner stops creating new tasks. */
const MAX_REPLAN_RETRY_COUNT = 15;

/** Confidence shift required to bypass the cooldown guard (mirrors SOURCE _CONFIDENCE_CHANGE_GATE). */
const CONFIDENCE_CHANGE_GATE = 0.2;

function getCooldownMinutes(): number {
  const value = Number(process.env.AGENT_ORCHESTRATOR_TASK_COOLDOWN_MINUTES ?? DEFAULT_TASK_COOLDOWN_MINUTES);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TASK_COOLDOWN_MINUTES;
  return value;
}

/**
 * In-flight guard: find any QUEUED/RUNNING task with the same dedupe_key.
 * SOURCE equivalent: db.get_inflight_task_by_dedupe_key()
 */
function findInFlightTaskByDedupeKey(tasks: TaskRecord[], dedupeKey: string): TaskRecord | null {
  return (
    [...tasks]
      .filter((task) => task.plannerContext?.dedupeKey === dedupeKey && ['QUEUED', 'RUNNING'].includes(task.status))
      .sort((a, b) => b.taskId - a.taskId)[0] ?? null
  );
}

/**
 * Count REPLAN_REQUIRED tasks for a given dedupeKey.
 * Used to enforce a retry cap so the planner does not loop indefinitely.
 */
function countReplanByDedupeKey(tasks: TaskRecord[], dedupeKey: string): number {
  return tasks.filter(
    (task) => task.plannerContext?.dedupeKey === dedupeKey && task.status === 'REPLAN_REQUIRED',
  ).length;
}

/**
 * Cooldown guard: find the most recent COMPLETED task within the cooldown window.
 * SOURCE equivalent: db.get_recent_completed_task_by_dedupe_key()
 */
function findRecentCompletedByDedupeKey(
  tasks: TaskRecord[],
  dedupeKey: string,
  cooldownMinutes: number,
  now: Date,
): TaskRecord | null {
  const thresholdMs = now.getTime() - cooldownMinutes * 60_000;
  return (
    [...tasks]
      .filter((task) => task.plannerContext?.dedupeKey === dedupeKey && task.status === 'COMPLETED')
      .sort((a, b) => b.taskId - a.taskId)
      .find((task) => {
        const at = Date.parse(task.updatedAt || task.createdAt);
        return Number.isFinite(at) && at >= thresholdMs;
      }) ?? null
  );
}

/**
 * State-change trigger: returns true if the latest task for the same taskType+game
 * was emitted under a DIFFERENT regimeState.
 */
function hasRegimeStateChange(tasks: TaskRecord[], context: PlannerTaskFingerprint): boolean {
  if (!(context.game && context.taskType && context.regimeState)) return false;
  const latestComparable = [...tasks]
    .filter((task) => {
      const plannerContext = task.plannerContext;
      return (
        plannerContext?.taskType === context.taskType &&
        plannerContext?.game === context.game &&
        plannerContext?.regimeState !== null
      );
    })
    .sort((a, b) => b.taskId - a.taskId)[0];
  if (!latestComparable?.plannerContext?.regimeState) return false;
  return latestComparable.plannerContext.regimeState !== context.regimeState;
}

/**
 * Returns the confidenceScore from the most recent task that shares the same
 * dedupe_key AND has a recorded confidence. Used to detect significant confidence shifts.
 * SOURCE equivalent: db.get_planner_dedupe_state() → last_confidence
 */
function findLastConfidenceByDedupeKey(tasks: TaskRecord[], dedupeKey: string): number | null {
  const lastWithConfidence = [...tasks]
    .filter(
      (task) =>
        task.plannerContext?.dedupeKey === dedupeKey &&
        task.plannerContext.confidenceScore != null,
    )
    .sort((a, b) => b.taskId - a.taskId)[0];
  return lastWithConfidence?.plannerContext?.confidenceScore ?? null;
}

function buildRunId(): string {
  return `planner-${Date.now()}`;
}

async function finalizeSkippedTick(
  runtime: PlannerRuntimeContext,
  reason: string,
  outcome: PlannerTickOutcome['reason'],
  taskId: number | null,
  updateSchedule = true,
): Promise<PlannerTickOutcome> {
  await appendRun(runtime.paths, {
    runId: buildRunId(),
    tickType: 'planner',
    startedAt: runtime.startedAt,
    finishedAt: nowIso(),
    status: 'skipped',
    reason,
    taskId,
  });

  if (updateSchedule) {
    runtime.state.lastPlannerRunAt = nowIso();
    runtime.state.nextPlannerRunAt = scheduleNextRunAt(runtime.state.scheduleMinutes);
    await saveSchedulerState(runtime.paths, runtime.state);
  }

  return { status: 'skipped', reason: outcome, taskId };
}

async function loadRecentTaskReferences(tasks: TaskRecord[]): Promise<ReturnType<typeof buildRecentTaskReference>[]> {
  const recentTasks = [...tasks].sort((a, b) => b.taskId - a.taskId).slice(0, 8);
  const references = await Promise.all(
    recentTasks.map(async (task) => {
      try {
        const contract = await readJsonFile<TaskContract>(task.contractPath);
        return buildRecentTaskReference(task, contract);
      } catch {
        return null;
      }
    }),
  );
  return references.filter((reference): reference is ReturnType<typeof buildRecentTaskReference> => Boolean(reference));
}

async function guardBeforeDraft(
  runtime: PlannerRuntimeContext,
  latestTask: TaskRecord | null,
  policySkipMessage: string | null,
  policySkipReason: string | null,
  profile: Awaited<ReturnType<typeof loadProjectProfile>>,
): Promise<{ previousResult: TaskResult | null } | PlannerTickOutcome> {
  if (policySkipMessage && policySkipReason) {
    return finalizeSkippedTick(runtime, policySkipMessage, policySkipReason, null, false);
  }

  if (latestTask?.status === 'RUNNING' && profile.planner_rules.skip_if_latest_running) {
    return finalizeSkippedTick(runtime, `Latest task #${latestTask.taskId} is RUNNING.`, 'latest_running', latestTask.taskId);
  }

  let previousResult: TaskResult | null = null;
  const latestResultPath = latestTask?.resultPath;
  if (latestResultPath && (await fileExists(latestResultPath))) {
    previousResult = await readJsonFile<TaskResult>(latestResultPath);
  }

  if (latestTask && profile.planner_rules.must_read_previous_result && !previousResult && latestTask.status !== 'CANCELLED') {
    return finalizeSkippedTick(
      runtime,
      `Latest task #${latestTask.taskId} has no task_result.json yet.`,
      'missing_previous_result',
      latestTask.taskId,
    );
  }

  if (latestTask?.status === 'REPLAN_REQUIRED' && profile.planner_rules.retry_replan_required_first) {
    previousResult ??= latestTask.resultPath ? await readJsonFile<TaskResult>(latestTask.resultPath) : null;
  }

  return { previousResult };
}

async function buildPlannerDraftForTick(
  profile: Awaited<ReturnType<typeof loadProjectProfile>>,
  backlogMarkdown: string,
  previousResult: TaskResult | null,
  runtime: PlannerRuntimeContext,
  recentTasks: TaskRecord[],
  researchItem?: import('./types').ResearchBacklogItem,
): Promise<DraftBuildResult | PlannerTickOutcome> {
  try {
    const signalState = await classifySignalState();

    if (signalState.state === 'TRUE_EXHAUSTED') {
      // Preferred path: emit a composite 8-hour multi-domain plan covering
      // 系統 / 功能 / 模擬 / 實戰 / 自我學習. Runs once per day, has its own
      // dedupe namespace (not gated by per-source daily quota), so it keeps
      // the scheduler moving even when single-task quota is exhausted.
      const composite = await runCompositeOptimizationMiner(recentTasks, profile).catch(() => null);
      if (composite) {
        return {
          draft: composite.draft,
          classifyReason: `OPTIMIZATION_MINER@composite_8h&domains=5&real=${composite.realBuckets}&fallback=${composite.fallbackBuckets}`,
        };
      }

      // Fallback: original single-source miner (may still hit daily quota and return null).
      const minerResult = await runOptimizationMiner(recentTasks, profile).catch(() => null);
      if (minerResult) {
        return {
          draft: minerResult.draft,
          classifyReason: `OPTIMIZATION_MINER@source=${minerResult.candidate.sourceType}&score=${minerResult.candidate.priorityScore}&mined=${minerResult.totalMined}`,
        };
      }
      // Both miners produced nothing (e.g. today's composite already PENDING_REVIEW, single-task
      // quota exhausted).  Fall through to the general backlog planner so that any
      // REPLAN_REQUIRED tasks from individual domain miners can still be retried, rather than
      // leaving the scheduler completely idle.
      // (no return here — execution continues to the general buildPlannerDraft call below)
    }

    if (signalState.state === 'COLD_REGIME') {
      return {
        draft: buildColdRegimePayload(signalState, profile),
        classifyReason: `COLD_REGIME (confidence=${(signalState.confidenceScore * 100).toFixed(0)}%)`,
      };
    }

    if (signalState.state === 'SIGNAL_SATURATED') {
      return {
        draft: buildSaturatedPayload(signalState, backlogMarkdown, profile),
        classifyReason: `SIGNAL_SATURATED (confidence=${(signalState.confidenceScore * 100).toFixed(0)}%)`,
      };
    }
  } catch {
    // non-blocking fallback below
  }

  return {
    draft: buildPlannerDraft({ profile, backlogMarkdown, previousResult, researchItem }),
    classifyReason: researchItem ? `backlog_research:${researchItem.id}` : null,
  };
}

async function guardAfterDraft(
  runtime: PlannerRuntimeContext,
  index: Awaited<ReturnType<typeof loadTaskIndex>>,
  draft: PlannerDraft,
): Promise<{ gate: ReturnType<typeof evaluatePlannerDraftQuality> } | PlannerTickOutcome> {
  const cooldownMinutes = getCooldownMinutes();
  const stateChanged = hasRegimeStateChange(index.tasks, draft.plannerContext);
  const currentConfidence = draft.plannerContext.confidenceScore ?? null;
  const lastConfidence = findLastConfidenceByDedupeKey(index.tasks, draft.plannerContext.dedupeKey);
  const confidenceDelta =
    currentConfidence !== null && lastConfidence !== null
      ? Math.abs(currentConfidence - lastConfidence)
      : null;
  const confidenceBypass = confidenceDelta !== null && confidenceDelta > CONFIDENCE_CHANGE_GATE;

  const inFlightTask = findInFlightTaskByDedupeKey(index.tasks, draft.plannerContext.dedupeKey);
  if (inFlightTask && !stateChanged) {
    return finalizeSkippedTick(
      runtime,
      `Dedupe hit: task #${inFlightTask.taskId} is in-flight for key ${draft.plannerContext.dedupeKey}.`,
      'dedupe_in_flight',
      inFlightTask.taskId,
    );
  }

  // Retry cap: if this dedupeKey has already accumulated too many REPLAN_REQUIRED
  // tasks, stop creating new ones to avoid an infinite loop.  The env var fix
  // (resolveWorkerCommand) should have resolved the root cause; the cap prevents
  // further damage if a different failure mode occurs.
  const replanCount = countReplanByDedupeKey(index.tasks, draft.plannerContext.dedupeKey);
  if (replanCount >= MAX_REPLAN_RETRY_COUNT) {
    return finalizeSkippedTick(
      runtime,
      `Max replan retry (${MAX_REPLAN_RETRY_COUNT}) reached for dedupeKey ${draft.plannerContext.dedupeKey}. Manual reset required.`,
      'dedupe_in_flight',
      null,
    );
  }

  const recentCompleted = findRecentCompletedByDedupeKey(
    index.tasks,
    draft.plannerContext.dedupeKey,
    cooldownMinutes,
    new Date(),
  );
  if (recentCompleted && !stateChanged && !confidenceBypass) {
    return finalizeSkippedTick(
      runtime,
      `Cooldown hit: task #${recentCompleted.taskId} completed recently for key ${draft.plannerContext.dedupeKey}.`,
      'dedupe_cooldown',
      recentCompleted.taskId,
    );
  }

  // Optimization miner drafts are pre-validated by the miner itself — skip trading-strategy gate.
  if (draft.plannerContext.regimeState === 'OPTIMIZATION') {
    return { gate: { quality_status: 'PASS', reasons: ['Optimization miner draft — gate bypassed.'], contract: draft.contract, promptMarkdown: draft.promptMarkdown } };
  }

  const gate = evaluatePlannerDraftQuality({
    objective: draft.objective,
    promptMarkdown: draft.promptMarkdown,
    contract: draft.contract,
    plannerContext: draft.plannerContext,
    recentTasks: await loadRecentTaskReferences(index.tasks),
  });
  if (gate.quality_status === 'REJECT') {
    return finalizeSkippedTick(
      runtime,
      `Quality gate rejected draft: ${gate.reasons.join(' | ')}`,
      'quality_gate_reject',
      null,
    );
  }

  return { gate };
}

export async function runPlannerTick(options: PlannerTickOptions = {}): Promise<PlannerTickOutcome> {
  const profile = await loadProjectProfile();
  const { paths, state } = await loadSchedulerState(profile);
  const index = await loadTaskIndex(paths);
  const startedAt = nowIso();
  const runtime: PlannerRuntimeContext = { startedAt, paths, state };
  if (!state.schedulerEnabled) {
    return finalizeSkippedTick(runtime, 'SCHEDULER_DISABLED — skip execution', 'scheduler_disabled', null, false);
  }

  // Health-aware logging: observe system health and emit a warning if degraded/critical.
  // Purely observational — does NOT change scheduling behaviour.
  getSystemHealthStatus()
    .then((health) => emitHealthWarningIfDegraded('plannerTick', health))
    .catch(() => { /* non-fatal — health check must never block the planner */ });
  const policyDecision = await evaluateExecutionPolicy({
    caller: 'planner',
    callerContext: options.callerContext ?? 'background',
    provider: state.plannerProvider,
    model: '',
    taskId: null,
  });
  const latestTask = getLatestTask(index);
  const beforeDraft = await guardBeforeDraft(
    runtime,
    latestTask,
    policyDecision.allowed ? null : getPolicySkipMessage(policyDecision.skip_reason),
    policyDecision.allowed ? null : policyDecision.skip_reason,
    profile,
  );
  if ('status' in beforeDraft) return beforeDraft;

  const backlogMarkdown = (await fileExists(BACKLOG_PATH))
    ? await readTextFile(BACKLOG_PATH)
    : '# Agent Orchestrator Backlog\n\n- [ ] Keep scheduler and task loop healthy.\n';

  // Load structured research backlog (v2); pick highest-priority queued item.
  const researchBacklog = (await fileExists(BACKLOG_RESEARCH_PATH))
    ? await readJsonFile<ResearchBacklog>(BACKLOG_RESEARCH_PATH).catch(() => null)
    : null;
  const researchItem = researchBacklog ? pickResearchBacklogItem(researchBacklog.items) : null;

  const draftResult = await buildPlannerDraftForTick(profile, backlogMarkdown, beforeDraft.previousResult, runtime, index.tasks, researchItem ?? undefined);
  if ('status' in draftResult) return draftResult;

  const postDraftGuard = await guardAfterDraft(runtime, index, draftResult.draft);
  if ('status' in postDraftGuard) return postDraftGuard;

  // Health guard — non-intrusive: always allowed, annotates task with health context.
  const [dispatchDecision, healthAnnotation] = await Promise.all([
    shouldWarnOnDispatch(),
    shouldAnnotateTask(),
  ]);
  logGuardDecision('plannerTick', 'dispatch', dispatchDecision);

  const task = await createQueuedTask(profile, paths, index, {
    objective: draftResult.draft.objective,
    promptMarkdown: postDraftGuard.gate.promptMarkdown,
    contract: postDraftGuard.gate.contract,
    plannerContext: draftResult.draft.plannerContext,
    plannerProvider: state.plannerProvider,
    workerProvider: state.workerProvider,
    healthContext: healthAnnotation,
  });

  const creationNote = draftResult.classifyReason ? ` [regime: ${draftResult.classifyReason}]` : '';
  await appendRun(paths, {
    runId: buildRunId(),
    tickType: 'planner',
    startedAt,
    finishedAt: nowIso(),
    status: 'success',
    reason: `Created task #${task.taskId}.${creationNote}`,
    taskId: task.taskId,
  });

  state.lastPlannerRunAt = nowIso();
  state.nextPlannerRunAt = scheduleNextRunAt(state.scheduleMinutes);
  await saveSchedulerState(paths, state);

  return {
    status: 'success',
    reason: `created_task_${task.taskId}`,
    taskId: task.taskId,
  };
}
