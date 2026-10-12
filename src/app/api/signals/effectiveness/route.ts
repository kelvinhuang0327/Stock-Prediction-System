import { NextRequest, NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';
import { buildSignalHistory } from '@/lib/signals/SignalHistoryBuilder';
import { evaluateSignalEffectiveness } from '@/lib/signals/SignalEffectivenessEngine';
import type {
  SignalType,
  SignalEffectivenessApiResponse,
} from '@/lib/signals/types';

const SIGNAL_TYPES: SignalType[] = [
  'topic_surging',
  'theme_diffusing',
  'strong_alpha_candidate',
  'chip_accumulation_signal',
  'risk_cluster_elevated',
  'regime_shift_signal',
];

function parseSignalType(value: string | null): SignalType | null {
  if (!value) return null;
  return SIGNAL_TYPES.includes(value as SignalType) ? (value as SignalType) : null;
}

function parseWindow(value: string | null): 3 | 5 | 10 {
  if (value === '3') return 3;
  if (value === '10') return 10;
  return 5;
}

/**
 * GET /api/signals/effectiveness
 *
 * Query:
 * - signalType: SignalType (required)
 * - symbol: optional symbol filter
 * - window: 3 | 5 | 10 (default 5)
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const signalType = parseSignalType(q.get('signalType'));
  const symbol = (q.get('symbol') ?? '').trim().toUpperCase();
  const window = parseWindow(q.get('window'));

  if (!signalType) {
    return NextResponse.json(
      {
        error: 'signalType is required',
        supportedSignals: SIGNAL_TYPES,
      },
      { status: 400 },
    );
  }

  const cacheKey = `signals:effectiveness:${signalType}:${symbol || 'all'}:${window}`;
  const cached = apiCache.get<SignalEffectivenessApiResponse>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const history = await buildSignalHistory(signalType, 180);
    const filteredHistory = symbol
      ? {
          ...history,
          observations: history.observations.filter((o) => o.symbol === symbol),
          limitations: history.observations.some((o) => o.symbol === symbol)
            ? history.limitations
            : [...history.limitations, `symbol=${symbol} 無對應訊號觀察`],
        }
      : history;

    const effectiveness = await evaluateSignalEffectiveness(filteredHistory, window);

    const response: SignalEffectivenessApiResponse = {
      signalType,
      window,
      effectiveness,
      generatedAt: new Date().toISOString(),
      limitations: effectiveness.limitations,
    };

    apiCache.set(cacheKey, response, 300);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[signals/effectiveness] error:', error);
    return NextResponse.json(
      {
        signalType,
        window,
        effectiveness: {
          signalType,
          window,
          sampleSize: 0,
          hitRate: 0,
          avgReturn: 0,
          excessReturn: 0,
          volatility: 0,
          regimeBreakdown: {},
          persistence: { avgDuration: 0, continuationRate: 0 },
          stabilityScore: 0,
          classification: 'NOISE',
          limitations: ['訊號有效性計算失敗（已降級）'],
        },
        generatedAt: new Date().toISOString(),
        limitations: ['訊號有效性計算失敗（已降級）'],
      } satisfies SignalEffectivenessApiResponse,
      { status: 500 },
    );
  }
}
