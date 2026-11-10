import { prisma } from '@/lib/prisma';
import { syncService } from '@/lib/services/syncService';
import { syncAndStoreEvents } from '@/lib/events/EventIngestionService';
import { createDailySnapshot } from '@/lib/report/DailySnapshotEngine';
import { runScreen } from '@/lib/screen/StrategyScreenEngine';
import { generateDailyReport } from '@/lib/report/DailyReportEngine';
import { runQualityCheck } from '@/lib/data/DataQualityChecker';
import { JobOrchestrationService } from '../JobOrchestrationService';
import { getTaiwanStockTaskStatuses, runTaiwanStockTask } from '../TaiwanStockJobOrchestrator';

jest.mock('@/lib/prisma', () => ({ prisma: { jobRunLog: { findFirst: jest.fn() } } }));
jest.mock('@/lib/services/syncService', () => ({
  syncService: {
    syncBasicInfo: jest.fn(), syncDailyQuotes: jest.fn(), syncMetrics: jest.fn(),
    syncMarketIndices: jest.fn(), syncInstitutionalChip: jest.fn(), syncRealRevenue: jest.fn(),
  },
}));
jest.mock('@/lib/events/EventIngestionService', () => ({ syncAndStoreEvents: jest.fn() }));
jest.mock('@/lib/report/DailySnapshotEngine', () => ({ createDailySnapshot: jest.fn() }));
jest.mock('@/lib/screen/StrategyScreenEngine', () => ({ runScreen: jest.fn() }));
jest.mock('@/lib/report/DailyReportEngine', () => ({ generateDailyReport: jest.fn() }));
jest.mock('@/lib/data/DataQualityChecker', () => ({ runQualityCheck: jest.fn() }));

const runLogFindFirst = (prisma as unknown as { jobRunLog: { findFirst: jest.Mock } }).jobRunLog.findFirst;
const syncMock = syncService as unknown as Record<string, jest.Mock>;
const syncEventsMock = syncAndStoreEvents as jest.MockedFunction<typeof syncAndStoreEvents>;
const snapshotMock = createDailySnapshot as jest.MockedFunction<typeof createDailySnapshot>;
const screenMock = runScreen as jest.MockedFunction<typeof runScreen>;
const dailyReportMock = generateDailyReport as jest.MockedFunction<typeof generateDailyReport>;
const qualityMock = runQualityCheck as jest.MockedFunction<typeof runQualityCheck>;

const runningRecord = { id: 41, status: 'running' };
const completedRecord = { id: 41, status: 'success' };
const failedRecord = { id: 41, status: 'failed' };

