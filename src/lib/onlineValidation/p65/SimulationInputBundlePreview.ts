/**
 * P65 — Axis B Simulation Input Bundle Preview
 *
 * Pure TypeScript preview builder that consumes a P63 review artifact and a
 * P64 APPROVE gate result to produce a JSON-safe, deterministic, preview-only
 * simulation input bundle description.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem imports
 *   - No child_process import
 *   - Imports only types from P62 and P64 modules
 *   - No Axis A implementation import
 *   - No P53/P54 logic import or mutation
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - Deterministic when params.fixedGeneratedAt is provided
 *   - Does not mutate input artifact or gateResult
 *   - No scoring, no recommendation, no investment advice, no forbidden fields
 *   - No simulation execution, no metrics, no optimizer, no backtest
 *   - Does NOT execute simulation
 *   - Does NOT produce performance metrics
 *   - Does NOT build an executable bundle
 *
 * This is NOT simulation execution.
 * This is NOT a backtest.
 * This is NOT optimizer work.
 * This does NOT produce returns, ROI, PnL, win-rate, edge, alphaScore,
 * recommendation, benchmark, target price, or action fields.
 *
 * DISCLAIMER: This module does not constitute investment advice,
 * a recommendation, or a signal to buy, sell, or hold any security.
 * entersAlphaScore = false. paperOnly = true. dryRunOnly = true.
 * previewOnly = true. noExecution = true. noActualMetrics = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 * For structural preview purposes only.
 *
 * Upstream baseline:
 *   P62 — Axis B simulation input eligibility review contract (b946453)
 *   P63 — Axis B simulation input eligibility review builder (622997b)
 *   P64 — Axis B review artifact consumer gate (75a5632)
 *   P65-GATE — APPROVE_P65_WITH_STRICT_SCOPE
 *
 * Authorization:
 *   P65-GATE 2026-05-26 — APPROVE_P65_WITH_STRICT_SCOPE
 *   Preview-only; no simulation execution, no metrics, no recommendation.
 */

import {
  type SimulationInputEligibilityReviewArtifact,
} from "../p62/SimulationInputEligibilityReviewContract";

import {
  type SimulationInputEligibilityReviewConsumerGateResult,
} from "../p64/SimulationInputEligibilityReviewConsumerGate";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SIMULATION_INPUT_BUNDLE_PREVIEW_VERSION =
  "p65-axis-b-simulation-input-bundle-preview-v0" as const;

// ─── Source Entry ─────────────────────────────────────────────────────────────

/**
 * A single source's preview classification in the P65 bundle preview.
 *
 * previewStatus:
 *   INCLUDED_ELIGIBLE         — source is fully eligible; included in preview.
 *   INCLUDED_LOW_CONFIDENCE   — source is eligible with low-confidence warning;
 *                               included in preview with advisory warning.
 *   EXCLUDED_BLOCKED          — source is blocked; excluded from preview.
 *   AUDIT_ONLY_REFERENCE      — source is audit-only; referenced but excluded.
 *
 * includeInPreview:
 *   true  → INCLUDED_ELIGIBLE or INCLUDED_LOW_CONFIDENCE
 *   false → EXCLUDED_BLOCKED or AUDIT_ONLY_REFERENCE
 *
 * GOVERNANCE: No scoring, no metrics, no recommendation, no investment semantics.
 */
export type SimulationInputBundlePreviewSourceEntry = {
  readonly sourceName: string;
  readonly previewStatus:
    | "INCLUDED_ELIGIBLE"
    | "INCLUDED_LOW_CONFIDENCE"
    | "EXCLUDED_BLOCKED"
    | "AUDIT_ONLY_REFERENCE";
  readonly includeInPreview: boolean;
  readonly warning?: string;
  readonly exclusionReason?: string;
};

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * Count-only summary of the P65 bundle preview source entries.
 *
 * GOVERNANCE: Counts only — no performance metrics, no returns, no scoring.
 */
export type SimulationInputBundlePreviewSummary = {
  readonly totalSources: number;
  readonly includedEligibleCount: number;
  readonly includedLowConfidenceCount: number;
  readonly excludedBlockedCount: number;
  readonly auditOnlyReferenceCount: number;
};

// ─── Preview ──────────────────────────────────────────────────────────────────

/**
 * The top-level P65 Axis B simulation input bundle preview artifact.
 *
 * Fields:
 *   - version: preview version for identity and traceability
 *   - generatedAt: ISO timestamp when the preview was produced
 *   - previewOnly: always true — this is a preview description, not execution
 *   - paperOnly: always true — no real data or real execution
 *   - noExecution: always true — simulation not executed
 *   - noActualMetrics: always true — no performance metrics computed
 *   - entersAlphaScore: always false — not fed into scoring pipeline
 *   - notInvestmentAdvice: always true
 *   - sourceEntries: per-source preview entries derived from P64 gate result
 *   - summary: count-only summary of preview entries
 *
 * GOVERNANCE:
 *   previewOnly = true
 *   paperOnly = true
 *   noExecution = true
 *   noActualMetrics = true
 *   entersAlphaScore = false
 *   notInvestmentAdvice = true
 */
export type SimulationInputBundlePreview = {
  readonly version: typeof SIMULATION_INPUT_BUNDLE_PREVIEW_VERSION;
  readonly generatedAt: string;
  readonly previewOnly: true;
  readonly paperOnly: true;
  readonly noExecution: true;
  readonly noActualMetrics: true;
  readonly entersAlphaScore: false;
  readonly notInvestmentAdvice: true;
  readonly sourceEntries: readonly SimulationInputBundlePreviewSourceEntry[];
  readonly summary: SimulationInputBundlePreviewSummary;
};

