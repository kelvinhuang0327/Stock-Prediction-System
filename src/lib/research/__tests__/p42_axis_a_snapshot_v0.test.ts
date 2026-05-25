/**
 * P42 — Axis A Controlled Research Snapshot Reader v0 Tests
 *
 * Tests for the SnapshotReader — the first user-inspectable Axis A output surface.
 * All tests are pure unit tests — no DB, no Prisma, no network, no side effects.
 *
 * Proves:
 *   T42.1  SNAPSHOT_READY: all sources eligible → eligibleSources=[MonthlyRevenue, Quote, Regime]
 *   T42.2  SNAPSHOT_PARTIAL: mixed sources → correctly split into eligible/blocked/not-assessed
 *   T42.3  SNAPSHOT_BLOCKED: all sources blocked → blockingReasons listed in readout
 *   T42.4  SNAPSHOT_BLOCKED_PIT: PIT violation → blockingReasons contains PIT_VIOLATION
 *   T42.5  Governance invariants always present and locked (entersAlphaScore=false, paperOnly=true, etc.)
 *   T42.6  No forbidden fields present in readout output
 *   T42.7  invariantsValid=true for healthy snapshot; invariantViolations=[] for healthy snapshot
 *   T42.8  Deterministic output when fixedReadoutAt is provided
 *   T42.9  readerVersion matches SNAPSHOT_READER_VERSION constant
 *   T42.10 Blocked source categories: source absent from input → NOT_ASSESSED, not fabricated
 *
 * DISCLAIMER: Test suite for Axis A research snapshot reader governance only.
 * entersAlphaScore = false. ALWAYS. Not investment advice.
 * No buy/sell/hold semantics. No scoring formula access.
 */

import {
  SNAPSHOT_READER_VERSION,
  readSnapshot,
  checkReadoutForbiddenFields,
  type SnapshotReadout,
} from "@/lib/research/snapshot/v0/SnapshotReader";

import {
  buildControlledResearchSnapshot,
  type SnapshotBuildInput,
} from "@/lib/research/ControlledResearchSnapshotBuilder";

import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";

// ─── Test Constants ───────────────────────────────────────────────────────────

const FIXED_TODAY = "2026-05-25";
const FIXED_GENERATED_AT = "2026-05-25T00:00:00.000Z";
const FIXED_READOUT_AT = "2026-05-25T01:00:00.000Z";
const PAST_DATE = "2026-05-01";
const FUTURE_DATE = "2099-12-31";
const TEST_SYMBOL = "2330";

// ─── Fixture Factories ────────────────────────────────────────────────────────

function makeEligibleMRFacts(): SourceReadinessFacts {
  return {
    sourceName: "MonthlyRevenue",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
    sourceTrace: "p42-test-mr",
  };
}

function makeEligibleQuoteFacts(): SourceReadinessFacts {
  return {
    sourceName: "Quote",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
    sourceTrace: "p42-test-quote",
  };
}

function makeEligibleRegimeFacts(): SourceReadinessFacts {
  return {
    sourceName: "Regime",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
    sourceTrace: "p42-test-regime",
  };
}

function makeBlockedMRFacts(): SourceReadinessFacts {
  return {
    sourceName: "MonthlyRevenue",
    pitStatus: "PIT_GATE_MISSING",
    pitConfidence: "NONE",
    consumerStatus: "BLOCKED",
    qualityEvidenceComplete: false,
    pitMetadataComplete: false,
    lagEvidenceComplete: false,
    authorizationGranted: false,
    pitSafeConfirmed: false,
    sourceTrace: "p42-test-mr-blocked",
  };
}

/**
 * Quote facts with pitSafeConfirmed=false → SOURCE_PRESENT_AUDIT_ONLY → AUDIT_ONLY
 * Used to produce SNAPSHOT_PARTIAL: MR=ELIGIBLE + Quote=AUDIT_ONLY → eligible < assessed
 */
function makeAuditOnlyQuoteFacts(): SourceReadinessFacts {
  return {
    sourceName: "Quote",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "LOW",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: false, // → SOURCE_PRESENT_AUDIT_ONLY → AUDIT_ONLY
    sourceTrace: "p42-test-quote-audit-only",
  };
}

