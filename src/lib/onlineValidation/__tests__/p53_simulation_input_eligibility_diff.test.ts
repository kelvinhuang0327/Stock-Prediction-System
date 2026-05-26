/**
 * P53 — Axis B Simulation Input Eligibility Diff Tests
 *
 * Tests for SimulationInputEligibilityDiff: diffSimulationInputEligibility()
 * covering: governance invariants, version constant, empty/full/partial bundles,
 * added/removed/unchanged/changed classification, order preservation, count
 * accuracy, determinism, non-mutation, JSON serializability, forbidden-field scan.
 *
 * DISCLAIMER: Structural diff tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRunOnly = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 */

import {
  SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION,
  SIMULATION_INPUT_ELIGIBILITY_DIFF_FORBIDDEN_FIELDS,
  diffSimulationInputEligibility,
  type SimulationInputEligibilityDiffReport,
  type EligibilityChangedEntry,
} from "../p53/SimulationInputEligibilityDiff";

import {
  buildDefaultPaperSimulationInputBundle,
  buildPaperSimulationInputBundle,
} from "../p39/PaperSimulationInputContractBuilder";

import type { PaperSimulationInputBundle } from "../p39/PaperSimulationInputContract";
import type { SimulationInputReadinessEntry } from "../p38/SimulationInputReadinessTypes";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIXED_DIFFED_AT = "2026-05-26T00:00:00.000Z";
const AS_OF_BEFORE = "2026-05-20T00:00:00.000Z";
const AS_OF_AFTER = "2026-05-26T00:00:00.000Z";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeEligibleEntry(
  sourceName: SimulationInputReadinessEntry["sourceName"],
): SimulationInputReadinessEntry {
  return {
    sourceName,
    currentGateStatus: "SIMULATION_INPUT_ELIGIBLE",
    pitStatus: "PIT_GATE_PRESENT",
    consumerStatus: "CONSUMER_READY",
    simulationInputStatus: "SIMULATION_INPUT_ELIGIBLE",
    blockingReasons: [],
    allowedUse: ["paper-only simulation input"],
    forbiddenUse: [
      "production scoring",
      "alphaScore mutation",
      "optimizer",
      "real backtest",
      "buy/sell/hold action semantics",
      "investment recommendation",
      "performance claims (profit, ROI, win-rate, edge, expected return)",
      "scoring formula modification",
    ],
    requiredNextEvidence: [],
    entersAlphaScore: false,
    paperOnly: true,
    noInvestmentAdvice: true,
  };
}

function makeBlockedEntry(
  sourceName: SimulationInputReadinessEntry["sourceName"],
  status: SimulationInputReadinessEntry["simulationInputStatus"] &
    (
      | "BLOCKED_QUALITY_EVIDENCE"
      | "BLOCKED_PIT_METADATA"
      | "BLOCKED_AUTHORIZATION"
      | "BLOCKED_LAG_EVIDENCE"
    ),
  reasons: string[] = ["reason-A"],
): SimulationInputReadinessEntry {
  return {
    sourceName,
    currentGateStatus: status,
    pitStatus: "NOT_ASSESSED",
    consumerStatus: "BLOCKED",
    simulationInputStatus: status,
    blockingReasons: reasons,
    allowedUse: [],
    forbiddenUse: [
      "production scoring",
      "alphaScore mutation",
      "optimizer",
      "real backtest",
      "buy/sell/hold action semantics",
      "investment recommendation",
      "performance claims (profit, ROI, win-rate, edge, expected return)",
      "scoring formula modification",
    ],
    requiredNextEvidence: ["See P38 for required evidence"],
    entersAlphaScore: false,
    paperOnly: true,
    noInvestmentAdvice: true,
  };
}

/** Returns the canonical default bundle (MR, Quote, Regime eligible; NE, FR, Chip blocked). */
function defaultBundle(asOfDate: string): PaperSimulationInputBundle {
  return buildDefaultPaperSimulationInputBundle({ asOfDate });
}

