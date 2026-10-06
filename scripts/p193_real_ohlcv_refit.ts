import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const INPUT_PATH = path.join(ROOT, 'outputs/retraining/p194_twstock_ohlcv_export.csv');
const OUTPUT_DIR = path.join(ROOT, 'outputs/retraining');
const METRICS_PATH = path.join(OUTPUT_DIR, 'p193_real_ohlcv_metrics.json');
const REPORT_JSON_PATH = path.join(OUTPUT_DIR, 'p193_real_ohlcv_refit_report.json');
const REPORT_MD_PATH = path.join(OUTPUT_DIR, 'p193_real_ohlcv_refit_report.md');
const COMMANDS_PATH = path.join(OUTPUT_DIR, 'p193_real_ohlcv_run_commands.txt');
const PREDICTIONS_PATH = path.join(OUTPUT_DIR, 'p193_latest_predictions.json');
const HISTORY_PATH = path.join(OUTPUT_DIR, 'strategy_lab_run_history.json');

const FEATURE_NAMES = [
  'return_5d',
  'return_20d',
  'volatility_10d',
  'volume_ratio_20d',
  'intraday_range_pct',
] as const;
const HORIZON_DAYS = 5;
const LOOKBACK_DAYS = 20;
const TRAIN_FRACTION = 0.7;
const ITERATIONS = 2500;
const LEARNING_RATE = 0.08;
const L2 = 0.01;