describe('TaiwanStockJobOrchestrator', () => {
  let startRun: jest.SpyInstance;
  let completeRun: jest.SpyInstance;
  let failRun: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    startRun = jest.spyOn(JobOrchestrationService.prototype, 'startJobRun')
      .mockResolvedValue({ run: runningRecord, shouldRun: true, reason: 'new' } as never);
    completeRun = jest.spyOn(JobOrchestrationService.prototype, 'completeJobRun')
      .mockResolvedValue(completedRecord as never);
    failRun = jest.spyOn(JobOrchestrationService.prototype, 'failJobRun')
      .mockResolvedValue(failedRecord as never);
    Object.values(syncMock).forEach((mock) => mock.mockResolvedValue(1));
    syncEventsMock.mockResolvedValue({ events: [], rawCount: 0 } as never);
    snapshotMock.mockResolvedValue({
      marketCreated: true, candidatesCreated: 2, candidatesUpdated: 1,
      watchlistCreated: 1, watchlistUpdated: 0, limitations: [],
    } as never);
    screenMock.mockResolvedValue({
      candidates: [{ symbol: '2330', name: '台積電', alphaScore: 0.9, screenBucket: 'Strong Candidate' }],
      regime: 'Bull', regimeConfidence: 0.85, limitations: [],
    } as never);
    dailyReportMock.mockResolvedValue({
      reportDate: '2026-11-10',
      candidateSummary: { strongCandidates: [{ symbol: '2330' }], watchCandidates: [] },
      eventSummary: { eventCount: 3 },
      marketSummary: { regime: 'Bull' },
    } as never);
    qualityMock.mockResolvedValue({
      overallScore: 90, warnings: [], tables: [{ name: 'Stock' }],
      coverageSummary: {
        totalStocks: 100, stocksWithQuotes: 80, backtestEligible: 40,
        chipAgentActive: 10, quoteLatestDate: '2026-11-10',
      },
    } as never);
    runLogFindFirst.mockResolvedValue(null);
  });

  afterEach(() => jest.restoreAllMocks());

  it('rejects unknown tasks and skips duplicate runs without invoking a runner', async () => {
    await expect(runTaiwanStockTask({ taskName: 'twstock:unknown' as never })).rejects.toThrow('Unknown taiwan-stock task');
    expect(startRun).not.toHaveBeenCalled();

    startRun.mockResolvedValueOnce({ run: completedRecord, shouldRun: false, reason: 'duplicate_success' } as never);
    const skipped = await runTaiwanStockTask({ taskName: 'twstock:quote_sync' });
    expect(skipped).toMatchObject({ skipped: true, skipReason: 'duplicate_success', outcome: null });
    expect(syncMock.syncDailyQuotes).not.toHaveBeenCalled();
  });

  it('runs the health sync with partial failures and reports fulfilled/rejected service calls', async () => {
    syncMock.syncMetrics.mockRejectedValueOnce(new Error('metrics unavailable'));
    syncEventsMock.mockRejectedValueOnce('feed down');
    const result = await runTaiwanStockTask({
      taskName: 'twstock:data_sync_health', triggerSource: 'local_scheduler', force: true,
    });
    expect(result).toMatchObject({ skipped: false, jobRun: completedRecord });
    expect(result.outcome).toEqual(expect.arrayContaining([
      { name: 'stock_master', status: 'fulfilled' },
      { name: 'stock_metrics', status: 'rejected' },
      { name: 'event_sync', status: 'rejected' },
    ]));
    expect(startRun).toHaveBeenCalledWith(expect.objectContaining({ triggerSource: 'local_scheduler', force: true }));
    expect(completeRun).toHaveBeenCalledWith(41, expect.objectContaining({
      summary: '資料同步完成：5/7 成功，2 失敗', metadata: expect.objectContaining({ totalJobs: 7, success: 5, failed: 2 }),
    }));
  });

  it('normalizes non-numeric quote counts and formats institutional sync success or failure', async () => {
    syncMock.syncDailyQuotes.mockResolvedValueOnce('not-a-count');
    syncMock.syncMarketIndices.mockResolvedValueOnce(3);
    const quote = await runTaiwanStockTask({ taskName: 'twstock:quote_sync' });
    expect(quote.outcome).toMatchObject({ quotesCount: 0, indexCount: 3 });

    syncMock.syncInstitutionalChip.mockResolvedValueOnce({ success: true, count: 7, date: '2026-11-10' });
    const chipSuccess = await runTaiwanStockTask({ taskName: 'twstock:institutional_chip_sync' });
    expect(chipSuccess.outcome).toMatchObject({ success: true, count: 7 });

    syncMock.syncInstitutionalChip.mockResolvedValueOnce({ success: false, count: 0, date: '', error: 'feed down' });
    const chipFailure = await runTaiwanStockTask({ taskName: 'twstock:institutional_chip_sync' });
    expect(chipFailure.jobRun).toBe(completedRecord);
    expect(completeRun).toHaveBeenLastCalledWith(41, expect.objectContaining({ summary: '籌碼同步失敗：feed down' }));
  });

  it('runs snapshots, dry-run screening, and persisted screening with isolated dry-run keys', async () => {
    const snapshot = await runTaiwanStockTask({ taskName: 'twstock:daily_market_snapshot' });
    expect(snapshot.outcome).toMatchObject({ candidatesCreated: 2 });
    expect(snapshotMock).toHaveBeenCalledWith({ forceRefresh: false });

    const scheduledFor = new Date('2026-11-10T00:00:00.000Z');
    await runTaiwanStockTask({ taskName: 'twstock:candidate_screening', dryRun: true, scheduledFor });
    expect(startRun).toHaveBeenLastCalledWith(expect.objectContaining({
      jobName: 'twstock:candidate_screening',
      idempotencyKey: expect.stringContaining('twstock:candidate_screening_dry_run:2026-11-10T00:00:00.001Z'),
      metadata: expect.objectContaining({ dryRun: true }),
    }));
    expect(screenMock).toHaveBeenCalledWith({ dryRun: true });

    await runTaiwanStockTask({ taskName: 'twstock:candidate_screening', scheduledFor });
    expect(snapshotMock).toHaveBeenLastCalledWith({ forceRefresh: false });
    expect(completeRun).toHaveBeenLastCalledWith(41, expect.objectContaining({ summary: '候選股篩選完成：2 新增，1 更新' }));

    const dedicatedPreview = await runTaiwanStockTask({ taskName: 'twstock:candidate_screening_dry_run', scheduledFor });
    expect(dedicatedPreview.outcome).toMatchObject({ candidates: expect.any(Array) });
    expect(startRun).toHaveBeenLastCalledWith(expect.objectContaining({
      idempotencyKey: expect.stringContaining('twstock:candidate_screening_dry_run:2026-11-10T00:00:00.001Z'),
    }));
  });

  it('formats report defaults, data-quality grades, and runner failures', async () => {
    dailyReportMock.mockResolvedValueOnce({ reportDate: 'today', marketSummary: {}, candidateSummary: null, eventSummary: null } as never);
    const report = await runTaiwanStockTask({ taskName: 'twstock:daily_report' });
    expect(report.outcome).toEqual({ reportDate: 'today', regime: undefined });
    expect(completeRun).toHaveBeenLastCalledWith(41, expect.objectContaining({
      metadata: expect.objectContaining({ strongCandidates: 0, watchCandidates: 0, eventCount: 0 }),
    }));

    for (const [score, grade] of [[80, 'A'], [60, 'B'], [40, 'C'], [39, 'D']] as const) {
      qualityMock.mockResolvedValueOnce({
        overallScore: score, warnings: [], tables: [],
        coverageSummary: { totalStocks: 1, stocksWithQuotes: 1, backtestEligible: 1, chipAgentActive: 1, quoteLatestDate: null },
      } as never);
      const quality = await runTaiwanStockTask({ taskName: 'twstock:data_quality_check' });
      expect(quality.outcome).toMatchObject({ grade, overallScore: score });
    }

    screenMock.mockRejectedValueOnce(new Error('screen failed'));
    const failed = await runTaiwanStockTask({ taskName: 'twstock:candidate_screening_dry_run' });
    expect(failed).toMatchObject({ skipped: false, outcome: null, jobRun: failedRecord });
    expect(failRun).toHaveBeenCalledWith(41, expect.objectContaining({ error: expect.any(Error) }));
  });

  it('lists all task statuses with nullable run metadata and scheduler labels', async () => {
    runLogFindFirst.mockImplementation(async (input: { where: { jobName: string; status?: string } }) => {
      if (input.where.status === 'success') {
        return input.where.jobName === 'twstock:quote_sync'
          ? { status: 'success' }
          : null;
      }
      return input.where.jobName === 'twstock:data_sync_health'
        ? {
            id: 12, status: 'failed', startedAt: new Date('2026-11-10T01:00:00Z'),
            finishedAt: new Date('2026-11-10T01:05:00Z'), summary: 'failure',
            errorMessage: 'timeout', triggerSource: 'scheduler',
          }
        : null;
    });

    const statuses = await getTaiwanStockTaskStatuses();
    expect(statuses).toHaveLength(8);
    expect(statuses[0]).toMatchObject({
      taskName: 'twstock:data_sync_health', scheduleLabel: '每 30 分鐘',
      latestRun: { id: 12, durationMs: 300_000, errorMessage: 'timeout' }, todayRan: false,
    });
    expect(statuses[1]).toMatchObject({ taskName: 'twstock:quote_sync', scheduleLabel: '每 1 小時', todayRan: true, todayStatus: 'success' });
    expect(statuses.find((task) => task.taskName === 'twstock:institutional_chip_sync')?.scheduleLabel).toBeNull();
    expect(statuses.every((task) => task.nextRunAt === null || Number.isFinite(Date.parse(task.nextRunAt)))).toBe(true);
    expect(runLogFindFirst).toHaveBeenCalledTimes(16);
  });
});
