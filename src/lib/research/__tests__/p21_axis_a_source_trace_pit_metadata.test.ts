/**
 * P21 — Axis A v2: sourceTrace Auditability + PIT Metadata Exposure
 *
 * Extends the Controlled Research Snapshot test suite with targeted coverage of:
 *
 *   T16.x  sourceTrace auditability — caller pipeline identity is preserved across
 *           all snapshot readiness states; per-source sourceTrace in facts does not
 *           leak into or override the snapshot-level sourceTrace.
 *
 *   T17.x  PIT metadata exposure — pitMetadataComplete flag drives BLOCKED_PIT_METADATA
 *           for MonthlyRevenue; pitSafeConfirmed drives eligibility for Quote/Regime;
 *           the snapshot correctly reflects per-source PIT metadata gate outcomes.
 *
 *   T18.x  Cross-invariant: PIT metadata state + sourceTrace are both preserved
 *           correctly in every readiness status (READY / PARTIAL / BLOCKED / BLOCKED_PIT).
 *
 * All tests are pure unit tests — no DB, no Prisma, no side effects.
 *
 * DISCLAIMER: Test suite for Axis A research snapshot governance extension only.
 * entersAlphaScore = false. ALWAYS. Not investment advice.
 * No buy/sell/hold semantics. No scoring formula access.
 */

import {
  CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT,
  SNAPSHOT_FORBIDDEN_FIELDS,
  validateSnapshotInvariants,
} from "../ControlledResearchSnapshot";

import {
  buildControlledResearchSnapshot,
  type SnapshotBuildInput,
} from "../ControlledResearchSnapshotBuilder";

import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIXED_TODAY = "2026-05-23";
const FIXED_GENERATED_AT = "2026-05-23T12:00:00.000Z";
const PAST_DATE = "2026-05-01";
const FUTURE_DATE = "2099-12-31";

// ─── Fact Factories ───────────────────────────────────────────────────────────

function makeEligibleMRFacts(sourceTrace?: string): SourceReadinessFacts {
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
    sourceTrace: sourceTrace ?? "p36-consumer-v1",
  };
}

function makeEligibleQuoteFacts(sourceTrace?: string): SourceReadinessFacts {
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
    sourceTrace: sourceTrace ?? "quote-pit-gate-v1",
  };
}

function makeEligibleRegimeFacts(sourceTrace?: string): SourceReadinessFacts {
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
    sourceTrace: sourceTrace ?? "regime-pit-gate-v1",
  };
}

/** MR with pitMetadataComplete=false → BLOCKED_PIT_METADATA */
function makePitMetadataIncompleteMRFacts(): SourceReadinessFacts {
  return {
    sourceName: "MonthlyRevenue",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: false, // <-- PIT metadata not complete
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
  };
}

/** MR with qualityEvidenceComplete=false → BLOCKED_QUALITY_EVIDENCE */
function makeQualityIncompleteMRFacts(): SourceReadinessFacts {
  return {
    sourceName: "MonthlyRevenue",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: false, // <-- quality evidence missing
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
  };
}

/** MR where consumer is not yet ready → CONSUMER_READY_AUDIT_ONLY → AUDIT_ONLY */
function makeConsumerNotReadyMRFacts(): SourceReadinessFacts {
  return {
    sourceName: "MonthlyRevenue",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "BLOCKED", // <-- consumer not yet integrated
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
  };
}

/** Quote with pitSafeConfirmed=false → SOURCE_PRESENT_AUDIT_ONLY → AUDIT_ONLY */
function makePitUnsafeQuoteFacts(): SourceReadinessFacts {
  return {
    sourceName: "Quote",
    pitStatus: "PIT_GATE_MISSING", // pitStatus is NOT used by mapper for Quote
    pitConfidence: "NONE",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: false, // <-- mapper only checks this for Quote/Regime
  };
}

/** Quote with pitStatus=NOT_ASSESSED but pitSafeConfirmed=true → ELIGIBLE */
function makeNotAssessedPitStatusEligibleQuote(): SourceReadinessFacts {
  return {
    sourceName: "Quote",
    pitStatus: "NOT_ASSESSED", // pitStatus is irrelevant for Quote/Regime mapper path
    pitConfidence: "NONE",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true, // mapper only checks this → ELIGIBLE
  };
}

