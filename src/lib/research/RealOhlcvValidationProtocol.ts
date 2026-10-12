import { createHash } from "node:crypto";

import {
  REAL_OHLCV_FEATURE_NAMES,
  buildHistoricalFeatureRows,
  fitTrainingLogisticRegression,
  fitTrainingScaler,
  parseRealOhlcvCsv,
  scanPriceDiscontinuities,
  type ConfusionMatrix,
  type LogisticRegressionFit,
  type PriceDiscontinuity,
  type RealOhlcvFeatureName,
  type RealOhlcvFeatureRow,
  type RealOhlcvRow,
  type ScalerFit,
} from "./RealOhlcvRefit";

export const VALIDATION_PROTOCOL_INPUT_SHA256 =
  "2d1aaee13c11015b7d9619e7fe45901cf87283694679a32a410ac03e4854185f";

export const VALIDATION_THRESHOLD_GRID = Object.freeze([
  0.450,
  0.475,
  0.500,
  0.525,
  0.550,
  0.575,
  0.600,
  0.625,
  0.650,
] as const);

export const THRESHOLD_SELECTION_RULE = Object.freeze({
  primary: "HIGHEST_VALIDATION_BALANCED_ACCURACY",
  secondary: "HIGHEST_VALIDATION_ACCURACY",
  tertiary: "SMALLEST_ABSOLUTE_DISTANCE_FROM_0_500",
  quaternary: "LOWER_NUMERIC_THRESHOLD",
  zeroDenominatorBehavior:
    "SENSITIVITY_SPECIFICITY_AND_PRECISION_ARE_ZERO_WHEN_THEIR_DENOMINATOR_IS_ZERO",
} as const);

declare const validationPartitionRowsBrand: unique symbol;
declare const finalTestPartitionRowsBrand: unique symbol;

export type ValidationPartitionRows = readonly RealOhlcvFeatureRow[] & {
  readonly [validationPartitionRowsBrand]: "VALIDATION";
};

export type FinalTestPartitionRows = readonly RealOhlcvFeatureRow[] & {
  readonly [finalTestPartitionRowsBrand]: "FINAL_TEST";
};

export interface ThreeWayChronologicalSplit {
  uniqueFeatureDates: string[];
  trainEndDate: string;
  validationStartDate: string;
  validationEndDate: string;
  finalTestStartDate: string;
  training: RealOhlcvFeatureRow[];
  trainValidationPurge: RealOhlcvFeatureRow[];
  validation: ValidationPartitionRows;
  validationFinalPurge: RealOhlcvFeatureRow[];
  finalTest: FinalTestPartitionRows;
}

export interface ThresholdMetrics {
  sampleCount: number;
  positiveCount: number;
  negativeCount: number;
  predictedPositiveCount: number;
  predictedNegativeCount: number;
  accuracy: number;
  majorityBaseline: number;
  sensitivity: number;
  recall: number;
  specificity: number;
  precision: number;
  balancedAccuracy: number;
  brierScore: number;
  logLoss: number;
  confusionMatrix: ConfusionMatrix;
}

export interface ValidationCandidateResult {
  threshold: number;
  metrics: ThresholdMetrics;
}

export interface ValidationThresholdSelection {
  candidates: ValidationCandidateResult[];
  selectedThreshold: number;
  selectedValidationMetrics: ThresholdMetrics;
  scoredValidationRowCount: number;
  scoredValidationRowIdentitySha256: string;
  validationCandidateStateSha256: string;
}

export interface RealOhlcvValidationProtocolResult {
  protocolStatus: "PASS";
  evidenceStatus: "DIAGNOSTIC_ONLY";
  promotionEligibility: "BLOCKED_DATA_QUALITY";
  inputSha256: string;
  inputPath: "outputs/retraining/p194_twstock_ohlcv_export.csv";
  rowCount: number;
  featureRowCount: number;
  dataDateRange: { start: string; end: string };
  featureNames: readonly RealOhlcvFeatureName[];
  trainEndDate: string;
  validationStartDate: string;
  validationEndDate: string;
  finalTestStartDate: string;
  trainCount: number;
  validationCount: number;
  finalTestCount: number;
  trainValidationPurgeCount: number;
  validationFinalPurgeCount: number;
  fitEvidence: {
    trainingRowIdentitySha256: string;
    scalerFitRowIdentitySha256: string;
    modelFitRowIdentitySha256: string;
    scalerStateSha256: string;
    modelStateSha256: string;
    scalerFitRowCount: number;
    modelFitRowCount: number;
  };
  fixedThresholdGrid: readonly number[];
  validationCandidates: ValidationCandidateResult[];
  selectedThreshold: number;
  thresholdSelectionRule: typeof THRESHOLD_SELECTION_RULE;
  selectedValidationMetrics: ThresholdMetrics;
  validationScoredRowIdentitySha256: string;
  validationCandidateStateSha256: string;
  finalTestMetrics: ThresholdMetrics;
  finalTestUsedForSelection: false;
  finalTestEvaluationCount: 1;
  isolationGuards: {
    splitBoundariesUseSortedFeatureDatesOnly: true;
    finalTestFeaturesAndLabelsExcludedFromBoundaryCalculation: true;
    scalerFitOnTrainingRowsOnly: true;
    modelFitOnTrainingRowsOnly: true;
    thresholdCandidatesFixedBeforeValidationScoring: true;
    thresholdSelectedFromValidationRowsOnly: true;
    purgedRowsExcludedFromFitSelectionAndEvaluation: true;
    selectedThresholdFrozenBeforeFinalTestEvaluation: true;
  };
  dataQualityFindings: PriceDiscontinuity[];
  warnings: string[];
}

