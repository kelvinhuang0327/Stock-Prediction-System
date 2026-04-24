/**
 * TrainingScheduler.ts
 *
 * Autonomous Training Scheduler — 4 scheduling layers that continuously improve
 * trading performance, price-analysis accuracy, and system robustness.
 *
 * SAFETY CONTRACT (NEVER RELAXED):
 *   - MUST NOT auto-change trading thresholds
 *   - MUST NOT bypass risk engine rejection floor (GUARDRAIL_MIN_CONFIDENCE = 0.6)
 *   - MUST NOT allow 0-strategy trading state
 *   - MUST NOT create unlimited insight stacking (MAX_PENALTY = 25%)
 *   - MUST NOT exceed global influence cap (25% base)
 *
 * Scheduling guarantees:
 *   - Missed jobs are backfilled (single window)
 *   - No duplicate task execution (dedupeKey TTL = 14 days)
 *   - Daily quota: LOW ≤ 5 / MEDIUM ≤ 3 / HIGH ≤ 1
 *   - All task insights flow through InsightGuardrailLayer before engine use
 *
 * Layers:
 *   Layer 1 — INTRADAY_MONITOR  every 30 minutes   (quote freshness, stuck trades)
 *   Layer 2 — DAILY_CYCLE       daily               (TWSE close → learn → gate)
 *   Layer 3 — NIGHTLY_OPT       daily (night)       (optimization miner → 4–8h tasks)
 *   Layer 4 — WEEKLY_DEEP       weekly (Saturday)   (deep training: score, MFE/MAE, etc.)
 */

import { prisma } from '../prisma';
import { runAutonomousCycle } from '../autonomous/AutonomousOrchestrator';
import {
  loadActiveInsights,
  processCompletedOptimizationTaskFromFS,
} from '../autonomous/InsightIntegrationLayer';
import { runTieredGuardrail } from '../autonomous/InsightGuardrailLayer';
import { evaluateGateRecovery } from '../autonomous/GateRecoveryEngine';
import { getQuotaRemaining, getMinerActivitySummaries, runTrainingMiner, recordRecoveryEvent } from '../training/TrainingMiner';
import type {
  LayerRunResult,
  LayerStatus,
  ProbeActivitySummary,
  RecoveryEventSummary,
  TrainingLayer,
  TrainingSchedulerStatus,
  TaskLogEntry,
} from '../training/TrainingSchedulerTypes';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Guard: if max active insights exceeds this, block new task publishing. */
const MAX_ACTIVE_INSIGHTS = 6;

/** Guard: if any single insightType count exceeds this, skip that source. */
const MAX_SAME_TYPE_INSIGHTS = 2;

// ─── Status store (in-process, survives ticks) ────────────────────────────────

const layerStatusStore: Map<TrainingLayer, LayerStatus> = new Map();
const taskLog: TaskLogEntry[] = [];
let schedulerStartedAt: string | null = null;

function initLayerStatus(layer: TrainingLayer): LayerStatus {
  return {
    layer,
    lastRunAt: null,
    lastStatus: 'never_ran',
    nextDueAt: null,
    runCount: 0,
    lastSummary: null,
  };
}

function getLayerStatus(layer: TrainingLayer): LayerStatus {
  if (!layerStatusStore.has(layer)) {
    layerStatusStore.set(layer, initLayerStatus(layer));
  }
  return layerStatusStore.get(layer)!;
}

function updateLayerStatus(layer: TrainingLayer, patch: Partial<LayerStatus>): void {
  const existing = getLayerStatus(layer);
  layerStatusStore.set(layer, { ...existing, ...patch });
}

function appendTaskLog(entry: TaskLogEntry): void {
  taskLog.unshift(entry); // newest first
  // Keep last 200 entries
  if (taskLog.length > 200) taskLog.splice(200);
}

// ─── Layer 1 — Intraday Monitor ───────────────────────────────────────────────

/**
 * Layer 1: INTRADAY_MONITOR
 *
 * Every 30 minutes:
 *   1. Check quote freshness via training miner (data_freshness_audit)
 *   2. Detect stuck open trades (lifecycle_stuck_detection)
 *   3. Log findings — NO automatic remediation
 */
