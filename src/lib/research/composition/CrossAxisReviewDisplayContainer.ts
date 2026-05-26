/**
 * P72 — Cross-Axis Review Display Container
 *
 * Accepts an Axis A P68 ResearchSnapshotReviewFormatterResponse and an
 * Axis B P70 SimulationInputBundleAuditTrailFormatterResponse as independent
 * typed parameters. Validates the governance flags of each axis independently.
 * Produces a single frozen container with two labelled, non-merged sections:
 * researchSection (Axis A) and simulationAuditSection (Axis B).
 *
 * Non-merge boundary:
 *   - Axis A and Axis B outputs are NOT merged into any combined score, verdict,
 *     prediction, strategy, or aggregate metric.
 *   - containerSummary contains { researchRowCount, simulationAuditRowCount } only.
 *   - No cross-axis causal chain. No causal inference across axes.
 *
 * Governance:
 *   - reviewOnly = true
 *   - noInvestmentAdvice = true
 *   - noForecast = true
 *   - noRecommendation = true
 *   - previewOnly = true
 *   - paperOnly = true
 *   - noExecution = true
 *   - noActualMetrics = true
 *   - entersAlphaScore = false (ALWAYS)
 *   - notInvestmentAdvice = true
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem, no child_process
 *   - Imports only types from upstream P68 and P70 modules (import type)
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate input formatter responses
 *   - Throws on any governance flag violation from either axis
 *
 * Authorization:
 *   P71B-GATE 2026-05-26 — P71B_GATE_CROSS_AXIS_INTEGRATION_BOUNDARY_DEFINED
 *   P72-GATE  2026-05-26 — P72_GATE_CROSS_AXIS_DISPLAY_CONTAINER_APPROVED_WITH_STRICT_SCOPE
 *
 * Upstream baselines:
 *   P68 — Axis A research snapshot review response formatter (71fbe65)
 *   P70 — Axis B simulation input bundle audit trail formatter (23044eb)
 */

import type { ResearchSnapshotReviewFormatterResponse } from "@/lib/research/snapshot/v1/ResearchSnapshotReviewResponseFormatter";
import type { SimulationInputBundleAuditTrailFormatterResponse } from "@/lib/onlineValidation/p70/SimulationInputBundleAuditTrailFormatter";

// ─── Version ──────────────────────────────────────────────────────────────────

export const CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_VERSION =
  "p72-cross-axis-review-display-container-v0" as const;

// ─── Governance ───────────────────────────────────────────────────────────────

export const CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE = Object.freeze({
  reviewOnly: true,
  noInvestmentAdvice: true,
  noForecast: true,
  noRecommendation: true,
  previewOnly: true,
  paperOnly: true,
  noExecution: true,
  noActualMetrics: true,
  entersAlphaScore: false,
  notInvestmentAdvice: true,
} as const);

// ─── Validation Result ────────────────────────────────────────────────────────

export type CrossAxisReviewDisplayContainerValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

// ─── Section ─────────────────────────────────────────────────────────────────

/**
 * A single axis section inside the container.
 *
 * Each section carries:
 *   - axis: "AXIS_A_RESEARCH_REVIEW" or "AXIS_B_SIMULATION_INPUT_AUDIT"
 *   - version: the upstream formatter version string
 *   - displayRows: the formatter displayRows, untransformed
 *   - summary: the formatter formatterSummary, untransformed
 *
 * GOVERNANCE: No score, no metric, no merged field of any kind.
 */
export type CrossAxisReviewDisplayContainerSection = {
  readonly axis: "AXIS_A_RESEARCH_REVIEW" | "AXIS_B_SIMULATION_INPUT_AUDIT";
  readonly version: string;
  readonly displayRows: readonly unknown[];
  readonly summary: unknown;
};

// ─── Container Summary ────────────────────────────────────────────────────────

/**
 * Count-only summary of the container.
 *
 * Contains exactly two fields: researchRowCount and simulationAuditRowCount.
 * No combined metric. No merged score. No aggregate field.
 */
export type CrossAxisReviewDisplayContainerSummary = {
  readonly researchRowCount: number;
  readonly simulationAuditRowCount: number;
};

// ─── Response ─────────────────────────────────────────────────────────────────

/**
 * The P72 cross-axis review display container response.
 *
 * Carries all 10 governance flags as literal constants.
 * Contains researchSection (Axis A) and simulationAuditSection (Axis B) independently.
 * containerSummary holds row counts only.
 *
 * GOVERNANCE:
 *   reviewOnly = true
 *   noInvestmentAdvice = true
 *   noForecast = true
 *   noRecommendation = true
 *   previewOnly = true
 *   paperOnly = true
 *   noExecution = true
 *   noActualMetrics = true
 *   entersAlphaScore = false
 *   notInvestmentAdvice = true
 */
export type CrossAxisReviewDisplayContainerResponse = {
  readonly version: typeof CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_VERSION;
  readonly generatedAt: string;
  readonly reviewOnly: true;
  readonly noInvestmentAdvice: true;
  readonly noForecast: true;
  readonly noRecommendation: true;
  readonly previewOnly: true;
  readonly paperOnly: true;
  readonly noExecution: true;
  readonly noActualMetrics: true;
  readonly entersAlphaScore: false;
  readonly notInvestmentAdvice: true;
  readonly researchSection: CrossAxisReviewDisplayContainerSection;
  readonly simulationAuditSection: CrossAxisReviewDisplayContainerSection;
  readonly containerSummary: CrossAxisReviewDisplayContainerSummary;
};

