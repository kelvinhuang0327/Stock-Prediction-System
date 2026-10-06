/**
 * P1 — Axis A Controlled Research Snapshot v0 Tests
 *
 * Proves:
 *   T1.x  Contract invariants (entersAlphaScore, paperOnly, dryRun, notInvestmentRecommendation)
 *   T2.x  PIT safety — future-dated asOfDate is rejected
 *   T3.x  Missing optional source yields NOT_ASSESSED, not fabricated data
 *   T4.x  All-eligible sources produce SNAPSHOT_READY
 *   T5.x  Mixed sources produce SNAPSHOT_PARTIAL
 *   T6.x  All-blocked sources produce SNAPSHOT_BLOCKED
 *   T7.x  No forbidden fields (buy/sell/hold/alphaScore/score/etc.) in snapshot output
 *   T8.x  No action semantics emitted
 *   T9.x  No scoring formula imported or mutated
 *   T10.x Deterministic output with fixedGeneratedAt
 *
 * All tests are pure unit tests — no DB, no Prisma, no side effects.
 *
 * DISCLAIMER: Test suite for Axis A research snapshot contract only.
 * entersAlphaScore = false. ALWAYS. Not investment advice.
 * No buy/sell/hold semantics. No scoring formula access.
 */

import {
  CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT,
  CONTROLLED_RESEARCH_SNAPSHOT_VERSION,
  CONTROLLED_RESEARCH_SNAPSHOT_DISCLAIMER,
  SNAPSHOT_FORBIDDEN_FIELDS,
  validateSnapshotInvariants,
  type ControlledResearchSnapshot,
} from "../ControlledResearchSnapshot";

import {
  buildControlledResearchSnapshot,
  type SnapshotBuildInput,
} from "../ControlledResearchSnapshotBuilder";

import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FIXED_TODAY = "2026-05-23";
const FIXED_GENERATED_AT = "2026-05-23T00:00:00.000Z";
const PAST_DATE = "2026-05-01";
const FUTURE_DATE = "2099-12-31";

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
    sourceTrace: "p36-consumer-v1",
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
    sourceTrace: "quote-pit-gate-v1",
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
    sourceTrace: "regime-pit-gate-v1",
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
  };
}

function makeBlockedQuoteFacts(): SourceReadinessFacts {
  return {
    sourceName: "Quote",
    pitStatus: "PIT_GATE_MISSING",
    pitConfidence: "NONE",
    consumerStatus: "BLOCKED",
    qualityEvidenceComplete: false,
    pitMetadataComplete: false,
    lagEvidenceComplete: false,
    authorizationGranted: false,
    pitSafeConfirmed: false,
  };
}

function makeBaseInput(
  overrides: Partial<SnapshotBuildInput> = {}
): SnapshotBuildInput {
  return {
    symbol: "2330",
    asOfDate: PAST_DATE,
    fixedToday: FIXED_TODAY,
    fixedGeneratedAt: FIXED_GENERATED_AT,
    ...overrides,
  };
}

// ─── T1: Contract Invariants ──────────────────────────────────────────────────

