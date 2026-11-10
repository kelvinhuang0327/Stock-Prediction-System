/** @jest-environment node */

export {};

const mockDailyMarketFindUnique = jest.fn();
const mockDailyMarketUpsert = jest.fn();
const mockDailyMarketCount = jest.fn();
const mockDailyMarketFindFirst = jest.fn();
const mockDailyMarketFindMany = jest.fn();
const mockDailyCandidateFindUnique = jest.fn();
const mockDailyCandidateCreate = jest.fn();
const mockDailyCandidateUpdate = jest.fn();
const mockDailyCandidateCount = jest.fn();
const mockDailyCandidateFindMany = jest.fn();
const mockDailyWatchlistFindUnique = jest.fn();
const mockDailyWatchlistCreate = jest.fn();
const mockDailyWatchlistUpdate = jest.fn();
const mockDailyWatchlistCount = jest.fn();
const mockDailyWatchlistFindMany = jest.fn();
const mockWatchlistFindMany = jest.fn();
const mockStockQuoteFindMany = jest.fn();
const mockGenerateDailyReport = jest.fn();
const mockRunScreen = jest.fn();
const mockFuseBatch = jest.fn();

jest.mock('@/lib/prisma', () => ({
    prisma: {
        dailyMarketSnapshot: {
            findUnique: mockDailyMarketFindUnique,
            upsert: mockDailyMarketUpsert,
            count: mockDailyMarketCount,
            findFirst: mockDailyMarketFindFirst,
            findMany: mockDailyMarketFindMany,
        },
        dailyCandidateSnapshot: {
            findUnique: mockDailyCandidateFindUnique,
            create: mockDailyCandidateCreate,
            update: mockDailyCandidateUpdate,
            count: mockDailyCandidateCount,
            findMany: mockDailyCandidateFindMany,
        },
        dailyWatchlistSnapshot: {
            findUnique: mockDailyWatchlistFindUnique,
            create: mockDailyWatchlistCreate,
            update: mockDailyWatchlistUpdate,
            count: mockDailyWatchlistCount,
            findMany: mockDailyWatchlistFindMany,
        },
        watchlist: { findMany: mockWatchlistFindMany },
        stockQuote: { findMany: mockStockQuoteFindMany },
    },
}));

jest.mock('../DailyReportEngine', () => ({ generateDailyReport: mockGenerateDailyReport }));
jest.mock('@/lib/screen/StrategyScreenEngine', () => ({ runScreen: mockRunScreen }));
jest.mock('@/lib/alpha/SignalFusionEngine', () => ({ fuseBatch: mockFuseBatch }));

function report(reportDate = '2026-11-10', regime = 'Bull', confidence = 70) {
    return { reportDate, marketSummary: { regime, regimeConfidence: confidence, limitations: [] } };
}

function candidate(symbol: string, marketContext: string, alphaScore: number) {
    return {
        symbol,
        name: `${symbol} Inc.`,
        alphaScore,
        marketContext,
        recommendationBucket: marketContext,
        confidence: 80,
        screenBucket: marketContext,
        whyIncluded: [],
        topFactors: [],
        keyRisks: [],
        dataCoverage: 'full',
    };
}

