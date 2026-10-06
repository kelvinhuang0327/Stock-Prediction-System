/**
 * P54 — Axis B Simulation Input Eligibility Diff Report Builder Tests
 *
 * Tests for buildEligibilityDiffAuditArtifact() covering:
 *   - Governance invariants (paperOnly, dryRunOnly, entersAlphaScore, etc.)
 *   - Version constant shape and content
 *   - Summary counts mirror the underlying diff counts
 *   - Source name arrays match diff arrays in order
 *   - Changed eligibility entries shape and content
 *   - Disclaimer static text
 *   - Determinism (fixedGeneratedAt; two calls same result)
 *   - Live generatedAt is valid ISO timestamp
 *   - Non-mutation of input diff report
 *   - JSON serializability
 *   - Forbidden field scan
 *   - Empty diff → all arrays empty, all counts 0
 *   - Mixed scenario: added, removed, unchanged, changed all populated
 *
 * DISCLAIMER: Structural builder tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRunOnly = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 */

import {
  DIFF_REPORT_BUILDER_VERSION,
  DIFF_REPORT_BUILDER_FORBIDDEN_FIELDS,
  buildEligibilityDiffAuditArtifact,
  type EligibilityDiffAuditArtifact,
} from "../p54/SimulationInputEligibilityDiffReportBuilder";

import {
  SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION,
  diffSimulationInputEligibility,
} from "../p53/SimulationInputEligibilityDiff";

import {
  buildDefaultPaperSimulationInputBundle,
  buildPaperSimulationInputBundle,
} from "../p39/PaperSimulationInputContractBuilder";

import type { SimulationInputReadinessEntry } from "../p38/SimulationInputReadinessTypes";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIXED_GENERATED_AT = "2026-05-26T12:00:00.000Z";
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

/** Default diff: MR/Quote/Regime eligible; NE/FR/Chip blocked */
function defaultDiff() {
  return diffSimulationInputEligibility(
    buildDefaultPaperSimulationInputBundle({ asOfDate: AS_OF_BEFORE }),
    buildDefaultPaperSimulationInputBundle({ asOfDate: AS_OF_AFTER }),
    FIXED_DIFFED_AT,
  );
}

/** Empty diff: no sources in before or after */
function emptyDiff() {
  return diffSimulationInputEligibility(
    buildPaperSimulationInputBundle([], { asOfDate: AS_OF_BEFORE }),
    buildPaperSimulationInputBundle([], { asOfDate: AS_OF_AFTER }),
    FIXED_DIFFED_AT,
  );
}

/** Parse a pre-serialized JSON string back to a typed value. */
function fromJsonString<T>(s: string): T {
  return JSON.parse(s) as T;
}

// ─── Group 1: Governance invariants ──────────────────────────────────────────

describe("Group 1: Governance invariants", () => {
  let artifact: EligibilityDiffAuditArtifact;

  beforeEach(() => {
    artifact = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
  });

  test("1.1 paperOnly is true", () => {
    expect(artifact.paperOnly).toBe(true);
  });

  test("1.2 dryRunOnly is true", () => {
    expect(artifact.dryRunOnly).toBe(true);
  });

  test("1.3 entersAlphaScore is false", () => {
    expect(artifact.entersAlphaScore).toBe(false);
  });

  test("1.4 noActualMetrics is true", () => {
    expect(artifact.noActualMetrics).toBe(true);
  });

  test("1.5 noRealExecution is true", () => {
    expect(artifact.noRealExecution).toBe(true);
  });

  test("1.6 notInvestmentAdvice is true", () => {
    expect(artifact.notInvestmentAdvice).toBe(true);
  });
});

// ─── Group 2: Version constant ────────────────────────────────────────────────

describe("Group 2: Version constant", () => {
  test("2.1 DIFF_REPORT_BUILDER_VERSION contains p54", () => {
    expect(DIFF_REPORT_BUILDER_VERSION).toContain("p54");
  });

  test("2.2 DIFF_REPORT_BUILDER_VERSION contains axis-b", () => {
    expect(DIFF_REPORT_BUILDER_VERSION).toContain("axis-b");
  });

  test("2.3 DIFF_REPORT_BUILDER_VERSION contains v0", () => {
    expect(DIFF_REPORT_BUILDER_VERSION).toContain("v0");
  });

  test("2.4 artifact.artifactVersion matches DIFF_REPORT_BUILDER_VERSION", () => {
    const artifact = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    expect(artifact.artifactVersion).toBe(DIFF_REPORT_BUILDER_VERSION);
  });
});

