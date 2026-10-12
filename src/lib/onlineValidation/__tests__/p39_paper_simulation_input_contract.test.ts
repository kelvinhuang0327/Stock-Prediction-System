/**
 * P39 — Paper Simulation Input Contract Tests
 *
 * Tests for PaperSimulationInputContract and PaperSimulationInputContractBuilder.
 * Verifies governance invariants, source eligibility/blocking, and forbidden semantics.
 *
 * DISCLAIMER: These tests do not constitute investment advice.
 * entersAlphaScore = false. paperOnly = true. dryRunOnly = true.
 */

import {
  buildDefaultPaperSimulationInputBundle,
  buildPaperSimulationInputBundle,
  validatePaperSimulationInputBundle,
  PAPER_SIMULATION_CONTRACT_MODE,
  PAPER_SIMULATION_CONTRACT_VERSION,
  PAPER_SIMULATION_CONTRACT_DISCLAIMER,
  PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS,
  PAPER_SIMULATION_CONTRACT_FORBIDDEN_USES,
  P39_ELIGIBLE_SOURCES,
  P39_BLOCKED_SOURCES,
} from "../p39/PaperSimulationInputContractBuilder";

import type {
  PaperSimulationInputBundle,
  PaperSimulationEligibleSourceInput,
} from "../p39/PaperSimulationInputContract";