describe('DailySnapshotEngine', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGenerateDailyReport.mockResolvedValue(report());
        mockRunScreen.mockResolvedValue({ candidates: [] });
        mockFuseBatch.mockResolvedValue([]);
        mockDailyMarketFindFirst.mockResolvedValue(null);
        mockDailyMarketFindUnique.mockResolvedValue(null);
        mockDailyMarketUpsert.mockResolvedValue({});
        mockDailyCandidateFindUnique.mockResolvedValue(null);
        mockDailyCandidateCreate.mockResolvedValue({});
        mockDailyCandidateUpdate.mockResolvedValue({});
        mockDailyWatchlistFindUnique.mockResolvedValue(null);
        mockDailyWatchlistCreate.mockResolvedValue({});
        mockDailyWatchlistUpdate.mockResolvedValue({});
        mockWatchlistFindMany.mockResolvedValue([]);
        mockStockQuoteFindMany.mockResolvedValue([]);
    });

    it('creates market, candidate, and watchlist snapshots and upserts existing rows on refresh', async () => {
        mockDailyMarketFindUnique.mockResolvedValue({ snapshotDate: '2026-11-10' });
        mockDailyCandidateFindUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 2 });
        mockDailyWatchlistFindUnique.mockResolvedValue({ id: 3 });
        mockRunScreen.mockResolvedValue({ candidates: [candidate('2330', 'Strong Candidate', 80), candidate('2317', 'Watch', 60)] });
        mockWatchlistFindMany.mockResolvedValue([{ stockId: '2330', stock: { name: '台積電' } }]);
        mockFuseBatch.mockResolvedValue([{ symbol: '2330', alphaScore: 60, recommendationBucket: 'Watch', dataCoverage: 'full' }]);
        mockStockQuoteFindMany.mockResolvedValue([{ stockId: '2330', close: 1500 }]);

        const { createDailySnapshot } = await import('../DailySnapshotEngine');
        const result = await createDailySnapshot({ date: '2026-11-10', forceRefresh: true });

        expect(result).toEqual({
            snapshotDate: '2026-11-10', success: true, marketCreated: true,
            candidatesCreated: 1, candidatesUpdated: 1, watchlistCreated: 0, watchlistUpdated: 1, limitations: [],
        });
        expect(mockGenerateDailyReport).toHaveBeenCalledWith({ includeWatchlist: true, candidateLimit: 50 });
        expect(mockDailyMarketUpsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { snapshotDate: '2026-11-10' },
            create: expect.objectContaining({ regime: 'Bull', regimeConfidence: 70 }),
        }));
        expect(mockDailyCandidateCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ symbol: '2330' }) }));
        expect(mockDailyCandidateUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 2 } }));
        expect(mockDailyWatchlistUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 3 } }));
        expect(mockFuseBatch).toHaveBeenCalledWith(['2330']);
    });

    it('records empty scan and watchlist limitations while preserving existing market snapshot', async () => {
        mockDailyMarketFindUnique.mockResolvedValue({ snapshotDate: '2026-11-10' });
        mockRunScreen.mockRejectedValue(new Error('screen offline'));

        const { createDailySnapshot } = await import('../DailySnapshotEngine');
        const result = await createDailySnapshot({ date: '2026-11-10', includeWatchlist: false });

        expect(result).toMatchObject({
            success: true,
            marketCreated: false,
            limitations: ['候選股掃描無結果或失敗'],
        });
        expect(mockDailyMarketUpsert).not.toHaveBeenCalled();
        expect(mockWatchlistFindMany).not.toHaveBeenCalled();
    });

    it('reports an empty watchlist when watchlist snapshots are requested', async () => {
        const { createDailySnapshot } = await import('../DailySnapshotEngine');
        const result = await createDailySnapshot({ date: '2026-11-10' });

        expect(result.limitations).toEqual(['候選股掃描無結果或失敗', '自選清單為空']);
        expect(mockDailyMarketUpsert).toHaveBeenCalledTimes(1);
    });

    it('returns a failure result if report generation fails', async () => {
        mockGenerateDailyReport.mockRejectedValue(new Error('report unavailable'));

        const { createDailySnapshot } = await import('../DailySnapshotEngine');
        const result = await createDailySnapshot({ date: '2026-11-10' });

        expect(result).toMatchObject({
            success: false,
            marketCreated: false,
            limitations: ['Snapshot 產生失敗: report unavailable'],
        });
        expect(mockDailyMarketFindUnique).not.toHaveBeenCalled();
    });

    it('returns counts and sorted available snapshot dates', async () => {
        mockDailyMarketCount.mockResolvedValue(3);
        mockDailyCandidateCount.mockResolvedValue(5);
        mockDailyWatchlistCount.mockResolvedValue(2);
        mockDailyMarketFindFirst.mockResolvedValue({ snapshotDate: '2026-11-10' });
        mockDailyMarketFindMany.mockResolvedValue([{ snapshotDate: '2026-11-10' }, { snapshotDate: '2026-11-09' }]);

        const { getSnapshotStatus } = await import('../DailySnapshotEngine');
        await expect(getSnapshotStatus()).resolves.toEqual({
            latestDate: '2026-11-10', totalMarketSnapshots: 3, totalCandidateSnapshots: 5,
            totalWatchlistSnapshots: 2, availableDates: ['2026-11-10', '2026-11-09'],
        });
    });

    it('returns unavailable comparisons until a previous market snapshot exists', async () => {
        const { buildComparison } = await import('../DailySnapshotEngine');
        const result = await buildComparison(report() as never, [] as never[]);

        expect(result.comparisonAvailable).toBe(false);
        expect(result.previousSnapshotDate).toBeNull();
        expect(result.market.currentRegime).toBe('Bull');
        expect(result.candidates.newStrongCandidates).toEqual([]);
        expect(result.watchlist.riskEscalated).toEqual([]);
        expect(mockDailyCandidateFindMany).not.toHaveBeenCalled();
    });

    it('compares market, candidate buckets, and watchlist score and risk changes', async () => {
        mockDailyMarketFindFirst.mockResolvedValue({ snapshotDate: '2026-11-09', regime: 'Bear', regimeConfidence: 55 });
        mockDailyCandidateFindMany.mockResolvedValue([
            { symbol: 'OLD', name: null, alphaScore: 75, screenBucket: 'Strong Candidate' },
            { symbol: 'UP', name: 'Up Inc.', alphaScore: 50, screenBucket: 'Neutral' },
            { symbol: 'DOWN', name: 'Down Inc.', alphaScore: 70, screenBucket: 'Strong Candidate' },
        ]);
        mockDailyWatchlistFindMany.mockResolvedValue([
            { symbol: '2330', name: '台積電', alphaScore: 50, recommendationBucket: 'Neutral', riskLevel: 'moderate' },
            { symbol: '2317', name: '鴻海', alphaScore: 80, recommendationBucket: 'Strong Candidate', riskLevel: 'low' },
            { symbol: '2454', name: '聯發科', alphaScore: null, recommendationBucket: 'Neutral', riskLevel: 'moderate' },
        ]);
        mockWatchlistFindMany.mockResolvedValue([
            { stockId: '2330', stock: { name: '台積電' } },
            { stockId: '2317', stock: { name: '鴻海' } },
            { stockId: '2454', stock: null },
        ]);
        mockFuseBatch.mockResolvedValue([
            { symbol: '2330', alphaScore: 60, recommendationBucket: 'Strong Candidate' },
            { symbol: '2317', alphaScore: 30, recommendationBucket: 'Insufficient Data' },
        ]);

        const { buildComparison } = await import('../DailySnapshotEngine');
        const result = await buildComparison(
            report('2026-11-10', 'Bull', 70) as never,
            [
                candidate('NEW', 'Strong Candidate', 85),
                candidate('UP', 'Watch', 60),
                candidate('DOWN', 'Avoid', 20),
            ] as never[],
        );

        expect(result.comparisonAvailable).toBe(true);
        expect(result.market).toMatchObject({ previousDate: '2026-11-09', regimeChanged: true, confidenceDelta: 15 });
        expect(result.market.note).toContain('由 Bear 轉為 Bull');
        expect(result.candidates.newStrongCandidates).toEqual([{ symbol: 'NEW', name: 'NEW Inc.', alphaScore: 85 }]);
        expect(result.candidates.removedStrongCandidates).toEqual([
            { symbol: 'OLD', name: 'OLD', previousAlpha: 75 },
            { symbol: 'DOWN', name: 'Down Inc.', previousAlpha: 70 },
        ]);
        expect(result.candidates.bucketUpgrades[0]).toMatchObject({ symbol: 'UP', alphaDelta: 10 });
        expect(result.candidates.bucketDowngrades[0]).toMatchObject({ symbol: 'DOWN', alphaDelta: -50 });
        expect(result.watchlist.scoreImproved[0]).toMatchObject({ symbol: '2330', alphaDelta: 10 });
        expect(result.watchlist.scoreDropped[0]).toMatchObject({ symbol: '2317', alphaDelta: -50 });
        expect(result.watchlist.newlyInsufficientData).toEqual(['2317']);
        expect(result.watchlist.riskEscalated.map(item => item.symbol)).toEqual(['2317', '2454']);
    });

    it('handles empty previous and current watchlists, and fusion failures', async () => {
        mockDailyMarketFindFirst.mockResolvedValue({ snapshotDate: '2026-11-09', regime: 'Bull', regimeConfidence: 70 });
        mockDailyCandidateFindMany.mockResolvedValue([]);
        mockDailyWatchlistFindMany.mockResolvedValueOnce([]);

        const { buildComparison } = await import('../DailySnapshotEngine');
        const noPreviousWatchlist = await buildComparison(report() as never, [] as never[]);
        expect(noPreviousWatchlist.watchlist).toMatchObject({ available: false, note: '前日自選清單快照為空。' });

        mockDailyWatchlistFindMany.mockResolvedValueOnce([{ symbol: '2330', name: '台積電', alphaScore: 50, recommendationBucket: 'Neutral', riskLevel: 'moderate' }]);
        mockWatchlistFindMany.mockResolvedValueOnce([]);
        const emptyCurrentWatchlist = await buildComparison(report() as never, [] as never[]);
        expect(emptyCurrentWatchlist.watchlist).toMatchObject({ available: true, note: '自選清單目前為空。' });

        mockDailyWatchlistFindMany.mockResolvedValueOnce([{ symbol: '2330', name: null, alphaScore: 50, recommendationBucket: 'Neutral', riskLevel: 'moderate' }]);
        mockWatchlistFindMany.mockResolvedValueOnce([{ stockId: '2330', stock: null }]);
        mockFuseBatch.mockRejectedValueOnce(new Error('fusion unavailable'));
        const failedFusion = await buildComparison(report() as never, [] as never[]);
        expect(failedFusion.watchlist.riskEscalated).toEqual([
            { symbol: '2330', name: '2330', previousRisk: 'moderate', currentRisk: 'unknown' },
        ]);
    });
});
