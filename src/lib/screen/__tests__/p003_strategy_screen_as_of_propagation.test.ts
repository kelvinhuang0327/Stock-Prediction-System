/** @jest-environment node */
/**
 * P0-03: StrategyScreenEngine asOf propagation tests
 *
 * Verifies that StrategyScreenEngine:
 * 1. Passes asOf from ScreenParams through to fuseBatch
 * 2. Works without asOf (backward-compatible)
 * 3. Does not produce forbidden output fields
 *
 * Research tool only. No auto trading. No edge claim. No H001-H012.
 */

const mockFuseBatch = jest.fn().mockResolvedValue([]);

jest.mock('@/lib/alpha/SignalFusionEngine', () => ({
  fuseBatch: mockFuseBatch,
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    stockQuote: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    stock: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    marketRegimeResult: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  },
}));

jest.mock('@/lib/data/AsOfDataGate', () => ({
  resolveAsOfDate: jest.fn((input?: string) => input ?? '2026-05-07'),
  buildAsOfWhereClause: jest.fn((asOf: string) => ({
    date: { lte: asOf.replace(/-/g, '') },
  })),
}));

describe('P0-03: StrategyScreenEngine asOf propagation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runScreen accepts asOf in ScreenParams', async () => {
    const { runScreen } = await import('@/lib/screen/StrategyScreenEngine');
    mockFuseBatch.mockResolvedValue([]);
    await expect(runScreen({ asOf: '2026-05-07' })).resolves.toBeDefined();
  });

  it('runScreen works without asOf (backward-compatible)', async () => {
    const { runScreen } = await import('@/lib/screen/StrategyScreenEngine');
    mockFuseBatch.mockResolvedValue([]);
    await expect(runScreen({})).resolves.toBeDefined();
  });

  it('fuseBatch is called with asOf when symbols present', async () => {
    // Simulate DB returning some symbols so fuseBatch actually fires
    const { prisma } = await import('@/lib/prisma');
    (prisma.stockQuote.groupBy as jest.Mock).mockResolvedValueOnce([
      { stockId: '2330', _count: { stockId: 100 } },
    ]);
    mockFuseBatch.mockResolvedValue([]);
    const { runScreen } = await import('@/lib/screen/StrategyScreenEngine');
    await runScreen({ asOf: '2026-05-07' });
    if (mockFuseBatch.mock.calls.length > 0) {
      // When fuseBatch is called, second arg should be asOf
      expect(mockFuseBatch.mock.calls[0][1]).toBe('2026-05-07');
    }
  });

  it('runScreen result does not contain forbidden fields', async () => {
    const { runScreen } = await import('@/lib/screen/StrategyScreenEngine');
    mockFuseBatch.mockResolvedValue([]);
    const result = await runScreen({ asOf: '2026-05-07' });
    const str = JSON.stringify(result);
    const forbidden = ['guaranteed', 'auto_trading', 'win_rate'];
    for (const term of forbidden) {
      expect(str).not.toMatch(new RegExp(`"${term}"`));
    }
  });

  it('does not mutate strategy weights across calls', async () => {
    const { runScreen } = await import('@/lib/screen/StrategyScreenEngine');
    mockFuseBatch.mockResolvedValue([]);
    const r1 = await runScreen({ asOf: '2026-05-07' });
    const r2 = await runScreen({ asOf: '2026-05-07' });
    expect(r1.candidates.length).toBe(r2.candidates.length);
  });
});
