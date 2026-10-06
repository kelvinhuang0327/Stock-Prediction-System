/**
 * TwseTradingCalendar.ts — P1 Online Validation TWSE Trading Calendar
 *
 * Deterministic, testable, no-external-API TWSE trading calendar for
 * online validation and outcome write-back pipelines.
 *
 * SAFETY CONTRACT:
 * - research mode only — no DB write — no external API — no LLM
 * - no auto trading — no performance claim — no edge claim
 * - calendarVersion is always explicit in output
 * - Holiday list is an APPROXIMATION — see calendarVersion note below
 *
 * Not investment advice. Not a trading system.
 */

// ─── Constants ────────────────────────────────────────────────────

export const CALENDAR_VERSION = 'twse-static-2024-2026-v1';

/** ISO YYYY-MM-DD regex */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Max trading days to advance (safety guard against infinite loop) */
const MAX_ADVANCE_DAYS = 500;

// ─── Errors ───────────────────────────────────────────────────────

export class InvalidTwseDateError extends Error {
    constructor(input: unknown) {
        super(`TwseTradingCalendar: invalid date "${String(input)}". Expected YYYY-MM-DD.`);
        this.name = 'InvalidTwseDateError';
    }
}

export class InvalidHorizonError extends Error {
    constructor(horizonDays: number) {
        super(`TwseTradingCalendar: horizonDays must be > 0, got ${horizonDays}`);
        this.name = 'InvalidHorizonError';
    }
}

// ─── Known TWSE Holidays (static, deterministic) ─────────────────

/**
 * Static approximation of TWSE closure days 2024-2026.
 * Mark approximate with comment — production use requires official TWSE data.
 */
export const TWSE_STATIC_HOLIDAYS: readonly string[] = [
    // 2024
    '2024-01-01', // New Year's Day
    '2024-02-08', // Spring Festival Eve
    '2024-02-09', // Spring Festival Day 1
    '2024-02-10', // Spring Festival Day 2
    '2024-02-11', // Spring Festival Day 3
    '2024-02-12', // Spring Festival Day 4
    '2024-02-13', // Spring Festival Day 5
    '2024-02-14', // Spring Festival compensatory
    '2024-02-28', // Peace Memorial Day
    '2024-04-04', // Children's Day / Tomb Sweeping
    '2024-04-05', // Tomb Sweeping compensatory
    '2024-05-01', // Labor Day
    '2024-06-10', // Dragon Boat Festival
    '2024-09-17', // Mid-Autumn Festival
    '2024-10-10', // National Day
    '2024-12-25', // Note: TWSE may trade — placeholder only
    // 2025
    '2025-01-01', // New Year's Day
    '2025-01-27', // Spring Festival Eve
    '2025-01-28', // Spring Festival Day 1
    '2025-01-29', // Spring Festival Day 2
    '2025-01-30', // Spring Festival Day 3
    '2025-01-31', // Spring Festival Day 4
    '2025-02-04', // Spring Festival compensatory
    '2025-02-28', // Peace Memorial Day
    '2025-04-03', // Children's Day compensatory
    '2025-04-04', // Children's Day / Tomb Sweeping
    '2025-05-01', // Labor Day
    '2025-05-30', // Dragon Boat Festival eve compensatory
    '2025-05-31', // Dragon Boat Festival
    '2025-10-06', // National Day compensatory
    '2025-10-10', // National Day
    // 2026
    '2026-01-01', // New Year's Day
    '2026-02-17', // Spring Festival Eve — approximate
    '2026-02-18', // Spring Festival Day 1 — approximate
    '2026-02-19', // Spring Festival Day 2 — approximate
    '2026-02-20', // Spring Festival Day 3 — approximate
    '2026-02-23', // Spring Festival compensatory — approximate
    '2026-02-24', // Spring Festival compensatory — approximate
    '2026-02-28', // Peace Memorial Day
    '2026-04-03', // Children's Day compensatory — approximate
    '2026-04-04', // Children's Day / Tomb Sweeping — approximate
    '2026-05-01', // Labor Day
    '2026-06-19', // Dragon Boat Festival — approximate
    '2026-09-25', // Mid-Autumn Festival — approximate
    '2026-10-09', // National Day compensatory — approximate
];

