/**
 * P42 — Paper Simulation Dry-run Lifecycle Design
 *
 * GOVERNANCE:
 * - paperOnly = true
 * - dryRunOnly = true
 * - entersAlphaScore = false
 * - noActualMetrics = true
 * - No real simulation executed
 * - executedAt = null (inherited from P41)
 * - stubResult = DRY_RUN_STUB_ONLY (inherited from P41)
 * - noRealExecution = true
 *
 * Authorization:
 *   YES design paper simulation dry-run lifecycle for P42
 */

import type { PaperSimulationDryRunResult } from "../p41/PaperSimulationDryRunContract";
import { DRY_RUN_STUB_RESULT } from "../p41/PaperSimulationDryRunContract";

// ─── Constants ────────────────────────────────────────────────────────────────

export const P42_EXECUTION_STATUS = "EXECUTION_LIFECYCLE_READY" as const;
export type P42ExecutionStatus = typeof P42_EXECUTION_STATUS;

export const PAPER_SIMULATION_DRY_RUN_LIFECYCLE_VERSION =
  "p42-paper-simulation-dry-run-lifecycle-v1" as const;

export type P42LifecycleState = "PENDING" | "RUNNING" | "COMPLETE" | "CANCELLED";

export const P42_LIFECYCLE_STATES: readonly P42LifecycleState[] = [
  "PENDING",
  "RUNNING",
  "COMPLETE",
  "CANCELLED",
] as const;

export const P42_INITIAL_STATE: P42LifecycleState = "PENDING";

/** Valid state transitions as [from, to] pairs */
export const P42_VALID_TRANSITIONS: readonly [P42LifecycleState, P42LifecycleState][] = [
  ["PENDING", "RUNNING"],
  ["PENDING", "CANCELLED"],
  ["RUNNING", "COMPLETE"],
  ["RUNNING", "CANCELLED"],
] as const;

export const P42_TERMINAL_STATES: readonly P42LifecycleState[] = [
  "COMPLETE",
  "CANCELLED",
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface P42LifecycleTransition {
  readonly from: P42LifecycleState;
  readonly to: P42LifecycleState;
  readonly transitionedAt: string;
}

export interface PaperSimulationDryRunLifecycleInput {
  readonly dryRunResult: PaperSimulationDryRunResult;
  readonly createdAt: string;
}

export interface PaperSimulationDryRunLifecycleState {
  // Identity
  readonly lifecycleId: string;
  readonly phase: "P42";
  readonly version: string;

  // Inherited from P41
  readonly runId: string;
  readonly dryRunRunId: string;
  readonly stubResult: typeof DRY_RUN_STUB_RESULT;
  readonly p41Version: string;

  // Lifecycle state machine
  readonly state: P42LifecycleState;
  readonly transitions: readonly P42LifecycleTransition[];
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly executedAt: null;

  // Execution status
  readonly executionStatus: P42ExecutionStatus;

  // Governance flags (all inherited from P40/P41 + P42 additions)
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

  // Sources from P40/P41
  readonly eligibleSources: readonly string[];
  readonly blockedSources: readonly string[];
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Create a new dry-run lifecycle in PENDING state.
 * Accepts a P41 DryRunResult and validates all stub boundaries.
 * No real execution. Returns immutable lifecycle state.
 */
export function createDryRunLifecycle(
  input: PaperSimulationDryRunLifecycleInput
): PaperSimulationDryRunLifecycleState {
  const { dryRunResult, createdAt } = input;

  if (dryRunResult.dryRunOnly !== true) {
    throw new Error("[P42] LifecycleBoundaryViolation: dryRunOnly must be true");
  }
  if (dryRunResult.stubResult !== DRY_RUN_STUB_RESULT) {
    throw new Error(
      `[P42] LifecycleBoundaryViolation: stubResult must be ${DRY_RUN_STUB_RESULT}`
    );
  }
  if (dryRunResult.executedAt !== null) {
    throw new Error("[P42] LifecycleBoundaryViolation: executedAt must be null");
  }
  if (!createdAt) {
    throw new Error("[P42] LifecycleBoundaryViolation: createdAt is required");
  }

  const lifecycleId = `p42-lifecycle-${dryRunResult.runId}-${createdAt}`;

  return {
    lifecycleId,
    phase: "P42",
    version: PAPER_SIMULATION_DRY_RUN_LIFECYCLE_VERSION,
    runId: dryRunResult.runId,
    dryRunRunId: dryRunResult.runId,
    stubResult: DRY_RUN_STUB_RESULT,
    p41Version: dryRunResult.version,
    state: P42_INITIAL_STATE,
    transitions: [],
    createdAt,
    completedAt: null,
    cancelledAt: null,
    executedAt: null,
    executionStatus: P42_EXECUTION_STATUS,
    dryRunOnly: true,
    paperOnly: true,
    noActualMetrics: true,
    entersAlphaScore: false,
    noAlphaScore: true,
    noRecommendation: true,
    noPnL: true,
    noROI: true,
    noWinRate: true,
    noReturnPct: true,
    noOptimizer: true,
    noRealBacktest: true,
    noInvestmentAdvice: true,
    noBuySellActionSemantics: true,
    noRealExecution: true,
    eligibleSources: dryRunResult.eligibleSources,
    blockedSources: dryRunResult.blockedSources,
  };
}

/**
 * Transition a lifecycle to a new state.
 * Throws [P42] LifecycleBoundaryViolation on invalid transition or terminal state.
 * Returns a new lifecycle state (immutable, pure function).
 */
export function transitionLifecycle(
  current: PaperSimulationDryRunLifecycleState,
  to: P42LifecycleState,
  transitionedAt: string
): PaperSimulationDryRunLifecycleState {
  const from = current.state;

  if (P42_TERMINAL_STATES.includes(from)) {
    throw new Error(
      `[P42] LifecycleBoundaryViolation: cannot transition from terminal state ${from}`
    );
  }

  const isValid = P42_VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
  if (!isValid) {
    throw new Error(
      `[P42] LifecycleBoundaryViolation: invalid transition ${from} → ${to}`
    );
  }

  const transition: P42LifecycleTransition = { from, to, transitionedAt };

  return {
    ...current,
    state: to,
    transitions: [...current.transitions, transition] as readonly P42LifecycleTransition[],
    completedAt: to === "COMPLETE" ? transitionedAt : current.completedAt,
    cancelledAt: to === "CANCELLED" ? transitionedAt : current.cancelledAt,
    executedAt: null,
  };
}

/**
 * Cancel a lifecycle from PENDING or RUNNING.
 * Convenience wrapper around transitionLifecycle.
 * Returns a new lifecycle state (immutable, pure function).
 */
export function cancelLifecycle(
  current: PaperSimulationDryRunLifecycleState,
  cancelledAt: string
): PaperSimulationDryRunLifecycleState {
  return transitionLifecycle(current, "CANCELLED", cancelledAt);
}

/**
 * Returns true if the given [from, to] transition is valid.
 */
export function isValidTransition(
  from: P42LifecycleState,
  to: P42LifecycleState
): boolean {
  return P42_VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

/**
 * Returns true if the given state is terminal (COMPLETE or CANCELLED).
 */
export function isTerminalState(state: P42LifecycleState): boolean {
  return P42_TERMINAL_STATES.includes(state);
}
