/**
 * P77 — Stock Research Product Surface Sample Report Fixture
 *
 * Accepts a caller-supplied P76 StockResearchProductSurfaceSampleReportResponse,
 * validates all 10 combined governance flags, and produces a frozen,
 * JSON-safe, deterministic fixture response with all 4 blocks preserved from
 * the P76 input:
 *   - disclaimerBlock: preserved from P76 input, frozen
 *   - researchReviewBlock: preserved from P76 input, frozen (Axis A)
 *   - simulationInputAuditBlock: preserved from P76 input, frozen (Axis B)
 *   - summaryBlock: preserved from P76 input, frozen
 *
 * Non-merge boundary:
 *   - researchReviewBlock and simulationInputAuditBlock are NOT merged.
 *   - No combined score, verdict, prediction, strategy, or aggregate metric.
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
 *   - Imports only types from upstream P76 sample report contract module (import type)
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate input sample report response
 *   - Throws on any governance flag violation from the P76 sample report response
 *
 * Neutral labels:
 *   - sampleTitle: "Stock Research Product Surface Sample Report Fixture"
 *
 * Authorization:
 *   P77-GATE 2026-05-26
 *   Token: P77_GATE_SAMPLE_REPORT_FIXTURE_APPROVED_WITH_STRICT_SCOPE
 *   Upstream baseline: P76 — StockResearchProductSurfaceSampleReportContract (d8816f8)
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import type { StockResearchProductSurfaceSampleReportResponse } from "./StockResearchProductSurfaceSampleReportContract";

// ─── Version ──────────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_VERSION =
  "p77-stock-research-product-surface-sample-report-fixture-v0" as const;

// ─── Governance ───────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE = Object.freeze({
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

export type StockResearchProductSurfaceSampleReportFixtureValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

// ─── Response ─────────────────────────────────────────────────────────────────

/**
 * The P77 stock research product surface sample report fixture response.
 *
 * Carries all 10 governance flags as literal constants.
 * Contains all 4 blocks preserved from the P76 sample report input:
 *   - disclaimerBlock: preserved from P76 input
 *   - researchReviewBlock: preserved from P76 input (Axis A)
 *   - simulationInputAuditBlock: preserved from P76 input (Axis B)
 *   - summaryBlock: preserved from P76 input
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
export type StockResearchProductSurfaceSampleReportFixtureResponse = {
  readonly sampleVersion: typeof STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_VERSION;
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
  readonly sampleTitle: string;
  readonly disclaimerBlock: StockResearchProductSurfaceSampleReportResponse["disclaimerBlock"];
  readonly researchReviewBlock: StockResearchProductSurfaceSampleReportResponse["researchReviewBlock"];
  readonly simulationInputAuditBlock: StockResearchProductSurfaceSampleReportResponse["simulationInputAuditBlock"];
  readonly summaryBlock: StockResearchProductSurfaceSampleReportResponse["summaryBlock"];
};

// ─── Params ───────────────────────────────────────────────────────────────────

export type StockResearchProductSurfaceSampleReportFixtureParams = {
  readonly sampleReportResponse: StockResearchProductSurfaceSampleReportResponse;
  readonly fixedGeneratedAt?: string;
};

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates that a P76 StockResearchProductSurfaceSampleReportResponse carries
 * all 10 required combined governance flags before it may enter the fixture.
 *
 * Checks: reviewOnly, noInvestmentAdvice, noForecast, noRecommendation,
 *         previewOnly, paperOnly, noExecution, noActualMetrics,
 *         entersAlphaScore, notInvestmentAdvice.
 */
