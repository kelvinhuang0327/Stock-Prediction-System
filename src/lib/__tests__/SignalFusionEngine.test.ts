/**
 * SignalFusionEngine.test.ts
 *
 * Tests for fuseSignals() covering:
 * - Full data → valid alphaScore / bucket / confidence
 * - Missing chip → weight normalization
 * - Missing revenue → weight normalization
 * - ETF weights differ from stock weights
 * - <20 datapoints → Insufficient Data bucket
 * - Regime market adjustments
 */

import { fuseSignals } from '../alpha/SignalFusionEngine';
import { analyzeStock } from '../analysis/RuleBasedStockAnalyzer';
import { detectRegime } from '../market/MarketRegimeEngine';

jest.mock('../analysis/RuleBasedStockAnalyzer');
jest.mock('../market/MarketRegimeEngine');
jest.mock('../prisma', () => ({ prisma: {} }));

const mockAnalyzeStock = analyzeStock as jest.MockedFunction<typeof analyzeStock>;
const mockDetectRegime = detectRegime as jest.MockedFunction<typeof detectRegime>;

// ─── Fixtures ────────────────────────────────────────────────────

const BULL_REGIME = {
  regime: 'Bull' as const,
  confidence: 80,
  factors: [],
  dataCoverage: 'full' as const,
  samplePeriod: '2024-01-01 ~ 2025-01-01',
  dataPoints: 250,
  last_updated: '2025-01-01',
  limitations: [],
};

const UNKNOWN_REGIME = {
  regime: 'Unknown' as const,
  confidence: 0,
  factors: [],
  dataCoverage: 'insufficient' as const,
  samplePeriod: 'N/A',
  dataPoints: 0,
  last_updated: null,
  limitations: ['MarketIndex 資料不足'],
};

function makeAnalysis(overrides: Partial<ReturnType<typeof baseAnalysis>> = {}) {
  return { ...baseAnalysis(), ...overrides };
}

function baseAnalysis() {
  return {
    stockId: '2330',
    name: '台積電',
    closePrice: 580,
    priceChangePercent: 1.2,
    technicalScore: 70,
    chipStrength: 65,
    revenueYoY: 20,
    eps: 50,
    reason: '',
    riskScore: 30,
    riskLevel: 'Low' as const,
    isETF: false,
    momentumScore: 60,
    overallScore: 70,
    calculatedScore: 70,
    recommendation: '偏多' as const,
    summary: '技術面強勢',
    factors: [],
    dataPoints: 250,
    samplePeriod: '2024-01-01 ~ 2025-01-01',
    usedSources: ['StockQuote', 'InstitutionalChip', 'MonthlyRevenue'],
    missingSources: [],
    limitations: [],
    dataCoverage: 'full' as const,
    last_updated: '2025-01-01',
  };
}

// ─── Tests ───────────────────────────────────────────────────────

