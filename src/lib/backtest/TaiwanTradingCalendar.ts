/**
 * TaiwanTradingCalendar.ts — T-05D Taiwan Trading Calendar Adapter
 *
 * Deterministic, static-override-based Taiwan Stock Exchange (TWSE) trading
 * calendar adapter for WalkForwardEngine.
 *
 * SAFETY CONTRACT:
 * - T-05D: Taiwan trading calendar adapter | deterministic calendar | static override contract
 * - no external API, no DB write, no LLM call
 * - no strategy mutation, no performance claim, no edge claim
 * - no H001-H012
 *
 * Important: The built-in static holiday list is an APPROXIMATION for skeleton
 * observability purposes only. Production use requires official TWSE published data.
 * All dates are treated as UTC (YYYY-MM-DD). No locale-dependent logic.
 */

import { resolveCurrentDate } from '@/lib/time/currentDate';

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Thrown when normalizeTradingDateKey receives input it cannot parse. */
export class InvalidTradingDateKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTradingDateKeyError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Configuration for building a Taiwan trading calendar. */
export interface TaiwanCalendarConfig {
  /** Start date of calendar range (YYYY-MM-DD, inclusive). */
  startDate: string;
  /** End date of calendar range (YYYY-MM-DD, inclusive). */
  endDate: string;
  /**
   * Dates to exclude as non-trading days (public holidays, special closures).
   * Overrides weekday status — a Monday listed here is treated as non-trading.
   * Format: YYYY-MM-DD.
   */
  holidayOverrides?: string[];
  /**
   * Dates to include as trading days even if they fall on a weekend.
   * Compensatory trading days (補班交易日) announced by TWSE.
   * Format: YYYY-MM-DD.
   */
  specialTradingDayOverrides?: string[];
}

/** Result object from buildTaiwanTradingCalendar(). */
export interface TaiwanTradingCalendarResult {
  startDate: string;
  endDate: string;
  tradingDates: string[];
  tradingDateSet: Set<string>;
  calendarBasis: 'TAIWAN_TRADING_CALENDAR';
  builtInHolidayCount: number;
  holidayOverrideCount: number;
  specialTradingDayOverrideCount: number;
  weekendExcludedCount: number;
  observabilityNote: string;
}

/** A single monthly rebalance entry for the trading calendar schedule. */
export interface TradingCalendarRebalanceEntry {
  monthKey: string;
  scheduledTradingDate: string | null;
  calendarBasis: 'TAIWAN_TRADING_CALENDAR' | 'WEEKDAY_APPROXIMATION';
  availableTradingDaysInMonth: number;
  status: 'AVAILABLE' | 'NO_TRADING_DAYS';
}

/** Output of buildMonthlyTradingRebalanceSchedule(). */
export interface TradingCalendarRebalanceSchedule {
  rangeStart: string;
  rangeEnd: string;
  rebalanceCount: number;
  entries: TradingCalendarRebalanceEntry[];
  calendarBasis: 'TAIWAN_TRADING_CALENDAR';
  observabilityNote: string;
}

/** Coverage summary from validateTradingCalendarCoverage(). Observability only. */
export interface TradingCalendarCoverageSummary {
  startDate: string;
  endDate: string;
  totalCalendarDays: number;
  tradingDayCount: number;
  weekendExcludedCount: number;
  holidayOverrideExcludedCount: number;
  specialTradingDayIncludedCount: number;
  firstTradingDate: string | null;
  lastTradingDate: string | null;
  status: 'PASS' | 'WARN' | 'FAIL';
  statusNote: string;
}

// ─── Built-in Static Holiday List ─────────────────────────────────────────────

/**
 * Built-in static TWSE holiday approximation for 2024–2026.
 *
 * NOTE: This is an OBSERVABILITY SKELETON approximation.
 * Authoritative data must come from official TWSE calendar publications.
 * Saturdays and Sundays are excluded independently via weekday logic.
 *
 * Dates that fall on weekends are still listed (they remain non-trading regardless).
 * The adapter handles weekend exclusion separately from this list.
 */
