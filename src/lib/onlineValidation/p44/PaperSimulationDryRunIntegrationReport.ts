/**
 * P44 — Paper Simulation Dry-run Integration Report
 *
 * Builds an immutable integration-level summary report from a completed
 * P44 IntegrationResult. Captures the full pipeline story: integration ID,
 * upstream runner report ID, pipeline step counts, timeline, and all
 * inherited governance flags.
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - isIntegrationReport = true
 *
 * Authorization:
 *   YES design paper simulation dry-run lifecycle runner integration for P44
 */

import { DRY_RUN_STUB_RESULT } from "../p41/PaperSimulationDryRunContract";
import type { PaperSimulationDryRunIntegrationResult } from "./PaperSimulationDryRunIntegration";
import { PAPER_SIMULATION_DRY_RUN_INTEGRATION_VERSION } from "./PaperSimulationDryRunIntegration";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAPER_SIMULATION_DRY_RUN_INTEGRATION_REPORT_VERSION =
  "p44-paper-simulation-dry-run-lifecycle-runner-integration-report-v1" as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaperSimulationDryRunIntegrationReport {
  // Identity
  readonly integrationReportId: string;
  readonly phase: "P44";
  readonly version: string;
  readonly integrationVersion: string;

  // Links
  readonly integrationId: string;
  readonly runnerId: string;
  readonly lifecycleId: string;
  readonly runId: string;

  // Pipeline summary
  readonly pipelineStepsCompleted: number;
  readonly pipelineStepsTotal: number;

  // Upstream runner report id
  readonly runnerReportId: string;

  // Timeline
  readonly integrationStartedAt: string;
  readonly integrationCompletedAt: string;
  readonly integrationReportGeneratedAt: string;
  readonly executedAt: null;

  // Stub marker
  readonly stubResult: typeof DRY_RUN_STUB_RESULT;
  readonly isIntegrationReport: true;

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

function assertReportBoundary(
  condition: boolean,
  field: string,
  detail: string
): void {
  if (!condition) {
    throw new Error(
      `[P44] IntegrationReportBoundaryViolation: ${field} — ${detail}`
    );
  }
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Build an immutable integration-level report from a completed P44 IntegrationResult.
 * Validates all governance boundaries before producing the report.
 * Throws [P44] IntegrationReportBoundaryViolation on any violation.
 */
export function buildIntegrationReport(
  result: PaperSimulationDryRunIntegrationResult,
  integrationReportGeneratedAt: string
): PaperSimulationDryRunIntegrationReport {
  assertReportBoundary(result.phase === "P44", "phase", "must be P44");
  assertReportBoundary(
    result.dryRunOnly === true,
    "dryRunOnly",
    "must be true"
  );
  assertReportBoundary(
    result.executedAt === null,
    "executedAt",
    "must be null"
  );
  assertReportBoundary(
    result.noRealExecution === true,
    "noRealExecution",
    "must be true"
  );
  assertReportBoundary(
    result.entersAlphaScore === false,
    "entersAlphaScore",
    "must be false"
  );
  assertReportBoundary(
    integrationReportGeneratedAt.length > 0,
    "integrationReportGeneratedAt",
    "must not be empty"
  );

  const integrationReportId = `p44-integration-report-${result.integrationId}-${integrationReportGeneratedAt}`;

  return Object.freeze({
    integrationReportId,
    phase: "P44" as const,
    version: PAPER_SIMULATION_DRY_RUN_INTEGRATION_REPORT_VERSION,
    integrationVersion: PAPER_SIMULATION_DRY_RUN_INTEGRATION_VERSION,
    integrationId: result.integrationId,
    runnerId: result.runnerId,
    lifecycleId: result.lifecycleId,
    runId: result.runId,
    pipelineStepsCompleted: result.pipelineStepsCompleted,
    pipelineStepsTotal: result.pipelineStepsTotal,
    runnerReportId: result.runnerReport.reportId,
    integrationStartedAt: result.integrationStartedAt,
    integrationCompletedAt: result.integrationCompletedAt,
    integrationReportGeneratedAt,
    executedAt: null,
    stubResult: DRY_RUN_STUB_RESULT,
    isIntegrationReport: true as const,
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
