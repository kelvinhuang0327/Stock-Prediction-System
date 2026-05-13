/**
 * WalkForwardEngine.ts — T-05B Portfolio Walk-Forward Backtest Skeleton v2
 *
 * Observability-only measurement foundation.
 *
 * SAFETY CONTRACT:
 * - observability-only: no edge claim, no production write, no DB write
 * - no external API, no LLM call, no strategy mutation, no H001-H012
 * - uses resolveCurrentDate() — no hardcoded date cap
 * - 500-day lookback contract
 * - reads persisted MarketRegimeResult as read-only context (injected, not queried)
 * - no buy/sell output, no performance conclusions, no trading recommendations
 *
 * This is NOT a trading recommendation. NOT investment advice.
 * NOT ROI evidence. NOT win-rate evidence. NOT proof of any edge.
 */

import { resolveCurrentDate } from '@/lib/time/currentDate';
import type { PersistedRegimeContext } from '@/lib/marketRegimeResult';
import type { CandidateSnapshot } from '@/lib/backtest/CandidateDataAdapter';

// ─── Constants ────────────────────────────────────────────────────────────────

/** 500-day lookback contract for T-05B */
export const T05B_LOOKBACK_DAYS = 500;

/** Default max candidates per rebalance period (observability only) */
export const T05B_MAX_CANDIDATES = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalkForwardConfig {
  /** Reference date (YYYY-MM-DD). Defaults to resolveCurrentDate(). */
  currentDate?: string;
  /** Number of calendar days to look back. Defaults to T05B_LOOKBACK_DAYS (500). */
  lookbackDays?: number;
  /** Mock candidate IDs for skeleton observability. Not a strategy selection. */
  mockCandidates?: string[];
  /**
   * Pre-computed trading dates (YYYY-MM-DD[]) from Taiwan trading calendar adapter (T-05D).
   * If provided, overrides the weekday approximation in date range generation.
   * calendarBasis in output will be 'TAIWAN_TRADING_CALENDAR'; otherwise 'WEEKDAY_APPROXIMATION'.
   */
  tradingDates?: string[];
  /**
   * PIT-safe candidate snapshots from CandidateDataAdapter (T-05E).
   * If provided, replaces mock candidates. candidateSource = 'PIT_SAFE_CANDIDATE_SNAPSHOT'.
   * If not provided, uses mock fallback. candidateSource = 'MOCK_OBSERVABILITY_ONLY'.
   */
  candidateSnapshots?: CandidateSnapshot[];
}

export type RegimeDataAvailabilityFlag = 'AVAILABLE' | 'MISSING' | 'FUTURE_DATE_ERROR';

export interface RegimeContextForDate {
  date: string;
  isAvailable: boolean;
  regimeLabel: string | null;
  confidence: number | null;
  freshnessStatus: string | null;
  freshnessLagDays: number | null;
  source: string | null;
  version: string | null;
  warning: string | null;
  dataAvailabilityFlag: RegimeDataAvailabilityFlag;
}

export type RebalanceDateAvailabilityFlag =
  | 'AVAILABLE'
  | 'DATE_OUT_OF_RANGE'
  | 'NO_TRADING_DAYS';

export interface MonthlyRebalanceEntry {
  rebalanceDate: string;
  monthLabel: string;
  tradingDayIndex: number | null;
  dataAvailabilityFlag: RebalanceDateAvailabilityFlag;
}

export interface MonthlyRebalanceSchedule {
  rangeStart: string;
  rangeEnd: string;
  rebalanceCount: number;
  entries: MonthlyRebalanceEntry[];
  observabilityNote: string;
}

export interface CandidateRankEntry {
  candidateId: string;
  rankPosition: number;
  ruleOnlyScore: number;
  rankingBasis: string;
  observableReasons: string[];
  dataAvailabilityFlags: string[];
}

export interface RankCandidatesResult {
  asofDate: string;
  candidateCount: number;
  rankedCandidates: CandidateRankEntry[];
  rankingMethod: 'DETERMINISTIC_RULE_ONLY';
  observabilityNote: string;
}

export interface TurnoverStats {
  periodStart: string;
  periodEnd: string;
  rebalanceCount: number;
  candidateAddedCount: number;
  candidateRemovedCount: number;
  candidateRetainedCount: number;
  overlapRatio: number;
  missingDataCount: number;
  observabilityNote: string;
}

