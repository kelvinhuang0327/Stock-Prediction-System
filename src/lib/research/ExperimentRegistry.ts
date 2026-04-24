/**
 * Research Experiment Registry — Wave 8
 *
 * Builds a unified "Research Experiment Registry / Hypothesis Tracker" that
 * answers:
 *   1. What research hypotheses are currently being tracked?
 *   2. Which hypotheses are verified vs. inferred vs. data-blocked?
 *   3. Which experiments are blocked by data gaps?
 *   4. Which Wave 7 gaps have been converted to actionable experiments?
 *   5. What is the highest-value next research task?
 *
 * This is a RESEARCH GOVERNANCE layer only. It MUST NOT:
 *   - Modify alphaScore, recommendationBucket, StrategyScreenEngine, or backtest
 *   - Fabricate validation results
 *   - Present INFERRED or NEEDS_DATA experiments as VERIFIED
 *
 * Persistence: code-defined TS constant (no DB migration, no JSON files).
 * Seed experiments are statically defined and enriched at runtime from the
 * Wave 7 ResearchGapsReport.
 *
 * Layer: Research Governance (L4 meta-tracking)
 */

import type { ResearchGapsReport, ResearchGapItem, ResearchCoverageItem } from './ResearchCoverageEngine';

// ─── Core Types ───────────────────────────────────────────────────────────────

/**
 * Lifecycle status of a research experiment.
 *
 * IDEA:       Hypothesis formed but not yet designed as a runnable experiment.
 * READY:      Experiment designed and data prerequisites available; ready to run.
 * RUNNING:    Experiment actively in progress.
 * BLOCKED:    Cannot proceed — missing data, schema change, or upstream gap.
 * PARTIAL:    Partially complete; some evidence gathered but not sufficient.
 * VALIDATED:  Hypothesis confirmed with sufficient evidence.
 * REJECTED:   Hypothesis falsified or experiment proved unfeasible.
 * DEFERRED:   Deliberately postponed; not blocked, just deprioritised.
 */
export type ExperimentStatus =
  | 'IDEA'
  | 'READY'
  | 'RUNNING'
  | 'BLOCKED'
  | 'PARTIAL'
  | 'VALIDATED'
  | 'REJECTED'
  | 'DEFERRED';

/**
 * Strength of evidence backing the hypothesis.
 *
 * VERIFIED:    Directly confirmed by real data from an implemented engine.
 * INFERRED:    Plausible from proxy signals or partial evidence.
 * NEEDS_DATA:  Hypothesis is reasonable but cannot be assessed until more data is collected.
 * UNVERIFIED:  Hypothesis only; no supporting or contradicting evidence yet.
 */
export type EvidenceLevel = 'VERIFIED' | 'INFERRED' | 'NEEDS_DATA' | 'UNVERIFIED';

export type ExperimentPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type ExperimentArea =
  | 'signal'
  | 'validation'
  | 'regime'
  | 'confidence'
  | 'event'
  | 'relevance'
  | 'data';

export interface ResearchExperiment {
  /** Stable unique identifier. Never reuse an ID once retired. */
  id: string;
  title: string;
  area: ExperimentArea;
  /** Falsifiable hypothesis that this experiment is designed to test. */
  hypothesis: string;
  status: ExperimentStatus;
  evidenceLevel: EvidenceLevel;
  priority: ExperimentPriority;
  /** Engine/module names this experiment depends on or validates. */
  linkedModules: string[];
  /** Current blockers preventing progress. Empty if status is not BLOCKED. */
  blockers: string[];
  /** Data or infrastructure required to run this experiment. */
  requiredData: string[];
  /** Measurable criteria that would constitute validation. */
  successCriteria: string[];
  /** Evidence gathered so far. May be empty for IDEA-stage experiments. */
  currentFindings: string[];
  /** Most actionable next step to advance this experiment. */
  recommendedNextStep?: string;
  /** Team or role best positioned to own this experiment. */
  ownerHint?: string;
  /** ISO timestamp of last status/finding update. */
  lastUpdated: string;
}

export interface ExperimentRegistrySummary {
  total: number;
  ready: number;
  running: number;
  blocked: number;
  partial: number;
  validated: number;
  rejected: number;
  deferred: number;
  idea: number;
}

export interface ExperimentRegistry {
  experiments: ResearchExperiment[];
  summary: ExperimentRegistrySummary;
  generatedAt: string;
}

