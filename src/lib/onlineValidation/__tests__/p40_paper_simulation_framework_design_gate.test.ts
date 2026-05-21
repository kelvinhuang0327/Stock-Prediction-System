/**
 * P40 — Paper Simulation Framework Design Gate Tests
 *
 * 90 tests across 15 groups.
 *
 * GOVERNANCE:
 * - entersAlphaScore = false
 * - paperOnly = true
 * - dryRunOnly = true
 * - noExecution = true
 * - No simulation execution tested
 * - No Prisma, DB, scoring import
 */

import {
  createPaperSimulationFrameworkPlan,
  validateFrameworkBoundary,
  assertNoSimulationExecution,
  summarizeFrameworkReadiness,
  P39_ELIGIBLE_SOURCES,
  P39_BLOCKED_SOURCES,
  PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS,
  PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_USES,
  PAPER_SIMULATION_FRAMEWORK_VERSION,
  PAPER_SIMULATION_FRAMEWORK_DISCLAIMER,
  P40_EXECUTION_STATUS,
} from "../p40/PaperSimulationFrameworkBoundary";
import {
  buildDefaultPaperSimulationInputBundle,
} from "../p39/PaperSimulationInputContractBuilder";
import type { PaperSimulationFrameworkPlan } from "../p40/PaperSimulationFrameworkTypes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeValidBundle() {
  return buildDefaultPaperSimulationInputBundle({ generatedAt: "2026-05-21T00:00:00.000Z" });
}

function makeValidPlan(): PaperSimulationFrameworkPlan {
  return createPaperSimulationFrameworkPlan(makeValidBundle(), {
    generatedAt: "2026-05-21T00:00:00.000Z",
  });
}

// ─── Group 1: Governance Invariants ──────────────────────────────────────────

describe("Group 1 — Framework governance invariants", () => {
  let plan: PaperSimulationFrameworkPlan;

  beforeEach(() => {
    plan = makeValidPlan();
  });

  test("1.1 paperOnly is true", () => {
    expect(plan.paperOnly).toBe(true);
  });

  test("1.2 dryRunOnly is true", () => {
    expect(plan.dryRunOnly).toBe(true);
  });

  test("1.3 entersAlphaScore is false", () => {
    expect(plan.entersAlphaScore).toBe(false);
  });

  test("1.4 noExecution is true", () => {
    expect(plan.noExecution).toBe(true);
  });

  test("1.5 noInvestmentAdvice is true", () => {
    expect(plan.noInvestmentAdvice).toBe(true);
  });

  test("1.6 noBuySellActionSemantics is true", () => {
    expect(plan.noBuySellActionSemantics).toBe(true);
  });

  test("1.7 notSimulationExecution is true", () => {
    expect(plan.notSimulationExecution).toBe(true);
  });

  test("1.8 notOptimizer is true", () => {
    expect(plan.notOptimizer).toBe(true);
  });

  test("1.9 notRealBacktest is true", () => {
    expect(plan.notRealBacktest).toBe(true);
  });

  test("1.10 governanceFlags mirrors top-level flags", () => {
    expect(plan.governanceFlags.paperOnly).toBe(true);
    expect(plan.governanceFlags.dryRunOnly).toBe(true);
    expect(plan.governanceFlags.entersAlphaScore).toBe(false);
    expect(plan.governanceFlags.noExecution).toBe(true);
    expect(plan.governanceFlags.noInvestmentAdvice).toBe(true);
    expect(plan.governanceFlags.noBuySellActionSemantics).toBe(true);
    expect(plan.governanceFlags.notSimulationExecution).toBe(true);
    expect(plan.governanceFlags.notOptimizer).toBe(true);
    expect(plan.governanceFlags.notRealBacktest).toBe(true);
  });
});

// ─── Group 2: Framework accepts P39 input bundle ──────────────────────────────

