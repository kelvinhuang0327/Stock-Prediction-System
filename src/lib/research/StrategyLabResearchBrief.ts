import type { StrategyLabSnapshot, StrategyDecision } from "@/lib/research/strategyLabArtifacts";
import type { StrategyLabCalibration } from "@/lib/research/StrategyLabCalibrationEngine";
import type { StrategyLabSimulation } from "@/lib/research/StrategyLabSimulationEngine";
import type { StrategyLabSymbolReliability } from "@/lib/research/StrategyLabSymbolReliabilityEngine";

function formatPct(value: number | null): string {
  return value === null ? "N/A" : `${(value * 100).toFixed(2)}%`;
}

function formatSignedPct(value: number | null): string {
  if (value === null) return "N/A";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${(value * 100).toFixed(2)}%`;
}

function productVerdictLabel(decision: StrategyDecision): string {
  if (decision === "do_not_promote") return "暫不推廣";
  if (decision === "research_candidate") return "研究候選，需再驗證";
  if (decision === "needs_more_evidence") return "研究觀察中";
  return "artifact 不完整";
}

function describeSimulationForBrief(simulation?: StrategyLabSimulation): string {
  if (!simulation || simulation.status === "missing") {
    return "Simulation: missing; no resolved prediction/outcome pairs are available.";
  }
  if (simulation.status === "insufficient") {
    return `Simulation: insufficient evidence; ${simulation.verdictReason}`;
  }
  return [
    `Simulation: ${simulation.verdictLabel} (${simulation.verdict}).`,
    `Follow-model net return ${formatSignedPct(simulation.stats.cumulativeStrategyNet)} vs baseline net return ${formatSignedPct(simulation.stats.cumulativeBaselineNet)}.`,
    `Valid pairs ${simulation.stats.validPairCount}; strategy trades ${simulation.stats.tradeCount}; hit rate ${formatPct(simulation.stats.hitRate)}.`,
  ].join(" ");
}

function describeThresholdForBrief(simulation?: StrategyLabSimulation): string {
  const drilldown = simulation?.thresholdDrilldown;
  const candidate = drilldown?.candidate;
  if (!candidate) {
    return `Candidate threshold: none selected; ${drilldown?.reason ?? "no threshold drilldown is available."}`;
  }
  return [
    `Candidate threshold: probabilityUp >= ${formatPct(candidate.threshold)} with ${candidate.tradeCount} selected artifact trades.`,
    `Delta vs baseline net ${formatSignedPct(candidate.deltaVsBaselineNet)}.`,
    candidate.smallSample ? "Small-sample flag is active." : "Small-sample flag is not active for the selected trade count.",
  ].join(" ");
}

function describeConcentrationForBrief(simulation?: StrategyLabSimulation): string[] {
  const symbolBreakdown = simulation?.thresholdDrilldown.symbolBreakdown;
  const cohortBreakdown = simulation?.thresholdDrilldown.cohortBreakdown;
  const symbolLine = !symbolBreakdown || symbolBreakdown.status === "no_candidate"
    ? `Symbol concentration: not available; ${symbolBreakdown?.reason ?? "no candidate threshold."}`
    : symbolBreakdown.isConcentrated
      ? `Symbol concentration: concentrated in ${symbolBreakdown.dominantSymbol ?? "one symbol"} (${formatPct(symbolBreakdown.dominantTradeShare)} selected-trade share across ${symbolBreakdown.symbolCount} symbols).`
      : `Symbol concentration: not dominated by a single symbol (${symbolBreakdown.symbolCount} symbols).`;
  const cohortLine = !cohortBreakdown || cohortBreakdown.status === "no_candidate"
    ? `Cohort/date concentration: not available; ${cohortBreakdown?.reason ?? "no candidate threshold."}`
    : cohortBreakdown.isTimeConcentrated
      ? `Cohort/date concentration: concentrated in ${cohortBreakdown.dominantCohortKey ?? "a small number of cohorts"} (${formatPct(cohortBreakdown.dominantTradeShare)} selected-trade share across ${cohortBreakdown.cohortCount} cohorts).`
      : `Cohort/date concentration: not dominated by a single cohort (${cohortBreakdown.cohortCount} cohorts).`;
  return [symbolLine, cohortLine];
}

function describeCalibrationForBrief(calibration?: StrategyLabCalibration): string {
  if (!calibration || calibration.status === "missing") {
    return "Calibration: missing; no resolved prediction/outcome pairs are available for calibration.";
  }
  return [
    `Calibration: ${calibration.verdictLabel} (${calibration.verdict}).`,
    `Valid pairs ${calibration.validPairCount}; Brier ${calibration.brierScore?.toFixed(4) ?? "N/A"}; ECE ${formatPct(calibration.expectedCalibrationErrorApprox)}; max gap ${formatPct(calibration.maxCalibrationGap)}.`,
    calibration.verdictReason,
  ].join(" ");
}

function describeSymbolReliabilityForBrief(reliability?: StrategyLabSymbolReliability): string[] {
  const rows = reliability?.rows ?? [];
  if (rows.length === 0) {
    return ["Per-symbol reliability: no symbol rows are available in the current artifact sample."];
  }
  const worstCalibrationRow = rows.find((row) => row.symbol === reliability?.status.worstCalibrationSymbol);
  const bestHitRateRow = rows.find((row) => row.symbol === reliability?.status.bestHitRateSymbol);
  return [
    `Per-symbol reliability: ${rows.length} symbol rows; enough-symbols flag ${reliability?.status.enoughSymbols ? "true" : "false"}.`,
    worstCalibrationRow
      ? `Worst calibration-gap diagnostic: ${worstCalibrationRow.symbol}, gap ${formatSignedPct(worstCalibrationRow.calibrationGap)}, resolved N=${worstCalibrationRow.resolvedPairCount}.`
      : "Worst calibration-gap diagnostic: N/A.",
    bestHitRateRow
      ? `Highest hit-rate diagnostic: ${bestHitRateRow.symbol}, hit rate ${formatPct(bestHitRateRow.correctRate)}, resolved N=${bestHitRateRow.resolvedPairCount}.`
      : "Highest hit-rate diagnostic: N/A.",
  ];
}

export function buildStrategyLabResearchBrief(snapshot: StrategyLabSnapshot): string {
  const resolvedPairCount = snapshot.simulation?.stats.pairCount
    ?? snapshot.calibration?.pairCount
    ?? snapshot.predictions.recentResolved.length;
  const validPairCount = snapshot.simulation?.stats.validPairCount
    ?? snapshot.calibration?.validPairCount
    ?? snapshot.predictions.recentResolved.filter((pair) => pair.forwardReturn !== null).length;
  const evidenceBullets = [
    `Overall verdict: ${productVerdictLabel(snapshot.productStance.decision)} / research only. ${snapshot.productStance.reason}`,
    `Artifact scope: generatedAt ${snapshot.generatedAt}; artifact status ${snapshot.artifactSetStatus}; data end ${snapshot.predictions.dataEndDate ?? "N/A"}; resolved pairs ${validPairCount}/${resolvedPairCount}.`,
    describeSimulationForBrief(snapshot.simulation),
    describeThresholdForBrief(snapshot.simulation),
    ...describeConcentrationForBrief(snapshot.simulation),
    describeCalibrationForBrief(snapshot.calibration),
    ...describeSymbolReliabilityForBrief(snapshot.symbolReliability),
  ];

  return [
    "# Strategy Lab Research Brief",
    "",
    "Generated from current resolved artifact.",
    "",
    "## Overall Verdict",
    "",
    `${productVerdictLabel(snapshot.productStance.decision)} / research only`,
    "",
    "## Key Evidence",
    "",
    ...evidenceBullets.map((line) => `- ${line}`),
    "",
    "## Caveats",
    "",
    "- Not investment advice.",
    "- Not a trading signal or action guidance.",
    "- Does not claim future predictive ability.",
    "- Describes only the current resolved artifact sample.",
    "- Sample size is small; concentration and calibration caveats remain visible.",
    "- Symbol diagnostics such as 0050 or 2317, when present, are descriptive artifact diagnostics only, not action guidance.",
  ].join("\n");
}
