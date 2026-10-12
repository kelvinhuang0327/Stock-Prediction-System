/**
 * P27 — Axis B v4: P39 Validator Edge Cases
 *
 * Extends P39 PaperSimulationInputContractBuilder validator coverage with edge-case
 * injection tests: per-source governance flag tampering, forbidden-field root injection,
 * entry ordering / deduplication / status routing, type-safety boundary, and
 * repeated-stability checks.
 *
 * NOT investment advice. No buy/sell/hold. No PnL/ROI/win-rate claims.
 * entersAlphaScore=false. paperOnly=true. dryRunOnly=true.
 * No scoring formula, optimizer, real backtest, or DB access.
 * Fixture-backed only — no source file modifications.
 */

import {
  buildDefaultPaperSimulationInputBundle,
  buildPaperSimulationInputBundle,
  validatePaperSimulationInputBundle,
} from "@/lib/onlineValidation/p39/PaperSimulationInputContractBuilder";
import type { SimulationInputReadinessEntry } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIXED_DATE_A = "2026-05-24T00:00:00.000Z";

// ─── Fixture Forbidden Use (governance-prevention context only) ───────────────

const FIXTURE_FORBIDDEN_USE = [
  "production scoring",
  "investment recommendation",
  "performance claims (profit, ROI, win-rate, edge, expected return)",
];

// ─── Fixture Helpers ──────────────────────────────────────────────────────────

function makeEligibleEntry(
  sourceName: SimulationInputReadinessEntry["sourceName"],
  currentGateStatus = "P38_GATE_PASS"
): SimulationInputReadinessEntry {
  return {
    sourceName,
    currentGateStatus,
    pitStatus: "PIT_SAFE",
    consumerStatus: "CONSUMER_READY",
    simulationInputStatus: "SIMULATION_INPUT_ELIGIBLE",
    blockingReasons: [],
    allowedUse: ["paper simulation input only"],
    forbiddenUse: FIXTURE_FORBIDDEN_USE,
    requiredNextEvidence: [],
    entersAlphaScore: false,
    paperOnly: true,
    noInvestmentAdvice: true,
  };
}

function makeBlockedEntry(
  sourceName: SimulationInputReadinessEntry["sourceName"],
  status:
    | "BLOCKED_QUALITY_EVIDENCE"
    | "BLOCKED_PIT_METADATA"
    | "BLOCKED_AUTHORIZATION"
    | "BLOCKED_LAG_EVIDENCE"
): SimulationInputReadinessEntry {
  return {
    sourceName,
    currentGateStatus: "BLOCKED",
    pitStatus: "PIT_INCOMPLETE",
    consumerStatus: "NOT_READY",
    simulationInputStatus: status,
    blockingReasons: ["fixture blocking reason"],
    allowedUse: [],
    forbiddenUse: FIXTURE_FORBIDDEN_USE,
    requiredNextEvidence: ["fixture evidence required"],
    entersAlphaScore: false,
    paperOnly: true,
    noInvestmentAdvice: true,
  };
}