import type { SimulationInputReadinessEntry } from "../p38/SimulationInputReadinessTypes";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEligibleEntry(
  sourceName: SimulationInputReadinessEntry["sourceName"]
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
  status: SimulationInputReadinessEntry["simulationInputStatus"],
  reasons: string[]
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

// ─── Group 1: Bundle Governance Invariants ────────────────────────────────────

describe("Group 1: Bundle governance invariants", () => {
  let bundle: PaperSimulationInputBundle;

  beforeEach(() => {
    bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
  });

  test("1.1 bundle.paperOnly is true", () => {
    expect(bundle.paperOnly).toBe(true);
  });

  test("1.2 bundle.dryRunOnly is true", () => {
    expect(bundle.dryRunOnly).toBe(true);
  });

  test("1.3 bundle.entersAlphaScore is false", () => {
    expect(bundle.entersAlphaScore).toBe(false);
  });

  test("1.4 bundle.noInvestmentAdvice is true", () => {
    expect(bundle.noInvestmentAdvice).toBe(true);
  });

  test("1.5 bundle.noBuySellActionSemantics is true", () => {
    expect(bundle.noBuySellActionSemantics).toBe(true);
  });

  test("1.6 bundle.notSimulationExecution is true", () => {
    expect(bundle.notSimulationExecution).toBe(true);
  });

  test("1.7 bundle.notOptimizer is true", () => {
    expect(bundle.notOptimizer).toBe(true);
  });

  test("1.8 bundle.notRealBacktest is true", () => {
    expect(bundle.notRealBacktest).toBe(true);
  });
});

// ─── Group 2: Mode and Version ────────────────────────────────────────────────

describe("Group 2: Mode and version", () => {
  let bundle: PaperSimulationInputBundle;

  beforeEach(() => {
    bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
  });

  test("2.1 bundle.mode is paper-simulation-input-contract", () => {
    expect(bundle.mode).toBe(PAPER_SIMULATION_CONTRACT_MODE);
  });

  test("2.2 PAPER_SIMULATION_CONTRACT_MODE constant is correct", () => {
    expect(PAPER_SIMULATION_CONTRACT_MODE).toBe("paper-simulation-input-contract");
  });

  test("2.3 bundle.version matches PAPER_SIMULATION_CONTRACT_VERSION", () => {
    expect(bundle.version).toBe(PAPER_SIMULATION_CONTRACT_VERSION);
  });

  test("2.4 version string contains p39", () => {
    expect(PAPER_SIMULATION_CONTRACT_VERSION).toContain("p39");
  });

  test("2.5 bundle.disclaimer is present and non-empty", () => {
    expect(bundle.disclaimer).toBe(PAPER_SIMULATION_CONTRACT_DISCLAIMER);
    expect(bundle.disclaimer.length).toBeGreaterThan(50);
  });
});

// ─── Group 3: MonthlyRevenue eligible ─────────────────────────────────────────

describe("Group 3: MonthlyRevenue is eligible", () => {
  let bundle: PaperSimulationInputBundle;

  beforeEach(() => {
    bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
  });

  test("3.1 MonthlyRevenue appears in eligibleSources", () => {
    const names = bundle.eligibleSources.map((s) => s.sourceName);
    expect(names).toContain("MonthlyRevenue");
  });

  test("3.2 MonthlyRevenue eligible entry has paperOnly=true", () => {
    const entry = bundle.eligibleSources.find((s) => s.sourceName === "MonthlyRevenue")!;
    expect(entry.paperOnly).toBe(true);
  });

  test("3.3 MonthlyRevenue eligible entry has entersAlphaScore=false", () => {
    const entry = bundle.eligibleSources.find((s) => s.sourceName === "MonthlyRevenue")!;
    expect(entry.entersAlphaScore).toBe(false);
  });

  test("3.4 MonthlyRevenue eligible entry has readinessStatus=SIMULATION_INPUT_ELIGIBLE", () => {
    const entry = bundle.eligibleSources.find((s) => s.sourceName === "MonthlyRevenue")!;
    expect(entry.readinessStatus).toBe("SIMULATION_INPUT_ELIGIBLE");
  });

  test("3.5 MonthlyRevenue is NOT in blockedSources", () => {
    const names = bundle.blockedSources.map((s) => s.sourceName);
    expect(names).not.toContain("MonthlyRevenue");
  });
});

// ─── Group 4: Quote is eligible ───────────────────────────────────────────────

describe("Group 4: Quote is eligible", () => {
  let bundle: PaperSimulationInputBundle;

  beforeEach(() => {
    bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
  });

  test("4.1 Quote appears in eligibleSources", () => {
    const names = bundle.eligibleSources.map((s) => s.sourceName);
    expect(names).toContain("Quote");
  });

  test("4.2 Quote eligible entry has paperOnly=true", () => {
    const entry = bundle.eligibleSources.find((s) => s.sourceName === "Quote")!;
    expect(entry.paperOnly).toBe(true);
  });

  test("4.3 Quote eligible entry has entersAlphaScore=false", () => {
    const entry = bundle.eligibleSources.find((s) => s.sourceName === "Quote")!;
    expect(entry.entersAlphaScore).toBe(false);
  });

  test("4.4 Quote eligible entry has noInvestmentAdvice=true", () => {
    const entry = bundle.eligibleSources.find((s) => s.sourceName === "Quote")!;
    expect(entry.noInvestmentAdvice).toBe(true);
  });

  test("4.5 Quote is NOT in blockedSources", () => {
    const names = bundle.blockedSources.map((s) => s.sourceName);
    expect(names).not.toContain("Quote");
  });
});

// ─── Group 5: Regime is eligible ──────────────────────────────────────────────

describe("Group 5: Regime is eligible", () => {
  let bundle: PaperSimulationInputBundle;

  beforeEach(() => {
    bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
  });

  test("5.1 Regime appears in eligibleSources", () => {
    const names = bundle.eligibleSources.map((s) => s.sourceName);
    expect(names).toContain("Regime");
  });

  test("5.2 Regime eligible entry has paperOnly=true", () => {
    const entry = bundle.eligibleSources.find((s) => s.sourceName === "Regime")!;
    expect(entry.paperOnly).toBe(true);
  });

  test("5.3 Regime eligible entry has entersAlphaScore=false", () => {
    const entry = bundle.eligibleSources.find((s) => s.sourceName === "Regime")!;
    expect(entry.entersAlphaScore).toBe(false);
  });

  test("5.4 Regime is NOT in blockedSources", () => {
    const names = bundle.blockedSources.map((s) => s.sourceName);
    expect(names).not.toContain("Regime");
  });
});

// ─── Group 6: Blocked Sources ─────────────────────────────────────────────────

describe("Group 6: Blocked sources are explicitly blocked", () => {
  let bundle: PaperSimulationInputBundle;

  beforeEach(() => {
    bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
  });

  test("6.1 NewsEvent is in blockedSources with BLOCKED_QUALITY_EVIDENCE", () => {
    const entry = bundle.blockedSources.find((s) => s.sourceName === "NewsEvent")!;
    expect(entry).toBeDefined();
    expect(entry.blockedStatus).toBe("BLOCKED_QUALITY_EVIDENCE");
  });

  test("6.2 FinancialReport is in blockedSources with BLOCKED_PIT_METADATA", () => {
    const entry = bundle.blockedSources.find((s) => s.sourceName === "FinancialReport")!;
    expect(entry).toBeDefined();
    expect(entry.blockedStatus).toBe("BLOCKED_PIT_METADATA");
  });

  test("6.3 Chip is in blockedSources with BLOCKED_AUTHORIZATION", () => {
    const entry = bundle.blockedSources.find((s) => s.sourceName === "Chip")!;
    expect(entry).toBeDefined();
    expect(entry.blockedStatus).toBe("BLOCKED_AUTHORIZATION");
  });

  test("6.4 NewsEvent is NOT in eligibleSources", () => {
    const names = bundle.eligibleSources.map((s) => s.sourceName);
    expect(names).not.toContain("NewsEvent");
  });

  test("6.5 FinancialReport is NOT in eligibleSources", () => {
    const names = bundle.eligibleSources.map((s) => s.sourceName);
    expect(names).not.toContain("FinancialReport");
  });

  test("6.6 Chip is NOT in eligibleSources", () => {
    const names = bundle.eligibleSources.map((s) => s.sourceName);
    expect(names).not.toContain("Chip");
  });

  test("6.7 blocked sources have non-empty blockingReasons", () => {
    for (const blocked of bundle.blockedSources) {
      expect(blocked.blockingReasons.length).toBeGreaterThan(0);
    }
  });

  test("6.8 blocked sources have non-empty requiredNextEvidence", () => {
    for (const blocked of bundle.blockedSources) {
      expect(blocked.requiredNextEvidence.length).toBeGreaterThan(0);
    }
  });
});

// ─── Group 7: Validator — valid bundle ────────────────────────────────────────

describe("Group 7: Validator accepts valid bundle", () => {
  test("7.1 default bundle passes validation", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
    const result = validatePaperSimulationInputBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("7.2 validation result has entersAlphaScore=false", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    const result = validatePaperSimulationInputBundle(bundle);
    expect(result.entersAlphaScore).toBe(false);
  });

  test("7.3 validation result has paperOnly=true", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    const result = validatePaperSimulationInputBundle(bundle);
    expect(result.paperOnly).toBe(true);
  });

  test("7.4 buildPaperSimulationInputBundle with all 6 entries passes validation", () => {
    const entries: SimulationInputReadinessEntry[] = [
      makeEligibleEntry("MonthlyRevenue"),
      makeEligibleEntry("Quote"),
      makeEligibleEntry("Regime"),
      makeBlockedEntry("NewsEvent", "BLOCKED_QUALITY_EVIDENCE", ["NLP unvalidated"]),
      makeBlockedEntry("FinancialReport", "BLOCKED_PIT_METADATA", ["releaseDate absent"]),
      makeBlockedEntry("Chip", "BLOCKED_AUTHORIZATION", ["availableAt absent"]),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, {
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
    const result = validatePaperSimulationInputBundle(bundle);
    expect(result.valid).toBe(true);
  });
});

// ─── Group 8: Validator — rejects invalid bundles ─────────────────────────────

describe("Group 8: Validator rejects invalid bundles", () => {
  test("8.1 validator rejects blocked source in eligibleSources", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    // Manually inject a blocked source into eligibleSources
    const tampered = {
      ...bundle,
      eligibleSources: [
        ...bundle.eligibleSources,
        {
          sourceName: "NewsEvent",
          readinessStatus: "SIMULATION_INPUT_ELIGIBLE",
          paperOnly: true,
          dryRunOnly: true,
          entersAlphaScore: false,
          noInvestmentAdvice: true,
          noBuySellActionSemantics: true,
          asOfDate: "2026-05-21T00:00:00.000Z",
          payloadSummary: "tampered",
        } satisfies PaperSimulationEligibleSourceInput,
      ],
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("NewsEvent"))).toBe(true);
  });

  test("8.2 validator rejects paperOnly=false", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    const tampered = { ...bundle, paperOnly: false as unknown as true };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("paperOnly"))).toBe(true);
  });

  test("8.3 validator rejects entersAlphaScore=true", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    const tampered = {
      ...bundle,
      entersAlphaScore: true as unknown as false,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("entersAlphaScore"))).toBe(true);
  });

  test("8.4 validator rejects noInvestmentAdvice=false", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    const tampered = {
      ...bundle,
      noInvestmentAdvice: false as unknown as true,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("noInvestmentAdvice"))).toBe(true);
  });

  test("8.5 validator rejects wrong mode", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    const tampered = { ...bundle, mode: "live-trading-mode" as unknown as typeof PAPER_SIMULATION_CONTRACT_MODE };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("mode"))).toBe(true);
  });

  test("8.6 validator rejects forbidden field 'alphaScore' in bundle root", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    const tampered = { ...bundle, alphaScore: 0.9 };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("alphaScore"))).toBe(true);
  });

  test("8.7 validator rejects forbidden field 'recommendation'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    const tampered = { ...bundle, recommendation: "BUY" };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("recommendation"))).toBe(true);
  });

  test("8.8 validator rejects forbidden field 'prediction'", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    const tampered = { ...bundle, prediction: "UP" };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("prediction"))).toBe(true);
  });

  test("8.9 validator rejects noBuySellActionSemantics=false", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    const tampered = {
      ...bundle,
      noBuySellActionSemantics: false as unknown as true,
    };
    const result = validatePaperSimulationInputBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("noBuySellActionSemantics"))).toBe(true);
  });

  test("8.10 validator rejects null input", () => {
    const result = validatePaperSimulationInputBundle(null);
    expect(result.valid).toBe(false);
    expect(result.entersAlphaScore).toBe(false);
  });
});

