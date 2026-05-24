/**
 * P25 — Axis B v3: P39 Bundle Boundary Validation
 *
 * 25 tests / 5 groups (T16–T20)
 *
 * This file extends Axis B coverage into P39 PaperSimulationInputBundle
 * boundary behavior — sourceTrace determinism, partial-bundle handling
 * (missing sources are absent, not fabricated), asOfDate propagation,
 * structural absence of real-execution / optimizer / DB markers, and
 * governance flag invariants with deterministic validation error paths.
 *
 * All tests are fixture-backed. No DB access. No real simulation.
 * No optimizer. No real backtest. No scoring formula mutation.
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - entersAlphaScore = false
 * - notSimulationExecution = true
 * - notOptimizer = true
 * - notRealBacktest = true
 * - noInvestmentAdvice = true
 * - noBuySellActionSemantics = true
 *
 * NOT investment advice. No buy/sell/hold. No PnL/ROI/win-rate claims.
 */

import {
  buildDefaultPaperSimulationInputBundle,
  buildPaperSimulationInputBundle,
  validatePaperSimulationInputBundle,
  PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS,
  P39_ELIGIBLE_SOURCES,
  P39_BLOCKED_SOURCES,
} from "@/lib/onlineValidation/p39/PaperSimulationInputContractBuilder";
import type { SourceName } from "@/lib/onlineValidation/p39/PaperSimulationInputContract";
import type { SimulationInputReadinessEntry } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";

// ─── Fixed timestamps ────────────────────────────────────────────────────────

const FIXED_DATE_A = "2026-05-24T00:00:00.000Z";
const FIXED_DATE_B = "2026-06-01T00:00:00.000Z";
const FIXED_DATE_FUTURE = "2099-01-01T00:00:00.000Z";

// ─── Fixture helpers ─────────────────────────────────────────────────────────

const FIXTURE_FORBIDDEN_USE: string[] = [
  "production scoring",
  "alphaScore mutation",
  "optimizer",
  "real backtest",
  "buy/sell/hold action semantics",
  "investment recommendation",
  "performance claims (profit, ROI, win-rate, edge, expected return)",
  "scoring formula modification",
];

function makeEligibleEntry(
  sourceName: SourceName,
  trace: string
): SimulationInputReadinessEntry {
  return {
    sourceName,
    currentGateStatus: trace,
    pitStatus: "PIT_GATE_PRESENT",
    consumerStatus: "CONSUMER_READY",
    simulationInputStatus: "SIMULATION_INPUT_ELIGIBLE",
    blockingReasons: [],
    allowedUse: ["paper-only simulation input"],
    forbiddenUse: FIXTURE_FORBIDDEN_USE,
    requiredNextEvidence: [],
    entersAlphaScore: false,
    paperOnly: true,
    noInvestmentAdvice: true,
  };
}

function makeBlockedEntry(
  sourceName: SourceName,
  status:
    | "BLOCKED_QUALITY_EVIDENCE"
    | "BLOCKED_PIT_METADATA"
    | "BLOCKED_AUTHORIZATION"
): SimulationInputReadinessEntry {
  return {
    sourceName,
    currentGateStatus: `BLOCKED:${sourceName}`,
    pitStatus: "PIT_GATE_MISSING",
    consumerStatus: "BLOCKED",
    simulationInputStatus: status,
    blockingReasons: [`${sourceName} blocked — fixture`],
    allowedUse: [],
    forbiddenUse: FIXTURE_FORBIDDEN_USE,
    requiredNextEvidence: [`Complete ${sourceName} required evidence`],
    entersAlphaScore: false,
    paperOnly: true,
    noInvestmentAdvice: true,
  };
}

// ─── Group 16: sourceTrace determinism and eligible source order (5 tests) ──

