/**
 * P64 — Axis B Simulation Input Eligibility Review Consumer Gate
 *
 * Pure TypeScript consumer gate for the P63 Axis B simulation input eligibility
 * review artifact. Evaluates whether the review artifact may proceed to
 * P65 — Simulation Input Bundle Preview.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem imports
 *   - No child_process import
 *   - Imports only types/constants from P62/P63 modules
 *   - No Axis A implementation import
 *   - No P53/P54 logic import or mutation
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when fixedEvaluatedAt is provided
 *   - Does not mutate input artifact
 *   - No scoring, no recommendation, no investment advice, no forbidden fields
 *   - No simulation execution, no metrics, no optimizer, no backtest
 *   - Does NOT build the simulation input bundle
 *   - Does NOT execute simulation
 *   - Does NOT produce the P65 bundle
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
 * For structural eligibility gate purposes only.
 *
 * Upstream baseline:
 *   P62 — Axis B simulation input eligibility review contract (b946453)
 *   P63 — Axis B simulation input eligibility review builder (622997b)
 *
 * Authorization:
 *   P63 completion — consumer gate only; no simulation, no bundle build
 */

import {
  type SimulationInputEligibilityReviewArtifact,
} from "../p62/SimulationInputEligibilityReviewContract";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONSUMER_GATE_VERSION =
  "p64-axis-b-simulation-input-eligibility-review-consumer-gate-v0" as const;

// ─── Decision ─────────────────────────────────────────────────────────────────

/**
 * The gate decision for whether the P63 review artifact may proceed
 * to P65 — Simulation Input Bundle Preview.
 *
 * APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW:
 *   At least one eligible source exists and governance passed.
 *
 * BLOCKED_BY_NO_ELIGIBLE_SOURCES:
 *   No eligible or low-confidence sources exist.
 *
 * BLOCKED_BY_GOVERNANCE_VIOLATION:
 *   One or more governance flags are not satisfied.
 *
 * REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY:
 *   No fully eligible sources exist; only low-confidence sources are present.
 */
export type SimulationInputEligibilityReviewConsumerGateDecision =
  | "APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW"
  | "BLOCKED_BY_NO_ELIGIBLE_SOURCES"
  | "BLOCKED_BY_GOVERNANCE_VIOLATION"
  | "REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY";

// ─── Result ───────────────────────────────────────────────────────────────────

/**
 * The frozen result produced by the P64 consumer gate.
 *
 * Fields:
 *   - gateVersion: gate identity
 *   - evaluatedAt: ISO timestamp of evaluation
 *   - decision: gate decision
 *   - nextAllowedPhase: P65 if approved, null otherwise
 *   - eligibleSourceNames: sources with ELIGIBLE_FOR_REVIEW_ARTIFACT status
 *   - lowConfidenceSourceNames: sources with ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING
 *   - blockedSourceNames: sources with BLOCKED status
 *   - auditOnlySourceNames: sources with AUDIT_ONLY status
 *   - warnings: human-readable advisory messages
 *   - governancePassed: whether all governance flags are satisfied
 *   - noSimulationExecuted: always true
 *   - noMetricsProduced: always true
 *   - notInvestmentAdvice: always true
 *
 * GOVERNANCE: No scoring, no metrics, no recommendation, no investment semantics.
 */
export type SimulationInputEligibilityReviewConsumerGateResult = {
  readonly gateVersion: typeof SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONSUMER_GATE_VERSION;
  readonly evaluatedAt: string;
  readonly decision: SimulationInputEligibilityReviewConsumerGateDecision;
  readonly nextAllowedPhase: "P65_SIMULATION_INPUT_BUNDLE_PREVIEW" | null;
  readonly eligibleSourceNames: readonly string[];
  readonly lowConfidenceSourceNames: readonly string[];
  readonly blockedSourceNames: readonly string[];
  readonly auditOnlySourceNames: readonly string[];
  readonly warnings: readonly string[];
  readonly governancePassed: boolean;
  readonly noSimulationExecuted: true;
  readonly noMetricsProduced: true;
  readonly notInvestmentAdvice: true;
};

// ─── Gate Function ────────────────────────────────────────────────────────────

