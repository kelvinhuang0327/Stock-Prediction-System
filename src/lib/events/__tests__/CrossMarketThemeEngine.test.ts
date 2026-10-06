import { generateCrossMarketTheme } from '../CrossMarketThemeEngine';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    newsEvent: { findMany: jest.fn() },
    stock: { findMany: jest.fn() },
  },
}));

type MockNewsEvent = {
  title: string;
  summary: string | null;
  relatedThemes: string;
  relatedSymbols: string;
  publishedAt: Date;
  source: string;
  trustLevel: string;
};

const mockNewsFindMany = prisma.newsEvent.findMany as jest.Mock;
const mockStockFindMany = prisma.stock.findMany as jest.Mock;

function makeEvent(overrides?: Partial<MockNewsEvent>): MockNewsEvent {
  return {
    title: 'AI Server 供應鏈',
    summary: 'AI server',
    relatedThemes: JSON.stringify(['AI Server']),
    relatedSymbols: JSON.stringify(['2330']),
    publishedAt: new Date(),
    source: 'Yahoo',
    trustLevel: 'mainstream',
    ...overrides,
  };
}

describe('CrossMarketThemeEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects sector expansion from initial cluster', async () => {
    const now = Date.now();
    mockNewsFindMany.mockResolvedValue([
      makeEvent({ publishedAt: new Date(now - 5 * 86400000), relatedSymbols: JSON.stringify(['2330']) }),
      makeEvent({ publishedAt: new Date(now - 3 * 86400000), relatedSymbols: JSON.stringify(['2317']) }),
      makeEvent({ publishedAt: new Date(now - 1 * 86400000), relatedSymbols: JSON.stringify(['2603']) }),
    ]);
    mockStockFindMany.mockResolvedValue([
      { id: '2330', industry: '半導體業' },
      { id: '2317', industry: '電腦及週邊設備業' },
      { id: '2603', industry: '航運業' },
    ]);

    const result = await generateCrossMarketTheme({ topic: 'AI伺服器', days: 14 });
    expect(['sector_expansion', 'broad_market']).toContain(result.spreadPattern);
    expect(result.spreadClusters.length).toBeGreaterThan(0);
  });

  it('downgrades spread speed under low-trust dominance', async () => {
    const now = Date.now();
    mockNewsFindMany.mockResolvedValue([
      makeEvent({ publishedAt: new Date(now - 5 * 86400000), trustLevel: 'unknown' }),
      makeEvent({ publishedAt: new Date(now - 4 * 86400000), trustLevel: 'unknown', relatedSymbols: JSON.stringify(['2317']) }),
      makeEvent({ publishedAt: new Date(now - 3 * 86400000), trustLevel: 'secondary', relatedSymbols: JSON.stringify(['2454']) }),
    ]);
    mockStockFindMany.mockResolvedValue([
      { id: '2330', industry: '半導體業' },
      { id: '2317', industry: '電腦及週邊設備業' },
      { id: '2454', industry: '半導體業' },
    ]);

    const result = await generateCrossMarketTheme({ topic: 'AI伺服器', days: 14 });
    expect(result.limitations.join(' ')).toMatch(/low-trust|保守|可信/i);
    expect(['slow', 'moderate']).toContain(result.spreadSpeed);
  });

  it('returns degraded structure when no matching data', async () => {
    mockNewsFindMany.mockResolvedValue([]);
    mockStockFindMany.mockResolvedValue([]);
    const result = await generateCrossMarketTheme({ topic: 'AI伺服器', days: 14 });
    expect(result.spreadPattern).toBe('unclear');
    expect(result.originCluster.symbols).toEqual([]);
    expect(result.limitations.length).toBeGreaterThan(0);
  });
});