describe("T1: Contract invariants", () => {
  it("T1.1 contract enforces entersAlphaScore = false", () => {
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.entersAlphaScore).toBe(false);
  });

  it("T1.2 contract enforces notInvestmentRecommendation = true", () => {
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.notInvestmentRecommendation).toBe(true);
  });

  it("T1.3 contract enforces paperOnly = true", () => {
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.paperOnly).toBe(true);
  });

  it("T1.4 contract enforces dryRun = true", () => {
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.dryRun).toBe(true);
  });

  it("T1.5 contract enforces noBuySellActionSemantics = true", () => {
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.noBuySellActionSemantics).toBe(true);
  });

  it("T1.6 contract enforces noScoringFormulaAccess = true", () => {
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.noScoringFormulaAccess).toBe(true);
  });

  it("T1.7 contract enforces noDbApply = true", () => {
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.noDbApply).toBe(true);
  });

  it("T1.8 contract version matches CONTROLLED_RESEARCH_SNAPSHOT_VERSION", () => {
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.version).toBe(
      CONTROLLED_RESEARCH_SNAPSHOT_VERSION
    );
  });

  it("T1.9 contract disclaimer is non-empty and contains anti-advice text", () => {
    expect(CONTROLLED_RESEARCH_SNAPSHOT_DISCLAIMER).toMatch(
      /does not constitute investment advice/i
    );
    expect(CONTROLLED_RESEARCH_SNAPSHOT_DISCLAIMER).toMatch(/entersAlphaScore = false/i);
  });

  it("T1.10 built snapshot satisfies validateSnapshotInvariants", () => {
    const snap = buildControlledResearchSnapshot(makeBaseInput());
    const result = validateSnapshotInvariants(snap);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

// ─── T2: PIT Safety ───────────────────────────────────────────────────────────

describe("T2: PIT safety — future-dated input rejected", () => {
  it("T2.1 future asOfDate produces SNAPSHOT_BLOCKED_PIT", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ asOfDate: FUTURE_DATE })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED_PIT");
  });

  it("T2.2 future-dated snapshot has all sources NOT_ASSESSED", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ asOfDate: FUTURE_DATE })
    );
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("NOT_ASSESSED");
    expect(snap.pitSafeInputs.quote).toBe("NOT_ASSESSED");
    expect(snap.pitSafeInputs.regime).toBe("NOT_ASSESSED");
  });

  it("T2.3 future-dated snapshot blockingReasons mentions PIT_VIOLATION", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ asOfDate: FUTURE_DATE })
    );
    expect(snap.blockingReasons.some((r) => r.includes("PIT_VIOLATION"))).toBe(true);
  });

  it("T2.4 future-dated snapshot preserves governance invariants", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ asOfDate: FUTURE_DATE })
    );
    expect(snap.entersAlphaScore).toBe(false);
    expect(snap.notInvestmentRecommendation).toBe(true);
    expect(snap.paperOnly).toBe(true);
    expect(snap.dryRun).toBe(true);
  });

  it("T2.5 invalid asOfDate format produces SNAPSHOT_BLOCKED_PIT", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ asOfDate: "not-a-date" })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED_PIT");
  });

  it("T2.6 today asOfDate is accepted (not future)", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ asOfDate: FIXED_TODAY })
    );
    expect(snap.researchReadinessStatus).not.toBe("SNAPSHOT_BLOCKED_PIT");
  });
});

// ─── T3: Missing Optional Source → NOT_ASSESSED (not fabricated) ─────────────

describe("T3: Missing source yields NOT_ASSESSED, not fabricated", () => {
  it("T3.1 no sources provided → all readiness NOT_ASSESSED", () => {
    const snap = buildControlledResearchSnapshot(makeBaseInput());
    expect(snap.monthlyRevenueReadiness).toBe("NOT_ASSESSED");
    expect(snap.quoteReadiness).toBe("NOT_ASSESSED");
    expect(snap.regimeReadiness).toBe("NOT_ASSESSED");
  });

  it("T3.2 no sources provided → pitSafeInputs all NOT_ASSESSED", () => {
    const snap = buildControlledResearchSnapshot(makeBaseInput());
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("NOT_ASSESSED");
    expect(snap.pitSafeInputs.quote).toBe("NOT_ASSESSED");
    expect(snap.pitSafeInputs.regime).toBe("NOT_ASSESSED");
  });

  it("T3.3 no sources provided → SNAPSHOT_BLOCKED", () => {
    const snap = buildControlledResearchSnapshot(makeBaseInput());
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
  });

  it("T3.4 only monthlyRevenue provided → quote and regime NOT_ASSESSED", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ monthlyRevenueFacts: makeEligibleMRFacts() })
    );
    expect(snap.pitSafeInputs.quote).toBe("NOT_ASSESSED");
    expect(snap.pitSafeInputs.regime).toBe("NOT_ASSESSED");
  });

  it("T3.5 only quote provided → monthlyRevenue and regime NOT_ASSESSED", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ quoteFacts: makeEligibleQuoteFacts() })
    );
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("NOT_ASSESSED");
    expect(snap.pitSafeInputs.regime).toBe("NOT_ASSESSED");
  });
});

