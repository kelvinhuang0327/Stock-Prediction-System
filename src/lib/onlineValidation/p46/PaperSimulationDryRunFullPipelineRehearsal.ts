/**
 * P46 — Paper Simulation Dry-run Full Pipeline Rehearsal
 *
 * Meta-layer over P45: runs the full integration rehearsal, builds the
 * rehearsal report, verifies all governance boundaries, and produces
 * an immutable full-pipeline rehearsal record.
 *
 * Orchestration (2 full-pipeline rehearsal steps):
 *   Step 1: runDryRunIntegrationRehearsal  (P45) — 2 rehearsal steps / 5 pipeline steps
 *   Step 2: buildRehearsalReport           (P45) — rehearsal-level report
 *   → PaperSimulationDryRunFullPipelineRehearsalResult (P46)
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - stubResult = DRY_RUN_STUB_ONLY
 * - 2 full-pipeline rehearsal steps, 2 rehearsal steps, 5 pipeline steps
 *
 * Authorization:
 *   YES design paper simulation dry-run full pipeline rehearsal for P46
 */

import type { PaperSimulationInputBundle } from "../p39/PaperSimulationInputContractBuilder";
import { DRY_RUN_STUB_RESULT } from "../p41/PaperSimulationDryRunContract";
import {
  runDryRunIntegrationRehearsal,
} from "../p45/PaperSimulationDryRunIntegrationRehearsal";
import type { PaperSimulationDryRunIntegrationRehearsalResult } from "../p45/PaperSimulationDryRunIntegrationRehearsal";
import {
  buildRehearsalReport,
} from "../p45/PaperSimulationDryRunIntegrationRehearsalReport";
import type { PaperSimulationDryRunIntegrationRehearsalReport } from "../p45/PaperSimulationDryRunIntegrationRehearsalReport";

// ─── Constants ────────────────────────────────────────────────────────────────

export const P46_EXECUTION_STATUS =
  "EXECUTION_LIFECYCLE_RUNNER_FULL_PIPELINE_REHEARSAL_READY" as const;
export type P46ExecutionStatus = typeof P46_EXECUTION_STATUS;

export const PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION =
  "p46-paper-simulation-dry-run-lifecycle-runner-full-pipeline-rehearsal-v1" as const;

export const P46_FULL_PIPELINE_REHEARSAL_STEPS_TOTAL = 2 as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaperSimulationDryRunFullPipelineRehearsalInput {
  readonly bundle: PaperSimulationInputBundle;
  /** ISO string — for framework plan generation (P40) */
  readonly generatedAt: string;
  /** ISO string — for dry run requestedAt (P41) */
  readonly requestedAt: string;
  /** ISO string — runner startedAt (P43) */
  readonly startedAt: string;
  /** ISO string — runner completedAt (P43) */
  readonly completedAt: string;
  /** ISO string — runner report timestamp (P43) */
  readonly reportGeneratedAt: string;
  /** ISO string — integration start (P44) */
  readonly integrationStartedAt: string;
  /** ISO string — integration completion (P44) */
  readonly integrationCompletedAt: string;
  /** ISO string — integration report timestamp (P44) */
  readonly integrationReportGeneratedAt: string;
  /** ISO string — P45 rehearsal start */
  readonly rehearsalStartedAt: string;
  /** ISO string — P45 rehearsal completion */
  readonly rehearsalCompletedAt: string;
  /** ISO string — P45 rehearsal report timestamp */
  readonly rehearsalReportGeneratedAt: string;
  /** ISO string — P46 full pipeline rehearsal start */
  readonly fullPipelineRehearsalStartedAt: string;
  /** ISO string — P46 full pipeline rehearsal completion */
  readonly fullPipelineRehearsalCompletedAt: string;
}

export interface PaperSimulationDryRunFullPipelineRehearsalResult {
  // Identity
  readonly fullPipelineRehearsalId: string;
  readonly phase: "P46";
  readonly version: string;
  readonly executionStatus: P46ExecutionStatus;

  // Embedded upstream results
  readonly rehearsalResult: PaperSimulationDryRunIntegrationRehearsalResult;
  readonly rehearsalReport: PaperSimulationDryRunIntegrationRehearsalReport;

  // Upstream references
  readonly rehearsalId: string;
  readonly integrationId: string;
  readonly runnerId: string;
  readonly lifecycleId: string;
  readonly runId: string;

