/**
 * StrategyScreenEngine.test.ts
 *
 * Tests for runScreen() covering:
 * - Regime-based threshold adjustments (Bull/Bear/Unknown)
 * - High alpha + low confidence → not Strong Candidate
 * - Insufficient data → excluded or degraded bucket
 * - Empty universe → safe empty result
 * - Excluded reasons populated correctly
 */

import { runScreen } from '../screen/StrategyScreenEngine';
import { fuseBatch } from '../alpha/SignalFusionEngine';
import { detectRegime } from '../market/MarketRegimeEngine';
import { prisma } from '../prisma';

jest.mock('../alpha/SignalFusionEngine');
jest.mock('../market/MarketRegimeEngine');
jest.mock('../prisma', () => ({
  prisma: {
    stockQuote: {
      groupBy: jest.fn(),
    },
  },
}));

const mockFuseBatch = fuseBatch as jest.MockedFunction<typeof fuseBatch>;
const mockDetectRegime = detectRegime as jest.MockedFunction<typeof detectRegime>;
const mockGroupBy = prisma.stockQuote.groupBy as jest.Mock;

// ─── Fixtures ────────────────────────────────────────────────────

const BULL_REGIME = {
  regime: 'Bull' as const, confidence: 80, factors: [], dataCoverage: 'full' as const,
  samplePeriod: '2024-01-01 ~ 2025-01-01', dataPoints: 250, last_updated: '2025-01-01', limitations: [],
};
const BEAR_REGIME = { ...BULL_REGIME, regime: 'Bear' as const };
const UNKNOWN_REGIME = {
  regime: 'Unknown' as const, confidence: 0, factors: [], dataCoverage: 'insufficient' as const,
  samplePeriod: 'N/A', dataPoints: 0, last_updated: null, limitations: ['MarketIndex 不足'],
};

function makeFusionResult(overrides: Partial<ReturnType<typeof baseFusion>> = {}) {
  return { ...baseFusion(), ...overrides };
}

function baseFusion() {
  return {
    symbol: '2330',
    name: '台積電',
    closePrice: 580,
    priceChangePercent: 1.2,
    isETF: false,
    alphaScore: 75,
    recommendationBucket: 'Strong Candidate' as const,
    confidence: 70,
    technicalScore: 75,
    chipScore: 70,
    fundamentalScore: 65,
    marketAdjustment: 5,
    weights: { technical: 0.4, chip: 0.3, fundamental: 0.2, market: 0.1 },
    marketRegime: 'Bull' as const,
    marketRegimeConfidence: 80,
    factors: [],
    usedSources: ['StockQuote', 'InstitutionalChip', 'MonthlyRevenue'],
    missingSources: [],
    limitations: [],
    dataCoverage: 'full' as const,
    last_updated: '2025-01-01',
  };
}

// ─── Tests ───────────────────────────────────────────────────────