/** MR with pitStatus=PIT_GATE_MISSING but pitMetadataComplete=true → mapper ignores pitStatus for MR */
function makePitStatusMissingButMetadataCompleteMRFacts(): SourceReadinessFacts {
  return {
    sourceName: "MonthlyRevenue",
    pitStatus: "PIT_GATE_MISSING", // pitStatus NOT checked by MonthlyRevenue resolver
    pitConfidence: "NONE",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true, // only this matters for MR
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
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

// ─── T16: sourceTrace Auditability ───────────────────────────────────────────

describe("T16: sourceTrace auditability", () => {
  it("T16.1 snapshot.sourceTrace is the caller-provided trace, not the per-source facts.sourceTrace", () => {
    const callerTrace = "p21-axis-a-caller-pipeline";
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        sourceTrace: callerTrace,
        monthlyRevenueFacts: makeEligibleMRFacts("p36-consumer-v1"), // per-source trace
        quoteFacts: makeEligibleQuoteFacts("quote-pit-gate-v1"),     // per-source trace
      })
    );
    // Snapshot's sourceTrace is the caller-level trace, not the per-source traces
    expect(snap.sourceTrace).toBe(callerTrace);
    expect(snap.sourceTrace).not.toBe("p36-consumer-v1");
    expect(snap.sourceTrace).not.toBe("quote-pit-gate-v1");
  });

  it("T16.2 per-source sourceTrace in facts does not appear at snapshot top level", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts("p36-consumer-v1"),
      })
    );
    const keys = Object.keys(snap as Record<string, unknown>);
    // sourceTrace appears once (the snapshot-level field) but not the per-source value
    expect(snap.sourceTrace).toBe("ControlledResearchSnapshotBuilder-v0");
    // No extra field carrying the facts.sourceTrace value
    const allValues = Object.values(snap as Record<string, unknown>);
    // The value "p36-consumer-v1" must not appear as a top-level value in the snapshot
    // (it lives inside the facts which are not part of the snapshot output)
    expect(allValues.includes("p36-consumer-v1")).toBe(false);
  });

  it("T16.3 two snapshots from different caller pipelines have distinct sourceTrace", () => {
    const snapA = buildControlledResearchSnapshot(
      makeBaseInput({
        sourceTrace: "p21-pipeline-A",
        monthlyRevenueFacts: makeEligibleMRFacts(),
      })
    );
    const snapB = buildControlledResearchSnapshot(
      makeBaseInput({
        sourceTrace: "p21-pipeline-B",
        monthlyRevenueFacts: makeEligibleMRFacts(),
      })
    );
    expect(snapA.sourceTrace).toBe("p21-pipeline-A");
    expect(snapB.sourceTrace).toBe("p21-pipeline-B");
    expect(snapA.sourceTrace).not.toBe(snapB.sourceTrace);
  });

  it("T16.4 sourceTrace is preserved in SNAPSHOT_BLOCKED_PIT (future-dated)", () => {
    const callerTrace = "p21-pit-blocked-audit-trace";
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        asOfDate: FUTURE_DATE,
        sourceTrace: callerTrace,
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED_PIT");
    expect(snap.sourceTrace).toBe(callerTrace);
  });

  it("T16.5 sourceTrace is preserved in SNAPSHOT_BLOCKED (no sources provided)", () => {
    const callerTrace = "p21-blocked-no-sources";
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ sourceTrace: callerTrace })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
    expect(snap.sourceTrace).toBe(callerTrace);
  });

  it("T16.6 sourceTrace is preserved in SNAPSHOT_PARTIAL", () => {
    const callerTrace = "p21-partial-audit";
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        sourceTrace: callerTrace,
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makePitUnsafeQuoteFacts(), // AUDIT_ONLY → partial
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
    expect(snap.sourceTrace).toBe(callerTrace);
  });

  it("T16.7 sourceTrace contains no forbidden investment-advice keywords", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        sourceTrace: "p21-axis-a-research-pipeline-v1",
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_READY");
    const forbiddenKeywords = ["buy", "sell", "hold", "alpha", "score", "profit", "return", "win-rate"];
    for (const kw of forbiddenKeywords) {
      expect(snap.sourceTrace.toLowerCase()).not.toContain(kw);
    }
  });

  it("T16.8 sourceTrace with a structured audit identifier is preserved verbatim", () => {
    const structuredTrace = "p21-axis-a::research-snapshot::2026-05-23::v1::symbol=2330";
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        sourceTrace: structuredTrace,
        monthlyRevenueFacts: makeEligibleMRFacts(),
      })
    );
    expect(snap.sourceTrace).toBe(structuredTrace);
  });

  it("T16.9 snapshot.sourceTrace field is present as a string in every readiness state", () => {
    const states = [
      buildControlledResearchSnapshot(makeBaseInput()),
      buildControlledResearchSnapshot(makeBaseInput({ asOfDate: FUTURE_DATE })),
      buildControlledResearchSnapshot(makeBaseInput({ monthlyRevenueFacts: makeEligibleMRFacts() })),
      buildControlledResearchSnapshot(
        makeBaseInput({
          monthlyRevenueFacts: makeEligibleMRFacts(),
          quoteFacts: makePitUnsafeQuoteFacts(),
        })
      ),
    ];
    for (const snap of states) {
      expect(typeof snap.sourceTrace).toBe("string");
    }
  });

  it("T16.10 default sourceTrace equals builder identifier string", () => {
    const snap = buildControlledResearchSnapshot(makeBaseInput());
    expect(snap.sourceTrace).toBe("ControlledResearchSnapshotBuilder-v0");
  });
});

