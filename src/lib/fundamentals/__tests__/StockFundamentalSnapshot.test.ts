import {
  buildStockFundamentalSnapshot,
  type BuildStockFundamentalSnapshotInput,
} from '../StockFundamentalSnapshot';

const BASE_INPUT: BuildStockFundamentalSnapshotInput = {
  isETF: false,
  monthlyRevenues: [
    { year: 2026, month: 2, revenue: 2100, yoyGrowth: 22, momGrowth: 4 },
    { year: 2026, month: 1, revenue: 1980, yoyGrowth: 16, momGrowth: 2 },
    { year: 2025, month: 12, revenue: 1900, yoyGrowth: 10, momGrowth: 1 },
  ],
  financialReports: [
    { year: 2025, quarter: 4, eps: 9.2, netIncome: 1000, grossMargin: 54.5, operatingMargin: 42.2 },
    { year: 2025, quarter: 3, eps: 8.4, netIncome: 920, grossMargin: 52.9, operatingMargin: 40.8 },
  ],
  stockMetrics: [
    { date: '2026-03-21', pe: 24.2, pb: 3.1, dividendYield: 2.4 },
  ],
};

describe('buildStockFundamentalSnapshot', () => {
  test('returns full coverage snapshot for a stock with revenue, profitability, and valuation data', () => {
    const result = buildStockFundamentalSnapshot(BASE_INPUT);

    expect(result.kind).toBe('stock');
    expect(result.dataCoverage).toBe('full');
    expect(result.revenue.latestMonth).toBe('2026/02');
    expect(result.revenue.trend).toBe('accelerating');
    expect(result.profitability.latestPeriod).toBe('2025 Q4');
    expect(result.profitability.epsQoQDelta).toBe(0.8);
    expect(result.valuation.pe).toBe(24.2);
    expect(result.keySignals.length).toBeGreaterThan(0);
    expect(result.keyRisks).toHaveLength(0);
  });

  test('flags weakening revenue and profitability deterioration as risks', () => {
    const result = buildStockFundamentalSnapshot({
      ...BASE_INPUT,
      monthlyRevenues: [
        { year: 2026, month: 2, revenue: 1500, yoyGrowth: -5, momGrowth: -3 },
        { year: 2026, month: 1, revenue: 1550, yoyGrowth: 8, momGrowth: -1 },
        { year: 2025, month: 12, revenue: 1600, yoyGrowth: 18, momGrowth: 0 },
      ],
      financialReports: [
        { year: 2025, quarter: 4, eps: 5.1, netIncome: 600, grossMargin: 44.5, operatingMargin: 30.2 },
        { year: 2025, quarter: 3, eps: 6.4, netIncome: 710, grossMargin: 47.0, operatingMargin: 32.1 },
      ],
      stockMetrics: [{ date: '2026-03-21', pe: 35.1, pb: 4.8, dividendYield: 0.9 }],
    });

    expect(result.revenue.trend).toBe('weakening');
    expect(result.keyRisks).toEqual(
      expect.arrayContaining([
        expect.stringContaining('營收年增'),
        expect.stringContaining('近三個月營收年增率走弱'),
        expect.stringContaining('最新單季 EPS 較前季減少'),
        expect.stringContaining('毛利率較前季下降'),
        expect.stringContaining('營益率較前季下滑'),
        expect.stringContaining('估值偏高'),
      ]),
    );
  });

  test('returns limited or insufficient coverage when inputs are partial', () => {
    const result = buildStockFundamentalSnapshot({
      ...BASE_INPUT,
      financialReports: [],
      stockMetrics: [],
    });

    expect(result.dataCoverage).toBe('insufficient');
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        '缺少財報資料，無法判讀 EPS 與利潤率。',
        '估值資料不足，無法提供 PE / PB / 殖利率參考。',
      ]),
    );
  });

  test('treats ETF as limited valuation-only fundamental view', () => {
    const result = buildStockFundamentalSnapshot({
      isETF: true,
      monthlyRevenues: [],
      financialReports: [],
      stockMetrics: [{ date: '2026-03-21', pe: null, pb: 1.2, dividendYield: 3.8 }],
    });

    expect(result.kind).toBe('etf');
    expect(result.dataCoverage).toBe('limited');
    expect(result.summary).toContain('ETF');
    expect(result.limitations.some((item) => item.includes('ETF 不適用'))).toBe(true);
    expect(result.keySignals).toEqual(
      expect.arrayContaining([expect.stringContaining('殖利率')]),
    );
  });

  test('counts consecutive positive revenue YoY months correctly', () => {
    const result = buildStockFundamentalSnapshot({
      ...BASE_INPUT,
      monthlyRevenues: [
        { year: 2026, month: 2, revenue: 2100, yoyGrowth: 5, momGrowth: 1 },
        { year: 2026, month: 1, revenue: 2050, yoyGrowth: 4, momGrowth: 1 },
        { year: 2025, month: 12, revenue: 2000, yoyGrowth: 3, momGrowth: 1 },
        { year: 2025, month: 11, revenue: 1980, yoyGrowth: -1, momGrowth: -1 },
      ],
    });

    expect(result.revenue.consecutivePositiveYoYMonths).toBe(3);
  });

  test('does not mutate input arrays', () => {
    const input: BuildStockFundamentalSnapshotInput = {
      ...BASE_INPUT,
      monthlyRevenues: [...BASE_INPUT.monthlyRevenues],
      financialReports: [...BASE_INPUT.financialReports],
      stockMetrics: [...BASE_INPUT.stockMetrics],
    };
    const before = JSON.stringify(input);

    buildStockFundamentalSnapshot(input);

    expect(JSON.stringify(input)).toBe(before);
  });
});