function makeAuditOnlyEntry(
  sourceName: SimulationInputReadinessEntry["sourceName"]
): SimulationInputReadinessEntry {
  return {
    sourceName,
    currentGateStatus: "CONSUMER_READY_AUDIT_ONLY",
    pitStatus: "PIT_SAFE",
    consumerStatus: "AUDIT_ONLY",
    simulationInputStatus: "CONSUMER_READY_AUDIT_ONLY",
    blockingReasons: ["not authorized for simulation input"],
    allowedUse: ["audit only"],
    forbiddenUse: FIXTURE_FORBIDDEN_USE,
    requiredNextEvidence: ["authorization required"],
    entersAlphaScore: false,
    paperOnly: true,
    noInvestmentAdvice: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Group T21 — per-source governance flag injection rejection
// ─────────────────────────────────────────────────────────────────────────────

describe("P27 — Group 21: per-source governance flag injection rejection", () => {
  it("T21.1 — validator rejects eligibleSources entry with entersAlphaScore=true; error mentions sourceName", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tamperedSrc: Record<string, unknown> = {
      ...(bundle.eligibleSources[0]! as Record<string, unknown>),
      entersAlphaScore: true,
    };
    const result = validatePaperSimulationInputBundle({
      ...(bundle as Record<string, unknown>),
      eligibleSources: [tamperedSrc, ...bundle.eligibleSources.slice(1)],
    });
    expect(result.valid).toBe(false);
    const errStr = result.errors.join(" ");
    expect(errStr).toMatch(/entersAlphaScore/);
    expect(errStr).toMatch(/MonthlyRevenue/);
  });

  it("T21.2 — validator rejects eligibleSources entry with paperOnly=false; error mentions sourceName", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tamperedSrc: Record<string, unknown> = {
      ...(bundle.eligibleSources[0]! as Record<string, unknown>),
      paperOnly: false,
    };
    const result = validatePaperSimulationInputBundle({
      ...(bundle as Record<string, unknown>),
      eligibleSources: [tamperedSrc, ...bundle.eligibleSources.slice(1)],
    });
    expect(result.valid).toBe(false);
    const errStr = result.errors.join(" ");
    expect(errStr).toMatch(/paperOnly/);
    expect(errStr).toMatch(/MonthlyRevenue/);
  });

  it("T21.3 — validator rejects bundle with notRealBacktest=false; error mentions 'notRealBacktest'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      notRealBacktest: false,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("notRealBacktest"))).toBe(true);
  });

  it("T21.4 — validator rejects bundle with noInvestmentAdvice=false; error mentions 'noInvestmentAdvice'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      noInvestmentAdvice: false,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("noInvestmentAdvice"))).toBe(true);
  });

  it("T21.5 — validator rejects bundle with noBuySellActionSemantics=false; error mentions 'noBuySellActionSemantics'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      noBuySellActionSemantics: false,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("noBuySellActionSemantics"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group T22 — forbidden field injection at bundle root
// ─────────────────────────────────────────────────────────────────────────────

describe("P27 — Group 22: forbidden field injection at bundle root", () => {
  it("T22.1 — bundle root with 'alphaScore' key → validator catches it; error mentions 'alphaScore'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered = { ...bundle, alphaScore: "injected" };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("alphaScore"))).toBe(true);
  });

  it("T22.2 — bundle root with 'recommendation' key → validator catches it; error mentions 'recommendation'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered = { ...bundle, recommendation: "hold" };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("recommendation"))).toBe(true);
  });

  it("T22.3 — bundle root with 'winRate' key → validator catches it; error mentions 'winRate'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered = { ...bundle, winRate: 0.65 };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("winRate"))).toBe(true);
  });

  it("T22.4 — bundle with alphaScore + backtestResult + profit injected → errors.length >= 3", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered = { ...bundle, alphaScore: 1, backtestResult: {}, profit: 999 };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("T22.5 — forbidden field injection: validator result preserves entersAlphaScore=false and paperOnly=true", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered = { ...bundle, alphaScore: "bad", optimizerScore: 42 };
    const result = validatePaperSimulationInputBundle(tampered);
    // The validator result itself must never activate scoring regardless of bundle content
    expect(result.entersAlphaScore).toBe(false);
    expect(result.paperOnly).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group T23 — entry ordering, deduplication, and status routing
// ─────────────────────────────────────────────────────────────────────────────

describe("P27 — Group 23: entry ordering, deduplication, and status routing", () => {
  it("T23.1 — entries in [Regime, Quote, MonthlyRevenue] order → eligibleSources in same input order", () => {
    const entries = [
      makeEligibleEntry("Regime"),
      makeEligibleEntry("Quote"),
      makeEligibleEntry("MonthlyRevenue"),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, { asOfDate: FIXED_DATE_A });
    expect(bundle.eligibleSources).toHaveLength(3);
    expect(bundle.eligibleSources[0]!.sourceName).toBe("Regime");
    expect(bundle.eligibleSources[1]!.sourceName).toBe("Quote");
    expect(bundle.eligibleSources[2]!.sourceName).toBe("MonthlyRevenue");
  });

  it("T23.2 — duplicate eligible entry (MonthlyRevenue twice) → eligibleSources has 2 entries (no dedup)", () => {
    const entries = [
      makeEligibleEntry("MonthlyRevenue"),
      makeEligibleEntry("MonthlyRevenue"),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, { asOfDate: FIXED_DATE_A });
    expect(bundle.eligibleSources).toHaveLength(2);
    expect(bundle.eligibleSources[0]!.sourceName).toBe("MonthlyRevenue");
    expect(bundle.eligibleSources[1]!.sourceName).toBe("MonthlyRevenue");
  });

  it("T23.3 — entry with currentGateStatus='' → sourceTrace stored as empty string (not filtered or nulled)", () => {
    const entry = makeEligibleEntry("MonthlyRevenue", "");
    const bundle = buildPaperSimulationInputBundle([entry], { asOfDate: FIXED_DATE_A });
    expect(bundle.eligibleSources).toHaveLength(1);
    expect(bundle.eligibleSources[0]!.sourceTrace).toBe("");
  });

  it("T23.4 — same sourceName once eligible + once blocked → one in eligibleSources, one in blockedSources", () => {
    const entries = [
      makeEligibleEntry("MonthlyRevenue"),
      makeBlockedEntry("MonthlyRevenue", "BLOCKED_QUALITY_EVIDENCE"),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, { asOfDate: FIXED_DATE_A });
    expect(bundle.eligibleSources).toHaveLength(1);
    expect(bundle.eligibleSources[0]!.sourceName).toBe("MonthlyRevenue");
    expect(bundle.blockedSources).toHaveLength(1);
    expect(bundle.blockedSources[0]!.sourceName).toBe("MonthlyRevenue");
  });

  it("T23.5 — CONSUMER_READY_AUDIT_ONLY entry → goes to blockedSources with blockedStatus 'BLOCKED_AUTHORIZATION'", () => {
    const entry = makeAuditOnlyEntry("Quote");
    const bundle = buildPaperSimulationInputBundle([entry], { asOfDate: FIXED_DATE_A });
    expect(bundle.eligibleSources).toHaveLength(0);
    expect(bundle.blockedSources).toHaveLength(1);
    expect(bundle.blockedSources[0]!.sourceName).toBe("Quote");
    expect(bundle.blockedSources[0]!.blockedStatus).toBe("BLOCKED_AUTHORIZATION");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group T24 — null / mode tamper and validator type safety
// ─────────────────────────────────────────────────────────────────────────────

describe("P27 — Group 24: null/mode tamper and validator type safety", () => {
  it("T24.1 — null passed to validator → valid=false; error mentions 'non-null'", () => {
    const result = validatePaperSimulationInputBundle(null);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("non-null"))).toBe(true);
  });

  it("T24.2 — bundle with wrong mode string → valid=false; error mentions 'mode'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      mode: "wrong-mode",
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("mode"))).toBe(true);
  });

  it("T24.3 — bundle with entersAlphaScore=true at root → error mentions 'entersAlphaScore'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      entersAlphaScore: true,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("entersAlphaScore"))).toBe(true);
  });

  it("T24.4 — bundle with disclaimer=undefined → valid=false; error mentions 'disclaimer'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      disclaimer: undefined,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("disclaimer"))).toBe(true);
  });

  it("T24.5 — bundle with disclaimer shorter than 10 chars → valid=false; error mentions 'disclaimer'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      disclaimer: "short",
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("disclaimer"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group T25 — repeated stability, empty source list, full flag tamper
// ─────────────────────────────────────────────────────────────────────────────

describe("P27 — Group 25: repeated stability, empty source list, full flag tamper", () => {
  it("T25.1 — three successive validations of same bundle yield identical result (strong determinism)", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const r1 = validatePaperSimulationInputBundle(bundle);
    const r2 = validatePaperSimulationInputBundle(bundle);
    const r3 = validatePaperSimulationInputBundle(bundle);
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });

  it("T25.2 — bundle with 3 forbidden fields (alphaScore, backtestResult, profit) → errors.length >= 3", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const tampered = { ...bundle, alphaScore: 1, backtestResult: "x", profit: 99 };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("T25.3 — bundle with all 9 root governance flags wrong → errors.length >= 9", () => {
    const allFlagsTampered: Record<string, unknown> = {
      mode: "bad-mode",
      paperOnly: false,
      dryRunOnly: false,
      entersAlphaScore: true,
      noInvestmentAdvice: false,
      noBuySellActionSemantics: false,
      notSimulationExecution: false,
      notOptimizer: false,
      notRealBacktest: false,
      eligibleSources: [],
      blockedSources: [],
      disclaimer: "DISCLAIMER: This fixture disclaimer is long enough to pass length validation here.",
      generatedAt: FIXED_DATE_A,
      version: "v1",
    };
    const result = validatePaperSimulationInputBundle(allFlagsTampered);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(9);
  });

  it("T25.4 — empty object {} passed to validator → valid=false with multiple errors", () => {
    const result = validatePaperSimulationInputBundle({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("T25.5 — default bundle with eligibleSources=[] → valid=true (empty list is not a contract violation)", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const emptyBundle: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      eligibleSources: [],
    };
    const result = validatePaperSimulationInputBundle(emptyBundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
