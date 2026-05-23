/**
 * P1 — Axis A Controlled Research Snapshot v0
 *
 * Defines the contract and types for the Controlled Research Snapshot surface.
 * A snapshot aggregates PIT-safe readiness states across controlled sources
 * (MonthlyRevenue, Quote, Regime) into a single governance-auditable object.
 *
 * This module is pure TypeScript — no DB access, no side effects, deterministic.
 * It does NOT produce scores, predictions, recommendations, or investment advice.
 *
 * INVARIANTS (must never be violated):
 *   entersAlphaScore = false        — snapshot never mutates scoring formula
 *   notInvestmentRecommendation = true — NOT buy/sell/hold/action semantics
 *   paperOnly = true                — paper simulation surface only
 *   dryRun = true                   — no real execution, no DB apply
 *   no PnL / ROI / win-rate claims
 *
 * DISCLAIMER: Research snapshot only. Does not constitute investment advice.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 * Results must not be used as buy/sell/hold signals or investment recommendations.
 */

// ─── Version & Disclaimer ─────────────────────────────────────────────────────

export const CONTROLLED_RESEARCH_SNAPSHOT_VERSION =
  "p1-axis-a-controlled-research-snapshot-v0";

export const CONTROLLED_RESEARCH_SNAPSHOT_DISCLAIMER =
  "Controlled research snapshot only. Does not constitute investment advice. " +
  "No profit, return, win-rate, edge, or investment performance claims are made. " +
  "entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true. " +
  "Results must not be used as buy/sell/hold signals or investment recommendations. " +
  "This snapshot prohibits: buy, sell, hold, ROI, win-rate, edge, profit, outperform, " +
  "guaranteed-return, expected-return, investment-recommendation, targetPrice, outcomePrice.";

// ─── Readiness Status ─────────────────────────────────────────────────────────

/**
 * Overall readiness classification of a controlled research snapshot.
 *
 * SNAPSHOT_READY:        All assessed sources are PIT-safe eligible; ready for
 *                        paper-only, dry-run research surface consumption.
 * SNAPSHOT_PARTIAL:      At least one source is eligible but others are
 *                        blocked, audit-only, or not assessed.
 * SNAPSHOT_BLOCKED:      No sources are eligible; snapshot cannot proceed.
 * SNAPSHOT_BLOCKED_PIT:  asOfDate is in the future; PIT boundary violated.
 */
export type ResearchSnapshotReadinessStatus =
  | "SNAPSHOT_READY"
  | "SNAPSHOT_PARTIAL"
  | "SNAPSHOT_BLOCKED"
  | "SNAPSHOT_BLOCKED_PIT";

// ─── Source Input State ───────────────────────────────────────────────────────

/**
 * Per-source PIT-safe input state, derived from P38 SimulationInputStatus.
 * "NOT_ASSESSED" is used when no facts were provided for a source.
 */
export type SourceInputState =
  | "ELIGIBLE"
  | "AUDIT_ONLY"
  | "BLOCKED"
  | "NOT_ASSESSED";

export interface PitSafeInputState {
  /** MonthlyRevenue controlled consumer (P36/P37) */
  monthlyRevenue: SourceInputState;
  /** PIT-safe Quote surface */
  quote: SourceInputState;
  /** Market Regime surface */
  regime: SourceInputState;
}

// ─── Snapshot Contract ────────────────────────────────────────────────────────

/**
 * The Controlled Research Snapshot — the central Axis A output artifact.
 *
 * Aggregates PIT-safe source readiness states for a single symbol+asOfDate
 * into an immutable, auditable governance record.
 */
export interface ControlledResearchSnapshot {
  /** Target symbol (e.g. "2330") */
  symbol: string;

  /** PIT boundary — snapshot only valid for data at or before this date (YYYY-MM-DD) */
  asOfDate: string;

  /** Snapshot schema version */
  snapshotVersion: string;

  /** ISO timestamp of snapshot generation */
  generatedAt: string;

