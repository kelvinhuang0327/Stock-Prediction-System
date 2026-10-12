/**
 * P44 — Paper Simulation Dry-run Lifecycle Runner Integration
 *
 * Orchestrates the full end-to-end dry-run pipeline in a single
 * integration surface:
 *
 *   InputBundle (P39)
 *     → createPaperSimulationFrameworkPlan (P40)
 *     → runPaperSimulationDryRun (P41)
 *     → createDryRunLifecycle (P42)
 *     → runDryRunLifecycle (P43)
 *     → buildRunnerReport (P43)
 *     → PaperSimulationDryRunIntegrationResult (P44)
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - stubResult = DRY_RUN_STUB_ONLY
 * - 5 pipeline steps, all stub-only
 *
 * Authorization:
 *   YES design paper simulation dry-run lifecycle runner integration for P44
 */

import type { PaperSimulationInputBundle } from "../p39/PaperSimulationInputContractBuilder";
import { createPaperSimulationFrameworkPlan } from "../p40/PaperSimulationFrameworkBoundary";
import { runPaperSimulationDryRun } from "../p41/PaperSimulationDryRunRunner";
import { DRY_RUN_STUB_RESULT } from "../p41/PaperSimulationDryRunContract";
import { createDryRunLifecycle } from "../p42/PaperSimulationDryRunLifecycle";
import {
  runDryRunLifecycle,
} from "../p43/PaperSimulationDryRunLifecycleRunner";
import type { PaperSimulationDryRunRunnerResult } from "../p43/PaperSimulationDryRunLifecycleRunner";
import { buildRunnerReport as buildP43RunnerReport } from "../p43/PaperSimulationDryRunRunnerReport";
import type { PaperSimulationDryRunRunnerReport } from "../p43/PaperSimulationDryRunRunnerReport";

// ─── Constants ────────────────────────────────────────────────────────────────

export const P44_EXECUTION_STATUS =
  "EXECUTION_LIFECYCLE_RUNNER_INTEGRATION_READY" as const;
export type P44ExecutionStatus = typeof P44_EXECUTION_STATUS;

export const PAPER_SIMULATION_DRY_RUN_INTEGRATION_VERSION =
  "p44-paper-simulation-dry-run-lifecycle-runner-integration-v1" as const;

export const P44_PIPELINE_STEPS_TOTAL = 5 as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaperSimulationDryRunIntegrationInput {
  readonly bundle: PaperSimulationInputBundle;
  /** ISO string — used for framework plan generation */
  readonly generatedAt: string;
  /** ISO string — used for dry run requestedAt */
  readonly requestedAt: string;
  /** ISO string — passed to runner as startedAt (PENDING→RUNNING) */
  readonly startedAt: string;
  /** ISO string — passed to runner as completedAt (RUNNING→COMPLETE) */
  readonly completedAt: string;
  /** ISO string — passed to buildRunnerReport */
  readonly reportGeneratedAt: string;
  /** ISO string — overall integration start timestamp */
  readonly integrationStartedAt: string;
  /** ISO string — overall integration completion timestamp */
  readonly integrationCompletedAt: string;
}

export interface PaperSimulationDryRunIntegrationResult {
  // Identity
  readonly integrationId: string;
  readonly phase: "P44";
  readonly version: string;
  readonly executionStatus: P44ExecutionStatus;

  // Upstream references
  readonly runnerReport: PaperSimulationDryRunRunnerReport;
  readonly runnerResult: PaperSimulationDryRunRunnerResult;
  readonly runnerId: string;
  readonly lifecycleId: string;
  readonly runId: string;

  // Pipeline summary
  readonly pipelineStepsCompleted: typeof P44_PIPELINE_STEPS_TOTAL;
  readonly pipelineStepsTotal: typeof P44_PIPELINE_STEPS_TOTAL;

  // Integration timeline
  readonly integrationStartedAt: string;
  readonly integrationCompletedAt: string;
  readonly executedAt: null;

  // Stub marker
  readonly stubResult: typeof DRY_RUN_STUB_RESULT;

