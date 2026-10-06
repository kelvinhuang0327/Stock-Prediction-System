import { buildAllSignalHistories } from '@/lib/signals/SignalHistoryBuilder';
import { evaluateAllSignals } from '@/lib/signals/SignalEffectivenessEngine';
import type {
  SignalEffectiveness,
  SignalEffectivenessBatchApiResponse,
  SignalEffectivenessBatchResult,
  SignalHistory,
  SignalType,
  SignalWindow,
} from '@/lib/signals/types';
import { ALL_SIGNAL_TYPES } from '@/lib/signals/types';

function filterHistoryBySymbol(history: SignalHistory, symbol: string): SignalHistory {
  const matchingObservations = history.observations.filter((observation) => observation.symbol === symbol);

  if (matchingObservations.length > 0) {
    return {
      ...history,
      observations: matchingObservations,
    };
  }

  return {
    ...history,
    observations: [],
    limitations: [...history.limitations, `symbol=${symbol} 無對應訊號觀察`],
  };
}

function toBatchResult(effectiveness: SignalEffectiveness): SignalEffectivenessBatchResult {
  return {
    signalType: effectiveness.signalType,
    sampleSize: effectiveness.sampleSize,
    hitRate: effectiveness.hitRate,
    avgReturn: effectiveness.avgReturn,
    excessReturn: effectiveness.excessReturn,
    stabilityScore: effectiveness.stabilityScore,
    classification: effectiveness.classification,
    limitations: effectiveness.limitations,
    effectiveness,
  };
}

function buildDegradedEffectiveness(
  signalType: SignalType,
  window: SignalWindow,
  limitation: string,
): SignalEffectiveness {
  return {
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
    limitations: [limitation],
  };
}

export function buildDegradedSignalEffectivenessBatch(
  window: SignalWindow,
  symbol: string | undefined,
  limitation: string,
): SignalEffectivenessBatchApiResponse {
  return {
    window,
    ...(symbol ? { symbol } : {}),
    results: ALL_SIGNAL_TYPES.map((signalType) =>
      toBatchResult(buildDegradedEffectiveness(signalType, window, limitation)),
    ),
    generatedAt: new Date().toISOString(),
    limitations: [limitation],
  };
}

export async function buildSignalEffectivenessBatch(params?: {
  symbol?: string;
  window?: SignalWindow;
  days?: number;
}): Promise<SignalEffectivenessBatchApiResponse> {
  const symbol = params?.symbol?.trim().toUpperCase() || undefined;
  const window = params?.window ?? 5;
  const days = params?.days ?? 180;

  const histories = await buildAllSignalHistories(days);
  const scopedHistories = symbol
    ? histories.map((history) => filterHistoryBySymbol(history, symbol))
    : histories;
  const effectivenessList = await evaluateAllSignals(scopedHistories, window);
  const effectivenessMap = new Map(
    effectivenessList.map((effectiveness) => [effectiveness.signalType, effectiveness]),
  );

  const results = ALL_SIGNAL_TYPES.map((signalType) =>
    toBatchResult(
      effectivenessMap.get(signalType) ??
        buildDegradedEffectiveness(signalType, window, '批次研究結果缺漏，已降級為 NOISE'),
    ),
  );

  return {
    window,
    ...(symbol ? { symbol } : {}),
    results,
    generatedAt: new Date().toISOString(),
    limitations: [...new Set(results.flatMap((result) => result.limitations))],
  };
}
