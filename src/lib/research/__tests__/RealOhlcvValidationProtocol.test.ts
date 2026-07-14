import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

import {
  fitTrainingLogisticRegression,
  fitTrainingScaler,
  parseRealOhlcvCsv,
  type FeatureVector,
  type RealOhlcvFeatureRow,
} from "../RealOhlcvRefit";
import {
  THRESHOLD_SELECTION_RULE,
  VALIDATION_THRESHOLD_GRID,
  chooseValidationCandidate,
  fitAndSelectValidationThreshold,
  requireExpectedDataQualityFinding,
  runRealOhlcvValidationProtocol,
  splitForUntouchedFinalTest,
  type RealOhlcvValidationProtocolResult,
  type ThresholdMetrics,
  type ValidationCandidateResult,
} from "../RealOhlcvValidationProtocol";

jest.setTimeout(240_000);

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, "outputs/retraining/p194_twstock_ohlcv_export.csv");
const CLI_PATH = path.join(ROOT, "scripts/strategy-lab-validation-protocol-check.ts");
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
  const date = new Date(`${start}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function syntheticFeatureRows(count = 50): RealOhlcvFeatureRow[] {
  return Array.from({ length: count }, (_, index) => {
    const target: 0 | 1 = index >= 12 ? 1 : 0;
    return {
      symbol: "0050",
      featureDate: isoDate("2024-01-01", index),
      targetDate: isoDate("2024-01-01", index + 5),
      featureSourceStartDate: isoDate("2023-12-01", index),
      featureSourceEndDate: isoDate("2024-01-01", index),
      features: [
        index / 50,
        (index * index) / 2_500,
        Math.sin(index / 5) / 10,
        1 + index / 100,
        0.01 + index / 10_000,
      ],
      target,
      forwardReturn: target === 1 ? 0.01 : -0.01,
    };
  });
}

function mutateFeatures(row: RealOhlcvFeatureRow, amount: number): RealOhlcvFeatureRow {
  const features: FeatureVector = [
    row.features[0] + amount,
    row.features[1] - amount / 2,
    row.features[2] + amount / 3,
    row.features[3] + amount / 4,
    row.features[4] + amount / 5,
  ];
  return { ...row, features };
}

function replacePartition(
  rows: readonly RealOhlcvFeatureRow[],
  partition: readonly RealOhlcvFeatureRow[],
  transform: (row: RealOhlcvFeatureRow) => RealOhlcvFeatureRow,
): RealOhlcvFeatureRow[] {
  const selected = new Set(partition);
  return rows.map((row) => selected.has(row) ? transform(row) : row);
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

function runCli(cwd: string): SpawnSyncReturns<string> {
  const tsNodeBin = resolveTsNodeBin();
  return spawnSync(process.execPath, [tsNodeBin, CLI_PATH], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      TS_NODE_COMPILER_OPTIONS: JSON.stringify({
        module: "commonjs",
        moduleResolution: "node",
        typeRoots: [path.resolve(path.dirname(tsNodeBin), "../../@types")],
      }),
    },
    maxBuffer: 10 * 1024 * 1024,
  });
}

function metric(overrides: Partial<ThresholdMetrics> = {}): ThresholdMetrics {
  return {
    sampleCount: 10,
    positiveCount: 5,
    negativeCount: 5,
    predictedPositiveCount: 5,
    predictedNegativeCount: 5,
    accuracy: 0.5,
    majorityBaseline: 0.5,
    sensitivity: 0.5,
    recall: 0.5,
    specificity: 0.5,
    precision: 0.5,
    balancedAccuracy: 0.5,
    brierScore: 0.25,
    logLoss: 0.69314718,
    confusionMatrix: {
      truePositive: 3,
      trueNegative: 2,
      falsePositive: 3,
      falseNegative: 2,
    },
    ...overrides,
  };
}

describe("RealOhlcvValidationProtocol", () => {
  const syntheticRows = syntheticFeatureRows();
  const syntheticSplit = splitForUntouchedFinalTest(syntheticRows);
  let csvBytes: Buffer;
  let protocolResult: RealOhlcvValidationProtocolResult;
  let cliRunOne: SpawnSyncReturns<string>;
  let cliRunTwo: SpawnSyncReturns<string>;
  let outputHashesBefore: Record<string, string>;
  let outputHashesAfter: Record<string, string>;

  beforeAll(() => {
    csvBytes = readFileSync(CSV_PATH);
    protocolResult = runRealOhlcvValidationProtocol(csvBytes);
    outputHashesBefore = fileHashes(OUTPUT_PATHS);
    cliRunOne = runCli(ROOT);
    cliRunTwo = runCli(ROOT);
    outputHashesAfter = fileHashes(OUTPUT_PATHS);
  });

  it("calculates exact 60/20/20 boundaries from sorted unique feature dates", () => {
    const reversedSplit = splitForUntouchedFinalTest([...syntheticRows].reverse());
    expect(reversedSplit.trainEndDate).toBe(isoDate("2024-01-01", 29));
    expect(reversedSplit.validationEndDate).toBe(isoDate("2024-01-01", 39));
    expect(reversedSplit.uniqueFeatureDates).toEqual(syntheticSplit.uniqueFeatureDates);
  });

  it("accounts for every feature row in exactly one partition", () => {
    const partitions = [
      syntheticSplit.training,
      syntheticSplit.trainValidationPurge,
      syntheticSplit.validation,
      syntheticSplit.validationFinalPurge,
      syntheticSplit.finalTest,
    ];
    expect(partitions.reduce((sum, partition) => sum + partition.length, 0))
      .toBe(syntheticRows.length);
    expect(new Set(partitions.flat()).size).toBe(syntheticRows.length);
    expect(partitions.every((partition) => partition.length > 0)).toBe(true);
  });

  it("purges five forward-label rows at the train/validation boundary", () => {
    expect(syntheticSplit.trainValidationPurge.map((row) => row.featureDate)).toEqual(
      Array.from({ length: 5 }, (_, index) => isoDate("2024-01-01", index + 25)),
    );
  });

  it("purges five forward-label rows at the validation/final boundary", () => {
    expect(syntheticSplit.validationFinalPurge.map((row) => row.featureDate)).toEqual(
      Array.from({ length: 5 }, (_, index) => isoDate("2024-01-01", index + 35)),
    );
  });

  it("keeps every training target on or before the train end date", () => {
    expect(syntheticSplit.training.every(
      (row) => row.targetDate <= syntheticSplit.trainEndDate,
    )).toBe(true);
  });

  it("keeps every validation target on or before the validation end date", () => {
    expect(syntheticSplit.validation.every(
      (row) => row.targetDate <= syntheticSplit.validationEndDate,
    )).toBe(true);
  });

  it("starts final-test features strictly after the validation end date", () => {
    expect(syntheticSplit.finalTestStartDate).toBe(isoDate("2024-01-01", 40));
    expect(syntheticSplit.finalTest.every(
      (row) => row.featureDate > syntheticSplit.validationEndDate,
    )).toBe(true);
  });

  it("fits the scaler on training rows only", () => {
    const scaler = fitTrainingScaler(syntheticSplit.training);
    const allRowsScaler = fitTrainingScaler(syntheticRows);
    expect(scaler.fitRowCount).toBe(syntheticSplit.training.length);
    expect(scaler.fitRowIdentitySha256).not.toBe(allRowsScaler.fitRowIdentitySha256);
    expect(scaler.stateSha256).not.toBe(allRowsScaler.stateSha256);
  });

  it("fits the model on the same training identities as the scaler", () => {
    const scaler = fitTrainingScaler(syntheticSplit.training);
    const model = fitTrainingLogisticRegression(syntheticSplit.training, scaler);
    expect(model.fitRowCount).toBe(syntheticSplit.training.length);
    expect(model.fitRowIdentitySha256).toBe(scaler.fitRowIdentitySha256);
    expect(model.finalRegularizedLoss).toBeLessThan(model.initialRegularizedLoss);
  });

  it("uses only the fixed predeclared threshold grid", () => {
    const { selection } = fitAndSelectValidationThreshold(syntheticRows);
    expect(VALIDATION_THRESHOLD_GRID).toEqual([
      0.450, 0.475, 0.500, 0.525, 0.550, 0.575, 0.600, 0.625, 0.650,
    ]);
    expect(selection.candidates.map((candidate) => candidate.threshold))
      .toEqual(VALIDATION_THRESHOLD_GRID);
  });

  it("scores every threshold candidate on validation rows only", () => {
    const { split, selection } = fitAndSelectValidationThreshold(syntheticRows);
    expect(selection.scoredValidationRowCount).toBe(split.validation.length);
    expect(selection.candidates.every(
      (candidate) => candidate.metrics.sampleCount === split.validation.length,
    )).toBe(true);
    expect(selection.candidates.map((candidate) => candidate.metrics.brierScore))
      .toEqual(Array(VALIDATION_THRESHOLD_GRID.length).fill(
        selection.candidates[0].metrics.brierScore,
      ));
  });

  it("applies every deterministic threshold tie-break in the declared order", () => {
    const balancedAccuracyWinner: ValidationCandidateResult[] = [
      { threshold: 0.500, metrics: metric({ balancedAccuracy: 0.6, accuracy: 0.4 }) },
      { threshold: 0.475, metrics: metric({ balancedAccuracy: 0.7, accuracy: 0.3 }) },
    ];
    expect(chooseValidationCandidate(balancedAccuracyWinner).threshold).toBe(0.475);

    const accuracyWinner: ValidationCandidateResult[] = [
      { threshold: 0.500, metrics: metric({ balancedAccuracy: 0.6, accuracy: 0.5 }) },
      { threshold: 0.550, metrics: metric({ balancedAccuracy: 0.6, accuracy: 0.6 }) },
    ];
    expect(chooseValidationCandidate(accuracyWinner).threshold).toBe(0.550);

    const distanceWinner: ValidationCandidateResult[] = [
      { threshold: 0.450, metrics: metric({ balancedAccuracy: 0.6, accuracy: 0.6 }) },
      { threshold: 0.525, metrics: metric({ balancedAccuracy: 0.6, accuracy: 0.6 }) },
    ];
    expect(chooseValidationCandidate(distanceWinner).threshold).toBe(0.525);

    const lowerThresholdWinner: ValidationCandidateResult[] = [
      { threshold: 0.525, metrics: metric({ balancedAccuracy: 0.6, accuracy: 0.6 }) },
      { threshold: 0.475, metrics: metric({ balancedAccuracy: 0.6, accuracy: 0.6 }) },
    ];
    expect(chooseValidationCandidate(lowerThresholdWinner).threshold).toBe(0.475);
    expect(THRESHOLD_SELECTION_RULE.zeroDenominatorBehavior).toMatch(/ARE_ZERO/);
  });

  it("never passes final-test rows into validation threshold selection", () => {
    const { split, selection } = fitAndSelectValidationThreshold(syntheticRows);
    expect(selection.scoredValidationRowCount).toBe(split.validation.length);
    expect(selection.scoredValidationRowCount).not.toBe(split.finalTest.length);
    expect(selection.candidates.every(
      (candidate) => candidate.metrics.sampleCount === split.validation.length,
    )).toBe(true);
  });

  it("evaluates the final test exactly once per protocol invocation", () => {
    expect(protocolResult.finalTestEvaluationCount).toBe(1);
    expect(protocolResult.finalTestUsedForSelection).toBe(false);
    expect(protocolResult.finalTestMetrics.sampleCount).toBe(protocolResult.finalTestCount);
  });

  it("changes fitted state when training data changes", () => {
    const baseline = fitAndSelectValidationThreshold(syntheticRows);
    const mutatedRows = replacePartition(
      syntheticRows,
      syntheticSplit.training.slice(0, 1),
      (row) => mutateFeatures(row, 10),
    );
    const mutated = fitAndSelectValidationThreshold(mutatedRows);
    expect(mutated.scaler.stateSha256).not.toBe(baseline.scaler.stateSha256);
    expect(mutated.model.stateSha256).not.toBe(baseline.model.stateSha256);
  });

  it("keeps fitted state unchanged when validation data changes", () => {
    const baseline = fitAndSelectValidationThreshold(syntheticRows);
    const mutatedRows = replacePartition(
      syntheticRows,
      syntheticSplit.validation,
      (row) => ({
        ...mutateFeatures(row, 20),
        target: row.target === 1 ? 0 : 1,
      }),
    );
    const mutated = fitAndSelectValidationThreshold(mutatedRows);
    expect(mutated.scaler.stateSha256).toBe(baseline.scaler.stateSha256);
    expect(mutated.model.stateSha256).toBe(baseline.model.stateSha256);
    expect(mutated.selection.validationCandidateStateSha256)
      .not.toBe(baseline.selection.validationCandidateStateSha256);
  });

  it("keeps boundaries, fit, candidate scores, and selection unchanged after final-test mutation", () => {
    const baseline = fitAndSelectValidationThreshold(syntheticRows);
    const mutatedRows = replacePartition(
      syntheticRows,
      syntheticSplit.finalTest,
      (row) => ({
        ...mutateFeatures(row, 30),
        target: row.target === 1 ? 0 : 1,
      }),
    );
    const mutated = fitAndSelectValidationThreshold(mutatedRows);
    expect({
      trainEndDate: mutated.split.trainEndDate,
      validationEndDate: mutated.split.validationEndDate,
    }).toEqual({
      trainEndDate: baseline.split.trainEndDate,
      validationEndDate: baseline.split.validationEndDate,
    });
    expect(mutated.scaler.stateSha256).toBe(baseline.scaler.stateSha256);
    expect(mutated.model.stateSha256).toBe(baseline.model.stateSha256);
    expect(mutated.selection.validationCandidateStateSha256)
      .toBe(baseline.selection.validationCandidateStateSha256);
    expect(mutated.selection.selectedThreshold).toBe(baseline.selection.selectedThreshold);
  });

  it("keeps fit and selection unchanged after either purged partition is mutated", () => {
    const baseline = fitAndSelectValidationThreshold(syntheticRows);
    const purgedRows = [
      ...syntheticSplit.trainValidationPurge,
      ...syntheticSplit.validationFinalPurge,
    ];
    const mutatedRows = replacePartition(
      syntheticRows,
      purgedRows,
      (row) => mutateFeatures(row, 40),
    );
    const mutated = fitAndSelectValidationThreshold(mutatedRows);
    expect(mutated.scaler.stateSha256).toBe(baseline.scaler.stateSha256);
    expect(mutated.model.stateSha256).toBe(baseline.model.stateSha256);
    expect(mutated.selection.validationCandidateStateSha256)
      .toBe(baseline.selection.validationCandidateStateSha256);
    expect(mutated.selection.selectedThreshold).toBe(baseline.selection.selectedThreshold);
  });

  it("fails reordered CSV input consistently with the merged parser contract", () => {
    const lines = csvBytes.toString("utf8").trimEnd().split("\n");
    [lines[1], lines[2]] = [lines[2], lines[1]];
    expect(() => parseRealOhlcvCsv(`${lines.join("\n")}\n`))
      .toThrow(/ordering is nondeterministic/);
  });

  it("fails closed when the input SHA does not match the committed bytes", () => {
    expect(() => runRealOhlcvValidationProtocol(Buffer.concat([csvBytes, Buffer.from(" ")])))
      .toThrow(/input SHA256 differs/);
  });

  it("fails closed when the expected discontinuity is missing", () => {
    expect(() => requireExpectedDataQualityFinding([]))
      .toThrow(/expected 0050 unadjusted-price discontinuity is missing/);
  });

  it("keeps promotion blocked regardless of validation or final-test performance", () => {
    expect(protocolResult.protocolStatus).toBe("PASS");
    expect(protocolResult.promotionEligibility).toBe("BLOCKED_DATA_QUALITY");
    expect(protocolResult.dataQualityFindings).toEqual([expect.objectContaining({
      symbol: "0050",
      priorDate: "2025-06-10",
      nextAvailableDate: "2025-06-18",
      classification: "UNADJUSTED_PRICE_DISCONTINUITY_RISK",
    })]);
  });

  it("prints exactly one parseable JSON object to stdout on CLI success", () => {
    expect(cliRunOne.status).toBe(0);
    expect(cliRunOne.stderr).toBe("");
    const lines = cliRunOne.stdout.trim().split(/\r?\n/);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      protocolStatus: "PASS",
      evidenceStatus: "DIAGNOSTIC_ONLY",
      promotionEligibility: "BLOCKED_DATA_QUALITY",
      protectedFilesUnchanged: true,
      finalTestUsedForSelection: false,
      finalTestEvaluationCount: 1,
    });
  });

  it("routes CLI failures to stderr and exits nonzero", () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), `validation-protocol-${process.pid}-`));
    try {
      const failed = runCli(temporaryRoot);
      expect(failed.status).not.toBe(0);
      expect(failed.stdout).toBe("");
      const lines = failed.stderr.trim().split(/\r?\n/);
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toMatchObject({
        protocolStatus: "FAIL",
        promotionEligibility: "BLOCKED_DATA_QUALITY",
      });
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("produces byte-identical deterministic JSON in two independent CLI processes", () => {
    expect(cliRunOne.status).toBe(0);
    expect(cliRunTwo.status).toBe(0);
    expect(JSON.stringify(JSON.parse(cliRunOne.stdout)))
      .toBe(JSON.stringify(JSON.parse(cliRunTwo.stdout)));
    expect(cliRunOne.stdout).toBe(cliRunTwo.stdout);
  });

  it("reports complete real-data boundaries, metrics, warnings, and fit identities", () => {
    expect(protocolResult).toMatchObject({
      inputSha256: "2d1aaee13c11015b7d9619e7fe45901cf87283694679a32a410ac03e4854185f",
      trainValidationPurgeCount: 25,
      validationFinalPurgeCount: 25,
      finalTestUsedForSelection: false,
      finalTestEvaluationCount: 1,
    });
    expect(protocolResult.validationCandidates).toHaveLength(VALIDATION_THRESHOLD_GRID.length);
    expect(protocolResult.fitEvidence.trainingRowIdentitySha256)
      .toBe(protocolResult.fitEvidence.scalerFitRowIdentitySha256);
    expect(protocolResult.fitEvidence.trainingRowIdentitySha256)
      .toBe(protocolResult.fitEvidence.modelFitRowIdentitySha256);
    expect(protocolResult.warnings).toEqual([
      "Existing source contains unadjusted-price discontinuity risk.",
      "Final-test evidence is diagnostic historical research only.",
      "Results are not investment advice.",
      "Positive final-test performance, if any, does not authorize promotion.",
    ]);
  });

  it("does not modify any tracked outputs/retraining file", () => {
    expect(outputHashesAfter).toEqual(outputHashesBefore);
  });
});
