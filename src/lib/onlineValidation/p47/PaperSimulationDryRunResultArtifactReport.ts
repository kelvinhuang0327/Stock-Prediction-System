/**
 * P47 — Paper Simulation Dry-run Result Artifact Materialization Report
 *
 * Builds an immutable result-artifact-level summary report from a completed
 * P47 ResultArtifactResult. Captures the full story: result artifact ID,
 * full-pipeline rehearsal ID, rehearsal ID, integration ID, step counts at
 * all four layers (materialization / full-pipeline rehearsal / rehearsal / pipeline),
 * timeline, and all inherited governance flags.
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - isResultArtifactReport = true
 *
 * Authorization:
 *   YES design paper simulation dry-run result artifact materialization for P47
 */

import { DRY_RUN_STUB_RESULT } from "../p41/PaperSimulationDryRunContract";
import type { PaperSimulationDryRunResultArtifactResult } from "./PaperSimulationDryRunResultArtifact";
import { PAPER_SIMULATION_DRY_RUN_RESULT_ARTIFACT_VERSION } from "./PaperSimulationDryRunResultArtifact";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAPER_SIMULATION_DRY_RUN_RESULT_ARTIFACT_REPORT_VERSION =
  "p47-paper-simulation-dry-run-lifecycle-runner-result-artifact-materialization-report-v1" as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaperSimulationDryRunResultArtifactReport {
  // Identity
  readonly resultArtifactReportId: string;
  readonly phase: "P47";
  readonly version: string;
  readonly resultArtifactVersion: string;

  // Links
  readonly resultArtifactId: string;
  readonly fullPipelineRehearsalId: string;
  readonly rehearsalId: string;
  readonly integrationId: string;
  readonly runnerId: string;
  readonly lifecycleId: string;
  readonly runId: string;

  // Step counts at all four layers
  readonly materializationStepsCompleted: number;
  readonly materializationStepsTotal: number;
  readonly fullPipelineRehearsalStepsCompleted: number;
  readonly rehearsalStepsCompleted: number;
  readonly pipelineStepsCompleted: number;

  // Timeline
  readonly materializationStartedAt: string;
  readonly materializationCompletedAt: string;
  readonly resultArtifactReportGeneratedAt: string;
  readonly executedAt: null;

  // Stub marker
  readonly stubResult: typeof DRY_RUN_STUB_RESULT;
  readonly isResultArtifactReport: true;

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

function assertResultArtifactReportBoundary(
  condition: boolean,
  field: string,
  detail: string
): void {
  if (!condition) {
    throw new Error(
      `[P47] ResultArtifactReportBoundaryViolation: ${field} — ${detail}`
    );
  }
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Build an immutable result artifact report from a completed
 * P47 ResultArtifactResult.
 * Validates all governance boundaries before producing the report.
 * Throws [P47] ResultArtifactReportBoundaryViolation on any violation.
 */
export function buildResultArtifactReport(
  result: PaperSimulationDryRunResultArtifactResult,
  resultArtifactReportGeneratedAt: string
): PaperSimulationDryRunResultArtifactReport {
  assertResultArtifactReportBoundary(
    result.phase === "P47",
    "phase",
    "must be P47"
  );
  assertResultArtifactReportBoundary(
    result.dryRunOnly === true,
    "dryRunOnly",
    "must be true"
  );
  assertResultArtifactReportBoundary(
    result.executedAt === null,
    "executedAt",
    "must be null"
  );
  assertResultArtifactReportBoundary(
    result.noRealExecution === true,
    "noRealExecution",
    "must be true"
  );
  assertResultArtifactReportBoundary(
    result.entersAlphaScore === false,
    "entersAlphaScore",
    "must be false"
  );
  assertResultArtifactReportBoundary(
    resultArtifactReportGeneratedAt.length > 0,
    "resultArtifactReportGeneratedAt",
    "must not be empty"
  );

  const resultArtifactReportId = `p47-result-artifact-report-${result.resultArtifactId}-${resultArtifactReportGeneratedAt}`;

  return Object.freeze({
    resultArtifactReportId,
    phase: "P47" as const,
    version: PAPER_SIMULATION_DRY_RUN_RESULT_ARTIFACT_REPORT_VERSION,
    resultArtifactVersion: PAPER_SIMULATION_DRY_RUN_RESULT_ARTIFACT_VERSION,
    resultArtifactId: result.resultArtifactId,
    fullPipelineRehearsalId: result.fullPipelineRehearsalId,
    rehearsalId: result.rehearsalId,
    integrationId: result.integrationId,
    runnerId: result.runnerId,
    lifecycleId: result.lifecycleId,
    runId: result.runId,
    materializationStepsCompleted: result.materializationStepsCompleted,
    materializationStepsTotal: result.materializationStepsTotal,
    fullPipelineRehearsalStepsCompleted: result.fullPipelineRehearsalStepsCompleted,
    rehearsalStepsCompleted: result.rehearsalStepsCompleted,
    pipelineStepsCompleted: result.pipelineStepsCompleted,
    materializationStartedAt: result.materializationStartedAt,
    materializationCompletedAt: result.materializationCompletedAt,
    resultArtifactReportGeneratedAt,
    executedAt: null,
    stubResult: DRY_RUN_STUB_RESULT,
    isResultArtifactReport: true as const,
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
