import type {
  PredictedDirection,
  StrategyLabOpenPrediction,
  StrategyLabResolvedPrediction,
} from "@/lib/research/strategyLabArtifacts";

const MIN_SYMBOL_COUNT = 2;
export const STRATEGY_LAB_SYMBOL_RELIABILITY_MIN_PAIR_COUNT = 3;
const POOR_CALIBRATION_GAP = 0.25;

export interface StrategyLabCandidateSelectedCount {
  symbol: string;
  tradeCount: number;
}

export interface StrategyLabSymbolReliabilityWarningFlags {
  lowSample: boolean;
  poorCalibration: boolean;
  negativeAvgReturn: boolean;
}

export interface StrategyLabSymbolReliabilityRow {
  symbol: string;
  resolvedPairCount: number;
  latestPredictedDirection: PredictedDirection | null;
  latestProbabilityUp: number | null;
  correctRate: number | null;
  actualUpRate: number | null;
  meanProbabilityUp: number | null;
  calibrationGap: number | null;
  avgForwardReturn: number | null;
  avgForwardReturnWhenPredictedUp: number | null;
  predictedUpCount: number;
  candidateSelectedCount: number | null;
  warnings: StrategyLabSymbolReliabilityWarningFlags;
}

export interface StrategyLabSymbolReliabilityStatus {
  enoughSymbols: boolean;
  minPairCount: number;
  worstCalibrationSymbol: string | null;
  bestHitRateSymbol: string | null;
  caveats: string[];
}

export interface StrategyLabSymbolReliability {
  rows: StrategyLabSymbolReliabilityRow[];
  status: StrategyLabSymbolReliabilityStatus;
}

interface ResolvedStats {
  pairs: StrategyLabResolvedPrediction[];
  actualUpValues: number[];
  probabilityValues: number[];
  forwardReturns: number[];
  predictedUpForwardReturns: number[];
}

