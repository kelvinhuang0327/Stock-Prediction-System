import { prisma } from '@/lib/prisma';
import type { NewsEvent } from '@prisma/client';
import {
  ingestEvents,
  dedupeEventRecords,
  type EventCoverage,
  type EventRecord,
  type IngestedEventBundle,
  type TrustLevelSummary,
} from '@/lib/events/EventIngestionService';
import type { SourceTrustLevel } from '@/lib/events/SourceTrustPolicy';
import {
  assessEventSourceQualityFromRecords,
  buildDegradedEventSourceQuality,
  type EventSourceQuality,
} from '@/lib/events/EventSourceQualityEngine';

const TRUST_LEVELS = new Set<SourceTrustLevel>(['official', 'mainstream', 'secondary', 'unknown']);

function toTrustLevel(raw: string): SourceTrustLevel {
  return TRUST_LEVELS.has(raw as SourceTrustLevel) ? (raw as SourceTrustLevel) : 'unknown';
}

function parseStringArrayField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (typeof value !== 'string' || value.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export interface EventSummaryResult {
  eventCount: number;
  rawCount: number;
  dedupedCount: number;
  recentThemes: string[];
  catalystSummary: string;
  sourceBreakdown: Record<string, number>;
  trustLevelSummary: TrustLevelSummary;
  limitations: string[];
  dataCoverage: EventCoverage;
  recentEventTitles: string[];
  /** Source quality / simulation-dominance guardrail. Undefined only in degraded fallback paths. */
  sourceQuality?: EventSourceQuality;
}

export type { EventSourceQuality };

function emptyTrustSummary(): TrustLevelSummary {
  return {
    official: 0,
    mainstream: 0,
    secondary: 0,
    unknown: 0,
    dominant: 'mixed',
    note: '目前無可用事件來源。',
  };
}

function extractRecentThemes(events: EventRecord[]): string[] {
  const freq = new Map<string, number>();
  for (const ev of events.slice(0, 10)) {
    for (const t of ev.relatedThemes) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme]) => theme);
}

function buildCatalystSummary(eventCount: number, trust: TrustLevelSummary): string {
  if (eventCount === 0) return '近期無明確事件資料，催化劑面不足';
  if (eventCount <= 2) return '近期有零星事件，影響仍待觀察';
  const highTrust = trust.official + trust.mainstream;
  const lowTrust = trust.secondary + trust.unknown;
  if (highTrust > 0 && highTrust >= lowTrust) {
    return '近期主題較集中，且包含較高可信度來源，值得持續觀察';
  }
  return '近期有多則事件提及該標的，但來源多為次級或未分類摘要，需保守解讀';
}

function summarizeTrust(events: EventRecord[]): TrustLevelSummary {
  const t = emptyTrustSummary();
  for (const ev of events) t[ev.trustLevel] += 1;
  const ranked = (['official', 'mainstream', 'secondary', 'unknown'] as const)
    .map((level) => ({ level, count: t[level] }))
    .sort((a, b) => b.count - a.count);
  t.dominant = ranked[0].count > ranked[1].count ? ranked[0].level : 'mixed';
  if (t.official + t.mainstream > 0) t.note = '含較高可信度來源，可作研究觀察參考。';
  else if (t.secondary + t.unknown > 0) t.note = '來源多為次級或未分類，需保守解讀。';
  return t;
}

function sourceBreakdown(events: EventRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ev of events) out[ev.source] = (out[ev.source] ?? 0) + 1;
  return out;
}

function coverage(events: EventRecord[]): EventCoverage {
  if (!events.length) return 'insufficient';
  return events.filter((e) => e.dataCoverage === 'full').length >= 3 ? 'full' : 'limited';
}

function summarizeEvents(
  events: EventRecord[],
  rawCount: number,
  dedupedCount: number,
  limitations: string[],
  sourceTypeTracked = true,
): EventSummaryResult {
  const trustLevelSummary = summarizeTrust(events);
  const recentThemes = extractRecentThemes(events);
  const eventCount = events.length;
  const outLimitations = [...limitations];
  if (eventCount > 0 && trustLevelSummary.official + trustLevelSummary.mainstream === 0) {
    outLimitations.push('事件來源多為 secondary/unknown，可信度有限');
  }
  if (dedupedCount > 0) outLimitations.push(`已去除 ${dedupedCount} 筆疑似重複事件`);
  if (eventCount > 0 && events.some((e) => e.dataCoverage !== 'full')) outLimitations.push('部分事件缺少完整摘要，僅可有限解讀');

  const sourceQuality = assessEventSourceQualityFromRecords(events, sourceTypeTracked);

  return {
    eventCount,
    rawCount,
    dedupedCount,
    recentThemes,
    catalystSummary: buildCatalystSummary(eventCount, trustLevelSummary),
    sourceBreakdown: sourceBreakdown(events),
    trustLevelSummary,
    limitations: outLimitations,
    dataCoverage: coverage(events),
    recentEventTitles: events.slice(0, 3).map((e) => e.title),
    sourceQuality,
  };
}

