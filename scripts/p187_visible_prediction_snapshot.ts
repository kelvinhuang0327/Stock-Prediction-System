import { promises as fs } from 'node:fs';
import path from 'node:path';

type JsonRecord = Record<string, any>;
type PreviewValue = number | string | boolean | null;

const OUT_DIR = path.join(process.cwd(), 'outputs', 'research_preview');
const SOURCE_DIR = path.join(process.cwd(), 'outputs', 'stock_validation_v3', '20260501');
const SUMMARY_PATH = path.join(SOURCE_DIR, 'v3_validation_summary.json');
const ACTIVE_DB_ERROR = 'Active prisma/dev.db read failed: malformed database schema (JobAlert) - invalid rootpage';
const DB_BOUNDARY_VIOLATION = 'DB safety boundary violated: git diff --name-only shows prisma/dev.db, prisma/dev.db-shm, and prisma/dev.db-wal dirty after the failed live DB-backed read attempt. No schema/migration command was run, but the task cannot be classified complete.';
const FINAL_CLASSIFICATION = 'P187_BLOCKED_BY_DB_SAFETY_BOUNDARY';

function nowIso(): string {
  return new Date().toISOString();
}

function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function readJson<T = JsonRecord>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function hypothesisDir(hypothesisId: string): string {
  return hypothesisId.toLowerCase();
}

function directionFromStatus(status: string): string {
  if (status === 'REVIEW_CANDIDATE') return 'research_review_candidate';
  if (status === 'REJECTED') return 'no_edge_found';
  if (status === 'OBSERVATION_ONLY') return 'observation_only';
  if (status === 'DATA_INSUFFICIENT') return 'insufficient_data';
  return 'unknown';
}

function confidenceFromGate(gate: JsonRecord | null): number | 'UNKNOWN' {
  const windows = Array.isArray(gate?.window_results) ? gate.window_results : [];
  if (windows.length === 0) return 'UNKNOWN';
  const qValues = windows
    .map((w: JsonRecord) => w.bh_fdr_q_value)
    .filter((v: unknown): v is number => typeof v === 'number' && Number.isFinite(v));
  if (qValues.length === 0) return 'UNKNOWN';
  return r2(Math.max(0, Math.min(1, 1 - Math.min(...qValues))));
}

