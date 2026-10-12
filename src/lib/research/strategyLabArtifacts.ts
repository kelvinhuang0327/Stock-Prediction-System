import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  buildStrategySimulation,
  type StrategyLabSimulation,
} from "@/lib/research/StrategyLabSimulationEngine";
import {
  buildStrategyLabCalibration,
  type StrategyLabCalibration,
} from "@/lib/research/StrategyLabCalibrationEngine";
import {
  buildStrategyLabSymbolReliability,
  type StrategyLabSymbolReliability,
} from "@/lib/research/StrategyLabSymbolReliabilityEngine";

const RETRAINING_DIR = path.join(process.cwd(), "outputs", "retraining");
const CSV_PATH = path.join(RETRAINING_DIR, "p194_twstock_ohlcv_export.csv");
const P194_MANIFEST_PATH = path.join(RETRAINING_DIR, "p194_twstock_ohlcv_export_manifest.json");
const P193_METRICS_PATH = path.join(RETRAINING_DIR, "p193_real_ohlcv_metrics.json");
const P193_REPORT_PATH = path.join(RETRAINING_DIR, "p193_real_ohlcv_refit_report.json");
const P195_METRICS_PATH = path.join(RETRAINING_DIR, "p195_protocol_comparison_metrics.json");
const LATEST_PREDICTIONS_PATH = path.join(RETRAINING_DIR, "p193_latest_predictions.json");
const RUN_HISTORY_PATH = path.join(RETRAINING_DIR, "strategy_lab_run_history.json");

type JsonRecord = Record<string, unknown>;

export type StrategyDecision = "do_not_promote" | "research_candidate" | "needs_more_evidence" | "missing";

export interface StrategyLabDataExport {
  status: "present" | "missing";
  path: string;
  manifestAvailable: boolean;
  sha256: string | null;
  rowCount: number | null;
  symbols: string[];
  dateRange: { start: string; end: string } | null;
  fetchedAtUtc: string | null;
  source: string | null;
  mtime: string | null;
  pitSafety: string;
  limitations: string[];
}

export interface StrategyLabMetricSet {
  accuracy: number | null;
  majorityBaselineAccuracy: number | null;
  deltaVsMajorityBaseline: number | null;
  precision: number | null;
  recall: number | null;
  brierScore: number | null;
  logLoss: number | null;
}

export interface StrategyLabSymbolHoldout {
  symbol: string;
  sampleCount: number | null;
  accuracy: number | null;
  majorityBaselineAccuracy: number | null;
  deltaVsMajorityBaseline: number | null;
}

export interface StrategyLabRefitResult {
  status: "present" | "missing";
  path: string;
  reportPath: string;
  mtime: string | null;
  runId: string | null;
  finalClassification: string | null;
  decision: StrategyDecision;
  decisionLabel: string;
  decisionReason: string;
  trainSampleCount: number | null;
  holdoutSampleCount: number | null;
  purgedSampleCount: number | null;
  featureCount: number | null;
  targetDefinition: string | null;
  validationBoundary: JsonRecord | null;
  metrics: StrategyLabMetricSet;
  perSymbolHoldout: StrategyLabSymbolHoldout[];
  interpretation: string | null;
  limitations: string[];
}

export type PredictedDirection = "up" | "down";

export interface StrategyLabOpenPrediction {
  symbol: string;
  featureDate: string;
  close: number | null;
  probabilityUp: number | null;
  predictedDirection: PredictedDirection | null;
  isLatest: boolean;
}

export interface StrategyLabResolvedPrediction {
  symbol: string;
  featureDate: string;
  targetDate: string;
  probabilityUp: number | null;
  predictedDirection: PredictedDirection | null;
  actualDirection: PredictedDirection | null;
  forwardReturn: number | null;
  correct: boolean;
}

export interface StrategyLabResolvedSampleProvenance {
  source: string;
  validationStatus: "expanded" | "fallback";
  validationReason: string;
  fallbackActive: boolean;
  committedResolvedPairs: number;
  activeResolvedPairs: number;
  featureDateRange: { start: string; end: string } | null;
  targetDateRange: { start: string; end: string } | null;
  caveat: string;
}

export interface StrategyLabPredictions {
  status: "present" | "missing";
  path: string;
  mtime: string | null;
  runId: string | null;
  dataEndDate: string | null;
  horizonTradingDays: number | null;
  modelBeatsBaseline: boolean | null;
  latestBySymbol: StrategyLabOpenPrediction[];
  openPredictions: StrategyLabOpenPrediction[];
  recentResolved: StrategyLabResolvedPrediction[];
  resolvedSampleProvenance: StrategyLabResolvedSampleProvenance;
  caveat: string;
}

