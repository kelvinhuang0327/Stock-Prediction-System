import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';
import {
  buildDegradedSignalEffectivenessBatch,
  buildSignalEffectivenessBatch,
} from '@/lib/signals/SignalEffectivenessBatchService';
import type { SignalEffectivenessBatchApiResponse, SignalWindow } from '@/lib/signals/types';

const CACHE_TTL_SECONDS = 240;
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=240, stale-while-revalidate=120',
};

function parseWindow(value: string | null): SignalWindow {
  if (value === '3') return 3;
  if (value === '10') return 10;
  return 5;
}

/**
 * GET /api/signals/effectiveness/batch
 *
 * Query:
 * - symbol: optional symbol filter
 * - window: 3 | 5 | 10 (default 5)
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const symbol = (q.get('symbol') ?? '').trim().toUpperCase();
  const window = parseWindow(q.get('window'));

  const cacheKey = `signals:effectiveness:batch:${symbol || 'all'}:${window}`;
  const cached = apiCache.get<SignalEffectivenessBatchApiResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    const response = await buildSignalEffectivenessBatch({ symbol, window, days: 180 });

    apiCache.set(cacheKey, response, CACHE_TTL_SECONDS);
    return NextResponse.json(response, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error('[signals/effectiveness/batch] error:', error);

    const response = buildDegradedSignalEffectivenessBatch(
      window,
      symbol || undefined,
      '訊號有效性批次計算失敗（已降級）',
    );

    return NextResponse.json(response, {
      status: 500,
      headers: CACHE_HEADERS,
    });
  }
}