// ─── Group 3: Passthrough of diff metadata ────────────────────────────────────

describe("Group 3: Diff metadata passthrough", () => {
  let artifact: EligibilityDiffAuditArtifact;

  beforeEach(() => {
    artifact = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
  });

  test("3.1 artifact.diffVersion equals SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION", () => {
    expect(artifact.diffVersion).toBe(SIMULATION_INPUT_ELIGIBILITY_DIFF_VERSION);
  });

  test("3.2 artifact.diffedAt equals FIXED_DIFFED_AT used in the diff", () => {
    expect(artifact.diffedAt).toBe(FIXED_DIFFED_AT);
  });

  test("3.3 artifact.generatedAt equals fixedGeneratedAt", () => {
    expect(artifact.generatedAt).toBe(FIXED_GENERATED_AT);
  });
});

// ─── Group 4: Empty diff → all zeros ─────────────────────────────────────────

describe("Group 4: Empty diff → all counts 0 and all arrays empty", () => {
  let artifact: EligibilityDiffAuditArtifact;

  beforeEach(() => {
    artifact = buildEligibilityDiffAuditArtifact(emptyDiff(), FIXED_GENERATED_AT);
  });

  test("4.1 summary.addedEligibleCount is 0", () => {
    expect(artifact.summary.addedEligibleCount).toBe(0);
  });

  test("4.2 summary.removedEligibleCount is 0", () => {
    expect(artifact.summary.removedEligibleCount).toBe(0);
  });

  test("4.3 summary.unchangedEligibleCount is 0", () => {
    expect(artifact.summary.unchangedEligibleCount).toBe(0);
  });

  test("4.4 summary.changedEligibilityCount is 0", () => {
    expect(artifact.summary.changedEligibilityCount).toBe(0);
  });

  test("4.5 addedEligibleSourceNames is empty", () => {
    expect(artifact.addedEligibleSourceNames).toHaveLength(0);
  });

  test("4.6 removedEligibleSourceNames is empty", () => {
    expect(artifact.removedEligibleSourceNames).toHaveLength(0);
  });

  test("4.7 unchangedEligibleSourceNames is empty", () => {
    expect(artifact.unchangedEligibleSourceNames).toHaveLength(0);
  });

  test("4.8 changedEligibilityEntries is empty", () => {
    expect(artifact.changedEligibilityEntries).toHaveLength(0);
  });
});

// ─── Group 5: Summary counts mirror diff counts ───────────────────────────────

describe("Group 5: Summary counts mirror diff counts", () => {
  test("5.1 summary.addedEligibleCount equals diff.addedEligibleCount", () => {
    const diff = defaultDiff();
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(artifact.summary.addedEligibleCount).toBe(diff.addedEligibleCount);
  });

  test("5.2 summary.removedEligibleCount equals diff.removedEligibleCount", () => {
    const diff = defaultDiff();
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(artifact.summary.removedEligibleCount).toBe(diff.removedEligibleCount);
  });

  test("5.3 summary.unchangedEligibleCount equals diff.unchangedEligibleCount", () => {
    const diff = defaultDiff();
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(artifact.summary.unchangedEligibleCount).toBe(diff.unchangedEligibleCount);
  });

  test("5.4 summary.changedEligibilityCount equals diff.changedEligibilityCount", () => {
    const diff = defaultDiff();
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(artifact.summary.changedEligibilityCount).toBe(diff.changedEligibilityCount);
  });

  test("5.5 summary.blockedBeforeCount equals diff.blockedBeforeCount", () => {
    const diff = defaultDiff();
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(artifact.summary.blockedBeforeCount).toBe(diff.blockedBeforeCount);
  });

  test("5.6 summary.blockedAfterCount equals diff.blockedAfterCount", () => {
    const diff = defaultDiff();
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(artifact.summary.blockedAfterCount).toBe(diff.blockedAfterCount);
  });
});

// ─── Group 6: Source name arrays ─────────────────────────────────────────────

