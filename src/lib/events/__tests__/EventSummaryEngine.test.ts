import { prisma } from '@/lib/prisma';
import {
  getEventSummaryForSymbol,
  getMarketEventSummary,
  loadEventsFromDb,
  summarizeEventBundle,
} from '../EventSummaryEngine';
import { dedupeEventRecords, ingestEvents } from '../EventIngestionService';
import type { EventRecord, IngestedEventBundle } from '../EventIngestionService';

jest.mock('@/lib/prisma', () => ({ prisma: { newsEvent: { findMany: jest.fn() } } }));
jest.mock('../EventIngestionService', () => ({
  ingestEvents: jest.fn(),
  dedupeEventRecords: jest.fn((events: EventRecord[]) => ({ events, dedupedCount: 0 })),
}));

const findEvents = (prisma as unknown as { newsEvent: { findMany: jest.Mock } }).newsEvent.findMany;
const ingestEventsMock = ingestEvents as jest.MockedFunction<typeof ingestEvents>;
const dedupeEventsMock = dedupeEventRecords as jest.MockedFunction<typeof dedupeEventRecords>;

function event(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    title: '營收成長',
    summary: '營收與 EPS 維持成長',
    publishedAt: '2026-11-10T00:00:00.000Z',
    relatedSymbols: ['2330'],
    relatedThemes: ['半導體', 'AI'],
    source: 'TWSE',
    sourceType: 'rss',
    trustLevel: 'official',
    rawUrl: 'https://example.com/news',
    dataCoverage: 'full',
    titleHash: 'hash',
    ...overrides,
  };
}

function emptyBundle(): IngestedEventBundle {
  return {
    events: [],
    rawCount: 0,
    dedupedCount: 0,
    sourceBreakdown: {},
    trustLevelSummary: {
      official: 0,
      mainstream: 0,
      secondary: 0,
      unknown: 0,
      dominant: 'mixed',
      note: '目前無可用事件來源。',
    },
    limitations: [],
    dataCoverage: 'insufficient',
  };
}

