/**
 * P46 — Paper Simulation Dry-run Full Pipeline Rehearsal Report
 *
 * Builds an immutable full-pipeline-rehearsal-level summary report from a
 * completed P46 FullPipelineRehearsalResult. Captures the full story:
 * full-pipeline rehearsal ID, rehearsal ID, integration ID, step counts at
 * all three layers (full-pipeline / rehearsal / pipeline), timeline, and all
 * inherited governance flags.
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - isFullPipelineRehearsalReport = true
 *
 * Authorization:
 *   YES design paper simulation dry-run full pipeline rehearsal for P46
 */

import { DRY_RUN_STUB_RESULT } from "../p41/PaperSimulationDryRunContract";
import type { PaperSimulationDryRunFullPipelineRehearsalResult } from "./PaperSimulationDryRunFullPipelineRehearsal";
import { PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION } from "./PaperSimulationDryRunFullPipelineRehearsal";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_REPORT_VERSION =
  "p46-paper-simulation-dry-run-lifecycle-runner-full-pipeline-rehearsal-report-v1" as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaperSimulationDryRunFullPipelineRehearsalReport {
  // Identity
  readonly fullPipelineRehearsalReportId: string;
  readonly phase: "P46";
  readonly version: string;
  readonly fullPipelineRehearsalVersion: string;

  // Links
  readonly fullPipelineRehearsalId: string;
  readonly rehearsalId: string;
  readonly integrationId: string;
  readonly runnerId: string;
  readonly lifecycleId: string;
  readonly runId: string;

  // Step counts at all three layers
  readonly fullPipelineRehearsalStepsCompleted: number;
  readonly fullPipelineRehearsalStepsTotal: number;
  readonly rehearsalStepsCompleted: number;
  readonly pipelineStepsCompleted: number;

  // Timeline
  readonly fullPipelineRehearsalStartedAt: string;
  readonly fullPipelineRehearsalCompletedAt: string;
  readonly fullPipelineRehearsalReportGeneratedAt: string;
  readonly executedAt: null;

  // Stub marker
  readonly stubResult: typeof DRY_RUN_STUB_RESULT;
  readonly isFullPipelineRehearsalReport: true;

  // Governance flags
  readonly dryRunOnly: true;
  readonly paperOnly: true;
  readonly noActualMetrics: true;
  readonly entersAlphaScore: false;
  readonly noAlphaScore: true;
  readonly noPnL: true;
  readonly noROI: true;
  readonly noWinRate: true;
  readonly noRealExecution: true;
}

// ─── Boundary guard ───────────────────────────────────────────────────────────

function assertFullPipelineRehearsalReportBoundary(
  condition: boolean,
  field: string,
  detail: string
): void {
  if (!condition) {
    throw new Error(
      `[P46] FullPipelineRehearsalReportBoundaryViolation: ${field} — ${detail}`
    );
  }
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Build an immutable full-pipeline rehearsal report from a completed
 * P46 FullPipelineRehearsalResult.
 * Validates all governance boundaries before producing the report.
 * Throws [P46] FullPipelineRehearsalReportBoundaryViolation on any violation.
 */
export function buildFullPipelineRehearsalReport(
  result: PaperSimulationDryRunFullPipelineRehearsalResult,
  fullPipelineRehearsalReportGeneratedAt: string
): PaperSimulationDryRunFullPipelineRehearsalReport {
  assertFullPipelineRehearsalReportBoundary(
    result.phase === "P46",
    "phase",
    "must be P46"
  );
  assertFullPipelineRehearsalReportBoundary(
    result.dryRunOnly === true,
    "dryRunOnly",
    "must be true"
  );
  assertFullPipelineRehearsalReportBoundary(
    result.executedAt === null,
    "executedAt",
    "must be null"
  );
  assertFullPipelineRehearsalReportBoundary(
    result.noRealExecution === true,
    "noRealExecution",
    "must be true"
  );
  assertFullPipelineRehearsalReportBoundary(
    result.entersAlphaScore === false,
    "entersAlphaScore",
    "must be false"
  );
  assertFullPipelineRehearsalReportBoundary(
    fullPipelineRehearsalReportGeneratedAt.length > 0,
    "fullPipelineRehearsalReportGeneratedAt",
    "must not be empty"
  );

  const fullPipelineRehearsalReportId = `p46-full-pipeline-rehearsal-report-${result.fullPipelineRehearsalId}-${fullPipelineRehearsalReportGeneratedAt}`;

  return Object.freeze({
    fullPipelineRehearsalReportId,
    phase: "P46" as const,
    version: PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_REPORT_VERSION,
    fullPipelineRehearsalVersion: PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION,
    fullPipelineRehearsalId: result.fullPipelineRehearsalId,
    rehearsalId: result.rehearsalId,
    integrationId: result.integrationId,
    runnerId: result.runnerId,
    lifecycleId: result.lifecycleId,
    runId: result.runId,
    fullPipelineRehearsalStepsCompleted: result.fullPipelineRehearsalStepsCompleted,
    fullPipelineRehearsalStepsTotal: result.fullPipelineRehearsalStepsTotal,
    rehearsalStepsCompleted: result.rehearsalStepsCompleted,
    pipelineStepsCompleted: result.pipelineStepsCompleted,
    fullPipelineRehearsalStartedAt: result.fullPipelineRehearsalStartedAt,
    fullPipelineRehearsalCompletedAt: result.fullPipelineRehearsalCompletedAt,
    fullPipelineRehearsalReportGeneratedAt,
    executedAt: null,
    stubResult: DRY_RUN_STUB_RESULT,
    isFullPipelineRehearsalReport: true as const,
    dryRunOnly: true as const,
    paperOnly: true as const,
    noActualMetrics: true as const,
    entersAlphaScore: false as const,
    noAlphaScore: true as const,
    noPnL: true as const,
    noROI: true as const,
    noWinRate: true as const,
    noRealExecution: true as const,
  });
}
