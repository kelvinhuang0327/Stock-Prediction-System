import type {
  StrategyDecision,
  StrategyLabResolvedPrediction,
} from "@/lib/research/strategyLabArtifacts";

export const TAIWAN_ROUND_TRIP_COST = 0.00585;
export const STRATEGY_LAB_CONFIDENCE_THRESHOLDS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75] as const;
const MIN_VALID_PAIR_COUNT = 10;
const THRESHOLD_DRILLDOWN_PREVIEW_LIMIT = 10;

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

export interface StrategyLabThresholdDrilldownTrade {
  symbol: string;
  featureDate: string;
  targetDate: string;
  probabilityUp: number | null;
  predictedDirection: StrategyLabResolvedPrediction["predictedDirection"];
  actualDirection: StrategyLabResolvedPrediction["actualDirection"];
  forwardReturn: number;
  netReturnAfterCost: number;
  correct: boolean;
}

export interface StrategyLabThresholdDrilldownCandidate {
  threshold: number;
  tradeCount: number;
  validPairCount: number;
  cohortCount: number;
  strategyNetCumulativeReturn: number;
  baselineNetCumulativeReturn: number;
  deltaVsBaselineNet: number;
  maxDrawdownStrategyNet: number;
  smallSample: boolean;
  selectedTradesPreview: StrategyLabThresholdDrilldownTrade[];
  caveats: string[];
}

export interface StrategyLabThresholdSymbolContribution {
  symbol: string;
  tradeCount: number;
  tradeShare: number;
  winCount: number;
  hitRate: number;
  averageProbabilityUp: number;
  averageForwardReturnGross: number;
  averageNetReturnAfterCost: number;
  cumulativeNetContributionApprox: number;
  bestTradeForwardReturn: number;
  worstTradeForwardReturn: number;
}

export interface StrategyLabThresholdSymbolBreakdown {
  status: "candidate" | "no_candidate";
  dominantSymbol: string | null;
  dominantTradeShare: number | null;
  symbolCount: number;
  isConcentrated: boolean;
  rows: StrategyLabThresholdSymbolContribution[];
  caveats: string[];
  reason: string;
}

export interface StrategyLabThresholdCohortContribution {
  cohortKey: string;
  featureDate: string;
  targetDateRange: string;
  targetDates: string[];
  tradeCount: number;
  tradeShare: number;
  winCount: number;
  hitRate: number;
  averageProbabilityUp: number;
  averageForwardReturnGross: number;
  averageNetReturnAfterCost: number;
  cumulativeNetContributionApprox: number;
  bestTradeForwardReturn: number;
  worstTradeForwardReturn: number;
  symbols: string[];
}

export interface StrategyLabThresholdCohortBreakdown {
  status: "candidate" | "no_candidate";
  cohortCount: number;
  dominantCohortKey: string | null;
  dominantTradeShare: number | null;
  isTimeConcentrated: boolean;
  rows: StrategyLabThresholdCohortContribution[];
  caveats: string[];
  reason: string;
}

