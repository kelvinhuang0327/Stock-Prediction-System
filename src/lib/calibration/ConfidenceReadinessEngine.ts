/**
 * ConfidenceReadinessEngine
 *
 * Research-only overlay (L3+). Answers:
 *   "Is this confidence number a calibrated probability, or a heuristic proxy?"
 *
 * PURPOSE
 * -------
 * The system produces several "confidence" values (0–100 or 0–1):
 *   - SignalFusionEngine:     data-coverage point-accumulation  → COVERAGE_PROXY
 *   - MultiAgentResearch:     score × coverageMultiplier        → SCORE_DERIVED
 *   - RelevanceScoringEngine: base-20 + penalty/bonus rules     → RULE_PENALTY
 *   - SignalEffectivenessEngine brierLikeScore: MSE-based       → BRIER_ADJACENT
 *
 * None of these are calibrated probabilities derived from prediction-outcome pairs.
 * This engine makes that distinction explicit in the research layer.
 *
 * CALIBRATION STATUS RULES
 * ------------------------
 * UNCALIBRATED:
 *   - confidenceType is COVERAGE_PROXY, SCORE_DERIVED, or RULE_PENALTY
 *   - These are heuristics by design; no amount of data changes their nature
 *
 * INSUFFICIENT_DATA:
 *   - confidenceType is BRIER_ADJACENT but sampleSize < MIN_BRIER_SAMPLE
 *   - OR predictionOutcomePairs = 0 for any type flagged as calibration candidate
 *
 * PARTIAL:
 *   - confidenceType is BRIER_ADJACENT AND sampleSize >= MIN_BRIER_SAMPLE
 *     AND brierLikeScore is defined
 *   - brierLikeScore (MSE-based) is the closest calibration-adjacent metric
 *     available in the current system; it is still NOT a calibrated probability
 *
 * CALIBRATED:
 *   - Would require ≥ MIN_CALIBRATION_PAIRS prediction-outcome pairs,
 *     time-split validation, and proper calibration curve fitting.
 *   - Not achievable with current data state.
 *
 * HARD CONSTRAINTS
 * ----------------
 * - Never modifies alphaScore, recommendationBucket, or any L1 output.
 * - Pure function — no DB access, no async, no side effects.
 * - Never pretends heuristic confidence is calibrated probability.
 * - Does NOT override any existing confidence value.
 *
 * Layer: L3+ Research Overlay
 */

// ─── Types ───────────────────────────────────────────────────────

/**
 * How the confidence value is computed in the source module.
 *
 * COVERAGE_PROXY:   Data coverage points (SignalFusionEngine).
 *                   Reflects data completeness, NOT prediction accuracy.
 * SCORE_DERIVED:    Derived from score by proportion/multiplier
 *                   (MultiAgentResearch agents).
 * RULE_PENALTY:     Rule-based bonus/penalty accumulation
 *                   (RelevanceScoringEngine).
 * BRIER_ADJACENT:   MSE between hitRate prediction and binary outcomes.
 *                   The only calibration-adjacent metric in the system.
 */
export type ConfidenceType =
  | 'COVERAGE_PROXY'
  | 'SCORE_DERIVED'
  | 'RULE_PENALTY'
  | 'BRIER_ADJACENT';

/**
 * Research-layer calibration status.
 *
 * UNCALIBRATED:       Heuristic by design; cannot be calibrated.
 * INSUFFICIENT_DATA:  Could be calibrated but lacks prediction-outcome pairs.
 * PARTIAL:            BRIER_ADJACENT metric available with sufficient sample.
 *                     Nearest thing to calibration evidence; still NOT a
 *                     calibrated probability.
 * CALIBRATED:         Full calibration. Not achievable in current system.
 */
export type CalibrationStatus =
  | 'UNCALIBRATED'
  | 'INSUFFICIENT_DATA'
  | 'PARTIAL'
  | 'CALIBRATED';

