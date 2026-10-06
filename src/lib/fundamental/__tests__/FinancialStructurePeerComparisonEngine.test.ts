import {
  buildFinancialStructurePeerComparison,
  type FinancialStructurePeerRecord,
} from '../FinancialStructurePeerComparisonEngine';

function makePeer(overrides: Partial<FinancialStructurePeerRecord>): FinancialStructurePeerRecord {
  return {
    symbol: '2330',
    name: '台積電',
    debtRatio: 20,
    liabilitiesRatio: 45,
    currentRatio: 1.8,
    quickRatio: 1.5,
    roe: 18,
    roa: 11,
    assetTurnover: 0.92,
    cashflowConversion: 1.05,
    ...overrides,
  };
}

describe('FinancialStructurePeerComparisonEngine', () => {
  it('flags leverage pressure when debt and liabilities ratios are high vs peers', () => {
    const result = buildFinancialStructurePeerComparison({
      basis: 'industry',
      groupLabel: '半導體業',
      target: makePeer({ debtRatio: 38, liabilitiesRatio: 72 }),
      peers: [
        makePeer({ symbol: '1', debtRatio: 18, liabilitiesRatio: 41 }),
        makePeer({ symbol: '2', debtRatio: 20, liabilitiesRatio: 48 }),
        makePeer({ symbol: '3', debtRatio: 17, liabilitiesRatio: 39 }),
        makePeer({ symbol: '4', debtRatio: 22, liabilitiesRatio: 46 }),
      ],
    });

    expect(result.pressures).toContain('同組槓桿壓力偏高，財務結構需保守觀察');
    expect(result.pressures).toContain('同組負債結構偏重，財務彈性需保守觀察');
  });

  it('flags weak liquidity when current and quick ratios lag peers', () => {
    const result = buildFinancialStructurePeerComparison({
      basis: 'industry',
      groupLabel: '半導體業',
      target: makePeer({ currentRatio: 0.9, quickRatio: 0.7 }),
      peers: [
        makePeer({ symbol: '1', currentRatio: 1.7, quickRatio: 1.4 }),
        makePeer({ symbol: '2', currentRatio: 1.9, quickRatio: 1.6 }),
        makePeer({ symbol: '3', currentRatio: 1.8, quickRatio: 1.5 }),
        makePeer({ symbol: '4', currentRatio: 1.6, quickRatio: 1.3 }),
      ],
    });

    expect(result.pressures).toContain('流動性指標相對同組中性偏弱');
  });

  it('flags possible leverage amplification when ROE is high but ROA is neutral/weak', () => {
    const result = buildFinancialStructurePeerComparison({
      basis: 'industry',
      groupLabel: '半導體業',
      target: makePeer({ roe: 24, roa: 8, debtRatio: 34, liabilitiesRatio: 68 }),
      peers: [
        makePeer({ symbol: '1', roe: 15, roa: 9, debtRatio: 18, liabilitiesRatio: 44 }),
        makePeer({ symbol: '2', roe: 16, roa: 10, debtRatio: 20, liabilitiesRatio: 46 }),
        makePeer({ symbol: '3', roe: 17, roa: 10.5, debtRatio: 19, liabilitiesRatio: 45 }),
        makePeer({ symbol: '4', roe: 18, roa: 9.5, debtRatio: 21, liabilitiesRatio: 47 }),
      ],
    });

    expect(result.pressures).toContain('資本報酬不差，但部分表現可能受槓桿放大');
  });

  it('flags weak turnover and cashflow conversion when both lag peers', () => {
    const result = buildFinancialStructurePeerComparison({
      basis: 'industry',
      groupLabel: '半導體業',
      target: makePeer({ assetTurnover: 0.42, cashflowConversion: 0.41 }),
      peers: [
        makePeer({ symbol: '1', assetTurnover: 0.91, cashflowConversion: 1.02 }),
        makePeer({ symbol: '2', assetTurnover: 0.88, cashflowConversion: 0.94 }),
        makePeer({ symbol: '3', assetTurnover: 0.95, cashflowConversion: 1.08 }),
        makePeer({ symbol: '4', assetTurnover: 0.86, cashflowConversion: 0.97 }),
      ],
    });

    expect(result.pressures).toContain('資產周轉效率相對同組偏弱');
    expect(result.pressures).toContain('現金流轉換率相對同組偏弱');
  });

  it('reports relative strengths when most structure metrics are strong', () => {
    const result = buildFinancialStructurePeerComparison({
      basis: 'industry',
      groupLabel: '半導體業',
      target: makePeer({
        debtRatio: 12,
        liabilitiesRatio: 31,
        currentRatio: 2.5,
        quickRatio: 2.1,
        roe: 23,
        roa: 15,
        assetTurnover: 1.22,
        cashflowConversion: 1.24,
      }),
      peers: [
        makePeer({ symbol: '1', debtRatio: 18, liabilitiesRatio: 44, currentRatio: 1.7, quickRatio: 1.3, roe: 15, roa: 9, assetTurnover: 0.82, cashflowConversion: 0.88 }),
        makePeer({ symbol: '2', debtRatio: 20, liabilitiesRatio: 48, currentRatio: 1.8, quickRatio: 1.4, roe: 16, roa: 10, assetTurnover: 0.86, cashflowConversion: 0.9 }),
        makePeer({ symbol: '3', debtRatio: 17, liabilitiesRatio: 42, currentRatio: 1.6, quickRatio: 1.2, roe: 14, roa: 8.5, assetTurnover: 0.79, cashflowConversion: 0.84 }),
        makePeer({ symbol: '4', debtRatio: 19, liabilitiesRatio: 45, currentRatio: 1.9, quickRatio: 1.5, roe: 17, roa: 10.2, assetTurnover: 0.88, cashflowConversion: 0.95 }),
      ],
    });

    expect(result.summary).toContain('相對位置偏強');
    expect(result.strengths).toContain('同組槓桿與流動性結構相對穩健');
  });

  it('degrades conservatively when peer sample is insufficient', () => {
    const result = buildFinancialStructurePeerComparison({
      basis: 'industry',
      groupLabel: '半導體業',
      target: makePeer({}),
      peers: [makePeer({ symbol: '1' }), makePeer({ symbol: '2' })],
    });

    expect(result.dataCoverage).toBe('insufficient');
    expect(result.summary).toContain('資料不足');
    expect(result.limitations.join(' ')).toContain('可比較財務結構 / 效率指標不足');
  });

  it('returns ETF-safe degraded comparison', () => {
    const result = buildFinancialStructurePeerComparison({
      basis: 'industry',
      groupLabel: 'ETF',
      target: makePeer({}),
      peers: [makePeer({ symbol: '1' }), makePeer({ symbol: '2' }), makePeer({ symbol: '3' })],
      isETF: true,
    });

    expect(result.basis).toBe('none');
    expect(result.summary).toContain('ETF 暫不做公司財務結構與效率的同組比較');
    expect(result.limitations[0]).toContain('ETF 不適用');
  });
});
