import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';
import { getEventSummaryForSymbol, type EventSummaryResult } from '@/lib/events/EventSummaryEngine';
import { buildDegradedEventSourceQuality } from '@/lib/events/EventSourceQualityEngine';

export interface EventSummaryResponse extends EventSummaryResult {
  symbol: string;
  last_updated: string;
}

function emptySummary(symbol: string, note: string): EventSummaryResponse {
  return {
    symbol,
    eventCount: 0,
    rawCount: 0,
    dedupedCount: 0,
    recentThemes: [],
    catalystSummary: note,
    sourceBreakdown: {},
    trustLevelSummary: {
      official: 0,
      mainstream: 0,
      secondary: 0,
      unknown: 0,
      dominant: 'mixed',
      note: '目前無可用事件來源。',
    },
    recentEventTitles: [],
    limitations: ['事件資料不足，已降級為空結構回傳'],
    dataCoverage: 'insufficient',
    sourceQuality: buildDegradedEventSourceQuality('事件資料不足，已降級為空結構'),
    last_updated: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse<EventSummaryResponse | { error: string }>> {
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: 'Missing required query param: symbol' }, { status: 400 });
  }

  const cacheKey = `events:summary:v2:${symbol}`;
  const cached = apiCache.get<EventSummaryResponse>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const { summary, source } = await getEventSummaryForSymbol({ symbol, limit: 25, days: 7 });
    const response: EventSummaryResponse = {
      symbol,
      ...summary,
      limitations: source === 'db' ? summary.limitations : [...summary.limitations, '目前使用即時來源 fallback，資料穩定性較低'],
      last_updated: new Date().toISOString(),
    };
    apiCache.set(cacheKey, response, 300);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(emptySummary(symbol, '事件摘要暫時不可用'), { status: 200 });
  }
}