// ─── T4: All-Eligible Sources → SNAPSHOT_READY ───────────────────────────────

describe("T4: All eligible sources produce SNAPSHOT_READY", () => {
  it("T4.1 all three eligible sources → SNAPSHOT_READY", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });

  it("T4.2 all three eligible → pitSafeInputs all ELIGIBLE", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("ELIGIBLE");
    expect(snap.pitSafeInputs.quote).toBe("ELIGIBLE");
    expect(snap.pitSafeInputs.regime).toBe("ELIGIBLE");
  });

  it("T4.3 eligible snapshot has empty blockingReasons", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    expect(snap.blockingReasons).toHaveLength(0);
  });

  it("T4.4 single eligible MR source → SNAPSHOT_READY (only assessed source is eligible)", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ monthlyRevenueFacts: makeEligibleMRFacts() })
    );
    // Only MR is assessed and it's eligible → all assessed are eligible → SNAPSHOT_READY
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });
});

// ─── T5: Mixed Sources → SNAPSHOT_PARTIAL ────────────────────────────────────

describe("T5: Mixed sources produce SNAPSHOT_PARTIAL", () => {
  it("T5.1 eligible MR + blocked Quote → SNAPSHOT_PARTIAL", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeBlockedQuoteFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
  });

  it("T5.2 eligible MR + unconfirmed Quote → pitSafeInputs reflects states (Quote=AUDIT_ONLY per P38 resolver)", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeBlockedQuoteFacts(),
      })
    );
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("ELIGIBLE");
    // P38 resolveQuoteOrRegime maps pitSafeConfirmed=false → SOURCE_PRESENT_AUDIT_ONLY → AUDIT_ONLY
    expect(snap.pitSafeInputs.quote).toBe("AUDIT_ONLY");
    expect(snap.pitSafeInputs.regime).toBe("NOT_ASSESSED");
  });

  it("T5.3 partial snapshot has blockingReasons for blocked source", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeBlockedQuoteFacts(),
      })
    );
    expect(snap.blockingReasons.length).toBeGreaterThan(0);
  });
});

// ─── T6: All-Blocked Sources → SNAPSHOT_BLOCKED ──────────────────────────────

describe("T6: All-blocked sources produce SNAPSHOT_BLOCKED", () => {
  it("T6.1 all blocked → SNAPSHOT_BLOCKED", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeBlockedMRFacts(),
        quoteFacts: makeBlockedQuoteFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
  });

  it("T6.2 blocked MR + unconfirmed Quote → pitSafeInputs reflects actual P38 statuses", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeBlockedMRFacts(),
        quoteFacts: makeBlockedQuoteFacts(),
      })
    );
    // MR with pitMetadataComplete=false → BLOCKED_PIT_METADATA → BLOCKED
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("BLOCKED");
    // Quote with pitSafeConfirmed=false → SOURCE_PRESENT_AUDIT_ONLY → AUDIT_ONLY (P38 behavior)
    expect(snap.pitSafeInputs.quote).toBe("AUDIT_ONLY");
  });
});

// ─── T7: No Forbidden Fields in Snapshot Output ──────────────────────────────