describe("P25 — Group 16: sourceTrace determinism and eligible source order", () => {
  it("T16.1 — buildPaperSimulationInputBundle captures sourceTrace from entry.currentGateStatus", () => {
    const entries: SimulationInputReadinessEntry[] = [
      makeEligibleEntry("MonthlyRevenue", "GATE-MR-P38-PASS"),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, {
      asOfDate: FIXED_DATE_A,
    });
    const src = bundle.eligibleSources.find(
      (s) => s.sourceName === "MonthlyRevenue"
    );
    expect(src).toBeDefined();
    expect(src!.sourceTrace).toBe("GATE-MR-P38-PASS");
  });

  it("T16.2 — default bundle eligible source names are exactly [MonthlyRevenue, Quote, Regime]", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    const names = bundle.eligibleSources.map((s) => s.sourceName);
    expect(names).toEqual(["MonthlyRevenue", "Quote", "Regime"]);
  });

  it("T16.3 — two successive default bundles have identical eligible source name list (stable order)", () => {
    const a = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const b = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const namesA = a.eligibleSources.map((s) => s.sourceName);
    const namesB = b.eligibleSources.map((s) => s.sourceName);
    expect(namesA).toEqual(namesB);
  });

  it("T16.4 — P39_ELIGIBLE_SOURCES canonical list matches default bundle eligible source names", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    const names = bundle.eligibleSources.map((s) => s.sourceName);
    expect(names).toEqual([...P39_ELIGIBLE_SOURCES]);
  });

  it("T16.5 — sourceTrace on eligible entries is a non-empty string or undefined, never null", () => {
    const entries: SimulationInputReadinessEntry[] = [
      makeEligibleEntry("Quote", "GATE-Q-P38-PASS"),
      makeEligibleEntry("Regime", "GATE-R-P38-PASS"),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, {
      asOfDate: FIXED_DATE_A,
    });
    for (const src of bundle.eligibleSources) {
      expect(src.sourceTrace).not.toBeNull();
      if (src.sourceTrace !== undefined) {
        expect(typeof src.sourceTrace).toBe("string");
        expect(src.sourceTrace.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Group 17: partial bundle and missing source determinism (5 tests) ───────

describe("P25 — Group 17: partial bundle and missing source determinism", () => {
  it("T17.1 — bundle with only MonthlyRevenue eligible has 1 eligible source; Quote and Regime absent", () => {
    const entries: SimulationInputReadinessEntry[] = [
      makeEligibleEntry("MonthlyRevenue", "GATE-MR"),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, {
      asOfDate: FIXED_DATE_A,
    });
    expect(bundle.eligibleSources).toHaveLength(1);
    expect(bundle.eligibleSources[0]!.sourceName).toBe("MonthlyRevenue");
    const names = bundle.eligibleSources.map((s) => s.sourceName);
    expect(names).not.toContain("Quote");
    expect(names).not.toContain("Regime");
  });

  it("T17.2 — bundle built with zero entries has empty eligibleSources (no sources fabricated)", () => {
    const bundle = buildPaperSimulationInputBundle([], { asOfDate: FIXED_DATE_A });
    expect(bundle.eligibleSources).toHaveLength(0);
  });

  it("T17.3 — bundle with MonthlyRevenue + Regime eligible (Quote absent) → Quote not in eligibleSources", () => {
    const entries: SimulationInputReadinessEntry[] = [
      makeEligibleEntry("MonthlyRevenue", "GATE-MR"),
      makeEligibleEntry("Regime", "GATE-R"),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, {
      asOfDate: FIXED_DATE_A,
    });
    const names = bundle.eligibleSources.map((s) => s.sourceName);
    expect(names).not.toContain("Quote");
    expect(names).toContain("MonthlyRevenue");
    expect(names).toContain("Regime");
  });

  it("T17.4 — bundle with all 3 blocked entries → eligibleSources empty, blockedSources has 3", () => {
    const entries: SimulationInputReadinessEntry[] = [
      makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE"),
      makeBlockedEntry("FinancialReport", "BLOCKED_PIT_METADATA"),
      makeBlockedEntry("Chip", "BLOCKED_AUTHORIZATION"),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, {
      asOfDate: FIXED_DATE_A,
    });
    expect(bundle.eligibleSources).toHaveLength(0);
    expect(bundle.blockedSources).toHaveLength(3);
  });

  it("T17.5 — P39_BLOCKED_SOURCES canonical list contains exactly NewsEvent, FinancialReport, Chip", () => {
    expect(P39_BLOCKED_SOURCES).toContain("NewsEvent");
    expect(P39_BLOCKED_SOURCES).toContain("FinancialReport");
    expect(P39_BLOCKED_SOURCES).toContain("Chip");
    expect(P39_BLOCKED_SOURCES).toHaveLength(3);
  });
});

// ─── Group 18: asOfDate boundary stability (5 tests) ─────────────────────────

describe("P25 — Group 18: asOfDate boundary stability", () => {
  it("T18.1 — bundle.generatedAt equals the asOfDate option passed to buildDefaultPaperSimulationInputBundle", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    expect(bundle.generatedAt).toBe(FIXED_DATE_A);
  });

  it("T18.2 — each eligibleSource.asOfDate matches the asOfDate option", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    for (const src of bundle.eligibleSources) {
      expect(src.asOfDate).toBe(FIXED_DATE_A);
    }
  });

  it("T18.3 — future asOfDate (2099) is accepted and stored as-is (no date rejection)", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_FUTURE,
    });
    expect(bundle.generatedAt).toBe(FIXED_DATE_FUTURE);
    for (const src of bundle.eligibleSources) {
      expect(src.asOfDate).toBe(FIXED_DATE_FUTURE);
    }
  });

  it("T18.4 — two builds with identical asOfDate produce identical generatedAt (deterministic)", () => {
    const a = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const b = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    expect(a.generatedAt).toBe(b.generatedAt);
  });

  it("T18.5 — bundles with different asOfDate have distinct generatedAt values (not aliased)", () => {
    const a = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_A });
    const b = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    expect(a.generatedAt).not.toBe(b.generatedAt);
    expect(a.generatedAt).toBe(FIXED_DATE_A);
    expect(b.generatedAt).toBe(FIXED_DATE_B);
  });
});

