/**
 * P37 — Axis C C4: Integration Guard Test Coverage
 *
 * 19 tests / 4 groups
 *
 * Closes the test gaps identified in P36 Section 9 / Section 10.
 * All tests are pure unit tests — no DB, no Prisma, no network, fixture-backed.
 *
 * Groups:
 *   T36 — buildDefaultPaperSimulationInputBundle() validation (5)
 *   T37 — summarizeSimulationInputReadinessMatrix() count validation (5)
 *   T38 — Pipeline determinism (4)
 *   T39 — Forbidden-field / boundary guard (5)
 *
 * Gaps closed from P36 Section 9:
 *   [HIGH]   buildDefaultPaperSimulationInputBundle() — canonical 3+3 partition
 *   [MEDIUM] summarizeSimulationInputReadinessMatrix() — count summary
 *   [MEDIUM] Pipeline determinism — repeated call stability
 *   [MEDIUM] Forbidden-field runtime guard — BLOCKED_AUTHORIZATION on forbidden keys
 *
 * DISCLAIMER: Test suite for Axis C C4 integration guard coverage only.
 * entersAlphaScore = false. ALWAYS. Not investment advice.
 * No buy/sell/hold semantics. No scoring formula access. No DB. No production data.
 * These tests are structural readiness audit tests only — they do not constitute
 * a simulation, optimizer call, backtest, or investment recommendation.
 *
 * Authorization: P36_AXIS_C_INTEGRATION_GUARD_DEFINED (c16b188)
 */

import {
  mapSourceToSimulationInputReadiness,
  buildSimulationInputReadinessMatrix,
  summarizeSimulationInputReadinessMatrix,
} from "@/lib/onlineValidation/p38/SimulationInputReadinessMapper";
import {
  buildPaperSimulationInputBundle,
  buildDefaultPaperSimulationInputBundle,
} from "@/lib/onlineValidation/p39/PaperSimulationInputContractBuilder";
import {
  PAPER_SIMULATION_CONTRACT_MODE,
  P39_ELIGIBLE_SOURCES,
  P39_BLOCKED_SOURCES,
} from "@/lib/onlineValidation/p39/PaperSimulationInputContract";
import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIXED_AS_OF = "2026-05-25T00:00:00.000Z";
const FIXED_MATRIX_AT = "2026-05-25T00:00:00.000Z";

// ─── Fact Factories ───────────────────────────────────────────────────────────

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

function makeNewsEventAuditOnlyFacts(): SourceReadinessFacts {
  return {
    sourceName: "NewsEvent",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "SOURCE_PRESENT_AUDIT_ONLY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: false,
  };
}

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

// ─── Group T36: buildDefaultPaperSimulationInputBundle() validation (5) ───────

describe("P37 — Group T36: buildDefaultPaperSimulationInputBundle() canonical partition", () => {
  it("T36.1 — default bundle has exactly 3 eligible sources", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_AS_OF });
    expect(bundle.eligibleSources).toHaveLength(3);
  });

  it("T36.2 — eligible sources are exactly MonthlyRevenue, Quote, Regime", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_AS_OF });
    const eligibleNames = bundle.eligibleSources.map((s) => s.sourceName).sort();
    expect(eligibleNames).toEqual([...P39_ELIGIBLE_SOURCES].sort());
  });

  it("T36.3 — default bundle has exactly 3 blocked sources", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_AS_OF });
    expect(bundle.blockedSources).toHaveLength(3);
  });

  it("T36.4 — blocked sources are exactly NewsEvent, FinancialReport, Chip", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_AS_OF });
    const blockedNames = bundle.blockedSources.map((s) => s.sourceName).sort();
    expect(blockedNames).toEqual([...P39_BLOCKED_SOURCES].sort());
  });

  it("T36.5 — no source appears in both eligible and blocked lists; all eligible entries have entersAlphaScore=false and mode is contract mode", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_AS_OF });
    const eligibleNames = new Set(bundle.eligibleSources.map((s) => s.sourceName));
    const blockedNames = new Set(bundle.blockedSources.map((s) => s.sourceName));
    const intersection = [...eligibleNames].filter((n) => blockedNames.has(n));

    expect(intersection).toHaveLength(0);
    bundle.eligibleSources.forEach((entry) => {
      expect(entry.entersAlphaScore).toBe(false);
    });
    expect(bundle.mode).toBe(PAPER_SIMULATION_CONTRACT_MODE);
    expect(bundle.entersAlphaScore).toBe(false);
    expect(bundle.paperOnly).toBe(true);
  });
});