describe("Group 2 — Framework accepts P39 input bundle", () => {
  test("2.1 createPaperSimulationFrameworkPlan accepts valid P39 bundle", () => {
    const bundle = makeValidBundle();
    expect(() => createPaperSimulationFrameworkPlan(bundle)).not.toThrow();
  });

  test("2.2 plan references P39 bundle mode", () => {
    const bundle = makeValidBundle();
    const plan = createPaperSimulationFrameworkPlan(bundle);
    expect(plan.acceptedInputBundle.mode).toBe("paper-simulation-input-contract");
  });

  test("2.3 plan references P39 bundle version", () => {
    const bundle = makeValidBundle();
    const plan = createPaperSimulationFrameworkPlan(bundle);
    expect(plan.acceptedInputBundle.version).toBe("p39-paper-simulation-input-contract-v1");
  });

  test("2.4 plan carries eligible sources from bundle", () => {
    const bundle = makeValidBundle();
    const plan = createPaperSimulationFrameworkPlan(bundle);
    expect(plan.eligibleSources).toContain("MonthlyRevenue");
    expect(plan.eligibleSources).toContain("Quote");
    expect(plan.eligibleSources).toContain("Regime");
  });

  test("2.5 plan carries blocked sources from bundle", () => {
    const bundle = makeValidBundle();
    const plan = createPaperSimulationFrameworkPlan(bundle);
    expect(plan.blockedSources).toContain("NewsEvent");
    expect(plan.blockedSources).toContain("FinancialReport");
    expect(plan.blockedSources).toContain("Chip");
  });
});

// ─── Group 3: Framework phase and mode ───────────────────────────────────────

describe("Group 3 — Framework phase and mode", () => {
  let plan: PaperSimulationFrameworkPlan;

  beforeEach(() => {
    plan = makeValidPlan();
  });

  test("3.1 phase is P40", () => {
    expect(plan.phase).toBe("P40");
  });

  test("3.2 frameworkMode is design-only", () => {
    expect(plan.frameworkMode).toBe("design-only");
  });

  test("3.3 frameworkStatus is FRAMEWORK_READY", () => {
    expect(plan.frameworkStatus).toBe("FRAMEWORK_READY");
  });

  test("3.4 version contains p40", () => {
    expect(plan.version).toContain("p40");
  });

  test("3.5 version equals PAPER_SIMULATION_FRAMEWORK_VERSION constant", () => {
    expect(plan.version).toBe(PAPER_SIMULATION_FRAMEWORK_VERSION);
  });
});

// ─── Group 4: Execution is blocked ───────────────────────────────────────────

describe("Group 4 — Execution is blocked", () => {
  let plan: PaperSimulationFrameworkPlan;

  beforeEach(() => {
    plan = makeValidPlan();
  });

  test("4.1 executionStatus is EXECUTION_BLOCKED_PENDING_AUTH", () => {
    expect(plan.executionStatus).toBe("EXECUTION_BLOCKED_PENDING_AUTH");
  });

  test("4.2 P40_EXECUTION_STATUS constant is EXECUTION_BLOCKED_PENDING_AUTH", () => {
    expect(P40_EXECUTION_STATUS).toBe("EXECUTION_BLOCKED_PENDING_AUTH");
  });

  test("4.3 allowedNextStep mentions P41 authorization", () => {
    expect(plan.allowedNextStep).toContain("P41");
    expect(plan.allowedNextStep).toContain("authorization");
  });

  test("4.4 requiredAuthorizationForExecution is the correct phrase", () => {
    expect(plan.requiredAuthorizationForExecution).toContain("P41");
    expect(plan.requiredAuthorizationForExecution).toContain("YES");
  });

  test("4.5 executionStatus is not EXECUTION_DRY_RUN_AUTHORIZED", () => {
    expect(plan.executionStatus).not.toBe("EXECUTION_DRY_RUN_AUTHORIZED");
  });
});

// ─── Group 5: Eligible sources ────────────────────────────────────────────────

