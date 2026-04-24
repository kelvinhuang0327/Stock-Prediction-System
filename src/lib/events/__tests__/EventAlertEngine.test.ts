import { generateEventAlerts } from '../EventAlertEngine';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    newsEvent: { findMany: jest.fn() },
    watchlist: { findMany: jest.fn() },
    dailyCandidateSnapshot: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('../TopicSurgeEngine', () => ({
  generateTopicSurgeSummary: jest.fn().mockResolvedValue({
    summary: 'no topic surge',
    topics: [],
    limitations: [],
    generatedAt: new Date().toISOString(),
  }),
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
const mockWatchlistFindMany = prisma.watchlist.findMany as jest.Mock;
const mockCandidateFindFirst = prisma.dailyCandidateSnapshot.findFirst as jest.Mock;
const mockCandidateFindMany = prisma.dailyCandidateSnapshot.findMany as jest.Mock;

function makeEvent(overrides?: Partial<MockNewsEvent>): MockNewsEvent {
  return {
    id: 'evt_1',
    title: '2330 供應鏈消息',
    summary: '事件摘要',
    source: 'Yahoo',
    trustLevel: 'mainstream',
    publishedAt: new Date(),
    relatedSymbols: JSON.stringify(['2330']),
    relatedThemes: JSON.stringify(['ai', 'semiconductor']),
    rawUrl: 'https://example.com/a',
    titleHash: 'hash_1',
    ingestedAt: new Date(),
    ...overrides,
  };
}

describe('EventAlertEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWatchlistFindMany.mockResolvedValue([]);
    mockCandidateFindFirst.mockResolvedValue(null);
    mockCandidateFindMany.mockResolvedValue([]);
  });

  it('produces symbol_new_event when symbol has new events', async () => {
    mockNewsFindMany
      .mockResolvedValueOnce([makeEvent()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeEvent({ id: 'evt_old', publishedAt: new Date(Date.now() - 5 * 86400000) })]);

    const result = await generateEventAlerts({ mode: 'symbol', symbol: '2330', days: 1 });
    expect(result.alerts.some((a) => a.type === 'symbol_new_event')).toBe(true);
  });

  it('produces watchlist_new_event when watchlist symbols have event increases', async () => {
    mockWatchlistFindMany.mockResolvedValue([{ stockId: '2330' }]);
    mockNewsFindMany
      .mockResolvedValueOnce([makeEvent()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeEvent({ id: 'evt_old2', publishedAt: new Date(Date.now() - 6 * 86400000) })]);

    const result = await generateEventAlerts({ mode: 'watchlist', days: 1 });
    expect(result.alerts.some((a) => a.type === 'watchlist_new_event')).toBe(true);
  });

  it('produces candidate_new_event when candidate symbols have event increases', async () => {
    mockCandidateFindFirst.mockResolvedValue({ snapshotDate: '2026-03-18' });
    mockCandidateFindMany.mockResolvedValue([{ symbol: '2330' }]);
    mockNewsFindMany
      .mockResolvedValueOnce([makeEvent()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeEvent({ id: 'evt_old3', publishedAt: new Date(Date.now() - 7 * 86400000) })]);

    const result = await generateEventAlerts({ mode: 'candidates', days: 1 });
    expect(result.alerts.some((a) => a.type === 'candidate_new_event')).toBe(true);
  });

  it('produces low_trust_event_cluster conservatively when low-trust events increase', async () => {
    const lowTrustRecent = Array.from({ length: 5 }, (_, i) =>
      makeEvent({
        id: `evt_low_${i}`,
        trustLevel: 'unknown',
        relatedSymbols: JSON.stringify(['2330', '2317']),
        relatedThemes: JSON.stringify(['chip']),
      }),
    );
    mockNewsFindMany
      .mockResolvedValueOnce(lowTrustRecent)
      .mockResolvedValueOnce([makeEvent({ id: 'evt_prev', trustLevel: 'unknown' })])
      .mockResolvedValueOnce([makeEvent({ id: 'evt_old4', trustLevel: 'unknown' })]);

    const result = await generateEventAlerts({ mode: 'market', days: 1 });
    const cluster = result.alerts.find((a) => a.type === 'low_trust_event_cluster');
    expect(cluster).toBeDefined();
    expect(['caution', 'warning']).toContain(cluster?.severity);
  });

  it('returns degraded structure when no comparable event data exists', async () => {
    mockNewsFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await generateEventAlerts({ mode: 'market', days: 1 });
    expect(result.alerts.some((a) => a.type === 'market_event_increase')).toBe(false);
    expect(result.limitations.join(' ')).toContain('無前期可比較事件資料');
    expect(result.summary.length).toBeGreaterThan(0);
  });
});