describe("T7: No forbidden fields in snapshot output", () => {
  it("T7.1 SNAPSHOT_BLOCKED_PIT output has no forbidden fields", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ asOfDate: FUTURE_DATE })
    );
    const keys = Object.keys(snap);
    const found = keys.filter((k) =>
      (SNAPSHOT_FORBIDDEN_FIELDS as readonly string[]).includes(k)
    );
    expect(found).toHaveLength(0);
  });

  it("T7.2 SNAPSHOT_READY output has no forbidden fields", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    const keys = Object.keys(snap);
    const found = keys.filter((k) =>
      (SNAPSHOT_FORBIDDEN_FIELDS as readonly string[]).includes(k)
    );
    expect(found).toHaveLength(0);
  });

  it("T7.3 SNAPSHOT_BLOCKED output has no forbidden fields", () => {
    const snap = buildControlledResearchSnapshot(makeBaseInput());
    const keys = Object.keys(snap);
    const found = keys.filter((k) =>
      (SNAPSHOT_FORBIDDEN_FIELDS as readonly string[]).includes(k)
    );
    expect(found).toHaveLength(0);
  });
});

// ─── T8: No Action Semantics ──────────────────────────────────────────────────

describe("T8: No action semantics emitted", () => {
  const actionFields = ["buy", "sell", "hold", "signal", "recommendation", "prediction"];

  it("T8.1 SNAPSHOT_READY has no action-semantic fields", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    const snapAsRecord = snap as Record<string, unknown>;
    for (const field of actionFields) {
      expect(snapAsRecord[field]).toBeUndefined();
    }
  });

  it("T8.2 snapshot disclaimer explicitly prohibits buy/sell/hold", () => {
    const snap = buildControlledResearchSnapshot(makeBaseInput());
    expect(snap.disclaimer).toMatch(/buy.*sell.*hold/i);
  });

  it("T8.3 notInvestmentRecommendation is always true in built snapshot", () => {
    const snaps: ControlledResearchSnapshot[] = [
      buildControlledResearchSnapshot(makeBaseInput()),
      buildControlledResearchSnapshot(makeBaseInput({ asOfDate: FUTURE_DATE })),
      buildControlledResearchSnapshot(
        makeBaseInput({ monthlyRevenueFacts: makeEligibleMRFacts() })
      ),
    ];
    for (const snap of snaps) {
      expect(snap.notInvestmentRecommendation).toBe(true);
    }
  });
});

// ─── T9: No Scoring Formula Imported or Mutated ───────────────────────────────

describe("T9: No scoring formula access", () => {
  it("T9.1 contract declares noScoringFormulaAccess = true", () => {
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.noScoringFormulaAccess).toBe(true);
  });

  it("T9.2 snapshot output contains no alphaScore field", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ monthlyRevenueFacts: makeEligibleMRFacts() })
    );
    expect((snap as Record<string, unknown>).alphaScore).toBeUndefined();
  });

  it("T9.3 entersAlphaScore is always false in built snapshot", () => {
    const snaps: ControlledResearchSnapshot[] = [
      buildControlledResearchSnapshot(makeBaseInput()),
      buildControlledResearchSnapshot(makeBaseInput({ asOfDate: FUTURE_DATE })),
      buildControlledResearchSnapshot(
        makeBaseInput({
          monthlyRevenueFacts: makeEligibleMRFacts(),
          quoteFacts: makeEligibleQuoteFacts(),
          regimeFacts: makeEligibleRegimeFacts(),
        })
      ),
    ];
    for (const snap of snaps) {
      expect(snap.entersAlphaScore).toBe(false);
    }
  });
});

// ─── T10: Deterministic Output ───────────────────────────────────────────────

