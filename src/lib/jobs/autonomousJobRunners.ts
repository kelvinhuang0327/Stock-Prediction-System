import { prisma } from '../prisma';
import nodeFs from 'node:fs/promises';
import nodePath from 'node:path';
import { runAutonomousCycle } from '../autonomous/AutonomousOrchestrator';
import { buildReviewReport } from '../autonomous/ReviewEngine';
import { processCompletedOptimizationTaskFromFS } from '../autonomous/InsightIntegrationLayer';
import { buildStrategyLearningInsight, persistStrategyLearningInsight } from '../autonomous/StrategyLearningEngine';
import type { AutonomousDailyRunResult } from '../autonomous/types';
import { AUTONOMOUS_JOB_REGISTRY } from './autonomousJobRegistry';
import { runJobWithOrchestration } from './runJobWithOrchestration';
import type { JobExecutionResult, JobRunnerContext, JobRunnerOutput, JobRunMode, JobTriggerSource } from './types';
import {
  runIntradayMonitorLayer,
  runDailyCycleLayer,
  runNightlyOptLayer,
  runWeeklyDeepLayer,
} from '../training/TrainingScheduler';
import type { LayerRunResult } from '../training/TrainingSchedulerTypes';
import { isTaiwanTradingDay, toTaiwanDateIso } from '../market/twTradingCalendar';
import { runTaiwanStockTask } from './TaiwanStockJobOrchestrator';
import { runCompositeOptimizationMiner, runOptimizationMiner } from '../agent-orchestrator/optimizationMiner';
import { loadProjectProfile } from '../agent-orchestrator/profile';
import { loadSchedulerState, loadTaskIndex } from '../agent-orchestrator/storage';
import { createQueuedTask } from '../agent-orchestrator/tasks';
import { runWorkerTick } from '../agent-orchestrator/workerTick';
import { generateTaiwanSelfAuditReport } from './TaiwanSelfOptimizationAudit';

interface MonitorCyclePayload {
  openTrades: number;
  closedTradesAwaitingReview: number;
  latestSnapshotId: number | null;
  latestSnapshotDate: string | null;
  note: string;
}

interface ReviewCyclePayload {
  createdReports: number;
  skippedExisting: number;
  reviewedTradeIds: number[];
  note: string;
}

