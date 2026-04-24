/**
 * Research Coverage Engine — Wave 7
 *
 * Builds a unified "Research Coverage Dashboard / Gaps Report" that
 * answers:
 *   1. Which research modules are truly available?
 *   2. Which are degraded / insufficient / simulation-dominated?
 *   3. Which research conclusions have high credibility?
 *   4. What are the biggest research blind spots?
 *   5. What data gaps should be addressed next?
 *
 * This is a RESEARCH TRANSPARENCY layer only. It MUST NOT:
 *   - Modify alphaScore, recommendationBucket, StrategyScreenEngine, or backtest
 *   - Fabricate coverage, readiness, or calibration data
 *   - Present degraded/insufficient states as available
 *
 * Layer: Research Transparency (L3+ meta-reporting)
 */

import type { EventSourceQuality } from '@/lib/events/EventSourceQualityEngine';
import type { SignalEffectivenessBatchApiResponse, SignalEffectivenessBatchResult } from '@/lib/signals/types';

// ─── Core Types ───────────────────────────────────────────────────────────────

/**
 * Coverage status for one research module.
 *
 * READY:               Sufficient data; module produces reliable research output.
 * PARTIAL:             Some data available; output possible but with caveats.
 * DEGRADED:            Data present but insufficient to produce reliable conclusions.
 * INSUFFICIENT_DATA:   Too little data to assess; conclusions would be fabricated.
 * SIMULATION_DOMINATED: Module output driven by simulated/mock data, not real signals.
 * UNAVAILABLE:         Prerequisite data source is missing entirely.
 */
export type ResearchCoverageStatus =
  | 'READY'
  | 'PARTIAL'
  | 'DEGRADED'
  | 'INSUFFICIENT_DATA'
  | 'SIMULATION_DOMINATED'
  | 'UNAVAILABLE';

export interface ResearchCoverageItem {
  /** Unique identifier for this research module. */
  key: string;
  /** Human-readable module name. */
  title: string;
  /** Research area this module belongs to. */
  area: 'signal' | 'validation' | 'regime' | 'confidence' | 'event' | 'relevance';
  /** Coverage status derived from actual data conditions. */
  status: ResearchCoverageStatus;
  /**
   * How confident we are in the research OUTPUT from this module (0–100).
   * Distinct from whether we can compute it at all (that is status).
   */
  confidence: number;
  /** Fraction of the module's maximum capacity that is usable (0–1). */
  coverageRatio?: number;
  /** Number of usable observations / rows / events backing this module. */
  sampleSize?: number;
  /** Top limitations explaining the status. */
  primaryLimitations: string[];
  /** Concrete recommended action to improve this module's status. */
  recommendedNextStep?: string;
}

export interface ResearchGapItem {
  key: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Which research areas this gap affects. */
  affectedAreas: ResearchCoverageItem['area'][];
  recommendedNextStep: string;
}

export interface ResearchGapsSummary {
  readyCount: number;
  partialCount: number;
  degradedCount: number;
  insufficientCount: number;
  simulationDominatedCount: number;
  unavailableCount: number;
  totalModules: number;
  /**
   * Weighted readiness score 0–100.
   * READY=100, PARTIAL=60, DEGRADED=30, INSUFFICIENT_DATA=10,
   * SIMULATION_DOMINATED=0, UNAVAILABLE=0.
   */
  overallReadiness: number;
}

export interface ResearchGapsReport {
  items: ResearchCoverageItem[];
  summary: ResearchGapsSummary;
  topGaps: ResearchGapItem[];
  generatedAt: string;
  limitations: string[];
}

// ─── Input data (pre-fetched by the API route) ────────────────────────────────