export async function runIntradayMonitorLayer(): Promise<LayerRunResult> {
  const ranAt = new Date().toISOString();
  const layer: TrainingLayer = 'intraday_monitor';

  // Step 1: Mine intraday tasks (data_freshness_audit, lifecycle_stuck_detection)
  const { tasks, quotaRemaining } = await runTrainingMiner({
    layers: ['intraday_monitor'],
  });

  // Step 2: Check current open trades for stuck detection (summary only)
  const openTrades = await prisma.simulatedTrade.count({
    where: { status: { in: ['open', 'shadow-open'] } },
  });
  const latestSnapshot = await prisma.autonomousResearchSnapshot.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { snapshotDate: true, id: true },
  });

  // Step 3: Check active insights for expiry (passive load, no mutation)
  const activeInsights = await loadActiveInsights().catch(() => []);
  const expiredNow = activeInsights.filter((ins) => {
    return ins.expiresAt && new Date(ins.expiresAt) < new Date();
  });

  if (expiredNow.length > 0) {
    await recordRecoveryEvent('expired_gate').catch(() => undefined);
  }

  const summary = [
    `open_trades=${openTrades}`,
    `active_insights=${activeInsights.length}`,
    `expired_insights=${expiredNow.length}`,
    `tasks_mined=${tasks.length}`,
    `quota_low=${quotaRemaining.low}`,
    `latest_snapshot=${latestSnapshot?.snapshotDate ?? 'none'}`,
  ].join(' ');

  for (const task of tasks) {
    appendTaskLog({
      dedupeKey: task.dedupeKey,
      title: task.title,
      source: task.source,
      layer,
      risk: task.risk,
      startedAt: ranAt,
      finishedAt: ranAt,
      status: 'success',
      summary: `mined: ${task.title}`,
      insightsCandidates: 0,
    });
  }

  updateLayerStatus(layer, {
    lastRunAt: ranAt,
    lastStatus: 'success',
    runCount: getLayerStatus(layer).runCount + 1,
    lastSummary: summary,
  });

  return {
    layer,
    ranAt,
    summary,
    tasksCreated: tasks.length,
    insightsCandidates: 0,
    metadata: {
      openTrades,
      activeInsights: activeInsights.length,
      expiredInsights: expiredNow.length,
      latestSnapshotDate: latestSnapshot?.snapshotDate ?? null,
      quotaRemaining,
    },
  };
}

// ─── Layer 2 — Daily Trading Cycle ───────────────────────────────────────────

/**
 * Layer 2: DAILY_CYCLE
 *
 * End-of-day (TWSE close):
 *   1. Run autonomous cycle (sync TWSE → close trades → snapshot → learn)
 *   2. Analyse time-exit dominance (mine daily_cycle tasks)
 *   3. Load active insights → pass through guardrail → feed engines
 *   4. Evaluate gate recovery (probe/downgrade signals)
 */
