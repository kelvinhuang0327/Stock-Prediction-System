/**
 * Relevance Quality Overlay — Research Layer (L3+)
 *
 * Integrates research signals from the 5 wave engines into a unified quality
 * overlay for the Relevance Layer. This is a PURE, RESEARCH-ONLY layer:
 *
 *   - SignalDisagreementEngine  → disagreement proxy via classification + stabilityScore
 *   - WalkForwardValidator      → walkForward proxy via stabilityScore (0–1)
 *   - RegimeStratifiedEngine    → regimeStability proxy via regimeBreakdown
 *   - ConfidenceReadinessEngine → confidenceReadiness proxy via sampleSize
 *   - EventSourceQualityEngine  → eventSourceQuality via sourceQuality label (Wave 5)
 *
 * Hard limits:
 *   - MUST NOT modify alphaScore, recommendationBucket, or StrategyScreenEngine
 *   - MUST NOT fabricate quality data; N/A is always a valid label
 *   - Score/confidence adjustments are capped to avoid extreme distortion
 *   - Event insights use zero adjustments (Wave 5 guardrail already applied)
 */

import type { Metric } from '@/lib/signals/types';
import type { SignalClassification } from '@/lib/signals/types';
import type { EventSourceQuality } from '@/lib/events/EventSourceQualityEngine';
import type {
  InsightCoverage,
  InsightQualityOverlay,
  InsightQualityOverlaySections,
  InsightTrust,
  OverlayQualityLabel,
  RelevantInsight,
} from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STABLE_THRESHOLD = 0.7;
const UNSTABLE_THRESHOLD = 0.4;
const CALIBRATED_SAMPLE = 30;
const PARTIAL_SAMPLE = 10;

// ─── Score/confidence deltas per label ───────────────────────────────────────

const SIGNAL_ADJUSTMENTS: Record<OverlayQualityLabel, { score: number; confidence: number }> = {
  RESEARCH_CONFIDENT: { score: +3, confidence: +5 },
  RESEARCH_CAUTION:   { score: -5, confidence: -8 },
  RESEARCH_WEAK:      { score: -12, confidence: -15 },
  RESEARCH_INSUFFICIENT: { score: -20, confidence: -20 },
};

const GENERIC_ADJUSTMENTS: Record<OverlayQualityLabel, { score: number; confidence: number }> = {
  RESEARCH_CONFIDENT: { score: 0, confidence: +2 },
  RESEARCH_CAUTION:   { score: -3, confidence: -5 },
  RESEARCH_WEAK:      { score: -8, confidence: -10 },
  RESEARCH_INSUFFICIENT: { score: -12, confidence: -12 },
};