export const TAIWAN_STATIC_HOLIDAYS_2024_2026: readonly string[] = [
  // 2024 ──────────────────────────────────────────────────────────────────────
  '2024-01-01', // New Year's Day (元旦)
  '2024-02-08', // Spring Festival Eve (除夕)
  '2024-02-09', // Spring Festival Day 1 (初一)
  '2024-02-10', // Spring Festival Day 2 (初二)
  '2024-02-12', // Spring Festival Day 4 — compensatory Monday
  '2024-02-13', // Spring Festival Day 5 — compensatory Tuesday
  '2024-02-14', // Spring Festival Day 6 — compensatory Wednesday
  '2024-02-28', // Peace Memorial Day (和平紀念日)
  '2024-04-04', // Children's Day / Tomb Sweeping (兒童節/清明節)
  '2024-04-05', // Tomb Sweeping Day (清明節)
  '2024-06-10', // Dragon Boat Festival (端午節)
  '2024-09-17', // Mid-Autumn Festival (中秋節)
  '2024-10-10', // National Day (國慶日)

  // 2025 ──────────────────────────────────────────────────────────────────────
  '2025-01-01', // New Year's Day (元旦)
  '2025-01-27', // Spring Festival Eve (除夕)
  '2025-01-28', // Spring Festival Day 1 (初一)
  '2025-01-29', // Spring Festival Day 2 (初二)
  '2025-01-30', // Spring Festival Day 3 (初三)
  '2025-01-31', // Spring Festival Day 4 (初四)
  '2025-02-03', // Spring Festival compensatory holiday
  '2025-02-04', // Spring Festival compensatory holiday
  '2025-02-28', // Peace Memorial Day (和平紀念日)
  '2025-04-03', // Children's Day compensatory (兒童節補假)
  '2025-04-04', // Children's Day / Tomb Sweeping (兒童節/清明節)
  '2025-05-01', // Labor Day (勞動節) — TWSE closed since 2023
  '2025-05-30', // Dragon Boat Festival (端午節)
  '2025-10-06', // Mid-Autumn Festival compensatory (中秋補假)
  '2025-10-07', // Mid-Autumn Festival (中秋節)
  '2025-10-10', // National Day (國慶日)

  // 2026 ──────────────────────────────────────────────────────────────────────
  '2026-01-01', // New Year's Day (元旦)
  '2026-02-17', // Spring Festival Eve (除夕) — approximate
  '2026-02-18', // Spring Festival Day 1 (初一) — approximate
  '2026-02-19', // Spring Festival Day 2 (初二) — approximate
  '2026-02-20', // Spring Festival Day 3 (初三) — approximate
  '2026-02-23', // Spring Festival compensatory holiday — approximate
  '2026-02-24', // Spring Festival compensatory holiday — approximate
  '2026-02-28', // Peace Memorial Day (和平紀念日)
  '2026-04-03', // Children's Day compensatory — approximate
  '2026-04-04', // Children's Day / Tomb Sweeping — approximate
  '2026-05-01', // Labor Day (勞動節)
  '2026-06-19', // Dragon Boat Festival — approximate
  '2026-09-25', // Mid-Autumn Festival — approximate
  '2026-10-09', // National Day compensatory (Oct 10 is Saturday) — approximate
] as const;

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** UTC-safe day-of-week check (0=Sun, 6=Sat). */
function getUTCDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay();
}

/** Count total calendar days between two inclusive YYYY-MM-DD dates. */
function countCalendarDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  if (end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

// ─── Exported Functions ───────────────────────────────────────────────────────

/**
 * Normalizes a Date or date string to a YYYY-MM-DD key using UTC.
 *
 * Deterministic, locale-independent, timezone-stable.
 * Throws InvalidTradingDateKeyError on unrecognized input.
 *
 * @param input - A Date object, ISO date string, or YYYY-MM-DD string
 */
export function normalizeTradingDateKey(input: Date | string): string {
  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      throw new InvalidTradingDateKeyError(
        `Invalid Date object provided to normalizeTradingDateKey`,
      );
    }
    return input.toISOString().slice(0, 10);
  }

  const s = String(input).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00Z');
    if (isNaN(d.getTime())) {
      throw new InvalidTradingDateKeyError(`Invalid YYYY-MM-DD value: "${s}"`);
    }
    return s;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  throw new InvalidTradingDateKeyError(`Cannot normalize to YYYY-MM-DD: "${input}"`);
}

/**
 * Builds a deterministic Taiwan trading calendar for the given date range.
 *
 * Excludes Saturdays and Sundays.
 * Excludes built-in static Taiwan holiday list plus any holidayOverrides.
 * Includes specialTradingDayOverrides even if they fall on weekends.
 *
 * No external API. No DB write. No LLM. Purely deterministic.
 *
 * @param config - Calendar configuration with optional overrides
 */
