import type {
  StrategyDecision,
  StrategyLabResolvedPrediction,
} from "@/lib/research/strategyLabArtifacts";

export const TAIWAN_ROUND_TRIP_COST = 0.00585;
export const STRATEGY_LAB_CONFIDENCE_THRESHOLDS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75] as const;
const MIN_VALID_PAIR_COUNT = 10;

export type StrategyLabSimulationStatus = "missing" | "insufficient" | "ready";

export interface StrategyLabSimulationPoint {
  featureDate: string;
  targetDate: string;
  strategyNetEquity: number;
  baselineNetEquity: number;
  strategyNetReturn: number;
  baselineNetReturn: number;
}

export interface StrategyLabSimulationStats {
  pairCount: number;
  validPairCount: number;
  cohortCount: number;
  tradeCount: number;
  hitRate: number | null;
  avgTradeReturnGross: number | null;
  cumulativeStrategyGross: number;
  cumulativeStrategyNet: number;
  cumulativeBaselineGross: number;
  cumulativeBaselineNet: number;
  maxDrawdownStrategyNet: number;
  maxDrawdownBaselineNet: number;
}

export interface StrategyLabThresholdSweepResult {
  threshold: number;
  tradeCount: number;
  validPairCount: number;
  cohortCount: number;
  strategyNetCumulativeReturn: number;
  baselineNetCumulativeReturn: number;
  deltaVsBaselineNet: number;
  hitRate: number | null;
  avgTradeReturnGross: number | null;
  maxDrawdownStrategyNet: number;
  verdict: StrategyDecision;
  equityCurve: StrategyLabSimulationPoint[];
}

export interface StrategyLabSimulation {
  status: StrategyLabSimulationStatus;
  verdict: StrategyDecision;
  verdictLabel: string;
  verdictReason: string;
  costPerRoundTrip: number;
  stats: StrategyLabSimulationStats;
  equityCurve: StrategyLabSimulationPoint[];
  thresholdSweep: StrategyLabThresholdSweepResult[];
  limitations: string[];
}

interface ValidPair extends StrategyLabResolvedPrediction {
  forwardReturn: number;
}

interface Cohort {
  featureDate: string;
  targetDate: string;
  pairs: ValidPair[];
}

interface SimulationRun {
  stats: StrategyLabSimulationStats;
  equityCurve: StrategyLabSimulationPoint[];
}

type StrategyPairSelector = (pair: ValidPair) => boolean;