export interface StrategyLabRunHistoryEntry {
  executedAt: string | null;
  runId: string | null;
  rows: number | null;
  dataEndDate: string | null;
  trainSampleCount: number | null;
  holdoutSampleCount: number | null;
  holdoutAccuracy: number | null;
  majorityBaselineAccuracy: number | null;
  deltaVsBaseline: number | null;
  finalClassification: string | null;
}

export interface StrategyLabRunHistory {
  status: "present" | "missing";
  path: string;
  mtime: string | null;
  totalRuns: number;
  entries: StrategyLabRunHistoryEntry[];
}

export interface StrategyLabProtocolVariant extends StrategyLabMetricSet {
  variantId: string;
  name: string;
  targetDefinition: string | null;
  featureNames: string[];
  trainSampleCount: number | null;
  holdoutSampleCount: number | null;
  purgedSampleCount: number | null;
  interpretation: string | null;
}

export interface StrategyLabProtocolComparison {
  status: "present" | "missing";
  path: string;
  mtime: string | null;
  finalClassification: string | null;
  decision: StrategyDecision;
  decisionLabel: string;
  decisionReason: string;
  variants: StrategyLabProtocolVariant[];
  bestVariant: StrategyLabProtocolVariant | null;
  limitations: string[];
}

export interface StrategyLabSnapshot {
  generatedAt: string;
  artifactSetStatus: "complete" | "blocked";
  dataExport: StrategyLabDataExport;
  refit: StrategyLabRefitResult;
  predictions: StrategyLabPredictions;
  simulation?: StrategyLabSimulation;
  calibration?: StrategyLabCalibration;
  symbolReliability?: StrategyLabSymbolReliability;
  runHistory: StrategyLabRunHistory;
  protocolComparison: StrategyLabProtocolComparison;
  productStance: {
    decision: StrategyDecision;
    label: string;
    reason: string;
  };
  safety: {
    canonicalDbRead: false;
    canonicalDbWrite: false;
    externalNetworkUsedForRead: false;
    investmentAdvice: false;
    tradingExecution: false;
  };
  artifactCompleteness: Array<{
    label: string;
    path: string;
    present: boolean;
    mtime: string | null;
  }>;
  availableActions: {
    rerunRefit: boolean;
    rerunProtocolComparison: boolean;
  };
}

interface CsvSummary {
  sha256: string;
  rowCount: number;
  symbols: string[];
  dateRange: { start: string; end: string };
  fetchedAtUtc: string | null;
  source: string | null;
}

