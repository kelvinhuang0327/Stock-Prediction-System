import { promises as fs } from "node:fs";
import path from "node:path";

import {
  expandResolvedPredictions,
  readStrategyLabSnapshot,
  type StrategyLabResolvedPrediction,
} from "@/lib/research/strategyLabArtifacts";

const RETRAINING_DIR = path.join(process.cwd(), "outputs", "retraining");
const LATEST_PREDICTIONS_PATH = path.join(RETRAINING_DIR, "p193_latest_predictions.json");
const CSV_PATH = path.join(RETRAINING_DIR, "p194_twstock_ohlcv_export.csv");
const METRICS_PATH = path.join(RETRAINING_DIR, "p193_real_ohlcv_metrics.json");

type LatestPredictionsArtifact = {
  horizonTradingDays: number;
  recentResolved: StrategyLabResolvedPrediction[];
};

async function readArtifacts() {
  const [latestRaw, csvRaw, metricsRaw] = await Promise.all([
    fs.readFile(LATEST_PREDICTIONS_PATH, "utf8"),
    fs.readFile(CSV_PATH, "utf8"),
    fs.readFile(METRICS_PATH, "utf8"),
  ]);

  return {
    latest: JSON.parse(latestRaw) as LatestPredictionsArtifact,
    csvRaw,
    metrics: JSON.parse(metricsRaw) as Record<string, unknown>,
  };
}

