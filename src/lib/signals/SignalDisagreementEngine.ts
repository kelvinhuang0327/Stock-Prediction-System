/**
 * SignalDisagreementEngine
 *
 * Research-only overlay (L3). Computes internal sub-score conflict within a fusion result.
 *
 * PURPOSE
 * -------
 * Answer: "Does this score have internal contradictions that reduce its reliability?"
 * Provide human-readable caution reasons for the research display layer.
 *
 * HARD CONSTRAINTS
 * ----------------
 * - Pure function — no DB access, no async, no side effects.
 * - MUST NOT modify alphaScore, recommendationBucket, or any L1 output.
 * - Output is research-only. Not a trading signal. Not a buy/sell recommendation.
 * - adjustedConfidenceLabel is a qualitative label for display. It does NOT override
 *   the core `confidence` value produced by SignalFusionEngine.
 *
 * FORMULA
 * -------
 * disagreementScore = stdDev(activeScores) / 50
 *   where 50 is a conservative upper-bound normalization factor for scores in [0,100].
 *   (Exact max stdDev for 3 values in [0,100] is ≈47.1, 50 gives slight conservatism.)
 *
 * Direction conflict: any active score > 65 AND any active score < 35
 *   → effectiveDisagreement = max(disagreementScore, 0.45) → pushed to HIGH
 *
 * Levels:
 *   LOW:      effectiveDisagreement < 0.20
 *   MODERATE: 0.20 ≤ effectiveDisagreement < 0.45
 *   HIGH:     effectiveDisagreement ≥ 0.45
 *
 * ETF HANDLING
 * ------------
 * isETF=true → fundamentalScore excluded from calculation (ETF_WEIGHTS.fundamental = 0).
 * Limitation is noted. Disagreement is computed from tech + chip only.
 *
 * Layer: L3 Research Overlay
 */

// ─── Types ───────────────────────────────────────────────────────

export type DisagreementLevel = 'LOW' | 'MODERATE' | 'HIGH';

/**
 * Qualitative research-layer confidence label.
 * Does NOT override the core `confidence` number from SignalFusionEngine.
 */
export type AdjustedConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';

export interface DisagreementInput {
  technicalScore: number;
  chipScore: number;
  fundamentalScore: number;
  /** true if the symbol is an ETF (fundamental score is excluded by design) */
  isETF: boolean;
  dataCoverage: 'full' | 'limited' | 'insufficient';
  missingSources: string[];
  /** Current market regime string ('Bull' | 'Bear' | 'Sideways' | 'Unknown' | '') */
  marketRegime: string;
  marketRegimeConfidence: number;
}

export interface DisagreementOverlay {
  /** Normalized standard deviation of active sub-scores. Range: 0.00–1.00. */
  disagreementScore: number;
  disagreementLevel: DisagreementLevel;
  /** Sub-scores included in the calculation, for display transparency. */
  activeScores: Array<{ name: string; value: number }>;
  /**
   * Qualitative research-layer confidence label.
   * Does NOT replace the core confidence value.
   */
  adjustedConfidenceLabel: AdjustedConfidenceLabel;
  /** Human-readable caution reasons for the research display layer. */
  cautionReasons: string[];
  limitations: string[];
  /** true when there are not enough inputs to produce a meaningful result. */
  isDegraded: boolean;
}

// ─── Constants ───────────────────────────────────────────────────

/** Conservative upper-bound for stdDev normalization with scores in [0, 100]. */
const NORMALIZATION_DIVISOR = 50;

const DIRECTION_CONFLICT_HIGH = 65;
const DIRECTION_CONFLICT_LOW = 35;

// ─── Internal helpers ────────────────────────────────────────────

function populationStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function hasDirectionConflict(scores: number[]): boolean {
  const hasBullish = scores.some((s) => s > DIRECTION_CONFLICT_HIGH);
  const hasBearish = scores.some((s) => s < DIRECTION_CONFLICT_LOW);
  return hasBullish && hasBearish;
}

// ─── Main export ─────────────────────────────────────────────────

