/** @jest-environment node */

export {};

const mockStockFindUnique = jest.fn();
const mockQuoteFindMany = jest.fn();
const mockChipFindMany = jest.fn();
const mockRevenueFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
    prisma: {
        stock: { findUnique: mockStockFindUnique },
        stockQuote: { findMany: mockQuoteFindMany },
        institutionalChip: { findMany: mockChipFindMany },
        monthlyRevenue: { findMany: mockRevenueFindMany },
    },
}));

function makeQuotes(count: number, closeAt: (index: number) => number) {
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10);
        return {
            stockId: '2330',
            date,
            close: closeAt(index),
            volume: index < count - 5 ? 1_000 : 1_000,
        };
    });
}

function makeChips(totalBuy: number, count = 5) {
    return Array.from({ length: count }, () => ({
        totalBuy,
        foreignBuy: Math.round(totalBuy * 0.6),
        trustBuy: Math.round(totalBuy * 0.4),
    }));
}

function makeRevenues(latestRevenue = 130, previousYearRevenue = 100) {
    const rows = [{ year: 2026, month: 6, revenue: latestRevenue }];
    for (let month = 5; month >= 1; month--) rows.push({ year: 2026, month, revenue: 110 });
    for (let month = 12; month >= 7; month--) rows.push({ year: 2025, month, revenue: 105 });
    rows.push({ year: 2025, month: 6, revenue: previousYearRevenue });
    return rows;
}

describe('normalizePitDateToIso', () => {
    it.each([
        ['2026-05-07', '2026-05-07'],
        ['20260507', '2026-05-07'],
        ['20240229', '2024-02-29'],
    ])('normalizes %s', async (input, expected) => {
        const { normalizePitDateToIso } = await import('../RuleBasedStockAnalyzer');
        expect(normalizePitDateToIso(input)).toBe(expected);
    });

    it.each(['2026/05/07', '2026-05-7', ' 2026-05-07'])('rejects invalid date format %s', async input => {
        const { normalizePitDateToIso } = await import('../RuleBasedStockAnalyzer');
        expect(() => normalizePitDateToIso(input)).toThrow('[PIT] Invalid date format');
    });
});

