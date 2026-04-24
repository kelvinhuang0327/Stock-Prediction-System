import { generateThemeDiffusion } from '../ThemeDiffusionEngine';
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
  publishedAt: Date;
  source: string;
  trustLevel: string;
};

const mockNewsFindMany = prisma.newsEvent.findMany as jest.Mock;

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

describe('ThemeDiffusionEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('classifies broad when >=5 symbols involved', async () => {
    mockNewsFindMany.mockResolvedValue([
      makeEvent({ relatedSymbols: JSON.stringify(['2330', '2317']) }),
      makeEvent({ relatedSymbols: JSON.stringify(['2454', '2308']) }),
      makeEvent({ relatedSymbols: JSON.stringify(['2382']) }),
    ]);
    const result = await generateThemeDiffusion({ topic: 'AI伺服器', days: 7, minCount: 0 });
    expect(result.diffusionType).toBe('broad');
  });

  it('returns single with low breadth', async () => {
    mockNewsFindMany.mockResolvedValue([makeEvent({ relatedSymbols: JSON.stringify(['2330']) })]);
    const result = await generateThemeDiffusion({ topic: 'AI伺服器', days: 7, minCount: 0 });
    expect(result.diffusionType).toBe('single');
  });

  it('returns degraded structure when no topic events', async () => {
    mockNewsFindMany.mockResolvedValue([]);
    const result = await generateThemeDiffusion({ topic: 'AI伺服器', days: 7 });
    expect(result.nodes).toEqual([]);
    expect(result.limitations.length).toBeGreaterThan(0);
  });
});
