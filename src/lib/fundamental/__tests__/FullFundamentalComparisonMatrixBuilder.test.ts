import {
  buildFullFundamentalComparisonMatrix,
  buildUnknownFundamentalComparisonMatrix,
  fundamentalMatrixStatusLabel,
} from '../FullFundamentalComparisonMatrixBuilder';
import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { StockPeerComparison } from '@/lib/fundamentals/StockPeerComparison';
import type { FundamentalRiskOverlay } from '../FundamentalRiskOverlayEngine';
import type { CashflowLeverageOverlay } from '../CashflowLeverageOverlayEngine';
import type { CapitalEfficiencyOverlay } from '../CapitalEfficiencyOverlayEngine';
import type { FinancialStructurePeerComparison } from '../FinancialStructurePeerComparisonEngine';

const fundamentals: StockFundamentalSnapshot = {
  kind: 'stock',
  dataCoverage: 'full',
  revenue: {
    latestMonth: '2026/03',
    revenue: 2100,
    yoyGrowth: 18.5,
    momGrowth: 2.4,
    trend: 'improving',
    consecutivePositiveYoYMonths: 4,
  },
  profitability: {
    latestPeriod: '2025 Q4',
    eps: 9.2,
    previousEps: 8.7,
    epsQoQDelta: 0.5,
    grossMargin: 54.1,
    grossMarginDelta: 1.1,
    operatingMargin: 42.3,
    operatingMarginDelta: 0.7,
  },
  valuation: {
    asOfDate: '2026-03-24',
    pe: 24.6,
    pb: 3.1,
    dividendYield: 2.2,
  },
  keySignals: ['營收年增維持雙位數'],
  keyRisks: ['估值偏高，需結合同業比較與成長性一併解讀。'],
  summary: '基本面整體穩定，營運訊號偏正向。',
  limitations: [],
};

const peerComparison: StockPeerComparison = {
  basis: 'industry',
  groupLabel: '半導體業',
  peerCount: 6,
  dataCoverage: 'limited',
  summary: '相較半導體業同組樣本，基本面優勢與壓力並存。',
  metrics: [],
  strengths: ['營收 YoY相對同組偏強'],
  cautions: ['PE相對同組偏高'],
  limitations: ['同 industry 樣本不足，已退回 sector 層級比較。'],
};

const overlay: FundamentalRiskOverlay = {
  riskLevel: 'elevated',
  strengths: ['同組成長表現偏強'],
  pressures: ['相對同組估值偏高'],
  valuationContext: 'PE / PB 相對同組偏高，後續需要成長持續性支撐。',
  growthContext: '同組成長表現偏強，但估值壓力較高。',
  summary: '同組成長表現偏強，但估值壓力較高。',
  limitations: ['同組樣本有限，解讀已保守處理。'],
};

const cashflowLeverageOverlay: CashflowLeverageOverlay = {
  riskLevel: 'elevated',
  cashflowContext: '營運成長不差，但現金流轉化仍偏弱，後續需觀察成長品質。',
  leverageContext: '負債壓力不高，但流動性支撐仍偏弱，短期周轉能力需留意。',
  strengths: ['負債壓力不高'],
  pressures: ['成長延續需持續觀察現金流轉化能力', '流動性支撐偏弱'],
  summary: '營運成長不差，但現金流轉化仍偏弱，成長延續性需持續追蹤。',
  limitations: ['現金流欄位僅部分可得。'],
};

const capitalEfficiencyOverlay: CapitalEfficiencyOverlay = {
  riskLevel: 'moderate',
  efficiencyContext: '部分效率指標不差，但尚未形成全面性的效率優勢。',
  profitabilityContext: '帳面獲利效率大致中性，需搭配財務體質與後續季度觀察。',
  conversionContext: '現金流與獲利大致同向，但轉現效率尚未形成明確優勢。',
  strengths: ['部分效率指標仍具支撐'],
  pressures: [],
  summary: '資本效率與獲利品質大致中性，建議搭配後續財報持續追蹤。',
  limitations: [],
};

const financialStructurePeerComparison: FinancialStructurePeerComparison = {
  basis: 'industry',
  groupLabel: '半導體業',
  peerSampleSize: 6,
  dataCoverage: 'limited',
  metrics: {
    debtRatio: { value: 18, median: 24, percentile: 82, interpretation: '相對同組槓桿壓力不高。' },
    currentRatio: { value: 1.8, median: 1.5, percentile: 75, interpretation: '相對同組流動性支撐較佳。' },
    roe: { value: 18, median: 15, percentile: 78, interpretation: '優於多數同組樣本。' },
    cashflowConversion: { value: 0.88, median: 0.95, percentile: 42, interpretation: '接近同組中位水準。' },
  },
  strengths: ['同組槓桿與流動性結構相對穩健'],
  pressures: ['資本報酬不差，但部分表現可能受槓桿放大'],
  summary: '相較半導體業同組樣本，財務結構與效率優勢與壓力並存。',
  limitations: ['同 industry 樣本不足，已退回 sector 層級比較。'],
};

describe('FullFundamentalComparisonMatrixBuilder', () => {
  it('builds five fundamental sections with unified statuses', () => {
    const matrix = buildFullFundamentalComparisonMatrix({
      fundamentals,
      peerComparison,
      overlay,
      cashflowLeverageOverlay,
      capitalEfficiencyOverlay,
      financialStructurePeerComparison,
    });

    expect(matrix.sections.growth.status).toBe('strong');
    expect(matrix.sections.valuation.status).toBe('pressure');
    expect(matrix.sections.financialStructure.status).toBe('pressure');
    expect(matrix.sections.efficiency.status).toBe('neutral');
    expect(matrix.sections.peerPosition.status).toBe('neutral');
    expect(matrix.sections.growth.basis).toBe('industry · 半導體業');
    expect(matrix.sections.peerPosition.peerSampleSize).toBe(6);
    expect(matrix.overallSummary).toContain('優勢與壓力並存');
  });

  it('builds degraded unknown matrix for ETFs', () => {
    const matrix = buildUnknownFundamentalComparisonMatrix({ isETF: true });

    expect(matrix.overallSummary).toContain('ETF');
    expect(matrix.sections.growth.status).toBe('unknown');
    expect(matrix.sections.peerPosition.status).toBe('unknown');
    expect(matrix.limitations[0]).toContain('ETF');
  });

  it('returns consistent status labels', () => {
    expect(fundamentalMatrixStatusLabel('strong')).toBe('偏強');
    expect(fundamentalMatrixStatusLabel('neutral')).toBe('中性');
    expect(fundamentalMatrixStatusLabel('pressure')).toBe('承壓');
    expect(fundamentalMatrixStatusLabel('unknown')).toBe('資料不足');
  });
});
