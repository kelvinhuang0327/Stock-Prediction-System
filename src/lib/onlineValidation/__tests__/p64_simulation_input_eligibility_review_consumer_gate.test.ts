/**
 * P64 — Axis B Simulation Input Eligibility Review Consumer Gate Tests
 *
 * Test suite for the P64 consumer gate.
 * All tests are pure — no DB, no Prisma, no network, no filesystem (except
 * source text scans which use fs.readFileSync on the P64 source file).
 *
 * 63 tests across 13 groups:
 *   Group 1:  Gate Version (3)
 *   Group 2:  evaluatedAt (3)
 *   Group 3:  Decision — APPROVE (5)
 *   Group 4:  Decision — BLOCKED_BY_GOVERNANCE_VIOLATION (3)
 *   Group 5:  Decision — BLOCKED_BY_NO_ELIGIBLE_SOURCES (3)
 *   Group 6:  Decision — REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY (3)
 *   Group 7:  Source Name Arrays (10)
 *   Group 8:  nextAllowedPhase (4)
 *   Group 9:  Warnings (4)
 *   Group 10: Governance booleans (5)
 *   Group 11: Serialization / immutability (5)
 *   Group 12: Forbidden field / source scans (10)
 *   Group 13: Boundary / regression (5)
 */

import * as fs from "fs";
import * as path from "path";

import {
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONSUMER_GATE_VERSION,
  evaluateSimulationInputEligibilityReviewArtifactForBundlePreview,
  type SimulationInputEligibilityReviewConsumerGateResult,
} from "../p64/SimulationInputEligibilityReviewConsumerGate";

import {
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS,
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE,
  type SimulationInputEligibilityReviewArtifact,
  type SimulationInputEligibilityReviewEntry,
  type SimulationInputReviewSourceName,
  type SimulationInputReviewStatus,
  type SimulationInputPitState,
} from "../p62/SimulationInputEligibilityReviewContract";

import { buildSimulationInputEligibilityReviewArtifact } from "../p63/SimulationInputEligibilityReviewBuilder";

// ─── Aliases ─────────────────────────────────────────────────────────────────

const evaluate = evaluateSimulationInputEligibilityReviewArtifactForBundlePreview;
const GATE_VERSION = SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONSUMER_GATE_VERSION;
const TS = "2026-01-01T00:00:00.000Z";

// ─── Source Text ──────────────────────────────────────────────────────────────

const GATE_SOURCE_FILE = path.resolve(
  __dirname,
  "../p64/SimulationInputEligibilityReviewConsumerGate.ts",
);
const gateSource = fs.readFileSync(GATE_SOURCE_FILE, "utf-8");

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(
  source: SimulationInputReviewSourceName,
  status: SimulationInputReviewStatus,
  pitState: SimulationInputPitState,
  requiredAuthorization: string | null = null,
): SimulationInputEligibilityReviewEntry {
  return {
    source,
    status,
    pitState,
    allowedUse: "structural input eligibility review only",
    forbiddenUse: ["scoring", "prediction", "simulation execution"],
    requiredAuthorization,
  };
}

function makeQuoteEntry(): SimulationInputEligibilityReviewEntry {
  return makeEntry("Quote", "ELIGIBLE_FOR_REVIEW_ARTIFACT", "PIT_SAFE_IF_DATE_PRESENT");
}

function makeRegimeEntry(): SimulationInputEligibilityReviewEntry {
  return makeEntry(
    "Regime",
    "ELIGIBLE_FOR_REVIEW_ARTIFACT",
    "PIT_SAFE_IF_DATE_AND_PIT_SAFETY_PRESENT",
  );
}

function makeMonthlyRevenueEntry(): SimulationInputEligibilityReviewEntry {
  return makeEntry(
    "MonthlyRevenue",
    "ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING",
    "LOW_CONFIDENCE_PIT_INFERRED_IF_RELEASE_DATE_MISSING",
  );
}

