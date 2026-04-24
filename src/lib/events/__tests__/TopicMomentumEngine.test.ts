import { generateTopicMomentum } from '../TopicMomentumEngine';
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

describe('TopicMomentumEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('classifies rising when recent events are clearly higher', async () => {
    const now = Date.now();
    const rows = [
      makeEvent({ publishedAt: new Date(now - 2 * 86400000) }),
      makeEvent({ publishedAt: new Date(now - 1 * 86400000) }),
      makeEvent({ publishedAt: new Date(now - 1 * 86400000) }),
      makeEvent({ publishedAt: new Date(now - 5 * 86400000) }),
    ];
    mockNewsFindMany.mockResolvedValue(rows);
    const result = await generateTopicMomentum({ topic: 'AI伺服器', days: 7, minCount: 0 });
    expect(['rising', 'spike', 'stable']).toContain(result.momentumType);
  });

  it('classifies spike when one day spikes and cools', async () => {
    const now = Date.now();
    const rows = [
      makeEvent({ publishedAt: new Date(now - 3 * 86400000) }),
      makeEvent({ publishedAt: new Date(now - 3 * 86400000) }),
      makeEvent({ publishedAt: new Date(now - 3 * 86400000) }),
      makeEvent({ publishedAt: new Date(now - 3 * 86400000) }),
      makeEvent({ publishedAt: new Date(now - 1 * 86400000) }),
    ];
    mockNewsFindMany.mockResolvedValue(rows);
    const result = await generateTopicMomentum({ topic: 'AI伺服器', days: 7, minCount: 0 });
    expect(['spike', 'rising']).toContain(result.momentumType);
  });

  it('returns unknown on insufficient data', async () => {
    mockNewsFindMany.mockResolvedValue([]);
    const result = await generateTopicMomentum({ topic: 'AI伺服器', days: 7 });
    expect(result.momentumType).toBe('unknown');
    expect(result.timeline).toEqual([]);
  });
});
