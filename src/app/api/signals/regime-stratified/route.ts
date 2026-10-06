import { NextRequest, NextResponse } from 'next/server';
import { buildAllSignalHistories } from '@/lib/signals/SignalHistoryBuilder';
import { computeAllRegimeStratified } from '@/lib/signals/RegimeStratifiedEngine';
import type { SignalType, SignalWindow } from '@/lib/signals/types';
import type { RegimeStratifiedResult } from '@/lib/signals/RegimeStratifiedEngine';

export interface RegimeStratifiedApiResponse {
  symbol?: string;
  window: SignalWindow;
  results: RegimeStratifiedResult[];
  generatedAt: string;
  limitations: string[];
}

const STOCK_SIGNAL_TYPES: SignalType[] = [
  'topic_surging',
  'theme_diffusing',
  'strong_alpha_candidate',
  'chip_accumulation_signal',
  'risk_cluster_elevated',
];

function parseWindow(value: string | null): SignalWindow {
  if (value === '3') return 3;
  if (value === '10') return 10;
  return 5;
}

/**
 * GET /api/signals/regime-stratified
 *
 * Query:
 * - symbol: optional stock symbol filter
 * - window: 3 | 5 | 10 (default 5)
 * - days:   lookback window in days (default 180)
 *
 * Research-only. Does not affect alphaScore or screen results.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const symbol = (q.get('symbol') ?? '').trim().toUpperCase();
  const window = parseWindow(q.get('window'));
  const days = parseInt(q.get('days') ?? '180', 10) || 180;

  try {
    const histories = await buildAllSignalHistories(days);

    const scopedHistories = histories
      .filter((h) => (STOCK_SIGNAL_TYPES as string[]).includes(h.signalType))
      .map((h) => {
        if (!symbol) return h;
        const filtered = h.observations.filter((o) => o.symbol === symbol);
        return {
          ...h,
          observations: filtered,
          limitations:
            filtered.length === 0
              ? [...h.limitations, `symbol=${symbol} 無對應訊號觀察`]
              : h.limitations,
        };
      });

    const results = await computeAllRegimeStratified(scopedHistories, window, days);

    const response: RegimeStratifiedApiResponse = {
      ...(symbol ? { symbol } : {}),
      window,
      results,
      generatedAt: new Date().toISOString(),
      limitations: [...new Set(results.flatMap((r) => r.limitations))],
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('[signals/regime-stratified] error:', error);
    return NextResponse.json(
      {
        error: '環境分層計算失敗',
        window,
        results: [],
        generatedAt: new Date().toISOString(),
        limitations: ['環境分層計算失敗'],
      },
      { status: 500 },
    );
  }
}