  // Governance flags (all P39–P43 flags + P44)
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

function assertIntegrationBoundary(
  condition: boolean,
  field: string,
  detail: string
): void {
  if (!condition) {
    throw new Error(
      `[P44] IntegrationBoundaryViolation: ${field} — ${detail}`
    );
  }
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Run the full P44 dry-run integration pipeline.
 *
 * Orchestrates 5 pipeline steps:
 *   Step 1: createPaperSimulationFrameworkPlan     (P40)
 *   Step 2: runPaperSimulationDryRun              (P41)
 *   Step 3: createDryRunLifecycle                  (P42)
 *   Step 4: runDryRunLifecycle                     (P43)
 *   Step 5: buildRunnerReport                      (P43)
 *
 * All steps are stub-only. No real execution at any layer.
 * Returns a frozen PaperSimulationDryRunIntegrationResult.
 *
 * Throws [P44] IntegrationBoundaryViolation on any boundary violation.
 */
export function runDryRunIntegration(
  input: PaperSimulationDryRunIntegrationInput
): PaperSimulationDryRunIntegrationResult {
  const {
    bundle,
    generatedAt,
    requestedAt,
    startedAt,
    completedAt,
    reportGeneratedAt,
    integrationStartedAt,
    integrationCompletedAt,
  } = input;

  // ── Input boundary checks ──────────────────────────────────────────────────

  assertIntegrationBoundary(
    bundle.dryRunOnly === true,
    "bundle.dryRunOnly",
    "must be true — only dry-run bundles are permitted"
  );
  assertIntegrationBoundary(
    bundle.paperOnly === true,
    "bundle.paperOnly",
    "must be true — only paper-only bundles are permitted"
  );
  assertIntegrationBoundary(
    bundle.entersAlphaScore === false,
    "bundle.entersAlphaScore",
    "must be false — bundle must not enter alpha score"
  );
  assertIntegrationBoundary(
    generatedAt.length > 0,
    "generatedAt",
    "must not be empty"
  );
  assertIntegrationBoundary(
    requestedAt.length > 0,
    "requestedAt",
    "must not be empty"
  );
  assertIntegrationBoundary(
    startedAt.length > 0,
    "startedAt",
    "must not be empty"
  );
  assertIntegrationBoundary(
    completedAt.length > 0,
    "completedAt",
    "must not be empty"
  );
  assertIntegrationBoundary(
    reportGeneratedAt.length > 0,
    "reportGeneratedAt",
    "must not be empty"
  );
  assertIntegrationBoundary(
    integrationStartedAt.length > 0,
    "integrationStartedAt",
    "must not be empty"
  );
  assertIntegrationBoundary(
    integrationCompletedAt.length > 0,
    "integrationCompletedAt",
    "must not be empty"
  );

  // ── Step 1: Framework plan (P40) ───────────────────────────────────────────
  const plan = createPaperSimulationFrameworkPlan(bundle, { generatedAt });

  // ── Step 2: Dry run (P41) ──────────────────────────────────────────────────
  const dryRunResult = runPaperSimulationDryRun({
    plan,
    mode: "stub-only",
    requestedAt,
  });

  // ── Step 3: Lifecycle creation (P42) ──────────────────────────────────────
  const lifecycle = createDryRunLifecycle({
    dryRunResult,
    createdAt: startedAt,
  });

  // ── Step 4: Lifecycle runner (P43) ────────────────────────────────────────
  const runnerResult = runDryRunLifecycle({
    lifecycle,
    startedAt,
    completedAt,
  });

  // ── Step 5: Runner report (P43) ───────────────────────────────────────────
  const runnerReport = buildP43RunnerReport(runnerResult, reportGeneratedAt);

  // ── Post-run boundary checks ───────────────────────────────────────────────

  assertIntegrationBoundary(
    runnerResult.executedAt === null,
    "runnerResult.executedAt",
    "must remain null after full pipeline — no real execution"
  );
  assertIntegrationBoundary(
    runnerResult.entersAlphaScore === false,
    "runnerResult.entersAlphaScore",
    "must remain false after full pipeline"
  );
  assertIntegrationBoundary(
    runnerResult.noRealExecution === true,
    "runnerResult.noRealExecution",
    "must remain true after full pipeline"
  );

  const integrationId = `p44-integration-${runnerResult.runId}-${integrationStartedAt}`;

  return Object.freeze({
    integrationId,
    phase: "P44" as const,
    version: PAPER_SIMULATION_DRY_RUN_INTEGRATION_VERSION,
    executionStatus: P44_EXECUTION_STATUS,
    runnerReport,
    runnerResult,
    runnerId: runnerResult.runnerId,
    lifecycleId: runnerResult.lifecycleId,
    runId: runnerResult.runId,
    pipelineStepsCompleted: P44_PIPELINE_STEPS_TOTAL,
    pipelineStepsTotal: P44_PIPELINE_STEPS_TOTAL,
    integrationStartedAt,
    integrationCompletedAt,
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
