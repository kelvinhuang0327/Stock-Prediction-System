/**
 * P43 — Paper Simulation Dry-run Lifecycle Runner
 *
 * Drives a P42 lifecycle state machine through a complete stub-only run:
 *   PENDING → RUNNING → COMPLETE
 * Records log entries at each step using P42 log primitives.
 * Returns an immutable RunnerResult. No real execution at any point.
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - stubResult = DRY_RUN_STUB_ONLY
 *
 * Authorization:
 *   YES design paper simulation dry-run lifecycle runner for P43
 */

import type {
  P42LifecycleState,
  P42LifecycleTransition,
  PaperSimulationDryRunLifecycleState,
} from "../p42/PaperSimulationDryRunLifecycle";
import { transitionLifecycle } from "../p42/PaperSimulationDryRunLifecycle";
import { DRY_RUN_STUB_RESULT } from "../p41/PaperSimulationDryRunContract";
import type { PaperSimulationDryRunLog } from "../p42/PaperSimulationDryRunLog";
import {
  createDryRunLogEntry,
  appendLogEntry,
  createEmptyLog,
} from "../p42/PaperSimulationDryRunLog";

// ─── Constants ────────────────────────────────────────────────────────────────

export const P43_EXECUTION_STATUS = "EXECUTION_LIFECYCLE_RUNNER_READY" as const;
export type P43ExecutionStatus = typeof P43_EXECUTION_STATUS;

export const PAPER_SIMULATION_DRY_RUN_LIFECYCLE_RUNNER_VERSION =
  "p43-paper-simulation-dry-run-lifecycle-runner-v1" as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaperSimulationDryRunRunnerInput {
  readonly lifecycle: PaperSimulationDryRunLifecycleState;
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface PaperSimulationDryRunRunnerResult {
  // Identity
  readonly runnerId: string;
  readonly phase: "P43";
  readonly version: string;
  readonly executionStatus: P43ExecutionStatus;

  // Inherited from P42
  readonly lifecycleId: string;
  readonly runId: string;
  readonly p42Version: string;

  // Runner timeline
  readonly startedAt: string;
  readonly completedAt: string;
  readonly executedAt: null;

  // Lifecycle outcome
  readonly initialState: P42LifecycleState;
  readonly finalState: P42LifecycleState;
  readonly transitions: readonly P42LifecycleTransition[];

  // Immutable log of all runner events
  readonly log: PaperSimulationDryRunLog;

  // Stub marker
  readonly stubResult: typeof DRY_RUN_STUB_RESULT;

  // Governance flags (all P40/P41/P42 inherited + P43)
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

function assertRunnerBoundary(
  condition: boolean,
  field: string,
  detail: string
): void {
  if (!condition) {
    throw new Error(`[P43] RunnerBoundaryViolation: ${field} — ${detail}`);
  }
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Drive a P42 lifecycle through a complete stub-only run.
 * Input lifecycle MUST be in PENDING state.
 * Transitions: PENDING → RUNNING → COMPLETE.
 * All steps are stub-only. executedAt is always null.
 * Throws [P43] RunnerBoundaryViolation on any boundary violation.
 */
export function runDryRunLifecycle(
  input: PaperSimulationDryRunRunnerInput
): PaperSimulationDryRunRunnerResult {
  const { lifecycle, startedAt, completedAt } = input;

  // Boundary checks
  assertRunnerBoundary(
    lifecycle.dryRunOnly === true,
    "dryRunOnly",
    "must be true — only dry-run lifecycles accepted"
  );
  assertRunnerBoundary(
    lifecycle.stubResult === DRY_RUN_STUB_RESULT,
    "stubResult",
    `must be ${DRY_RUN_STUB_RESULT}`
  );
  assertRunnerBoundary(
    lifecycle.executedAt === null,
    "executedAt",
    "must be null — no real execution permitted"
  );
  assertRunnerBoundary(
    lifecycle.noRealExecution === true,
    "noRealExecution",
    "must be true"
  );
  assertRunnerBoundary(
    lifecycle.state === "PENDING",
    "state",
    `runner requires PENDING state as input, received: ${lifecycle.state}`
  );
  assertRunnerBoundary(
    startedAt.length > 0,
    "startedAt",
    "must not be empty"
  );
  assertRunnerBoundary(
    completedAt.length > 0,
    "completedAt",
    "must not be empty"
  );

  const initialState = lifecycle.state;
  const { lifecycleId } = lifecycle;

  // ── Build log ──────────────────────────────────────────────────────────────

  let log: PaperSimulationDryRunLog = createEmptyLog();

  // Step 1 — validation passed
  log = appendLogEntry(log, createDryRunLogEntry({
    eventType: "VALIDATION_PASSED",
    message: "P43 runner boundary checks passed — proceeding with stub-only run",
    createdAt: startedAt,
    lifecycleId,
  }));

  // Step 2 — transition PENDING → RUNNING
  const running = transitionLifecycle(lifecycle, "RUNNING", startedAt);
  log = appendLogEntry(log, createDryRunLogEntry({
    eventType: "TRANSITION_COMPLETED",
    message: "Lifecycle transitioned PENDING → RUNNING",
    createdAt: startedAt,
    lifecycleId,
    fromState: "PENDING",
    toState: "RUNNING",
  }));

  // Step 3 — transition RUNNING → COMPLETE
  const complete = transitionLifecycle(running, "COMPLETE", completedAt);
  log = appendLogEntry(log, createDryRunLogEntry({
    eventType: "TRANSITION_COMPLETED",
    message: "Lifecycle transitioned RUNNING → COMPLETE",
    createdAt: completedAt,
    lifecycleId,
    fromState: "RUNNING",
    toState: "COMPLETE",
  }));

  // Step 4 — runner complete
  log = appendLogEntry(log, createDryRunLogEntry({
    eventType: "BOUNDARY_CHECK_PASSED",
    message: "P43 runner complete — stub only, no real execution, executedAt=null",
    createdAt: completedAt,
    lifecycleId,
  }));

  const runnerId = `p43-runner-${lifecycle.runId}-${startedAt}`;

  return Object.freeze({
    runnerId,
    phase: "P43" as const,
    version: PAPER_SIMULATION_DRY_RUN_LIFECYCLE_RUNNER_VERSION,
    executionStatus: P43_EXECUTION_STATUS,
    lifecycleId,
    runId: lifecycle.runId,
    p42Version: lifecycle.version,
    startedAt,
    completedAt,
    executedAt: null,
    initialState,
    finalState: complete.state,
    transitions: complete.transitions,
    log,
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