/** Returns a bundle with only one eligible source (MonthlyRevenue) and the rest blocked. */
function singleEligibleBundle(asOfDate: string): PaperSimulationInputBundle {
  return buildPaperSimulationInputBundle(
    [
      makeEligibleEntry("MonthlyRevenue"),
      makeBlockedEntry("Quote", "BLOCKED_LAG_EVIDENCE", ["lag evidence missing"]),
      makeBlockedEntry("Regime", "BLOCKED_AUTHORIZATION", ["authorization not granted"]),
      makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE"),
      makeBlockedEntry("FinancialReport", "BLOCKED_PIT_METADATA"),
      makeBlockedEntry("Chip", "BLOCKED_AUTHORIZATION"),
    ],
    { asOfDate },
  );
}

/** Empty bundle — no eligible, no blocked sources. */
function emptyBundle(asOfDate: string): PaperSimulationInputBundle {
  return buildPaperSimulationInputBundle([], { asOfDate });
}

// ─── Group 1: Governance invariants ──────────────────────────────────────────

describe("Group 1: Governance invariants on diff report", () => {
  let report: SimulationInputEligibilityDiffReport;

  beforeEach(() => {
    const before = defaultBundle(AS_OF_BEFORE);
    const after = defaultBundle(AS_OF_AFTER);
    report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
  });

  test("1.1 paperOnly is true", () => {
    expect(report.paperOnly).toBe(true);
  });

  test("1.2 dryRunOnly is true", () => {
    expect(report.dryRunOnly).toBe(true);
  });

  test("1.3 entersAlphaScore is false", () => {
    expect(report.entersAlphaScore).toBe(false);
  });

  test("1.4 noActualMetrics is true", () => {
    expect(report.noActualMetrics).toBe(true);
  });

  test("1.5 noRealExecution is true", () => {
    expect(report.noRealExecution).toBe(true);
  });

  test("1.6 notInvestmentAdvice is true", () => {
    expect(report.notInvestmentAdvice).toBe(true);
  });
});

// ─── Group 2: Version constant ────────────────────────────────────────────────

describe("Group 2: Version constant", () => {
  test("2.1 SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION contains p53", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION).toContain("p53");
  });

  test("2.2 version contains axis-b", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION).toContain("axis-b");
  });

  test("2.3 version contains v0", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION).toContain("v0");
  });

  test("2.4 report.diffVersion matches constant", () => {
    const report = diffSimulationInputEligibility(
      emptyBundle(AS_OF_BEFORE),
      emptyBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    expect(report.diffVersion).toBe(SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION);
  });
});

// ─── Group 3: Empty bundles ───────────────────────────────────────────────────