function makeFinancialReportEntry(): SimulationInputEligibilityReviewEntry {
  return makeEntry(
    "FinancialReport",
    "BLOCKED",
    "BLOCKED_PENDING_PIT_METADATA",
    "PIT metadata required before use",
  );
}

function makeChipEntry(): SimulationInputEligibilityReviewEntry {
  return makeEntry(
    "Chip",
    "BLOCKED",
    "BLOCKED_PENDING_AVAILABLE_AT_AND_PROD_LOGS",
    "availableAt + prod logs required",
  );
}

function makeNewsEventEntry(): SimulationInputEligibilityReviewEntry {
  return makeEntry(
    "NewsEvent",
    "AUDIT_ONLY",
    "AUDIT_ONLY_PENDING_QUALITY_AND_SYMBOL_LINKAGE",
    "quality + symbol linkage audit required",
  );
}

/** All 6 P61 sources in canonical order. */
function makeP61Entries(): readonly SimulationInputEligibilityReviewEntry[] {
  return [
    makeQuoteEntry(),
    makeRegimeEntry(),
    makeMonthlyRevenueEntry(),
    makeFinancialReportEntry(),
    makeChipEntry(),
    makeNewsEventEntry(),
  ];
}

function makeArtifact(
  entries: readonly SimulationInputEligibilityReviewEntry[],
  fixedGeneratedAt = TS,
): SimulationInputEligibilityReviewArtifact {
  return buildSimulationInputEligibilityReviewArtifact({ entries, fixedGeneratedAt });
}

/** Construct an artifact with tampered governance (for governance violation tests). */
function makeBadGovernanceArtifact(
  tamper: Partial<typeof SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE>,
): SimulationInputEligibilityReviewArtifact {
  const base = makeArtifact([makeQuoteEntry()]);
  return {
    ...base,
    governance: { ...base.governance, ...tamper },
  } as unknown as SimulationInputEligibilityReviewArtifact;
}

// ─── Group 1: Gate Version ───────────────────────────────────────────────────

describe("P64 — Gate Version", () => {
  it("GATE_VERSION constant has exact expected value", () => {
    expect(GATE_VERSION).toBe(
      "p64-axis-b-simulation-input-eligibility-review-consumer-gate-v0",
    );
  });

  it("result.gateVersion equals GATE_VERSION constant", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.gateVersion).toBe(GATE_VERSION);
  });

  it("gateVersion is a string", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const result = evaluate(artifact, TS);
    expect(typeof result.gateVersion).toBe("string");
  });
});

// ─── Group 2: evaluatedAt ────────────────────────────────────────────────────

describe("P64 — evaluatedAt", () => {
  it("uses fixedEvaluatedAt when provided", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.evaluatedAt).toBe(TS);
  });

  it("default evaluatedAt is a non-empty ISO string when not provided", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const before = new Date().toISOString();
    const result = evaluate(artifact);
    const after = new Date().toISOString();
    expect(result.evaluatedAt.length).toBeGreaterThan(0);
    expect(result.evaluatedAt >= before).toBe(true);
    expect(result.evaluatedAt <= after).toBe(true);
  });

  it("two calls with same fixedEvaluatedAt produce the same evaluatedAt", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const r1 = evaluate(artifact, TS);
    const r2 = evaluate(artifact, TS);
    expect(r1.evaluatedAt).toBe(r2.evaluatedAt);
  });
});

// ─── Group 3: Decision — APPROVE ─────────────────────────────────────────────

describe("P64 — Decision: APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW", () => {
  it("approves when governance passes and at least one eligible source exists", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.decision).toBe("APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW");
  });

  it("approves when eligible sources exist alongside low-confidence sources", () => {
    const artifact = makeArtifact([makeQuoteEntry(), makeMonthlyRevenueEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.decision).toBe("APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW");
  });

  it("approves when eligible sources exist alongside blocked and audit-only sources", () => {
    const artifact = makeArtifact(makeP61Entries());
    const result = evaluate(artifact, TS);
    expect(result.decision).toBe("APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW");
  });

  it("P61 six-source matrix produces APPROVE because eligible count > 0", () => {
    const artifact = makeArtifact(makeP61Entries());
    const result = evaluate(artifact, TS);
    // Quote + Regime = 2 eligible sources
    expect(result.eligibleSourceNames.length).toBe(2);
    expect(result.decision).toBe("APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW");
  });

  it("governancePassed is true for valid P63 artifact with eligible sources", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.governancePassed).toBe(true);
  });
});

