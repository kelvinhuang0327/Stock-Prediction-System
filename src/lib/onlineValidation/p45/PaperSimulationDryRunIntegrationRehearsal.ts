/**
 * P45 — Paper Simulation Dry-run Integration Rehearsal
 *
 * Meta-layer over P44: runs the full integration pipeline, builds the
 * integration report, verifies all governance boundaries, and produces
 * an immutable rehearsal record.
 *
 * Orchestration (2 rehearsal steps):
 *   Step 1: runDryRunIntegration     (P44) — full P39→P43 pipeline
 *   Step 2: buildIntegrationReport  (P44) — integration-level report
 *   → PaperSimulationDryRunIntegrationRehearsalResult (P45)
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - stubResult = DRY_RUN_STUB_ONLY
 * - 2 rehearsal steps, 5 pipeline steps (inherited from P44)
 *
 * Authorization:
 *   YES design paper simulation dry-run integration rehearsal for P45
 */

import type { PaperSimulationInputBundle } from "../p39/PaperSimulationInputContractBuilder";
import { DRY_RUN_STUB_RESULT } from "../p41/PaperSimulationDryRunContract";
import {
  runDryRunIntegration,
} from "../p44/PaperSimulationDryRunIntegration";
import type { PaperSimulationDryRunIntegrationResult } from "../p44/PaperSimulationDryRunIntegration";
import {
  buildIntegrationReport,
} from "../p44/PaperSimulationDryRunIntegrationReport";
import type { PaperSimulationDryRunIntegrationReport } from "../p44/PaperSimulationDryRunIntegrationReport";

// ─── Constants ────────────────────────────────────────────────────────────────

export const P45_EXECUTION_STATUS =
  "EXECUTION_LIFECYCLE_RUNNER_INTEGRATION_REHEARSAL_READY" as const;
export type P45ExecutionStatus = typeof P45_EXECUTION_STATUS;

export const PAPER_SIMULATION_DRY_RUN_INTEGRATION_REHEARSAL_VERSION =
  "p45-paper-simulation-dry-run-lifecycle-runner-integration-rehearsal-v1" as const;

export const P45_REHEARSAL_STEPS_TOTAL = 2 as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaperSimulationDryRunIntegrationRehearsalInput {
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
  /** ISO string — rehearsal start (P45) */
  readonly rehearsalStartedAt: string;
  /** ISO string — rehearsal completion (P45) */
  readonly rehearsalCompletedAt: string;
}

export interface PaperSimulationDryRunIntegrationRehearsalResult {
  // Identity
  readonly rehearsalId: string;
  readonly phase: "P45";
  readonly version: string;
  readonly executionStatus: P45ExecutionStatus;

  // Embedded upstream results
  readonly integrationResult: PaperSimulationDryRunIntegrationResult;
  readonly integrationReport: PaperSimulationDryRunIntegrationReport;

  // Upstream references
  readonly integrationId: string;
  readonly runnerId: string;
  readonly lifecycleId: string;
  readonly runId: string;

  // Rehearsal summary
  readonly rehearsalStepsCompleted: typeof P45_REHEARSAL_STEPS_TOTAL;
  readonly rehearsalStepsTotal: typeof P45_REHEARSAL_STEPS_TOTAL;
  readonly pipelineStepsCompleted: number;

  // Rehearsal timeline
  readonly rehearsalStartedAt: string;
  readonly rehearsalCompletedAt: string;
  readonly executedAt: null;

  // Stub marker
  readonly stubResult: typeof DRY_RUN_STUB_RESULT;

