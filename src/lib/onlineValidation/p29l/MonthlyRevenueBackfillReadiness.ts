/**
 * P29L — MonthlyRevenueBackfillReadiness
 *
 * Pure TypeScript module for MonthlyRevenue historical NULL releaseDate
 * backfill readiness assessment and dry-run logic.
 *
 * No DB access in this module. No side effects. Deterministic.
 *
 * DISCLAIMER: Structural backfill readiness plan only.
 * Does not constitute investment advice.
 * No profit, return, or investment performance claims.
 * MonthlyRevenue entersAlphaScore = false. ALWAYS.
 * Results must not be used as buy/sell/hold signals.
 *
 * Classification: BACKFILL_SCRIPT_READY_NOT_APPLIED
 * - DB NOT modified in P29L session
 * - Script defaults to dryRun=true
 * - Source-present dry-run gate: requires non-null releaseDate
 */

export const MONTHLY_REVENUE_BACKFILL_VERSION = "p29l-monthly-revenue-backfill-v1";

export const MONTHLY_REVENUE_BACKFILL_DISCLAIMER =
  "Structural backfill readiness plan only. Does not constitute investment advice. " +
  "No profit, return, or investment performance claims. " +
  "MonthlyRevenue entersAlphaScore = false. " +
  "Results must not be used as buy/sell/hold signals.";

// ─── Classification types ────────────────────────────────────────────────────

export type BackfillClassification =
  | "BACKFILL_SCRIPT_READY_NOT_APPLIED"
  | "BACKFILL_APPLIED_DEV_ONLY"
  | "SOURCE_PRESENT_DRY_RUN_READY"
  | "BACKFILL_BLOCKED";

// ─── Row types ───────────────────────────────────────────────────────────────

export interface NullReleaseDateRow {
  stockId: string;
  year: number;
  month: number;
  /** releaseDate is null — needs backfill */
  releaseDate: null;
}

export interface BackfilledRow {
  stockId: string;
  year: number;
  month: number;
  /** Computed backfill releaseDate (UTC midnight on next-month-10th) */
  releaseDate: Date;
  /** ALWAYS INFERRED_NEXT_MONTH_10TH */
  releaseDateSource: "INFERRED_NEXT_MONTH_10TH";
  /** ALWAYS LOW — no explicit announcement date available */
  releaseDateConfidence: "LOW";
  /** ALWAYS false — never enters alphaScore */
  entersAlphaScore: false;
}

// ─── Dry-run result ──────────────────────────────────────────────────────────

export interface BackfillDryRunResult {
  /** ALWAYS true in P29L — no production apply */
  dryRun: true;
  /** Number of NULL releaseDate rows that WOULD be updated */
  affectedRows: number;
  /** Sample of computed rows (up to 5 for audit evidence) */
  sampleRows: BackfilledRow[];
  policy: "INFERRED_NEXT_MONTH_10TH";
  releaseDateConfidence: "LOW";
  classification: BackfillClassification;
  /** ALWAYS false — script never applies to production in P29L */
  productionApplied: false;
  /** ALWAYS false */
  entersAlphaScore: false;
  version: string;
  disclaimer: string;
}

// ─── Source-present dry-run readiness ────────────────────────────────────────

export interface SourcePresentDryRunReadiness {
  /** Whether MonthlyRevenue is ready for source-present dry-run */
  ready: boolean;
  /** Reason for readiness or blocking */
  reason: string;
  /** Requirements that must be satisfied */
  requirements: {
    releaseDateNonNull: boolean;
    releaseDateSourcePopulated: boolean;
    entersAlphaScoreequalsFalse: true;
    noFutureFields: boolean;
  };
  classification:
    | "MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN"
    | "MONTHLY_REVENUE_BLOCKED_NULL_RELEASE_DATE"
    | "MONTHLY_REVENUE_BLOCKED_FUTURE_FIELD";
  entersAlphaScore: false;
}

// ─── Core computation functions ───────────────────────────────────────────────

/**
 * Compute the backfill releaseDate for a MonthlyRevenue row.
 *
 * Policy: INFERRED_NEXT_MONTH_10TH (same as P29K MonthlyRevenueReleaseDatePolicy)
 * - releaseDate = next-month-10th at UTC midnight
 * - December wraps: month=12 → nextYear=year+1, nextMonth=1
 * - PIT-safe: always after last day of revenue month
 *
 * @throws {RangeError} if year < 2000 | > 2100 or month < 1 | > 12
 */
