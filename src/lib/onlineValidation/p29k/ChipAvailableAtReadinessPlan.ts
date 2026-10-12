/**
 * P29K: Chip availableAt Readiness Plan
 *
 * DISCLAIMER: Structural audit-only. Does not constitute investment advice.
 * No guaranteed profit, guaranteed return, risk-free claims.
 * Results must not be used as buy/sell/hold signals.
 *
 * Purpose: Assess whether InstitutionalChip has an `availableAt` field,
 * and produce a migration plan if it does not.
 *
 * Finding: InstitutionalChip schema has no `availableAt` or `releaseDate` field.
 * Classification: CHIP_AVAILABLE_AT_NEEDS_MIGRATION_PLAN
 * Migration deferred to P29L to avoid P29K scope creep.
 */

// ─── Version ─────────────────────────────────────────────────────────────────

export const CHIP_AVAILABLE_AT_READINESS_VERSION =
  "p29k-chip-available-at-readiness-v1";

export const CHIP_AVAILABLE_AT_DISCLAIMER =
  "Structural audit-only. Does not constitute investment advice. " +
  "No profit, return, or investment performance claims. " +
  "Results must not be used as buy/sell/hold signals.";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChipAvailableAtClassification =
  | "CHIP_AVAILABLE_AT_FIELD_PRESENT"
  | "CHIP_AVAILABLE_AT_NEEDS_MIGRATION_PLAN";

export interface ChipAvailableAtMigrationStep {
  step: number;
  description: string;
}

export interface ChipAvailableAtMigrationPlan {
  steps: ChipAvailableAtMigrationStep[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  deferralReason: string;
  targetPhase: string;
}

export interface ChipAvailableAtFieldAudit {
  schemaModel: "InstitutionalChip";
  existingFields: string[];
  hasAvailableAt: false;
  hasReleaseDate: false;
  migrationNeeded: true;
  migrationPlan: ChipAvailableAtMigrationPlan;
}

export interface ChipAvailableAtReadinessReport {
  version: string;
  disclaimer: string;
  capturedAt: string;
  classification: ChipAvailableAtClassification;
  fieldAudit: ChipAvailableAtFieldAudit;
  cronSchedule: string;
  t86AvailabilityTwn: string;
  effectiveChipDate: string;
  timingGapNote: string;
  /** Always false — chip data is structural metadata only, never enters scoring */
  entersAlphaScore: false;
}

// ─── Report builder ───────────────────────────────────────────────────────────

/**
 * Build the chip availableAt readiness report.
 * Pure / deterministic — no database access, no side effects.
 */
export function buildChipAvailableAtReadinessReport(): ChipAvailableAtReadinessReport {
  return {
    version: CHIP_AVAILABLE_AT_READINESS_VERSION,
    disclaimer: CHIP_AVAILABLE_AT_DISCLAIMER,
    capturedAt: "2026-05-20T00:00:00.000Z",
    classification: "CHIP_AVAILABLE_AT_NEEDS_MIGRATION_PLAN",
    fieldAudit: {
      schemaModel: "InstitutionalChip",
      existingFields: [
        "id",
        "stockId",
        "date",
        "foreignBuy",
        "trustBuy",
        "dealerBuy",
        "totalBuy",
        "holders400",
        "holders1000",
        "createdAt",
      ],
      hasAvailableAt: false,
      hasReleaseDate: false,
      migrationNeeded: true,
      migrationPlan: {
        steps: [
          {
            step: 1,
            description:
              "Add `availableAt DateTime?` field to InstitutionalChip in prisma/schema.prisma",
          },
          {
            step: 2,
            description:
              "Run `npx prisma migrate dev --name add_chip_available_at` to create and apply migration",
          },
          {
            step: 3,
            description:
              "Update syncInstitutionalChip() to populate availableAt = T86 availability datetime (~17:30 TWN = 09:30 UTC) for each chip date",
          },
          {
            step: 4,
            description:
              "Backfill existing rows: set availableAt = date + 1 day at 09:30 UTC as conservative T-1 assumption for historical data",
          },
          {
            step: 5,
            description:
              "Update ChipLagEvidenceAudit (P29J) to read availableAt and reclassify: CHIP_LAG_WARN_ASSUMPTION_REQUIRED → CHIP_LAG_CONFIRMED when availableAt evidence is present",
          },
        ],
        riskLevel: "LOW",
        deferralReason:
          "Adding availableAt requires a Prisma DB migration, backfill script, and updates to ChipLagEvidenceAudit. Scope is well-bounded but exceeds P29K's primary goal of MonthlyRevenue releaseDate repair. Deferred to P29L to keep P29K focused.",
        targetPhase: "P29L",
      },
    },
    cronSchedule: "0 7 * * 1-5 (UTC) = 15:00 TWN",
    t86AvailabilityTwn: "~17:30 TWN",
    effectiveChipDate: "T-1 (previous trading day)",
    timingGapNote:
      "Daily sync cron fires at 15:00 TWN. T86 (institutional chip) data is available ~17:30 TWN. " +
      "2.5-hour gap means current-day chip data is unavailable at sync time → effective chip = T-1. " +
      "Without an availableAt field in the schema, this timing constraint cannot be enforced at runtime. " +
      "Migration plan deferred to P29L.",
    entersAlphaScore: false,
  };
}
