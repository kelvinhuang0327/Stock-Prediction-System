import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, 'research/stock_poc/sample_stock_ohlcv.csv');
const HYPOTHESIS_PATH = path.join(ROOT, 'research/stock_poc/stock_momentum_hypothesis.json');
const OUTPUT_DIR = path.join(ROOT, 'outputs/retraining');
const METRICS_PATH = path.join(OUTPUT_DIR, 'p192_training_metrics.json');
const REPORT_JSON_PATH = path.join(OUTPUT_DIR, 'p192_true_retraining_mvp_report.json');
const REPORT_MD_PATH = path.join(OUTPUT_DIR, 'p192_true_retraining_mvp_report.md');
const COMMANDS_PATH = path.join(OUTPUT_DIR, 'p192_training_run_commands.txt');

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
  date: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  dataIsPointInTime: boolean;
  note: string;
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
  throw new Error(`P192 fail-closed: ${message}`);
}

function round(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

function mean(values: number[]): number {
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
  const expectedHeader = 'date,symbol,open,high,low,close,volume,data_is_point_in_time,note';
  if (lines.shift() !== expectedHeader) fail('unexpected CSV header');

  return lines.map((line, index) => {
    const fields = line.split(',');
    if (fields.length !== 9) fail(`invalid CSV field count at data row ${index + 1}`);
    const [date, symbol, open, high, low, close, volume, pit, note] = fields;
    const numeric = [open, high, low, close, volume].map(Number);
    if (numeric.some((value) => !Number.isFinite(value))) {
      fail(`non-numeric OHLCV value at data row ${index + 1}`);
    }
    if (pit !== 'true') fail(`non-PIT row at data row ${index + 1}`);
    if (note !== 'MOCK_DATA_NOT_FOR_TRADING') {
      fail(`missing mock-data safety label at data row ${index + 1}`);
    }
    return {
      date,
      symbol,
      open: numeric[0],
      high: numeric[1],
      low: numeric[2],
      close: numeric[3],
      volume: numeric[4],
      dataIsPointInTime: true,
      note,
    };
  });
}

function buildSamples(rows: CsvRow[]): Sample[] {
  const bySymbol = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const symbolRows = bySymbol.get(row.symbol) ?? [];
    symbolRows.push(row);
    bySymbol.set(row.symbol, symbolRows);
  }

  const samples: Sample[] = [];
  for (const [symbol, symbolRows] of bySymbol) {
    symbolRows.sort((left, right) => left.date.localeCompare(right.date));
    for (let index = LOOKBACK_DAYS; index + HORIZON_DAYS < symbolRows.length; index += 1) {
      const current = symbolRows[index];
      const returns10: number[] = [];
      for (let offset = index - 9; offset <= index; offset += 1) {
        returns10.push(symbolRows[offset].close / symbolRows[offset - 1].close - 1);
      }
      const averageReturn = mean(returns10);
      const variance = mean(returns10.map((value) => (value - averageReturn) ** 2));
      const averageVolume20 = mean(symbolRows.slice(index - 20, index).map((row) => row.volume));
      const targetRow = symbolRows[index + HORIZON_DAYS];
      const forwardReturn = targetRow.close / current.close - 1;
      samples.push({
        featureDate: current.date,
        targetDate: targetRow.date,
        symbol,
        features: [
          current.close / symbolRows[index - 5].close - 1,
          current.close / symbolRows[index - 20].close - 1,
          Math.sqrt(variance),
          current.volume / averageVolume20,
          (current.high - current.low) / current.close,
        ],
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

async function main(): Promise<void> {
  if (ROOT !== '/Users/kelvin/Kelvin-WorkSpace/Stock-Prediction-System') {
    fail(`unexpected working directory: ${ROOT}`);
  }
  const [csvRaw, hypothesisRaw] = await Promise.all([
    readFile(SOURCE_PATH, 'utf8'),
    readFile(HYPOTHESIS_PATH, 'utf8'),
  ]);
  const hypothesis = JSON.parse(hypothesisRaw) as Record<string, unknown>;
  if (hypothesis.prediction_target !== 'next_5d_return_positive' || hypothesis.data_is_mock !== true) {
    fail('hypothesis contract does not match the approved mock-data target');
  }
  const rows = parseCsv(csvRaw);
  if (rows.length < 100) fail(`insufficient source rows: ${rows.length}`);
  const samples = buildSamples(rows);
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
  const runId = `p192-logistic-${sourceSha256.slice(0, 12)}-${trainEndDate}`;
  const symbols = [...new Set(rows.map((row) => row.symbol))].sort();
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
    schemaVersion: 'p192.1',
    runId,
    retrainingType: 'TRUE_REFIT_MVP',
    deterministic: true,
    localOnly: true,
    externalNetworkUsed: false,
    canonicalDbRead: false,
    canonicalDbWrite: false,
    data: {
      source: 'research/stock_poc/sample_stock_ohlcv.csv',
      sourceSha256,
      sourceNature: 'tracked deterministic mock OHLCV fixture',
      sourceRowCount: rows.length,
      symbols,
      sourcePeriod: { start: rows[0].date, end: rows[rows.length - 1].date },
    },
    target: {
      name: 'next_5d_return_positive',
      definition: '1 when close[t+5 trading rows] / close[t] - 1 > 0; otherwise 0',
      horizonTradingRows: HORIZON_DAYS,
    },
    features: {
      count: FEATURE_NAMES.length,
      names: FEATURE_NAMES,
      lookbackTradingRows: LOOKBACK_DAYS,
      scalerFitOnTrainingOnly: true,
    },
    validationBoundary: {
      method: 'chronological 70/30 holdout with a five-row purge gap',
      trainFeaturePeriod: { start: trainSamples[0].featureDate, end: trainSamples.at(-1)?.featureDate },
      trainTargetPeriod: { start: trainSamples[0].targetDate, end: trainSamples.at(-1)?.targetDate },
      trainEndDate,
      testFeaturePeriod: { start: testSamples[0].featureDate, end: testSamples.at(-1)?.featureDate },
      testTargetPeriod: { start: testSamples[0].targetDate, end: testSamples.at(-1)?.targetDate },
      purgedBoundarySampleCount: purgedSamples.length,
      leakageGuard: 'training labels end on or before trainEndDate; test features begin after trainEndDate',
    },
    fit: {
      algorithm: 'binary logistic regression by deterministic full-batch gradient descent',
      iterations: ITERATIONS,
      learningRate: LEARNING_RATE,
      l2: L2,
      trainSampleCount: trainSamples.length,
      testSampleCount: testSamples.length,
      totalUsableSampleCount: trainSamples.length + testSamples.length,
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
      'Historical validation on synthetic mock data only.',
      'This run does not establish future predictive ability.',
      'This artifact is not investment advice and must not be used for trading.',
      'Small two-symbol fixture; metrics are limited and are not product-readiness evidence.',
      'No transaction-cost, portfolio, ROI, or Sharpe claim is made.',
    ],
  };

  const inventory = [
    {
      entrypoint: 'scripts/run-training-scheduler.ts + src/lib/training/*',
      finding: 'Task mining/orchestration, not a model fit; writes runtime state and some layers can write DB.',
      selected: false,
    },
    {
      entrypoint: 'scripts/run-autonomous-learning.ts + StrategyLearningEngine',
      finding: 'Builds insights from DB rows and upserts StrategyLearningInsight; canonical DB write is unsafe here.',
      selected: false,
    },
    {
      entrypoint: 'scripts/grid-search-optimizer.ts / src/sandbox/StrategySandbox.py',
      finding: 'Parameter search/backtest uses DB, is time-dependent or random, writes outside whitelist, and has no safe OOS fit contract.',
      selected: false,
    },
    {
      entrypoint: 'replay and walk-forward utilities',
      finding: 'Historical evaluation/replay only; no learned-parameter fit.',
      selected: false,
    },
    {
      entrypoint: 'scripts/p192_true_retraining_mvp.ts',
      finding: 'Selected minimal true-refit runner: tracked mock CSV, deterministic logistic fit, purged chronological holdout, output-only writes.',
      selected: true,
    },
  ];
  const classification = 'P192_TRUE_RETRAINING_MVP_COMPLETE_WITH_LIMITED_METRICS';
  const report = {
    schemaVersion: 'p192.1',
    finalClassification: classification,
    repository: ROOT,
    branch: 'main',
    startHead: '482fce5',
    endHead: '482fce5',
    governanceConflict: 'active_task.md remains STOCK-A2 read-only; direct P192 owner directive authorizes this bounded product-progress lane.',
    p191Baseline: {
      verified: true,
      commit: '482fce5',
      jsonArtifactsParsed: 6,
      researchPreviewChanged: false,
    },
    trainingEntrypointInventory: inventory,
    trueRetrainingPathFound: true,
    trueRetrainingExecuted: true,
    run: {
      command: `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node scripts/p192_true_retraining_mvp.ts`,
      runId,
      dataSource: metrics.data,
      sampleCount: metrics.fit.totalUsableSampleCount,
      trainSampleCount: metrics.fit.trainSampleCount,
      testSampleCount: metrics.fit.testSampleCount,
      featureCount: metrics.features.count,
      targetDefinition: metrics.target.definition,
      validationBoundary: metrics.validationBoundary,
      holdoutMetrics: metrics.metrics.chronologicalHoldout,
    },
    dbSafety: {
      canonicalDbRead: false,
      canonicalDbWrite: false,
      preRunGuard: 'PASS',
      postRunGuard: 'PENDING_EXTERNAL_VALIDATION',
    },
    validation: {
      metricsJsonParse: 'PENDING_EXTERNAL_VALIDATION',
      reportJsonParse: 'PENDING_EXTERNAL_VALIDATION',
      targetedEslint: 'PENDING_EXTERNAL_VALIDATION',
      fullTests: 'NOT RUN (out of scope)',
    },
    filesWritten: [
      'scripts/p192_true_retraining_mvp.ts',
      'outputs/retraining/p192_training_metrics.json',
      'outputs/retraining/p192_true_retraining_mvp_report.json',
      'outputs/retraining/p192_true_retraining_mvp_report.md',
      'outputs/retraining/p192_training_run_commands.txt',
    ],
    explicitlyNotTouched: [
      'prisma/dev.db', 'prisma/dev.db-shm', 'prisma/dev.db-wal',
      'schema and migrations', 'governance files', 'package/config/CI files',
      'src/app/research-preview/page.tsx', 'existing model/analyzer/strategy core logic',
    ],
    gitActions: { staged: false, committed: false, pushed: false },
    ownerCanViewNow: 'Local P192 metrics and auditable reports under outputs/retraining/.',
    cannotClaim: [
      'future stock-price predictive ability', 'investment advice', 'tradability',
      'product readiness', 'real-market performance', 'ROI or Sharpe improvement',
    ],
    recommendedNextSingleTask: 'Run the same fail-closed refit protocol on an approved PIT-safe real-data export using a copied/read-only source, without changing the canonical DB.',
    followUp24hPrompt: 'P193: approve one PIT-safe, read-only real OHLCV export; rerun the P192 deterministic refit protocol with the same purged chronological boundary; compare only historical holdout metrics; keep canonical DB, product routes, and core strategy logic unchanged; no stage, commit, push, or investment claims.',
  };

  const markdown = `# P192 True Retraining Pipeline MVP Report\n\n` +
    `- Final classification: \`${classification}\`\n` +
    `- Repo / branch / HEAD: \`${ROOT}\` / \`main\` / \`482fce5\` → \`482fce5\`\n` +
    `- P191 baseline: PASS (commit and six required JSON artifacts verified)\n` +
    `- Governance conflict: active task remains A2 read-only; direct P192 owner directive used for this bounded lane.\n` +
    `- True retraining path found / executed: YES / YES\n` +
    `- Research preview changed: NO\n\n` +
    `## Run\n\n` +
    `Command: \`${report.run.command}\`\n\n` +
    `The runner fit a new binary logistic-regression parameter vector from the tracked mock OHLCV fixture. It did not replay P187 rows or reuse cached results. ` +
    `There were ${metrics.fit.trainSampleCount} training samples, ${metrics.fit.testSampleCount} chronological holdout samples, and ${metrics.features.count} features. ` +
    `The target is ${metrics.target.definition}. Training labels end by ${trainEndDate}; test features begin after it, with ${purgedSamples.length} boundary samples purged.\n\n` +
    `## Historical holdout metrics\n\n` +
    `- Accuracy: ${testEvaluation.accuracy}\n` +
    `- Majority baseline accuracy: ${testEvaluation.majorityBaselineAccuracy}\n` +
    `- Precision: ${testEvaluation.precision}\n` +
    `- Recall: ${testEvaluation.recall}\n` +
    `- Brier score: ${testEvaluation.brierScore}\n` +
    `- Log loss: ${testEvaluation.logLoss}\n` +
    `- Probability MAE: ${testEvaluation.probabilityMae}\n` +
    `- Regularized training loss: ${round(model.initialLoss)} → ${round(model.finalLoss)}\n\n` +
    `## Safety and limitations\n\n` +
    `No canonical DB read or write occurred; no external network was used. This is historical validation on synthetic mock data only, not evidence of future predictive ability, investment advice, tradability, or product readiness. No ROI or Sharpe claim is made.\n\n` +
    `Post-run DB cleanliness, JSON parsing, and targeted ESLint are recorded as pending until the external validation commands complete. Full repository tests are NOT RUN because they are out of scope. Nothing is staged, committed, or pushed.\n\n` +
    `## Next single task\n\n` +
    `${report.recommendedNextSingleTask}\n\n` +
    `## 24H follow-up prompt\n\n` +
    `${report.followUp24hPrompt}\n`;

  const commands = [
    'pwd',
    'git rev-parse --show-toplevel',
    'git branch --show-current',
    'git rev-parse --short HEAD',
    'git status --short --untracked-files=all',
    'git diff --name-only',
    'git log --oneline -12',
    'git show --name-only --oneline --stat --no-renames 482fce5',
    'git status --short --untracked-files=all -- prisma/dev.db prisma/dev.db-shm prisma/dev.db-wal',
    'git diff --name-only -- prisma/dev.db prisma/dev.db-shm prisma/dev.db-wal',
    `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node scripts/p192_true_retraining_mvp.ts`,
    'jq . outputs/retraining/p192_training_metrics.json',
    'jq . outputs/retraining/p192_true_retraining_mvp_report.json',
    'npx eslint scripts/p192_true_retraining_mvp.ts --ext .js,.jsx,.ts,.tsx',
    'git diff --cached --name-only',
  ].join('\n');

  await mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all([
    writeFile(METRICS_PATH, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8'),
    writeFile(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(REPORT_MD_PATH, markdown, 'utf8'),
    writeFile(COMMANDS_PATH, `${commands}\n`, 'utf8'),
  ]);
  console.log(JSON.stringify({
    status: 'complete_with_limited_metrics',
    runId,
    trainSamples: trainSamples.length,
    testSamples: testSamples.length,
    holdoutAccuracy: testEvaluation.accuracy,
    holdoutMajorityBaselineAccuracy: testEvaluation.majorityBaselineAccuracy,
    outputDirectory: 'outputs/retraining',
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