describe('StrategyScreenEngine — runScreen()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetectRegime.mockResolvedValue(BULL_REGIME);
    mockGroupBy.mockResolvedValue([{ stockId: '2330', _count: { stockId: 100 } }]);
  });

  describe('empty universe', () => {
    it('returns safe empty result when no stocks have enough data', async () => {
      mockGroupBy.mockResolvedValue([]);

      const result = await runScreen();

      expect(result.candidates).toEqual([]);
      expect(result.excludedCount).toBe(0);
      expect(result.totalScanned).toBe(0);
      expect(result.limitations.length).toBeGreaterThan(0);
      expect(result.disclaimer).toBeTruthy();
    });
  });

  describe('regime threshold adjustments', () => {
    it('Bull regime: min alpha threshold is reduced by 5 (more permissive)', async () => {
      mockDetectRegime.mockResolvedValue(BULL_REGIME);
      // Stock with alpha=36 (just above 40-5=35)
      mockFuseBatch.mockResolvedValue([makeFusionResult({ alphaScore: 36, confidence: 50 })]);

      const result = await runScreen({ minAlphaScore: 40, respectMarketRegime: true });

      // In Bull, effective min = 40 - 5 = 35; REGIME_ALPHA_OFFSET.Bull is negative → "降低"
      expect(result.screenParams.appliedRegimeAdjustment).toContain('降低');
    });

    it('Bear regime: min alpha threshold is increased by 10 (stricter)', async () => {
      mockDetectRegime.mockResolvedValue(BEAR_REGIME);
      // Stock with alpha=49 (below 40+10=50)
      mockFuseBatch.mockResolvedValue([makeFusionResult({ alphaScore: 49, confidence: 50 })]);

      const result = await runScreen({ minAlphaScore: 40, respectMarketRegime: true });

      // In Bear, effective min = 40 + 10 = 50; alpha=49 should be excluded
      const candidate = result.candidates.find(c => c.symbol === '2330');
      expect(candidate).toBeUndefined(); // excluded due to stricter threshold
      expect(result.screenParams.appliedRegimeAdjustment).toContain('提高');
    });

    it('Unknown regime: no threshold adjustment', async () => {
      mockDetectRegime.mockResolvedValue(UNKNOWN_REGIME);
      mockFuseBatch.mockResolvedValue([makeFusionResult({ alphaScore: 75, confidence: 60 })]);

      const result = await runScreen({ respectMarketRegime: true });

      expect(result.screenParams.appliedRegimeAdjustment).toBe('無調整');
    });
  });

  describe('high alpha + low confidence → not Strong Candidate', () => {
    it('stock with alpha>=75 but confidence<15 is excluded (below minConfidence)', async () => {
      mockFuseBatch.mockResolvedValue([makeFusionResult({ alphaScore: 85, confidence: 10 })]);

      const result = await runScreen({ minAlphaScore: 40, minConfidence: 15 });

      const candidate = result.candidates.find(c => c.symbol === '2330');
      expect(candidate).toBeUndefined();
    });

    it('stock meeting both alpha and confidence thresholds is included', async () => {
      mockFuseBatch.mockResolvedValue([makeFusionResult({ alphaScore: 80, confidence: 50 })]);

      const result = await runScreen({ minAlphaScore: 40, minConfidence: 15 });

      expect(result.candidates.find(c => c.symbol === '2330')).toBeDefined();
    });
  });

  describe('Insufficient Data bucket', () => {
    it('stock with Insufficient Data bucket is excluded or degraded', async () => {
      mockFuseBatch.mockResolvedValue([makeFusionResult({
        alphaScore: 50,
        confidence: 5,
        recommendationBucket: 'Insufficient Data',
        dataCoverage: 'insufficient',
      })]);

      const result = await runScreen();

      // Should not appear as a candidate (excluded)
      const candidate = result.candidates.find(c => c.symbol === '2330');
      expect(candidate).toBeUndefined();
    });
  });

  describe('output integrity', () => {
    it('disclaimer is always present and non-empty', async () => {
      mockFuseBatch.mockResolvedValue([makeFusionResult()]);
      const result = await runScreen();
      expect(result.disclaimer).toBeTruthy();
      expect(result.disclaimer.length).toBeGreaterThan(10);
    });

    it('limitations is always an array', async () => {
      mockGroupBy.mockResolvedValue([]);
      const result = await runScreen();
      expect(Array.isArray(result.limitations)).toBe(true);
    });

    it('candidates array always present (not null)', async () => {
      mockFuseBatch.mockResolvedValue([]);
      const result = await runScreen();
      expect(Array.isArray(result.candidates)).toBe(true);
    });

    it('excludedCount matches excluded array length', async () => {
      mockFuseBatch.mockResolvedValue([makeFusionResult({ alphaScore: 10, confidence: 50 })]);
      const result = await runScreen({ minAlphaScore: 40 });
      expect(result.excludedCount).toBe(result.excluded.length);
    });

    it('symbolUniverse override bypasses DB query', async () => {
      mockFuseBatch.mockResolvedValue([makeFusionResult()]);

      await runScreen({ symbolUniverse: ['2330'] });

      expect(mockGroupBy).not.toHaveBeenCalled();
    });
  });
});
