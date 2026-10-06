/**
 * P47 — Paper Simulation Dry-run Result Artifact Materialization
 *
 * Meta-layer over P46: runs the full pipeline rehearsal, builds the
 * full-pipeline rehearsal report, verifies all governance boundaries, and
 * produces an immutable result artifact record.
 *
 * Orchestration (2 result artifact materialization steps):
 *   Step 1: runDryRunFullPipelineRehearsal  (P46) — 2 full-pipeline rehearsal steps / 2 rehearsal steps / 5 pipeline steps
 *   Step 2: buildFullPipelineRehearsalReport (P46) — full-pipeline rehearsal report
 *   → PaperSimulationDryRunResultArtifactResult (P47)
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - stubResult = DRY_RUN_STUB_ONLY
 * - 2 materialization steps, 2 full-pipeline rehearsal steps, 2 rehearsal steps, 5 pipeline steps
 *
 * Authorization:
 *   YES design paper simulation dry-run result artifact materialization for P47
 */

import type { PaperSimulationInputBundle } from "../p39/PaperSimulationInputContractBuilder";
import { DRY_RUN_STUB_RESULT } from "../p41/PaperSimulationDryRunContract";
import {
  runDryRunFullPipelineRehearsal,
} from "../p46/PaperSimulationDryRunFullPipelineRehearsal";
import type { PaperSimulationDryRunFullPipelineRehearsalResult } from "../p46/PaperSimulationDryRunFullPipelineRehearsal";
import {
  buildFullPipelineRehearsalReport,
} from "../p46/PaperSimulationDryRunFullPipelineRehearsalReport";
import type { PaperSimulationDryRunFullPipelineRehearsalReport } from "../p46/PaperSimulationDryRunFullPipelineRehearsalReport";

// ─── Constants ────────────────────────────────────────────────────────────────

export const P47_EXECUTION_STATUS =
  "EXECUTION_LIFECYCLE_RUNNER_RESULT_ARTIFACT_MATERIALIZATION_READY" as const;
export type P47ExecutionStatus = typeof P47_EXECUTION_STATUS;

export const PAPER_SIMULATION_DRY_RUN_RESULT_ARTIFACT_VERSION =
  "p47-paper-simulation-dry-run-lifecycle-runner-result-artifact-materialization-v1" as const;

export const P47_RESULT_ARTIFACT_MATERIALIZATION_STEPS_TOTAL = 2 as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaperSimulationDryRunResultArtifactInput {
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
  /** ISO string — P46 full pipeline rehearsal report timestamp */
  readonly fullPipelineRehearsalReportGeneratedAt: string;
  /** ISO string — P47 materialization start */
  readonly materializationStartedAt: string;
  /** ISO string — P47 materialization completion */
  readonly materializationCompletedAt: string;
}

export interface PaperSimulationDryRunResultArtifactResult {
  // Identity
  readonly resultArtifactId: string;
  readonly phase: "P47";
  readonly version: string;
  readonly executionStatus: P47ExecutionStatus;

  // Embedded upstream results
  readonly fullPipelineRehearsalResult: PaperSimulationDryRunFullPipelineRehearsalResult;
  readonly fullPipelineRehearsalReport: PaperSimulationDryRunFullPipelineRehearsalReport;

  // Upstream references
  readonly fullPipelineRehearsalId: string;
  readonly rehearsalId: string;
  readonly integrationId: string;
  readonly runnerId: string;
  readonly lifecycleId: string;
  readonly runId: string;

  // Step counts
  readonly materializationStepsCompleted: typeof P47_RESULT_ARTIFACT_MATERIALIZATION_STEPS_TOTAL;
  readonly materializationStepsTotal: typeof P47_RESULT_ARTIFACT_MATERIALIZATION_STEPS_TOTAL;
  readonly fullPipelineRehearsalStepsCompleted: number;
  readonly rehearsalStepsCompleted: number;
  readonly pipelineStepsCompleted: number;

  // Materialization timeline
  readonly materializationStartedAt: string;
  readonly materializationCompletedAt: string;
  readonly executedAt: null;

  // Stub marker
  readonly stubResult: typeof DRY_RUN_STUB_RESULT;

