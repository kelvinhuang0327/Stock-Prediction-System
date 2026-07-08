import { buildStrategyLabCalibration } from "@/lib/research/StrategyLabCalibrationEngine";
import { buildStrategyLabResearchBrief } from "@/lib/research/StrategyLabResearchBrief";
import { buildStrategySimulation } from "@/lib/research/StrategyLabSimulationEngine";
import { buildStrategyLabSymbolReliability } from "@/lib/research/StrategyLabSymbolReliabilityEngine";
import type {
  StrategyLabResolvedPrediction,
  StrategyLabSnapshot,
} from "@/lib/research/strategyLabArtifacts";

function pair(
  index: number,
  overrides: Partial<StrategyLabResolvedPrediction>,
): StrategyLabResolvedPrediction {
  const actualDirection = "actualDirection" in overrides ? overrides.actualDirection ?? null : "up";
  const predictedDirection = "predictedDirection" in overrides ? overrides.predictedDirection ?? null : "up";
  return {
    symbol: overrides.symbol ?? (index % 2 === 0 ? "0050" : "2317"),
    featureDate: overrides.featureDate ?? `2026-06-${String((index % 10) + 1).padStart(2, "0")}`,
    targetDate: overrides.targetDate ?? `2026-06-${String((index % 10) + 8).padStart(2, "0")}`,
    probabilityUp: "probabilityUp" in overrides ? overrides.probabilityUp ?? null : 0.6,
    predictedDirection,
    actualDirection,
    forwardReturn: "forwardReturn" in overrides
      ? overrides.forwardReturn ?? null
      : actualDirection === "up"
        ? 0.02
        : -0.02,
    correct: overrides.correct ?? actualDirection === predictedDirection,
  };
}

function resolvedPairs(): StrategyLabResolvedPrediction[] {
  return Array.from({ length: 20 }, (_, index) =>
    pair(index, {
      probabilityUp: index < 10 ? 0.6 : 0.75,
      actualDirection: index % 4 === 0 ? "down" : "up",
      predictedDirection: "up",
      symbol: index < 12 ? "0050" : "2317",
    }),
  );
}

function snapshot(overrides: Partial<StrategyLabSnapshot> = {}): StrategyLabSnapshot {
  const pairs = resolvedPairs();
  const simulation = buildStrategySimulation(pairs);
  const calibration = buildStrategyLabCalibration(pairs);
  const symbolReliability = buildStrategyLabSymbolReliability(pairs, [
    {
      symbol: "0050",
      featureDate: "2026-06-30",
      close: 150,
      probabilityUp: 0.63,
      predictedDirection: "up",
      isLatest: true,
    },
  ]);

  return {
    generatedAt: "2026-07-08T00:00:00.000Z",
    artifactSetStatus: "complete",
    dataExport: {
      status: "present",
      path: "outputs/retraining/p194_twstock_ohlcv_export.csv",
      manifestAvailable: true,
      sha256: "abc123",
      rowCount: 100,
      symbols: ["0050", "2317"],
      dateRange: { start: "2026-06-01", end: "2026-06-30" },
      fetchedAtUtc: "2026-07-01T00:00:00.000Z",
      source: "fixture",
      mtime: "2026-07-01T00:00:00.000Z",
      pitSafety: "artifact-only",
      limitations: [],
    },
    refit: {
      status: "present",
      path: "outputs/retraining/p193_real_ohlcv_metrics.json",
      reportPath: "outputs/retraining/p193_real_ohlcv_refit_report.json",
      mtime: "2026-07-01T00:00:00.000Z",
      runId: "fixture-run",
      finalClassification: "research_only",
      decision: "do_not_promote",
      decisionLabel: "暫不推廣",
      decisionReason: "Fixture keeps the product stance conservative.",
      trainSampleCount: 80,
      holdoutSampleCount: 20,
      purgedSampleCount: 0,
      featureCount: 5,
      targetDefinition: "5 trading day forward return",
      validationBoundary: null,
      metrics: {
        accuracy: 0.55,
        majorityBaselineAccuracy: 0.5,
        deltaVsMajorityBaseline: 0.05,
        precision: 0.56,
        recall: 0.57,
        brierScore: 0.24,
        logLoss: 0.68,
      },
      perSymbolHoldout: [],
      interpretation: null,
      limitations: [],
    },
    predictions: {
      status: "present",
      path: "outputs/retraining/p193_latest_predictions.json",
      mtime: "2026-07-01T00:00:00.000Z",
      runId: "fixture-run",
      dataEndDate: "2026-06-30",
      horizonTradingDays: 5,
      modelBeatsBaseline: false,
      latestBySymbol: [],
      openPredictions: [],
      recentResolved: pairs,
      caveat: "Research only.",
    },
    simulation,
    calibration,
    symbolReliability,
    runHistory: {
      status: "missing",
      path: "outputs/retraining/strategy_lab_run_history.json",
      mtime: null,
      totalRuns: 0,
      entries: [],
    },
    protocolComparison: {
      status: "missing",
      path: "outputs/retraining/p195_protocol_comparison_metrics.json",
      mtime: null,
      finalClassification: null,
      decision: "missing",
      decisionLabel: "missing",
      decisionReason: "missing",
      variants: [],
      bestVariant: null,
      limitations: [],
    },
    productStance: {
      decision: "do_not_promote",
      label: "暫不推廣",
      reason: "Research-only fixture verdict; do not promote from this artifact sample.",
    },
    safety: {
      canonicalDbRead: false,
      canonicalDbWrite: false,
      externalNetworkUsedForRead: false,
      investmentAdvice: false,
      tradingExecution: false,
    },
    artifactCompleteness: [],
    availableActions: {
      rerunRefit: false,
      rerunProtocolComparison: false,
    },
    ...overrides,
  };
}