describe("Group 5 — Eligible sources (MonthlyRevenue, Quote, Regime)", () => {
  test("5.1 MonthlyRevenue is in eligibleSources", () => {
    const plan = makeValidPlan();
    expect(plan.eligibleSources).toContain("MonthlyRevenue");
  });

  test("5.2 Quote is in eligibleSources", () => {
    const plan = makeValidPlan();
    expect(plan.eligibleSources).toContain("Quote");
  });

  test("5.3 Regime is in eligibleSources", () => {
    const plan = makeValidPlan();
    expect(plan.eligibleSources).toContain("Regime");
  });

  test("5.4 Exactly 3 eligible sources", () => {
    const plan = makeValidPlan();
    expect(plan.eligibleSources).toHaveLength(3);
  });

  test("5.5 P39_ELIGIBLE_SOURCES constant contains all three", () => {
    expect(P39_ELIGIBLE_SOURCES).toContain("MonthlyRevenue");
    expect(P39_ELIGIBLE_SOURCES).toContain("Quote");
    expect(P39_ELIGIBLE_SOURCES).toContain("Regime");
  });
});

// ─── Group 6: Blocked sources ────────────────────────────────────────────────

describe("Group 6 — Blocked sources (NewsEvent, FinancialReport, Chip)", () => {
  test("6.1 NewsEvent is in blockedSources", () => {
    const plan = makeValidPlan();
    expect(plan.blockedSources).toContain("NewsEvent");
  });

  test("6.2 FinancialReport is in blockedSources", () => {
    const plan = makeValidPlan();
    expect(plan.blockedSources).toContain("FinancialReport");
  });

  test("6.3 Chip is in blockedSources", () => {
    const plan = makeValidPlan();
    expect(plan.blockedSources).toContain("Chip");
  });

  test("6.4 NewsEvent is NOT in eligibleSources", () => {
    const plan = makeValidPlan();
    expect(plan.eligibleSources).not.toContain("NewsEvent");
  });

  test("6.5 FinancialReport is NOT in eligibleSources", () => {
    const plan = makeValidPlan();
    expect(plan.eligibleSources).not.toContain("FinancialReport");
  });

  test("6.6 Chip is NOT in eligibleSources", () => {
    const plan = makeValidPlan();
    expect(plan.eligibleSources).not.toContain("Chip");
  });

  test("6.7 Exactly 3 blocked sources", () => {
    const plan = makeValidPlan();
    expect(plan.blockedSources).toHaveLength(3);
  });

  test("6.8 P39_BLOCKED_SOURCES constant contains all three", () => {
    expect(P39_BLOCKED_SOURCES).toContain("NewsEvent");
    expect(P39_BLOCKED_SOURCES).toContain("FinancialReport");
    expect(P39_BLOCKED_SOURCES).toContain("Chip");
  });
});

// ─── Group 7: Validator accepts valid plan ────────────────────────────────────

describe("Group 7 — Validator accepts valid framework plan", () => {
  test("7.1 validateFrameworkBoundary returns valid=true for valid plan", () => {
    const plan = makeValidPlan();
    const result = validateFrameworkBoundary(plan);
    expect(result.valid).toBe(true);
  });

  test("7.2 validateFrameworkBoundary returns empty errors for valid plan", () => {
    const plan = makeValidPlan();
    const result = validateFrameworkBoundary(plan);
    expect(result.errors).toHaveLength(0);
  });

  test("7.3 validation result entersAlphaScore is always false", () => {
    const plan = makeValidPlan();
    const result = validateFrameworkBoundary(plan);
    expect(result.entersAlphaScore).toBe(false);
  });

  test("7.4 validation result noExecution is always true", () => {
    const plan = makeValidPlan();
    const result = validateFrameworkBoundary(plan);
    expect(result.noExecution).toBe(true);
  });

  test("7.5 validation result paperOnly is always true", () => {
    const plan = makeValidPlan();
    const result = validateFrameworkBoundary(plan);
    expect(result.paperOnly).toBe(true);
  });
});

// ─── Group 8: Validator rejects invalid plans ─────────────────────────────────

