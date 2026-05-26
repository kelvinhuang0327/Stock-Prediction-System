/**
 * P76 — Stock Research Product Surface Sample Report Contract
 *
 * Accepts a caller-supplied P75 StockResearchProductSurfaceExportResponse,
 * validates all 10 combined governance flags, and produces a frozen,
 * JSON-safe, deterministic sample report with:
 *   - disclaimerBlock: fixed neutral disclaimer lines
 *   - researchReviewBlock: mapped from researchReviewSection (Axis A)
 *   - simulationInputAuditBlock: mapped from simulationInputAuditSection (Axis B)
 *   - summaryBlock: { researchCardCount, simulationAuditCardCount } only
 *
 * Non-merge boundary:
 *   - researchReviewBlock and simulationInputAuditBlock are NOT merged.
 *   - No combined score, verdict, prediction, strategy, or aggregate metric.
 *   - summaryBlock contains { researchCardCount, simulationAuditCardCount } only.
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
 *   - Imports only types from upstream P75 export contract module (import type)
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate input export response
 *   - Throws on any governance flag violation from the P75 export response
 *
 * Neutral labels:
 *   - reportTitle: "Stock Research Product Surface Sample Report"
 *   - disclaimerLabel: "Disclaimer"
 *   - researchReviewBlock blockLabel: "Research Review"
 *   - simulationInputAuditBlock blockLabel: "Simulation Input Audit"
 *
 * Authorization:
 *   P76-GATE 2026-05-26
 *   Token: P76_GATE_SAMPLE_REPORT_CONTRACT_APPROVED_WITH_STRICT_SCOPE
 *   Upstream baseline: P75 — StockResearchProductSurfaceExportContract (0ba0c32)
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import type { StockResearchProductSurfaceExportResponse } from "./StockResearchProductSurfaceExportContract";

// ─── Version ──────────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_VERSION =
  "p76-stock-research-product-surface-sample-report-contract-v0" as const;

// ─── Governance ───────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE = Object.freeze({
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

export type StockResearchProductSurfaceSampleReportValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

// ─── Disclaimer Block ─────────────────────────────────────────────────────────

/**
 * A fixed neutral disclaimer block.
 *
 * Contains:
 *   - disclaimerLabel: "Disclaimer"
 *   - lines: fixed neutral text lines asserting no-advice, no-forecast, no-execution
 *
 * GOVERNANCE: Text is fixed. No advisory language. No forecast. No execution.
 */
export type StockResearchProductSurfaceSampleReportDisclaimerBlock = {
  readonly disclaimerLabel: string;
  readonly lines: readonly string[];
};

// ─── Block ────────────────────────────────────────────────────────────────────

/**
 * A single neutral section block in the sample report response.
 *
 * Carries:
 *   - blockLabel: a neutral axis block label
 *   - cards: a frozen array of neutral display cards from the P75 export response
 *   - cardCount: the number of cards in this block
 *
 * GOVERNANCE: No score, no metric, no recommendation, no merged field.
 */
export type StockResearchProductSurfaceSampleReportBlock = {
  readonly blockLabel: string;
  readonly cards: readonly {
    readonly sourceName: string;
    readonly label: string;
    readonly status: string;
    readonly note?: string;
  }[];
  readonly cardCount: number;
};

// ─── Summary Block ────────────────────────────────────────────────────────────

/**
 * Count-only summary block.
 *
 * Contains exactly two fields: researchCardCount and simulationAuditCardCount.
 * No combined metric. No merged score. No aggregate field.
 */
export type StockResearchProductSurfaceSampleReportSummaryBlock = {
  readonly researchCardCount: number;
  readonly simulationAuditCardCount: number;
};

// ─── Response ─────────────────────────────────────────────────────────────────

/**
 * The P76 stock research product surface sample report contract response.
 *
 * Carries all 10 governance flags as literal constants.
 * Contains:
 *   - disclaimerBlock: fixed neutral disclaimer
 *   - researchReviewBlock: mapped from researchReviewSection (Axis A)
 *   - simulationInputAuditBlock: mapped from simulationInputAuditSection (Axis B)
 *   - summaryBlock: card counts only
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
export type StockResearchProductSurfaceSampleReportResponse = {
  readonly reportVersion: typeof STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_VERSION;
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
  readonly disclaimerBlock: StockResearchProductSurfaceSampleReportDisclaimerBlock;
  readonly researchReviewBlock: StockResearchProductSurfaceSampleReportBlock;
  readonly simulationInputAuditBlock: StockResearchProductSurfaceSampleReportBlock;
  readonly summaryBlock: StockResearchProductSurfaceSampleReportSummaryBlock;
};

// ─── Params ───────────────────────────────────────────────────────────────────

export type StockResearchProductSurfaceSampleReportContractParams = {
  readonly surfaceExportResponse: StockResearchProductSurfaceExportResponse;
  readonly fixedGeneratedAt?: string;
};

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates that a P75 StockResearchProductSurfaceExportResponse carries all
 * 10 required combined governance flags before it may enter the sample report
 * contract.
 *
 * Checks: reviewOnly, noInvestmentAdvice, noForecast, noRecommendation,
 *         previewOnly, paperOnly, noExecution, noActualMetrics,
 *         entersAlphaScore, notInvestmentAdvice.
 */