export interface ResearchCoverageInputData {
  /** Signal effectiveness batch (window=5). Use degraded batch if unavailable. */
  signalBatch: SignalEffectivenessBatchApiResponse;
  /** Market event source quality. null if event engine is completely unavailable. */
  eventSourceQuality: EventSourceQuality | null;
  /** Number of TAIEX rows in MarketIndex table (0 if unavailable). */
  taiexRowCount: number;
  /** Number of rows in DailyMarketSnapshot (0 if no regime history). */
  regimeSnapshotCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_SAMPLE_STRONG = 30;      // signal effectiveness — full readiness
const MIN_SAMPLE_DEGRADED = 10;    // signal effectiveness — minimum floor
const MIN_WALK_FORWARD_TOTAL = 16; // 2 × MIN_HALF_SAMPLE(8) for walk-forward split
const MIN_REGIME_SNAPSHOT_READY = 100; // enough regime history for READY
const MIN_REGIME_SNAPSHOT_PARTIAL = 30; // enough for PARTIAL
const MIN_REGIME_PER_BUCKET = 5;   // minimum per regime bucket (from SignalEffectivenessEngine)
const MIN_TAIEX_ROWS = 10;         // minimum TAIEX rows before signal effectiveness can run

const STATUS_READINESS_WEIGHT: Record<ResearchCoverageStatus, number> = {
  READY: 1.0,
  PARTIAL: 0.6,
  DEGRADED: 0.3,
  INSUFFICIENT_DATA: 0.1,
  SIMULATION_DOMINATED: 0.0,
  UNAVAILABLE: 0.0,
};

// ─── Signal Effectiveness Coverage ───────────────────────────────────────────

function signalCoverageStatus(
  result: SignalEffectivenessBatchResult,
  taiexAvailable: boolean,
): ResearchCoverageStatus {
  if (!taiexAvailable) return 'UNAVAILABLE';
  if (result.sampleSize === 0) return 'INSUFFICIENT_DATA';
  if (result.sampleSize < MIN_SAMPLE_DEGRADED) return 'INSUFFICIENT_DATA';
  if (result.sampleSize < MIN_SAMPLE_STRONG) return 'PARTIAL';
  return 'READY';
}

function signalCoverageConfidence(
  result: SignalEffectivenessBatchResult,
  status: ResearchCoverageStatus,
): number {
  if (status === 'UNAVAILABLE') return 95; // confident it's unavailable
  if (status === 'INSUFFICIENT_DATA') return 85; // confident it's insufficient
  if (status === 'PARTIAL') return 55 + Math.min(20, Math.floor((result.sampleSize - 10) / 2));
  // READY
  const base = 70;
  const sampleBonus = Math.min(15, Math.floor(result.sampleSize / 10));
  const limitPenalty = Math.min(15, result.limitations.length * 5);
  return Math.min(90, base + sampleBonus - limitPenalty);
}

function buildSignalItems(
  batch: SignalEffectivenessBatchApiResponse,
  taiexAvailable: boolean,
): ResearchCoverageItem[] {
  return batch.results.map((result) => {
    const status = signalCoverageStatus(result, taiexAvailable);
    const confidence = signalCoverageConfidence(result, status);
    const coverageRatio = taiexAvailable
      ? Math.min(1, result.sampleSize / MIN_SAMPLE_STRONG)
      : 0;

    const limitations: string[] = [];
    if (!taiexAvailable) {
      limitations.push('TAIEX 基準資料不可用，無法計算前向報酬');
    } else if (result.sampleSize < MIN_SAMPLE_DEGRADED) {
      limitations.push(`有效樣本 ${result.sampleSize} 筆，低於最低研究門檻 ${MIN_SAMPLE_DEGRADED}`);
    } else if (result.sampleSize < MIN_SAMPLE_STRONG) {
      limitations.push(`樣本 ${result.sampleSize} 筆（建議 ≥${MIN_SAMPLE_STRONG} 筆以達 READY）`);
    }
    if (result.classification === 'NOISE' && result.sampleSize >= MIN_SAMPLE_DEGRADED) {
      limitations.push('此訊號分類為 NOISE（歷史無明顯 edge），可繼續追蹤但研究優先級偏低');
    }
    limitations.push(...result.limitations.slice(0, 2));

    return {
      key: `signal:${result.signalType}`,
      title: `訊號有效性：${result.signalType}`,
      area: 'signal',
      status,
      confidence,
      coverageRatio,
      sampleSize: result.sampleSize,
      primaryLimitations: [...new Set(limitations)].slice(0, 3),
      recommendedNextStep:
        status === 'INSUFFICIENT_DATA'
          ? `累積更多 ${result.signalType} 觀察記錄（目標 ≥${MIN_SAMPLE_STRONG} 筆）`
          : status === 'PARTIAL'
          ? `繼續累積樣本（目前 ${result.sampleSize}，目標 ${MIN_SAMPLE_STRONG}+）`
          : undefined,
    };
  });
}

// ─── Walk-Forward Validation Coverage ────────────────────────────────────────

function buildWalkForwardItem(batch: SignalEffectivenessBatchApiResponse): ResearchCoverageItem {
  const samples = batch.results.map((r) => r.sampleSize);
  const minSample = samples.length > 0 ? Math.min(...samples) : 0;
  const avgSample = samples.length > 0 ? Math.round(samples.reduce((sum, v) => sum + v, 0) / samples.length) : 0;
  const readyCount = samples.filter((s) => s >= MIN_SAMPLE_STRONG).length;
  const partialCount = samples.filter((s) => s >= MIN_WALK_FORWARD_TOTAL && s < MIN_SAMPLE_STRONG).length;

  let status: ResearchCoverageStatus;
  let coverageRatio: number;
  let primaryLimitations: string[];
  let recommendedNextStep: string | undefined;

  if (minSample === 0) {
    status = 'INSUFFICIENT_DATA';
    coverageRatio = 0;
    primaryLimitations = ['所有訊號類型均無可用觀察記錄，walk-forward 無法執行'];
    recommendedNextStep = '需先累積訊號觀察記錄，每個訊號類型至少需 16 筆才可時序切分';
  } else if (minSample < MIN_WALK_FORWARD_TOTAL) {
    status = 'INSUFFICIENT_DATA';
    coverageRatio = minSample / MIN_WALK_FORWARD_TOTAL;
    primaryLimitations = [
      `最少樣本的訊號類型僅有 ${minSample} 筆，低於 walk-forward 最低門檻 ${MIN_WALK_FORWARD_TOTAL}（每半段需 ≥8）`,
    ];
    recommendedNextStep = `繼續累積訊號觀察；最少需 ${MIN_WALK_FORWARD_TOTAL} 筆才可執行時序切分`;
  } else if (readyCount + partialCount < batch.results.length) {
    status = 'DEGRADED';
    coverageRatio = (readyCount + partialCount) / Math.max(1, batch.results.length);
    primaryLimitations = [
      `${batch.results.length - readyCount - partialCount} 個訊號類型樣本仍不足 walk-forward`,
    ];
    recommendedNextStep = '累積更多觀察記錄以覆蓋所有訊號類型';
  } else if (readyCount === batch.results.length) {
    status = 'READY';
    coverageRatio = 1.0;
    primaryLimitations = [];
    recommendedNextStep = undefined;
  } else {
    status = 'PARTIAL';
    coverageRatio = (readyCount + partialCount * 0.5) / Math.max(1, batch.results.length);
    primaryLimitations = [
      `${readyCount}/${batch.results.length} 個訊號類型已達 READY，其餘仍為 PARTIAL`,
    ];
    recommendedNextStep = '繼續累積樣本至各訊號類型 ≥30 筆以達完整 READY 狀態';
  }

  return {
    key: 'validation:walk_forward',
    title: 'Walk-Forward 時序驗證',
    area: 'validation',
    status,
    confidence: status === 'READY' ? 80 : status === 'PARTIAL' ? 65 : status === 'DEGRADED' ? 50 : 40,
    coverageRatio,
    sampleSize: avgSample,
    primaryLimitations,
    recommendedNextStep,
  };
}

// ─── Regime Stratification Coverage ──────────────────────────────────────────

function buildRegimeItem(
  batch: SignalEffectivenessBatchApiResponse,
  regimeSnapshotCount: number,
): ResearchCoverageItem {
  if (regimeSnapshotCount === 0) {
    return {
      key: 'regime:stratification',
      title: 'Regime Stratification（市場環境分層）',
      area: 'regime',
      status: 'UNAVAILABLE',
      confidence: 95, // confident it's unavailable
      coverageRatio: 0,
      sampleSize: 0,
      primaryLimitations: [
        'DailyMarketSnapshot 無資料，所有觀察均落入 Unknown regime',
        '無法進行跨市場環境的訊號效果分析',
      ],
      recommendedNextStep: '確認 daily regime snapshot 同步機制是否正常；優先確保 DailyMarketSnapshot 有資料',
    };
  }

  // Count how many signal types have assessable regime breakdown (≥2 regimes with ≥5 samples)
  const assessableSignals = batch.results.filter((r) => {
    const bd = r.effectiveness.regimeBreakdown;
    const assessable = [bd.bull, bd.bear, bd.neutral].filter(
      (m) => m != null && m.sampleSize >= MIN_REGIME_PER_BUCKET,
    ).length;
    return assessable >= 2;
  }).length;

  const coverageRatio = batch.results.length > 0 ? assessableSignals / batch.results.length : 0;

  let status: ResearchCoverageStatus;
  let primaryLimitations: string[];
  let confidence: number;
  let recommendedNextStep: string | undefined;

  if (regimeSnapshotCount < MIN_REGIME_SNAPSHOT_PARTIAL) {
    status = 'INSUFFICIENT_DATA';
    confidence = 70;
    primaryLimitations = [
      `DailyMarketSnapshot 僅 ${regimeSnapshotCount} 筆，建議至少 ${MIN_REGIME_SNAPSHOT_PARTIAL} 筆才可支撐 regime 分層`,
    ];
    recommendedNextStep = `同步更多 DailyMarketSnapshot 歷史資料（目前 ${regimeSnapshotCount} 筆，建議 ≥${MIN_REGIME_SNAPSHOT_PARTIAL}）`;
  } else if (assessableSignals === 0) {
    status = 'DEGRADED';
    confidence = 60;
    primaryLimitations = [
      'DailyMarketSnapshot 有資料，但各訊號類型的 regime breakdown 均不足 2 個有效 regime',
      `每個 regime 需至少 ${MIN_REGIME_PER_BUCKET} 筆觀察才可納入分析`,
    ];
    recommendedNextStep = '繼續累積各 regime 的訊號觀察記錄';
  } else if (regimeSnapshotCount >= MIN_REGIME_SNAPSHOT_READY && assessableSignals >= Math.ceil(batch.results.length * 0.7)) {
    status = 'READY';
    confidence = 80;
    primaryLimitations = [];
    recommendedNextStep = undefined;
  } else {
    status = 'PARTIAL';
    confidence = 60 + Math.round(coverageRatio * 15);
    primaryLimitations = [
      `${assessableSignals}/${batch.results.length} 個訊號類型有足夠 regime breakdown`,
      regimeSnapshotCount < MIN_REGIME_SNAPSHOT_READY
        ? `DailyMarketSnapshot ${regimeSnapshotCount} 筆（建議 ≥${MIN_REGIME_SNAPSHOT_READY} 以達 READY）`
        : '部分訊號類型的 regime 樣本不足',
    ];
    recommendedNextStep = assessableSignals < Math.ceil(batch.results.length * 0.7)
      ? '確保更多訊號觀察覆蓋已知的市場環境'
      : '繼續累積 DailyMarketSnapshot 歷史資料';
  }

  return {
    key: 'regime:stratification',
    title: 'Regime Stratification（市場環境分層）',
    area: 'regime',
    status,
    confidence,
    coverageRatio,
    sampleSize: regimeSnapshotCount,
    primaryLimitations,
    recommendedNextStep,
  };
}

// ─── Confidence Calibration Coverage ─────────────────────────────────────────

function buildConfidenceItem(batch: SignalEffectivenessBatchApiResponse): ResearchCoverageItem {
  const withBrier = batch.results.filter((r) => r.effectiveness.brierLikeScore !== undefined).length;
  const brierCoverage = batch.results.length > 0 ? withBrier / batch.results.length : 0;

  // CALIBRATED is structurally unreachable; PARTIAL is the best achievable state
  let status: ResearchCoverageStatus;
  let confidence: number;
  let primaryLimitations: string[];
  let recommendedNextStep: string | undefined;

  const heuristicNote = '系統中 COVERAGE_PROXY / SCORE_DERIVED / RULE_PENALTY 型信心值均為啟發式指標，不可達 CALIBRATED 狀態';

  if (withBrier === 0) {
    status = 'INSUFFICIENT_DATA';
    confidence = 30;
    primaryLimitations = [
      '目前無訊號類型具備 brierLikeScore（需 sampleSize ≥10）',
      heuristicNote,
      '信心值均處於啟發式狀態，無法提供統計校準支持',
    ];
    recommendedNextStep = '累積訊號樣本至 ≥10 筆以解鎖 BRIER_ADJACENT 指標，這是系統中最接近校準的量化指標';
  } else {
    status = 'PARTIAL';
    confidence = 50 + Math.round(brierCoverage * 20);
    primaryLimitations = [
      heuristicNote,
      `${withBrier}/${batch.results.length} 個訊號類型具備 brierLikeScore（BRIER_ADJACENT，最接近校準）`,
      '達到真正 CALIBRATED 狀態需 ≥30 筆 prediction-outcome pairs，目前不可達',
    ];
    recommendedNextStep = '建立 prediction-outcome pairs 追蹤機制；考慮記錄每次訊號發出後的實際結果';
  }

  return {
    key: 'confidence:calibration',
    title: '信心值校準狀態',
    area: 'confidence',
    status,
    confidence,
    coverageRatio: brierCoverage,
    sampleSize: withBrier,
    primaryLimitations,
    recommendedNextStep,
  };
}

// ─── Event Source Quality Coverage ───────────────────────────────────────────

function buildEventItem(eventSourceQuality: EventSourceQuality | null): ResearchCoverageItem {
  if (!eventSourceQuality) {
    return {
      key: 'event:source_quality',
      title: '事件來源品質',
      area: 'event',
      status: 'INSUFFICIENT_DATA',
      confidence: 30,
      coverageRatio: 0,
      sampleSize: 0,
      primaryLimitations: [
        '事件資料暫時不可用，無法評估事件來源品質',
        'NewsEvent DB schema 未保存 sourceType 欄位，DB 路徑無法區分 RSS / mock 來源',
      ],
      recommendedNextStep: '確認 RSS 事件同步是否正常；考慮在 NewsEvent schema 增加 sourceType 欄位',
    };
  }

  const esqLabel = eventSourceQuality.qualityLabel;
  const { totalEvents, rssCount, mockCount, rssRatio, mockRatio, limitations } = eventSourceQuality;

  const dbPathNote = 'NewsEvent DB schema 未保存 sourceType 欄位，DB 路徑取回的事件 sourceType 一律標記為 rss（保守估算）';

  switch (esqLabel) {
    case 'LIVE_CONFIDENT':
      return {
        key: 'event:source_quality',
        title: '事件來源品質',
        area: 'event',
        status: 'READY',
        confidence: 80,
        coverageRatio: rssRatio,
        sampleSize: totalEvents,
        primaryLimitations: [dbPathNote, ...limitations.slice(0, 1)],
        recommendedNextStep: '維持 RSS 事件採集品質；考慮增加 official / mainstream 來源比例',
      };
    case 'MIXED_SOURCE':
      return {
        key: 'event:source_quality',
        title: '事件來源品質',
        area: 'event',
        status: 'PARTIAL',
        confidence: 55,
        coverageRatio: rssRatio,
        sampleSize: totalEvents,
        primaryLimitations: [
          `事件來源混合：RSS ${rssCount} 則 / mock ${mockCount} 則（mock 佔 ${(mockRatio * 100).toFixed(0)}%）`,
          dbPathNote,
          ...limitations.slice(0, 1),
        ],
        recommendedNextStep: '增加 RSS 真實事件來源，減少 MockEventSource 依賴',
      };
    case 'SIMULATION_DOMINATED':
      return {
        key: 'event:source_quality',
        title: '事件來源品質',
        area: 'event',
        status: 'SIMULATION_DOMINATED',
        confidence: 40,
        coverageRatio: rssRatio,
        sampleSize: totalEvents,
        primaryLimitations: [
          `事件以模擬來源為主（mock ${(mockRatio * 100).toFixed(0)}%），研究結論大幅降低可信度`,
          dbPathNote,
          ...limitations.slice(0, 1),
        ],
        recommendedNextStep: '優先接通 RSS 真實事件來源；減少或隔離 MockEventSource',
      };
    default: // INSUFFICIENT_EVENT_DATA
      return {
        key: 'event:source_quality',
        title: '事件來源品質',
        area: 'event',
        status: 'INSUFFICIENT_DATA',
        confidence: 40,
        coverageRatio: 0,
        sampleSize: totalEvents,
        primaryLimitations: [
          '事件資料不足，無法形成可信的事件研究結論',
          dbPathNote,
          ...limitations.slice(0, 1),
        ],
        recommendedNextStep: '確認 RSS 事件同步是否正常；增加事件採集頻率',
      };
  }
}

// ─── Relevance Quality Overlay Coverage ──────────────────────────────────────

function buildRelevanceItem(batch: SignalEffectivenessBatchApiResponse): ResearchCoverageItem {
  // The overlay is always PARTIAL because:
  // 1. Signal overlays use stabilityScore/regimeBreakdown as proxies (not actual WalkForward/RegimeStratified calls)
  // 2. Event overlays are informational-only (Wave 5 guardrail already applied)
  // 3. Generic overlays (topic/portfolio/risk) use coverage+trust heuristics
  // READY would require pre-computed WalkForward/RegimeStratified results in hot path

  const signalCount = batch.results.length;
  const coveredCount = batch.results.filter((r) => r.sampleSize > 0).length;

  return {
    key: 'relevance:quality_overlay',
    title: 'Relevance Quality Overlay',
    area: 'relevance',
    status: 'PARTIAL',
    confidence: 60 + Math.round((coveredCount / Math.max(1, signalCount)) * 15),
    coverageRatio: signalCount > 0 ? coveredCount / signalCount : 0,
    sampleSize: signalCount,
    primaryLimitations: [
      'Signal overlay 使用 stabilityScore / regimeBreakdown proxy，未直接呼叫 WalkForwardValidator 或 RegimeStratifiedEngine',
      'Event overlay 為純顯示層（scoreAdjustment=0），Wave 5 guardrail 已處理實質懲罰',
      'Topic / Portfolio / Risk overlay 使用 coverage+trust 啟發式指標',
    ],
    recommendedNextStep: '考慮預計算並快取 WalkForward / RegimeStratified 結果，以接入 Relevance hot path 直接呼叫',
  };
}

// ─── Gaps Ranking ─────────────────────────────────────────────────────────────

function buildTopGaps(
  items: ResearchCoverageItem[],
  taiexAvailable: boolean,
  regimeSnapshotCount: number,
  eventSourceQuality: EventSourceQuality | null,
): ResearchGapItem[] {
  const gaps: ResearchGapItem[] = [];

  // Gap 1: No TAIEX data (blocks everything signal-related)
  if (!taiexAvailable) {
    gaps.push({
      key: 'gap:taiex_unavailable',
      reason: 'TAIEX 基準資料不可用，所有訊號有效性計算（forward return、超額報酬、brierLikeScore）均無法執行',
      priority: 'HIGH',
      affectedAreas: ['signal', 'validation', 'regime', 'confidence'],
      recommendedNextStep: '優先同步 MarketIndex TAIEX 資料（至少 10 筆以上）',
    });
  }

  // Gap 2: No DailyMarketSnapshot (blocks regime stratification entirely)
  if (regimeSnapshotCount === 0) {
    gaps.push({
      key: 'gap:no_regime_history',
      reason: 'DailyMarketSnapshot 無資料，所有觀察均落入 Unknown regime，無法進行市場環境分層分析',
      priority: 'HIGH',
      affectedAreas: ['regime', 'validation'],
      recommendedNextStep: '確認 daily regime snapshot 同步機制；補齊 DailyMarketSnapshot 歷史資料',
    });
  }

  // Gap 3: Signals with insufficient samples (blocks walk-forward, brierLikeScore, confidence)
  const insufficientSignals = items.filter(
    (item) => item.area === 'signal' && (item.status === 'INSUFFICIENT_DATA' || item.status === 'UNAVAILABLE'),
  );
  if (insufficientSignals.length > 0) {
    gaps.push({
      key: 'gap:signal_insufficient_sample',
      reason: `${insufficientSignals.length} 個訊號類型樣本不足（< ${MIN_SAMPLE_DEGRADED} 筆），無法計算有效性指標、walk-forward 及 brierLikeScore`,
      priority: insufficientSignals.length >= 3 ? 'HIGH' : 'MEDIUM',
      affectedAreas: ['signal', 'validation', 'confidence'],
      recommendedNextStep: `累積更多訊號觀察記錄；目標各訊號類型 ≥${MIN_SAMPLE_STRONG} 筆`,
    });
  }

  // Gap 4: Event simulation-dominated (highest event gap)
  const esqLabel = eventSourceQuality?.qualityLabel;
  if (esqLabel === 'SIMULATION_DOMINATED') {
    gaps.push({
      key: 'gap:simulation_dominated',
      reason: `事件資料以模擬來源為主（mock ${((eventSourceQuality?.mockRatio ?? 1) * 100).toFixed(0)}%），事件研究結論大幅失去可信度`,
      priority: 'HIGH',
      affectedAreas: ['event', 'relevance'],
      recommendedNextStep: '接通更多 RSS 真實事件來源（yahoo、bloomberg 等）；將 MockEventSource 標記為僅限開發環境',
    });
  } else if (!esqLabel || esqLabel === 'INSUFFICIENT_EVENT_DATA') {
    gaps.push({
      key: 'gap:event_insufficient',
      reason: '事件資料不足，近期無可用 RSS 事件，事件研究無法提供可信分析',
      priority: 'MEDIUM',
      affectedAreas: ['event', 'relevance'],
      recommendedNextStep: '確認 RSS 事件同步是否正常；增加採集頻率或補充事件來源',
    });
  }

  // Gap 5: NewsEvent schema missing sourceType (structural, always present)
  gaps.push({
    key: 'gap:event_sourcetype_not_in_db',
    reason: 'NewsEvent DB schema 未保存 sourceType 欄位，DB 路徑取回的事件無法區分 RSS 真實來源與 mock 模擬來源',
    priority: 'MEDIUM',
    affectedAreas: ['event'],
    recommendedNextStep: '在 NewsEvent schema 新增 sourceType 欄位並執行 migration；回填歷史記錄（mock 可識別來源）',
  });

  // Gap 6: Confidence calibration (structural; medium priority — requires long-term accumulation)
  gaps.push({
    key: 'gap:confidence_uncalibrated',
    reason: '所有信心值均為啟發式指標（COVERAGE_PROXY / SCORE_DERIVED / RULE_PENALTY / BRIER_ADJACENT），缺乏真正的機率校準基礎（需 ≥30 筆 prediction-outcome pairs）',
    priority: 'MEDIUM',
    affectedAreas: ['confidence'],
    recommendedNextStep: '建立 prediction-outcome pairs 追蹤機制：記錄每次訊號發出後 N 天的實際結果（正/負報酬），長期累積至 ≥30 筆',
  });

  // Gap 7: Relevance overlay uses proxies (low priority — optimization)
  gaps.push({
    key: 'gap:relevance_proxy_only',
    reason: 'Relevance Quality Overlay 的訊號部分使用 stabilityScore 作為 walk-forward proxy，未直接整合 WalkForwardValidator 或 RegimeStratifiedEngine 的完整輸出',
    priority: 'LOW',
    affectedAreas: ['relevance'],
    recommendedNextStep: '評估是否將 WalkForward / RegimeStratified 結果預計算後快取（如每日排程），再由 Relevance hot path 讀取快取結果',
  });

  // Sort: HIGH → MEDIUM → LOW, then alphabetical by key
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return gaps.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.key.localeCompare(b.key);
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function buildSummary(items: ResearchCoverageItem[]): ResearchGapsSummary {
  const counts = {
    readyCount: items.filter((item) => item.status === 'READY').length,
    partialCount: items.filter((item) => item.status === 'PARTIAL').length,
    degradedCount: items.filter((item) => item.status === 'DEGRADED').length,
    insufficientCount: items.filter((item) => item.status === 'INSUFFICIENT_DATA').length,
    simulationDominatedCount: items.filter((item) => item.status === 'SIMULATION_DOMINATED').length,
    unavailableCount: items.filter((item) => item.status === 'UNAVAILABLE').length,
  };

  const totalWeight = items.reduce((sum, item) => sum + STATUS_READINESS_WEIGHT[item.status], 0);
  const overallReadiness = items.length > 0 ? Math.round((totalWeight / items.length) * 100) : 0;

  return {
    ...counts,
    totalModules: items.length,
    overallReadiness,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a unified Research Gaps Report from pre-fetched data.
 *
 * Pure function (no DB, no async). The API route is responsible for
 * fetching the input data and passing it here.
 */
export function buildResearchGapsReport(input: ResearchCoverageInputData): ResearchGapsReport {
  const taiexAvailable = input.taiexRowCount >= MIN_TAIEX_ROWS;

  const signalItems = buildSignalItems(input.signalBatch, taiexAvailable);
  const walkForwardItem = buildWalkForwardItem(input.signalBatch);
  const regimeItem = buildRegimeItem(input.signalBatch, input.regimeSnapshotCount);
  const confidenceItem = buildConfidenceItem(input.signalBatch);
  const eventItem = buildEventItem(input.eventSourceQuality);
  const relevanceItem = buildRelevanceItem(input.signalBatch);

  const items: ResearchCoverageItem[] = [
    ...signalItems,
    walkForwardItem,
    regimeItem,
    confidenceItem,
    eventItem,
    relevanceItem,
  ];

  const summary = buildSummary(items);
  const topGaps = buildTopGaps(
    items,
    taiexAvailable,
    input.regimeSnapshotCount,
    input.eventSourceQuality,
  );

  const topLimitations: string[] = [];
  if (!taiexAvailable) topLimitations.push('TAIEX 資料不足，訊號有效性計算全面受限');
  if (input.regimeSnapshotCount === 0) topLimitations.push('DailyMarketSnapshot 無資料，regime stratification 不可用');
  if (input.eventSourceQuality?.qualityLabel === 'SIMULATION_DOMINATED') {
    topLimitations.push('事件研究以模擬來源為主，可信度大幅降低');
  }

  return {
    items,
    summary,
    topGaps,
    generatedAt: new Date().toISOString(),
    limitations: topLimitations,
  };
}

// ─── Badge helpers for UI ─────────────────────────────────────────────────────

export function getCoverageStatusLabel(status: ResearchCoverageStatus): string {
  const labels: Record<ResearchCoverageStatus, string> = {
    READY: '可用',
    PARTIAL: '部分可用',
    DEGRADED: '效能降級',
    INSUFFICIENT_DATA: '資料不足',
    SIMULATION_DOMINATED: '模擬主導',
    UNAVAILABLE: '不可用',
  };
  return labels[status];
}

export function getCoverageStatusColor(status: ResearchCoverageStatus): string {
  const colors: Record<ResearchCoverageStatus, string> = {
    READY: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
    PARTIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    DEGRADED: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
    INSUFFICIENT_DATA: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    SIMULATION_DOMINATED: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    UNAVAILABLE: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  };
  return colors[status];
}

export function getPriorityColor(priority: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  if (priority === 'HIGH') return 'text-red-600 dark:text-red-400';
  if (priority === 'MEDIUM') return 'text-amber-600 dark:text-amber-300';
  return 'text-slate-500 dark:text-slate-400';
}
