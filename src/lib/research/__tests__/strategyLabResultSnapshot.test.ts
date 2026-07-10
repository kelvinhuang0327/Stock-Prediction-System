import {
  STRATEGY_LAB_RESULT_NOT_AVAILABLE,
  STRATEGY_LAB_SNAPSHOT_DIAGNOSTIC_CAVEAT,
  buildStrategyLabResultSnapshot,
} from "@/lib/research/strategyLabResultSnapshot";
import type { StrategyLabSnapshot } from "@/lib/research/strategyLabArtifacts";

function makeSnapshot(overrides: Partial<StrategyLabSnapshot> = {}): StrategyLabSnapshot {
  const snapshot: StrategyLabSnapshot = {
    generatedAt: "2026-07-09T01:00:00.000Z",
    artifactSetStatus: "complete",
    dataExport: {
      status: "present",
      path: "outputs/retraining/p194_twstock_ohlcv_export.csv",
      manifestAvailable: true,
      sha256: "abc",
      rowCount: 100,
      symbols: ["2330", "2317"],
      dateRange: { start: "2024-01-01", end: "2026-07-01" },
      fetchedAtUtc: "2026-07-01T08:07:37Z",
      source: "twstock",
      mtime: "2026-07-01T08:07:37Z",
      pitSafety: "BOUNDED_PASS_WITH_SOURCE_LIMITATION",
      limitations: [],
    },
    refit: {
      status: "present",
      path: "outputs/retraining/p193_real_ohlcv_metrics.json",
      reportPath: "outputs/retraining/p193_real_ohlcv_refit_report.json",
      mtime: "2026-07-02T08:14:19.861Z",
      runId: "run-a",
      finalClassification: "NEGATIVE_HISTORICAL_EVIDENCE",
      decision: "do_not_promote",
      decisionLabel: "research only",
      decisionReason: "bounded historical result",
      trainSampleCount: 70,
      holdoutSampleCount: 30,
      purgedSampleCount: 5,
      featureCount: 5,
      targetDefinition: "5 day direction",
      validationBoundary: {
        trainFeaturePeriod: { start: "2024-01-01", end: "2025-01-01" },
      },
      metrics: {
        accuracy: 0.5,
        majorityBaselineAccuracy: 0.55,
        deltaVsMajorityBaseline: -0.05,
        precision: 0.51,
        recall: 0.52,
        brierScore: 0.24,
        logLoss: 0.69,
      },
      perSymbolHoldout: [],
      interpretation: "bounded result",
      limitations: [],
    },
    predictions: {
      status: "present",
      path: "outputs/retraining/p193_latest_predictions.json",
      mtime: "2026-07-02T08:14:19.861Z",
      runId: "run-a",
      dataEndDate: "2026-07-01",
      horizonTradingDays: 5,
      modelBeatsBaseline: false,
      latestBySymbol: [
        { symbol: "2330", featureDate: "2026-07-01", close: 100, probabilityUp: 0.6, predictedDirection: "up", isLatest: true },
        { symbol: "2317", featureDate: "2026-07-01", close: 80, probabilityUp: 0.4, predictedDirection: "down", isLatest: true },
      ],
      openPredictions: [
        { symbol: "2330", featureDate: "2026-07-01", close: 100, probabilityUp: 0.6, predictedDirection: "up", isLatest: true },
        { symbol: "2317", featureDate: "2026-07-01", close: 80, probabilityUp: 0.4, predictedDirection: "down", isLatest: true },
      ],
      recentResolved: [
        { symbol: "2330", featureDate: "2026-06-01", targetDate: "2026-06-08", probabilityUp: 0.6, predictedDirection: "up", actualDirection: "up", forwardReturn: 0.02, correct: true },
        { symbol: "2317", featureDate: "2026-06-01", targetDate: "2026-06-08", probabilityUp: 0.4, predictedDirection: "down", actualDirection: "up", forwardReturn: 0.01, correct: false },
        { symbol: "2330", featureDate: "2026-06-02", targetDate: "2026-06-09", probabilityUp: 0.7, predictedDirection: "up", actualDirection: "down", forwardReturn: -0.03, correct: false },
      ],
      resolvedSampleProvenance: {
        source: "reader-derived from tracked P194 CSV + P193 metrics metadata",
        validationStatus: "expanded",
        validationReason: "derived rows matched committed recentResolved sample",
        fallbackActive: false,
        committedResolvedPairs: 2,
        activeResolvedPairs: 3,
        featureDateRange: { start: "2026-06-01", end: "2026-06-02" },
        targetDateRange: { start: "2026-06-08", end: "2026-06-09" },
        caveat: "Research-only resolved artifact sample; not investment advice, not a trading signal.",
      },
      caveat: "Research pipeline output only.",
    },
    simulation: undefined,
    calibration: undefined,
    symbolReliability: undefined,
    runHistory: {
      status: "present",
      path: "outputs/retraining/strategy_lab_run_history.json",
      mtime: "2026-07-02T08:14:19.861Z",
      totalRuns: 1,
      entries: [{
        executedAt: "2026-07-02T08:14:19.861Z",
        runId: "run-a",
        rows: 100,
        dataEndDate: "2026-07-01",
        trainSampleCount: 70,
        holdoutSampleCount: 30,
        holdoutAccuracy: 0.5,
        majorityBaselineAccuracy: 0.55,
        deltaVsBaseline: -0.05,
        finalClassification: "NEGATIVE_HISTORICAL_EVIDENCE",
      }],
    },
    protocolComparison: {
      status: "present",
      path: "outputs/retraining/p195_protocol_comparison_metrics.json",
      mtime: "2026-07-02T08:14:19.861Z",
      finalClassification: "INCONCLUSIVE",
      decision: "needs_more_evidence",
      decisionLabel: "inconclusive",
      decisionReason: "bounded variants",
      variants: [],
      bestVariant: null,
      limitations: [],
    },
    productStance: {
      decision: "do_not_promote",
      label: "research only",
      reason: "diagnostic only",
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
  };

  return { ...snapshot, ...overrides };
}

describe("buildStrategyLabResultSnapshot", () => {
  it("builds the happy path artifact-backed summary", () => {
    const result = buildStrategyLabResultSnapshot(makeSnapshot());

    expect(result.title).toBe("Prediction & Retraining Snapshot");
    expect(result.prediction.status).toBe("available");
    expect(result.prediction.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "latest symbol count", value: 2 }),
        expect.objectContaining({ label: "latest model-direction counts", value: "up 1 / down 1 / NA 0" }),
      ]),
    );
    expect(result.resolvedValidation.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "resolved historical validation sample size", value: 3 }),
        expect.objectContaining({ label: "directional hit rate (historical validation evidence)", value: "1/3 (33.33%)" }),
      ]),
    );
    expect(result.researchReplay.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "by validation horizon", value: "5 trading days: 1/3 (33.33%)" }),
        expect.objectContaining({ label: "hypothetical frictionless resolved-sample observation — not a profitability claim" }),
      ]),
    );
  });

  it("uses explicit NOT_AVAILABLE states for missing artifacts", () => {
    const result = buildStrategyLabResultSnapshot(makeSnapshot({
      artifactSetStatus: "blocked",
      refit: { ...makeSnapshot().refit, status: "missing", runId: null },
      predictions: {
        ...makeSnapshot().predictions,
        status: "missing",
        runId: null,
        dataEndDate: null,
        latestBySymbol: [],
        openPredictions: [],
        recentResolved: [],
      },
    }));

    expect(result.prediction.status).toBe("not_available");
    expect(result.retraining.status).toBe("not_available");
    expect(result.resolvedValidation.status).toBe("not_available");
    expect(JSON.stringify(result)).toContain(STRATEGY_LAB_RESULT_NOT_AVAILABLE);
  });

  it("flags mixed-run artifact provenance", () => {
    const base = makeSnapshot();
    const result = buildStrategyLabResultSnapshot(makeSnapshot({
      refit: { ...base.refit, runId: "run-b" },
    }));

    expect(result.provenanceAndCaveats.mixedRun).toBe(true);
    expect(result.provenanceAndCaveats.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "mixed-run indicator", value: "MIXED_RUN" }),
      ]),
    );
  });

  it("discloses resolved-only coverage", () => {
    const result = buildStrategyLabResultSnapshot(makeSnapshot());

    expect(result.resolvedValidation.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "resolved coverage",
          value: "3/5 (60.00%)",
          note: "resolved / tracked rows currently available in the artifact-backed payload",
        }),
      ]),
    );
  });

  it("keeps required caveats present", () => {
    const result = buildStrategyLabResultSnapshot(makeSnapshot());

    expect(result.provenanceAndCaveats.caveats).toEqual(
      expect.arrayContaining([
        STRATEGY_LAB_SNAPSHOT_DIAGNOSTIC_CAVEAT,
        "artifact-backed research-only snapshot",
        "diagnostic-only",
        "no investment advice",
        "no trading signal",
        "not performance",
        "Validation and replay values are historical resolved-sample evidence, not prediction reliability or future performance.",
      ]),
    );
  });

  it("distinguishes coverage, artifact mtime, and recorded run time", () => {
    const result = buildStrategyLabResultSnapshot(makeSnapshot());

    expect(result.prediction.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "market data coverage end", value: "2026-07-01" }),
      ]),
    );
    expect(result.prediction.provenance).toMatchObject({
      artifactFileMtime: "2026-07-02T08:14:19.861Z",
      runRecordedAt: "2026-07-02T08:14:19.861Z",
      runId: "run-a",
    });
    expect(result.generatedAt).toBe("2026-07-09T01:00:00.000Z");
  });

  it("labels accuracy, baseline, replay, and returns as historical validation evidence", () => {
    const result = buildStrategyLabResultSnapshot(makeSnapshot());

    expect(result.retraining.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "holdout accuracy / majority baseline (historical validation evidence)" }),
      ]),
    );
    expect(result.resolvedValidation.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "average resolved forward return (historical validation observation)" }),
      ]),
    );
    expect(result.researchReplay.title).toBe("Research Replay (historical validation)");
  });

  it("does not mutate the input object", () => {
    const snapshot = makeSnapshot();
    const before = JSON.stringify(snapshot);

    buildStrategyLabResultSnapshot(snapshot);

    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("does not expose replay performance fields", () => {
    const result = buildStrategyLabResultSnapshot(makeSnapshot());
    const replayJson = JSON.stringify(result.researchReplay);

    expect(replayJson).not.toContain("equityCurve");
    expect(replayJson).not.toContain("compounding");
    expect(replayJson).not.toContain("annualizedReturn");
    expect(replayJson).not.toContain("sharpe");
    expect(replayJson).not.toContain("cumulativeStrategy");
  });
});
