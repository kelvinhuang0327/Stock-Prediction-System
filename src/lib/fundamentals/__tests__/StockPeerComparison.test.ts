import {
  buildStockPeerComparison,
  type BuildStockPeerComparisonInput,
} from '../StockPeerComparison';

const BASE_INPUT: BuildStockPeerComparisonInput = {
  target: {
    symbol: '2330',
    name: '台積電',
    revenueYoY: 18,
    eps: 12.5,
    grossMargin: 55,
    operatingMargin: 44,
    pe: 18,
    pb: 4,
    dividendYield: 2.6,
  },
  peers: [
    { symbol: '2454', name: '聯發科', revenueYoY: 12, eps: 10.4, grossMargin: 47, operatingMargin: 31, pe: 22, pb: 5, dividendYield: 2.1 },
    { symbol: '2303', name: '聯電', revenueYoY: 5, eps: 3.1, grossMargin: 31, operatingMargin: 18, pe: 14, pb: 2, dividendYield: 3.8 },
    { symbol: '3034', name: '聯詠', revenueYoY: 7, eps: 9.2, grossMargin: 38, operatingMargin: 24, pe: 16, pb: 3.1, dividendYield: 4.4 },
    { symbol: '3711', name: '日月光投控', revenueYoY: 10, eps: 8.3, grossMargin: 20, operatingMargin: 11, pe: 17, pb: 2.4, dividendYield: 3.4 },
  ],
  basis: 'industry',
  groupLabel: '半導體業',
};

describe('buildStockPeerComparison', () => {
  it('builds relative comparisons and strengths', () => {
    const result = buildStockPeerComparison(BASE_INPUT);

    expect(result.peerCount).toBe(4);
    expect(result.dataCoverage).toBe('limited');
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.summary).toContain('半導體業');
  });

  it('returns insufficient result when no peers are available', () => {
    const result = buildStockPeerComparison({
      ...BASE_INPUT,
      peers: [],
    });

    expect(result.dataCoverage).toBe('insufficient');
    expect(result.limitations[0]).toContain('同組樣本不足');
  });

  it('marks mixed profile when strengths and cautions coexist', () => {
    const result = buildStockPeerComparison({
      ...BASE_INPUT,
      target: {
        ...BASE_INPUT.target,
        revenueYoY: 3,
        pe: 28,
      },
    });

    expect(result.cautions.length).toBeGreaterThan(0);
  });
});