describe('SignalFusionEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetectRegime.mockResolvedValue(BULL_REGIME);
  });

  describe('fuseSignals — full data', () => {
    it('returns valid alphaScore, recommendationBucket, confidence with full data', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis());

      const result = await fuseSignals('2330');

      expect(result.symbol).toBe('2330');
      expect(result.alphaScore).toBeGreaterThanOrEqual(0);
      expect(result.alphaScore).toBeLessThanOrEqual(100);
      expect(['Strong Candidate', 'Watch', 'Neutral', 'Avoid', 'Insufficient Data'])
        .toContain(result.recommendationBucket);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('returns "Strong Candidate" for high-scoring stock in Bull regime', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis({
        technicalScore: 90,
        momentumScore: 85,
        chipStrength: 80,
        revenueYoY: 40,
        dataPoints: 250,
      }));

      const result = await fuseSignals('2330');

      expect(result.alphaScore).toBeGreaterThanOrEqual(75);
      expect(result.recommendationBucket).toBe('Strong Candidate');
    });

    it('exposes weights in result', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis());

      const result = await fuseSignals('2330');

      expect(result.weights.technical).toBeGreaterThan(0);
      const total = result.weights.technical + result.weights.chip + result.weights.fundamental + result.weights.market;
      expect(total).toBeCloseTo(1, 2);
    });
  });

  describe('fuseSignals — missing chip data', () => {
    it('normalizes weights when chip data is missing (chipStrength=0, no InstitutionalChip source)', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis({
        chipStrength: 0,
        usedSources: ['StockQuote', 'MonthlyRevenue'],
        missingSources: ['InstitutionalChip'],
      }));

      const result = await fuseSignals('2330');

      // chip weight should be 0 after normalization
      expect(result.weights.chip).toBe(0);
      // remaining weights should sum to 1
      const total = result.weights.technical + result.weights.chip + result.weights.fundamental + result.weights.market;
      expect(total).toBeCloseTo(1, 2);
      // should still produce valid alphaScore
      expect(result.alphaScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('fuseSignals — missing revenue data', () => {
    it('normalizes weights when revenue data is missing (revenueYoY=null)', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis({
        revenueYoY: null,
        usedSources: ['StockQuote', 'InstitutionalChip'],
        missingSources: ['MonthlyRevenue'],
      }));

      const result = await fuseSignals('2330');

      // fundamental weight should be 0 for non-ETF with no revenue
      expect(result.weights.fundamental).toBe(0);
      const total = result.weights.technical + result.weights.chip + result.weights.fundamental + result.weights.market;
      expect(total).toBeCloseTo(1, 2);
    });
  });

  describe('fuseSignals — ETF vs stock weights', () => {
    it('ETF: fundamental weight is 0, technical weight is higher than stock', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis({ isETF: true, revenueYoY: null }));
      const etfResult = await fuseSignals('0050');

      mockAnalyzeStock.mockResolvedValue(makeAnalysis({ isETF: false, revenueYoY: 20 }));
      const stockResult = await fuseSignals('2330');

      // ETF should have 0 fundamental weight
      expect(etfResult.weights.fundamental).toBe(0);
      // ETF technical weight should be higher
      expect(etfResult.weights.technical).toBeGreaterThan(stockResult.weights.technical);
    });
  });

  describe('fuseSignals — insufficient data', () => {
    it('returns "Insufficient Data" bucket when dataPoints < 20', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis({
        dataPoints: 10,
        dataCoverage: 'insufficient',
        technicalScore: 80, // even high score → still insufficient
      }));

      const result = await fuseSignals('2330');

      expect(result.recommendationBucket).toBe('Insufficient Data');
    });

    it('returns "Insufficient Data" bucket with 19 datapoints (boundary)', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis({ dataPoints: 19 }));
      const result = await fuseSignals('2330');
      expect(result.recommendationBucket).toBe('Insufficient Data');
    });

    it('does NOT return "Insufficient Data" with exactly 20 datapoints', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis({ dataPoints: 20, technicalScore: 80, momentumScore: 70 }));
      const result = await fuseSignals('2330');
      expect(result.recommendationBucket).not.toBe('Insufficient Data');
    });
  });

  describe('fuseSignals — regime override', () => {
    it('uses provided regimeOverride instead of calling detectRegime()', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis());
      const bearRegime = { ...BULL_REGIME, regime: 'Bear' as const, confidence: 70 };

      const result = await fuseSignals('2330', bearRegime);

      // detectRegime should NOT have been called
      expect(mockDetectRegime).not.toHaveBeenCalled();
      expect(result.marketRegime).toBe('Bear');
    });

    it('marketAdjustment is negative in Bear regime', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis({ technicalScore: 70, momentumScore: 60 }));
      const bearRegime = { ...BULL_REGIME, regime: 'Bear' as const, confidence: 80 };

      const result = await fuseSignals('2330', bearRegime);

      expect(result.marketAdjustment).toBeLessThan(0);
    });

    it('marketAdjustment is positive/non-negative in Bull regime with high tech score', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis({ technicalScore: 70, momentumScore: 60 }));

      const result = await fuseSignals('2330', BULL_REGIME);

      expect(result.marketAdjustment).toBeGreaterThanOrEqual(0);
    });
  });

  describe('fuseSignals — output integrity', () => {
    it('limitations array is always present (never null/undefined)', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis());
      const result = await fuseSignals('2330');
      expect(Array.isArray(result.limitations)).toBe(true);
    });

    it('usedSources and missingSources are always arrays', async () => {
      mockAnalyzeStock.mockResolvedValue(makeAnalysis());
      const result = await fuseSignals('2330');
      expect(Array.isArray(result.usedSources)).toBe(true);
      expect(Array.isArray(result.missingSources)).toBe(true);
    });

    it('Unknown regime adds MarketRegime to missingSources', async () => {
      mockDetectRegime.mockResolvedValue(UNKNOWN_REGIME);
      mockAnalyzeStock.mockResolvedValue(makeAnalysis());

      const result = await fuseSignals('2330');

      expect(result.marketRegime).toBe('Unknown');
      expect(result.missingSources.some(s => s.includes('MarketRegime'))).toBe(true);
    });
  });
});
