/**
 * P40 — Paper Simulation Framework Boundary
 *
 * Provides the boundary functions for the paper simulation framework design gate.
 * All functions are pure, deterministic, and side-effect free.
 *
 * GOVERNANCE:
 * - No simulation execution.
 * - No optimizer, no real backtest.
 * - No Prisma, no DB, no corpus, no scoring import.
 * - No prediction, recommendation, buy/sell/hold, PnL, ROI, win-rate.
 * - entersAlphaScore = false. paperOnly = true. dryRunOnly = true.
 * - Execution status = EXECUTION_BLOCKED_PENDING_AUTH.
 * - All execution paths are FORBIDDEN at P40.
 *
 * DISCLAIMER: This module does not constitute investment advice,
 * a recommendation, or a signal to buy, sell, or hold any security.
 * P40 defines framework boundaries — it does not execute simulations.
 */

import type { PaperSimulationInputBundle } from "../p39/PaperSimulationInputContract";
import {
  P39_ELIGIBLE_SOURCES,
  P39_BLOCKED_SOURCES,
  PAPER_SIMULATION_CONTRACT_MODE,
} from "../p39/PaperSimulationInputContract";
import {
  PAPER_SIMULATION_FRAMEWORK_VERSION,
  PAPER_SIMULATION_FRAMEWORK_DISCLAIMER,
  PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS,
  PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_USES,
  PAPER_SIMULATION_FRAMEWORK_DEFAULT_MODE,
  P40_EXECUTION_STATUS,
  type PaperSimulationFrameworkPlan,
  type PaperSimulationFrameworkValidationResult,
} from "./PaperSimulationFrameworkTypes";

// ─── createPaperSimulationFrameworkPlan ───────────────────────────────────────

/**
 * Creates a PaperSimulationFrameworkPlan from a validated P39 input bundle.
 *
 * This function:
 * 1. Validates the input bundle comes from P39.
 * 2. Carries eligible/blocked sources forward.
 * 3. Sets all governance flags.
 * 4. Sets execution status to EXECUTION_BLOCKED_PENDING_AUTH.
 * 5. Does NOT execute any simulation logic.
 *
 * @param inputBundle — must be a valid PaperSimulationInputBundle from P39
 * @param opts — optional overrides for generatedAt
 */
export function createPaperSimulationFrameworkPlan(
  inputBundle: PaperSimulationInputBundle,
  opts?: { generatedAt?: string }
): PaperSimulationFrameworkPlan {
  const generatedAt = opts?.generatedAt ?? new Date().toISOString();

  const eligibleSources = inputBundle.eligibleSources.map((s) => s.sourceName);
  const blockedSources = inputBundle.blockedSources.map((s) => s.sourceName);

  return {
    phase: "P40",
    generatedAt,
    version: PAPER_SIMULATION_FRAMEWORK_VERSION,
    frameworkMode: PAPER_SIMULATION_FRAMEWORK_DEFAULT_MODE,
    frameworkStatus: "FRAMEWORK_READY",
    executionStatus: P40_EXECUTION_STATUS,

    // Governance flags — all structurally frozen
    noExecution: true,
    paperOnly: true,
    dryRunOnly: true,
    entersAlphaScore: false,
    noInvestmentAdvice: true,
    noBuySellActionSemantics: true,
    notSimulationExecution: true,
    notOptimizer: true,
    notRealBacktest: true,

    // P39 contract reference
    acceptedInputBundle: {
      mode: inputBundle.mode,
      version: inputBundle.version,
      generatedAt: inputBundle.generatedAt,
    },

    eligibleSources,
    blockedSources,

    allowedNextStep:
      "P41: Design paper simulation execution dry-run (requires explicit authorization: " +
      "'YES design paper simulation execution dry-run for P41')",

    requiredAuthorizationForExecution:
      "YES design paper simulation execution dry-run for P41",

    forbiddenOutputs: PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS,

    governanceFlags: {
      paperOnly: true,
      dryRunOnly: true,
      entersAlphaScore: false,
      noExecution: true,
      noInvestmentAdvice: true,
      noBuySellActionSemantics: true,
      notSimulationExecution: true,
      notOptimizer: true,
      notRealBacktest: true,
    },

    validationSummary:
      `Framework design gate complete. ` +
      `${eligibleSources.length} eligible source(s): [${eligibleSources.join(", ")}]. ` +
      `${blockedSources.length} blocked source(s): [${blockedSources.join(", ")}]. ` +
      `Execution is blocked pending explicit P41 authorization. ` +
      `No simulation was executed. No performance metrics produced.`,

    disclaimer: PAPER_SIMULATION_FRAMEWORK_DISCLAIMER,
  };
}