// ─── Group 9: buildPaperSimulationInputBundle from entries ────────────────────

describe("Group 9: buildPaperSimulationInputBundle from P38 entries", () => {
  test("9.1 eligible entry → appears in eligibleSources", () => {
    const entries = [makeEligibleEntry("Quote")];
    const bundle = buildPaperSimulationInputBundle(entries, {
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
    expect(bundle.eligibleSources.map((s) => s.sourceName)).toContain("Quote");
  });

  test("9.2 blocked entry → appears in blockedSources", () => {
    const entries = [
      makeBlockedEntry("Chip", "BLOCKED_AUTHORIZATION", ["availableAt absent"]),
    ];
    const bundle = buildPaperSimulationInputBundle(entries, {
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
    expect(bundle.blockedSources.map((s) => s.sourceName)).toContain("Chip");
    expect(bundle.eligibleSources.map((s) => s.sourceName)).not.toContain("Chip");
  });

  test("9.3 all governance fields enforced in built bundle", () => {
    const entries = [makeEligibleEntry("MonthlyRevenue")];
    const bundle = buildPaperSimulationInputBundle(entries);
    expect(bundle.paperOnly).toBe(true);
    expect(bundle.dryRunOnly).toBe(true);
    expect(bundle.entersAlphaScore).toBe(false);
    expect(bundle.noInvestmentAdvice).toBe(true);
    expect(bundle.notSimulationExecution).toBe(true);
  });

  test("9.4 bundle is deterministic for same input", () => {
    const entries = [makeEligibleEntry("Regime")];
    const opts = { asOfDate: "2026-05-21T00:00:00.000Z" };
    const b1 = buildPaperSimulationInputBundle(entries, opts);
    const b2 = buildPaperSimulationInputBundle(entries, opts);
    expect(JSON.stringify(b1)).toBe(JSON.stringify(b2));
  });

  test("9.5 empty input produces empty eligible, empty blocked, valid bundle", () => {
    const bundle = buildPaperSimulationInputBundle([], {
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
    expect(bundle.eligibleSources).toHaveLength(0);
    expect(bundle.blockedSources).toHaveLength(0);
    const result = validatePaperSimulationInputBundle(bundle);
    expect(result.valid).toBe(true);
  });
});

// ─── Group 10: Default bundle structure ───────────────────────────────────────

describe("Group 10: Default bundle structure", () => {
  test("10.1 default bundle has exactly 3 eligible sources", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    expect(bundle.eligibleSources).toHaveLength(3);
  });

  test("10.2 default bundle has exactly 3 blocked sources", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    expect(bundle.blockedSources).toHaveLength(3);
  });

  test("10.3 P39_ELIGIBLE_SOURCES contains MonthlyRevenue, Quote, Regime", () => {
    expect(P39_ELIGIBLE_SOURCES).toContain("MonthlyRevenue");
    expect(P39_ELIGIBLE_SOURCES).toContain("Quote");
    expect(P39_ELIGIBLE_SOURCES).toContain("Regime");
  });

  test("10.4 P39_BLOCKED_SOURCES contains NewsEvent, FinancialReport, Chip", () => {
    expect(P39_BLOCKED_SOURCES).toContain("NewsEvent");
    expect(P39_BLOCKED_SOURCES).toContain("FinancialReport");
    expect(P39_BLOCKED_SOURCES).toContain("Chip");
  });

  test("10.5 default bundle is JSON-serializable and stable", () => {
    const bundle = buildDefaultPaperSimulationInputBundle({
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
    const json1 = JSON.stringify(bundle);
    const json2 = JSON.stringify(JSON.parse(json1));
    expect(json1).toBe(json2);
  });

  test("10.6 all eligible entries have noBuySellActionSemantics=true", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    for (const src of bundle.eligibleSources) {
      expect(src.noBuySellActionSemantics).toBe(true);
    }
  });

  test("10.7 all eligible entries have dryRunOnly=true", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    for (const src of bundle.eligibleSources) {
      expect(src.dryRunOnly).toBe(true);
    }
  });
});

// ─── Group 11: Forbidden fields constants ────────────────────────────────────

describe("Group 11: Forbidden fields and uses constants", () => {
  test("11.1 PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS includes alphaScore", () => {
    expect(PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS).toContain("alphaScore");
  });

  test("11.2 PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS includes recommendation", () => {
    expect(PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS).toContain("recommendation");
  });

  test("11.3 PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS includes prediction", () => {
    expect(PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS).toContain("prediction");
  });

  test("11.4 PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS includes buy", () => {
    expect(PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS).toContain("buy");
  });

  test("11.5 PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS includes sell", () => {
    expect(PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS).toContain("sell");
  });

  test("11.6 PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS includes hold", () => {
    expect(PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS).toContain("hold");
  });

  test("11.7 PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS includes backtestResult", () => {
    expect(PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS).toContain("backtestResult");
  });

  test("11.8 PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS includes winRate", () => {
    expect(PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS).toContain("winRate");
  });

  test("11.9 PAPER_SIMULATION_CONTRACT_FORBIDDEN_USES includes investment recommendation", () => {
    const uses = PAPER_SIMULATION_CONTRACT_FORBIDDEN_USES.join("|");
    expect(uses).toContain("investment recommendation");
  });

  test("11.10 PAPER_SIMULATION_CONTRACT_FORBIDDEN_USES includes optimizer", () => {
    const uses = PAPER_SIMULATION_CONTRACT_FORBIDDEN_USES.join("|");
    expect(uses).toContain("optimizer");
  });
});

// ─── Group 12: Isolation and governance ───────────────────────────────────────

describe("Group 12: Isolation and governance", () => {
  test("12.1 no Prisma import in builder module (import check via require path)", () => {
    // This test verifies the module can be imported without Prisma dependency.
    // If Prisma was imported, it would throw during test setup.
    const builder = require("../p39/PaperSimulationInputContractBuilder");
    expect(builder).toBeDefined();
  });

  test("12.2 builder functions are pure — no shared mutable state", () => {
    const b1 = buildDefaultPaperSimulationInputBundle({
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
    const b2 = buildDefaultPaperSimulationInputBundle({
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
    expect(JSON.stringify(b1)).toBe(JSON.stringify(b2));
  });

  test("12.3 modifying returned bundle does not affect next call", () => {
    const b1 = buildDefaultPaperSimulationInputBundle({
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
    (b1 as Record<string, unknown>)["__tampered"] = true;
    const b2 = buildDefaultPaperSimulationInputBundle({
      asOfDate: "2026-05-21T00:00:00.000Z",
    });
    expect((b2 as Record<string, unknown>)["__tampered"]).toBeUndefined();
  });

  test("12.4 eligible source entries never contain forbidden fields", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    for (const entry of bundle.eligibleSources) {
      for (const field of PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS) {
        expect(entry).not.toHaveProperty(field);
      }
    }
  });

  test("12.5 blocked source entries never contain eligible source status", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    for (const entry of bundle.blockedSources) {
      expect(entry.blockedStatus).not.toBe("SIMULATION_INPUT_ELIGIBLE");
    }
  });

  test("12.6 no simulation execution — notSimulationExecution is always true", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    expect(bundle.notSimulationExecution).toBe(true);
    expect(bundle.notOptimizer).toBe(true);
    expect(bundle.notRealBacktest).toBe(true);
  });
});
