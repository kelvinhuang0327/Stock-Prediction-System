jest.mock('../../prisma', () => ({
  prisma: {
    simulatedTrade: { count: jest.fn(), findMany: jest.fn() },
    autonomousResearchSnapshot: { findFirst: jest.fn(), findUnique: jest.fn() },
    tradeReviewReport: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    tradeJournalEntry: { findUnique: jest.fn() },
    optimizationInsightRecord: { count: jest.fn() },
  },
}));

jest.mock('../../autonomous/AutonomousOrchestrator', () => ({ runAutonomousCycle: jest.fn() }));
jest.mock('../../autonomous/ReviewEngine', () => ({ buildReviewReport: jest.fn() }));
jest.mock('../../autonomous/StrategyLearningEngine', () => ({
  buildStrategyLearningInsight: jest.fn(),
  persistStrategyLearningInsight: jest.fn(),
}));
jest.mock('../../training/TrainingScheduler', () => ({
  runIntradayMonitorLayer: jest.fn(),
  runDailyCycleLayer: jest.fn(),
  runNightlyOptLayer: jest.fn(),
  runWeeklyDeepLayer: jest.fn(),
}));
jest.mock('../../market/twTradingCalendar', () => ({
  isTaiwanTradingDay: jest.fn(),
  toTaiwanDateIso: jest.fn(),
}));
jest.mock('../TaiwanStockJobOrchestrator', () => ({ runTaiwanStockTask: jest.fn() }));
jest.mock('../../agent-orchestrator/profile', () => ({ loadProjectProfile: jest.fn() }));
jest.mock('../../agent-orchestrator/storage', () => ({ loadSchedulerState: jest.fn(), loadTaskIndex: jest.fn() }));
jest.mock('../../agent-orchestrator/tasks', () => ({ createQueuedTask: jest.fn() }));
jest.mock('../../agent-orchestrator/optimizationMiner', () => ({
  runCompositeOptimizationMiner: jest.fn(),
  runOptimizationMiner: jest.fn(),
}));
jest.mock('../../agent-orchestrator/workerTick', () => ({ runWorkerTick: jest.fn() }));
jest.mock('../../autonomous/InsightIntegrationLayer', () => ({ processCompletedOptimizationTaskFromFS: jest.fn() }));
jest.mock('../TaiwanSelfOptimizationAudit', () => ({ generateTaiwanSelfAuditReport: jest.fn() }));
jest.mock('../runJobWithOrchestration', () => ({ runJobWithOrchestration: jest.fn() }));

import { prisma } from '../../prisma';
import { runAutonomousCycle } from '../../autonomous/AutonomousOrchestrator';
import { buildReviewReport } from '../../autonomous/ReviewEngine';
import { buildStrategyLearningInsight, persistStrategyLearningInsight } from '../../autonomous/StrategyLearningEngine';
import {
  runDailyCycleLayer,
  runIntradayMonitorLayer,
  runNightlyOptLayer,
  runWeeklyDeepLayer,
} from '../../training/TrainingScheduler';
import { isTaiwanTradingDay, toTaiwanDateIso } from '../../market/twTradingCalendar';
import { runTaiwanStockTask } from '../TaiwanStockJobOrchestrator';
import { loadProjectProfile } from '../../agent-orchestrator/profile';
import { loadSchedulerState, loadTaskIndex } from '../../agent-orchestrator/storage';
import { createQueuedTask } from '../../agent-orchestrator/tasks';
import { runCompositeOptimizationMiner, runOptimizationMiner } from '../../agent-orchestrator/optimizationMiner';
import { runWorkerTick } from '../../agent-orchestrator/workerTick';
import { processCompletedOptimizationTaskFromFS } from '../../autonomous/InsightIntegrationLayer';
import { runJobWithOrchestration } from '../runJobWithOrchestration';
import {
  runAutonomousDailyCycle,
  runAutonomousLearningCycle,
  runAutonomousMonitorCycle,
  runAutonomousReviewCycle,
  runTrainingDailyCycle,
  runTrainingIntradayMonitorCycle,
  runTrainingNightlyOpt,
  runTrainingTaiwanDataSync,
  runTrainingTaiwanInsightIngest,
  runTrainingTaiwanOptimizationMiner,
  runTrainingTaiwanReport,
  runTrainingTaiwanScreen,
  runTrainingTaiwanSelfAudit,
  runTrainingTaiwanSnapshot,
  runTrainingTaiwanWeeklyDeepResearch,
  runTrainingTaiwanWorkerCycle,
  runTrainingWeeklyDeep,
} from '../autonomousJobRunners';