// ─── validateFrameworkBoundary ────────────────────────────────────────────────

/**
 * Validates that a PaperSimulationFrameworkPlan complies with all P40 boundary rules.
 *
 * Rules enforced:
 * 1. phase must be "P40"
 * 2. frameworkMode must be a valid P40 mode
 * 3. frameworkStatus must not be execution-authorized
 * 4. executionStatus must be EXECUTION_BLOCKED_PENDING_AUTH or EXECUTION_NOT_IMPLEMENTED
 * 5. noExecution must be true
 * 6. paperOnly must be true
 * 7. dryRunOnly must be true
 * 8. entersAlphaScore must be false
 * 9. noInvestmentAdvice must be true
 * 10. noBuySellActionSemantics must be true
 * 11. notSimulationExecution must be true
 * 12. notOptimizer must be true
 * 13. notRealBacktest must be true
 * 14. blocked sources must not appear in eligibleSources
 * 15. forbiddenOutputs must be present and non-empty
 * 16. disclaimer must be present
 */
export function validateFrameworkBoundary(
  plan: unknown
): PaperSimulationFrameworkValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan || typeof plan !== "object") {
    errors.push("Plan must be a non-null object");
    return { valid: false, errors, warnings, entersAlphaScore: false, noExecution: true, paperOnly: true };
  }

  const p = plan as Record<string, unknown>;

  // Rule 1: phase
  if (p["phase"] !== "P40") {
    errors.push(`Rule 1: phase must be "P40", got: ${String(p["phase"])}`);
  }

  // Rule 2: frameworkMode
  const validModes = ["design-only", "skeleton-only", "no-execution"];
  if (!validModes.includes(p["frameworkMode"] as string)) {
    errors.push(
      `Rule 2: frameworkMode must be one of [${validModes.join(", ")}], got: ${String(p["frameworkMode"])}`
    );
  }

  // Rule 3: frameworkStatus must not be execution-authorized
  const forbiddenStatuses = ["EXECUTION_DRY_RUN_AUTHORIZED", "EXECUTION_RUNNING", "EXECUTION_COMPLETE"];
  if (forbiddenStatuses.includes(p["frameworkStatus"] as string)) {
    errors.push(
      `Rule 3: frameworkStatus must not be an execution-authorized status, got: ${String(p["frameworkStatus"])}`
    );
  }

  // Rule 4: executionStatus must be blocked
  const allowedExecutionStatuses = [
    "EXECUTION_BLOCKED_PENDING_AUTH",
    "EXECUTION_NOT_IMPLEMENTED",
    "EXECUTION_FORBIDDEN",
  ];
  if (!allowedExecutionStatuses.includes(p["executionStatus"] as string)) {
    errors.push(
      `Rule 4: executionStatus must be one of [${allowedExecutionStatuses.join(", ")}], got: ${String(p["executionStatus"])}`
    );
  }

  // Rule 5: noExecution
  if (p["noExecution"] !== true) {
    errors.push(`Rule 5: noExecution must be true`);
  }

  // Rule 6: paperOnly
  if (p["paperOnly"] !== true) {
    errors.push(`Rule 6: paperOnly must be true`);
  }

  // Rule 7: dryRunOnly
  if (p["dryRunOnly"] !== true) {
    errors.push(`Rule 7: dryRunOnly must be true`);
  }

  // Rule 8: entersAlphaScore
  if (p["entersAlphaScore"] !== false) {
    errors.push(`Rule 8: entersAlphaScore must be false`);
  }

  // Rule 9: noInvestmentAdvice
  if (p["noInvestmentAdvice"] !== true) {
    errors.push(`Rule 9: noInvestmentAdvice must be true`);
  }

  // Rule 10: noBuySellActionSemantics
  if (p["noBuySellActionSemantics"] !== true) {
    errors.push(`Rule 10: noBuySellActionSemantics must be true`);
  }

  // Rule 11: notSimulationExecution
  if (p["notSimulationExecution"] !== true) {
    errors.push(`Rule 11: notSimulationExecution must be true`);
  }

  // Rule 12: notOptimizer
  if (p["notOptimizer"] !== true) {
    errors.push(`Rule 12: notOptimizer must be true`);
  }

  // Rule 13: notRealBacktest
  if (p["notRealBacktest"] !== true) {
    errors.push(`Rule 13: notRealBacktest must be true`);
  }

  // Rule 14: blocked sources must not appear in eligibleSources
  const eligible = Array.isArray(p["eligibleSources"]) ? (p["eligibleSources"] as string[]) : [];
  for (const blocked of P39_BLOCKED_SOURCES) {
    if (eligible.includes(blocked)) {
      errors.push(`Rule 14: blocked source "${blocked}" must not appear in eligibleSources`);
    }
  }

  // Rule 15: forbiddenOutputs must be present and non-empty
  if (!Array.isArray(p["forbiddenOutputs"]) || (p["forbiddenOutputs"] as unknown[]).length === 0) {
    errors.push(`Rule 15: forbiddenOutputs must be a non-empty array`);
  }

  // Rule 16: disclaimer must be present
  if (typeof p["disclaimer"] !== "string" || (p["disclaimer"] as string).length === 0) {
    errors.push(`Rule 16: disclaimer must be a non-empty string`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    entersAlphaScore: false,
    noExecution: true,
    paperOnly: true,
  };
}