  // Step counts
  readonly fullPipelineRehearsalStepsCompleted: typeof P46_FULL_PIPELINE_REHEARSAL_STEPS_TOTAL;
  readonly fullPipelineRehearsalStepsTotal: typeof P46_FULL_PIPELINE_REHEARSAL_STEPS_TOTAL;
  readonly rehearsalStepsCompleted: number;
  readonly pipelineStepsCompleted: number;

  // Full pipeline rehearsal timeline
  readonly fullPipelineRehearsalStartedAt: string;
  readonly fullPipelineRehearsalCompletedAt: string;
  readonly executedAt: null;

  // Stub marker
  readonly stubResult: typeof DRY_RUN_STUB_RESULT;

  // Governance flags (all P39–P45 flags + P46)
  readonly dryRunOnly: true;
  readonly paperOnly: true;
  readonly noActualMetrics: true;
  readonly entersAlphaScore: false;
  readonly noAlphaScore: true;
  readonly noRecommendation: true;
  readonly noPnL: true;
  readonly noROI: true;
  readonly noWinRate: true;
  readonly noReturnPct: true;
  readonly noOptimizer: true;
  readonly noRealBacktest: true;
  readonly noInvestmentAdvice: true;
  readonly noBuySellActionSemantics: true;
  readonly noRealExecution: true;
}

// ─── Boundary guard ───────────────────────────────────────────────────────────

