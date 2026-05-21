/**
 * P37 — MonthlyRevenue Controlled Consumer Adapter
 *
 * Bridges P36 row-level input data and the P37 integration surface.
 * Accepts raw MonthlyRevenue consumer input rows, calls P36 batch evaluator,
 * and transforms results into a P37 integration payload.
 *
 * This adapter:
 *   - Calls P36 evaluateBatchConsumerReadiness (pure, no DB)
 *   - Maps results to P37 payload rows
 *   - Calls buildMonthlyRevenueConsumerPayload to produce the integration payload
 *   - Validates the resulting payload with validateMonthlyRevenueConsumerPayload
 *   - Never reads or writes the database
 *   - Never imports Prisma
 *   - Never modifies any scoring formula
 *   - Returns a blocked classification on missing metadata instead of throwing
 *   - Supports counts-only mode (includeRows=false) to prevent payload bloat
 *   - Supports deterministic test fixtures via fixed generatedAt
 *
 * DISCLAIMER: Controlled consumer adapter only. Does not constitute investment advice.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 * MonthlyRevenue entersAlphaScore = false. ALWAYS.
 * Results must not be used as buy/sell/hold signals or investment recommendations.
 */

import {
  evaluateBatchConsumerReadiness,
  evaluateRowConsumerReadiness,
  type MonthlyRevenueConsumerInputRow,
  type ConsumerRowReadinessResult,
} from "../p36/MonthlyRevenueControlledConsumerReadiness";
import {
  buildMonthlyRevenueConsumerPayload,
  validateMonthlyRevenueConsumerPayload,
  type MonthlyRevenueConsumerPayload,
  type MonthlyRevenueConsumerPayloadRow,
  type PayloadValidationResult,
  type BuildPayloadOptions,
} from "./MonthlyRevenueConsumerIntegrationSurface";

// ─── Adapter Options ──────────────────────────────────────────────────────────

export interface AdapterOptions {
  /** Include per-row details in the payload (default: false for counts-only) */
  includeRows?: boolean;
  /** Allow LOW confidence rows to be consumer-ready (default: false) */
  allowLowConfidenceConsumerAccess?: boolean;
  /** Override generatedAt for deterministic fixtures */
  fixedGeneratedAt?: string;
}

// ─── Adapter Result ───────────────────────────────────────────────────────────

export interface AdapterResult {
  payload: MonthlyRevenueConsumerPayload;
  validation: PayloadValidationResult;
  rowResults: ConsumerRowReadinessResult[];
}

// ─── Map row result to payload row ───────────────────────────────────────────

function mapToPayloadRow(result: ConsumerRowReadinessResult): MonthlyRevenueConsumerPayloadRow {
  return {
    symbol: result.symbol,
    revenueMonth: result.revenueMonth,
    classification: result.classification,
    consumerReady: result.consumerReady,
    confidenceTier: result.confidenceTier,
    revenueAvailable: result.revenueAvailable,
    releaseMetadataComplete: result.releaseMetadataComplete,
    pitBoundaryRespected: result.pitBoundaryRespected,
    auditNotes: result.auditNotes,
    entersAlphaScore: false,
    paperOnly: true,
    dryRunOnly: true,
  };
}

// ─── Main Adapter Function ────────────────────────────────────────────────────

/**
 * Adapt a batch of MonthlyRevenue consumer input rows into a P37 integration payload.
 *
 * This is the primary entry point for downstream pipelines wishing to consume
 * MonthlyRevenue readiness data in a controlled, governance-enforced manner.
 *
 * @param rows - Input rows conforming to MonthlyRevenueConsumerInputRow
 * @param options - Adapter configuration options
 * @returns AdapterResult containing the payload, validation, and per-row results
 */
export function adaptMonthlyRevenueConsumerBatch(
  rows: MonthlyRevenueConsumerInputRow[],
  options: AdapterOptions = {}
): AdapterResult {
  const { includeRows = false, allowLowConfidenceConsumerAccess = false } = options;

  // Step 1: Evaluate each row via P36 evaluator (pure function, no DB)
  const rowResults: ConsumerRowReadinessResult[] = rows.map((row) =>
    evaluateRowConsumerReadiness(row, { allowLowConfidenceConsumerAccess })
  );

  // Step 2: Build batch summary via P36 batch evaluator (re-evaluate to get batch result)
  const batchResult = evaluateBatchConsumerReadiness(rows, { allowLowConfidenceConsumerAccess });

  // Step 3: Map row results to payload rows
  const payloadRows = rowResults.map(mapToPayloadRow);

  // Step 4: Build integration surface payload
  const buildOptions: BuildPayloadOptions = { includeRows };
  const payload = buildMonthlyRevenueConsumerPayload(batchResult, payloadRows, buildOptions);

  // Step 5: Override generatedAt for deterministic test fixtures
  if (options.fixedGeneratedAt) {
    (payload as MonthlyRevenueConsumerPayload & { generatedAt: string }).generatedAt =
      options.fixedGeneratedAt;
  }

  // Step 6: Validate the resulting payload
  const validation = validateMonthlyRevenueConsumerPayload(payload);

  return { payload, validation, rowResults };
}

/**
 * Adapt a single MonthlyRevenue consumer input row into a P37 integration payload.
 *
 * Convenience wrapper around adaptMonthlyRevenueConsumerBatch for single-row use.
 */
export function adaptMonthlyRevenueConsumerRow(
  row: MonthlyRevenueConsumerInputRow,
  options: AdapterOptions = {}
): AdapterResult {
  return adaptMonthlyRevenueConsumerBatch([row], options);
}
