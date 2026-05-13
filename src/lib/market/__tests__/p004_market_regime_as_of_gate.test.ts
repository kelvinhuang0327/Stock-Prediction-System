/**
 * P0-04: MarketRegimeResult as-of gate tests
 *
 * Validates that getLatestMarketRegimeContext() gates the DB query
 * with date <= asOf and rejects sourceDate > asOfDate.
 *
 * - No DB writes
 * - No external API calls
 * - No strategy mutation
 * - No performance claims
 */

import { getLatestMarketRegimeContext } from '../../marketRegimeResult';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    marketRegimeResult: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/time/currentDate', () => ({
  resolveCurrentDate: jest.fn((d?: string) => d ?? '2026-05-07'),
}));

const { prisma } = jest.requireMock('@/lib/prisma');

const REGIME_ROW = {
  date: '2026-05-07',
  regimeLabel: 'BULL',
  confidence: 0.8,
  taiexClose: 20100,
  source: 'nightly-sync',
  version: 'v1',
};

const FUTURE_REGIME_ROW = {
  date: '2026-05-18',
  regimeLabel: 'BULL',
  confidence: 0.9,
  taiexClose: 21000,
  source: 'nightly-sync',
  version: 'v1',
};

describe('P0-04: MarketRegimeResult as-of gate — getLatestMarketRegimeContext()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries with no date bound when asOf not provided (backward compat)', async () => {
    prisma.marketRegimeResult.findFirst.mockResolvedValue(REGIME_ROW);
    await getLatestMarketRegimeContext('2026-05-07');
    const call = prisma.marketRegimeResult.findFirst.mock.calls[0][0];
    expect(call.where).toBeUndefined();
  });

  it('applies date <= asOf constraint when asOf provided', async () => {
    prisma.marketRegimeResult.findFirst.mockResolvedValue(REGIME_ROW);
    await getLatestMarketRegimeContext('2026-05-07', '2026-05-07');
    const call = prisma.marketRegimeResult.findFirst.mock.calls[0][0];
    expect(call.where).toEqual({ date: { lte: '2026-05-07' } });
  });

  it('returns FUTURE_DATE_ERROR if row.date > asOf (safety net)', async () => {
    prisma.marketRegimeResult.findFirst.mockResolvedValue(FUTURE_REGIME_ROW);
    const result = await getLatestMarketRegimeContext('2026-05-07', '2026-05-07');
    expect(result.isAvailable).toBe(false);
    expect(result.freshnessStatus).toBe('FUTURE_DATE_ERROR');
    expect(result.warning).toContain('2026-05-18');
    expect(result.warning).toContain('asOf');
  });

  it('returns valid context when row.date <= asOf', async () => {
    prisma.marketRegimeResult.findFirst.mockResolvedValue(REGIME_ROW);
    const result = await getLatestMarketRegimeContext('2026-05-07', '2026-05-07');
    expect(result.isAvailable).toBe(true);
    expect(result.date).toBe('2026-05-07');
  });

  it('returns MISSING when no rows found', async () => {
    prisma.marketRegimeResult.findFirst.mockResolvedValue(null);
    const result = await getLatestMarketRegimeContext('2026-05-07', '2026-05-07');
    expect(result.isAvailable).toBe(false);
    expect(result.freshnessStatus).toBe('MISSING');
  });

  it('returns FUTURE_DATE_ERROR and does not fallback to bullish/valid', async () => {
    prisma.marketRegimeResult.findFirst.mockResolvedValue(FUTURE_REGIME_ROW);
    const result = await getLatestMarketRegimeContext('2026-05-07', '2026-05-07');
    // Must not return isAvailable: true even if row exists
    expect(result.isAvailable).toBe(false);
    expect(result.freshnessStatus).not.toBe('FRESH');
    // No regime data leaked
    expect(result.regimeLabel).toBeUndefined();
  });
});
