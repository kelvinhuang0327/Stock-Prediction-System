/**
 * P38 — Simulation Input Readiness Types
 *
 * Defines the type system for mapping controlled sources to simulation input
 * readiness classifications. These types enforce governance boundaries at the
 * TypeScript level: no scoring, no investment advice, no optimizer semantics.
 *
 * DISCLAIMER: This module does not constitute investment advice.
 * entersAlphaScore = false. paperOnly = true. dryRunOnly = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 * For structural readiness audit purposes only.
 */

// ─── Source Names ─────────────────────────────────────────────────────────────

export type SourceName =
  | "MonthlyRevenue"
  | "NewsEvent"
  | "FinancialReport"
  | "Chip"
  | "Quote"
  | "Regime";

export const ALL_SOURCE_NAMES: SourceName[] = [
  "MonthlyRevenue",
  "NewsEvent",
  "FinancialReport",
  "Chip",
  "Quote",
  "Regime",
];

// ─── Readiness Classifications ────────────────────────────────────────────────

/**
 * Simulation input readiness status for a given source.
 *
 * - SIMULATION_INPUT_ELIGIBLE: source passes all gates; eligible as paper-only simulation input
 * - CONSUMER_READY_AUDIT_ONLY: consumer integration complete, but simulation input not yet authorized
 * - SOURCE_PRESENT_AUDIT_ONLY: source data present and gate-eligible, but consumer integration missing
 * - BLOCKED_PIT_METADATA: PIT metadata (releaseDate / publishedAt / availableAt) missing
 * - BLOCKED_QUALITY_EVIDENCE: NLP / symbol linkage / source diversity quality unknown
 * - BLOCKED_AUTHORIZATION: explicit authorization required before any action
 * - BLOCKED_LAG_EVIDENCE: lag evidence (prod logs / availableAt) not validated
 * - NOT_APPLICABLE: source not in scope
 */
export type SimulationInputStatus =
  | "SIMULATION_INPUT_ELIGIBLE"
  | "CONSUMER_READY_AUDIT_ONLY"
  | "SOURCE_PRESENT_AUDIT_ONLY"
  | "BLOCKED_PIT_METADATA"
  | "BLOCKED_QUALITY_EVIDENCE"
  | "BLOCKED_AUTHORIZATION"
  | "BLOCKED_LAG_EVIDENCE"
  | "NOT_APPLICABLE";

// ─── Source Readiness Facts ───────────────────────────────────────────────────

/**
 * Facts about a source's current readiness state.
 * These are the inputs to the readiness mapper.
 *
 * IMPORTANT: Must not contain scoring, recommendation, or investment fields.
 * Any forbidden field present in this struct causes BLOCKED_AUTHORIZATION.
 */
export interface SourceReadinessFacts {
  /** Source identifier */
  sourceName: SourceName;

  /** Whether a PIT gate field is present (releaseDate / publishedAt / availableAt) */
  pitStatus: "PIT_GATE_PRESENT" | "PIT_GATE_MISSING" | "NOT_ASSESSED";

  /** Confidence level of the PIT gate value */
  pitConfidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";

  /** Consumer integration status */
  consumerStatus:
    | "CONSUMER_READY"
    | "SOURCE_PRESENT_AUDIT_ONLY"
    | "BLOCKED"
    | "NOT_ASSESSED";

  /** Whether quality evidence (NLP, symbol linkage, source diversity) is complete */
  qualityEvidenceComplete: boolean;

  /** Whether PIT metadata fields are complete */
  pitMetadataComplete: boolean;

  /** Whether lag evidence (prod logs, availableAt) is validated */
  lagEvidenceComplete: boolean;

  /** Whether explicit authorization has been granted for schema migration */
  authorizationGranted: boolean;

  /** Whether PIT-safe behavior has been confirmed in the system */
  pitSafeConfirmed: boolean;

  /** Optional source trace for audit */
  sourceTrace?: string;
}

// ─── Individual Readiness Entry ───────────────────────────────────────────────

export interface SimulationInputReadinessEntry {
  /** Source name */
  sourceName: SourceName;

  /** Human-readable current gate status */
  currentGateStatus: string;

  /** PIT gate status */
  pitStatus: string;

  /** Consumer integration status */
  consumerStatus: string;

  /** Final simulation input readiness classification */
  simulationInputStatus: SimulationInputStatus;

  /** Reasons blocking progress (empty if SIMULATION_INPUT_ELIGIBLE) */
  blockingReasons: string[];

  /** What this source MAY be used for under current classification */
  allowedUse: string[];

  /**
   * What this source MUST NEVER be used for.
   * Always includes production scoring, optimizer, real backtest,
   * buy/sell/hold semantics, alphaScore mutation, investment recommendation.
   */
  forbiddenUse: string[];

  /** Evidence required before the next gate can be cleared */
  requiredNextEvidence: string[];

  /** GOVERNANCE: always false */
  entersAlphaScore: false;

  /** GOVERNANCE: always true */
  paperOnly: true;

  /** GOVERNANCE: always true */
  noInvestmentAdvice: true;
}

// ─── Full Readiness Matrix ────────────────────────────────────────────────────

export interface SimulationInputReadinessMatrix {
  /** ISO timestamp of generation */
  generatedAt: string;

  /** GOVERNANCE: always true */
  dryRunOnly: true;

  /** GOVERNANCE: always true */
  paperOnly: true;

  /** GOVERNANCE: always false */
  entersAlphaScore: false;

  /** GOVERNANCE: always true */
  notInvestmentRecommendation: true;

  /** GOVERNANCE: always true */
  noBuySellActionSemantics: true;

  /** Per-source readiness entries */
  entries: SimulationInputReadinessEntry[];

  /** Matrix schema version */
  version: string;

  /** Full disclaimer */
  disclaimer: string;
}

// ─── Forbidden Uses (always enforced) ────────────────────────────────────────

/**
 * These uses are ALWAYS forbidden regardless of source classification.
 * Appended to every SimulationInputReadinessEntry.forbiddenUse.
 */
export const SIMULATION_INPUT_FORBIDDEN_USES: readonly string[] = [
  "production scoring",
  "alphaScore mutation",
  "optimizer",
  "real backtest",
  "buy/sell/hold action semantics",
  "investment recommendation",
  "performance claims (profit, ROI, win-rate, edge, expected return)",
  "scoring formula modification",
];

/**
 * Fields that must never appear in SourceReadinessFacts or any mapper output.
 */
export const SIMULATION_INPUT_FORBIDDEN_FIELDS: readonly string[] = [
  "alphaScore",
  "prediction",
  "recommendation",
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
  "edgeScore",
];

// ─── Version & Disclaimer ─────────────────────────────────────────────────────

export const SIMULATION_INPUT_READINESS_MATRIX_VERSION =
  "p38-simulation-input-readiness-mapping-v1";

export const SIMULATION_INPUT_READINESS_DISCLAIMER =
  "DISCLAIMER: This simulation input readiness matrix does not constitute investment advice, " +
  "a recommendation, or a signal to buy, sell, or hold any security. " +
  "entersAlphaScore = false. paperOnly = true. dryRunOnly = true. " +
  "No profit, return, win-rate, edge, or investment performance claims are made. " +
  "For structural readiness audit and simulation input classification purposes only. " +
  "P38 does not execute simulations, optimizers, or real backtests.";
