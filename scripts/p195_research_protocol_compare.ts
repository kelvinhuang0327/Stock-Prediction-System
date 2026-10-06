import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const EXPECTED_ROOT = '/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System';
const OUTPUT_DIR = path.join(ROOT, 'outputs/retraining');
const CSV_PATH = path.join(OUTPUT_DIR, 'p194_twstock_ohlcv_export.csv');
const P194_MANIFEST_PATH = path.join(OUTPUT_DIR, 'p194_twstock_ohlcv_export_manifest.json');
const P193_METRICS_PATH = path.join(OUTPUT_DIR, 'p193_real_ohlcv_metrics.json');
const P193_REPORT_JSON_PATH = path.join(OUTPUT_DIR, 'p193_real_ohlcv_refit_report.json');
const METRICS_PATH = path.join(OUTPUT_DIR, 'p195_protocol_comparison_metrics.json');
const REPORT_JSON_PATH = path.join(OUTPUT_DIR, 'p195_protocol_comparison_report.json');
const REPORT_MD_PATH = path.join(OUTPUT_DIR, 'p195_protocol_comparison_report.md');
const COMMANDS_PATH = path.join(OUTPUT_DIR, 'p195_protocol_comparison_run_commands.txt');

const EXPECTED_CSV_SHA256 = '2d1aaee13c11015b7d9619e7fe45901cf87283694679a32a410ac03e4854185f';
const TRAIN_FRACTION = 0.7;
const LOOKBACK_ROWS = 20;
const ITERATIONS = 2500;
const LEARNING_RATE = 0.08;
const L2 = 0.01;

type FeatureName =
  | 'return_5d'
  | 'return_20d'
  | 'volatility_10d'
  | 'volume_ratio_20d'
  | 'intraday_range_pct';

type BlockedClassification =
  | 'P195_BLOCKED_CONTEXT_MISMATCH'
  | 'P195_BLOCKED_EVIDENCE_MISSING'
  | 'P195_BLOCKED_CSV_HASH_MISMATCH'
  | 'P195_BLOCKED_JSON_PARSE_FAILURE'
  | 'P195_BLOCKED_SCHEMA_INVALID';

interface CsvRow {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Sample {
  featureDate: string;
  targetDate: string;
  symbol: string;
  features: number[];
  target: 0 | 1;
}

interface Evaluation {
  sampleCount: number;
  positiveCount: number;
  negativeCount: number;
  accuracy: number;
  majorityBaselineAccuracy: number;
  precision: number;
  recall: number;
  brierScore: number;
  logLoss: number;
  probabilityMae: number;
  confusionMatrix: {
    truePositive: number;
    trueNegative: number;
    falsePositive: number;
    falseNegative: number;
  };
}

interface MacroEvaluation {
  symbolCount: number;
  accuracy: number;
  majorityBaselineAccuracy: number;
  precision: number;
  recall: number;
  brierScore: number;
  logLoss: number;
  probabilityMae: number;
}

interface VariantConfig {
  id: 'A' | 'B' | 'C' | 'D';
  name: string;
  targetHorizonRows: number;
  featureNames: FeatureName[];
  reportMacroMetrics: boolean;
}

interface P193Metrics {
  accuracy: number;
  majorityBaselineAccuracy: number;
}

interface P194Manifest {
  rowCount: number;
  csvSha256: string;
}

interface JsonReport {
  finalClassification: string;
}

function fail(classification: BlockedClassification, message: string): never {
  throw new Error(`${classification}: ${message}`);
}

function round(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

function mean(values: number[]): number {
  if (values.length === 0) fail('P195_BLOCKED_SCHEMA_INVALID', 'cannot compute mean of empty array');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const exp = Math.exp(-value);
    return 1 / (1 + exp);
  }
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function dot(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail('P195_BLOCKED_JSON_PARSE_FAILURE', `${label}: ${detail}`);
  }
}

function parseCsv(raw: string): { rows: CsvRow[]; header: string[] } {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) fail('P195_BLOCKED_EVIDENCE_MISSING', 'P194 CSV is empty or missing data rows');
  const header = lines[0].replace(/\r/g, '').split(',');
  const requiredColumns = ['symbol', 'date', 'open', 'high', 'low', 'close', 'volume'];
  for (const column of requiredColumns) {
    if (!header.includes(column)) {
      fail('P195_BLOCKED_SCHEMA_INVALID', `CSV missing required column: ${column}`);
    }
  }
  const indexOf = (column: string): number => header.indexOf(column);
  const rows = lines.slice(1).map((line, index) => {
    const fields = line.replace(/\r/g, '').split(',');
    if (fields.length !== header.length) {
      fail('P195_BLOCKED_SCHEMA_INVALID', `invalid CSV field count at data row ${index + 1}`);
    }
    const row = {
      symbol: fields[indexOf('symbol')],
      date: fields[indexOf('date')],
      open: Number(fields[indexOf('open')]),
      high: Number(fields[indexOf('high')]),
      low: Number(fields[indexOf('low')]),
      close: Number(fields[indexOf('close')]),
      volume: Number(fields[indexOf('volume')]),
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      fail('P195_BLOCKED_SCHEMA_INVALID', `invalid ISO date at data row ${index + 1}`);
    }
    if (!row.symbol) fail('P195_BLOCKED_SCHEMA_INVALID', `missing symbol at data row ${index + 1}`);
    if (![row.open, row.high, row.low, row.close, row.volume].every(Number.isFinite)) {
      fail('P195_BLOCKED_SCHEMA_INVALID', `non-numeric OHLCV value at data row ${index + 1}`);
    }
    return row;
  });
  return { rows, header };
}