// ─── Params ───────────────────────────────────────────────────────────────────

export type SimulationInputBundlePreviewParams = {
  readonly artifact: SimulationInputEligibilityReviewArtifact;
  readonly gateResult: SimulationInputEligibilityReviewConsumerGateResult;
  readonly fixedGeneratedAt?: string;
};

// ─── Summary Helper ───────────────────────────────────────────────────────────

/**
 * Computes count-only summary from preview source entries.
 * Pure helper — no metrics, no scoring, no recommendation.
 *
 * @param sources - Readonly array of preview source entries.
 * @returns Frozen SimulationInputBundlePreviewSummary.
 */
export function summarizePreviewSources(
  sources: readonly SimulationInputBundlePreviewSourceEntry[],
): SimulationInputBundlePreviewSummary {
  let includedEligibleCount = 0;
  let includedLowConfidenceCount = 0;
  let excludedBlockedCount = 0;
  let auditOnlyReferenceCount = 0;

  for (const src of sources) {
    if (src.previewStatus === "INCLUDED_ELIGIBLE") {
      includedEligibleCount++;
    } else if (src.previewStatus === "INCLUDED_LOW_CONFIDENCE") {
      includedLowConfidenceCount++;
    } else if (src.previewStatus === "EXCLUDED_BLOCKED") {
      excludedBlockedCount++;
    } else if (src.previewStatus === "AUDIT_ONLY_REFERENCE") {
      auditOnlyReferenceCount++;
    }
  }

  return Object.freeze({
    totalSources: sources.length,
    includedEligibleCount,
    includedLowConfidenceCount,
    excludedBlockedCount,
    auditOnlyReferenceCount,
  });
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds a P65 simulation input bundle preview from a P63 review artifact
 * and a P64 APPROVE gate result.
 *
 * Pure function — does not mutate artifact or gateResult.
 * Deterministic when fixedGeneratedAt is provided.
 *
 * Decision gate:
 *   Requires gateResult.decision === "APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW".
 *   Throws if any other decision is presented.
 *
 * Source classification (from gateResult arrays):
 *   eligibleSourceNames      → INCLUDED_ELIGIBLE, includeInPreview=true
 *   lowConfidenceSourceNames → INCLUDED_LOW_CONFIDENCE, includeInPreview=true, warning
 *   blockedSourceNames       → EXCLUDED_BLOCKED, includeInPreview=false, exclusionReason
 *   auditOnlySourceNames     → AUDIT_ONLY_REFERENCE, includeInPreview=false
 *
 * @param params - Builder parameters including artifact, gateResult, fixedGeneratedAt.
 * @returns Frozen SimulationInputBundlePreview.
 *
 * GOVERNANCE: No simulation execution, no metrics, no scoring, no recommendation.
 */
export function buildSimulationInputBundlePreview(
  params: SimulationInputBundlePreviewParams,
): SimulationInputBundlePreview {
  const { artifact, gateResult, fixedGeneratedAt } = params;

  // ── Gate decision check ────────────────────────────────────────────────────
  if (gateResult.decision !== "APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW") {
    throw new Error(
      `P65 buildSimulationInputBundlePreview requires P64 decision ` +
        `APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW; received: ${gateResult.decision}`,
    );
  }

  const generatedAt = fixedGeneratedAt ?? new Date().toISOString();

  // ── Build source entries (preserving artifact entry order) ─────────────────
  const sourceEntries: SimulationInputBundlePreviewSourceEntry[] = [];

  for (const entry of artifact.entries) {
    const name: string = entry.source;

    if (gateResult.eligibleSourceNames.includes(name)) {
      sourceEntries.push(
        Object.freeze({
          sourceName: name,
          previewStatus: "INCLUDED_ELIGIBLE" as const,
          includeInPreview: true,
        }),
      );
    } else if (gateResult.lowConfidenceSourceNames.includes(name)) {
      sourceEntries.push(
        Object.freeze({
          sourceName: name,
          previewStatus: "INCLUDED_LOW_CONFIDENCE" as const,
          includeInPreview: true,
          warning: `${name} is included with low-confidence status — requires manual review before simulation`,
        }),
      );
    } else if (gateResult.blockedSourceNames.includes(name)) {
      sourceEntries.push(
        Object.freeze({
          sourceName: name,
          previewStatus: "EXCLUDED_BLOCKED" as const,
          includeInPreview: false,
          exclusionReason: `${name} is BLOCKED — excluded from simulation input bundle preview`,
        }),
      );
    } else if (gateResult.auditOnlySourceNames.includes(name)) {
      sourceEntries.push(
        Object.freeze({
          sourceName: name,
          previewStatus: "AUDIT_ONLY_REFERENCE" as const,
          includeInPreview: false,
        }),
      );
    }
  }

  const frozenEntries = Object.freeze(sourceEntries) as readonly SimulationInputBundlePreviewSourceEntry[];
  const summary = summarizePreviewSources(frozenEntries);

  // ── Return frozen preview ──────────────────────────────────────────────────
  return Object.freeze({
    version: SIMULATION_INPUT_BUNDLE_PREVIEW_VERSION,
    generatedAt,
    previewOnly: true as const,
    paperOnly: true as const,
    noExecution: true as const,
    noActualMetrics: true as const,
    entersAlphaScore: false as const,
    notInvestmentAdvice: true as const,
    sourceEntries: frozenEntries,
    summary,
  } satisfies SimulationInputBundlePreview);
}