// ─── Internal seed definition ─────────────────────────────────────────────────

/** Seed definition — same as ResearchExperiment plus dynamic enrichment metadata. */
interface SeedExperimentDef {
  id: string;
  title: string;
  area: ExperimentArea;
  hypothesis: string;
  /** Status when no live data is available for enrichment. */
  defaultStatus: ExperimentStatus;
  /** Evidence level when no live data is available for enrichment. */
  defaultEvidenceLevel: EvidenceLevel;
  priority: ExperimentPriority;
  linkedModules: string[];
  /** Blockers that are always structurally present (not data-conditional). */
  staticBlockers: string[];
  requiredData: string[];
  successCriteria: string[];
  /** Static findings known at seed-definition time. */
  staticFindings: string[];
  recommendedNextStep?: string;
  ownerHint?: string;
  /**
   * Gap keys from ResearchCoverageEngine (Wave 7) that map to this experiment.
   * When a linked gap appears in ResearchGapsReport.topGaps, the experiment
   * is enriched with the gap's reason, recommendedNextStep, and (for HIGH
   * priority gaps) has its status downgraded to BLOCKED if currently IDEA.
   */
  linkedGapKeys: string[];
  /**
   * Coverage item keys from ResearchCoverageEngine whose status is used to
   * derive the dynamic evidenceLevel. E.g. 'signal:topic_surging'.
   */
  linkedCoverageKeys: string[];
}

// ─── Seed Experiments ─────────────────────────────────────────────────────────

