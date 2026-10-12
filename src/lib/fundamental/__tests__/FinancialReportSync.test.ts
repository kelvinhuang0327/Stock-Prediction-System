import { normalizeFinancialReportRecord } from '../FinancialReportSync';

describe('FinancialReportSync', () => {
  it('normalizes string payloads and derives missing ratios', () => {
    const normalized = normalizeFinancialReportRecord({
      stockId: '2330',
      year: '2025',
      quarter: '4',
      eps: '9.2',
      netIncome: '315000',
      operatingCashFlow: '505000',
      capitalExpenditure: '-180000',
      currentAssets: '980000',
      inventory: '120000',
      currentLiabilities: '420000',
      totalAssets: '3950000',
      totalLiabilities: '1380000',
      shortTermDebt: '90000',
      longTermDebt: '260000',
      operatingIncome: '428000',
      interestExpense: '12000',
    });

    expect(normalized.year).toBe(2025);
    expect(normalized.freeCashFlow).toBe(325000);
    expect(normalized.currentRatio).toBeCloseTo(2.33, 2);
    expect(normalized.quickRatio).toBeCloseTo(2.05, 2);
    expect(normalized.debtRatio).toBeCloseTo(8.86, 2);
    expect(normalized.liabilitiesRatio).toBeCloseTo(34.94, 2);
    expect(normalized.interestCoverage).toBeCloseTo(35.67, 2);
  });
});