describe("Group 6: Source name arrays match diff arrays in order", () => {
  test("6.1 addedEligibleSourceNames matches added source names in order", () => {
    const before = buildPaperSimulationInputBundle([], { asOfDate: AS_OF_BEFORE });
    const after = buildPaperSimulationInputBundle(
      [makeEligibleEntry("MonthlyRevenue"), makeEligibleEntry("Quote")],
      { asOfDate: AS_OF_AFTER },
    );
    const diff = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(artifact.addedEligibleSourceNames).toEqual(["MonthlyRevenue", "Quote"]);
  });

  test("6.2 removedEligibleSourceNames matches removed source names in order", () => {
    const before = buildPaperSimulationInputBundle(
      [makeEligibleEntry("MonthlyRevenue"), makeEligibleEntry("Quote")],
      { asOfDate: AS_OF_BEFORE },
    );
    const after = buildPaperSimulationInputBundle([], { asOfDate: AS_OF_AFTER });
    const diff = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(artifact.removedEligibleSourceNames).toEqual(["MonthlyRevenue", "Quote"]);
  });

  test("6.3 unchangedEligibleSourceNames matches unchanged source names in order", () => {
    const diff = defaultDiff();
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    const expected = diff.unchangedEligibleSources.map((s) => s.sourceName);
    expect(artifact.unchangedEligibleSourceNames).toEqual(expected);
  });

  test("6.4 default bundle → unchangedEligibleSourceNames has 3 entries", () => {
    const artifact = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    expect(artifact.unchangedEligibleSourceNames).toHaveLength(3);
  });
});

// ─── Group 7: Changed eligibility entries ────────────────────────────────────

describe("Group 7: Changed eligibility entries shape and content", () => {
  test("7.1 changedEligibilityEntries has correct length for changed diff", () => {
    const before = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE", ["r1"])],
      { asOfDate: AS_OF_BEFORE },
    );
    const after = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_PIT_METADATA", ["r2"])],
      { asOfDate: AS_OF_AFTER },
    );
    const diff = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(artifact.changedEligibilityEntries).toHaveLength(1);
  });

  test("7.2 changedEligibilityEntries[0].sourceName is correct", () => {
    const before = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE", ["r1"])],
      { asOfDate: AS_OF_BEFORE },
    );
    const after = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_PIT_METADATA", ["r2"])],
      { asOfDate: AS_OF_AFTER },
    );
    const diff = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(artifact.changedEligibilityEntries[0]?.sourceName).toBe("NewsEvent");
  });

  test("7.3 changedEligibilityEntries[0].blockedStatusBefore is correct", () => {
    const before = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE", ["r1"])],
      { asOfDate: AS_OF_BEFORE },
    );
    const after = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_PIT_METADATA", ["r2"])],
      { asOfDate: AS_OF_AFTER },
    );
    const diff = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(artifact.changedEligibilityEntries[0]?.blockedStatusBefore).toBe(
      "BLOCKED_QUALITY_EVIDENCE",
    );
  });

  test("7.4 changedEligibilityEntries[0].blockedStatusAfter is correct", () => {
    const before = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE", ["r1"])],
      { asOfDate: AS_OF_BEFORE },
    );
    const after = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_PIT_METADATA", ["r2"])],
      { asOfDate: AS_OF_AFTER },
    );
    const diff = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(artifact.changedEligibilityEntries[0]?.blockedStatusAfter).toBe(
      "BLOCKED_PIT_METADATA",
    );
  });

  test("7.5 changedEligibilityEntries entry does NOT expose blockingReasons arrays", () => {
    const before = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE", ["r1"])],
      { asOfDate: AS_OF_BEFORE },
    );
    const after = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_PIT_METADATA", ["r2"])],
      { asOfDate: AS_OF_AFTER },
    );
    const diff = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    const entry = artifact.changedEligibilityEntries[0];
    // EligibilityDiffAuditArtifact changedEligibilityEntries only expose 3 fields
    expect(Object.keys(entry ?? {})).toEqual([
      "sourceName",
      "blockedStatusBefore",
      "blockedStatusAfter",
    ]);
  });
});

// ─── Group 8: Disclaimer ──────────────────────────────────────────────────────

describe("Group 8: Disclaimer", () => {
  test("8.1 disclaimer is a non-empty string", () => {
    const artifact = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    expect(typeof artifact.disclaimer).toBe("string");
    expect(artifact.disclaimer.length).toBeGreaterThan(0);
  });

  test("8.2 disclaimer mentions entersAlphaScore=false", () => {
    const artifact = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    expect(artifact.disclaimer).toContain("entersAlphaScore=false");
  });

  test("8.3 disclaimer mentions Not investment advice", () => {
    const artifact = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    expect(artifact.disclaimer.toLowerCase()).toContain("not investment advice");
  });

  test("8.4 disclaimer is identical across two calls (static text)", () => {
    const a = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    const b = buildEligibilityDiffAuditArtifact(emptyDiff(), FIXED_GENERATED_AT);
    expect(a.disclaimer).toBe(b.disclaimer);
  });
});

