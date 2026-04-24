import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';
import { buildRelevantInsights } from '@/lib/relevance/RelevanceInsightsService';
import type { RelevanceInsightsApiResponse, RelevanceMode } from '@/lib/relevance/types';

const CACHE_TTL_SECONDS = 180;

function parseMode(value: unknown): RelevanceMode {
  if (value === 'symbol' || value === 'watchlist') return value;
  return 'report';
}

function parseMaxItems(value: unknown): number {
  const parsed = Number(value ?? 5);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(Math.max(Math.round(parsed), 1), 10);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const mode = parseMode(body?.mode);
  const symbol = typeof body?.symbol === 'string' ? body.symbol.trim().toUpperCase() : undefined;
  const maxItems = parseMaxItems(body?.maxItems);
  const cacheKey = `relevance:insights:${mode}:${symbol ?? 'all'}:${maxItems}`;

  const cached = apiCache.get<RelevanceInsightsApiResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=60' },
    });
  }

  try {
    const response = await buildRelevantInsights({ mode, symbol, maxItems });
    apiCache.set(cacheKey, response, CACHE_TTL_SECONDS);
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=60' },
    });
  } catch (error) {
    const response: RelevanceInsightsApiResponse = {
      insights: [],
      generatedAt: new Date().toISOString(),
      limitations: [error instanceof Error ? error.message : 'relevance insights unavailable'],
    };
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    });
  }
}
