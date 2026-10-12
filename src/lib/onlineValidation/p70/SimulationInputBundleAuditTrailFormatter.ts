/**
 * P70 — Axis B v1 Simulation Input Bundle Audit Trail Formatter
 *
 * Pure TypeScript formatter layer that consumes a P69 SimulationInputBundleAuditTrail
 * and produces a frozen, JSON-safe, deterministic SimulationInputBundleAuditTrailFormatterResponse
 * with neutral display rows for each audit trail entry.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem imports
 *   - No child_process import
 *   - Imports only types from P69 module
 *   - No Axis A implementation import (no src/lib/research/**)
 *   - No P53/P54/P62/P63/P64/P65 logic import or mutation
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate input audit trail
 *   - No scoring, no recommendation, no investment advice, no forbidden fields
 *   - No simulation execution, no metrics, no optimizer, no backtest
 *   - Does NOT execute simulation
 *   - Does NOT produce performance metrics
 *   - Does NOT compute ROI, PnL, win-rate, benchmark, alphaScore, or target price
 *   - Does NOT contain buy, sell, hold, action, forecast, or recommendation semantics
 *
 * This is NOT simulation execution.
 * This is NOT a backtest.
 * This is NOT optimizer work.
 * This does NOT produce returns, ROI, PnL, win-rate, edge, alphaScore,
 * recommendation, benchmark, target price, or action fields.
 *
 * DISCLAIMER: This module does not constitute investment advice,
 * a recommendation, or a signal to buy, sell, or hold any security.
 * entersAlphaScore = false. paperOnly = true. previewOnly = true.
 * noExecution = true. noActualMetrics = true. notInvestmentAdvice = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 * For structural display formatting purposes only.
 *
 * Upstream baseline:
 *   P69 — Axis B simulation input bundle audit trail (d4f7a60)
 *   P70-GATE — APPROVE_P70_AXIS_B_AUDIT_TRAIL_FORMATTER_WITH_STRICT_SCOPE
 *
 * Authorization:
 *   P70-GATE 2026-05-26 — APPROVE_P70_AXIS_B_AUDIT_TRAIL_FORMATTER_WITH_STRICT_SCOPE
 *   Preview-only; no simulation execution, no metrics, no recommendation.
 */

import type { SimulationInputBundleAuditTrail } from "@/lib/onlineValidation/p69/SimulationInputBundleAuditTrail";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_VERSION =
  "p70-axis-b-simulation-input-bundle-audit-trail-formatter-v0" as const;

// ─── Governance ───────────────────────────────────────────────────────────────

export const SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_GOVERNANCE = Object.freeze({
  previewOnly: true,
  paperOnly: true,
  noExecution: true,
  noActualMetrics: true,
  entersAlphaScore: false,
  notInvestmentAdvice: true,
} as const);

// ─── Validation Result ────────────────────────────────────────────────────────

export type SimulationInputBundleAuditTrailFormatterValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

// ─── Display Row ──────────────────────────────────────────────────────────────

/**
 * A single source's display entry derived from a P69 audit trail row.
 *
 * Preserves all structural fields from the audit row.
 * displayNote forwards the P69 auditNote for non-eligible rows.
 *
 * GOVERNANCE: No scoring, no metrics, no recommendation, no investment semantics.
 */
export type SimulationInputBundleAuditTrailDisplayRow = {
  readonly sourceName: string;
  readonly auditRowType: string;
  readonly previewStatus: string;
  readonly includeInAudit: boolean;
  readonly includeInPreview: boolean;
  readonly displayNote?: string;
};

// ─── Formatter Summary ────────────────────────────────────────────────────────

/**
 * Count-only summary of the P70 formatter display rows.
 *
 * GOVERNANCE: Counts only — no performance metrics, no returns, no scoring.
 */
export type SimulationInputBundleAuditTrailFormatterSummary = {
  readonly totalDisplayRows: number;
  readonly includedEligibleCount: number;
  readonly includedLowConfidenceCount: number;
  readonly excludedBlockedCount: number;
  readonly auditOnlyReferenceCount: number;
};

// ─── Formatter Response ───────────────────────────────────────────────────────

/**
 * The top-level P70 Axis B simulation input bundle audit trail formatter response.
 *
 * Fields:
 *   - version: formatter version for identity and traceability
 *   - generatedAt: ISO timestamp when the formatter response was produced
 *   - previewOnly: always true — structural display only, not execution
 *   - paperOnly: always true — no real data or real execution
 *   - noExecution: always true — simulation not executed
 *   - noActualMetrics: always true — no performance metrics computed
 *   - entersAlphaScore: always false — not fed into scoring pipeline
 *   - notInvestmentAdvice: always true
 *   - auditTrailVersion: version of the upstream P69 audit trail
 *   - displayRows: per-source display rows derived from P69 auditRows
 *   - formatterSummary: count-only summary of display rows
 *
 * GOVERNANCE:
 *   previewOnly = true
 *   paperOnly = true
 *   noExecution = true
 *   noActualMetrics = true
 *   entersAlphaScore = false
 *   notInvestmentAdvice = true
 */
export type SimulationInputBundleAuditTrailFormatterResponse = {
  readonly version: typeof SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_VERSION;
  readonly generatedAt: string;
  readonly previewOnly: true;
  readonly paperOnly: true;
  readonly noExecution: true;
  readonly noActualMetrics: true;
  readonly entersAlphaScore: false;
  readonly notInvestmentAdvice: true;
  readonly auditTrailVersion: string;
  readonly displayRows: readonly SimulationInputBundleAuditTrailDisplayRow[];
  readonly formatterSummary: SimulationInputBundleAuditTrailFormatterSummary;
};

