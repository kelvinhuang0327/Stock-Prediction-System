/**
 * P39 — Paper Simulation Input Contract Types
 *
 * Defines the type system for paper-only simulation input contracts.
 * This module establishes the contract that eligible sources
 * (MonthlyRevenue, Quote, Regime) must satisfy to be consumed by
 * any future simulation runner.
 *
 * DISCLAIMER: This module does not constitute investment advice,
 * a recommendation, or a signal to buy, sell, or hold any security.
 * entersAlphaScore = false. paperOnly = true. dryRunOnly = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 * This is a structural contract definition — not simulation execution.
 */

import type { SourceName, SimulationInputStatus } from "../p38/SimulationInputReadinessTypes";

// ─── Re-exports for consumers ─────────────────────────────────────────────────

export type { SourceName, SimulationInputStatus };

// ─── Contract Mode ────────────────────────────────────────────────────────────

/** The only allowed mode for P39 contracts */
export const PAPER_SIMULATION_CONTRACT_MODE = "paper-simulation-input-contract" as const;
export type PaperSimulationContractMode = typeof PAPER_SIMULATION_CONTRACT_MODE;

// ─── Eligible Source Input ────────────────────────────────────────────────────

/**
 * An eligible source's contract entry.
 * Only sources with SimulationInputStatus = SIMULATION_INPUT_ELIGIBLE
 * may appear in the eligibleSources list of a PaperSimulationInputBundle.
 *
 * GOVERNANCE: All fields below are structurally frozen.
 * No scoring, recommendation, prediction, or action semantics allowed.
 */
export interface PaperSimulationEligibleSourceInput {
  /** Source identifier — must be an eligible source */
  sourceName: SourceName;

  /** Must always be SIMULATION_INPUT_ELIGIBLE */
  readinessStatus: "SIMULATION_INPUT_ELIGIBLE";

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

  /** ISO date the contract was generated */
  asOfDate: string;

  /** Optional provenance trace for audit */
  sourceTrace?: string;

  /** Human-readable summary of what this source provides */
  payloadSummary: string;
}

// ─── Blocked Source Record ────────────────────────────────────────────────────

/**
 * A blocked source's contract record.
 * Blocked sources are listed explicitly so consumers know which
 * sources are NOT available and why.
 *
 * Blocked sources must NEVER appear in eligibleSources.
 */
export interface PaperSimulationBlockedSource {
  /** Source identifier */
  sourceName: SourceName;

  /** The blocking classification from P38 */
  blockedStatus:
    | "BLOCKED_QUALITY_EVIDENCE"
    | "BLOCKED_PIT_METADATA"
    | "BLOCKED_AUTHORIZATION"
    | "BLOCKED_LAG_EVIDENCE";

  /** Human-readable reasons explaining the block */
  blockingReasons: string[];

  /** Evidence required before this source can be unblocked */
  requiredNextEvidence: string[];

  /** Uses that are always forbidden for this source */
  forbiddenUse: string[];
}

// ─── Contract Bundle ──────────────────────────────────────────────────────────

/**
 * The top-level paper simulation input contract bundle.
 *
 * This is the artifact that future simulation runners must validate
 * before consuming any source data. A valid bundle has:
 * - mode = "paper-simulation-input-contract"
 * - paperOnly = true
 * - dryRunOnly = true
 * - entersAlphaScore = false
 * - noInvestmentAdvice = true
 * - noBuySellActionSemantics = true
 * - only SIMULATION_INPUT_ELIGIBLE sources in eligibleSources
 * - explicit blockedSources list
 *
 * GOVERNANCE: This bundle defines input contracts — not simulation outputs.
 * No prediction, recommendation, scoring, or action semantics are permitted.
 */
export interface PaperSimulationInputBundle {
  /** Must always be "paper-simulation-input-contract" */
  mode: PaperSimulationContractMode;

  /** ISO timestamp of contract generation */
  generatedAt: string;

  /** Contract schema version */
  version: string;

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

  /** Sources eligible for paper simulation input consumption */
  eligibleSources: PaperSimulationEligibleSourceInput[];

  /** Sources explicitly blocked — must not be used as simulation inputs */
  blockedSources: PaperSimulationBlockedSource[];

  /** Full disclaimer */
  disclaimer: string;
}

// ─── Validation Result ────────────────────────────────────────────────────────

/** Result of validating a PaperSimulationInputBundle */
export interface PaperSimulationInputValidationResult {
  /** Whether the bundle passed all validation rules */
  valid: boolean;

  /** List of validation errors (empty if valid) */
  errors: string[];

  /** List of validation warnings (informational) */
  warnings: string[];

  /** GOVERNANCE: always false — validation never activates scoring */
  entersAlphaScore: false;

  /** GOVERNANCE: always true */
  paperOnly: true;
}

// ─── Forbidden Fields ─────────────────────────────────────────────────────────

/**
 * Fields that must never appear in any P39 contract, bundle, or input struct.
 * Presence of any of these fields is a contract violation.
 */
export const PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS: readonly string[] = [
  "alphaScore",
  "recommendation",
  "prediction",
  "signal",
  "buy",
  "sell",
  "hold",
  "targetPrice",
  "outcomePrice",
  "returnPct",
  "winRate",
  "profit",
  "expectedReturn",
  "optimizerScore",
  "backtestResult",
  "edgeScore",
];

/**
 * Uses that are always forbidden regardless of source classification.
 */
export const PAPER_SIMULATION_CONTRACT_FORBIDDEN_USES: readonly string[] = [
  "production scoring",
  "alphaScore mutation",
  "optimizer execution",
  "real backtest execution",
  "buy/sell/hold action semantics",
  "investment recommendation",
  "performance claims (profit, ROI, win-rate, edge, expected return)",
  "scoring formula modification",
  "simulation execution",
];

// ─── Canonical Eligible / Blocked Source Lists ────────────────────────────────

/** Sources that are eligible for paper simulation input per P38 */
export const P39_ELIGIBLE_SOURCES: readonly SourceName[] = [
  "MonthlyRevenue",
  "Quote",
  "Regime",
];

/** Sources that are blocked from paper simulation input per P38 */
export const P39_BLOCKED_SOURCES: readonly SourceName[] = [
  "NewsEvent",
  "FinancialReport",
  "Chip",
];

// ─── Version & Disclaimer ─────────────────────────────────────────────────────

export const PAPER_SIMULATION_CONTRACT_VERSION =
  "p39-paper-simulation-input-contract-v1";

export const PAPER_SIMULATION_CONTRACT_DISCLAIMER =
  "DISCLAIMER: This paper simulation input contract does not constitute investment advice, " +
  "a recommendation, or a signal to buy, sell, or hold any security. " +
  "entersAlphaScore = false. paperOnly = true. dryRunOnly = true. " +
  "No profit, return, win-rate, edge, or investment performance claims are made. " +
  "This contract defines structural input requirements for paper-only simulation — " +
  "it does not execute simulations, optimizers, or real backtests. " +
  "P39 does not activate any scoring formula or production model.";