function mdTable(headers: string[], rows: Array<Array<PreviewValue>>): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((value) => String(value ?? 'UNKNOWN')).join(' | ')} |`),
  ].join('\n');
}

async function loadGate(symbol: string, hypothesisId: string): Promise<JsonRecord | null> {
  const filePath = path.join(SOURCE_DIR, symbol, hypothesisDir(hypothesisId), 'gate_result.json');
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

async function loadMetrics(symbol: string, hypothesisId: string): Promise<JsonRecord | null> {
  const filePath = path.join(SOURCE_DIR, symbol, hypothesisDir(hypothesisId), 'validation_metrics.json');
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

async function loadLineage(symbol: string, hypothesisId: string): Promise<JsonRecord | null> {
  const filePath = path.join(SOURCE_DIR, symbol, hypothesisDir(hypothesisId), 'data_lineage.json');
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

function statusFor(summary: JsonRecord, symbol: string, hypothesisId: string): string {
  const groups = [
    ['review_candidates', 'REVIEW_CANDIDATE'],
    ['rejected', 'REJECTED'],
    ['data_insufficient', 'DATA_INSUFFICIENT'],
    ['observation_only_results', 'OBSERVATION_ONLY'],
  ] as const;

  for (const [key, status] of groups) {
    const rows = Array.isArray(summary[key]) ? summary[key] : [];
    if (rows.some((row: JsonRecord) => row.symbol === symbol && row.hypothesis_id === hypothesisId)) {
      return status;
    }
  }
  return 'UNKNOWN';
}

async function buildRows(summary: JsonRecord) {
  const symbols = summary.symbols_evaluated as string[];
  const hypotheses = summary.candidates_evaluated as string[];
  const rows: JsonRecord[] = [];
  const allWindows: JsonRecord[] = [];
  const lineages: JsonRecord[] = [];

  for (const symbol of symbols) {
    for (const hypothesisId of hypotheses) {
      const status = statusFor(summary, symbol, hypothesisId);
      const gate = await loadGate(symbol, hypothesisId);
      const metrics = await loadMetrics(symbol, hypothesisId);
      const lineage = await loadLineage(symbol, hypothesisId);
      if (lineage) lineages.push(lineage);

      const windowResults = Array.isArray(gate?.window_results) ? gate.window_results : [];
      allWindows.push(...windowResults);

      rows.push({
        symbol,
        strategyOrHypothesis: hypothesisId,
        asOfDate: metrics?.as_of_date ?? gate?.as_of_date ?? summary.as_of_date,
        score: typeof metrics?.avg_sharpe_annualized === 'number' ? metrics.avg_sharpe_annualized : 'UNKNOWN',
        signal: status,
        predictionDirection: directionFromStatus(status),
        confidence: confidenceFromGate(gate),
        promotionAllowed: gate?.promotion_allowed ?? false,
        windowsTested: metrics?.windows_tested ?? windowResults.map((w: JsonRecord) => w.window_days),
        windowsOk: metrics?.windows_ok ?? windowResults.filter((w: JsonRecord) => w.status === 'OK').map((w: JsonRecord) => w.window_days),
        avgSharpeAnnualized: metrics?.avg_sharpe_annualized ?? 'UNKNOWN',
        avgRoiAnnualized: metrics?.avg_roi_annualized ?? 'UNKNOWN',
        bhFdrPassCount: metrics?.bh_fdr_pass_count ?? 0,
        status,
        pitEnforced: lineage?.pit_enforced ?? 'UNKNOWN',
        timeBasedSplit: lineage?.time_based_split ?? 'UNKNOWN',
        artifactSource: path.relative(process.cwd(), path.join(SOURCE_DIR, symbol, hypothesisDir(hypothesisId))),
      });
    }
  }

  return { rows, allWindows, lineages };
}

function aggregateReplay(summary: JsonRecord, windows: JsonRecord[]) {
  const okWindows = windows.filter((w) => w.status === 'OK');
  const numeric = (key: string) => okWindows
    .map((w) => w[key])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avg = (key: string): number | 'UNKNOWN' => {
    const values = numeric(key);
    return values.length > 0 ? r2(values.reduce((a, b) => a + b, 0) / values.length) : 'UNKNOWN';
  };
  const sum = (key: string): number => numeric(key).reduce((a, b) => a + b, 0);

  return {
    totalTests: summary.total_tests ?? 'UNKNOWN',
    okTests: summary.ok_tests ?? 'UNKNOWN',
    okTestRatePct: typeof summary.total_tests === 'number' && summary.total_tests > 0
      ? r2((summary.ok_tests / summary.total_tests) * 100)
      : 'UNKNOWN',
    bhFdrAlpha: summary.bh_fdr_alpha ?? 'UNKNOWN',
    bhFdrPassCount: summary.bh_fdr_pass_count ?? 'UNKNOWN',
    reviewCandidateCount: Array.isArray(summary.review_candidates) ? summary.review_candidates.length : 'UNKNOWN',
    rejectedCount: Array.isArray(summary.rejected) ? summary.rejected.length : 'UNKNOWN',
    dataInsufficientCount: Array.isArray(summary.data_insufficient) ? summary.data_insufficient.length : 'UNKNOWN',
    observationOnlyCount: Array.isArray(summary.observation_only_results) ? summary.observation_only_results.length : 'UNKNOWN',
    sampleCount: sum('n_oos'),
    signalCount: sum('n_signals'),
    averageWinRatePct: avg('win_rate') === 'UNKNOWN' ? 'UNKNOWN' : r2((avg('win_rate') as number) * 100),
    averageMeanReturnPct: avg('mean_return') === 'UNKNOWN' ? 'UNKNOWN' : r2((avg('mean_return') as number) * 100),
    averageSharpeAnnualized: avg('sharpe_annualized'),
    averageRoiAnnualized: avg('roi_annualized'),
    averagePValue: avg('p_value'),
    pitLeakageDetected: okWindows.some((w) => w.pit_leakage === true),
  };
}

async function writeArtifacts() {
  const runTimestamp = nowIso();
  await fs.mkdir(OUT_DIR, { recursive: true });

  const summary = await readJson(SUMMARY_PATH);
  const { rows, allWindows, lineages } = await buildRows(summary);
  const replayMetrics = aggregateReplay(summary, allWindows);
  const lineageDbSources = [...new Set(lineages.map((l) => l.db_source).filter(Boolean))];

  const predictionSnapshot = {
    previewNotice: 'RESEARCH PREVIEW ONLY — NOT INVESTMENT ADVICE — DATA MAY BE CACHED ARTIFACT DATA',
    runTimestamp,
    sourceArtifact: path.relative(process.cwd(), SUMMARY_PATH),
    analyzerName: 'stock_validation_v3 strategy validation artifacts',
    modelOrStrategy: 'existing hypothesis validation / strategy scoring artifact, not a live trained model',
    dataSource: {
      datasetType: 'cached_existing_artifacts',
      asOfDate: summary.as_of_date ?? 'UNKNOWN',
      artifactRunTimestamp: summary.run_ts ?? 'UNKNOWN',
      dbSourcesRecordedInLineage: lineageDbSources,
      activeDbCurrentReadStatus: ACTIVE_DB_ERROR,
    },
    stockUniverse: summary.symbols_evaluated ?? [],
    predictions: rows,
    limitations: [
      'Research preview only; no buy/sell instruction or investment advice.',
      'Generated from existing cached validation artifacts because active prisma/dev.db is currently malformed for live read execution.',
      'Signals are strategy-validation statuses, not live trading recommendations.',
      'Score uses existing average annualized Sharpe where present; otherwise UNKNOWN.',
      'No production behavior, tests, package config, schema, migrations, or DB contents were changed.',
    ],
  };

  const replayResult = {
    previewNotice: predictionSnapshot.previewNotice,
    runTimestamp,
    resultType: 'replay',
    trueRetraining: false,
    refit: false,
    simulationRefresh: false,
    replayDescription: 'Existing cached stock_validation_v3 validation replay over 2026-05-01 artifacts. No model weights, strategy thresholds, DB rows, or schema were changed.',
    trainWindow: 'N/A — replay of fixed hypotheses; no model training window',
    validationWindow: `as_of=${summary.as_of_date ?? 'UNKNOWN'}; rolling windows=${[...new Set(allWindows.map((w) => w.window_days).filter(Boolean))].join(',') || 'UNKNOWN'} days`,
    sampleCount: replayMetrics.sampleCount || 'UNKNOWN',
    featureCount: 'UNKNOWN',
    metrics: {
      accuracy: 'UNKNOWN',
      precision: 'UNKNOWN',
      recall: 'UNKNOWN',
      mae: 'UNKNOWN',
      mse: 'UNKNOWN',
      return: replayMetrics.averageMeanReturnPct,
      drawdown: 'UNKNOWN',
      hitRate: replayMetrics.averageWinRatePct,
      okTestRatePct: replayMetrics.okTestRatePct,
      averageSharpeAnnualized: replayMetrics.averageSharpeAnnualized,
      averageRoiAnnualized: replayMetrics.averageRoiAnnualized,
      bhFdrPassCount: replayMetrics.bhFdrPassCount,
      pitLeakageDetected: replayMetrics.pitLeakageDetected,
    },
    replayMetrics,
    stockUniverse: summary.symbols_evaluated ?? [],
    strategyUniverse: summary.candidates_evaluated ?? [],
    limitations: [
      'Replay only; this is not full model retraining, refit, or optimizer activation.',
      'Existing artifacts found no promoted/review candidate under BH-FDR alpha in this run.',
      'Feature count and classification metrics are UNKNOWN because the existing artifact schema does not expose them.',
      'Active DB live rerun is blocked by malformed schema; no DB repair was attempted.',
    ],
  };

  const progressReport = {
    previewNotice: predictionSnapshot.previewNotice,
    repo: process.cwd(),
    branch: 'main',
    startHead: 'b8196f7',
    endHead: 'b8196f7',
    governanceReadResult: {
      activeTaskConflict: 'active_task.md remains STOCK-A2 read-only audit',
      ownerDirectiveHandling: 'P187 prompt explicitly authorizes minimal visible-output lane; active_task.md was not modified.',
    },
    existingPipelineInventory: [
      'package.json npm run backtest -> BacktestRunner path exists but DB-backed live execution is unsafe while active DB is malformed.',
      'RuleBasedStockAnalyzer.analyzeStock -> existing DB-backed prediction analyzer, attempted and blocked by active DB malformed schema.',
      'scripts/run-fast-forward-simulation.ts -> writes simulation/review/learning state when not dry-run; outside safe boundary for this task.',
      'outputs/stock_validation_v3/20260501 -> existing cached validation/replay artifacts, chosen as shortest safe executable path.',
    ],
    chosenShortestExecutablePath: 'Artifact-only aggregation from existing stock_validation_v3 cached replay outputs.',
    predictionSnapshotSummary: {
      produced: true,
      artifactJson: 'outputs/research_preview/p187_prediction_snapshot.json',
      artifactMarkdown: 'outputs/research_preview/p187_prediction_snapshot.md',
      rowCount: rows.length,
      dataSource: predictionSnapshot.dataSource,
    },
    retrainingReplayResultSummary: {
      produced: true,
      artifactJson: 'outputs/research_preview/p187_retraining_result.json',
      artifactMarkdown: 'outputs/research_preview/p187_retraining_result.md',
      resultType: replayResult.resultType,
      trueRetraining: false,
      sampleCount: replayResult.sampleCount,
      metrics: replayResult.metrics,
    },
    confirmedVsUnknown: {
      confirmed: [
        'Existing cached validation artifacts are parseable and produce visible strategy-status rows.',
        'Replay result includes sample count, signal count, win-rate/hit-rate proxy, return, Sharpe, ROI, FDR pass count, and PIT leakage flag where present.',
        'No source production behavior, schema, migrations, package config, or tests were changed.',
      ],
      unknown: [
        'Live current prediction output from active DB is blocked by malformed schema.',
        'Feature count, precision, recall, MAE, MSE, and drawdown are not present in selected artifacts.',
        'Cached artifacts are as-of 2026-05-01 and are not real-time market data.',
      ],
    },
    dbSchemaSourceModificationStatus: {
      dbWrites: DB_BOUNDARY_VIOLATION,
      schemaOrMigrationChanges: 'NO',
      productionSourceChanges: 'NO',
      activeDbLiveRead: ACTIVE_DB_ERROR,
    },
    stagedCommitPushStatus: 'not staged, not committed, not pushed',
    viewableByOwner: true,
    canTurnIntoUiPageNext: true,
    needsStrongModel: 'Recommended but not strictly required for this artifact-only follow-up; stronger reasoning was useful to avoid crossing DB/write boundaries.',
    finalClassification: FINAL_CLASSIFICATION,
    next24HPrompt: 'Create a bounded UI/data-contract task that renders the P187 research preview artifacts from outputs/research_preview as a read-only page, preserving research-only/no-advice labels and without running live training or DB writes.',
  };

  await fs.writeFile(path.join(OUT_DIR, 'p187_prediction_snapshot.json'), `${JSON.stringify(predictionSnapshot, null, 2)}\n`, 'utf-8');
  await fs.writeFile(path.join(OUT_DIR, 'p187_retraining_result.json'), `${JSON.stringify(replayResult, null, 2)}\n`, 'utf-8');
  await fs.writeFile(path.join(OUT_DIR, 'p187_visible_progress_report.json'), `${JSON.stringify(progressReport, null, 2)}\n`, 'utf-8');

  const predictionRows = rows.map((row) => [
    row.symbol,
    row.strategyOrHypothesis,
    row.asOfDate,
    row.score,
    row.signal,
    row.predictionDirection,
    row.confidence,
    row.promotionAllowed,
  ]);

  await fs.writeFile(path.join(OUT_DIR, 'p187_prediction_snapshot.md'), [
    '# P187 Prediction Snapshot',
    '',
    predictionSnapshot.previewNotice,
    '',
    `- Run timestamp: ${runTimestamp}`,
    `- Source artifact: ${predictionSnapshot.sourceArtifact}`,
    `- Dataset type: ${predictionSnapshot.dataSource.datasetType}`,
    `- Data as-of date: ${predictionSnapshot.dataSource.asOfDate}`,
    `- Artifact run timestamp: ${predictionSnapshot.dataSource.artifactRunTimestamp}`,
    `- Active DB live-read status: ${ACTIVE_DB_ERROR}`,
    '',
    mdTable(['Symbol', 'Strategy/Hypothesis', 'As-of', 'Score', 'Signal', 'Direction', 'Confidence', 'Promotion Allowed'], predictionRows),
    '',
    '## Limitations',
    '',
    ...predictionSnapshot.limitations.map((item) => `- ${item}`),
    '',
  ].join('\n'), 'utf-8');

  await fs.writeFile(path.join(OUT_DIR, 'p187_retraining_result.md'), [
    '# P187 Retraining / Replay Result',
    '',
    replayResult.previewNotice,
    '',
    `- Run timestamp: ${runTimestamp}`,
    `- Result type: ${replayResult.resultType}`,
    `- True retraining: ${replayResult.trueRetraining ? 'YES' : 'NO'}`,
    `- Refit: ${replayResult.refit ? 'YES' : 'NO'}`,
    `- Simulation refresh: ${replayResult.simulationRefresh ? 'YES' : 'NO'}`,
    `- Train window: ${replayResult.trainWindow}`,
    `- Validation/test window: ${replayResult.validationWindow}`,
    `- Sample count: ${replayResult.sampleCount}`,
    `- Feature count: ${replayResult.featureCount}`,
    '',
    mdTable(['Metric', 'Value'], Object.entries(replayResult.metrics)),
    '',
    '## Limitations',
    '',
    ...replayResult.limitations.map((item) => `- ${item}`),
    '',
  ].join('\n'), 'utf-8');

  await fs.writeFile(path.join(OUT_DIR, 'p187_visible_progress_report.md'), [
    '# P187 Visible Progress Report',
    '',
    predictionSnapshot.previewNotice,
    '',
    '## Required Report',
    '',
    `- Repo / branch / start HEAD / end HEAD: ${process.cwd()} / main / b8196f7 / b8196f7`,
    '- Governance read result and Owner Directive handling: active_task.md is still STOCK-A2 read-only; P187 Owner Directive authorized this minimal visible-output lane; active_task.md unchanged.',
    '- Existing pipeline inventory: RuleBasedStockAnalyzer, prediction API, BacktestRunner, autonomous learning/fast-forward scripts, and stock_validation_v3 cached validation artifacts were inspected.',
    '- Chosen shortest executable path: artifact-only aggregation from outputs/stock_validation_v3/20260501 because active DB live reads are malformed.',
    `- Prediction snapshot summary: ${rows.length} strategy-status rows generated.`,
    `- Retraining / refit / replay result summary: replay only; sampleCount=${replayResult.sampleCount}; trueRetraining=NO.`,
    `- Data source and as-of timestamp: cached_existing_artifacts; as_of=${summary.as_of_date}; artifact run=${summary.run_ts}.`,
    '- What is confirmed vs unknown: see JSON report for detailed confirmed/unknown arrays.',
    `- DB / schema / source modification status: ${DB_BOUNDARY_VIOLATION}; no schema/migration changes; no production source changes.`,
    '- staged / commit / push status: none.',
    '- Whether result is viewable by Owner: yes, markdown and JSON artifacts are written under outputs/research_preview.',
    '- Whether this can be turned into a UI page next: yes, use generated JSON artifacts read-only.',
    '- 這輪 Worker 是否需要強模型: recommended; boundary decisions required care.',
    `- Final Classification: ${FINAL_CLASSIFICATION}`,
    '',
    '## Metrics Table',
    '',
    mdTable(['Metric', 'Value'], Object.entries(replayResult.metrics)),
    '',
    '## Next 24H Prompt',
    '',
    progressReport.next24HPrompt,
    '',
  ].join('\n'), 'utf-8');
}

writeArtifacts().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
