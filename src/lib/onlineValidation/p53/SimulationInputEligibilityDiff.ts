/**
 * P53 — Axis B Simulation Input Eligibility Diff
 *
 * Compares two PaperSimulationInputBundle objects (P39) and returns a
 * structured diff report describing which simulation input sources became
 * eligible, were removed, remained unchanged, or changed their blocking
 * classification between the "before" and "after" snapshots.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem writes
 *   - Deterministic when fixedDiffedAt is provided
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - No scoring, no recommendation, no investment advice, no forbidden fields
 *   - Does not mutate either input bundle
 *   - Order preservation:
 *       addedEligibleSources / unchangedEligibleSources → after.eligibleSources order
 *       removedEligibleSources → before.eligibleSources order
 *       changedEligibilitySources → after.blockedSources order (for those that changed)
 *       blockedSourcesBefore → before.blockedSources order (verbatim)
 *       blockedSourcesAfter  → after.blockedSources order (verbatim)
 *   - Identity key: sourceName (SourceName string)
 *
 * Diff semantics:
 *   - addedEligibleSources:   in after.eligibleSources, NOT in before.eligibleSources
 *   - removedEligibleSources: in before.eligibleSources, NOT in after.eligibleSources
 *   - unchangedEligibleSources: in both before and after eligibleSources
 *   - changedEligibilitySources: in BOTH before and after blockedSources,
 *       where blockedStatus OR blockingReasons differ (blocked→blocked with change)
 *   - blockedSourcesBefore: verbatim copy of before.blockedSources
 *   - blockedSourcesAfter:  verbatim copy of after.blockedSources
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
 * For structural eligibility audit purposes only.
 *
 * Authorization:
 *   CEO Decision 2026-05-25 — P53 is Axis B re-entry, first of at least 2 rounds.
 */

import type {
  PaperSimulationEligibleSourceInput,
  PaperSimulationBlockedSource,
  PaperSimulationInputBundle,
  SourceName,
} from "../p39/PaperSimulationInputContract";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION =
  "p53-axis-b-simulation-input-eligibility-diff-v0" as const;

// ─── Changed Eligibility Entry ────────────────────────────────────────────────

/**
 * Describes a source that was blocked in BOTH the before and after bundles,
 * but whose blocking classification or blocking reasons changed between them.
 *
 * This captures the "changed blocking reason" audit case.
 * It does NOT cover eligible→blocked or blocked→eligible transitions —
 * those are captured in removedEligibleSources and addedEligibleSources.
 *
 * GOVERNANCE: No scoring, recommendation, or action semantics.
 */
export type EligibilityChangedEntry = {
  /** Source identifier */
  readonly sourceName: SourceName;

  /** Blocking classification in the before bundle */
  readonly blockedStatusBefore: PaperSimulationBlockedSource["blockedStatus"];

  /** Blocking classification in the after bundle */
  readonly blockedStatusAfter: PaperSimulationBlockedSource["blockedStatus"];

  /** Blocking reasons as they appeared in the before bundle */
  readonly blockingReasonsBefore: readonly string[];

  /** Blocking reasons as they appear in the after bundle */
  readonly blockingReasonsAfter: readonly string[];

  /** GOVERNANCE: always false */
  readonly entersAlphaScore: false;

  /** GOVERNANCE: always true */
  readonly paperOnly: true;
};

// ─── Diff Report ──────────────────────────────────────────────────────────────

/**
 * Full eligibility diff report produced by diffSimulationInputEligibility().
 *
 * All arrays are readonly and frozen — the report is immutable after
 * construction. Counts always equal the length of their corresponding arrays.
 *
 * GOVERNANCE:
 *   paperOnly = true
 *   dryRunOnly = true
 *   entersAlphaScore = false
 *   noActualMetrics = true
 *   noRealExecution = true
 *   notInvestmentAdvice = true
 */
