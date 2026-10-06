/**
 * P29K: MonthlyRevenue Release Date Policy
 *
 * DISCLAIMER: Structural sync policy only. Does not constitute investment advice.
 * No guaranteed profit, guaranteed return, risk-free claims.
 * MonthlyRevenue NEVER enters alphaScore or recommendationBucket.
 * Results must not be used as buy/sell/hold signals.
 *
 * Purpose: Deterministic release date computation for MonthlyRevenue sync upserts.
 * Since TWSE getMonthlyRevenueSummary() does not return an explicit releaseDate or
 * announcementDate, this module provides the conservative INFERRED_NEXT_MONTH_10TH
 * policy based on Taiwan's statutory disclosure deadline.
 */

// ─── Version ─────────────────────────────────────────────────────────────────

export const MONTHLY_REVENUE_RELEASE_DATE_POLICY_VERSION =
  "p29k-release-date-policy-v1";

export const MONTHLY_REVENUE_RELEASE_DATE_POLICY_DISCLAIMER =
  "Structural sync policy only. Does not constitute investment advice. " +
  "No profit, return, or investment performance claims. " +
  "MonthlyRevenue entersAlphaScore = false. " +
  "Results must not be used as buy/sell/hold signals.";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReleaseDatePolicy = "INFERRED_NEXT_MONTH_10TH";
export type ReleaseDateSource = "INFERRED_NEXT_MONTH_10TH";
export type ReleaseDateConfidence = "LOW";

/**
 * The release date fields written to MonthlyRevenue on every sync upsert.
 * All three fields are always populated together.
 */
export interface MonthlyRevenueReleaseDatePayload {
  /** UTC midnight on the 10th of the month following revenue month */
  releaseDate: Date;
  /** Always "INFERRED_NEXT_MONTH_10TH" — TWSE never provides an explicit date */
  releaseDateSource: ReleaseDateSource;
  /** Always "LOW" — inferred, not confirmed by upstream data */
  releaseDateConfidence: ReleaseDateConfidence;
  policy: ReleaseDatePolicy;
  computedFrom: { year: number; month: number };
  /** Always false. MonthlyRevenue is read-only metadata, never used in scoring. */
  entersAlphaScore: false;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

/**
 * Compute the inferred release date for a revenue year/month.
 *
 * Taiwan statutory rule: monthly revenue must be publicly released by the
 * 10th of the following calendar month.
 *
 * Returns UTC midnight (00:00:00.000Z) on that date.
 * This is always AFTER the last day of the revenue month — PIT-safe.
 */
export function computeInferredReleaseDate(year: number, month: number): Date {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(Date.UTC(nextYear, nextMonth - 1, 10, 0, 0, 0, 0));
}

/**
 * Build the full release date payload for a MonthlyRevenue sync upsert.
 *
 * Throws RangeError if year or month is outside valid bounds.
 * Pure — no database access, no side effects, deterministic.
 */
export function buildMonthlyRevenueReleaseDatePayload(
  year: number,
  month: number
): MonthlyRevenueReleaseDatePayload {
  if (year < 2000 || year > 2100) {
    throw new RangeError(
      `Invalid year=${year} for MonthlyRevenue release date policy. Expected 2000–2100.`
    );
  }
  if (month < 1 || month > 12) {
    throw new RangeError(
      `Invalid month=${month} for MonthlyRevenue release date policy. Expected 1–12.`
    );
  }
  return {
    releaseDate: computeInferredReleaseDate(year, month),
    releaseDateSource: "INFERRED_NEXT_MONTH_10TH",
    releaseDateConfidence: "LOW",
    policy: "INFERRED_NEXT_MONTH_10TH",
    computedFrom: { year, month },
    entersAlphaScore: false,
  };
}

// ─── PIT safety validation ────────────────────────────────────────────────────

/**
 * Validate that the release date is strictly after the last day of the revenue month.
 * This is required for PIT (point-in-time) safety: you cannot see revenue data
 * before the revenue period has ended.
 *
 * @param year  Revenue year
 * @param month Revenue month
 * @param releaseDateIso Release date as YYYY-MM-DD string
 */
export function validateReleaseDateIsPitSafe(
  year: number,
  month: number,
  releaseDateIso: string
): { safe: boolean; reason: string } {
  // Last day of the revenue month: day 0 of the next month
  const lastDayOfRevenueMonth = new Date(Date.UTC(year, month, 0));
  const releaseDate = new Date(releaseDateIso + "T00:00:00.000Z");
  if (releaseDate > lastDayOfRevenueMonth) {
    return {
      safe: true,
      reason:
        `releaseDate ${releaseDateIso} is after last day of revenue month ` +
        `${year}-${String(month).padStart(2, "0")} — PIT-safe`,
    };
  }
  return {
    safe: false,
    reason:
      `releaseDate ${releaseDateIso} is NOT after last day of revenue month ` +
      `${year}-${String(month).padStart(2, "0")} — PIT violation`,
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/**
 * Format a Date as YYYY-MM-DD using UTC date parts (no timezone shift).
 */
export function formatReleaseDateUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