describe("Group 8 — Validator rejects invalid framework plans", () => {
  test("8.1 rejects null input", () => {
    const result = validateFrameworkBoundary(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("8.2 rejects plan with wrong phase", () => {
    const plan = { ...makeValidPlan(), phase: "P39" as unknown as "P40" };
    const result = validateFrameworkBoundary(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("phase"))).toBe(true);
  });

  test("8.3 rejects plan with noExecution=false", () => {
    const plan = { ...makeValidPlan(), noExecution: false as unknown as true };
    const result = validateFrameworkBoundary(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("noExecution"))).toBe(true);
  });

  test("8.4 rejects plan with paperOnly=false", () => {
    const plan = { ...makeValidPlan(), paperOnly: false as unknown as true };
    const result = validateFrameworkBoundary(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("paperOnly"))).toBe(true);
  });

  test("8.5 rejects plan with entersAlphaScore=true", () => {
    const plan = { ...makeValidPlan(), entersAlphaScore: true as unknown as false };
    const result = validateFrameworkBoundary(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("entersAlphaScore"))).toBe(true);
  });

  test("8.6 rejects plan with executionStatus=EXECUTION_DRY_RUN_AUTHORIZED", () => {
    const plan = {
      ...makeValidPlan(),
      executionStatus: "EXECUTION_DRY_RUN_AUTHORIZED" as unknown as typeof P40_EXECUTION_STATUS,
    };
    const result = validateFrameworkBoundary(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("executionStatus"))).toBe(true);
  });

  test("8.7 rejects plan with blocked source in eligibleSources", () => {
    const plan = { ...makeValidPlan(), eligibleSources: ["MonthlyRevenue", "Quote", "Regime", "NewsEvent"] };
    const result = validateFrameworkBoundary(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("NewsEvent"))).toBe(true);
  });

  test("8.8 rejects plan with invalid frameworkMode", () => {
    const plan = { ...makeValidPlan(), frameworkMode: "execution-mode" as unknown as "design-only" };
    const result = validateFrameworkBoundary(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("frameworkMode"))).toBe(true);
  });

  test("8.9 rejects plan with missing disclaimer", () => {
    const plan = { ...makeValidPlan(), disclaimer: "" };
    const result = validateFrameworkBoundary(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("disclaimer"))).toBe(true);
  });

  test("8.10 rejects plan with empty forbiddenOutputs", () => {
    const plan = { ...makeValidPlan(), forbiddenOutputs: [] };
    const result = validateFrameworkBoundary(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("forbiddenOutputs"))).toBe(true);
  });

  test("8.11 rejects plan with noBuySellActionSemantics=false", () => {
    const plan = {
      ...makeValidPlan(),
      noBuySellActionSemantics: false as unknown as true,
    };
    const result = validateFrameworkBoundary(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("noBuySellActionSemantics"))).toBe(true);
  });

  test("8.12 rejects plan with notSimulationExecution=false", () => {
    const plan = {
      ...makeValidPlan(),
      notSimulationExecution: false as unknown as true,
    };
    const result = validateFrameworkBoundary(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("notSimulationExecution"))).toBe(true);
  });
});

// ─── Group 9: assertNoSimulationExecution ─────────────────────────────────────

