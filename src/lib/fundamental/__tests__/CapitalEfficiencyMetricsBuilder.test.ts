import { buildCapitalEfficiencyMetrics } from '../CapitalEfficiencyMetricsBuilder';
import type { FinancialReportLike, MonthlyRevenueLike } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { FinancialStructureMetrics } from '../FinancialStructureMetricsBuilder';

const monthlyRevenues: MonthlyRevenueLike[] = Array.from({ length: 12 }, (_, index) => ({
  year: 2025,
  month: 12 - index,
  revenue: 100,
  yoyGrowth: 10,
  momGrowth: 1,
}));

const financialReports: FinancialReportLike[] = [
  {
    year: 2025,
    quarter: 4,
    eps: 8,
    netIncome: 120,
    grossMargin: 50,
    operatingMargin: 20,
    equity: 600,
    totalAssets: 1200,
    operatingCashFlow: 132,
  },
  {
    year: 2025,
    quarter: 3,
    eps: 7,
    netIncome: 116,
    grossMargin: 49.5,
    operatingMargin: 19.3,
    equity: 590,
    totalAssets: 1180,
    operatingCashFlow: 120,
  },
  {
    year: 2025,
    quarter: 2,
    eps: 6.8,
    netIncome: 108,
    grossMargin: 49.2,
    operatingMargin: 19.1,
    equity: 575,
    totalAssets: 1160,
    operatingCashFlow: 109,
  },
];

const structureMetrics: FinancialStructureMetrics = {
  netIncome: 120,
  previousNetIncome: 116,
  operatingCashFlow: 132,
  freeCashFlow: 95,
  cashAndCashEquivalents: 180,
  totalAssets: 1200,
  totalLiabilities: 420,
  totalDebt: 180,
  currentAssets: 360,
  inventory: 40,
  currentLiabilities: 180,
  currentRatio: 2,
  quickRatio: 1.78,
  equity: 600,
  debtRatio: 15,
  liabilitiesRatio: 35,
  interestCoverage: 10,
  shortTermDebt: 40,
  longTermDebt: 140,
  dataCoverage: 'full',
  limitations: [],
};

describe('CapitalEfficiencyMetricsBuilder', () => {
  it('builds ROE/ROA/turnover/conversion from available data', () => {
    const metrics = buildCapitalEfficiencyMetrics({
      monthlyRevenues,
      financialReports,
      structureMetrics,
    });

    expect(metrics.roe).toBe(20);
    expect(metrics.roa).toBe(10);
    expect(metrics.assetTurnover).toBe(1);
    expect(metrics.cashflowConversion).toBe(1.1);
    expect(metrics.earningsQuality).toBe('strong');
    expect(metrics.dataCoverage).toBe('full');
  });

  it('degrades when denominators or monthly revenue coverage are insufficient', () => {
    const metrics = buildCapitalEfficiencyMetrics({
      monthlyRevenues: monthlyRevenues.slice(0, 6),
      financialReports: [
        {
          year: 2025,
          quarter: 4,
          eps: 3,
          netIncome: 50,
          grossMargin: 30,
          operatingMargin: 10,
          equity: null,
          totalAssets: null,
          operatingCashFlow: null,
        },
      ],
    });

    expect(metrics.roe).toBeNull();
    expect(metrics.assetTurnover).toBeNull();
    expect(metrics.cashflowConversion).toBeNull();
    expect(metrics.dataCoverage).toBe('insufficient');
    expect(metrics.limitations.join(' ')).toMatch(/月營收資料不足|equity|operatingCashFlow/);
  });
});
