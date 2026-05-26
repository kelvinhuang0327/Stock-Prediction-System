/**
 * P75 — Stock Research Product Surface Export Contract
 *
 * Accepts a caller-supplied P74 StockResearchProductSurfaceResponse,
 * validates all 10 combined governance flags, and produces a frozen,
 * JSON-safe, deterministic export payload with two separated sections:
 * researchReviewSection (Axis A) and simulationInputAuditSection (Axis B).
 *
 * Non-merge boundary:
 *   - researchReviewSection and simulationInputAuditSection are NOT merged.
 *   - No combined score, verdict, prediction, strategy, or aggregate metric.
 *   - exportSummary contains { researchCardCount, simulationAuditCardCount } only.
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
 *   - Imports only types from upstream P74 product surface contract module (import type)
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate input surface response
 *   - Throws on any governance flag violation from the P74 surface response
 *
 * Neutral section labels:
 *   - "Research Review" (Axis A)
 *   - "Simulation Input Audit" (Axis B)
 *
 * Authorization:
 *   P75-GATE 2026-05-26 — P75_GATE_PRODUCT_SURFACE_EXPORT_CONTRACT_APPROVED_WITH_STRICT_SCOPE
 *
 * Upstream baseline:
 *   P74 — Stock Research Product Surface Contract (c1ae678)
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import type { StockResearchProductSurfaceResponse } from "./StockResearchProductSurfaceContract";

// ─── Version ──────────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_VERSION =
  "p75-stock-research-product-surface-export-contract-v0" as const;

// ─── Governance ───────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE = Object.freeze({
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

export type StockResearchProductSurfaceExportValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

// ─── Section ──────────────────────────────────────────────────────────────────

/**
 * A single neutral section in the export response.
 *
 * Carries:
 *   - sectionLabel: a neutral axis section label ("Research Review" or "Simulation Input Audit")
 *   - cards: a frozen array of neutral display cards from the P74 surface response
 *   - cardCount: the number of cards in this section
 *
 * GOVERNANCE: No score, no metric, no recommendation, no merged field.
 */
export type StockResearchProductSurfaceExportSection = {
  readonly sectionLabel: string;
  readonly cards: readonly {
    readonly sourceName: string;
    readonly label: string;
    readonly status: string;
    readonly note?: string;
  }[];
  readonly cardCount: number;
};

// ─── Export Summary ───────────────────────────────────────────────────────────

/**
 * Count-only summary of the product surface export response.
 *
 * Contains exactly two fields: researchCardCount and simulationAuditCardCount.
 * No combined metric. No merged score. No aggregate field.
 */
export type StockResearchProductSurfaceExportSummary = {
  readonly researchCardCount: number;
  readonly simulationAuditCardCount: number;
};

// ─── Response ─────────────────────────────────────────────────────────────────

/**
 * The P75 stock research product surface export contract response.
 *
 * Carries all 10 governance flags as literal constants.
 * Contains researchReviewSection (Axis A) and simulationInputAuditSection (Axis B) independently.
 * exportSummary holds card counts only.
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
export type StockResearchProductSurfaceExportResponse = {
  readonly exportVersion: typeof STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_VERSION;
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
  readonly reportTitle: string;
  readonly researchReviewSection: StockResearchProductSurfaceExportSection;
  readonly simulationInputAuditSection: StockResearchProductSurfaceExportSection;
  readonly exportSummary: StockResearchProductSurfaceExportSummary;
};

// ─── Params ───────────────────────────────────────────────────────────────────

export type StockResearchProductSurfaceExportContractParams = {
  readonly surfaceResponse: StockResearchProductSurfaceResponse;
  readonly fixedGeneratedAt?: string;
};

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates that a P74 StockResearchProductSurfaceResponse carries all
 * 10 required combined governance flags before it may enter the product
 * surface export contract.
 *
 * Checks: reviewOnly, noInvestmentAdvice, noForecast, noRecommendation,
 *         previewOnly, paperOnly, noExecution, noActualMetrics,
 *         entersAlphaScore, notInvestmentAdvice.
 */
export function validateProductSurfaceForExport(
  params: StockResearchProductSurfaceResponse,
): StockResearchProductSurfaceExportValidationResult {
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
 * Builds a frozen StockResearchProductSurfaceExportResponse from a validated
 * P74 StockResearchProductSurfaceResponse.
 *
 * Steps:
 *   1. Validates all 10 governance flags — throws on any violation.
 *   2. Maps surfaceResponse.researchReview → researchReviewSection (neutral label).
 *   3. Maps surfaceResponse.simulationInputAudit → simulationInputAuditSection (neutral label).
 *   4. Assembles exportSummary with card counts only.
 *   5. Returns Object.freeze({...} satisfies StockResearchProductSurfaceExportResponse).
 *
 * Throws if validation fails.
 * Does not mutate input.
 */
export function buildStockResearchProductSurfaceExport(
  params: StockResearchProductSurfaceExportContractParams,
): StockResearchProductSurfaceExportResponse {
  const { surfaceResponse, fixedGeneratedAt } = params;

  const validation = validateProductSurfaceForExport(surfaceResponse);
  if (!validation.valid) {
    throw new Error(
      `StockResearchProductSurfaceExportContract: governance validation failed — ${validation.reason}`,
    );
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();

  const researchCards = Object.freeze(
    surfaceResponse.researchReview.cards.map((c) =>
      Object.freeze(
        c.note !== undefined
          ? { sourceName: c.sourceName, label: c.label, status: c.status, note: c.note }
          : { sourceName: c.sourceName, label: c.label, status: c.status },
      ),
    ),
  );

  const simulationCards = Object.freeze(
    surfaceResponse.simulationInputAudit.cards.map((c) =>
      Object.freeze(
        c.note !== undefined
          ? { sourceName: c.sourceName, label: c.label, status: c.status, note: c.note }
          : { sourceName: c.sourceName, label: c.label, status: c.status },
      ),
    ),
  );

  const researchReviewSection = Object.freeze({
    sectionLabel: "Research Review",
    cards: researchCards,
    cardCount: researchCards.length,
  } satisfies StockResearchProductSurfaceExportSection);

  const simulationInputAuditSection = Object.freeze({
    sectionLabel: "Simulation Input Audit",
    cards: simulationCards,
    cardCount: simulationCards.length,
  } satisfies StockResearchProductSurfaceExportSection);

  const exportSummary = Object.freeze({
    researchCardCount: researchCards.length,
    simulationAuditCardCount: simulationCards.length,
  } satisfies StockResearchProductSurfaceExportSummary);

  return Object.freeze({
    exportVersion: STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_VERSION,
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
    reportTitle: "Stock Research Product Surface Export",
    researchReviewSection,
    simulationInputAuditSection,
    exportSummary,
  } satisfies StockResearchProductSurfaceExportResponse);
}
