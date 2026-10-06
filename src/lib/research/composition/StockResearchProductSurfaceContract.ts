/**
 * P74 — Stock Research Product Surface Contract
 *
 * Accepts a caller-supplied P73 CrossAxisReviewDisplayPresenterResponse,
 * validates all 10 combined governance flags, and produces a frozen,
 * JSON-safe, deterministic product surface response with two separated
 * sections: researchReview (Axis A) and simulationInputAudit (Axis B).
 *
 * Non-merge boundary:
 *   - researchReview and simulationInputAudit sections are NOT merged.
 *   - No combined score, verdict, prediction, strategy, or aggregate metric.
 *   - surfaceSummary contains { researchCardCount, simulationAuditCardCount } only.
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
 *   - Imports only types from upstream P73 presenter module (import type)
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate input presenter response
 *   - Throws on any governance flag violation from the P73 presenter
 *
 * Neutral section labels:
 *   - "Research Review" (Axis A)
 *   - "Simulation Input Audit" (Axis B)
 *
 * Authorization:
 *   P74-GATE 2026-05-26 — P74_GATE_PRODUCT_SURFACE_CONTRACT_APPROVED_WITH_STRICT_SCOPE
 *
 * Upstream baseline:
 *   P73 — Cross-Axis Review Display Presenter (b891fc9)
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import type { CrossAxisReviewDisplayPresenterResponse } from "./CrossAxisReviewDisplayPresenter";

// ─── Version ──────────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_VERSION =
  "p74-stock-research-product-surface-contract-v0" as const;

// ─── Governance ───────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE = Object.freeze({
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

export type StockResearchProductSurfaceContractValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

// ─── Section ──────────────────────────────────────────────────────────────────

/**
 * A single neutral section in the product surface response.
 *
 * Carries:
 *   - sectionLabel: a neutral axis section label ("Research Review" or "Simulation Input Audit")
 *   - cards: a frozen array of neutral display cards from the P73 presenter
 *   - cardCount: the number of cards in this section
 *
 * GOVERNANCE: No score, no metric, no recommendation, no merged field.
 */
export type StockResearchProductSurfaceSection = {
  readonly sectionLabel: string;
  readonly cards: readonly {
    readonly sourceName: string;
    readonly label: string;
    readonly status: string;
    readonly note?: string;
  }[];
  readonly cardCount: number;
};

// ─── Surface Summary ──────────────────────────────────────────────────────────

/**
 * Count-only summary of the product surface response.
 *
 * Contains exactly two fields: researchCardCount and simulationAuditCardCount.
 * No combined metric. No merged score. No aggregate field.
 */
export type StockResearchProductSurfaceSummary = {
  readonly researchCardCount: number;
  readonly simulationAuditCardCount: number;
};

// ─── Response ─────────────────────────────────────────────────────────────────

/**
 * The P74 stock research product surface contract response.
 *
 * Carries all 10 governance flags as literal constants.
 * Contains researchReview (Axis A) and simulationInputAudit (Axis B) independently.
 * surfaceSummary holds card counts only.
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
export type StockResearchProductSurfaceResponse = {
  readonly surfaceVersion: typeof STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_VERSION;
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
  readonly researchReview: StockResearchProductSurfaceSection;
  readonly simulationInputAudit: StockResearchProductSurfaceSection;
  readonly surfaceSummary: StockResearchProductSurfaceSummary;
};

// ─── Params ───────────────────────────────────────────────────────────────────

export type StockResearchProductSurfaceContractParams = {
  readonly presenterResponse: CrossAxisReviewDisplayPresenterResponse;
  readonly fixedGeneratedAt?: string;
};

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates that a P73 CrossAxisReviewDisplayPresenterResponse carries all
 * 10 required combined governance flags before it may enter the product
 * surface contract.
 *
 * Checks: reviewOnly, noInvestmentAdvice, noForecast, noRecommendation,
 *         previewOnly, paperOnly, noExecution, noActualMetrics,
 *         entersAlphaScore, notInvestmentAdvice.
 */
export function validateCrossAxisPresenterForProductSurface(
  params: CrossAxisReviewDisplayPresenterResponse,
): StockResearchProductSurfaceContractValidationResult {
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
 * Builds a frozen StockResearchProductSurfaceResponse from a validated
 * P73 CrossAxisReviewDisplayPresenterResponse.
 *
 * Steps:
 *   1. Validates all 10 governance flags — throws on any violation.
 *   2. Maps presenterResponse.researchCards → researchReview section (neutral label).
 *   3. Maps presenterResponse.simulationAuditCards → simulationInputAudit section (neutral label).
 *   4. Assembles surfaceSummary with card counts only.
 *   5. Returns Object.freeze({...} satisfies StockResearchProductSurfaceResponse).
 *
 * Throws if validation fails.
 * Does not mutate input.
 */
export function buildStockResearchProductSurfaceResponse(
  params: StockResearchProductSurfaceContractParams,
): StockResearchProductSurfaceResponse {
  const { presenterResponse, fixedGeneratedAt } = params;

  const validation = validateCrossAxisPresenterForProductSurface(presenterResponse);
  if (!validation.valid) {
    throw new Error(
      `StockResearchProductSurfaceContract: governance validation failed — ${validation.reason}`,
    );
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();

  const researchCards = Object.freeze(
    presenterResponse.researchCards.map((c) =>
      Object.freeze(
        c.note !== undefined
          ? { sourceName: c.sourceName, label: c.label, status: c.status, note: c.note }
          : { sourceName: c.sourceName, label: c.label, status: c.status },
      ),
    ),
  );

  const simulationAuditCards = Object.freeze(
    presenterResponse.simulationAuditCards.map((c) =>
      Object.freeze(
        c.note !== undefined
          ? { sourceName: c.sourceName, label: c.label, status: c.status, note: c.note }
          : { sourceName: c.sourceName, label: c.label, status: c.status },
      ),
    ),
  );

  const researchReview = Object.freeze({
    sectionLabel: "Research Review",
    cards: researchCards,
    cardCount: researchCards.length,
  } satisfies StockResearchProductSurfaceSection);

  const simulationInputAudit = Object.freeze({
    sectionLabel: "Simulation Input Audit",
    cards: simulationAuditCards,
    cardCount: simulationAuditCards.length,
  } satisfies StockResearchProductSurfaceSection);

  const surfaceSummary = Object.freeze({
    researchCardCount: researchCards.length,
    simulationAuditCardCount: simulationAuditCards.length,
  } satisfies StockResearchProductSurfaceSummary);

  return Object.freeze({
    surfaceVersion: STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_VERSION,
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
    researchReview,
    simulationInputAudit,
    surfaceSummary,
  } satisfies StockResearchProductSurfaceResponse);
}
