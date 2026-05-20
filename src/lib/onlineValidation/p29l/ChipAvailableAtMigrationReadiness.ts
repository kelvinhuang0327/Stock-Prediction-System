/**
 * P29L — ChipAvailableAtMigrationReadiness
 *
 * Pure TypeScript module for Chip availableAt migration readiness assessment.
 * No external imports. No DB access. No side effects. Deterministic.
 *
 * DISCLAIMER: Structural migration readiness plan only.
 * Does not constitute investment advice.
 * No profit, return, or investment performance claims.
 * InstitutionalChip entersAlphaScore = false.
 * Results must not be used as buy/sell/hold signals.
 *
 * Classification: CHIP_AVAILABLE_AT_MIGRATION_PLAN_READY
 * - Schema NOT modified in P29L session (Option A: dev-safe)
 * - prisma migrate dev NOT run in P29L session
 * - CHIP_LAG_CONFIRMED cannot be claimed without:
 *   (1) schema migration executed
 *   (2) availableAt populated in DB
 *   (3) production logs confirming actual data arrival times
 */

export const CHIP_AVAILABLE_AT_MIGRATION_VERSION = "p29l-chip-available-at-migration-v1";

export const CHIP_AVAILABLE_AT_MIGRATION_DISCLAIMER =
  "Structural migration readiness plan only. Does not constitute investment advice. " +
  "No profit, return, or investment performance claims. " +
  "InstitutionalChip entersAlphaScore = false. " +
  "Results must not be used as buy/sell/hold signals.";

// ─── Classification types ────────────────────────────────────────────────────

export type ChipAvailableAtMigrationClassification =
  | "CHIP_AVAILABLE_AT_MIGRATION_PLAN_READY"
  | "CHIP_AVAILABLE_AT_SCHEMA_READY_NOT_PROD_VALIDATED"
  | "CHIP_AVAILABLE_AT_BLOCKED_NEEDS_SCHEMA_OWNER";

export type ChipAvailableAtPolicy =
  | "INFERRED_SAME_DAY_T86_0930_UTC"
  | "INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE";

// ─── Result types ────────────────────────────────────────────────────────────

export interface ChipAvailableAtResult {
  /** ISO date string of the chip trading day e.g. "2026-05-20" */
  chipDate: string;
  /** UTC time when T86 data becomes publicly available */
  availableAt: Date;
  /** ISO string of availableAt */
  availableAtIso: string;
  /** Policy used to compute availableAt */
  policy: ChipAvailableAtPolicy;
  /** ALWAYS false — chip metadata never enters alphaScore */
  entersAlphaScore: false;
}

export interface ChipMigrationStep {
  step: number;
  action: string;
  note?: string;
}

export interface ChipMigrationReadinessReport {
  version: string;
  capturedAt: string;
  disclaimer: string;
  classification: "CHIP_AVAILABLE_AT_MIGRATION_PLAN_READY";
  schemaModel: "InstitutionalChip";
  /** InstitutionalChip has no availableAt field — migration needed */
  hasAvailableAt: false;
  hasReleaseDate: false;
  migrationNeeded: true;
  /** P29J classification maintained — lag still WARN until prod logs available */
  lagWarningMaintained: true;
  /** Production logs required before upgrading to CHIP_LAG_CONFIRMED */
  prodLogsRequired: true;
  /** Cannot claim CHIP_LAG_CONFIRMED without schema + data + prod logs */
  canClaimChipLagConfirmed: false;
  /** Option A selected — schema NOT modified in P29L session */
  schemaModifiedInSession: false;
  primaryPolicy: "INFERRED_SAME_DAY_T86_0930_UTC";
  conservativePolicy: "INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE";
  cronScheduleUtc: "0 7 * * 1-5";
  cronScheduleTwn: "15:00 TWN";
  t86AvailabilityTwn: "~17:30 TWN";
  timingGapMinutes: 150;
  effectiveChipDate: "T-1";
  migrationSteps: ChipMigrationStep[];
  entersAlphaScore: false;
}

// ─── Core computation functions ───────────────────────────────────────────────

/**
 * Compute availableAt for a chip trading date using the primary policy.
 *
 * Policy: INFERRED_SAME_DAY_T86_0930_UTC
 * - TWSE T86 data is published ~17:30 TWN = 09:30 UTC on the SAME trading day
 * - availableAt = chipDate at 09:30:00.000 UTC
 *
 * @param dateString - ISO date string e.g. "2026-05-20"
 * @throws {RangeError} if dateString is not a valid YYYY-MM-DD format
 */
