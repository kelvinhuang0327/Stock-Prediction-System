import { buildFinancialStructureMetrics } from '../FinancialStructureMetricsBuilder';

describe('FinancialStructureMetricsBuilder', () => {
  it('derives ratios and free cash flow from raw balance sheet fields', () => {
    const metrics = buildFinancialStructureMetrics({
      financialReports: [
        {
          year: 2025,
          quarter: 4,
          eps: 8.5,
          netIncome: 1200,
          grossMargin: 42,
          operatingMargin: 28,
          operatingIncome: 900,
          operatingCashFlow: 1500,
          capitalExpenditure: -400,
          currentAssets: 2200,
          inventory: 300,
          currentLiabilities: 1100,
          totalAssets: 5000,
          totalLiabilities: 2100,
          shortTermDebt: 200,
          longTermDebt: 600,
          interestExpense: 150,
        },
      ],
    });

    expect(metrics.freeCashFlow).toBe(1100);
    expect(metrics.currentRatio).toBe(2);
    expect(metrics.quickRatio).toBeCloseTo(1.73, 2);
    expect(metrics.totalDebt).toBe(800);
    expect(metrics.debtRatio).toBe(16);
    expect(metrics.liabilitiesRatio).toBe(42);
    expect(metrics.interestCoverage).toBe(6);
    expect(metrics.dataCoverage).toBe('full');
  });

  it('degrades cleanly when only partial financial structure fields are available', () => {
    const metrics = buildFinancialStructureMetrics({
      financialReports: [
        {
          year: 2025,
          quarter: 4,
          eps: 2.1,
          netIncome: 220,
          grossMargin: null,
          operatingMargin: null,
          operatingCashFlow: null,
          totalAssets: 1000,
          totalLiabilities: 650,
        },
      ],
    });

    expect(metrics.liabilitiesRatio).toBe(65);
    expect(metrics.dataCoverage).toBe('insufficient');
    expect(metrics.limitations.join(' ')).toMatch(/operatingCashFlow/);
  });
});
