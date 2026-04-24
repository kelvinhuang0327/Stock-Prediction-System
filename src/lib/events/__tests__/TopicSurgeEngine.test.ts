import { generateTopicSurgeSummary } from '../TopicSurgeEngine';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    newsEvent: { findMany: jest.fn() },
  },
}));

type MockNewsEvent = {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  trustLevel: string;
  publishedAt: Date;
  relatedSymbols: string;
  relatedThemes: string;
  rawUrl: string | null;
  titleHash: string;
  ingestedAt: Date;
};

const mockNewsFindMany = prisma.newsEvent.findMany as jest.Mock;

function makeEvent(overrides?: Partial<MockNewsEvent>): MockNewsEvent {
  return {
    id: 'evt_1',
    title: 'AI Server 供應鏈觀察',
    summary: 'AI server topic',
    source: 'Yahoo',
    trustLevel: 'mainstream',
    publishedAt: new Date(),
    relatedSymbols: JSON.stringify(['2330']),
    relatedThemes: JSON.stringify(['AI Server']),
    rawUrl: 'https://example.com/x',
    titleHash: 'h1',
    ingestedAt: new Date(),
    ...overrides,
  };
}

describe('TopicSurgeEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks topic as surging when recent count is clearly higher', async () => {
    mockNewsFindMany
      .mockResolvedValueOnce([makeEvent(), makeEvent({ id: 'evt_2' }), makeEvent({ id: 'evt_3' })])
      .mockResolvedValueOnce([makeEvent({ id: 'evt_prev', relatedThemes: JSON.stringify(['AI伺服器']) })]);

    const result = await generateTopicSurgeSummary({ days: 3, minSurgeLevel: 'none' });
    expect(result.topics.some((t) => t.surgeLevel === 'surging')).toBe(true);
  });

  it('detects diffusion when symbol coverage broadens', async () => {
    mockNewsFindMany
      .mockResolvedValueOnce([
        makeEvent({ id: 'evt_1', relatedSymbols: JSON.stringify(['2330', '2317', '2454']) }),
        makeEvent({ id: 'evt_2', relatedSymbols: JSON.stringify(['2382', '2308']) }),
      ])
      .mockResolvedValueOnce([makeEvent({ id: 'evt_prev', relatedSymbols: JSON.stringify(['2330']) })]);

    const result = await generateTopicSurgeSummary({ days: 3 });
    expect(result.topics.some((t) => t.diffusionLevel !== 'single-stock theme')).toBe(true);
  });

  it('downgrades confidence when all sources are low trust', async () => {
    mockNewsFindMany
      .mockResolvedValueOnce([
        makeEvent({ id: 'evt_1', trustLevel: 'unknown' }),
        makeEvent({ id: 'evt_2', trustLevel: 'secondary' }),
        makeEvent({ id: 'evt_3', trustLevel: 'unknown' }),
      ])
      .mockResolvedValueOnce([makeEvent({ id: 'evt_prev', trustLevel: 'unknown' })]);

    const result = await generateTopicSurgeSummary({ days: 3 });
    expect(result.topics[0]?.limitations.join(' ')).toMatch(/low-trust|次級或未知|保守/);
  });

  it('returns degraded structure when no comparison data', async () => {
    mockNewsFindMany
      .mockResolvedValueOnce([makeEvent()])
      .mockResolvedValueOnce([]);

    const result = await generateTopicSurgeSummary({ days: 3 });
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.limitations.join(' ')).toContain('無前期比較視窗資料');
  });
});