// ─── Params ───────────────────────────────────────────────────────────────────

export type CrossAxisReviewDisplayContainerParams = {
  readonly researchResponse: ResearchSnapshotReviewFormatterResponse;
  readonly simulationAuditResponse: SimulationInputBundleAuditTrailFormatterResponse;
  readonly fixedGeneratedAt?: string;
};

// ─── Axis A Validator ─────────────────────────────────────────────────────────

/**
 * Validates that a P68 ResearchSnapshotReviewFormatterResponse carries the
 * required Axis A governance flags before it may enter the container.
 *
 * Checks: reviewOnly, noInvestmentAdvice, noForecast, noRecommendation,
 *         entersAlphaScore
 */
export function validateResearchResponseForContainer(
  response: ResearchSnapshotReviewFormatterResponse,
): CrossAxisReviewDisplayContainerValidationResult {
  if (response.reviewOnly !== true) {
    return { valid: false, reason: "Axis A reviewOnly must be true" };
  }
  if (response.noInvestmentAdvice !== true) {
    return { valid: false, reason: "Axis A noInvestmentAdvice must be true" };
  }
  if (response.noForecast !== true) {
    return { valid: false, reason: "Axis A noForecast must be true" };
  }
  if (response.noRecommendation !== true) {
    return { valid: false, reason: "Axis A noRecommendation must be true" };
  }
  if (response.entersAlphaScore !== false) {
    return { valid: false, reason: "Axis A entersAlphaScore must be false" };
  }
  return { valid: true };
}

// ─── Axis B Validator ─────────────────────────────────────────────────────────

/**
 * Validates that a P70 SimulationInputBundleAuditTrailFormatterResponse carries
 * the required Axis B governance flags before it may enter the container.
 *
 * Checks: previewOnly, paperOnly, noExecution, noActualMetrics,
 *         entersAlphaScore, notInvestmentAdvice
 */
export function validateSimulationAuditResponseForContainer(
  response: SimulationInputBundleAuditTrailFormatterResponse,
): CrossAxisReviewDisplayContainerValidationResult {
  if (response.previewOnly !== true) {
    return { valid: false, reason: "Axis B previewOnly must be true" };
  }
  if (response.paperOnly !== true) {
    return { valid: false, reason: "Axis B paperOnly must be true" };
  }
  if (response.noExecution !== true) {
    return { valid: false, reason: "Axis B noExecution must be true" };
  }
  if (response.noActualMetrics !== true) {
    return { valid: false, reason: "Axis B noActualMetrics must be true" };
  }
  if (response.entersAlphaScore !== false) {
    return { valid: false, reason: "Axis B entersAlphaScore must be false" };
  }
  if (response.notInvestmentAdvice !== true) {
    return { valid: false, reason: "Axis B notInvestmentAdvice must be true" };
  }
  return { valid: true };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds a frozen CrossAxisReviewDisplayContainerResponse.
 *
 * Steps:
 *   1. Validates Axis A governance flags — throws on any violation.
 *   2. Validates Axis B governance flags — throws on any violation.
 *   3. Assembles researchSection with Axis A display rows and summary, untransformed.
 *   4. Assembles simulationAuditSection with Axis B display rows and summary, untransformed.
 *   5. Assembles containerSummary with row counts only.
 *   6. Returns Object.freeze({...} satisfies CrossAxisReviewDisplayContainerResponse).
 *
 * Throws if either validation fails.
 */
export function buildCrossAxisReviewDisplayContainer(
  params: CrossAxisReviewDisplayContainerParams,
): CrossAxisReviewDisplayContainerResponse {
  const { researchResponse, simulationAuditResponse, fixedGeneratedAt } = params;

  const researchValidation = validateResearchResponseForContainer(researchResponse);
  if (!researchValidation.valid) {
    throw new Error(
      `P72 Axis A governance violation: ${researchValidation.reason}`,
    );
  }

  const simulationValidation =
    validateSimulationAuditResponseForContainer(simulationAuditResponse);
  if (!simulationValidation.valid) {
    throw new Error(
      `P72 Axis B governance violation: ${simulationValidation.reason}`,
    );
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();

  const researchSection = Object.freeze({
    axis: "AXIS_A_RESEARCH_REVIEW" as const,
    version: researchResponse.version,
    displayRows: researchResponse.displayRows,
    summary: researchResponse.formatterSummary,
  } satisfies CrossAxisReviewDisplayContainerSection);

  const simulationAuditSection = Object.freeze({
    axis: "AXIS_B_SIMULATION_INPUT_AUDIT" as const,
    version: simulationAuditResponse.version,
    displayRows: simulationAuditResponse.displayRows,
    summary: simulationAuditResponse.formatterSummary,
  } satisfies CrossAxisReviewDisplayContainerSection);

  const containerSummary = Object.freeze({
    researchRowCount: researchResponse.displayRows.length,
    simulationAuditRowCount: simulationAuditResponse.displayRows.length,
  } satisfies CrossAxisReviewDisplayContainerSummary);

  return Object.freeze({
    version: CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_VERSION,
    generatedAt,
    reviewOnly: true,
    noInvestmentAdvice: true,
    noForecast: true,
    noRecommendation: true,
    previewOnly: true,
    paperOnly: true,
    noExecution: true,
    noActualMetrics: true,
    entersAlphaScore: false,
    notInvestmentAdvice: true,
    researchSection,
    simulationAuditSection,
    containerSummary,
  } satisfies CrossAxisReviewDisplayContainerResponse);
}
