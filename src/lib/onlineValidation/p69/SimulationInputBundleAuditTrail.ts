/**
 * P69 — Axis B v1 Simulation Input Bundle Audit Trail
 *
 * Pure TypeScript audit trail layer that consumes a P65 SimulationInputBundlePreview
 * and produces a frozen, JSON-safe, deterministic SimulationInputBundleAuditTrail
 * with neutral audit rows for each source entry.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem imports
 *   - No child_process import
 *   - Imports only types from P65 module
 *   - No Axis A implementation import (no src/lib/research/**)
 *   - No P53/P54/P62/P63/P64 logic import or mutation
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate input preview
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
 * For structural audit trail purposes only.
 *
 * Upstream baseline:
 *   P65 — Axis B simulation input bundle preview (de9a8ce)
 *   P69-GATE — APPROVE_P69_AXIS_B_SIMULATION_INPUT_AUDIT_TRAIL_WITH_STRICT_SCOPE
 *
 * Authorization:
 *   P69-GATE 2026-05-26 — APPROVE_P69_AXIS_B_SIMULATION_INPUT_AUDIT_TRAIL_WITH_STRICT_SCOPE
 *   Preview-only; no simulation execution, no metrics, no recommendation.
 */

import type { SimulationInputBundlePreview } from "@/lib/onlineValidation/p65/SimulationInputBundlePreview";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_VERSION =
  "p69-axis-b-simulation-input-bundle-audit-trail-v0" as const;

// ─── Governance ───────────────────────────────────────────────────────────────

export const SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_GOVERNANCE = Object.freeze({
  previewOnly: true,
  paperOnly: true,
  noExecution: true,
  noActualMetrics: true,
  entersAlphaScore: false,
  notInvestmentAdvice: true,
} as const);

// ─── Validation Result ────────────────────────────────────────────────────────

export type SimulationInputBundleAuditTrailValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

// ─── Audit Row ────────────────────────────────────────────────────────────────

/**
 * A single source's audit trail entry derived from a P65 preview source entry.
 *
 * auditRowType mirrors the P65 previewStatus for traceability.
 *
 * includeInAudit:
 *   true  → INCLUDED_ELIGIBLE or INCLUDED_LOW_CONFIDENCE
 *   false → EXCLUDED_BLOCKED or AUDIT_ONLY_REFERENCE
 *
 * GOVERNANCE: No scoring, no metrics, no recommendation, no investment semantics.
 */
export type SimulationInputBundleAuditTrailSourceRow = {
  readonly sourceName: string;
  readonly auditRowType:
    | "INCLUDED_ELIGIBLE"
    | "INCLUDED_LOW_CONFIDENCE"
    | "EXCLUDED_BLOCKED"
    | "AUDIT_ONLY_REFERENCE";
  readonly includeInAudit: boolean;
  readonly previewStatus: string;
  readonly includeInPreview: boolean;
  readonly auditNote?: string;
};

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * Count-only summary of the P69 audit trail rows.
 *
 * GOVERNANCE: Counts only — no performance metrics, no returns, no scoring.
 */
export type SimulationInputBundleAuditTrailSummary = {
  readonly totalAuditRows: number;
  readonly includedEligibleCount: number;
  readonly includedLowConfidenceCount: number;
  readonly excludedBlockedCount: number;
  readonly auditOnlyReferenceCount: number;
};

// ─── Audit Trail ──────────────────────────────────────────────────────────────

