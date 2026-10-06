/**
 * P41 — Paper Simulation Execution Dry-Run Design Contract
 *
 * Defines the type system for the paper simulation dry-run boundary.
 * This module establishes the dry-run stub interface — NOT real simulation.
 *
 * Authorization received:
 *   YES design paper simulation execution dry-run for P41
 *
 * GOVERNANCE:
 * - This is a dry-run stub design. NOT real simulation execution.
 * - noActualMetrics = true. paperOnly = true. dryRunOnly = true.
 * - entersAlphaScore = false. noExecution = true (real simulation still forbidden).
 * - executedAt = null — no real execution timestamp.
 * - stubResult = "DRY_RUN_STUB_ONLY".
 * - No PnL, ROI, win-rate, profit, return, edge, expected return.
 * - No optimizer, no real backtest, no production scoring.
 * - No DB, Prisma, corpus, or scoring formula access.
 * - No investment advice, prediction, recommendation.
 * - No buy/sell/hold action semantics.
 *
 * DISCLAIMER: This module does not constitute investment advice,
 * a recommendation, or a signal to buy, sell, or hold any security.
 * P41 defines a dry-run stub interface only — it does not execute real simulations.
 */

import type { PaperSimulationFrameworkPlan } from "../p40/PaperSimulationFrameworkTypes";
import { PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS } from "../p40/PaperSimulationFrameworkTypes";

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { PaperSimulationFrameworkPlan };
export { PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS };

// ─── P41 Execution Status ─────────────────────────────────────────────────────

/**
 * The execution status granted by P41 authorization.
 * Upgrades from P40's EXECUTION_BLOCKED_PENDING_AUTH.
 */
export const P41_EXECUTION_STATUS = "EXECUTION_DRY_RUN_AUTHORIZED" as const;
export type P41ExecutionStatus = typeof P41_EXECUTION_STATUS;

// ─── Dry-Run Mode ─────────────────────────────────────────────────────────────

/** Allowed dry-run modes for P41 */
export type PaperSimulationDryRunMode = "stub-only" | "design-only";

export const PAPER_SIMULATION_DRY_RUN_MODES: readonly PaperSimulationDryRunMode[] =
  ["stub-only", "design-only"];

/** Default dry-run mode — stub-only (no real execution) */
export const PAPER_SIMULATION_DRY_RUN_DEFAULT_MODE: PaperSimulationDryRunMode =
  "stub-only";

// ─── Stub Result Constant ─────────────────────────────────────────────────────

/** Constant returned in stubResult — confirms no real execution occurred */
export const DRY_RUN_STUB_RESULT = "DRY_RUN_STUB_ONLY" as const;
export type DryRunStubResult = typeof DRY_RUN_STUB_RESULT;

// ─── Version & Disclaimer ─────────────────────────────────────────────────────

export const PAPER_SIMULATION_DRY_RUN_VERSION =
  "p41-paper-simulation-dry-run-design-v1";

export const PAPER_SIMULATION_DRY_RUN_DISCLAIMER =
  "DISCLAIMER: This paper simulation dry-run design does not constitute investment advice, " +
  "a recommendation, or a signal to buy, sell, or hold any security. " +
  "entersAlphaScore = false. paperOnly = true. dryRunOnly = true. noActualMetrics = true. " +
  "No profit, return, win-rate, edge, PnL, ROI, or investment performance claims are made. " +
  "This dry-run runner is a stub only — no real simulation is executed. " +
  "executedAt = null (no real execution timestamp). stubResult = DRY_RUN_STUB_ONLY.";

// ─── Forbidden Dry-Run Execution Fields ───────────────────────────────────────

/**
 * Fields that must NEVER appear in a dry-run result.
 * Presence of any of these is a boundary violation.
 */