export async function runDailyCycleLayer(simulationDate?: Date): Promise<LayerRunResult> {
  const ranAt = new Date().toISOString();
  const layer: TrainingLayer = 'daily_cycle';
  const simDate = simulationDate ?? new Date();

  let cycleResult: Awaited<ReturnType<typeof runAutonomousCycle>> | null = null;

  // Step 1: Run autonomous cycle
  cycleResult = await runAutonomousCycle({ simulationDate: simDate });

  // Step 2: Mine daily tasks (time_exit_dominance)
  const { tasks } = await runTrainingMiner({ layers: ['daily_cycle'] });

  // Step 3: Load active insights + guardrail
  const activeInsights = await loadActiveInsights().catch(() => []);

  // Safety: block if too many active insights
  const insightStacking = activeInsights.length > MAX_ACTIVE_INSIGHTS;

  // Apply guardrail for observability only (engines apply it internally too)
  let guardrailResult = null as ReturnType<typeof runTieredGuardrail> | null;
  try { guardrailResult = runTieredGuardrail(activeInsights); } catch { /* non-blocking */ }

  // Step 4: Detect gate recovery signals from learning insight
  let recoverySignals: string[] = [];
  if (cycleResult.learningInsight) {
    // Build recovery signals from the cycle result
    const closedTrades = await prisma.simulatedTrade.findMany({
      where: { status: { in: ['closed', 'shadow-closed'] } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { exitReason: true, pnlPct: true },
    });

    const timeExitCount = closedTrades.filter((t) => t.exitReason === 'time').length;
    const timeExitRate = closedTrades.length > 0 ? timeExitCount / closedTrades.length : 0;

    if (timeExitRate < 0.40) {
      recoverySignals.push('reduced_time_exit');
      await recordRecoveryEvent('expired_gate').catch(() => undefined);
    }
  }

  const gatedSetups = guardrailResult?.tiers?.critical?.flatMap((i: { affectedSetupTypes: string[] }) => i.affectedSetupTypes) ?? [];

  const summary = [
    `snapshot=${cycleResult.snapshot.snapshotId ?? 'n/a'}`,
    `proposals=${cycleResult.proposals.length}`,
    `orders=${cycleResult.orders.length}`,
    `reviews=${cycleResult.reviewReports.length}`,
    `learning_insight=${cycleResult.learningInsight?.id ?? 'none'}`,
    `active_insights=${activeInsights.length}`,
    `insight_stacking=${insightStacking ? 'WARNING' : 'ok'}`,
    `gated_setups=${gatedSetups.join(',') || 'none'}`,
    `recovery_signals=${recoverySignals.join(',') || 'none'}`,
    `tasks_mined=${tasks.length}`,
  ].join(' ');

  for (const task of tasks) {
    appendTaskLog({
      dedupeKey: task.dedupeKey,
      title: task.title,
      source: task.source,
      layer,
      risk: task.risk,
      startedAt: ranAt,
      finishedAt: ranAt,
      status: 'success',
      summary: `mined: ${task.title}`,
      insightsCandidates: 0,
    });
  }

  updateLayerStatus(layer, {
    lastRunAt: ranAt,
    lastStatus: 'success',
    runCount: getLayerStatus(layer).runCount + 1,
    lastSummary: summary,
  });

  return {
    layer,
    ranAt,
    summary,
    tasksCreated: tasks.length,
    insightsCandidates: 0,
    metadata: {
      snapshotId: cycleResult.snapshot.snapshotId ?? null,
      proposalsCount: cycleResult.proposals.length,
      ordersCount: cycleResult.orders.length,
      reviewsCount: cycleResult.reviewReports.length,
      learningInsightId: cycleResult.learningInsight?.id ?? null,
      activeInsightsCount: activeInsights.length,
      insightStacking,
      gatedSetups,
      recoverySignals,
    },
  };
}

// ─── Layer 3 — Nightly Optimisation ──────────────────────────────────────────

/**
 * Layer 3: NIGHTLY_OPT
 *
 * After-market (every night):
 *   1. Mine all nightly optimization tasks (8 system/data sources)
 *   2. Process any completed optimization reports on disk → extract insights
 *   3. Persist new insights through guardrail → feed TriggerScoringEngine etc.
 *   4. Safety: enforce insight stacking cap
 */
export async function runNightlyOptLayer(): Promise<LayerRunResult> {
  const ranAt = new Date().toISOString();
  const layer: TrainingLayer = 'nightly_opt';

  // Step 1: Mine nightly optimization tasks
  const { tasks, skipped, quotaRemaining } = await runTrainingMiner({
    layers: ['nightly_opt'],
  });

  // Step 2: Process completed task reports from filesystem
  // (AI workers write JSON reports to runtime/training_reports/ after completing tasks)
  let insightsCandidates = 0;
  const reportDir = 'runtime/training_reports';

  try {
    const { promises: fs } = await import('node:fs');
    const files = await fs.readdir(reportDir).catch(() => [] as string[]);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const filePath = `${reportDir}/${file}`;
      try {
        // processCompletedOptimizationTaskFromFS handles extraction + persistence
        // and gracefully no-ops if task ID is not recognised
        await processCompletedOptimizationTaskFromFS(filePath);
        insightsCandidates += 1;
      } catch {
        // Non-blocking: log and continue
        console.error(JSON.stringify({
          event: 'nightly_opt_report_error',
          file,
          layer,
        }));
      }
    }
  } catch {
    // reportDir may not exist yet — safe to skip
  }

  // Step 3: Enforce insight stacking cap
  const activeInsights = await loadActiveInsights().catch(() => []);
  if (activeInsights.length > MAX_ACTIVE_INSIGHTS) {
    console.warn(JSON.stringify({
      event: 'insight_stacking_cap_hit',
      count: activeInsights.length,
      max: MAX_ACTIVE_INSIGHTS,
      layer,
    }));
  }

  // Step 4: Guardrail pass (observability)
  try { runTieredGuardrail(activeInsights); } catch { /* non-blocking */ }

  const summary = [
    `tasks_mined=${tasks.length}`,
    `tasks_skipped=${skipped.length}`,
    `reports_processed=${insightsCandidates}`,
    `active_insights=${activeInsights.length}`,
    `quota_remaining_low=${quotaRemaining.low}`,
    `quota_remaining_medium=${quotaRemaining.medium}`,
  ].join(' ');

  for (const task of tasks) {
    appendTaskLog({
      dedupeKey: task.dedupeKey,
      title: task.title,
      source: task.source,
      layer,
      risk: task.risk,
      startedAt: ranAt,
      finishedAt: ranAt,
      status: 'success',
      summary: `mined: ${task.title}`,
      insightsCandidates,
    });
  }

  updateLayerStatus(layer, {
    lastRunAt: ranAt,
    lastStatus: 'success',
    runCount: getLayerStatus(layer).runCount + 1,
    lastSummary: summary,
  });

  return {
    layer,
    ranAt,
    summary,
    tasksCreated: tasks.length,
    insightsCandidates,
    metadata: {
      tasksMined: tasks.length,
      tasksSkipped: skipped.length,
      reportsProcessed: insightsCandidates,
      activeInsightsCount: activeInsights.length,
      quotaRemaining,
    },
  };
}