// ─── T17: PIT Metadata Exposure ──────────────────────────────────────────────

describe("T17: PIT metadata exposure", () => {
  it("T17.1 MR with pitMetadataComplete=false → pitSafeInputs.monthlyRevenue is BLOCKED", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ monthlyRevenueFacts: makePitMetadataIncompleteMRFacts() })
    );
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("BLOCKED");
  });

  it("T17.2 MR with pitMetadataComplete=false → monthlyRevenueReadiness is BLOCKED_PIT_METADATA", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ monthlyRevenueFacts: makePitMetadataIncompleteMRFacts() })
    );
    expect(snap.monthlyRevenueReadiness).toBe("BLOCKED_PIT_METADATA");
  });

  it("T17.3 MR with pitMetadataComplete=false → blockingReasons mentions PIT metadata", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ monthlyRevenueFacts: makePitMetadataIncompleteMRFacts() })
    );
    const hasMetadataBlocker = snap.blockingReasons.some(
      (r) => r.toLowerCase().includes("pit metadata")
    );
    expect(hasMetadataBlocker).toBe(true);
  });

  it("T17.4 MR with pitMetadataComplete=false → researchReadinessStatus is SNAPSHOT_BLOCKED", () => {
    // Only MR is assessed; MR is BLOCKED → no eligible sources → SNAPSHOT_BLOCKED
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ monthlyRevenueFacts: makePitMetadataIncompleteMRFacts() })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
  });

  it("T17.5 MR with qualityEvidenceComplete=false → BLOCKED_QUALITY_EVIDENCE → pitSafeInputs.monthlyRevenue is BLOCKED", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ monthlyRevenueFacts: makeQualityIncompleteMRFacts() })
    );
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("BLOCKED");
    expect(snap.monthlyRevenueReadiness).toBe("BLOCKED_QUALITY_EVIDENCE");
  });

  it("T17.6 MR with pitMetadataComplete=true but consumer not ready → pitSafeInputs.monthlyRevenue is AUDIT_ONLY", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ monthlyRevenueFacts: makeConsumerNotReadyMRFacts() })
    );
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("AUDIT_ONLY");
    expect(snap.monthlyRevenueReadiness).toBe("CONSUMER_READY_AUDIT_ONLY");
  });

  it("T17.7 Quote mapper ignores pitStatus — pitStatus=NOT_ASSESSED + pitSafeConfirmed=true → ELIGIBLE", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ quoteFacts: makeNotAssessedPitStatusEligibleQuote() })
    );
    // Quote/Regime mapper ONLY checks pitSafeConfirmed; pitStatus is not used
    expect(snap.pitSafeInputs.quote).toBe("ELIGIBLE");
    expect(snap.quoteReadiness).toBe("SIMULATION_INPUT_ELIGIBLE");
  });

  it("T17.8 Quote with pitStatus=PIT_GATE_MISSING + pitSafeConfirmed=false → AUDIT_ONLY", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ quoteFacts: makePitUnsafeQuoteFacts() })
    );
    // pitStatus is irrelevant for Quote; only pitSafeConfirmed drives eligibility
    expect(snap.pitSafeInputs.quote).toBe("AUDIT_ONLY");
    expect(snap.quoteReadiness).toBe("SOURCE_PRESENT_AUDIT_ONLY");
  });

  it("T17.9 MR mapper ignores pitStatus — pitStatus=PIT_GATE_MISSING but pitMetadataComplete=true → ELIGIBLE", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({ monthlyRevenueFacts: makePitStatusMissingButMetadataCompleteMRFacts() })
    );
    // MonthlyRevenue resolver ONLY checks pitMetadataComplete (not pitStatus field)
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("ELIGIBLE");
    expect(snap.monthlyRevenueReadiness).toBe("SIMULATION_INPUT_ELIGIBLE");
  });

  it("T17.10 eligible MR + PIT-metadata-incomplete Quote not applicable (Quote mapper ignores pitMetadataComplete)", () => {
    // Quote mapper only checks pitSafeConfirmed — pitMetadataComplete is ignored for Quote
    const quoteFacts: SourceReadinessFacts = {
      sourceName: "Quote",
      pitStatus: "PIT_GATE_PRESENT",
      pitConfidence: "HIGH",
      consumerStatus: "CONSUMER_READY",
      qualityEvidenceComplete: true,
      pitMetadataComplete: false, // not checked by Quote mapper
      lagEvidenceComplete: true,
      authorizationGranted: true,
      pitSafeConfirmed: true, // this is all that matters for Quote
    };
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts,
      })
    );
    // Both MR and Quote resolve to ELIGIBLE
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("ELIGIBLE");
    expect(snap.pitSafeInputs.quote).toBe("ELIGIBLE");
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });

  it("T17.11 pitMetadataComplete=false for MR blocks the snapshot even when Quote is eligible", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makePitMetadataIncompleteMRFacts(), // BLOCKED
        quoteFacts: makeEligibleQuoteFacts(),                    // ELIGIBLE
      })
    );
    // MR=BLOCKED, Quote=ELIGIBLE → some eligible, some not → SNAPSHOT_PARTIAL
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("BLOCKED");
    expect(snap.pitSafeInputs.quote).toBe("ELIGIBLE");
  });

  it("T17.12 all three sources with pitMetadataComplete=false for MR + eligible Quote + eligible Regime → SNAPSHOT_PARTIAL", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makePitMetadataIncompleteMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
    expect(snap.blockingReasons.some((r) => r.startsWith("MonthlyRevenue:"))).toBe(true);
  });
});

