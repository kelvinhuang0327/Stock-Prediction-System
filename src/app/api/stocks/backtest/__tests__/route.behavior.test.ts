/** @jest-environment node */

import { NextRequest } from 'next/server';

const mockQuoteCount = jest.fn();
const mockQuoteFindMany = jest.fn();
const mockQuoteGroupBy = jest.fn();
const mockQuoteFindFirst = jest.fn();
const mockStockFindMany = jest.fn();
const mockMarketFindMany = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockDetectRegimeForPeriod = jest.fn();
const mockBuildRegimeTimeline = jest.fn();

jest.mock('@/lib/prisma', () => ({
    prisma: {
        stockQuote: {
            count: mockQuoteCount,
            findMany: mockQuoteFindMany,
            groupBy: mockQuoteGroupBy,
            findFirst: mockQuoteFindFirst,
        },
        stock: { findMany: mockStockFindMany },
        marketIndex: { findMany: mockMarketFindMany },
    },
}));

jest.mock('@/lib/cache', () => ({ apiCache: { get: mockCacheGet, set: mockCacheSet } }));
jest.mock('@/lib/data/AsOfDataGate', () => ({ resolveAsOfDate: (value?: string) => value ?? '2026-05-07' }));
jest.mock('@/lib/market/MarketRegimeEngine', () => ({
    detectRegimeForPeriod: mockDetectRegimeForPeriod,
    buildRegimeTimeline: mockBuildRegimeTimeline,
}));

jest.mock('next/server', () => {
    const actual = jest.requireActual('next/server');
    return {
        ...actual,
        NextResponse: {
            json: (data: unknown, init?: ResponseInit) => ({
                json: async () => data,
                status: init?.status ?? 200,
                _data: data,
            }),
        },
    };
});

function makeQuotes(count = 120) {
    const start = new Date('2025-12-01T00:00:00.000Z');
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(start);
        date.setUTCDate(date.getUTCDate() + index);
        const phase = index % 30;
        const close = phase < 15 ? 150 - phase * 2 : 122 + (phase - 15) * 2;
        return {
            stockId: '2330',
            date: date.toISOString().slice(0, 10),
            open: close,
            high: close + 1,
            low: close - 1,
            close,
            volume: 10_000 + index * 100,
        };
    });
}

