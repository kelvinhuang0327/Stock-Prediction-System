import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getMockEvents, type MockEventItem } from '@/lib/events/MockEventSource';
import { fetchRSSNewsEvents, type RSSRawEvent } from '@/lib/events/adapters/RSSNewsAdapter';
import { resolveSourceTrustLevel, type SourceTrustLevel } from '@/lib/events/SourceTrustPolicy';

export type EventCoverage = 'full' | 'limited' | 'insufficient';
export type EventTrustLevel = SourceTrustLevel;

export interface EventRecord {
  title: string;
  summary: string;
  publishedAt: string;
  relatedSymbols: string[];
  relatedThemes: string[];
  source: string;
  sourceType: 'mock' | 'rss';
  trustLevel: EventTrustLevel;
  rawUrl: string | null;
  dataCoverage: EventCoverage;
  titleHash: string;
}

export interface TrustLevelSummary {
  official: number;
  mainstream: number;
  secondary: number;
  unknown: number;
  dominant: EventTrustLevel | 'mixed';
  note: string;
}

export interface IngestedEventBundle {
  events: EventRecord[];
  rawCount: number;
  dedupedCount: number;
  rssCount: number;
  mockCount: number;
  sourceBreakdown: Record<string, number>;
  trustLevelSummary: TrustLevelSummary;
  limitations: string[];
  dataCoverage: EventCoverage;
}

export interface RawEventInput {
  title: string;
  summary?: string;
  publishedAt?: string;
  source: string;
  sourceType: 'mock' | 'rss';
  rawUrl?: string;
  symbol?: string;
  trustLevel?: EventTrustLevel;
}

export interface PersistResult {
  inserted: number;
  skippedDuplicate: number;
  failed: number;
}

export interface SyncResult {
  bundle: IngestedEventBundle;
  persist: PersistResult;
}

export function classifyTrustLevel(source: string, rawUrl?: string): EventTrustLevel {
  return resolveSourceTrustLevel(source, rawUrl);
}

function extractSymbolsFromText(text: string): string[] {
  const matches = text.match(/\b\d{4}\b/g) ?? [];
  return [...new Set(matches)];
}