export interface WalkForwardSkeletonRecord {
  asofDate: string;
  regimeContextAvailable: boolean;
  regimeLabel: string | null;
  regimeConfidence: number | null;
  regimeFreshnessStatus: string | null;
  regimeFreshnessLagDays: number | null;
  candidateCount: number;
  dataAvailabilityFlags: string[];
  pitSafetyNote: string;
  placeholderMetrics: {
    note: string;
    forwardReturnPlaceholder: null;
    benchmarkReturnPlaceholder: null;
    drawdownPlaceholder: null;
  };
}

export interface WalkForwardSkeletonSafetyContract {
  noDbWrite: true;
  noExternalApiCall: true;
  noLlmCall: true;
  noBuySellOutput: true;
  noTradingClaims: true;
  noPerformanceClaims: true;
  noLegacyHypotheses: true;
  resolveCurrentDateUsed: true;
  noHardcodedTodayCap: true;
  persistedRegimeResultReadOnly: true;
  observabilityOnly: true;
}

export interface WalkForwardSkeletonSummary {
  totalRecords: number;
  recordsWithRegimeContext: number;
  recordsMissingRegimeContext: number;
  regimeDistribution: Record<string, number>;
  totalRebalancePoints: number;
  candidateCountRange: { min: number; max: number };
  missingDataDays: number;
}

export interface WalkForwardSkeletonOutput {
  task: 'T-05B_WALK_FORWARD_BACKTEST_SKELETON_V2';
  generatedAt: string;
  currentDate: string;
  lookbackDays: number;
  rangeStart: string;
  rangeEnd: string;
  totalDays: number;
  /** Indicates which calendar basis was used for date range generation. */
  calendarBasis: 'TAIWAN_TRADING_CALENDAR' | 'WEEKDAY_APPROXIMATION';
  safetyContract: WalkForwardSkeletonSafetyContract;
  summary: WalkForwardSkeletonSummary;
  rebalanceSchedule: MonthlyRebalanceSchedule;
  records: WalkForwardSkeletonRecord[];
  /** Indicates whether candidate data came from PIT-safe adapter or mock fallback. */
  candidateSource: 'PIT_SAFE_CANDIDATE_SNAPSHOT' | 'MOCK_OBSERVABILITY_ONLY';
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Generates a list of weekday dates (Mon-Fri) from (endDate - lookbackDays) to endDate.
 * Simplified trading date approximation: excludes Sat/Sun only.
 * Real implementation would use a full trading calendar.
 */
function generateWeekdayDateRange(endDate: string, lookbackCalendarDays: number): string[] {
  const dates: string[] = [];
  const end = new Date(endDate + 'T00:00:00Z');
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - lookbackCalendarDays);

