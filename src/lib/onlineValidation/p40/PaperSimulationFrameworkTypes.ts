/**
 * P40 — Paper Simulation Framework Design Gate Types
 *
 * Defines the type system for the paper simulation framework boundary.
 * This module establishes what the framework IS and IS NOT authorized to do.
 *
 * GOVERNANCE:
 * - This is a design gate / skeleton contract. NOT simulation execution.
 * - entersAlphaScore = false. paperOnly = true. dryRunOnly = true.
 * - noExecution = true. Execution is BLOCKED_PENDING_AUTH.
 * - No investment advice, no prediction, no recommendation.
 * - No buy/sell/hold action semantics.
 * - No PnL, ROI, win-rate, returnPct, profit, or performance claims.
 * - No optimizer, no real backtest.
 * - No DB, Prisma, corpus, or scoring formula access.
 *
 * DISCLAIMER: This module does not constitute investment advice,
 * a recommendation, or a signal to buy, sell, or hold any security.
 * P40 defines a framework boundary only — it does not execute simulations.
 */

import type {
  PaperSimulationInputBundle,
  PaperSimulationContractMode,
} from "../p39/PaperSimulationInputContract";

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { PaperSimulationInputBundle, PaperSimulationContractMode };

// ─── Framework Mode ───────────────────────────────────────────────────────────

/** The only allowed framework modes in P40 */
export type PaperSimulationFrameworkMode =
  | "design-only"
  | "skeleton-only"
  | "no-execution";

export const PAPER_SIMULATION_FRAMEWORK_MODES: readonly PaperSimulationFrameworkMode[] =
  ["design-only", "skeleton-only", "no-execution"];

/** Default framework mode for P40 */
export const PAPER_SIMULATION_FRAMEWORK_DEFAULT_MODE: PaperSimulationFrameworkMode =
  "design-only";

// ─── Framework Status ─────────────────────────────────────────────────────────

/**
 * Lifecycle statuses for the paper simulation framework.
 *
 * Progression:
 *   INPUT_CONTRACT_READY         → P39 contract is available
 *   FRAMEWORK_READY              → P40 design gate complete (current max)
 *   EXECUTION_BLOCKED_PENDING_AUTH → execution not yet authorized
 *   EXECUTION_NOT_IMPLEMENTED    → execution logic not yet built
 *   EXECUTION_FORBIDDEN          → execution is permanently blocked at this gate
 */
export type PaperSimulationFrameworkStatus =
  | "INPUT_CONTRACT_READY"
  | "FRAMEWORK_READY"
  | "EXECUTION_BLOCKED_PENDING_AUTH"
  | "EXECUTION_NOT_IMPLEMENTED"
  | "EXECUTION_FORBIDDEN";

export const PAPER_SIMULATION_FRAMEWORK_STATUS_ORDER: readonly PaperSimulationFrameworkStatus[] =
  [
    "INPUT_CONTRACT_READY",
    "FRAMEWORK_READY",
    "EXECUTION_BLOCKED_PENDING_AUTH",
    "EXECUTION_NOT_IMPLEMENTED",
    "EXECUTION_FORBIDDEN",
  ];

// ─── Execution Status ─────────────────────────────────────────────────────────

/**
 * Execution authorization status.
 * P40 is authorized only up to EXECUTION_BLOCKED_PENDING_AUTH.
 * Progression to EXECUTION_DRY_RUN_AUTHORIZED requires P41 authorization.
 */
export type PaperSimulationExecutionStatus =
  | "EXECUTION_BLOCKED_PENDING_AUTH"
  | "EXECUTION_NOT_IMPLEMENTED"
  | "EXECUTION_FORBIDDEN"
  | "EXECUTION_DRY_RUN_AUTHORIZED"; // Reserved — requires explicit P41 authorization

/** The execution status for P40 — execution is blocked pending authorization */
export const P40_EXECUTION_STATUS: PaperSimulationExecutionStatus =
  "EXECUTION_BLOCKED_PENDING_AUTH";

// ─── Framework Plan ───────────────────────────────────────────────────────────

/**
 * The output of the P40 framework design gate.
 * This is a plan document — NOT an execution result.
 *
 * GOVERNANCE: All fields below enforce no-execution semantics.
 * No simulation result, no performance metric, no action output.
 */
export interface PaperSimulationFrameworkPlan {
  /** Framework phase */
  phase: "P40";

  /** ISO timestamp of plan generation */
  generatedAt: string;

  /** Framework schema version */
  version: string;

