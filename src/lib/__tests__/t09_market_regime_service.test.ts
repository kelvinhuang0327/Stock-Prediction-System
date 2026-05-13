/**
 * T-09: MarketRegimeResult Service Tests
 *
 * Tests getLatestMarketRegimeContext() service function.
 * No DB writes. No strategy signals. No ROI/win-rate.
 */

import { getLatestMarketRegimeContext } from '@/lib/marketRegimeResult';

// Mock prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    marketRegimeResult: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
const mockFindFirst = prisma.marketRegimeResult.findFirst as jest.Mock;

const SAMPLE_ROW = {
  date: '2026-05-06',
  regimeLabel: 'BULL',
  confidence: 1.0,
  taiexClose: 41138.85,
  source: 'P4_03_MARKET_REGIME_CLASSIFIER',
  version: 'p4_03b_v1',
};

const FORBIDDEN_FIELDS = [
  'buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha',
  'edge', 'profit', 'recommendation', 'outperform',
];

beforeEach(() => {
  mockFindFirst.mockReset();
});

describe('getLatestMarketRegimeContext', () => {
  it('returns FRESH context when date matches currentDate', async () => {
    mockFindFirst.mockResolvedValue(SAMPLE_ROW);
    const ctx = await getLatestMarketRegimeContext('2026-05-06');
    expect(ctx.isAvailable).toBe(true);
    if (ctx.isAvailable) {
      expect(ctx.date).toBe('2026-05-06');
      expect(ctx.regimeLabel).toBe('BULL');
      expect(ctx.confidence).toBe(1.0);
      expect(ctx.freshnessStatus).toBe('FRESH');
      expect(ctx.freshnessLagDays).toBe(0);
      expect(ctx.warning).toBeNull();
    }
  });

  it('returns FRESH when lag <= 3 days', async () => {
    mockFindFirst.mockResolvedValue({ ...SAMPLE_ROW, date: '2026-05-03' });
    const ctx = await getLatestMarketRegimeContext('2026-05-06');
    expect(ctx.isAvailable).toBe(true);
    if (ctx.isAvailable) {
      expect(ctx.freshnessStatus).toBe('FRESH');
      expect(ctx.freshnessLagDays).toBe(3);
    }
  });

  it('returns STALE when lag > 3 days', async () => {
    mockFindFirst.mockResolvedValue({ ...SAMPLE_ROW, date: '2026-04-30' });
    const ctx = await getLatestMarketRegimeContext('2026-05-06');
    expect(ctx.isAvailable).toBe(true);
    if (ctx.isAvailable) {
      expect(ctx.freshnessStatus).toBe('STALE');
      expect(ctx.freshnessLagDays).toBeGreaterThan(3);
      expect(ctx.warning).toContain('days old');
    }
  });

  it('returns MISSING when no rows in DB', async () => {
    mockFindFirst.mockResolvedValue(null);
    const ctx = await getLatestMarketRegimeContext('2026-05-06');
    expect(ctx.isAvailable).toBe(false);
    expect(ctx.freshnessStatus).toBe('MISSING');
  });

  it('returns MISSING when DB throws', async () => {
    mockFindFirst.mockRejectedValue(new Error('DB connection failed'));
    const ctx = await getLatestMarketRegimeContext('2026-05-06');
    expect(ctx.isAvailable).toBe(false);
    expect(ctx.freshnessStatus).toBe('MISSING');
    if (!ctx.isAvailable) {
      expect(ctx.warning).toContain('DB query failed');
    }
  });

  it('returns FUTURE_DATE_ERROR when persisted date > currentDate', async () => {
    mockFindFirst.mockResolvedValue({ ...SAMPLE_ROW, date: '2026-05-10' });
    const ctx = await getLatestMarketRegimeContext('2026-05-06');
    expect(ctx.isAvailable).toBe(true);
    if (ctx.isAvailable) {
      expect(ctx.freshnessStatus).toBe('FUTURE_DATE_ERROR');
      expect(ctx.warning).toBeTruthy();
    }
  });

  it('confidence is between 0 and 1', async () => {
    mockFindFirst.mockResolvedValue(SAMPLE_ROW);
    const ctx = await getLatestMarketRegimeContext('2026-05-06');
    if (ctx.isAvailable) {
      expect(ctx.confidence).toBeGreaterThanOrEqual(0);
      expect(ctx.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('regimeLabel is an allowed enum value', async () => {
    mockFindFirst.mockResolvedValue(SAMPLE_ROW);
    const ctx = await getLatestMarketRegimeContext('2026-05-06');
    if (ctx.isAvailable) {
      const allowed = ['BULL', 'BEAR', 'SIDEWAYS', 'HIGH_VOLATILITY', 'LOW_CONFIDENCE'];
      expect(allowed).toContain(ctx.regimeLabel);
    }
  });

  it('does not include forbidden fields', async () => {
    mockFindFirst.mockResolvedValue(SAMPLE_ROW);
    const ctx = await getLatestMarketRegimeContext('2026-05-06');
    const keys = Object.keys(ctx);
    FORBIDDEN_FIELDS.forEach(field => {
      expect(keys).not.toContain(field);
    });
  });

  it('does not write to DB (findFirst only, no create/update/delete)', async () => {
    mockFindFirst.mockResolvedValue(SAMPLE_ROW);
    await getLatestMarketRegimeContext('2026-05-06');
    // Verify only findFirst was called, no mutations
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect((prisma.marketRegimeResult as any).create).toBeUndefined();
    expect((prisma.marketRegimeResult as any).update).toBeUndefined();
    expect((prisma.marketRegimeResult as any).delete).toBeUndefined();
  });
});