function extractThemes(text: string): string[] {
  const stopwords = new Set(['市場', '公司', '消息', '新聞', '報導', '今日', '更新', '觀察']);
  const tokens = text
    .split(/[\s,，。:：\-()（）]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && !stopwords.has(s) && !/^\d{4}$/.test(s));
  return [...new Set(tokens)].slice(0, 8);
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

function hashTitle(title: string): string {
  return createHash('sha1').update(normalizeTitle(title)).digest('hex').slice(0, 16);
}

function normalizeRawEvent(raw: RawEventInput): EventRecord | null {
  if (!raw.title?.trim()) return null;
  const title = raw.title.trim();
  const summary = raw.summary?.trim() ?? '';
  const ts = raw.publishedAt ? Date.parse(raw.publishedAt) : NaN;
  const publishedAt = Number.isNaN(ts) ? new Date().toISOString() : new Date(ts).toISOString();
  const relatedSymbols = [
    ...new Set([
      ...(raw.symbol ? [raw.symbol.toUpperCase()] : []),
      ...extractSymbolsFromText(`${title} ${summary}`).map((s) => s.toUpperCase()),
    ]),
  ];
  const trustLevel = raw.trustLevel ?? resolveSourceTrustLevel(raw.source, raw.rawUrl);
  const titleHash = hashTitle(title);
  const dataCoverage: EventCoverage = summary ? 'full' : 'limited';

  return {
    title,
    summary,
    publishedAt,
    relatedSymbols,
    relatedThemes: extractThemes(`${title} ${summary}`),
    source: raw.source || 'unknown',
    sourceType: raw.sourceType,
    trustLevel,
    rawUrl: raw.rawUrl ?? null,
    dataCoverage,
    titleHash,
  };
}

function toRawEventsFromMock(list: MockEventItem[]): RawEventInput[] {
  return list.map((e) => ({
    title: e.title,
    summary: e.summary,
    publishedAt: e.publishedAt,
    source: e.source,
    sourceType: 'mock',
    symbol: e.symbol,
  }));
}

function toRawEventsFromRSS(list: RSSRawEvent[]): RawEventInput[] {
  return list.map((e) => ({
    title: e.title,
    summary: e.summary,
    publishedAt: e.publishedAt,
    source: e.source,
    sourceType: 'rss',
    rawUrl: e.rawUrl,
  }));
}

export function dedupeEventRecords(input: EventRecord[]): { events: EventRecord[]; dedupedCount: number } {
  const sorted = [...input].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const kept: EventRecord[] = [];
  const seenUrl = new Set<string>();
  const seenSourceTitleWindow = new Set<string>();
  let dedupedCount = 0;

  for (const ev of sorted) {
    if (ev.rawUrl && seenUrl.has(ev.rawUrl)) {
      dedupedCount++;
      continue;
    }
    if (ev.rawUrl) seenUrl.add(ev.rawUrl);

    const timeBucket = Math.floor(Date.parse(ev.publishedAt) / (6 * 60 * 60 * 1000)); // 6h window
    const sourceTitleKey = `${ev.source.toLowerCase()}|${ev.titleHash}|${timeBucket}`;
    if (seenSourceTitleWindow.has(sourceTitleKey)) {
      dedupedCount++;
      continue;
    }
    seenSourceTitleWindow.add(sourceTitleKey);
    kept.push(ev);
  }

  return { events: kept, dedupedCount };
}

function buildTrustSummary(events: EventRecord[]): TrustLevelSummary {
  const summary: TrustLevelSummary = {
    official: 0,
    mainstream: 0,
    secondary: 0,
    unknown: 0,
    dominant: 'mixed',
    note: '',
  };
  for (const ev of events) summary[ev.trustLevel] += 1;
  const ranked = (['official', 'mainstream', 'secondary', 'unknown'] as EventTrustLevel[])
    .map((level) => ({ level, count: summary[level] }))
    .sort((a, b) => b.count - a.count);
  summary.dominant = ranked[0].count > ranked[1].count ? ranked[0].level : 'mixed';

  if (summary.official + summary.mainstream > 0) summary.note = '含較高可信度來源，可作研究觀察參考。';
  else if (summary.secondary + summary.unknown > 0) summary.note = '來源多為次級或未分類，需保守解讀。';
  else summary.note = '目前無可用事件來源。';
  return summary;
}

function buildSourceBreakdown(events: EventRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ev of events) out[ev.source] = (out[ev.source] ?? 0) + 1;
  return out;
}

function aggregateCoverage(events: EventRecord[]): EventCoverage {
  if (!events.length) return 'insufficient';
  const fullCount = events.filter((e) => e.dataCoverage === 'full').length;
  return fullCount >= 3 ? 'full' : 'limited';
}

