/**
 * P36 — MonthlyRevenue Controlled Feature Consumer Readiness Evaluator
 *
 * Evaluates whether a MonthlyRevenue row or batch is safe for consumption
 * by a controlled downstream feature consumer. Enforces PIT boundary,
 * metadata completeness, and forbidden-field rules.
 *
 * This module is pure TypeScript — no DB access, no side effects, deterministic.
 * It does NOT produce scores, predictions, recommendations, or investment advice.
 *
 * DISCLAIMER: Structural audit evaluator only. Does not constitute investment advice.
 * No profit, return, win-rate, or investment performance claims are made.
 * MonthlyRevenue entersAlphaScore = false. ALWAYS.
 * Results must not be used as buy/sell/hold signals or investment recommendations.
 */

import {
  MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT,
  CONTROLLED_CONSUMER_CONTRACT_VERSION,
  CONTROLLED_CONSUMER_CONTRACT_DISCLAIMER,
  FORBIDDEN_CONSUMER_OUTPUT_FIELDS,
  mapConfidenceTier,
  type ConfidenceTier,
} from "./MonthlyRevenueControlledConsumerContract";

// ─── Consumer Readiness Classification ──────────────────────────────────────

export type ConsumerReadinessClassification =
  | "CONSUMER_READY"
  | "CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING"
  | "CONSUMER_BLOCKED_MISSING_METADATA"
  | "CONSUMER_BLOCKED_PIT_VIOLATION"
  | "CONSUMER_BLOCKED_FORBIDDEN_FIELD";

// ─── Row Input Type ──────────────────────────────────────────────────────────

export interface MonthlyRevenueConsumerInputRow {
  symbol: string;
  revenueMonth: string; // "YYYY-MM" format
  revenue: number | null;
  releaseDate: string | Date | null;
  releaseDateSource: string | null;
  releaseDateConfidence: string | null;
  asOfDate: string | Date | null;
  sourceTrace?: string | null;
  [key: string]: unknown;
}

// ─── Row Readiness Result ────────────────────────────────────────────────────

export interface ConsumerRowReadinessResult {
  symbol: string;
  revenueMonth: string;
  classification: ConsumerReadinessClassification;
  consumerReady: boolean;
  confidenceTier: ConfidenceTier;
  revenueAvailable: boolean;
  releaseMetadataComplete: boolean;
  pitBoundaryRespected: boolean;
  forbiddenFieldViolations: string[];
  auditNotes: string[];
  entersAlphaScore: false;
  paperOnly: true;
  dryRunOnly: true;
}

// ─── Batch Readiness Result ──────────────────────────────────────────────────

export interface ConsumerBatchReadinessResult {
  sourceName: "MonthlyRevenue";
  consumerMode: "controlled-feature-consumer-readiness";
  rowCount: number;
  consumerReadyRows: number;
  warningRows: number;
  blockedRows: number;
  blockedBreakdown: Record<ConsumerReadinessClassification, number>;
  confidenceDistribution: Record<ConfidenceTier, number>;
  readinessConclusion: string;
  overallClassification: ConsumerReadinessClassification | "CONSUMER_BATCH_READY" | "CONSUMER_BATCH_BLOCKED";
  entersAlphaScore: false;
  dryRunOnly: true;
  paperOnly: true;
  noBuySellActionSemantics: true;
  version: string;
  disclaimer: string;
}

// ─── Future-looking Fields ───────────────────────────────────────────────────

const FUTURE_LOOKING_FIELDS: readonly string[] = [
  "returnPct",
  "outcomePrice",
  "realizedReturn",
  "forwardReturn",
  "predictedPrice",
  "futurePrice",
  "expectedReturn",
  "profitLoss",
  "winRate",
  "edgeScore",
  "alphaScore",
  "prediction",
  "recommendation",
  "signal",
  "alpha",
  "score",
  "buy",
  "sell",
  "hold",
  "targetPrice",
  "profit",
];

// ─── Row-level Evaluator ─────────────────────────────────────────────────────

/**
 * Evaluate a single MonthlyRevenue row for controlled consumer readiness.
 *
 * Checks (in order):
 * 1. Forbidden fields absent
 * 2. releaseDate present → else CONSUMER_BLOCKED_MISSING_METADATA
 * 3. releaseDateSource present → else CONSUMER_BLOCKED_MISSING_METADATA
 * 4. releaseDateConfidence present → else CONSUMER_BLOCKED_MISSING_METADATA
 * 5. asOfDate >= releaseDate (PIT boundary) → else CONSUMER_BLOCKED_PIT_VIOLATION
 * 6. No future-looking fields → else CONSUMER_BLOCKED_FORBIDDEN_FIELD
 * 7. If confidence LOW and allowLowConfidenceConsumerAccess=false → CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING
 * 8. CONSUMER_READY
 */
