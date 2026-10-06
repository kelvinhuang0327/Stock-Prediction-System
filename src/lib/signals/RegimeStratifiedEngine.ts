/**
 * RegimeStratifiedEngine
 *
 * Research-only overlay (L3+). Answers:
 *   "Is this signal effective across all market regimes, or only in specific conditions?"
 *
 * STRATEGY
 * --------
 * 1. Load landed regime history from DailyMarketSnapshot (date → regime label).
 * 2. Enrich signal observations: if the observation date has a known regime in
 *    the map, stamp it onto context.regime. Otherwise: falls through to
 *    observation.context.regime (if already set), otherwise Unknown.
 * 3. Evaluate the enriched history via the existing evaluateSignalEffectiveness().
 *    This reuses all forward-return computation — no duplication.
 * 4. Extract per-regime Metric (now includes excessReturn / excessHitRate thanks
 *    to the updated computeRegimeBreakdown()).
 * 5. Assess RegimeDependencyLabel: REGIME_STABLE / REGIME_CONDITIONAL / REGIME_FRAGILE.
 *
 * HARD CONSTRAINTS
 * ----------------
 * - Never modifies alphaScore, recommendationBucket, StrategyScreenEngine, or backtest.
 * - Never infers or fabricates missing regime history.
 * - When DailyMarketSnapshot is empty (0 rows), all observations land in Unknown →
 *   unknownRegimeFraction = 1.0 → REGIME_FRAGILE (degraded mode).
 * - Does NOT mutate input SignalHistory.
 *
 * CLASSIFICATION RULES (Phase 3)
 * --------------------------------
 * Requires assessableRegimes >= 2 (regimes with Metric !== undefined, i.e. >= MIN_REGIME_SAMPLE).
 *
 * REGIME_STABLE:
 *   - assessableRegimes >= 2
 *   - All assessable regimes have the same excessReturn sign (all > 0 or all <= 0)
 *   - No single regime accounts for > 80% of the total sample
 *   - unknownRegimeFraction <= 0.5
 *
 * REGIME_CONDITIONAL:
 *   - assessableRegimes >= 2
 *   - Only 1 regime has excessReturn > 0 (others flat/negative)
 *   - OR one regime dominates (> 80% sample share) but has clearly positive excessReturn
 *   - unknownRegimeFraction <= 0.5
 *
 * REGIME_FRAGILE (any of):
 *   - assessableRegimes < 2
 *   - unknownRegimeFraction > 0.5
 *   - Regimes show conflicting excessReturn directions AND no clear dominant
 *   - sampleSize < MIN_SAMPLE_FRAGILE overall
 *
 * Layer: L3+ Research Overlay
 */

import { prisma } from '@/lib/prisma';
import { evaluateSignalEffectiveness } from './SignalEffectivenessEngine';
import type {
  Metric,
  SignalHistory,
  SignalType,
  SignalWindow,
} from './types';

// ─── Constants ───────────────────────────────────────────────────

const MIN_SAMPLE_FRAGILE = 10;
const UNKNOWN_FRAGILE_THRESHOLD = 0.5;
const DOMINANT_REGIME_SHARE = 0.80;

// ─── Types ───────────────────────────────────────────────────────

export type RegimeDependencyLabel =
  | 'REGIME_STABLE'
  | 'REGIME_CONDITIONAL'
  | 'REGIME_FRAGILE';

export interface RegimeDependencyInfo {
  /** Regime with the highest excessReturn among assessable regimes */
  dominantRegime?: string;
  /** Regimes where excessReturn <= 0 or with insufficient samples */
  fragileRegimes: string[];
  consistencyLabel: RegimeDependencyLabel;
}

export interface RegimeStratifiedResult {
  signalType: SignalType;
  window: SignalWindow;
  sampleSize: number;

  overall: {
    hitRate: number;
    excessHitRate?: number;
    avgReturn: number;
    excessReturn: number;
    volatility: number;
  };

  regimeBreakdown: {
    bull?: Metric;
    bear?: Metric;
    neutral?: Metric;
  };

  regimeDependency: RegimeDependencyInfo;

  /**
   * Fraction of observations that could not be matched to a known regime.
   * High values (> 0.5) trigger REGIME_FRAGILE.
   */
  unknownRegimeFraction: number;