const HOLIDAY_SET = new Set<string>(TWSE_STATIC_HOLIDAYS);

// ─── Helpers ──────────────────────────────────────────────────────

function assertIsoDate(input: string): void {
    if (!ISO_DATE_RE.test(input)) throw new InvalidTwseDateError(input);
}

/** Returns day-of-week: 0=Sun, 1=Mon, ..., 6=Sat */
function getDayOfWeek(date: string): number {
    // Use noon UTC to avoid DST edge cases
    return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Add calendar days to an ISO date string, returning a new ISO date string */
function addCalendarDays(date: string, days: number): string {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * isWeekend — true if date is Saturday or Sunday
 */
export function isWeekend(date: string): boolean {
    assertIsoDate(date);
    const dow = getDayOfWeek(date);
    return dow === 0 || dow === 6;
}

/**
 * isKnownTwseHoliday — true if date is in the static TWSE holiday list
 * calendarVersion = CALENDAR_VERSION (always explicit)
 */
export function isKnownTwseHoliday(date: string): boolean {
    assertIsoDate(date);
    return HOLIDAY_SET.has(date);
}

/**
 * isTwseTradingDay — true if date is neither weekend nor known holiday
 */
export function isTwseTradingDay(date: string): boolean {
    assertIsoDate(date);
    return !isWeekend(date) && !isKnownTwseHoliday(date);
}

/**
 * addTwseTradingDays — returns the date that is `tradingDays` TWSE trading
 * days AFTER startDate (startDate itself is NOT counted as day 1).
 *
 * Example: startDate='2026-05-11' (Monday), tradingDays=5
 *   → next 5 trading days: May 12, May 13, May 14, May 15, May 18
 *   → returns '2026-05-18'
 */
export function addTwseTradingDays(startDate: string, tradingDays: number): string {
    assertIsoDate(startDate);
    if (tradingDays <= 0) throw new InvalidHorizonError(tradingDays);

    let count = 0;
    let current = startDate;
    let safety = 0;

    while (count < tradingDays) {
        safety++;
        if (safety > MAX_ADVANCE_DAYS) {
            throw new Error(
                `TwseTradingCalendar: exceeded ${MAX_ADVANCE_DAYS} calendar days looking for ${tradingDays} trading days from ${startDate}`,
            );
        }
        current = addCalendarDays(current, 1);
        if (isTwseTradingDay(current)) count++;
    }

    return current;
}

// ─── Types ────────────────────────────────────────────────────────

export interface OutcomeTargetDate {
    horizonLabel: string;
    horizonDays: number;
    targetTradingDate: string;
}

export interface OutcomeTargetDatePlan {
    asOfDate: string;
    calendarVersion: string;
    targets: OutcomeTargetDate[];
    validationStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

/**
 * buildOutcomeTargetDatePlan — builds target trading date plan for given asOfDate.
 *
 * horizons: array of trading day counts (e.g. [5, 20])
 * All targetTradingDate values are guaranteed > asOfDate.
 */
export function buildOutcomeTargetDatePlan(
    asOfDate: string,
    horizons: number[],
): OutcomeTargetDatePlan {
    assertIsoDate(asOfDate);

    const messages: string[] = [];
    const targets: OutcomeTargetDate[] = [];

    for (const h of horizons) {
        if (h <= 0) {
            messages.push(`FAIL: horizonDays must be > 0, got ${h}`);
            continue;
        }
        const targetTradingDate = addTwseTradingDays(asOfDate, h);
        if (targetTradingDate <= asOfDate) {
            messages.push(`FAIL: targetTradingDate ${targetTradingDate} is not after asOfDate ${asOfDate}`);
        }
        const label = h === 5 ? '5D' : h === 20 ? '20D' : h === 60 ? '60D' : `${h}D`;
        targets.push({ horizonLabel: label, horizonDays: h, targetTradingDate });
    }

    const failCount = messages.filter(m => m.startsWith('FAIL')).length;
    return {
        asOfDate,
        calendarVersion: CALENDAR_VERSION,
        targets,
        validationStatus: failCount > 0 ? 'FAIL' : 'PASS',
        validationMessages: messages,
    };
}