export type SimulationInputEligibilityDiffReport = {
  /** Identifies this diff implementation version */
  readonly diffVersion: typeof SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION;

  /** ISO timestamp when this diff was produced */
  readonly diffedAt: string;

  /**
   * Sources eligible in after but NOT in before (became eligible).
   * Preserves after.eligibleSources order for affected entries.
   */
  readonly addedEligibleSources: readonly PaperSimulationEligibleSourceInput[];

  /**
   * Sources eligible in before but NOT in after (lost eligibility).
   * Preserves before.eligibleSources order for affected entries.
   */
  readonly removedEligibleSources: readonly PaperSimulationEligibleSourceInput[];

  /**
   * Sources eligible in BOTH before and after (remained eligible).
   * Preserves after.eligibleSources order for affected entries.
   */
  readonly unchangedEligibleSources: readonly PaperSimulationEligibleSourceInput[];

  /**
   * Sources blocked in BOTH before and after, but where the blocking
   * classification or blocking reasons changed.
   * Preserves after.blockedSources order for affected entries.
   */
  readonly changedEligibilitySources: readonly EligibilityChangedEntry[];

  /**
   * Verbatim copy of before.blockedSources for audit reference.
   * Preserves before.blockedSources order.
   */
  readonly blockedSourcesBefore: readonly PaperSimulationBlockedSource[];

  /**
   * Verbatim copy of after.blockedSources for audit reference.
   * Preserves after.blockedSources order.
   */
  readonly blockedSourcesAfter: readonly PaperSimulationBlockedSource[];

  /** Count of addedEligibleSources — always equals addedEligibleSources.length */
  readonly addedEligibleCount: number;

  /** Count of removedEligibleSources — always equals removedEligibleSources.length */
  readonly removedEligibleCount: number;

  /** Count of unchangedEligibleSources — always equals unchangedEligibleSources.length */
  readonly unchangedEligibleCount: number;

  /** Count of changedEligibilitySources — always equals changedEligibilitySources.length */
  readonly changedEligibilityCount: number;

  /** Count of blockedSourcesBefore — always equals blockedSourcesBefore.length */
  readonly blockedBeforeCount: number;

  /** Count of blockedSourcesAfter — always equals blockedSourcesAfter.length */
  readonly blockedAfterCount: number;

  /** GOVERNANCE: always true — this diff is paper-only */
  readonly paperOnly: true;

  /** GOVERNANCE: always true — this diff is dry-run only */
  readonly dryRunOnly: true;

  /** GOVERNANCE: always false — this diff never enters alpha scoring */
  readonly entersAlphaScore: false;

  /** GOVERNANCE: always true — no actual performance metrics */
  readonly noActualMetrics: true;

  /** GOVERNANCE: always true — no real execution triggered */
  readonly noRealExecution: true;

  /** GOVERNANCE: always true — not investment advice */
  readonly notInvestmentAdvice: true;
};

// ─── Forbidden Fields (compile-time audit reference) ─────────────────────────

/**
 * Fields that must NEVER appear in any P53 diff output.
 * This list is a strict superset of P39 forbidden fields.
 */
export const SIMULATION_INPUT_ELIGIBILITY_DIFF_FORBIDDEN_FIELDS: readonly string[] =
  [
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
    "edgeScore",
    "roi",
    "pnl",
    "benchmark",
    "action",
  ] as const;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Build the identity key for a source entry.
 * sourceName is the canonical identifier for Axis B contracts.
 */
function eligibleKey(entry: PaperSimulationEligibleSourceInput): SourceName {
  return entry.sourceName;
}

function blockedKey(entry: PaperSimulationBlockedSource): SourceName {
  return entry.sourceName;
}

/**
 * Returns true if two blocked source entries have the same blocking
 * classification AND the same blocking reasons (order-insensitive).
 */
