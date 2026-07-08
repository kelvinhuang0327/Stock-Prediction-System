import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  buildStrategySimulation,
  type StrategyLabSimulation,
} from "@/lib/research/StrategyLabSimulationEngine";

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

const PREDICTIONS_CAVEAT_FALLBACK = "僅供研究驗證；不是投資建議，不可用於交易。";

async function buildPredictions(): Promise<StrategyLabPredictions> {
  const [record, mtime] = await Promise.all([
    readJson(LATEST_PREDICTIONS_PATH),
    statIso(LATEST_PREDICTIONS_PATH),
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
    recentResolved,
    caveat: asString(record.caveat) ?? PREDICTIONS_CAVEAT_FALLBACK,
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

  return {
    generatedAt: new Date().toISOString(),
    artifactSetStatus,
    dataExport,
    refit,
    predictions,
    simulation: buildStrategySimulation(predictions.recentResolved),
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
