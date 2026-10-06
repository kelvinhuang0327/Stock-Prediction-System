import { buildFundamentalRiskOverlay } from '../FundamentalRiskOverlayEngine';
import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { StockPeerComparison } from '@/lib/fundamentals/StockPeerComparison';

const baseFundamentals: StockFundamentalSnapshot = {
  kind: 'stock',
  dataCoverage: 'full',
  revenue: {
    latestMonth: '2026/03',
    revenue: 1000,
    yoyGrowth: 18,
    momGrowth: 2,
    trend: 'improving',
    consecutivePositiveYoYMonths: 4,
  },
  profitability: {
    latestPeriod: '2025 Q4',
    eps: 12.5,
    previousEps: 11.2,
    epsQoQDelta: 1.3,
    grossMargin: 55,
    grossMarginDelta: 1.2,
    operatingMargin: 44,
    operatingMarginDelta: 1.1,
  },
  valuation: {
    asOfDate: '2026-03-24',
    pe: 18,
    pb: 3.5,
    dividendYield: 2.5,
  },
  keySignals: [],
  keyRisks: [],
  summary: '基本面穩定。',
  limitations: [],
};

const makePeer = (overrides?: Partial<StockPeerComparison>): StockPeerComparison => ({
  basis: 'industry',
  groupLabel: '半導體業',
  peerCount: 6,
  dataCoverage: 'full',
  summary: '同組比較',
  metrics: [
    { key: 'revenueYoY', label: '營收 YoY', targetValue: 18, peerMedian: 9, percentile: 85, interpretation: '優於多數同組樣本。' },
    { key: 'eps', label: 'EPS', targetValue: 12.5, peerMedian: 8, percentile: 80, interpretation: '優於多數同組樣本。' },
    { key: 'grossMargin', label: '毛利率', targetValue: 55, peerMedian: 38, percentile: 88, interpretation: '優於多數同組樣本。' },
    { key: 'operatingMargin', label: '營益率', targetValue: 44, peerMedian: 24, percentile: 84, interpretation: '優於多數同組樣本。' },
    { key: 'pe', label: 'PE', targetValue: 18, peerMedian: 20, percentile: 75, interpretation: '相對同組估值不高。' },
    { key: 'pb', label: 'PB', targetValue: 3.5, peerMedian: 4.1, percentile: 72, interpretation: '相對同組估值不高。' },
    { key: 'dividendYield', label: '殖利率', targetValue: 2.5, peerMedian: 2.2, percentile: 70, interpretation: '優於多數同組樣本。' },
  ],
  strengths: [],
  cautions: [],
  limitations: [],
  ...overrides,
});

describe('buildFundamentalRiskOverlay', () => {
  it('handles high growth with high valuation', () => {
    const result = buildFundamentalRiskOverlay({
      fundamentals: baseFundamentals,
      peerComparison: makePeer({
        metrics: makePeer().metrics.map((metric) =>
          metric.key === 'pe' || metric.key === 'pb'
            ? { ...metric, percentile: 20, interpretation: '相對同組估值偏高。' }
            : metric,
        ),
      }),
    });

    expect(result.riskLevel).toBe('elevated');
    expect(result.summary).toContain('估值壓力');
  });

  it('handles low valuation but weakening profits', () => {
    const result = buildFundamentalRiskOverlay({
      fundamentals: {
        ...baseFundamentals,
        profitability: {
          ...baseFundamentals.profitability,
          epsQoQDelta: -0.8,
          operatingMarginDelta: -1.2,
        },
      },
      peerComparison: makePeer({
        metrics: makePeer().metrics.map((metric) => {
          if (metric.key === 'pe' || metric.key === 'pb') return { ...metric, percentile: 80 };
          if (metric.key === 'eps' || metric.key === 'grossMargin' || metric.key === 'operatingMargin') return { ...metric, percentile: 20 };
          return metric;
        }),
      }),
    });

    expect(result.riskLevel).toBe('elevated');
    expect(result.summary).toContain('估值不高也不代表基本面風險已解除');
  });

  it('marks low risk when most percentiles are strong', () => {
    const result = buildFundamentalRiskOverlay({
      fundamentals: baseFundamentals,
      peerComparison: makePeer(),
    });

    expect(result.riskLevel).toBe('low');
    expect(result.strengths.some((item) => item.includes('偏強'))).toBe(true);
  });

  it('degrades to unknown when data is insufficient', () => {
    const result = buildFundamentalRiskOverlay({
      fundamentals: {
        ...baseFundamentals,
        dataCoverage: 'insufficient',
      },
      peerComparison: null,
    });

    expect(result.riskLevel).toBe('unknown');
    expect(result.limitations.some((item) => item.includes('不足'))).toBe(true);
  });

  it('returns unknown for ETFs without pretending to compare company operations', () => {
    const result = buildFundamentalRiskOverlay({
      fundamentals: {
        ...baseFundamentals,
        kind: 'etf',
      },
      peerComparison: makePeer(),
    });

    expect(result.riskLevel).toBe('unknown');
    expect(result.summary).toContain('ETF');
    expect(result.limitations.some((item) => item.includes('ETF'))).toBe(true);
  });
});