describe("Strategy Lab artifact resolved expansion", () => {
  afterEach(() => jest.restoreAllMocks());

  it("derives expanded holdout rows and validates the committed 40-row sample", async () => {
    const { latest, csvRaw, metrics } = await readArtifacts();
    const expansion = expandResolvedPredictions(
      latest.recentResolved,
      csvRaw,
      metrics,
      latest.horizonTradingDays,
    );

    expect(expansion.validationStatus).toBe("expanded");
    expect(expansion.rows).toHaveLength(2280);
    expect(expansion.rows.length).toBeGreaterThan(latest.recentResolved.length);

    latest.recentResolved.forEach((committedRow, index) => {
      const expandedRow = expansion.rows[index];
      expect(expandedRow).toMatchObject({
        symbol: committedRow.symbol,
        featureDate: committedRow.featureDate,
        targetDate: committedRow.targetDate,
        predictedDirection: committedRow.predictedDirection,
        actualDirection: committedRow.actualDirection,
        correct: committedRow.correct,
      });
      expect(expandedRow.probabilityUp).toBeCloseTo(committedRow.probabilityUp ?? Number.NaN, 7);
      expect(expandedRow.forwardReturn).toBeCloseTo(committedRow.forwardReturn ?? Number.NaN, 8);
    });

    const symbols = [...new Set(expansion.rows.map((row) => row.symbol))].sort();
    const featureDates = expansion.rows.map((row) => row.featureDate).sort();
    const targetDates = expansion.rows.map((row) => row.targetDate).sort();
    expect(symbols).toEqual(["0050", "0056", "2317", "2330", "2454"]);
    expect(featureDates[0]).toBe("2024-07-19");
    expect(featureDates.at(-1)).toBe("2026-06-24");
    expect(targetDates[0]).toBe("2024-07-30");
    expect(targetDates.at(-1)).toBe("2026-07-01");
  });

  it("falls back to the committed sample when derived probabilities fail validation", async () => {
    const { latest, csvRaw, metrics } = await readArtifacts();
    const invalidMetrics = JSON.parse(JSON.stringify(metrics)) as Record<string, unknown>;
    const fit = invalidMetrics.fit as Record<string, unknown>;
    const coefficients = fit.standardizedCoefficients as Record<string, unknown>;
    coefficients.intercept = 9;

    const expansion = expandResolvedPredictions(
      latest.recentResolved,
      csvRaw,
      invalidMetrics,
      latest.horizonTradingDays,
    );

    expect(expansion.validationStatus).toBe("fallback");
    expect(expansion.rows).toEqual(latest.recentResolved);
    expect(expansion.reason).toContain("probability mismatch");
  });

  it("exposes the expanded resolved rows through the Strategy Lab snapshot", async () => {
    const snapshot = await readStrategyLabSnapshot();

    expect(snapshot.predictions.status).toBe("present");
    expect(snapshot.predictions.recentResolved.length).toBeGreaterThan(40);
    expect(snapshot.predictions.recentResolved).toHaveLength(2280);
    expect(snapshot.predictions.recentResolved[0]).toMatchObject({
      symbol: "0050",
      featureDate: "2026-06-24",
      targetDate: "2026-07-01",
    });
    expect(snapshot.predictions.resolvedSampleProvenance).toMatchObject({
      source: "reader-derived from tracked P194 CSV + P193 metrics metadata",
      validationStatus: "expanded",
      validationReason: "derived rows matched committed recentResolved sample",
      fallbackActive: false,
      committedResolvedPairs: 40,
      activeResolvedPairs: 2280,
      featureDateRange: { start: "2024-07-19", end: "2026-06-24" },
      targetDateRange: { start: "2024-07-30", end: "2026-07-01" },
    });
    expect(snapshot.predictions.caveat).not.toContain("Expanded resolved sample validation failed");
    expect(snapshot.safety).toMatchObject({
      canonicalDbRead: false,
      canonicalDbWrite: false,
      externalNetworkUsedForRead: false,
      investmentAdvice: false,
      tradingExecution: false,
    });
  });

  it("returns explicit missing-artifact states when no retraining files can be read", async () => {
    jest.spyOn(fs, "readFile").mockRejectedValue(new Error("artifact missing"));
    jest.spyOn(fs, "stat").mockRejectedValue(new Error("artifact missing"));

    const snapshot = await readStrategyLabSnapshot();

    expect(snapshot.artifactSetStatus).toBe("blocked");
    expect(snapshot.dataExport).toMatchObject({ status: "missing", manifestAvailable: false, sha256: null, rowCount: null });
    expect(snapshot.refit).toMatchObject({ status: "missing", decision: "missing", mtime: null, perSymbolHoldout: [] });
    expect(snapshot.predictions).toMatchObject({
      status: "missing",
      latestBySymbol: [],
      openPredictions: [],
      recentResolved: [],
      resolvedSampleProvenance: {
        validationStatus: "fallback",
        fallbackActive: true,
        featureDateRange: null,
        targetDateRange: null,
      },
    });
    expect(snapshot.runHistory).toMatchObject({ status: "missing", totalRuns: 0, entries: [] });
    expect(snapshot.protocolComparison).toMatchObject({ status: "missing", decision: "missing", variants: [], bestVariant: null });
    expect(snapshot.productStance).toMatchObject({ decision: "missing", label: "研究成果檔不完整" });
  });

  it("classifies refit metrics above baseline and tied with baseline", async () => {
    const mockMetrics = (accuracy: number, majorityBaselineAccuracy: number) => {
      jest.spyOn(fs, "readFile").mockImplementation((async (filePath: unknown) => {
        if (String(filePath) === METRICS_PATH) {
          return JSON.stringify({ accuracy, majorityBaselineAccuracy });
        }
        throw new Error("artifact missing");
      }) as never);
      jest.spyOn(fs, "stat").mockRejectedValue(new Error("artifact missing"));
    };

    mockMetrics(0.8, 0.7);
    const candidate = await readStrategyLabSnapshot();
    expect(candidate.refit).toMatchObject({ decision: "research_candidate", decisionLabel: "研究候選，需再驗證" });

    mockMetrics(0.7, 0.7);
    const tied = await readStrategyLabSnapshot();
    expect(tied.refit).toMatchObject({ decision: "needs_more_evidence", decisionLabel: "證據不足" });
  });

  it("normalizes incomplete prediction records and appends the fallback caveat once", async () => {
    const latest: Record<string, unknown> = {
      openPredictions: [
        null,
        { symbol: "", featureDate: "2026-01-01" },
        { symbol: "2330", featureDate: "2026-01-01", close: "bad", probabilityUp: 0.6, predictedDirection: "sideways", isLatest: "yes" },
        { symbol: "2317", featureDate: "2026-01-02", predictedDirection: "down", isLatest: true },
      ],
      recentResolved: [
        null,
        {},
        { symbol: "2330", featureDate: "2026-01-01", targetDate: "2026-01-02", probabilityUp: "bad", predictedDirection: "flat", actualDirection: "up", forwardReturn: null, correct: "yes" },
      ],
      horizonTradingDays: "unknown",
      modelBeatsBaseline: "yes",
    };
    jest.spyOn(fs, "readFile").mockImplementation((async (filePath: unknown) => {
      if (String(filePath) === LATEST_PREDICTIONS_PATH) return JSON.stringify(latest);
      throw new Error("artifact missing");
    }) as never);
    jest.spyOn(fs, "stat").mockRejectedValue(new Error("artifact missing"));

    const snapshot = await readStrategyLabSnapshot();

    expect(snapshot.predictions).toMatchObject({
      status: "present",
      runId: null,
      horizonTradingDays: null,
      modelBeatsBaseline: null,
      latestBySymbol: [{ symbol: "2317", predictedDirection: "down", isLatest: true }],
      openPredictions: [
        { symbol: "2330", close: null, probabilityUp: 0.6, predictedDirection: null, isLatest: false },
        { symbol: "2317", close: null, probabilityUp: null, predictedDirection: "down", isLatest: true },
      ],
      recentResolved: [
        { symbol: "2330", probabilityUp: null, predictedDirection: null, actualDirection: "up", forwardReturn: null, correct: false },
      ],
      resolvedSampleProvenance: {
        validationStatus: "fallback",
        fallbackActive: true,
        featureDateRange: { start: "2026-01-01", end: "2026-01-01" },
        targetDateRange: { start: "2026-01-02", end: "2026-01-02" },
      },
      caveat: expect.stringContaining("Expanded resolved sample validation failed"),
    });

    latest.caveat = "Research-only. Expanded resolved sample validation failed; showing committed recentResolved sample only.";
    const alreadyCaveated = await readStrategyLabSnapshot();
    expect(alreadyCaveated.predictions.caveat.match(/Expanded resolved sample validation failed/g)).toHaveLength(1);
  });

  it("falls back when expanded rows are not larger or do not match the committed sample", async () => {
    const { latest, csvRaw, metrics } = await readArtifacts();
    const expanded = expandResolvedPredictions(latest.recentResolved, csvRaw, metrics, latest.horizonTradingDays);
    expect(expanded.validationStatus).toBe("expanded");

    const equalSized = expandResolvedPredictions(expanded.rows, csvRaw, metrics, latest.horizonTradingDays);
    expect(equalSized).toMatchObject({ validationStatus: "fallback", reason: expect.stringContaining("not more than committed") });

    const wrongIdentity = latest.recentResolved.map((row, index) => index === 0 ? { ...row, symbol: "WRONG" } : row);
    expect(expandResolvedPredictions(wrongIdentity, csvRaw, metrics, latest.horizonTradingDays).reason).toContain("identity/direction mismatch");

    const missingProbability = latest.recentResolved.map((row, index) => index === 0 ? { ...row, probabilityUp: null } : row);
    expect(expandResolvedPredictions(missingProbability, csvRaw, metrics, latest.horizonTradingDays).reason).toContain("probability mismatch");

    const missingForwardReturn = latest.recentResolved.map((row, index) => index === 0 ? { ...row, forwardReturn: null } : row);
    expect(expandResolvedPredictions(missingForwardReturn, csvRaw, metrics, latest.horizonTradingDays).reason).toContain("forward return mismatch");

    expect(expandResolvedPredictions(latest.recentResolved, "symbol,date\n2330,2026-01-01", metrics, latest.horizonTradingDays))
      .toMatchObject({ validationStatus: "fallback", reason: "unable to derive expanded rows from tracked CSV/metrics artifacts" });
    expect(expandResolvedPredictions(latest.recentResolved, csvRaw, null, latest.horizonTradingDays).validationStatus).toBe("fallback");
    expect(expandResolvedPredictions(latest.recentResolved, csvRaw, metrics, 0).validationStatus).toBe("fallback");
  });

  it("rejects OHLCV rows with missing identity or non-finite price and volume fields", async () => {
    const { latest, metrics } = await readArtifacts();
    const header = "symbol,date,open,high,low,close,volume";
    const malformedRows = [
      ",2026-01-01,1,1,1,1,1",
      "2330,,1,1,1,1,1",
      "2330,2026-01-01,not-a-number,1,1,1,1",
      "2330,2026-01-01,1,not-a-number,1,1,1",
      "2330,2026-01-01,1,1,not-a-number,1,1",
      "2330,2026-01-01,1,1,1,not-a-number,1",
      "2330,2026-01-01,1,1,1,1,not-a-number",
    ];

    for (const row of malformedRows) {
      const expansion = expandResolvedPredictions(
        latest.recentResolved,
        `${header}\n${row}`,
        metrics,
        latest.horizonTradingDays,
      );
      expect(expansion).toMatchObject({
        validationStatus: "fallback",
        reason: "unable to derive expanded rows from tracked CSV/metrics artifacts",
      });
    }
  });
});