interface LearningCyclePayload {
  insightId: number | null;
  sourceCount: number;
  note: string;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function buildJobSummary(prefix: string, payload: Record<string, unknown>): string {
  const pieces = Object.entries(payload)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.length : String(value)}`)
    .join(', ');
  return `${prefix}: ${pieces}`;
}

function toMetadataRecord(payload: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(payload);
}

async function runDailyRunner(context: JobRunnerContext): Promise<JobRunnerOutput<AutonomousDailyRunResult>> {
  // Use scheduledFor as the simulation date so holdingDays counts completed
  // UTC days rather than wall-clock fractional hours within the same day.
  const result = await runAutonomousCycle({ simulationDate: context.scheduledFor });
  return {
    summary: `daily snapshot=${result.snapshot.snapshotId ?? 'n/a'} proposals=${result.proposals.length} trades=${result.orders.length} reviews=${result.reviewReports.length}`,
    metadata: {
      snapshotId: result.snapshot.snapshotId ?? null,
      proposals: result.proposals.length,
      trades: result.orders.length,
      reviews: result.reviewReports.length,
      learningInsight: result.learningInsight?.id ?? null,
    },
    payload: result,
  };
}

async function runMonitorRunner(_context: JobRunnerContext): Promise<JobRunnerOutput<MonitorCyclePayload>> {
  const now = new Date();
  const [openTrades, latestSnapshot, closedTrades, reviewedTrades] = await Promise.all([
    prisma.simulatedTrade.count({ where: { status: { in: ['open', 'shadow-open'] } } }),
    prisma.autonomousResearchSnapshot.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.simulatedTrade.findMany({
      where: { status: { in: ['closed', 'shadow-closed'] } },
      select: { id: true, pnlPct: true, symbol: true, status: true, exitReason: true },
    }),
    prisma.tradeReviewReport.findMany({ select: { tradeId: true } }),
  ]);
  const tradeReviewIds = new Set(reviewedTrades.map((review) => review.tradeId));

  // Build a calendar-aware note so operators can distinguish a holiday/weekend
  // from a genuine sync failure when the latest snapshot date has not advanced.
  const buildNote = (): string => {
    if (!latestSnapshot) return 'no autonomous snapshot yet';
    const todayIso = toTaiwanDateIso(now);
    const isTradingToday = isTaiwanTradingDay(now);
    const snapshotDateNote = latestSnapshot.snapshotDate
      ? `latestSnapshotDate=${latestSnapshot.snapshotDate}`
      : '';
    if (!isTradingToday) {
      const isWeekend = [0, 6].includes(new Date(`${todayIso}T12:00:00+08:00`).getDay());
      const closedReason = isWeekend ? 'weekend' : 'holiday';
      return `monitor snapshot refreshed; ${snapshotDateNote}; Market closed (${closedReason}); latest trading quote is current`;
    }
    return snapshotDateNote
      ? `monitor snapshot refreshed; ${snapshotDateNote}`
      : 'monitor snapshot refreshed';
  };

  const payload: MonitorCyclePayload = {
    openTrades,
    closedTradesAwaitingReview: closedTrades
      .filter((trade) => {
        const isTimeExit = trade.exitReason === 'time';
        const isShadow = trade.status === 'shadow-closed';
        const threshold = isShadow ? 3 : 5;
        return (isTimeExit || Math.abs(trade.pnlPct ?? 0) >= threshold) && !tradeReviewIds.has(trade.id);
      })
      .length,
    latestSnapshotId: latestSnapshot?.id ?? null,
    latestSnapshotDate: latestSnapshot?.snapshotDate ?? null,
    note: buildNote(),
  };

  return {
    summary: buildJobSummary('monitor cycle', payload as unknown as Record<string, unknown>),
    metadata: toMetadataRecord(payload as unknown as Record<string, unknown>),
    payload,
  };
}

async function runReviewRunner(_context: JobRunnerContext): Promise<JobRunnerOutput<ReviewCyclePayload>> {
  const closedTrades = await prisma.simulatedTrade.findMany({
    where: { status: { in: ['closed', 'shadow-closed'] }, pnlPct: { not: null } },
    orderBy: { updatedAt: 'desc' },
  });

  let createdReports = 0;
  let skippedExisting = 0;
  const reviewedTradeIds: number[] = [];

  for (const trade of closedTrades) {
    const pnlPct = trade.pnlPct ?? 0;
    // Time-exit trades always qualify for review (learning needs signal regardless of magnitude).
    // For stop/target exits, apply a per-mode threshold: 3% for shadow, 5% for full.
    const isShadowClosed = trade.status === 'shadow-closed';
    const reviewThreshold = isShadowClosed ? 3 : 5;
    const isTimeExit = trade.exitReason === 'time';
    if (!isTimeExit && Math.abs(pnlPct) < reviewThreshold) continue;

    const existing = await prisma.tradeReviewReport.findUnique({ where: { tradeId: trade.id } });
    if (existing) {
      skippedExisting += 1;
      continue;
    }

    const journal = await prisma.tradeJournalEntry.findUnique({ where: { tradeId: trade.id } });
    const snapshot = await prisma.autonomousResearchSnapshot.findUnique({ where: { id: trade.snapshotId } });
    const marketContext = parseJson<{ marketState: string }>(trade.marketContext, { marketState: 'defensive' });
    const review = buildReviewReport({
      tradeId: trade.id,
      symbol: trade.symbol,
      setupType: trade.setupType,
      pnlPct,
      holdingDays: trade.holdingDays,
      mfePct: trade.mfePct,
      maePct: trade.maePct,
      exitReason: trade.exitReason ?? null,
      marketState: (marketContext.marketState as 'defensive' | '震盪' | 'recovery' | 'trending') ?? 'defensive',
      dataCoverage: (snapshot?.dataCoverage ?? 'insufficient') as AutonomousDailyRunResult['snapshot']['dataCoverage'],
      thesis: journal?.decisionReasoning ?? trade.marketContext,
      signalStrength: trade.setupType,
      fundamentalState: (snapshot?.dataCoverage ?? 'insufficient') as AutonomousDailyRunResult['snapshot']['dataCoverage'],
    });

    await prisma.tradeReviewReport.create({
      data: {
        tradeId: trade.id,
        snapshotId: trade.snapshotId,
        triggerType: review.triggerType,
        preTrade: JSON.stringify(review.preTrade),
        result: JSON.stringify(review.result),
        analysis: JSON.stringify(review.analysis),
        issues: JSON.stringify(review.issues),
        recommendations: JSON.stringify(review.recommendations),
      },
    });
    createdReports += 1;
    reviewedTradeIds.push(trade.id);
  }

  const payload: ReviewCyclePayload = {
    createdReports,
    skippedExisting,
    reviewedTradeIds,
    note: createdReports > 0 ? 'review reports created' : 'no eligible trades needed review',
  };

  return {
    summary: buildJobSummary('review cycle', payload as unknown as Record<string, unknown>),
    metadata: toMetadataRecord(payload as unknown as Record<string, unknown>),
    payload,
  };
}

async function runLearningRunner(_context: JobRunnerContext): Promise<JobRunnerOutput<LearningCyclePayload>> {
  const insight = await buildStrategyLearningInsight();
  if (!insight) {
    const payload: LearningCyclePayload = {
      insightId: null,
      sourceCount: 0,
      note: 'no review data available',
    };
    return {
      summary: buildJobSummary('learning cycle', payload as unknown as Record<string, unknown>),
      metadata: toMetadataRecord(payload as unknown as Record<string, unknown>),
      payload,
    };
  }

  const persisted = await persistStrategyLearningInsight(insight);
  const payload: LearningCyclePayload = {
    insightId: persisted.id ?? null,
    sourceCount: persisted.sourceCount,
    note: 'learning insight refreshed',
  };
  return {
    summary: buildJobSummary('learning cycle', payload as unknown as Record<string, unknown>),
    metadata: toMetadataRecord(payload as unknown as Record<string, unknown>),
    payload,
  };
}

export async function runAutonomousDailyCycle(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<AutonomousDailyRunResult>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['autonomous:daily'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { mode: 'daily' },
    },
    runDailyRunner,
  );
}

export async function runAutonomousMonitorCycle(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<MonitorCyclePayload>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['autonomous:monitor'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { mode: 'monitor' },
    },
    runMonitorRunner,
  );
}

export async function runAutonomousReviewCycle(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<ReviewCyclePayload>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['autonomous:review'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { mode: 'review' },
    },
    runReviewRunner,
  );
}

export async function runAutonomousLearningCycle(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<LearningCyclePayload>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['autonomous:learning'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { mode: 'learning' },
    },
    runLearningRunner,
  );
}

// ── Training Scheduler Layer Runners ──────────────────────────────────────────

async function runTrainingIntradayMonitorRunner(context: JobRunnerContext): Promise<JobRunnerOutput<LayerRunResult>> {
  const result = await runIntradayMonitorLayer();
  return {
    summary: result.summary,
    metadata: result.metadata,
    payload: result,
  };
}

async function runTrainingDailyCycleRunner(context: JobRunnerContext): Promise<JobRunnerOutput<LayerRunResult>> {
  const result = await runDailyCycleLayer(context.scheduledFor);
  return {
    summary: result.summary,
    metadata: result.metadata,
    payload: result,
  };
}

async function runTrainingNightlyOptRunner(_context: JobRunnerContext): Promise<JobRunnerOutput<LayerRunResult>> {
  const result = await runNightlyOptLayer();
  return {
    summary: result.summary,
    metadata: result.metadata,
    payload: result,
  };
}

async function runTrainingWeeklyDeepRunner(_context: JobRunnerContext): Promise<JobRunnerOutput<LayerRunResult>> {
  const result = await runWeeklyDeepLayer();
  return {
    summary: result.summary,
    metadata: result.metadata,
    payload: result,
  };
}

interface TaiwanSchedulerTaskResult {
  taskName: string;
  jobId: number | undefined;
  status: string;
  skipped: boolean;
  summary: string | null;
}

interface TaiwanSchedulerPayload {
  tasks: TaiwanSchedulerTaskResult[];
}

interface TaiwanOptimizationMinerPayload {
  createdTaskId: number | null;
  dedupeKey: string | null;
  mode: 'composite' | 'single' | 'none';
  sources: string[];
}

interface TaiwanWorkerCyclePayload {
  taskId: number | null;
  status: 'success' | 'skipped' | 'failed';
  reason: string;
}

interface TaiwanInsightIngestPayload {
  completedTaskCount: number;
  processedReportCount: number;
  generatedInsightCount: number;
}

interface TaiwanWeeklyDeepPayload {
  reportPath: string;
  tasksCreated: number;
  thresholdsChanged: false;
}

interface TaiwanSelfAuditPayload {
  reportPath: string;
  recommendationCount: number;
}

async function loadOrchestratorRuntime() {
  const profile = await loadProjectProfile();
  const runtime = await loadSchedulerState(profile);
  const index = await loadTaskIndex(runtime.paths);
  return { profile, runtime, index };
}

function assertSchedulerTaskSucceeded(result: Awaited<ReturnType<typeof runTaiwanStockTask>>): void {
  if (result.skipped) return;
  if (result.jobRun.status === 'success') return;

  throw new Error(
    result.jobRun.errorMessage
      ?? result.jobRun.summary
      ?? `Taiwan stock task ${result.jobRun.jobName} failed`,
  );
}

function toTaiwanSchedulerTaskResult(result: Awaited<ReturnType<typeof runTaiwanStockTask>>): TaiwanSchedulerTaskResult {
  return {
    taskName: result.jobRun.jobName,
    jobId: result.jobRun.id,
    status: result.jobRun.status,
    skipped: result.skipped,
    summary: result.jobRun.summary,
  };
}

async function runTrainingTaiwanDataSyncRunner(context: JobRunnerContext): Promise<JobRunnerOutput<TaiwanSchedulerPayload>> {
  const tasks: TaiwanSchedulerTaskResult[] = [];

  const syncResult = await runTaiwanStockTask({
    taskName: 'twstock:data_sync_health',
    scheduledFor: context.scheduledFor,
    triggerSource: context.triggerSource,
    force: context.force,
  });
  assertSchedulerTaskSucceeded(syncResult);
  tasks.push(toTaiwanSchedulerTaskResult(syncResult));

  if (context.scheduledFor.getUTCMinutes() === 0) {
    const quoteResult = await runTaiwanStockTask({
      taskName: 'twstock:quote_sync',
      scheduledFor: context.scheduledFor,
      triggerSource: context.triggerSource,
      force: context.force,
    });
    assertSchedulerTaskSucceeded(quoteResult);
    tasks.push(toTaiwanSchedulerTaskResult(quoteResult));
  }

  return {
    summary: `taiwan data sync tasks=${tasks.length}`,
    metadata: {
      tasks: tasks.map((task) => ({
        taskName: task.taskName,
        status: task.status,
        skipped: task.skipped,
      })),
    },
    payload: { tasks },
  };
}

async function runTrainingTaiwanSnapshotRunner(context: JobRunnerContext): Promise<JobRunnerOutput<TaiwanSchedulerPayload>> {
  const result = await runTaiwanStockTask({
    taskName: 'twstock:daily_market_snapshot',
    scheduledFor: context.scheduledFor,
    triggerSource: context.triggerSource,
    force: context.force,
  });
  assertSchedulerTaskSucceeded(result);
  const tasks = [toTaiwanSchedulerTaskResult(result)];

  return {
    summary: `taiwan snapshot tasks=${tasks.length}`,
    metadata: { tasks },
    payload: { tasks },
  };
}

async function runTrainingTaiwanScreenRunner(context: JobRunnerContext): Promise<JobRunnerOutput<TaiwanSchedulerPayload>> {
  const result = await runTaiwanStockTask({
    taskName: 'twstock:candidate_screening_dry_run',
    dryRun: true,
    scheduledFor: context.scheduledFor,
    triggerSource: context.triggerSource,
    force: context.force,
  });
  assertSchedulerTaskSucceeded(result);
  const tasks = [toTaiwanSchedulerTaskResult(result)];

  return {
    summary: `taiwan dry-run screen tasks=${tasks.length}`,
    metadata: { tasks },
    payload: { tasks },
  };
}

async function runTrainingTaiwanReportRunner(context: JobRunnerContext): Promise<JobRunnerOutput<TaiwanSchedulerPayload>> {
  const result = await runTaiwanStockTask({
    taskName: 'twstock:daily_report',
    scheduledFor: context.scheduledFor,
    triggerSource: context.triggerSource,
    force: context.force,
  });
  assertSchedulerTaskSucceeded(result);
  const tasks = [toTaiwanSchedulerTaskResult(result)];

  return {
    summary: `taiwan report tasks=${tasks.length}`,
    metadata: { tasks },
    payload: { tasks },
  };
}

async function runTrainingTaiwanOptimizationMinerRunner(
  _context: JobRunnerContext,
): Promise<JobRunnerOutput<TaiwanOptimizationMinerPayload>> {
  const { profile, runtime, index } = await loadOrchestratorRuntime();
  if (!runtime.state.schedulerEnabled) {
    return {
      summary: 'optimization miner skipped: orchestrator scheduler hard-off',
      metadata: {
        schedulerOutcome: 'skipped',
        skippedReason: 'scheduler_disabled',
        generatedTaskCount: 0,
      },
      payload: {
        createdTaskId: null,
        dedupeKey: null,
        mode: 'none',
        sources: [],
      },
      finalStatus: 'skipped',
      skipReason: 'scheduler_disabled',
    };
  }

  const composite = await runCompositeOptimizationMiner(index.tasks, profile).catch(() => null);
  if (composite) {
    const task = await createQueuedTask(profile, runtime.paths, index, {
      objective: composite.draft.objective,
      promptMarkdown: composite.draft.promptMarkdown,
      contract: composite.draft.contract,
      plannerContext: composite.draft.plannerContext,
      plannerProvider: runtime.state.plannerProvider,
      workerProvider: runtime.state.workerProvider,
    });

    return {
      summary: `optimization miner queued composite task #${task.taskId}`,
      metadata: {
        schedulerOutcome: 'success',
        generatedTaskCount: 1,
        dedupeKey: composite.dedupeKey,
        sources: composite.buckets.flatMap((bucket) => bucket.picks.map((pick) => pick.sourceType)),
        realBuckets: composite.realBuckets,
        fallbackBuckets: composite.fallbackBuckets,
      },
      payload: {
        createdTaskId: task.taskId,
        dedupeKey: composite.dedupeKey,
        mode: 'composite',
        sources: composite.buckets.flatMap((bucket) => bucket.picks.map((pick) => pick.sourceType)),
      },
    };
  }

  const single = await runOptimizationMiner(index.tasks, profile).catch(() => null);
  if (!single) {
    return {
      summary: 'optimization miner skipped: no actionable candidates',
      metadata: {
        schedulerOutcome: 'skipped',
        skippedReason: 'no_actionable_candidates',
        generatedTaskCount: 0,
      },
      payload: {
        createdTaskId: null,
        dedupeKey: null,
        mode: 'none',
        sources: [],
      },
      finalStatus: 'skipped',
      skipReason: 'no_actionable_candidates',
    };
  }

  const task = await createQueuedTask(profile, runtime.paths, index, {
    objective: single.draft.objective,
    promptMarkdown: single.draft.promptMarkdown,
    contract: single.draft.contract,
    plannerContext: single.draft.plannerContext,
    plannerProvider: runtime.state.plannerProvider,
    workerProvider: runtime.state.workerProvider,
  });

  return {
    summary: `optimization miner queued task #${task.taskId}`,
    metadata: {
      schedulerOutcome: 'success',
      generatedTaskCount: 1,
      dedupeKey: single.candidate.dedupeKey,
      source: single.candidate.sourceType,
      priorityScore: single.candidate.priorityScore,
      totalMined: single.totalMined,
      sourcesActive: single.sourcesActive,
    },
    payload: {
      createdTaskId: task.taskId,
      dedupeKey: single.candidate.dedupeKey,
      mode: 'single',
      sources: single.sourcesActive,
    },
  };
}