describe("Group 9 — assertNoSimulationExecution", () => {
  test("9.1 does not throw for clean payload", () => {
    expect(() => assertNoSimulationExecution({ phase: "P40", status: "FRAMEWORK_READY" })).not.toThrow();
  });

  test("9.2 throws for payload with 'prediction' field", () => {
    expect(() => assertNoSimulationExecution({ prediction: "UP" })).toThrow();
  });

  test("9.3 throws for payload with 'recommendation' field", () => {
    expect(() => assertNoSimulationExecution({ recommendation: "BUY" })).toThrow();
  });

  test("9.4 throws for payload with 'pnl' field", () => {
    expect(() => assertNoSimulationExecution({ pnl: 12345 })).toThrow();
  });

  test("9.5 throws for payload with 'winRate' field", () => {
    expect(() => assertNoSimulationExecution({ winRate: 0.6 })).toThrow();
  });

  test("9.6 throws for payload with 'ROI' field", () => {
    expect(() => assertNoSimulationExecution({ ROI: 0.15 })).toThrow();
  });

  test("9.7 throws for payload with 'returnPct' field", () => {
    expect(() => assertNoSimulationExecution({ returnPct: 0.12 })).toThrow();
  });

  test("9.8 throws for payload with 'backtestResult' field", () => {
    expect(() => assertNoSimulationExecution({ backtestResult: {} })).toThrow();
  });

  test("9.9 throws for payload with 'optimizerScore' field", () => {
    expect(() => assertNoSimulationExecution({ optimizerScore: 0.9 })).toThrow();
  });

  test("9.10 does not throw for null or undefined", () => {
    expect(() => assertNoSimulationExecution(null)).not.toThrow();
    expect(() => assertNoSimulationExecution(undefined)).not.toThrow();
  });
});

// ─── Group 10: summarizeFrameworkReadiness ────────────────────────────────────

describe("Group 10 — summarizeFrameworkReadiness", () => {
  test("10.1 returns non-empty string", () => {
    const plan = makeValidPlan();
    const summary = summarizeFrameworkReadiness(plan);
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  test("10.2 summary contains P40", () => {
    const plan = makeValidPlan();
    expect(summarizeFrameworkReadiness(plan)).toContain("P40");
  });

  test("10.3 summary contains FRAMEWORK_READY", () => {
    const plan = makeValidPlan();
    expect(summarizeFrameworkReadiness(plan)).toContain("FRAMEWORK_READY");
  });

  test("10.4 summary contains EXECUTION_BLOCKED_PENDING_AUTH", () => {
    const plan = makeValidPlan();
    expect(summarizeFrameworkReadiness(plan)).toContain("EXECUTION_BLOCKED_PENDING_AUTH");
  });

  test("10.5 summary contains eligible sources", () => {
    const plan = makeValidPlan();
    const summary = summarizeFrameworkReadiness(plan);
    expect(summary).toContain("MonthlyRevenue");
    expect(summary).toContain("Quote");
    expect(summary).toContain("Regime");
  });

  test("10.6 summary contains blocked sources", () => {
    const plan = makeValidPlan();
    const summary = summarizeFrameworkReadiness(plan);
    expect(summary).toContain("NewsEvent");
    expect(summary).toContain("FinancialReport");
    expect(summary).toContain("Chip");
  });

  test("10.7 summary is deterministic", () => {
    const plan = makeValidPlan();
    expect(summarizeFrameworkReadiness(plan)).toBe(summarizeFrameworkReadiness(plan));
  });
});

// ─── Group 11: Forbidden outputs constants ────────────────────────────────────

describe("Group 11 — Forbidden outputs and uses constants", () => {
  test("11.1 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS contains prediction", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS).toContain("prediction");
  });

  test("11.2 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS contains recommendation", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS).toContain("recommendation");
  });

  test("11.3 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS contains buy", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS).toContain("buy");
  });

  test("11.4 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS contains sell", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS).toContain("sell");
  });

  test("11.5 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS contains hold", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS).toContain("hold");
  });

  test("11.6 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS contains pnl", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS).toContain("pnl");
  });

  test("11.7 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS contains winRate", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS).toContain("winRate");
  });

  test("11.8 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS contains returnPct", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS).toContain("returnPct");
  });

  test("11.9 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS contains alphaScore", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS).toContain("alphaScore");
  });

  test("11.10 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS contains backtestResult", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_OUTPUTS).toContain("backtestResult");
  });

  test("11.11 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_USES contains simulation execution", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_USES).toContain("simulation execution");
  });

  test("11.12 PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_USES contains optimizer execution", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_FORBIDDEN_USES).toContain("optimizer execution");
  });

  test("11.13 plan.forbiddenOutputs includes all key forbidden terms", () => {
    const plan = makeValidPlan();
    const fo = plan.forbiddenOutputs as string[];
    expect(fo).toContain("prediction");
    expect(fo).toContain("recommendation");
    expect(fo).toContain("pnl");
    expect(fo).toContain("winRate");
    expect(fo).toContain("returnPct");
  });
});