export class ValidationProtocolError extends Error {
  constructor(message: string) {
    super(`untouched final-test validation protocol failed closed: ${message}`);
    this.name = "ValidationProtocolError";
  }
}

function fail(message: string): never {
  throw new ValidationProtocolError(message);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function round(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function featureRowIdentitySha256(rows: readonly RealOhlcvFeatureRow[]): string {
  return sha256(rows
    .map((row) => `${row.symbol}:${row.featureDate}:${row.targetDate}`)
    .join("\n"));
}

function maxDate(rows: readonly RealOhlcvFeatureRow[], field: "featureDate" | "targetDate"): string {
  if (rows.length === 0) fail(`cannot determine ${field} for an empty partition`);
  return rows.reduce(
    (latest, row) => row[field] > latest ? row[field] : latest,
    rows[0][field],
  );
}

function minDate(rows: readonly RealOhlcvFeatureRow[], field: "featureDate" | "targetDate"): string {
  if (rows.length === 0) fail(`cannot determine ${field} for an empty partition`);
  return rows.reduce(
    (earliest, row) => row[field] < earliest ? row[field] : earliest,
    rows[0][field],
  );
}

export function splitForUntouchedFinalTest(
  featureRows: readonly RealOhlcvFeatureRow[],
): ThreeWayChronologicalSplit {
  if (featureRows.length === 0) fail("cannot partition zero feature rows");
  if (featureRows.some((row) => row.targetDate < row.featureDate)) {
    fail("a target date precedes its feature date");
  }
  const uniqueFeatureDates = [...new Set(featureRows.map((row) => row.featureDate))]
    .sort(compareText);
  const trainEndIndex = Math.floor(uniqueFeatureDates.length * 0.60) - 1;
  const validationEndIndex = Math.floor(uniqueFeatureDates.length * 0.80) - 1;
  if (trainEndIndex < 0 || validationEndIndex <= trainEndIndex
    || validationEndIndex >= uniqueFeatureDates.length - 1) {
    fail("unique feature dates are insufficient for non-empty 60/20/20 boundaries");
  }
  const trainEndDate = uniqueFeatureDates[trainEndIndex];
  const validationEndDate = uniqueFeatureDates[validationEndIndex];

  const training: RealOhlcvFeatureRow[] = [];
  const trainValidationPurge: RealOhlcvFeatureRow[] = [];
  const validation: RealOhlcvFeatureRow[] = [];
  const validationFinalPurge: RealOhlcvFeatureRow[] = [];
  const finalTest: RealOhlcvFeatureRow[] = [];

  for (const row of featureRows) {
    const memberships = [
      row.targetDate <= trainEndDate,
      row.featureDate <= trainEndDate && row.targetDate > trainEndDate,
      row.featureDate > trainEndDate && row.targetDate <= validationEndDate,
      row.featureDate > trainEndDate
        && row.featureDate <= validationEndDate
        && row.targetDate > validationEndDate,
      row.featureDate > validationEndDate,
    ];
    if (memberships.filter(Boolean).length !== 1) {
      fail(`feature row does not belong to exactly one partition: ${row.symbol}:${row.featureDate}`);
    }
    if (memberships[0]) training.push(row);
    if (memberships[1]) trainValidationPurge.push(row);
    if (memberships[2]) validation.push(row);
    if (memberships[3]) validationFinalPurge.push(row);
    if (memberships[4]) finalTest.push(row);
  }

  const partitions = [
    training,
    trainValidationPurge,
    validation,
    validationFinalPurge,
    finalTest,
  ];
  if (partitions.some((partition) => partition.length === 0)) {
    fail("three-way split produced an empty partition");
  }
  if (partitions.reduce((sum, partition) => sum + partition.length, 0) !== featureRows.length) {
    fail("three-way split did not account for every feature row exactly once");
  }

  const validationStartDate = minDate(validation, "featureDate");
  const finalTestStartDate = minDate(finalTest, "featureDate");
  if (maxDate(training, "targetDate") > trainEndDate) {
    fail("latest training target crosses the training boundary");
  }
  if (validationStartDate <= trainEndDate) {
    fail("earliest validation feature does not follow the training boundary");
  }
  if (maxDate(validation, "targetDate") > validationEndDate) {
    fail("latest validation target crosses the validation boundary");
  }
  if (finalTestStartDate <= validationEndDate) {
    fail("earliest final-test feature does not follow the validation boundary");
  }

  return {
    uniqueFeatureDates,
    trainEndDate,
    validationStartDate,
    validationEndDate,
    finalTestStartDate,
    training,
    trainValidationPurge,
    validation: validation as unknown as ValidationPartitionRows,
    validationFinalPurge,
    finalTest: finalTest as unknown as FinalTestPartitionRows,
  };
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const exponent = Math.exp(-value);
    return 1 / (1 + exponent);
  }
  const exponent = Math.exp(value);
  return exponent / (1 + exponent);
}

function probabilityFor(
  row: RealOhlcvFeatureRow,
  scaler: ScalerFit,
  model: LogisticRegressionFit,
): number {
  let score = model.weights[0];
  for (let index = 0; index < row.features.length; index += 1) {
    const standardized = (row.features[index] - scaler.means[index])
      / scaler.standardDeviations[index];
    score += model.weights[index + 1] * standardized;
  }
  return sigmoid(score);
}

export function evaluateAtThreshold(
  rows: readonly RealOhlcvFeatureRow[],
  scaler: ScalerFit,
  model: LogisticRegressionFit,
  threshold: number,
): ThresholdMetrics {
  if (rows.length === 0) fail("cannot evaluate an empty row set");
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    fail(`threshold is outside [0, 1]: ${threshold}`);
  }
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let brierTotal = 0;
  let logLossTotal = 0;
  const epsilon = 1e-12;

  for (const row of rows) {
    const probability = probabilityFor(row, scaler, model);
    const prediction = probability >= threshold ? 1 : 0;
    if (prediction === 1 && row.target === 1) truePositive += 1;
    if (prediction === 0 && row.target === 0) trueNegative += 1;
    if (prediction === 1 && row.target === 0) falsePositive += 1;
    if (prediction === 0 && row.target === 1) falseNegative += 1;
    brierTotal += (probability - row.target) ** 2;
    logLossTotal += -(row.target * Math.log(probability + epsilon)
      + (1 - row.target) * Math.log(1 - probability + epsilon));
  }

  const positiveCount = truePositive + falseNegative;
  const negativeCount = trueNegative + falsePositive;
  const predictedPositiveCount = truePositive + falsePositive;
  const predictedNegativeCount = trueNegative + falseNegative;
  const sensitivity = positiveCount === 0 ? 0 : truePositive / positiveCount;
  const specificity = negativeCount === 0 ? 0 : trueNegative / negativeCount;
  const precision = predictedPositiveCount === 0 ? 0 : truePositive / predictedPositiveCount;

  return {
    sampleCount: rows.length,
    positiveCount,
    negativeCount,
    predictedPositiveCount,
    predictedNegativeCount,
    accuracy: round((truePositive + trueNegative) / rows.length),
    majorityBaseline: round(Math.max(positiveCount, negativeCount) / rows.length),
    sensitivity: round(sensitivity),
    recall: round(sensitivity),
    specificity: round(specificity),
    precision: round(precision),
    balancedAccuracy: round((sensitivity + specificity) / 2),
    brierScore: round(brierTotal / rows.length),
    logLoss: round(logLossTotal / rows.length),
    confusionMatrix: { truePositive, trueNegative, falsePositive, falseNegative },
  };
}