async function runTrainingTaiwanWorkerCycleRunner(
  _context: JobRunnerContext,
): Promise<JobRunnerOutput<TaiwanWorkerCyclePayload>> {
  const result = await runWorkerTick({ callerContext: 'background' });

  if (result.status === 'failed') {
    throw new Error(result.reason);
  }

  if (result.status === 'skipped') {
    return {
      summary: `worker cycle skipped: ${result.reason}`,
      metadata: {
        schedulerOutcome: 'skipped',
        skippedReason: result.reason,
        generatedTaskCount: 0,
        generatedInsightCount: 0,
        taskId: result.taskId,
      },
      payload: {
        taskId: result.taskId,
        status: result.status,
        reason: result.reason,
      },
      finalStatus: 'skipped',
      skipReason: result.reason,
    };
  }

  return {
    summary: `worker cycle completed task #${result.taskId ?? 'n/a'}`,
    metadata: {
      schedulerOutcome: 'success',
      taskId: result.taskId,
      generatedTaskCount: 0,
      generatedInsightCount: 0,
    },
    payload: {
      taskId: result.taskId,
      status: result.status,
      reason: result.reason,
    },
  };
}

async function runTrainingTaiwanInsightIngestRunner(
  _context: JobRunnerContext,
): Promise<JobRunnerOutput<TaiwanInsightIngestPayload>> {
  const { runtime, index } = await loadOrchestratorRuntime();
  const dedupeKeys = [...new Set(
    index.tasks
      .filter((task) => task.status === 'COMPLETED' && task.plannerContext?.regimeState === 'OPTIMIZATION')
      .map((task) => task.plannerContext?.dedupeKey)
      .filter((value): value is string => Boolean(value)),
  )];

  if (dedupeKeys.length === 0) {
    return {
      summary: 'insight ingest skipped: no completed optimisation reports',
      metadata: {
        schedulerOutcome: 'skipped',
        skippedReason: 'no_completed_reports',
        processedReportCount: 0,
        generatedInsightCount: 0,
      },
      payload: {
        completedTaskCount: 0,
        processedReportCount: 0,
        generatedInsightCount: 0,
      },
      finalStatus: 'skipped',
      skipReason: 'no_completed_reports',
    };
  }

  const beforeCount = await prisma.optimizationInsightRecord.count({
    where: { expiresAt: { gt: new Date() } },
  }).catch(() => 0);

  for (const dedupeKey of dedupeKeys) {
    await processCompletedOptimizationTaskFromFS(dedupeKey);
  }

  const afterCount = await prisma.optimizationInsightRecord.count({
    where: { expiresAt: { gt: new Date() } },
  }).catch(() => beforeCount);

  return {
    summary: `insight ingest processed=${dedupeKeys.length} generated=${Math.max(0, afterCount - beforeCount)}`,
    metadata: {
      schedulerOutcome: 'success',
      completedTaskCount: dedupeKeys.length,
      processedReportCount: dedupeKeys.length,
      generatedInsightCount: Math.max(0, afterCount - beforeCount),
      runtimeTaskRoot: runtime.paths.taskRoot,
    },
    payload: {
      completedTaskCount: dedupeKeys.length,
      processedReportCount: dedupeKeys.length,
      generatedInsightCount: Math.max(0, afterCount - beforeCount),
    },
  };
}