// ─── Group 4: Decision — BLOCKED_BY_GOVERNANCE_VIOLATION ────────────────────

describe("P64 — Decision: BLOCKED_BY_GOVERNANCE_VIOLATION", () => {
  it("blocks when entersAlphaScore is tampered to true", () => {
    const artifact = makeBadGovernanceArtifact({ entersAlphaScore: true as unknown as false });
    const result = evaluate(artifact, TS);
    expect(result.decision).toBe("BLOCKED_BY_GOVERNANCE_VIOLATION");
  });

  it("blocks when noSimulationExecution is tampered to false", () => {
    const artifact = makeBadGovernanceArtifact({ noSimulationExecution: false as unknown as true });
    const result = evaluate(artifact, TS);
    expect(result.decision).toBe("BLOCKED_BY_GOVERNANCE_VIOLATION");
  });

  it("nextAllowedPhase is null when governance fails", () => {
    const artifact = makeBadGovernanceArtifact({ entersAlphaScore: true as unknown as false });
    const result = evaluate(artifact, TS);
    expect(result.nextAllowedPhase).toBeNull();
  });
});

// ─── Group 5: Decision — BLOCKED_BY_NO_ELIGIBLE_SOURCES ─────────────────────

describe("P64 — Decision: BLOCKED_BY_NO_ELIGIBLE_SOURCES", () => {
  it("blocks when all sources are BLOCKED", () => {
    const artifact = makeArtifact([makeFinancialReportEntry(), makeChipEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.decision).toBe("BLOCKED_BY_NO_ELIGIBLE_SOURCES");
  });

  it("blocks when all sources are AUDIT_ONLY", () => {
    const artifact = makeArtifact([makeNewsEventEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.decision).toBe("BLOCKED_BY_NO_ELIGIBLE_SOURCES");
  });

  it("blocks when entries array is empty", () => {
    const artifact = makeArtifact([]);
    const result = evaluate(artifact, TS);
    expect(result.decision).toBe("BLOCKED_BY_NO_ELIGIBLE_SOURCES");
  });
});

// ─── Group 6: Decision — REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY ────────────────

describe("P64 — Decision: REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY", () => {
  it("returns REVIEW_REQUIRED when only low-confidence sources are present", () => {
    const artifact = makeArtifact([makeMonthlyRevenueEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.decision).toBe("REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY");
  });

  it("nextAllowedPhase is null for REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY", () => {
    const artifact = makeArtifact([makeMonthlyRevenueEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.nextAllowedPhase).toBeNull();
  });

  it("returns REVIEW_REQUIRED when eligible=0 and low-confidence>0 (with blocked)", () => {
    const artifact = makeArtifact([makeMonthlyRevenueEntry(), makeFinancialReportEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.decision).toBe("REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY");
  });
});

// ─── Group 7: Source Name Arrays ─────────────────────────────────────────────

describe("P64 — Source Name Arrays", () => {
  it("Quote appears in eligibleSourceNames when ELIGIBLE_FOR_REVIEW_ARTIFACT", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.eligibleSourceNames).toContain("Quote");
  });

  it("Regime appears in eligibleSourceNames when ELIGIBLE_FOR_REVIEW_ARTIFACT", () => {
    const artifact = makeArtifact([makeRegimeEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.eligibleSourceNames).toContain("Regime");
  });

  it("MonthlyRevenue appears in lowConfidenceSourceNames", () => {
    const artifact = makeArtifact([makeMonthlyRevenueEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.lowConfidenceSourceNames).toContain("MonthlyRevenue");
  });

  it("FinancialReport appears in blockedSourceNames", () => {
    const artifact = makeArtifact([makeFinancialReportEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.blockedSourceNames).toContain("FinancialReport");
  });

  it("Chip appears in blockedSourceNames", () => {
    const artifact = makeArtifact([makeChipEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.blockedSourceNames).toContain("Chip");
  });

  it("NewsEvent appears in auditOnlySourceNames", () => {
    const artifact = makeArtifact([makeNewsEventEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.auditOnlySourceNames).toContain("NewsEvent");
  });

  it("P61 six-source matrix produces correct arrays for all four categories", () => {
    const artifact = makeArtifact(makeP61Entries());
    const result = evaluate(artifact, TS);
    expect(result.eligibleSourceNames).toEqual(["Quote", "Regime"]);
    expect(result.lowConfidenceSourceNames).toEqual(["MonthlyRevenue"]);
    expect(result.blockedSourceNames).toEqual(["FinancialReport", "Chip"]);
    expect(result.auditOnlySourceNames).toEqual(["NewsEvent"]);
  });

  it("source names preserve insertion order in eligibleSourceNames", () => {
    const artifact = makeArtifact([makeRegimeEntry(), makeQuoteEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.eligibleSourceNames[0]).toBe("Regime");
    expect(result.eligibleSourceNames[1]).toBe("Quote");
  });

  it("empty entries produce empty arrays for all four categories", () => {
    const artifact = makeArtifact([]);
    const result = evaluate(artifact, TS);
    expect(result.eligibleSourceNames).toHaveLength(0);
    expect(result.lowConfidenceSourceNames).toHaveLength(0);
    expect(result.blockedSourceNames).toHaveLength(0);
    expect(result.auditOnlySourceNames).toHaveLength(0);
  });

  it("single BLOCKED source produces single-element blockedSourceNames", () => {
    const artifact = makeArtifact([makeChipEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.blockedSourceNames).toHaveLength(1);
    expect(result.blockedSourceNames[0]).toBe("Chip");
  });
});

// ─── Group 8: nextAllowedPhase ───────────────────────────────────────────────

describe("P64 — nextAllowedPhase", () => {
  it("is P65_SIMULATION_INPUT_BUNDLE_PREVIEW when decision is APPROVE", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.nextAllowedPhase).toBe("P65_SIMULATION_INPUT_BUNDLE_PREVIEW");
  });

  it("is null when decision is BLOCKED_BY_NO_ELIGIBLE_SOURCES", () => {
    const artifact = makeArtifact([makeNewsEventEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.nextAllowedPhase).toBeNull();
  });

  it("is null when decision is BLOCKED_BY_GOVERNANCE_VIOLATION", () => {
    const artifact = makeBadGovernanceArtifact({ noRecommendation: false as unknown as true });
    const result = evaluate(artifact, TS);
    expect(result.nextAllowedPhase).toBeNull();
  });

  it("is null when decision is REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY", () => {
    const artifact = makeArtifact([makeMonthlyRevenueEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.nextAllowedPhase).toBeNull();
  });
});

// ─── Group 9: Warnings ───────────────────────────────────────────────────────

describe("P64 — Warnings", () => {
  it("warning is emitted when MonthlyRevenue is a low-confidence source", () => {
    const artifact = makeArtifact([makeQuoteEntry(), makeMonthlyRevenueEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("no warning when no low-confidence sources are present", () => {
    const artifact = makeArtifact([makeQuoteEntry(), makeRegimeEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.warnings).toHaveLength(0);
  });

  it("warning string contains the low-confidence source name", () => {
    const artifact = makeArtifact([makeQuoteEntry(), makeMonthlyRevenueEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.warnings[0]).toContain("MonthlyRevenue");
  });

  it("warning string lists multiple low-confidence source names when several exist", () => {
    // Two entries with low-confidence status
    const entry2 = makeEntry(
      "Regime",
      "ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING",
      "LOW_CONFIDENCE_PIT_INFERRED_IF_RELEASE_DATE_MISSING",
    );
    const artifact = makeArtifact([makeQuoteEntry(), makeMonthlyRevenueEntry(), entry2]);
    const result = evaluate(artifact, TS);
    expect(result.warnings[0]).toContain("MonthlyRevenue");
    expect(result.warnings[0]).toContain("Regime");
  });
});

// ─── Group 10: Governance booleans ───────────────────────────────────────────

describe("P64 — Governance booleans", () => {
  it("noSimulationExecuted is always true", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.noSimulationExecuted).toBe(true);
  });

  it("noMetricsProduced is always true", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.noMetricsProduced).toBe(true);
  });

  it("notInvestmentAdvice is always true", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const result = evaluate(artifact, TS);
    expect(result.notInvestmentAdvice).toBe(true);
  });

  it("governancePassed is true for a valid P63 artifact", () => {
    const artifact = makeArtifact(makeP61Entries());
    const result = evaluate(artifact, TS);
    expect(result.governancePassed).toBe(true);
  });

  it("governancePassed is false when entersAlphaScore is tampered", () => {
    const artifact = makeBadGovernanceArtifact({ entersAlphaScore: true as unknown as false });
    const result = evaluate(artifact, TS);
    expect(result.governancePassed).toBe(false);
  });
});

// ─── Group 11: Serialization / immutability ───────────────────────────────────

describe("P64 — Serialization / immutability", () => {
  it("output is JSON-safe (serializes without error and round-trips)", () => {
    const artifact = makeArtifact(makeP61Entries());
    const result = evaluate(artifact, TS);
    const json = JSON.stringify(result);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json) as SimulationInputEligibilityReviewConsumerGateResult;
    expect(parsed.gateVersion).toBe(GATE_VERSION);
  });

  it("two calls with same fixedEvaluatedAt and same artifact deep-equal", () => {
    const artifact = makeArtifact(makeP61Entries());
    const r1 = evaluate(artifact, TS);
    const r2 = evaluate(artifact, TS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("input artifact is not mutated after evaluation", () => {
    const entries = makeP61Entries();
    const artifact = makeArtifact(entries);
    const entriesLengthBefore = artifact.entries.length;
    const summaryBefore = JSON.stringify(artifact.summary);
    evaluate(artifact, TS);
    expect(artifact.entries.length).toBe(entriesLengthBefore);
    expect(JSON.stringify(artifact.summary)).toBe(summaryBefore);
  });

  it("frozen artifact (from P63 builder) is accepted without error", () => {
    const artifact = makeArtifact(makeP61Entries());
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(() => evaluate(artifact, TS)).not.toThrow();
  });

  it("output top-level keys do not include any forbidden metrics/recommendation fields", () => {
    const artifact = makeArtifact(makeP61Entries());
    const result = evaluate(artifact, TS);
    const keys = Object.keys(result);
    for (const forbidden of SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

// ─── Group 12: Forbidden field / source scans ────────────────────────────────

describe("P64 — Forbidden field and source scans", () => {
  it("result top-level keys contain no forbidden field names from P62 constant", () => {
    const artifact = makeArtifact(makeP61Entries());
    const result = evaluate(artifact, TS);
    const keys = Object.keys(result);
    for (const field of SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS) {
      expect(keys).not.toContain(field);
    }
  });

  it("source text has no Prisma import", () => {
    expect(gateSource).not.toMatch(/from\s+['"]@?prisma/i);
    expect(gateSource).not.toContain("PrismaClient");
  });

  it("source text has no DB import (mongoose, sequelize, typeorm, knex)", () => {
    expect(gateSource).not.toMatch(/from\s+['"](?:mongoose|sequelize|typeorm|knex)/i);
  });

  it("source text has no fs, path, network, or child_process import", () => {
    expect(gateSource).not.toMatch(/from\s+['"](?:fs|path|net|http|https|child_process)['"]/);
  });

  it("source text has no src/lib/research import", () => {
    expect(gateSource).not.toContain("src/lib/research");
  });

  it("source text does not export run, execute, simulate, score, optimize, backtest, or recommend", () => {
    const forbidden = [
      "export function run",
      "export function execute",
      "export function simulate",
      "export function score",
      "export function optimize",
      "export function backtest",
      "export function recommend",
    ];
    for (const fn of forbidden) {
      expect(gateSource).not.toContain(fn);
    }
  });

  it("source text does not import P53 or P54 modules", () => {
    expect(gateSource).not.toMatch(/from\s+['"].*p53/i);
    expect(gateSource).not.toMatch(/from\s+['"].*p54/i);
  });

  it("source text does not reference PnL, ROI, winRate, or benchmark as live computation", () => {
    const livePatterns = ["= PnL", "PnL =", "= ROI", "ROI =", "= winRate", "winRate =", "= benchmark", "benchmark ="];
    for (const pattern of livePatterns) {
      expect(gateSource).not.toContain(pattern);
    }
  });

  it("result does not contain recommendation or action fields", () => {
    const artifact = makeArtifact(makeP61Entries());
    const result = evaluate(artifact, TS);
    const keys = Object.keys(result);
    expect(keys).not.toContain("recommendation");
    expect(keys).not.toContain("action");
  });

  it("result does not contain score, forecast, or expectedReturn fields", () => {
    const artifact = makeArtifact(makeP61Entries());
    const result = evaluate(artifact, TS);
    const keys = Object.keys(result);
    expect(keys).not.toContain("score");
    expect(keys).not.toContain("forecast");
    expect(keys).not.toContain("expectedReturn");
  });
});

// ─── Group 13: Boundary / regression ─────────────────────────────────────────

describe("P64 — Boundary and regression", () => {
  it("runs synchronously and returns a plain object (no Promise, no async side effects)", () => {
    const artifact = makeArtifact(makeP61Entries());
    const result = evaluate(artifact, TS);
    expect(typeof result).toBe("object");
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("output has exactly the expected top-level keys — no extra metrics fields", () => {
    const artifact = makeArtifact(makeP61Entries());
    const result = evaluate(artifact, TS);
    const keys = Object.keys(result).sort();
    const expectedKeys = [
      "auditOnlySourceNames",
      "blockedSourceNames",
      "decision",
      "eligibleSourceNames",
      "evaluatedAt",
      "gateVersion",
      "governancePassed",
      "lowConfidenceSourceNames",
      "nextAllowedPhase",
      "notInvestmentAdvice",
      "noMetricsProduced",
      "noSimulationExecuted",
      "warnings",
    ].sort();
    expect(keys).toEqual(expectedKeys);
  });

  it("source name array counts sum to artifact.entries.length", () => {
    const artifact = makeArtifact(makeP61Entries());
    const result = evaluate(artifact, TS);
    const totalClassified =
      result.eligibleSourceNames.length +
      result.lowConfidenceSourceNames.length +
      result.blockedSourceNames.length +
      result.auditOnlySourceNames.length;
    expect(totalClassified).toBe(artifact.entries.length);
  });

  it("function signature accepts (artifact, fixedEvaluatedAt) positional params", () => {
    const artifact = makeArtifact([makeQuoteEntry()]);
    const result1 = evaluate(artifact, TS);
    const result2 = evaluate(artifact);
    expect(result1.gateVersion).toBe(GATE_VERSION);
    expect(result2.gateVersion).toBe(GATE_VERSION);
  });

  it("compatible with P63 builder output for P61 six-source matrix", () => {
    const entries = makeP61Entries();
    const artifact = buildSimulationInputEligibilityReviewArtifact({
      entries,
      fixedGeneratedAt: TS,
    });
    const result = evaluate(artifact, TS);
    // Confirm end-to-end: P63 builder → P64 gate → APPROVE
    expect(result.decision).toBe("APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW");
    expect(result.nextAllowedPhase).toBe("P65_SIMULATION_INPUT_BUNDLE_PREVIEW");
    expect(result.eligibleSourceNames).toEqual(["Quote", "Regime"]);
    expect(result.lowConfidenceSourceNames).toEqual(["MonthlyRevenue"]);
    expect(result.blockedSourceNames).toEqual(["FinancialReport", "Chip"]);
    expect(result.auditOnlySourceNames).toEqual(["NewsEvent"]);
  });
});