describe("T10: Deterministic output with fixedGeneratedAt", () => {
  it("T10.1 same input → same generatedAt when fixed", () => {
    const a = buildControlledResearchSnapshot(makeBaseInput());
    const b = buildControlledResearchSnapshot(makeBaseInput());
    expect(a.generatedAt).toBe(b.generatedAt);
    expect(a.generatedAt).toBe(FIXED_GENERATED_AT);
  });

  it("T10.2 same input → same snapshotVersion", () => {
    const snap = buildControlledResearchSnapshot(makeBaseInput());
    expect(snap.snapshotVersion).toBe(CONTROLLED_RESEARCH_SNAPSHOT_VERSION);
  });

  it("T10.3 same eligible input → same researchReadinessStatus", () => {
    const input = makeBaseInput({ monthlyRevenueFacts: makeEligibleMRFacts() });
    const a = buildControlledResearchSnapshot(input);
    const b = buildControlledResearchSnapshot(input);
    expect(a.researchReadinessStatus).toBe(b.researchReadinessStatus);
  });

  it("T10.4 sourceTrace defaults to builder identifier when not provided", () => {
    const snap = buildControlledResearchSnapshot(makeBaseInput());
    expect(snap.sourceTrace).toBe("ControlledResearchSnapshotBuilder-v0");
  });

  it("T10.5 custom sourceTrace is preserved", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ sourceTrace: "test-trace-p1" })
    );
    expect(snap.sourceTrace).toBe("test-trace-p1");
  });

  it("T10.6 symbol is preserved in snapshot", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ symbol: "2454" })
    );
    expect(snap.symbol).toBe("2454");
  });

  it("T10.7 asOfDate is preserved in snapshot", () => {
    const snap = buildControlledResearchSnapshot(makeBaseInput());
    expect(snap.asOfDate).toBe(PAST_DATE);
  });
});

// ─── P5 Helpers ───────────────────────────────────────────────────────────────

function makeBlockedRegimeFacts(): SourceReadinessFacts {
  return {
    sourceName: "Regime",
    pitStatus: "PIT_GATE_MISSING",
    pitConfidence: "NONE",
    consumerStatus: "BLOCKED",
    qualityEvidenceComplete: false,
    pitMetadataComplete: false,
    lagEvidenceComplete: false,
    authorizationGranted: false,
    pitSafeConfirmed: false,
  };
}

function makeAuditOnlyQuoteFacts(): SourceReadinessFacts {
  return {
    sourceName: "Quote",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "MEDIUM",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: false, // not yet confirmed → SOURCE_PRESENT_AUDIT_ONLY → AUDIT_ONLY
  };
}

function makeAuditOnlyRegimeFacts(): SourceReadinessFacts {
  return {
    sourceName: "Regime",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "MEDIUM",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: false, // not yet confirmed → SOURCE_PRESENT_AUDIT_ONLY → AUDIT_ONLY
  };
}

// ─── P5 T11: All-sources-blocked invariant exhaustiveness ────────────────────

describe("T11: All-sources-blocked invariant exhaustiveness", () => {
  function makeAllBlockedSnap() {
    return buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeBlockedMRFacts(),
        quoteFacts: makeBlockedQuoteFacts(),
        regimeFacts: makeBlockedRegimeFacts(),
      })
    );
  }

  it("T11.1 all three sources explicitly blocked → SNAPSHOT_BLOCKED", () => {
    expect(makeAllBlockedSnap().researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
  });

  it("T11.2 all-blocked pitSafeInputs: MR is BLOCKED; Quote/Regime are AUDIT_ONLY (P38 SOURCE_PRESENT_AUDIT_ONLY)", () => {
    // P38 resolveQuoteOrRegime returns SOURCE_PRESENT_AUDIT_ONLY (→ AUDIT_ONLY)
    // for any Quote/Regime with pitSafeConfirmed=false regardless of consumerStatus.
    // Only BLOCKED_* statuses from MR/FinancialReport/Chip/News map to BLOCKED.
    const snap = makeAllBlockedSnap();
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("BLOCKED");
    expect(snap.pitSafeInputs.quote).toBe("AUDIT_ONLY");
    expect(snap.pitSafeInputs.regime).toBe("AUDIT_ONLY");
  });

  it("T11.3 all-blocked blockingReasons: at least one reason per source", () => {
    const snap = makeAllBlockedSnap();
    const reasons = snap.blockingReasons;
    expect(reasons.some((r) => r.startsWith("MonthlyRevenue:"))).toBe(true);
    expect(reasons.some((r) => r.startsWith("Quote:"))).toBe(true);
    expect(reasons.some((r) => r.startsWith("Regime:"))).toBe(true);
  });

  it("T11.4 all-blocked snapshot preserves all governance flags", () => {
    const snap = makeAllBlockedSnap();
    expect(snap.entersAlphaScore).toBe(false);
    expect(snap.notInvestmentRecommendation).toBe(true);
    expect(snap.paperOnly).toBe(true);
    expect(snap.dryRun).toBe(true);
  });

  it("T11.5 validateSnapshotInvariants on all-blocked snapshot returns valid=true", () => {
    const result = validateSnapshotInvariants(makeAllBlockedSnap());
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

// ─── P5 T12: Partial and ready bundle edge cases ──────────────────────────────

describe("T12: Partial and ready bundle edge cases", () => {
  it("T12.1 no MR + eligible Quote + eligible Regime → SNAPSHOT_READY", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });

  it("T12.2 eligible MR + eligible Quote + no Regime → SNAPSHOT_READY", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });

  it("T12.3 eligible MR + blocked Quote + blocked Regime → SNAPSHOT_PARTIAL", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeBlockedQuoteFacts(),
        regimeFacts: makeBlockedRegimeFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
  });

  it("T12.4 blocked MR + eligible Quote + eligible Regime → SNAPSHOT_PARTIAL", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeBlockedMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
  });

  it("T12.5 SNAPSHOT_READY snapshot has empty blockingReasons array", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_READY");
    expect(snap.blockingReasons).toHaveLength(0);
  });
});