// ─── Group T37: summarizeSimulationInputReadinessMatrix() counts (5) ──────────

describe("P37 — Group T37: summarizeSimulationInputReadinessMatrix() count validation", () => {
  it("T37.1 — 3 eligible facts produce eligible count = 3", () => {
    const factsArray = [
      makeMREligibleFacts(),
      makeQuoteEligibleFacts(),
      makeRegimeEligibleFacts(),
    ];
    const matrix = buildSimulationInputReadinessMatrix(factsArray, {
      fixedGeneratedAt: FIXED_MATRIX_AT,
    });
    const summary = summarizeSimulationInputReadinessMatrix(matrix);

    expect(summary.eligible).toBe(3);
    expect(summary.blocked).toBe(0);
    expect(summary.totalSources).toBe(3);
  });

  it("T37.2 — 3 blocked facts produce blocked count = 3, eligible = 0", () => {
    const factsArray = [
      makeNewsEventAuditOnlyFacts(),
      makeFinancialReportAllTrueFacts(),
      makeChipUnauthorizedFacts(),
    ];
    const matrix = buildSimulationInputReadinessMatrix(factsArray, {
      fixedGeneratedAt: FIXED_MATRIX_AT,
    });
    const summary = summarizeSimulationInputReadinessMatrix(matrix);

    expect(summary.eligible).toBe(0);
    expect(summary.totalSources).toBe(3);
    // NewsEvent audit-only goes into auditOnly bucket; FR and Chip go into blocked
    expect(summary.auditOnly + summary.blocked).toBe(3);
  });

  it("T37.3 — mixed 3 eligible + 3 blocked facts produce correct counts", () => {
    const factsArray = [
      makeMREligibleFacts(),
      makeQuoteEligibleFacts(),
      makeRegimeEligibleFacts(),
      makeNewsEventAuditOnlyFacts(),
      makeFinancialReportAllTrueFacts(),
      makeChipUnauthorizedFacts(),
    ];
    const matrix = buildSimulationInputReadinessMatrix(factsArray, {
      fixedGeneratedAt: FIXED_MATRIX_AT,
    });
    const summary = summarizeSimulationInputReadinessMatrix(matrix);

    expect(summary.eligible).toBe(3);
    expect(summary.totalSources).toBe(6);
    expect(summary.eligible + summary.auditOnly + summary.blocked).toBe(6);
  });

  it("T37.4 — summary always carries entersAlphaScore=false", () => {
    const factsArray = [makeMREligibleFacts(), makeChipUnauthorizedFacts()];
    const matrix = buildSimulationInputReadinessMatrix(factsArray, {
      fixedGeneratedAt: FIXED_MATRIX_AT,
    });
    const summary = summarizeSimulationInputReadinessMatrix(matrix);

    expect(summary.entersAlphaScore).toBe(false);
  });

  it("T37.5 — summary always carries paperOnly=true", () => {
    const factsArray = [makeQuoteEligibleFacts()];
    const matrix = buildSimulationInputReadinessMatrix(factsArray, {
      fixedGeneratedAt: FIXED_MATRIX_AT,
    });
    const summary = summarizeSimulationInputReadinessMatrix(matrix);

    expect(summary.paperOnly).toBe(true);
  });
});

// ─── Group T38: Pipeline determinism (4) ─────────────────────────────────────

