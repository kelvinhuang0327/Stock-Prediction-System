/**
 * WalkForwardValidator
 *
 * Research-only module (L3+). Splits historical signal observations into two
 * chronological halves and evaluates each independently to assess whether
 * signal effectiveness is stable or regime-driven over time.
 *
 * HARD CONSTRAINTS
 * ----------------
 * - Never modifies alphaScore, recommendationBucket, or any L1 output.
 * - Re-uses evaluateSignalEffectiveness() — no new return-calculation logic.
 * - Pure research output. Not a trading signal.
 * - Does NOT mutate the input SignalHistory.
 *
 * SPLIT RULE
 * ----------
 * Observations are sorted by date (ascending), then split at the median.
 * The earlier half is labelled '前半' and the later half '後半'.
 * Minimum observations per half: MIN_HALF_SAMPLE (both halves must qualify).
 *
 * CONSISTENCY LABELS
 * ------------------
 * STABLE:   hitRateDeviation < 0.15 AND classificationMatch AND excessReturnSignMatch
 * UNSTABLE: hitRateDeviation > 0.30 OR (NOT classificationMatch AND NOT excessReturnSignMatch)
 * MIXED:    otherwise
 *
 * Layer: L3+ Research Overlay
 */

import { evaluateSignalEffectiveness } from './SignalEffectivenessEngine';
import type {
  SignalClassification,
  SignalEffectiveness,
  SignalHistory,
  SignalType,
  SignalWindow,
} from './types';

// ─── Constants ───────────────────────────────────────────────────

const MIN_HALF_SAMPLE = 8;

// ─── Types ───────────────────────────────────────────────────────

export interface WalkForwardPeriod {
  label: '前半' | '後半';
  /** First observation date in this period (YYYY-MM-DD) */
  start: string;
  /** Last observation date in this period (YYYY-MM-DD) */
  end: string;
  sampleSize: number;
  hitRate: number;
  excessReturn: number;
  excessHitRate: number | undefined;
  classification: SignalClassification;
}

export interface WalkForwardConsistency {
  /** |firstHalf.hitRate - secondHalf.hitRate| */
  hitRateDeviation: number;
  /** both periods produce same SignalClassification */
  classificationMatch: boolean;
  /** sign(firstHalf.excessReturn) === sign(secondHalf.excessReturn) */
  excessReturnSignMatch: boolean;
  /**
   * STABLE:   hitRateDeviation < 0.15 AND classificationMatch AND excessReturnSignMatch
   * UNSTABLE: hitRateDeviation > 0.30 OR (!classificationMatch AND !excessReturnSignMatch)
   * MIXED:    otherwise
   */
  overallLabel: 'STABLE' | 'MIXED' | 'UNSTABLE';
}

export interface WalkForwardResult {
  signalType: SignalType;
  window: SignalWindow;
  firstHalf: WalkForwardPeriod;
  secondHalf: WalkForwardPeriod;
  /** false if either half has fewer than MIN_HALF_SAMPLE computable observations */
  hasSufficientData: boolean;
  consistency: WalkForwardConsistency;
  limitations: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────

function makeDegradedPeriod(label: '前半' | '後半'): WalkForwardPeriod {
  return {
    label,
    start: '',
    end: '',
    sampleSize: 0,
    hitRate: 0,
    excessReturn: 0,
    excessHitRate: undefined,
    classification: 'NOISE',
  };
}

function toPeriod(
  eff: SignalEffectiveness,
  label: '前半' | '後半',
  sortedDates: string[],
): WalkForwardPeriod {
  return {
    label,
    start: sortedDates[0] ?? '',
    end: sortedDates[sortedDates.length - 1] ?? '',
    sampleSize: eff.sampleSize,
    hitRate: eff.hitRate,
    excessReturn: eff.excessReturn,
    excessHitRate: eff.excessHitRate,
    classification: eff.classification,
  };
}

function assessConsistency(
  first: WalkForwardPeriod,
  second: WalkForwardPeriod,
): WalkForwardConsistency {
  const hitRateDeviation =
    Math.round(Math.abs(first.hitRate - second.hitRate) * 10000) / 10000;
  const classificationMatch = first.classification === second.classification;
  const excessReturnSignMatch =
    Math.sign(first.excessReturn) === Math.sign(second.excessReturn);

  let overallLabel: 'STABLE' | 'MIXED' | 'UNSTABLE';
  if (hitRateDeviation < 0.15 && classificationMatch && excessReturnSignMatch) {
    overallLabel = 'STABLE';
  } else if (
    hitRateDeviation > 0.3 ||
    (!classificationMatch && !excessReturnSignMatch)
  ) {
    overallLabel = 'UNSTABLE';
  } else {
    overallLabel = 'MIXED';
  }

  return {
    hitRateDeviation,
    classificationMatch,
    excessReturnSignMatch,
    overallLabel,
  };
}

// ─── Main export ─────────────────────────────────────────────────

/**
 * Run walk-forward validation on a signal history.
 * Splits observations chronologically, evaluates each half independently,
 * then assesses consistency between the two periods.
 */
export async function runWalkForwardValidation(
  history: SignalHistory,
  window: SignalWindow,
): Promise<WalkForwardResult> {
  const { signalType, observations } = history;
  const limitations: string[] = [...history.limitations];

  // Sort ascending by date (does not mutate input — spread is above)
  const sorted = [...observations].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const mid = Math.floor(sorted.length / 2);
  const firstObs = sorted.slice(0, mid);
  const secondObs = sorted.slice(mid);

  if (firstObs.length < MIN_HALF_SAMPLE || secondObs.length < MIN_HALF_SAMPLE) {
    limitations.push(
      `觀察數不足以執行走勢驗證（共 ${sorted.length} 筆，每半段至少需 ${MIN_HALF_SAMPLE} 筆）。`,
    );
    return {
      signalType,
      window,
      firstHalf: makeDegradedPeriod('前半'),
      secondHalf: makeDegradedPeriod('後半'),
      hasSufficientData: false,
      consistency: {
        hitRateDeviation: 0,
        classificationMatch: false,
        excessReturnSignMatch: false,
        overallLabel: 'UNSTABLE',
      },
      limitations,
    };
  }

  const firstHistory: SignalHistory = {
    signalType,
    observations: firstObs,
    limitations: [...history.limitations],
  };
  const secondHistory: SignalHistory = {
    signalType,
    observations: secondObs,
    limitations: [...history.limitations],
  };

  const [firstEff, secondEff] = await Promise.all([
    evaluateSignalEffectiveness(firstHistory, window),
    evaluateSignalEffectiveness(secondHistory, window),
  ]);

  const firstPeriod = toPeriod(firstEff, '前半', firstObs.map((o) => o.date));
  const secondPeriod = toPeriod(secondEff, '後半', secondObs.map((o) => o.date));

  const consistency = assessConsistency(firstPeriod, secondPeriod);

  const allLimitations = [
    ...limitations,
    ...firstEff.limitations,
    ...secondEff.limitations,
  ];

  return {
    signalType,
    window,
    firstHalf: firstPeriod,
    secondHalf: secondPeriod,
    hasSufficientData: true,
    consistency,
    limitations: [...new Set(allLimitations)],
  };
}