describe('EventSummaryEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findEvents.mockResolvedValue([]);
    ingestEventsMock.mockResolvedValue(emptyBundle());
    dedupeEventsMock.mockImplementation((events) => ({ events, dedupedCount: 0 }));
  });

  it('returns complete degraded structure for empty events', () => {
    const summary = summarizeEventBundle(emptyBundle());
    expect(summary.eventCount).toBe(0);
    expect(summary.rawCount).toBe(0);
    expect(summary.recentThemes).toEqual([]);
    expect(summary.catalystSummary.length).toBeGreaterThan(0);
    expect(summary.trustLevelSummary.unknown).toBe(0);
    expect(summary.dataCoverage).toBe('insufficient');
  });

  it('summarizes source trust, themes, coverage, limitations, and duplicate counts', () => {
    const events = [
      event({ title: 'one', relatedThemes: ['AI', '半導體'], source: 'TWSE', trustLevel: 'official' }),
      event({ title: 'two', relatedThemes: ['AI'], source: 'CNA', trustLevel: 'mainstream', dataCoverage: 'limited' }),
      event({ title: 'three', relatedThemes: ['AI', '電子'], source: 'Blog A', trustLevel: 'secondary' }),
      event({ title: 'four', relatedThemes: ['AI', '半導體'], source: 'Blog A', trustLevel: 'unknown' }),
    ];
    const summary = summarizeEventBundle({ ...emptyBundle(), events, rawCount: 5, dedupedCount: 1, limitations: ['source warning'] });

    expect(summary).toMatchObject({
      eventCount: 4,
      rawCount: 5,
      dedupedCount: 1,
      recentThemes: ['AI', '半導體', '電子'],
      catalystSummary: '近期主題較集中，且包含較高可信度來源，值得持續觀察',
      sourceBreakdown: { TWSE: 1, CNA: 1, 'Blog A': 2 },
      trustLevelSummary: { official: 1, mainstream: 1, secondary: 1, unknown: 1, dominant: 'mixed' },
      dataCoverage: 'full',
      recentEventTitles: ['one', 'two', 'three'],
    });
    expect(summary.limitations).toEqual(expect.arrayContaining([
      'source warning', '已去除 1 筆疑似重複事件', '部分事件缺少完整摘要，僅可有限解讀',
    ]));
  });

  it('parses database event arrays, normalizes trust levels, filters symbols, and applies the result limit', async () => {
    findEvents.mockResolvedValue([
      { title: 'match', summary: 'full', publishedAt: new Date('2026-11-10T00:00:00Z'), relatedSymbols: '["2330",3]', relatedThemes: ['AI', 4], source: 'TWSE', trustLevel: 'official', rawUrl: null, titleHash: 'a' },
      { title: 'other', summary: null, publishedAt: new Date('2026-11-09T00:00:00Z'), relatedSymbols: 'not-json', relatedThemes: '{}', source: 'RSS', trustLevel: 'unknown-value', rawUrl: null, titleHash: 'b' },
      { title: 'bad-shape', summary: null, publishedAt: new Date('2026-11-08T00:00:00Z'), relatedSymbols: 5, relatedThemes: '', source: 'RSS', trustLevel: 'secondary', rawUrl: null, titleHash: 'c' },
      { title: 'array-field', summary: null, publishedAt: new Date('2026-11-07T00:00:00Z'), relatedSymbols: ['2330', 5], relatedThemes: ' ["GPU", 7] ', source: 'Exchange', trustLevel: 'mainstream', rawUrl: 'url', titleHash: 'd' },
    ]);

    const events = await loadEventsFromDb('2330', 3, 1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: 'match', relatedSymbols: ['2330'], relatedThemes: ['AI'], trustLevel: 'official',
      rawUrl: null, dataCoverage: 'full', sourceType: 'rss',
    });
    expect(findEvents).toHaveBeenCalledWith(expect.objectContaining({ take: 100, orderBy: { publishedAt: 'desc' } }));

    const unfiltered = await loadEventsFromDb(undefined, 1, 10);
    expect(unfiltered).toHaveLength(4);
    expect(unfiltered[1]).toMatchObject({ title: 'other', relatedSymbols: [], relatedThemes: [], trustLevel: 'unknown', dataCoverage: 'limited' });
    expect(unfiltered[2]).toMatchObject({ title: 'bad-shape', relatedSymbols: [], relatedThemes: [] });
    expect(unfiltered[3]).toMatchObject({ title: 'array-field', relatedSymbols: ['2330'], relatedThemes: ['GPU'], trustLevel: 'mainstream' });
  });

  it('uses DB records for symbol and market summaries, including low-trust and duplicate warnings', async () => {
    findEvents.mockResolvedValue([
      { title: 'a', summary: '', publishedAt: new Date('2026-11-10'), relatedSymbols: ['2330'], relatedThemes: ['AI'], source: 'Blog', trustLevel: 'secondary', rawUrl: null, titleHash: 'a' },
      { title: 'b', summary: '', publishedAt: new Date('2026-11-09'), relatedSymbols: ['2330'], relatedThemes: ['AI'], source: 'Blog', trustLevel: 'secondary', rawUrl: null, titleHash: 'b' },
      { title: 'c', summary: '', publishedAt: new Date('2026-11-08'), relatedSymbols: ['2330'], relatedThemes: ['GPU'], source: 'Feed', trustLevel: 'unknown', rawUrl: null, titleHash: 'c' },
    ]);
    dedupeEventsMock.mockImplementation((events) => ({ events, dedupedCount: 2 }));

    const bySymbol = await getEventSummaryForSymbol({ symbol: '2330', days: 4, limit: 2 });
    expect(bySymbol.source).toBe('db');
    expect(bySymbol.summary).toMatchObject({ eventCount: 2, rawCount: 2, dedupedCount: 2, dataCoverage: 'limited' });
    expect(bySymbol.summary.limitations).toEqual(expect.arrayContaining([
      '事件來源多為 secondary/unknown，可信度有限', '已去除 2 筆疑似重複事件',
    ]));

    const market = await getMarketEventSummary({ days: 2, limit: 5 });
    expect(market.source).toBe('db');
    expect(ingestEventsMock).not.toHaveBeenCalled();
  });

  it('falls back to live ingest for empty or failed DB reads and returns degraded empty data if both fail', async () => {
    findEvents.mockResolvedValueOnce([]);
    ingestEventsMock.mockResolvedValueOnce({ ...emptyBundle(), events: [event()], rawCount: 1 });
    const live = await getEventSummaryForSymbol({ symbol: '2330' });
    expect(live.source).toBe('live_fallback');
    expect(ingestEventsMock).toHaveBeenCalledWith({ symbol: '2330', limit: 25, includeRss: true, includeMock: true });

    findEvents.mockRejectedValueOnce(new Error('db down'));
    ingestEventsMock.mockResolvedValueOnce(emptyBundle());
    expect((await getMarketEventSummary()).source).toBe('empty');

    findEvents.mockRejectedValueOnce(new Error('db down'));
    ingestEventsMock.mockRejectedValueOnce(new Error('feed down'));
    const degraded = await getEventSummaryForSymbol({ symbol: '2330' });
    expect(degraded.source).toBe('empty');
    expect(degraded.summary.limitations).toContain('事件來源抓取失敗，已降級為空結構');
    expect(degraded.summary.sourceQuality).toBeDefined();
  });
});
