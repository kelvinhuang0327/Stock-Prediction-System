import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  P193_EXPECTED,
  REAL_OHLCV_FEATURE_NAMES,
  buildHistoricalFeatureRows,
  fitTrainingLogisticRegression,
  fitTrainingScaler,
  parseRealOhlcvCsv,
  runReproducibleRefitCheck,
  scanPriceDiscontinuities,
  splitChronologically,
  type RealOhlcvRow,
  type RefitCheckResult,
} from "../RealOhlcvRefit";

jest.setTimeout(240_000);

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, "outputs/retraining/p194_twstock_ohlcv_export.csv");
const METRICS_PATH = path.join(ROOT, "outputs/retraining/p193_real_ohlcv_metrics.json");
const OUTPUT_PATHS = [
  "outputs/retraining/p193_latest_predictions.json",
  "outputs/retraining/p193_real_ohlcv_metrics.json",
  "outputs/retraining/p193_real_ohlcv_refit_report.json",
  "outputs/retraining/p194_twstock_ohlcv_export.csv",
  "outputs/retraining/p194_twstock_ohlcv_export_manifest.json",
  "outputs/retraining/p195_protocol_comparison_metrics.json",
  "outputs/retraining/strategy_lab_run_history.json",
];

function isoDate(start: string, offset: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function syntheticRows(count = 45): RealOhlcvRow[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index;
    return {
      symbol: "0050",
      date: isoDate("2024-01-01", index),
      open: close - 0.25,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1_000 + index * 10,
      source: "twstock/twse",
      fetchedAtUtc: "2026-07-01T00:00:00Z",
    };
  });
}

function toCsv(rows: readonly RealOhlcvRow[]): string {
  const header = "symbol,date,open,high,low,close,volume,source,fetched_at_utc";
  const body = rows.map((row) => [
    row.symbol,
    row.date,
    row.open,
    row.high,
    row.low,
    row.close,
    row.volume,
    row.source,
    row.fetchedAtUtc,
  ].join(","));
  return `${header}\n${body.join("\n")}\n`;
}

function fileHashes(paths: readonly string[]): Record<string, string> {
  return Object.fromEntries(paths.map((relativePath) => {
    const content = readFileSync(path.join(ROOT, relativePath));
    return [relativePath, createHash("sha256").update(content).digest("hex")];
  }));
}

function resolveTsNodeBin(): string {
  const candidates = [
    path.join(ROOT, "node_modules/ts-node/dist/bin.js"),
    path.join(ROOT, "../Stock-Prediction-System/node_modules/ts-node/dist/bin.js"),
  ];
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (!resolved) throw new Error("ts-node executable is unavailable for CLI verification");
  return resolved;
}

