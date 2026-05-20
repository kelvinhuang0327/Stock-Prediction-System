/**
 * P29G: Paper Simulation Dry-Run Input Contract
 * paper-only / simulation-only / NOT investment recommendation
 *
 * This module defines the INPUT contract for P29G dry-run simulation runs.
 * It extends and tightens the P29E scaffold contract by:
 *   - Requiring explicit source-status classification per input dimension
 *   - Enforcing paperOnly=true and dryRun=true at the type level
 *   - Classifying every source feature with its current governance status
 *
 * What this module DOES NOT allow:
 *   - buy / sell / hold / action / stake / recommendation fields
 *   - FinancialReport / NewsEvent classified as PIT_SAFE_VERIFIED
 *   - Any source classified as BLOCKED to enter simulation
 */

import { SourceFeaturePitStatus } from "../p29e/PaperSimulationOutputSchema";

// ---------------------------------------------------------------------------
// Source status types
// ---------------------------------------------------------------------------

/**
 * Governance status for each data source entering the dry-run pipeline.
 *
 * PIT_SAFE_VERIFIED        — Source passed PIT audit (Quote, Regime, Chip after P29F-Repair)
 * HIGH_RISK_SOURCE_ABSENT  — Source is absent / not ingested (FinancialReport, NewsEvent)
 * STRUCTURAL_PLACEHOLDER_ONLY — Source is present as a structural schema only, no real data
 * BLOCKED                  — Source explicitly blocked by governance policy
 */
export type DryRunSourceStatus =
  | "PIT_SAFE_VERIFIED"
  | "HIGH_RISK_SOURCE_ABSENT"
  | "STRUCTURAL_PLACEHOLDER_ONLY"
  | "BLOCKED";

/**
 * Per-source governance classification for a dry-run input.
 */
export interface DryRunSourceClassification {
  sourceName: string;
  status: DryRunSourceStatus;
  /** If BLOCKED or HIGH_RISK_SOURCE_ABSENT, reason must be provided. */
  reason?: string;
  /** Whether this source is permitted to influence alphaScore. */
  entersAlphaScore: boolean;
}

// ---------------------------------------------------------------------------
// Forbidden action fields
// ---------------------------------------------------------------------------

/**
 * Fields that MUST NOT appear in any dry-run input or output.
 * Their presence indicates scope boundary violation.
 */
export const FORBIDDEN_ACTION_FIELDS = [
  "buy",
  "sell",
  "hold",
  "action",
  "stake",
  "position",
  "allocation",
  "order",
  "trade",
  "recommendation",
  "investmentAdvice",
] as const;

export type ForbiddenActionField = (typeof FORBIDDEN_ACTION_FIELDS)[number];

// ---------------------------------------------------------------------------
// Dry-run input config
// ---------------------------------------------------------------------------

/**
 * P29G dry-run input configuration.
 *
 * The caller MUST explicitly set paperOnly=true and dryRun=true.
 * The runner will reject any config where these are false.
 */
export interface DryRunInputConfig {
  /** Simulation date (YYYY-MM-DD). Must be in the past. */
  asOfDate: string;

  /** Strategy candidate identifier. */
  candidateId: string;

  /**
   * MUST be true. Explicitly marks this as a paper-only run.
   * The runner will throw if this is not true.
   */
  paperOnly: true;

  /**
   * MUST be true. Enforces dry-run execution mode.
   * The runner will throw if this is not true.
   */
  dryRun: true;

  /**
   * MUST be true. Mandatory disclaimer marker.
   * The runner will throw if this is not true.
   */
  notInvestmentRecommendation: true;

  /** Feature set snapshot label. */
  featureSetLabel?: string;

  /** Optional deterministic seed for reproducibility. */
  seed?: string;

  /**
   * Per-source governance classification.
   * Caller must provide classifications for all sources included in the run.
   * Sources with status BLOCKED must not enter the simulation.
   */
  sourceClassifications?: DryRunSourceClassification[];

