/**
 * Signal Effectiveness Layer — Type Definitions
 *
 * This module is a pure research evaluation layer (L3+).
 * It MUST NOT affect alphaScore, recommendationBucket,
 * StrategyScreenEngine, or backtest logic.
 *
 * All outputs are labelled as research observations, not predictions.
 */

// ─── Signal Taxonomy ─────────────────────────────────────────────

export type SignalType =
  | 'topic_surging'
  | 'theme_diffusing'
  | 'strong_alpha_candidate'
  | 'chip_accumulation_signal'
  | 'risk_cluster_elevated'
  | 'regime_shift_signal';

export type SignalWindow = 3 | 5 | 10;

export const ALL_SIGNAL_TYPES: SignalType[] = [
  'topic_surging',
  'theme_diffusing',
  'strong_alpha_candidate',
  'chip_accumulation_signal',
  'risk_cluster_elevated',
  'regime_shift_signal',
];

export const SIGNAL_LABELS: Record<SignalType, string> = {
  topic_surging: '主題升溫',
  theme_diffusing: '題材擴散',
  strong_alpha_candidate: '高 alpha 候選',
  chip_accumulation_signal: '籌碼累積',
  risk_cluster_elevated: '風險群聚升高',
  regime_shift_signal: '環境切換',
};

export type SignalClassification =
  | 'STRONG_SIGNAL'
  | 'CONDITIONAL_SIGNAL'
  | 'WEAK_SIGNAL'
  | 'NOISE';

export type SignalRegime = 'Bull' | 'Bear' | 'Neutral' | 'Unknown';

// ─── Signal Observation ──────────────────────────────────────────

/**
 * One historical occurrence of a signal.
 * Reconstructed from DB — no synthetic backfill.
 */
export interface SignalObservation {
  signalType: SignalType;
  /** Specific stock symbol, if signal is symbol-level. Undefined for market-wide signals. */
  symbol?: string;
  /** YYYY-MM-DD */
  date: string;
  context: {
    topic?: string;
    regime?: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
  };
}

export interface SignalHistory {
  signalType: SignalType;
  observations: SignalObservation[];
  limitations: string[];
}

// ─── Effectiveness Metrics ───────────────────────────────────────

export interface Metric {
  sampleSize: number;
  avgReturn: number;
  hitRate: number;
  /** Average forward return minus benchmark; undefined for legacy/degraded results */
  excessReturn?: number;
  /** Fraction of observations that beat the benchmark; undefined for legacy/degraded results */
  excessHitRate?: number;
}

/**
 * Effectiveness metrics for one signal type over a given forward-return window.
 *
 * ⚠️ All metrics are retrospective research observations.
 *    They describe historical patterns, not future predictions.
 *    Past behavior does NOT guarantee future outcomes.
 */
export interface SignalEffectiveness {
  signalType: SignalType;
  /** Forward return window in trading days */
  window: SignalWindow;

  /** Number of observations with computable forward returns */
  sampleSize: number;

  /** Fraction of observations where forward return was positive */
  hitRate: number;

  /** Average forward return across all observations */
  avgReturn: number;

  /** Average forward return minus benchmark (TAIEX) return for the same window */
  excessReturn: number;

  /**
   * Fraction of observations where forward return beat the benchmark (signalReturn > marketReturn).
   * Complements hitRate (positive return) with a market-relative perspective.
   * Undefined for degraded results.
   */
  excessHitRate?: number;

  /** Standard deviation of forward returns */
  volatility: number;

  /**
   * Brier-like calibration proxy.
   * Undefined if sampleSize < 10.
   */
  brierLikeScore?: number;

  /** Regime-conditional breakdown (only populated if regime data available) */
  regimeBreakdown: {
    bull?: Metric;
    bear?: Metric;
    neutral?: Metric;
  };

  /** Signal persistence characteristics */
  persistence: {
    /** Average consecutive days the signal fires for the same key (symbol/topic) */
    avgDuration: number;
    /** P(signal fires on D+1 | signal fires on D), for the same key */
    continuationRate: number;
  };

  /**
   * Cross-window consistency score.
   * 1.0 = perfectly stable across first/second half of history.
   * 0.0 = completely unstable.
   */
  stabilityScore: number;

  /** Research classification — see CLASSIFICATION_RULES */
  classification: SignalClassification;

  /** Documented data limitations for this evaluation */
  limitations: string[];
}

// ─── API Shape ───────────────────────────────────────────────────

export interface SignalEffectivenessApiResponse {
  signalType: SignalType;
  window: SignalWindow;
  effectiveness: SignalEffectiveness;
  generatedAt: string;
  limitations: string[];
}

export interface SignalEffectivenessBatchResult {
  signalType: SignalType;
  sampleSize: number;
  hitRate: number;
  avgReturn: number;
  excessReturn: number;
  stabilityScore: number;
  classification: SignalClassification;
  limitations: string[];
  effectiveness: SignalEffectiveness;
}

export interface SignalEffectivenessBatchApiResponse {
  window: SignalWindow;
  symbol?: string;
  results: SignalEffectivenessBatchResult[];
  generatedAt: string;
  limitations: string[];
}

export interface SignalEffectivenessSummary {
  window: SignalWindow;
  signals: Array<{
    signalType: SignalType;
    label: string;
    classification: SignalClassification;
    hitRate: number;
    avgReturn: number;
    excessReturn: number;
    sampleSize: number;
    regimeDependency: string;
    summary: string;
    limitations: string[];
  }>;
  generatedAt: string;
  dataNote: string;
  limitations: string[];
}