export function computeDisagreementOverlay(
  input: DisagreementInput,
): DisagreementOverlay {
  const limitations: string[] = [];
  const cautionReasons: string[] = [];

  // ── 1. Determine active scores ──────────────────────────────────
  // Tech and chip are always included if available (non-negative values expected).
  // Fundamental is excluded for ETFs by design (ETF_WEIGHTS.fundamental = 0).
  const activeScores: Array<{ name: string; value: number }> = [
    { name: '技術面', value: input.technicalScore },
    { name: '籌碼面', value: input.chipScore },
  ];

  if (input.isETF) {
    limitations.push(
      'ETF 無基本面分項（設計行為），衝突分析僅包含技術面與籌碼面。',
    );
  } else {
    activeScores.push({ name: '基本面', value: input.fundamentalScore });
  }

  // ── 2. Degraded guard ───────────────────────────────────────────
  if (activeScores.length < 2) {
    return {
      disagreementScore: 0,
      disagreementLevel: 'LOW',
      activeScores,
      adjustedConfidenceLabel: 'VERY_LOW',
      cautionReasons: ['有效子分項不足，無法進行衝突分析。'],
      limitations: ['資料不足以執行衝突分析。'],
      isDegraded: true,
    };
  }

  // ── 3. Compute disagreement score ──────────────────────────────
  const scoreValues = activeScores.map((s) => s.value);
  const sd = populationStdDev(scoreValues);
  const rawDisagreement = Math.min(1.0, sd / NORMALIZATION_DIVISOR);
  const directionConflict = hasDirectionConflict(scoreValues);

  // Direction conflict hard-pushes to HIGH threshold
  const effectiveDisagreement = directionConflict
    ? Math.max(rawDisagreement, 0.45)
    : rawDisagreement;

  // ── 4. Disagreement level ───────────────────────────────────────
  let disagreementLevel: DisagreementLevel;
  if (effectiveDisagreement < 0.20) {
    disagreementLevel = 'LOW';
  } else if (effectiveDisagreement < 0.45) {
    disagreementLevel = 'MODERATE';
  } else {
    disagreementLevel = 'HIGH';
  }

  // ── 5. Condition downgrade rules ────────────────────────────────
  // Rule 1: internal score conflict
  if (disagreementLevel === 'HIGH') {
    cautionReasons.push(
      directionConflict
        ? '子分數出現方向衝突（部分面向強勢、部分面向弱勢），整體評分可信度應保守解讀。'
        : '子分數離散程度偏高，各面向評估結果差異明顯，建議保守解讀整體評分。',
    );
  } else if (disagreementLevel === 'MODERATE' && directionConflict) {
    cautionReasons.push(
      '部分子分數方向相反，一面強勢、另一面偏弱，整體評分均衡性有限。',
    );
  }

  // Rule 2: data coverage
  if (input.dataCoverage === 'limited') {
    cautionReasons.push(
      '資料覆蓋部分不完整，子分計算可能缺乏足夠歷史支撐。',
    );
  } else if (input.dataCoverage === 'insufficient') {
    cautionReasons.push(
      '資料嚴重不足，子分可信度有限，衝突分析結果僅供參考。',
    );
  }

  // Rule 3: missing sources
  if (input.missingSources.length > 0) {
    const shown = input.missingSources.slice(0, 2).join('、');
    const extra = input.missingSources.length > 2 ? ` 等 ${input.missingSources.length} 項` : '';
    cautionReasons.push(
      `部分資料來源缺失（${shown}${extra}），可能影響評分均衡性。`,
    );
  }

  // Rule 4: market regime
  const unknownRegime =
    !input.marketRegime || input.marketRegime === 'Unknown';
  if (unknownRegime) {
    cautionReasons.push(
      '市場環境無法判斷，市場分項影響力不確定。',
    );
  } else if (input.marketRegimeConfidence < 45) {
    cautionReasons.push(
      `市場環境信心度偏低（${input.marketRegimeConfidence}%），市場分項穩定性有限。`,
    );
  }

  // ── 6. Adjusted confidence label ───────────────────────────────
  let adjustedConfidenceLabel: AdjustedConfidenceLabel;
  const cautionCount = cautionReasons.length;

  if (cautionCount === 0) {
    adjustedConfidenceLabel = 'HIGH';
  } else if (disagreementLevel === 'HIGH' && cautionCount >= 2) {
    adjustedConfidenceLabel = 'VERY_LOW';
  } else if (disagreementLevel === 'HIGH' || cautionCount >= 3) {
    adjustedConfidenceLabel = 'LOW';
  } else if (cautionCount === 1 && disagreementLevel === 'LOW') {
    adjustedConfidenceLabel = 'MEDIUM';
  } else {
    adjustedConfidenceLabel = 'LOW';
  }

  return {
    disagreementScore: Math.round(rawDisagreement * 100) / 100,
    disagreementLevel,
    activeScores,
    adjustedConfidenceLabel,
    cautionReasons,
    limitations,
    isDegraded: false,
  };
}