  /** false if DailyMarketSnapshot is empty or sample too small */
  hasSufficientRegimeData: boolean;

  /** Research-layer limitations */
  limitations: string[];
}

// ─── Internal helpers ────────────────────────────────────────────

function normalizeDate(d: string): string {
  if (!d) return '';
  if (d.includes('T')) return d.slice(0, 10);
  if (d.includes('-') && d.length >= 10) return d.slice(0, 10);
  return d.slice(0, 10);
}

function normalizeRegimeLabel(value: string | null | undefined): string {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'bull') return 'Bull';
  if (v === 'bear') return 'Bear';
  if (v === 'sideways' || v === 'neutral') return 'Neutral';
  return 'Unknown';
}

async function loadRegimeMap(days: number): Promise<Map<string, string>> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = await prisma.dailyMarketSnapshot.findMany({
    where: { snapshotDate: { gte: sinceStr } },
    select: { snapshotDate: true, regime: true },
    orderBy: { snapshotDate: 'asc' },
  });

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(normalizeDate(row.snapshotDate), normalizeRegimeLabel(row.regime));
  }
  return map;
}

function enrichHistoryWithRegime(
  history: SignalHistory,
  regimeMap: Map<string, string>,
): { enriched: SignalHistory; unmatchedCount: number; totalCount: number } {
  let unmatchedCount = 0;
  const totalCount = history.observations.length;

  const enrichedObservations = history.observations.map((obs) => {
    const mapped = regimeMap.get(obs.date);
    if (mapped && mapped !== 'Unknown') {
      // Stamp the landed regime from DailyMarketSnapshot
      return { ...obs, context: { ...obs.context, regime: mapped } };
    }
    // If not in map, keep the observation's own context.regime (may be set by builder)
    if (obs.context.regime && obs.context.regime !== 'Unknown') {
      return obs;
    }
    unmatchedCount += 1;
    return obs;
  });

  return {
    enriched: { ...history, observations: enrichedObservations },
    unmatchedCount,
    totalCount,
  };
}

function assessRegimeDependency(
  breakdown: { bull?: Metric; bear?: Metric; neutral?: Metric },
  totalSample: number,
  unknownFraction: number,
  overallSampleSize: number,
): RegimeDependencyInfo {
  // Collect assessable regimes (those with a Metric)
  const available: Array<{ name: string; metric: Metric }> = [];
  if (breakdown.bull) available.push({ name: 'Bull', metric: breakdown.bull });
  if (breakdown.bear) available.push({ name: 'Bear', metric: breakdown.bear });
  if (breakdown.neutral) available.push({ name: 'Neutral', metric: breakdown.neutral });

  // dominantRegime = highest excessReturn (falls back to avgReturn)
  const sorted = [...available].sort(
    (a, b) =>
      (b.metric.excessReturn ?? b.metric.avgReturn) -
      (a.metric.excessReturn ?? a.metric.avgReturn),
  );
  const dominant = sorted[0];

  // Classify each regime's excessReturn direction
  const truePositive = available.filter(
    (r) => (r.metric.excessReturn ?? r.metric.avgReturn) > 0,
  );
  const trueNegative = available.filter(
    (r) => (r.metric.excessReturn ?? r.metric.avgReturn) < 0,
  );

  // fragileRegimes = regimes where the signal clearly hurts vs benchmark
  const fragileRegimes = trueNegative.map((r) => r.name);

  let consistencyLabel: RegimeDependencyLabel;

  // ── FRAGILE: hard conditions first ─────────────────────────────
  if (
    available.length < 2 ||
    unknownFraction > UNKNOWN_FRAGILE_THRESHOLD ||
    overallSampleSize < MIN_SAMPLE_FRAGILE
  ) {
    consistencyLabel = 'REGIME_FRAGILE';
  } else if (trueNegative.length > 0 && truePositive.length > 0) {
    // Regimes flip direction (some positive, some negative) → FRAGILE
    consistencyLabel = 'REGIME_FRAGILE';
  } else if (truePositive.length === available.length || trueNegative.length === available.length) {
    // All regimes have the same excess direction
    const maxShare =
      Math.max(...available.map((r) => r.metric.sampleSize)) / totalSample;

    if (maxShare > DOMINANT_REGIME_SHARE) {
      // One regime so dominant that "stability" is dataset-specific → CONDITIONAL
      consistencyLabel = 'REGIME_CONDITIONAL';
    } else {
      consistencyLabel = 'REGIME_STABLE';
    }
  } else if (truePositive.length === 1 && trueNegative.length === 0) {
    // 1 positive regime, rest flat (neutral excess) → CONDITIONAL
    consistencyLabel = 'REGIME_CONDITIONAL';
  } else {
    // Mixed picture with no clear pattern → FRAGILE
    consistencyLabel = 'REGIME_FRAGILE';
  }

  return {
    dominantRegime: dominant?.name,
    fragileRegimes,
    consistencyLabel,
  };
}