async function runTrainingTaiwanWeeklyDeepResearchRunner(
  context: JobRunnerContext,
): Promise<JobRunnerOutput<TaiwanWeeklyDeepPayload>> {
  const profile = await loadProjectProfile();
  const { state } = await loadSchedulerState(profile);
  if (!state.schedulerEnabled) {
    return {
      summary: 'weekly deep research skipped: orchestrator scheduler hard-off',
      metadata: {
        schedulerOutcome: 'skipped',
        skippedReason: 'scheduler_disabled',
        generatedTaskCount: 0,
      },
      payload: {
        reportPath: 'runtime/training_reports/tw_weekly_deep_research.json',
        tasksCreated: 0,
        thresholdsChanged: false,
      },
      finalStatus: 'skipped',
      skipReason: 'scheduler_disabled',
    };
  }

  const result = await runWeeklyDeepLayer();
  const reportPath = 'runtime/training_reports/tw_weekly_deep_research.json';
  const absolutePath = nodePath.join(process.cwd(), reportPath);
  await nodeFs.mkdir(nodePath.dirname(absolutePath), { recursive: true });
  await nodeFs.writeFile(absolutePath, JSON.stringify({
    generatedAt: context.scheduledFor.toISOString(),
    summary: result.summary,
    metadata: result.metadata,
    thresholdsChanged: false,
  }, null, 2), 'utf-8');

  return {
    summary: result.summary,
    metadata: {
      ...result.metadata,
      schedulerOutcome: 'success',
      reportPath,
      generatedTaskCount: result.tasksCreated,
      thresholdsChanged: false,
    },
    payload: {
      reportPath,
      tasksCreated: result.tasksCreated,
      thresholdsChanged: false,
    },
  };
}

