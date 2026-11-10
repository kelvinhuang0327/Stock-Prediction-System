/** @jest-environment node */

export {};

const mockStockFindUnique = jest.fn();
const mockQuoteFindMany = jest.fn();
const mockWatchlistFindFirst = jest.fn();
const mockRevenueFindMany = jest.fn();
const mockFinancialFindMany = jest.fn();
const mockMetricsFindMany = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockRunScreen = jest.fn();
const mockResolveAsOfDate = jest.fn();
const mockDetectRegime = jest.fn();
const mockCalculateTechnicalSignals = jest.fn();
const mockGetStockCoverage = jest.fn();
const mockSafeCandidateLatest = jest.fn();
const mockSafeCandidates = jest.fn();
const mockBuildFundamentalSnapshot = jest.fn();
const mockBuildPeerComparison = jest.fn();
const mockBuildStructurePeerComparison = jest.fn();
const mockBuildStructureMetrics = jest.fn();
const mockBuildEfficiencyMetrics = jest.fn();
const mockBuildRiskOverlay = jest.fn();
const mockBuildCashflowOverlay = jest.fn();
const mockBuildEfficiencyOverlay = jest.fn();
const mockBuildFundamentalMatrix = jest.fn();
const mockBuildPeerPercentile = jest.fn();

jest.mock('next/server', () => ({ NextResponse: { json: (data: unknown) => ({ json: async () => data }) } }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        stock: { findUnique: mockStockFindUnique },
        stockQuote: { findMany: mockQuoteFindMany },
        watchlist: { findFirst: mockWatchlistFindFirst },
        monthlyRevenue: { findMany: mockRevenueFindMany },
        financialReport: { findMany: mockFinancialFindMany },
        stockMetrics: { findMany: mockMetricsFindMany },
    },
}));
jest.mock('@/lib/cache', () => ({ apiCache: { get: mockCacheGet, set: mockCacheSet } }));
jest.mock('@/lib/screen/StrategyScreenEngine', () => ({ runScreen: mockRunScreen }));
jest.mock('@/lib/data/AsOfDataGate', () => ({ resolveAsOfDate: mockResolveAsOfDate }));
jest.mock('@/lib/market/MarketRegimeEngine', () => ({ detectRegime: mockDetectRegime }));
jest.mock('@/lib/analysis/TechnicalSignalCalculator', () => ({ calculateTechnicalSignals: mockCalculateTechnicalSignals }));
jest.mock('@/lib/data/CoverageService', () => ({ getStockCoverage: mockGetStockCoverage }));
jest.mock('@/lib/prisma-safe', () => ({
    safeCandidateSnapshotLatest: mockSafeCandidateLatest,
    safeCandidateSnapshots: mockSafeCandidates,
}));
jest.mock('@/lib/fundamentals/StockFundamentalSnapshot', () => ({ buildStockFundamentalSnapshot: mockBuildFundamentalSnapshot }));
jest.mock('@/lib/fundamentals/FundamentalResearchService', () => ({
    buildFinancialStructurePeerComparisonForSymbol: mockBuildStructurePeerComparison,
    buildCashflowLeverageMetricsFromReports: mockBuildStructureMetrics,
    buildCapitalEfficiencyMetricsFromResearchContext: mockBuildEfficiencyMetrics,
    buildPeerComparisonForSymbol: mockBuildPeerComparison,
}));
jest.mock('@/lib/fundamental/FundamentalRiskOverlayEngine', () => ({ buildFundamentalRiskOverlay: mockBuildRiskOverlay }));
jest.mock('@/lib/fundamental/CashflowLeverageOverlayEngine', () => ({ buildCashflowLeverageOverlay: mockBuildCashflowOverlay }));
jest.mock('@/lib/fundamental/CapitalEfficiencyOverlayEngine', () => ({ buildCapitalEfficiencyOverlay: mockBuildEfficiencyOverlay }));
jest.mock('@/lib/fundamental/FullFundamentalComparisonMatrixBuilder', () => ({ buildFullFundamentalComparisonMatrix: mockBuildFundamentalMatrix }));
jest.mock('@/lib/fundamental/PeerPercentileDetailTableBuilder', () => ({ buildPeerPercentileDetailTable: mockBuildPeerPercentile }));