describe("P37 — Group T38: pipeline determinism — same input → identical output", () => {
  it("T38.1 — same MR eligible facts called twice produce identical simulationInputStatus", () => {
    const facts = makeMREligibleFacts();
    const entry1 = mapSourceToSimulationInputReadiness(facts);
    const entry2 = mapSourceToSimulationInputReadiness(facts);

    expect(entry1.simulationInputStatus).toBe(entry2.simulationInputStatus);
    expect(entry1.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
    expect(entry1.blockingReasons).toEqual(entry2.blockingReasons);
  });

  it("T38.2 — same blocked facts called twice produce identical blockingReasons", () => {
    const facts = makeChipUnauthorizedFacts();
    const entry1 = mapSourceToSimulationInputReadiness(facts);
    const entry2 = mapSourceToSimulationInputReadiness(facts);

    expect(entry1.simulationInputStatus).toBe(entry2.simulationInputStatus);
    expect(entry1.blockingReasons).toEqual(entry2.blockingReasons);
    expect(entry1.blockingReasons.length).toBeGreaterThan(0);
  });

  it("T38.3 — fixedGeneratedAt option propagates to matrix.generatedAt", () => {
    const facts = [makeMREligibleFacts()];
    const matrix = buildSimulationInputReadinessMatrix(facts, {
      fixedGeneratedAt: FIXED_MATRIX_AT,
    });

    expect(matrix.generatedAt).toBe(FIXED_MATRIX_AT);
    expect(matrix.entersAlphaScore).toBe(false);
  });

  it("T38.4 — asOfDate option propagates to all eligibleSources in bundle", () => {
    const entries = [
      mapSourceToSimulationInputReadiness(makeMREligibleFacts()),
      mapSourceToSimulationInputReadiness(makeQuoteEligibleFacts()),
      mapSourceToSimulationInputReadiness(makeRegimeEligibleFacts()),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, { asOfDate: FIXED_AS_OF });

    bundle.eligibleSources.forEach((source) => {
      expect(source.asOfDate).toBe(FIXED_AS_OF);
    });
    expect(bundle.entersAlphaScore).toBe(false);
  });
});

// ─── Group T39: Forbidden-field / boundary guard (5) ─────────────────────────

describe("P37 — Group T39: forbidden-field guard and blocked source boundary", () => {
  it("T39.1 — facts with forbidden key 'alphaScore' → BLOCKED_AUTHORIZATION with FORBIDDEN_FIELD_IN_INPUT reason", () => {
    const forbiddenFacts = {
      ...makeMREligibleFacts(),
      alphaScore: 0.85,
    } as unknown as SourceReadinessFacts;

    const entry = mapSourceToSimulationInputReadiness(forbiddenFacts);

    expect(entry.simulationInputStatus).toBe("BLOCKED_AUTHORIZATION");
    expect(entry.blockingReasons.some((r) => r.includes("FORBIDDEN_FIELD_IN_INPUT"))).toBe(true);
    expect(entry.blockingReasons.some((r) => r.includes("alphaScore"))).toBe(true);
    expect(entry.entersAlphaScore).toBe(false);
  });

  it("T39.2 — facts with forbidden key 'signal' → BLOCKED_AUTHORIZATION", () => {
    const forbiddenFacts = {
      ...makeQuoteEligibleFacts(),
      signal: "buy",
    } as unknown as SourceReadinessFacts;

    const entry = mapSourceToSimulationInputReadiness(forbiddenFacts);

    expect(entry.simulationInputStatus).toBe("BLOCKED_AUTHORIZATION");
    expect(entry.blockingReasons.some((r) => r.includes("signal"))).toBe(true);
  });

  it("T39.3 — facts with forbidden key 'prediction' → BLOCKED_AUTHORIZATION", () => {
    const forbiddenFacts = {
      ...makeRegimeEligibleFacts(),
      prediction: "bullish",
    } as unknown as SourceReadinessFacts;

    const entry = mapSourceToSimulationInputReadiness(forbiddenFacts);

    expect(entry.simulationInputStatus).toBe("BLOCKED_AUTHORIZATION");
    expect(entry.blockingReasons.some((r) => r.includes("prediction"))).toBe(true);
  });

  it("T39.4 — normal facts (no forbidden keys) execute resolver normally and are not BLOCKED_AUTHORIZATION due to forbidden field guard", () => {
    const entry = mapSourceToSimulationInputReadiness(makeMREligibleFacts());

    // Should be eligible — not blocked by forbidden field guard
    expect(entry.simulationInputStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
    // No FORBIDDEN_FIELD_IN_INPUT reason
    expect(entry.blockingReasons.some((r) => r.includes("FORBIDDEN_FIELD_IN_INPUT"))).toBe(false);
  });

  it("T39.5 — audit-only NewsEvent and blocked FinancialReport/Chip never enter eligibleSources in the bundle", () => {
    const entries = [
      mapSourceToSimulationInputReadiness(makeNewsEventAuditOnlyFacts()),
      mapSourceToSimulationInputReadiness(makeFinancialReportAllTrueFacts()),
      mapSourceToSimulationInputReadiness(makeChipUnauthorizedFacts()),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, { asOfDate: FIXED_AS_OF });

    expect(bundle.eligibleSources).toHaveLength(0);
    expect(bundle.blockedSources).toHaveLength(3);
    expect(bundle.entersAlphaScore).toBe(false);

    const blockedNames = bundle.blockedSources.map((s) => s.sourceName);
    expect(blockedNames).toContain("NewsEvent");
    expect(blockedNames).toContain("FinancialReport");
    expect(blockedNames).toContain("Chip");
  });
});
