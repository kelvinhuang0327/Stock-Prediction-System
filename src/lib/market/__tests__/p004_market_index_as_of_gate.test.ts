/**
 * P0-04: MarketIndex as-of gate tests
 *
 * Validates that detectRegime() correctly gates MarketIndex queries
 * with date <= asOfDate, excluding future-dated rows.
 *
 * - No DB writes
 * - No external API calls
 * - No strategy mutation
 * - No performance claims
 */

import { detectRegime } from '../MarketRegimeEngine';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    marketIndex: {
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock('@/lib/prisma');

const PAST_ROW = { date: '2026-05-01', value: 20000 };
const PRESENT_ROW = { date: '2026-05-07', value: 20100 };
const FUTURE_ROW = { date: '2026-05-18', value: 21000 };

describe('P0-04: MarketIndex as-of gate — detectRegime()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.marketIndex.findMany.mockResolvedValue([]);
  });

  it('calls findMany with only name=TAIEX when no asOf provided (backward compat)', async () => {
    await detectRegime();
    expect(prisma.marketIndex.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ name: 'TAIEX' }),
      }),
    );
    const call = prisma.marketIndex.findMany.mock.calls[0][0];
    // no date upper bound when asOf not provided
    expect(call.where.date).toBeUndefined();
  });

  it('adds date <= asOf constraint when asOf is provided', async () => {
    await detectRegime('2026-05-07');
    const call = prisma.marketIndex.findMany.mock.calls[0][0];
    expect(call.where).toEqual(
      expect.objectContaining({ name: 'TAIEX', date: { lte: '2026-05-07' } }),
    );
  });

  it('excludes future-dated rows via asOf gate', async () => {
    // Return only non-future rows when gate applied
    prisma.marketIndex.findMany.mockImplementation(({ where }: { where: { date?: { lte: string }; name: string } }) => {
      const rows = [PAST_ROW, PRESENT_ROW, FUTURE_ROW];
      if (where.date?.lte) {
        return Promise.resolve(rows.filter(r => r.date <= where.date!.lte!));
      }
      return Promise.resolve(rows);
    });

    await detectRegime('2026-05-07');
    const call = prisma.marketIndex.findMany.mock.calls[0][0];
    // Gate is in the query itself
    expect(call.where.date).toEqual({ lte: '2026-05-07' });
  });

  it('returns regime result even when rows are empty (insufficient data)', async () => {
    prisma.marketIndex.findMany.mockResolvedValue([]);
    const result = await detectRegime('2026-05-07');
    expect(result).toHaveProperty('regime');
    expect(result.dataCoverage).toBe('insufficient');
  });

  it('does not mutate regime judgment logic — returns same fields', async () => {
    const result = await detectRegime();
    expect(result).toHaveProperty('regime');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('factors');
    expect(result).toHaveProperty('dataCoverage');
    expect(result).toHaveProperty('dataPoints');
  });
});
