/**
 * P80 — Stock Research Product Surface Report Export Metadata Contract
 *
 * Accepts a caller-supplied P78 StockResearchProductSurfaceStaticSampleArtifactResponse,
 * validates all 10 combined governance flags, and produces a frozen,
 * JSON-safe, directly-inspectable in-memory export metadata envelope.
 *
 * Envelope structure:
 *   - version: versioned string constant
 *   - generatedAt: ISO timestamp (fixedGeneratedAt or now)
 *   - All 10 governance flags as literal constants
 *   - fileName: deterministic neutral filename
 *   - mimeType: text/markdown; charset=utf-8
 *   - contentBody: markdown-safe neutral text derived from P78 artifact blocks
 *   - metadata: neutral metadata (artifactVersion, artifactTitle,
 *               researchCardCount, simulationAuditCardCount)
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
 *   - Imports only types from upstream P78 static sample artifact module (import type)
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate input artifact response
 *   - Throws on any governance flag violation from the P78 artifact response
 *   - No binary-data writer, raw-byte output, or file-write operation
 *   - No endpoint, route, server handler, UI component
 *
 * Neutral filename:
 *   - stock-research-product-surface-static-sample-artifact.md
 *
 * Neutral MIME type:
 *   - text/markdown; charset=utf-8
 *
 * Authorization:
 *   P79-GATE 2026-05-26
 *   Token: P79_GATE_PRODUCT_CHECKPOINT_CONSOLIDATION_DEFERRED
 *   Selected candidate: P80 — In-Memory Report Export Metadata Contract
 *   Upstream baseline: P78 — StockResearchProductSurfaceStaticSampleArtifact (70510e7)
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import type {
  StockResearchProductSurfaceStaticSampleArtifactResponse,
} from "../composition/StockResearchProductSurfaceStaticSampleArtifact";

// ─── Version ──────────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION =
  "p80-stock-research-product-surface-report-export-metadata-v0" as const;

// ─── Governance ───────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_GOVERNANCE = Object.freeze({
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

export type StockResearchProductSurfaceReportExportMetadataValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

// ─── Metadata ─────────────────────────────────────────────────────────────────

/**
 * Neutral in-memory metadata for the export envelope.
 *
 * Contains only:
 *   - artifactVersion: string from P78 artifact
 *   - artifactTitle: string from P78 artifact
 *   - researchCardCount: number of research review cards
 *   - simulationAuditCardCount: number of simulation input audit cards
 *
 * No score, no metric, no recommendation, no merged field.
 */
export type StockResearchProductSurfaceReportExportMetadataRecord = {
  readonly artifactVersion: string;
  readonly artifactTitle: string;
  readonly researchCardCount: number;
  readonly simulationAuditCardCount: number;
};

// ─── Envelope ─────────────────────────────────────────────────────────────────

/**
 * The P80 in-memory export metadata envelope.
 *
 * Carries all 10 governance flags as literal constants.
 * Contains:
 *   - fileName: deterministic neutral filename
 *   - mimeType: text/markdown; charset=utf-8
 *   - contentBody: markdown-safe neutral text from P78 artifact blocks
 *   - metadata: neutral record (artifactVersion, artifactTitle, counts)
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
export type StockResearchProductSurfaceReportExportMetadataEnvelope = {
  readonly version: typeof STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION;
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
  readonly fileName: string;
  readonly mimeType: string;
  readonly contentBody: string;
  readonly metadata: StockResearchProductSurfaceReportExportMetadataRecord;
};

// ─── Params ───────────────────────────────────────────────────────────────────

export type StockResearchProductSurfaceReportExportMetadataParams = {
  readonly artifactResponse: StockResearchProductSurfaceStaticSampleArtifactResponse;
  readonly fixedGeneratedAt?: string;
};

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates that a P78 StockResearchProductSurfaceStaticSampleArtifactResponse
 * carries all 10 required combined governance flags before it may enter the
 * export metadata builder.
 *
 * Checks: reviewOnly, noInvestmentAdvice, noForecast, noRecommendation,
 *         previewOnly, paperOnly, noExecution, noActualMetrics,
 *         entersAlphaScore, notInvestmentAdvice.
 */
export function validateStaticSampleArtifactForExportMetadata(
  params: StockResearchProductSurfaceStaticSampleArtifactResponse,
): StockResearchProductSurfaceReportExportMetadataValidationResult {
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
 * Builds a frozen StockResearchProductSurfaceReportExportMetadataEnvelope from
 * a validated P78 StockResearchProductSurfaceStaticSampleArtifactResponse.
 *
 * Steps:
 *   1. Validates all 10 governance flags — throws on any violation.
 *   2. Derives deterministic fileName and mimeType.
 *   3. Builds contentBody as markdown-safe neutral text from P78 reportBlocks.
 *   4. Builds neutral metadata record from P78 artifactSummary counts.
 *   5. Returns Object.freeze({...} satisfies StockResearchProductSurfaceReportExportMetadataEnvelope).
 *
 * Throws if validation fails.
 * Does not mutate input.
 * No filesystem write. No endpoint. No DB. No scoring.
 */
export function buildStockResearchProductSurfaceReportExportMetadata(
  params: StockResearchProductSurfaceReportExportMetadataParams,
): StockResearchProductSurfaceReportExportMetadataEnvelope {
  const { artifactResponse, fixedGeneratedAt } = params;

  const validation = validateStaticSampleArtifactForExportMetadata(artifactResponse);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();
  const fileName = "stock-research-product-surface-static-sample-artifact.md";
  const mimeType = "text/markdown; charset=utf-8";

  const contentLines: string[] = [];
  for (const block of artifactResponse.reportBlocks) {
    contentLines.push(`## ${block.blockLabel}`);
    contentLines.push("");
    for (const line of block.lines) {
      contentLines.push(line);
    }
    contentLines.push("");
  }
  const contentBody = contentLines.join("\n");

  const metadata = Object.freeze({
    artifactVersion: artifactResponse.artifactVersion,
    artifactTitle: artifactResponse.artifactTitle,
    researchCardCount: artifactResponse.artifactSummary.researchCardCount,
    simulationAuditCardCount: artifactResponse.artifactSummary.simulationAuditCardCount,
  } satisfies StockResearchProductSurfaceReportExportMetadataRecord);

  return Object.freeze({
    version: STOCK_RESEARCH_PRODUCT_SURFACE_REPORT_EXPORT_METADATA_VERSION,
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
    fileName,
    mimeType,
    contentBody,
    metadata,
  } satisfies StockResearchProductSurfaceReportExportMetadataEnvelope);
}
