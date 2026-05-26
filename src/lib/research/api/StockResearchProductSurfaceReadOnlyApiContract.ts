/**
 * P81 — Stock Research Product Surface Read-Only API Contract
 *
 * Accepts a caller-supplied P80 StockResearchProductSurfaceReportExportMetadataEnvelope,
 * validates all 10 governance flags, and produces a frozen, JSON-safe,
 * in-memory API-like response object.
 *
 * Response structure:
 *   - status: "ok"
 *   - version: P81 versioned string constant
 *   - generatedAt: ISO timestamp (fixedGeneratedAt or now)
 *   - fileName: from P80 envelope
 *   - mimeType: from P80 envelope
 *   - contentBody: from P80 envelope
 *   - metadata: from P80 envelope (frozen)
 *   - governanceFlags: all 10 flags echoed as frozen object
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
 *   - Pure function — no DB, no Prisma, no network, no filesystem, no subprocess
 *   - Imports only types from upstream P80 export metadata module (import type)
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate input envelope
 *   - Throws StockResearchProductSurfaceReadOnlyApiContractGovernanceError on any governance violation
 *   - No binary-data writer, raw-byte output, or file-write operation
 *   - No endpoint, route, server handler, HTTP handler, UI component
 *   - No server runtime, no edge runtime
 *
 * Authorization:
 *   P81-GATE 2026-05-26
 *   Token: P81_GATE_READ_ONLY_PRODUCT_API_CONTRACT_APPROVED_WITH_STRICT_SCOPE
 *   Upstream baseline: P80 — StockResearchProductSurfaceReportExportMetadata (cefb371)
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import type {
  StockResearchProductSurfaceReportExportMetadataEnvelope,
  StockResearchProductSurfaceReportExportMetadataRecord,
} from "../export/StockResearchProductSurfaceReportExportMetadata";

// ─── Version ──────────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_VERSION =
  "p81-stock-research-product-surface-read-only-api-contract-v0" as const;

// ─── Governance ───────────────────────────────────────────────────────────────

export const STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_GOVERNANCE = Object.freeze({
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

// ─── Governance Flags Shape ───────────────────────────────────────────────────

export type StockResearchProductSurfaceReadOnlyApiContractGovernanceFlags = {
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
};

// ─── Validation Result ────────────────────────────────────────────────────────

export type StockResearchProductSurfaceReadOnlyApiContractValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

// ─── Response ─────────────────────────────────────────────────────────────────

/**
 * The P81 frozen in-memory API-like response object.
 *
 * Contains:
 *   - status: "ok"
 *   - version: P81 version constant
 *   - generatedAt: ISO timestamp
 *   - fileName: from P80 envelope
 *   - mimeType: from P80 envelope
 *   - contentBody: from P80 envelope
 *   - metadata: from P80 envelope (frozen)
 *   - governanceFlags: all 10 flags (frozen)
 *
 * No score, no metric, no recommendation, no merged field.
 * No route. No HTTP handler. No endpoint.
 */
export type StockResearchProductSurfaceReadOnlyApiContractResponse = {
  readonly status: "ok";
  readonly version: typeof STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_VERSION;
  readonly generatedAt: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly contentBody: string;
  readonly metadata: StockResearchProductSurfaceReportExportMetadataRecord;
  readonly governanceFlags: StockResearchProductSurfaceReadOnlyApiContractGovernanceFlags;
};

// ─── Params ───────────────────────────────────────────────────────────────────

export type StockResearchProductSurfaceReadOnlyApiContractParams = {
  readonly envelope: StockResearchProductSurfaceReportExportMetadataEnvelope;
  readonly fixedGeneratedAt?: string;
};

// ─── Governance Error ─────────────────────────────────────────────────────────

export class StockResearchProductSurfaceReadOnlyApiContractGovernanceError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "StockResearchProductSurfaceReadOnlyApiContractGovernanceError";
  }
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates that a P80 StockResearchProductSurfaceReportExportMetadataEnvelope
 * carries all 10 required governance flags before it may enter the
 * read-only API contract builder.
 *
 * Checks: reviewOnly, noInvestmentAdvice, noForecast, noRecommendation,
 *         previewOnly, paperOnly, noExecution, noActualMetrics,
 *         entersAlphaScore, notInvestmentAdvice.
 */
export function validateExportMetadataForReadOnlyApiContract(
  params: StockResearchProductSurfaceReportExportMetadataEnvelope,
): StockResearchProductSurfaceReadOnlyApiContractValidationResult {
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
 * Builds a frozen StockResearchProductSurfaceReadOnlyApiContractResponse from
 * a validated P80 StockResearchProductSurfaceReportExportMetadataEnvelope.
 *
 * Steps:
 *   1. Validates all 10 governance flags — throws StockResearchProductSurfaceReadOnlyApiContractGovernanceError on any violation.
 *   2. Derives generatedAt from fixedGeneratedAt param or new Date().
 *   3. Preserves fileName / mimeType / contentBody / metadata from P80 envelope.
 *   4. Echoes all 10 governance flags into a frozen governanceFlags object.
 *   5. Returns Object.freeze({...} satisfies StockResearchProductSurfaceReadOnlyApiContractResponse).
 *
 * Throws StockResearchProductSurfaceReadOnlyApiContractGovernanceError if validation fails.
 * Does not mutate input.
 * No filesystem write. No endpoint. No DB. No scoring. No network call.
 */
export function buildStockResearchProductSurfaceReadOnlyApiContract(
  params: StockResearchProductSurfaceReadOnlyApiContractParams,
): StockResearchProductSurfaceReadOnlyApiContractResponse {
  const { envelope, fixedGeneratedAt } = params;

  const validation = validateExportMetadataForReadOnlyApiContract(envelope);
  if (!validation.valid) {
    throw new StockResearchProductSurfaceReadOnlyApiContractGovernanceError(validation.reason);
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();

  const governanceFlags = Object.freeze({
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
  } satisfies StockResearchProductSurfaceReadOnlyApiContractGovernanceFlags);

  const metadata = Object.freeze({
    artifactVersion: envelope.metadata.artifactVersion,
    artifactTitle: envelope.metadata.artifactTitle,
    researchCardCount: envelope.metadata.researchCardCount,
    simulationAuditCardCount: envelope.metadata.simulationAuditCardCount,
  } satisfies StockResearchProductSurfaceReportExportMetadataRecord);

  return Object.freeze({
    status: "ok",
    version: STOCK_RESEARCH_PRODUCT_SURFACE_READ_ONLY_API_CONTRACT_VERSION,
    generatedAt,
    fileName: envelope.fileName,
    mimeType: envelope.mimeType,
    contentBody: envelope.contentBody,
    metadata,
    governanceFlags,
  } satisfies StockResearchProductSurfaceReadOnlyApiContractResponse);
}