  /**
   * Observability metadata — recorded in output but not used in scoring.
   */
  metadata?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Built-in source classification constants
// ---------------------------------------------------------------------------

/**
 * Canonical source classifications as of P29G.
 * These reflect the governance state after P29F-Repair.
 */
export const P29G_SOURCE_CLASSIFICATIONS: DryRunSourceClassification[] = [
  {
    sourceName: "Quote",
    status: "PIT_SAFE_VERIFIED",
    entersAlphaScore: false, // structural placeholder only — alphaScore gating is separate
    reason:
      "Quote PIT audit completed in P29F-Repair. PIT_SAFE_VERIFIED for scaffold representation only.",
  },
  {
    sourceName: "Regime",
    status: "PIT_SAFE_VERIFIED",
    entersAlphaScore: false,
    reason:
      "Regime PIT audit completed in P29F-Repair. PIT_SAFE_VERIFIED for scaffold representation only.",
  },
  {
    sourceName: "Chip",
    status: "PIT_SAFE_VERIFIED",
    entersAlphaScore: false,
    reason:
      "Chip PIT audit completed in P29F-Repair. PIT_SAFE_VERIFIED for scaffold representation only.",
  },
  {
    sourceName: "MonthlyRevenue",
    status: "STRUCTURAL_PLACEHOLDER_ONLY",
    entersAlphaScore: false,
    reason: "MonthlyRevenue awaiting operator source arrival (P26F4). REPAIRED_BUT_SOURCE_GATED.",
  },
  {
    sourceName: "FinancialReport",
    status: "HIGH_RISK_SOURCE_ABSENT",
    entersAlphaScore: false,
    reason:
      "FinancialReport source is absent. Source-gated per P29B. filingDate PIT path unverified. MUST NOT enter alphaScore.",
  },
  {
    sourceName: "NewsEvent",
    status: "HIGH_RISK_SOURCE_ABSENT",
    entersAlphaScore: false,
    reason:
      "NewsEvent source is absent. Source-gated per P29B. publishedAt vs ingestedAt PIT separation unverified. MUST NOT enter alphaScore.",
  },
];

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/**
 * Validate a DryRunInputConfig before passing to the runner.
 *
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validateDryRunInputConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof config !== "object" || config === null) {
    return { valid: false, errors: ["config must be a non-null object"] };
  }

  const c = config as Record<string, unknown>;

  if (typeof c["asOfDate"] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(c["asOfDate"] as string)) {
    errors.push("asOfDate must be a string in YYYY-MM-DD format");
  }

  if (typeof c["candidateId"] !== "string" || (c["candidateId"] as string).length === 0) {
    errors.push("candidateId must be a non-empty string");
  }

  if (c["paperOnly"] !== true) {
    errors.push("paperOnly must be true — paper-only mode is mandatory");
  }

  if (c["dryRun"] !== true) {
    errors.push("dryRun must be true — dry-run mode is mandatory");
  }

  if (c["notInvestmentRecommendation"] !== true) {
    errors.push("notInvestmentRecommendation must be true — mandatory disclaimer");
  }

  // Check for forbidden action fields
  for (const field of FORBIDDEN_ACTION_FIELDS) {
    if (field in c) {
      errors.push(`forbidden action field present in input: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get the combined (canonical + caller-supplied) source classifications.
 * Caller-supplied entries override canonical defaults by sourceName.
 */
export function resolveSourceClassifications(
  callerClassifications?: DryRunSourceClassification[]
): DryRunSourceClassification[] {
  if (!callerClassifications || callerClassifications.length === 0) {
    return P29G_SOURCE_CLASSIFICATIONS;
  }

  const merged = new Map<string, DryRunSourceClassification>();
  for (const c of P29G_SOURCE_CLASSIFICATIONS) {
    merged.set(c.sourceName, c);
  }
  for (const c of callerClassifications) {
    merged.set(c.sourceName, c);
  }
  return Array.from(merged.values());
}

/**
 * Check if any source classified as HIGH_RISK_SOURCE_ABSENT or BLOCKED
 * is attempting to enter alphaScore. Returns violations list.
 */
export function checkAlphaScoreGating(
  classifications: DryRunSourceClassification[]
): string[] {
  const violations: string[] = [];
  for (const sc of classifications) {
    if (
      (sc.status === "HIGH_RISK_SOURCE_ABSENT" || sc.status === "BLOCKED") &&
      sc.entersAlphaScore
    ) {
      violations.push(
        `source '${sc.sourceName}' has status '${sc.status}' but entersAlphaScore=true — BOUNDARY VIOLATION`
      );
    }
  }
  return violations;
}
