import {
  ingestEvents,
  classifyTrustLevel,
  type RawEventInput,
} from '../EventIngestionService';

describe('EventIngestionService', () => {
  it('dedupes by rawUrl and by same source+title in close time', async () => {
    const rawInputs: RawEventInput[] = [
      {
        title: '2330 法說會重點整理',
        summary: '重點一',
        source: 'Yahoo 台股新聞 RSS',
        sourceType: 'rss',
        rawUrl: 'https://example.com/a',
        publishedAt: '2026-03-18T10:00:00Z',
      },
      {
        title: '2330 法說會重點整理',
        summary: '重點一 duplicate by url',
        source: 'Yahoo 台股新聞 RSS',
        sourceType: 'rss',
        rawUrl: 'https://example.com/a',
        publishedAt: '2026-03-18T10:05:00Z',
      },
      {
        title: '2330 法說會重點整理',
        summary: '重點一 duplicate by title+source+time',
        source: 'Yahoo 台股新聞 RSS',
        sourceType: 'rss',
        publishedAt: '2026-03-18T11:00:00Z',
      },
    ];

    const result = await ingestEvents({ symbol: '2330', rawInputsForTest: rawInputs, includeMock: false, includeRss: false });
    expect(result.rawCount).toBe(3);
    expect(result.events.length).toBe(1);
    expect(result.dedupedCount).toBe(2);
  });

  it('classifies source trust level', () => {
    expect(classifyTrustLevel('TWSE 公告', 'https://mops.twse.com.tw/mops/web/t05sr01_1')).toBe('official');
    expect(classifyTrustLevel('Yahoo 台股新聞 RSS', 'https://tw.stock.yahoo.com/news/abc')).toBe('mainstream');
    expect(classifyTrustLevel('MockEventSource:IR')).toBe('secondary');
  });
});