export function summarizeEventBundle(bundle: IngestedEventBundle): EventSummaryResult {
  // Live ingest always has accurate sourceType tracking
  return summarizeEvents(bundle.events, bundle.rawCount, bundle.dedupedCount, bundle.limitations, true);
}

export async function loadEventsFromDb(symbol?: string, days = 7, limit = 50): Promise<EventRecord[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.newsEvent.findMany({
    where: { publishedAt: { gte: since } },
    orderBy: { publishedAt: 'desc' },
    take: Math.max(limit * 4, 100),
  });

  const mapped: EventRecord[] = (rows as NewsEvent[]).map((r) => ({
    title: r.title,
    summary: r.summary ?? '',
    publishedAt: new Date(r.publishedAt).toISOString(),
    relatedSymbols: parseStringArrayField(r.relatedSymbols),
    relatedThemes: parseStringArrayField(r.relatedThemes),
    source: r.source,
    sourceType: 'rss' as const,
    trustLevel: toTrustLevel(r.trustLevel),
    rawUrl: r.rawUrl ?? null,
    dataCoverage: (r.summary ? 'full' : 'limited') as EventCoverage,
    titleHash: r.titleHash,
  }));

  const filtered = symbol
    ? mapped.filter((e) => e.relatedSymbols.includes(symbol.toUpperCase()))
    : mapped;
  return filtered.slice(0, limit);
}

export async function getEventSummaryForSymbol(options: {
  symbol: string;
  days?: number;
  limit?: number;
}): Promise<{ summary: EventSummaryResult; source: 'db' | 'live_fallback' | 'empty' }> {
  const symbol = options.symbol.toUpperCase();
  const days = options.days ?? 7;
  const limit = options.limit ?? 25;

  try {
    const dbEvents = await loadEventsFromDb(symbol, days, limit);
    if (dbEvents.length > 0) {
      const { events, dedupedCount } = dedupeEventRecords(dbEvents);
      // sourceTypeTracked=false: DB does not store sourceType, cannot confirm RSS vs mock origin
      return {
        summary: summarizeEvents(events.slice(0, limit), dbEvents.length, dedupedCount, [], false),
        source: 'db',
      };
    }
  } catch {
    // fall through to live fallback
  }

  try {
    const bundle = await ingestEvents({ symbol, limit, includeRss: true, includeMock: true });
    return {
      summary: summarizeEventBundle(bundle),
      source: bundle.events.length > 0 ? 'live_fallback' : 'empty',
    };
  } catch {
    return {
      summary: { ...summarizeEvents([], 0, 0, ['事件來源抓取失敗，已降級為空結構']), sourceQuality: buildDegradedEventSourceQuality('事件來源抓取失敗') },
      source: 'empty',
    };
  }
}

export async function getMarketEventSummary(options?: {
  days?: number;
  limit?: number;
}): Promise<{ summary: EventSummaryResult; source: 'db' | 'live_fallback' | 'empty' }> {
  const days = options?.days ?? 1;
  const limit = options?.limit ?? 40;
  try {
    const dbEvents = await loadEventsFromDb(undefined, days, limit);
    if (dbEvents.length > 0) {
      const { events, dedupedCount } = dedupeEventRecords(dbEvents);
      // sourceTypeTracked=false: DB does not store sourceType
      return {
        summary: summarizeEvents(events.slice(0, limit), dbEvents.length, dedupedCount, [], false),
        source: 'db',
      };
    }
  } catch {
    // fall through
  }

  try {
    const bundle = await ingestEvents({ includeRss: true, includeMock: true, limit });
    return {
      summary: summarizeEventBundle(bundle),
      source: bundle.events.length > 0 ? 'live_fallback' : 'empty',
    };
  } catch {
    return {
      summary: { ...summarizeEvents([], 0, 0, ['事件來源抓取失敗，已降級為空結構']), sourceQuality: buildDegradedEventSourceQuality('市場事件來源抓取失敗') },
      source: 'empty',
    };
  }
}

export const EventSummaryEngine = {
  summarizeEventBundle,
  loadEventsFromDb,
  getEventSummaryForSymbol,
  getMarketEventSummary,
};