function postRequest(body: string | Record<string, unknown>) {
    return new NextRequest('http://localhost/api/stocks/backtest', {
        method: 'POST',
        body: typeof body === 'string' ? body : JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('/api/stocks/backtest route behavior', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCacheGet.mockReturnValue(null);
        mockQuoteCount.mockResolvedValue(120);
        mockQuoteFindMany.mockResolvedValue(makeQuotes());
        mockQuoteGroupBy.mockResolvedValue([]);
        mockQuoteFindFirst.mockResolvedValue({ date: '2026-03-30' });
        mockStockFindMany.mockResolvedValue([]);
        mockMarketFindMany.mockResolvedValue([
            { value: 20_000 }, { value: 21_000 },
        ]);
        mockDetectRegimeForPeriod.mockResolvedValue({ regime: 'Bull', confidence: 80 });
        mockBuildRegimeTimeline.mockResolvedValue({ timeline: new Map(), limitations: [] });
    });

    it('validates malformed bodies and a missing symbol', async () => {
        const { POST } = await import('../route');

        const invalid = await POST(postRequest('{'));
        await expect(invalid.json()).resolves.toEqual({ error: '無效的請求格式' });
        expect(invalid.status).toBe(400);

        const missing = await POST(postRequest({ strategy: 'rsi' }));
        await expect(missing.json()).resolves.toEqual({ error: '缺少 symbol 參數' });
        expect(missing.status).toBe(400);
        expect(mockQuoteCount).not.toHaveBeenCalled();
    });

    it('returns an insufficient-data response before requesting quote history', async () => {
        mockQuoteCount.mockResolvedValue(42);
        const { POST } = await import('../route');

        const response = await POST(postRequest({ symbol: '2330', strategy: 'rsi', asOfDate: '2026-05-07' }));

        await expect(response.json()).resolves.toMatchObject({
            symbol: '2330', strategy: 'rsi', source: 'insufficient_data',
            coverage: { availableDays: 42, requiredDays: 100 }, sample_size: 42,
        });
        expect(mockQuoteFindMany).not.toHaveBeenCalled();
    });

    it('returns insufficient data when count qualifies but the gated history is too short', async () => {
        mockQuoteFindMany.mockResolvedValue(makeQuotes(20));
        const { POST } = await import('../route');

        const response = await POST(postRequest({ symbol: '2330', strategy: 'rsi', months: 12 }));

        await expect(response.json()).resolves.toMatchObject({
            symbol: '2330', source: 'insufficient_data', sample_size: 120,
            coverage: { availableDays: 120, message: '回測執行失敗或資料不符合條件。' },
        });
        expect(mockQuoteFindMany).toHaveBeenCalledTimes(1);
    });

    it('runs a baseline backtest, benchmarks it, and caches the dated response', async () => {
        const { POST } = await import('../route');
        const response = await POST(postRequest({ symbol: '2330', strategy: 'rsi', months: 12, asOfDate: '2026-05-07' }));
        const body = await response.json();

        expect(body).toMatchObject({
            symbol: '2330',
            strategy: 'rsi',
            source: 'database（TWSE 歷史行情資料）',
            asOfDate: '2026-05-07',
            asOfGateStatus: 'ACTIVE',
            benchmark: { marketAvailable: true, marketReturn: 5 },
            regimeAware: false,
            regimeMode: 'ignore',
        });
        expect(body.summary.totalTrades).toBeGreaterThan(0);
        expect(body.equityCurve.length).toBe(100);
        expect(body.dataLimitations).toContain('回測期間僅 100 個交易日，統計意義有限');
        expect(mockQuoteFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ stockId: '2330', date: expect.objectContaining({ lte: '20260507' }) }),
        }));
        expect(mockCacheSet).toHaveBeenCalledWith(expect.stringContaining(':2026-05-07'), body, 600);
    });

    it('runs the other baseline strategies and handles a flat, trade-free history', async () => {
        const { POST } = await import('../route');
        for (const [strategy, methodology] of [
            ['ma_cross', 'MA5/MA20 黃金交叉買進，死亡交叉賣出'],
            ['bb', '跌破布林下軌買進，突破布林上軌賣出'],
            ['custom', 'MA5/MA20 黃金交叉買進，死亡交叉賣出'],
        ]) {
            const response = await POST(postRequest({ symbol: '2330', strategy }));
            const body = await response.json();
            expect(body.methodology).toBe(methodology);
        }

        const flatHistory = makeQuotes().map((quote) => ({ ...quote, open: 100, high: 100, low: 100, close: 100 }));
        mockQuoteFindMany.mockResolvedValueOnce(flatHistory).mockResolvedValueOnce([]);
        const flatResponse = await POST(postRequest({ symbol: '2330', strategy: 'rsi' }));
        const flatBody = await flatResponse.json();
        expect(flatBody.summary).toMatchObject({ totalTrades: 0, winRate: 0, avgReturn: 0, sharpeRatio: 0 });
        expect(flatBody.benchmark.buyAndHoldReturn).toBe(0);
    });

    it('handles a long history and missing quote dates without short-sample warnings', async () => {
        const { POST } = await import('../route');
        mockQuoteCount.mockResolvedValue(320);
        mockQuoteFindMany.mockResolvedValue(makeQuotes(320));
        const longBody = await (await POST(postRequest({ symbol: '2330', strategy: 'rsi' }))).json();
        expect(longBody.equityCurve).toHaveLength(300);
        expect(longBody.dataLimitations).not.toContain('回測期間僅 300 個交易日，統計意義有限');

        mockQuoteFindMany.mockResolvedValue(makeQuotes().map((quote) => ({ ...quote, date: '' })));
        const undated = await POST(postRequest({ symbol: '2330', strategy: 'rsi' }));
        await expect(undated.json()).resolves.toMatchObject({ last_updated: null, samplePeriod: ' ~ ' });
    });

    it('reports unavailable benchmark data and tolerates optional regime detection failure', async () => {
        const { POST } = await import('../route');
        mockQuoteFindMany.mockResolvedValueOnce(makeQuotes()).mockResolvedValueOnce([{ close: 0 }, { close: 150 }]);
        mockMarketFindMany.mockResolvedValueOnce([]);
        mockDetectRegimeForPeriod.mockRejectedValueOnce(new Error('regime source unavailable'));

        const noMarket = await POST(postRequest({ symbol: '2330', strategy: 'rsi' }));
        const noMarketBody = await noMarket.json();
        expect(noMarketBody.marketRegime).toBeNull();
        expect(noMarketBody.benchmark).toMatchObject({
            buyAndHoldReturn: 0,
            marketAvailable: false,
            marketReturn: null,
            marketUnavailableReason: '大盤指數歷史資料不存在，無法計算市場 benchmark',
        });
        expect(noMarketBody.dataLimitations).toContain('大盤指數歷史資料不足，無法提供市場 benchmark 比較');

        mockQuoteFindMany.mockClear();
        mockQuoteFindMany.mockResolvedValueOnce(makeQuotes()).mockResolvedValueOnce([{ close: 20_000 }, { close: 21_000 }]);
        mockMarketFindMany.mockResolvedValueOnce([{ value: 20_000 }]);
        const oneMarketPoint = await POST(postRequest({ symbol: '2330', strategy: 'rsi' }));
        await expect(oneMarketPoint.json()).resolves.toMatchObject({
            benchmark: {
                marketAvailable: false,
                marketUnavailableReason: '大盤指數僅有 1 筆資料，不足以計算市場 benchmark',
            },
        });

        mockQuoteFindMany.mockClear();
        mockQuoteFindMany.mockResolvedValueOnce(makeQuotes()).mockResolvedValueOnce([{ close: 0 }, { close: 150 }]);
        const zeroStartPrice = await POST(postRequest({ symbol: '2330', strategy: 'rsi' }));
        await expect(zeroStartPrice.json()).resolves.toMatchObject({ benchmark: { buyAndHoldReturn: 0 } });
    });

    it('applies position-adjust sizing and forced regime exits', async () => {
        const { POST } = await import('../route');
        const quotes = makeQuotes();
        const timeline = new Map(quotes.map((quote, index) => [
            quote.date,
            { regime: index < 45 ? 'Bull' as const : 'Bear' as const },
        ]));
        mockBuildRegimeTimeline.mockResolvedValueOnce({ timeline, limitations: [] });

        const response = await POST(postRequest({
            symbol: '2330',
            strategy: 'rsi',
            regimeMode: 'position_adjust',
            positionAdjustmentRules: { Bull: 0.5, Bear: 0, Sideways: 0.5, Unknown: 1 },
        }));
        const body = await response.json();

        expect(body.regimeAware).toBe(true);
        expect(body.regimeAwareResult.trades.length).toBeGreaterThan(0);
        expect(body.regimeAwareResult.trades[0].reason).toContain('強制出場');
        expect(body.regimeStats).toEqual(expect.arrayContaining([
            expect.objectContaining({ regime: 'Bull', tradingDays: 45 }),
            expect.objectContaining({ regime: 'Bear', tradingDays: 75 }),
        ]));
    });

    it('uses the default full position when the timeline and configured Unknown size are absent', async () => {
        const { POST } = await import('../route');
        mockBuildRegimeTimeline.mockResolvedValueOnce({ timeline: new Map(), limitations: [] });

        const response = await POST(postRequest({
            symbol: '2330',
            strategy: 'rsi',
            regimeMode: 'position_adjust',
            positionAdjustmentRules: { Unknown: null },
        }));
        const body = await response.json();

        expect(body.regimeAware).toBe(true);
        expect(body.positionAdjustmentRules.Unknown).toBeNull();
        expect(body.regimeAwareResult.trades.length).toBeGreaterThan(0);
        expect(body.regimeStats).toEqual(expect.arrayContaining([
            expect.objectContaining({ regime: 'Unknown', tradeCount: body.regimeAwareResult.trades.length }),
        ]));
    });

    it('filters disallowed regime entries and returns baseline when regime quotes are insufficient', async () => {
        const { POST } = await import('../route');
        const quotes = makeQuotes();
        mockBuildRegimeTimeline.mockResolvedValueOnce({
            timeline: new Map(quotes.map((quote) => [quote.date, { regime: 'Bull' as const }])),
            limitations: [],
        });

        const filtered = await POST(postRequest({
            symbol: '2330', strategy: 'rsi', regimeMode: 'filter_only', allowedRegimes: ['Bear'],
        }));
        await expect(filtered.json()).resolves.toMatchObject({ regimeAware: true, regimeAwareResult: { trades: [] } });

        mockBuildRegimeTimeline.mockResolvedValueOnce({ timeline: new Map(), limitations: [] });
        mockQuoteFindMany.mockResolvedValueOnce(makeQuotes()).mockResolvedValueOnce(makeQuotes()).mockResolvedValueOnce([]);
        const noRegimeHistory = await POST(postRequest({ symbol: '2330', strategy: 'rsi', regimeMode: 'filter_only' }));
        await expect(noRegimeHistory.json()).resolves.toMatchObject({
            regimeAware: false,
            regimeAwareResult: null,
            dataLimitations: expect.arrayContaining(['Regime-aware 回測不可用，僅顯示 baseline 結果']),
        });
    });

    it('supports regime-aware moving-average and fallback strategies', async () => {
        const { POST } = await import('../route');
        const quotes = makeQuotes();
        const timeline = new Map(quotes.map((quote) => [quote.date, { regime: 'Bull' as const }]));
        mockBuildRegimeTimeline
            .mockResolvedValueOnce({ timeline, limitations: [] })
            .mockResolvedValueOnce({ timeline, limitations: [] });

        const movingAverage = await POST(postRequest({ symbol: '2330', strategy: 'ma_cross', regimeMode: 'filter_only' }));
        await expect(movingAverage.json()).resolves.toMatchObject({ regimeAware: true, regimeMode: 'filter_only' });

        const fallbackStrategy = await POST(postRequest({ symbol: '2330', strategy: 'custom', regimeMode: 'filter_only' }));
        await expect(fallbackStrategy.json()).resolves.toMatchObject({ regimeAware: true, regimeMode: 'filter_only' });
    });

    it('supports the regime-aware path and falls back cleanly when timeline construction fails', async () => {
        const { POST } = await import('../route');
        mockBuildRegimeTimeline.mockResolvedValueOnce({
            timeline: new Map(makeQuotes().map(quote => [quote.date, { regime: 'Bull' }])),
            limitations: ['timeline source limited'],
        });
        const response = await POST(postRequest({
            symbol: '2330', strategy: 'rsi', regimeMode: 'filter_only', allowedRegimes: ['Bull'],
        }));
        const body = await response.json();

        expect(body.regimeAware).toBe(true);
        expect(body.regimeMode).toBe('filter_only');
        expect(body.regimeAwareResult).toEqual(expect.objectContaining({ summary: expect.any(Object) }));
        expect(body.regimeStats).toEqual(expect.arrayContaining([expect.objectContaining({ regime: 'Bull' })]));
        expect(body.dataLimitations).toContain('timeline source limited');

        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockBuildRegimeTimeline.mockRejectedValueOnce(new Error('timeline unavailable'));
        const fallback = await POST(postRequest({ symbol: '2330', strategy: 'rsi', regimeMode: 'position_adjust' }));
        await expect(fallback.json()).resolves.toMatchObject({
            regimeAware: false,
            regimeAwareResult: null,
            dataLimitations: expect.arrayContaining([
                'Regime timeline 建立失敗，已退回 baseline 模式',
                'Regime-aware 回測不可用，僅顯示 baseline 結果',
            ]),
        });
        expect(errorLog).toHaveBeenCalledWith('Regime-aware backtest error:', expect.any(Error));
    });

    it('serves the eligible-stock list and enriches names', async () => {
        mockQuoteGroupBy.mockResolvedValue([
            { stockId: '2330', _count: { stockId: 200 } },
            { stockId: '2317', _count: { stockId: 99 } },
            { stockId: '2454', _count: { stockId: 150 } },
        ]);
        mockStockFindMany.mockResolvedValue([
            { id: '2330', name: '台積電', industry: '半導體' },
        ]);
        const { GET } = await import('../route');

        const response = await GET(new NextRequest('http://localhost/api/stocks/backtest'));

        await expect(response.json()).resolves.toMatchObject({
            total: 3,
            eligibleCount: 2,
            eligible: [
                { symbol: '2330', dataPoints: 200, name: '台積電', industry: '半導體' },
                { symbol: '2454', dataPoints: 150, name: '2454', industry: '' },
            ],
            last_updated: '2026-03-30',
        });
    });

    it('routes GET query parameters through POST and degrades when the eligible query fails', async () => {
        const { GET } = await import('../route');
        const queryResponse = await GET(new NextRequest(
            'http://localhost/api/stocks/backtest?symbol=2330&strategy=bb&months=3&regimeMode=filter_only&allowedRegimes=Bear,,Bull&asOfDate=2026-05-07',
        ));
        await expect(queryResponse.json()).resolves.toMatchObject({
            symbol: '2330', strategy: 'bb', regimeMode: 'filter_only', allowedRegimes: ['Bear', 'Bull'], asOfDate: '2026-05-07',
        });

        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockQuoteGroupBy.mockRejectedValueOnce(new Error('eligible query failed'));
        const fallback = await GET(new NextRequest('http://localhost/api/stocks/backtest'));
        await expect(fallback.json()).resolves.toEqual({ eligible: [], total: 0, eligibleCount: 0, minRequired: 100 });
        expect(errorLog).toHaveBeenCalledWith('Backtest eligible list error:', expect.any(Error));
    });

    it('uses GET defaults and returns null when the eligible list has no latest quote date', async () => {
        const { GET } = await import('../route');
        const response = await GET(new NextRequest('http://localhost/api/stocks/backtest?symbol=2330'));
        await expect(response.json()).resolves.toMatchObject({
            strategy: 'ma_cross',
            regimeMode: 'ignore',
            asOfDate: '2026-05-07',
        });

        mockQuoteGroupBy.mockResolvedValueOnce([]);
        mockStockFindMany.mockResolvedValueOnce([]);
        mockQuoteFindFirst.mockResolvedValueOnce(null);
        const eligible = await GET(new NextRequest('http://localhost/api/stocks/backtest'));
        await expect(eligible.json()).resolves.toMatchObject({ eligible: [], total: 0, eligibleCount: 0, last_updated: null });
    });

    it('returns the cached payload and maps unexpected backtest errors to 500', async () => {
        const { GET, POST } = await import('../route');
        mockCacheGet.mockReturnValueOnce({ cachedPost: true });
        await expect((await POST(postRequest({ symbol: '2330' }))).json()).resolves.toEqual({ cachedPost: true });
        expect(mockQuoteCount).not.toHaveBeenCalled();

        mockCacheGet.mockReturnValueOnce({ cached: true });
        await expect((await GET(new NextRequest('http://localhost/api/stocks/backtest'))).json()).resolves.toEqual({ cached: true });
        expect(mockQuoteGroupBy).not.toHaveBeenCalled();

        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockQuoteCount.mockRejectedValue(new Error('db unavailable'));
        const response = await POST(postRequest({ symbol: '2330' }));
        await expect(response.json()).resolves.toEqual({ error: '回測執行失敗' });
        expect(response.status).toBe(500);
        expect(errorLog).toHaveBeenCalledWith('Backtest error:', expect.any(Error));
    });
});
