/**
 * P78 — Stock Research Product Surface Static Sample Artifact
 *
 * Accepts a caller-supplied P77 StockResearchProductSurfaceSampleReportFixtureResponse,
 * validates all 10 combined governance flags, and produces a frozen,
 * JSON-safe, directly-inspectable in-memory artifact for CEO/product review.
 *
 * Artifact structure:
 *   - artifactVersion: versioned string constant
 *   - generatedAt: ISO timestamp (fixedGeneratedAt or now)
 *   - All 10 governance flags as literal constants
 *   - artifactTitle: neutral string
 *   - reportBlocks: 4 frozen artifact blocks built from P77 input blocks:
 *       [0] disclaimer   — from P77 disclaimerBlock
 *       [1] researchReview — from P77 researchReviewBlock (Axis A)
 *       [2] simulationInputAudit — from P77 simulationInputAuditBlock (Axis B)
 *       [3] summary      — from P77 summaryBlock (neutral counts)
 *   - artifactSummary: { summaryLabel, researchCardCount, simulationAuditCardCount }
 *
 * Non-merge boundary:
 *   - Axis A (researchReview) and Axis B (simulationInputAudit) blocks are NOT merged.
 *   - No combined score, verdict, prediction, strategy, or aggregate metric.
 *   - artifactSummary contains neutral counts only.
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
 *   - Imports only types from upstream P77 fixture module (import type)
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate input fixture response
 *   - Throws on any governance flag violation from the P77 fixture response
 *
 * Neutral labels used:
 *   - "Research review"
 *   - "Simulation input audit"
 *   - "Source status"
 *   - "Review note"
 *   - "Report Summary"
 *   - "This report is review-only and not investment advice."
 *
 * Authorization:
 *   P78-GATE 2026-05-26
 *   Token: P78_GATE_STATIC_SAMPLE_REPORT_ARTIFACT_APPROVED_WITH_STRICT_SCOPE
 *   Upstream baseline: P77 — StockResearchProductSurfaceSampleReportFixture (29edb28)
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import type {
  StockResearchProductSurfaceSampleReportFixtureResponse,
} from "./StockResearchProductSurfaceSampleReportFixture";

// ─── Version ──────────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_VERSION =
  "p78-stock-research-product-surface-static-sample-artifact-v0" as const;

// ─── Governance ───────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE = Object.freeze({
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

export type StockResearchProductSurfaceStaticSampleArtifactValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

// ─── Artifact Block ───────────────────────────────────────────────────────────

/**
 * A single neutral artifact block in the static sample artifact response.
 *
 * Carries:
 *   - blockKey: a stable identifier for the block source
 *   - blockLabel: neutral human-readable label
 *   - lines: markdown-safe, JSON-safe neutral text lines
 *
 * GOVERNANCE: No score, no metric, no recommendation, no merged field.
 */
export type StockResearchProductSurfaceStaticSampleArtifactBlock = {
  readonly blockKey: string;
  readonly blockLabel: string;
  readonly lines: readonly string[];
};

// ─── Artifact Summary ─────────────────────────────────────────────────────────

/**
 * Count-only artifact summary.
 *
 * Contains exactly:
 *   - summaryLabel: neutral label string
 *   - researchCardCount: number of research review cards
 *   - simulationAuditCardCount: number of simulation input audit cards
 *
 * No combined metric. No merged score. No aggregate field.
 */
export type StockResearchProductSurfaceStaticSampleArtifactSummary = {
  readonly summaryLabel: string;
  readonly researchCardCount: number;
  readonly simulationAuditCardCount: number;
};

// ─── Response ─────────────────────────────────────────────────────────────────

/**
 * The P78 stock research product surface static sample artifact response.
 *
 * Carries all 10 governance flags as literal constants.
 * Contains:
 *   - reportBlocks: 4 frozen artifact blocks (disclaimer, researchReview,
 *                   simulationInputAudit, summary)
 *   - artifactSummary: neutral counts only
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
export type StockResearchProductSurfaceStaticSampleArtifactResponse = {
  readonly artifactVersion: typeof STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_VERSION;
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
  readonly artifactTitle: string;
  readonly reportBlocks: readonly StockResearchProductSurfaceStaticSampleArtifactBlock[];
  readonly artifactSummary: StockResearchProductSurfaceStaticSampleArtifactSummary;
};

// ─── Params ───────────────────────────────────────────────────────────────────

export type StockResearchProductSurfaceStaticSampleArtifactParams = {
  readonly fixtureResponse: StockResearchProductSurfaceSampleReportFixtureResponse;
  readonly fixedGeneratedAt?: string;
};

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates that a P77 StockResearchProductSurfaceSampleReportFixtureResponse
 * carries all 10 required combined governance flags before it may enter the
 * static sample artifact builder.
 *
 * Checks: reviewOnly, noInvestmentAdvice, noForecast, noRecommendation,
 *         previewOnly, paperOnly, noExecution, noActualMetrics,
 *         entersAlphaScore, notInvestmentAdvice.
 */