/**
 * The top-level P69 Axis B simulation input bundle audit trail artifact.
 *
 * Fields:
 *   - version: audit trail version for identity and traceability
 *   - generatedAt: ISO timestamp when the audit trail was produced
 *   - previewOnly: always true — structural audit only, not execution
 *   - paperOnly: always true — no real data or real execution
 *   - noExecution: always true — simulation not executed
 *   - noActualMetrics: always true — no performance metrics computed
 *   - entersAlphaScore: always false — not fed into scoring pipeline
 *   - notInvestmentAdvice: always true
 *   - previewVersion: version of the upstream P65 preview
 *   - auditRows: per-source audit trail rows derived from P65 sourceEntries
 *   - auditSummary: count-only summary of audit rows
 *
 * GOVERNANCE:
 *   previewOnly = true
 *   paperOnly = true
 *   noExecution = true
 *   noActualMetrics = true
 *   entersAlphaScore = false
 *   notInvestmentAdvice = true
 */
export type SimulationInputBundleAuditTrail = {
  readonly version: typeof SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_VERSION;
  readonly generatedAt: string;
  readonly previewOnly: true;
  readonly paperOnly: true;
  readonly noExecution: true;
  readonly noActualMetrics: true;
  readonly entersAlphaScore: false;
  readonly notInvestmentAdvice: true;
  readonly previewVersion: string;
  readonly auditRows: readonly SimulationInputBundleAuditTrailSourceRow[];
  readonly auditSummary: SimulationInputBundleAuditTrailSummary;
};

// ─── Params ───────────────────────────────────────────────────────────────────

export type SimulationInputBundleAuditTrailParams = {
  readonly preview: SimulationInputBundlePreview;
  readonly fixedGeneratedAt?: string;
};

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates that the supplied P65 SimulationInputBundlePreview carries all
 * required governance flags before an audit trail is produced.
 *
 * Returns { valid: true } on success.
 * Returns { valid: false, reason } on any governance violation.
 *
 * GOVERNANCE: Read-only validation — does not modify input.
 *
 * @param preview - The P65 SimulationInputBundlePreview to validate.
 * @returns SimulationInputBundleAuditTrailValidationResult
 */