describe('analyzeStock', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStockFindUnique.mockResolvedValue({ id: '2330', name: '台積電' });
        mockQuoteFindMany.mockResolvedValue([]);
        mockChipFindMany.mockResolvedValue([]);
        mockRevenueFindMany.mockResolvedValue([]);
    });

    it('returns a stable insufficient-data result and applies the PIT cutoff to each source', async () => {
        const { analyzeStock } = await import('../RuleBasedStockAnalyzer');
        const result = await analyzeStock('2330', '2026-05-07');

        expect(result).toMatchObject({
            stockId: '2330',
            name: '台積電',
            recommendation: '資料不足',
            dataCoverage: 'insufficient',
            dataPoints: 0,
        });
        expect(mockQuoteFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { stockId: '2330', date: { lte: '2026-05-07' } },
        }));
        expect(mockChipFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { stockId: '2330', date: { lte: '2026-05-07' } },
        }));
        expect(mockRevenueFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { stockId: '2330', OR: [{ year: { lt: 2026 } }, { year: 2026, month: { lte: 5 } }] },
        }));
    });

    it('rejects an unrecognized PIT format before querying date-gated data', async () => {
        const { analyzeStock } = await import('../RuleBasedStockAnalyzer');
        await expect(analyzeStock('2330', '2026/02/30')).rejects.toThrow('[PIT] Invalid date format');
        expect(mockStockFindUnique).toHaveBeenCalledTimes(1);
        expect(mockQuoteFindMany).not.toHaveBeenCalled();
    });

    it('analyzes a rising stock with sufficient quote, chip, and revenue history', async () => {
        mockQuoteFindMany.mockResolvedValue(makeQuotes(65, index => 100 + index * 0.1));
        mockChipFindMany.mockResolvedValue(makeChips(1_000));
        mockRevenueFindMany.mockResolvedValue(makeRevenues());

        const { analyzeStock } = await import('../RuleBasedStockAnalyzer');
        const result = await analyzeStock('2330');

        expect(result.name).toBe('台積電');
        expect(result.dataCoverage).toBe('full');
        expect(result.usedSources).toEqual(['StockQuote', 'InstitutionalChip', 'MonthlyRevenue']);
        expect(result.revenueYoY).toBe(30);
        expect(result.chipStrength).toBe(55);
        expect(result.recommendation).toBe('偏多');
        expect(result.factors.map(factor => factor.name)).toEqual(expect.arrayContaining([
            'MA 趨勢', 'RSI(14)', 'MACD', '近 20 日動能', '法人近 10 日買超', '營收年增率',
        ]));
        expect(result.last_updated).toBe(result.samplePeriod.split(' ~ ')[1]);
        expect(result.limitations).toEqual([]);
    });

    it('falls back to short-term scoring and marks missing chip and revenue data', async () => {
        mockStockFindUnique.mockResolvedValue(null);
        mockQuoteFindMany.mockResolvedValue(makeQuotes(25, index => 50 + index * 0.2));
        mockChipFindMany.mockResolvedValue(makeChips(1_000, 4));
        mockRevenueFindMany.mockResolvedValue(makeRevenues().slice(0, 12));

        const { analyzeStock } = await import('../RuleBasedStockAnalyzer');
        const result = await analyzeStock('9999');

        expect(result.name).toBe('9999');
        expect(result.dataCoverage).toBe('limited');
        expect(result.usedSources).toEqual(['StockQuote']);
        expect(result.missingSources).toEqual(expect.arrayContaining([
            'InstitutionalChip',
            'MonthlyRevenue（不足 13 個月，無法計算 YoY）',
        ]));
        expect(result.limitations).toEqual(expect.arrayContaining([
            '歷史資料僅 25 天，技術分析為短期參考',
            '法人籌碼資料不足，未納入籌碼面分析',
            '營收資料不足，未納入基本面分析',
        ]));
        expect(result.factors.map(factor => factor.name)).not.toContain('MA 趨勢');
    });

    it('uses technical score alone for an ETF with no chip history', async () => {
        mockQuoteFindMany.mockResolvedValue(makeQuotes(20, index => 50 + index * 0.2));

        const { analyzeStock } = await import('../RuleBasedStockAnalyzer');
        const result = await analyzeStock('0050');

        expect(result.isETF).toBe(true);
        expect(result.dataCoverage).toBe('limited');
        expect(result.overallScore).toBe(result.technicalScore);
        expect(result.calculatedScore).toBe(Math.round(result.technicalScore * 0.5));
        expect(result.factors.map(factor => factor.name)).toEqual(expect.arrayContaining(['MA20 位置', 'RSI(14)']));
    });

    it('scores a falling stock as weak and elevated risk', async () => {
        mockQuoteFindMany.mockResolvedValue(makeQuotes(60, index => 1_000 - index * 10));
        mockChipFindMany.mockResolvedValue(makeChips(-1_000));
        mockRevenueFindMany.mockResolvedValue(makeRevenues(50, 100));

        const { analyzeStock } = await import('../RuleBasedStockAnalyzer');
        const result = await analyzeStock('2330');

        expect(result.technicalScore).toBeLessThan(40);
        expect(result.momentumScore).toBeLessThan(40);
        expect(result.riskLevel).toBe('High');
        expect(result.revenueYoY).toBe(-50);
        expect(result.summary).toContain('營收年減');
        expect(result.reason).toContain('技術偏空');
    });

    it('retains safe defaults when quote rows contain non-positive prices', async () => {
        mockQuoteFindMany.mockResolvedValue(makeQuotes(20, () => 0));

        const { analyzeStock } = await import('../RuleBasedStockAnalyzer');
        const result = await analyzeStock('2330');

        expect(result.priceChangePercent).toBe(0);
        expect(result.recommendation).toBe('觀察');
        expect(result.dataCoverage).toBe('limited');
    });

    it.each([
        ['expanding volume', 2_000, 57, 'positive'],
        ['contracting volume', 500, 47, 'negative'],
    ] as const)('scores neutral RSI and %s independently of price momentum', async (_label, recentVolume, expectedMomentum, expectedVolumeImpact) => {
        const quotes = makeQuotes(30, index => 100 + (index % 2));
        quotes.forEach((quote, index) => {
            if (index >= 25) quote.volume = recentVolume;
        });
        mockQuoteFindMany.mockResolvedValue(quotes);
        mockChipFindMany.mockResolvedValue(makeChips(0));
        mockRevenueFindMany.mockResolvedValue(makeRevenues(100, 100));

        const { analyzeStock } = await import('../RuleBasedStockAnalyzer');
        const result = await analyzeStock('2330');

        expect(result.momentumScore).toBe(expectedMomentum);
        expect(result.factors).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'RSI(14)', value: 50, impact: 'positive' }),
            expect.objectContaining({ name: '近 5 日報酬', value: '1%', impact: 'neutral' }),
            expect.objectContaining({ name: '近 20 日報酬', value: '0%', impact: 'neutral' }),
            expect.objectContaining({ name: '量能變化', impact: expectedVolumeImpact }),
            expect.objectContaining({ name: '營收年增率', value: 0, impact: 'neutral' }),
        ]));
    });

    it('does not score revenue when 13 records have no positive same-month prior-year value', async () => {
        mockQuoteFindMany.mockResolvedValue(makeQuotes(60, index => 100 + index * 0.1));
        mockChipFindMany.mockResolvedValue(makeChips(1_000));
        mockRevenueFindMany.mockResolvedValue(makeRevenues(130, 0));

        const { analyzeStock } = await import('../RuleBasedStockAnalyzer');
        const result = await analyzeStock('2330');

        expect(result.usedSources).toContain('MonthlyRevenue');
        expect(result.revenueYoY).toBeNull();
        expect(result.factors.map(factor => factor.name)).not.toContain('營收年增率');
        expect(result.missingSources).not.toContain('MonthlyRevenue');
        expect(result.dataCoverage).toBe('limited');
    });

    it('weights chip history for an ETF when enough rows are available', async () => {
        mockQuoteFindMany.mockResolvedValue(makeQuotes(60, index => 50 + index * 0.2));
        mockChipFindMany.mockResolvedValue(makeChips(1_000));

        const { analyzeStock } = await import('../RuleBasedStockAnalyzer');
        const result = await analyzeStock('0050');

        expect(result.isETF).toBe(true);
        expect(result.chipStrength).toBe(55);
        expect(result.overallScore).toBe(Math.round(result.technicalScore * 0.5 + 55 * 0.5));
        expect(result.calculatedScore).toBe(Math.round(result.technicalScore * 0.5 + 27.5));
        expect(result.usedSources).toContain('InstitutionalChip');
        expect(result.factors.map(factor => factor.name)).toContain('法人近 10 日買超');
    });
});