function blockedSourceIsUnchanged(
  a: PaperSimulationBlockedSource,
  b: PaperSimulationBlockedSource,
): boolean {
  if (a.blockedStatus !== b.blockedStatus) return false;
  if (a.blockingReasons.length !== b.blockingReasons.length) return false;
  const bSet = new Set(b.blockingReasons);
  return a.blockingReasons.every((r) => bSet.has(r));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compare two PaperSimulationInputBundle objects and return a
 * SimulationInputEligibilityDiffReport.
 *
 * Algorithm (O(n + m)):
 *   1. Build identity-key sets for before.eligibleSources and after.eligibleSources.
 *   2. Build identity-key maps for before.blockedSources and after.blockedSources.
 *   3. Walk after.eligibleSources:
 *      - sourceName in beforeEligibleKeys → unchangedEligibleSources
 *      - sourceName NOT in beforeEligibleKeys → addedEligibleSources
 *   4. Walk before.eligibleSources:
 *      - sourceName NOT in afterEligibleKeys → removedEligibleSources
 *   5. Walk after.blockedSources:
 *      - sourceName in beforeBlockedMap AND classification changed →
 *        changedEligibilitySources (preserves after order)
 *   6. blockedSourcesBefore / blockedSourcesAfter are verbatim copies.
 *
 * Neither input bundle is mutated.
 *
 * @param before          The earlier PaperSimulationInputBundle (baseline).
 * @param after           The later PaperSimulationInputBundle (current state).
 * @param fixedDiffedAt   Optional ISO timestamp for deterministic testing.
 *                        If omitted, uses new Date().toISOString().
 */
export function diffSimulationInputEligibility(
  before: PaperSimulationInputBundle,
  after: PaperSimulationInputBundle,
  fixedDiffedAt?: string,
): SimulationInputEligibilityDiffReport {
  const diffedAt = fixedDiffedAt ?? new Date().toISOString();

  // ── Step 1: Build eligible identity-key sets ────────────────────────────
  const beforeEligibleKeys = new Set<SourceName>(
    before.eligibleSources.map(eligibleKey),
  );
  const afterEligibleKeys = new Set<SourceName>(
    after.eligibleSources.map(eligibleKey),
  );

  // ── Step 2: Build blocked identity-key maps ─────────────────────────────
  const beforeBlockedMap = new Map<SourceName, PaperSimulationBlockedSource>();
  for (const entry of before.blockedSources) {
    beforeBlockedMap.set(blockedKey(entry), entry);
  }

  // ── Step 3: Walk after.eligibleSources → added or unchanged ────────────
  const addedEligibleSources: PaperSimulationEligibleSourceInput[] = [];
  const unchangedEligibleSources: PaperSimulationEligibleSourceInput[] = [];
  for (const entry of after.eligibleSources) {
    if (beforeEligibleKeys.has(eligibleKey(entry))) {
      unchangedEligibleSources.push(entry);
    } else {
      addedEligibleSources.push(entry);
    }
  }

  // ── Step 4: Walk before.eligibleSources → removed ──────────────────────
  const removedEligibleSources: PaperSimulationEligibleSourceInput[] = [];
  for (const entry of before.eligibleSources) {
    if (!afterEligibleKeys.has(eligibleKey(entry))) {
      removedEligibleSources.push(entry);
    }
  }

  // ── Step 5: Walk after.blockedSources → changedEligibilitySources ──────
  // Only includes entries that are blocked in BOTH before and after,
  // but whose blocking classification or reasons differ.
  const changedEligibilitySources: EligibilityChangedEntry[] = [];
  for (const afterEntry of after.blockedSources) {
    const beforeEntry = beforeBlockedMap.get(blockedKey(afterEntry));
    if (beforeEntry !== undefined && !blockedSourceIsUnchanged(beforeEntry, afterEntry)) {
      changedEligibilitySources.push({
        sourceName: afterEntry.sourceName,
        blockedStatusBefore: beforeEntry.blockedStatus,
        blockedStatusAfter: afterEntry.blockedStatus,
        blockingReasonsBefore: Object.freeze([...beforeEntry.blockingReasons]),
        blockingReasonsAfter: Object.freeze([...afterEntry.blockingReasons]),
        entersAlphaScore: false,
        paperOnly: true,
      });
    }
  }

  // ── Step 6: Verbatim blocked source copies ──────────────────────────────
  const blockedSourcesBefore = Object.freeze([...before.blockedSources]);
  const blockedSourcesAfter = Object.freeze([...after.blockedSources]);

  return {
    diffVersion: SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION,
    diffedAt,

    addedEligibleSources: Object.freeze([...addedEligibleSources]),
    removedEligibleSources: Object.freeze([...removedEligibleSources]),
    unchangedEligibleSources: Object.freeze([...unchangedEligibleSources]),
    changedEligibilitySources: Object.freeze([...changedEligibilitySources]),

    blockedSourcesBefore,
    blockedSourcesAfter,

    addedEligibleCount: addedEligibleSources.length,
    removedEligibleCount: removedEligibleSources.length,
    unchangedEligibleCount: unchangedEligibleSources.length,
    changedEligibilityCount: changedEligibilitySources.length,
    blockedBeforeCount: before.blockedSources.length,
    blockedAfterCount: after.blockedSources.length,

    paperOnly: true,
    dryRunOnly: true,
    entersAlphaScore: false,
    noActualMetrics: true,
    noRealExecution: true,
    notInvestmentAdvice: true,
  };
}
