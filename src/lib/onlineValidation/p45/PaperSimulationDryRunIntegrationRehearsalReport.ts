/**
 * P45 — Paper Simulation Dry-run Integration Rehearsal Report
 *
 * Builds an immutable rehearsal-level summary report from a completed
 * P45 RehearsalResult. Captures the full rehearsal story: rehearsal ID,
 * integration ID, rehearsal/pipeline step counts, timeline, and all
 * inherited governance flags.
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - isRehearsalReport = true
 *
 * Authorization:
 *   YES design paper simulation dry-run integration rehearsal for P45
 */

import { DRY_RUN_STUB_RESULT } from "../p41/PaperSimulationDryRunContract";
import type { PaperSimulationDryRunIntegrationRehearsalResult } from "./PaperSimulationDryRunIntegrationRehearsal";
import { PAPER_SIMULATION_DRY_RUN_INTEGRATION_REHEARSAL_VERSION } from "./PaperSimulationDryRunIntegrationRehearsal";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAPER_SIMULATION_DRY_RUN_INTEGRATION_REHEARSAL_REPORT_VERSION =
  "p45-paper-simulation-dry-run-lifecycle-runner-integration-rehearsal-report-v1" as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaperSimulationDryRunIntegrationRehearsalReport {
  // Identity
  readonly rehearsalReportId: string;
  readonly phase: "P45";
  readonly version: string;
  readonly rehearsalVersion: string;

  // Links
  readonly rehearsalId: string;
  readonly integrationId: string;
  readonly runnerId: string;
  readonly lifecycleId: string;
  readonly runId: string;

  // Step counts
  readonly rehearsalStepsCompleted: number;
  readonly rehearsalStepsTotal: number;
  readonly pipelineStepsCompleted: number;

  // Timeline
  readonly rehearsalStartedAt: string;
  readonly rehearsalCompletedAt: string;
  readonly rehearsalReportGeneratedAt: string;
  readonly executedAt: null;

  // Stub marker
  readonly stubResult: typeof DRY_RUN_STUB_RESULT;
  readonly isRehearsalReport: true;

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

function assertRehearsalReportBoundary(
  condition: boolean,
  field: string,
  detail: string
): void {
  if (!condition) {
    throw new Error(
      `[P45] RehearsalReportBoundaryViolation: ${field} — ${detail}`
    );
  }
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Build an immutable rehearsal-level report from a completed P45 RehearsalResult.
 * Validates all governance boundaries before producing the report.
 * Throws [P45] RehearsalReportBoundaryViolation on any violation.
 */
export function buildRehearsalReport(
  result: PaperSimulationDryRunIntegrationRehearsalResult,
  rehearsalReportGeneratedAt: string
): PaperSimulationDryRunIntegrationRehearsalReport {
  assertRehearsalReportBoundary(result.phase === "P45", "phase", "must be P45");
  assertRehearsalReportBoundary(
    result.dryRunOnly === true,
    "dryRunOnly",
    "must be true"
  );
  assertRehearsalReportBoundary(
    result.executedAt === null,
    "executedAt",
    "must be null"
  );
  assertRehearsalReportBoundary(
    result.noRealExecution === true,
    "noRealExecution",
    "must be true"
  );
  assertRehearsalReportBoundary(
    result.entersAlphaScore === false,
    "entersAlphaScore",
    "must be false"
  );
  assertRehearsalReportBoundary(
    rehearsalReportGeneratedAt.length > 0,
    "rehearsalReportGeneratedAt",
    "must not be empty"
  );

  const rehearsalReportId = `p45-rehearsal-report-${result.rehearsalId}-${rehearsalReportGeneratedAt}`;

  return Object.freeze({
    rehearsalReportId,
    phase: "P45" as const,
    version: PAPER_SIMULATION_DRY_RUN_INTEGRATION_REHEARSAL_REPORT_VERSION,
    rehearsalVersion: PAPER_SIMULATION_DRY_RUN_INTEGRATION_REHEARSAL_VERSION,
    rehearsalId: result.rehearsalId,
    integrationId: result.integrationId,
    runnerId: result.runnerId,
    lifecycleId: result.lifecycleId,
    runId: result.runId,
    rehearsalStepsCompleted: result.rehearsalStepsCompleted,
    rehearsalStepsTotal: result.rehearsalStepsTotal,
    pipelineStepsCompleted: result.pipelineStepsCompleted,
    rehearsalStartedAt: result.rehearsalStartedAt,
    rehearsalCompletedAt: result.rehearsalCompletedAt,
    rehearsalReportGeneratedAt,
    executedAt: null,
    stubResult: DRY_RUN_STUB_RESULT,
    isRehearsalReport: true as const,
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