export function computeChipAvailableAt(dateString: string): ChipAvailableAtResult {
  const parts = dateString.split('-');
  if (parts.length !== 3) {
    throw new RangeError(`computeChipAvailableAt: invalid dateString "${dateString}" — expected YYYY-MM-DD`);
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (
    isNaN(year) || isNaN(month) || isNaN(day) ||
    year < 2000 || year > 2100 ||
    month < 1 || month > 12 ||
    day < 1 || day > 31
  ) {
    throw new RangeError(`computeChipAvailableAt: out-of-range dateString "${dateString}"`);
  }

  // Same-day 09:30 UTC = 17:30 TWN (UTC+8)
  const availableAt = new Date(Date.UTC(year, month - 1, day, 9, 30, 0, 0));
  return {
    chipDate: dateString,
    availableAt,
    availableAtIso: availableAt.toISOString(),
    policy: "INFERRED_SAME_DAY_T86_0930_UTC",
    entersAlphaScore: false,
  };
}

/**
 * Compute availableAt using the conservative policy (for historical backfill).
 *
 * Policy: INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE
 * - availableAt = chipDate + 1 calendar day at 09:30 UTC
 * - More conservative than primary policy — used for backfilling existing rows
 *   when actual availability time is unknown
 *
 * @param dateString - ISO date string e.g. "2026-05-20"
 * @throws {RangeError} if dateString is not a valid YYYY-MM-DD format
 */
export function computeChipAvailableAtConservative(dateString: string): ChipAvailableAtResult {
  const primary = computeChipAvailableAt(dateString);
  // Add 1 day: next-day 09:30 UTC
  const nextDay = new Date(primary.availableAt);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return {
    chipDate: dateString,
    availableAt: nextDay,
    availableAtIso: nextDay.toISOString(),
    policy: "INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE",
    entersAlphaScore: false,
  };
}

/**
 * Format a chip availableAt Date as "YYYY-MM-DDTHH:MM:SSZ" for display.
 */
export function formatChipAvailableAtUtc(d: Date): string {
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, '0');
  const D = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D}T${h}:${m}:00Z`;
}

/**
 * Validate that availableAt is AFTER the chip date (PIT-safe check).
 * availableAt must be >= chipDate 00:00:00 UTC.
 *
 * Primary policy: availableAt is same-day 09:30 UTC → always after 00:00 UTC
 * Conservative policy: availableAt is next-day 09:30 UTC → always after chipDate
 */
export function validateChipAvailableAtIsPitSafe(
  dateString: string,
  availableAtIso: string
): { safe: boolean; reason: string } {
  const [y, mo, d] = dateString.split('-').map(Number);
  // chip date at midnight UTC
  const chipMidnight = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  const avAt = new Date(availableAtIso);

  if (avAt <= chipMidnight) {
    return {
      safe: false,
      reason: `availableAt (${availableAtIso}) is not after chip date midnight (${chipMidnight.toISOString()})`,
    };
  }
  return { safe: true, reason: 'availableAt is after chip date midnight — PIT-safe' };
}

// ─── Migration readiness report ───────────────────────────────────────────────

const MIGRATION_STEPS: ChipMigrationStep[] = [
  {
    step: 1,
    action: "Add `availableAt DateTime?` to InstitutionalChip in prisma/schema.prisma",
    note: "Additive nullable field — no breaking changes to existing rows",
  },
  {
    step: 2,
    action: "Run `npx prisma migrate dev --name add_chip_available_at`",
    note: "Creates migration file; applies to dev DB only. Production DB requires separate apply step.",
  },
  {
    step: 3,
    action: "Update syncInstitutionalChip() to set availableAt = computeChipAvailableAt(isoDate)",
    note: "Use INFERRED_SAME_DAY_T86_0930_UTC policy — isoDate at 09:30 UTC = 17:30 TWN",
  },
  {
    step: 4,
    action: "Backfill existing rows: availableAt = computeChipAvailableAtConservative(date) for rows where availableAt IS NULL",
    note: "Use INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE for backfill (extra conservative). Script: scripts/p29l_chip_available_at_backfill.ts",
  },
  {
    step: 5,
    action: "Update ChipLagEvidenceAudit (P29J) to reclassify CHIP_LAG_WARN_ASSUMPTION_REQUIRED → CHIP_LAG_CONFIRMED",
    note: "Only after steps 1-4 complete AND production logs confirm actual data arrival times match policy",
  },
];

/**
 * Build the migration readiness report.
 * Returns a fully deterministic, serializable object.
 * capturedAt is fixed for test stability.
 */
export function buildChipMigrationReadinessReport(): ChipMigrationReadinessReport {
  return {
    version: CHIP_AVAILABLE_AT_MIGRATION_VERSION,
    capturedAt: "2026-05-20T00:00:00.000Z",
    disclaimer: CHIP_AVAILABLE_AT_MIGRATION_DISCLAIMER,
    classification: "CHIP_AVAILABLE_AT_MIGRATION_PLAN_READY",
    schemaModel: "InstitutionalChip",
    hasAvailableAt: false,
    hasReleaseDate: false,
    migrationNeeded: true,
    lagWarningMaintained: true,
    prodLogsRequired: true,
    canClaimChipLagConfirmed: false,
    schemaModifiedInSession: false,
    primaryPolicy: "INFERRED_SAME_DAY_T86_0930_UTC",
    conservativePolicy: "INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE",
    cronScheduleUtc: "0 7 * * 1-5",
    cronScheduleTwn: "15:00 TWN",
    t86AvailabilityTwn: "~17:30 TWN",
    timingGapMinutes: 150,
    effectiveChipDate: "T-1",
    migrationSteps: MIGRATION_STEPS,
    entersAlphaScore: false,
  };
}