const SEED_EXPERIMENTS: SeedExperimentDef[] = [
  // ── 1. Label redesign validation ──────────────────────────────────────────
  {
    id: 'label-redesign-validation',
    title: '訊號標籤分類有效性驗證',
    area: 'signal',
    hypothesis:
      '現有訊號標籤類別（STRONG_SIGNAL / CONDITIONAL_SIGNAL / WEAK_SIGNAL / NOISE）能有效分層未來報酬分佈，調整標籤邊界不會帶來顯著改善。',
    defaultStatus: 'IDEA',
    defaultEvidenceLevel: 'NEEDS_DATA',
    priority: 'HIGH',
    linkedModules: ['SignalEffectivenessEngine', 'SignalHistoryBuilder'],
    staticBlockers: [],
    requiredData: [
      'StockQuote 連續 ≥30 個交易日',
      'TAIEX MarketIndex 資料',
      '6 種訊號類型各 ≥30 筆觀察',
    ],
    successCriteria: [
      '6 種訊號類型樣本數均 ≥30',
      '各標籤的未來報酬分佈具有統計顯著差異（p < 0.1）',
      'Walk-forward 驗證確認跨時間段的標籤穩定性',
    ],
    staticFindings: [
      '現有 SignalEffectivenessEngine 實作已支援 STRONG_SIGNAL / CONDITIONAL_SIGNAL / WEAK_SIGNAL / NOISE 四層分類',
      '分類依據：excessReturn 正負、stabilityScore、regimeFragile 三項組合判斷',
    ],
    recommendedNextStep: '收集各訊號類型 ≥30 筆觀察後，計算各標籤的報酬分佈並進行 K-S 檢定',
    ownerHint: '訊號工程師',
    linkedGapKeys: ['gap:signal_insufficient_sample', 'gap:taiex_unavailable'],
    linkedCoverageKeys: [
      'signal:topic_surging',
      'signal:theme_diffusing',
      'signal:strong_alpha_candidate',
      'signal:chip_accumulation_signal',
      'signal:risk_cluster_elevated',
      'signal:regime_shift_signal',
    ],
  },

  // ── 2. Walk-forward sample sufficiency ────────────────────────────────────
  {
    id: 'walkforward-sample-sufficiency',
    title: 'Walk-Forward 驗證樣本充裕度',
    area: 'validation',
    hypothesis:
      '以現有樣本量進行 Walk-Forward 分半驗證，能產生穩定的跨時段一致性結果；倍增資料量後分類結論不會根本改變。',
    defaultStatus: 'IDEA',
    defaultEvidenceLevel: 'NEEDS_DATA',
    priority: 'HIGH',
    linkedModules: ['WalkForwardValidator', 'SignalEffectivenessEngine'],
    staticBlockers: [],
    requiredData: [
      '各訊號類型 ≥16 筆觀察（每半各 ≥8 筆）',
      'TAIEX MarketIndex 資料（前向報酬計算）',
    ],
    successCriteria: [
      '所有訊號類型達到 MIN_HALF_SAMPLE=8 的門檻',
      '多數訊號的分半一致性評分 ≥0.6',
      '倍增樣本後，分類不發生根本性改變（無 STRONG→NOISE 跳躍）',
    ],
    staticFindings: [
      'WalkForwardValidator 已實作：按時間序分前後半，分別計算 hitRate / excessReturn / classification',
      '一致性判斷：hitRateDeviation < 0.15 AND classificationMatch AND excessReturnSignMatch → STABLE',
    ],
    recommendedNextStep: '確認各訊號類型目前樣本數，對達到 ≥16 者立即執行 Walk-Forward 驗證',
    ownerHint: '訊號工程師',
    linkedGapKeys: ['gap:signal_insufficient_sample'],
    linkedCoverageKeys: ['validation:walk_forward'],
  },

  // ── 3. Regime history coverage ────────────────────────────────────────────
  {
    id: 'regime-history-coverage',
    title: '市場環境歷史覆蓋度',
    area: 'regime',
    hypothesis:
      'DailyMarketSnapshot 歷史記錄足以代表 ≥2 種不同市場環境（多頭/空頭/中性），且每種環境對各訊號類型各有 ≥5 筆觀察。',
    defaultStatus: 'BLOCKED',
    defaultEvidenceLevel: 'NEEDS_DATA',
    priority: 'HIGH',
    linkedModules: ['RegimeStratifiedEngine', 'MarketRegimeEngine'],
    staticBlockers: ['DailyMarketSnapshot 可能為空（regimeSnapshotCount = 0）'],
    requiredData: [
      'DailyMarketSnapshot ≥100 筆（各環境均有足夠樣本）',
      'MarketRegimeEngine 每日寫入快照',
    ],
    successCriteria: [
      'DailyMarketSnapshot 記錄數 ≥100',
      '≥70% 的訊號類型具備 ≥2 個環境桶，每桶 ≥5 筆',
      '各環境的超額報酬呈現統計可區分的分佈',
    ],
    staticFindings: [
      'RegimeStratifiedEngine 已實作：讀取 DailyMarketSnapshot 建立日期→環境對照表',
      'FRAGILE 條件：assessableRegimes < 2 或 unknownRegimeFraction > 0.5 或環境間 excessReturn 方向衝突',
    ],
    recommendedNextStep: '啟動 MarketRegimeEngine 每日寫入，累積 ≥30 筆後重新評估覆蓋狀態',
    ownerHint: '資料工程師',
    linkedGapKeys: ['gap:no_regime_history'],
    linkedCoverageKeys: ['regime:stratification'],
  },

  // ── 4. Event source persistence ───────────────────────────────────────────
  {
    id: 'event-source-persistence',
    title: '事件來源類型持久化',
    area: 'event',
    hypothesis:
      '在 NewsEvent schema 中加入 sourceType 欄位，可讓 DB 路徑的事件品質評估準確度接近 memory 路徑，消除現有的結構性降級。',
    defaultStatus: 'BLOCKED',
    defaultEvidenceLevel: 'INFERRED',
    priority: 'MEDIUM',
    linkedModules: ['EventSourceQualityEngine', 'EventIngestionService'],
    staticBlockers: [
      'NewsEvent schema 目前缺少 sourceType 欄位',
      'DB 路徑永遠以 sourceTypeTracked=false 執行，品質上限為 MIXED_SOURCE',
      'Schema migration 已刻意延後以避免 schema 風險',
    ],
    requiredData: [
      'NewsEvent.sourceType 欄位（schema migration）',
      '歷史事件的 sourceType 回填',
    ],
    successCriteria: [
      'NewsEvent schema 包含 sourceType 欄位',
      'DB 路徑的品質評估與 memory 路徑差異 ≤5%',
      '歷史事件以正確 sourceType 回填完成',
    ],
    staticFindings: [
      'EventSourceQualityEngine 已區分 sourceTypeTracked=true/false 兩種路徑',
      'DB 路徑：hardcoded sourceType="rss"，因此 sourceTypeTracked=false，品質上限 MIXED_SOURCE',
      'Memory 路徑：來源類型正確（rss/mock），可達 LIVE_CONFIDENT',
    ],
    recommendedNextStep: '評估 NewsEvent schema migration 的影響範圍，決定是否在下一輪技術債中執行',
    ownerHint: '資料工程師 / 後端工程師',
    linkedGapKeys: ['gap:event_sourcetype_not_in_db'],
    linkedCoverageKeys: ['event:source_quality'],
  },

  // ── 5. Confidence outcome collection ──────────────────────────────────────
  {
    id: 'confidence-outcome-collection',
    title: '信心值校準：預測結果收集',
    area: 'confidence',
    hypothesis:
      '收集訊號觸發 → 實際 N 日報酬的預測-結果配對，能讓 Brier score 校準成為可能，使信心值從啟發式規則升級為統計可驗證的校準機率。',
    defaultStatus: 'BLOCKED',
    defaultEvidenceLevel: 'INFERRED',
    priority: 'MEDIUM',
    linkedModules: ['ConfidenceReadinessEngine', 'SignalEffectivenessEngine'],
    staticBlockers: [
      '系統目前無預測-結果配對追蹤機制',
      'CALIBRATED 狀態在現有架構下結構性不可達（需 ≥30 預測-結果配對）',
      '需要新的資料收集 pipeline',
    ],
    requiredData: [
      '每種訊號類型 ≥30 筆預測-結果配對',
      '訊號觸發時間戳與對應的 N 日後報酬',
      '配對資料的持久化儲存（新資料表或欄位）',
    ],
    successCriteria: [
      '各訊號類型具備 ≥30 筆預測-結果配對',
      '所有訊號類型 Brier score 可計算',
      '信心值校準曲線呈單調遞增關係',
    ],
    staticFindings: [
      'ConfidenceReadinessEngine 已實作：BRIER_ADJACENT + sampleSize ≥10 → PARTIAL',
      'CALIBRATED 需要 predictionOutcomePairs ≥30，但系統無此資料收集機制',
      '所有啟發式類型（COVERAGE_PROXY / SCORE_DERIVED / RULE_PENALTY）結構性 UNCALIBRATED',
    ],
    recommendedNextStep: '設計預測-結果配對的資料結構，評估是否新增 SignalPrediction 資料表',
    ownerHint: '研究工程師',
    linkedGapKeys: ['gap:confidence_uncalibrated'],
    linkedCoverageKeys: ['confidence:calibration'],
  },

  // ── 6. Relevance overlay completeness ─────────────────────────────────────
  {
    id: 'relevance-overlay-completeness',
    title: '相關性 Overlay 品質完整性',
    area: 'relevance',
    hypothesis:
      '以預先計算的 WalkForwardValidator 和 RegimeStratifiedEngine 結果取代代理指標（stabilityScore / regimeBreakdown），能顯著提升相關性排序的研究品質評分準確度。',
    defaultStatus: 'IDEA',
    defaultEvidenceLevel: 'INFERRED',
    priority: 'LOW',
    linkedModules: ['RelevanceQualityOverlay', 'WalkForwardValidator', 'RegimeStratifiedEngine'],
    staticBlockers: [],
    requiredData: [
      '預先計算並快取的 WalkForwardResult（各訊號類型）',
      '預先計算並快取的 RegimeStratifiedResult（各訊號類型）',
    ],
    successCriteria: [
      '實作 WalkForward / Regime 快取機制',
      'Overlay 使用直接引擎結果而非代理指標',
      'A/B 比較顯示排序差異超過雜訊門檻',
    ],
    staticFindings: [
      'RelevanceQualityOverlay 目前使用代理：stabilityScore 代理 WalkForward、regimeBreakdown 代理 RegimeStratified',
      '代理指標來自真實資料，但解讀層加入了啟發式推斷',
      '使用直接引擎結果需要非同步預計算，影響 API 熱路徑效能',
    ],
    recommendedNextStep: '評估預計算快取的效能影響，考慮在 /api/signals/effectiveness/batch 中加入 walkForward / regime 欄位',
    ownerHint: '研究工程師',
    linkedGapKeys: ['gap:relevance_proxy_only'],
    linkedCoverageKeys: ['relevance:quality_overlay'],
  },

  // ── 7. Signal disagreement effectiveness ──────────────────────────────────
  {
    id: 'signal-disagreement-effectiveness',
    title: '訊號分歧度與報酬相關性驗證',
    area: 'signal',
    hypothesis:
      'SignalDisagreementEngine 計算的分歧分數與未來報酬呈負相關：高分歧預測較低的報酬確信度和較差的實際結果。',
    defaultStatus: 'IDEA',
    defaultEvidenceLevel: 'UNVERIFIED',
    priority: 'MEDIUM',
    linkedModules: ['SignalDisagreementEngine', 'SignalEffectivenessEngine'],
    staticBlockers: [],
    requiredData: [
      '≥30 筆具備分歧分數的訊號觀察',
      '對應的 N 日後實際報酬',
    ],
    successCriteria: [
      '≥30 筆觀察具備分歧分數與前向報酬配對',
      '分歧分數與前向報酬的秩相關係數為負（p < 0.1）',
      '高分歧子集的實際報酬顯著低於低分歧子集',
    ],
    staticFindings: [
      'SignalDisagreementEngine 已實作：stdDev(activeScores) / 50 計算分歧分數',
      '理論上高分歧應降低報酬確信度，但尚無實際資料驗證此假設',
      '引擎為純函數，不依賴 DB 或非同步操作',
    ],
    recommendedNextStep: '在 SignalHistoryBuilder 中加入分歧分數記錄，累積足夠觀察後執行相關性分析',
    ownerHint: '研究工程師',
    linkedGapKeys: ['gap:signal_insufficient_sample'],
    linkedCoverageKeys: [
      'signal:topic_surging',
      'signal:strong_alpha_candidate',
      'signal:chip_accumulation_signal',
    ],
  },
];