export interface FinalTestEvaluationGuard {
  evaluate(
    finalTestRows: FinalTestPartitionRows,
    scaler: ScalerFit,
    model: LogisticRegressionFit,
    threshold: number,
  ): ThresholdMetrics;
  assertExactlyOnce(): 1;
}

export function createFinalTestEvaluationGuard(): FinalTestEvaluationGuard {
  let evaluationCount = 0;
  return {
    evaluate(finalTestRows, scaler, model, threshold) {
      evaluationCount += 1;
      return evaluateAtThreshold(finalTestRows, scaler, model, threshold);
    },
    assertExactlyOnce() {
      if (evaluationCount !== 1) {
        fail(`final test evaluation count differs: expected 1, received ${evaluationCount}`);
      }
      return 1;
    },
  };
}

function candidateIsBetter(
  candidate: ValidationCandidateResult,
  incumbent: ValidationCandidateResult,
): boolean {
  if (candidate.metrics.balancedAccuracy !== incumbent.metrics.balancedAccuracy) {
    return candidate.metrics.balancedAccuracy > incumbent.metrics.balancedAccuracy;
  }
  if (candidate.metrics.accuracy !== incumbent.metrics.accuracy) {
    return candidate.metrics.accuracy > incumbent.metrics.accuracy;
  }
  const candidateDistance = Math.abs(candidate.threshold - 0.500);
  const incumbentDistance = Math.abs(incumbent.threshold - 0.500);
  if (candidateDistance !== incumbentDistance) return candidateDistance < incumbentDistance;
  return candidate.threshold < incumbent.threshold;
}