interface CsvRow {
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

interface Sample {
  featureDate: string;
  targetDate: string;
  symbol: string;
  features: number[];
  target: 0 | 1;
  forwardReturn: number;
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

function fail(message: string): never {
  throw new Error(`P193 real OHLCV refit fail-closed: ${message}`);
}

function round(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

function mean(values: number[]): number {
  if (values.length === 0) fail('cannot compute mean of empty array');
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

function parseCsv(raw: string): CsvRow[] {
  const lines = raw.trim().split(/\r?\n/);
  const expectedHeader = 'symbol,date,open,high,low,close,volume,source,fetched_at_utc';
  if (lines.shift() !== expectedHeader) fail('unexpected CSV header');
  return lines.map((line, index) => {
    const fields = line.split(',');
    if (fields.length !== 9) fail(`invalid CSV field count at data row ${index + 1}`);
    const [symbol, date, open, high, low, close, volume, source, fetchedAtUtc] = fields;
    const numeric = [open, high, low, close, volume].map(Number);
    if (numeric.some((value) => !Number.isFinite(value))) {
      fail(`non-numeric OHLCV value at data row ${index + 1}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`invalid ISO date at data row ${index + 1}`);
    if (!source.startsWith('twstock/')) fail(`unexpected source at data row ${index + 1}`);
    return {
      symbol,
      date,
      open: numeric[0],
      high: numeric[1],
      low: numeric[2],
      close: numeric[3],
      volume: numeric[4],
      source,
      fetchedAtUtc,
    };
  });
}

function validateRows(rows: CsvRow[]): void {
  if (rows.length < 100) fail(`insufficient source rows: ${rows.length}`);
  const sorted = [...rows].sort((left, right) =>
    left.symbol.localeCompare(right.symbol) || left.date.localeCompare(right.date),
  );
  if (JSON.stringify(rows.map((row) => [row.symbol, row.date])) !== JSON.stringify(sorted.map((row) => [row.symbol, row.date]))) {
    fail('CSV is not sorted by symbol asc, date asc');
  }
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.symbol}:${row.date}`;
    if (seen.has(key)) fail(`duplicate symbol/date row: ${key}`);
    seen.add(key);
  }
}

function groupBySymbolSorted(rows: CsvRow[]): Map<string, CsvRow[]> {
  const bySymbol = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const symbolRows = bySymbol.get(row.symbol) ?? [];
    symbolRows.push(row);
    bySymbol.set(row.symbol, symbolRows);
  }
  for (const symbolRows of bySymbol.values()) {
    symbolRows.sort((left, right) => left.date.localeCompare(right.date));
  }
  return bySymbol;
}

function computeFeatures(symbolRows: CsvRow[], index: number): number[] {
  const current = symbolRows[index];
  const returns10: number[] = [];
  for (let offset = index - 9; offset <= index; offset += 1) {
    returns10.push(symbolRows[offset].close / symbolRows[offset - 1].close - 1);
  }
  const averageReturn = mean(returns10);
  const variance = mean(returns10.map((value) => (value - averageReturn) ** 2));
  const averageVolume20 = mean(symbolRows.slice(index - 20, index).map((row) => row.volume));
  return [
    current.close / symbolRows[index - 5].close - 1,
    current.close / symbolRows[index - 20].close - 1,
    Math.sqrt(variance),
    current.volume / averageVolume20,
    (current.high - current.low) / current.close,
  ];
}

function buildSamples(bySymbol: Map<string, CsvRow[]>): Sample[] {
  const samples: Sample[] = [];
  for (const [symbol, symbolRows] of bySymbol) {
    for (let index = LOOKBACK_DAYS; index + HORIZON_DAYS < symbolRows.length; index += 1) {
      const current = symbolRows[index];
      const targetRow = symbolRows[index + HORIZON_DAYS];
      const forwardReturn = targetRow.close / current.close - 1;
      samples.push({
        featureDate: current.date,
        targetDate: targetRow.date,
        symbol,
        features: computeFeatures(symbolRows, index),
        target: forwardReturn > 0 ? 1 : 0,
        forwardReturn,
      });
    }
  }
  return samples.sort((left, right) =>
    left.featureDate.localeCompare(right.featureDate) || left.symbol.localeCompare(right.symbol),
  );
}

function fitScaler(samples: Sample[]): { means: number[]; standardDeviations: number[] } {
  const means = FEATURE_NAMES.map((_, featureIndex) =>
    mean(samples.map((sample) => sample.features[featureIndex])),
  );
  const standardDeviations = FEATURE_NAMES.map((_, featureIndex) => {
    const variance = mean(
      samples.map((sample) => (sample.features[featureIndex] - means[featureIndex]) ** 2),
    );
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
  means: number[],
  standardDeviations: number[],
): { weights: number[]; initialLoss: number; finalLoss: number } {
  const weights = Array(FEATURE_NAMES.length + 1).fill(0) as number[];
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

function evaluate(
  samples: Sample[],
  weights: number[],
  means: number[],
  standardDeviations: number[],
): Evaluation {
  if (samples.length === 0) fail('cannot evaluate empty sample set');
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

function period(samples: Sample[], key: 'featureDate' | 'targetDate'): { start: string; end: string } {
  return { start: samples[0][key], end: samples[samples.length - 1][key] };
}

interface OpenPrediction {
  symbol: string;
  featureDate: string;
  close: number;
  probabilityUp: number;
  predictedDirection: 'up' | 'down';
  isLatest: boolean;
}

interface ResolvedPrediction {
  symbol: string;
  featureDate: string;
  targetDate: string;
  probabilityUp: number;
  predictedDirection: 'up' | 'down';
  actualDirection: 'up' | 'down';
  forwardReturn: number;
  correct: boolean;
}

function predictProbability(
  features: number[],
  weights: number[],
  means: number[],
  standardDeviations: number[],
): number {
  return sigmoid(dot(weights, [1, ...transform(features, means, standardDeviations)]));
}

function buildOpenPredictions(
  bySymbol: Map<string, CsvRow[]>,
  weights: number[],
  means: number[],
  standardDeviations: number[],
): OpenPrediction[] {
  const predictions: OpenPrediction[] = [];
  for (const [symbol, symbolRows] of bySymbol) {
    // Rows whose 5-trading-row target lies beyond the data end: unresolved forward predictions.
    const firstOpenIndex = Math.max(LOOKBACK_DAYS, symbolRows.length - HORIZON_DAYS);
    for (let index = firstOpenIndex; index < symbolRows.length; index += 1) {
      const probability = predictProbability(
        computeFeatures(symbolRows, index),
        weights,
        means,
        standardDeviations,
      );
      predictions.push({
        symbol,
        featureDate: symbolRows[index].date,
        close: symbolRows[index].close,
        probabilityUp: round(probability),
        predictedDirection: probability >= 0.5 ? 'up' : 'down',
        isLatest: index === symbolRows.length - 1,
      });
    }
  }
  return predictions.sort((left, right) =>
    left.symbol.localeCompare(right.symbol) || left.featureDate.localeCompare(right.featureDate),
  );
}

function buildRecentResolved(
  testSamples: Sample[],
  weights: number[],
  means: number[],
  standardDeviations: number[],
  perSymbolLimit = 8,
): ResolvedPrediction[] {
  const bySymbol = new Map<string, Sample[]>();
  for (const sample of testSamples) {
    const symbolSamples = bySymbol.get(sample.symbol) ?? [];
    symbolSamples.push(sample);
    bySymbol.set(sample.symbol, symbolSamples);
  }
  const resolved: ResolvedPrediction[] = [];
  for (const [symbol, symbolSamples] of bySymbol) {
    symbolSamples.sort((left, right) => left.featureDate.localeCompare(right.featureDate));
    for (const sample of symbolSamples.slice(-perSymbolLimit)) {
      const probability = predictProbability(sample.features, weights, means, standardDeviations);
      const predictedDirection = probability >= 0.5 ? 'up' : 'down';
      const actualDirection = sample.target === 1 ? 'up' : 'down';
      resolved.push({
        symbol,
        featureDate: sample.featureDate,
        targetDate: sample.targetDate,
        probabilityUp: round(probability),
        predictedDirection,
        actualDirection,
        forwardReturn: round(sample.forwardReturn),
        correct: predictedDirection === actualDirection,
      });
    }
  }
  return resolved.sort((left, right) =>
    right.featureDate.localeCompare(left.featureDate) || left.symbol.localeCompare(right.symbol),
  );
}

interface RunHistoryEntry {
  executedAt: string;
  runId: string;
  rows: number;
  dataEndDate: string;
  trainSampleCount: number;
  holdoutSampleCount: number;
  holdoutAccuracy: number;
  majorityBaselineAccuracy: number;
  deltaVsBaseline: number;
  finalClassification: string;
}

async function appendRunHistory(entry: RunHistoryEntry): Promise<number> {
  let runs: unknown[] = [];
  try {
    const parsed = JSON.parse(await readFile(HISTORY_PATH, 'utf8')) as { runs?: unknown };
    if (Array.isArray(parsed.runs)) runs = parsed.runs;
  } catch {
    // Missing or unreadable history: start a fresh log rather than failing the refit.
  }
  runs.push(entry);
  const trimmed = runs.slice(-100);
  const payload = {
    schemaVersion: 'strategy_lab.run_history.1',
    note: 'Execution log of P193 refit runs. executedAt is wall-clock and intentionally non-deterministic; metrics artifacts stay deterministic.',
    runs: trimmed,
  };
  await writeFile(HISTORY_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return trimmed.length;
}

async function main(): Promise<void> {
  if (ROOT !== '/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System') {
    fail(`unexpected working directory: ${ROOT}`);
  }
  const csvRaw = await readFile(INPUT_PATH, 'utf8');
  const rows = parseCsv(csvRaw);
  validateRows(rows);
  const rowsBySymbol = groupBySymbolSorted(rows);
  const samples = buildSamples(rowsBySymbol);
  const uniqueFeatureDates = [...new Set(samples.map((sample) => sample.featureDate))];
  if (uniqueFeatureDates.length < 60) fail('insufficient unique feature dates for chronological holdout');
  const splitDateIndex = Math.floor(uniqueFeatureDates.length * TRAIN_FRACTION) - 1;
  const trainEndDate = uniqueFeatureDates[splitDateIndex];
  const trainSamples = samples.filter((sample) => sample.targetDate <= trainEndDate);
  const testSamples = samples.filter((sample) => sample.featureDate > trainEndDate);
  const purgedSamples = samples.filter(
    (sample) => sample.featureDate <= trainEndDate && sample.targetDate > trainEndDate,
  );
  if (trainSamples.length < 100 || testSamples.length < 40) {
    fail(`insufficient split: train=${trainSamples.length}, test=${testSamples.length}`);
  }

  const scaler = fitScaler(trainSamples);
  const model = fitLogisticRegression(trainSamples, scaler.means, scaler.standardDeviations);
  if (!(model.finalLoss < model.initialLoss)) fail('fit did not reduce regularized training loss');
  const trainEvaluation = evaluate(trainSamples, model.weights, scaler.means, scaler.standardDeviations);
  const testEvaluation = evaluate(testSamples, model.weights, scaler.means, scaler.standardDeviations);
  const sourceSha256 = createHash('sha256').update(csvRaw).digest('hex');
  const symbols = [...new Set(rows.map((row) => row.symbol))].sort();
  const dates = rows.map((row) => row.date).sort();
  const interpretation =
    testEvaluation.accuracy > testEvaluation.majorityBaselineAccuracy
      ? 'positive historical evidence: holdout accuracy exceeded the majority-class baseline in this bounded historical refit.'
      : testEvaluation.accuracy < testEvaluation.majorityBaselineAccuracy
        ? 'negative historical evidence: holdout accuracy was below the majority-class baseline in this bounded historical refit.'
        : 'inconclusive historical evidence: holdout accuracy matched the majority-class baseline in this bounded historical refit.';
  const finalClassification =
    testEvaluation.accuracy < testEvaluation.majorityBaselineAccuracy
      ? 'P194_TWSTOCK_EXPORT_AND_P193_REFIT_COMPLETE_NEGATIVE_HISTORICAL_EVIDENCE'
      : 'P194_TWSTOCK_EXPORT_AND_P193_REFIT_COMPLETE_INCONCLUSIVE';
  const coefficientEntries = Object.fromEntries(
    ['intercept', ...FEATURE_NAMES].map((name, index) => [name, round(model.weights[index])]),
  );
  const perSymbolTest = Object.fromEntries(symbols.map((symbol) => [
    symbol,
    evaluate(
      testSamples.filter((sample) => sample.symbol === symbol),
      model.weights,
      scaler.means,
      scaler.standardDeviations,
    ),
  ]));

  const metrics = {
    schemaVersion: 'p193.real_ohlcv_refit.1',
    runId: `p193-real-ohlcv-${sourceSha256.slice(0, 12)}-${trainEndDate}`,
    deterministic: true,
    localOnly: true,
    externalNetworkUsedDuringRefit: false,
    canonicalDbRead: false,
    canonicalDbWrite: false,
    rows: rows.length,
    symbols,
    dateRange: { start: dates[0], end: dates[dates.length - 1] },
    trainSampleCount: trainSamples.length,
    holdoutSampleCount: testSamples.length,
    purgedSampleCount: purgedSamples.length,
    featureCount: FEATURE_NAMES.length,
    targetDefinition: '1 when close[t+5 trading rows] / close[t] - 1 > 0; otherwise 0',
    accuracy: testEvaluation.accuracy,
    majorityBaselineAccuracy: testEvaluation.majorityBaselineAccuracy,
    precision: testEvaluation.precision,
    recall: testEvaluation.recall,
    brierScore: testEvaluation.brierScore,
    logLoss: testEvaluation.logLoss,
    interpretation,
    caveat: 'This is not investment advice and not proof of future prediction ability.',
    data: {
      source: 'outputs/retraining/p194_twstock_ohlcv_export.csv',
      sourceSha256,
      sourceNature: 'controlled real OHLCV export generated by twstock',
    },
    features: {
      names: FEATURE_NAMES,
      lookbackTradingRows: LOOKBACK_DAYS,
      scalerFitOnTrainingOnly: true,
      leakageGuard: 'features use only same-row or prior-row OHLCV values; no future columns are used as features',
    },
    validationBoundary: {
      method: 'chronological 70/30 holdout with a five-row purge gap',
      trainFeaturePeriod: period(trainSamples, 'featureDate'),
      trainTargetPeriod: period(trainSamples, 'targetDate'),
      trainEndDate,
      testFeaturePeriod: period(testSamples, 'featureDate'),
      testTargetPeriod: period(testSamples, 'targetDate'),
      purgedBoundarySampleCount: purgedSamples.length,
      leakageGuard: 'training labels end on or before trainEndDate; test features begin after trainEndDate',
    },
    fit: {
      algorithm: 'binary logistic regression by deterministic full-batch gradient descent',
      iterations: ITERATIONS,
      learningRate: LEARNING_RATE,
      l2: L2,
      initialRegularizedTrainLoss: round(model.initialLoss),
      finalRegularizedTrainLoss: round(model.finalLoss),
      standardizedCoefficients: coefficientEntries,
      trainingFeatureMeans: Object.fromEntries(FEATURE_NAMES.map((name, index) => [name, round(scaler.means[index])])),
      trainingFeatureStandardDeviations: Object.fromEntries(
        FEATURE_NAMES.map((name, index) => [name, round(scaler.standardDeviations[index])]),
      ),
    },
    metrics: {
      train: trainEvaluation,
      chronologicalHoldout: testEvaluation,
      chronologicalHoldoutBySymbol: perSymbolTest,
    },
    limitations: [
      'twstock does not provide full point-in-time archival metadata in the exported CSV.',
      'This run does not establish future predictive ability.',
      'This artifact is not investment advice and must not be used for trading.',
      'No transaction-cost, portfolio, ROI, or Sharpe claim is made.',
    ],
  };

  const openPredictions = buildOpenPredictions(
    rowsBySymbol,
    model.weights,
    scaler.means,
    scaler.standardDeviations,
  );
  const recentResolved = buildRecentResolved(
    testSamples,
    model.weights,
    scaler.means,
    scaler.standardDeviations,
  );
  const latestPredictions = {
    schemaVersion: 'p193.latest_predictions.1',
    runId: metrics.runId,
    sourceSha256,
    dataEndDate: dates[dates.length - 1],
    horizonTradingDays: HORIZON_DAYS,
    modelNote: 'Predictions use the same weights as the chronological holdout evaluation, trained on the 70% chronological train split only.',
    holdoutAccuracy: testEvaluation.accuracy,
    holdoutMajorityBaselineAccuracy: testEvaluation.majorityBaselineAccuracy,
    modelBeatsBaseline: testEvaluation.accuracy > testEvaluation.majorityBaselineAccuracy,
    caveat: 'Research pipeline output only. Not investment advice; must not be used for trading.',
    openPredictions,
    recentResolved,
  };

  const report = {
    schemaVersion: 'p193.real_ohlcv_refit_report.1',
    finalClassification,
    repository: ROOT,
    branch: 'main',
    trueRetrainingExecuted: true,
    run: {
      command: `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node scripts/p193_real_ohlcv_refit.ts`,
      runId: metrics.runId,
      sampleCount: trainSamples.length + testSamples.length,
      trainSampleCount: trainSamples.length,
      holdoutSampleCount: testSamples.length,
      purgedSampleCount: purgedSamples.length,
      featureCount: FEATURE_NAMES.length,
      targetDefinition: metrics.targetDefinition,
      validationBoundary: metrics.validationBoundary,
      holdoutMetrics: testEvaluation,
      interpretation,
    },
    validation: {
      csvSchemaValidation: 'PASS',
      boundedPitSafetyValidation: 'BOUNDED_PASS_WITH_SOURCE_LIMITATION',
      refitReadsOnly: 'outputs/retraining/p194_twstock_ohlcv_export.csv',
      externalNetworkUsedDuringRefit: false,
      fullPointInTimeArchivalSafety: 'NOT PROVEN BY TWSTOCK METADATA',
    },
    dbSafety: {
      canonicalDbRead: false,
      canonicalDbWrite: false,
    },
    cannotClaim: [
      'future stock-price predictive ability',
      'investment advice',
      'tradability',
      'product readiness',
      'real-market performance',
      'ROI or Sharpe improvement',
    ],
    filesWritten: [
      'outputs/retraining/p193_real_ohlcv_metrics.json',
      'outputs/retraining/p193_real_ohlcv_refit_report.json',
      'outputs/retraining/p193_real_ohlcv_refit_report.md',
      'outputs/retraining/p193_real_ohlcv_run_commands.txt',
      'outputs/retraining/p193_latest_predictions.json',
      'outputs/retraining/strategy_lab_run_history.json',
    ],
    gitActions: { staged: false, committed: false, pushed: false },
  };

  const markdown = `# P193 Real OHLCV Refit Report\n\n` +
    `- Final classification: \`${finalClassification}\`\n` +
    `- Data source: \`outputs/retraining/p194_twstock_ohlcv_export.csv\`\n` +
    `- Rows / symbols: ${rows.length} / ${symbols.join(', ')}\n` +
    `- Date range: ${dates[0]} to ${dates[dates.length - 1]}\n` +
    `- Target: ${metrics.targetDefinition}\n` +
    `- Samples: train ${trainSamples.length}, holdout ${testSamples.length}, purged ${purgedSamples.length}\n` +
    `- Features: ${FEATURE_NAMES.join(', ')}\n\n` +
    `## Holdout Metrics\n\n` +
    `- Accuracy: ${testEvaluation.accuracy}\n` +
    `- Majority baseline accuracy: ${testEvaluation.majorityBaselineAccuracy}\n` +
    `- Precision: ${testEvaluation.precision}\n` +
    `- Recall: ${testEvaluation.recall}\n` +
    `- Brier score: ${testEvaluation.brierScore}\n` +
    `- Log loss: ${testEvaluation.logLoss}\n\n` +
    `## Interpretation\n\n` +
    `${interpretation}\n\n` +
    `This is not investment advice, trading readiness evidence, product readiness evidence, or proof of future predictive ability. No ROI or Sharpe claim is made.\n`;

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
    'python3 -m venv /tmp/p194-twstock-venv',
    '/tmp/p194-twstock-venv/bin/python -m pip install twstock',
    '/tmp/p194-twstock-venv/bin/python scripts/p194_twstock_export_ohlcv.py',
    `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node scripts/p193_real_ohlcv_refit.ts`,
    'jq . outputs/retraining/p194_twstock_ohlcv_export_manifest.json',
    'jq . outputs/retraining/p193_real_ohlcv_metrics.json',
    'jq . outputs/retraining/p193_real_ohlcv_refit_report.json',
    'git status --short --untracked-files=all -- prisma/dev.db prisma/dev.db-shm prisma/dev.db-wal',
    'git diff --name-only -- prisma/dev.db prisma/dev.db-shm prisma/dev.db-wal',
    'git diff --check',
    'git diff --cached --name-only',
    '/tmp/p194-twstock-venv/bin/python -m py_compile scripts/p194_twstock_export_ohlcv.py',
    'npx eslint scripts/p193_real_ohlcv_refit.ts --ext .js,.jsx,.ts,.tsx',
  ].join('\n');

  await mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all([
    writeFile(METRICS_PATH, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8'),
    writeFile(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(REPORT_MD_PATH, markdown, 'utf8'),
    writeFile(COMMANDS_PATH, `${commands}\n`, 'utf8'),
    writeFile(PREDICTIONS_PATH, `${JSON.stringify(latestPredictions, null, 2)}\n`, 'utf8'),
  ]);
  const historyLength = await appendRunHistory({
    executedAt: new Date().toISOString(),
    runId: metrics.runId,
    rows: rows.length,
    dataEndDate: dates[dates.length - 1],
    trainSampleCount: trainSamples.length,
    holdoutSampleCount: testSamples.length,
    holdoutAccuracy: testEvaluation.accuracy,
    majorityBaselineAccuracy: testEvaluation.majorityBaselineAccuracy,
    deltaVsBaseline: round(testEvaluation.accuracy - testEvaluation.majorityBaselineAccuracy),
    finalClassification,
  });
  console.log(JSON.stringify({
    status: 'complete',
    finalClassification,
    runId: metrics.runId,
    trainSamples: trainSamples.length,
    holdoutSamples: testSamples.length,
    holdoutAccuracy: testEvaluation.accuracy,
    holdoutMajorityBaselineAccuracy: testEvaluation.majorityBaselineAccuracy,
    openPredictionCount: openPredictions.length,
    recentResolvedCount: recentResolved.length,
    runHistoryLength: historyLength,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
