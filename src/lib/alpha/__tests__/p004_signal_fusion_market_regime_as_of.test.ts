/**
 * P0-04: SignalFusionEngine — market regime as-of gate tests
 *
 * Validates that fuseBatch() and fuseSignals() pass asOf to detectRegime().
 *
 * - No DB writes
 * - No external API calls
 * - No strategy mutation
 * - No performance claims
 */

import { fuseBatch, fuseSignals } from '../../alpha/SignalFusionEngine';

jest.mock('@/lib/market/MarketRegimeEngine', () => ({
  detectRegime: jest.fn().mockResolvedValue({
    regime: 'Neutral',
    confidence: 0.5,
    factors: [],
    dataCoverage: 'limited',
    samplePeriod: '20d',
    dataPoints: 10,
    last_updated: '2026-05-07',
    limitations: [],
  }),
  MarketRegime: {},
}));

jest.mock('@/lib/analysis/RuleBasedStockAnalyzer', () => ({
  analyzeStock: jest.fn().mockResolvedValue({
    symbol: '2330',
    name: 'TSMC',
    closePrice: 900,
    priceChangePercent: 0.5,
    isETF: false,
    technicalScore: 60,
    momentumScore: 55,
    chipScore: 65,
    fundamentalScore: 70,
    marketContextScore: 50,
    revenueYoY: 10,
    last_updated: '2026-05-07',
    limitations: [],
    usedSources: ['stockQuote'],
    missingSources: [],
    dataCoverage: 'full',
    factors: [],
  }),
}));

const { detectRegime } = jest.requireMock('@/lib/market/MarketRegimeEngine');

describe('P0-04: SignalFusionEngine — market regime as-of gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (detectRegime as jest.Mock).mockResolvedValue({
      regime: 'Neutral',
      confidence: 0.5,
      factors: [],
      dataCoverage: 'limited',
      samplePeriod: '20d',
      dataPoints: 10,
      last_updated: '2026-05-07',
      limitations: [],
    });
  });

  it('fuseBatch passes asOf to detectRegime()', async () => {
    await fuseBatch(['2330'], '2026-05-07');
    expect(detectRegime).toHaveBeenCalledWith('2026-05-07');
  });

  it('fuseBatch without asOf calls detectRegime() with no args (backward compat)', async () => {
    await fuseBatch(['2330']);
    expect(detectRegime).toHaveBeenCalledWith(undefined);
  });

  it('fuseSignals passes asOf to detectRegime() when no regimeOverride', async () => {
    await fuseSignals('2330', undefined, '2026-05-07');
    expect(detectRegime).toHaveBeenCalledWith('2026-05-07');
  });

  it('fuseSignals does NOT call detectRegime() when regimeOverride provided', async () => {
    const override = {
      regime: 'Bull' as const,
      confidence: 0.9,
      factors: [],
      dataCoverage: 'full' as const,
      samplePeriod: '20d',
      dataPoints: 20,
      last_updated: '2026-05-07',
      limitations: [],
    };
    await fuseSignals('2330', override, '2026-05-07');
    expect(detectRegime).not.toHaveBeenCalled();
  });

  it('no strategy mutation — result structure unchanged', async () => {
    const results = await fuseBatch(['2330'], '2026-05-07');
    expect(results[0]).toHaveProperty('alphaScore');
    expect(results[0]).toHaveProperty('marketRegime');
    expect(typeof results[0].alphaScore).toBe('number');
  });
});