function round(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

function mean(values: number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function actualUpFromPair(pair: StrategyLabResolvedPrediction): boolean | null {
  if (pair.actualDirection === "up") return true;
  if (pair.actualDirection === "down") return false;
  if (pair.predictedDirection === "up") return pair.correct;
  if (pair.predictedDirection === "down") return !pair.correct;
  return null;
}

function finiteNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function latestBySymbol(latestPredictions: StrategyLabOpenPrediction[] | null | undefined) {
  const bySymbol = new Map<string, StrategyLabOpenPrediction>();
  for (const prediction of latestPredictions ?? []) {
    if (!bySymbol.has(prediction.symbol)) {
      bySymbol.set(prediction.symbol, prediction);
    }
  }
  return bySymbol;
}

function candidateCountsBySymbol(candidateSelectedCounts: StrategyLabCandidateSelectedCount[] | null | undefined) {
  const bySymbol = new Map<string, number>();
  for (const item of candidateSelectedCounts ?? []) {
    bySymbol.set(item.symbol, (bySymbol.get(item.symbol) ?? 0) + item.tradeCount);
  }
  return bySymbol;
}

function buildStats(pairs: StrategyLabResolvedPrediction[]): ResolvedStats {
  return {
    pairs,
    actualUpValues: pairs.flatMap((pair) => {
      const actualUp = actualUpFromPair(pair);
      return actualUp === null ? [] : [actualUp ? 1 : 0];
    }),
    probabilityValues: pairs.flatMap((pair) => finiteNumber(pair.probabilityUp) ? [pair.probabilityUp] : []),
    forwardReturns: pairs.flatMap((pair) => finiteNumber(pair.forwardReturn) ? [pair.forwardReturn] : []),
    predictedUpForwardReturns: pairs.flatMap((pair) =>
      pair.predictedDirection === "up" && finiteNumber(pair.forwardReturn) ? [pair.forwardReturn] : [],
    ),
  };
}

function warningFlags(
  resolvedPairCount: number,
  calibrationGap: number | null,
  avgForwardReturn: number | null,
): StrategyLabSymbolReliabilityWarningFlags {
  return {
    lowSample: resolvedPairCount < STRATEGY_LAB_SYMBOL_RELIABILITY_MIN_PAIR_COUNT,
    poorCalibration: calibrationGap !== null && Math.abs(calibrationGap) >= POOR_CALIBRATION_GAP,
    negativeAvgReturn: avgForwardReturn !== null && avgForwardReturn < 0,
  };
}

function symbolNames(
  pairs: StrategyLabResolvedPrediction[] | null | undefined,
  latestPredictions: StrategyLabOpenPrediction[] | null | undefined,
): string[] {
  return [...new Set([
    ...(pairs ?? []).map((pair) => pair.symbol),
    ...(latestPredictions ?? []).map((prediction) => prediction.symbol),
  ])].sort((left, right) => left.localeCompare(right));
}

function caveats(rows: StrategyLabSymbolReliabilityRow[]): string[] {
  return [
    "Each symbol row uses only the current resolved prediction artifact and latest prediction artifact.",
    ...(rows.some((row) => row.warnings.lowSample)
      ? [`At least one symbol has fewer than ${STRATEGY_LAB_SYMBOL_RELIABILITY_MIN_PAIR_COUNT} resolved pairs.`]
      : []),
    "Candidate selected counts are descriptive artifact counts when a candidate threshold exists.",
    "Research-only reliability summary; not investment advice, not a trading signal, and not evidence of future predictive ability.",
  ];
}

export function buildStrategyLabSymbolReliability(
  pairs: StrategyLabResolvedPrediction[] | null | undefined,
  latestPredictions: StrategyLabOpenPrediction[] | null | undefined,
  candidateSelectedCounts?: StrategyLabCandidateSelectedCount[] | null,
): StrategyLabSymbolReliability {
  const latest = latestBySymbol(latestPredictions);
  const selectedCounts = candidateCountsBySymbol(candidateSelectedCounts);

  const rows = symbolNames(pairs, latestPredictions).map((symbol) => {
    const stats = buildStats((pairs ?? []).filter((pair) => pair.symbol === symbol));
    const latestPrediction = latest.get(symbol);
    const correctRate = mean(stats.pairs.map((pair) => pair.correct ? 1 : 0));
    const actualUpRate = mean(stats.actualUpValues);
    const meanProbabilityUp = mean(stats.probabilityValues);
    const avgForwardReturn = mean(stats.forwardReturns);
    const avgForwardReturnWhenPredictedUp = mean(stats.predictedUpForwardReturns);
    const calibrationGap = actualUpRate !== null && meanProbabilityUp !== null
      ? round(actualUpRate - meanProbabilityUp)
      : null;

    return {
      symbol,
      resolvedPairCount: stats.pairs.length,
      latestPredictedDirection: latestPrediction?.predictedDirection ?? null,
      latestProbabilityUp: latestPrediction?.probabilityUp ?? null,
      correctRate: correctRate === null ? null : round(correctRate),
      actualUpRate: actualUpRate === null ? null : round(actualUpRate),
      meanProbabilityUp: meanProbabilityUp === null ? null : round(meanProbabilityUp),
      calibrationGap,
      avgForwardReturn: avgForwardReturn === null ? null : round(avgForwardReturn),
      avgForwardReturnWhenPredictedUp: avgForwardReturnWhenPredictedUp === null
        ? null
        : round(avgForwardReturnWhenPredictedUp),
      predictedUpCount: stats.pairs.filter((pair) => pair.predictedDirection === "up").length,
      candidateSelectedCount: selectedCounts.get(symbol) ?? null,
      warnings: warningFlags(stats.pairs.length, calibrationGap, avgForwardReturn),
    };
  }).sort((left, right) =>
    right.resolvedPairCount - left.resolvedPairCount || left.symbol.localeCompare(right.symbol),
  );

  const supportedSymbolCount = rows.filter(
    (row) => row.resolvedPairCount >= STRATEGY_LAB_SYMBOL_RELIABILITY_MIN_PAIR_COUNT,
  ).length;
  const rowsWithCalibration = rows.filter((row) => row.calibrationGap !== null);
  const worstCalibrationSymbol = [...rowsWithCalibration].sort((left, right) =>
    Math.abs(right.calibrationGap ?? 0) - Math.abs(left.calibrationGap ?? 0)
    || left.symbol.localeCompare(right.symbol),
  )[0]?.symbol ?? null;
  const rowsWithHitRate = rows.filter((row) => row.correctRate !== null);
  const bestHitRateSymbol = [...rowsWithHitRate].sort((left, right) =>
    (right.correctRate ?? 0) - (left.correctRate ?? 0)
    || right.resolvedPairCount - left.resolvedPairCount
    || left.symbol.localeCompare(right.symbol),
  )[0]?.symbol ?? null;

  return {
    rows,
    status: {
      enoughSymbols: supportedSymbolCount >= MIN_SYMBOL_COUNT,
      minPairCount: STRATEGY_LAB_SYMBOL_RELIABILITY_MIN_PAIR_COUNT,
      worstCalibrationSymbol,
      bestHitRateSymbol,
      caveats: caveats(rows),
    },
  };
}