// Zero adjustment for event insights (Wave 5 guardrail already applied via trust→scoring)
const EVENT_ADJUSTMENTS: Record<OverlayQualityLabel, { score: number; confidence: number }> = {
  RESEARCH_CONFIDENT: { score: 0, confidence: 0 },
  RESEARCH_CAUTION:   { score: 0, confidence: 0 },
  RESEARCH_WEAK:      { score: 0, confidence: 0 },
  RESEARCH_INSUFFICIENT: { score: 0, confidence: 0 },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type WalkForwardLabel = InsightQualityOverlaySections['walkForward'];
type RegimeStabilityLabel = InsightQualityOverlaySections['regimeStability'];
type ConfidenceReadinessLabel = InsightQualityOverlaySections['confidenceReadiness'];
type DisagreementLabel = InsightQualityOverlaySections['disagreement'];

function walkForwardFromStability(stabilityScore: number, sampleSize: number): WalkForwardLabel {
  if (sampleSize === 0) return 'N/A';
  if (stabilityScore >= STABLE_THRESHOLD) return 'STABLE';
  if (stabilityScore >= UNSTABLE_THRESHOLD) return 'MIXED';
  return 'UNSTABLE';
}

function regimeStabilityFromBreakdown(
  regimeBreakdown: { bull?: Metric; bear?: Metric; neutral?: Metric },
): RegimeStabilityLabel {
  const available = [regimeBreakdown.bull, regimeBreakdown.bear, regimeBreakdown.neutral].filter(
    (metric): metric is Metric => metric != null && metric.sampleSize > 0,
  );
  if (available.length === 0) return 'N/A';
  const positiveCount = available.filter((metric) => metric.avgReturn > 0).length;
  if (positiveCount === available.length) return 'REGIME_STABLE';
  if (positiveCount > 0) return 'REGIME_CONDITIONAL';
  return 'REGIME_FRAGILE';
}

function confidenceReadinessFromSample(sampleSize: number): ConfidenceReadinessLabel {
  if (sampleSize === 0) return 'UNCALIBRATED';
  if (sampleSize >= CALIBRATED_SAMPLE) return 'CALIBRATED';
  if (sampleSize >= PARTIAL_SAMPLE) return 'PARTIAL';
  return 'INSUFFICIENT_DATA';
}

function disagreementFromSignals(
  classification: SignalClassification,
  walkForward: WalkForwardLabel,
): DisagreementLabel {
  if (classification === 'NOISE' || walkForward === 'UNSTABLE') return 'HIGH';
  if (classification === 'STRONG_SIGNAL' && walkForward === 'STABLE') return 'LOW';
  return 'MODERATE';
}

/**
 * Derive an OverlayQualityLabel for signal insights using a point system.
 *
 * Points:
 *   +2 STABLE, +1 REGIME_STABLE, +1 CALIBRATED
 *   -1 MIXED, -2 UNSTABLE
 *   -1 REGIME_CONDITIONAL, -2 REGIME_FRAGILE
 *   -1 INSUFFICIENT_DATA, -2 UNCALIBRATED
 *   -2 HIGH disagreement (NOISE or UNSTABLE)
 *
 * Thresholds: >=2 CONFIDENT, >=0 CAUTION, >=-2 WEAK, <-2 INSUFFICIENT
 */
function deriveSignalQualityLabel(
  walkForward: WalkForwardLabel,
  regimeStability: RegimeStabilityLabel,
  confidenceReadiness: ConfidenceReadinessLabel,
  disagreement: DisagreementLabel,
): OverlayQualityLabel {
  let points = 0;

  if (walkForward === 'STABLE') points += 2;
  else if (walkForward === 'MIXED') points -= 1;
  else if (walkForward === 'UNSTABLE') points -= 2;

  if (regimeStability === 'REGIME_STABLE') points += 1;
  else if (regimeStability === 'REGIME_CONDITIONAL') points -= 1;
  else if (regimeStability === 'REGIME_FRAGILE') points -= 2;

  if (confidenceReadiness === 'CALIBRATED') points += 1;
  else if (confidenceReadiness === 'INSUFFICIENT_DATA') points -= 1;
  else if (confidenceReadiness === 'UNCALIBRATED') points -= 2;

  if (disagreement === 'HIGH') points -= 2;

  if (points >= 2) return 'RESEARCH_CONFIDENT';
  if (points >= 0) return 'RESEARCH_CAUTION';
  if (points >= -2) return 'RESEARCH_WEAK';
  return 'RESEARCH_INSUFFICIENT';
}

function buildSignalReasons(
  walkForward: WalkForwardLabel,
  regimeStability: RegimeStabilityLabel,
  confidenceReadiness: ConfidenceReadinessLabel,
  disagreement: DisagreementLabel,
  stabilityScore: number,
  sampleSize: number,
): string[] {
  const reasons: string[] = [];

  if (walkForward === 'STABLE') {
    reasons.push(`走勢穩定性：STABLE（跨期一致性 ${(stabilityScore * 100).toFixed(0)}%）`);
  } else if (walkForward === 'MIXED') {
    reasons.push(`走勢穩定性：MIXED（跨期一致性 ${(stabilityScore * 100).toFixed(0)}%，有分歧）`);
  } else if (walkForward === 'UNSTABLE') {
    reasons.push(`走勢穩定性：UNSTABLE（跨期一致性僅 ${(stabilityScore * 100).toFixed(0)}%）`);
  }

  if (regimeStability === 'REGIME_STABLE') {
    reasons.push('環境適應性：REGIME_STABLE（各市場環境均呈正超額回報）');
  } else if (regimeStability === 'REGIME_CONDITIONAL') {
    reasons.push('環境適應性：REGIME_CONDITIONAL（不同市場環境下表現有異，需條件解讀）');
  } else if (regimeStability === 'REGIME_FRAGILE') {
    reasons.push('環境適應性：REGIME_FRAGILE（缺乏有效環境資料，或各環境回報均為負）');
  }

  if (confidenceReadiness === 'CALIBRATED') {
    reasons.push(`樣本充足性：CALIBRATED（n=${sampleSize}，可信度較高）`);
  } else if (confidenceReadiness === 'PARTIAL') {
    reasons.push(`樣本充足性：PARTIAL（n=${sampleSize}，部分可信）`);
  } else if (confidenceReadiness === 'INSUFFICIENT_DATA') {
    reasons.push(`樣本充足性：INSUFFICIENT_DATA（n=${sampleSize}，樣本偏低）`);
  } else if (confidenceReadiness === 'UNCALIBRATED') {
    reasons.push('樣本充足性：UNCALIBRATED（無歷史樣本，不具研究可信度）');
  }

  if (disagreement === 'HIGH') {
    reasons.push('訊號一致性：HIGH 發散（NOISE 類型或穩定性不足，需高度謹慎）');
  } else if (disagreement === 'LOW') {
    reasons.push('訊號一致性：LOW 發散（分類穩定一致）');
  }

  return reasons;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SignalOverlayInput {
  stabilityScore: number;
  sampleSize: number;
  regimeBreakdown: { bull?: Metric; bear?: Metric; neutral?: Metric };
  classification: SignalClassification;
}

/**
 * Compute a quality overlay for a **signal** insight.
 *
 * Uses SignalEffectiveness fields as proxies for the expensive wave engines:
 *   - stabilityScore → WalkForwardValidator (STABLE/MIXED/UNSTABLE)
 *   - regimeBreakdown → RegimeStratifiedEngine (REGIME_STABLE/CONDITIONAL/FRAGILE)
 *   - sampleSize      → ConfidenceReadinessEngine (CALIBRATED/PARTIAL/…)
 *   - classification  → SignalDisagreementEngine proxy
 */
export function computeSignalQualityOverlay(input: SignalOverlayInput): InsightQualityOverlay {
  const walkForward = walkForwardFromStability(input.stabilityScore, input.sampleSize);
  const regimeStability = regimeStabilityFromBreakdown(input.regimeBreakdown);
  const confidenceReadiness = confidenceReadinessFromSample(input.sampleSize);
  const disagreement = disagreementFromSignals(input.classification, walkForward);
  const qualityLabel = deriveSignalQualityLabel(walkForward, regimeStability, confidenceReadiness, disagreement);
  const adjustments = SIGNAL_ADJUSTMENTS[qualityLabel];
  const reasons = buildSignalReasons(
    walkForward,
    regimeStability,
    confidenceReadiness,
    disagreement,
    input.stabilityScore,
    input.sampleSize,
  );

  return {
    qualityLabel,
    scoreAdjustment: adjustments.score,
    confidenceAdjustment: adjustments.confidence,
    reasons,
    sections: {
      disagreement,
      walkForward,
      regimeStability,
      confidenceReadiness,
      eventSourceQuality: 'N/A',
    },
  };
}

/**
 * Compute a quality overlay for an **event** insight.
 *
 * Informational only — score/confidence adjustments are zero because Wave 5's
 * `applySourceQualityGuardrail` already penalized the trust level before scoring.
 */
export function computeEventQualityOverlay(
  sourceQuality: EventSourceQuality | undefined,
): InsightQualityOverlay {
  const esqLabel = sourceQuality?.qualityLabel ?? 'INSUFFICIENT_EVENT_DATA';

  let qualityLabel: OverlayQualityLabel;
  let reasons: string[];

  switch (esqLabel) {
    case 'LIVE_CONFIDENT':
      qualityLabel = 'RESEARCH_CONFIDENT';
      reasons = ['事件來源品質：LIVE_CONFIDENT（RSS 即時事件，可信度高）'];
      break;
    case 'MIXED_SOURCE':
      qualityLabel = 'RESEARCH_CAUTION';
      reasons = [
        `事件來源品質：MIXED_SOURCE（含模擬事件 ${sourceQuality?.mockCount ?? 0} 則，建議保守解讀）`,
      ];
      break;
    case 'SIMULATION_DOMINATED':
      qualityLabel = 'RESEARCH_WEAK';
      reasons = [
        `事件來源品質：SIMULATION_DOMINATED（模擬事件佔 ${((sourceQuality?.mockRatio ?? 1) * 100).toFixed(0)}%，事件研究不可靠）`,
      ];
      break;
    default:
      qualityLabel = 'RESEARCH_INSUFFICIENT';
      reasons = ['事件來源品質：INSUFFICIENT_EVENT_DATA（事件樣本不足，無法形成可信研究結論）'];
  }

  const adjustments = EVENT_ADJUSTMENTS[qualityLabel];
  return {
    qualityLabel,
    scoreAdjustment: adjustments.score,
    confidenceAdjustment: adjustments.confidence,
    reasons,
    sections: {
      disagreement: 'N/A',
      walkForward: 'N/A',
      regimeStability: 'N/A',
      confidenceReadiness: 'N/A',
      eventSourceQuality: esqLabel,
    },
  };
}

/**
 * Compute a quality overlay for **generic** insights (topic, portfolio, risk).
 *
 * Uses coverage and trust as proxies, with mild adjustments.
 */
export function computeGenericQualityOverlay(params: {
  coverage: InsightCoverage;
  trust: InsightTrust;
  limitationsCount: number;
}): InsightQualityOverlay {
  const { coverage, trust, limitationsCount } = params;

  let qualityLabel: OverlayQualityLabel;
  const reasons: string[] = [];

  if (coverage === 'full' && trust === 'high') {
    qualityLabel = 'RESEARCH_CONFIDENT';
    reasons.push('資料覆蓋與可信度完整（full coverage + high trust）');
  } else if (coverage === 'insufficient' || trust === 'low') {
    qualityLabel = 'RESEARCH_WEAK';
    reasons.push('資料覆蓋不足或可信度偏低，研究優先級需保守下修');
  } else {
    qualityLabel = 'RESEARCH_CAUTION';
    reasons.push('資料覆蓋或可信度有限，建議保守解讀');
  }

  // Bump down one level if limitations are excessive
  if (limitationsCount >= 4) {
    if (qualityLabel === 'RESEARCH_CONFIDENT') qualityLabel = 'RESEARCH_CAUTION';
    else if (qualityLabel === 'RESEARCH_CAUTION') qualityLabel = 'RESEARCH_WEAK';
    else if (qualityLabel === 'RESEARCH_WEAK') qualityLabel = 'RESEARCH_INSUFFICIENT';
    reasons.push(`limitations 數量偏多（${limitationsCount} 則），研究可信度進一步下修`);
  }

  const adjustments = GENERIC_ADJUSTMENTS[qualityLabel];
  return {
    qualityLabel,
    scoreAdjustment: adjustments.score,
    confidenceAdjustment: adjustments.confidence,
    reasons,
    sections: {
      disagreement: 'N/A',
      walkForward: 'N/A',
      regimeStability: 'N/A',
      confidenceReadiness: 'N/A',
      eventSourceQuality: 'N/A',
    },
  };
}

/**
 * Apply a quality overlay to an insight.
 *
 * Clamps relevanceScore to [0, 100] and confidence to [10, 100].
 * Attaches the overlay for transparent display in the UI.
 */
export function applyQualityOverlay(
  insight: RelevantInsight,
  overlay: InsightQualityOverlay,
): RelevantInsight {
  return {
    ...insight,
    relevanceScore: clamp(round1(insight.relevanceScore + overlay.scoreAdjustment), 0, 100),
    confidence: clamp(round1(insight.confidence + overlay.confidenceAdjustment), 10, 100),
    qualityOverlay: overlay,
  };
}