describe("Group 3: Empty bundles produce zero-count report", () => {
  let report: SimulationInputEligibilityDiffReport;

  beforeEach(() => {
    report = diffSimulationInputEligibility(
      emptyBundle(AS_OF_BEFORE),
      emptyBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
  });

  test("3.1 addedEligibleSources is empty", () => {
    expect(report.addedEligibleSources).toHaveLength(0);
  });

  test("3.2 removedEligibleSources is empty", () => {
    expect(report.removedEligibleSources).toHaveLength(0);
  });

  test("3.3 unchangedEligibleSources is empty", () => {
    expect(report.unchangedEligibleSources).toHaveLength(0);
  });

  test("3.4 changedEligibilitySources is empty", () => {
    expect(report.changedEligibilitySources).toHaveLength(0);
  });

  test("3.5 blockedSourcesBefore is empty", () => {
    expect(report.blockedSourcesBefore).toHaveLength(0);
  });

  test("3.6 blockedSourcesAfter is empty", () => {
    expect(report.blockedSourcesAfter).toHaveLength(0);
  });

  test("3.7 all counts are 0", () => {
    expect(report.addedEligibleCount).toBe(0);
    expect(report.removedEligibleCount).toBe(0);
    expect(report.unchangedEligibleCount).toBe(0);
    expect(report.changedEligibilityCount).toBe(0);
    expect(report.blockedBeforeCount).toBe(0);
    expect(report.blockedAfterCount).toBe(0);
  });
});

// ─── Group 4: Added eligible sources ─────────────────────────────────────────

describe("Group 4: Added eligible sources (before empty, after has eligible)", () => {
  let report: SimulationInputEligibilityDiffReport;

  beforeEach(() => {
    const before = emptyBundle(AS_OF_BEFORE);
    const after = singleEligibleBundle(AS_OF_AFTER);
    report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
  });

  test("4.1 MonthlyRevenue appears in addedEligibleSources", () => {
    const names = report.addedEligibleSources.map((s) => s.sourceName);
    expect(names).toContain("MonthlyRevenue");
  });

  test("4.2 addedEligibleCount equals addedEligibleSources.length", () => {
    expect(report.addedEligibleCount).toBe(report.addedEligibleSources.length);
  });

  test("4.3 addedEligibleCount is 1", () => {
    expect(report.addedEligibleCount).toBe(1);
  });

  test("4.4 removedEligibleSources is empty", () => {
    expect(report.removedEligibleSources).toHaveLength(0);
  });

  test("4.5 unchangedEligibleSources is empty", () => {
    expect(report.unchangedEligibleSources).toHaveLength(0);
  });

  test("4.6 added entry has governance flags from the after bundle", () => {
    const entry = report.addedEligibleSources[0];
    expect(entry).toBeDefined();
    expect(entry!.paperOnly).toBe(true);
    expect(entry!.entersAlphaScore).toBe(false);
    expect(entry!.dryRunOnly).toBe(true);
    expect(entry!.readinessStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
  });
});

// ─── Group 5: Removed eligible sources ───────────────────────────────────────

describe("Group 5: Removed eligible sources (before has eligible, after loses them)", () => {
  let report: SimulationInputEligibilityDiffReport;

  beforeEach(() => {
    const before = singleEligibleBundle(AS_OF_BEFORE);
    const after = emptyBundle(AS_OF_AFTER);
    report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
  });

  test("5.1 MonthlyRevenue appears in removedEligibleSources", () => {
    const names = report.removedEligibleSources.map((s) => s.sourceName);
    expect(names).toContain("MonthlyRevenue");
  });

  test("5.2 removedEligibleCount equals removedEligibleSources.length", () => {
    expect(report.removedEligibleCount).toBe(report.removedEligibleSources.length);
  });

  test("5.3 removedEligibleCount is 1", () => {
    expect(report.removedEligibleCount).toBe(1);
  });

  test("5.4 addedEligibleSources is empty", () => {
    expect(report.addedEligibleSources).toHaveLength(0);
  });

  test("5.5 unchangedEligibleSources is empty", () => {
    expect(report.unchangedEligibleSources).toHaveLength(0);
  });
});

// ─── Group 6: Unchanged eligible sources ─────────────────────────────────────

describe("Group 6: Unchanged eligible sources (same sources in both bundles)", () => {
  let report: SimulationInputEligibilityDiffReport;

  beforeEach(() => {
    const before = defaultBundle(AS_OF_BEFORE);
    const after = defaultBundle(AS_OF_AFTER);
    report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
  });

  test("6.1 unchangedEligibleCount is 3 (MR, Quote, Regime)", () => {
    expect(report.unchangedEligibleCount).toBe(3);
  });

  test("6.2 unchangedEligibleSources contains MonthlyRevenue", () => {
    const names = report.unchangedEligibleSources.map((s) => s.sourceName);
    expect(names).toContain("MonthlyRevenue");
  });

  test("6.3 unchangedEligibleSources contains Quote", () => {
    const names = report.unchangedEligibleSources.map((s) => s.sourceName);
    expect(names).toContain("Quote");
  });

  test("6.4 unchangedEligibleSources contains Regime", () => {
    const names = report.unchangedEligibleSources.map((s) => s.sourceName);
    expect(names).toContain("Regime");
  });

  test("6.5 addedEligibleSources is empty", () => {
    expect(report.addedEligibleSources).toHaveLength(0);
  });

  test("6.6 removedEligibleSources is empty", () => {
    expect(report.removedEligibleSources).toHaveLength(0);
  });

  test("6.7 unchangedEligibleCount equals unchangedEligibleSources.length", () => {
    expect(report.unchangedEligibleCount).toBe(report.unchangedEligibleSources.length);
  });
});

// ─── Group 7: Changed eligibility sources ────────────────────────────────────

describe("Group 7: Changed eligibility sources (blocked→blocked with different classification)", () => {
  let report: SimulationInputEligibilityDiffReport;

  beforeEach(() => {
    // Before: NewsEvent is BLOCKED_QUALITY_EVIDENCE with reasons A
    const before = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE", ["reason-A"])],
      { asOfDate: AS_OF_BEFORE },
    );
    // After: NewsEvent is BLOCKED_PIT_METADATA with reasons B (different status + reasons)
    const after = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_PIT_METADATA", ["reason-B"])],
      { asOfDate: AS_OF_AFTER },
    );
    report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
  });

  test("7.1 changedEligibilitySources has 1 entry", () => {
    expect(report.changedEligibilitySources).toHaveLength(1);
  });

  test("7.2 changedEligibilityCount equals changedEligibilitySources.length", () => {
    expect(report.changedEligibilityCount).toBe(report.changedEligibilitySources.length);
  });

  test("7.3 changed entry has correct sourceName", () => {
    const entry = report.changedEligibilitySources[0] as EligibilityChangedEntry;
    expect(entry).toBeDefined();
    expect(entry!.sourceName).toBe("NewsEvent");
  });

  test("7.4 changed entry records correct before/after blocked statuses", () => {
    const entry = report.changedEligibilitySources[0] as EligibilityChangedEntry;
    expect(entry!.blockedStatusBefore).toBe("BLOCKED_QUALITY_EVIDENCE");
    expect(entry!.blockedStatusAfter).toBe("BLOCKED_PIT_METADATA");
  });

  test("7.5 changed entry records correct before/after blocking reasons", () => {
    const entry = report.changedEligibilitySources[0] as EligibilityChangedEntry;
    expect(entry!.blockingReasonsBefore).toContain("reason-A");
    expect(entry!.blockingReasonsAfter).toContain("reason-B");
  });

  test("7.6 changed entry has governance flags", () => {
    const entry = report.changedEligibilitySources[0] as EligibilityChangedEntry;
    expect(entry!.entersAlphaScore).toBe(false);
    expect(entry!.paperOnly).toBe(true);
  });
});