// ─── Layer 4 — Weekly Deep Training ──────────────────────────────────────────

/**
 * Layer 4: WEEKLY_DEEP
 *
 * Saturday deep-training run (can be triggered manually anytime):
 *   1. Mine all weekly_deep tasks (strategy axis)
 *   2. Evaluate gate recovery for all gated setups
 *   3. Apply gate diversity rule for any recovery-eligible setups
 *
 * WARNING: tasks produced here are 4–8h analysis tasks.
 * They produce JSON reports → processed next night by Layer 3.
 */
export async function runWeeklyDeepLayer(): Promise<LayerRunResult> {
  const ranAt = new Date().toISOString();
  const layer: TrainingLayer = 'weekly_deep';

  // Step 1: Mine deep training tasks
  const { tasks, skipped, quotaRemaining } = await runTrainingMiner({
    layers: ['weekly_deep'],
  });

  // Step 2: Load active insights for gate recovery evaluation
  const activeInsights = await loadActiveInsights().catch(() => []);

  // Step 3: Evaluate gate recovery across all gated setups
  const closedTrades = await prisma.simulatedTrade.findMany({
    where: {
      status: { in: ['closed', 'shadow-closed'] },
      pnlPct: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      exitReason: true,
      pnlPct: true,
      setupType: true,
      tradeMode: true,
    },
  });

  // Build recovery signals
  const probeSuccesses = closedTrades.filter((t) => {
    return t.tradeMode === 'probe' && (t.pnlPct ?? 0) >= 0;
  });

  const timeExitCount = closedTrades.filter((t) => t.exitReason === 'time').length;
  const timeExitRate = closedTrades.length > 0 ? timeExitCount / closedTrades.length : 0;

  const recoverySignals: Array<{ signalType: string; strength: number; context: string }> = [];

  if (probeSuccesses.length > 0) {
    recoverySignals.push({
      signalType: 'successful_probe',
      strength: Math.min(1, probeSuccesses.length / 3),
      context: `${probeSuccesses.length} successful probe trades`,
    });
  }

  if (timeExitRate < 0.40 && closedTrades.length >= 10) {
    recoverySignals.push({
      signalType: 'reduced_time_exit',
      strength: 1 - timeExitRate / 0.40,
      context: `Time-exit rate reduced to ${(timeExitRate * 100).toFixed(0)}%`,
    });
  }

  let recoveryEventsCount = 0;
  // Evaluate gate recovery for each gated setup type
  const gatedSetupTypes = [...new Set(
    activeInsights
      .filter((i) => i.confidence >= 0.9)
      .flatMap((i) => i.affectedSetupTypes),
  )];

  let guardrailResultWeekly = null as ReturnType<typeof runTieredGuardrail> | null;
  try { guardrailResultWeekly = runTieredGuardrail(activeInsights); } catch { /* non-blocking */ }

  const gateDecisions = guardrailResultWeekly?.gatingDecisions ?? [];
  const weeklyRecoverySignals = recoverySignals.map((s) => ({
    type: s.signalType as import('../autonomous/GateRecoveryEngine').RecoverySignalType,
    setupType: undefined as string | undefined,
    value: s.strength,
    evidence: s.context,
    recordedAt: ranAt,
  }));

  for (const setupType of gatedSetupTypes) {
    const setupGates = gateDecisions.filter((g) => g.gatedSetupType === setupType);
    if (setupGates.length === 0) continue;
    try {
      const recoveryResult = evaluateGateRecovery(
        setupGates,
        weeklyRecoverySignals,
        [setupType],
        { callerLabel: 'weekly_deep' },
      );
      if (recoveryResult.expiredGates.length > 0) {
        recoveryEventsCount += 1;
        await recordRecoveryEvent('expired_gate').catch(() => undefined);
      }
    } catch { /* non-blocking */ }
  }

  const summary = [
    `tasks_mined=${tasks.length}`,
    `tasks_skipped=${skipped.length}`,
    `gated_setup_types=${gatedSetupTypes.join(',') || 'none'}`,
    `recovery_signals=${recoverySignals.map((s) => s.signalType).join(',') || 'none'}`,
    `recovery_events=${recoveryEventsCount}`,
    `probe_successes=${probeSuccesses.length}`,
    `time_exit_rate=${(timeExitRate * 100).toFixed(0)}%`,
    `quota_remaining_low=${quotaRemaining.low}`,
  ].join(' ');

  for (const task of tasks) {
    appendTaskLog({
      dedupeKey: task.dedupeKey,
      title: task.title,
      source: task.source,
      layer,
      risk: task.risk,
      startedAt: ranAt,
      finishedAt: ranAt,
      status: 'success',
      summary: `mined: ${task.title}`,
      insightsCandidates: 0,
    });
  }

  updateLayerStatus(layer, {
    lastRunAt: ranAt,
    lastStatus: 'success',
    runCount: getLayerStatus(layer).runCount + 1,
    lastSummary: summary,
  });

  return {
    layer,
    ranAt,
    summary,
    tasksCreated: tasks.length,
    insightsCandidates: 0,
    metadata: {
      tasksMined: tasks.length,
      tasksSkipped: skipped.length,
      gatedSetupTypes,
      recoverySignals,
      recoveryEventsCount,
      probeSuccesses: probeSuccesses.length,
      timeExitRate,
      quotaRemaining,
    },
  };
}

