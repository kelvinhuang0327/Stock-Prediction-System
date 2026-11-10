import { generateEventAlerts } from '../EventAlertEngine';
import { prisma } from '@/lib/prisma';
import { generateTopicSurgeSummary } from '../TopicSurgeEngine';

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
const mockTopicSummary = generateTopicSurgeSummary as jest.MockedFunction<typeof generateTopicSurgeSummary>;

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
    mockNewsFindMany.mockResolvedValue([]);
    mockWatchlistFindMany.mockResolvedValue([]);
    mockCandidateFindFirst.mockResolvedValue(null);
    mockCandidateFindMany.mockResolvedValue([]);
    mockTopicSummary.mockResolvedValue({ summary: 'none', topics: [], limitations: [], generatedAt: '2026-11-10T00:00:00.000Z' });
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

  it('handles missing symbols and empty candidate/watchlist targets without querying event windows', async () => {
    const emptyCandidates = await generateEventAlerts({ mode: 'candidates', candidateSymbols: [] });
    expect(emptyCandidates.summary).toContain('無可用目標清單');
    expect(emptyCandidates.limitations).toContain('目標股票清單為空，無法產生事件提醒。');
    expect(mockNewsFindMany).not.toHaveBeenCalled();

    mockWatchlistFindMany.mockResolvedValue([]);
    const emptyWatchlist = await generateEventAlerts({ mode: 'watchlist' });
    expect(emptyWatchlist.limitations).toContain('目標股票清單為空，無法產生事件提醒。');

    const missingSymbol = await generateEventAlerts({ mode: 'symbol', symbol: '   ' });
    expect(missingSymbol.limitations).toContain('symbol mode 需要提供 symbol');
  });

  it('reports symbol silence and applies minimum-severity filtering', async () => {
    mockNewsFindMany.mockResolvedValue([]);
    const result = await generateEventAlerts({ mode: 'symbol', symbol: '2330', days: 0, minSeverity: 'warning' });
    expect(result.alerts).toEqual([]);
    expect(result.summary).toContain('降級摘要');
    expect(result.limitations).toContain('無前期可比較事件資料，變化提醒已降級為存在性提醒。');
    expect(mockNewsFindMany).toHaveBeenCalledTimes(3);
    expect(mockNewsFindMany.mock.calls[0][0].where.publishedAt.gte.getTime()).toBeGreaterThan(Date.now() - 2 * 86400000);
  });

  it('emits filtered market increase and low-trust cluster alerts', async () => {
    const lowTrustRecent = Array.from({ length: 6 }, (_, i) =>
      makeEvent({ id: `recent_${i}`, trustLevel: 'unknown', relatedSymbols: 'bad-json', relatedThemes: '["AI"]' }),
    );
    mockNewsFindMany
      .mockResolvedValueOnce(lowTrustRecent)
      .mockResolvedValueOnce([makeEvent({ id: 'prev', trustLevel: 'unknown' })])
      .mockResolvedValueOnce([makeEvent({ id: 'old', trustLevel: 'unknown' })]);

    const result = await generateEventAlerts({ mode: 'market', days: 1, minSeverity: 'warning' });
    expect(result.alerts.map((alert) => alert.type)).toContain('low_trust_event_cluster');
    expect(result.alerts.map((alert) => alert.type)).not.toContain('market_event_increase');
    expect(result.summary).toContain('warning');
    expect(result.limitations).toContain('當期事件幾乎全為低可信度來源，已強制保守提醒。');
  });

  it('emits topic surge, diffusion, low-trust noise, and topic-source limitations', async () => {
    mockTopicSummary.mockResolvedValue({
      summary: 'topic results',
      topics: [
        { topic: 'AI', recentCount: 5, previousCount: 1, delta: 4, surgeLevel: 'surging', diffusionLevel: 'broadening theme', relatedSymbols: ['2330', '2317'], trustLevelSummary: 'secondary/unknown sources', limitations: [] },
        { topic: 'GPU', recentCount: 3, previousCount: 2, delta: 1, surgeLevel: 'watch', diffusionLevel: 'single-stock theme', relatedSymbols: ['2382'], trustLevelSummary: 'secondary', limitations: [] },
        { topic: 'quiet', recentCount: 1, previousCount: 1, delta: 0, surgeLevel: 'none', diffusionLevel: 'multi-stock theme', relatedSymbols: ['A', 'B'], trustLevelSummary: 'official', limitations: [] },
      ],
      limitations: ['topic source unavailable'],
      generatedAt: '2026-11-10T00:00:00.000Z',
    });

    const result = await generateEventAlerts({ mode: 'market', minSeverity: 'caution' });
    expect(result.alerts.map((alert) => alert.type)).toEqual(expect.arrayContaining([
      'topic_surging', 'theme_diffusing', 'low_trust_theme_noise',
    ]));
    expect(result.alerts.find((alert) => alert.type === 'topic_surging')?.severity).toBe('caution');
    expect(result.alerts.find((alert) => alert.type === 'theme_diffusing')?.severity).toBe('caution');
    expect(result.limitations).toContain('[topic] topic source unavailable');

    mockTopicSummary.mockRejectedValueOnce(new Error('topic engine down'));
    const degradedTopic = await generateEventAlerts({ mode: 'market' });
    expect(degradedTopic.limitations).toContain('topic surge 提醒暫時不可用（已降級）');
  });

  it('returns a stable degraded result when database access throws', async () => {
    mockNewsFindMany.mockRejectedValueOnce('query failed');
    const result = await generateEventAlerts({ mode: 'market' });
    expect(result).toMatchObject({
      summary: '事件提醒暫時不可用（已降級）。',
      alerts: [],
      limitations: ['事件資料查詢失敗，已回傳降級結構', 'unknown error'],
    });
  });
});