export function evaluateRowConsumerReadiness(
  row: MonthlyRevenueConsumerInputRow,
  options?: { allowLowConfidenceConsumerAccess?: boolean }
): ConsumerRowReadinessResult {
  const allowLow =
    options?.allowLowConfidenceConsumerAccess ??
    MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT.allowLowConfidenceConsumerAccess;

  const auditNotes: string[] = [];
  const forbiddenFieldViolations: string[] = [];

  // Check 1: forbidden output fields in row
  for (const field of FORBIDDEN_CONSUMER_OUTPUT_FIELDS) {
    if (field in row) {
      forbiddenFieldViolations.push(`Row contains forbidden field: "${field}"`);
    }
  }
  if (forbiddenFieldViolations.length > 0) {
    return buildBlockedResult(row, "CONSUMER_BLOCKED_FORBIDDEN_FIELD", forbiddenFieldViolations, auditNotes);
  }

  // Check 2: releaseDate present
  if (row.releaseDate === null || row.releaseDate === undefined) {
    auditNotes.push("releaseDate is null — cannot determine PIT boundary");
    return buildBlockedResult(row, "CONSUMER_BLOCKED_MISSING_METADATA", [], auditNotes);
  }

  // Check 3: releaseDateSource present
  if (!row.releaseDateSource) {
    auditNotes.push("releaseDateSource is null — provenance unknown");
    return buildBlockedResult(row, "CONSUMER_BLOCKED_MISSING_METADATA", [], auditNotes);
  }

  // Check 4: releaseDateConfidence present
  if (!row.releaseDateConfidence) {
    auditNotes.push("releaseDateConfidence is null — confidence level unknown");
    return buildBlockedResult(row, "CONSUMER_BLOCKED_MISSING_METADATA", [], auditNotes);
  }

  const releaseDate = toDate(row.releaseDate);
  if (!releaseDate) {
    auditNotes.push(`releaseDate cannot be parsed: ${String(row.releaseDate)}`);
    return buildBlockedResult(row, "CONSUMER_BLOCKED_MISSING_METADATA", [], auditNotes);
  }

  // Check 5: asOfDate >= releaseDate (PIT boundary)
  if (row.asOfDate !== null && row.asOfDate !== undefined) {
    const asOfDate = toDate(row.asOfDate);
    if (!asOfDate) {
      auditNotes.push(`asOfDate cannot be parsed: ${String(row.asOfDate)}`);
      return buildBlockedResult(row, "CONSUMER_BLOCKED_MISSING_METADATA", [], auditNotes);
    }
    if (asOfDate < releaseDate) {
      auditNotes.push(
        `PIT violation: asOfDate ${formatDate(asOfDate)} is before releaseDate ${formatDate(releaseDate)}`
      );
      return buildBlockedResult(row, "CONSUMER_BLOCKED_PIT_VIOLATION", [], auditNotes);
    }
    auditNotes.push(`PIT boundary respected: asOfDate ${formatDate(asOfDate)} >= releaseDate ${formatDate(releaseDate)}`);
  } else {
    auditNotes.push("asOfDate not provided — PIT boundary not enforced for this row");
  }

  // Check 6: future-looking fields
  const futureLookingViolations: string[] = [];
  for (const field of FUTURE_LOOKING_FIELDS) {
    if (field in row) {
      futureLookingViolations.push(`Row contains future-looking field: "${field}"`);
    }
  }
  if (futureLookingViolations.length > 0) {
    return buildBlockedResult(row, "CONSUMER_BLOCKED_FORBIDDEN_FIELD", futureLookingViolations, auditNotes);
  }

  // Derive confidence tier
  const confidenceTier = mapConfidenceTier(row.releaseDateConfidence);

  // Check 7: LOW confidence handling
  if (confidenceTier === "LOW" && !allowLow) {
    auditNotes.push(
      `releaseDateConfidence is LOW (${row.releaseDateConfidence}) — audit-only unless allowLowConfidenceConsumerAccess=true`
    );
    return {
      symbol: row.symbol,
      revenueMonth: row.revenueMonth,
      classification: "CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING",
      consumerReady: true,
      confidenceTier,
      revenueAvailable: row.revenue !== null && row.revenue !== undefined,
      releaseMetadataComplete: true,
      pitBoundaryRespected: true,
      forbiddenFieldViolations: [],
      auditNotes,
      entersAlphaScore: false,
      paperOnly: true,
      dryRunOnly: true,
    };
  }

  // CONSUMER_READY
  auditNotes.push(`Consumer ready: confidence=${confidenceTier}, releaseDateSource=${row.releaseDateSource}`);
  return {
    symbol: row.symbol,
    revenueMonth: row.revenueMonth,
    classification: "CONSUMER_READY",
    consumerReady: true,
    confidenceTier,
    revenueAvailable: row.revenue !== null && row.revenue !== undefined,
    releaseMetadataComplete: true,
    pitBoundaryRespected: true,
    forbiddenFieldViolations: [],
    auditNotes,
    entersAlphaScore: false,
    paperOnly: true,
    dryRunOnly: true,
  };
}

