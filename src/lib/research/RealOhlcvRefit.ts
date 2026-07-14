import { createHash } from "node:crypto";

export const REAL_OHLCV_FEATURE_NAMES = [
  "return_5d",
  "return_20d",
  "volatility_10d",
  "volume_ratio_20d",
  "intraday_range_pct",
] as const;

export const P193_EXPECTED = {
  inputSha256: "2d1aaee13c11015b7d9619e7fe45901cf87283694679a32a410ac03e4854185f",
  rowCount: 7709,
  dateStart: "2020-01-02",
  dateEnd: "2026-07-01",
  trainRows: 5279,
  holdoutRows: 2280,
  purgedRows: 25,
  accuracy: 0.54692982,
  majorityBaseline: 0.55701754,
  trainEndDate: "2024-07-18",
  holdoutStartDate: "2024-07-19",
  iterations: 2500,
  learningRate: 0.08,
  l2: 0.01,
  threshold: 0.5,
  holdoutConfusionMatrix: {
    truePositive: 1229,
    trueNegative: 18,
    falsePositive: 992,
    falseNegative: 41,
  },
} as const;

const HORIZON_ROWS = 5;
const LOOKBACK_ROWS = 20;
const TRAIN_FRACTION = 0.7;
const DISCONTINUITY_THRESHOLD = 0.5;

export type RealOhlcvFeatureName = (typeof REAL_OHLCV_FEATURE_NAMES)[number];
export type FeatureVector = [number, number, number, number, number];

export interface RealOhlcvRow {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
  fetchedAtUtc: string;
}

export interface RealOhlcvFeatureRow {
  symbol: string;
  featureDate: string;
  targetDate: string;
  featureSourceStartDate: string;
  featureSourceEndDate: string;
  features: FeatureVector;
  target: 0 | 1;
  forwardReturn: number;
}

export interface ChronologicalSplit {
  trainEndDate: string;
  holdoutStartDate: string;
  train: RealOhlcvFeatureRow[];
  holdout: RealOhlcvFeatureRow[];
  purged: RealOhlcvFeatureRow[];
}

export interface ScalerFit {
  means: FeatureVector;
  standardDeviations: FeatureVector;
  fitRowCount: number;
  fitRowIdentitySha256: string;
  stateSha256: string;
}

export interface LogisticRegressionFit {
  weights: [number, number, number, number, number, number];
  fitRowCount: number;
  fitRowIdentitySha256: string;
  initialRegularizedLoss: number;
  finalRegularizedLoss: number;
  stateSha256: string;
}

export interface ConfusionMatrix {
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
}

export interface RefitEvaluation {
  sampleCount: number;
  positiveCount: number;
  negativeCount: number;
  accuracy: number;
  majorityBaseline: number;
  precision: number;
  recall: number;
  brierScore: number;
  logLoss: number;
  confusionMatrix: ConfusionMatrix;
}

export interface PriceDiscontinuity {
  symbol: string;
  priorDate: string;
  nextAvailableDate: string;
  priorClose: number;
  nextClose: number;
  closeReturn: number;
  approximateCloseDiscontinuityPct: number;
  classification: "UNADJUSTED_PRICE_DISCONTINUITY_RISK";
}

export interface RefitCheckResult {
  reproductionStatus: "PASS";
  promotionEligibility: "BLOCKED_DATA_QUALITY";
  inputSha256: string;
  inputPath: "outputs/retraining/p194_twstock_ohlcv_export.csv";
  rowCount: number;
  dataDateRange: { start: string; end: string };
  trainRows: number;
  holdoutRows: number;
  purgedRows: number;
  accuracy: number;
  majorityBaseline: number;
  precision: number;
  recall: number;
  confusionMatrix: ConfusionMatrix;
  trainEndDate: string;
  holdoutStartDate: string;
  featureNames: readonly RealOhlcvFeatureName[];
  leakageGuards: {
    historicalFeaturesOnly: true;
    trainingLabelsEndOnOrBeforeTrainEndDate: true;
    holdoutFeaturesBeginAfterTrainEndDate: true;
    scalerFitOnTrainingRowsOnly: true;
    modelFitOnTrainingRowsOnly: true;
    holdoutExcludedFromThresholdSelection: true;
  };
  fitEvidence: {
    scalerFitRows: number;
    modelFitRows: number;
    scalerFitRowIdentitySha256: string;
    modelFitRowIdentitySha256: string;
    scalerStateSha256: string;
    modelStateSha256: string;
    latestTrainingFeatureDate: string;
    latestTrainingTargetDate: string;
    decisionThreshold: 0.5;
    thresholdSelection: "FIXED_BEFORE_HOLDOUT_EVALUATION";
  };
  discontinuities: PriceDiscontinuity[];
  perSymbolDiscontinuityFindings: Record<string, PriceDiscontinuity[]>;
  warnings: string[];
}