// ─── T18: Cross-invariant: PIT metadata + sourceTrace + governance flags ──────

describe("T18: PIT metadata state + sourceTrace preserved across all readiness statuses", () => {
  it("T18.1 SNAPSHOT_READY: sourceTrace present, governance flags intact, no PIT violations", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        sourceTrace: "p21-t18-ready",
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_READY");
    expect(snap.sourceTrace).toBe("p21-t18-ready");
    expect(snap.entersAlphaScore).toBe(false);
    expect(snap.notInvestmentRecommendation).toBe(true);
    expect(snap.paperOnly).toBe(true);
    expect(snap.dryRun).toBe(true);
    expect(snap.blockingReasons).toHaveLength(0);
  });

  it("T18.2 SNAPSHOT_PARTIAL: sourceTrace present, governance flags intact, blockingReasons non-empty", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        sourceTrace: "p21-t18-partial",
        monthlyRevenueFacts: makePitMetadataIncompleteMRFacts(), // BLOCKED
        quoteFacts: makeEligibleQuoteFacts(),                    // ELIGIBLE
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
    expect(snap.sourceTrace).toBe("p21-t18-partial");
    expect(snap.entersAlphaScore).toBe(false);
    expect(snap.notInvestmentRecommendation).toBe(true);
    expect(snap.blockingReasons.length).toBeGreaterThan(0);
  });

  it("T18.3 SNAPSHOT_BLOCKED: sourceTrace present, governance flags intact", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        sourceTrace: "p21-t18-blocked",
        monthlyRevenueFacts: makePitMetadataIncompleteMRFacts(),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
    expect(snap.sourceTrace).toBe("p21-t18-blocked");
    expect(snap.entersAlphaScore).toBe(false);
    expect(snap.notInvestmentRecommendation).toBe(true);
  });

  it("T18.4 SNAPSHOT_BLOCKED_PIT: sourceTrace present, governance flags intact", () => {
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        asOfDate: FUTURE_DATE,
        sourceTrace: "p21-t18-blocked-pit",
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED_PIT");
    expect(snap.sourceTrace).toBe("p21-t18-blocked-pit");
    expect(snap.entersAlphaScore).toBe(false);
    expect(snap.notInvestmentRecommendation).toBe(true);
    expect(snap.paperOnly).toBe(true);
    expect(snap.dryRun).toBe(true);
  });

  it("T18.5 validateSnapshotInvariants passes on all readiness states with PIT metadata variations", () => {
    const snaps = [
      buildControlledResearchSnapshot(
        makeBaseInput({
          monthlyRevenueFacts: makeEligibleMRFacts(),
          quoteFacts: makeEligibleQuoteFacts(),
          regimeFacts: makeEligibleRegimeFacts(),
        })
      ),
      buildControlledResearchSnapshot(
        makeBaseInput({
          monthlyRevenueFacts: makePitMetadataIncompleteMRFacts(),
          quoteFacts: makeEligibleQuoteFacts(),
        })
      ),
      buildControlledResearchSnapshot(
        makeBaseInput({ monthlyRevenueFacts: makePitMetadataIncompleteMRFacts() })
      ),
      buildControlledResearchSnapshot(makeBaseInput({ asOfDate: FUTURE_DATE })),
    ];
    for (const snap of snaps) {
      const result = validateSnapshotInvariants(snap);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    }
  });

  it("T18.6 no forbidden fields in snapshot output for any PIT metadata state", () => {
    const snaps = [
      buildControlledResearchSnapshot(
        makeBaseInput({ monthlyRevenueFacts: makePitMetadataIncompleteMRFacts() })
      ),
      buildControlledResearchSnapshot(
        makeBaseInput({ monthlyRevenueFacts: makeQualityIncompleteMRFacts() })
      ),
      buildControlledResearchSnapshot(
        makeBaseInput({ monthlyRevenueFacts: makeConsumerNotReadyMRFacts() })
      ),
      buildControlledResearchSnapshot(
        makeBaseInput({ quoteFacts: makeNotAssessedPitStatusEligibleQuote() })
      ),
    ];
    for (const snap of snaps) {
      const keys = Object.keys(snap as Record<string, unknown>);
      const found = keys.filter((k) =>
        (SNAPSHOT_FORBIDDEN_FIELDS as readonly string[]).includes(k)
      );
      expect(found).toHaveLength(0);
    }
  });

  it("T18.7 contract invariants still hold regardless of PIT metadata completeness", () => {
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.entersAlphaScore).toBe(false);
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.notInvestmentRecommendation).toBe(true);
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.paperOnly).toBe(true);
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.dryRun).toBe(true);
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.noDbApply).toBe(true);
    expect(CONTROLLED_RESEARCH_SNAPSHOT_CONTRACT.noScoringFormulaAccess).toBe(true);
  });

  it("T18.8 pitSafeInputs reflects distinct per-source PIT metadata outcomes in same snapshot", () => {
    // MR: pitMetadataComplete=false → BLOCKED
    // Quote: pitSafeConfirmed=true → ELIGIBLE
    // Regime: pitSafeConfirmed=false → AUDIT_ONLY
    const quoteFacts: SourceReadinessFacts = makeEligibleQuoteFacts();
    const regimeFacts: SourceReadinessFacts = {
      ...makeEligibleRegimeFacts(),
      pitSafeConfirmed: false, // AUDIT_ONLY
    };
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        monthlyRevenueFacts: makePitMetadataIncompleteMRFacts(),
        quoteFacts,
        regimeFacts,
      })
    );
    expect(snap.pitSafeInputs.monthlyRevenue).toBe("BLOCKED");
    expect(snap.pitSafeInputs.quote).toBe("ELIGIBLE");
    expect(snap.pitSafeInputs.regime).toBe("AUDIT_ONLY");
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
  });

  it("T18.9 deterministic: same PIT metadata inputs → same pitSafeInputs across two builds", () => {
    const inputA = makeBaseInput({
      monthlyRevenueFacts: makePitMetadataIncompleteMRFacts(),
      quoteFacts: makeEligibleQuoteFacts(),
    });
    const a = buildControlledResearchSnapshot(inputA);
    const b = buildControlledResearchSnapshot(inputA);
    expect(a.pitSafeInputs).toEqual(b.pitSafeInputs);
    expect(a.researchReadinessStatus).toBe(b.researchReadinessStatus);
  });

  it("T18.10 SNAPSHOT_READY with custom sourceTrace has exact sourceTrace value in output", () => {
    const trace = "p21-axis-a-v2::pit-metadata::2026-05-23";
    const snap = buildControlledResearchSnapshot(
      makeBaseInput({
        sourceTrace: trace,
        monthlyRevenueFacts: makeEligibleMRFacts("p36-consumer-v1"),
        quoteFacts: makeEligibleQuoteFacts("quote-pit-gate-v1"),
        regimeFacts: makeEligibleRegimeFacts("regime-pit-gate-v1"),
      })
    );
    expect(snap.researchReadinessStatus).toBe("SNAPSHOT_READY");
    expect(snap.sourceTrace).toBe(trace);
    // Per-source traces must not appear in the snapshot's sourceTrace field
    expect(snap.sourceTrace).not.toContain("p36-consumer-v1");
    expect(snap.sourceTrace).not.toContain("quote-pit-gate-v1");
    expect(snap.sourceTrace).not.toContain("regime-pit-gate-v1");
  });
});