// ─── Group 9: Determinism ────────────────────────────────────────────────────

describe("Group 9: Determinism and generatedAt", () => {
  test("9.1 same fixedGeneratedAt → same artifact.generatedAt", () => {
    const a = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    const b = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    expect(a.generatedAt).toBe(b.generatedAt);
  });

  test("9.2 two calls with same inputs and fixedGeneratedAt produce equal artifacts", () => {
    const diff = defaultDiff();
    const a = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    const b = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("9.3 live generatedAt (no fixedGeneratedAt) is valid ISO 8601", () => {
    const artifact = buildEligibilityDiffAuditArtifact(defaultDiff());
    expect(() => new Date(artifact.generatedAt)).not.toThrow();
    expect(new Date(artifact.generatedAt).toISOString()).toBe(artifact.generatedAt);
  });
});

// ─── Group 10: Non-mutation ───────────────────────────────────────────────────

describe("Group 10: Non-mutation of input diff report", () => {
  test("10.1 input diff report is not mutated after build", () => {
    const diff = defaultDiff();
    const diffBefore = JSON.stringify(diff);
    buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(JSON.stringify(diff)).toBe(diffBefore);
  });

  test("10.2 two sequential builds from same diff produce equal artifacts", () => {
    const diff = defaultDiff();
    const a = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    const b = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ─── Group 11: JSON serializability ──────────────────────────────────────────

describe("Group 11: JSON serializability", () => {
  test("11.1 artifact is JSON-serializable without throw", () => {
    const artifact = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    expect(() => JSON.stringify(artifact)).not.toThrow();
  });

  test("11.2 round-trip preserves artifactVersion", () => {
    const artifact = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    const parsed = fromJsonString<EligibilityDiffAuditArtifact>(JSON.stringify(artifact));
    expect(parsed.artifactVersion).toBe(DIFF_REPORT_BUILDER_VERSION);
  });

  test("11.3 round-trip preserves governance flags", () => {
    const artifact = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    const parsed = fromJsonString<EligibilityDiffAuditArtifact>(JSON.stringify(artifact));
    expect(parsed.paperOnly).toBe(true);
    expect(parsed.entersAlphaScore).toBe(false);
    expect(parsed.dryRunOnly).toBe(true);
    expect(parsed.notInvestmentAdvice).toBe(true);
  });

  test("11.4 round-trip preserves summary counts", () => {
    const artifact = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    const parsed = fromJsonString<EligibilityDiffAuditArtifact>(JSON.stringify(artifact));
    expect(parsed.summary.unchangedEligibleCount).toBe(artifact.summary.unchangedEligibleCount);
    expect(parsed.summary.blockedBeforeCount).toBe(artifact.summary.blockedBeforeCount);
  });
});

// ─── Group 12: Forbidden field scan ──────────────────────────────────────────

describe("Group 12: Forbidden field scan", () => {
  test("12.1 DIFF_REPORT_BUILDER_FORBIDDEN_FIELDS is non-empty", () => {
    expect(DIFF_REPORT_BUILDER_FORBIDDEN_FIELDS.length).toBeGreaterThan(0);
  });

  test("12.2 forbidden fields include alphaScore", () => {
    expect(DIFF_REPORT_BUILDER_FORBIDDEN_FIELDS).toContain("alphaScore");
  });

  test("12.3 forbidden fields include recommendation", () => {
    expect(DIFF_REPORT_BUILDER_FORBIDDEN_FIELDS).toContain("recommendation");
  });

  test("12.4 forbidden fields include winRate", () => {
    expect(DIFF_REPORT_BUILDER_FORBIDDEN_FIELDS).toContain("winRate");
  });

  test("12.5 artifact JSON does not contain any forbidden field as a key", () => {
    const artifact = buildEligibilityDiffAuditArtifact(defaultDiff(), FIXED_GENERATED_AT);
    const json = JSON.stringify(artifact);
    for (const field of DIFF_REPORT_BUILDER_FORBIDDEN_FIELDS) {
      expect(json).not.toMatch(new RegExp(String.raw`"${field}"\s*:`));
    }
  });

  test("12.6 changedEligibilityEntries JSON does not contain forbidden fields", () => {
    const before = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE", ["A"])],
      { asOfDate: AS_OF_BEFORE },
    );
    const after = buildPaperSimulationInputBundle(
      [makeBlockedEntry("NewsEvent", "BLOCKED_PIT_METADATA", ["B"])],
      { asOfDate: AS_OF_AFTER },
    );
    const diff = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    const artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
    for (const entry of artifact.changedEligibilityEntries) {
      const json = JSON.stringify(entry);
      for (const field of DIFF_REPORT_BUILDER_FORBIDDEN_FIELDS) {
        expect(json).not.toMatch(new RegExp(String.raw`"${field}"\s*:`));
      }
    }
  });
});

// ─── Group 13: Mixed scenario ─────────────────────────────────────────────────

describe("Group 13: Mixed scenario — partial eligibility change", () => {
  let artifact: EligibilityDiffAuditArtifact;

  beforeEach(() => {
    // Before: MR eligible, Quote blocked(AUTHORIZATION), Regime blocked(QUALITY)
    const before = buildPaperSimulationInputBundle(
      [
        makeEligibleEntry("MonthlyRevenue"),
        makeBlockedEntry("Quote", "BLOCKED_AUTHORIZATION", ["auth-missing"]),
        makeBlockedEntry("Regime", "BLOCKED_QUALITY_EVIDENCE", ["quality-low"]),
      ],
      { asOfDate: AS_OF_BEFORE },
    );
    // After: MR + Quote eligible (Quote gained eligibility), Regime blocked(PIT) (changed)
    const after = buildPaperSimulationInputBundle(
      [
        makeEligibleEntry("MonthlyRevenue"),
        makeEligibleEntry("Quote"),
        makeBlockedEntry("Regime", "BLOCKED_PIT_METADATA", ["pit-missing"]),
      ],
      { asOfDate: AS_OF_AFTER },
    );
    const diff = diffSimulationInputEligibility(before, after, FIXED_DIFFED_AT);
    artifact = buildEligibilityDiffAuditArtifact(diff, FIXED_GENERATED_AT);
  });

  test("13.1 addedEligibleSourceNames contains Quote", () => {
    expect(artifact.addedEligibleSourceNames).toContain("Quote");
  });

  test("13.2 summary.addedEligibleCount is 1", () => {
    expect(artifact.summary.addedEligibleCount).toBe(1);
  });

  test("13.3 unchangedEligibleSourceNames contains MonthlyRevenue", () => {
    expect(artifact.unchangedEligibleSourceNames).toContain("MonthlyRevenue");
  });

  test("13.4 summary.unchangedEligibleCount is 1", () => {
    expect(artifact.summary.unchangedEligibleCount).toBe(1);
  });

  test("13.5 changedEligibilityEntries contains Regime", () => {
    const names = artifact.changedEligibilityEntries.map((e) => e.sourceName);
    expect(names).toContain("Regime");
  });

  test("13.6 changedEligibilityEntries Regime has correct status transition", () => {
    const entry = artifact.changedEligibilityEntries.find(
      (e) => e.sourceName === "Regime",
    );
    expect(entry?.blockedStatusBefore).toBe("BLOCKED_QUALITY_EVIDENCE");
    expect(entry?.blockedStatusAfter).toBe("BLOCKED_PIT_METADATA");
  });

  test("13.7 summary.removedEligibleCount is 0", () => {
    expect(artifact.summary.removedEligibleCount).toBe(0);
  });

  test("13.8 removedEligibleSourceNames is empty", () => {
    expect(artifact.removedEligibleSourceNames).toHaveLength(0);
  });

  test("13.9 summary.blockedBeforeCount is 2", () => {
    expect(artifact.summary.blockedBeforeCount).toBe(2);
  });

  test("13.10 summary.blockedAfterCount is 1", () => {
    expect(artifact.summary.blockedAfterCount).toBe(1);
  });

  test("13.11 governance flags correct in mixed scenario", () => {
    expect(artifact.paperOnly).toBe(true);
    expect(artifact.entersAlphaScore).toBe(false);
    expect(artifact.dryRunOnly).toBe(true);
    expect(artifact.noActualMetrics).toBe(true);
    expect(artifact.noRealExecution).toBe(true);
    expect(artifact.notInvestmentAdvice).toBe(true);
  });
});
