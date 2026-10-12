/**
 * P62 — Axis B Simulation Input Eligibility Review Contract
 *
 * Pure TypeScript contract stub for the Axis B simulation input eligibility
 * review artifact introduced by P61. Defines types and constants for
 * representing source review entries, statuses, PIT states, summary counts,
 * and governance flags.
 *
 * Design contract:
 *   - Pure contract — no DB, no Prisma, no network, no filesystem imports
 *   - No child_process import
 *   - No builder function (builder belongs to P63 if separately approved)
 *   - No Axis A implementation import
 *   - No P53/P54 logic mutation
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - No scoring, no recommendation, no investment advice, no forbidden fields
 *   - No simulation execution, no metrics, no optimizer, no backtest
 *
 * This is NOT simulation execution.
 * This is NOT a backtest.
 * This is NOT optimizer work.
 * This does NOT produce returns, ROI, PnL, win-rate, edge, alphaScore,
 * recommendation, benchmark, target price, or action fields.
 *
 * DISCLAIMER: This module does not constitute investment advice,
 * a recommendation, or a signal to buy, sell, or hold any security.
 * entersAlphaScore = false. paperOnly = true. dryRunOnly = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 * For structural eligibility review audit purposes only.
 *
 * Upstream baseline:
 *   P53 — Axis B simulation input eligibility diff (P53_AXIS_B_..._COMMITTED)
 *   P54 — Axis B diff report builder (P54_AXIS_B_..._COMMITTED)
 *   P57 — Axis A v1 source adapter contract stub
 *   P58 — Axis A v1 adapter implementations (Quote, Regime, MonthlyRevenue)
 *   P59 — Axis A v1 ResearchSnapshotInputBuilder
 *   P60-GATE — BLOCK_FURTHER_AXIS_A_RECOMMEND_AXIS_B (commit 73167ff)
 *   P61 — Axis B simulation input eligibility review (P61_AXIS_B_..._COMMITTED)
 *
 * Authorization:
 *   P60-GATE 2026-05-26 — P62 is code-touching Axis B contract stub only.
 *   P63-GATE or explicit approval required before any builder implementation.
 */

// ─── Version ──────────────────────────────────────────────────────────────────

export const SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONTRACT_VERSION =
  "p62-axis-b-simulation-input-eligibility-review-contract-v0" as const;

// ─── Governance ───────────────────────────────────────────────────────────────

export const SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE = {
  axis: "Axis B",
  paperOnly: true,
  dryRunOnly: true,
  noSimulationExecution: true,
  noMetrics: true,
  noScoring: true,
  noOptimizer: true,
  noBacktest: true,
  noRecommendation: true,
  notInvestmentAdvice: true,
  entersAlphaScore: false,
} as const;

// ─── Forbidden Fields ─────────────────────────────────────────────────────────

/**
 * Fields that must NEVER appear in any P62 review artifact output.
 * This is a strict superset of P53/P54 forbidden fields, extended with
 * additional P57/P61 guardrail terms.
 *
 * These names must never appear as top-level artifact field names,
 * computed values, or metric outputs.
 */
export const SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS = [
  "recommendation",
  "action",
  "buy",
  "sell",
  "hold",
  "targetPrice",
  "ROI",
  "PnL",
  "winRate",
  "edge",
  "alphaScore",
  "score",
  "forecast",
  "expectedReturn",
  "benchmark",
  "optimizer",
  "backtest",
  "returnPct",
  "profit",
  "position",
] as const;

// ─── Source Names ─────────────────────────────────────────────────────────────

/**
 * All source names tracked in the P62 eligibility review contract.
 * Derived from the P61 source review matrix.
 */
export type SimulationInputReviewSourceName =
  | "Quote"
  | "Regime"
  | "MonthlyRevenue"
  | "FinancialReport"
  | "Chip"
  | "NewsEvent";

/**
 * The complete set of expected source names as a readonly tuple.
 * Used for validation and test assertions.
 */
export const EXPECTED_REVIEW_SOURCE_NAMES: readonly SimulationInputReviewSourceName[] =
  [
    "Quote",
    "Regime",
    "MonthlyRevenue",
    "FinancialReport",
    "Chip",
    "NewsEvent",
  ] as const;

// ─── Review Statuses ──────────────────────────────────────────────────────────

/**
 * Possible review statuses for each source in the P62 eligibility review.
 * Derived from the P61 source review matrix.
 */
export type SimulationInputReviewStatus =
  | "ELIGIBLE_FOR_REVIEW_ARTIFACT"
  | "ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING"
  | "BLOCKED"
  | "AUDIT_ONLY";