export function buildTaiwanTradingCalendar(
  config: TaiwanCalendarConfig,
): TaiwanTradingCalendarResult {
  const startDate = resolveCurrentDate(config.startDate);
  const endDate = resolveCurrentDate(config.endDate);

  const builtInHolidaySet = new Set<string>(TAIWAN_STATIC_HOLIDAYS_2024_2026);
  const holidayOverrideSet = new Set<string>(config.holidayOverrides ?? []);
  const specialSet = new Set<string>(config.specialTradingDayOverrides ?? []);

  const allHolidays = new Set<string>([...builtInHolidaySet, ...holidayOverrideSet]);
  const tradingDates: string[] = [];

  let weekendExcludedCount = 0;
  let builtInHolidaysHit = 0;
  let holidayOverrideHit = 0;
  let specialTradingDayHit = 0;

  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const dow = current.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = allHolidays.has(dateStr);
    const isSpecial = specialSet.has(dateStr);

    if (isSpecial) {
      // Special trading day: include regardless of weekend or holiday status
      tradingDates.push(dateStr);
      if (isWeekend || isHoliday) specialTradingDayHit++;
    } else if (isWeekend) {
      weekendExcludedCount++;
    } else if (isHoliday) {
      if (holidayOverrideSet.has(dateStr) && !builtInHolidaySet.has(dateStr)) {
        holidayOverrideHit++;
      } else {
        builtInHolidaysHit++;
        if (holidayOverrideSet.has(dateStr)) holidayOverrideHit++; // also counted as override
      }
    } else {
      tradingDates.push(dateStr);
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    startDate,
    endDate,
    tradingDates,
    tradingDateSet: new Set(tradingDates),
    calendarBasis: 'TAIWAN_TRADING_CALENDAR',
    builtInHolidayCount: builtInHolidaysHit,
    holidayOverrideCount: holidayOverrideSet.size,
    specialTradingDayOverrideCount: specialTradingDayHit,
    weekendExcludedCount,
    observabilityNote:
      'Taiwan trading calendar skeleton. Built-in holiday list is approximate. ' +
      'Requires official TWSE data for production accuracy. No strategy conclusions.',
  };
}

/**
 * Checks if a given date is a Taiwan trading day according to the calendar.
 *
 * Deterministic and timezone-stable (UTC-based).
 * Throws InvalidTradingDateKeyError on invalid input.
 *
 * @param date     - Date object or YYYY-MM-DD string to check
 * @param calendar - Result from buildTaiwanTradingCalendar()
 */
export function isTaiwanTradingDay(
  date: Date | string,
  calendar: TaiwanTradingCalendarResult,
): boolean {
  const dateStr = normalizeTradingDateKey(date);
  return calendar.tradingDateSet.has(dateStr);
}

/**
 * Returns all Taiwan trading dates in [startDate, endDate] as a sorted array.
 *
 * Deterministic. Uses holidayOverrides and specialTradingDayOverrides.
 * Returns empty array for empty/inverted ranges.
 *
 * @param startDate                   - Start date (YYYY-MM-DD, inclusive)
 * @param endDate                     - End date (YYYY-MM-DD, inclusive)
 * @param holidayOverrides            - Additional dates to exclude as holidays
 * @param specialTradingDayOverrides  - Dates to include despite being weekends
 */
export function buildTaiwanTradingDateRange(
  startDate: string,
  endDate: string,
  holidayOverrides: string[] = [],
  specialTradingDayOverrides: string[] = [],
): string[] {
  const start = resolveCurrentDate(startDate);
  const end = resolveCurrentDate(endDate);

  if (end < start) return [];

  const calendar = buildTaiwanTradingCalendar({
    startDate: start,
    endDate: end,
    holidayOverrides,
    specialTradingDayOverrides,
  });

  return calendar.tradingDates;
}

/**
 * Builds a deterministic monthly rebalance schedule using Taiwan trading calendar.
 *
 * Uses the first available trading day per month within the range.
 * No buy/sell logic. No strategy conclusions. Observability metadata only.
 *
 * @param startDate  - Start date of range (YYYY-MM-DD)
 * @param endDate    - End date of range (YYYY-MM-DD)
 * @param calendar   - Pre-built Taiwan trading calendar for the range
 */
