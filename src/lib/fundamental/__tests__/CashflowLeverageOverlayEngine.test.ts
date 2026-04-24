import {
  buildCashflowLeverageOverlay,
  type CashflowLeverageMetrics,
} from '../CashflowLeverageOverlayEngine';
import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';

const baseFundamentals: StockFundamentalSnapshot = {
  kind: 'stock',
  dataCoverage: 'full',
  revenue: {
    latestMonth: '2026/03',
    revenue: 2100,
    yoyGrowth: 18.5,
    momGrowth: 2.2,
    trend: 'improving',
    consecutivePositiveYoYMonths: 4,
  },
  profitability: {
    latestPeriod: '2025 Q4',
    eps: 9.2,
    previousEps: 8.6,
    epsQoQDelta: 0.6,
    grossMargin: 54.1,
    grossMarginDelta: 1.2,
    operatingMargin: 42.3,
    operatingMarginDelta: 0.8,
  },
  valuation: {
    asOfDate: '2026-03-24',
    pe: 24.6,
    pb: 3.1,
    dividendYield: 2.1,
  },
  keySignals: ['營收年增維持雙位數'],
  keyRisks: [],
  summary: '基本面整體穩定，營運訊號偏正向。',
  limitations: [],
};

function build(metrics: CashflowLeverageMetrics, fundamentals = baseFundamentals) {
  return buildCashflowLeverageOverlay({
    fundamentals,
    metrics,
  });
}

describe('CashflowLeverageOverlayEngine', () => {
  it('classifies healthy cashflow + low leverage as low risk', () => {
    const overlay = build({
      operatingCashFlow: 120,
      freeCashFlow: 65,
      debtRatio: 24,
      currentRatio: 1.7,
      quickRatio: 1.1,
      interestCoverage: 8,
      netIncome: 90,
    });

    expect(overlay.riskLevel).toBe('low');
    expect(overlay.summary).toMatch(/財務體質風險相對較低/);
  });

  it('classifies weak cashflow + high leverage as high risk', () => {
    const overlay = build({
      operatingCashFlow: -40,
      freeCashFlow: -25,
      debtRatio: 62,
      currentRatio: 0.8,
      quickRatio: 0.5,
      interestCoverage: 1.4,
      netIncome: 35,
    });

    expect(overlay.riskLevel).toBe('high');
    expect(overlay.pressures).toContain('槓桿偏高且流動性支撐不足');
  });

  it('flags growth still decent but cashflow weak', () => {
    const overlay = build({
      operatingCashFlow: -12,
      freeCashFlow: -8,
      debtRatio: 35,
      currentRatio: 1.2,
      netIncome: 60,
    });

    expect(overlay.summary).toMatch(/成長不差/);
    expect(overlay.cashflowContext).toMatch(/現金流轉化/);
  });

  it('degrades cleanly when financial structure data is missing', () => {
    const overlay = build({});

    expect(overlay.riskLevel).toBe('unknown');
    expect(overlay.summary).toMatch(/資料不足/);
    expect(overlay.limitations.join(' ')).toMatch(/未提供穩定的營運現金流/);
  });

  it('returns unknown for ETF without pretending precise analysis', () => {
    const overlay = build(
      {
        operatingCashFlow: 120,
        debtRatio: 15,
      },
      {
        ...baseFundamentals,
        kind: 'etf',
        dataCoverage: 'limited',
      },
    );

    expect(overlay.riskLevel).toBe('unknown');
    expect(overlay.summary).toMatch(/ETF 暫不建立公司財務結構式/);
  });
});