async function runTrainingTaiwanSelfAuditRunner(
  _context: JobRunnerContext,
): Promise<JobRunnerOutput<TaiwanSelfAuditPayload>> {
  const report = await generateTaiwanSelfAuditReport();
  return {
    summary: `self audit recommendations=${report.recommendations.length}`,
    metadata: {
      schedulerOutcome: 'success',
      reportPath: report.reportPath,
      generatedTaskCount: 0,
      generatedInsightCount: 0,
      recommendations: report.recommendations,
      thresholdsChanged: false,
    },
    payload: {
      reportPath: report.reportPath,
      recommendationCount: report.recommendations.length,
    },
  };
}

export async function runTrainingIntradayMonitorCycle(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<LayerRunResult>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:intraday_monitor'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { layer: 'intraday_monitor' },
    },
    runTrainingIntradayMonitorRunner,
  );
}

export async function runTrainingDailyCycle(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<LayerRunResult>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:daily_cycle'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { layer: 'daily_cycle' },
    },
    runTrainingDailyCycleRunner,
  );
}

export async function runTrainingNightlyOpt(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<LayerRunResult>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:nightly_opt'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { layer: 'nightly_opt' },
    },
    runTrainingNightlyOptRunner,
  );
}

export async function runTrainingWeeklyDeep(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<LayerRunResult>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:weekly_deep'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { layer: 'weekly_deep' },
    },
    runTrainingWeeklyDeepRunner,
  );
}