export function validateSampleReportForFixture(
  params: StockResearchProductSurfaceSampleReportResponse,
): StockResearchProductSurfaceSampleReportFixtureValidationResult {
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
 * Builds a frozen StockResearchProductSurfaceSampleReportFixtureResponse from a
 * validated P76 StockResearchProductSurfaceSampleReportResponse.
 *
 * Steps:
 *   1. Validates all 10 governance flags — throws on any violation.
 *   2. Preserves disclaimerBlock from P76 input (frozen).
 *   3. Preserves researchReviewBlock from P76 input (Axis A, frozen).
 *   4. Preserves simulationInputAuditBlock from P76 input (Axis B, frozen).
 *   5. Preserves summaryBlock from P76 input (frozen).
 *   6. Returns Object.freeze({...} satisfies StockResearchProductSurfaceSampleReportFixtureResponse).
 *
 * Throws if validation fails.
 * Does not mutate input.
 */
export function buildStockResearchProductSurfaceSampleReportFixture(
  params: StockResearchProductSurfaceSampleReportFixtureParams,
): StockResearchProductSurfaceSampleReportFixtureResponse {
  const { sampleReportResponse, fixedGeneratedAt } = params;

  const validation = validateSampleReportForFixture(sampleReportResponse);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();
  const sampleTitle = "Stock Research Product Surface Sample Report Fixture";

  const disclaimerBlock = Object.freeze({
    disclaimerLabel: sampleReportResponse.disclaimerBlock.disclaimerLabel,
    lines: Object.freeze(
      [...sampleReportResponse.disclaimerBlock.lines] as string[],
    ),
  } satisfies StockResearchProductSurfaceSampleReportResponse["disclaimerBlock"]);

  const researchReviewBlock = Object.freeze({
    blockLabel: sampleReportResponse.researchReviewBlock.blockLabel,
    cards: Object.freeze(
      sampleReportResponse.researchReviewBlock.cards.map((c) =>
        Object.freeze(
          c.note !== undefined
            ? { sourceName: c.sourceName, label: c.label, status: c.status, note: c.note }
            : { sourceName: c.sourceName, label: c.label, status: c.status },
        ),
      ),
    ),
    cardCount: sampleReportResponse.researchReviewBlock.cardCount,
  } satisfies StockResearchProductSurfaceSampleReportResponse["researchReviewBlock"]);

  const simulationInputAuditBlock = Object.freeze({
    blockLabel: sampleReportResponse.simulationInputAuditBlock.blockLabel,
    cards: Object.freeze(
      sampleReportResponse.simulationInputAuditBlock.cards.map((c) =>
        Object.freeze(
          c.note !== undefined
            ? { sourceName: c.sourceName, label: c.label, status: c.status, note: c.note }
            : { sourceName: c.sourceName, label: c.label, status: c.status },
        ),
      ),
    ),
    cardCount: sampleReportResponse.simulationInputAuditBlock.cardCount,
  } satisfies StockResearchProductSurfaceSampleReportResponse["simulationInputAuditBlock"]);

  const summaryBlock = Object.freeze({
    researchCardCount: sampleReportResponse.summaryBlock.researchCardCount,
    simulationAuditCardCount: sampleReportResponse.summaryBlock.simulationAuditCardCount,
  } satisfies StockResearchProductSurfaceSampleReportResponse["summaryBlock"]);

  return Object.freeze({
    sampleVersion: STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_VERSION,
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
    sampleTitle,
    disclaimerBlock,
    researchReviewBlock,
    simulationInputAuditBlock,
    summaryBlock,
  } satisfies StockResearchProductSurfaceSampleReportFixtureResponse);
}

// ─── Default Builder ──────────────────────────────────────────────────────────

/**
 * Builds a StockResearchProductSurfaceSampleReportFixtureResponse from the
 * caller-supplied P76 sample report response using the main build function.
 *
 * Delegates to buildStockResearchProductSurfaceSampleReportFixture internally.
 * Returns the same frozen response type.
 *
 * Throws if governance validation fails.
 */
export function buildDefaultStockResearchProductSurfaceSampleReportFixture(
  params: StockResearchProductSurfaceSampleReportFixtureParams,
): StockResearchProductSurfaceSampleReportFixtureResponse {
  return buildStockResearchProductSurfaceSampleReportFixture(params);
}