export function validateSimulationInputBundlePreviewForAuditTrail(
  preview: SimulationInputBundlePreview,
): SimulationInputBundleAuditTrailValidationResult {
  if ((preview as { previewOnly: unknown }).previewOnly !== true) {
    return { valid: false, reason: "previewOnly is not true" };
  }
  if ((preview as { paperOnly: unknown }).paperOnly !== true) {
    return { valid: false, reason: "paperOnly is not true" };
  }
  if ((preview as { noExecution: unknown }).noExecution !== true) {
    return { valid: false, reason: "noExecution is not true" };
  }
  if ((preview as { noActualMetrics: unknown }).noActualMetrics !== true) {
    return { valid: false, reason: "noActualMetrics is not true" };
  }
  if ((preview as { entersAlphaScore: unknown }).entersAlphaScore !== false) {
    return { valid: false, reason: "entersAlphaScore is not false" };
  }
  if ((preview as { notInvestmentAdvice: unknown }).notInvestmentAdvice !== true) {
    return { valid: false, reason: "notInvestmentAdvice is not true" };
  }
  return { valid: true };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds a frozen, JSON-safe, deterministic SimulationInputBundleAuditTrail
 * from a caller-supplied P65 SimulationInputBundlePreview.
 *
 * Throws if the preview fails governance validation.
 *
 * Mapping rules:
 *   INCLUDED_ELIGIBLE       → auditRowType="INCLUDED_ELIGIBLE",     includeInAudit=true
 *   INCLUDED_LOW_CONFIDENCE → auditRowType="INCLUDED_LOW_CONFIDENCE", includeInAudit=true, neutral auditNote
 *   EXCLUDED_BLOCKED        → auditRowType="EXCLUDED_BLOCKED",       includeInAudit=false, neutral auditNote
 *   AUDIT_ONLY_REFERENCE    → auditRowType="AUDIT_ONLY_REFERENCE",   includeInAudit=false, neutral auditNote
 *
 * GOVERNANCE: No simulation, no metrics, no scoring, no recommendation,
 * no forecast, no investment advice, no target price, no buy/sell/hold/action.
 *
 * @param params - SimulationInputBundleAuditTrailParams
 * @returns Frozen SimulationInputBundleAuditTrail
 * @throws Error if governance validation fails
 */
export function buildSimulationInputBundleAuditTrail(
  params: SimulationInputBundleAuditTrailParams,
): SimulationInputBundleAuditTrail {
  const { preview, fixedGeneratedAt } = params;

  const validation = validateSimulationInputBundlePreviewForAuditTrail(preview);
  if (!validation.valid) {
    throw new Error(
      `P69: governance validation failed — ${validation.reason}`,
    );
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();

  const auditRows: SimulationInputBundleAuditTrailSourceRow[] =
    preview.sourceEntries.map((entry) => {
      let auditRowType: SimulationInputBundleAuditTrailSourceRow["auditRowType"];
      let includeInAudit: boolean;
      let auditNote: string | undefined;

      if (entry.previewStatus === "INCLUDED_ELIGIBLE") {
        auditRowType = "INCLUDED_ELIGIBLE";
        includeInAudit = true;
      } else if (entry.previewStatus === "INCLUDED_LOW_CONFIDENCE") {
        auditRowType = "INCLUDED_LOW_CONFIDENCE";
        includeInAudit = true;
        auditNote =
          entry.warning != null
            ? `Low-confidence source: ${entry.warning}`
            : "Low-confidence source included with advisory note.";
      } else if (entry.previewStatus === "EXCLUDED_BLOCKED") {
        auditRowType = "EXCLUDED_BLOCKED";
        includeInAudit = false;
        auditNote =
          entry.exclusionReason != null
            ? `Source excluded: ${entry.exclusionReason}`
            : "Source excluded from preview.";
      } else {
        // AUDIT_ONLY_REFERENCE
        auditRowType = "AUDIT_ONLY_REFERENCE";
        includeInAudit = false;
        auditNote = "Audit-only reference source; not included in preview.";
      }

      const rowFields: SimulationInputBundleAuditTrailSourceRow = auditNote !== undefined
        ? Object.freeze({
            sourceName: entry.sourceName,
            auditRowType,
            includeInAudit,
            previewStatus: entry.previewStatus,
            includeInPreview: entry.includeInPreview,
            auditNote,
          })
        : Object.freeze({
            sourceName: entry.sourceName,
            auditRowType,
            includeInAudit,
            previewStatus: entry.previewStatus,
            includeInPreview: entry.includeInPreview,
          });

      return rowFields;
    });

  const frozenRows: readonly SimulationInputBundleAuditTrailSourceRow[] =
    Object.freeze(auditRows);

  let includedEligibleCount = 0;
  let includedLowConfidenceCount = 0;
  let excludedBlockedCount = 0;
  let auditOnlyReferenceCount = 0;

  for (const row of frozenRows) {
    if (row.auditRowType === "INCLUDED_ELIGIBLE") {
      includedEligibleCount++;
    } else if (row.auditRowType === "INCLUDED_LOW_CONFIDENCE") {
      includedLowConfidenceCount++;
    } else if (row.auditRowType === "EXCLUDED_BLOCKED") {
      excludedBlockedCount++;
    } else if (row.auditRowType === "AUDIT_ONLY_REFERENCE") {
      auditOnlyReferenceCount++;
    }
  }

  const auditSummary = Object.freeze({
    totalAuditRows: frozenRows.length,
    includedEligibleCount,
    includedLowConfidenceCount,
    excludedBlockedCount,
    auditOnlyReferenceCount,
  } satisfies SimulationInputBundleAuditTrailSummary);

  return Object.freeze({
    version: SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_VERSION,
    generatedAt,
    previewOnly: true,
    paperOnly: true,
    noExecution: true,
    noActualMetrics: true,
    entersAlphaScore: false,
    notInvestmentAdvice: true,
    previewVersion: preview.version,
    auditRows: frozenRows,
    auditSummary,
  } satisfies SimulationInputBundleAuditTrail);
}
