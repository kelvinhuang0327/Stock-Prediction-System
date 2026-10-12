import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';
import { generateTopicSurgeSummary, type TopicSurgeLevel, type TopicSurgeResponse } from '@/lib/events/TopicSurgeEngine';

const LEVELS: TopicSurgeLevel[] = ['none', 'watch', 'surging'];

function parseLevel(value: string | null): TopicSurgeLevel {
  if (value && LEVELS.includes(value as TopicSurgeLevel)) return value as TopicSurgeLevel;
  return 'none';
}

function parseBool(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

export async function GET(req: NextRequest): Promise<NextResponse<TopicSurgeResponse>> {
  const rawDays = Number(req.nextUrl.searchParams.get('days') ?? '3');
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 7) : 3;
  const minSurgeLevel = parseLevel(req.nextUrl.searchParams.get('minSurgeLevel'));
  const includeSymbols = parseBool(req.nextUrl.searchParams.get('includeSymbols'), true);
  const rawMaxTopics = Number(req.nextUrl.searchParams.get('maxTopics') ?? '5');
  const maxTopics = Number.isFinite(rawMaxTopics) ? Math.min(Math.max(rawMaxTopics, 1), 20) : 5;
  const symbol = req.nextUrl.searchParams.get('symbol')?.trim().toUpperCase();

  const cacheKey = `events:topics:v1:d=${days}:l=${minSurgeLevel}:s=${includeSymbols}:m=${maxTopics}:symbol=${symbol ?? 'all'}`;
  const cached = apiCache.get<TopicSurgeResponse>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const result = await generateTopicSurgeSummary({ days, minSurgeLevel, includeSymbols, maxTopics, symbol });
  apiCache.set(cacheKey, result, 120);
  return NextResponse.json(result);
}