export class RefitCheckError extends Error {
  constructor(message: string) {
    super(`P193 reproducible refit check failed closed: ${message}`);
    this.name = "RefitCheckError";
  }
}

function fail(message: string): never {
  throw new RefitCheckError(message);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function round(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function mean(values: readonly number[]): number {
  if (values.length === 0) fail("cannot compute a mean from zero values");
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function asFeatureVector(values: readonly number[]): FeatureVector {
  if (values.length !== REAL_OHLCV_FEATURE_NAMES.length) {
    fail(`expected ${REAL_OHLCV_FEATURE_NAMES.length} features, received ${values.length}`);
  }
  return [values[0], values[1], values[2], values[3], values[4]];
}

function parseCsvLine(line: string, rowNumber: number): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (field.length === 0 || quoted) {
        quoted = !quoted;
      } else {
        fail(`invalid quote at CSV row ${rowNumber}`);
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) fail(`unterminated quoted field at CSV row ${rowNumber}`);
  fields.push(field);
  return fields;
}

function validateNumericRow(row: RealOhlcvRow, rowNumber: number): void {
  const values = [row.open, row.high, row.low, row.close, row.volume];
  if (values.some((value) => !Number.isFinite(value))) {
    fail(`non-finite OHLCV value at data row ${rowNumber}`);
  }
  if (row.open <= 0 || row.high <= 0 || row.low <= 0 || row.close <= 0 || row.volume < 0) {
    fail(`out-of-domain OHLCV value at data row ${rowNumber}`);
  }
  if (row.high < row.low) fail(`high is below low at data row ${rowNumber}`);
}

export function parseRealOhlcvCsv(raw: string): RealOhlcvRow[] {
  if (raw.length === 0) fail("CSV input is empty");
  const lines = raw.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const expectedHeader = "symbol,date,open,high,low,close,volume,source,fetched_at_utc";
  if (lines.shift() !== expectedHeader) fail("unexpected CSV header");

  const rows = lines.map((line, index): RealOhlcvRow => {
    const rowNumber = index + 2;
    const fields = parseCsvLine(line, rowNumber);
    if (fields.length !== 9) fail(`expected 9 fields at CSV row ${rowNumber}`);
    const [symbol, date, open, high, low, close, volume, source, fetchedAtUtc] = fields;
    if (!/^\d{4}$/.test(symbol)) fail(`invalid symbol at data row ${index + 1}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`invalid ISO date at data row ${index + 1}`);
    if (!source.startsWith("twstock/")) fail(`unexpected source at data row ${index + 1}`);
    if (fetchedAtUtc.length === 0) fail(`missing fetch timestamp at data row ${index + 1}`);
    const row = {
      symbol,
      date,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
      source,
      fetchedAtUtc,
    };
    validateNumericRow(row, index + 1);
    return row;
  });

  if (rows.length < LOOKBACK_ROWS + HORIZON_ROWS + 1) {
    fail(`insufficient source rows: ${rows.length}`);
  }
  const seen = new Set<string>();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const identity = `${row.symbol}:${row.date}`;
    if (seen.has(identity)) fail(`duplicate symbol/date row: ${identity}`);
    seen.add(identity);
    if (index > 0) {
      const previous = rows[index - 1];
      const order = compareText(previous.symbol, row.symbol) || compareText(previous.date, row.date);
      if (order >= 0) fail(`CSV ordering is nondeterministic at ${identity}`);
    }
  }
  return rows;
}

function groupRowsBySymbol(rows: readonly RealOhlcvRow[]): Map<string, RealOhlcvRow[]> {
  const grouped = new Map<string, RealOhlcvRow[]>();
  for (const row of rows) {
    const symbolRows = grouped.get(row.symbol) ?? [];
    symbolRows.push(row);
    grouped.set(row.symbol, symbolRows);
  }
  return grouped;
}

function computeFeatureVector(symbolRows: readonly RealOhlcvRow[], index: number): FeatureVector {
  if (index < LOOKBACK_ROWS || index >= symbolRows.length) {
    fail(`feature index ${index} is outside the historical lookback boundary`);
  }
  const current = symbolRows[index];
  const returns10: number[] = [];
  for (let offset = index - 9; offset <= index; offset += 1) {
    returns10.push(symbolRows[offset].close / symbolRows[offset - 1].close - 1);
  }
  const averageReturn = mean(returns10);
  const variance = mean(returns10.map((value) => (value - averageReturn) ** 2));
  const historicalVolumes = symbolRows.slice(index - LOOKBACK_ROWS, index).map((row) => row.volume);
  const averageVolume20 = mean(historicalVolumes);
  if (averageVolume20 <= 0) fail(`zero historical volume mean at ${current.symbol}:${current.date}`);
  return [
    current.close / symbolRows[index - 5].close - 1,
    current.close / symbolRows[index - 20].close - 1,
    Math.sqrt(variance),
    current.volume / averageVolume20,
    (current.high - current.low) / current.close,
  ];
}

export function buildHistoricalFeatureRows(
  rows: readonly RealOhlcvRow[],
): RealOhlcvFeatureRow[] {
  const samples: RealOhlcvFeatureRow[] = [];
  for (const [symbol, symbolRows] of groupRowsBySymbol(rows)) {
    for (let index = LOOKBACK_ROWS; index + HORIZON_ROWS < symbolRows.length; index += 1) {
      const current = symbolRows[index];
      const targetRow = symbolRows[index + HORIZON_ROWS];
      const forwardReturn = targetRow.close / current.close - 1;
      samples.push({
        symbol,
        featureDate: current.date,
        targetDate: targetRow.date,
        featureSourceStartDate: symbolRows[index - LOOKBACK_ROWS].date,
        featureSourceEndDate: current.date,
        features: computeFeatureVector(symbolRows, index),
        target: forwardReturn > 0 ? 1 : 0,
        forwardReturn,
      });
    }
  }
  samples.sort((left, right) =>
    compareText(left.featureDate, right.featureDate) || compareText(left.symbol, right.symbol),
  );
  if (samples.some((sample) => sample.featureSourceEndDate > sample.featureDate)) {
    fail("a feature row consumed future data");
  }
  return samples;
}

export function splitChronologically(
  samples: readonly RealOhlcvFeatureRow[],
): ChronologicalSplit {
  const uniqueFeatureDates = [...new Set(samples.map((sample) => sample.featureDate))];
  if (uniqueFeatureDates.length < 2) fail("insufficient unique feature dates for chronological split");
  const splitDateIndex = Math.floor(uniqueFeatureDates.length * TRAIN_FRACTION) - 1;
  if (splitDateIndex < 0) fail("chronological split produced no training date");
  const trainEndDate = uniqueFeatureDates[splitDateIndex];
  const train = samples.filter((sample) => sample.targetDate <= trainEndDate);
  const holdout = samples.filter((sample) => sample.featureDate > trainEndDate);
  const purged = samples.filter(
    (sample) => sample.featureDate <= trainEndDate && sample.targetDate > trainEndDate,
  );
  if (train.length === 0 || holdout.length === 0) fail("chronological split produced an empty partition");
  if (train.length + holdout.length + purged.length !== samples.length) {
    fail("chronological split did not account for every sample exactly once");
  }
  const latestTrainingTargetDate = train[train.length - 1].targetDate;
  const holdoutStartDate = holdout[0].featureDate;
  if (latestTrainingTargetDate > trainEndDate) fail("training target crosses trainEndDate");
  if (holdoutStartDate <= trainEndDate) fail("holdout feature date does not follow trainEndDate");
  return { trainEndDate, holdoutStartDate, train: [...train], holdout: [...holdout], purged: [...purged] };
}

function sampleIdentitySha256(samples: readonly RealOhlcvFeatureRow[]): string {
  return sha256(samples.map((sample) => `${sample.symbol}:${sample.featureDate}:${sample.targetDate}`).join("\n"));
}

export function fitTrainingScaler(samples: readonly RealOhlcvFeatureRow[]): ScalerFit {
  if (samples.length === 0) fail("cannot fit scaler on zero training rows");
  const means = asFeatureVector(REAL_OHLCV_FEATURE_NAMES.map((_, featureIndex) =>
    mean(samples.map((sample) => sample.features[featureIndex])),
  ));
  const standardDeviations = asFeatureVector(REAL_OHLCV_FEATURE_NAMES.map((_, featureIndex) => {
    const variance = mean(
      samples.map((sample) => (sample.features[featureIndex] - means[featureIndex]) ** 2),
    );
    const standardDeviation = Math.sqrt(variance);
    return standardDeviation > 1e-12 ? standardDeviation : 1;
  }));
  const fitRowIdentitySha256 = sampleIdentitySha256(samples);
  return {
    means,
    standardDeviations,
    fitRowCount: samples.length,
    fitRowIdentitySha256,
    stateSha256: sha256(JSON.stringify({ means, standardDeviations, fitRowIdentitySha256 })),
  };
}

function transform(features: FeatureVector, scaler: ScalerFit): FeatureVector {
  return asFeatureVector(features.map(
    (value, index) => (value - scaler.means[index]) / scaler.standardDeviations[index],
  ));
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const exponent = Math.exp(-value);
    return 1 / (1 + exponent);
  }
  const exponent = Math.exp(value);
  return exponent / (1 + exponent);
}

function dot(left: readonly number[], right: readonly number[]): number {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function regularizedLoss(
  samples: readonly RealOhlcvFeatureRow[],
  weights: readonly number[],
  scaler: ScalerFit,
): number {
  const epsilon = 1e-12;
  const dataLoss = mean(samples.map((sample) => {
    const probability = sigmoid(dot(weights, [1, ...transform(sample.features, scaler)]));
    return -(sample.target * Math.log(probability + epsilon)
      + (1 - sample.target) * Math.log(1 - probability + epsilon));
  }));
  const penalty = weights.slice(1).reduce((sum, weight) => sum + weight ** 2, 0);
  return dataLoss + (P193_EXPECTED.l2 / 2) * penalty;
}

export function fitTrainingLogisticRegression(
  samples: readonly RealOhlcvFeatureRow[],
  scaler: ScalerFit,
): LogisticRegressionFit {
  if (samples.length === 0) fail("cannot fit model on zero training rows");
  if (scaler.fitRowIdentitySha256 !== sampleIdentitySha256(samples)) {
    fail("model training rows do not match scaler training rows");
  }
  const weights = [0, 0, 0, 0, 0, 0];
  const initialRegularizedLoss = regularizedLoss(samples, weights, scaler);
  for (let iteration = 0; iteration < P193_EXPECTED.iterations; iteration += 1) {
    const gradient = [0, 0, 0, 0, 0, 0];
    for (const sample of samples) {
      const inputs = [1, ...transform(sample.features, scaler)];
      const error = sigmoid(dot(weights, inputs)) - sample.target;
      for (let index = 0; index < gradient.length; index += 1) {
        gradient[index] += error * inputs[index];
      }
    }
    for (let index = 0; index < weights.length; index += 1) {
      const regularization = index === 0 ? 0 : P193_EXPECTED.l2 * weights[index];
      weights[index] -= P193_EXPECTED.learningRate
        * (gradient[index] / samples.length + regularization);
    }
  }
  const typedWeights: LogisticRegressionFit["weights"] = [
    weights[0], weights[1], weights[2], weights[3], weights[4], weights[5],
  ];
  const fitRowIdentitySha256 = sampleIdentitySha256(samples);
  const finalRegularizedLoss = regularizedLoss(samples, typedWeights, scaler);
  if (!(finalRegularizedLoss < initialRegularizedLoss)) fail("training did not reduce loss");
  return {
    weights: typedWeights,
    fitRowCount: samples.length,
    fitRowIdentitySha256,
    initialRegularizedLoss,
    finalRegularizedLoss,
    stateSha256: sha256(JSON.stringify({
      weights: typedWeights,
      fitRowIdentitySha256,
      iterations: P193_EXPECTED.iterations,
      learningRate: P193_EXPECTED.learningRate,
      l2: P193_EXPECTED.l2,
    })),
  };
}

export function evaluateRefit(
  samples: readonly RealOhlcvFeatureRow[],
  scaler: ScalerFit,
  model: LogisticRegressionFit,
): RefitEvaluation {
  if (samples.length === 0) fail("cannot evaluate zero rows");
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let brierTotal = 0;
  let logLossTotal = 0;
  const epsilon = 1e-12;
  for (const sample of samples) {
    const probability = sigmoid(dot(model.weights, [1, ...transform(sample.features, scaler)]));
    const prediction = probability >= P193_EXPECTED.threshold ? 1 : 0;
    if (prediction === 1 && sample.target === 1) truePositive += 1;
    if (prediction === 0 && sample.target === 0) trueNegative += 1;
    if (prediction === 1 && sample.target === 0) falsePositive += 1;
    if (prediction === 0 && sample.target === 1) falseNegative += 1;
    brierTotal += (probability - sample.target) ** 2;
    logLossTotal += -(sample.target * Math.log(probability + epsilon)
      + (1 - sample.target) * Math.log(1 - probability + epsilon));
  }
  const positiveCount = truePositive + falseNegative;
  const negativeCount = trueNegative + falsePositive;
  const predictedPositiveCount = truePositive + falsePositive;
  return {
    sampleCount: samples.length,
    positiveCount,
    negativeCount,
    accuracy: round((truePositive + trueNegative) / samples.length),
    majorityBaseline: round(Math.max(positiveCount, negativeCount) / samples.length),
    precision: round(predictedPositiveCount === 0 ? 0 : truePositive / predictedPositiveCount),
    recall: round(positiveCount === 0 ? 0 : truePositive / positiveCount),
    brierScore: round(brierTotal / samples.length),
    logLoss: round(logLossTotal / samples.length),
    confusionMatrix: { truePositive, trueNegative, falsePositive, falseNegative },
  };
}

export function scanPriceDiscontinuities(
  rows: readonly RealOhlcvRow[],
): { discontinuities: PriceDiscontinuity[]; perSymbol: Record<string, PriceDiscontinuity[]> } {
  const discontinuities: PriceDiscontinuity[] = [];
  const perSymbol: Record<string, PriceDiscontinuity[]> = {};
  for (const [symbol, symbolRows] of groupRowsBySymbol(rows)) {
    const findings: PriceDiscontinuity[] = [];
    for (let index = 1; index < symbolRows.length; index += 1) {
      const previous = symbolRows[index - 1];
      const current = symbolRows[index];
      const closeReturn = current.close / previous.close - 1;
      if (Math.abs(closeReturn) >= DISCONTINUITY_THRESHOLD) {
        findings.push({
          symbol,
          priorDate: previous.date,
          nextAvailableDate: current.date,
          priorClose: previous.close,
          nextClose: current.close,
          closeReturn: round(closeReturn),
          approximateCloseDiscontinuityPct: round(closeReturn * 100, 6),
          classification: "UNADJUSTED_PRICE_DISCONTINUITY_RISK",
        });
      }
    }
    perSymbol[symbol] = findings;
    discontinuities.push(...findings);
  }
  return { discontinuities, perSymbol };
}

type JsonRecord = Record<string, unknown>;

function recordAt(value: unknown, location: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`committed P193 artifact field ${location} is not an object`);
  }
  return value as JsonRecord;
}

function numberAt(record: JsonRecord, key: string, location: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`committed P193 artifact field ${location}.${key} is not numeric`);
  }
  return value;
}

function stringAt(record: JsonRecord, key: string, location: string): string {
  const value = record[key];
  if (typeof value !== "string") fail(`committed P193 artifact field ${location}.${key} is not text`);
  return value;
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) fail(`${label} differs: expected ${String(expected)}, received ${String(actual)}`);
}

function validateCommittedP193Artifact(raw: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("committed P193 metrics artifact is not valid JSON");
  }
  const root = recordAt(parsed, "root");
  const data = recordAt(root.data, "data");
  const features = recordAt(root.features, "features");
  const fit = recordAt(root.fit, "fit");
  const boundary = recordAt(root.validationBoundary, "validationBoundary");
  const metrics = recordAt(root.metrics, "metrics");
  const holdout = recordAt(metrics.chronologicalHoldout, "metrics.chronologicalHoldout");
  assertEqual(numberAt(root, "rows", "root"), P193_EXPECTED.rowCount, "committed row count");
  assertEqual(numberAt(root, "trainSampleCount", "root"), P193_EXPECTED.trainRows, "committed train count");
  assertEqual(numberAt(root, "holdoutSampleCount", "root"), P193_EXPECTED.holdoutRows, "committed holdout count");
  assertEqual(numberAt(root, "purgedSampleCount", "root"), P193_EXPECTED.purgedRows, "committed purge count");
  assertEqual(numberAt(root, "accuracy", "root"), P193_EXPECTED.accuracy, "committed accuracy");
  assertEqual(
    numberAt(root, "majorityBaselineAccuracy", "root"),
    P193_EXPECTED.majorityBaseline,
    "committed majority baseline",
  );
  assertEqual(stringAt(data, "sourceSha256", "data"), P193_EXPECTED.inputSha256, "committed input SHA");
  assertEqual(stringAt(boundary, "trainEndDate", "validationBoundary"), P193_EXPECTED.trainEndDate, "committed train end");
  assertEqual(numberAt(fit, "iterations", "fit"), P193_EXPECTED.iterations, "committed iterations");
  assertEqual(numberAt(fit, "learningRate", "fit"), P193_EXPECTED.learningRate, "committed learning rate");
  assertEqual(numberAt(fit, "l2", "fit"), P193_EXPECTED.l2, "committed L2");
  assertEqual(numberAt(holdout, "accuracy", "holdout"), P193_EXPECTED.accuracy, "committed holdout accuracy");
  const names = features.names;
  if (!Array.isArray(names) || JSON.stringify(names) !== JSON.stringify(REAL_OHLCV_FEATURE_NAMES)) {
    fail("committed feature order differs from the P193 contract");
  }
}

function assertExpectedDiscontinuity(discontinuities: readonly PriceDiscontinuity[]): void {
  const expected = discontinuities.find((finding) =>
    finding.symbol === "0050"
    && finding.priorDate === "2025-06-10"
    && finding.nextAvailableDate === "2025-06-18"
    && finding.classification === "UNADJUSTED_PRICE_DISCONTINUITY_RISK",
  );
  if (!expected) fail("expected 0050 unadjusted-price discontinuity was not detected");
  if (Math.abs(expected.closeReturn - (-0.74783992)) > 1e-8) {
    fail(`0050 close discontinuity differs: ${expected.closeReturn}`);
  }
}

export function runReproducibleRefitCheck(
  csvRaw: string,
  committedMetricsRaw: string,
  options: { expectedInputSha256?: string } = {},
): RefitCheckResult {
  const expectedInputSha256 = options.expectedInputSha256 ?? P193_EXPECTED.inputSha256;
  const inputSha256 = sha256(csvRaw);
  assertEqual(inputSha256, expectedInputSha256, "input SHA256");
  assertEqual(expectedInputSha256, P193_EXPECTED.inputSha256, "authorized P193 input SHA256");
  validateCommittedP193Artifact(committedMetricsRaw);

  const rows = parseRealOhlcvCsv(csvRaw);
  const samples = buildHistoricalFeatureRows(rows);
  const split = splitChronologically(samples);
  const scaler = fitTrainingScaler(split.train);
  const model = fitTrainingLogisticRegression(split.train, scaler);
  const evaluation = evaluateRefit(split.holdout, scaler, model);
  const dates = rows.map((row) => row.date).sort(compareText);

  assertEqual(rows.length, P193_EXPECTED.rowCount, "source row count");
  assertEqual(dates[0], P193_EXPECTED.dateStart, "source start date");
  assertEqual(dates[dates.length - 1], P193_EXPECTED.dateEnd, "source end date");
  assertEqual(split.train.length, P193_EXPECTED.trainRows, "training row count");
  assertEqual(split.holdout.length, P193_EXPECTED.holdoutRows, "holdout row count");
  assertEqual(split.purged.length, P193_EXPECTED.purgedRows, "purged row count");
  assertEqual(split.trainEndDate, P193_EXPECTED.trainEndDate, "train end date");
  assertEqual(split.holdoutStartDate, P193_EXPECTED.holdoutStartDate, "holdout start date");
  assertEqual(evaluation.accuracy, P193_EXPECTED.accuracy, "holdout accuracy at 8 decimals");
  assertEqual(
    evaluation.majorityBaseline,
    P193_EXPECTED.majorityBaseline,
    "majority baseline at 8 decimals",
  );
  assertEqual(
    JSON.stringify(evaluation.confusionMatrix),
    JSON.stringify(P193_EXPECTED.holdoutConfusionMatrix),
    "holdout confusion matrix",
  );
  assertEqual(scaler.fitRowCount, split.train.length, "scaler fit row count");
  assertEqual(model.fitRowCount, split.train.length, "model fit row count");
  assertEqual(model.fitRowIdentitySha256, scaler.fitRowIdentitySha256, "fit row identity");

  const latestTrainingFeatureDate = split.train.reduce(
    (latest, sample) => sample.featureDate > latest ? sample.featureDate : latest,
    split.train[0].featureDate,
  );
  const latestTrainingTargetDate = split.train.reduce(
    (latest, sample) => sample.targetDate > latest ? sample.targetDate : latest,
    split.train[0].targetDate,
  );
  if (latestTrainingTargetDate > split.trainEndDate) fail("training-label end-date guard failed");
  if (split.holdout.some((sample) => sample.featureDate <= split.trainEndDate)) {
    fail("holdout start-date guard failed");
  }
  if (samples.some((sample) => sample.featureSourceEndDate > sample.featureDate)) {
    fail("historical-only feature guard failed");
  }

  const scan = scanPriceDiscontinuities(rows);
  assertExpectedDiscontinuity(scan.discontinuities);

  return {
    reproductionStatus: "PASS",
    promotionEligibility: "BLOCKED_DATA_QUALITY",
    inputSha256,
    inputPath: "outputs/retraining/p194_twstock_ohlcv_export.csv",
    rowCount: rows.length,
    dataDateRange: { start: dates[0], end: dates[dates.length - 1] },
    trainRows: split.train.length,
    holdoutRows: split.holdout.length,
    purgedRows: split.purged.length,
    accuracy: evaluation.accuracy,
    majorityBaseline: evaluation.majorityBaseline,
    precision: evaluation.precision,
    recall: evaluation.recall,
    confusionMatrix: evaluation.confusionMatrix,
    trainEndDate: split.trainEndDate,
    holdoutStartDate: split.holdoutStartDate,
    featureNames: REAL_OHLCV_FEATURE_NAMES,
    leakageGuards: {
      historicalFeaturesOnly: true,
      trainingLabelsEndOnOrBeforeTrainEndDate: true,
      holdoutFeaturesBeginAfterTrainEndDate: true,
      scalerFitOnTrainingRowsOnly: true,
      modelFitOnTrainingRowsOnly: true,
      holdoutExcludedFromThresholdSelection: true,
    },
    fitEvidence: {
      scalerFitRows: scaler.fitRowCount,
      modelFitRows: model.fitRowCount,
      scalerFitRowIdentitySha256: scaler.fitRowIdentitySha256,
      modelFitRowIdentitySha256: model.fitRowIdentitySha256,
      scalerStateSha256: scaler.stateSha256,
      modelStateSha256: model.stateSha256,
      latestTrainingFeatureDate,
      latestTrainingTargetDate,
      decisionThreshold: P193_EXPECTED.threshold,
      thresholdSelection: "FIXED_BEFORE_HOLDOUT_EVALUATION",
    },
    discontinuities: scan.discontinuities,
    perSymbolDiscontinuityFindings: scan.perSymbol,
    warnings: [
      "UNADJUSTED_PRICE_DISCONTINUITY_RISK blocks promotion even though metric reproduction passes.",
      "The committed source lacks adjustment metadata sufficient to resolve the 0050 discontinuity.",
      "This deterministic result is diagnostic-only historical research and is not investment advice.",
    ],
  };
}