function makeQuotes(count: number) {
    const start = new Date('2026-01-01T00:00:00.000Z');
    return Array.from({ length: count }, (_, index) => ({
        stockId: '2330',
        date: new Date(start.getTime() + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        close: 100 + index,
        high: 101 + index,
        low: 99 + index,
        volume: 1_000,
    }));
}

describe('GET /api/stocks/[id]/detail', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.clearAllMocks();
        mockCacheGet.mockReturnValue(null);
        mockStockFindUnique.mockResolvedValue(null);
        mockQuoteFindMany.mockResolvedValue([]);
        mockWatchlistFindFirst.mockResolvedValue(null);
        mockRevenueFindMany.mockResolvedValue([]);
        mockFinancialFindMany.mockResolvedValue([]);
        mockMetricsFindMany.mockResolvedValue([]);
        mockRunScreen.mockResolvedValue({ candidates: [], excluded: [] });
        mockResolveAsOfDate.mockImplementation((value?: string) => value ?? '2026-11-10');
        mockDetectRegime.mockResolvedValue(null);
        mockCalculateTechnicalSignals.mockReturnValue(null);
        mockGetStockCoverage.mockResolvedValue({ tier: 'C', tierLabel: '受限分析 (Tier C)', quoteDays: 0, hasChip: false, capabilities: [], limitations: [] });
        mockSafeCandidateLatest.mockResolvedValue(null);
        mockSafeCandidates.mockResolvedValue([]);
        mockBuildFundamentalSnapshot.mockReturnValue({ status: 'insufficient' });
        mockBuildPeerComparison.mockResolvedValue(null);
        mockBuildStructurePeerComparison.mockResolvedValue(null);
        mockBuildStructureMetrics.mockReturnValue({});
        mockBuildEfficiencyMetrics.mockReturnValue({});
        mockBuildRiskOverlay.mockReturnValue({ status: 'unknown' });
        mockBuildCashflowOverlay.mockReturnValue({ status: 'unknown' });
        mockBuildEfficiencyOverlay.mockReturnValue({ status: 'unknown' });
        mockBuildFundamentalMatrix.mockReturnValue({ rows: [] });
        mockBuildPeerPercentile.mockReturnValue({ rows: [] });
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('returns a degraded but complete response when quote history is empty', async () => {
        const { GET } = await import('../route');
        const response = await GET(
            { nextUrl: new URL('http://localhost/api/stocks/2330/detail?asOfDate=2026-05-07') } as never,
            { params: Promise.resolve({ id: '2330' }) },
        );
        const body = await response.json();

        expect(body).toMatchObject({
            symbol: '2330', name: '2330', closePrice: 0, dataPoints: 0, dataCoverage: 'insufficient',
            regime: null, fusion: null, signals: null,
            backtest: { available: false, dataPoints: 0, requiredDays: 100 },
            comparison: { available: false, previousDate: null },
            candidateCtx: { isCandidate: false },
            watchlistCtx: { inWatchlist: false },
            asOfDate: '2026-05-07', asOfGateStatus: 'ACTIVE', asOfGateNote: expect.any(String),
        });
        expect(body.limitations).toEqual(expect.arrayContaining([
            '此股票目前無歷史行情資料，所有分析均不可用',
            '歷史資料少於 20 天，無法執行綜合分析',
        ]));
        expect(mockQuoteFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { stockId: '2330', date: { lte: '20260507' } },
        }));
        expect(mockCacheSet).toHaveBeenCalled();
    });

    it('builds signals, fusion, candidate context, and snapshot comparison for short history', async () => {
        mockStockFindUnique.mockResolvedValue({ id: '2330', name: '台積電', industry: '半導體業' });
        mockQuoteFindMany.mockResolvedValue(makeQuotes(25));
        mockWatchlistFindFirst.mockResolvedValue({ id: 4, quantity: 10, entryPrice: 900 });
        mockGetStockCoverage.mockResolvedValue({ tier: 'B', tierLabel: '有限分析', quoteDays: 25, hasChip: true, capabilities: [], limitations: [] });
        mockDetectRegime.mockResolvedValue({ regime: 'Bull', confidence: 80, dataPoints: 100, samplePeriod: '100d', limitations: [] });
        mockRunScreen.mockResolvedValue({
            candidates: [{
                symbol: '2330', alphaScore: 75, recommendationBucket: 'Strong Candidate', confidence: 80,
                technicalScore: 80, chipScore: 60, fundamentalScore: 70, marketAdjustment: 5,
                usedSources: ['StockQuote'], missingSources: [], riskLevel: 'low', screenBucket: 'Strong Candidate',
                whyIncluded: 'trend', topFactors: ['MA'], keyRisks: [], summary: 'strong', limitations: [],
            }],
            excluded: [],
        });
        mockCalculateTechnicalSignals.mockReturnValue({
            signal: 'BUY', strength: 80, signalDate: '2026-01-25', dataPeriod: '2026-01-01 ~ 2026-01-25',
            dataPoints: 25, watchPrice: { price: 120 }, buyPrice: { price: 119 }, stopLoss: { price: 110 },
            targetPrice: { price: 140 }, indicators: [{ name: 'RSI', value: 60, signal: 'neutral', description: 'ok' }],
        });
        mockSafeCandidateLatest.mockResolvedValue({
            screenBucket: 'Watch', whyIncluded: 'history', topFactors: '["MA"]', keyRisks: ['volatility'], snapshotDate: '2026-01-25',
        });
        mockSafeCandidates.mockResolvedValue([
            { alphaScore: 70, screenBucket: 'Strong Candidate', dataCoverage: 'limited', snapshotDate: '2026-01-25' },
            { alphaScore: 60, screenBucket: 'Watch', dataCoverage: 'full', snapshotDate: '2026-01-24' },
        ]);

        const { GET } = await import('../route');
        const response = await GET(
            { nextUrl: new URL('http://localhost/api/stocks/2330/detail') } as never,
            { params: Promise.resolve({ id: '2330' }) },
        );
        const body = await response.json();

        expect(body).toMatchObject({
            symbol: '2330', name: '台積電', industry: '半導體業', closePrice: 124,
            dataPoints: 25, dataCoverage: 'insufficient', regime: { regime: 'Bull' },
            fusion: { alphaScore: 75, screenBucket: 'Strong Candidate' },
            signals: { signal: 'BUY', dataPoints: 25 },
            backtest: { available: false, dataPoints: 25 },
            candidateCtx: { isCandidate: true, topFactors: ['MA'], snapshotDate: '2026-01-25' },
            watchlistCtx: { inWatchlist: true, watchlistId: '4', holdingShares: 10, holdingCost: 900 },
            comparison: { available: true, alphaDelta: 10, bucketChanged: true, dataCoverageChanged: true },
        });
        expect(mockRunScreen).toHaveBeenCalledWith(expect.objectContaining({ symbolUniverse: ['2330'], asOf: '20261110' }));
        expect(body.comparison.summaryNote).toContain('Alpha 評分上升 10 分');
    });

    it('serves a cached response without querying the database', async () => {
        mockCacheGet.mockReturnValue({ symbol: '2330', cached: true });
        const { GET } = await import('../route');
        const response = await GET(
            { nextUrl: new URL('http://localhost/api/stocks/2330/detail') } as never,
            { params: Promise.resolve({ id: '2330' }) },
        );

        await expect(response.json()).resolves.toEqual({ symbol: '2330', cached: true });
        expect(mockStockFindUnique).not.toHaveBeenCalled();
    });

    it('uses fallback coverage and preserves snapshot context when optional analysis services fail', async () => {
        mockStockFindUnique.mockResolvedValue({ id: '0050', name: 'Taiwan 50', industry: null });
        mockQuoteFindMany.mockResolvedValue(makeQuotes(60));
        mockGetStockCoverage.mockRejectedValue(new Error('coverage unavailable'));
        mockBuildPeerComparison.mockRejectedValue(new Error('peer service unavailable'));
        mockBuildStructurePeerComparison.mockRejectedValue(new Error('structure service unavailable'));
        mockDetectRegime.mockRejectedValue(new Error('regime unavailable'));
        mockRunScreen.mockResolvedValue({
            candidates: [],
            excluded: [{ symbol: '0050', reason: 'screen policy' }],
        });
        mockCalculateTechnicalSignals.mockImplementation(() => {
            throw new Error('signal calculation failed');
        });
        mockSafeCandidateLatest.mockResolvedValue({
            screenBucket: null,
            whyIncluded: null,
            topFactors: ['momentum'],
            keyRisks: '["volatility"]',
            snapshotDate: '2026-03-01',
        });
        mockSafeCandidates.mockResolvedValue([{ snapshotDate: '2026-03-01' }]);

        const { GET } = await import('../route');
        const response = await GET(
            { nextUrl: new URL('http://localhost/api/stocks/0050/detail') } as never,
            { params: Promise.resolve({ id: '0050' }) },
        );
        const body = await response.json();

        expect(body).toMatchObject({
            symbol: '0050',
            name: 'Taiwan 50',
            industry: '',
            isETF: true,
            dataPoints: 60,
            dataCoverage: 'limited',
            closePrice: 159,
            regime: null,
            fusion: null,
            signals: null,
            backtest: { available: false, requiredDays: 100 },
            candidateCtx: {
                isCandidate: true,
                screenBucket: null,
                whyIncluded: null,
                topFactors: ['momentum'],
                keyRisks: ['volatility'],
            },
            comparison: { available: false, currentDate: '2026-03-01' },
            coverageTier: {
                tier: 'C',
                quoteDays: 60,
                capabilities: {
                    canBacktest: false,
                    canMA200: false,
                    canMA60: true,
                    canBasicSignals: true,
                },
            },
        });
        expect(body.limitations).toEqual(expect.arrayContaining([
            '歷史資料 60 天，部分指標（MA60 等）可能不完整',
            '此股票未進入候選池：screen policy',
            '技術訊號計算失敗',
        ]));
        expect(mockBuildFundamentalSnapshot).toHaveBeenCalledWith(expect.objectContaining({ isETF: true }));
    });

    it('builds a full backtest summary and handles empty snapshot comparisons', async () => {
        mockQuoteFindMany.mockResolvedValue(makeQuotes(200));
        mockDetectRegime.mockResolvedValue(null);
        mockRunScreen.mockResolvedValue({ candidates: [], excluded: [] });
        mockSafeCandidateLatest.mockResolvedValue(null);
        mockSafeCandidates.mockResolvedValue([
            { snapshotDate: '2026-07-19', alphaScore: null, screenBucket: null, dataCoverage: null },
            { snapshotDate: '2026-07-18', alphaScore: null, screenBucket: null, dataCoverage: null },
        ]);
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                summary: { totalReturn: 10, buyAndHoldReturn: 5, maxDrawdown: -4, totalTrades: 8 },
                benchmark: { marketAvailable: true, marketReturn: 12 },
                period: '2026-01-01 ~ 2026-07-19',
                regimeAware: true,
                regimeAwareResult: { summary: { totalReturn: 11 } },
                dataLimitations: ['benchmark limitation'],
            }),
        }) as unknown as typeof fetch;

        const { GET } = await import('../route');
        const response = await GET(
            { nextUrl: new URL('http://localhost/api/stocks/2330/detail') } as never,
            { params: Promise.resolve({ id: '2330' }) },
        );
        const body = await response.json();

        expect(body.dataCoverage).toBe('full');
        expect(body.backtest).toMatchObject({ available: true, dataPoints: 200, buyAndHoldReturn: 199 });
        expect(body.backtestSummary).toMatchObject({
            available: true,
            totalReturn: 10,
            buyAndHoldReturn: 5,
            alphaToBuyAndHold: 5,
            maxDrawdown: -4,
            totalTrades: 8,
            marketBenchmarkAvailable: true,
            marketReturn: 12,
            regimeAwareAvailable: true,
            regimeAwareReturn: 11,
            limitations: ['benchmark limitation'],
        });
        expect(body.comparison).toMatchObject({
            available: true,
            alphaDelta: null,
            bucketChanged: false,
            dataCoverageChanged: false,
            newlyInsufficient: false,
            summaryNote: '與前日快照相比無重大變化',
        });
        expect(mockRunScreen).toHaveBeenCalledWith(expect.objectContaining({ symbolUniverse: ['2330'] }));
        expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/stocks\/backtest$/), expect.objectContaining({ method: 'POST' }));
    });

    it('reports negative snapshot changes and an insufficient backtest response', async () => {
        const quotes = makeQuotes(100);
        quotes[0].close = 0;
        mockQuoteFindMany.mockResolvedValue(quotes);
        mockSafeCandidates.mockResolvedValue([
            { snapshotDate: '2026-04-10', alphaScore: 50, screenBucket: 'Watch', dataCoverage: 'insufficient' },
            { snapshotDate: '2026-04-09', alphaScore: 60, screenBucket: 'Strong Candidate', dataCoverage: 'full' },
        ]);
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({ source: 'insufficient_data', coverage: { message: 'Need more history' } }),
        }) as unknown as typeof fetch;

        const { GET } = await import('../route');
        const response = await GET(
            { nextUrl: new URL('http://localhost/api/stocks/2330/detail') } as never,
            { params: Promise.resolve({ id: '2330' }) },
        );
        const body = await response.json();

        expect(body.comparison).toMatchObject({
            available: true,
            alphaDelta: -10,
            bucketChanged: true,
            dataCoverageChanged: true,
            newlyInsufficient: true,
        });
        expect(body.comparison.summaryNote).toContain('Alpha 評分下降 10 分');
        expect(body.comparison.summaryNote).toContain('資料覆蓋轉為不足');
        expect(body.backtest.buyAndHoldReturn).toBeNull();
        expect(body.backtestSummary.unavailableReason).toBe('Need more history');
    });

    it.each([
        ['http-error', async () => ({ ok: false, json: async () => ({}) }), null],
        ['invalid-json', async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } }), null],
        ['rejected-fetch', () => Promise.reject(new Error('network unavailable')), null],
        ['insufficient-response-without-message', async () => ({ ok: true, json: async () => ({ source: 'insufficient_data', coverage: {} }) }), '回測資料不足'],
        ['synchronous-fetch-error', () => { throw new Error('fetch unavailable'); }, '回測摘要暫時不可用'],
    ])('keeps the backtest unavailable when %s occurs', async (_label, fetchImplementation, reason) => {
        mockQuoteFindMany.mockResolvedValue(makeQuotes(100));
        global.fetch = jest.fn(fetchImplementation) as unknown as typeof fetch;

        const { GET } = await import('../route');
        const response = await GET(
            { nextUrl: new URL('http://localhost/api/stocks/2330/detail') } as never,
            { params: Promise.resolve({ id: '2330' }) },
        );
        const body = await response.json();

        expect(body.backtestSummary.available).toBe(false);
        expect(body.backtestSummary.unavailableReason).toBe(reason);
    });

    it('degrades each base data source independently when database queries fail', async () => {
        mockStockFindUnique.mockRejectedValue(new Error('stock lookup failed'));
        mockQuoteFindMany.mockRejectedValue(new Error('quote lookup failed'));
        mockWatchlistFindFirst.mockRejectedValue(new Error('watchlist lookup failed'));
        mockGetStockCoverage.mockRejectedValue(new Error('coverage lookup failed'));
        mockRevenueFindMany.mockRejectedValue(new Error('revenue lookup failed'));
        mockFinancialFindMany.mockRejectedValue(new Error('financial lookup failed'));
        mockMetricsFindMany.mockRejectedValue(new Error('metrics lookup failed'));

        const { GET } = await import('../route');
        const response = await GET(
            { nextUrl: new URL('http://localhost/api/stocks/2330/detail') } as never,
            { params: Promise.resolve({ id: '2330' }) },
        );
        const body = await response.json();

        expect(body).toMatchObject({
            name: '2330',
            industry: '',
            dataPoints: 0,
            dataCoverage: 'insufficient',
            backtest: { available: false },
            watchlistCtx: { inWatchlist: false, watchlistId: null },
            coverageTier: { tier: 'C', quoteDays: 0 },
        });
        expect(mockBuildFundamentalSnapshot).toHaveBeenCalledWith({
            isETF: false,
            monthlyRevenues: [],
            financialReports: [],
            stockMetrics: [],
        });
    });

    it('keeps fusion, candidate context, and comparison unavailable when optional paths throw', async () => {
        mockQuoteFindMany.mockResolvedValue(makeQuotes(25));
        mockRunScreen.mockRejectedValue(new Error('screen unavailable'));
        mockSafeCandidateLatest.mockRejectedValue(new Error('snapshot unavailable'));
        mockSafeCandidates.mockRejectedValue(new Error('comparison unavailable'));

        const { GET } = await import('../route');
        const response = await GET(
            { nextUrl: new URL('http://localhost/api/stocks/2330/detail') } as never,
            { params: Promise.resolve({ id: '2330' }) },
        );
        const body = await response.json();

        expect(body.fusion).toBeNull();
        expect(body.regime).toBeNull();
        expect(body.signals).toBeNull();
        expect(body.candidateCtx).toMatchObject({ isCandidate: false, topFactors: [], keyRisks: [] });
        expect(body.comparison).toMatchObject({ available: false, summaryNote: '尚無前日快照可供比較' });
        expect(body.limitations).toContain('分析引擎暫時無法執行，評分資料不可用');
    });

    it('reports stable alpha when consecutive snapshots have no material changes', async () => {
        mockQuoteFindMany.mockResolvedValue(makeQuotes(25));
        mockSafeCandidateLatest.mockResolvedValue({
            snapshotDate: '2026-01-25',
            topFactors: null,
            keyRisks: null,
        });
        mockSafeCandidates.mockResolvedValue([
            { snapshotDate: '2026-01-25', alphaScore: 60, screenBucket: 'Watch', dataCoverage: 'insufficient' },
            { snapshotDate: '2026-01-24', alphaScore: 60, screenBucket: 'Watch', dataCoverage: 'insufficient' },
        ]);

        const { GET } = await import('../route');
        const response = await GET(
            { nextUrl: new URL('http://localhost/api/stocks/2330/detail') } as never,
            { params: Promise.resolve({ id: '2330' }) },
        );
        const body = await response.json();

        expect(body.comparison).toMatchObject({
            alphaDelta: 0,
            bucketChanged: false,
            dataCoverageChanged: false,
            newlyInsufficient: false,
            summaryNote: 'Alpha 評分持平',
        });
        expect(body.candidateCtx).toMatchObject({ topFactors: [], keyRisks: [] });
    });

    it('uses safe fallback values when the backtest summary omits optional measurements', async () => {
        mockQuoteFindMany.mockResolvedValue(makeQuotes(100));
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                summary: { totalReturn: null, buyAndHoldReturn: null, maxDrawdown: null, totalTrades: null },
            }),
        }) as unknown as typeof fetch;

        const { GET } = await import('../route');
        const response = await GET(
            { nextUrl: new URL('http://localhost/api/stocks/2330/detail') } as never,
            { params: Promise.resolve({ id: '2330' }) },
        );
        const body = await response.json();

        expect(body.backtestSummary).toMatchObject({
            available: true,
            totalReturn: null,
            buyAndHoldReturn: body.backtest.buyAndHoldReturn,
            alphaToBuyAndHold: null,
            maxDrawdown: null,
            totalTrades: null,
            period: null,
            marketBenchmarkAvailable: false,
            marketReturn: null,
            regimeAwareAvailable: false,
            regimeAwareReturn: null,
            limitations: [],
        });
    });
});
