import { buildPeerPercentileDetailTable, buildUnknownPeerPercentileDetailTable } from '../PeerPercentileDetailTableBuilder';
import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { StockPeerComparison } from '@/lib/fundamentals/StockPeerComparison';
import type { FinancialStructurePeerComparison } from '../FinancialStructurePeerComparisonEngine';
import type { FullFundamentalComparisonMatrix } from '../FullFundamentalComparisonMatrixBuilder';

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
  metrics: [
    { key: 'revenueYoY', label: '營收 YoY', targetValue: 18.5, peerMedian: 10.1, percentile: 83, interpretation: '優於多數同組樣本。' },
    { key: 'eps', label: 'EPS', targetValue: 9.2, peerMedian: 8.8, percentile: 65, interpretation: '接近同組中位水準。' },
    { key: 'grossMargin', label: '毛利率', targetValue: 54.1, peerMedian: 48.2, percentile: 82, interpretation: '優於多數同組樣本。' },
    { key: 'operatingMargin', label: '營益率', targetValue: 42.3, peerMedian: 38.5, percentile: 79, interpretation: '優於多數同組樣本。' },
    { key: 'pe', label: 'PE', targetValue: 24.6, peerMedian: 21.2, percentile: 35, interpretation: '相對同組估值偏高。' },
    { key: 'pb', label: 'PB', targetValue: 3.1, peerMedian: 2.9, percentile: 40, interpretation: '接近同組中位水準。' },
    { key: 'dividendYield', label: '殖利率', targetValue: 2.2, peerMedian: 2.0, percentile: 57, interpretation: '接近同組中位水準。' },
  ],
  strengths: ['營收 YoY相對同組偏強'],
  cautions: ['PE相對同組偏高'],
  limitations: ['同 industry 樣本不足，已退回 sector 層級比較。'],
};

const financialStructurePeerComparison: FinancialStructurePeerComparison = {
  basis: 'industry',
  groupLabel: '半導體業',
  peerSampleSize: 6,
  dataCoverage: 'limited',
  metrics: {
    debtRatio: { value: 18, median: 24, percentile: 82, interpretation: '相對同組槓桿壓力不高。' },
    liabilitiesRatio: { value: 48, median: 55, percentile: 74, interpretation: '相對同組財務結構較穩。' },
    currentRatio: { value: 1.8, median: 1.5, percentile: 75, interpretation: '相對同組流動性支撐較佳。' },
    quickRatio: { value: 1.4, median: 1.2, percentile: 68, interpretation: '接近同組中位水準。' },
    roe: { value: 18, median: 15, percentile: 78, interpretation: '優於多數同組樣本。' },
    roa: { value: 8.1, median: 6.7, percentile: 72, interpretation: '優於多數同組樣本。' },
    assetTurnover: { value: 1.05, median: 0.92, percentile: 71, interpretation: '優於多數同組樣本。' },
    cashflowConversion: { value: 0.88, median: 0.95, percentile: 42, interpretation: '接近同組中位水準。' },
  },
  strengths: ['同組槓桿與流動性結構相對穩健'],
  pressures: ['資本報酬不差，但部分表現可能受槓桿放大'],
  summary: '相較半導體業同組樣本，財務結構與效率優勢與壓力並存。',
  limitations: ['同 industry 樣本不足，已退回 sector 層級比較。'],
};

const fundamentalMatrix: FullFundamentalComparisonMatrix = {
  overallSummary: '基本面優勢與壓力並存，建議搭配同組位置與後續財報持續追蹤。',
  limitations: ['同組樣本有限，解讀已保守處理。'],
  sections: {
    growth: { title: '成長', status: 'strong', summary: '同組成長表現偏強，但估值壓力較高。', highlights: ['同組成長表現偏強'], warnings: [], basis: 'industry · 半導體業', peerSampleSize: 6, limitations: [] },
    valuation: { title: '估值', status: 'pressure', summary: 'PE / PB 相對同組偏高，後續需要成長持續性支撐。', highlights: [], warnings: ['相對同組估值偏高'], basis: 'industry · 半導體業', peerSampleSize: 6, limitations: [] },
    financialStructure: { title: '財務體質', status: 'pressure', summary: '營運成長不差，但現金流轉化仍偏弱，成長延續性需持續追蹤。', highlights: ['負債壓力不高'], warnings: ['流動性支撐偏弱'], basis: 'industry · 半導體業', peerSampleSize: 6, limitations: [] },
    efficiency: { title: '經營效率', status: 'pressure', summary: '帳面報酬不差，但部分表現可能受槓桿放大影響。', highlights: ['部分效率指標仍具支撐'], warnings: ['高 ROE 可能受槓桿放大影響'], basis: 'industry · 半導體業', peerSampleSize: 6, limitations: [] },
    peerPosition: { title: '同組位置', status: 'neutral', summary: '相較半導體業同組樣本，財務結構與效率優勢與壓力並存。', highlights: ['同組槓桿與流動性結構相對穩健'], warnings: ['資本報酬不差，但部分表現可能受槓桿放大'], basis: 'industry · 半導體業', peerSampleSize: 6, limitations: [] },
  },
};

describe('buildPeerPercentileDetailTable', () => {
  it('builds a detailed percentile table from peer comparisons', () => {
    const table = buildPeerPercentileDetailTable({
      fundamentals,
      peerComparison,
      financialStructurePeerComparison,
      fundamentalMatrix,
    });

    expect(table.basis).toBe('industry');
    expect(table.peerSampleSize).toBe(6);
    expect(table.rows).toHaveLength(14);
    expect(table.rows[0].label).toBe('營收 YoY');
    expect(table.rows[0].percentile).toBe(83);
    expect(table.rows[7].label).toBe('負債佔資產比');
    expect(table.rows[7].interpretation).toBe('同組中性');
    expect(table.limitations).toContain('同組樣本有限，解讀已保守處理。');
  });

  it('builds a degraded unknown table for ETFs', () => {
    const table = buildUnknownPeerPercentileDetailTable({ isETF: true });

    expect(table.basis).toBe('none');
    expect(table.peerSampleSize).toBe(0);
    expect(table.rows.some((row) => row.interpretation.includes('ETF'))).toBe(true);
    expect(table.limitations[0]).toContain('ETF');
  });
});