function validateRows(rows: CsvRow[], manifest: P194Manifest): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.symbol}:${row.date}`;
    if (seen.has(key)) fail('P195_BLOCKED_SCHEMA_INVALID', `duplicate symbol/date row: ${key}`);
    seen.add(key);
  }
  if (rows.length !== manifest.rowCount) {
    fail('P195_BLOCKED_SCHEMA_INVALID', `CSV row count ${rows.length} differs from manifest ${manifest.rowCount}`);
  }
}

function bySymbol(rows: CsvRow[]): Map<string, CsvRow[]> {
  const grouped = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const symbolRows = grouped.get(row.symbol) ?? [];
    symbolRows.push(row);
    grouped.set(row.symbol, symbolRows);
  }
  for (const symbolRows of grouped.values()) {
    symbolRows.sort((left, right) => left.date.localeCompare(right.date));
  }
  return grouped;
}

function computeFeature(name: FeatureName, symbolRows: CsvRow[], index: number): number {
  const current = symbolRows[index];
  if (name === 'return_5d') return current.close / symbolRows[index - 5].close - 1;
  if (name === 'return_20d') return current.close / symbolRows[index - 20].close - 1;
  if (name === 'volatility_10d') {
    const returns10: number[] = [];
    for (let offset = index - 9; offset <= index; offset += 1) {
      returns10.push(symbolRows[offset].close / symbolRows[offset - 1].close - 1);
    }
    const averageReturn = mean(returns10);
    return Math.sqrt(mean(returns10.map((value) => (value - averageReturn) ** 2)));
  }
  if (name === 'volume_ratio_20d') {
    const averageVolume20 = mean(symbolRows.slice(index - 20, index).map((row) => row.volume));
    return current.volume / averageVolume20;
  }
  return (current.high - current.low) / current.close;
}

function buildSamples(rows: CsvRow[], horizonRows: number, featureNames: FeatureName[]): Sample[] {
  const samples: Sample[] = [];
  for (const [symbol, symbolRows] of bySymbol(rows)) {
    for (let index = LOOKBACK_ROWS; index + horizonRows < symbolRows.length; index += 1) {
      const current = symbolRows[index];
      const targetRow = symbolRows[index + horizonRows];
      const forwardReturn = targetRow.close / current.close - 1;
      samples.push({
        featureDate: current.date,
        targetDate: targetRow.date,
        symbol,
        features: featureNames.map((name) => computeFeature(name, symbolRows, index)),
        target: forwardReturn > 0 ? 1 : 0,
      });
    }
  }
  return samples.sort((left, right) =>
    left.featureDate.localeCompare(right.featureDate) || left.symbol.localeCompare(right.symbol),
  );
}

function fitScaler(samples: Sample[], featureCount: number): { means: number[]; standardDeviations: number[] } {
  const means = Array.from({ length: featureCount }, (_, featureIndex) =>
    mean(samples.map((sample) => sample.features[featureIndex])),
  );
  const standardDeviations = Array.from({ length: featureCount }, (_, featureIndex) => {
    const variance = mean(samples.map((sample) => (sample.features[featureIndex] - means[featureIndex]) ** 2));
    const standardDeviation = Math.sqrt(variance);
    return standardDeviation > 1e-12 ? standardDeviation : 1;
  });
  return { means, standardDeviations };
}

function transform(features: number[], means: number[], standardDeviations: number[]): number[] {
  return features.map((value, index) => (value - means[index]) / standardDeviations[index]);
}

function loss(samples: Sample[], weights: number[], means: number[], standardDeviations: number[]): number {
  const epsilon = 1e-12;
  const dataLoss = mean(samples.map((sample) => {
    const x = [1, ...transform(sample.features, means, standardDeviations)];
    const probability = sigmoid(dot(weights, x));
    return -(sample.target * Math.log(probability + epsilon)
      + (1 - sample.target) * Math.log(1 - probability + epsilon));
  }));
  return dataLoss + (L2 / 2) * weights.slice(1).reduce((sum, value) => sum + value ** 2, 0);
}

function fitLogisticRegression(
  samples: Sample[],
  featureCount: number,
  means: number[],
  standardDeviations: number[],
): { weights: number[]; initialLoss: number; finalLoss: number } {
  const weights = Array(featureCount + 1).fill(0) as number[];
  const initialLoss = loss(samples, weights, means, standardDeviations);
  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const gradient = Array(weights.length).fill(0) as number[];
    for (const sample of samples) {
      const x = [1, ...transform(sample.features, means, standardDeviations)];
      const error = sigmoid(dot(weights, x)) - sample.target;
      x.forEach((value, index) => {
        gradient[index] += error * value;
      });
    }
    weights.forEach((weight, index) => {
      const regularization = index === 0 ? 0 : L2 * weight;
      weights[index] -= LEARNING_RATE * (gradient[index] / samples.length + regularization);
    });
  }
  return { weights, initialLoss, finalLoss: loss(samples, weights, means, standardDeviations) };
}

function evaluate(samples: Sample[], weights: number[], means: number[], standardDeviations: number[]): Evaluation {
  if (samples.length === 0) fail('P195_BLOCKED_SCHEMA_INVALID', 'cannot evaluate empty sample set');
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let brierTotal = 0;
  let logLossTotal = 0;
  let maeTotal = 0;
  const epsilon = 1e-12;
  for (const sample of samples) {
    const x = [1, ...transform(sample.features, means, standardDeviations)];
    const probability = sigmoid(dot(weights, x));
    const prediction = probability >= 0.5 ? 1 : 0;
    if (prediction === 1 && sample.target === 1) truePositive += 1;
    if (prediction === 0 && sample.target === 0) trueNegative += 1;
    if (prediction === 1 && sample.target === 0) falsePositive += 1;
    if (prediction === 0 && sample.target === 1) falseNegative += 1;
    brierTotal += (probability - sample.target) ** 2;
    maeTotal += Math.abs(probability - sample.target);
    logLossTotal += -(sample.target * Math.log(probability + epsilon)
      + (1 - sample.target) * Math.log(1 - probability + epsilon));
  }
  const positives = truePositive + falseNegative;
  const negatives = trueNegative + falsePositive;
  const predictedPositives = truePositive + falsePositive;
  return {
    sampleCount: samples.length,
    positiveCount: positives,
    negativeCount: negatives,
    accuracy: round((truePositive + trueNegative) / samples.length),
    majorityBaselineAccuracy: round(Math.max(positives, negatives) / samples.length),
    precision: round(predictedPositives > 0 ? truePositive / predictedPositives : 0),
    recall: round(positives > 0 ? truePositive / positives : 0),
    brierScore: round(brierTotal / samples.length),
    logLoss: round(logLossTotal / samples.length),
    probabilityMae: round(maeTotal / samples.length),
    confusionMatrix: { truePositive, trueNegative, falsePositive, falseNegative },
  };
}

function macroAverage(evaluations: Record<string, Evaluation>): MacroEvaluation {
  const values = Object.values(evaluations);
  return {
    symbolCount: values.length,
    accuracy: round(mean(values.map((evaluation) => evaluation.accuracy))),
    majorityBaselineAccuracy: round(mean(values.map((evaluation) => evaluation.majorityBaselineAccuracy))),
    precision: round(mean(values.map((evaluation) => evaluation.precision))),
    recall: round(mean(values.map((evaluation) => evaluation.recall))),
    brierScore: round(mean(values.map((evaluation) => evaluation.brierScore))),
    logLoss: round(mean(values.map((evaluation) => evaluation.logLoss))),
    probabilityMae: round(mean(values.map((evaluation) => evaluation.probabilityMae))),
  };
}

function period(samples: Sample[], key: 'featureDate' | 'targetDate'): { start: string; end: string } {
  return { start: samples[0][key], end: samples[samples.length - 1][key] };
}

function interpret(accuracy: number, majorityBaselineAccuracy: number): string {
  if (accuracy > majorityBaselineAccuracy) {
    return 'positive historical evidence, preliminary only: holdout accuracy exceeded the majority-class baseline and requires reproduction before further claims.';
  }
  if (accuracy < majorityBaselineAccuracy) {
    return 'negative historical evidence: holdout accuracy was below the majority-class baseline in this bounded historical comparison.';
  }
  return 'inconclusive historical evidence: holdout accuracy matched the majority-class baseline in this bounded historical comparison.';
}

function runVariant(config: VariantConfig, rows: CsvRow[], p193: P193Metrics) {
  const samples = buildSamples(rows, config.targetHorizonRows, config.featureNames);
  const uniqueFeatureDates = [...new Set(samples.map((sample) => sample.featureDate))];
  if (uniqueFeatureDates.length < 60) {
    fail('P195_BLOCKED_SCHEMA_INVALID', `${config.id}: insufficient unique feature dates for chronological holdout`);
  }
  const splitDateIndex = Math.floor(uniqueFeatureDates.length * TRAIN_FRACTION) - 1;
  const trainEndDate = uniqueFeatureDates[splitDateIndex];
  const trainSamples = samples.filter((sample) => sample.targetDate <= trainEndDate);
  const holdoutSamples = samples.filter((sample) => sample.featureDate > trainEndDate);
  const purgedSamples = samples.filter(
    (sample) => sample.featureDate <= trainEndDate && sample.targetDate > trainEndDate,
  );
  if (trainSamples.length < 100 || holdoutSamples.length < 40) {
    fail(
      'P195_BLOCKED_SCHEMA_INVALID',
      `${config.id}: insufficient split train=${trainSamples.length} holdout=${holdoutSamples.length}`,
    );
  }

  const scaler = fitScaler(trainSamples, config.featureNames.length);
  const model = fitLogisticRegression(trainSamples, config.featureNames.length, scaler.means, scaler.standardDeviations);
  if (!(model.finalLoss < model.initialLoss)) {
    fail('P195_BLOCKED_SCHEMA_INVALID', `${config.id}: fit did not reduce regularized training loss`);
  }
  const trainEvaluation = evaluate(trainSamples, model.weights, scaler.means, scaler.standardDeviations);
  const holdoutEvaluation = evaluate(holdoutSamples, model.weights, scaler.means, scaler.standardDeviations);
  const symbols = [...new Set(rows.map((row) => row.symbol))].sort();
  const holdoutBySymbol = Object.fromEntries(symbols.map((symbol) => [
    symbol,
    evaluate(
      holdoutSamples.filter((sample) => sample.symbol === symbol),
      model.weights,
      scaler.means,
      scaler.standardDeviations,
    ),
  ])) as Record<string, Evaluation>;
  const macroMetrics = config.reportMacroMetrics ? macroAverage(holdoutBySymbol) : null;
  const primaryAccuracy = macroMetrics?.accuracy ?? holdoutEvaluation.accuracy;
  const primaryMajorityBaseline = macroMetrics?.majorityBaselineAccuracy ?? holdoutEvaluation.majorityBaselineAccuracy;

  return {
    variantId: config.id,
    name: config.name,
    rowsUsed: rows.length,
    symbols,
    sampleCount: samples.length,
    trainSampleCount: trainSamples.length,
    holdoutSampleCount: holdoutSamples.length,
    purgedSampleCount: purgedSamples.length,
    featureCount: config.featureNames.length,
    featureNames: config.featureNames,
    targetDefinition: `1 when close[t+${config.targetHorizonRows} trading rows] / close[t] - 1 > 0; otherwise 0`,
    validationBoundary: {
      method: `chronological 70/30 holdout with a ${config.targetHorizonRows}-row purge gap`,
      trainFeaturePeriod: period(trainSamples, 'featureDate'),
      trainTargetPeriod: period(trainSamples, 'targetDate'),
      trainEndDate,
      holdoutFeaturePeriod: period(holdoutSamples, 'featureDate'),
      holdoutTargetPeriod: period(holdoutSamples, 'targetDate'),
      purgedBoundarySampleCount: purgedSamples.length,
      leakageGuard: 'training labels end on or before trainEndDate; holdout features begin after trainEndDate',
    },
    trainMetrics: trainEvaluation,
    holdoutMetrics: holdoutEvaluation,
    holdoutMetricsBySymbol: holdoutBySymbol,
    macroHoldoutMetrics: macroMetrics,
    primaryEvaluation: macroMetrics
      ? 'macro-average across symbols, with pooled metrics also reported'
      : 'pooled chronological holdout',
    accuracy: primaryAccuracy,
    majorityBaselineAccuracy: primaryMajorityBaseline,
    precision: macroMetrics?.precision ?? holdoutEvaluation.precision,
    recall: macroMetrics?.recall ?? holdoutEvaluation.recall,
    brierScore: macroMetrics?.brierScore ?? holdoutEvaluation.brierScore,
    logLoss: macroMetrics?.logLoss ?? holdoutEvaluation.logLoss,
    deltaVsP193BaselineAccuracy: round(primaryAccuracy - p193.accuracy),
    deltaVsP193MajorityBaselineAccuracy: round(primaryAccuracy - p193.majorityBaselineAccuracy),
    deltaVsVariantMajorityBaseline: round(primaryAccuracy - primaryMajorityBaseline),
    interpretation: interpret(primaryAccuracy, primaryMajorityBaseline),
    fit: {
      algorithm: 'binary logistic regression by deterministic full-batch gradient descent',
      iterations: ITERATIONS,
      learningRate: LEARNING_RATE,
      l2: L2,
      initialRegularizedTrainLoss: round(model.initialLoss),
      finalRegularizedTrainLoss: round(model.finalLoss),
      standardizedCoefficients: Object.fromEntries(
        ['intercept', ...config.featureNames].map((name, index) => [name, round(model.weights[index])]),
      ),
      trainingFeatureMeans: Object.fromEntries(
        config.featureNames.map((name, index) => [name, round(scaler.means[index])]),
      ),
      trainingFeatureStandardDeviations: Object.fromEntries(
        config.featureNames.map((name, index) => [name, round(scaler.standardDeviations[index])]),
      ),
    },
  };
}

function markdownTable(rows: ReturnType<typeof runVariant>[]): string {
  const lines = [
    '| Variant | Primary eval | Accuracy | Majority baseline | Delta vs P193 acc | Delta vs majority | Brier | Log loss | Interpretation |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const row of rows) {
    lines.push([
      `| ${row.variantId}`,
      row.primaryEvaluation,
      row.accuracy,
      row.majorityBaselineAccuracy,
      row.deltaVsP193BaselineAccuracy,
      row.deltaVsVariantMajorityBaseline,
      row.brierScore,
      row.logLoss,
      row.interpretation,
    ].join(' | ') + ' |');
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  if (ROOT !== EXPECTED_ROOT) fail('P195_BLOCKED_CONTEXT_MISMATCH', `unexpected working directory: ${ROOT}`);
  const [csvRaw, manifestRaw, p193MetricsRaw, p193ReportRaw] = await Promise.all([
    readFile(CSV_PATH, 'utf8').catch(() => fail('P195_BLOCKED_EVIDENCE_MISSING', 'missing P194 CSV')),
    readFile(P194_MANIFEST_PATH, 'utf8').catch(() => fail('P195_BLOCKED_EVIDENCE_MISSING', 'missing P194 manifest JSON')),
    readFile(P193_METRICS_PATH, 'utf8').catch(() => fail('P195_BLOCKED_EVIDENCE_MISSING', 'missing P193 metrics JSON')),
    readFile(P193_REPORT_JSON_PATH, 'utf8').catch(() => fail('P195_BLOCKED_EVIDENCE_MISSING', 'missing P193 report JSON')),
  ]);
  const sourceSha256 = createHash('sha256').update(csvRaw).digest('hex');
  if (sourceSha256 !== EXPECTED_CSV_SHA256) {
    fail('P195_BLOCKED_CSV_HASH_MISMATCH', `expected ${EXPECTED_CSV_SHA256}, got ${sourceSha256}`);
  }
  const manifest = parseJson<P194Manifest>(manifestRaw, 'P194 manifest');
  const p193Metrics = parseJson<P193Metrics>(p193MetricsRaw, 'P193 metrics');
  const p193Report = parseJson<JsonReport>(p193ReportRaw, 'P193 report JSON');
  if (manifest.csvSha256 !== EXPECTED_CSV_SHA256) {
    fail('P195_BLOCKED_CSV_HASH_MISMATCH', `manifest hash ${manifest.csvSha256} did not match expected`);
  }
  const { rows, header } = parseCsv(csvRaw);
  validateRows(rows, manifest);
  const symbols = [...new Set(rows.map((row) => row.symbol))].sort();
  const dates = rows.map((row) => row.date).sort();

  const variants: VariantConfig[] = [
    {
      id: 'A',
      name: 'P193 baseline reproduction',
      targetHorizonRows: 5,
      featureNames: ['return_5d', 'return_20d', 'volatility_10d', 'volume_ratio_20d', 'intraday_range_pct'],
      reportMacroMetrics: false,
    },
    {
      id: 'B',
      name: 'Longer horizon',
      targetHorizonRows: 10,
      featureNames: ['return_5d', 'return_20d', 'volatility_10d', 'volume_ratio_20d', 'intraday_range_pct'],
      reportMacroMetrics: false,
    },
    {
      id: 'C',
      name: 'Conservative features',
      targetHorizonRows: 5,
      featureNames: ['return_5d', 'return_20d', 'volatility_10d', 'intraday_range_pct'],
      reportMacroMetrics: false,
    },
    {
      id: 'D',
      name: 'Per-symbol balanced evaluation',
      targetHorizonRows: 5,
      featureNames: ['return_5d', 'return_20d', 'volatility_10d', 'volume_ratio_20d', 'intraday_range_pct'],
      reportMacroMetrics: true,
    },
  ];

  const variantResults = variants.map((variant) => runVariant(variant, rows, p193Metrics));
  const anyPositive = variantResults.some((variant) => variant.accuracy > variant.majorityBaselineAccuracy);
  const anyInconclusive = variantResults.some((variant) => variant.accuracy === variant.majorityBaselineAccuracy);
  const finalClassification = anyPositive
    ? 'P195_PROTOCOL_COMPARISON_COMPLETE_POSITIVE_PRELIMINARY_HISTORICAL_EVIDENCE'
    : anyInconclusive
      ? 'P195_PROTOCOL_COMPARISON_COMPLETE_INCONCLUSIVE'
      : 'P195_PROTOCOL_COMPARISON_COMPLETE_NEGATIVE_HISTORICAL_EVIDENCE';

  const commonLimitations = [
    'This is bounded historical research only.',
    'This is not investment advice.',
    'This is not trading readiness.',
    'This is not product readiness.',
    'This is not proof of future prediction ability.',
    'Any variant beating the majority baseline is preliminary only and requires reproduction before further claims.',
  ];
  const filesWritten = [
    'scripts/p195_research_protocol_compare.ts',
    'outputs/retraining/p195_protocol_comparison_metrics.json',
    'outputs/retraining/p195_protocol_comparison_report.md',
    'outputs/retraining/p195_protocol_comparison_report.json',
    'outputs/retraining/p195_protocol_comparison_run_commands.txt',
  ];
  const commands = [
    'pwd',
    'git rev-parse --show-toplevel',
    'git branch --show-current',
    'git rev-parse --short HEAD',
    'git status --short --untracked-files=all',
    'git diff --name-only',
    'git diff --cached --name-only',
    'git status --short --untracked-files=all -- prisma/dev.db prisma/dev.db-shm prisma/dev.db-wal',
    'git diff --name-only -- prisma/dev.db prisma/dev.db-shm prisma/dev.db-wal',
    'shasum -a 256 outputs/retraining/p194_twstock_ohlcv_export.csv',
    'jq . outputs/retraining/p194_twstock_ohlcv_export_manifest.json',
    'jq . outputs/retraining/p193_real_ohlcv_metrics.json',
    'jq . outputs/retraining/p193_real_ohlcv_refit_report.json',
    `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' ./node_modules/.bin/ts-node scripts/p195_research_protocol_compare.ts`,
    'jq . outputs/retraining/p195_protocol_comparison_metrics.json',
    'jq . outputs/retraining/p195_protocol_comparison_report.json',
    'git status --short --untracked-files=all -- prisma/dev.db prisma/dev.db-shm prisma/dev.db-wal',
    'git diff --name-only -- prisma/dev.db prisma/dev.db-shm prisma/dev.db-wal',
    'git diff --check',
    'git diff --cached --name-only',
    './node_modules/.bin/eslint scripts/p195_research_protocol_compare.ts',
  ].join('\n');

  const metrics = {
    schemaVersion: 'p195.protocol_comparison.1',
    finalClassification,
    repository: ROOT,
    deterministic: true,
    localOnly: true,
    externalNetworkUsedDuringComparison: false,
    canonicalDbRead: false,
    canonicalDbWrite: false,
    evidenceVerification: {
      csvExists: true,
      csvSha256: sourceSha256,
      manifestJsonParses: true,
      p193MetricsJsonParses: true,
      p193ReportJsonParses: true,
      csvRequiredColumnsPresent: ['symbol', 'date', 'open', 'high', 'low', 'close', 'volume'].every((column) =>
        header.includes(column),
      ),
      duplicateSymbolDateRows: 0,
      rowCount: rows.length,
      manifestRowCount: manifest.rowCount,
      p193FinalClassification: p193Report.finalClassification,
    },
    sourceData: {
      path: 'outputs/retraining/p194_twstock_ohlcv_export.csv',
      sha256: sourceSha256,
      rows: rows.length,
      symbols,
      dateRange: { start: dates[0], end: dates[dates.length - 1] },
      boundedPitSafety: 'BOUNDED_PASS_WITH_SOURCE_LIMITATION',
    },
    p193Baseline: {
      accuracy: p193Metrics.accuracy,
      majorityBaselineAccuracy: p193Metrics.majorityBaselineAccuracy,
    },
    leakageRules: {
      features: 'features use only same-row or prior-row OHLCV values',
      target: 'future close is used only for label generation',
      split: 'chronological holdout with horizon-specific purge boundary',
    },
    variants: variantResults,
    limitations: commonLimitations,
    filesWritten,
    gitActions: { staged: false, committed: false, pushed: false },
  };

  const report = {
    schemaVersion: 'p195.protocol_comparison_report.1',
    finalClassification,
    repository: ROOT,
    branch: 'main',
    comparisonExecuted: true,
    sourceCsvSha256: sourceSha256,
    p193Baseline: metrics.p193Baseline,
    variants: variantResults.map((variant) => ({
      variantId: variant.variantId,
      name: variant.name,
      targetDefinition: variant.targetDefinition,
      featureNames: variant.featureNames,
      trainSampleCount: variant.trainSampleCount,
      holdoutSampleCount: variant.holdoutSampleCount,
      purgedSampleCount: variant.purgedSampleCount,
      primaryEvaluation: variant.primaryEvaluation,
      accuracy: variant.accuracy,
      majorityBaselineAccuracy: variant.majorityBaselineAccuracy,
      precision: variant.precision,
      recall: variant.recall,
      brierScore: variant.brierScore,
      logLoss: variant.logLoss,
      deltaVsP193BaselineAccuracy: variant.deltaVsP193BaselineAccuracy,
      deltaVsVariantMajorityBaseline: variant.deltaVsVariantMajorityBaseline,
      interpretation: variant.interpretation,
      macroHoldoutMetrics: variant.macroHoldoutMetrics,
    })),
    conclusion: anyPositive
      ? 'At least one bounded historical protocol variant beat its majority baseline, but this is preliminary only and requires reproduction before further claims.'
      : anyInconclusive
        ? 'No bounded historical protocol variant produced clear positive evidence; at least one matched its majority baseline.'
        : 'No bounded historical protocol variant beat its majority baseline.',
    cannotClaim: commonLimitations.slice(1),
    recommendedNextStep: anyPositive
      ? 'reproduce best variant'
      : 'pause model direction',
    filesWritten,
    gitActions: { staged: false, committed: false, pushed: false },
  };

  const markdown = `# P195 Protocol Comparison Report\n\n` +
    `- Final classification: \`${finalClassification}\`\n` +
    `- Source CSV: \`outputs/retraining/p194_twstock_ohlcv_export.csv\`\n` +
    `- CSV SHA256: \`${sourceSha256}\`\n` +
    `- Rows / symbols: ${rows.length} / ${symbols.join(', ')}\n` +
    `- Date range: ${dates[0]} to ${dates[dates.length - 1]}\n` +
    `- P193 baseline accuracy: ${p193Metrics.accuracy}\n` +
    `- P193 majority baseline accuracy: ${p193Metrics.majorityBaselineAccuracy}\n\n` +
    `## Bounded Historical Research Limits\n\n` +
    commonLimitations.map((limitation) => `- ${limitation}`).join('\n') +
    `\n\n## Variant Metrics\n\n` +
    markdownTable(variantResults) +
    `\n\n## Interpretation\n\n` +
    `${report.conclusion}\n\n` +
    `Recommended next step: ${report.recommendedNextStep}.\n`;

  await mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all([
    writeFile(METRICS_PATH, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8'),
    writeFile(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(REPORT_MD_PATH, markdown, 'utf8'),
    writeFile(COMMANDS_PATH, `${commands}\n`, 'utf8'),
  ]);
  console.log(JSON.stringify({
    status: 'complete',
    finalClassification,
    sourceSha256,
    variants: variantResults.map((variant) => ({
      variantId: variant.variantId,
      accuracy: variant.accuracy,
      majorityBaselineAccuracy: variant.majorityBaselineAccuracy,
      deltaVsP193BaselineAccuracy: variant.deltaVsP193BaselineAccuracy,
      deltaVsVariantMajorityBaseline: variant.deltaVsVariantMajorityBaseline,
    })),
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