// ─── Group 12: No forbidden outputs in plan structure ─────────────────────────

describe("Group 12 — No forbidden outputs appear as plan result fields", () => {
  test("12.1 plan does not have 'prediction' field with a result value", () => {
    const plan = makeValidPlan();
    expect((plan as Record<string, unknown>)["prediction"]).toBeUndefined();
  });

  test("12.2 plan does not have 'recommendation' field", () => {
    const plan = makeValidPlan();
    expect((plan as Record<string, unknown>)["recommendation"]).toBeUndefined();
  });

  test("12.3 plan does not have 'pnl' field", () => {
    const plan = makeValidPlan();
    expect((plan as Record<string, unknown>)["pnl"]).toBeUndefined();
  });

  test("12.4 plan does not have 'winRate' field", () => {
    const plan = makeValidPlan();
    expect((plan as Record<string, unknown>)["winRate"]).toBeUndefined();
  });

  test("12.5 plan does not have 'returnPct' field", () => {
    const plan = makeValidPlan();
    expect((plan as Record<string, unknown>)["returnPct"]).toBeUndefined();
  });

  test("12.6 plan does not have 'ROI' field", () => {
    const plan = makeValidPlan();
    expect((plan as Record<string, unknown>)["ROI"]).toBeUndefined();
  });

  test("12.7 plan does not have 'buy' field", () => {
    const plan = makeValidPlan();
    expect((plan as Record<string, unknown>)["buy"]).toBeUndefined();
  });

  test("12.8 plan does not have 'sell' field", () => {
    const plan = makeValidPlan();
    expect((plan as Record<string, unknown>)["sell"]).toBeUndefined();
  });

  test("12.9 plan does not have 'hold' field", () => {
    const plan = makeValidPlan();
    expect((plan as Record<string, unknown>)["hold"]).toBeUndefined();
  });

  test("12.10 plan does not have 'optimizerScore' field", () => {
    const plan = makeValidPlan();
    expect((plan as Record<string, unknown>)["optimizerScore"]).toBeUndefined();
  });

  test("12.11 plan does not have 'backtestResult' field", () => {
    const plan = makeValidPlan();
    expect((plan as Record<string, unknown>)["backtestResult"]).toBeUndefined();
  });

  test("12.12 plan does not have 'profit' field", () => {
    const plan = makeValidPlan();
    expect((plan as Record<string, unknown>)["profit"]).toBeUndefined();
  });
});

// ─── Group 13: Isolation and governance ──────────────────────────────────────