/**
 * Evaluates a P63 simulation input eligibility review artifact and decides
 * whether it may proceed to P65 — Simulation Input Bundle Preview.
 *
 * Pure function — does not mutate the input artifact.
 * Deterministic when fixedEvaluatedAt is provided.
 *
 * Decision logic:
 *   1. BLOCKED_BY_GOVERNANCE_VIOLATION if any governance flag fails.
 *   2. BLOCKED_BY_NO_ELIGIBLE_SOURCES if eligible + low-confidence count = 0.
 *   3. REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY if eligible=0 and low-confidence>0.
 *   4. APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW if eligible>0 and governance passes.
 *
 * @param artifact - The P63 review artifact to evaluate.
 * @param fixedEvaluatedAt - Optional ISO timestamp for deterministic output.
 * @returns Frozen SimulationInputEligibilityReviewConsumerGateResult.
 *
 * GOVERNANCE: No simulation execution, no metrics, no scoring, no recommendation.
 */
export function evaluateSimulationInputEligibilityReviewArtifactForBundlePreview(
  artifact: SimulationInputEligibilityReviewArtifact,
  fixedEvaluatedAt?: string,
): SimulationInputEligibilityReviewConsumerGateResult {
  const evaluatedAt = fixedEvaluatedAt ?? new Date().toISOString();

  // ── Governance check ───────────────────────────────────────────────────────
  const g = artifact.governance;
  const governancePassed =
    g.noSimulationExecution === true &&
    g.noMetrics === true &&
    g.noScoring === true &&
    g.noOptimizer === true &&
    g.noBacktest === true &&
    g.noRecommendation === true &&
    g.notInvestmentAdvice === true &&
    g.entersAlphaScore === false;

  // ── Classify source names by status ───────────────────────────────────────
  const eligibleSourceNames: string[] = [];
  const lowConfidenceSourceNames: string[] = [];
  const blockedSourceNames: string[] = [];
  const auditOnlySourceNames: string[] = [];

  for (const entry of artifact.entries) {
    if (entry.status === "ELIGIBLE_FOR_REVIEW_ARTIFACT") {
      eligibleSourceNames.push(entry.source);
    } else if (entry.status === "ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING") {
      lowConfidenceSourceNames.push(entry.source);
    } else if (entry.status === "BLOCKED") {
      blockedSourceNames.push(entry.source);
    } else if (entry.status === "AUDIT_ONLY") {
      auditOnlySourceNames.push(entry.source);
    }
  }

  // ── Warnings ───────────────────────────────────────────────────────────────
  const warnings: string[] = [];
  if (lowConfidenceSourceNames.length > 0) {
    warnings.push(
      `Low-confidence sources require manual review before bundle preview: ${lowConfidenceSourceNames.join(", ")}`,
    );
  }

  // ── Decision ───────────────────────────────────────────────────────────────
  let decision: SimulationInputEligibilityReviewConsumerGateDecision;
  if (!governancePassed) {
    decision = "BLOCKED_BY_GOVERNANCE_VIOLATION";
  } else if (
    eligibleSourceNames.length + lowConfidenceSourceNames.length === 0
  ) {
    decision = "BLOCKED_BY_NO_ELIGIBLE_SOURCES";
  } else if (
    eligibleSourceNames.length === 0 &&
    lowConfidenceSourceNames.length > 0
  ) {
    decision = "REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY";
  } else {
    decision = "APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW";
  }

  // ── Next allowed phase ─────────────────────────────────────────────────────
  const nextAllowedPhase: "P65_SIMULATION_INPUT_BUNDLE_PREVIEW" | null =
    decision === "APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW"
      ? "P65_SIMULATION_INPUT_BUNDLE_PREVIEW"
      : null;

  return Object.freeze({
    gateVersion: SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONSUMER_GATE_VERSION,
    evaluatedAt,
    decision,
    nextAllowedPhase,
    eligibleSourceNames: Object.freeze(eligibleSourceNames),
    lowConfidenceSourceNames: Object.freeze(lowConfidenceSourceNames),
    blockedSourceNames: Object.freeze(blockedSourceNames),
    auditOnlySourceNames: Object.freeze(auditOnlySourceNames),
    warnings: Object.freeze(warnings),
    governancePassed,
    noSimulationExecuted: true as const,
    noMetricsProduced: true as const,
    notInvestmentAdvice: true as const,
  } satisfies SimulationInputEligibilityReviewConsumerGateResult);
}