const mockRunJob = runJobWithOrchestration as jest.Mock;
const mockPrisma = prisma as unknown as {
  simulatedTrade: { count: jest.Mock; findMany: jest.Mock };
  autonomousResearchSnapshot: { findFirst: jest.Mock; findUnique: jest.Mock };
  tradeReviewReport: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
  tradeJournalEntry: { findUnique: jest.Mock };
  optimizationInsightRecord: { count: jest.Mock };
};
const mockRunAutonomousCycle = runAutonomousCycle as jest.Mock;
const mockBuildReviewReport = buildReviewReport as jest.Mock;
const mockBuildLearning = buildStrategyLearningInsight as jest.Mock;
const mockPersistLearning = persistStrategyLearningInsight as jest.Mock;
const mockIntraday = runIntradayMonitorLayer as jest.Mock;
const mockDaily = runDailyCycleLayer as jest.Mock;
const mockNightly = runNightlyOptLayer as jest.Mock;
const mockWeekly = runWeeklyDeepLayer as jest.Mock;
const mockIsTradingDay = isTaiwanTradingDay as jest.Mock;
const mockTaiwanDate = toTaiwanDateIso as jest.Mock;
const mockTaiwanTask = runTaiwanStockTask as jest.Mock;
const mockLoadProfile = loadProjectProfile as jest.Mock;
const mockLoadScheduler = loadSchedulerState as jest.Mock;
const mockLoadIndex = loadTaskIndex as jest.Mock;
const mockCreateTask = createQueuedTask as jest.Mock;
const mockCompositeMiner = runCompositeOptimizationMiner as jest.Mock;
const mockSingleMiner = runOptimizationMiner as jest.Mock;
const mockWorkerTick = runWorkerTick as jest.Mock;
const mockProcessInsight = processCompletedOptimizationTaskFromFS as jest.Mock;

const scheduledFor = new Date('2026-11-10T03:00:00.000Z');
const options = { triggerSource: 'local_scheduler' as const, scheduledFor };

function taskResult(jobName: string, status: string = 'success', skipped = false) {
  return {
    jobRun: {
      id: 17,
      jobName,
      status,
      summary: `${jobName} done`,
      errorMessage: status === 'failed' ? `${jobName} failed` : null,
    },
    skipped,
    outcome: { imported: 1 },
  };
}

