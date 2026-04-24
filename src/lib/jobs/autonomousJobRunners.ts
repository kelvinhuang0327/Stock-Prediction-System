import { prisma } from '../prisma';
import { runAutonomousCycle } from '../autonomous/AutonomousOrchestrator';
import { buildReviewReport } from '../autonomous/ReviewEngine';
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
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
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

async function runMonitorRunner(context: JobRunnerContext): Promise<JobRunnerOutput<MonitorCyclePayload>> {
  void context;
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
    note: latestSnapshot ? 'monitor snapshot refreshed' : 'no autonomous snapshot yet',
  };

  return {
    summary: buildJobSummary('monitor cycle', payload as unknown as Record<string, unknown>),
    metadata: toMetadataRecord(payload as unknown as Record<string, unknown>),
    payload,
  };
}

async function runReviewRunner(context: JobRunnerContext): Promise<JobRunnerOutput<ReviewCyclePayload>> {
  void context;
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

async function runLearningRunner(context: JobRunnerContext): Promise<JobRunnerOutput<LearningCyclePayload>> {
  void context;
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