// ─── Group 8: No changedEligibilitySources when blocking is identical ─────────

describe("Group 8: No changedEligibilitySources when blocked classification is identical", () => {
  test("8.1 same blocked status and reasons → changedEligibilitySources empty", () => {
    const before = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE", ["reason-A"])],
      { asOfDate: AS_OF_BEFORE },
    );
    const after = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE", ["reason-A"])],
      { asOfDate: AS_OF_AFTER },
    );
    const report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    expect(report.changedEligibilitySources).toHaveLength(0);
    expect(report.changedEligibilityCount).toBe(0);
  });

  test("8.2 same status different reasons → changedEligibilitySources has entry", () => {
    const before = buildPaperSimulationInputBundle(
      [makeBlockedEntry("FinancialReport", "BLOCKED_PIT_METADATA", ["old reason"])],
      { asOfDate: AS_OF_BEFORE },
    );
    const after = buildPaperSimulationInputBundle(
      [makeBlockedEntry("FinancialReport", "BLOCKED_PIT_METADATA", ["new reason"])],
      { asOfDate: AS_OF_AFTER },
    );
    const report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    expect(report.changedEligibilitySources).toHaveLength(1);
  });
});

// ─── Group 9: Blocked source verbatim copies ──────────────────────────────────

describe("Group 9: blockedSourcesBefore and blockedSourcesAfter are verbatim copies", () => {
  test("9.1 default bundle: blockedBeforeCount is 3", () => {
    const bundle = defaultBundle(AS_OF_BEFORE);
    const report = diffSimulationInputEligibility(bundle, bundle, FIXED_DIFFED_AT);
    expect(report.blockedBeforeCount).toBe(3);
    expect(report.blockedBeforeCount).toBe(bundle.blockedSources.length);
  });

  test("9.2 default bundle: blockedAfterCount is 3", () => {
    const bundle = defaultBundle(AS_OF_AFTER);
    const report = diffSimulationInputEligibility(bundle, bundle, FIXED_DIFFED_AT);
    expect(report.blockedAfterCount).toBe(3);
    expect(report.blockedAfterCount).toBe(bundle.blockedSources.length);
  });

  test("9.3 blockedSourcesBefore preserves before.blockedSources sourceNames", () => {
    const before = defaultBundle(AS_OF_BEFORE);
    const after = defaultBundle(AS_OF_AFTER);
    const report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const beforeNames = report.blockedSourcesBefore.map((s) => s.sourceName).sort();
    const expectedNames = before.blockedSources.map((s) => s.sourceName).sort();
    expect(beforeNames).toEqual(expectedNames);
  });

  test("9.4 blockedSourcesAfter preserves after.blockedSources sourceNames", () => {
    const before = defaultBundle(AS_OF_BEFORE);
    const after = defaultBundle(AS_OF_AFTER);
    const report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const afterNames = report.blockedSourcesAfter.map((s) => s.sourceName).sort();
    const expectedNames = after.blockedSources.map((s) => s.sourceName).sort();
    expect(afterNames).toEqual(expectedNames);
  });

  test("9.5 blockedBeforeCount equals blockedSourcesBefore.length", () => {
    const report = diffSimulationInputEligibility(
      defaultBundle(AS_OF_BEFORE),
      defaultBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    expect(report.blockedBeforeCount).toBe(report.blockedSourcesBefore.length);
  });

  test("9.6 blockedAfterCount equals blockedSourcesAfter.length", () => {
    const report = diffSimulationInputEligibility(
      defaultBundle(AS_OF_BEFORE),
      defaultBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    expect(report.blockedAfterCount).toBe(report.blockedSourcesAfter.length);
  });
});

// ─── Group 10: Determinism ────────────────────────────────────────────────────

describe("Group 10: Determinism with fixedDiffedAt", () => {
  test("10.1 fixedDiffedAt is used when provided", () => {
    const report = diffSimulationInputEligibility(
      defaultBundle(AS_OF_BEFORE),
      defaultBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    expect(report.diffedAt).toBe(FIXED_DIFFED_AT);
  });

  test("10.2 two calls with same fixedDiffedAt produce identical diffedAt", () => {
    const before = defaultBundle(AS_OF_BEFORE);
    const after = defaultBundle(AS_OF_AFTER);
    const r1 = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const r2 = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    expect(r1.diffedAt).toBe(r2.diffedAt);
  });

  test("10.3 without fixedDiffedAt, diffedAt is a valid ISO string", () => {
    const report = diffSimulationInputEligibility(
      defaultBundle(AS_OF_BEFORE),
      defaultBundle(AS_OF_AFTER),
    );
    expect(() => new Date(report.diffedAt)).not.toThrow();
    expect(new Date(report.diffedAt).toISOString()).toBe(report.diffedAt);
  });

  test("10.4 two calls with same inputs and fixedDiffedAt produce same counts", () => {
    const before = defaultBundle(AS_OF_BEFORE);
    const after = defaultBundle(AS_OF_AFTER);
    const r1 = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const r2 = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    expect(r1.addedEligibleCount).toBe(r2.addedEligibleCount);
    expect(r1.removedEligibleCount).toBe(r2.removedEligibleCount);
    expect(r1.unchangedEligibleCount).toBe(r2.unchangedEligibleCount);
    expect(r1.changedEligibilityCount).toBe(r2.changedEligibilityCount);
  });
});

// ─── Group 11: Non-mutation ───────────────────────────────────────────────────

describe("Group 11: Input bundles are not mutated", () => {
  test("11.1 before.eligibleSources is not mutated", () => {
    const before = defaultBundle(AS_OF_BEFORE);
    const after = defaultBundle(AS_OF_AFTER);
    const originalLength = before.eligibleSources.length;
    diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    expect(before.eligibleSources).toHaveLength(originalLength);
  });

  test("11.2 after.eligibleSources is not mutated", () => {
    const before = defaultBundle(AS_OF_BEFORE);
    const after = defaultBundle(AS_OF_AFTER);
    const originalLength = after.eligibleSources.length;
    diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    expect(after.eligibleSources).toHaveLength(originalLength);
  });

  test("11.3 before.blockedSources is not mutated", () => {
    const before = defaultBundle(AS_OF_BEFORE);
    const after = defaultBundle(AS_OF_AFTER);
    const originalLength = before.blockedSources.length;
    diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    expect(before.blockedSources).toHaveLength(originalLength);
  });

  test("11.4 after.blockedSources is not mutated", () => {
    const before = defaultBundle(AS_OF_BEFORE);
    const after = defaultBundle(AS_OF_AFTER);
    const originalLength = after.blockedSources.length;
    diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    expect(after.blockedSources).toHaveLength(originalLength);
  });
});

// ─── Group 12: Order preservation ────────────────────────────────────────────

describe("Group 12: Order preservation", () => {
  test("12.1 addedEligibleSources preserves after.eligibleSources order", () => {
    const after = buildPaperSimulationInputBundle(
      [
        makeEligibleEntry("MonthlyRevenue"),
        makeEligibleEntry("Quote"),
        makeEligibleEntry("Regime"),
      ],
      { asOfDate: AS_OF_AFTER },
    );
    const report = diffSimulationInputEligibility(
      emptyBundle(AS_OF_BEFORE),
      after,
      FIXED_DIFFED_AT,
    );
    const names = report.addedEligibleSources.map((s) => s.sourceName);
    expect(names).toEqual(["MonthlyRevenue", "Quote", "Regime"]);
  });

  test("12.2 removedEligibleSources preserves before.eligibleSources order", () => {
    const before = buildPaperSimulationInputBundle(
      [
        makeEligibleEntry("MonthlyRevenue"),
        makeEligibleEntry("Quote"),
        makeEligibleEntry("Regime"),
      ],
      { asOfDate: AS_OF_BEFORE },
    );
    const report = diffSimulationInputEligibility(
      before,
      emptyBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    const names = report.removedEligibleSources.map((s) => s.sourceName);
    expect(names).toEqual(["MonthlyRevenue", "Quote", "Regime"]);
  });

  test("12.3 unchangedEligibleSources preserves after.eligibleSources order", () => {
    const before = buildPaperSimulationInputBundle(
      [
        makeEligibleEntry("MonthlyRevenue"),
        makeEligibleEntry("Quote"),
        makeEligibleEntry("Regime"),
      ],
      { asOfDate: AS_OF_BEFORE },
    );
    const after = buildPaperSimulationInputBundle(
      [
        makeEligibleEntry("MonthlyRevenue"),
        makeEligibleEntry("Quote"),
        makeEligibleEntry("Regime"),
      ],
      { asOfDate: AS_OF_AFTER },
    );
    const report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const names = report.unchangedEligibleSources.map((s) => s.sourceName);
    expect(names).toEqual(["MonthlyRevenue", "Quote", "Regime"]);
  });
});

// ─── Group 13: Count accuracy ─────────────────────────────────────────────────

describe("Group 13: Count accuracy", () => {
  test("13.1 addedEligibleCount always equals addedEligibleSources.length", () => {
    const report = diffSimulationInputEligibility(
      emptyBundle(AS_OF_BEFORE),
      singleEligibleBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    expect(report.addedEligibleCount).toBe(report.addedEligibleSources.length);
  });

  test("13.2 removedEligibleCount always equals removedEligibleSources.length", () => {
    const report = diffSimulationInputEligibility(
      singleEligibleBundle(AS_OF_BEFORE),
      emptyBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    expect(report.removedEligibleCount).toBe(report.removedEligibleSources.length);
  });

  test("13.3 unchangedEligibleCount always equals unchangedEligibleSources.length", () => {
    const report = diffSimulationInputEligibility(
      defaultBundle(AS_OF_BEFORE),
      defaultBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    expect(report.unchangedEligibleCount).toBe(report.unchangedEligibleSources.length);
  });

  test("13.4 changedEligibilityCount always equals changedEligibilitySources.length", () => {
    const before = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE", ["A"])],
      { asOfDate: AS_OF_BEFORE },
    );
    const after = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_PIT_METADATA", ["B"])],
      { asOfDate: AS_OF_AFTER },
    );
    const report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    expect(report.changedEligibilityCount).toBe(report.changedEligibilitySources.length);
  });

  test("13.5 blockedBeforeCount always equals blockedSourcesBefore.length", () => {
    const report = diffSimulationInputEligibility(
      defaultBundle(AS_OF_BEFORE),
      defaultBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    expect(report.blockedBeforeCount).toBe(report.blockedSourcesBefore.length);
  });

  test("13.6 blockedAfterCount always equals blockedSourcesAfter.length", () => {
    const report = diffSimulationInputEligibility(
      defaultBundle(AS_OF_BEFORE),
      defaultBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    expect(report.blockedAfterCount).toBe(report.blockedSourcesAfter.length);
  });
});

// ─── Group 14: JSON serializability ──────────────────────────────────────────

describe("Group 14: JSON serializability", () => {
  test("14.1 report is JSON-serializable without loss", () => {
    const report = diffSimulationInputEligibility(
      defaultBundle(AS_OF_BEFORE),
      defaultBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    expect(() => JSON.stringify(report)).not.toThrow();
  });

  test("14.2 round-trip preserves diffVersion", () => {
    const report = diffSimulationInputEligibility(
      defaultBundle(AS_OF_BEFORE),
      defaultBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    const parsed = JSON.parse(JSON.stringify(report)) as SimulationInputEligibilityDiffReport;
    expect(parsed.diffVersion).toBe(SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION);
  });

  test("14.3 round-trip preserves governance flags", () => {
    const report = diffSimulationInputEligibility(
      defaultBundle(AS_OF_BEFORE),
      defaultBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    const parsed = JSON.parse(JSON.stringify(report)) as SimulationInputEligibilityDiffReport;
    expect(parsed.paperOnly).toBe(true);
    expect(parsed.entersAlphaScore).toBe(false);
    expect(parsed.dryRunOnly).toBe(true);
    expect(parsed.notInvestmentAdvice).toBe(true);
  });

  test("14.4 round-trip preserves counts", () => {
    const report = diffSimulationInputEligibility(
      defaultBundle(AS_OF_BEFORE),
      defaultBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    const parsed = JSON.parse(JSON.stringify(report)) as SimulationInputEligibilityDiffReport;
    expect(parsed.unchangedEligibleCount).toBe(report.unchangedEligibleCount);
    expect(parsed.blockedBeforeCount).toBe(report.blockedBeforeCount);
  });
});

// ─── Group 15: Forbidden field scan ──────────────────────────────────────────

describe("Group 15: Forbidden field scan", () => {
  test("15.1 SIMULATION_INPUT_ELIGIBILITY_DIFF_FORBIDDEN_FIELDS is non-empty", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_DIFF_FORBIDDEN_FIELDS.length).toBeGreaterThan(0);
  });

  test("15.2 forbidden fields include alphaScore", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_DIFF_FORBIDDEN_FIELDS).toContain("alphaScore");
  });

  test("15.3 forbidden fields include recommendation", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_DIFF_FORBIDDEN_FIELDS).toContain("recommendation");
  });

  test("15.4 forbidden fields include winRate", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_DIFF_FORBIDDEN_FIELDS).toContain("winRate");
  });

  test("15.5 report JSON does not contain any forbidden field as a key", () => {
    const report = diffSimulationInputEligibility(
      defaultBundle(AS_OF_BEFORE),
      defaultBundle(AS_OF_AFTER),
      FIXED_DIFFED_AT,
    );
    const json = JSON.stringify(report);
    for (const field of SIMULATION_INPUT_ELIGIBILITY_DIFF_FORBIDDEN_FIELDS) {
      // Check that the field does not appear as a JSON key
      // (We match `"<field>":` to avoid false positives in string values)
      expect(json).not.toMatch(new RegExp(`"${field}"\\s*:`));
    }
  });

  test("15.6 changedEligibilitySources entries do not contain forbidden fields", () => {
    const before = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE", ["A"])],
      { asOfDate: AS_OF_BEFORE },
    );
    const after = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_PIT_METADATA", ["B"])],
      { asOfDate: AS_OF_AFTER },
    );
    const report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    for (const entry of report.changedEligibilitySources) {
      const json = JSON.stringify(entry);
      for (const field of SIMULATION_INPUT_ELIGIBILITY_DIFF_FORBIDDEN_FIELDS) {
        expect(json).not.toMatch(new RegExp(`"${field}"\\s*:`));
      }
    }
  });
});

// ─── Group 16: Mixed scenario ─────────────────────────────────────────────────

describe("Group 16: Mixed scenario — partial eligibility change", () => {
  let report: SimulationInputEligibilityDiffReport;

  beforeEach(() => {
    // Before: MR eligible, Quote+Regime blocked
    const before = buildPaperSimulationInputBundle(
      [
        makeEligibleEntry("MonthlyRevenue"),
        makeBlockedEntry("Quote", "BLOCKED_LAG_EVIDENCE", ["lag missing"]),
        makeBlockedEntry("Regime", "BLOCKED_AUTHORIZATION", ["auth missing"]),
      ],
      { asOfDate: AS_OF_BEFORE },
    );
    // After: MR+Quote eligible, Regime still blocked with different reasons
    const after = buildPaperSimulationInputBundle(
      [
        makeEligibleEntry("MonthlyRevenue"),
        makeEligibleEntry("Quote"),
        makeBlockedEntry("Regime", "BLOCKED_AUTHORIZATION", ["auth missing — updated"]),
      ],
      { asOfDate: AS_OF_AFTER },
    );
    report = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
  });

  test("16.1 addedEligibleSources contains Quote", () => {
    const names = report.addedEligibleSources.map((s) => s.sourceName);
    expect(names).toContain("Quote");
  });

  test("16.2 addedEligibleCount is 1", () => {
    expect(report.addedEligibleCount).toBe(1);
  });

  test("16.3 unchangedEligibleSources contains MonthlyRevenue", () => {
    const names = report.unchangedEligibleSources.map((s) => s.sourceName);
    expect(names).toContain("MonthlyRevenue");
  });

  test("16.4 unchangedEligibleCount is 1", () => {
    expect(report.unchangedEligibleCount).toBe(1);
  });

  test("16.5 removedEligibleSources is empty", () => {
    expect(report.removedEligibleSources).toHaveLength(0);
  });

  test("16.6 changedEligibilitySources contains Regime", () => {
    const names = report.changedEligibilitySources.map((e) => e.sourceName);
    expect(names).toContain("Regime");
  });

  test("16.7 changedEligibilityCount is 1", () => {
    expect(report.changedEligibilityCount).toBe(1);
  });

  test("16.8 Regime changedEligibilitySources entry records correct reasons", () => {
    const entry = report.changedEligibilitySources.find(
      (e) => e.sourceName === "Regime",
    );
    expect(entry).toBeDefined();
    expect(entry!.blockingReasonsBefore).toContain("auth missing");
    expect(entry!.blockingReasonsAfter).toContain("auth missing — updated");
  });

  test("16.9 blockedBeforeCount is 2", () => {
    expect(report.blockedBeforeCount).toBe(2);
  });

  test("16.10 blockedAfterCount is 1", () => {
    expect(report.blockedAfterCount).toBe(1);
  });

  test("16.11 governance flags on report remain correct", () => {
    expect(report.paperOnly).toBe(true);
    expect(report.entersAlphaScore).toBe(false);
    expect(report.dryRunOnly).toBe(true);
    expect(report.noActualMetrics).toBe(true);
    expect(report.noRealExecution).toBe(true);
    expect(report.notInvestmentAdvice).toBe(true);
  });
});
