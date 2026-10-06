/**
 * P35 — Axis C C2: Fixture-Backed Pipeline Coverage
 *
 * 25 tests / 5 groups
 *
 * Proves Axis C eligibility behavior from SourceReadinessFacts through the P38
 * mapper into P39 paper simulation bundle boundaries. No new production logic.
 * All tests are pure unit tests — no DB, no Prisma, no network, fixture-backed.
 *
 * Groups:
 *   T31 — End-to-end pipeline: facts → P38 mapper → P39 bundle (5)
 *   T32 — MonthlyRevenue mapper field isolation: fields ignored by resolver (5)
 *   T33 — Quote / Regime mapper field isolation (5)
 *   T34 — Blocked source mapper verification at mapper level (5)
 *   T35 — Governance invariants in full pipeline (5)
 *
 * Primary gap addressed (from P34):
 *   No existing test ran facts → P38 mapper → P39 bundle end-to-end.
 *   This suite closes that gap with deterministic fixture-backed assertions.
 *
 * DISCLAIMER: Test suite for Axis C C2 pipeline coverage only.
 * entersAlphaScore = false. ALWAYS. Not investment advice.
 * No buy/sell/hold semantics. No scoring formula access. No DB. No production data.
 * These tests are structural readiness audit tests only — they do not constitute
 * a simulation, optimizer call, backtest, or investment recommendation.
 *
 * Authorization: P34_AXIS_C_EVIDENCE_INVENTORY_COMMITTED (398706d)
 */

import {
  mapSourceToSimulationInputReadiness,
  buildSimulationInputReadinessMatrix,
} from "@/lib/onlineValidation/p38/SimulationInputReadinessMapper";
import { buildPaperSimulationInputBundle } from "@/lib/onlineValidation/p39/PaperSimulationInputContractBuilder";
import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIXED_AS_OF = "2026-05-01T00:00:00.000Z";
const FIXED_MATRIX_AT = "2026-05-01T00:00:00.000Z";

// ─── Fact Factories ───────────────────────────────────────────────────────────

/** MonthlyRevenue — all 3 required gates cleared (pitMetadataComplete + qualityEvidenceComplete + consumerStatus=CONSUMER_READY) */
function makeMREligibleFacts(overrides?: Partial<SourceReadinessFacts>): SourceReadinessFacts {
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
    ...overrides,
  };
}

/** Quote — pitSafeConfirmed=true is the only required gate */
function makeQuoteEligibleFacts(overrides?: Partial<SourceReadinessFacts>): SourceReadinessFacts {
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
    ...overrides,
  };
}

/** Regime — pitSafeConfirmed=true is the only required gate (same resolver as Quote) */
function makeRegimeEligibleFacts(overrides?: Partial<SourceReadinessFacts>): SourceReadinessFacts {
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
    ...overrides,
  };
}

/** NewsEvent — quality evidence complete; max reachable state is SOURCE_PRESENT_AUDIT_ONLY */
function makeNewsEventQualityCompleteFacts(): SourceReadinessFacts {
  return {
    sourceName: "NewsEvent",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: false,
  };
}

/** NewsEvent — quality evidence incomplete; expected BLOCKED_QUALITY_EVIDENCE */
function makeNewsEventQualityIncompleteFacts(): SourceReadinessFacts {
  return {
    sourceName: "NewsEvent",
    pitStatus: "NOT_ASSESSED",
    pitConfidence: "NONE",
    consumerStatus: "NOT_ASSESSED",
    qualityEvidenceComplete: false,
    pitMetadataComplete: false,
    lagEvidenceComplete: false,
    authorizationGranted: false,
    pitSafeConfirmed: false,
  };
}

/** FinancialReport — even with all fields=true, resolver always returns BLOCKED_PIT_METADATA */
function makeFinancialReportAllTrueFacts(): SourceReadinessFacts {
  return {
    sourceName: "FinancialReport",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
  };
}