function assertFullPipelineRehearsalBoundary(
  condition: boolean,
  field: string,
  detail: string
): void {
  if (!condition) {
    throw new Error(
      `[P46] FullPipelineRehearsalBoundaryViolation: ${field} — ${detail}`
    );
  }
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Run the P46 dry-run full pipeline rehearsal.
 *
 * Performs 2 full-pipeline rehearsal steps:
 *   Step 1: runDryRunIntegrationRehearsal (P45) — 2 rehearsal steps / 5 pipeline steps
 *   Step 2: buildRehearsalReport          (P45) — builds rehearsal-level report
 *
 * All steps are stub-only. No real execution at any layer.
 * Returns a frozen PaperSimulationDryRunFullPipelineRehearsalResult.
 *
 * Throws [P46] FullPipelineRehearsalBoundaryViolation on any boundary violation.
 */
export function runDryRunFullPipelineRehearsal(
  input: PaperSimulationDryRunFullPipelineRehearsalInput
): PaperSimulationDryRunFullPipelineRehearsalResult {
  const {
    bundle,
    generatedAt,
    requestedAt,
    startedAt,
    completedAt,
    reportGeneratedAt,
    integrationStartedAt,
    integrationCompletedAt,
    integrationReportGeneratedAt,
    rehearsalStartedAt,
    rehearsalCompletedAt,
    rehearsalReportGeneratedAt,
    fullPipelineRehearsalStartedAt,
    fullPipelineRehearsalCompletedAt,
  } = input;

  // ── Input boundary checks ──────────────────────────────────────────────────

  assertFullPipelineRehearsalBoundary(
    bundle.dryRunOnly === true,
    "bundle.dryRunOnly",
    "must be true — only dry-run bundles are permitted"
  );
  assertFullPipelineRehearsalBoundary(
    bundle.paperOnly === true,
    "bundle.paperOnly",
    "must be true — only paper-only bundles are permitted"
  );
  assertFullPipelineRehearsalBoundary(
    bundle.entersAlphaScore === false,
    "bundle.entersAlphaScore",
    "must be false — bundle must not enter alpha score"
  );
  assertFullPipelineRehearsalBoundary(
    generatedAt.length > 0,
    "generatedAt",
    "must not be empty"
  );
  assertFullPipelineRehearsalBoundary(
    requestedAt.length > 0,
    "requestedAt",
    "must not be empty"
  );
  assertFullPipelineRehearsalBoundary(
    startedAt.length > 0,
    "startedAt",
    "must not be empty"
  );
  assertFullPipelineRehearsalBoundary(
    completedAt.length > 0,
    "completedAt",
    "must not be empty"
  );
  assertFullPipelineRehearsalBoundary(
    reportGeneratedAt.length > 0,
    "reportGeneratedAt",
    "must not be empty"
  );
  assertFullPipelineRehearsalBoundary(
    integrationStartedAt.length > 0,
    "integrationStartedAt",
    "must not be empty"
  );
  assertFullPipelineRehearsalBoundary(
    integrationCompletedAt.length > 0,
    "integrationCompletedAt",
    "must not be empty"
  );
  assertFullPipelineRehearsalBoundary(
    integrationReportGeneratedAt.length > 0,
    "integrationReportGeneratedAt",
    "must not be empty"
  );
  assertFullPipelineRehearsalBoundary(
    rehearsalStartedAt.length > 0,
    "rehearsalStartedAt",
    "must not be empty"
  );
  assertFullPipelineRehearsalBoundary(
    rehearsalCompletedAt.length > 0,
    "rehearsalCompletedAt",
    "must not be empty"
  );
  assertFullPipelineRehearsalBoundary(
    rehearsalReportGeneratedAt.length > 0,
    "rehearsalReportGeneratedAt",
    "must not be empty"
  );
  assertFullPipelineRehearsalBoundary(
    fullPipelineRehearsalStartedAt.length > 0,
    "fullPipelineRehearsalStartedAt",
    "must not be empty"
  );
  assertFullPipelineRehearsalBoundary(
    fullPipelineRehearsalCompletedAt.length > 0,
    "fullPipelineRehearsalCompletedAt",
    "must not be empty"
  );

  // ── Full Pipeline Rehearsal Step 1: Run rehearsal (P45) ───────────────────
  const rehearsalResult = runDryRunIntegrationRehearsal({
    bundle,
    generatedAt,
    requestedAt,
    startedAt,
    completedAt,
    reportGeneratedAt,
    integrationStartedAt,
    integrationCompletedAt,
    integrationReportGeneratedAt,
    rehearsalStartedAt,
    rehearsalCompletedAt,
  });

  // ── Full Pipeline Rehearsal Step 2: Build rehearsal report (P45) ──────────
  const rehearsalReport = buildRehearsalReport(
    rehearsalResult,
    rehearsalReportGeneratedAt
  );

  // ── Post-rehearsal boundary checks ────────────────────────────────────────

  assertFullPipelineRehearsalBoundary(
    rehearsalResult.executedAt === null,
    "rehearsalResult.executedAt",
    "must remain null after full pipeline rehearsal — no real execution"
  );
  assertFullPipelineRehearsalBoundary(
    rehearsalResult.entersAlphaScore === false,
    "rehearsalResult.entersAlphaScore",
    "must remain false after full pipeline rehearsal"
  );
  assertFullPipelineRehearsalBoundary(
    rehearsalResult.noRealExecution === true,
    "rehearsalResult.noRealExecution",
    "must remain true after full pipeline rehearsal"
  );
  assertFullPipelineRehearsalBoundary(
    rehearsalReport.executedAt === null,
    "rehearsalReport.executedAt",
    "must remain null in rehearsal report"
  );

  const fullPipelineRehearsalId = `p46-full-pipeline-rehearsal-${rehearsalResult.runId}-${fullPipelineRehearsalStartedAt}`;

  return Object.freeze({
    fullPipelineRehearsalId,
    phase: "P46" as const,
    version: PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION,
    executionStatus: P46_EXECUTION_STATUS,
    rehearsalResult,
    rehearsalReport,
    rehearsalId: rehearsalResult.rehearsalId,
    integrationId: rehearsalResult.integrationId,
    runnerId: rehearsalResult.runnerId,
    lifecycleId: rehearsalResult.lifecycleId,
    runId: rehearsalResult.runId,
    fullPipelineRehearsalStepsCompleted: P46_FULL_PIPELINE_REHEARSAL_STEPS_TOTAL,
    fullPipelineRehearsalStepsTotal: P46_FULL_PIPELINE_REHEARSAL_STEPS_TOTAL,
    rehearsalStepsCompleted: rehearsalResult.rehearsalStepsCompleted,
    pipelineStepsCompleted: rehearsalResult.pipelineStepsCompleted,
    fullPipelineRehearsalStartedAt,
    fullPipelineRehearsalCompletedAt,
    executedAt: null,
    stubResult: DRY_RUN_STUB_RESULT,
    dryRunOnly: true as const,
    paperOnly: true as const,
    noActualMetrics: true as const,
    entersAlphaScore: false as const,
    noAlphaScore: true as const,
    noRecommendation: true as const,
    noPnL: true as const,
    noROI: true as const,
    noWinRate: true as const,
    noReturnPct: true as const,
    noOptimizer: true as const,
    noRealBacktest: true as const,
    noInvestmentAdvice: true as const,
    noBuySellActionSemantics: true as const,
    noRealExecution: true as const,
  });
}