/**
 * The complete set of expected review statuses as a readonly tuple.
 * Used for validation and test assertions.
 */
export const EXPECTED_REVIEW_STATUSES: readonly SimulationInputReviewStatus[] =
  [
    "ELIGIBLE_FOR_REVIEW_ARTIFACT",
    "ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING",
    "BLOCKED",
    "AUDIT_ONLY",
  ] as const;

// ─── PIT States ───────────────────────────────────────────────────────────────

/**
 * PIT (point-in-time) safety states for each source.
 * Derived from P57 RealDataSnapshotInputContract and P58 adapter implementations.
 */
export type SimulationInputPitState =
  | "PIT_SAFE_IF_DATE_PRESENT"
  | "PIT_SAFE_IF_DATE_AND_PIT_SAFETY_PRESENT"
  | "PIT_SAFE_IF_RELEASE_DATE_PRESENT"
  | "LOW_CONFIDENCE_PIT_INFERRED_IF_RELEASE_DATE_MISSING"
  | "BLOCKED_PENDING_PIT_METADATA"
  | "BLOCKED_PENDING_AVAILABLE_AT_AND_PROD_LOGS"
  | "AUDIT_ONLY_PENDING_QUALITY_AND_SYMBOL_LINKAGE";

// ─── Review Entry ─────────────────────────────────────────────────────────────

/**
 * A single source entry in the P62 eligibility review artifact.
 *
 * Fields:
 *   - source: the source identifier
 *   - status: its eligibility review status (from P61 matrix)
 *   - pitState: its PIT safety state (from P57/P58)
 *   - allowedUse: what this entry may be used for
 *   - forbiddenUse: guardrail list of prohibited uses for this source
 *   - requiredAuthorization: null if eligible; non-null string if blocked/audit-only
 *
 * GOVERNANCE: No scoring, no metrics, no recommendation semantics.
 */
export type SimulationInputEligibilityReviewEntry = {
  readonly source: SimulationInputReviewSourceName;
  readonly status: SimulationInputReviewStatus;
  readonly pitState: SimulationInputPitState;
  readonly allowedUse: "structural input eligibility review only";
  readonly forbiddenUse: readonly string[];
  readonly requiredAuthorization: string | null;
};

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * Count-only summary of a P62 eligibility review artifact.
 *
 * GOVERNANCE: Counts only — no performance metrics, no returns, no scoring.
 */
export type SimulationInputEligibilityReviewSummary = {
  readonly eligibleCount: number;
  readonly lowConfidenceCount: number;
  readonly blockedCount: number;
  readonly auditOnlyCount: number;
  readonly totalSources: number;
};

// ─── Artifact ─────────────────────────────────────────────────────────────────

/**
 * The top-level P62 Axis B simulation input eligibility review artifact.
 *
 * Fields:
 *   - version: contract version for identity and traceability
 *   - generatedAt: ISO timestamp when the artifact was produced
 *   - governance: readonly governance flags (all constant)
 *   - entries: the per-source review entries
 *   - summary: count-only summary of the review
 *
 * GOVERNANCE:
 *   paperOnly = true
 *   dryRunOnly = true
 *   entersAlphaScore = false
 *   noSimulationExecution = true
 *   noMetrics = true
 *   noScoring = true
 *   noOptimizer = true
 *   noBacktest = true
 *   noRecommendation = true
 *   notInvestmentAdvice = true
 */
export type SimulationInputEligibilityReviewArtifact = {
  readonly version: typeof SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONTRACT_VERSION;
  readonly generatedAt: string;
  readonly governance: typeof SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE;
  readonly entries: readonly SimulationInputEligibilityReviewEntry[];
  readonly summary: SimulationInputEligibilityReviewSummary;
};

// ─── Default Forbidden Use ────────────────────────────────────────────────────

/**
 * Default forbidden-use guardrail list applied to all review entries.
 * Sources may extend this list but must not remove entries from it.
 *
 * Note: These strings name prohibited activities — they are guardrail
 * declarations, not live computations.
 */
export const DEFAULT_REVIEW_FORBIDDEN_USE: readonly string[] = [
  "scoring",
  "prediction",
  "alphaScore computation",
  "benchmark comparison",
  "performance measurement",
  "investment recommendation",
  "simulation execution",
  "optimizer run",
  "backtest run",
  "buy/sell/hold action semantics",
  "target price derivation",
  "ROI or PnL computation",
  "win-rate or edge computation",
  "profit or return calculation",
] as const;
