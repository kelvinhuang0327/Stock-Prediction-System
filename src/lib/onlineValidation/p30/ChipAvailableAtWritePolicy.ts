/**
 * P30 — ChipAvailableAtWritePolicy
 *
 * Pure TypeScript module for writing InstitutionalChip.availableAt values.
 * Provides policy-based computation, write-safety validation, and
 * alphaScore guard enforcement.
 *
 * No DB access. No side effects. Deterministic.
 *
 * DISCLAIMER: Structural write policy only. Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 * InstitutionalChip.entersAlphaScore = false (always).
 * Results must not be used as buy/sell/hold signals.
 */

import {
  computeChipAvailableAt,
  computeChipAvailableAtConservative,
  type ChipAvailableAtResult,
} from '../p29l/ChipAvailableAtMigrationReadiness';

// ─── Constants ────────────────────────────────────────────────────────────────

export const CHIP_AVAILABLE_AT_WRITE_POLICY_VERSION =
  "p30-chip-available-at-write-policy-v1";

export const CHIP_AVAILABLE_AT_WRITE_DISCLAIMER =
  "Structural write policy only. Does not constitute investment advice. " +
  "Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. " +
  "InstitutionalChip entersAlphaScore = false (always). " +
  "Results must not be used as investment recommendations or signals.";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChipAvailableAtPolicyMode = "PRIMARY" | "CONSERVATIVE";

export type ChipAvailableAtPolicySource =
  | "SOURCE_PAYLOAD"
  | "INFERRED_PRIMARY"
  | "INFERRED_CONSERVATIVE";

export interface ChipAvailableAtWriteResult {
  /** Computed or supplied availableAt value */
  availableAt: Date;
  /** ISO string of availableAt */
  availableAtIso: string;
  /** Policy mode used (only relevant if not SOURCE_PAYLOAD) */
  policy: "INFERRED_SAME_DAY_T86_0930_UTC" | "INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE";
  /** How availableAt was determined */
  policySource: ChipAvailableAtPolicySource;
  /** ALWAYS false — chip data never enters alphaScore */
  entersAlphaScore: false;
  /** Version of the write policy */
  version: string;
  /** Disclaimer text */
  disclaimer: string;
}

export interface ChipNumericSnapshot {
  foreignBuy: number;
  trustBuy: number;
  dealerBuy: number;
  totalBuy: number;
}

// ─── Core computation functions ───────────────────────────────────────────────

/**
 * Compute availableAt for a chip trade date using the specified policy mode.
 *
 * PRIMARY: INFERRED_SAME_DAY_T86_0930_UTC — same-day 09:30 UTC = 17:30 TWN
 * CONSERVATIVE: INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE — next-day 09:30 UTC
 *
 * @param isoDate - ISO date string e.g. "2026-05-20"
 * @param mode - "PRIMARY" (default) or "CONSERVATIVE"
 */
export function computeChipWriteAvailableAt(
  isoDate: string,
  mode: ChipAvailableAtPolicyMode = "PRIMARY"
): ChipAvailableAtWriteResult {
  let result: ChipAvailableAtResult;
  let policySource: ChipAvailableAtPolicySource;

  if (mode === "CONSERVATIVE") {
    result = computeChipAvailableAtConservative(isoDate);
    policySource = "INFERRED_CONSERVATIVE";
  } else {
    result = computeChipAvailableAt(isoDate);
    policySource = "INFERRED_PRIMARY";
  }

  return {
    availableAt: result.availableAt,
    availableAtIso: result.availableAtIso,
    policy: result.policy,
    policySource,
    entersAlphaScore: false,
    version: CHIP_AVAILABLE_AT_WRITE_POLICY_VERSION,
    disclaimer: CHIP_AVAILABLE_AT_WRITE_DISCLAIMER,
  };
}

/**
 * Build the availableAt value for a chip upsert operation.
 *
 * If the source payload provides an explicit availableAt, it is used directly.
 * Otherwise, the primary policy (INFERRED_SAME_DAY_T86_0930_UTC) is used.
 *
 * @param isoDate - ISO date string of the chip trading day e.g. "2026-05-20"
 * @param sourcePayloadAvailableAt - Optional availableAt from the data source.
 *   If provided and valid, takes precedence over inferred policy.
 */
export function buildChipUpsertAvailableAt(
  isoDate: string,
  sourcePayloadAvailableAt?: Date
): ChipAvailableAtWriteResult {
  if (sourcePayloadAvailableAt instanceof Date && !isNaN(sourcePayloadAvailableAt.getTime())) {
    return {
      availableAt: sourcePayloadAvailableAt,
      availableAtIso: sourcePayloadAvailableAt.toISOString(),
      policy: "INFERRED_SAME_DAY_T86_0930_UTC", // nominal — actual value is from source
      policySource: "SOURCE_PAYLOAD",
      entersAlphaScore: false,
      version: CHIP_AVAILABLE_AT_WRITE_POLICY_VERSION,
      disclaimer: CHIP_AVAILABLE_AT_WRITE_DISCLAIMER,
    };
  }

  return computeChipWriteAvailableAt(isoDate, "PRIMARY");
}

// ─── Write safety validators ──────────────────────────────────────────────────

/**
 * Validate that a chip upsert does NOT alter numeric values.
 *
 * A write is safe if all four numeric fields (foreignBuy, trustBuy,
 * dealerBuy, totalBuy) remain unchanged. The availableAt field is
 * metadata-only and its addition/update is always permitted.
 *
 * Returns true if numeric values are unchanged (safe write).
 * Returns false if any numeric value changed (unsafe — would alter chip signal).
 *
 * @param original - Original numeric values from DB
 * @param updated - Proposed numeric values to write
 */
export function validateWriteDoesNotAlterChipNumerics(
  original: ChipNumericSnapshot,
  updated: ChipNumericSnapshot
): boolean {
  return (
    original.foreignBuy === updated.foreignBuy &&
    original.trustBuy === updated.trustBuy &&
    original.dealerBuy === updated.dealerBuy &&
    original.totalBuy === updated.totalBuy
  );
}

/**
 * Assert that entersAlphaScore is false.
 * Throws if entersAlphaScore is not exactly false.
 *
 * This is a runtime guard to ensure the chip write policy invariant
 * is never violated: InstitutionalChip.entersAlphaScore = false always.
 *
 * @throws {Error} if result.entersAlphaScore !== false
 */
export function assertEntersAlphaScoreFalse(
  result: { entersAlphaScore: unknown }
): void {
  if (result.entersAlphaScore !== false) {
    throw new Error(
      `[ChipAvailableAtWritePolicy] Invariant violation: entersAlphaScore must be false. ` +
      `Got: ${JSON.stringify(result.entersAlphaScore)}. ` +
      `InstitutionalChip data must never enter alphaScore computation.`
    );
  }
}
