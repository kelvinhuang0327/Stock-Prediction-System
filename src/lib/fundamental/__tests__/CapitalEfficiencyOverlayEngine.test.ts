import { buildCapitalEfficiencyOverlay } from '../CapitalEfficiencyOverlayEngine';
import type { CapitalEfficiencyMetrics } from '../CapitalEfficiencyMetricsBuilder';
import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { CashflowLeverageOverlay } from '../CashflowLeverageOverlayEngine';

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

const neutralCashflowOverlay: CashflowLeverageOverlay = {
  riskLevel: 'moderate',
  cashflowContext: '現金流資料大致中性。',
  leverageContext: '槓桿與流動性資料大致中性。',
  strengths: [],
  pressures: [],
  summary: '財務體質中性。',
  limitations: [],
};

function build(metrics: CapitalEfficiencyMetrics, fundamentals = baseFundamentals, cashflowLeverageOverlay = neutralCashflowOverlay) {
  return buildCapitalEfficiencyOverlay({
    metrics,
    fundamentals,
    cashflowLeverageOverlay,
  });
}

describe('CapitalEfficiencyOverlayEngine', () => {
  it('classifies high ROE / ROA with good conversion as low risk', () => {
    const overlay = build({
      roe: 19,
      roa: 9,
      assetTurnover: 1.05,
      cashflowConversion: 1.02,
      earningsQuality: 'strong',
      marginStability: 'stable',
      returnStability: 'stable',
      roeRoaGap: 10,
      ttmRevenue: 1200,
      dataCoverage: 'full',
      limitations: [],
    });

    expect(overlay.riskLevel).toBe('low');
    expect(overlay.summary).toMatch(/資本使用效率偏佳/);
  });

  it('flags high ROE that may be leverage-amplified', () => {
    const overlay = build(
      {
        roe: 18,
        roa: 2.8,
        assetTurnover: 0.7,
        cashflowConversion: 0.9,
        earningsQuality: 'mixed',
        marginStability: 'mixed',
        returnStability: 'mixed',
        roeRoaGap: 15.2,
        ttmRevenue: 980,
        dataCoverage: 'full',
        limitations: [],
      },
      baseFundamentals,
      {
        ...neutralCashflowOverlay,
        riskLevel: 'elevated',
        pressures: ['槓桿壓力偏高'],
      },
    );

    expect(overlay.summary).toMatch(/槓桿放大影響/);
    expect(overlay.pressures).toContain('高 ROE 可能受槓桿放大影響');
  });

  it('flags positive earnings with weak cash conversion', () => {
    const overlay = build({
      roe: 11,
      roa: 5,
      assetTurnover: 0.85,
      cashflowConversion: 0.2,
      earningsQuality: 'weak',
      marginStability: 'mixed',
      returnStability: 'mixed',
      roeRoaGap: 6,
      ttmRevenue: 1100,
      dataCoverage: 'full',
      limitations: [],
    });

    expect(overlay.riskLevel === 'elevated' || overlay.riskLevel === 'high').toBe(true);
    expect(overlay.summary).toMatch(/現金流轉換品質偏弱/);
  });

  it('flags weak asset turnover as a pressure', () => {
    const overlay = build({
      roe: 8,
      roa: 4,
      assetTurnover: 0.35,
      cashflowConversion: 0.7,
      earningsQuality: 'mixed',
      marginStability: 'mixed',
      returnStability: 'mixed',
      roeRoaGap: 4,
      ttmRevenue: 500,
      dataCoverage: 'full',
      limitations: [],
    });

    expect(overlay.pressures).toContain('資產周轉效率偏弱');
  });

  it('degrades cleanly when metrics are insufficient', () => {
    const overlay = build({
      roe: null,
      roa: null,
      assetTurnover: null,
      cashflowConversion: null,
      earningsQuality: 'insufficient',
      marginStability: 'insufficient',
      returnStability: 'insufficient',
      roeRoaGap: null,
      ttmRevenue: null,
      dataCoverage: 'insufficient',
      limitations: ['缺少有效 equity。'],
    });

    expect(overlay.riskLevel).toBe('unknown');
    expect(overlay.summary).toMatch(/資料不足/);
  });

  it('returns unknown for ETF without pretending precise analysis', () => {
    const overlay = build(
      {
        roe: 15,
        roa: 7,
        assetTurnover: 0.9,
        cashflowConversion: 1,
        earningsQuality: 'strong',
        marginStability: 'stable',
        returnStability: 'stable',
        roeRoaGap: 8,
        ttmRevenue: 1000,
        dataCoverage: 'full',
        limitations: [],
      },
      {
        ...baseFundamentals,
        kind: 'etf',
        dataCoverage: 'limited',
      },
    );

    expect(overlay.riskLevel).toBe('unknown');
    expect(overlay.summary).toMatch(/ETF 暫不建立公司營運式的資本效率與獲利品質判讀/);
  });
});
