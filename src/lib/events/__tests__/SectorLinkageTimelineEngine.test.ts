import { generateSectorLinkageTimeline } from '../SectorLinkageTimelineEngine';
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

describe('SectorLinkageTimelineEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('classifies spreading when breadth expands', async () => {
    const now = Date.now();
    mockNewsFindMany.mockResolvedValue([
      makeEvent({ publishedAt: new Date(now - 6 * 86400000), relatedSymbols: JSON.stringify(['2330']) }),
      makeEvent({ publishedAt: new Date(now - 2 * 86400000), relatedSymbols: JSON.stringify(['2330', '2317', '2454']) }),
      makeEvent({ publishedAt: new Date(now - 1 * 86400000), relatedSymbols: JSON.stringify(['2330', '2317', '2454', '2603']) }),
    ]);
    mockStockFindMany.mockResolvedValue([
      { id: '2330', industry: '半導體業' },
      { id: '2317', industry: '電腦及週邊設備業' },
      { id: '2454', industry: '半導體業' },
      { id: '2603', industry: '航運業' },
    ]);

    const result = await generateSectorLinkageTimeline({ topic: 'AI伺服器', days: 14, minBreadth: 1 });
    expect(['spreading', 'mature']).toContain(result.stage);
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  it('can classify fading when recent breadth drops', async () => {
    const now = Date.now();
    mockNewsFindMany.mockResolvedValue([
      makeEvent({ publishedAt: new Date(now - 7 * 86400000), relatedSymbols: JSON.stringify(['2330', '2317', '2454', '2603']) }),
      makeEvent({ publishedAt: new Date(now - 6 * 86400000), relatedSymbols: JSON.stringify(['2330', '2317', '2454']) }),
      makeEvent({ publishedAt: new Date(now - 1 * 86400000), relatedSymbols: JSON.stringify(['2330']) }),
    ]);
    mockStockFindMany.mockResolvedValue([
      { id: '2330', industry: '半導體業' },
      { id: '2317', industry: '電腦及週邊設備業' },
      { id: '2454', industry: '半導體業' },
      { id: '2603', industry: '航運業' },
    ]);

    const result = await generateSectorLinkageTimeline({ topic: 'AI伺服器', days: 14, minBreadth: 1 });
    expect(['fading', 'mature', 'unknown']).toContain(result.stage);
  });

  it('returns degraded response on no data', async () => {
    mockNewsFindMany.mockResolvedValue([]);
    mockStockFindMany.mockResolvedValue([]);
    const result = await generateSectorLinkageTimeline({ topic: 'AI伺服器', days: 14, minBreadth: 1 });
    expect(result.timeline).toEqual([]);
    expect(result.stage).toBe('unknown');
    expect(result.limitations.length).toBeGreaterThan(0);
  });
});