// ─── Batch Evaluator ─────────────────────────────────────────────────────────

/**
 * Evaluate a batch of MonthlyRevenue rows for controlled consumer readiness.
 */
export function evaluateBatchConsumerReadiness(
  rows: MonthlyRevenueConsumerInputRow[],
  options?: { allowLowConfidenceConsumerAccess?: boolean }
): ConsumerBatchReadinessResult {
  const rowResults = rows.map((r) => evaluateRowConsumerReadiness(r, options));

  const blockedBreakdown: Record<ConsumerReadinessClassification, number> = {
    CONSUMER_READY: 0,
    CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING: 0,
    CONSUMER_BLOCKED_MISSING_METADATA: 0,
    CONSUMER_BLOCKED_PIT_VIOLATION: 0,
    CONSUMER_BLOCKED_FORBIDDEN_FIELD: 0,
  };
  const confidenceDistribution: Record<ConfidenceTier, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  let consumerReadyRows = 0;
  let warningRows = 0;
  let blockedRows = 0;

  for (const result of rowResults) {
    blockedBreakdown[result.classification]++;
    confidenceDistribution[result.confidenceTier]++;

    if (result.classification === "CONSUMER_READY") {
      consumerReadyRows++;
    } else if (result.classification === "CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING") {
      warningRows++;
    } else {
      blockedRows++;
    }
  }

  const overallClassification =
    blockedRows === 0
      ? "CONSUMER_BATCH_READY"
      : "CONSUMER_BATCH_BLOCKED";

  const readinessConclusion =
    blockedRows === 0
      ? `All ${rows.length} MonthlyRevenue rows pass controlled consumer readiness. ` +
        `entersAlphaScore=false enforced. No scoring, recommendation, or investment advice produced.`
      : `${blockedRows}/${rows.length} MonthlyRevenue rows blocked for consumer access. ` +
        `${consumerReadyRows} ready, ${warningRows} with low-confidence warning. ` +
        `Resolve blocked rows before expanding consumer access.`;

  return {
    sourceName: "MonthlyRevenue",
    consumerMode: "controlled-feature-consumer-readiness",
    rowCount: rows.length,
    consumerReadyRows,
    warningRows,
    blockedRows,
    blockedBreakdown,
    confidenceDistribution,
    readinessConclusion,
    overallClassification,
    entersAlphaScore: false,
    dryRunOnly: true,
    paperOnly: true,
    noBuySellActionSemantics: true,
    version: CONTROLLED_CONSUMER_CONTRACT_VERSION,
    disclaimer: CONTROLLED_CONSUMER_CONTRACT_DISCLAIMER,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildBlockedResult(
  row: MonthlyRevenueConsumerInputRow,
  classification: ConsumerReadinessClassification,
  forbiddenFieldViolations: string[],
  auditNotes: string[]
): ConsumerRowReadinessResult {
  return {
    symbol: row.symbol,
    revenueMonth: row.revenueMonth,
    classification,
    consumerReady: false,
    confidenceTier: mapConfidenceTier(row.releaseDateConfidence ?? null),
    revenueAvailable: false,
    releaseMetadataComplete: false,
    pitBoundaryRespected: false,
    forbiddenFieldViolations,
    auditNotes,
    entersAlphaScore: false,
    paperOnly: true,
    dryRunOnly: true,
  };
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
