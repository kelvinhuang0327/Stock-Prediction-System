/** @jest-environment node */

export {};

const mockQuoteCount = jest.fn();
const mockQuoteFindMany = jest.fn();
const mockQuoteGroupBy = jest.fn();
const mockQuoteFindFirst = jest.fn();
const mockStockCount = jest.fn();
const mockRevenueCount = jest.fn();
const mockRevenueGroupBy = jest.fn();
const mockMetricsCount = jest.fn();
const mockMetricsFindMany = jest.fn();
const mockMarketCount = jest.fn();
const mockMarketFindMany = jest.fn();
const mockMarketFindFirst = jest.fn();
const mockChipCount = jest.fn();
const mockChipFindMany = jest.fn();
const mockChipGroupBy = jest.fn();
const mockChipFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => ({
    prisma: {
        stockQuote: { count: mockQuoteCount, findMany: mockQuoteFindMany, groupBy: mockQuoteGroupBy, findFirst: mockQuoteFindFirst },
        stock: { count: mockStockCount },
        monthlyRevenue: { count: mockRevenueCount, groupBy: mockRevenueGroupBy },
        stockMetrics: { count: mockMetricsCount, findMany: mockMetricsFindMany },
        marketIndex: { count: mockMarketCount, findMany: mockMarketFindMany, findFirst: mockMarketFindFirst },
        institutionalChip: { count: mockChipCount, findMany: mockChipFindMany, groupBy: mockChipGroupBy, findFirst: mockChipFindFirst },
    },
}));

