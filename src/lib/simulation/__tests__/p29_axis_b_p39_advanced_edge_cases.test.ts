/**
 * P29 — Axis B v5: P39 Advanced Edge Cases
 *
 * Extends P39 PaperSimulationInputContractBuilder coverage with advanced edge-case
 * injection tests: SOURCE_PRESENT_AUDIT_ONLY routing, individual governance flag
 * rejection (notSimulationExecution, notOptimizer, paperOnly root, dryRunOnly),
 * blocked-source-in-eligibleSources cross-check, warnings array stability, and
 * null/undefined governance flag tamper.
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

const FIXED_DATE_B = "2026-05-24T00:00:00.000Z";

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

function makeSourcePresentAuditOnlyEntry(
  sourceName: SimulationInputReadinessEntry["sourceName"]
): SimulationInputReadinessEntry {
  return {
    sourceName,
    currentGateStatus: "SOURCE_PRESENT_AUDIT_ONLY",
    pitStatus: "PIT_SAFE",
    consumerStatus: "SOURCE_PRESENT_AUDIT_ONLY",
    simulationInputStatus: "SOURCE_PRESENT_AUDIT_ONLY",
    blockingReasons: ["consumer integration not complete"],
    allowedUse: ["audit only"],
    forbiddenUse: FIXTURE_FORBIDDEN_USE,
    requiredNextEvidence: ["complete consumer integration"],
    entersAlphaScore: false,
    paperOnly: true,
    noInvestmentAdvice: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Group T26 — SOURCE_PRESENT_AUDIT_ONLY routing behavior
// ─────────────────────────────────────────────────────────────────────────────

describe("P29 — Group 26: SOURCE_PRESENT_AUDIT_ONLY routing behavior", () => {
  it("T26.1 — SOURCE_PRESENT_AUDIT_ONLY entry → blockedSources with blockedStatus 'BLOCKED_AUTHORIZATION'", () => {
    const entry = makeSourcePresentAuditOnlyEntry("Quote");
    const bundle = buildPaperSimulationInputBundle([entry], { asOfDate: FIXED_DATE_B });
    expect(bundle.blockedSources).toHaveLength(1);
    expect(bundle.blockedSources[0]!.sourceName).toBe("Quote");
    expect(bundle.blockedSources[0]!.blockedStatus).toBe("BLOCKED_AUTHORIZATION");
  });

  it("T26.2 — SOURCE_PRESENT_AUDIT_ONLY entry → eligibleSources is empty (not routed to eligible)", () => {
    const entry = makeSourcePresentAuditOnlyEntry("Regime");
    const bundle = buildPaperSimulationInputBundle([entry], { asOfDate: FIXED_DATE_B });
    expect(bundle.eligibleSources).toHaveLength(0);
  });

  it("T26.3 — two SOURCE_PRESENT_AUDIT_ONLY entries → both in blockedSources with 'BLOCKED_AUTHORIZATION'", () => {
    const entries = [
      makeSourcePresentAuditOnlyEntry("Quote"),
      makeSourcePresentAuditOnlyEntry("Regime"),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, { asOfDate: FIXED_DATE_B });
    expect(bundle.eligibleSources).toHaveLength(0);
    expect(bundle.blockedSources).toHaveLength(2);
    expect(bundle.blockedSources[0]!.blockedStatus).toBe("BLOCKED_AUTHORIZATION");
    expect(bundle.blockedSources[1]!.blockedStatus).toBe("BLOCKED_AUTHORIZATION");
  });

  it("T26.4 — SOURCE_PRESENT_AUDIT_ONLY (Quote) + SIMULATION_INPUT_ELIGIBLE (MonthlyRevenue) → 1 eligible, 1 blocked", () => {
    const entries = [
      makeSourcePresentAuditOnlyEntry("Quote"),
      makeEligibleEntry("MonthlyRevenue"),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, { asOfDate: FIXED_DATE_B });
    expect(bundle.eligibleSources).toHaveLength(1);
    expect(bundle.eligibleSources[0]!.sourceName).toBe("MonthlyRevenue");
    expect(bundle.blockedSources).toHaveLength(1);
    expect(bundle.blockedSources[0]!.sourceName).toBe("Quote");
    expect(bundle.blockedSources[0]!.blockedStatus).toBe("BLOCKED_AUTHORIZATION");
  });

  it("T26.5 — SOURCE_PRESENT_AUDIT_ONLY entry → blockingReasons from entry preserved in blockedSources output", () => {
    const entry = makeSourcePresentAuditOnlyEntry("MonthlyRevenue");
    const bundle = buildPaperSimulationInputBundle([entry], { asOfDate: FIXED_DATE_B });
    expect(bundle.blockedSources).toHaveLength(1);
    expect(bundle.blockedSources[0]!.blockingReasons).toEqual(entry.blockingReasons);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group T27 — individual governance flag rejection: notSimulationExecution,
//             notOptimizer, paperOnly (root), dryRunOnly
// ─────────────────────────────────────────────────────────────────────────────

describe("P29 — Group 27: notSimulationExecution/notOptimizer/paperOnly/dryRunOnly individual rejection", () => {
  it("T27.1 — notSimulationExecution=false → valid=false; error mentions 'notSimulationExecution'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      notSimulationExecution: false,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("notSimulationExecution"))).toBe(true);
  });

  it("T27.2 — notOptimizer=false → valid=false; error mentions 'notOptimizer'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      notOptimizer: false,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("notOptimizer"))).toBe(true);
  });

  it("T27.3 — paperOnly=false at bundle root → valid=false; error mentions 'paperOnly'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      paperOnly: false,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("paperOnly"))).toBe(true);
  });

  it("T27.4 — dryRunOnly=false → valid=false; error mentions 'dryRunOnly'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      dryRunOnly: false,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("dryRunOnly"))).toBe(true);
  });

  it("T27.5 — notSimulationExecution=false + notOptimizer=false + dryRunOnly=false → errors.length >= 3", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      notSimulationExecution: false,
      notOptimizer: false,
      dryRunOnly: false,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group T28 — blocked source names injected into eligibleSources
// ─────────────────────────────────────────────────────────────────────────────

describe("P29 — Group 28: blocked source names in eligibleSources rejection", () => {
  it("T28.1 — NewsEvent in eligibleSources → valid=false; error mentions 'NewsEvent'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const fakeEntry: Record<string, unknown> = {
      sourceName: "NewsEvent",
      readinessStatus: "SIMULATION_INPUT_ELIGIBLE",
      paperOnly: true,
      dryRunOnly: true,
      entersAlphaScore: false,
      noInvestmentAdvice: true,
      noBuySellActionSemantics: true,
      asOfDate: FIXED_DATE_B,
      payloadSummary: "fixture-only — governance test for blocked-source injection",
    };
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      eligibleSources: [fakeEntry],
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("NewsEvent"))).toBe(true);
  });

  it("T28.2 — FinancialReport in eligibleSources → valid=false; error mentions 'FinancialReport'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const fakeEntry: Record<string, unknown> = {
      sourceName: "FinancialReport",
      readinessStatus: "SIMULATION_INPUT_ELIGIBLE",
      paperOnly: true,
      dryRunOnly: true,
      entersAlphaScore: false,
      noInvestmentAdvice: true,
      noBuySellActionSemantics: true,
      asOfDate: FIXED_DATE_B,
      payloadSummary: "fixture-only — governance test for blocked-source injection",
    };
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      eligibleSources: [fakeEntry],
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("FinancialReport"))).toBe(true);
  });

  it("T28.3 — Chip in eligibleSources → valid=false; error mentions 'Chip'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const fakeEntry: Record<string, unknown> = {
      sourceName: "Chip",
      readinessStatus: "SIMULATION_INPUT_ELIGIBLE",
      paperOnly: true,
      dryRunOnly: true,
      entersAlphaScore: false,
      noInvestmentAdvice: true,
      noBuySellActionSemantics: true,
      asOfDate: FIXED_DATE_B,
      payloadSummary: "fixture-only — governance test for blocked-source injection",
    };
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      eligibleSources: [fakeEntry],
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Chip"))).toBe(true);
  });

  it("T28.4 — all 3 blocked sources (NewsEvent, FinancialReport, Chip) in eligibleSources → errors.length >= 3", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const makeEntry = (name: string): Record<string, unknown> => ({
      sourceName: name,
      readinessStatus: "SIMULATION_INPUT_ELIGIBLE",
      paperOnly: true,
      dryRunOnly: true,
      entersAlphaScore: false,
      noInvestmentAdvice: true,
      noBuySellActionSemantics: true,
      asOfDate: FIXED_DATE_B,
      payloadSummary: "fixture-only — governance test for blocked-source injection",
    });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      eligibleSources: [
        makeEntry("NewsEvent"),
        makeEntry("FinancialReport"),
        makeEntry("Chip"),
      ],
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("T28.5 — NewsEvent in eligibleSources with entersAlphaScore=true → errors include both blocked-source and entersAlphaScore violations", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const fakeEntry: Record<string, unknown> = {
      sourceName: "NewsEvent",
      readinessStatus: "SIMULATION_INPUT_ELIGIBLE",
      paperOnly: true,
      dryRunOnly: true,
      entersAlphaScore: true, // also triggers rule 11
      noInvestmentAdvice: true,
      noBuySellActionSemantics: true,
      asOfDate: FIXED_DATE_B,
      payloadSummary: "fixture-only — governance test",
    };
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      eligibleSources: [fakeEntry],
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("NewsEvent"))).toBe(true);
    expect(result.errors.some((e) => e.includes("entersAlphaScore"))).toBe(true);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group T29 — warnings array stability and validator result shape invariants
// ─────────────────────────────────────────────────────────────────────────────

describe("P29 — Group 29: warnings array stability and result shape invariants", () => {
  it("T29.1 — valid default bundle → warnings is an array (not undefined or null)", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const result = validatePaperSimulationInputBundle(bundle);
    expect(result.valid).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("T29.2 — valid default bundle → warnings.length === 0", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const result = validatePaperSimulationInputBundle(bundle);
    expect(result.warnings).toHaveLength(0);
  });

  it("T29.3 — invalid bundle (mode tampered) → warnings is still an array (not undefined)", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      mode: "bad-mode",
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("T29.4 — null input → warnings is an array (early-return path preserves the invariant)", () => {
    const result = validatePaperSimulationInputBundle(null);
    expect(result.valid).toBe(false);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("T29.5 — three successive valid bundle validations → warnings deep-equal each time (deterministic)", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const r1 = validatePaperSimulationInputBundle(bundle);
    const r2 = validatePaperSimulationInputBundle(bundle);
    const r3 = validatePaperSimulationInputBundle(bundle);
    expect(r1.warnings).toEqual(r2.warnings);
    expect(r2.warnings).toEqual(r3.warnings);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group T30 — null / undefined governance flag tamper
// ─────────────────────────────────────────────────────────────────────────────

describe("P29 — Group 30: null/undefined governance flag tamper", () => {
  it("T30.1 — paperOnly=null → valid=false; error mentions 'paperOnly'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      paperOnly: null,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("paperOnly"))).toBe(true);
  });

  it("T30.2 — dryRunOnly=null → valid=false; error mentions 'dryRunOnly'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      dryRunOnly: null,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("dryRunOnly"))).toBe(true);
  });

  it("T30.3 — noInvestmentAdvice=null → valid=false; error mentions 'noInvestmentAdvice'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      noInvestmentAdvice: null,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("noInvestmentAdvice"))).toBe(true);
  });

  it("T30.4 — noBuySellActionSemantics=undefined → valid=false; error mentions 'noBuySellActionSemantics'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      noBuySellActionSemantics: undefined,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("noBuySellActionSemantics"))).toBe(true);
  });

  it("T30.5 — entersAlphaScore=null → valid=false; error mentions 'entersAlphaScore'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({ asOfDate: FIXED_DATE_B });
    const tampered: Record<string, unknown> = {
      ...(bundle as Record<string, unknown>),
      entersAlphaScore: null,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("entersAlphaScore"))).toBe(true);
  });
});