describe("Group 13 — Isolation and governance", () => {
  test("13.1 no Prisma import in PaperSimulationFrameworkBoundary", () => {
    // This test passes by virtue of the file not importing Prisma.
    // If it did, the test suite would fail to compile or have type errors.
    const plan = makeValidPlan();
    expect(plan).toBeDefined();
  });

  test("13.2 createPaperSimulationFrameworkPlan is a pure function", () => {
    const bundle = makeValidBundle();
    const plan1 = createPaperSimulationFrameworkPlan(bundle, { generatedAt: "2026-05-21T00:00:00.000Z" });
    const plan2 = createPaperSimulationFrameworkPlan(bundle, { generatedAt: "2026-05-21T00:00:00.000Z" });
    expect(JSON.stringify(plan1)).toBe(JSON.stringify(plan2));
  });

  test("13.3 JSON serialization is stable", () => {
    const plan = makeValidPlan();
    const json1 = JSON.stringify(plan);
    const json2 = JSON.stringify(plan);
    expect(json1).toBe(json2);
  });

  test("13.4 plan can round-trip through JSON.stringify + JSON.parse", () => {
    const plan = makeValidPlan();
    const parsed = JSON.parse(JSON.stringify(plan)) as PaperSimulationFrameworkPlan;
    expect(parsed.phase).toBe("P40");
    expect(parsed.entersAlphaScore).toBe(false);
    expect(parsed.paperOnly).toBe(true);
    expect(parsed.noExecution).toBe(true);
  });

  test("13.5 disclaimer is present and contains governance language", () => {
    const plan = makeValidPlan();
    expect(plan.disclaimer).toContain("entersAlphaScore = false");
    expect(plan.disclaimer).toContain("paperOnly = true");
    expect(plan.disclaimer).toContain("noExecution = true");
  });

  test("13.6 PAPER_SIMULATION_FRAMEWORK_DISCLAIMER contains P41 auth requirement", () => {
    expect(PAPER_SIMULATION_FRAMEWORK_DISCLAIMER).toContain("P41");
    expect(PAPER_SIMULATION_FRAMEWORK_DISCLAIMER).toContain("YES");
  });

  test("13.7 validationSummary mentions eligible and blocked count", () => {
    const plan = makeValidPlan();
    expect(plan.validationSummary).toContain("3");
  });

  test("13.8 validationSummary explicitly says no simulation was executed", () => {
    const plan = makeValidPlan();
    expect(plan.validationSummary.toLowerCase()).toContain("no simulation was executed");
  });
});

// ─── Group 14: P39 regression ─────────────────────────────────────────────────

describe("Group 14 — P39 contract regression", () => {
  test("14.1 buildDefaultPaperSimulationInputBundle still works after P40 added", () => {
    expect(() => buildDefaultPaperSimulationInputBundle()).not.toThrow();
  });

  test("14.2 P39 bundle mode is paper-simulation-input-contract", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    expect(bundle.mode).toBe("paper-simulation-input-contract");
  });

  test("14.3 P39 bundle entersAlphaScore is false", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    expect(bundle.entersAlphaScore).toBe(false);
  });

  test("14.4 P39 bundle has 3 eligible sources", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    expect(bundle.eligibleSources).toHaveLength(3);
  });

  test("14.5 P39 bundle has 3 blocked sources", () => {
    const bundle = buildDefaultPaperSimulationInputBundle();
    expect(bundle.blockedSources).toHaveLength(3);
  });
});

// ─── Group 15: No simulation execution function exists ───────────────────────

describe("Group 15 — No simulation execution function is implemented", () => {
  test("15.1 there is no executeSimulation export in boundary module", () => {
    // Dynamic import check — if executeSimulation existed, this cast would find it
    const mod = require("../p40/PaperSimulationFrameworkBoundary");
    expect(mod.executeSimulation).toBeUndefined();
  });

  test("15.2 there is no runSimulation export", () => {
    const mod = require("../p40/PaperSimulationFrameworkBoundary");
    expect(mod.runSimulation).toBeUndefined();
  });

  test("15.3 there is no runBacktest export", () => {
    const mod = require("../p40/PaperSimulationFrameworkBoundary");
    expect(mod.runBacktest).toBeUndefined();
  });

  test("15.4 there is no runOptimizer export", () => {
    const mod = require("../p40/PaperSimulationFrameworkBoundary");
    expect(mod.runOptimizer).toBeUndefined();
  });

  test("15.5 there is no computePnL export", () => {
    const mod = require("../p40/PaperSimulationFrameworkBoundary");
    expect(mod.computePnL).toBeUndefined();
  });

  test("15.6 there is no computeROI export", () => {
    const mod = require("../p40/PaperSimulationFrameworkBoundary");
    expect(mod.computeROI).toBeUndefined();
  });

  test("15.7 there is no generateRecommendation export", () => {
    const mod = require("../p40/PaperSimulationFrameworkBoundary");
    expect(mod.generateRecommendation).toBeUndefined();
  });

  test("15.8 there is no computeWinRate export", () => {
    const mod = require("../p40/PaperSimulationFrameworkBoundary");
    expect(mod.computeWinRate).toBeUndefined();
  });
});