describe('autonomous job runner core flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (!globalThis.structuredClone) {
      Object.defineProperty(globalThis, 'structuredClone', {
        configurable: true,
        value: (value: unknown) => JSON.parse(JSON.stringify(value)),
      });
    }
    mockRunJob.mockImplementation(async (input, runner) => {
      const context = {
        jobName: input.job.jobName,
        scheduledFor: input.scheduledFor ?? scheduledFor,
        triggerSource: input.triggerSource,
        runMode: input.runMode ?? 'live_run',
        force: input.force ?? false,
      };
      try {
        const output = await runner(context);
        return {
          jobRun: { jobName: input.job.jobName, status: output.finalStatus ?? 'success' },
          skipped: output.finalStatus === 'skipped',
          reason: output.skipReason,
          outcome: output.payload ?? null,
        };
      } catch (error) {
        return {
          jobRun: { jobName: input.job.jobName, status: 'failed' },
          skipped: false,
          reason: error instanceof Error ? error.message : String(error),
          outcome: null,
        };
      }
    });
    mockRunAutonomousCycle.mockResolvedValue({
      snapshot: { snapshotId: 11 }, proposals: [{}], orders: [{}, {}], reviewReports: [{}], learningInsight: { id: 9 },
    });
    mockPrisma.simulatedTrade.count.mockResolvedValue(4);
    mockPrisma.simulatedTrade.findMany.mockResolvedValue([]);
    mockPrisma.autonomousResearchSnapshot.findFirst.mockResolvedValue(null);
    mockPrisma.autonomousResearchSnapshot.findUnique.mockResolvedValue(null);
    mockPrisma.tradeReviewReport.findMany.mockResolvedValue([]);
    mockPrisma.tradeReviewReport.findUnique.mockResolvedValue(null);
    mockPrisma.tradeReviewReport.create.mockResolvedValue({});
    mockPrisma.tradeJournalEntry.findUnique.mockResolvedValue(null);
    mockBuildReviewReport.mockReturnValue({
      triggerType: 'closed_trade', preTrade: {}, result: {}, analysis: {}, issues: [], recommendations: [],
    });
    mockBuildLearning.mockResolvedValue(null);
    mockPersistLearning.mockResolvedValue({ id: 12, sourceCount: 3 });
    mockIntraday.mockResolvedValue({ summary: 'intraday', metadata: { count: 1 } });
    mockDaily.mockResolvedValue({ summary: 'daily', metadata: { date: 'today' } });
    mockNightly.mockResolvedValue({ summary: 'nightly', metadata: { optimized: true } });
    mockWeekly.mockResolvedValue({ summary: 'weekly', tasksCreated: 2, metadata: { recoveryEvents: 1 } });
    mockIsTradingDay.mockReturnValue(true);
    mockTaiwanDate.mockReturnValue('2026-11-10');
    mockTaiwanTask.mockImplementation(async ({ taskName }) => taskResult(taskName));
    mockLoadProfile.mockResolvedValue({ project: 'test' });
    mockLoadScheduler.mockResolvedValue({
      paths: { taskRoot: '/tmp/tasks' },
      state: { schedulerEnabled: true, plannerProvider: 'codex', workerProvider: 'copilot-daemon' },
    });
    mockLoadIndex.mockResolvedValue({ tasks: [] });
    mockCreateTask.mockResolvedValue({ taskId: 31 });
    mockCompositeMiner.mockResolvedValue(null);
    mockSingleMiner.mockResolvedValue(null);
    mockWorkerTick.mockResolvedValue({ status: 'success', taskId: 25, reason: 'completed' });
    mockPrisma.optimizationInsightRecord.count.mockResolvedValue(2);
  });

  test('daily cycle passes the scheduled date and summarizes its result', async () => {
    const result = await runAutonomousDailyCycle(options);

    expect(mockRunAutonomousCycle).toHaveBeenCalledWith({ simulationDate: scheduledFor });
    expect(result.outcome).toMatchObject({ snapshot: { snapshotId: 11 } });
    expect(mockRunJob.mock.calls[0][0].metadata).toEqual({ mode: 'daily' });
  });

  test('monitor counts open trades, eligible unreviewed closes, and closed-market reasons', async () => {
    mockPrisma.autonomousResearchSnapshot.findFirst.mockResolvedValue({ id: 8, snapshotDate: '2026-11-09' });
    mockPrisma.simulatedTrade.findMany.mockResolvedValue([
      { id: 1, pnlPct: 1, status: 'closed', exitReason: 'time' },
      { id: 2, pnlPct: 5, status: 'closed', exitReason: 'target' },
      { id: 3, pnlPct: 2.9, status: 'shadow-closed', exitReason: 'target' },
      { id: 4, pnlPct: -6, status: 'closed', exitReason: 'stop' },
    ]);
    mockPrisma.tradeReviewReport.findMany.mockResolvedValue([{ tradeId: 4 }]);
    mockIsTradingDay.mockReturnValue(false);
    mockTaiwanDate.mockReturnValue('2026-11-08');

    const result = await runAutonomousMonitorCycle(options);

    expect(result.outcome).toMatchObject({
      openTrades: 4,
      closedTradesAwaitingReview: 2,
      latestSnapshotId: 8,
      note: expect.stringContaining('weekend'),
    });
  });

  test('monitor explains missing snapshots and trading-day refreshes', async () => {
    const missing = await runAutonomousMonitorCycle(options);
    expect(missing.outcome).toMatchObject({ latestSnapshotId: null, note: 'no autonomous snapshot yet' });

    mockPrisma.autonomousResearchSnapshot.findFirst.mockResolvedValue({ id: 9, snapshotDate: null });
    mockIsTradingDay.mockReturnValue(true);
    const tradingDay = await runAutonomousMonitorCycle(options);
    expect(tradingDay.outcome).toMatchObject({ note: 'monitor snapshot refreshed' });
  });

  test('review cycle creates reports for time and threshold exits, skips existing and small trades', async () => {
    mockPrisma.simulatedTrade.findMany.mockResolvedValue([
      { id: 1, pnlPct: 1, status: 'closed', exitReason: 'time', symbol: 'AAA', setupType: 'swing', snapshotId: 10, marketContext: '{bad' },
      { id: 2, pnlPct: -5, status: 'closed', exitReason: 'stop', symbol: 'BBB', setupType: 'swing', snapshotId: 11, marketContext: '{"marketState":"trending"}' },
      { id: 3, pnlPct: 3, status: 'shadow-closed', exitReason: 'target', symbol: 'CCC', setupType: 'shadow', snapshotId: 12 },
      { id: 4, pnlPct: 4.9, status: 'closed', exitReason: 'target', symbol: 'DDD', setupType: 'swing', snapshotId: 13 },
      { id: 5, pnlPct: 7, status: 'closed', exitReason: 'target', symbol: 'EEE', setupType: 'swing', snapshotId: 14 },
    ]);
    mockPrisma.tradeReviewReport.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.tradeId === 3 ? { id: 80 } : null));
    mockPrisma.tradeJournalEntry.findUnique.mockResolvedValue({ decisionReasoning: 'journal thesis' });
    mockPrisma.autonomousResearchSnapshot.findUnique.mockResolvedValue({ dataCoverage: 'complete' });

    const result = await runAutonomousReviewCycle(options);

    expect(result.outcome).toMatchObject({ createdReports: 3, skippedExisting: 1, reviewedTradeIds: [1, 2, 5] });
    expect(mockPrisma.tradeReviewReport.create).toHaveBeenCalledTimes(3);
    expect(mockBuildReviewReport).toHaveBeenCalledWith(expect.objectContaining({
      tradeId: 1,
      marketState: 'defensive',
      dataCoverage: 'complete',
      thesis: 'journal thesis',
    }));
  });

  test('review cycle reports when no trades qualify', async () => {
    mockPrisma.simulatedTrade.findMany.mockResolvedValue([]);
    const result = await runAutonomousReviewCycle(options);
    expect(result.outcome).toMatchObject({ createdReports: 0, skippedExisting: 0, note: 'no eligible trades needed review' });
  });

  test('learning cycle handles no source data and persists a generated insight', async () => {
    const empty = await runAutonomousLearningCycle(options);
    expect(empty.outcome).toMatchObject({ insightId: null, sourceCount: 0, note: 'no review data available' });

    mockBuildLearning.mockResolvedValueOnce({ insight: 'new' });
    const refreshed = await runAutonomousLearningCycle(options);
    expect(mockPersistLearning).toHaveBeenCalledWith({ insight: 'new' });
    expect(refreshed.outcome).toMatchObject({ insightId: 12, sourceCount: 3, note: 'learning insight refreshed' });
  });

  test('training layer wrappers forward dates and preserve layer payloads', async () => {
    await expect(runTrainingIntradayMonitorCycle(options)).resolves.toMatchObject({ outcome: { summary: 'intraday' } });
    await expect(runTrainingDailyCycle(options)).resolves.toMatchObject({ outcome: { summary: 'daily' } });
    await expect(runTrainingNightlyOpt(options)).resolves.toMatchObject({ outcome: { summary: 'nightly' } });
    await expect(runTrainingWeeklyDeep(options)).resolves.toMatchObject({ outcome: { summary: 'weekly' } });
    expect(mockDaily).toHaveBeenCalledWith(scheduledFor);
  });

  test('Taiwan data sync includes hourly quotes and reports failed subtask errors', async () => {
    await runTrainingTaiwanDataSync(options);
    expect(mockTaiwanTask.mock.calls.map(([arg]) => arg.taskName)).toEqual([
      'twstock:data_sync_health', 'twstock:quote_sync',
    ]);

    mockTaiwanTask.mockResolvedValueOnce(taskResult('twstock:data_sync_health', 'failed'));
    const failed = await runTrainingTaiwanDataSync({
      ...options,
      scheduledFor: new Date('2026-11-10T03:15:00.000Z'),
    });
    expect(failed.jobRun.status).toBe('failed');
    expect(failed.reason).toContain('twstock:data_sync_health failed');
  });

  test('Taiwan snapshot, screening, and report dispatch the expected task contract', async () => {
    await runTrainingTaiwanSnapshot(options);
    await runTrainingTaiwanScreen(options);
    await runTrainingTaiwanReport(options);

    expect(mockTaiwanTask.mock.calls.map(([arg]) => arg.taskName)).toEqual([
      'twstock:daily_market_snapshot', 'twstock:candidate_screening_dry_run', 'twstock:daily_report',
    ]);
    expect(mockTaiwanTask.mock.calls[1][0].dryRun).toBe(true);
  });

  test('Taiwan optimization miner queues composite and single candidates, then skips empty results', async () => {
    mockCompositeMiner.mockResolvedValueOnce({
      dedupeKey: 'composite-1',
      draft: { objective: 'composite objective', promptMarkdown: 'prompt', contract: {}, plannerContext: {} },
      buckets: [{ picks: [{ sourceType: 'audit' }, { sourceType: 'test' }] }],
      realBuckets: 1,
      fallbackBuckets: 0,
    });
    const composite = await runTrainingTaiwanOptimizationMiner(options);
    expect(composite.outcome).toMatchObject({ createdTaskId: 31, dedupeKey: 'composite-1', mode: 'composite', sources: ['audit', 'test'] });

    mockCompositeMiner.mockRejectedValueOnce(new Error('composite unavailable'));
    mockSingleMiner.mockResolvedValueOnce({
      draft: { objective: 'single objective', promptMarkdown: 'single prompt', contract: {}, plannerContext: {} },
      candidate: { dedupeKey: 'single-1', sourceType: 'coverage', priorityScore: 8 },
      totalMined: 5,
      sourcesActive: ['coverage'],
    });
    const single = await runTrainingTaiwanOptimizationMiner(options);
    expect(single.outcome).toMatchObject({ createdTaskId: 31, dedupeKey: 'single-1', mode: 'single', sources: ['coverage'] });
    expect(mockCreateTask).toHaveBeenCalledTimes(2);

    const skipped = await runTrainingTaiwanOptimizationMiner(options);
    expect(skipped).toMatchObject({ skipped: true, reason: 'no_actionable_candidates', outcome: { mode: 'none' } });
  });

  test('Taiwan worker maps completed, skipped, and failed tick results', async () => {
    const success = await runTrainingTaiwanWorkerCycle(options);
    expect(success.outcome).toMatchObject({ taskId: 25, status: 'success' });

    mockWorkerTick.mockResolvedValueOnce({ status: 'skipped', taskId: null, reason: 'scheduler_disabled' });
    const skipped = await runTrainingTaiwanWorkerCycle(options);
    expect(skipped).toMatchObject({ skipped: true, reason: 'scheduler_disabled' });

    mockWorkerTick.mockResolvedValueOnce({ status: 'failed', taskId: 99, reason: 'worker crashed' });
    const failed = await runTrainingTaiwanWorkerCycle(options);
    expect(failed).toMatchObject({ jobRun: { status: 'failed' }, reason: 'worker crashed' });
  });

  test('Taiwan insight ingest skips empty indexes, deduplicates reports, and clamps negative growth', async () => {
    const empty = await runTrainingTaiwanInsightIngest(options);
    expect(empty).toMatchObject({ skipped: true, reason: 'no_completed_reports' });

    mockLoadIndex.mockResolvedValueOnce({ tasks: [
      { status: 'COMPLETED', plannerContext: { regimeState: 'OPTIMIZATION', dedupeKey: 'same' } },
      { status: 'COMPLETED', plannerContext: { regimeState: 'OPTIMIZATION', dedupeKey: 'same' } },
      { status: 'COMPLETED', plannerContext: { regimeState: 'OTHER', dedupeKey: 'ignored' } },
      { status: 'RUNNING', plannerContext: { regimeState: 'OPTIMIZATION', dedupeKey: 'ignored-too' } },
    ] });
    mockPrisma.optimizationInsightRecord.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3);
    const processed = await runTrainingTaiwanInsightIngest(options);
    expect(mockProcessInsight).toHaveBeenCalledTimes(1);
    expect(mockProcessInsight).toHaveBeenCalledWith('same');
    expect(processed.outcome).toMatchObject({ completedTaskCount: 1, generatedInsightCount: 0 });
  });

  test('Taiwan insight ingest continues when insight count queries fail', async () => {
    mockLoadIndex.mockResolvedValueOnce({ tasks: [
      { status: 'COMPLETED', plannerContext: { regimeState: 'OPTIMIZATION', dedupeKey: 'count-fallback' } },
    ] });
    mockPrisma.optimizationInsightRecord.count
      .mockRejectedValueOnce(new Error('initial count unavailable'))
      .mockRejectedValueOnce(new Error('final count unavailable'));

    const result = await runTrainingTaiwanInsightIngest(options);

    expect(mockProcessInsight).toHaveBeenCalledWith('count-fallback');
    expect(result.outcome).toMatchObject({ completedTaskCount: 1, generatedInsightCount: 0 });
  });

  test('Taiwan weekly deep research skips when the orchestrator scheduler is disabled', async () => {
    mockLoadScheduler.mockResolvedValueOnce({
      paths: { taskRoot: '/tmp/tasks' },
      state: { schedulerEnabled: false },
    });
    const result = await runTrainingTaiwanWeeklyDeepResearch(options);

    expect(result).toMatchObject({ skipped: true, reason: 'scheduler_disabled' });
    expect(mockWeekly).not.toHaveBeenCalled();
  });

  test('Taiwan self-audit returns recommendation count and report metadata', async () => {
    const { generateTaiwanSelfAuditReport } = jest.requireMock('../TaiwanSelfOptimizationAudit');
    generateTaiwanSelfAuditReport.mockResolvedValue({ reportPath: 'reports/audit.json', recommendations: [{ title: 'one' }] });

    const result = await runTrainingTaiwanSelfAudit(options);

    expect(result.outcome).toEqual({ reportPath: 'reports/audit.json', recommendationCount: 1 });
  });
});
