/**
 * P63 — Axis B Simulation Input Eligibility Review Builder
 *
 * Pure TypeScript builder for the P62 Axis B simulation input eligibility
 * review artifact. Accepts caller-supplied entries, computes count-only
 * summary, and produces a JSON-safe SimulationInputEligibilityReviewArtifact.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem imports
 *   - No child_process import
 *   - Imports only from P62 SimulationInputEligibilityReviewContract
 *   - No Axis A implementation import
 *   - No P53/P54 logic import or mutation
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate entries
 *   - No scoring, no recommendation, no investment advice, no forbidden fields
 *   - No simulation execution, no metrics, no optimizer, no backtest
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
 * For structural eligibility review audit purposes only.
 *
 * Upstream baseline:
 *   P62 — Axis B simulation input eligibility review contract (b946453)
 *   P63-GATE — APPROVE_P63_WITH_STRICT_SCOPE (commit 600eff5)
 *
 * Authorization:
 *   P63-GATE 2026-05-26 — APPROVE_P63_WITH_STRICT_SCOPE
 *   Gate decision commit: 600eff5
 */

import {
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONTRACT_VERSION,
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE,
  type SimulationInputReviewStatus,
  type SimulationInputEligibilityReviewEntry,
  type SimulationInputEligibilityReviewSummary,
  type SimulationInputEligibilityReviewArtifact,
} from "../p62/SimulationInputEligibilityReviewContract";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SIMULATION_INPUT_ELIGIBILITY_REVIEW_BUILDER_VERSION =
  "p63-axis-b-simulation-input-eligibility-review-builder-v0" as const;

// ─── Params ───────────────────────────────────────────────────────────────────

export type SimulationInputEligibilityReviewBuilderParams = {
  readonly entries: readonly SimulationInputEligibilityReviewEntry[];
  readonly fixedGeneratedAt?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Counts entries whose status matches the given review status.
 * Pure helper — no side effects, no mutation.
 *
 * @param entries - Readonly array of review entries.
 * @param status - The status to count.
 * @returns Integer count of matching entries.
 */
export function countReviewStatus(
  entries: readonly SimulationInputEligibilityReviewEntry[],
  status: SimulationInputReviewStatus,
): number {
  let count = 0;
  for (const entry of entries) {
    if (entry.status === status) {
      count++;
    }
  }
  return count;
}

/**
 * Computes count-only summary from review entries.
 * Pure helper — no metrics, no scoring, no recommendation.
 *
 * @param entries - Readonly array of review entries.
 * @returns Frozen SimulationInputEligibilityReviewSummary.
 */
export function summarizeSimulationInputEligibilityReviewEntries(
  entries: readonly SimulationInputEligibilityReviewEntry[],
): SimulationInputEligibilityReviewSummary {
  return Object.freeze({
    eligibleCount: countReviewStatus(entries, "ELIGIBLE_FOR_REVIEW_ARTIFACT"),
    lowConfidenceCount: countReviewStatus(
      entries,
      "ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING",
    ),
    blockedCount: countReviewStatus(entries, "BLOCKED"),
    auditOnlyCount: countReviewStatus(entries, "AUDIT_ONLY"),
    totalSources: entries.length,
  });
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds a SimulationInputEligibilityReviewArtifact from caller-supplied entries.
 *
 * @param params - Builder params: entries and optional fixedGeneratedAt.
 *   - entries: caller-supplied readonly review entries — not mutated.
 *   - fixedGeneratedAt: optional ISO timestamp for deterministic output;
 *     when omitted, uses new Date().toISOString().
 * @returns A JSON-safe, immutable SimulationInputEligibilityReviewArtifact.
 *
 * Pure function: does not mutate entries, does not write to DB/FS/network.
 * Deterministic when params.fixedGeneratedAt is provided.
 *
 * GOVERNANCE:
 *   paperOnly = true | dryRunOnly = true | entersAlphaScore = false
 *   noSimulationExecution = true | noMetrics = true | noScoring = true
 *   noOptimizer = true | noBacktest = true | noRecommendation = true
 *   notInvestmentAdvice = true
 */
export function buildSimulationInputEligibilityReviewArtifact(
  params: SimulationInputEligibilityReviewBuilderParams,
): SimulationInputEligibilityReviewArtifact {
  const generatedAt = params.fixedGeneratedAt ?? new Date().toISOString();
  const summary = summarizeSimulationInputEligibilityReviewEntries(
    params.entries,
  );

  return Object.freeze({
    version: SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONTRACT_VERSION,
    generatedAt,
    governance: SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE,
    entries: params.entries,
    summary,
  } satisfies SimulationInputEligibilityReviewArtifact);
}