export interface ConfidenceReadinessInput {
  /** Identifier for the source module */
  moduleId: string;
  /** How this confidence value is computed */
  confidenceType: ConfidenceType;
  /**
   * The raw confidence value from the module (0–100 or 0–1 depending on source).
   * Shown as-is; never modified.
   */
  rawConfidence: number;
  /**
   * Number of computable signal observations with forward returns.
   * Used for BRIER_ADJACENT calibration readiness check.
   */
  sampleSize?: number;
  /**
   * Brier-like MSE score from SignalEffectivenessEngine.
   * Only meaningful for BRIER_ADJACENT type. Lower = better.
   */
  brierLikeScore?: number;
  /**
   * Number of historical prediction-outcome pairs available for calibration.
   * 0 = no outcome data; required ≥ MIN_CALIBRATION_PAIRS for CALIBRATED status.
   */
  predictionOutcomePairs?: number;
  /** Any known limitations about this confidence value */
  limitations?: string[];
}

export interface ConfidenceReadinessResult {
  moduleId: string;
  confidenceType: ConfidenceType;
  /** Raw confidence from source module — never modified */
  rawConfidence: number;
  calibrationStatus: CalibrationStatus;
  /**
   * Brier-like MSE score (0–1; lower is better).
   * Only populated for BRIER_ADJACENT type with sufficient samples.
   */
  brierLikeScore?: number;
  /** Short label for UI badges */
  readinessLabel: string;
  /**
   * Human-readable explanation of what this confidence means
   * and why it has (or lacks) calibration support.
   */
  explanation: string;
  /**
   * What would be required to reach a higher calibration status.
   * Empty string when already CALIBRATED.
   */
  requirementNote: string;
  limitations: string[];
}

// ─── Constants ───────────────────────────────────────────────────

/** Minimum signal observations to compute a meaningful brierLikeScore. */
const MIN_BRIER_SAMPLE = 10;

/**
 * Minimum prediction-outcome pairs required to attempt calibration curve fitting.
 * Below this number, only readiness monitoring is meaningful.
 */
const MIN_CALIBRATION_PAIRS = 30;

// ─── Label helpers ───────────────────────────────────────────────

const CONFIDENCE_TYPE_LABELS: Record<ConfidenceType, string> = {
  COVERAGE_PROXY: '資料覆蓋代理',
  SCORE_DERIVED: '分數比例映射',
  RULE_PENALTY: '規則懲罰累積',
  BRIER_ADJACENT: 'Brier-like MSE',
};

const STATUS_LABELS: Record<CalibrationStatus, string> = {
  UNCALIBRATED: '未校準',
  INSUFFICIENT_DATA: '資料不足',
  PARTIAL: '部分指標',
  CALIBRATED: '已校準',
};

// ─── Explanations by confidence type ─────────────────────────────

function buildExplanation(
  input: ConfidenceReadinessInput,
  status: CalibrationStatus,
): string {
  switch (input.confidenceType) {
    case 'COVERAGE_PROXY':
      return (
        '此信心值反映資料完整度（歷史天數最高 40 分、籌碼 20 分、' +
        '基本面 20 分、市場環境 20 分），為資料覆蓋代理指標，' +
        '不代表預測準確率或歷史勝率。'
      );
    case 'SCORE_DERIVED':
      return (
        '此信心值由各研究 agent 的評分按比例映射（score/100 × 80 × coverageMultiplier），' +
        '反映評分強度與資料覆蓋的乘積，不是預測結果校準。'
      );
    case 'RULE_PENALTY':
      return (
        '此信心值以規則懲罰方式計算（基礎 20 分 + 可用因子加分 ± 資料品質懲罰），' +
        '反映洞察條件完整度，不是預測結果校準。'
      );
    case 'BRIER_ADJACENT':
      if (status === 'PARTIAL') {
        const brier = input.brierLikeScore;
        const quality =
          brier !== undefined
            ? brier < 0.15
              ? '（偏低 → 訊號行為相對穩定）'
              : brier < 0.25
                ? '（中等 → 訊號行為有波動）'
                : '（偏高 → 訊號行為不穩定）'
            : '';
        return (
          `brierLikeScore = ${brier?.toFixed(4) ?? 'N/A'} ${quality}。` +
          '此指標量化 hitRate 預測與實際二元結果（正報酬=1/負報酬=0）的均方誤差，' +
          '是系統中最接近校準驗證的指標，但仍非正式機率校準。'
        );
      }
      return (
        'brierLikeScore 是系統中最接近校準驗證的指標（MSE between hitRate and binary outcomes），' +
        '但目前樣本不足，無法提供可靠的校準參考。'
      );
  }
}