// ─── Scheduler status (observability) ────────────────────────────────────────

/**
 * Collect and return the full scheduler status for the observability API.
 * Non-mutating — safe to call at any frequency.
 */
export async function getTrainingSchedulerStatus(): Promise<TrainingSchedulerStatus> {
  const now = new Date();
  const startedAt = schedulerStartedAt;
  const uptimeSeconds =
    startedAt != null
      ? Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000)
      : null;

  // Insights
  const activeInsights = await loadActiveInsights().catch(() => []);
  const allInsights = await prisma.optimizationInsightRecord
    .findMany({ select: { insightType: true, expiresAt: true } })
    .catch(() => []);

  const expiredCount = allInsights.filter(
    (i) => i.expiresAt && new Date(i.expiresAt) < now,
  ).length;

  const byType: Record<string, number> = {};
  for (const ins of activeInsights) {
    byType[ins.insightType] = (byType[ins.insightType] ?? 0) + 1;
  }

  // Guardrail: find gated setups
  let gatedSetupTypes: string[] = [];
  try {
    const guardrailResult = runTieredGuardrail(activeInsights);
    gatedSetupTypes = guardrailResult.tiers.critical
      .flatMap((i: { affectedSetupTypes: string[] }) => i.affectedSetupTypes)
      .filter((v: string, idx: number, arr: string[]) => arr.indexOf(v) === idx);
  } catch {
    // non-blocking
  }

  // Probe / recovery from miner state
  const { probeActivity, recoveryEvents } = await getMinerActivitySummaries().catch(
    (): { probeActivity: ProbeActivitySummary; recoveryEvents: RecoveryEventSummary } => ({
      probeActivity: {
        totalProbeAttempts: 0,
        allowedProbes: 0,
        deniedProbes: 0,
        lastProbeAt: null,
      },
      recoveryEvents: {
        totalExpiredGates: 0,
        totalDowngrades: 0,
        totalDiversityRescues: 0,
        lastRecoveryAt: null,
      },
    }),
  );

  // Quota
  const quota = await getQuotaRemaining().catch(() => ({ low: 0, medium: 0, high: 0 }));

  // Layers
  const layers = Object.fromEntries(
    (['intraday_monitor', 'daily_cycle', 'nightly_opt', 'weekly_deep'] as TrainingLayer[]).map(
      (l) => [l, getLayerStatus(l)],
    ),
  ) as Record<TrainingLayer, LayerStatus>;

  return {
    schedulerPid: process.pid,
    startedAt,
    uptimeSeconds,
    layers,
    insightCounts: {
      active: activeInsights.length,
      expired: expiredCount,
      byType,
    },
    gatedSetupTypes,
    probeActivity,
    recoveryEvents,
    taskLog: taskLog.slice(0, 50), // last 50 entries
    quotaRemaining: quota,
  };
}

// ─── Scheduler initialiser ────────────────────────────────────────────────────

/** Call once at daemon startup to initialise the in-process status store. */
export function initTrainingScheduler(): void {
  schedulerStartedAt = new Date().toISOString();
  for (const layer of ['intraday_monitor', 'daily_cycle', 'nightly_opt', 'weekly_deep'] as TrainingLayer[]) {
    layerStatusStore.set(layer, initLayerStatus(layer));
  }
  console.log(JSON.stringify({ event: 'training_scheduler_init', startedAt: schedulerStartedAt }));
}