describe("buildStrategyLabResearchBrief", () => {
  it("builds deterministic conservative Markdown from the current artifact snapshot", () => {
    const currentSnapshot = snapshot();
    const brief = buildStrategyLabResearchBrief(currentSnapshot);

    expect(buildStrategyLabResearchBrief(currentSnapshot)).toBe(brief);
    expect(brief).toContain("# Strategy Lab Research Brief");
    expect(brief).toContain("Generated from current resolved artifact.");
    expect(brief).toContain("暫不推廣 / research only");
    expect(brief).toContain("resolved pairs 20/20");
    expect(brief).toMatch(/Simulation: .*\((research_candidate|needs_more_evidence|do_not_promote)\)/);
    expect(brief).toContain("Calibration:");
    expect(brief).toContain("Valid pairs 20; Brier");
    expect(brief).toContain("ECE");
    expect(brief).toContain("max gap");
    expect(brief).toContain("Per-symbol reliability: 2 symbol rows");
    expect(brief).toContain("Worst calibration-gap diagnostic:");
    expect(brief).toContain("Highest hit-rate diagnostic:");
  });

  it("keeps explicit research-only caveats and avoids action wording", () => {
    const brief = buildStrategyLabResearchBrief(snapshot());

    expect(brief).toContain("Not investment advice.");
    expect(brief).toContain("Not a trading signal or action guidance.");
    expect(brief).toContain("Does not claim future predictive ability.");
    expect(brief).toContain("Describes only the current resolved artifact sample.");
    expect(brief).toContain("descriptive artifact diagnostics only, not action guidance.");
    expect(brief).not.toMatch(/\b(buy|sell|recommend|recommendation|recommended)\b/i);
  });

  it("handles missing optional sections without throwing", () => {
    const missingOptionalSnapshot = snapshot({
      simulation: undefined,
      calibration: undefined,
      symbolReliability: undefined,
      predictions: {
        ...snapshot().predictions,
        dataEndDate: null,
        recentResolved: [],
      },
    });

    expect(() => buildStrategyLabResearchBrief(missingOptionalSnapshot)).not.toThrow();
    const brief = buildStrategyLabResearchBrief(missingOptionalSnapshot);
    expect(brief).toContain("resolved pairs 0/0");
    expect(brief).toContain("Simulation: missing");
    expect(brief).toContain("Calibration: missing");
    expect(brief).toContain("Per-symbol reliability: no symbol rows");
  });
});
