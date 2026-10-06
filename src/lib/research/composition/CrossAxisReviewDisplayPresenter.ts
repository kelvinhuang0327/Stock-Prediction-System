/**
 * P73 — Cross-Axis Review Display Presenter
 *
 * Accepts a caller-supplied P72 CrossAxisReviewDisplayContainerResponse,
 * validates all 10 combined governance flags, and produces a frozen,
 * JSON-safe, deterministic presenter response with two separated card groups:
 * researchCards (Axis A) and simulationAuditCards (Axis B).
 *
 * Non-merge boundary:
 *   - Axis A researchCards and Axis B simulationAuditCards are NOT merged.
 *   - No combined score, verdict, prediction, strategy, or aggregate metric.
 *   - presenterSummary contains { researchCardCount, simulationAuditCardCount } only.
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
 *   - Imports only types from upstream P72 module (import type)
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate input container response
 *   - Throws on any governance flag violation from the P72 container
 *
 * Neutral labels:
 *   - Research review
 *   - Simulation input audit
 *   - Source status
 *   - Excluded reason
 *   - Review note
 *
 * Authorization:
 *   P73-GATE 2026-05-26 — P73_GATE_CROSS_AXIS_PRODUCT_VIEW_PRESENTER_APPROVED_WITH_STRICT_SCOPE
 *
 * Upstream baseline:
 *   P72 — Cross-Axis Review Display Container (6644681)
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import type { CrossAxisReviewDisplayContainerResponse } from "./CrossAxisReviewDisplayContainer";

// ─── Version ──────────────────────────────────────────────────────────────────

export const CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_VERSION =
  "p73-cross-axis-review-display-presenter-v0" as const;

// ─── Governance ───────────────────────────────────────────────────────────────

export const CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE = Object.freeze({
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

export type CrossAxisReviewDisplayPresenterValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

// ─── Card ─────────────────────────────────────────────────────────────────────

/**
 * A single neutral display card in the presenter output.
 *
 * Carries:
 *   - sourceName: the original source identifier
 *   - label: a neutral axis label ("Research review" or "Simulation input audit")
 *   - status: a neutral status string (rowType or previewStatus from upstream)
 *   - note?: an optional neutral note (from displayNote if present)
 *
 * GOVERNANCE: No score, no metric, no recommendation, no merged field.
 */
export type CrossAxisReviewDisplayCard = {
  readonly sourceName: string;
  readonly label: string;
  readonly status: string;
  readonly note?: string;
};

// ─── Presenter Summary ────────────────────────────────────────────────────────

/**
 * Count-only summary of the presenter output.
 *
 * Contains exactly two fields: researchCardCount and simulationAuditCardCount.
 * No combined metric. No merged score. No aggregate field.
 */
export type CrossAxisReviewDisplayPresenterSummary = {
  readonly researchCardCount: number;
  readonly simulationAuditCardCount: number;
};

// ─── Response ─────────────────────────────────────────────────────────────────

/**
 * The P73 cross-axis review display presenter response.
 *
 * Carries all 10 governance flags as literal constants.
 * Contains researchCards (Axis A) and simulationAuditCards (Axis B) independently.
 * presenterSummary holds card counts only.
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
export type CrossAxisReviewDisplayPresenterResponse = {
  readonly version: typeof CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_VERSION;
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
  readonly researchCards: readonly CrossAxisReviewDisplayCard[];
  readonly simulationAuditCards: readonly CrossAxisReviewDisplayCard[];
  readonly presenterSummary: CrossAxisReviewDisplayPresenterSummary;
};

// ─── Params ───────────────────────────────────────────────────────────────────

export type CrossAxisReviewDisplayPresenterParams = {
  readonly containerResponse: CrossAxisReviewDisplayContainerResponse;
  readonly fixedGeneratedAt?: string;
};

// ─── Internal row shapes (private) ────────────────────────────────────────────

type ResearchDisplayRow = {
  readonly sourceName: string;
  readonly rowType: string;
  readonly displayNote?: string;
};

type SimulationAuditDisplayRow = {
  readonly sourceName: string;
  readonly previewStatus: string;
  readonly displayNote?: string;
};

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates that a P72 CrossAxisReviewDisplayContainerResponse carries all
 * 10 required combined governance flags before it may enter the presenter.
 *
 * Checks: reviewOnly, noInvestmentAdvice, noForecast, noRecommendation,
 *         previewOnly, paperOnly, noExecution, noActualMetrics,
 *         entersAlphaScore, notInvestmentAdvice.
 */