export function buildMonthlyTradingRebalanceSchedule(
  startDate: string,
  endDate: string,
  calendar: TaiwanTradingCalendarResult,
): TradingCalendarRebalanceSchedule {
  const resolvedStart = resolveCurrentDate(startDate);
  const resolvedEnd = resolveCurrentDate(endDate);

  const tradingDates = calendar.tradingDates;

  if (tradingDates.length === 0) {
    return {
      rangeStart: resolvedStart,
      rangeEnd: resolvedEnd,
      rebalanceCount: 0,
      entries: [],
      calendarBasis: 'TAIWAN_TRADING_CALENDAR',
      observabilityNote:
        'No trading dates in range. Monthly rebalance schedule cannot be built.',
    };
  }

  const entries: TradingCalendarRebalanceEntry[] = [];

  const startYear = parseInt(resolvedStart.slice(0, 4), 10);
  const startMonth = parseInt(resolvedStart.slice(5, 7), 10) - 1;
  const endYear = parseInt(resolvedEnd.slice(0, 4), 10);
  const endMonth = parseInt(resolvedEnd.slice(5, 7), 10) - 1;

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthStartStr = `${monthKey}-01`;
    const nextYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextMonthStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;

    // Find all trading days in this month within [resolvedStart, resolvedEnd]
    const tradingDaysInMonth = tradingDates.filter(
      d => d >= monthStartStr && d < nextMonthStr && d >= resolvedStart && d <= resolvedEnd,
    );

    if (tradingDaysInMonth.length > 0) {
      entries.push({
        monthKey,
        scheduledTradingDate: tradingDaysInMonth[0], // First available trading day
        calendarBasis: 'TAIWAN_TRADING_CALENDAR',
        availableTradingDaysInMonth: tradingDaysInMonth.length,
        status: 'AVAILABLE',
      });
    } else if (monthStartStr <= resolvedEnd && nextMonthStr > resolvedStart) {
      entries.push({
        monthKey,
        scheduledTradingDate: null,
        calendarBasis: 'TAIWAN_TRADING_CALENDAR',
        availableTradingDaysInMonth: 0,
        status: 'NO_TRADING_DAYS',
      });
    }

    if (month === 11) {
      month = 0;
      year++;
    } else {
      month++;
    }
  }

  return {
    rangeStart: resolvedStart,
    rangeEnd: resolvedEnd,
    rebalanceCount: entries.filter(e => e.status === 'AVAILABLE').length,
    entries,
    calendarBasis: 'TAIWAN_TRADING_CALENDAR',
    observabilityNote:
      'Monthly trading rebalance schedule only. First available trading day per month. ' +
      'No trading strategy conclusions. Observability metadata only.',
  };
}

/**
 * Validates trading calendar coverage and returns an observability summary.
 *
 * Coverage thresholds:
 *   PASS  — tradingDayCount / totalCalendarDays >= 40% (typical ~71% after weekends)
 *   WARN  — tradingDayCount / totalCalendarDays 20%–39%
 *   FAIL  — tradingDayCount / totalCalendarDays < 20% (suspicious — too many excluded)
 *
 * No performance fields. No strategy claims.
 *
 * @param calendar          - Result from buildTaiwanTradingCalendar()
 * @param holidayOverrides  - Number of holiday override dates applied
 * @param specialOverrides  - Number of special trading day overrides applied
 */
export function validateTradingCalendarCoverage(
  calendar: TaiwanTradingCalendarResult,
): TradingCalendarCoverageSummary {
  const totalCalendarDays = countCalendarDays(calendar.startDate, calendar.endDate);
  const tradingDayCount = calendar.tradingDates.length;
  const firstTradingDate = tradingDayCount > 0 ? calendar.tradingDates[0] : null;
  const lastTradingDate = tradingDayCount > 0 ? calendar.tradingDates[tradingDayCount - 1] : null;

  const ratio = totalCalendarDays === 0 ? 0 : tradingDayCount / totalCalendarDays;

  let status: 'PASS' | 'WARN' | 'FAIL';
  let statusNote: string;

  if (totalCalendarDays === 0) {
    status = 'WARN';
    statusNote = 'Empty date range. Calendar coverage cannot be evaluated.';
  } else if (ratio >= 0.4) {
    status = 'PASS';
    statusNote = `Trading day ratio ${(ratio * 100).toFixed(1)}% (${tradingDayCount}/${totalCalendarDays} calendar days). Calendar looks well-formed.`;
  } else if (ratio >= 0.2) {
    status = 'WARN';
    statusNote = `Trading day ratio ${(ratio * 100).toFixed(1)}% is lower than expected. Verify holiday overrides.`;
  } else {
    status = 'FAIL';
    statusNote = `Trading day ratio ${(ratio * 100).toFixed(1)}% is unusually low. Calendar may be misconfigured.`;
  }

  return {
    startDate: calendar.startDate,
    endDate: calendar.endDate,
    totalCalendarDays,
    tradingDayCount,
    weekendExcludedCount: calendar.weekendExcludedCount,
    holidayOverrideExcludedCount: calendar.holidayOverrideCount,
    specialTradingDayIncludedCount: calendar.specialTradingDayOverrideCount,
    firstTradingDate,
    lastTradingDate,
    status,
    statusNote,
  };
}