// ─── Group 19: structural absence of real-execution / optimizer / DB markers ─

describe("P25 — Group 19: structural absence of real-execution, optimizer, and DB markers", () => {
  it("T19.1 — bundle root has no 'executeSimulation' key", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    expect(bundle).not.toHaveProperty("executeSimulation");
  });

  it("T19.2 — bundle root has no 'runOptimizer' or 'applyMigration' keys", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    expect(bundle).not.toHaveProperty("runOptimizer");
    expect(bundle).not.toHaveProperty("applyMigration");
  });

  it("T19.3 — bundle root has no 'backtestResult' or 'computePnL' keys", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    expect(bundle).not.toHaveProperty("backtestResult");
    expect(bundle).not.toHaveProperty("computePnL");
  });

  it("T19.4 — bundle root has no 'connectDB' or 'prismaClient' keys", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    expect(bundle).not.toHaveProperty("connectDB");
    expect(bundle).not.toHaveProperty("prismaClient");
  });

  it("T19.5 — PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS covers expected marker strings", () => {
    const forbidden = PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS;
    expect(forbidden).toContain("alphaScore");
    expect(forbidden).toContain("backtestResult");
    expect(forbidden).toContain("optimizerScore");
    expect(forbidden).toContain("winRate");
    expect(forbidden).toContain("profit");
    expect(forbidden).toContain("returnPct");
    expect(forbidden).toContain("expectedReturn");
  });
});

// ─── Group 20: governance flag invariants and validation determinism (5 tests) ─

describe("P25 — Group 20: governance flag invariants and validation determinism", () => {
  it("T20.1 — validator rejects notSimulationExecution=false; error references field name", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    const tampered = { ...bundle, notSimulationExecution: false };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("notSimulationExecution"))
    ).toBe(true);
  });

  it("T20.2 — validator rejects notOptimizer=false; error references field name", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    const tampered = { ...bundle, notOptimizer: false };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("notOptimizer"))).toBe(true);
  });

  it("T20.3 — two successive validations of the same bundle return identical result (deterministic)", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    const r1 = validatePaperSimulationInputBundle(bundle);
    const r2 = validatePaperSimulationInputBundle(bundle);
    expect(r1.valid).toBe(r2.valid);
    expect(r1.errors).toEqual(r2.errors);
    expect(r1.warnings).toEqual(r2.warnings);
  });

  it("T20.4 — validator catches blocked source (NewsEvent) injected into eligibleSources", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    const injectedEntry = {
      sourceName: "NewsEvent" as SourceName,
      readinessStatus: "SIMULATION_INPUT_ELIGIBLE" as const,
      paperOnly: true as const,
      dryRunOnly: true as const,
      entersAlphaScore: false as const,
      noInvestmentAdvice: true as const,
      noBuySellActionSemantics: true as const,
      asOfDate: FIXED_DATE_A,
      payloadSummary:
        "Governance violation test — blocked source injected into eligibleSources",
    };
    const tampered = {
      ...bundle,
      eligibleSources: [...bundle.eligibleSources, injectedEntry],
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("NewsEvent"))).toBe(true);
  });

  it("T20.5 — valid default bundle passes all validator rules: valid=true, errors=[], warnings=[]", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_DATE_A,
    });
    const result = validatePaperSimulationInputBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.entersAlphaScore).toBe(false);
    expect(result.paperOnly).toBe(true);
  });
});