describe('runQualityCheck', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const today = new Date().toISOString().slice(0, 10);
        mockQuoteCount.mockResolvedValue(12_000);
        mockQuoteFindMany.mockResolvedValue([{ date: today }, { date: today.replace(/-/g, '') }]);
        mockQuoteGroupBy.mockResolvedValue([
            { stockId: 'A', _count: { _all: 300 } },
            { stockId: 'B', _count: { _all: 100 } },
            { stockId: 'C', _count: { _all: 60 } },
            { stockId: 'D', _count: { _all: 20 } },
            { stockId: 'E', _count: { _all: 5 } },
        ]);
        mockQuoteFindFirst.mockResolvedValue({ date: today });
        mockStockCount.mockResolvedValue(1_000);
        mockRevenueCount.mockResolvedValue(6_000);
        mockRevenueGroupBy.mockResolvedValue(Array.from({ length: 600 }, (_, index) => ({ stockId: `R${index}` })));
        mockMetricsCount.mockResolvedValue(5_000);
        mockMetricsFindMany.mockResolvedValue([{ date: today }]);
        mockMarketCount.mockImplementation(async (args?: { where?: { name?: string } }) => args?.where?.name === 'TAIEX' ? 300 : 500);
        mockMarketFindMany.mockResolvedValue([{ date: today }]);
        mockMarketFindFirst.mockResolvedValue({ date: today });
        mockChipCount.mockResolvedValue(200);
        mockChipFindMany.mockResolvedValue([{ date: today }]);
        mockChipGroupBy.mockResolvedValue([
            { stockId: 'A' }, { stockId: 'B' },
            ...Array.from({ length: 18 }, (_, index) => ({ stockId: `C${index}` })),
        ]);
        mockChipFindFirst.mockResolvedValue({ date: today });
    });

    it('summarizes fresh tables, mixed date formats, coverage thresholds, and eligibility', async () => {
        const { runQualityCheck } = await import('../DataQualityChecker');
        const result = await runQualityCheck();
        const quote = result.tables.find(table => table.table === 'StockQuote');
        const chip = result.tables.find(table => table.table === 'InstitutionalChip');

        expect(result.tables).toHaveLength(6);
        expect(result.warnings).toEqual([]);
        expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(result.overallScore).toBeGreaterThan(0);
        expect(quote).toMatchObject({ rowCount: 12_000, stockCoverage: 5, latestDate: new Date().toISOString().slice(0, 10) });
        expect(quote?.issues).toEqual(expect.arrayContaining([
            expect.stringContaining('混合日期格式'),
            expect.stringContaining('僅 3 檔股票有 ≥60 天'),
            expect.stringContaining('僅 2 檔股票有 ≥100 天'),
        ]));
        expect(chip).toMatchObject({ rowCount: 200, stockCoverage: 20, score: 50 });
        expect(result.coverageSummary).toMatchObject({
            totalStocks: 1_000,
            stocksWithQuotes: 5,
            stocksGe250Days: 1,
            stocksGe100Days: 2,
            stocksGe60Days: 3,
            stocksGe20Days: 4,
            chipCoveredStocks: 20,
            chipDatesAvailable: 1,
            marketIndexDays: 300,
            backtestEligible: 2,
            fullAnalysisEligible: 2,
            chipAgentActive: true,
        });
    });

    it('returns bounded low scores and null latest dates when all tables are empty', async () => {
        mockQuoteCount.mockResolvedValue(0);
        mockQuoteFindMany.mockResolvedValue([]);
        mockQuoteGroupBy.mockResolvedValue([]);
        mockQuoteFindFirst.mockResolvedValue(null);
        mockStockCount.mockResolvedValue(0);
        mockRevenueCount.mockResolvedValue(0);
        mockRevenueGroupBy.mockResolvedValue([]);
        mockMetricsCount.mockResolvedValue(0);
        mockMetricsFindMany.mockResolvedValue([]);
        mockMarketCount.mockResolvedValue(0);
        mockMarketFindMany.mockResolvedValue([]);
        mockMarketFindFirst.mockResolvedValue(null);
        mockChipCount.mockResolvedValue(0);
        mockChipFindMany.mockResolvedValue([]);
        mockChipGroupBy.mockResolvedValue([]);
        mockChipFindFirst.mockResolvedValue(null);

        const { runQualityCheck } = await import('../DataQualityChecker');
        const result = await runQualityCheck();

        expect(result.overallScore).toBe(21);
        expect(result.tables.every(table => table.score >= 0 && table.score <= 100)).toBe(true);
        expect(result.tables.find(table => table.table === 'StockQuote')?.latestDate).toBeNull();
        expect(result.tables.find(table => table.table === 'InstitutionalChip')).toMatchObject({
            score: 0,
            issues: ['InstitutionalChip 完全無資料 — ChipAgent 將永遠輸出 Insufficient'],
        });
        expect(result.coverageSummary).toMatchObject({
            stocksWithQuotes: 0,
            backtestEligible: 0,
            fullAnalysisEligible: 0,
            chipAgentActive: false,
            taiexLatestDate: null,
            quoteLatestDate: null,
            chipLatestDate: null,
        });
    });

    it('continues after individual table failures and reports the summary-query failure', async () => {
        mockQuoteCount.mockRejectedValue(new Error('quotes unavailable'));
        mockStockCount.mockRejectedValue(new Error('stocks unavailable'));
        mockRevenueCount.mockRejectedValue(new Error('revenue unavailable'));
        mockMetricsCount.mockRejectedValue(new Error('metrics unavailable'));
        mockMarketCount.mockRejectedValue(new Error('market unavailable'));
        mockChipCount.mockRejectedValue(new Error('chips unavailable'));
        mockQuoteGroupBy.mockRejectedValue(new Error('coverage unavailable'));

        const { runQualityCheck } = await import('../DataQualityChecker');
        const result = await runQualityCheck();

        expect(result.tables).toEqual([]);
        expect(result.overallScore).toBe(0);
        expect(result.warnings).toHaveLength(7);
        expect(result.warnings).toEqual(expect.arrayContaining([
            expect.stringContaining('StockQuote check failed'),
            expect.stringContaining('Stock check failed'),
            expect.stringContaining('MonthlyRevenue check failed'),
            expect.stringContaining('StockMetrics check failed'),
            expect.stringContaining('MarketIndex check failed'),
            expect.stringContaining('InstitutionalChip check failed'),
            expect.stringContaining('coverageSummary failed'),
        ]));
        expect(result.coverageSummary.totalStocks).toBe(0);
    });
});
