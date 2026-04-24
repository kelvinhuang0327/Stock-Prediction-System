import { generateThemeLinkage } from '../ThemeLinkageEngine';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    newsEvent: { findMany: jest.fn() },
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

function makeRow(overrides?: Partial<MockNewsEvent>): MockNewsEvent {
  return {
    title: 'AI Server + 半導體',
    summary: 'AI 與晶片',
    relatedThemes: JSON.stringify(['AI Server', 'chip']),
    relatedSymbols: JSON.stringify(['2330', '2317']),
    source: 'Yahoo',
    trustLevel: 'mainstream',
    publishedAt: new Date(),
    ...overrides,
  };
}

describe('ThemeLinkageEngine', () => {
  beforeEach(() => jest.clearAllMocks());

  it('finds linked topics with co-occurrence', async () => {
    mockNewsFindMany.mockResolvedValue([makeRow(), makeRow({ source: 'cnyes' })]);
    const result = await generateThemeLinkage({ topic: 'AI伺服器', days: 7 });
    expect(result.linkedTopics.length).toBeGreaterThan(0);
  });

  it('upgrades linkage strength with symbol overlap and frequency', async () => {
    mockNewsFindMany.mockResolvedValue([
      makeRow(),
      makeRow(),
      makeRow(),
      makeRow({ relatedSymbols: JSON.stringify(['2330', '2454']) }),
    ]);
    const result = await generateThemeLinkage({ topic: 'AI伺服器', days: 7 });
    expect(['moderate', 'strong']).toContain(result.linkedTopics[0]?.linkageStrength);
  });

  it('degrades linkage under low-trust dominant sources', async () => {
    mockNewsFindMany.mockResolvedValue([
      makeRow({ trustLevel: 'unknown' }),
      makeRow({ trustLevel: 'unknown' }),
      makeRow({ trustLevel: 'secondary' }),
      makeRow({ trustLevel: 'unknown' }),
    ]);
    const result = await generateThemeLinkage({ topic: 'AI伺服器', days: 7 });
    expect(['weak', 'moderate']).toContain(result.linkedTopics[0]?.linkageStrength);
  });
});