function round(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

function emptyStats(pairCount: number, validPairCount: number): StrategyLabSimulationStats {
  return {
    pairCount,
    validPairCount,
    cohortCount: 0,
    tradeCount: 0,
    hitRate: null,
    avgTradeReturnGross: null,
    cumulativeStrategyGross: 0,
    cumulativeStrategyNet: 0,
    cumulativeBaselineGross: 0,
    cumulativeBaselineNet: 0,
    maxDrawdownStrategyNet: 0,
    maxDrawdownBaselineNet: 0,
  };
}

function limitationsFor(validPairCount: number): string[] {
  return [
    "Overlapping 5-trading-day forward-return windows are an approximation.",
    `Small sample warning: N=${validPairCount}.`,
    "Research-only simulation; not investment advice.",
  ];
}

function isValidPair(pair: StrategyLabResolvedPrediction): pair is ValidPair {
  return typeof pair.forwardReturn === "number" && Number.isFinite(pair.forwardReturn);
}

function buildCohorts(pairs: ValidPair[]): Cohort[] {
  const byFeatureDate = new Map<string, ValidPair[]>();
  for (const pair of pairs) {
    byFeatureDate.set(pair.featureDate, [...(byFeatureDate.get(pair.featureDate) ?? []), pair]);
  }

  return [...byFeatureDate.entries()]
    .map(([featureDate, cohortPairs]) => ({
      featureDate,
      targetDate: cohortPairs
        .map((pair) => pair.targetDate)
        .sort((left, right) => left.localeCompare(right))[0] ?? featureDate,
      pairs: cohortPairs,
    }))
    .sort((left, right) =>
      left.targetDate.localeCompare(right.targetDate) || left.featureDate.localeCompare(right.featureDate),
    );
}

function mean(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function maxDrawdown(equityValues: number[]): number {
  let peak = 1;
  let worst = 0;
  for (const equity of equityValues) {
    peak = Math.max(peak, equity);
    worst = Math.min(worst, equity / peak - 1);
  }
  return round(Math.abs(worst));
}

function tradeHit(pair: ValidPair): boolean {
  if (pair.actualDirection !== null) return pair.actualDirection === "up";
  return pair.forwardReturn > 0;
}

function verdictFromNetReturn(strategyNet: number, baselineNet: number): StrategyDecision {
  return strategyNet <= baselineNet ? "do_not_promote" : "research_candidate";
}

function thresholdVerdictFromRun(run: SimulationRun): StrategyDecision {
  if (run.stats.tradeCount === 0) return "needs_more_evidence";
  return verdictFromNetReturn(run.stats.cumulativeStrategyNet, run.stats.cumulativeBaselineNet);
}

function buildSimulationRun(
  pairCount: number,
  validPairs: ValidPair[],
  cohorts: Cohort[],
  selectsStrategyTrade: StrategyPairSelector,
): SimulationRun {
  const validPairCount = validPairs.length;
  const longTrades = validPairs.filter(selectsStrategyTrade);
  const tradeCount = longTrades.length;
  const hitRate = tradeCount > 0
    ? round(longTrades.filter(tradeHit).length / tradeCount)
    : null;
  const avgTradeReturnGross = tradeCount > 0
    ? round(mean(longTrades.map((pair) => pair.forwardReturn)))
    : null;

  let strategyGrossEquity = 1;
  let strategyNetEquity = 1;
  let baselineGrossEquity = 1;
  let baselineNetEquity = 1;
  const strategyNetEquities: number[] = [];
  const baselineNetEquities: number[] = [];
  const equityCurve: StrategyLabSimulationPoint[] = [];

  for (const cohort of cohorts) {
    const strategyGrossReturns = cohort.pairs.map((pair) =>
      selectsStrategyTrade(pair) ? pair.forwardReturn : 0,
    );
    const strategyNetReturns = cohort.pairs.map((pair) =>
      selectsStrategyTrade(pair) ? pair.forwardReturn - TAIWAN_ROUND_TRIP_COST : 0,
    );
    const baselineGrossReturns = cohort.pairs.map((pair) => pair.forwardReturn);
    const baselineNetReturns = cohort.pairs.map((pair) => pair.forwardReturn - TAIWAN_ROUND_TRIP_COST);

    strategyGrossEquity *= 1 + mean(strategyGrossReturns);
    strategyNetEquity *= 1 + mean(strategyNetReturns);
    baselineGrossEquity *= 1 + mean(baselineGrossReturns);
    baselineNetEquity *= 1 + mean(baselineNetReturns);
    strategyNetEquities.push(strategyNetEquity);
    baselineNetEquities.push(baselineNetEquity);
    equityCurve.push({
      featureDate: cohort.featureDate,
      targetDate: cohort.targetDate,
      strategyNetEquity: round(strategyNetEquity),
      baselineNetEquity: round(baselineNetEquity),
      strategyNetReturn: round(strategyNetEquity - 1),
      baselineNetReturn: round(baselineNetEquity - 1),
    });
  }

  return {
    stats: {
      pairCount,
      validPairCount,
      cohortCount: cohorts.length,
      tradeCount,
      hitRate,
      avgTradeReturnGross,
      cumulativeStrategyGross: round(strategyGrossEquity - 1),
      cumulativeStrategyNet: round(strategyNetEquity - 1),
      cumulativeBaselineGross: round(baselineGrossEquity - 1),
      cumulativeBaselineNet: round(baselineNetEquity - 1),
      maxDrawdownStrategyNet: maxDrawdown(strategyNetEquities),
      maxDrawdownBaselineNet: maxDrawdown(baselineNetEquities),
    },
    equityCurve,
  };
}

function buildThresholdSweep(
  pairCount: number,
  validPairs: ValidPair[],
  cohorts: Cohort[],
): StrategyLabThresholdSweepResult[] {
  return STRATEGY_LAB_CONFIDENCE_THRESHOLDS.map((threshold) => {
    const run = buildSimulationRun(
      pairCount,
      validPairs,
      cohorts,
      (pair) => pair.predictedDirection === "up"
        && pair.probabilityUp !== null
        && pair.probabilityUp >= threshold,
    );
    const strategyNetCumulativeReturn = run.stats.cumulativeStrategyNet;
    const baselineNetCumulativeReturn = run.stats.cumulativeBaselineNet;
    return {
      threshold,
      tradeCount: run.stats.tradeCount,
      validPairCount: run.stats.validPairCount,
      cohortCount: run.stats.cohortCount,
      strategyNetCumulativeReturn,
      baselineNetCumulativeReturn,
      deltaVsBaselineNet: round(strategyNetCumulativeReturn - baselineNetCumulativeReturn),
      hitRate: run.stats.hitRate,
      avgTradeReturnGross: run.stats.avgTradeReturnGross,
      maxDrawdownStrategyNet: run.stats.maxDrawdownStrategyNet,
      verdict: thresholdVerdictFromRun(run),
      equityCurve: run.equityCurve,
    };
  });
}

export function buildStrategySimulation(
  pairs: StrategyLabResolvedPrediction[] | null | undefined,
): StrategyLabSimulation {
  const pairCount = pairs?.length ?? 0;
  const validPairs = (pairs ?? []).filter(isValidPair);
  const validPairCount = validPairs.length;
  const limitations = limitationsFor(validPairCount);

  if (pairCount === 0) {
    return {
      status: "missing",
      verdict: "needs_more_evidence",
      verdictLabel: "證據不足",
      verdictReason: "找不到可回放的 resolved prediction/outcome pairs。",
      costPerRoundTrip: TAIWAN_ROUND_TRIP_COST,
      stats: emptyStats(pairCount, validPairCount),
      equityCurve: [],
      thresholdSweep: [],
      limitations,
    };
  }

  if (validPairCount < MIN_VALID_PAIR_COUNT) {
    return {
      status: "insufficient",
      verdict: "needs_more_evidence",
      verdictLabel: "證據不足",
      verdictReason: `有效 forwardReturn 樣本只有 ${validPairCount} 筆，低於 ${MIN_VALID_PAIR_COUNT} 筆門檻。`,
      costPerRoundTrip: TAIWAN_ROUND_TRIP_COST,
      stats: emptyStats(pairCount, validPairCount),
      equityCurve: [],
      thresholdSweep: [],
      limitations,
    };
  }

  const cohorts = buildCohorts(validPairs);
  const defaultRun = buildSimulationRun(
    pairCount,
    validPairs,
    cohorts,
    (pair) => pair.predictedDirection === "up",
  );
  const thresholdSweep = buildThresholdSweep(pairCount, validPairs, cohorts);
  const cumulativeStrategyNet = defaultRun.stats.cumulativeStrategyNet;
  const cumulativeBaselineNet = defaultRun.stats.cumulativeBaselineNet;
  const verdict = verdictFromNetReturn(cumulativeStrategyNet, cumulativeBaselineNet);

  return {
    status: "ready",
    verdict,
    verdictLabel: verdict === "do_not_promote" ? "暫不啟用策略" : "研究候選，需再驗證",
    verdictReason: verdict === "do_not_promote"
      ? "跟隨模型的成本後累積報酬未高於全部做多 baseline。"
      : "跟隨模型在這批 resolved pairs 的成本後累積報酬高於 baseline；仍只能視為研究候選。",
    costPerRoundTrip: TAIWAN_ROUND_TRIP_COST,
    stats: defaultRun.stats,
    equityCurve: defaultRun.equityCurve,
    thresholdSweep,
    limitations,
  };
}