export function validateProductSurfaceExportForSampleReport(
  params: StockResearchProductSurfaceExportResponse,
): StockResearchProductSurfaceSampleReportValidationResult {
  if (params.reviewOnly !== true) {
    return { valid: false, reason: "Governance validation failed: reviewOnly" };
  }
  if (params.noInvestmentAdvice !== true) {
    return { valid: false, reason: "Governance validation failed: noInvestmentAdvice" };
  }
  if (params.noForecast !== true) {
    return { valid: false, reason: "Governance validation failed: noForecast" };
  }
  if (params.noRecommendation !== true) {
    return { valid: false, reason: "Governance validation failed: noRecommendation" };
  }
  if (params.previewOnly !== true) {
    return { valid: false, reason: "Governance validation failed: previewOnly" };
  }
  if (params.paperOnly !== true) {
    return { valid: false, reason: "Governance validation failed: paperOnly" };
  }
  if (params.noExecution !== true) {
    return { valid: false, reason: "Governance validation failed: noExecution" };
  }
  if (params.noActualMetrics !== true) {
    return { valid: false, reason: "Governance validation failed: noActualMetrics" };
  }
  if (params.entersAlphaScore !== false) {
    return { valid: false, reason: "Governance validation failed: entersAlphaScore" };
  }
  if (params.notInvestmentAdvice !== true) {
    return { valid: false, reason: "Governance validation failed: notInvestmentAdvice" };
  }
  return { valid: true };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds a frozen StockResearchProductSurfaceSampleReportResponse from a validated
 * P75 StockResearchProductSurfaceExportResponse.
 *
 * Steps:
 *   1. Validates all 10 governance flags — throws on any violation.
 *   2. Builds disclaimerBlock with fixed neutral lines.
 *   3. Maps researchReviewSection → researchReviewBlock (neutral label).
 *   4. Maps simulationInputAuditSection → simulationInputAuditBlock (neutral label).
 *   5. Assembles summaryBlock with card counts only.
 *   6. Returns Object.freeze({...} satisfies StockResearchProductSurfaceSampleReportResponse).
 *
 * Throws if validation fails.
 * Does not mutate input.
 */
export function buildStockResearchProductSurfaceSampleReport(
  params: StockResearchProductSurfaceSampleReportContractParams,
): StockResearchProductSurfaceSampleReportResponse {
  const { surfaceExportResponse, fixedGeneratedAt } = params;

  const validation = validateProductSurfaceExportForSampleReport(surfaceExportResponse);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();
  const reportTitle = "Stock Research Product Surface Sample Report";

  const disclaimerBlock = Object.freeze({
    disclaimerLabel: "Disclaimer",
    lines: Object.freeze([
      "This report is review-only and not investment advice.",
      "No forecast is implied or generated.",
      "No trading execution is authorized or implied.",
    ] as const),
  } satisfies StockResearchProductSurfaceSampleReportDisclaimerBlock);

  const researchReviewBlock = Object.freeze({
    blockLabel: "Research Review",
    cards: Object.freeze(
      surfaceExportResponse.researchReviewSection.cards.map((c) =>
        Object.freeze(
          c.note !== undefined
            ? { sourceName: c.sourceName, label: c.label, status: c.status, note: c.note }
            : { sourceName: c.sourceName, label: c.label, status: c.status },
        ),
      ),
    ),
    cardCount: surfaceExportResponse.researchReviewSection.cardCount,
  } satisfies StockResearchProductSurfaceSampleReportBlock);

  const simulationInputAuditBlock = Object.freeze({
    blockLabel: "Simulation Input Audit",
    cards: Object.freeze(
      surfaceExportResponse.simulationInputAuditSection.cards.map((c) =>
        Object.freeze(
          c.note !== undefined
            ? { sourceName: c.sourceName, label: c.label, status: c.status, note: c.note }
            : { sourceName: c.sourceName, label: c.label, status: c.status },
        ),
      ),
    ),
    cardCount: surfaceExportResponse.simulationInputAuditSection.cardCount,
  } satisfies StockResearchProductSurfaceSampleReportBlock);

  const summaryBlock = Object.freeze({
    researchCardCount: surfaceExportResponse.exportSummary.researchCardCount,
    simulationAuditCardCount: surfaceExportResponse.exportSummary.simulationAuditCardCount,
  } satisfies StockResearchProductSurfaceSampleReportSummaryBlock);

  return Object.freeze({
    reportVersion: STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_VERSION,
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
    reportTitle,
    disclaimerBlock,
    researchReviewBlock,
    simulationInputAuditBlock,
    summaryBlock,
  } satisfies StockResearchProductSurfaceSampleReportResponse);
}