  // Governance flags (all P39–P46 flags + P47)
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

function assertResultArtifactMaterializationBoundary(
  condition: boolean,
  field: string,
  detail: string
): void {
  if (!condition) {
    throw new Error(
      `[P47] ResultArtifactMaterializationBoundaryViolation: ${field} — ${detail}`
    );
  }
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Run the P47 dry-run result artifact materialization.
 *
 * Performs 2 materialization steps:
 *   Step 1: runDryRunFullPipelineRehearsal  (P46) — 2 full-pipeline rehearsal steps / 2 rehearsal steps / 5 pipeline steps
 *   Step 2: buildFullPipelineRehearsalReport (P46) — builds full-pipeline rehearsal report
 *
 * All steps are stub-only. No real execution at any layer.
 * Returns a frozen PaperSimulationDryRunResultArtifactResult.
 *
 * Throws [P47] ResultArtifactMaterializationBoundaryViolation on any boundary violation.
 */
export function materializeDryRunResultArtifact(
  input: PaperSimulationDryRunResultArtifactInput
): PaperSimulationDryRunResultArtifactResult {
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
    fullPipelineRehearsalReportGeneratedAt,
    materializationStartedAt,
    materializationCompletedAt,
  } = input;

  // ── Input boundary checks ──────────────────────────────────────────────────

  assertResultArtifactMaterializationBoundary(
    bundle.dryRunOnly === true,
    "bundle.dryRunOnly",
    "must be true — only dry-run bundles are permitted"
  );
  assertResultArtifactMaterializationBoundary(
    bundle.paperOnly === true,
    "bundle.paperOnly",
    "must be true — only paper-only bundles are permitted"
  );
  assertResultArtifactMaterializationBoundary(
    bundle.entersAlphaScore === false,
    "bundle.entersAlphaScore",
    "must be false — bundle must not enter alpha score"
  );
  assertResultArtifactMaterializationBoundary(
    generatedAt.length > 0,
    "generatedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    requestedAt.length > 0,
    "requestedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    startedAt.length > 0,
    "startedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    completedAt.length > 0,
    "completedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    reportGeneratedAt.length > 0,
    "reportGeneratedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    integrationStartedAt.length > 0,
    "integrationStartedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    integrationCompletedAt.length > 0,
    "integrationCompletedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    integrationReportGeneratedAt.length > 0,
    "integrationReportGeneratedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    rehearsalStartedAt.length > 0,
    "rehearsalStartedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    rehearsalCompletedAt.length > 0,
    "rehearsalCompletedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    rehearsalReportGeneratedAt.length > 0,
    "rehearsalReportGeneratedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    fullPipelineRehearsalStartedAt.length > 0,
    "fullPipelineRehearsalStartedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    fullPipelineRehearsalCompletedAt.length > 0,
    "fullPipelineRehearsalCompletedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    fullPipelineRehearsalReportGeneratedAt.length > 0,
    "fullPipelineRehearsalReportGeneratedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    materializationStartedAt.length > 0,
    "materializationStartedAt",
    "must not be empty"
  );
  assertResultArtifactMaterializationBoundary(
    materializationCompletedAt.length > 0,
    "materializationCompletedAt",
    "must not be empty"
  );

  // ── Materialization Step 1: Run full pipeline rehearsal (P46) ─────────────
  const fullPipelineRehearsalResult = runDryRunFullPipelineRehearsal({
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
  });

  // ── Materialization Step 2: Build full pipeline rehearsal report (P46) ────
  const fullPipelineRehearsalReport = buildFullPipelineRehearsalReport(
    fullPipelineRehearsalResult,
    fullPipelineRehearsalReportGeneratedAt
  );

  // ── Post-materialization boundary checks ──────────────────────────────────

  assertResultArtifactMaterializationBoundary(
    fullPipelineRehearsalResult.executedAt === null,
    "fullPipelineRehearsalResult.executedAt",
    "must remain null after result artifact materialization — no real execution"
  );
  assertResultArtifactMaterializationBoundary(
    fullPipelineRehearsalResult.entersAlphaScore === false,
    "fullPipelineRehearsalResult.entersAlphaScore",
    "must remain false after result artifact materialization"
  );
  assertResultArtifactMaterializationBoundary(
    fullPipelineRehearsalResult.noRealExecution === true,
    "fullPipelineRehearsalResult.noRealExecution",
    "must remain true after result artifact materialization"
  );
  assertResultArtifactMaterializationBoundary(
    fullPipelineRehearsalReport.executedAt === null,
    "fullPipelineRehearsalReport.executedAt",
    "must remain null in full pipeline rehearsal report"
  );

  const resultArtifactId = `p47-result-artifact-${fullPipelineRehearsalResult.runId}-${materializationStartedAt}`;

  return Object.freeze({
    resultArtifactId,
    phase: "P47" as const,
    version: PAPER_SIMULATION_DRY_RUN_RESULT_ARTIFACT_VERSION,
    executionStatus: P47_EXECUTION_STATUS,
    fullPipelineRehearsalResult,
    fullPipelineRehearsalReport,
    fullPipelineRehearsalId: fullPipelineRehearsalResult.fullPipelineRehearsalId,
    rehearsalId: fullPipelineRehearsalResult.rehearsalId,
    integrationId: fullPipelineRehearsalResult.integrationId,
    runnerId: fullPipelineRehearsalResult.runnerId,
    lifecycleId: fullPipelineRehearsalResult.lifecycleId,
    runId: fullPipelineRehearsalResult.runId,
    materializationStepsCompleted: P47_RESULT_ARTIFACT_MATERIALIZATION_STEPS_TOTAL,
    materializationStepsTotal: P47_RESULT_ARTIFACT_MATERIALIZATION_STEPS_TOTAL,
    fullPipelineRehearsalStepsCompleted: fullPipelineRehearsalResult.fullPipelineRehearsalStepsCompleted,
    rehearsalStepsCompleted: fullPipelineRehearsalResult.rehearsalStepsCompleted,
    pipelineStepsCompleted: fullPipelineRehearsalResult.pipelineStepsCompleted,
    materializationStartedAt,
    materializationCompletedAt,
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
