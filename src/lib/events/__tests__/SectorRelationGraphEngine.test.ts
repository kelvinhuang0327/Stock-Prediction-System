import { generateSectorRelationGraph } from '../SectorRelationGraphEngine';
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
  source: string;
  trustLevel: string;
  publishedAt: Date;
};

const mockNewsFindMany = prisma.newsEvent.findMany as jest.Mock;
const mockStockFindMany = prisma.stock.findMany as jest.Mock;

function makeRow(overrides?: Partial<MockNewsEvent>): MockNewsEvent {
  return {
    title: 'AI Server 主題',
    summary: 'AI 事件',
    relatedThemes: JSON.stringify(['AI Server']),
    relatedSymbols: JSON.stringify(['2330', '2317']),
    source: 'Yahoo',
    trustLevel: 'mainstream',
    publishedAt: new Date(),
    ...overrides,
  };
}

describe('SectorRelationGraphEngine', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds topic-sector-symbol graph when mapping exists', async () => {
    mockNewsFindMany.mockResolvedValue([makeRow(), makeRow({ relatedSymbols: JSON.stringify(['2454']) })]);
    mockStockFindMany.mockResolvedValue([
      { id: '2330', industry: '半導體', name: '台積電' },
      { id: '2317', industry: '電子零組件', name: '鴻海' },
      { id: '2454', industry: '半導體', name: '聯發科' },
    ]);
    const result = await generateSectorRelationGraph({ topic: 'AI伺服器', days: 7, minStrength: 1 });
    expect(result.nodes.some((n) => n.type === 'sector')).toBe(true);
    expect(result.edges.length).toBeGreaterThan(0);
  });

  it('degrades to topic-symbol when sector mapping unavailable', async () => {
    mockNewsFindMany.mockResolvedValue([makeRow()]);
    mockStockFindMany.mockResolvedValue([]);
    const result = await generateSectorRelationGraph({ topic: 'AI伺服器', days: 7, minStrength: 1 });
    expect(result.edges.some((e) => e.relationType === 'topic_mentions_symbol')).toBe(true);
    expect(result.limitations.join(' ')).toContain('sector mapping');
  });
});
