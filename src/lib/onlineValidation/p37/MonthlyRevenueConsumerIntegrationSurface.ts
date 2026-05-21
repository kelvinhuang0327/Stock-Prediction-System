/**
 * P37 — MonthlyRevenue Consumer Integration Surface
 *
 * Provides a read-only integration surface for downstream pipelines to safely
 * consume MonthlyRevenue controlled consumer readiness results.
 *
 * This module is layered on top of P36 (MonthlyRevenueControlledConsumerReadiness).
 * It produces a structured, serializable payload that enforces all P36 governance
 * invariants and adds an integration-surface-level contract.
 *
 * This surface does NOT:
 *   - Access or modify the database
 *   - Produce alpha scores, predictions, or recommendations
 *   - Produce buy/sell/hold signals or investment advice
 *   - Modify any scoring formula or optimizer input
 *
 * DISCLAIMER: Read-only integration surface. Does not constitute investment advice.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 * MonthlyRevenue entersAlphaScore = false. ALWAYS.
 * Results must not be used as buy/sell/hold signals or investment recommendations.
 */

import {
  CONTROLLED_CONSUMER_CONTRACT_DISCLAIMER,
  CONTROLLED_CONSUMER_CONTRACT_VERSION,
  FORBIDDEN_CONSUMER_OUTPUT_FIELDS,
} from "../p36/MonthlyRevenueControlledConsumerContract";
import {
  type ConsumerBatchReadinessResult,
  type ConsumerReadinessClassification,
  type MonthlyRevenueConsumerInputRow,
} from "../p36/MonthlyRevenueControlledConsumerReadiness";

// ─── Integration Surface Version ─────────────────────────────────────────────

export const INTEGRATION_SURFACE_VERSION =
  "p37-monthly-revenue-consumer-integration-surface-v1";

export const INTEGRATION_SURFACE_DISCLAIMER =
  "Read-only controlled consumer integration surface. Does not constitute investment advice. " +
  "No profit, return, win-rate, edge, or investment performance claims are made. " +
  "MonthlyRevenue entersAlphaScore = false. ALWAYS. " +
  "Results must not be used as buy/sell/hold signals, investment recommendations, " +
  "optimizer inputs, or backtest inputs. " +
  CONTROLLED_CONSUMER_CONTRACT_DISCLAIMER;

// ─── Payload Types ────────────────────────────────────────────────────────────

export interface MonthlyRevenueConsumerPayloadRow {
  symbol: string;
  revenueMonth: string;
  classification: ConsumerReadinessClassification;
  consumerReady: boolean;
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  revenueAvailable: boolean;
  releaseMetadataComplete: boolean;
  pitBoundaryRespected: boolean;
  auditNotes: string[];
  entersAlphaScore: false;
  paperOnly: true;
  dryRunOnly: true;
}

export interface MonthlyRevenueConsumerPayload {
  sourceName: "MonthlyRevenue";
  surfaceMode: "controlled-consumer-integration";
  generatedAt: string;
  dryRunOnly: true;
  paperOnly: true;
  entersAlphaScore: false;
  notInvestmentRecommendation: true;
  noBuySellActionSemantics: true;
  rowCount: number;
  consumerReadyRows: number;
  warningRows: number;
  blockedRows: number;
  confidenceDistribution: { HIGH: number; MEDIUM: number; LOW: number };
  readinessClassifications: Record<ConsumerReadinessClassification, number>;
  auditNotes: string[];
  sourceTrace: string;
  rows?: MonthlyRevenueConsumerPayloadRow[];
  version: string;
  disclaimer: string;
}

// ─── Payload Validation ───────────────────────────────────────────────────────

export interface PayloadValidationResult {
  valid: boolean;
  violations: string[];
}

/**
 * Validate a MonthlyRevenueConsumerPayload against all integration surface invariants.
 */
