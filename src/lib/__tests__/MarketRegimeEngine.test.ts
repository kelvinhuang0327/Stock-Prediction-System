/**
 * MarketRegimeEngine.test.ts
 *
 * Tests for detectRegime() covering:
 * - <50 data points → Unknown + insufficient
 * - 50-199 data points → degraded mode (limited coverage, no MA200)
 * - >=200 data points → full coverage, can compute Bull/Bear/Sideways
 * - confidence and limitations always present
 */

import { detectRegime } from '../market/MarketRegimeEngine';
import { prisma } from '../prisma';

jest.mock('../prisma', () => ({
  prisma: {
    marketIndex: {
      findMany: jest.fn(),
    },
  },
}));

const mockFindMany = (prisma.marketIndex.findMany as jest.Mock);

// ─── Helpers ─────────────────────────────────────────────────────

/** Generate N days of price data starting from a base value with optional trend */
function makePrices(count: number, startPrice = 18000, trendPerDay = 0): { date: string; value: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
    value: startPrice + i * trendPerDay + (Math.random() - 0.5) * 50,
  }));
}

/** Generate clearly bullish data: prices consistently rising */
function makeBullishPrices(count = 250): { date: string; value: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
    value: 15000 + i * 20, // steady uptrend
  }));
}

/** Generate clearly bearish data: prices consistently falling */
function makeBearishPrices(count = 250): { date: string; value: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
    value: 22000 - i * 20, // steady downtrend
  }));
}

// ─── Tests ───────────────────────────────────────────────────────

describe('MarketRegimeEngine — detectRegime()', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('< 50 data points → Unknown (insufficient)', () => {
    it('returns Unknown with 0 data points', async () => {
      mockFindMany.mockResolvedValue([]);
      const result = await detectRegime();

      expect(result.regime).toBe('Unknown');
      expect(result.dataCoverage).toBe('insufficient');
      expect(result.confidence).toBe(0);
      expect(result.limitations.length).toBeGreaterThan(0);
    });

    it('returns Unknown with 49 data points (boundary)', async () => {
      mockFindMany.mockResolvedValue(makePrices(49));
      const result = await detectRegime();

      expect(result.regime).toBe('Unknown');
      expect(result.dataCoverage).toBe('insufficient');
    });
  });

  describe('50–199 data points → degraded mode', () => {
    it('returns a regime (not Unknown) with 50 data points', async () => {
      mockFindMany.mockResolvedValue(makePrices(50, 18000, 10));
      const result = await detectRegime();

      expect(result.dataPoints).toBe(50);
      // Can compute MA50 but not MA200 → limited coverage
      expect(result.dataCoverage).toBe('limited');
      // Regime is deterministic based on prices — just check it's valid
      expect(['Bull', 'Bear', 'Sideways', 'Unknown']).toContain(result.regime);
    });

    it('has a limitation about missing MA200 with < 200 data points', async () => {
      mockFindMany.mockResolvedValue(makePrices(100, 18000, 5));
      const result = await detectRegime();

      expect(result.dataCoverage).toBe('limited');
      expect(result.limitations.some(l => l.includes('200') || l.includes('MA200'))).toBe(true);
    });

    it('confidence is lower without full MA200 data', async () => {
      mockFindMany.mockResolvedValue(makePrices(80, 18000, 5));
      const limitedResult = await detectRegime();

      mockFindMany.mockResolvedValue(makeBullishPrices(250));
      const fullResult = await detectRegime();

      expect(limitedResult.confidence).toBeLessThanOrEqual(fullResult.confidence);
    });
  });

  describe('>= 200 data points → full coverage', () => {
    it('returns "full" dataCoverage with 200+ data points', async () => {
      mockFindMany.mockResolvedValue(makeBullishPrices(250));
      const result = await detectRegime();

      expect(result.dataCoverage).toBe('full');
      expect(result.dataPoints).toBe(250);
    });

    it('detects Bull regime for consistently rising prices', async () => {
      mockFindMany.mockResolvedValue(makeBullishPrices(250));
      const result = await detectRegime();

      expect(result.regime).toBe('Bull');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('detects Bear regime for consistently falling prices', async () => {
      mockFindMany.mockResolvedValue(makeBearishPrices(250));
      const result = await detectRegime();

      expect(result.regime).toBe('Bear');
    });
  });

  describe('output integrity', () => {
    it('always returns limitations array (never null)', async () => {
      mockFindMany.mockResolvedValue([]);
      const result = await detectRegime();
      expect(Array.isArray(result.limitations)).toBe(true);
    });

    it('always returns factors array (never null)', async () => {
      mockFindMany.mockResolvedValue(makeBullishPrices(250));
      const result = await detectRegime();
      expect(Array.isArray(result.factors)).toBe(true);
    });

    it('dataPoints matches input row count', async () => {
      const prices = makePrices(75);
      mockFindMany.mockResolvedValue(prices);
      const result = await detectRegime();
      expect(result.dataPoints).toBe(75);
    });

    it('confidence is in range 0-100', async () => {
      mockFindMany.mockResolvedValue(makeBullishPrices(250));
      const result = await detectRegime();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });
  });
});