// ─── Builder helpers ──────────────────────────────────────────────────────────

/**
 * Derive a dynamic EvidenceLevel from the linked coverage items.
 * If any linked item is READY → promote toward VERIFIED.
 * If all linked items are INSUFFICIENT_DATA / UNAVAILABLE → NEEDS_DATA.
 */
function deriveEvidenceLevel(
  seed: SeedExperimentDef,
  coverageItems: ResearchCoverageItem[],
  defaultEvidenceLevel: EvidenceLevel,
): EvidenceLevel {
  if (seed.linkedCoverageKeys.length === 0) return defaultEvidenceLevel;

  const linked = coverageItems.filter((item) => seed.linkedCoverageKeys.includes(item.key));
  if (linked.length === 0) return defaultEvidenceLevel;

  const hasReady = linked.some((item) => item.status === 'READY');
  const hasPartial = linked.some((item) => item.status === 'PARTIAL' || item.status === 'DEGRADED');
  const allBlocked = linked.every(
    (item) =>
      item.status === 'INSUFFICIENT_DATA' ||
      item.status === 'UNAVAILABLE' ||
      item.status === 'SIMULATION_DOMINATED',
  );

  if (allBlocked) return 'NEEDS_DATA';
  if (hasReady) {
    // Only upgrade to VERIFIED if the seed's default level allows it
    return defaultEvidenceLevel === 'UNVERIFIED' ? 'INFERRED' : 'VERIFIED';
  }
  if (hasPartial) return 'INFERRED';
  return defaultEvidenceLevel;
}