/** Chip — authorizationGranted=false; expected BLOCKED_AUTHORIZATION */
function makeChipUnauthorizedFacts(): SourceReadinessFacts {
  return {
    sourceName: "Chip",
    pitStatus: "PIT_GATE_MISSING",
    pitConfidence: "NONE",
    consumerStatus: "NOT_ASSESSED",
    qualityEvidenceComplete: false,
    pitMetadataComplete: false,
    lagEvidenceComplete: false,
    authorizationGranted: false,
    pitSafeConfirmed: false,
  };
}

/** Chip — authorizationGranted=true; expected BLOCKED_LAG_EVIDENCE (auth clears, lag still missing) */
function makeChipAuthorizedFacts(): SourceReadinessFacts {
  return {
    sourceName: "Chip",
    pitStatus: "PIT_GATE_MISSING",
    pitConfidence: "NONE",
    consumerStatus: "NOT_ASSESSED",
    qualityEvidenceComplete: false,
    pitMetadataComplete: false,
    lagEvidenceComplete: false,
    authorizationGranted: true,
    pitSafeConfirmed: false,
  };
}

// ─── Group 31: End-to-end pipeline — facts → P38 mapper → P39 bundle (5) ─────

describe("P35 — Group 31: end-to-end pipeline: facts → P38 mapper → P39 bundle", () => {
  it("T31.1 — MR eligible facts → mapper → bundle: MR appears in eligibleSources, blockedSources empty", () => {
    const entry = mapSourceToSimulationInputReadiness(makeMREligibleFacts());
    const bundle = buildPaperSimulationInputBundle([entry], { asOfDate: FIXED_AS_OF });

    expect(entry.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
    expect(bundle.eligibleSources.length).toBe(1);
    expect(bundle.eligibleSources[0].sourceName).toBe("MonthlyRevenue");
    expect(bundle.blockedSources.length).toBe(0);
  });

  it("T31.2 — Quote eligible facts (pitSafeConfirmed=true) → mapper → bundle: Quote in eligibleSources", () => {
    const entry = mapSourceToSimulationInputReadiness(makeQuoteEligibleFacts());
    const bundle = buildPaperSimulationInputBundle([entry], { asOfDate: FIXED_AS_OF });

    expect(entry.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
    expect(bundle.eligibleSources.length).toBe(1);
    expect(bundle.eligibleSources[0].sourceName).toBe("Quote");
    expect(bundle.blockedSources.length).toBe(0);
  });

  it("T31.3 — Regime eligible facts (pitSafeConfirmed=true) → mapper → bundle: Regime in eligibleSources", () => {
    const entry = mapSourceToSimulationInputReadiness(makeRegimeEligibleFacts());
    const bundle = buildPaperSimulationInputBundle([entry], { asOfDate: FIXED_AS_OF });

    expect(entry.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
    expect(bundle.eligibleSources.length).toBe(1);
    expect(bundle.eligibleSources[0].sourceName).toBe("Regime");
    expect(bundle.blockedSources.length).toBe(0);
  });

  it("T31.4 — All 3 eligible facts → mapper × 3 → bundle: eligibleSources.length=3, blockedSources.length=0", () => {
    const entries = [
      mapSourceToSimulationInputReadiness(makeMREligibleFacts()),
      mapSourceToSimulationInputReadiness(makeQuoteEligibleFacts()),
      mapSourceToSimulationInputReadiness(makeRegimeEligibleFacts()),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, { asOfDate: FIXED_AS_OF });

    expect(bundle.eligibleSources.length).toBe(3);
    expect(bundle.blockedSources.length).toBe(0);
    const eligibleNames = bundle.eligibleSources.map((s) => s.sourceName);
    expect(eligibleNames).toContain("MonthlyRevenue");
    expect(eligibleNames).toContain("Quote");
    expect(eligibleNames).toContain("Regime");
  });

  it("T31.5 — All 6 source facts → mapper × 6 → bundle: 3 eligible (MR/Quote/Regime), 3 blocked (News/FR/Chip)", () => {
    const allFacts: SourceReadinessFacts[] = [
      makeMREligibleFacts(),
      makeQuoteEligibleFacts(),
      makeRegimeEligibleFacts(),
      makeNewsEventQualityCompleteFacts(),    // SOURCE_PRESENT_AUDIT_ONLY → blockedSources
      makeFinancialReportAllTrueFacts(),      // BLOCKED_PIT_METADATA → blockedSources
      makeChipUnauthorizedFacts(),            // BLOCKED_AUTHORIZATION → blockedSources
    ];
    const entries = allFacts.map(mapSourceToSimulationInputReadiness);
    const bundle = buildPaperSimulationInputBundle(entries, { asOfDate: FIXED_AS_OF });

    expect(bundle.eligibleSources.length).toBe(3);
    expect(bundle.blockedSources.length).toBe(3);

    const eligibleNames = bundle.eligibleSources.map((s) => s.sourceName);
    expect(eligibleNames).toContain("MonthlyRevenue");
    expect(eligibleNames).toContain("Quote");
    expect(eligibleNames).toContain("Regime");

    const blockedNames = bundle.blockedSources.map((s) => s.sourceName);
    expect(blockedNames).toContain("NewsEvent");
    expect(blockedNames).toContain("FinancialReport");
    expect(blockedNames).toContain("Chip");
  });
});

// ─── Group 32: MonthlyRevenue mapper field isolation — ignored fields (5) ────

describe("P35 — Group 32: MonthlyRevenue mapper field isolation — fields resolver ignores", () => {
  it("T32.1 — MR with lagEvidenceComplete=false → SIMULATION_INPUT_ELIGIBLE (mapper ignores lagEvidenceComplete)", () => {
    const facts = makeMREligibleFacts({ lagEvidenceComplete: false });
    const entry = mapSourceToSimulationInputReadiness(facts);

    // The MR resolver only checks pitMetadataComplete, qualityEvidenceComplete, consumerStatus.
    // lagEvidenceComplete is structurally present but NOT read by the MR resolver.
    expect(entry.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
  });

  it("T32.2 — MR with authorizationGranted=false → SIMULATION_INPUT_ELIGIBLE (mapper ignores authorizationGranted)", () => {
    const facts = makeMREligibleFacts({ authorizationGranted: false });
    const entry = mapSourceToSimulationInputReadiness(facts);

    // authorizationGranted is checked by the Chip resolver only; MR resolver ignores it.
    expect(entry.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
  });

  it("T32.3 — MR with pitSafeConfirmed=false → SIMULATION_INPUT_ELIGIBLE (mapper ignores pitSafeConfirmed for MR)", () => {
    const facts = makeMREligibleFacts({ pitSafeConfirmed: false });
    const entry = mapSourceToSimulationInputReadiness(facts);

    // pitSafeConfirmed is checked by the Quote/Regime resolver only; MR resolver ignores it.
    expect(entry.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
  });

  it("T32.4 — MR with pitConfidence=NONE → SIMULATION_INPUT_ELIGIBLE (mapper ignores pitConfidence for MR)", () => {
    const facts = makeMREligibleFacts({ pitConfidence: "NONE" });
    const entry = mapSourceToSimulationInputReadiness(facts);

    // pitConfidence is informational only; no resolver gates on it.
    expect(entry.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
  });

  it("T32.5 — MR with consumerStatus=SOURCE_PRESENT_AUDIT_ONLY → CONSUMER_READY_AUDIT_ONLY (not ELIGIBLE, not BLOCKED)", () => {
    const facts = makeMREligibleFacts({ consumerStatus: "SOURCE_PRESENT_AUDIT_ONLY" });
    const entry = mapSourceToSimulationInputReadiness(facts);

    // consumerStatus != CONSUMER_READY → consumer gate not cleared → CONSUMER_READY_AUDIT_ONLY.
    // Distinct from the BLOCKED_* statuses; source is present but consumer integration incomplete.
    expect(entry.simulationInputStatus).toBe("CONSUMER_READY_AUDIT_ONLY");
    expect(entry.simulationInputStatus).not.toBe("SIMULATION_INPUT_ELIGIBLE");
    expect(entry.simulationInputStatus).not.toContain("BLOCKED");
  });
});

// ─── Group 33: Quote / Regime mapper field isolation (5) ─────────────────────

describe("P35 — Group 33: Quote and Regime mapper field isolation — fields resolver ignores", () => {
  it("T33.1 — Quote with consumerStatus=BLOCKED + pitSafeConfirmed=true → SIMULATION_INPUT_ELIGIBLE (consumerStatus ignored for Quote)", () => {
    const facts = makeQuoteEligibleFacts({ consumerStatus: "BLOCKED" });
    const entry = mapSourceToSimulationInputReadiness(facts);

    // resolveQuoteOrRegime checks ONLY pitSafeConfirmed.
    // consumerStatus=BLOCKED does not affect Quote eligibility.
    expect(entry.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
  });

  it("T33.2 — Quote with qualityEvidenceComplete=false + pitSafeConfirmed=true → SIMULATION_INPUT_ELIGIBLE (quality evidence ignored for Quote)", () => {
    const facts = makeQuoteEligibleFacts({ qualityEvidenceComplete: false });
    const entry = mapSourceToSimulationInputReadiness(facts);

    // qualityEvidenceComplete is checked by MR and NewsEvent resolvers; not by Quote/Regime.
    expect(entry.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
  });

  it("T33.3 — Quote with lagEvidenceComplete=false + pitSafeConfirmed=true → SIMULATION_INPUT_ELIGIBLE (lagEvidenceComplete ignored for Quote)", () => {
    const facts = makeQuoteEligibleFacts({ lagEvidenceComplete: false });
    const entry = mapSourceToSimulationInputReadiness(facts);

    expect(entry.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
  });

  it("T33.4 — Quote with authorizationGranted=false + pitSafeConfirmed=true → SIMULATION_INPUT_ELIGIBLE (authorizationGranted ignored for Quote)", () => {
    const facts = makeQuoteEligibleFacts({ authorizationGranted: false });
    const entry = mapSourceToSimulationInputReadiness(facts);

    expect(entry.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
  });

  it("T33.5 — Regime with pitSafeConfirmed=false → SOURCE_PRESENT_AUDIT_ONLY (Regime-specific: same resolver as Quote)", () => {
    const facts = makeRegimeEligibleFacts({ pitSafeConfirmed: false });
    const entry = mapSourceToSimulationInputReadiness(facts);

    // Regime uses resolveQuoteOrRegime: pitSafeConfirmed=false → SOURCE_PRESENT_AUDIT_ONLY.
    // Max possible status without pitSafeConfirmed; Regime cannot reach ELIGIBLE.
    expect(entry.simulationInputStatus).toBe("SOURCE_PRESENT_AUDIT_ONLY");
    expect(entry.sourceName).toBe("Regime");
  });
});

// ─── Group 34: Blocked source mapper verification at mapper level (5) ─────────

describe("P35 — Group 34: blocked source mapper verification at mapper call level", () => {
  it("T34.1 — NewsEvent with qualityEvidenceComplete=false → BLOCKED_QUALITY_EVIDENCE", () => {
    const entry = mapSourceToSimulationInputReadiness(makeNewsEventQualityIncompleteFacts());

    expect(entry.simulationInputStatus).toBe("BLOCKED_QUALITY_EVIDENCE");
    expect(entry.sourceName).toBe("NewsEvent");
    // Blocking reasons should reference NLP quality
    expect(entry.blockingReasons.some((r) => r.toLowerCase().includes("nlp") || r.toLowerCase().includes("quality"))).toBe(true);
  });

  it("T34.2 — NewsEvent with qualityEvidenceComplete=true → SOURCE_PRESENT_AUDIT_ONLY (max reachable state — can never reach ELIGIBLE)", () => {
    const entry = mapSourceToSimulationInputReadiness(makeNewsEventQualityCompleteFacts());

    // Even with all fields complete, resolveNewsEvent always returns SOURCE_PRESENT_AUDIT_ONLY.
    // NewsEvent has no code path to SIMULATION_INPUT_ELIGIBLE.
    expect(entry.simulationInputStatus).toBe("SOURCE_PRESENT_AUDIT_ONLY");
    expect(entry.simulationInputStatus).not.toBe("SIMULATION_INPUT_ELIGIBLE");
    expect(entry.sourceName).toBe("NewsEvent");
  });

  it("T34.3 — FinancialReport with all facts set to true → still BLOCKED_PIT_METADATA (resolver is unconditional)", () => {
    // resolveFinancialReport ignores ALL SourceReadinessFacts fields.
    // It always returns BLOCKED_PIT_METADATA with 4 hardcoded blocking reasons.
    const entry = mapSourceToSimulationInputReadiness(makeFinancialReportAllTrueFacts());

    expect(entry.simulationInputStatus).toBe("BLOCKED_PIT_METADATA");
    expect(entry.sourceName).toBe("FinancialReport");
    // Must always have the schema migration blocking reasons
    expect(entry.blockingReasons.some((r) => r.includes("releaseDate"))).toBe(true);
    expect(entry.blockingReasons.length).toBeGreaterThanOrEqual(4);
  });

  it("T34.4 — Chip with authorizationGranted=false → BLOCKED_AUTHORIZATION", () => {
    const entry = mapSourceToSimulationInputReadiness(makeChipUnauthorizedFacts());

    expect(entry.simulationInputStatus).toBe("BLOCKED_AUTHORIZATION");
    expect(entry.sourceName).toBe("Chip");
    expect(entry.blockingReasons.some((r) => r.toLowerCase().includes("authorization") || r.toLowerCase().includes("availableat"))).toBe(true);
  });

  it("T34.5 — Chip with authorizationGranted=true → BLOCKED_LAG_EVIDENCE (auth clears; lag evidence still missing)", () => {
    // authorizationGranted=true advances Chip past the BLOCKED_AUTHORIZATION gate,
    // but the lag evidence gate is not yet cleared → BLOCKED_LAG_EVIDENCE.
    // Chip can never reach SIMULATION_INPUT_ELIGIBLE via the current resolver.
    const entry = mapSourceToSimulationInputReadiness(makeChipAuthorizedFacts());

    expect(entry.simulationInputStatus).toBe("BLOCKED_LAG_EVIDENCE");
    expect(entry.sourceName).toBe("Chip");
    expect(entry.simulationInputStatus).not.toBe("SIMULATION_INPUT_ELIGIBLE");
    expect(entry.blockingReasons.some((r) => r.toLowerCase().includes("lag") || r.toLowerCase().includes("availableat"))).toBe(true);
  });
});

// ─── Group 35: Governance invariants in full pipeline (5) ─────────────────────

describe("P35 — Group 35: governance invariants preserved throughout the full pipeline", () => {
  it("T35.1 — all 6 mapper outputs have entersAlphaScore=false and paperOnly=true and noInvestmentAdvice=true", () => {
    const allFacts: SourceReadinessFacts[] = [
      makeMREligibleFacts(),
      makeQuoteEligibleFacts(),
      makeRegimeEligibleFacts(),
      makeNewsEventQualityCompleteFacts(),
      makeFinancialReportAllTrueFacts(),
      makeChipUnauthorizedFacts(),
    ];

    for (const facts of allFacts) {
      const entry = mapSourceToSimulationInputReadiness(facts);
      expect(entry.entersAlphaScore).toBe(false);
      expect(entry.paperOnly).toBe(true);
      expect(entry.noInvestmentAdvice).toBe(true);
    }
  });

  it("T35.2 — bundle from 3 eligible entries preserves all root governance flags: entersAlphaScore=false, paperOnly=true, dryRunOnly=true, notSimulationExecution=true, notRealBacktest=true", () => {
    const entries = [
      mapSourceToSimulationInputReadiness(makeMREligibleFacts()),
      mapSourceToSimulationInputReadiness(makeQuoteEligibleFacts()),
      mapSourceToSimulationInputReadiness(makeRegimeEligibleFacts()),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, { asOfDate: FIXED_AS_OF });

    expect(bundle.entersAlphaScore).toBe(false);
    expect(bundle.paperOnly).toBe(true);
    expect(bundle.dryRunOnly).toBe(true);
    expect(bundle.notSimulationExecution).toBe(true);
    expect(bundle.notRealBacktest).toBe(true);
    expect(bundle.noInvestmentAdvice).toBe(true);
    expect(bundle.noBuySellActionSemantics).toBe(true);
  });

  it("T35.3 — blocked sources (NewsEvent/FinancialReport/Chip) never appear in eligibleSources when constructed from mapper output", () => {
    const blockedFacts: SourceReadinessFacts[] = [
      makeNewsEventQualityCompleteFacts(),
      makeFinancialReportAllTrueFacts(),
      makeChipUnauthorizedFacts(),
      makeChipAuthorizedFacts(),
    ];
    const entries = blockedFacts.map(mapSourceToSimulationInputReadiness);
    const bundle = buildPaperSimulationInputBundle(entries, { asOfDate: FIXED_AS_OF });

    // None of the blocked sources should appear in eligibleSources
    expect(bundle.eligibleSources.length).toBe(0);
    expect(bundle.blockedSources.length).toBe(4); // 2 Chip variants + News + FR

    const eligibleNames = bundle.eligibleSources.map((s) => s.sourceName);
    expect(eligibleNames).not.toContain("NewsEvent");
    expect(eligibleNames).not.toContain("FinancialReport");
    expect(eligibleNames).not.toContain("Chip");
  });

  it("T35.4 — eligible source entries from pipeline each have entersAlphaScore=false in the bundle output", () => {
    const entries = [
      mapSourceToSimulationInputReadiness(makeMREligibleFacts()),
      mapSourceToSimulationInputReadiness(makeQuoteEligibleFacts()),
      mapSourceToSimulationInputReadiness(makeRegimeEligibleFacts()),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, { asOfDate: FIXED_AS_OF });

    for (const source of bundle.eligibleSources) {
      expect(source.entersAlphaScore).toBe(false);
      expect(source.paperOnly).toBe(true);
      expect(source.dryRunOnly).toBe(true);
      expect(source.noInvestmentAdvice).toBe(true);
      expect(source.noBuySellActionSemantics).toBe(true);
    }
  });

  it("T35.5 — buildSimulationInputReadinessMatrix from all 6 sources has matrix-level governance invariants and correct eligible/blocked counts", () => {
    const allFacts: SourceReadinessFacts[] = [
      makeMREligibleFacts(),
      makeQuoteEligibleFacts(),
      makeRegimeEligibleFacts(),
      makeNewsEventQualityCompleteFacts(),
      makeFinancialReportAllTrueFacts(),
      makeChipUnauthorizedFacts(),
    ];
    const matrix = buildSimulationInputReadinessMatrix(allFacts, {
      fixedGeneratedAt: FIXED_MATRIX_AT,
    });

    expect(matrix.entersAlphaScore).toBe(false);
    expect(matrix.paperOnly).toBe(true);
    expect(matrix.dryRunOnly).toBe(true);
    expect(matrix.notInvestmentRecommendation).toBe(true);
    expect(matrix.noBuySellActionSemantics).toBe(true);
    expect(matrix.entries.length).toBe(6);

    const eligibleCount = matrix.entries.filter(
      (e) => e.simulationInputStatus === "SIMULATION_INPUT_ELIGIBLE"
    ).length;
    const blockedOrAuditCount = matrix.entries.filter(
      (e) => e.simulationInputStatus !== "SIMULATION_INPUT_ELIGIBLE"
    ).length;

    expect(eligibleCount).toBe(3);     // MR, Quote, Regime
    expect(blockedOrAuditCount).toBe(3); // NewsEvent (SPAO), FinancialReport (BLOCKED_PIT_METADATA), Chip (BLOCKED_AUTHORIZATION)
    expect(matrix.generatedAt).toBe(FIXED_MATRIX_AT);
  });
});