// ─── P5 T13: sourceTrace edge cases ──────────────────────────────────────────

describe("T13: sourceTrace edge cases", () => {
  it("T13.1 no sourceTrace provided → defaults to builder identifier string", () => {
    const snap = buildControlledResearchSnapshot(makeBaseInput({ sourceTrace: undefined }));
    expect(snap.sourceTrace).toBe("ControlledResearchSnapshotBuilder-v0");
  });

  it("T13.2 empty string sourceTrace is preserved as empty string (not replaced by default)", () => {
    const snap = buildControlledResearchSnapshot(makeBaseInput({ sourceTrace: "" }));
    expect(snap.sourceTrace).toBe("");
  });

  it("T13.3 sourceTrace with spaces and special characters is preserved verbatim", () => {
    const trace = "p5-test :: axis-a / builder@v1 [edge-case]";
    const snap = buildControlledResearchSnapshot(makeBaseInput({ sourceTrace: trace }));
    expect(snap.sourceTrace).toBe(trace);
  });

  it("T13.4 very long sourceTrace (100+ chars) is preserved verbatim", () => {
    const trace = "a".repeat(120) + "-suffix";
    const snap = buildControlledResearchSnapshot(makeBaseInput({ sourceTrace: trace }));
    expect(snap.sourceTrace).toBe(trace);
  });

  it("T13.5 sourceTrace with numbers and hyphens is preserved verbatim", () => {
    const trace = "controlled-research-2026-05-23-v1-snapshot";
    const snap = buildControlledResearchSnapshot(makeBaseInput({ sourceTrace: trace }));
    expect(snap.sourceTrace).toBe(trace);
  });
});

// ─── P5 T14: Deterministic repeated build ────────────────────────────────────