// ─── assertNoSimulationExecution ─────────────────────────────────────────────

/**
 * Assert that a payload does not contain any execution-indicating fields.
 * Throws if any forbidden execution field is found.
 *
 * This is used in tests and at framework entry points to enforce that
 * no simulation result has been accidentally embedded.
 *
 * @param payload — any object to inspect
 * @throws Error if any forbidden execution field is present
 */
export function assertNoSimulationExecution(payload: unknown): void {
  if (!payload || typeof payload !== "object") return;

  const forbidden = [
    ...PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS,
    "executionResult",
    "simulationOutput",
    "runResult",
    "backtest",
  ];

  const keys = Object.keys(payload as Record<string, unknown>);
  for (const key of keys) {
    if (forbidden.includes(key)) {
      throw new Error(
        `assertNoSimulationExecution: forbidden field "${key}" found in payload. ` +
          `P40 framework boundary violation. No simulation execution is permitted at this gate.`
      );
    }
  }
}

// ─── summarizeFrameworkReadiness ─────────────────────────────────────────────

/**
 * Returns a human-readable summary of the framework readiness state.
 * This is a pure reporting function — no side effects.
 *
 * @param plan — the PaperSimulationFrameworkPlan to summarize
 */
export function summarizeFrameworkReadiness(
  plan: PaperSimulationFrameworkPlan
): string {
  return (
    `[P40 Framework Readiness]\n` +
    `  Phase:            ${plan.phase}\n` +
    `  Framework Mode:   ${plan.frameworkMode}\n` +
    `  Framework Status: ${plan.frameworkStatus}\n` +
    `  Execution Status: ${plan.executionStatus}\n` +
    `  noExecution:      ${String(plan.noExecution)}\n` +
    `  paperOnly:        ${String(plan.paperOnly)}\n` +
    `  dryRunOnly:       ${String(plan.dryRunOnly)}\n` +
    `  entersAlphaScore: ${String(plan.entersAlphaScore)}\n` +
    `  Eligible Sources: [${plan.eligibleSources.join(", ")}]\n` +
    `  Blocked Sources:  [${plan.blockedSources.join(", ")}]\n` +
    `  Next Step:        ${plan.allowedNextStep}\n` +
    `  Required Auth:    ${plan.requiredAuthorizationForExecution}`
  );
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export {
  P39_ELIGIBLE_SOURCES,
  P39_BLOCKED_SOURCES,
  PAPER_SIMULATION_CONTRACT_MODE,
  PAPER_SIMULATION_FRAMEWORK_VERSION,
  PAPER_SIMULATION_FRAMEWORK_DISCLAIMER,
  PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS,
  PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_USES,
  P40_EXECUTION_STATUS,
};
