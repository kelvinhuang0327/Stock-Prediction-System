/**
 * P43 — Paper Simulation Dry-run Runner Report
 *
 * Builds an immutable summary report from a completed P43 RunnerResult.
 * Report captures lifecycle summary: initial/final states, transition count,
 * log entry count, timeline. All governance flags inherited and enforced.
 * No real metrics, no PnL, no ROI, no alphaScore.
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - isStubReport = true
 *
 * Authorization:
 *   YES design paper simulation dry-run lifecycle runner for P43
 */

import type { P42LifecycleState } from "../p42/PaperSimulationDryRunLifecycle";
import { DRY_RUN_STUB_RESULT } from "../p41/PaperSimulationDryRunContract";
import type { PaperSimulationDryRunRunnerResult } from "./PaperSimulationDryRunLifecycleRunner";
import { PAPER_SIMULATION_DRY_RUN_LIFECYCLE_RUNNER_VERSION } from "./PaperSimulationDryRunLifecycleRunner";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAPER_SIMULATION_DRY_RUN_RUNNER_REPORT_VERSION =
  "p43-paper-simulation-dry-run-runner-report-v1" as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaperSimulationDryRunRunnerReport {
  // Identity
  readonly reportId: string;
  readonly phase: "P43";
  readonly version: string;
  readonly runnerVersion: string;

  // Links to runner result
  readonly runnerId: string;
  readonly lifecycleId: string;
  readonly runId: string;

  // Lifecycle summary
  readonly initialState: P42LifecycleState;
  readonly finalState: P42LifecycleState;
  readonly transitionCount: number;
  readonly logEntryCount: number;

  // Timeline
  readonly startedAt: string;
  readonly completedAt: string;
  readonly reportGeneratedAt: string;
  readonly executedAt: null;

  // Stub marker
  readonly stubResult: typeof DRY_RUN_STUB_RESULT;
  readonly isStubReport: true;

  // Governance flags
  readonly dryRunOnly: true;
  readonly paperOnly: true;
  readonly noActualMetrics: true;
  readonly entersAlphaScore: false;
  readonly noAlphaScore: true;
  readonly noRealExecution: true;
  readonly noPnL: true;
  readonly noROI: true;
  readonly noWinRate: true;
}

// ─── Boundary guard ───────────────────────────────────────────────────────────

function assertReportBoundary(
  condition: boolean,
  field: string,
  detail: string
): void {
  if (!condition) {
    throw new Error(`[P43] ReportBoundaryViolation: ${field} — ${detail}`);
  }
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Build an immutable summary report from a completed P43 RunnerResult.
 * Validates all governance boundaries before producing the report.
 * Throws [P43] ReportBoundaryViolation on any violation.
 */
export function buildRunnerReport(
  result: PaperSimulationDryRunRunnerResult,
  reportGeneratedAt: string
): PaperSimulationDryRunRunnerReport {
  assertReportBoundary(result.phase === "P43", "phase", "must be P43");
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
    reportGeneratedAt.length > 0,
    "reportGeneratedAt",
    "must not be empty"
  );

  const reportId = `p43-report-${result.runnerId}-${reportGeneratedAt}`;

  return Object.freeze({
    reportId,
    phase: "P43" as const,
    version: PAPER_SIMULATION_DRY_RUN_RUNNER_REPORT_VERSION,
    runnerVersion: PAPER_SIMULATION_DRY_RUN_LIFECYCLE_RUNNER_VERSION,
    runnerId: result.runnerId,
    lifecycleId: result.lifecycleId,
    runId: result.runId,
    initialState: result.initialState,
    finalState: result.finalState,
    transitionCount: result.transitions.length,
    logEntryCount: result.log.length,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    reportGeneratedAt,
    executedAt: null,
    stubResult: DRY_RUN_STUB_RESULT,
    isStubReport: true as const,
    dryRunOnly: true as const,
    paperOnly: true as const,
    noActualMetrics: true as const,
    entersAlphaScore: false as const,
    noAlphaScore: true as const,
    noRealExecution: true as const,
    noPnL: true as const,
    noROI: true as const,
    noWinRate: true as const,
  });
}