  const current = new Date(start);
  while (current <= end) {
    const dow = current.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      dates.push(current.toISOString().slice(0, 10));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

// ─── Exported Functions ───────────────────────────────────────────────────────

/**
 * Returns observability regime context for a given date from an in-memory context map.
 *
 * NEVER re-computes regime. NEVER writes to DB. NEVER queries external sources.
 * Returns explicit MISSING state when no data is available — never assumes BULL or valid.
 *
 * @param date        - Target date (YYYY-MM-DD)
 * @param contextMap  - Pre-loaded read-only map of persisted MarketRegimeResult records
 */
export function getRegimeContextForDate(
  date: string,
  contextMap: Map<string, PersistedRegimeContext>,
): RegimeContextForDate {
  const resolvedDate = resolveCurrentDate(date);

  if (contextMap.size === 0) {
    return {
      date: resolvedDate,
      isAvailable: false,
      regimeLabel: null,
      confidence: null,
      freshnessStatus: 'MISSING',
      freshnessLagDays: null,
      source: null,
      version: null,
      warning: 'No persisted MarketRegimeResult context provided',
      dataAvailabilityFlag: 'MISSING',
    };
  }

  // PIT-safe: find the most recent persisted regime date that is <= resolvedDate
  const sortedKeys = [...contextMap.keys()].sort();
  let bestDate: string | null = null;
  for (const k of sortedKeys) {
    if (k <= resolvedDate) {
      bestDate = k;
    }
  }

  if (bestDate === null) {
    return {
      date: resolvedDate,
      isAvailable: false,
      regimeLabel: null,
      confidence: null,
      freshnessStatus: 'MISSING',
      freshnessLagDays: null,
      source: null,
      version: null,
      warning: 'No persisted MarketRegimeResult found for this date or any prior date',
      dataAvailabilityFlag: 'MISSING',
    };
  }

  const ctx = contextMap.get(bestDate)!;
  const lagDays = Math.round(
    (new Date(resolvedDate + 'T00:00:00Z').getTime() -
      new Date(bestDate + 'T00:00:00Z').getTime()) /
      86_400_000,
  );

  // Guardrail: regime date must be <= requested date (always holds due to PIT-safe lookup above)
  if (bestDate > resolvedDate) {
    return {
      date: resolvedDate,
      isAvailable: false,
      regimeLabel: null,
      confidence: null,
      freshnessStatus: 'FUTURE_DATE_ERROR',
      freshnessLagDays: lagDays,
      source: ctx.source,
      version: ctx.version,
      warning: `GUARDRAIL: regime date ${bestDate} is after requested date ${resolvedDate}`,
      dataAvailabilityFlag: 'FUTURE_DATE_ERROR',
    };
  }

  return {
    date: resolvedDate,
    isAvailable: true,
    regimeLabel: ctx.regimeLabel,
    confidence: ctx.confidence,
    freshnessStatus: lagDays <= 3 ? 'FRESH' : 'STALE',
    freshnessLagDays: lagDays,
    source: ctx.source,
    version: ctx.version,
    warning: lagDays > 3 ? `Regime data is ${lagDays} calendar days old` : null,
    dataAvailabilityFlag: 'AVAILABLE',
  };
}

/**
 * Builds a deterministic monthly rebalance schedule skeleton.
 *
 * No trading strategy. No buy/sell logic. No performance conclusions.
 * Observability metadata only.
 *
 * @param rangeStart   - Start date of walk-forward range (YYYY-MM-DD)
 * @param rangeEnd     - End date of walk-forward range (YYYY-MM-DD)
 * @param tradingDates - List of available trading dates in range
 */
export function buildMonthlyRebalanceSchedule(
  rangeStart: string,
  rangeEnd: string,
  tradingDates: string[],
): MonthlyRebalanceSchedule {
  if (tradingDates.length === 0) {
    return {
      rangeStart,
      rangeEnd,
      rebalanceCount: 0,
      entries: [],
      observabilityNote:
        'No trading dates available in range. Rebalance skeleton cannot be built.',
    };
  }

  const entries: MonthlyRebalanceEntry[] = [];

  // Parse range boundaries
  const startYear = parseInt(rangeStart.slice(0, 4), 10);
  const startMonth = parseInt(rangeStart.slice(5, 7), 10) - 1; // 0-indexed
  const endYear = parseInt(rangeEnd.slice(0, 4), 10);
  const endMonth = parseInt(rangeEnd.slice(5, 7), 10) - 1;

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthLabel = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthStartStr = `${monthLabel}-01`;
    const nextYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextMonthStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;

    // Find first available trading day in this calendar month within [rangeStart, rangeEnd]
    const tradingDayInMonth = tradingDates.find(
      d => d >= monthStartStr && d < nextMonthStr && d >= rangeStart && d <= rangeEnd,
    );

    if (tradingDayInMonth !== undefined) {
      entries.push({
        rebalanceDate: tradingDayInMonth,
        monthLabel,
        tradingDayIndex: tradingDates.indexOf(tradingDayInMonth),
        dataAvailabilityFlag: 'AVAILABLE',
      });
    } else if (monthStartStr <= rangeEnd && nextMonthStr > rangeStart) {
      entries.push({
        rebalanceDate: monthStartStr,
        monthLabel,
        tradingDayIndex: null,
        dataAvailabilityFlag: 'NO_TRADING_DAYS',
      });
    }

    // Advance month
    if (month === 11) {
      month = 0;
      year++;
    } else {
      month++;
    }
  }

  return {
    rangeStart,
    rangeEnd,
    rebalanceCount: entries.filter(e => e.dataAvailabilityFlag === 'AVAILABLE').length,
    entries,
    observabilityNote:
      'Monthly rebalance skeleton only. Observability metadata only. No trading strategy conclusions.',
  };
}

/**
 * Deterministic rule-only candidate ranking for observability purposes.
 *
 * Ranks by alphabetical candidateId order.
 * NOT an investment recommendation. NOT a trading strategy.
 * Output contains only neutral observability metadata.
 *
 * @param candidates    - List of candidate IDs
 * @param asofDate      - Reference date for observability context
 * @param regimeContext - Optional regime context for metadata enrichment (observability only)
 */
export function rankCandidatesRuleOnly(
  candidates: string[],
  asofDate: string,
  regimeContext?: RegimeContextForDate,
): RankCandidatesResult {
  const resolvedDate = resolveCurrentDate(asofDate);
  const sorted = [...candidates].sort();

  const rankedCandidates: CandidateRankEntry[] = sorted.map((id, index) => {
    const observableReasons: string[] = ['alphabetical-sort-deterministic'];
    const dataAvailabilityFlags: string[] = [];

    if (regimeContext?.isAvailable) {
      observableReasons.push(`regime-context-observed:${regimeContext.regimeLabel ?? 'UNKNOWN'}`);
    } else {
      dataAvailabilityFlags.push('regime-context-unavailable');
    }

    return {
      candidateId: id,
      rankPosition: index + 1,
      ruleOnlyScore: sorted.length - index,
      rankingBasis: 'ALPHABETICAL_DETERMINISTIC',
      observableReasons,
      dataAvailabilityFlags,
    };
  });

  return {
    asofDate: resolvedDate,
    candidateCount: candidates.length,
    rankedCandidates,
    rankingMethod: 'DETERMINISTIC_RULE_ONLY',
    observabilityNote:
      'Deterministic rule-only observability ranking. Not an investment recommendation. Not a trading output.',
  };
}

/**
 * Computes portfolio-level turnover observability statistics.
 *
 * No performance fields. No trading advisory. No strategy claims.
 * Measures candidate overlap and turnover for observability only.
 *
 * @param previousCandidates - Candidate list from the prior rebalance period
 * @param currentCandidates  - Candidate list from the current rebalance period
 * @param periodStart        - Start date of the measured period
 * @param periodEnd          - End date of the measured period
 * @param rebalanceCount     - Number of rebalance points in this period
 * @param missingDataCount   - Number of dates with missing regime/market data
 */
export function computeTurnoverStats(
  previousCandidates: string[],
  currentCandidates: string[],
  periodStart: string,
  periodEnd: string,
  rebalanceCount: number,
  missingDataCount: number,
): TurnoverStats {
  const prevSet = new Set(previousCandidates);
  const currSet = new Set(currentCandidates);

  const retained = currentCandidates.filter(c => prevSet.has(c));
  const added = currentCandidates.filter(c => !prevSet.has(c));
  const removed = previousCandidates.filter(c => !currSet.has(c));

  const unionSize = new Set([...previousCandidates, ...currentCandidates]).size;
  const overlapRatio = unionSize === 0 ? 0 : Math.round((retained.length / unionSize) * 10000) / 10000;

  return {
    periodStart,
    periodEnd,
    rebalanceCount,
    candidateAddedCount: added.length,
    candidateRemovedCount: removed.length,
    candidateRetainedCount: retained.length,
    overlapRatio,
    missingDataCount,
    observabilityNote:
      'Turnover observability stats only. No performance claims. No trading conclusions.',
  };
}

/**
 * Builds the full portfolio-level walk-forward skeleton.
 *
 * Key contracts:
 * - Uses resolveCurrentDate() — no hardcoded date cap
 * - 500-day lookback (T05B_LOOKBACK_DAYS) by default
 * - Reads injected regimeContextMap as read-only context (no DB write, no DB query)
 * - Output is observability-only; all performancce fields are null placeholders
 * - Deterministic given same config and context map
 *
 * @param config           - Walk-forward configuration
 * @param regimeContextMap - Pre-loaded read-only map of persisted MarketRegimeResult records.
 *                          Key: date string (YYYY-MM-DD). Value: PersistedRegimeContext.
 *                          Pass an empty Map() if no persisted data is available.
 */
export function buildWalkForwardSkeleton(
  config: WalkForwardConfig = {},
  regimeContextMap: Map<string, PersistedRegimeContext> = new Map(),
): WalkForwardSkeletonOutput {
  const currentDate = resolveCurrentDate(config.currentDate);
  const lookbackDays = config.lookbackDays ?? T05B_LOOKBACK_DAYS;

  // T-05E: use PIT-safe candidate snapshots if provided; else mock fallback
  let activeCandidates: string[];
  let candidateSource: 'PIT_SAFE_CANDIDATE_SNAPSHOT' | 'MOCK_OBSERVABILITY_ONLY';
  if (config.candidateSnapshots && config.candidateSnapshots.length > 0) {
    activeCandidates = config.candidateSnapshots.map(s => s.symbol);
    candidateSource = 'PIT_SAFE_CANDIDATE_SNAPSHOT';
  } else {
    activeCandidates = config.mockCandidates ?? ['A001', 'A002', 'A003', 'B001', 'B002'];
    candidateSource = 'MOCK_OBSERVABILITY_ONLY';
  }

  // Use injected trading dates (T-05D calendar) if provided; else fall back to weekday approx
  let tradingDates: string[];
  let calendarBasis: 'TAIWAN_TRADING_CALENDAR' | 'WEEKDAY_APPROXIMATION';

  if (config.tradingDates && config.tradingDates.length > 0) {
    tradingDates = config.tradingDates;
    calendarBasis = 'TAIWAN_TRADING_CALENDAR';
  } else {
    tradingDates = generateWeekdayDateRange(currentDate, lookbackDays);
    calendarBasis = 'WEEKDAY_APPROXIMATION';
  }

  const rangeStart = tradingDates.length > 0 ? tradingDates[0] : currentDate;
  const rangeEnd = tradingDates.length > 0 ? tradingDates[tradingDates.length - 1] : currentDate;

  // Build monthly rebalance schedule (observability only)
  const rebalanceSchedule = buildMonthlyRebalanceSchedule(rangeStart, rangeEnd, tradingDates);

  // Build skeleton records
  let recordsWithContext = 0;
  let recordsMissingContext = 0;
  const regimeDist: Record<string, number> = {};
  let missingDataDays = 0;

  const records: WalkForwardSkeletonRecord[] = tradingDates.map(date => {
    const regCtx = getRegimeContextForDate(date, regimeContextMap);
    const dataFlags: string[] = [];

    if (regCtx.isAvailable) {
      recordsWithContext++;
      const label = regCtx.regimeLabel ?? 'UNKNOWN';
      regimeDist[label] = (regimeDist[label] ?? 0) + 1;
    } else {
      recordsMissingContext++;
      dataFlags.push('regime-context-missing');
      missingDataDays++;
    }

    return {
      asofDate: date,
      regimeContextAvailable: regCtx.isAvailable,
      regimeLabel: regCtx.regimeLabel,
      regimeConfidence: regCtx.confidence,
      regimeFreshnessStatus: regCtx.freshnessStatus,
      regimeFreshnessLagDays: regCtx.freshnessLagDays,
      candidateCount: activeCandidates.length,
      dataAvailabilityFlags: dataFlags,
      pitSafetyNote: `PIT-safe: regime context date <= ${date}`,
      placeholderMetrics: {
        note: 'Skeleton only. No performance conclusions.',
        forwardReturnPlaceholder: null,
        benchmarkReturnPlaceholder: null,
        drawdownPlaceholder: null,
      },
    };
  });

  const candidateCounts = records.map(r => r.candidateCount);
  const candidateCountRange = {
    min: candidateCounts.length > 0 ? Math.min(...candidateCounts) : 0,
    max: candidateCounts.length > 0 ? Math.max(...candidateCounts) : 0,
  };

  return {
    task: 'T-05B_WALK_FORWARD_BACKTEST_SKELETON_V2',
    generatedAt: new Date().toISOString(),
    currentDate,
    lookbackDays,
    rangeStart,
    rangeEnd,
    totalDays: tradingDates.length,
    calendarBasis,
    safetyContract: {
      noDbWrite: true,
      noExternalApiCall: true,
      noLlmCall: true,
      noBuySellOutput: true,
      noTradingClaims: true,
      noPerformanceClaims: true,
      noLegacyHypotheses: true,
      resolveCurrentDateUsed: true,
      noHardcodedTodayCap: true,
      persistedRegimeResultReadOnly: true,
      observabilityOnly: true,
    },
    summary: {
      totalRecords: records.length,
      recordsWithRegimeContext: recordsWithContext,
      recordsMissingRegimeContext: recordsMissingContext,
      regimeDistribution: regimeDist,
      totalRebalancePoints: rebalanceSchedule.rebalanceCount,
      candidateCountRange,
      missingDataDays,
    },
    rebalanceSchedule,
    records,
    candidateSource,
  };
}
