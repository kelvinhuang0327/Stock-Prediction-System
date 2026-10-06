/**
 * P54 — Axis B Simulation Input Eligibility Diff Report Builder
 *
 * Wraps a P53 SimulationInputEligibilityDiffReport into a human-readable,
 * JSON-safe audit artifact (EligibilityDiffAuditArtifact).
 *
 * This is the Axis B equivalent of a serializer/report-envelope layer.
 * It accepts the structured diff output from P53 and produces a compact,
 * governance-tagged artifact suitable for audit, logging, or UI display.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem writes
 *   - Deterministic when fixedGeneratedAt is provided
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - No scoring, no recommendation, no investment advice, no forbidden fields
 *   - Does not mutate the input diff report
 *   - Source name arrays preserve the order of their corresponding diff arrays
 *
 * This is NOT simulation execution.
 * This is NOT a backtest.
 * This is NOT optimizer work.
 * This does NOT produce returns, ROI, PnL, win-rate, edge, alphaScore,
 * recommendation, benchmark, target price, or action fields.
 *
 * DISCLAIMER: This module does not constitute investment advice,
 * a recommendation, or a signal to buy, sell, or hold any security.
 * entersAlphaScore = false. paperOnly = true. dryRunOnly = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 * For structural eligibility audit purposes only.
 *
 * Authorization:
 *   CEO Decision 2026-05-25 — P54 is Axis B re-entry, second (final) of 2 rounds.
 */

import type { SimulationInputEligibilityDiffReport } from "../p53/SimulationInputEligibilityDiff";

// ─── Version ──────────────────────────────────────────────────────────────────

export const DIFF_REPORT_BUILDER_VERSION =
  "p54-axis-b-simulation-input-eligibility-diff-report-builder-v0" as const;

// ─── Audit Artifact ───────────────────────────────────────────────────────────

/**
 * Compact, human-readable audit artifact produced by buildEligibilityDiffAuditArtifact().
 *
 * Extracts the essential audit-visible information from a P53
 * SimulationInputEligibilityDiffReport and wraps it in a governance-tagged envelope.
 *
 * Fields:
 *   - artifactVersion / generatedAt: artifact identity and timestamp
 *   - Governance flags: all constant, never derived from diff data
 *   - diffVersion / diffedAt: forwarded from the underlying P53 diff report
 *   - summary: count-only summary of the diff
 *   - addedEligibleSourceNames: names of sources that gained eligibility
 *   - removedEligibleSourceNames: names of sources that lost eligibility
 *   - unchangedEligibleSourceNames: names of sources that remained eligible
 *   - changedEligibilityEntries: concise transition records for changed-blocking sources
 *   - disclaimer: static governance disclaimer text
 *
 * GOVERNANCE:
 *   paperOnly = true
 *   dryRunOnly = true
 *   entersAlphaScore = false
 *   noActualMetrics = true
 *   noRealExecution = true
 *   notInvestmentAdvice = true
 */
export type EligibilityDiffAuditArtifact = {
  /** Identifies this builder implementation version */
  readonly artifactVersion: typeof DIFF_REPORT_BUILDER_VERSION;

  /** ISO timestamp when this artifact was generated */
  readonly generatedAt: string;

  /** GOVERNANCE: always true — paper-only artifact */
  readonly paperOnly: true;

  /** GOVERNANCE: always true — dry-run only artifact */
  readonly dryRunOnly: true;

  /** GOVERNANCE: always false — never enters alpha scoring */
  readonly entersAlphaScore: false;

  /** GOVERNANCE: always true — no actual performance metrics */
  readonly noActualMetrics: true;

  /** GOVERNANCE: always true — no real execution triggered */
  readonly noRealExecution: true;

  /** GOVERNANCE: always true — not investment advice */
  readonly notInvestmentAdvice: true;

  /** The version string of the underlying P53 diff report */
  readonly diffVersion: string;

  /** The ISO timestamp from the underlying P53 diff report */
  readonly diffedAt: string;

  /** Count-only summary of the diff for quick inspection */
  readonly summary: {
    readonly addedEligibleCount: number;
    readonly removedEligibleCount: number;
    readonly unchangedEligibleCount: number;
    readonly changedEligibilityCount: number;
    readonly blockedBeforeCount: number;
    readonly blockedAfterCount: number;
  };

  /**
   * Names of sources that gained eligibility (added).
   * Preserves the order of diff.addedEligibleSources.
   */
  readonly addedEligibleSourceNames: readonly string[];

  /**
   * Names of sources that lost eligibility (removed).
   * Preserves the order of diff.removedEligibleSources.
   */
  readonly removedEligibleSourceNames: readonly string[];

  /**
   * Names of sources that remained eligible (unchanged).
   * Preserves the order of diff.unchangedEligibleSources.
   */
  readonly unchangedEligibleSourceNames: readonly string[];

  /**
   * Concise transition records for sources that were blocked in both before
   * and after but whose blocking classification or reasons changed.
   * Preserves the order of diff.changedEligibilitySources.
   */
  readonly changedEligibilityEntries: readonly {
    readonly sourceName: string;
    readonly blockedStatusBefore: string;
    readonly blockedStatusAfter: string;
  }[];

  /** Static governance disclaimer — always the same string */
  readonly disclaimer: string;
};