export function validateFixtureForStaticSampleArtifact(
  params: StockResearchProductSurfaceSampleReportFixtureResponse,
): StockResearchProductSurfaceStaticSampleArtifactValidationResult {
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
 * Builds a frozen StockResearchProductSurfaceStaticSampleArtifactResponse from
 * a validated P77 StockResearchProductSurfaceSampleReportFixtureResponse.
 *
 * Steps:
 *   1. Validates all 10 governance flags — throws on any violation.
 *   2. Builds disclaimer artifact block from P77 disclaimerBlock.
 *   3. Builds researchReview artifact block from P77 researchReviewBlock (Axis A).
 *   4. Builds simulationInputAudit artifact block from P77 simulationInputAuditBlock (Axis B).
 *   5. Builds summary artifact block from P77 summaryBlock counts.
 *   6. Builds artifactSummary with neutral counts only.
 *   7. Returns Object.freeze({...} satisfies StockResearchProductSurfaceStaticSampleArtifactResponse).
 *
 * Throws if validation fails.
 * Does not mutate input.
 */
export function buildStockResearchProductSurfaceStaticSampleArtifact(
  params: StockResearchProductSurfaceStaticSampleArtifactParams,
): StockResearchProductSurfaceStaticSampleArtifactResponse {
  const { fixtureResponse, fixedGeneratedAt } = params;

  const validation = validateFixtureForStaticSampleArtifact(fixtureResponse);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();
  const artifactTitle = "Stock Research Product Surface Static Sample Artifact";

  const disclaimerBlock = Object.freeze({
    blockKey: "disclaimer",
    blockLabel: fixtureResponse.disclaimerBlock.disclaimerLabel,
    lines: Object.freeze([...fixtureResponse.disclaimerBlock.lines]),
  } satisfies StockResearchProductSurfaceStaticSampleArtifactBlock);

  const researchReviewLines: string[] = fixtureResponse.researchReviewBlock.cards.map((c) => {
    const base = `${c.label}: ${c.status}`;
    return c.note !== undefined ? `${base} — Review note: ${c.note}` : base;
  });

  const researchReviewBlock = Object.freeze({
    blockKey: "researchReview",
    blockLabel: fixtureResponse.researchReviewBlock.blockLabel,
    lines: Object.freeze(researchReviewLines),
  } satisfies StockResearchProductSurfaceStaticSampleArtifactBlock);

  const simulationAuditLines: string[] = fixtureResponse.simulationInputAuditBlock.cards.map((c) => {
    const base = `${c.label}: ${c.status}`;
    return c.note !== undefined ? `${base} — Review note: ${c.note}` : base;
  });

  const simulationInputAuditBlock = Object.freeze({
    blockKey: "simulationInputAudit",
    blockLabel: fixtureResponse.simulationInputAuditBlock.blockLabel,
    lines: Object.freeze(simulationAuditLines),
  } satisfies StockResearchProductSurfaceStaticSampleArtifactBlock);

  const summaryBlock = Object.freeze({
    blockKey: "summary",
    blockLabel: "Report Summary",
    lines: Object.freeze([
      `Research review: ${fixtureResponse.summaryBlock.researchCardCount} card(s)`,
      `Simulation input audit: ${fixtureResponse.summaryBlock.simulationAuditCardCount} card(s)`,
      "This report is review-only and not investment advice.",
    ]),
  } satisfies StockResearchProductSurfaceStaticSampleArtifactBlock);

  const reportBlocks = Object.freeze([
    disclaimerBlock,
    researchReviewBlock,
    simulationInputAuditBlock,
    summaryBlock,
  ]);

  const artifactSummary = Object.freeze({
    summaryLabel: "Report Summary",
    researchCardCount: fixtureResponse.summaryBlock.researchCardCount,
    simulationAuditCardCount: fixtureResponse.summaryBlock.simulationAuditCardCount,
  } satisfies StockResearchProductSurfaceStaticSampleArtifactSummary);

  return Object.freeze({
    artifactVersion: STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_VERSION,
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
    artifactTitle,
    reportBlocks,
    artifactSummary,
  } satisfies StockResearchProductSurfaceStaticSampleArtifactResponse);
}