export async function ingestEvents(options?: {
  symbol?: string;
  limit?: number;
  includeMock?: boolean;
  includeRss?: boolean;
  fallbackToMockOnRssFailure?: boolean;
  rawInputsForTest?: RawEventInput[];
}): Promise<IngestedEventBundle> {
  const symbol = options?.symbol?.toUpperCase();
  const limit = options?.limit ?? 30;
  const includeMock = options?.includeMock ?? true;
  const includeRss = options?.includeRss ?? true;
  const fallbackToMockOnRssFailure = options?.fallbackToMockOnRssFailure ?? true;
  const limitations: string[] = [];
  let rawInputs: RawEventInput[] = [];

  if (options?.rawInputsForTest) {
    rawInputs = options.rawInputsForTest;
  } else {
    if (includeRss) {
      const rss = await fetchRSSNewsEvents();
      rawInputs.push(...toRawEventsFromRSS(rss.events));
      limitations.push(...rss.limitations);
      if (!rss.events.length && fallbackToMockOnRssFailure) {
        limitations.push('RSS 來源不可用，已降級使用 mock 事件資料');
      }
    }
    if (includeMock || (fallbackToMockOnRssFailure && rawInputs.length === 0)) {
      rawInputs.push(...toRawEventsFromMock(getMockEvents()));
    }
  }

  const normalizedAll = rawInputs
    .map(normalizeRawEvent)
    .filter((e): e is EventRecord => e !== null);

  const normalized = symbol
    ? normalizedAll.filter((e) => e.relatedSymbols.includes(symbol))
    : normalizedAll;
  const rawCount = normalized.length;
  const { events: deduped, dedupedCount } = dedupeEventRecords(normalized);

  const events = deduped
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, limit);

  if (symbol && normalizedAll.length > 0 && rawCount === 0) {
    limitations.push(`事件存在但無法可靠關聯到 ${symbol}，已保守不綁定個股`);
  }

  return {
    events,
    rawCount,
    dedupedCount,
    rssCount: events.filter((e) => e.sourceType === 'rss').length,
    mockCount: events.filter((e) => e.sourceType === 'mock').length,
    sourceBreakdown: buildSourceBreakdown(events),
    trustLevelSummary: buildTrustSummary(events),
    limitations,
    dataCoverage: aggregateCoverage(events),
  };
}

export async function persistEventsToDb(events: EventRecord[]): Promise<PersistResult> {
  const result: PersistResult = { inserted: 0, skippedDuplicate: 0, failed: 0 };
  for (const ev of events) {
    try {
      // url duplicate
      if (ev.rawUrl) {
        const existingUrl = await prisma.newsEvent.findFirst({ where: { rawUrl: ev.rawUrl } });
        if (existingUrl) {
          result.skippedDuplicate++;
          continue;
        }
      }

      // titleHash + source + close time duplicate
      const at = new Date(ev.publishedAt);
      const before = new Date(at.getTime() - 6 * 60 * 60 * 1000);
      const after = new Date(at.getTime() + 6 * 60 * 60 * 1000);
      const existing = await prisma.newsEvent.findFirst({
        where: {
          titleHash: ev.titleHash,
          source: ev.source,
          publishedAt: { gte: before, lte: after },
        },
      });
      if (existing) {
        result.skippedDuplicate++;
        continue;
      }

      await prisma.newsEvent.create({
        data: {
          title: ev.title,
          summary: ev.summary || null,
          source: ev.source,
          trustLevel: ev.trustLevel,
          publishedAt: new Date(ev.publishedAt),
          relatedSymbols: JSON.stringify(ev.relatedSymbols),
          relatedThemes: JSON.stringify(ev.relatedThemes),
          rawUrl: ev.rawUrl,
          titleHash: ev.titleHash,
        },
      });
      result.inserted++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

export async function syncAndStoreEvents(options?: {
  symbol?: string;
  limit?: number;
  includeMock?: boolean;
  includeRss?: boolean;
  dryRun?: boolean;
}): Promise<SyncResult> {
  const bundle = await ingestEvents(options);
  if (options?.dryRun) {
    return {
      bundle,
      persist: { inserted: 0, skippedDuplicate: 0, failed: 0 },
    };
  }

  try {
    const persist = await persistEventsToDb(bundle.events);
    return { bundle, persist };
  } catch {
    return {
      bundle: {
        ...bundle,
        limitations: [...bundle.limitations, '事件寫入資料庫失敗，已維持記憶體模式'],
      },
      persist: { inserted: 0, skippedDuplicate: 0, failed: bundle.events.length },
    };
  }
}

export const EventIngestionService = {
  classifyTrustLevel,
  ingestEvents,
  persistEventsToDb,
  syncAndStoreEvents,
  dedupeEventRecords,
};
