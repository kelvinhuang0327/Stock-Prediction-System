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
});