function buildBaseInput(overrides: Partial<SnapshotBuildInput> = {}): SnapshotBuildInput {
  return {
    symbol: TEST_SYMBOL,
    asOfDate: PAST_DATE,
    sourceTrace: "p42-test-suite",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    ...overrides,
  };
}

// ─── T42.1 — SNAPSHOT_READY: all eligible ────────────────────────────────────

describe("T42.1 — SNAPSHOT_READY: all sources eligible", () => {
  let readout: SnapshotReadout;

  beforeAll(() => {
    const snapshot = buildControlledResearchSnapshot(
      buildBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    readout = readSnapshot(snapshot, FIXED_READOUT_AT);
  });

  it("T42.1.1 researchReadinessStatus is SNAPSHOT_READY", () => {
    expect(readout.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });

  it("T42.1.2 eligibleSources contains MonthlyRevenue, Quote, Regime", () => {
    expect(readout.eligibleSources).toContain("MonthlyRevenue");
    expect(readout.eligibleSources).toContain("Quote");
    expect(readout.eligibleSources).toContain("Regime");
    expect(readout.eligibleSources).toHaveLength(3);
  });

  it("T42.1.3 blockedSources is empty", () => {
    expect(readout.blockedSources).toHaveLength(0);
  });

  it("T42.1.4 auditOnlySources is empty", () => {
    expect(readout.auditOnlySources).toHaveLength(0);
  });

  it("T42.1.5 notAssessedSources is empty", () => {
    expect(readout.notAssessedSources).toHaveLength(0);
  });

  it("T42.1.6 blockingReasons is empty", () => {
    expect(readout.blockingReasons).toHaveLength(0);
  });
});

// ─── T42.2 — SNAPSHOT_PARTIAL: mixed sources ─────────────────────────────────

describe("T42.2 — SNAPSHOT_PARTIAL: mixed sources", () => {
  let readout: SnapshotReadout;

  beforeAll(() => {
    // MR=ELIGIBLE, Quote=AUDIT_ONLY (pitSafeConfirmed=false → SOURCE_PRESENT_AUDIT_ONLY)
    // Regime=NOT_ASSESSED → assessed=[ELIGIBLE, AUDIT_ONLY], eligible=[ELIGIBLE]
    // eligible.length (1) < assessed.length (2) → SNAPSHOT_PARTIAL
    const snapshot = buildControlledResearchSnapshot(
      buildBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeAuditOnlyQuoteFacts(), // AUDIT_ONLY
        // regimeFacts omitted → NOT_ASSESSED
      })
    );
    readout = readSnapshot(snapshot, FIXED_READOUT_AT);
  });

  it("T42.2.1 researchReadinessStatus is SNAPSHOT_PARTIAL", () => {
    expect(readout.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
  });

  it("T42.2.2 eligibleSources contains MonthlyRevenue only", () => {
    expect(readout.eligibleSources).toContain("MonthlyRevenue");
    expect(readout.eligibleSources).toHaveLength(1);
  });

  it("T42.2.3 auditOnlySources contains Quote", () => {
    expect(readout.auditOnlySources).toContain("Quote");
    expect(readout.auditOnlySources).toHaveLength(1);
  });

  it("T42.2.4 notAssessedSources contains Regime only", () => {
    expect(readout.notAssessedSources).toContain("Regime");
    expect(readout.notAssessedSources).toHaveLength(1);
  });
});

// ─── T42.3 — SNAPSHOT_BLOCKED: all sources blocked ───────────────────────────

describe("T42.3 — SNAPSHOT_BLOCKED: all sources blocked", () => {
  let readout: SnapshotReadout;

  beforeAll(() => {
    const snapshot = buildControlledResearchSnapshot(
      buildBaseInput({
        monthlyRevenueFacts: makeBlockedMRFacts(),
        // Quote and Regime not assessed
      })
    );
    readout = readSnapshot(snapshot, FIXED_READOUT_AT);
  });

  it("T42.3.1 researchReadinessStatus is SNAPSHOT_BLOCKED", () => {
    expect(readout.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
  });

  it("T42.3.2 blockedSources contains MonthlyRevenue", () => {
    expect(readout.blockedSources).toContain("MonthlyRevenue");
  });

  it("T42.3.3 blockingReasons is non-empty", () => {
    expect(readout.blockingReasons.length).toBeGreaterThan(0);
  });

  it("T42.3.4 eligibleSources is empty", () => {
    expect(readout.eligibleSources).toHaveLength(0);
  });
});

// ─── T42.4 — SNAPSHOT_BLOCKED_PIT: future asOfDate ───────────────────────────

describe("T42.4 — SNAPSHOT_BLOCKED_PIT: future-dated snapshot", () => {
  let readout: SnapshotReadout;

  beforeAll(() => {
    const snapshot = buildControlledResearchSnapshot(
      buildBaseInput({
        asOfDate: FUTURE_DATE,
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    readout = readSnapshot(snapshot, FIXED_READOUT_AT);
  });

  it("T42.4.1 researchReadinessStatus is SNAPSHOT_BLOCKED_PIT", () => {
    expect(readout.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED_PIT");
  });

  it("T42.4.2 blockingReasons contains PIT_VIOLATION", () => {
    const hasPitViolation = readout.blockingReasons.some((r) =>
      r.includes("PIT_VIOLATION")
    );
    expect(hasPitViolation).toBe(true);
  });

  it("T42.4.3 eligibleSources is empty (PIT violation blocks all)", () => {
    expect(readout.eligibleSources).toHaveLength(0);
  });
});

// ─── T42.5 — Governance invariants always present ────────────────────────────

describe("T42.5 — Governance invariants always present and locked", () => {
  const cases: Array<{ label: string; input: SnapshotBuildInput }> = [
    {
      label: "SNAPSHOT_READY",
      input: buildBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      }),
    },
    {
      label: "SNAPSHOT_PARTIAL",
      input: buildBaseInput({ monthlyRevenueFacts: makeEligibleMRFacts() }),
    },
    {
      label: "SNAPSHOT_BLOCKED",
      input: buildBaseInput({ monthlyRevenueFacts: makeBlockedMRFacts() }),
    },
    {
      label: "SNAPSHOT_BLOCKED_PIT",
      input: buildBaseInput({ asOfDate: FUTURE_DATE }),
    },
  ];

  for (const { label, input } of cases) {
    describe(`case: ${label}`, () => {
      let readout: SnapshotReadout;
      beforeAll(() => {
        readout = readSnapshot(
          buildControlledResearchSnapshot(input),
          FIXED_READOUT_AT
        );
      });

      it("entersAlphaScore is false", () => {
        expect(readout.entersAlphaScore).toBe(false);
      });

      it("notInvestmentRecommendation is true", () => {
        expect(readout.notInvestmentRecommendation).toBe(true);
      });

      it("paperOnly is true", () => {
        expect(readout.paperOnly).toBe(true);
      });

      it("dryRun is true", () => {
        expect(readout.dryRun).toBe(true);
      });

      it("disclaimer is non-empty", () => {
        expect(readout.disclaimer.length).toBeGreaterThan(0);
      });
    });
  }
});

// ─── T42.6 — No forbidden fields in readout ──────────────────────────────────

describe("T42.6 — No forbidden fields in SnapshotReadout", () => {
  it("T42.6.1 checkReadoutForbiddenFields returns empty for SNAPSHOT_READY readout", () => {
    const snapshot = buildControlledResearchSnapshot(
      buildBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    const forbidden = checkReadoutForbiddenFields(readout);
    expect(forbidden).toHaveLength(0);
  });

  it("T42.6.2 readout contains no alphaScore field", () => {
    const snapshot = buildControlledResearchSnapshot(buildBaseInput());
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    expect(Object.keys(readout)).not.toContain("alphaScore");
  });

  it("T42.6.3 readout contains no prediction field", () => {
    const snapshot = buildControlledResearchSnapshot(buildBaseInput());
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    expect(Object.keys(readout)).not.toContain("prediction");
  });

  it("T42.6.4 readout contains no recommendation field", () => {
    const snapshot = buildControlledResearchSnapshot(buildBaseInput());
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    expect(Object.keys(readout)).not.toContain("recommendation");
  });
});

// ─── T42.7 — Invariant validation ────────────────────────────────────────────

describe("T42.7 — invariantsValid reflects snapshot health", () => {
  it("T42.7.1 invariantsValid=true and invariantViolations=[] for healthy SNAPSHOT_READY", () => {
    const snapshot = buildControlledResearchSnapshot(
      buildBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    expect(readout.invariantsValid).toBe(true);
    expect(readout.invariantViolations).toHaveLength(0);
  });

  it("T42.7.2 invariantsValid=true for SNAPSHOT_BLOCKED_PIT", () => {
    // A PIT-blocked snapshot still has correct invariants (entersAlphaScore=false etc.)
    const snapshot = buildControlledResearchSnapshot(
      buildBaseInput({ asOfDate: FUTURE_DATE })
    );
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    expect(readout.invariantsValid).toBe(true);
  });
});

// ─── T42.8 — Determinism with fixedReadoutAt ─────────────────────────────────

describe("T42.8 — Deterministic output with fixedReadoutAt", () => {
  it("T42.8.1 two calls with same fixedReadoutAt produce identical readoutAt", () => {
    const snapshot = buildControlledResearchSnapshot(buildBaseInput());
    const r1 = readSnapshot(snapshot, FIXED_READOUT_AT);
    const r2 = readSnapshot(snapshot, FIXED_READOUT_AT);
    expect(r1.readoutAt).toBe(r2.readoutAt);
    expect(r1.readoutAt).toBe(FIXED_READOUT_AT);
  });

  it("T42.8.2 symbol and asOfDate match the input snapshot", () => {
    const snapshot = buildControlledResearchSnapshot(
      buildBaseInput({ symbol: "2317", asOfDate: "2026-04-01" })
    );
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    expect(readout.symbol).toBe("2317");
    expect(readout.asOfDate).toBe("2026-04-01");
  });

  it("T42.8.3 generatedAt in readout matches the snapshot generatedAt", () => {
    const snapshot = buildControlledResearchSnapshot(buildBaseInput());
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    expect(readout.generatedAt).toBe(snapshot.generatedAt);
    expect(readout.generatedAt).toBe(FIXED_GENERATED_AT);
  });
});

// ─── T42.9 — readerVersion matches constant ──────────────────────────────────

describe("T42.9 — readerVersion matches SNAPSHOT_READER_VERSION", () => {
  it("T42.9.1 readout.readerVersion equals SNAPSHOT_READER_VERSION", () => {
    const snapshot = buildControlledResearchSnapshot(buildBaseInput());
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    expect(readout.readerVersion).toBe(SNAPSHOT_READER_VERSION);
    expect(readout.readerVersion).toBe("p42-axis-a-snapshot-reader-v0");
  });
});

// ─── T42.10 — NOT_ASSESSED for absent sources ────────────────────────────────

describe("T42.10 — Absent source input → NOT_ASSESSED, not fabricated", () => {
  it("T42.10.1 no facts provided → all three sources in notAssessedSources", () => {
    const snapshot = buildControlledResearchSnapshot(
      buildBaseInput({
        // No facts provided at all
      })
    );
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    expect(readout.notAssessedSources).toContain("MonthlyRevenue");
    expect(readout.notAssessedSources).toContain("Quote");
    expect(readout.notAssessedSources).toContain("Regime");
    expect(readout.notAssessedSources).toHaveLength(3);
  });

  it("T42.10.2 absent sources do not appear in eligibleSources", () => {
    const snapshot = buildControlledResearchSnapshot(buildBaseInput());
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    expect(readout.eligibleSources).toHaveLength(0);
  });

  it("T42.10.3 absent sources do not appear in blockedSources", () => {
    const snapshot = buildControlledResearchSnapshot(buildBaseInput());
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    expect(readout.blockedSources).toHaveLength(0);
  });
});