describe("RealOhlcvRefit", () => {
  let csvRaw: string;
  let committedMetricsRaw: string;
  let firstResult: RefitCheckResult;
  let cliStdout: string;
  let cliStderr: string;
  let cliStatus: number | null;
  let outputHashesBeforeCli: Record<string, string>;
  let outputHashesAfterCli: Record<string, string>;

  beforeAll(() => {
    csvRaw = readFileSync(CSV_PATH, "utf8");
    committedMetricsRaw = readFileSync(METRICS_PATH, "utf8");
    firstResult = runReproducibleRefitCheck(csvRaw, committedMetricsRaw);
    outputHashesBeforeCli = fileHashes(OUTPUT_PATHS);
    const tsNodeBin = resolveTsNodeBin();
    const execution = spawnSync(
      process.execPath,
      [tsNodeBin, path.join(ROOT, "scripts/strategy-lab-refit-check.ts")],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          TS_NODE_COMPILER_OPTIONS: JSON.stringify({
            module: "commonjs",
            moduleResolution: "node",
            typeRoots: [path.resolve(path.dirname(tsNodeBin), "../../@types")],
          }),
        },
        maxBuffer: 5 * 1024 * 1024,
      },
    );
    cliStdout = execution.stdout;
    cliStderr = execution.stderr;
    cliStatus = execution.status;
    outputHashesAfterCli = fileHashes(OUTPUT_PATHS);
  });

  it("parses CSV deterministically and rejects non-canonical ordering", () => {
    const raw = toCsv(syntheticRows());
    expect(parseRealOhlcvCsv(raw)).toEqual(parseRealOhlcvCsv(raw));
    const lines = raw.trimEnd().split("\n");
    [lines[1], lines[2]] = [lines[2], lines[1]];
    expect(() => parseRealOhlcvCsv(`${lines.join("\n")}\n`)).toThrow(/ordering is nondeterministic/);
  });

  it("constructs features only from the current or historical rows", () => {
    const rows = syntheticRows();
    const baseline = buildHistoricalFeatureRows(rows);
    const mutated = rows.map((row, index) => index > 25 ? { ...row, close: row.close * 50 } : row);
    const afterFutureMutation = buildHistoricalFeatureRows(mutated);
    expect(afterFutureMutation[0]).toEqual(baseline[0]);
    expect(baseline[0].featureSourceEndDate).toBe(baseline[0].featureDate);
    expect(baseline[0].features[0]).toBeCloseTo(120 / 115 - 1, 12);
    expect(baseline[0].features[1]).toBeCloseTo(120 / 100 - 1, 12);
    expect(baseline[0].features[4]).toBeCloseTo(2 / 120, 12);
  });

  it("uses the close five trading rows ahead as the binary target", () => {
    const rows = syntheticRows();
    const up = buildHistoricalFeatureRows(rows)[0];
    const downRows = rows.map((row, index) => index === 25 ? { ...row, close: 50 } : row);
    const down = buildHistoricalFeatureRows(downRows)[0];
    expect(up.targetDate).toBe(rows[25].date);
    expect(up.target).toBe(1);
    expect(down.target).toBe(0);
    expect(down.forwardReturn).toBeCloseTo(50 / 120 - 1, 12);
  });

  it("selects the chronological 70 percent feature-date boundary", () => {
    const samples = buildHistoricalFeatureRows(syntheticRows());
    const split = splitChronologically(samples);
    const uniqueDates = [...new Set(samples.map((sample) => sample.featureDate))];
    expect(split.trainEndDate).toBe(uniqueDates[Math.floor(uniqueDates.length * 0.7) - 1]);
  });

  it("purges exactly five boundary rows per symbol", () => {
    const split = splitChronologically(buildHistoricalFeatureRows(syntheticRows()));
    expect(split.purged).toHaveLength(5);
    expect(split.purged.map((sample) => sample.featureDate)).toHaveLength(5);
  });

  it("keeps every training label on or before trainEndDate", () => {
    const split = splitChronologically(buildHistoricalFeatureRows(syntheticRows()));
    expect(split.train.every((sample) => sample.targetDate <= split.trainEndDate)).toBe(true);
  });

  it("starts every holdout feature strictly after trainEndDate", () => {
    const split = splitChronologically(buildHistoricalFeatureRows(syntheticRows()));
    expect(split.holdout.every((sample) => sample.featureDate > split.trainEndDate)).toBe(true);
    expect(split.holdoutStartDate).toBe(split.holdout[0].featureDate);
  });

  it("fits scaler state on training rows only", () => {
    const samples = buildHistoricalFeatureRows(syntheticRows());
    const split = splitChronologically(samples);
    const trainingScaler = fitTrainingScaler(split.train);
    const allRowsScaler = fitTrainingScaler(samples);
    expect(trainingScaler.fitRowCount).toBe(split.train.length);
    expect(trainingScaler.fitRowIdentitySha256).not.toBe(allRowsScaler.fitRowIdentitySha256);
    expect(trainingScaler.stateSha256).not.toBe(allRowsScaler.stateSha256);
  });

  it("fits logistic-regression weights on the same training identities as the scaler", () => {
    const split = splitChronologically(buildHistoricalFeatureRows(syntheticRows()));
    const scaler = fitTrainingScaler(split.train);
    const model = fitTrainingLogisticRegression(split.train, scaler);
    expect(model.fitRowCount).toBe(split.train.length);
    expect(model.fitRowIdentitySha256).toBe(scaler.fitRowIdentitySha256);
    expect(model.finalRegularizedLoss).toBeLessThan(model.initialRegularizedLoss);
  });

  it("returns identical complete results from two independent refits", () => {
    const secondResult = runReproducibleRefitCheck(csvRaw, committedMetricsRaw);
    expect(JSON.stringify(secondResult)).toBe(JSON.stringify(firstResult));
  });

  it("reproduces the exact P193 train, holdout, and purge counts", () => {
    expect(firstResult).toMatchObject({
      trainRows: 5279,
      holdoutRows: 2280,
      purgedRows: 25,
      trainEndDate: "2024-07-18",
      holdoutStartDate: "2024-07-19",
    });
  });

  it("reproduces P193 accuracy and majority baseline to eight decimals", () => {
    expect(firstResult.accuracy.toFixed(8)).toBe(P193_EXPECTED.accuracy.toFixed(8));
    expect(firstResult.majorityBaseline.toFixed(8)).toBe(P193_EXPECTED.majorityBaseline.toFixed(8));
    expect(firstResult.confusionMatrix).toEqual(P193_EXPECTED.holdoutConfusionMatrix);
    expect(firstResult.featureNames).toEqual(REAL_OHLCV_FEATURE_NAMES);
  });

  it("fails closed when the authorized input SHA differs", () => {
    expect(() => runReproducibleRefitCheck(csvRaw, committedMetricsRaw, {
      expectedInputSha256: "0".repeat(64),
    })).toThrow(/input SHA256 differs/);
  });

  it("keeps earlier features and all fitted state unchanged after future-row mutation", () => {
    const rows = parseRealOhlcvCsv(csvRaw);
    const baselineSamples = buildHistoricalFeatureRows(rows);
    const baselineSplit = splitChronologically(baselineSamples);
    const baselineScaler = fitTrainingScaler(baselineSplit.train);
    const baselineModel = fitTrainingLogisticRegression(baselineSplit.train, baselineScaler);
    const mutatedRows = rows.map((row) => row.date > baselineSplit.trainEndDate
      ? { ...row, close: row.close * 1.01, high: row.high * 1.01, low: row.low * 1.01, volume: row.volume + 1 }
      : row);
    const mutatedSamples = buildHistoricalFeatureRows(mutatedRows);
    const mutatedSplit = splitChronologically(mutatedSamples);
    const mutatedScaler = fitTrainingScaler(mutatedSplit.train);
    const mutatedModel = fitTrainingLogisticRegression(mutatedSplit.train, mutatedScaler);
    const historicalFeatureState = (samples: typeof baselineSamples) => samples
      .filter((sample) => sample.featureDate <= baselineSplit.trainEndDate)
      .map((sample) => ({
        symbol: sample.symbol,
        featureDate: sample.featureDate,
        featureSourceStartDate: sample.featureSourceStartDate,
        featureSourceEndDate: sample.featureSourceEndDate,
        features: sample.features,
      }));
    expect(historicalFeatureState(mutatedSamples)).toEqual(historicalFeatureState(baselineSamples));
    expect(mutatedScaler.stateSha256).toBe(baselineScaler.stateSha256);
    expect(mutatedModel.stateSha256).toBe(baselineModel.stateSha256);
  });

  it("detects the 0050 unadjusted-price discontinuity", () => {
    const findings = scanPriceDiscontinuities(parseRealOhlcvCsv(csvRaw)).discontinuities;
    expect(findings).toEqual([expect.objectContaining({
      symbol: "0050",
      priorDate: "2025-06-10",
      nextAvailableDate: "2025-06-18",
      closeReturn: -0.74783992,
      classification: "UNADJUSTED_PRICE_DISCONTINUITY_RISK",
    })]);
    expect(findings[0].approximateCloseDiscontinuityPct).toBeCloseTo(-74.8, 1);
  });

  it("blocks promotion and emits no recommendation or readiness claim", () => {
    const serialized = JSON.stringify(firstResult);
    expect(firstResult.reproductionStatus).toBe("PASS");
    expect(firstResult.promotionEligibility).toBe("BLOCKED_DATA_QUALITY");
    expect(serialized).not.toMatch(/\b(buy|sell|profitable|profitability|promoted|production-ready)\b/i);
  });

  it("prints exactly one parseable JSON object from the check-only CLI", () => {
    expect(cliStatus).toBe(0);
    expect(cliStderr).toBe("");
    const lines = cliStdout.trim().split(/\r?\n/);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      reproductionStatus: "PASS",
      promotionEligibility: "BLOCKED_DATA_QUALITY",
      protectedFilesUnchanged: true,
    });
  });

  it("does not write any tracked outputs/retraining artifact", () => {
    expect(outputHashesAfterCli).toEqual(outputHashesBeforeCli);
  });
});
