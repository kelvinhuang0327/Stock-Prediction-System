export interface RSSAdapterFeed {
  name: string;
  url: string;
}

export interface RSSRawEvent {
  title: string;
  summary?: string;
  publishedAt?: string;
  source: string;
  rawUrl?: string;
  sourceType: 'rss';
}

export interface RSSAdapterResult {
  events: RSSRawEvent[];
  limitations: string[];
}

const DEFAULT_FEEDS: RSSAdapterFeed[] = [
  { name: 'Yahoo 台股新聞 RSS', url: 'https://tw.stock.yahoo.com/rss' },
  { name: 'UDN 股市 RSS', url: 'https://udn.com/rssfeed/news/2/6644?ch=news' },
  { name: 'Google News 台股 RSS', url: 'https://news.google.com/rss/search?q=%E5%8F%B0%E8%82%A1+when%3A90d&hl=zh-TW&gl=TW&ceid=TW%3Azh-Hant' },
  { name: 'Google News 半導體 RSS', url: 'https://news.google.com/rss/search?q=%E5%8D%8A%E5%B0%8E%E9%AB%94+when%3A90d&hl=zh-TW&gl=TW&ceid=TW%3Azh-Hant' },
];

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(input: string): string {
  return decodeHtmlEntities(input).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m?.[1]?.trim() ?? null;
}

function normalizePublishedAt(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return undefined;
  return new Date(ts).toISOString();
}

function parseRSSItems(xml: string, feedName: string): RSSRawEvent[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const out: RSSRawEvent[] = [];

  for (const item of items) {
    const title = stripHtml(pickTag(item, 'title') ?? '');
    if (!title) continue;
    const summary = stripHtml(pickTag(item, 'description') ?? '');
    const rawUrl = pickTag(item, 'link') ?? undefined;
    const pubDate = normalizePublishedAt(pickTag(item, 'pubDate'));
    const source = stripHtml(pickTag(item, 'source') ?? feedName) || feedName;

    out.push({
      title,
      summary: summary || undefined,
      publishedAt: pubDate,
      source,
      rawUrl,
      sourceType: 'rss',
    });
  }

  return out;
}

export async function fetchRSSNewsEvents(options?: {
  feeds?: RSSAdapterFeed[];
  timeoutMs?: number;
  maxItemsPerFeed?: number;
}): Promise<RSSAdapterResult> {
  const feeds = options?.feeds ?? DEFAULT_FEEDS;
  const timeoutMs = options?.timeoutMs ?? 5000;
  const maxItemsPerFeed = options?.maxItemsPerFeed ?? 20;
  const limitations: string[] = [];

  const results = await Promise.all(
    feeds.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { 'User-Agent': 'StockInsightBot/1.0' },
          signal: AbortSignal.timeout(timeoutMs),
          cache: 'no-store',
        });
        if (!res.ok) {
          limitations.push(`RSS 來源 ${feed.name} 回應 ${res.status}`);
          return [] as RSSRawEvent[];
        }
        const xml = await res.text();
        return parseRSSItems(xml, feed.name).slice(0, maxItemsPerFeed);
      } catch {
        limitations.push(`RSS 來源 ${feed.name} 讀取失敗`);
        return [] as RSSRawEvent[];
      }
    })
  );

  return {
    events: results.flat(),
    limitations,
  };
}