// ─── Forbidden Fields (compile-time audit reference) ─────────────────────────

/**
 * Fields that must NEVER appear in any P54 artifact output.
 * Identical superset to P53 forbidden fields.
 */
export const DIFF_REPORT_BUILDER_FORBIDDEN_FIELDS: readonly string[] = [
  "alphaScore",
  "recommendation",
  "prediction",
  "signal",
  "buy",
  "sell",
  "hold",
  "targetPrice",
  "outcomePrice",
  "returnPct",
  "winRate",
  "profit",
  "expectedReturn",
  "optimizerScore",
  "edgeScore",
  "roi",
  "pnl",
  "benchmark",
  "action",
] as const;

// ─── Disclaimer ───────────────────────────────────────────────────────────────

const DISCLAIMER =
  "This artifact is for structural eligibility audit only. " +
  "Not investment advice. entersAlphaScore=false always. " +
  "paperOnly=true. dryRunOnly=true. " +
  "No profit, return, win-rate, edge, or investment performance claims are made.";

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds a compact EligibilityDiffAuditArtifact from a P53 diff report.
 *
 * @param diff - The P53 SimulationInputEligibilityDiffReport to wrap.
 * @param fixedGeneratedAt - Optional fixed ISO timestamp for deterministic output.
 *   When omitted, uses new Date().toISOString().
 * @returns An EligibilityDiffAuditArtifact — JSON-safe, immutable, governance-tagged.
 *
 * Pure function: does not mutate `diff`, does not write to DB/FS/network.
 */
export function buildEligibilityDiffAuditArtifact(
  diff: SimulationInputEligibilityDiffReport,
  fixedGeneratedAt?: string,
): EligibilityDiffAuditArtifact {
  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();

  const addedEligibleSourceNames = diff.addedEligibleSources.map(
    (s) => s.sourceName,
  );

  const removedEligibleSourceNames = diff.removedEligibleSources.map(
    (s) => s.sourceName,
  );

  const unchangedEligibleSourceNames = diff.unchangedEligibleSources.map(
    (s) => s.sourceName,
  );

  const changedEligibilityEntries = diff.changedEligibilitySources.map((e) => ({
    sourceName: e.sourceName,
    blockedStatusBefore: e.blockedStatusBefore,
    blockedStatusAfter: e.blockedStatusAfter,
  }));

  return Object.freeze({
    artifactVersion: DIFF_REPORT_BUILDER_VERSION,
    generatedAt,

    paperOnly: true,
    dryRunOnly: true,
    entersAlphaScore: false,
    noActualMetrics: true,
    noRealExecution: true,
    notInvestmentAdvice: true,

    diffVersion: diff.diffVersion,
    diffedAt: diff.diffedAt,

    summary: Object.freeze({
      addedEligibleCount: diff.addedEligibleCount,
      removedEligibleCount: diff.removedEligibleCount,
      unchangedEligibleCount: diff.unchangedEligibleCount,
      changedEligibilityCount: diff.changedEligibilityCount,
      blockedBeforeCount: diff.blockedBeforeCount,
      blockedAfterCount: diff.blockedAfterCount,
    }),

    addedEligibleSourceNames: Object.freeze(addedEligibleSourceNames),
    removedEligibleSourceNames: Object.freeze(removedEligibleSourceNames),
    unchangedEligibleSourceNames: Object.freeze(unchangedEligibleSourceNames),
    changedEligibilityEntries: Object.freeze(
      changedEligibilityEntries.map((e) => Object.freeze(e)),
    ),

    disclaimer: DISCLAIMER,
  } satisfies EligibilityDiffAuditArtifact);
}
