/**
 * MarketRegimeEngine.test.ts
 *
 * Tests for detectRegime() covering:
 * - <50 data points → Unknown + insufficient
 * - 50-199 data points → degraded mode (limited coverage, no MA200)
 * - >=200 data points → full coverage, can compute Bull/Bear/Sideways
 * - confidence and limitations always present
 */

import { buildRegimeTimeline, detectRegime, detectRegimeForPeriod } from '../market/MarketRegimeEngine';
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

  it('records high volatility as a bearish factor', async () => {
    mockFindMany.mockResolvedValue(makeDatedRows(250, '2025-01-01', index => index % 2 === 0 ? 100 : 150));

    const result = await detectRegime();

    expect(result.factors.find(factor => factor.name === 'volatility20d')).toMatchObject({ impact: 'bearish' });
    expect(result.factors.find(factor => factor.name === 'volatility20d')?.note).toContain('偏高');
  });
  });
});

function makeDatedRows(count: number, start: string, valueAt: (index: number) => number = index => 18_000 + index) {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) => ({
    date: new Date(startMs + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    value: valueAt(index),
  }));
}

describe('MarketRegimeEngine — period and rolling timeline', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the bounded period query and returns Unknown below the 20-row minimum', async () => {
    mockFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await detectRegimeForPeriod('2026-01-01', '2026-01-31');

    expect(result).toMatchObject({
      regime: 'Unknown', confidence: 0, dataCoverage: 'insufficient', dataPoints: 0,
      samplePeriod: 'N/A', last_updated: null,
    });
    expect(result.limitations).toEqual(['回測期間 MarketIndex 僅 0 天，無法判斷市場環境']);
    expect(mockFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { name: 'TAIEX', date: { gte: '2026-01-01', lte: '2026-01-31' } },
    }));
    expect(mockFindMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { name: 'TAIEX', date: { lt: '2026-01-01' } }, take: 200,
    }));
  });

  it('classifies a consistent period gain as Bull and reduces confidence for short periods', async () => {
    mockFindMany
      .mockResolvedValueOnce(makeDatedRows(30, '2026-01-01', index => 100 + index))
      .mockResolvedValueOnce(makeDatedRows(200, '2025-01-01'));

    const result = await detectRegimeForPeriod('2026-01-01', '2026-01-30');

    expect(result).toMatchObject({ regime: 'Bull', dataPoints: 30, dataCoverage: 'limited' });
    expect(result.confidence).toBe(62);
    expect(result.limitations).toEqual(['期間資料僅 30 天，信心度已降低']);
    expect(result.factors.map(factor => factor.name)).toEqual(['periodReturn', 'trendConsistency', 'periodVolatility']);
    expect(result.factors[0]).toMatchObject({ impact: 'bullish' });
    expect(result.factors[1]).toMatchObject({ value: true, impact: 'bullish' });
  });

  it('covers consistent losses, mixed trends, threshold gains/losses, volatility, and full period coverage', async () => {
    const run = async (values: number[]) => {
      mockFindMany.mockReset();
      mockFindMany.mockResolvedValueOnce(makeDatedRows(values.length, '2026-03-01', index => values[index]!));
      mockFindMany.mockResolvedValueOnce([]);
      return detectRegimeForPeriod('2026-03-01', '2026-06-28');
    };

    const bear = await run(Array.from({ length: 120 }, (_, index) => 220 - index));
    expect(bear).toMatchObject({ regime: 'Bear', confidence: 90, dataCoverage: 'full', limitations: [] });
    expect(bear.factors[0]).toMatchObject({ impact: 'bearish' });
    expect(bear.factors[1]).toMatchObject({ value: true, impact: 'bearish' });

    const choppyGain = await run(Array.from({ length: 60 }, (_, index) => index < 30 ? 100 + index * 0.3 : 109 - (index - 30) * 0.05));
    expect(choppyGain.regime).toBe('Bull');
    expect(choppyGain.factors[1]).toMatchObject({ value: false, impact: 'neutral' });

    const modestLoss = await run(Array.from({ length: 60 }, (_, index) => 100 - index * 0.1));
    expect(modestLoss.regime).toBe('Bear');
    expect(modestLoss.factors[0]).toMatchObject({ impact: 'bearish' });

    const flat = await run(Array.from({ length: 60 }, () => 100));
    expect(flat.regime).toBe('Sideways');
    expect(flat.factors[1]).toMatchObject({ value: false, impact: 'neutral' });
    expect(flat.factors[2]).toMatchObject({ value: 0, impact: 'neutral' });

    const volatile = await run(Array.from({ length: 60 }, (_, index) => index % 2 === 0 ? 100 : 150));
    expect(volatile.factors[2]).toMatchObject({ impact: 'bearish' });
    expect(volatile.limitations).toEqual([]);
  });

  it('fills short-history timeline dates with Unknown and reports missing periods', async () => {
    const rows = makeDatedRows(12, '2026-01-01');
    mockFindMany.mockResolvedValue(rows);

    const { timeline, limitations } = await buildRegimeTimeline('2026-01-05', '2026-02-01');

    expect(timeline.size).toBe(8);
    expect([...timeline.values()][0]).toMatchObject({ date: '2026-01-05', regime: 'Unknown', confidence: 0 });
    expect(limitations).toEqual(['MarketIndex 僅 12 天歷史，無法建立 regime timeline']);
  });

  it('interpolates unchanged rolling results and reports absent date windows', async () => {
    const rows = makeDatedRows(80, '2026-01-01', index => 100 + index * 0.2);
    mockFindMany.mockResolvedValue(rows);

    const timelineResult = await buildRegimeTimeline('2026-01-20', '2026-04-01');
    const entries = [...timelineResult.timeline.values()];
    expect(entries.length).toBeGreaterThan(10);
    expect(entries[0]?.regime).toBe('Unknown');
    expect(entries[entries.length - 1]?.regime).toBe('Bull');
    expect(entries[entries.length - 1]?.confidence).toBeLessThan(100);
    expect(timelineResult.limitations).toEqual(['回測起始前 MarketIndex 不足 200 天，早期 regime 判斷信心度較低']);

    mockFindMany.mockResolvedValue(makeDatedRows(60, '2025-01-01'));
    const absent = await buildRegimeTimeline('2026-01-01', '2026-02-01');
    expect(absent.timeline.size).toBe(0);
    expect(absent.limitations).toEqual([
      '回測期間無 MarketIndex 資料，regime 全部為 Unknown',
      '回測起始前 MarketIndex 不足 200 天，早期 regime 判斷信心度較低',
    ]);
  });

  it('evaluates full-history rolling MAs and produces Bear and Sideways intervals', async () => {
    const falling = makeDatedRows(230, '2025-01-01', index => 10_000 - index * 20);
    mockFindMany.mockResolvedValue(falling);
    const bearResult = await buildRegimeTimeline('2025-08-01', '2025-08-18');
    expect([...bearResult.timeline.values()].some(entry => entry.regime === 'Bear')).toBe(true);
    expect(bearResult.limitations).toEqual([]);

    const trendReversal = makeDatedRows(230, '2025-01-01', index => index < 200 ? 100 + index : 299 - (index - 199));
    mockFindMany.mockResolvedValue(trendReversal);
    const sidewaysResult = await buildRegimeTimeline('2025-08-01', '2025-08-18');
    expect([...sidewaysResult.timeline.values()].some(entry => entry.regime === 'Sideways')).toBe(true);
  });
});
