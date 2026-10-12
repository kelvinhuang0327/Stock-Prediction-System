import {
  buildDailyFundamentalSummary,
  type BuildDailyFundamentalSummaryInput,
} from '../DailyFundamentalSummary';

const BASE_INPUT: BuildDailyFundamentalSummaryInput = {
  candidates: [
    { symbol: '2330', name: '台積電' },
    { symbol: '1101', name: '台泥' },
  ],
  monthlyRevenuesByStock: {
    '2330': [
      { year: 2026, month: 2, revenue: 1000, yoyGrowth: 18, momGrowth: 3 },
      { year: 2026, month: 1, revenue: 980, yoyGrowth: 12, momGrowth: 2 },
      { year: 2025, month: 12, revenue: 960, yoyGrowth: 8, momGrowth: 1 },
    ],
    '1101': [
      { year: 2026, month: 2, revenue: 500, yoyGrowth: -6, momGrowth: -1 },
      { year: 2026, month: 1, revenue: 510, yoyGrowth: -2, momGrowth: -1 },
    ],
  },
  financialReportsByStock: {
    '2330': [
      { year: 2025, quarter: 4, eps: 12.5, netIncome: 100, grossMargin: 55, operatingMargin: 44 },
      { year: 2025, quarter: 3, eps: 11.1, netIncome: 90, grossMargin: 53.4, operatingMargin: 42.2 },
    ],
    '1101': [
      { year: 2025, quarter: 4, eps: 0.8, netIncome: 10, grossMargin: 18, operatingMargin: 8 },
      { year: 2025, quarter: 3, eps: 1.1, netIncome: 12, grossMargin: 19.5, operatingMargin: 9.5 },
    ],
  },
  stockMetricsByStock: {
    '2330': [{ date: '2026-03-24', pe: 18, pb: 4.2, dividendYield: 2.5 }],
    '1101': [{ date: '2026-03-24', pe: 28, pb: 1.5, dividendYield: 4.1 }],
  },
};

describe('buildDailyFundamentalSummary', () => {
  it('builds highlights and risks from candidate snapshots', () => {
    const result = buildDailyFundamentalSummary(BASE_INPUT);

    expect(result.items).toHaveLength(2);
    expect(result.highlights.some((item) => item.includes('營收年增'))).toBe(true);
    expect(result.risks.some((item) => item.includes('營運動能轉弱'))).toBe(true);
    expect(result.dataCoverage).toBe('full');
  });

  it('returns insufficient summary when there are no candidates', () => {
    const result = buildDailyFundamentalSummary({
      ...BASE_INPUT,
      candidates: [],
    });

    expect(result.dataCoverage).toBe('insufficient');
    expect(result.limitations[0]).toContain('無 strong/watch 候選股');
  });

  it('adds ETF limitation when ETF candidates are included', () => {
    const result = buildDailyFundamentalSummary({
      ...BASE_INPUT,
      candidates: [{ symbol: '0050', name: '元大台灣50' }],
      monthlyRevenuesByStock: {},
      financialReportsByStock: {},
      stockMetricsByStock: {
        '0050': [{ date: '2026-03-24', pe: 15, pb: 1.9, dividendYield: 3.4 }],
      },
    });

    expect(result.items[0].summary).toContain('ETF');
    expect(result.limitations.some((item) => item.includes('ETF 候選'))).toBe(true);
  });
});