export async function runTrainingTaiwanDataSync(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<TaiwanSchedulerPayload>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:tw-data-sync'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { lane: 'taiwan-stock', stage: 'data-sync' },
    },
    runTrainingTaiwanDataSyncRunner,
  );
}

export async function runTrainingTaiwanSnapshot(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<TaiwanSchedulerPayload>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:tw-snapshot'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { lane: 'taiwan-stock', stage: 'snapshot' },
    },
    runTrainingTaiwanSnapshotRunner,
  );
}

export async function runTrainingTaiwanScreen(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<TaiwanSchedulerPayload>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:tw-screen'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { lane: 'taiwan-stock', stage: 'screen' },
    },
    runTrainingTaiwanScreenRunner,
  );
}

export async function runTrainingTaiwanReport(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<TaiwanSchedulerPayload>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:tw-report'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { lane: 'taiwan-stock', stage: 'report' },
    },
    runTrainingTaiwanReportRunner,
  );
}

export async function runTrainingTaiwanOptimizationMiner(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<TaiwanOptimizationMinerPayload>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:tw-optimization-miner'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { lane: 'taiwan-stock', stage: 'optimization-miner' },
    },
    runTrainingTaiwanOptimizationMinerRunner,
  );
}

export async function runTrainingTaiwanWorkerCycle(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<TaiwanWorkerCyclePayload>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:tw-worker-cycle'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { lane: 'taiwan-stock', stage: 'worker-cycle' },
    },
    runTrainingTaiwanWorkerCycleRunner,
  );
}

