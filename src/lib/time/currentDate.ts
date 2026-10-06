/**
 * currentDate.ts — T-12b Dynamic Current Date Source
 *
 * Provides a unified, testable, injectable date source for the system.
 * Replaces all hardcoded DEFAULT_CURRENT_DATE = '2026-05-06' in runtime code.
 *
 * Rules:
 * - No external API calls
 * - No DB writes
 * - Pure and testable
 * - Supports Date injection
 * - Only returns YYYY-MM-DD format
 * - Invalid input falls back to system date (no throw)
 */

/**
 * Returns the current date in YYYY-MM-DD format using UTC.
 * Accepts an optional `now` Date for injection (useful in tests).
 */
export function getCurrentDateISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolves a date string to YYYY-MM-DD.
 *
 * - If `input` is a valid YYYY-MM-DD string, returns it as-is.
 * - Otherwise (null, undefined, empty, malformed), returns the current system date.
 *
 * Fallback is always to system date — never throws.
 */
export function resolveCurrentDate(input?: string | null): string {
  if (input && DATE_REGEX.test(input)) return input;
  return getCurrentDateISO();
}