// ─── Main exports ─────────────────────────────────────────────────

/**
 * Run regime-stratified effectiveness analysis for a single signal.
 *
 * Enriches observations with landed DailyMarketSnapshot regime data,
 * then evaluates effectiveness per regime without re-computing returns.
 */
export async function computeRegimeStratified(
  history: SignalHistory,
  window: SignalWindow,
  regimeMap: Map<string, string>,
): Promise<RegimeStratifiedResult> {
  const { signalType } = history;
  const limitations: string[] = [...history.limitations];

  // ── 1. Enrich observations ──────────────────────────────────────
  const { enriched, unmatchedCount, totalCount } = enrichHistoryWithRegime(
    history,
    regimeMap,
  );
  const unknownRegimeFraction =
    totalCount > 0 ? Math.round((unmatchedCount / totalCount) * 100) / 100 : 1;

  if (regimeMap.size === 0) {
    limitations.push(
      'DailyMarketSnapshot 無可用 regime 歷史（0 筆），所有觀察將以 Unknown 處理。',
    );
  } else if (unknownRegimeFraction > UNKNOWN_FRAGILE_THRESHOLD) {
    limitations.push(
      `${Math.round(unknownRegimeFraction * 100)}% 的觀察無法對齊到已落地 regime，分層分析可信度有限。`,
    );
  }

  // ── 2. Evaluate effectiveness on enriched history ───────────────
  const effectiveness = await evaluateSignalEffectiveness(enriched, window);

  // Merge engine limitations
  for (const lim of effectiveness.limitations) {
    if (!limitations.includes(lim)) limitations.push(lim);
  }

  // ── 3. Extract per-regime metrics ──────────────────────────────
  const breakdown = effectiveness.regimeBreakdown;
  const totalRegimeSample =
    (breakdown.bull?.sampleSize ?? 0) +
    (breakdown.bear?.sampleSize ?? 0) +
    (breakdown.neutral?.sampleSize ?? 0);

  // ── 4. Assess regime dependency ─────────────────────────────────
  const regimeDependency = assessRegimeDependency(
    breakdown,
    totalRegimeSample || effectiveness.sampleSize,
    unknownRegimeFraction,
    effectiveness.sampleSize,
  );

  const hasSufficientRegimeData =
    regimeMap.size > 0 &&
    unknownRegimeFraction <= UNKNOWN_FRAGILE_THRESHOLD &&
    effectiveness.sampleSize >= MIN_SAMPLE_FRAGILE;

  return {
    signalType,
    window,
    sampleSize: effectiveness.sampleSize,
    overall: {
      hitRate: effectiveness.hitRate,
      excessHitRate: effectiveness.excessHitRate,
      avgReturn: effectiveness.avgReturn,
      excessReturn: effectiveness.excessReturn,
      volatility: effectiveness.volatility,
    },
    regimeBreakdown: breakdown,
    regimeDependency,
    unknownRegimeFraction,
    hasSufficientRegimeData,
    limitations: [...new Set(limitations)],
  };
}

/**
 * Run regime-stratified analysis for multiple signal histories.
 * Loads regime map once, applies to all histories.
 */
export async function computeAllRegimeStratified(
  histories: SignalHistory[],
  window: SignalWindow,
  days = 180,
): Promise<RegimeStratifiedResult[]> {
  const regimeMap = await loadRegimeMap(days);
  return Promise.all(
    histories.map((h) => computeRegimeStratified(h, window, regimeMap)),
  );
}