describe("T14: Deterministic repeated build invariants", () => {
  function makeFullEligibleInput(): SnapshotBuildInput {
    return makeBaseInput({
      monthlyRevenueFacts: makeEligibleMRFacts(),
      quoteFacts: makeEligibleQuoteFacts(),
      regimeFacts: makeEligibleRegimeFacts(),
      sourceTrace: "p5-determinism-test",
    });
  }

  it("T14.1 two builds with same fixed eligible input → identical researchReadinessStatus", () => {
    const a = buildControlledResearchSnapshot(makeFullEligibleInput());
    const b = buildControlledResearchSnapshot(makeFullEligibleInput());
    expect(a.researchReadinessStatus).toBe(b.researchReadinessStatus);
  });

  it("T14.2 two builds with same fixed eligible input → identical pitSafeInputs", () => {
    const a = buildControlledResearchSnapshot(makeFullEligibleInput());
    const b = buildControlledResearchSnapshot(makeFullEligibleInput());
    expect(a.pitSafeInputs).toEqual(b.pitSafeInputs);
  });

  it("T14.3 two builds with same fixed eligible input → both have empty blockingReasons", () => {
    const a = buildControlledResearchSnapshot(makeFullEligibleInput());
    const b = buildControlledResearchSnapshot(makeFullEligibleInput());
    expect(a.blockingReasons).toHaveLength(0);
    expect(b.blockingReasons).toHaveLength(0);
  });

  it("T14.4 two builds with fixedGeneratedAt → identical generatedAt", () => {
    const a = buildControlledResearchSnapshot(makeFullEligibleInput());
    const b = buildControlledResearchSnapshot(makeFullEligibleInput());
    expect(a.generatedAt).toBe(FIXED_GENERATED_AT);
    expect(b.generatedAt).toBe(FIXED_GENERATED_AT);
  });

  it("T14.5 two builds with same all-blocked input → identical blockingReasons count", () => {
    const blockedInput = makeBaseInput({
      monthlyRevenueFacts: makeBlockedMRFacts(),
      quoteFacts: makeBlockedQuoteFacts(),
      regimeFacts: makeBlockedRegimeFacts(),
    });
    const a = buildControlledResearchSnapshot(blockedInput);
    const b = buildControlledResearchSnapshot(blockedInput);
    expect(a.blockingReasons.length).toBe(b.blockingReasons.length);
  });
});

// ─── P5 T15: PIT-unsafe source combinations ──────────────────────────────────

describe("T15: PIT-unsafe source combinations", () => {
  it("T15.1 Quote with pitSafeConfirmed=false → pitSafeInputs.quote is AUDIT_ONLY", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ quoteFacts: makeAuditOnlyQuoteFacts() })
    );
    expect(snap.pitSafeInputs.quote).toBe("AUDIT_ONLY");
  });

  it("T15.2 Regime with pitSafeConfirmed=false → pitSafeInputs.regime is AUDIT_ONLY", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ regimeFacts: makeAuditOnlyRegimeFacts() })
    );
    expect(snap.pitSafeInputs.regime).toBe("AUDIT_ONLY");
  });

  it("T15.3 eligible MR + PIT-unsafe Quote + no Regime → SNAPSHOT_PARTIAL", () => {
    // MR=ELIGIBLE, Quote=AUDIT_ONLY, Regime=NOT_ASSESSED
    // assessed=[ELIGIBLE, AUDIT_ONLY] (length=2), eligible=[ELIGIBLE] (length=1)
    // eligible.length < assessed.length → SNAPSHOT_PARTIAL
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeAuditOnlyQuoteFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
  });

  it("T15.4 no MR + PIT-unsafe Quote + PIT-unsafe Regime → SNAPSHOT_BLOCKED (no eligible source)", () => {
    // MR=NOT_ASSESSED, Quote=AUDIT_ONLY, Regime=AUDIT_ONLY
    // assessed=[AUDIT_ONLY, AUDIT_ONLY] (length=2), eligible=[] (length=0)
    // eligible.length === 0 → falls to SNAPSHOT_BLOCKED
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        quoteFacts: makeAuditOnlyQuoteFacts(),
        regimeFacts: makeAuditOnlyRegimeFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
  });

  it("T15.5 eligible MR + PIT-unsafe Quote + PIT-unsafe Regime → SNAPSHOT_PARTIAL", () => {
    // MR=ELIGIBLE, Quote=AUDIT_ONLY, Regime=AUDIT_ONLY
    // assessed=[ELIGIBLE, AUDIT_ONLY, AUDIT_ONLY] (length=3), eligible=[ELIGIBLE] (length=1)
    // 1 > 0 and 1 !== 3 → SNAPSHOT_PARTIAL
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeAuditOnlyQuoteFacts(),
        regimeFacts: makeAuditOnlyRegimeFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
  });
});