export interface StrategyLabThresholdDrilldown {
  status: "candidate" | "no_candidate";
  candidate: StrategyLabThresholdDrilldownCandidate | null;
  symbolBreakdown: StrategyLabThresholdSymbolBreakdown;
  cohortBreakdown: StrategyLabThresholdCohortBreakdown;
  reason: string;
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
  thresholdDrilldown: StrategyLabThresholdDrilldown;
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

function emptyThresholdDrilldown(reason: string): StrategyLabThresholdDrilldown {
  return {
    status: "no_candidate",
    candidate: null,
    symbolBreakdown: emptySymbolBreakdown(reason),
    cohortBreakdown: emptyCohortBreakdown(reason),
    reason,
  };
}

function thresholdDrilldownCaveats(smallSample: boolean): string[] {
  return [
    ...(smallSample
      ? ["Small sample: selected trade count is below 10; inspect only as a research sample."]
      : []),
    "Research-only drilldown; not investment advice.",
    "Selected trades are artifact replay rows, not trading instructions.",
  ];
}

function emptySymbolBreakdown(reason: string): StrategyLabThresholdSymbolBreakdown {
  return {
    status: "no_candidate",
    dominantSymbol: null,
    dominantTradeShare: null,
    symbolCount: 0,
    isConcentrated: false,
    rows: [],
    caveats: [
      "No candidate threshold selected; symbol contribution is empty.",
      "Research-only attribution; not investment advice.",
    ],
    reason,
  };
}

function emptyCohortBreakdown(reason: string): StrategyLabThresholdCohortBreakdown {
  return {
    status: "no_candidate",
    cohortCount: 0,
    dominantCohortKey: null,
    dominantTradeShare: null,
    isTimeConcentrated: false,
    rows: [],
    caveats: [
      "No candidate threshold selected; cohort contribution is empty.",
      "Research-only time attribution; not investment advice.",
    ],
    reason,
  };
}

function symbolBreakdownCaveats(tradeCount: number, isConcentrated: boolean): string[] {
  return [
    "Symbol contribution is sample attribution from selected artifact trades and is approximate.",
    ...(tradeCount < 10
      ? ["Small sample: selected trade count is below 10; concentration can dominate sample results."]
      : []),
    ...(isConcentrated
      ? ["Concentration warning: selected trades are dominated by one symbol or a single-symbol sample."]
      : []),
    "Research-only symbol breakdown; not investment advice.",
  ];
}

function cohortBreakdownCaveats(
  tradeCount: number,
  cohortCount: number,
  isTimeConcentrated: boolean,
): string[] {
  return [
    "Cohort contribution is sample attribution from selected artifact trades and is approximate.",
    ...(tradeCount < 10
      ? ["Small sample: selected trade count is below 10; date concentration can dominate sample results."]
      : []),
    ...(cohortCount <= 2
      ? ["Date concentration warning: selected trades occur in two or fewer featureDate cohorts."]
      : []),
    ...(isTimeConcentrated
      ? ["Concentration warning: selected trades are dominated by one featureDate cohort or a small number of cohorts."]
      : []),
    "Research-only cohort breakdown; not investment advice.",
  ];
}

function targetDateRange(targetDates: string[]): string {
  const first = targetDates[0] ?? "";
  const last = targetDates.at(-1) ?? first;
  return first === last ? first : `${first} -> ${last}`;
}

function buildSymbolBreakdown(
  selectedTrades: ValidPair[],
  reason: string,
): StrategyLabThresholdSymbolBreakdown {
  if (selectedTrades.length === 0) {
    return emptySymbolBreakdown(reason);
  }

  const bySymbol = new Map<string, ValidPair[]>();
  for (const trade of selectedTrades) {
    bySymbol.set(trade.symbol, [...(bySymbol.get(trade.symbol) ?? []), trade]);
  }

  const totalTradeCount = selectedTrades.length;
  const rows = [...bySymbol.entries()]
    .map(([symbol, trades]) => {
      const netReturns = trades.map((trade) => trade.forwardReturn - TAIWAN_ROUND_TRIP_COST);
      const forwardReturns = trades.map((trade) => trade.forwardReturn);
      const winCount = trades.filter(tradeHit).length;
      return {
        symbol,
        tradeCount: trades.length,
        tradeShare: round(trades.length / totalTradeCount),
        winCount,
        hitRate: round(winCount / trades.length),
        averageProbabilityUp: round(mean(trades.map((trade) => trade.probabilityUp ?? 0))),
        averageForwardReturnGross: round(mean(forwardReturns)),
        averageNetReturnAfterCost: round(mean(netReturns)),
        cumulativeNetContributionApprox: round(netReturns.reduce((total, value) => total + value, 0) / totalTradeCount),
        bestTradeForwardReturn: round(Math.max(...forwardReturns)),
        worstTradeForwardReturn: round(Math.min(...forwardReturns)),
      };
    })
    .sort((left, right) =>
      right.tradeCount - left.tradeCount
      || right.cumulativeNetContributionApprox - left.cumulativeNetContributionApprox
      || left.symbol.localeCompare(right.symbol),
    );

  const dominant = rows[0] ?? null;
  const dominantTradeShare = dominant?.tradeShare ?? null;
  const symbolCount = rows.length;
  const isConcentrated = (dominantTradeShare ?? 0) >= 0.5 || symbolCount === 1;

  return {
    status: "candidate",
    dominantSymbol: dominant?.symbol ?? null,
    dominantTradeShare,
    symbolCount,
    isConcentrated,
    rows,
    caveats: symbolBreakdownCaveats(totalTradeCount, isConcentrated),
    reason,
  };
}

function buildCohortBreakdown(
  selectedTrades: ValidPair[],
  reason: string,
): StrategyLabThresholdCohortBreakdown {
  if (selectedTrades.length === 0) {
    return emptyCohortBreakdown(reason);
  }

  const byFeatureDate = new Map<string, ValidPair[]>();
  for (const trade of selectedTrades) {
    byFeatureDate.set(trade.featureDate, [...(byFeatureDate.get(trade.featureDate) ?? []), trade]);
  }

  const totalTradeCount = selectedTrades.length;
  const rows = [...byFeatureDate.entries()]
    .map(([featureDate, trades]) => {
      const netReturns = trades.map((trade) => trade.forwardReturn - TAIWAN_ROUND_TRIP_COST);
      const forwardReturns = trades.map((trade) => trade.forwardReturn);
      const targetDates = [...new Set(trades.map((trade) => trade.targetDate))]
        .sort((left, right) => left.localeCompare(right));
      const symbols = [...new Set(trades.map((trade) => trade.symbol))]
        .sort((left, right) => left.localeCompare(right));
      const winCount = trades.filter(tradeHit).length;
      return {
        cohortKey: featureDate,
        featureDate,
        targetDateRange: targetDateRange(targetDates),
        targetDates,
        tradeCount: trades.length,
        tradeShare: round(trades.length / totalTradeCount),
        winCount,
        hitRate: round(winCount / trades.length),
        averageProbabilityUp: round(mean(trades.map((trade) => trade.probabilityUp ?? 0))),
        averageForwardReturnGross: round(mean(forwardReturns)),
        averageNetReturnAfterCost: round(mean(netReturns)),
        cumulativeNetContributionApprox: round(netReturns.reduce((total, value) => total + value, 0) / totalTradeCount),
        bestTradeForwardReturn: round(Math.max(...forwardReturns)),
        worstTradeForwardReturn: round(Math.min(...forwardReturns)),
        symbols,
      };
    })
    .sort((left, right) =>
      right.tradeCount - left.tradeCount
      || right.cumulativeNetContributionApprox - left.cumulativeNetContributionApprox
      || left.featureDate.localeCompare(right.featureDate)
      || left.targetDateRange.localeCompare(right.targetDateRange),
    );

  const dominant = rows[0] ?? null;
  const dominantTradeShare = dominant?.tradeShare ?? null;
  const cohortCount = rows.length;
  const isTimeConcentrated = (dominantTradeShare ?? 0) >= 0.5 || cohortCount <= 2;

  return {
    status: "candidate",
    cohortCount,
    dominantCohortKey: dominant?.cohortKey ?? null,
    dominantTradeShare,
    isTimeConcentrated,
    rows,
    caveats: cohortBreakdownCaveats(totalTradeCount, cohortCount, isTimeConcentrated),
    reason,
  };
}

function buildThresholdDrilldown(
  thresholdSweep: StrategyLabThresholdSweepResult[],
  validPairs: ValidPair[],
): StrategyLabThresholdDrilldown {
  const candidateRow = thresholdSweep
    .filter((row) => row.verdict === "research_candidate" && row.tradeCount > 0)
    .sort((left, right) =>
      right.deltaVsBaselineNet - left.deltaVsBaselineNet
      || right.strategyNetCumulativeReturn - left.strategyNetCumulativeReturn
      || left.threshold - right.threshold,
    )[0];

  if (!candidateRow) {
    return emptyThresholdDrilldown("No nonzero-trade research_candidate threshold is available in the current artifact sample.");
  }

  const selectedTrades = validPairs
    .filter((pair) =>
      pair.predictedDirection === "up"
      && pair.probabilityUp !== null
      && pair.probabilityUp >= candidateRow.threshold,
    );
  const selectedTradesPreview = selectedTrades
    .slice(0, THRESHOLD_DRILLDOWN_PREVIEW_LIMIT)
    .map((pair) => ({
      symbol: pair.symbol,
      featureDate: pair.featureDate,
      targetDate: pair.targetDate,
      probabilityUp: pair.probabilityUp,
      predictedDirection: pair.predictedDirection,
      actualDirection: pair.actualDirection,
      forwardReturn: pair.forwardReturn,
      netReturnAfterCost: round(pair.forwardReturn - TAIWAN_ROUND_TRIP_COST),
      correct: pair.correct,
    }));
  const smallSample = candidateRow.tradeCount < 10;

  return {
    status: "candidate",
    candidate: {
      threshold: candidateRow.threshold,
      tradeCount: candidateRow.tradeCount,
      validPairCount: candidateRow.validPairCount,
      cohortCount: candidateRow.cohortCount,
      strategyNetCumulativeReturn: candidateRow.strategyNetCumulativeReturn,
      baselineNetCumulativeReturn: candidateRow.baselineNetCumulativeReturn,
      deltaVsBaselineNet: candidateRow.deltaVsBaselineNet,
      maxDrawdownStrategyNet: candidateRow.maxDrawdownStrategyNet,
      smallSample,
      selectedTradesPreview,
      caveats: thresholdDrilldownCaveats(smallSample),
    },
    symbolBreakdown: buildSymbolBreakdown(
      selectedTrades,
      "Grouped selected artifact trades by symbol for sample attribution; contribution values are approximate.",
    ),
    cohortBreakdown: buildCohortBreakdown(
      selectedTrades,
      "Grouped selected artifact trades by featureDate cohort for sample time attribution; contribution values are approximate.",
    ),
    reason: "Selected highest deltaVsBaselineNet among nonzero-trade research_candidate threshold rows.",
  };
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
      thresholdDrilldown: emptyThresholdDrilldown("No resolved prediction/outcome pairs are available for threshold drilldown."),
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
      thresholdDrilldown: emptyThresholdDrilldown(
        `Only ${validPairCount} valid forwardReturn pairs are available; at least ${MIN_VALID_PAIR_COUNT} are required.`,
      ),
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
  const thresholdDrilldown = buildThresholdDrilldown(thresholdSweep, validPairs);
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
    thresholdDrilldown,
    limitations,
  };
}