  /** Framework mode — must be "design-only", "skeleton-only", or "no-execution" */
  frameworkMode: PaperSimulationFrameworkMode;

  /** Framework lifecycle status */
  frameworkStatus: PaperSimulationFrameworkStatus;

  /** Execution authorization status */
  executionStatus: PaperSimulationExecutionStatus;

  /** GOVERNANCE: always true — no execution occurs */
  noExecution: true;

  /** GOVERNANCE: always true */
  paperOnly: true;

  /** GOVERNANCE: always true */
  dryRunOnly: true;

  /** GOVERNANCE: always false */
  entersAlphaScore: false;

  /** GOVERNANCE: always true */
  noInvestmentAdvice: true;

  /** GOVERNANCE: always true */
  noBuySellActionSemantics: true;

  /** GOVERNANCE: always true */
  notSimulationExecution: true;

  /** GOVERNANCE: always true */
  notOptimizer: true;

  /** GOVERNANCE: always true */
  notRealBacktest: true;

  /** The P39 input bundle this framework plan accepts */
  acceptedInputBundle: {
    mode: PaperSimulationContractMode;
    version: string;
    generatedAt: string;
  };

  /** Sources eligible as framework inputs (from P39) */
  eligibleSources: string[];

  /** Sources blocked from framework consumption (from P39) */
  blockedSources: string[];

  /** What the next authorized step is */
  allowedNextStep: string;

  /** What authorization is required before execution can begin */
  requiredAuthorizationForExecution: string;

  /** Outputs that are permanently forbidden from this framework */
  forbiddenOutputs: readonly string[];

  /** Governance flags summary */
  governanceFlags: {
    paperOnly: true;
    dryRunOnly: true;
    entersAlphaScore: false;
    noExecution: true;
    noInvestmentAdvice: true;
    noBuySellActionSemantics: true;
    notSimulationExecution: true;
    notOptimizer: true;
    notRealBacktest: true;
  };

  /** Human-readable validation summary */
  validationSummary: string;

  /** Full disclaimer */
  disclaimer: string;
}

// ─── Framework Boundary Validation Result ─────────────────────────────────────

/** Result of validating a PaperSimulationFrameworkPlan */
export interface PaperSimulationFrameworkValidationResult {
  /** Whether the plan passed all boundary validation rules */
  valid: boolean;

  /** Validation errors (empty if valid) */
  errors: string[];

  /** Validation warnings (informational) */
  warnings: string[];

  /** GOVERNANCE: always false */
  entersAlphaScore: false;

  /** GOVERNANCE: always true */
  noExecution: true;

  /** GOVERNANCE: always true */
  paperOnly: true;
}

// ─── Forbidden Outputs ────────────────────────────────────────────────────────

/**
 * Outputs that must NEVER appear in any P40 framework plan or result.
 * Presence of any of these is a boundary violation.
 */
export const PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS: readonly string[] = [
  "prediction",
  "recommendation",
  "signal",
  "buy",
  "sell",
  "hold",
  "pnl",
  "profit",
  "returnPct",
  "winRate",
  "ROI",
  "outcomePrice",
  "targetPrice",
  "optimizerScore",
  "backtestResult",
  "edgeScore",
  "expectedReturn",
  "alphaScore",
];

/**
 * Uses that are always forbidden in the P40 framework.
 */
export const PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_USES: readonly string[] = [
  "simulation execution",
  "optimizer execution",
  "real backtest execution",
  "production scoring",
  "alphaScore mutation",
  "buy/sell/hold action semantics",
  "investment recommendation",
  "performance claims (profit, ROI, win-rate, edge, expected return)",
  "scoring formula modification",
  "DB write",
  "corpus mutation",
];

// ─── Version & Disclaimer ─────────────────────────────────────────────────────

export const PAPER_SIMULATION_FRAMEWORK_VERSION =
  "p40-paper-simulation-framework-design-gate-v1";

export const PAPER_SIMULATION_FRAMEWORK_DISCLAIMER =
  "DISCLAIMER: This paper simulation framework design gate does not constitute investment advice, " +
  "a recommendation, or a signal to buy, sell, or hold any security. " +
  "entersAlphaScore = false. paperOnly = true. dryRunOnly = true. noExecution = true. " +
  "No profit, return, win-rate, edge, PnL, or investment performance claims are made. " +
  "This framework defines design boundaries only — it does not execute simulations, " +
  "optimizers, or real backtests. " +
  "Execution requires explicit P41 authorization: " +
  "'YES design paper simulation execution dry-run for P41'.";