export function chooseValidationCandidate(
  candidates: readonly ValidationCandidateResult[],
): ValidationCandidateResult {
  if (candidates.length === 0) fail("cannot select a threshold from zero candidates");
  return candidates.slice(1).reduce(
    (incumbent, candidate) => candidateIsBetter(candidate, incumbent) ? candidate : incumbent,
    candidates[0],
  );
}

export function selectValidationThreshold(
  validationRows: ValidationPartitionRows,
  scaler: ScalerFit,
  model: LogisticRegressionFit,
): ValidationThresholdSelection {
  if (validationRows.length === 0) fail("cannot select a threshold from zero validation rows");
  const candidates = VALIDATION_THRESHOLD_GRID.map((threshold) => ({
    threshold,
    metrics: evaluateAtThreshold(validationRows, scaler, model, threshold),
  }));
  const selected = chooseValidationCandidate(candidates);
  return {
    candidates,
    selectedThreshold: selected.threshold,
    selectedValidationMetrics: selected.metrics,
    scoredValidationRowCount: validationRows.length,
    scoredValidationRowIdentitySha256: featureRowIdentitySha256(validationRows),
    validationCandidateStateSha256: sha256(JSON.stringify(candidates)),
  };
}

export function requireExpectedDataQualityFinding(
  findings: readonly PriceDiscontinuity[],
): PriceDiscontinuity {
  const expected = findings.find((finding) =>
    finding.symbol === "0050"
    && finding.priorDate === "2025-06-10"
    && finding.nextAvailableDate === "2025-06-18"
    && finding.classification === "UNADJUSTED_PRICE_DISCONTINUITY_RISK",
  );
  if (!expected) fail("expected 0050 unadjusted-price discontinuity is missing");
  return expected;
}

function assertFitUsesTrainingOnly(
  split: ThreeWayChronologicalSplit,
  scaler: ScalerFit,
  model: LogisticRegressionFit,
): void {
  const trainingIdentity = featureRowIdentitySha256(split.training);
  if (scaler.fitRowCount !== split.training.length
    || model.fitRowCount !== split.training.length) {
    fail("scaler or model fit row count differs from the training partition");
  }
  if (scaler.fitRowIdentitySha256 !== trainingIdentity
    || model.fitRowIdentitySha256 !== trainingIdentity) {
    fail("scaler or model fit identity differs from the training partition");
  }
}

export function fitAndSelectValidationThreshold(
  featureRows: readonly RealOhlcvFeatureRow[],
): {
  split: ThreeWayChronologicalSplit;
  scaler: ScalerFit;
  model: LogisticRegressionFit;
  selection: ValidationThresholdSelection;
} {
  const split = splitForUntouchedFinalTest(featureRows);
  const scaler = fitTrainingScaler(split.training);
  const model = fitTrainingLogisticRegression(split.training, scaler);
  assertFitUsesTrainingOnly(split, scaler, model);
  const selection = selectValidationThreshold(split.validation, scaler, model);
  if (selection.scoredValidationRowCount !== split.validation.length
    || selection.scoredValidationRowIdentitySha256 !== featureRowIdentitySha256(split.validation)) {
    fail("threshold selection did not use exactly the validation partition");
  }
  return { split, scaler, model, selection };
}