export function validateCrossAxisReviewDisplayContainerForPresenter(
  params: CrossAxisReviewDisplayContainerResponse,
): CrossAxisReviewDisplayPresenterValidationResult {
  if (params.reviewOnly !== true) {
    return { valid: false, reason: "reviewOnly must be true" };
  }
  if (params.noInvestmentAdvice !== true) {
    return { valid: false, reason: "noInvestmentAdvice must be true" };
  }
  if (params.noForecast !== true) {
    return { valid: false, reason: "noForecast must be true" };
  }
  if (params.noRecommendation !== true) {
    return { valid: false, reason: "noRecommendation must be true" };
  }
  if (params.previewOnly !== true) {
    return { valid: false, reason: "previewOnly must be true" };
  }
  if (params.paperOnly !== true) {
    return { valid: false, reason: "paperOnly must be true" };
  }
  if (params.noExecution !== true) {
    return { valid: false, reason: "noExecution must be true" };
  }
  if (params.noActualMetrics !== true) {
    return { valid: false, reason: "noActualMetrics must be true" };
  }
  if (params.entersAlphaScore !== false) {
    return { valid: false, reason: "entersAlphaScore must be false" };
  }
  if (params.notInvestmentAdvice !== true) {
    return { valid: false, reason: "notInvestmentAdvice must be true" };
  }
  return { valid: true };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds a frozen CrossAxisReviewDisplayPresenterResponse from a validated
 * P72 CrossAxisReviewDisplayContainerResponse.
 *
 * Steps:
 *   1. Validates all 10 governance flags — throws on any violation.
 *   2. Maps researchSection.displayRows → researchCards (neutral label mapping).
 *   3. Maps simulationAuditSection.displayRows → simulationAuditCards (neutral label mapping).
 *   4. Assembles presenterSummary with card counts only.
 *   5. Returns Object.freeze({...} satisfies CrossAxisReviewDisplayPresenterResponse).
 *
 * Throws if validation fails.
 * Does not mutate input.
 */
export function presentCrossAxisReviewDisplayContainer(
  params: CrossAxisReviewDisplayPresenterParams,
): CrossAxisReviewDisplayPresenterResponse {
  const { containerResponse, fixedGeneratedAt } = params;

  const validation =
    validateCrossAxisReviewDisplayContainerForPresenter(containerResponse);
  if (!validation.valid) {
    throw new Error(`P73 governance violation: ${validation.reason}`);
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();

  const researchCards: CrossAxisReviewDisplayCard[] =
    containerResponse.researchSection.displayRows.map((row) => {
      const r = row as ResearchDisplayRow;
      const card: CrossAxisReviewDisplayCard =
        r.displayNote !== undefined
          ? {
              sourceName: r.sourceName,
              label: "Research review",
              status: r.rowType,
              note: r.displayNote,
            }
          : {
              sourceName: r.sourceName,
              label: "Research review",
              status: r.rowType,
            };
      return Object.freeze(card);
    });

  const simulationAuditCards: CrossAxisReviewDisplayCard[] =
    containerResponse.simulationAuditSection.displayRows.map((row) => {
      const r = row as SimulationAuditDisplayRow;
      const card: CrossAxisReviewDisplayCard =
        r.displayNote !== undefined
          ? {
              sourceName: r.sourceName,
              label: "Simulation input audit",
              status: r.previewStatus,
              note: r.displayNote,
            }
          : {
              sourceName: r.sourceName,
              label: "Simulation input audit",
              status: r.previewStatus,
            };
      return Object.freeze(card);
    });

  const presenterSummary = Object.freeze({
    researchCardCount: researchCards.length,
    simulationAuditCardCount: simulationAuditCards.length,
  } satisfies CrossAxisReviewDisplayPresenterSummary);

  return Object.freeze({
    version: CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_VERSION,
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
    researchCards: Object.freeze(researchCards),
    simulationAuditCards: Object.freeze(simulationAuditCards),
    presenterSummary,
  } satisfies CrossAxisReviewDisplayPresenterResponse);
}