// ─── Params ───────────────────────────────────────────────────────────────────

export type SimulationInputBundleAuditTrailFormatterParams = {
  readonly auditTrail: SimulationInputBundleAuditTrail;
  readonly fixedGeneratedAt?: string;
};

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates that the supplied P69 SimulationInputBundleAuditTrail carries all
 * required governance flags before a formatter response is produced.
 *
 * Returns { valid: true } on success.
 * Returns { valid: false, reason } on any governance violation.
 *
 * GOVERNANCE: Read-only validation — does not modify input.
 *
 * @param auditTrail - The P69 SimulationInputBundleAuditTrail to validate.
 * @returns SimulationInputBundleAuditTrailFormatterValidationResult
 */
export function validateSimulationInputBundleAuditTrailForFormatting(
  auditTrail: SimulationInputBundleAuditTrail,
): SimulationInputBundleAuditTrailFormatterValidationResult {
  if ((auditTrail as { previewOnly: unknown }).previewOnly !== true) {
    return { valid: false, reason: "previewOnly is not true" };
  }
  if ((auditTrail as { paperOnly: unknown }).paperOnly !== true) {
    return { valid: false, reason: "paperOnly is not true" };
  }
  if ((auditTrail as { noExecution: unknown }).noExecution !== true) {
    return { valid: false, reason: "noExecution is not true" };
  }
  if ((auditTrail as { noActualMetrics: unknown }).noActualMetrics !== true) {
    return { valid: false, reason: "noActualMetrics is not true" };
  }
  if ((auditTrail as { entersAlphaScore: unknown }).entersAlphaScore !== false) {
    return { valid: false, reason: "entersAlphaScore is not false" };
  }
  if ((auditTrail as { notInvestmentAdvice: unknown }).notInvestmentAdvice !== true) {
    return { valid: false, reason: "notInvestmentAdvice is not true" };
  }
  return { valid: true };
}

// ─── Formatter ────────────────────────────────────────────────────────────────

/**
 * Formats a frozen, JSON-safe, deterministic SimulationInputBundleAuditTrailFormatterResponse
 * from a caller-supplied P69 SimulationInputBundleAuditTrail.
 *
 * Throws if the audit trail fails governance validation.
 *
 * Mapping rules:
 *   INCLUDED_ELIGIBLE       → displayNote=undefined (no note for eligible rows)
 *   INCLUDED_LOW_CONFIDENCE → displayNote forwarded from P69 auditNote
 *   EXCLUDED_BLOCKED        → displayNote forwarded from P69 auditNote
 *   AUDIT_ONLY_REFERENCE    → displayNote forwarded from P69 auditNote
 *
 * GOVERNANCE: No simulation, no metrics, no scoring, no recommendation,
 * no forecast, no investment advice, no target price, no buy/sell/hold/action.
 *
 * @param params - SimulationInputBundleAuditTrailFormatterParams
 * @returns Frozen SimulationInputBundleAuditTrailFormatterResponse
 * @throws Error if governance validation fails
 */
export function formatSimulationInputBundleAuditTrail(
  params: SimulationInputBundleAuditTrailFormatterParams,
): SimulationInputBundleAuditTrailFormatterResponse {
  const { auditTrail, fixedGeneratedAt } = params;

  const validation = validateSimulationInputBundleAuditTrailForFormatting(auditTrail);
  if (!validation.valid) {
    throw new Error(
      `P70: governance validation failed — ${validation.reason}`,
    );
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();

  const displayRows: SimulationInputBundleAuditTrailDisplayRow[] = auditTrail.auditRows.map(
    (row) => {
      const displayRow: SimulationInputBundleAuditTrailDisplayRow = {
        sourceName: row.sourceName,
        auditRowType: row.auditRowType,
        previewStatus: row.previewStatus,
        includeInAudit: row.includeInAudit,
        includeInPreview: row.includeInPreview,
        ...(row.auditRowType !== "INCLUDED_ELIGIBLE" && row.auditNote !== undefined
          ? { displayNote: row.auditNote }
          : {}),
      };
      return Object.freeze(displayRow);
    },
  );

  const frozenRows = Object.freeze(displayRows);

  let includedEligibleCount = 0;
  let includedLowConfidenceCount = 0;
  let excludedBlockedCount = 0;
  let auditOnlyReferenceCount = 0;

  for (const row of frozenRows) {
    if (row.auditRowType === "INCLUDED_ELIGIBLE") includedEligibleCount++;
    else if (row.auditRowType === "INCLUDED_LOW_CONFIDENCE") includedLowConfidenceCount++;
    else if (row.auditRowType === "EXCLUDED_BLOCKED") excludedBlockedCount++;
    else if (row.auditRowType === "AUDIT_ONLY_REFERENCE") auditOnlyReferenceCount++;
  }

  const formatterSummary = Object.freeze({
    totalDisplayRows: frozenRows.length,
    includedEligibleCount,
    includedLowConfidenceCount,
    excludedBlockedCount,
    auditOnlyReferenceCount,
  } satisfies SimulationInputBundleAuditTrailFormatterSummary);

  return Object.freeze({
    version: SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_VERSION,
    generatedAt,
    previewOnly: true,
    paperOnly: true,
    noExecution: true,
    noActualMetrics: true,
    entersAlphaScore: false,
    notInvestmentAdvice: true,
    auditTrailVersion: auditTrail.version,
    displayRows: frozenRows,
    formatterSummary,
  } satisfies SimulationInputBundleAuditTrailFormatterResponse);
}