export async function runTrainingTaiwanInsightIngest(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<TaiwanInsightIngestPayload>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:tw-insight-ingest'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { lane: 'taiwan-stock', stage: 'insight-ingest' },
    },
    runTrainingTaiwanInsightIngestRunner,
  );
}

export async function runTrainingTaiwanWeeklyDeepResearch(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<TaiwanWeeklyDeepPayload>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:tw-weekly-deep-research'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { lane: 'taiwan-stock', stage: 'weekly-deep-research' },
    },
    runTrainingTaiwanWeeklyDeepResearchRunner,
  );
}

export async function runTrainingTaiwanSelfAudit(options: {
  triggerSource: JobTriggerSource;
  scheduledFor?: Date;
  force?: boolean;
  runMode?: JobRunMode;
}): Promise<JobExecutionResult<TaiwanSelfAuditPayload>> {
  return runJobWithOrchestration(
    {
      job: AUTONOMOUS_JOB_REGISTRY['training:tw-self-audit'],
      scheduledFor: options.scheduledFor,
      triggerSource: options.triggerSource,
      runMode: options.runMode,
      force: options.force,
      metadata: { lane: 'taiwan-stock', stage: 'self-audit' },
    },
    runTrainingTaiwanSelfAuditRunner,
  );
}