export function validateMonthlyRevenueConsumerPayload(
  payload: MonthlyRevenueConsumerPayload
): PayloadValidationResult {
  const violations: string[] = [];

  // Governance invariants
  if (payload.sourceName !== "MonthlyRevenue") {
    violations.push(`sourceName must be "MonthlyRevenue", got: ${payload.sourceName}`);
  }
  if (payload.surfaceMode !== "controlled-consumer-integration") {
    violations.push(`surfaceMode must be "controlled-consumer-integration", got: ${payload.surfaceMode}`);
  }
  if (payload.dryRunOnly !== true) {
    violations.push("dryRunOnly must be true");
  }
  if (payload.paperOnly !== true) {
    violations.push("paperOnly must be true");
  }
  if (payload.entersAlphaScore !== false) {
    violations.push("entersAlphaScore must be false — invariant violation");
  }
  if (payload.notInvestmentRecommendation !== true) {
    violations.push("notInvestmentRecommendation must be true");
  }
  if (payload.noBuySellActionSemantics !== true) {
    violations.push("noBuySellActionSemantics must be true");
  }

  // Count sanity
  if (typeof payload.rowCount !== "number" || payload.rowCount < 0) {
    violations.push("rowCount must be a non-negative number");
  }
  if (typeof payload.consumerReadyRows !== "number" || payload.consumerReadyRows < 0) {
    violations.push("consumerReadyRows must be a non-negative number");
  }
  if (typeof payload.warningRows !== "number" || payload.warningRows < 0) {
    violations.push("warningRows must be a non-negative number");
  }
  if (typeof payload.blockedRows !== "number" || payload.blockedRows < 0) {
    violations.push("blockedRows must be a non-negative number");
  }
  if (
    payload.rowCount > 0 &&
    payload.consumerReadyRows + payload.warningRows + payload.blockedRows !== payload.rowCount
  ) {
    violations.push(
      `consumerReadyRows(${payload.consumerReadyRows}) + warningRows(${payload.warningRows}) + blockedRows(${payload.blockedRows}) must equal rowCount(${payload.rowCount})`
    );
  }

  // Forbidden fields in payload root
  for (const forbidden of FORBIDDEN_CONSUMER_OUTPUT_FIELDS) {
    if (forbidden in payload) {
      violations.push(`Payload contains forbidden field: "${forbidden}"`);
    }
  }

  // Forbidden fields in rows (if present)
  if (payload.rows) {
    for (let i = 0; i < payload.rows.length; i++) {
      const row = payload.rows[i];
      for (const forbidden of FORBIDDEN_CONSUMER_OUTPUT_FIELDS) {
        if (forbidden in row) {
          violations.push(`Row[${i}] contains forbidden field: "${forbidden}"`);
        }
      }
      if (row.entersAlphaScore !== false) {
        violations.push(`Row[${i}] entersAlphaScore must be false`);
      }
      if (row.paperOnly !== true) {
        violations.push(`Row[${i}] paperOnly must be true`);
      }
      if (row.dryRunOnly !== true) {
        violations.push(`Row[${i}] dryRunOnly must be true`);
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

// ─── Payload Builder ──────────────────────────────────────────────────────────

export interface BuildPayloadOptions {
  includeRows?: boolean;
  asOfDate?: string;
}

/**
 * Build a MonthlyRevenueConsumerPayload from a P36 batch readiness result.
 *
 * @param batchResult - result from evaluateBatchConsumerReadiness (P36)
 * @param inputRows - original input rows (needed when includeRows=true)
 * @param rowClassifications - per-row results (from P37 adapter)
 * @param options - build options
 */
export function buildMonthlyRevenueConsumerPayload(
  batchResult: ConsumerBatchReadinessResult,
  rowClassifications: MonthlyRevenueConsumerPayloadRow[],
  options: BuildPayloadOptions = {}
): MonthlyRevenueConsumerPayload {
  const { includeRows = false } = options;

  const readinessClassifications: Record<ConsumerReadinessClassification, number> = {
    CONSUMER_READY: 0,
    CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING: 0,
    CONSUMER_BLOCKED_MISSING_METADATA: 0,
    CONSUMER_BLOCKED_PIT_VIOLATION: 0,
    CONSUMER_BLOCKED_FORBIDDEN_FIELD: 0,
  };

  // Populate from batchResult blockedBreakdown
  for (const [key, count] of Object.entries(batchResult.blockedBreakdown)) {
    const k = key as ConsumerReadinessClassification;
    readinessClassifications[k] = count;
  }

  const auditNotes: string[] = [
    `Integration surface built from P36 batch evaluator result`,
    `rowCount=${batchResult.rowCount}, consumerReady=${batchResult.consumerReadyRows}, warning=${batchResult.warningRows}, blocked=${batchResult.blockedRows}`,
    `overallClassification=${batchResult.overallClassification}`,
    `entersAlphaScore=false enforced at integration surface level`,
    `surfaceMode=controlled-consumer-integration`,
  ];

  const payload: MonthlyRevenueConsumerPayload = {
    sourceName: "MonthlyRevenue",
    surfaceMode: "controlled-consumer-integration",
    generatedAt: new Date().toISOString(),
    dryRunOnly: true,
    paperOnly: true,
    entersAlphaScore: false,
    notInvestmentRecommendation: true,
    noBuySellActionSemantics: true,
    rowCount: batchResult.rowCount,
    consumerReadyRows: batchResult.consumerReadyRows,
    warningRows: batchResult.warningRows,
    blockedRows: batchResult.blockedRows,
    confidenceDistribution: { ...batchResult.confidenceDistribution },
    readinessClassifications,
    auditNotes,
    sourceTrace: `P37 integration surface — P36 evaluator v${CONTROLLED_CONSUMER_CONTRACT_VERSION}`,
    version: INTEGRATION_SURFACE_VERSION,
    disclaimer: INTEGRATION_SURFACE_DISCLAIMER,
  };

  if (includeRows) {
    payload.rows = rowClassifications;
  }

  return payload;
}

// ─── Payload Summarizer ───────────────────────────────────────────────────────

export interface PayloadSummary {
  sourceName: "MonthlyRevenue";
  surfaceMode: "controlled-consumer-integration";
  rowCount: number;
  consumerReadyRows: number;
  warningRows: number;
  blockedRows: number;
  readyRate: string;
  warningRate: string;
  blockedRate: string;
  topClassification: ConsumerReadinessClassification | "CONSUMER_BATCH_READY" | "CONSUMER_BATCH_BLOCKED";
  entersAlphaScore: false;
  generatedAt: string;
}

/**
 * Summarize a MonthlyRevenueConsumerPayload into a compact, deterministic summary.
 */
export function summarizeMonthlyRevenueConsumerPayload(
  payload: MonthlyRevenueConsumerPayload
): PayloadSummary {
  const total = payload.rowCount;
  const pct = (n: number): string =>
    total === 0 ? "0.00%" : `${((n / total) * 100).toFixed(2)}%`;

  // Determine top classification
  let topClassification: ConsumerReadinessClassification | "CONSUMER_BATCH_READY" | "CONSUMER_BATCH_BLOCKED";
  if (payload.blockedRows === 0 && payload.warningRows === 0) {
    topClassification = "CONSUMER_BATCH_READY";
  } else if (payload.blockedRows > 0) {
    topClassification = "CONSUMER_BATCH_BLOCKED";
    // Find the dominant blocked classification
    const blocked: Array<[ConsumerReadinessClassification, number]> = [
      ["CONSUMER_BLOCKED_MISSING_METADATA", payload.readinessClassifications.CONSUMER_BLOCKED_MISSING_METADATA],
      ["CONSUMER_BLOCKED_PIT_VIOLATION", payload.readinessClassifications.CONSUMER_BLOCKED_PIT_VIOLATION],
      ["CONSUMER_BLOCKED_FORBIDDEN_FIELD", payload.readinessClassifications.CONSUMER_BLOCKED_FORBIDDEN_FIELD],
    ];
    const dominantBlocked = blocked.reduce((a, b) => (a[1] >= b[1] ? a : b));
    if (dominantBlocked[1] > 0) {
      topClassification = dominantBlocked[0];
    }
  } else {
    topClassification = "CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING";
  }

  return {
    sourceName: "MonthlyRevenue",
    surfaceMode: "controlled-consumer-integration",
    rowCount: total,
    consumerReadyRows: payload.consumerReadyRows,
    warningRows: payload.warningRows,
    blockedRows: payload.blockedRows,
    readyRate: pct(payload.consumerReadyRows),
    warningRate: pct(payload.warningRows),
    blockedRate: pct(payload.blockedRows),
    topClassification,
    entersAlphaScore: false,
    generatedAt: payload.generatedAt,
  };
}
