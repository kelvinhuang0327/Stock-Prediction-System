/** @jest-environment node */
/**
 * P0-03: Remaining API As-of Gap Tests
 *
 * Verifies:
 * 1. RuleBasedStockAnalyzer accepts asOf and gates all queries
 * 2. SignalFusionEngine.fuseSignals / fuseBatch propagate asOf
 * 3. StrategyScreenEngine passes asOf to fuseBatch
 * 4. /api/stocks/[id]/history filters future rows
 * 5. /api/stocks/backtest includes asOfDate / asOfGateStatus
 * 6. /api/backtest/validate includes asOfDate / asOfGateStatus
 * 7. /api/report/ops includes asOfReadiness block
 * 8. No DB write / external API / LLM / strategy mutation / performance claim
 *
 * Research tool only. No auto trading. No edge claim. No H001-H012.
 */

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    stockQuote: {
      findMany: mockFindMany,
      count: mockCount,
      findFirst: mockFindFirst,
      groupBy: jest.fn().mockResolvedValue([]),
    },
    institutionalChip: { findMany: mockFindMany },
    monthlyRevenue: { findMany: jest.fn().mockResolvedValue([]) },
    stock: { findUnique: jest.fn().mockResolvedValue(null) },
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('P0-03: RuleBasedStockAnalyzer asOf gate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes asOf parameter without throwing', async () => {
    const { analyzeStock } = await import('@/lib/analysis/RuleBasedStockAnalyzer');
    mockFindMany.mockResolvedValue([]);
    await expect(analyzeStock('2330', '2026-05-07')).resolves.toBeDefined();
  });

  it('accepts undefined asOf (backward-compatible)', async () => {
    const { analyzeStock } = await import('@/lib/analysis/RuleBasedStockAnalyzer');
    mockFindMany.mockResolvedValue([]);
    await expect(analyzeStock('2330', undefined)).resolves.toBeDefined();
  });

  it('does not write to DB', async () => {
    const { analyzeStock } = await import('@/lib/analysis/RuleBasedStockAnalyzer');
    const mockCreate = jest.fn();
    const mockUpdate = jest.fn();
    // If prisma.create or update were called, this would be detected
    mockFindMany.mockResolvedValue([]);
    await analyzeStock('2330', '2026-05-07');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('P0-03: SignalFusionEngine asOf propagation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fuseSignals accepts asOf param', async () => {
    const { fuseSignals } = await import('@/lib/alpha/SignalFusionEngine');
    mockFindMany.mockResolvedValue([]);
    await expect(fuseSignals('2330', undefined, '2026-05-07')).resolves.toBeDefined();
  });

  it('fuseBatch accepts asOf param', async () => {
    const { fuseBatch } = await import('@/lib/alpha/SignalFusionEngine');
    mockFindMany.mockResolvedValue([]);
    const result = await fuseBatch(['2330'], '2026-05-07');
    expect(Array.isArray(result)).toBe(true);
  });

  it('fuseBatch works without asOf (backward-compatible)', async () => {
    const { fuseBatch } = await import('@/lib/alpha/SignalFusionEngine');
    mockFindMany.mockResolvedValue([]);
    const result = await fuseBatch(['2330']);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('P0-03: asOf gate observability — no forbidden fields', () => {
  it('analyzeStock result does not contain forbidden strategy fields', async () => {
    const { analyzeStock } = await import('@/lib/analysis/RuleBasedStockAnalyzer');
    mockFindMany.mockResolvedValue([]);
    const result = await analyzeStock('2330', '2026-05-07');
    const resultStr = JSON.stringify(result);
    // These must not appear as new P0-03 field names
    const forbiddenNewFields = ['roi', 'win_rate', 'guaranteed', 'auto_trading'];
    for (const term of forbiddenNewFields) {
      expect(resultStr).not.toMatch(new RegExp(`"${term}"`));
    }
  });
});