export const PAPER_SIMULATION_DRY_RUN_FORBIDDEN_FIELDS: readonly string[] = [
  "pnl",
  "roi",
  "ROI",
  "winRate",
  "returnPct",
  "profit",
  "alphaScore",
  "recommendation",
  "prediction",
  "buy",
  "sell",
  "hold",
  "signal",
  "optimizerScore",
  "backtestResult",
  "expectedReturn",
  "edgeScore",
  "outcomePrice",
  "targetPrice",
  "executionResult",
  "simulationResult",
];

// ─── Dry-Run Input ────────────────────────────────────────────────────────────

/**
 * Input for the dry-run stub runner.
 * Requires a valid P40 framework plan.
 *
 * GOVERNANCE: plan.noExecution must be true.
 * GOVERNANCE: plan.dryRunOnly must be true.
 * GOVERNANCE: plan.frameworkStatus must be "FRAMEWORK_READY".
 */
export interface PaperSimulationDryRunInput {
  /** The P40 framework plan — must have noExecution=true, dryRunOnly=true */
  plan: PaperSimulationFrameworkPlan;

  /** Dry-run mode — must be "stub-only" or "design-only" */
  mode: PaperSimulationDryRunMode;

  /** ISO timestamp of when the dry-run was requested */
  requestedAt: string;
}

// ─── Dry-Run Result ───────────────────────────────────────────────────────────

/**
 * Result of the dry-run stub runner.
 * Contains NO real simulation metrics — stub result only.
 *
 * GOVERNANCE: All fields below enforce no-execution semantics.
 * No simulation result, no performance metric, no action output.
 */
export interface PaperSimulationDryRunResult {
  /** Unique run identifier (stub — not a real execution ID) */
  runId: string;

  /** Always "P41" */
  phase: "P41";

  /** Dry-run mode */
  mode: PaperSimulationDryRunMode;

  /** GOVERNANCE: always true — dry-run only, no real execution */
  dryRunOnly: true;

  /** GOVERNANCE: always true */
  paperOnly: true;

  /** GOVERNANCE: always true — no real PnL, ROI, win-rate, etc. */
  noActualMetrics: true;

  /** GOVERNANCE: always true */
  noAlphaScore: true;

  /** GOVERNANCE: always true */
  noRecommendation: true;

  /** GOVERNANCE: always true */
  noPnL: true;

  /** GOVERNANCE: always true */
  noROI: true;

  /** GOVERNANCE: always true */
  noWinRate: true;

  /** GOVERNANCE: always true */
  noReturnPct: true;

  /** GOVERNANCE: always true */
  noOptimizer: true;

  /** GOVERNANCE: always true */
  noRealBacktest: true;

  /** GOVERNANCE: always true */
  noInvestmentAdvice: true;

  /** GOVERNANCE: always true */
  noBuySellActionSemantics: true;

  /** GOVERNANCE: always false */
  entersAlphaScore: false;

  /** No real execution — always null */
  executedAt: null;

  /** When the dry-run was requested */
  requestedAt: string;

  /** Dry-run schema version */
  version: string;

  /** Execution status — authorized for dry-run design */
  executionStatus: P41ExecutionStatus;

  /** Always DRY_RUN_STUB_ONLY — no real simulation was executed */
  stubResult: DryRunStubResult;

  /** Eligible sources inherited from P40 plan */
  eligibleSources: string[];

  /** Blocked sources inherited from P40 plan */
  blockedSources: string[];

  /** The version of the P40 framework plan used as input */
  frameworkPlanVersion: string;

  /** Full disclaimer */
  disclaimer: string;
}

// ─── Dry-Run Validation Result ────────────────────────────────────────────────

/** Result of validating a PaperSimulationDryRunInput */
export interface PaperSimulationDryRunValidationResult {
  /** Whether the input passed all boundary validation rules */
  valid: boolean;

  /** Validation errors (empty if valid) */
  errors: string[];

  /** Validation warnings (informational) */
  warnings: string[];

  /** GOVERNANCE: always true */
  noExecution: true;

  /** GOVERNANCE: always true */
  paperOnly: true;

  /** GOVERNANCE: always false */
  entersAlphaScore: false;
}
