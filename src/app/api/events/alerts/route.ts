import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';
import {
  generateEventAlerts,
  type EventAlertMode,
  type EventAlertSeverity,
  type EventAlertsResult,
} from '@/lib/events/EventAlertEngine';

const CACHE_TTL = 120;

const MODES: EventAlertMode[] = ['market', 'symbol', 'watchlist', 'candidates'];
const SEVERITIES: EventAlertSeverity[] = ['info', 'caution', 'warning'];

function parseMode(value: string | null): EventAlertMode {
  if (value && MODES.includes(value as EventAlertMode)) return value as EventAlertMode;
  return 'market';
}

function parseSeverity(value: string | null): EventAlertSeverity {
  if (value && SEVERITIES.includes(value as EventAlertSeverity)) return value as EventAlertSeverity;
  return 'info';
}

function emptyResult(note: string): EventAlertsResult {
  return {
    summary: note,
    alerts: [],
    limitations: ['事件提醒資料不可用，已降級'],
    generatedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse<EventAlertsResult>> {
  const mode = parseMode(req.nextUrl.searchParams.get('mode'));
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase();
  const rawDays = Number(req.nextUrl.searchParams.get('days') ?? '1');
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 7) : 1;
  const minSeverity = parseSeverity(req.nextUrl.searchParams.get('minSeverity'));

  const cacheKey = `events:alerts:v1:mode=${mode}:symbol=${symbol ?? 'none'}:days=${days}:sev=${minSeverity}`;
  const cached = apiCache.get<EventAlertsResult>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const result = await generateEventAlerts({ mode, symbol, days, minSeverity });
    apiCache.set(cacheKey, result, CACHE_TTL);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(emptyResult('事件提醒產生失敗'), { status: 200 });
  }
}