/**
 * Enrich a seed experiment with findings and status from the live gaps report.
 */
function enrichFromGapsReport(
  seed: SeedExperimentDef,
  gapsReport: ResearchGapsReport,
): { extraFindings: string[]; downgradedStatus: ExperimentStatus | null; enrichedNextStep: string | undefined } {
  const extraFindings: string[] = [];
  let highGapFound = false;
  let enrichedNextStep: string | undefined;

  for (const gapKey of seed.linkedGapKeys) {
    const gap: ResearchGapItem | undefined = gapsReport.topGaps.find((g) => g.key === gapKey);
    if (!gap) continue;

    extraFindings.push(`[Wave 7 Gap] ${gap.reason}`);
    if (!enrichedNextStep) {
      enrichedNextStep = gap.recommendedNextStep;
    }
    if (gap.priority === 'HIGH') {
      highGapFound = true;
    }
  }

  // Downgrade IDEA → BLOCKED if a HIGH-priority linked gap is currently active
  const downgradedStatus =
    highGapFound && seed.defaultStatus === 'IDEA' ? 'BLOCKED' : null;

  return { extraFindings, downgradedStatus, enrichedNextStep };
}

/**
 * Convert a SeedExperimentDef into a ResearchExperiment, optionally enriched
 * from the live ResearchGapsReport.
 */