  // Governance flags (all P39–P44 flags + P45)
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

function assertRehearsalBoundary(
  condition: boolean,
  field: string,
  detail: string
): void {
  if (!condition) {
    throw new Error(
      `[P45] RehearsalBoundaryViolation: ${field} — ${detail}`
    );
  }
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Run the P45 dry-run integration rehearsal.
 *
 * Performs 2 rehearsal steps:
 *   Step 1: runDryRunIntegration   (P44) — orchestrates 5 pipeline steps
 *   Step 2: buildIntegrationReport (P44) — builds integration-level report
 *
 * All steps are stub-only. No real execution at any layer.
 * Returns a frozen PaperSimulationDryRunIntegrationRehearsalResult.
 *
 * Throws [P45] RehearsalBoundaryViolation on any boundary violation.
 */
export function runDryRunIntegrationRehearsal(
  input: PaperSimulationDryRunIntegrationRehearsalInput
): PaperSimulationDryRunIntegrationRehearsalResult {
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
  } = input;

  // ── Input boundary checks ──────────────────────────────────────────────────

  assertRehearsalBoundary(
    bundle.dryRunOnly === true,
    "bundle.dryRunOnly",
    "must be true — only dry-run bundles are permitted"
  );
  assertRehearsalBoundary(
    bundle.paperOnly === true,
    "bundle.paperOnly",
    "must be true — only paper-only bundles are permitted"
  );
  assertRehearsalBoundary(
    bundle.entersAlphaScore === false,
    "bundle.entersAlphaScore",
    "must be false — bundle must not enter alpha score"
  );
  assertRehearsalBoundary(
    generatedAt.length > 0,
    "generatedAt",
    "must not be empty"
  );
  assertRehearsalBoundary(
    requestedAt.length > 0,
    "requestedAt",
    "must not be empty"
  );
  assertRehearsalBoundary(
    startedAt.length > 0,
    "startedAt",
    "must not be empty"
  );
  assertRehearsalBoundary(
    completedAt.length > 0,
    "completedAt",
    "must not be empty"
  );
  assertRehearsalBoundary(
    reportGeneratedAt.length > 0,
    "reportGeneratedAt",
    "must not be empty"
  );
  assertRehearsalBoundary(
    integrationStartedAt.length > 0,
    "integrationStartedAt",
    "must not be empty"
  );
  assertRehearsalBoundary(
    integrationCompletedAt.length > 0,
    "integrationCompletedAt",
    "must not be empty"
  );
  assertRehearsalBoundary(
    integrationReportGeneratedAt.length > 0,
    "integrationReportGeneratedAt",
    "must not be empty"
  );
  assertRehearsalBoundary(
    rehearsalStartedAt.length > 0,
    "rehearsalStartedAt",
    "must not be empty"
  );
  assertRehearsalBoundary(
    rehearsalCompletedAt.length > 0,
    "rehearsalCompletedAt",
    "must not be empty"
  );

  // ── Rehearsal Step 1: Run full integration (P44) ──────────────────────────
  const integrationResult = runDryRunIntegration({
    bundle,
    generatedAt,
    requestedAt,
    startedAt,
    completedAt,
    reportGeneratedAt,
    integrationStartedAt,
    integrationCompletedAt,
  });

  // ── Rehearsal Step 2: Build integration report (P44) ─────────────────────
  const integrationReport = buildIntegrationReport(
    integrationResult,
    integrationReportGeneratedAt
  );

  // ── Post-rehearsal boundary checks ────────────────────────────────────────

  assertRehearsalBoundary(
    integrationResult.executedAt === null,
    "integrationResult.executedAt",
    "must remain null after rehearsal — no real execution"
  );
  assertRehearsalBoundary(
    integrationResult.entersAlphaScore === false,
    "integrationResult.entersAlphaScore",
    "must remain false after rehearsal"
  );
  assertRehearsalBoundary(
    integrationResult.noRealExecution === true,
    "integrationResult.noRealExecution",
    "must remain true after rehearsal"
  );
  assertRehearsalBoundary(
    integrationReport.executedAt === null,
    "integrationReport.executedAt",
    "must remain null in integration report"
  );

  const rehearsalId = `p45-rehearsal-${integrationResult.runId}-${rehearsalStartedAt}`;

  return Object.freeze({
    rehearsalId,
    phase: "P45" as const,
    version: PAPER_SIMULATION_DRY_RUN_INTEGRATION_REHEARSAL_VERSION,
    executionStatus: P45_EXECUTION_STATUS,
    integrationResult,
    integrationReport,
    integrationId: integrationResult.integrationId,
    runnerId: integrationResult.runnerId,
    lifecycleId: integrationResult.lifecycleId,
    runId: integrationResult.runId,
    rehearsalStepsCompleted: P45_REHEARSAL_STEPS_TOTAL,
    rehearsalStepsTotal: P45_REHEARSAL_STEPS_TOTAL,
    pipelineStepsCompleted: integrationResult.pipelineStepsCompleted,
    rehearsalStartedAt,
    rehearsalCompletedAt,
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