export function computeBackfillReleaseDate(year: number, month: number): Date {
  if (year < 2000 || year > 2100) {
    throw new RangeError(`computeBackfillReleaseDate: year ${year} out of range [2000, 2100]`);
  }
  if (month < 1 || month > 12) {
    throw new RangeError(`computeBackfillReleaseDate: month ${month} out of range [1, 12]`);
  }
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return new Date(Date.UTC(nextYear, nextMonth - 1, 10, 0, 0, 0, 0));
}

/**
 * Compute backfill rows for a list of null-releaseDate rows.
 * Returns BackfilledRow[] with computed releaseDate, source, confidence.
 * entersAlphaScore is always false.
 */
export function computeBackfillRows(nullRows: NullReleaseDateRow[]): BackfilledRow[] {
  return nullRows.map(row => {
    const releaseDate = computeBackfillReleaseDate(row.year, row.month);
    return {
      stockId: row.stockId,
      year: row.year,
      month: row.month,
      releaseDate,
      releaseDateSource: "INFERRED_NEXT_MONTH_10TH" as const,
      releaseDateConfidence: "LOW" as const,
      entersAlphaScore: false as const,
    };
  });
}

/**
 * Build a dry-run result from a list of null-releaseDate rows.
 * Never writes to DB.
 * productionApplied is always false.
 */
export function buildBackfillDryRunResult(nullRows: NullReleaseDateRow[]): BackfillDryRunResult {
  const backfilled = computeBackfillRows(nullRows);
  const sampleRows = backfilled.slice(0, 5);

  const classification: BackfillClassification = "BACKFILL_SCRIPT_READY_NOT_APPLIED";

  return {
    dryRun: true,
    affectedRows: backfilled.length,
    sampleRows,
    policy: "INFERRED_NEXT_MONTH_10TH",
    releaseDateConfidence: "LOW",
    classification,
    productionApplied: false,
    entersAlphaScore: false,
    version: MONTHLY_REVENUE_BACKFILL_VERSION,
    disclaimer: MONTHLY_REVENUE_BACKFILL_DISCLAIMER,
  };
}

/**
 * Check if a MonthlyRevenue row (post-backfill) is ready for source-present dry-run.
 *
 * Requirements:
 * 1. releaseDate is non-null
 * 2. releaseDateSource is populated
 * 3. entersAlphaScore = false (always)
 * 4. No future-looking fields (outcomePrice, returnPct, realizedReturnClass, futurePrice)
 */
export function checkSourcePresentDryRunReadiness(row: {
  releaseDate: Date | null;
  releaseDateSource: string | null;
  [key: string]: unknown;
}): SourcePresentDryRunReadiness {
  const FORBIDDEN_FUTURE_FIELDS = [
    'outcomePrice', 'returnPct', 'realizedReturnClass', 'futurePrice',
    'realizedReturn', 'forwardReturn', 'predictedPrice',
  ];

  const hasFutureField = FORBIDDEN_FUTURE_FIELDS.some(f => f in row && row[f] !== undefined);

  const releaseDateNonNull = row.releaseDate !== null && row.releaseDate !== undefined;
  const releaseDateSourcePopulated = !!row.releaseDateSource;
  const noFutureFields = !hasFutureField;

  if (!releaseDateNonNull) {
    return {
      ready: false,
      reason: "releaseDate is NULL — MonthlyRevenue row requires backfill before source-present dry-run gate",
      requirements: {
        releaseDateNonNull: false,
        releaseDateSourcePopulated,
        entersAlphaScoreequalsFalse: true,
        noFutureFields,
      },
      classification: "MONTHLY_REVENUE_BLOCKED_NULL_RELEASE_DATE",
      entersAlphaScore: false,
    };
  }

  if (hasFutureField) {
    return {
      ready: false,
      reason: `Future-looking field detected — cannot pass source-present dry-run gate`,
      requirements: {
        releaseDateNonNull: true,
        releaseDateSourcePopulated,
        entersAlphaScoreequalsFalse: true,
        noFutureFields: false,
      },
      classification: "MONTHLY_REVENUE_BLOCKED_FUTURE_FIELD",
      entersAlphaScore: false,
    };
  }

  return {
    ready: true,
    reason: "releaseDate is non-null and no future fields detected — ready for source-present dry-run",
    requirements: {
      releaseDateNonNull: true,
      releaseDateSourcePopulated,
      entersAlphaScoreequalsFalse: true,
      noFutureFields: true,
    },
    classification: "MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN",
    entersAlphaScore: false,
  };
}

/**
 * Format a backfill releaseDate as "YYYY-MM-DD" (UTC).
 */
export function formatBackfillReleaseDateUtc(d: Date): string {
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, '0');
  const D = String(d.getUTCDate()).padStart(2, '0');
  return `${Y}-${M}-${D}`;
}