export function runRealOhlcvValidationProtocol(
  csvInput: string | Buffer,
  options: { expectedInputSha256?: string } = {},
): RealOhlcvValidationProtocolResult {
  const inputBytes = typeof csvInput === "string" ? Buffer.from(csvInput, "utf8") : csvInput;
  const inputSha256 = sha256(inputBytes);
  const expectedInputSha256 = options.expectedInputSha256 ?? VALIDATION_PROTOCOL_INPUT_SHA256;
  if (expectedInputSha256 !== VALIDATION_PROTOCOL_INPUT_SHA256) {
    fail("authorized input SHA256 contract differs from the committed protocol");
  }
  if (inputSha256 !== expectedInputSha256) {
    fail(`input SHA256 differs: expected ${expectedInputSha256}, received ${inputSha256}`);
  }

  const rows: RealOhlcvRow[] = parseRealOhlcvCsv(inputBytes.toString("utf8"));
  const featureRows = buildHistoricalFeatureRows(rows);
  const { split, scaler, model, selection } = fitAndSelectValidationThreshold(featureRows);
  const scan = scanPriceDiscontinuities(rows);
  requireExpectedDataQualityFinding(scan.discontinuities);

  const selectedThreshold = selection.selectedThreshold;
  const finalTestUsedForSelection = selection.scoredValidationRowIdentitySha256
    === featureRowIdentitySha256(split.finalTest);
  if (finalTestUsedForSelection) fail("final-test rows reached threshold selection");
  const finalTestEvaluationGuard = createFinalTestEvaluationGuard();
  const finalTestMetrics = finalTestEvaluationGuard.evaluate(
    split.finalTest,
    scaler,
    model,
    selectedThreshold,
  );
  const finalTestEvaluationCount = finalTestEvaluationGuard.assertExactlyOnce();

  const sortedDataDates = rows.map((row) => row.date).sort(compareText);
  return {
    protocolStatus: "PASS",
    evidenceStatus: "DIAGNOSTIC_ONLY",
    promotionEligibility: "BLOCKED_DATA_QUALITY",
    inputSha256,
    inputPath: "outputs/retraining/p194_twstock_ohlcv_export.csv",
    rowCount: rows.length,
    featureRowCount: featureRows.length,
    dataDateRange: {
      start: sortedDataDates[0],
      end: sortedDataDates[sortedDataDates.length - 1],
    },
    featureNames: REAL_OHLCV_FEATURE_NAMES,
    trainEndDate: split.trainEndDate,
    validationStartDate: split.validationStartDate,
    validationEndDate: split.validationEndDate,
    finalTestStartDate: split.finalTestStartDate,
    trainCount: split.training.length,
    validationCount: split.validation.length,
    finalTestCount: split.finalTest.length,
    trainValidationPurgeCount: split.trainValidationPurge.length,
    validationFinalPurgeCount: split.validationFinalPurge.length,
    fitEvidence: {
      trainingRowIdentitySha256: scaler.fitRowIdentitySha256,
      scalerFitRowIdentitySha256: scaler.fitRowIdentitySha256,
      modelFitRowIdentitySha256: model.fitRowIdentitySha256,
      scalerStateSha256: scaler.stateSha256,
      modelStateSha256: model.stateSha256,
      scalerFitRowCount: scaler.fitRowCount,
      modelFitRowCount: model.fitRowCount,
    },
    fixedThresholdGrid: [...VALIDATION_THRESHOLD_GRID],
    validationCandidates: selection.candidates,
    selectedThreshold,
    thresholdSelectionRule: THRESHOLD_SELECTION_RULE,
    selectedValidationMetrics: selection.selectedValidationMetrics,
    validationScoredRowIdentitySha256: selection.scoredValidationRowIdentitySha256,
    validationCandidateStateSha256: selection.validationCandidateStateSha256,
    finalTestMetrics,
    finalTestUsedForSelection,
    finalTestEvaluationCount,
    isolationGuards: {
      splitBoundariesUseSortedFeatureDatesOnly: true,
      finalTestFeaturesAndLabelsExcludedFromBoundaryCalculation: true,
      scalerFitOnTrainingRowsOnly: true,
      modelFitOnTrainingRowsOnly: true,
      thresholdCandidatesFixedBeforeValidationScoring: true,
      thresholdSelectedFromValidationRowsOnly: true,
      purgedRowsExcludedFromFitSelectionAndEvaluation: true,
      selectedThresholdFrozenBeforeFinalTestEvaluation: true,
    },
    dataQualityFindings: scan.discontinuities,
    warnings: [
      "Existing source contains unadjusted-price discontinuity risk.",
      "Final-test evidence is diagnostic historical research only.",
      "Results are not investment advice.",
      "Positive final-test performance, if any, does not authorize promotion.",
    ],
  };
}
