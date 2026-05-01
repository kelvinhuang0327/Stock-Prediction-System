/**
 * Lightweight Taiwan (TWSE) trading calendar.
 *
 * Covers weekends + a partial list of known TWSE non-trading days.
 * This is NOT a complete exchange calendar — extend KNOWN_TW_HOLIDAYS
 * each year as TWSE announces the official schedule.
 *
 * All date logic uses Taiwan local time (UTC+8).
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns the ISO date string "YYYY-MM-DD" for a Date in Taiwan time (UTC+8). */
export function toTaiwanDateIso(date: Date): string {
  const tw = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return tw.toISOString().slice(0, 10);
}

/** Returns the day-of-week (0=Sun … 6=Sat) for a Taiwan-local date ISO string. */
function twDayOfWeek(twDateIso: string): number {
  return new Date(`${twDateIso}T12:00:00+08:00`).getDay();
}

function isWeekend(twDateIso: string): boolean {
  const dow = twDayOfWeek(twDateIso);
  return dow === 0 || dow === 6;
}

// ---------------------------------------------------------------------------
// Known TWSE non-trading days (partial — extend annually)
// Dates are Taiwan local time. Source: TWSE official holiday announcements.
// ---------------------------------------------------------------------------
const KNOWN_TW_HOLIDAYS: ReadonlySet<string> = new Set([
  // ── 2025 ──────────────────────────────────────────────────────────────────
  '2025-01-01', // New Year's Day
  '2025-01-27', // Lunar New Year Eve
  '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', // Spring Festival
  '2025-02-03', // Spring Festival bridge
  '2025-02-28', // Peace Memorial Day
  '2025-04-03', // Children's Day (bridge — adjacent to Qingming)
  '2025-04-04', // Qingming Festival (Tomb Sweeping Day)
  '2025-05-01', // Labor Day
  '2025-05-30', // Dragon Boat Festival bridge
  '2025-05-31', // Dragon Boat Festival
  '2025-10-06', // National Day bridge
  '2025-10-10', // National Day

  // ── 2026 ──────────────────────────────────────────────────────────────────
  '2026-01-01', // New Year's Day
  // Spring Festival 2026: CNY falls on 2026-02-17 (Year of the Horse)
  // TWSE typically closes CNY Eve + approx. 初一–初五; dates below are estimated
  // and should be verified against the official TWSE 2026 schedule when published.
  '2026-02-16', // Lunar New Year Eve (除夕)
  '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', // Spring Festival
  '2026-02-28', // Peace Memorial Day
  '2026-04-03', // Children's Day (Friday, bridge to Qingming weekend)
  '2026-04-05', // Qingming Festival (Tomb Sweeping Day)
  '2026-05-01', // Labor Day ← current session date
  '2026-06-19', // Dragon Boat Festival
  '2026-09-27', // Mid-Autumn Festival
  '2026-10-09', // National Day bridge
  '2026-10-10', // National Day
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if the given Date is a TWSE trading day
 * (weekday that is not a known public holiday).
 */
export function isTaiwanTradingDay(date: Date): boolean {
  const iso = toTaiwanDateIso(date);
  if (isWeekend(iso)) return false;
  if (KNOWN_TW_HOLIDAYS.has(iso)) return false;
  return true;
}

/**
 * Returns the most recent Taiwan trading day on or before the given date (ISO string).
 * If the given date is itself a trading day, returns that date.
 * Looks back up to 14 calendar days.
 */
export function getPreviousTaiwanTradingDay(date: Date): string {
  for (let lag = 0; lag <= 14; lag++) {
    const candidate = new Date(date.getTime() - lag * 24 * 60 * 60 * 1000);
    if (isTaiwanTradingDay(candidate)) {
      return toTaiwanDateIso(candidate);
    }
  }
  throw new Error('Could not find previous Taiwan trading day within 14 days');
}

/**
 * Returns the next Taiwan trading day strictly after the given date (ISO string).
 * Looks ahead up to 14 calendar days.
 */
export function getNextTaiwanTradingDay(date: Date): string {
  for (let step = 1; step <= 14; step++) {
    const candidate = new Date(date.getTime() + step * 24 * 60 * 60 * 1000);
    if (isTaiwanTradingDay(candidate)) {
      return toTaiwanDateIso(candidate);
    }
  }
  throw new Error('Could not find next Taiwan trading day within 14 days');
}

// ---------------------------------------------------------------------------
// Quote freshness classification
// ---------------------------------------------------------------------------

export type MarketCalendarStatus =
  | 'MARKET_CLOSED_HOLIDAY'
  | 'MARKET_CLOSED_WEEKEND'
  | 'MARKET_OPEN';

export type QuoteFreshnessLabel =
  /** Quote is current for today (trading day, quote matches today). */
  | 'QUOTE_CURRENT'
  /** Market is closed today; quote is current as of the last trading day;
   *  next update expected on the next trading day. */
  | 'QUOTE_EXPECTED_NEXT_TRADING_DAY'
  /** Market was open but quote has not yet advanced to the expected date. */
  | 'QUOTE_SYNC_DELAYED'
  /** Quote is older than 48 h on a trading day — downstream stale guard active. */
  | 'QUOTE_STALE_BLOCKED';

export interface QuoteFreshness {
  latestQuoteDate: string;
  /** ISO date of the most recent Taiwan trading day at or before `now`. */
  expectedQuoteDate: string;
  marketCalendarStatus: MarketCalendarStatus;
  freshnessClassification: QuoteFreshnessLabel;
  /** ISO date of the next Taiwan trading day after `now`. */
  nextExpectedTradingDate: string;
  /** True when the quote is BEHIND the expected trading day AND its age exceeds 48 h.
   *  Always false when the market is closed (holiday/weekend) and the quote is current
   *  as of the most-recent trading day — even if calendar time exceeds 48 h. */
  isStale: boolean;
}

/**
 * Classifies the freshness of a stock quote against the Taiwan market calendar.
 *
 * @param latestQuoteDate ISO date of the latest persisted quote (e.g. "2026-04-30").
 * @param now             Reference timestamp (defaults to `new Date()`).
 */
export function classifyQuoteFreshness(
  latestQuoteDate: string,
  now: Date = new Date(),
): QuoteFreshness {
  const todayIso = toTaiwanDateIso(now);
  const isTodayTrading = isTaiwanTradingDay(now);
  const isTodayWeekend = isWeekend(todayIso);

  // Most recent trading day on or before today
  const expectedQuoteDate = getPreviousTaiwanTradingDay(now);
  const nextExpectedTradingDate = getNextTaiwanTradingDay(now);

  // Market status for today
  let marketCalendarStatus: MarketCalendarStatus;
  if (!isTodayTrading) {
    marketCalendarStatus = isTodayWeekend
      ? 'MARKET_CLOSED_WEEKEND'
      : 'MARKET_CLOSED_HOLIDAY';
  } else {
    marketCalendarStatus = 'MARKET_OPEN';
  }

  // Is the quote current relative to the last expected trading day?
  const isUpToDate = latestQuoteDate >= expectedQuoteDate;

  // Stale guard: compare against Taiwan EOD (16:00 +08:00) of latestQuoteDate.
  // A quote is only considered stale when it is BEHIND the expected trading day AND
  // has aged more than 48 h. If the market is closed (holiday/weekend) and the quote
  // matches the most-recent trading day, it is NOT stale — even if calendar time
  // exceeds 48 h — because no new data was expected.
  const latestQuoteEod = new Date(`${latestQuoteDate}T16:00:00+08:00`).getTime();
  const ageMs = now.getTime() - latestQuoteEod;
  const isStale = !isUpToDate && ageMs > 48 * 60 * 60 * 1000;

  let freshnessClassification: QuoteFreshnessLabel;
  if (isUpToDate) {
    freshnessClassification = !isTodayTrading
      ? 'QUOTE_EXPECTED_NEXT_TRADING_DAY'
      : 'QUOTE_CURRENT';
  } else if (isStale) {
    freshnessClassification = 'QUOTE_STALE_BLOCKED';
  } else {
    freshnessClassification = 'QUOTE_SYNC_DELAYED';
  }

  return {
    latestQuoteDate,
    expectedQuoteDate,
    marketCalendarStatus,
    freshnessClassification,
    nextExpectedTradingDate,
    isStale,
  };
}