  /** Human-readable trace of how this snapshot was produced */
  sourceTrace: string;

  /** Per-source PIT-safe input states */
  pitSafeInputs: PitSafeInputState;

  /** Raw SimulationInputStatus for MonthlyRevenue, or "NOT_ASSESSED" */
  monthlyRevenueReadiness: string;

  /** Raw SimulationInputStatus for Quote, or "NOT_ASSESSED" */
  quoteReadiness: string;

  /** Raw SimulationInputStatus for Regime, or "NOT_ASSESSED" */
  regimeReadiness: string;

  /** Overall snapshot readiness classification */
  researchReadinessStatus: ResearchSnapshotReadinessStatus;

  /** List of reasons blocking progress; empty if SNAPSHOT_READY */
  blockingReasons: string[];

  /** Full disclaimer text */
  disclaimer: string;

  // ─── Governance Invariants (must never change) ─────────────────────────────
  /** INVARIANT: snapshot NEVER enters alphaScore. Must always be false. */
  readonly entersAlphaScore: false;
  /** INVARIANT: not an investment recommendation. Must always be true. */
  readonly notInvestmentRecommendation: true;
  /** INVARIANT: paper-only surface. Must always be true. */
  readonly paperOnly: true;
  /** INVARIANT: dry-run only; no real execution or DB apply. Must always be true. */
  readonly dryRun: true;
}

// ─── Contract Constant ────────────────────────────────────────────────────────

/**
 * The canonical contract for all Controlled Research Snapshots.
 * Imported by consumers to assert invariants without re-declaring them.
 */
export const CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT = {
  surfaceName: "ControlledResearchSnapshot" as const,
  version: CONTROLLED_RESEARCH_SNAPSHOT_VERSION,
  entersAlphaScore: false as const,
  notInvestmentRecommendation: true as const,
  paperOnly: true as const,
  dryRun: true as const,
  noBuySellActionSemantics: true as const,
  noScoringFormulaAccess: true as const,
  noDbApply: true as const,
  disclaimer: CONTROLLED_RESEARCH_SNAPSHOT_DISCLAIMER,
} as const;

// ─── Forbidden Fields ─────────────────────────────────────────────────────────

/**
 * Fields that must NEVER appear in a ControlledResearchSnapshot output.
 * Checked at runtime by the builder and in tests.
 */
export const SNAPSHOT_FORBIDDEN_FIELDS: readonly string[] = [
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
  "profitLoss",
  "edgeScore",
  "realizedReturn",
  "forwardReturn",
  "predictedPrice",
  "futurePrice",
  "expectedReturn",
  "alpha",
  "score",
] as const;

// ─── Invariant Validation ─────────────────────────────────────────────────────

export interface SnapshotValidationResult {
  valid: boolean;
  violations: string[];
}

/**
 * Validates that a snapshot obeys all governance invariants.
 * Pure function — no side effects.
 */
export function validateSnapshotInvariants(
  snapshot: ControlledResearchSnapshot
): SnapshotValidationResult {
  const violations: string[] = [];

  if (snapshot.entersAlphaScore !== false) {
    violations.push("INVARIANT_VIOLATION: entersAlphaScore must be false");
  }
  if (snapshot.notInvestmentRecommendation !== true) {
    violations.push("INVARIANT_VIOLATION: notInvestmentRecommendation must be true");
  }
  if (snapshot.paperOnly !== true) {
    violations.push("INVARIANT_VIOLATION: paperOnly must be true");
  }
  if (snapshot.dryRun !== true) {
    violations.push("INVARIANT_VIOLATION: dryRun must be true");
  }

  // Check no forbidden fields present at object top level
  const keys = Object.keys(snapshot as Record<string, unknown>);
  for (const key of keys) {
    if ((SNAPSHOT_FORBIDDEN_FIELDS as readonly string[]).includes(key)) {
      violations.push(
        `INVARIANT_VIOLATION: forbidden field "${key}" present in snapshot`
      );
    }
  }

  return { valid: violations.length === 0, violations };
}