interface OhlcvRow {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type FeatureName = "return_5d" | "return_20d" | "volatility_10d" | "volume_ratio_20d" | "intraday_range_pct";

type FeatureVector = Record<FeatureName, number>;

interface LogisticFit {
  intercept: number;
  coefficients: Record<FeatureName, number>;
  means: Record<FeatureName, number>;
  standardDeviations: Record<FeatureName, number>;
}

interface ResolvedExpansionResult {
  rows: StrategyLabResolvedPrediction[];
  validationStatus: "expanded" | "fallback";
  reason: string;
}

const RESOLVED_EXPANSION_FEATURES: FeatureName[] = [
  "return_5d",
  "return_20d",
  "volatility_10d",
  "volume_ratio_20d",
  "intraday_range_pct",
];
const RESOLVED_EXPANSION_PROBABILITY_TOLERANCE = 1e-7;
const RESOLVED_EXPANSION_FORWARD_RETURN_TOLERANCE = 1e-8;

async function statIso(filePath: string): Promise<string | null> {
  try {
    const stats = await fs.stat(filePath);
    return stats.mtime.toISOString();
  } catch {
    return null;
  }
}

async function readJson<T extends JsonRecord>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function relative(filePath: string): string {
  return path.relative(process.cwd(), filePath);
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asDirection(value: unknown): PredictedDirection | null {
  return value === "up" || value === "down" ? value : null;
}

function round(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

function appendCaveat(caveat: string, addition: string): string {
  return caveat.includes(addition) ? caveat : `${caveat} ${addition}`;
}

function metricSet(source: JsonRecord | null): StrategyLabMetricSet {
  const accuracy = asNumber(source?.accuracy);
  const majorityBaselineAccuracy = asNumber(source?.majorityBaselineAccuracy);
  return {
    accuracy,
    majorityBaselineAccuracy,
    deltaVsMajorityBaseline:
      accuracy !== null && majorityBaselineAccuracy !== null
        ? round(accuracy - majorityBaselineAccuracy)
        : null,
    precision: asNumber(source?.precision),
    recall: asNumber(source?.recall),
    brierScore: asNumber(source?.brierScore),
    logLoss: asNumber(source?.logLoss),
  };
}

function decisionFromMetrics(metrics: StrategyLabMetricSet): StrategyDecision {
  if (metrics.accuracy === null || metrics.majorityBaselineAccuracy === null) return "missing";
  if (metrics.accuracy > metrics.majorityBaselineAccuracy) return "research_candidate";
  if (metrics.accuracy < metrics.majorityBaselineAccuracy) return "do_not_promote";
  return "needs_more_evidence";
}

function decisionCopy(decision: StrategyDecision): { label: string; reason: string } {
  if (decision === "research_candidate") {
    return {
      label: "研究候選，需再驗證",
      reason: "歷史 holdout 表現高於 majority baseline，但仍需重複驗證、成本模型與更完整 PIT 資料後才能推進。",
    };
  }
  if (decision === "do_not_promote") {
    return {
      label: "暫不啟用策略",
      reason: "目前重訓與策略比較沒有打敗基準，不能把它包裝成可用投資建議。",
    };
  }
  if (decision === "needs_more_evidence") {
    return {
      label: "證據不足",
      reason: "策略表現只追平基準或 artifact 不完整，下一步應先補資料與驗證而非發布訊號。",
    };
  }
  return {
    label: "尚未產生結果",
    reason: "目前缺少可讀取的重訓 artifact，請先執行 refit。",
  };
}

async function summarizeCsv(): Promise<CsvSummary | null> {
  try {
    const raw = await fs.readFile(CSV_PATH, "utf8");
    const sha256 = createHash("sha256").update(raw).digest("hex");
    const lines = raw.trim().split(/\r?\n/);
    const header = lines.shift()?.split(",") ?? [];
    const indexOf = (column: string) => header.indexOf(column);
    const symbolIndex = indexOf("symbol");
    const dateIndex = indexOf("date");
    const sourceIndex = indexOf("source");
    const fetchedAtIndex = indexOf("fetched_at_utc");

    if (symbolIndex < 0 || dateIndex < 0) return null;

    const symbols = new Set<string>();
    const dates: string[] = [];
    let fetchedAtUtc: string | null = null;
    let source: string | null = null;

    for (const line of lines) {
      const fields = line.split(",");
      const symbol = fields[symbolIndex];
      const date = fields[dateIndex];
      if (symbol) symbols.add(symbol);
      if (date) dates.push(date);
      if (!fetchedAtUtc && fetchedAtIndex >= 0) fetchedAtUtc = fields[fetchedAtIndex] || null;
      if (!source && sourceIndex >= 0) source = fields[sourceIndex] || null;
    }

    dates.sort();
    return {
      sha256,
      rowCount: lines.length,
      symbols: [...symbols].sort(),
      dateRange: { start: dates[0] ?? "UNKNOWN", end: dates.at(-1) ?? "UNKNOWN" },
      fetchedAtUtc,
      source,
    };
  } catch {
    return null;
  }
}

async function buildDataExport(): Promise<StrategyLabDataExport> {
  const [csvSummary, manifest, csvMtime] = await Promise.all([
    summarizeCsv(),
    readJson(P194_MANIFEST_PATH),
    statIso(CSV_PATH),
  ]);

  if (!csvSummary) {
    return {
      status: "missing",
      path: relative(CSV_PATH),
      manifestAvailable: manifest !== null,
      sha256: null,
      rowCount: null,
      symbols: [],
      dateRange: null,
      fetchedAtUtc: null,
      source: null,
      mtime: null,
      pitSafety: "NO_EXPORT",
      limitations: ["找不到 P194 OHLCV CSV，無法顯示真實資料重訓結果。"],
    };
  }

  const manifestDateRange = asRecord(manifest?.actualDateRange);
  return {
    status: "present",
    path: relative(CSV_PATH),
    manifestAvailable: manifest !== null,
    sha256: csvSummary.sha256,
    rowCount: asNumber(manifest?.rowCount) ?? csvSummary.rowCount,
    symbols: asStringArray(manifest?.symbolsFetched).length > 0
      ? asStringArray(manifest?.symbolsFetched)
      : csvSummary.symbols,
    dateRange: {
      start: asString(manifestDateRange?.min) ?? csvSummary.dateRange.start,
      end: asString(manifestDateRange?.max) ?? csvSummary.dateRange.end,
    },
    fetchedAtUtc: asString(manifest?.fetchedAtUtc) ?? csvSummary.fetchedAtUtc,
    source: asString(manifest?.source) ?? csvSummary.source,
    mtime: csvMtime,
    pitSafety: asRecord(manifest?.validation)?.boundedPitSafetyValidation as string ?? "BOUNDED_PASS_WITH_SOURCE_LIMITATION",
    limitations: [
      "twstock 匯出不等於完整 point-in-time archival database；目前只能宣稱 bounded PIT safety。",
      "此 CSV 僅用於歷史研究與模型 refit，不是交易資料流。",
    ],
  };
}

async function buildRefit(): Promise<StrategyLabRefitResult> {
  const [metrics, report, metricsMtime] = await Promise.all([
    readJson(P193_METRICS_PATH),
    readJson(P193_REPORT_PATH),
    statIso(P193_METRICS_PATH),
  ]);
  const metricSummary = metricSet(metrics);
  const decision = decisionFromMetrics(metricSummary);
  const copy = decisionCopy(decision);
  const holdoutBySymbol = asRecord(asRecord(metrics?.metrics)?.chronologicalHoldoutBySymbol);
  const perSymbolHoldout: StrategyLabSymbolHoldout[] = holdoutBySymbol
    ? Object.entries(holdoutBySymbol)
        .map(([symbol, value]) => {
          const record = asRecord(value);
          const accuracy = asNumber(record?.accuracy);
          const baseline = asNumber(record?.majorityBaselineAccuracy);
          return {
            symbol,
            sampleCount: asNumber(record?.sampleCount),
            accuracy,
            majorityBaselineAccuracy: baseline,
            deltaVsMajorityBaseline:
              accuracy !== null && baseline !== null ? round(accuracy - baseline) : null,
          };
        })
        .sort((left, right) => left.symbol.localeCompare(right.symbol))
    : [];

  if (!metrics) {
    return {
      status: "missing",
      path: relative(P193_METRICS_PATH),
      reportPath: relative(P193_REPORT_PATH),
      mtime: null,
      runId: null,
      finalClassification: asString(report?.finalClassification),
      decision,
      decisionLabel: copy.label,
      decisionReason: copy.reason,
      trainSampleCount: null,
      holdoutSampleCount: null,
      purgedSampleCount: null,
      featureCount: null,
      targetDefinition: null,
      validationBoundary: null,
      metrics: metricSummary,
      perSymbolHoldout,
      interpretation: null,
      limitations: ["P193 metrics JSON 尚未產生。"],
    };
  }

  return {
    status: "present",
    path: relative(P193_METRICS_PATH),
    reportPath: relative(P193_REPORT_PATH),
    mtime: metricsMtime,
    runId: asString(metrics.runId),
    finalClassification: asString(report?.finalClassification),
    decision,
    decisionLabel: copy.label,
    decisionReason: copy.reason,
    trainSampleCount: asNumber(metrics.trainSampleCount),
    holdoutSampleCount: asNumber(metrics.holdoutSampleCount),
    purgedSampleCount: asNumber(metrics.purgedSampleCount),
    featureCount: asNumber(metrics.featureCount),
    targetDefinition: asString(metrics.targetDefinition),
    validationBoundary: asRecord(metrics.validationBoundary),
    metrics: metricSummary,
    perSymbolHoldout,
    interpretation: asString(metrics.interpretation),
    limitations: asStringArray(metrics.limitations),
  };
}

function normalizeOpenPrediction(raw: unknown): StrategyLabOpenPrediction | null {
  const record = asRecord(raw);
  const symbol = asString(record?.symbol);
  const featureDate = asString(record?.featureDate);
  if (!record || !symbol || !featureDate) return null;
  return {
    symbol,
    featureDate,
    close: asNumber(record.close),
    probabilityUp: asNumber(record.probabilityUp),
    predictedDirection: asDirection(record.predictedDirection),
    isLatest: asBoolean(record.isLatest) ?? false,
  };
}

function normalizeResolvedPrediction(raw: unknown): StrategyLabResolvedPrediction | null {
  const record = asRecord(raw);
  const symbol = asString(record?.symbol);
  const featureDate = asString(record?.featureDate);
  const targetDate = asString(record?.targetDate);
  if (!record || !symbol || !featureDate || !targetDate) return null;
  return {
    symbol,
    featureDate,
    targetDate,
    probabilityUp: asNumber(record.probabilityUp),
    predictedDirection: asDirection(record.predictedDirection),
    actualDirection: asDirection(record.actualDirection),
    forwardReturn: asNumber(record.forwardReturn),
    correct: asBoolean(record.correct) ?? false,
  };
}

function parseOhlcvRows(csvRaw: string): OhlcvRow[] | null {
  const lines = csvRaw.trim().split(/\r?\n/);
  const header = lines.shift()?.split(",") ?? [];
  const indexOf = (column: string) => header.indexOf(column);
  const symbolIndex = indexOf("symbol");
  const dateIndex = indexOf("date");
  const openIndex = indexOf("open");
  const highIndex = indexOf("high");
  const lowIndex = indexOf("low");
  const closeIndex = indexOf("close");
  const volumeIndex = indexOf("volume");

  if (
    symbolIndex < 0
    || dateIndex < 0
    || openIndex < 0
    || highIndex < 0
    || lowIndex < 0
    || closeIndex < 0
    || volumeIndex < 0
  ) {
    return null;
  }

  const rows: OhlcvRow[] = [];
  for (const line of lines) {
    const fields = line.split(",");
    const symbol = fields[symbolIndex];
    const date = fields[dateIndex];
    const open = Number(fields[openIndex]);
    const high = Number(fields[highIndex]);
    const low = Number(fields[lowIndex]);
    const close = Number(fields[closeIndex]);
    const volume = Number(fields[volumeIndex]);
    if (
      !symbol
      || !date
      || !Number.isFinite(open)
      || !Number.isFinite(high)
      || !Number.isFinite(low)
      || !Number.isFinite(close)
      || !Number.isFinite(volume)
    ) {
      return null;
    }
    rows.push({ symbol, date, open, high, low, close, volume });
  }

  return rows;
}

function asFeatureMap(value: unknown): Record<FeatureName, number> | null {
  const record = asRecord(value);
  if (!record) return null;
  const entries = RESOLVED_EXPANSION_FEATURES.map((feature) => [feature, asNumber(record[feature])] as const);
  if (entries.some(([, numberValue]) => numberValue === null)) return null;
  return Object.fromEntries(entries) as Record<FeatureName, number>;
}

function logisticFitFromMetrics(metrics: JsonRecord | null): LogisticFit | null {
  const fit = asRecord(metrics?.fit);
  const coefficientsRecord = asRecord(fit?.standardizedCoefficients);
  const coefficients = asFeatureMap(coefficientsRecord);
  const means = asFeatureMap(fit?.trainingFeatureMeans);
  const standardDeviations = asFeatureMap(fit?.trainingFeatureStandardDeviations);
  const intercept = asNumber(coefficientsRecord?.intercept);
  if (!coefficients || !means || !standardDeviations || intercept === null) return null;
  if (RESOLVED_EXPANSION_FEATURES.some((feature) => standardDeviations[feature] === 0)) return null;
  return { intercept, coefficients, means, standardDeviations };
}

function populationStandardDeviation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildFeatures(rows: OhlcvRow[], index: number): FeatureVector | null {
  const row = rows[index];
  const close5 = rows[index - 5]?.close;
  const close20 = rows[index - 20]?.close;
  if (!row || !close5 || !close20) return null;

  const returns10: number[] = [];
  for (let cursor = index - 9; cursor <= index; cursor += 1) {
    const previous = rows[cursor - 1]?.close;
    const current = rows[cursor]?.close;
    if (!previous || !current) return null;
    returns10.push(current / previous - 1);
  }

  const priorVolumeRows = rows.slice(index - 20, index);
  const averagePriorVolume = priorVolumeRows.reduce((sum, priorRow) => sum + priorRow.volume, 0) / priorVolumeRows.length;
  if (!Number.isFinite(averagePriorVolume) || averagePriorVolume === 0 || row.close === 0) return null;

  return {
    return_5d: row.close / close5 - 1,
    return_20d: row.close / close20 - 1,
    volatility_10d: populationStandardDeviation(returns10),
    volume_ratio_20d: row.volume / averagePriorVolume,
    intraday_range_pct: (row.high - row.low) / row.close,
  };
}

function probabilityFromFit(features: FeatureVector, fit: LogisticFit): number {
  const logit = RESOLVED_EXPANSION_FEATURES.reduce(
    (sum, feature) =>
      sum
      + ((features[feature] - fit.means[feature]) / fit.standardDeviations[feature])
      * fit.coefficients[feature],
    fit.intercept,
  );
  return 1 / (1 + Math.exp(-logit));
}

function groupRowsBySymbol(rows: OhlcvRow[]): Map<string, OhlcvRow[]> {
  const grouped = new Map<string, OhlcvRow[]>();
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

function deriveExpandedResolvedPredictions(
  csvRaw: string,
  metrics: JsonRecord | null,
  horizonTradingDays: number | null,
): StrategyLabResolvedPrediction[] | null {
  const rows = parseOhlcvRows(csvRaw);
  const fit = logisticFitFromMetrics(metrics);
  const validationBoundary = asRecord(metrics?.validationBoundary);
  const trainEndDate = asString(validationBoundary?.trainEndDate);
  const lookbackTradingRows = asNumber(asRecord(metrics?.features)?.lookbackTradingRows);
  if (!rows || !fit || !trainEndDate || horizonTradingDays === null || horizonTradingDays <= 0) return null;
  if (lookbackTradingRows !== 20) return null;

  const derived: StrategyLabResolvedPrediction[] = [];
  for (const symbolRows of groupRowsBySymbol(rows).values()) {
    for (let index = lookbackTradingRows; index + horizonTradingDays < symbolRows.length; index += 1) {
      const featureRow = symbolRows[index];
      const targetRow = symbolRows[index + horizonTradingDays];
      if (!featureRow || !targetRow || featureRow.date <= trainEndDate) continue;
      const features = buildFeatures(symbolRows, index);
      if (!features) return null;
      const probabilityUp = round(probabilityFromFit(features, fit));
      const predictedDirection: PredictedDirection = probabilityUp >= 0.5 ? "up" : "down";
      const forwardReturn = round(targetRow.close / featureRow.close - 1);
      const actualDirection: PredictedDirection = forwardReturn > 0 ? "up" : "down";
      derived.push({
        symbol: featureRow.symbol,
        featureDate: featureRow.date,
        targetDate: targetRow.date,
        probabilityUp,
        predictedDirection,
        actualDirection,
        forwardReturn,
        correct: predictedDirection === actualDirection,
      });
    }
  }

  return derived.sort((left, right) =>
    right.featureDate.localeCompare(left.featureDate)
    || left.symbol.localeCompare(right.symbol),
  );
}

function numericMatches(left: number | null, right: number | null, tolerance: number): boolean {
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) <= tolerance;
}

function validateExpandedResolvedRows(
  expandedRows: StrategyLabResolvedPrediction[],
  committedRows: StrategyLabResolvedPrediction[],
): string | null {
  if (expandedRows.length <= committedRows.length) {
    return `expanded resolved sample has ${expandedRows.length} rows, not more than committed ${committedRows.length}`;
  }

  for (let index = 0; index < committedRows.length; index += 1) {
    const expanded = expandedRows[index];
    const committed = committedRows[index];
    if (!expanded || !committed) return `missing row at committed sample index ${index}`;
    if (
      expanded.symbol !== committed.symbol
      || expanded.featureDate !== committed.featureDate
      || expanded.targetDate !== committed.targetDate
      || expanded.predictedDirection !== committed.predictedDirection
      || expanded.actualDirection !== committed.actualDirection
      || expanded.correct !== committed.correct
    ) {
      return `identity/direction mismatch at committed sample index ${index}`;
    }
    if (
      !numericMatches(
        expanded.probabilityUp,
        committed.probabilityUp,
        RESOLVED_EXPANSION_PROBABILITY_TOLERANCE,
      )
    ) {
      return `probability mismatch at committed sample index ${index}`;
    }
    if (
      !numericMatches(
        expanded.forwardReturn,
        committed.forwardReturn,
        RESOLVED_EXPANSION_FORWARD_RETURN_TOLERANCE,
      )
    ) {
      return `forward return mismatch at committed sample index ${index}`;
    }
  }

  return null;
}

function dateRangeFromRows(
  rows: StrategyLabResolvedPrediction[],
  field: "featureDate" | "targetDate",
): { start: string; end: string } | null {
  const dates = rows.map((row) => row[field]).filter(Boolean).sort();
  if (dates.length === 0) return null;
  return { start: dates[0] ?? "UNKNOWN", end: dates.at(-1) ?? "UNKNOWN" };
}

export function expandResolvedPredictions(
  committedRows: StrategyLabResolvedPrediction[],
  csvRaw: string,
  metrics: JsonRecord | null,
  horizonTradingDays: number | null,
): ResolvedExpansionResult {
  const expandedRows = deriveExpandedResolvedPredictions(csvRaw, metrics, horizonTradingDays);
  if (!expandedRows) {
    return {
      rows: committedRows,
      validationStatus: "fallback",
      reason: "unable to derive expanded rows from tracked CSV/metrics artifacts",
    };
  }
  const validationError = validateExpandedResolvedRows(expandedRows, committedRows);
  if (validationError) {
    return {
      rows: committedRows,
      validationStatus: "fallback",
      reason: validationError,
    };
  }
  return {
    rows: expandedRows,
    validationStatus: "expanded",
    reason: "derived rows matched committed recentResolved sample",
  };
}

const PREDICTIONS_CAVEAT_FALLBACK = "僅供研究驗證；不是投資建議，不可用於交易。";
const PREDICTIONS_EXPANSION_FALLBACK_CAVEAT = "Expanded resolved sample validation failed; showing committed recentResolved sample only.";
const RESOLVED_SAMPLE_SOURCE = "reader-derived from tracked P194 CSV + P193 metrics metadata";
const RESOLVED_SAMPLE_CAVEAT = "Research-only resolved artifact sample; not investment advice, not a trading signal, and not evidence of future predictive ability.";

async function buildPredictions(): Promise<StrategyLabPredictions> {
  const [record, mtime, csvRaw, metrics] = await Promise.all([
    readJson(LATEST_PREDICTIONS_PATH),
    statIso(LATEST_PREDICTIONS_PATH),
    fs.readFile(CSV_PATH, "utf8").catch(() => null),
    readJson(P193_METRICS_PATH),
  ]);

  if (!record) {
    return {
      status: "missing",
      path: relative(LATEST_PREDICTIONS_PATH),
      mtime: null,
      runId: null,
      dataEndDate: null,
      horizonTradingDays: null,
      modelBeatsBaseline: null,
      latestBySymbol: [],
      openPredictions: [],
      recentResolved: [],
      resolvedSampleProvenance: {
        source: RESOLVED_SAMPLE_SOURCE,
        validationStatus: "fallback",
        validationReason: "missing latest predictions artifact",
        fallbackActive: true,
        committedResolvedPairs: 0,
        activeResolvedPairs: 0,
        featureDateRange: null,
        targetDateRange: null,
        caveat: RESOLVED_SAMPLE_CAVEAT,
      },
      caveat: PREDICTIONS_CAVEAT_FALLBACK,
    };
  }

  const openPredictions = Array.isArray(record.openPredictions)
    ? record.openPredictions
        .map(normalizeOpenPrediction)
        .filter((item): item is StrategyLabOpenPrediction => item !== null)
    : [];
  const recentResolved = Array.isArray(record.recentResolved)
    ? record.recentResolved
        .map(normalizeResolvedPrediction)
        .filter((item): item is StrategyLabResolvedPrediction => item !== null)
    : [];
  const caveat = asString(record.caveat) ?? PREDICTIONS_CAVEAT_FALLBACK;
  const expansion = typeof csvRaw === "string"
    ? expandResolvedPredictions(
        recentResolved,
        csvRaw,
        metrics,
        asNumber(record.horizonTradingDays),
      )
    : {
        rows: recentResolved,
        validationStatus: "fallback" as const,
        reason: "missing P194 OHLCV CSV",
      };
  const fallbackActive = expansion.validationStatus === "fallback";

  return {
    status: "present",
    path: relative(LATEST_PREDICTIONS_PATH),
    mtime,
    runId: asString(record.runId),
    dataEndDate: asString(record.dataEndDate),
    horizonTradingDays: asNumber(record.horizonTradingDays),
    modelBeatsBaseline: asBoolean(record.modelBeatsBaseline),
    latestBySymbol: openPredictions.filter((prediction) => prediction.isLatest),
    openPredictions,
    recentResolved: expansion.rows,
    resolvedSampleProvenance: {
      source: RESOLVED_SAMPLE_SOURCE,
      validationStatus: expansion.validationStatus,
      validationReason: expansion.reason,
      fallbackActive,
      committedResolvedPairs: recentResolved.length,
      activeResolvedPairs: expansion.rows.length,
      featureDateRange: dateRangeFromRows(expansion.rows, "featureDate"),
      targetDateRange: dateRangeFromRows(expansion.rows, "targetDate"),
      caveat: RESOLVED_SAMPLE_CAVEAT,
    },
    caveat: fallbackActive
      ? appendCaveat(caveat, PREDICTIONS_EXPANSION_FALLBACK_CAVEAT)
      : caveat,
  };
}

function normalizeRunHistoryEntry(raw: unknown): StrategyLabRunHistoryEntry | null {
  const record = asRecord(raw);
  if (!record) return null;
  const holdoutAccuracy = asNumber(record.holdoutAccuracy);
  const majorityBaselineAccuracy = asNumber(record.majorityBaselineAccuracy);
  return {
    executedAt: asString(record.executedAt),
    runId: asString(record.runId),
    rows: asNumber(record.rows),
    dataEndDate: asString(record.dataEndDate),
    trainSampleCount: asNumber(record.trainSampleCount),
    holdoutSampleCount: asNumber(record.holdoutSampleCount),
    holdoutAccuracy,
    majorityBaselineAccuracy,
    deltaVsBaseline:
      asNumber(record.deltaVsBaseline)
      ?? (holdoutAccuracy !== null && majorityBaselineAccuracy !== null
        ? round(holdoutAccuracy - majorityBaselineAccuracy)
        : null),
    finalClassification: asString(record.finalClassification),
  };
}

async function buildRunHistory(): Promise<StrategyLabRunHistory> {
  const [record, mtime] = await Promise.all([
    readJson(RUN_HISTORY_PATH),
    statIso(RUN_HISTORY_PATH),
  ]);
  const entries = Array.isArray(record?.runs)
    ? record.runs
        .map(normalizeRunHistoryEntry)
        .filter((item): item is StrategyLabRunHistoryEntry => item !== null)
    : [];

  return {
    status: record ? "present" : "missing",
    path: relative(RUN_HISTORY_PATH),
    mtime,
    totalRuns: entries.length,
    entries: [...entries].reverse().slice(0, 20),
  };
}

function normalizeVariant(raw: unknown): StrategyLabProtocolVariant | null {
  const record = asRecord(raw);
  if (!record) return null;
  return {
    variantId: asString(record.variantId) ?? "UNKNOWN",
    name: asString(record.name) ?? "Unnamed variant",
    targetDefinition: asString(record.targetDefinition),
    featureNames: asStringArray(record.featureNames),
    trainSampleCount: asNumber(record.trainSampleCount),
    holdoutSampleCount: asNumber(record.holdoutSampleCount),
    purgedSampleCount: asNumber(record.purgedSampleCount),
    interpretation: asString(record.interpretation),
    ...metricSet(record),
  };
}

async function buildProtocolComparison(): Promise<StrategyLabProtocolComparison> {
  const [metrics, mtime] = await Promise.all([
    readJson(P195_METRICS_PATH),
    statIso(P195_METRICS_PATH),
  ]);

  const variants = Array.isArray(metrics?.variants)
    ? metrics.variants.map(normalizeVariant).filter((item): item is StrategyLabProtocolVariant => item !== null)
    : [];
  const bestVariant = [...variants].sort((left, right) =>
    (right.deltaVsMajorityBaseline ?? Number.NEGATIVE_INFINITY)
    - (left.deltaVsMajorityBaseline ?? Number.NEGATIVE_INFINITY),
  )[0] ?? null;
  const anyPositive = variants.some((variant) =>
    variant.accuracy !== null
    && variant.majorityBaselineAccuracy !== null
    && variant.accuracy > variant.majorityBaselineAccuracy,
  );
  const anyPresent = variants.length > 0;
  const decision: StrategyDecision = anyPositive
    ? "research_candidate"
    : anyPresent
      ? "needs_more_evidence"
      : "missing";
  const copy = decisionCopy(decision);

  return {
    status: metrics ? "present" : "missing",
    path: relative(P195_METRICS_PATH),
    mtime,
    finalClassification: asString(metrics?.finalClassification),
    decision,
    decisionLabel: anyPresent && !anyPositive ? "無策略勝過基準" : copy.label,
    decisionReason: anyPresent && !anyPositive
      ? "四個 bounded protocol variant 都未穩定打敗各自的 majority baseline。"
      : copy.reason,
    variants,
    bestVariant,
    limitations: asStringArray(metrics?.limitations),
  };
}

export async function readStrategyLabSnapshot(): Promise<StrategyLabSnapshot> {
  const [dataExport, refit, predictions, runHistory, protocolComparison] = await Promise.all([
    buildDataExport(),
    buildRefit(),
    buildPredictions(),
    buildRunHistory(),
    buildProtocolComparison(),
  ]);

  const artifactPaths = [
    ["P194 OHLCV CSV", CSV_PATH],
    ["P194 manifest", P194_MANIFEST_PATH],
    ["P193 refit metrics", P193_METRICS_PATH],
    ["P193 refit report", P193_REPORT_PATH],
    ["P193 latest predictions", LATEST_PREDICTIONS_PATH],
    ["Refit run history", RUN_HISTORY_PATH],
    ["P195 protocol comparison", P195_METRICS_PATH],
  ] as const;
  const artifactCompleteness = await Promise.all(
    artifactPaths.map(async ([label, filePath]) => {
      const mtime = await statIso(filePath);
      return { label, path: relative(filePath), present: mtime !== null, mtime };
    }),
  );
  const artifactSetStatus = artifactCompleteness.every((item) => item.present)
    ? "complete"
    : "blocked";
  const productDecision: StrategyDecision = artifactSetStatus === "blocked"
    ? "missing"
    : refit.decision === "do_not_promote" || protocolComparison.decision === "needs_more_evidence"
      ? "do_not_promote"
      : refit.decision === "research_candidate" && protocolComparison.decision === "research_candidate"
        ? "research_candidate"
        : refit.decision === "missing"
          ? "missing"
          : "needs_more_evidence";
  const productCopy = artifactSetStatus === "blocked"
    ? {
        label: "研究成果檔不完整",
        reason: "必要成果檔缺失；目前快照不可視為完整研究結果。",
      }
    : decisionCopy(productDecision);

  const simulation = buildStrategySimulation(predictions.recentResolved);
  const calibration = buildStrategyLabCalibration(predictions.recentResolved);
  const symbolReliability = buildStrategyLabSymbolReliability(
    predictions.recentResolved,
    predictions.latestBySymbol,
    simulation.thresholdDrilldown.symbolBreakdown.status === "candidate"
      ? simulation.thresholdDrilldown.symbolBreakdown.rows.map((row) => ({
          symbol: row.symbol,
          tradeCount: row.tradeCount,
        }))
      : [],
  );

  return {
    generatedAt: new Date().toISOString(),
    artifactSetStatus,
    dataExport,
    refit,
    predictions,
    simulation,
    calibration,
    symbolReliability,
    runHistory,
    protocolComparison,
    productStance: {
      decision: productDecision,
      label: productCopy.label,
      reason: productCopy.reason,
    },
    safety: {
      canonicalDbRead: false,
      canonicalDbWrite: false,
      externalNetworkUsedForRead: false,
      investmentAdvice: false,
      tradingExecution: false,
    },
    artifactCompleteness,
    availableActions: {
      // Browser clients cannot safely receive CRON_SECRET; reruns remain an
      // authenticated operator/API action rather than a public UI action.
      rerunRefit: false,
      rerunProtocolComparison: false,
    },
  };
}