function buildRequirementNote(
  input: ConfidenceReadinessInput,
  status: CalibrationStatus,
): string {
  if (status === 'CALIBRATED') return '';

  const pairs = input.predictionOutcomePairs ?? 0;
  const needed = MIN_CALIBRATION_PAIRS;

  if (
    input.confidenceType === 'COVERAGE_PROXY' ||
    input.confidenceType === 'SCORE_DERIVED' ||
    input.confidenceType === 'RULE_PENALTY'
  ) {
    return (
      `此類型 confidence 為啟發式規則，即使累積 ${needed} 筆以上的 prediction-outcome pairs，` +
      '也需要重新定義 outcome 後才可以執行研究校準。'
    );
  }

  // BRIER_ADJACENT
  if (status === 'PARTIAL') {
    return `已具備 brierLikeScore 參考。如需進一步做研究校準，需另外建立 ≥${needed} 筆的 prediction-outcome pairs。`;
  }

  const current = Math.max(pairs, input.sampleSize ?? 0);
  return (
    `目前可用樣本：${current} 筆；` +
    `研究校準最低需求：${needed} 筆 prediction-outcome pairs。`
  );
}

// ─── Core function ────────────────────────────────────────────────

/**
 * Assess calibration readiness for a single module's confidence value.
 *
 * Pure function — no DB access, no side effects.
 * Never modifies the rawConfidence or any L1 value.
 */
export function assessConfidenceReadiness(
  input: ConfidenceReadinessInput,
): ConfidenceReadinessResult {
  const limitations: string[] = [...(input.limitations ?? [])];
  const pairs = input.predictionOutcomePairs ?? 0;

  let calibrationStatus: CalibrationStatus;

  // ── Classification ────────────────────────────────────────────
  if (
    input.confidenceType === 'COVERAGE_PROXY' ||
    input.confidenceType === 'SCORE_DERIVED' ||
    input.confidenceType === 'RULE_PENALTY'
  ) {
    // Heuristic types: UNCALIBRATED regardless of sample size
    calibrationStatus = 'UNCALIBRATED';
    if (pairs === 0) {
      limitations.push(`目前 prediction-outcome pairs：0 筆（${CONFIDENCE_TYPE_LABELS[input.confidenceType]}型不支援直接校準）`);
    }
  } else {
    // BRIER_ADJACENT
    const sample = input.sampleSize ?? 0;

    if (sample >= MIN_BRIER_SAMPLE && input.brierLikeScore !== undefined) {
      calibrationStatus = 'PARTIAL';
    } else {
      calibrationStatus = 'INSUFFICIENT_DATA';
      if (sample < MIN_BRIER_SAMPLE) {
        limitations.push(
          `有效樣本 ${sample} 筆，低於 brierLikeScore 最低需求 ${MIN_BRIER_SAMPLE} 筆`,
        );
      }
      if (pairs === 0) {
        limitations.push('prediction-outcome pairs：0 筆，尚無校準基礎');
      }
    }
  }

  const explanation = buildExplanation(input, calibrationStatus);
  const requirementNote = buildRequirementNote(input, calibrationStatus);

  return {
    moduleId: input.moduleId,
    confidenceType: input.confidenceType,
    rawConfidence: input.rawConfidence,
    calibrationStatus,
    brierLikeScore:
      input.confidenceType === 'BRIER_ADJACENT' ? input.brierLikeScore : undefined,
    readinessLabel: STATUS_LABELS[calibrationStatus],
    explanation,
    requirementNote,
    limitations: [...new Set(limitations)],
  };
}

/**
 * Convenience: assess multiple modules at once.
 */
export function assessAllConfidenceReadiness(
  inputs: ConfidenceReadinessInput[],
): ConfidenceReadinessResult[] {
  return inputs.map(assessConfidenceReadiness);
}

// ─── Re-exports for UI convenience ───────────────────────────────

export { CONFIDENCE_TYPE_LABELS, STATUS_LABELS };
