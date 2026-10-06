/**
 * P41 — Paper Simulation Execution Dry-Run Runner
 *
 * Provides the dry-run stub runner and validation functions for P41.
 * All functions are pure, deterministic, and side-effect free.
 *
 * Authorization received:
 *   YES design paper simulation execution dry-run for P41
 *
 * GOVERNANCE:
 * - No real simulation execution. Stub-only.
 * - No optimizer, no real backtest.
 * - No Prisma, no DB, no corpus, no scoring import.
 * - No prediction, recommendation, buy/sell/hold, PnL, ROI, win-rate.
 * - entersAlphaScore = false. paperOnly = true. dryRunOnly = true.
 * - executedAt = null — no real execution timestamp.
 * - stubResult = DRY_RUN_STUB_ONLY.
 *
 * DISCLAIMER: This module does not constitute investment advice,
 * a recommendation, or a signal to buy, sell, or hold any security.
 * P41 provides a dry-run stub runner — it does not execute real simulations.
 */

import type {
  PaperSimulationDryRunInput,
  PaperSimulationDryRunResult,
  PaperSimulationDryRunValidationResult,
} from "./PaperSimulationDryRunContract";
import {
  P41_EXECUTION_STATUS,
  PAPER_SIMULATION_DRY_RUN_VERSION,
  PAPER_SIMULATION_DRY_RUN_DISCLAIMER,
  PAPER_SIMULATION_DRY_RUN_FORBIDDEN_FIELDS,
  PAPER_SIMULATION_DRY_RUN_DEFAULT_MODE,
  DRY_RUN_STUB_RESULT,
} from "./PaperSimulationDryRunContract";

// ─── runPaperSimulationDryRun ─────────────────────────────────────────────────

/**
 * Runs the paper simulation dry-run stub.
 *
 * This function:
 * 1. Validates the P40 framework plan has correct governance flags.
 * 2. Returns a stub result — no real simulation is executed.
 * 3. executedAt is always null (no real execution).
 * 4. stubResult is always DRY_RUN_STUB_ONLY.
 *
 * @throws Error if plan.noExecution !== true
 * @throws Error if plan.dryRunOnly !== true
 * @throws Error if plan.frameworkStatus !== "FRAMEWORK_READY"
 */
export function runPaperSimulationDryRun(
  input: PaperSimulationDryRunInput
): PaperSimulationDryRunResult {
  const { plan, requestedAt } = input;

  // Guard: plan must have noExecution = true
  if (plan.noExecution !== true) {
    throw new Error(
      "[P41] DryRunBoundaryViolation: plan.noExecution must be true. " +
        "Dry-run requires noExecution=true from P40 framework plan."
    );
  }

  // Guard: plan must have dryRunOnly = true
  if (plan.dryRunOnly !== true) {
    throw new Error(
      "[P41] DryRunBoundaryViolation: plan.dryRunOnly must be true. " +
        "Dry-run requires dryRunOnly=true from P40 framework plan."
    );
  }

  // Guard: plan must have frameworkStatus = FRAMEWORK_READY
  if (plan.frameworkStatus !== "FRAMEWORK_READY") {
    throw new Error(
      `[P41] DryRunBoundaryViolation: plan.frameworkStatus must be "FRAMEWORK_READY". ` +
        `Got: "${plan.frameworkStatus}".`
    );
  }

  const mode = input.mode ?? PAPER_SIMULATION_DRY_RUN_DEFAULT_MODE;

  // Deterministic stub run ID — not a real execution ID
  const runId = `p41-dry-run-stub-${plan.phase}-${requestedAt}`;

  return {
    runId,
    phase: "P41",
    mode,

    // Governance flags — all structurally frozen
    dryRunOnly: true,
    paperOnly: true,
    noActualMetrics: true,
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
    entersAlphaScore: false,

    // No real execution
    executedAt: null,
    requestedAt,

    version: PAPER_SIMULATION_DRY_RUN_VERSION,
    executionStatus: P41_EXECUTION_STATUS,
    stubResult: DRY_RUN_STUB_RESULT,

    // Carry eligible/blocked sources from P40 plan
    eligibleSources: plan.eligibleSources,
    blockedSources: plan.blockedSources,
    frameworkPlanVersion: plan.version,

    disclaimer: PAPER_SIMULATION_DRY_RUN_DISCLAIMER,
  };
}

// ─── validateDryRunInput ──────────────────────────────────────────────────────

/**
 * Validates a PaperSimulationDryRunInput before running the dry-run stub.
 * Returns a structured validation result — does NOT throw.
 */
export function validateDryRunInput(
  input: PaperSimulationDryRunInput
): PaperSimulationDryRunValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const base = { noExecution: true as const, paperOnly: true as const, entersAlphaScore: false as const };

  if (!input) {
    return { valid: false, errors: ["input is required"], warnings, ...base };
  }

  if (!input.plan) {
    errors.push("input.plan is required");
  } else {
    if (input.plan.noExecution !== true) {
      errors.push("input.plan.noExecution must be true");
    }
    if (input.plan.dryRunOnly !== true) {
      errors.push("input.plan.dryRunOnly must be true");
    }
    if (input.plan.paperOnly !== true) {
      errors.push("input.plan.paperOnly must be true");
    }
    if (input.plan.entersAlphaScore !== false) {
      errors.push("input.plan.entersAlphaScore must be false");
    }
    if (input.plan.frameworkStatus !== "FRAMEWORK_READY") {
      errors.push(
        `input.plan.frameworkStatus must be "FRAMEWORK_READY", got "${input.plan.frameworkStatus}"`
      );
    }
    if (input.plan.phase !== "P40") {
      errors.push(`input.plan.phase must be "P40", got "${input.plan.phase}"`);
    }
    if (!input.plan.eligibleSources || input.plan.eligibleSources.length === 0) {
      errors.push("input.plan.eligibleSources must be non-empty");
    }
  }

  if (!input.mode) {
    errors.push("input.mode is required");
  } else if (!["stub-only", "design-only"].includes(input.mode)) {
    errors.push(
      `input.mode must be "stub-only" or "design-only", got "${input.mode}"`
    );
  }

  if (!input.requestedAt) {
    errors.push("input.requestedAt is required");
  }

  return { valid: errors.length === 0, errors, warnings, ...base };
}

// ─── assertNoDryRunExecution ──────────────────────────────────────────────────

/**
 * Asserts that a dry-run result contains no forbidden execution fields.
 * Throws if any forbidden field is found with a non-undefined value.
 *
 * @throws Error if result contains any forbidden execution field
 */
export function assertNoDryRunExecution(result: Record<string, unknown>): void {
  for (const field of PAPER_SIMULATION_DRY_RUN_FORBIDDEN_FIELDS) {
    if (field in result && result[field] !== undefined) {
      throw new Error(
        `[P41] DryRunBoundaryViolation: forbidden execution field "${field}" found in dry-run result. ` +
          `This field must never appear in a dry-run result. ` +
          `Dry-run is stub-only: no real simulation, no metrics, no performance data.`
      );
    }
  }
}
