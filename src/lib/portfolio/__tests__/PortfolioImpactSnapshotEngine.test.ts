import {
  comparePortfolioSnapshots,
  createPortfolioImpactSnapshot,
  getLatestPortfolioImpactSnapshot,
} from '../PortfolioImpactSnapshotEngine';

const store: Array<{
  id: number;
  snapshotDate: string;
  scope: string;
  symbols: string | null;
  themeConcentration: string | null;
  sectorConcentration: string | null;
  riskClusters: string | null;
  regimeExposure: string | null;
  summary: string | null;
  limitations: string | null;
}> = [];

let idSeq = 1;

jest.mock('@/lib/prisma', () => ({
  prisma: {
    watchlist: {
      findMany: jest.fn(async () => [
        { stockId: '2330', quantity: 10 },
        { stockId: '2317', quantity: 5 },
      ]),
    },
    portfolioImpactSnapshot: {
      findUnique: jest.fn(async ({ where }: { where: { snapshotDate_scope: { snapshotDate: string; scope: string } } }) => store.find((s) => s.snapshotDate === where.snapshotDate_scope.snapshotDate && s.scope === where.snapshotDate_scope.scope) ?? null),
      upsert: jest.fn(async ({ where, create, update }: { where: { snapshotDate_scope: { snapshotDate: string; scope: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const idx = store.findIndex((s) => s.snapshotDate === where.snapshotDate_scope.snapshotDate && s.scope === where.snapshotDate_scope.scope);
        if (idx >= 0) {
          store[idx] = { ...store[idx], ...(update as typeof store[number]) };
          return store[idx];
        }
        const row = { id: idSeq++, ...(create as typeof store[number]) };
        store.push(row);
        return row;
      }),
      findFirst: jest.fn(async ({ where, orderBy }: { where?: { scope?: string; snapshotDate?: { lt?: string } | string }; orderBy?: { snapshotDate?: 'asc' | 'desc' } }) => {
        let rows = [...store];
        if (where?.scope) rows = rows.filter((s) => s.scope === where.scope);
        if (where?.snapshotDate?.lt) rows = rows.filter((s) => s.snapshotDate < where.snapshotDate.lt);
        if (typeof where?.snapshotDate === 'string') rows = rows.filter((s) => s.snapshotDate === where.snapshotDate);
        rows.sort((a, b) => (orderBy?.snapshotDate === 'desc' ? b.snapshotDate.localeCompare(a.snapshotDate) : a.snapshotDate.localeCompare(b.snapshotDate)));
        return rows[0] ?? null;
      }),
    },
    stock: {
      findMany: jest.fn(async () => []),
    },
  },
}));

jest.mock('@/lib/screen/StrategyScreenEngine', () => ({
  runScreen: jest.fn(async () => ({
    candidates: [{ symbol: '2330' }, { symbol: '2317' }, { symbol: '2454' }],
  })),
}));

jest.mock('@/lib/portfolio/PortfolioImpactEngine', () => ({
  generatePortfolioDecisionSupport: jest.fn(async (symbols: string[]) => ({
    summary: `snapshot for ${symbols.join(',')}`,
    themeConcentration: {
      topThemes: [{ theme: 'AI伺服器', weight: 60, symbols, linkageSignals: [] }],
      concentrationLevel: 'high',
      explanation: 'test',
    },
    sectorConcentration: {
      sectors: [{ sector: '半導體', weight: 70, symbols }],
      concentrationLevel: 'high',
      chainBias: 'single/limited sector chain',
      explanation: 'test',
    },
    riskClusters: {
      overallRiskLevel: 'moderate',
      clusters: [],
    },
    regimeExposure: {
      regime: 'Bull',
      confidence: 70,
      offensiveExposure: 60,
      defensiveExposure: 20,
      neutralExposure: 20,
      sensitivity: 'pro-cyclical',
      note: 'test',
    },
    limitations: [],
  })),
}));

describe('PortfolioImpactSnapshotEngine', () => {
  beforeEach(() => {
    store.splice(0, store.length);
    idSeq = 1;
  });

  it('creates first snapshot', async () => {
    const result = await createPortfolioImpactSnapshot({ scope: 'watchlist', date: '2026-03-18' });
    expect(result.success).toBe(true);
    expect(result.created).toBe(true);
    expect(result.snapshot.snapshotDate).toBe('2026-03-18');
  });

  it('supports same-day forceRefresh replace', async () => {
    await createPortfolioImpactSnapshot({ scope: 'watchlist', date: '2026-03-18' });
    const result = await createPortfolioImpactSnapshot({ scope: 'watchlist', date: '2026-03-18', forceRefresh: true });
    expect(result.updated).toBe(true);
    expect(store).toHaveLength(1);
  });

  it('returns comparison unavailable when no previous snapshot', async () => {
    await createPortfolioImpactSnapshot({ scope: 'watchlist', date: '2026-03-18' });
    const res = await getLatestPortfolioImpactSnapshot({ scope: 'watchlist', comparison: true });
    expect(res.comparison.comparisonAvailable).toBe(false);
  });

  it('compares latest against 1d baseline', async () => {
    await createPortfolioImpactSnapshot({ scope: 'watchlist', date: '2026-03-17' });
    await createPortfolioImpactSnapshot({ scope: 'watchlist', date: '2026-03-18', forceRefresh: true });
    const res = await getLatestPortfolioImpactSnapshot({ scope: 'watchlist', comparison: true, compareWindow: '1d' });
    expect(res.comparison.previousSnapshotDate).toBe('2026-03-17');
  });

  it('supports 7d compareWindow when exact baseline exists', async () => {
    await createPortfolioImpactSnapshot({ scope: 'watchlist', date: '2026-03-11' });
    await createPortfolioImpactSnapshot({ scope: 'watchlist', date: '2026-03-18', forceRefresh: true });
    const res = await getLatestPortfolioImpactSnapshot({ scope: 'watchlist', comparison: true, compareWindow: '7d' });
    expect(res.comparison.comparisonAvailable).toBe(true);
    expect(res.comparison.previousSnapshotDate).toBe('2026-03-11');
    expect(res.comparison.compareWindow).toBe('7d');
  });

  it('returns unavailable for 30d compareWindow without exact baseline', async () => {
    await createPortfolioImpactSnapshot({ scope: 'watchlist', date: '2026-02-20' });
    await createPortfolioImpactSnapshot({ scope: 'watchlist', date: '2026-03-18', forceRefresh: true });
    const res = await getLatestPortfolioImpactSnapshot({ scope: 'watchlist', comparison: true, compareWindow: '30d' });
    expect(res.comparison.comparisonAvailable).toBe(false);
    expect(res.comparison.previousSnapshotDate).toBeNull();
    expect(res.comparison.compareWindow).toBe('30d');
  });

  it('flags limited confidence when symbols too few', async () => {
    const result = await createPortfolioImpactSnapshot({ scope: 'watchlist', date: '2026-03-18', symbols: ['2330'] });
    expect(result.limitations.join(' ')).toMatch(/symbols 僅/);
  });

  it('compare function returns structured delta fields', () => {
    const current = {
      snapshotDate: '2026-03-18',
      scope: 'watchlist' as const,
      symbols: ['2330'],
      summary: '',
      themeConcentration: { topThemes: [{ theme: 'AI', weight: 60, symbols: ['2330'], linkageSignals: [] }], concentrationLevel: 'high' as const, explanation: '' },
      sectorConcentration: { sectors: [{ sector: '半導體', weight: 60, symbols: ['2330'] }], concentrationLevel: 'high' as const, chainBias: '', explanation: '' },
      riskClusters: { overallRiskLevel: 'moderate' as const, clusters: [] },
      regimeExposure: { regime: 'Bull', confidence: 60, offensiveExposure: 70, defensiveExposure: 10, neutralExposure: 20, sensitivity: 'pro-cyclical' as const, note: '' },
      limitations: [],
    };
    const previous = { ...current, snapshotDate: '2026-03-17', riskClusters: { overallRiskLevel: 'low' as const, clusters: [] } };
    const cmp = comparePortfolioSnapshots(current, previous, '1d');
    expect(cmp.comparisonAvailable).toBe(true);
    expect(cmp.riskChanged).toBe(true);
  });
});