function seedToExperiment(
  seed: SeedExperimentDef,
  gapsReport: ResearchGapsReport | null | undefined,
  generatedAt: string,
): ResearchExperiment {
  let status: ExperimentStatus = seed.defaultStatus;
  let evidenceLevel: EvidenceLevel = seed.defaultEvidenceLevel;
  const findings = [...seed.staticFindings];
  let nextStep = seed.recommendedNextStep;

  if (gapsReport) {
    const { extraFindings, downgradedStatus, enrichedNextStep } = enrichFromGapsReport(
      seed,
      gapsReport,
    );
    findings.push(...extraFindings);

    if (downgradedStatus) status = downgradedStatus;
    if (!nextStep && enrichedNextStep) nextStep = enrichedNextStep;

    evidenceLevel = deriveEvidenceLevel(seed, gapsReport.items, seed.defaultEvidenceLevel);
  }

  return {
    id: seed.id,
    title: seed.title,
    area: seed.area,
    hypothesis: seed.hypothesis,
    status,
    evidenceLevel,
    priority: seed.priority,
    linkedModules: seed.linkedModules,
    blockers: [...seed.staticBlockers],
    requiredData: seed.requiredData,
    successCriteria: seed.successCriteria,
    currentFindings: findings,
    recommendedNextStep: nextStep,
    ownerHint: seed.ownerHint,
    lastUpdated: generatedAt,
  };
}

function buildRegistrySummary(experiments: ResearchExperiment[]): ExperimentRegistrySummary {
  const counts: ExperimentRegistrySummary = {
    total: experiments.length,
    idea: 0,
    ready: 0,
    running: 0,
    blocked: 0,
    partial: 0,
    validated: 0,
    rejected: 0,
    deferred: 0,
  };
  for (const exp of experiments) {
    switch (exp.status) {
      case 'IDEA': counts.idea++; break;
      case 'READY': counts.ready++; break;
      case 'RUNNING': counts.running++; break;
      case 'BLOCKED': counts.blocked++; break;
      case 'PARTIAL': counts.partial++; break;
      case 'VALIDATED': counts.validated++; break;
      case 'REJECTED': counts.rejected++; break;
      case 'DEFERRED': counts.deferred++; break;
    }
  }
  return counts;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the research experiment registry, optionally enriched from Wave 7's
 * ResearchGapsReport.
 *
 * Pure function — no DB access, no async. Accepts null/undefined gapsReport
 * for degraded-mode callers that cannot fetch live coverage data.
 */
export function buildExperimentRegistry(
  gapsReport?: ResearchGapsReport | null,
): ExperimentRegistry {
  const generatedAt = gapsReport?.generatedAt ?? new Date().toISOString();

  const experiments = SEED_EXPERIMENTS.map((seed) =>
    seedToExperiment(seed, gapsReport, generatedAt),
  );

  return {
    experiments,
    summary: buildRegistrySummary(experiments),
    generatedAt,
  };
}

// ─── Badge helpers for UI ─────────────────────────────────────────────────────

export function getExperimentStatusLabel(status: ExperimentStatus): string {
  const labels: Record<ExperimentStatus, string> = {
    IDEA: '構想',
    READY: '可執行',
    RUNNING: '進行中',
    BLOCKED: '受阻',
    PARTIAL: '部分完成',
    VALIDATED: '已驗證',
    REJECTED: '已否決',
    DEFERRED: '延後',
  };
  return labels[status];
}

export function getExperimentStatusColor(status: ExperimentStatus): string {
  const colors: Record<ExperimentStatus, string> = {
    IDEA: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    READY: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
    RUNNING: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400',
    BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    PARTIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    VALIDATED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    REJECTED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    DEFERRED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };
  return colors[status];
}

export function getEvidenceLevelLabel(level: EvidenceLevel): string {
  const labels: Record<EvidenceLevel, string> = {
    VERIFIED: '已驗證',
    INFERRED: '推斷',
    NEEDS_DATA: '待資料',
    UNVERIFIED: '未驗證',
  };
  return labels[level];
}

export function getEvidenceLevelColor(level: EvidenceLevel): string {
  const colors: Record<EvidenceLevel, string> = {
    VERIFIED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    INFERRED: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    NEEDS_DATA: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
    UNVERIFIED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  };
  return colors[level];
}

export function getExperimentPriorityColor(priority: ExperimentPriority): string {
  if (priority === 'HIGH') return 'text-red-600 dark:text-red-400';
  if (priority === 'MEDIUM') return 'text-amber-600 dark:text-amber-300';
  return 'text-slate-500 dark:text-slate-400';
}
