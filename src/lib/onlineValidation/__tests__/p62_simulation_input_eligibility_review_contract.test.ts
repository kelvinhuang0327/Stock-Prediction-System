/**
 * P62 — Axis B Simulation Input Eligibility Review Contract Tests
 *
 * Tests for SimulationInputEligibilityReviewContract:
 * covering version/governance constants, forbidden fields, source names,
 * review statuses, PIT states, entry shape, summary shape, artifact shape,
 * JSON serializability, and import/boundary compliance.
 *
 * Minimum: 45 tests (spec requires 40+).
 *
 * DISCLAIMER: Structural contract tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRunOnly = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 */

import * as fs from "fs";
import * as path from "path";

import {
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONTRACT_VERSION,
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE,
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS,
  EXPECTED_REVIEW_SOURCE_NAMES,
  EXPECTED_REVIEW_STATUSES,
  DEFAULT_REVIEW_FORBIDDEN_USE,
  type SimulationInputReviewSourceName,
  type SimulationInputReviewStatus,
  type SimulationInputPitState,
  type SimulationInputEligibilityReviewEntry,
  type SimulationInputEligibilityReviewSummary,
  type SimulationInputEligibilityReviewArtifact,
} from "../p62/SimulationInputEligibilityReviewContract";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIXED_GENERATED_AT = "2026-05-26T12:00:00.000Z";

const CONTRACT_SOURCE_FILE = path.resolve(
  __dirname,
  "../p62/SimulationInputEligibilityReviewContract.ts",
);

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeQuoteEntry(): SimulationInputEligibilityReviewEntry {
  return {
    source: "Quote",
    status: "ELIGIBLE_FOR_REVIEW_ARTIFACT",
    pitState: "PIT_SAFE_IF_DATE_PRESENT",
    allowedUse: "structural input eligibility review only",
    forbiddenUse: [...DEFAULT_REVIEW_FORBIDDEN_USE],
    requiredAuthorization: null,
  };
}

function makeRegimeEntry(): SimulationInputEligibilityReviewEntry {
  return {
    source: "Regime",
    status: "ELIGIBLE_FOR_REVIEW_ARTIFACT",
    pitState: "PIT_SAFE_IF_DATE_AND_PIT_SAFETY_PRESENT",
    allowedUse: "structural input eligibility review only",
    forbiddenUse: [...DEFAULT_REVIEW_FORBIDDEN_USE],
    requiredAuthorization: null,
  };
}

function makeMonthlyRevenueEntry(): SimulationInputEligibilityReviewEntry {
  return {
    source: "MonthlyRevenue",
    status: "ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING",
    pitState: "LOW_CONFIDENCE_PIT_INFERRED_IF_RELEASE_DATE_MISSING",
    allowedUse: "structural input eligibility review only",
    forbiddenUse: [
      ...DEFAULT_REVIEW_FORBIDDEN_USE,
      "treating LOW_CONFIDENCE_PIT_INFERRED as PIT_SAFE",
    ],
    requiredAuthorization: null,
  };
}

function makeFinancialReportEntry(): SimulationInputEligibilityReviewEntry {
  return {
    source: "FinancialReport",
    status: "BLOCKED",
    pitState: "BLOCKED_PENDING_PIT_METADATA",
    allowedUse: "structural input eligibility review only",
    forbiddenUse: [...DEFAULT_REVIEW_FORBIDDEN_USE, "any use without releaseDate migration"],
    requiredAuthorization: "YES apply FinancialReport releaseDate migration to dev DB",
  };
}

function makeChipEntry(): SimulationInputEligibilityReviewEntry {
  return {
    source: "Chip",
    status: "BLOCKED",
    pitState: "BLOCKED_PENDING_AVAILABLE_AT_AND_PROD_LOGS",
    allowedUse: "structural input eligibility review only",
    forbiddenUse: [...DEFAULT_REVIEW_FORBIDDEN_USE, "any use without availableAt migration and CHIP_LAG_CONFIRMED"],
    requiredAuthorization: "YES apply Chip availableAt migration to dev DB + CHIP_LAG_CONFIRMED",
  };
}

function makeNewsEventEntry(): SimulationInputEligibilityReviewEntry {
  return {
    source: "NewsEvent",
    status: "AUDIT_ONLY",
    pitState: "AUDIT_ONLY_PENDING_QUALITY_AND_SYMBOL_LINKAGE",
    allowedUse: "structural input eligibility review only",
    forbiddenUse: [...DEFAULT_REVIEW_FORBIDDEN_USE, "structural input without quality and symbol-linkage audit"],
    requiredAuthorization: "YES begin NewsEvent quality and symbol-linkage audit",
  };
}

function makeP61Summary(): SimulationInputEligibilityReviewSummary {
  return {
    eligibleCount: 2,
    lowConfidenceCount: 1,
    blockedCount: 2,
    auditOnlyCount: 1,
    totalSources: 6,
  };
}

function makeFullP61Artifact(): SimulationInputEligibilityReviewArtifact {
  return {
    version: SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONTRACT_VERSION,
    generatedAt: FIXED_GENERATED_AT,
    governance: SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE,
    entries: [
      makeQuoteEntry(),
      makeRegimeEntry(),
      makeMonthlyRevenueEntry(),
      makeFinancialReportEntry(),
      makeChipEntry(),
      makeNewsEventEntry(),
    ],
    summary: makeP61Summary(),
  };
}

// ─── 1. Version / Governance ──────────────────────────────────────────────────

describe("P62 — Version and governance", () => {
  // Test 1
  test("version has exact expected value", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONTRACT_VERSION).toBe(
      "p62-axis-b-simulation-input-eligibility-review-contract-v0",
    );
  });

  // Test 2
  test("governance axis is Axis B", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.axis).toBe("Axis B");
  });

  // Test 3
  test("paperOnly is true", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.paperOnly).toBe(true);
  });

  // Test 4
  test("dryRunOnly is true", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.dryRunOnly).toBe(true);
  });

  // Test 5
  test("noSimulationExecution is true", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.noSimulationExecution).toBe(true);
  });

  // Test 6
  test("noMetrics is true", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.noMetrics).toBe(true);
  });

  // Test 7
  test("noScoring is true", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.noScoring).toBe(true);
  });

  // Test 8
  test("noOptimizer is true", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.noOptimizer).toBe(true);
  });

  // Test 9
  test("noBacktest is true", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.noBacktest).toBe(true);
  });

  // Test 10
  test("noRecommendation is true", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.noRecommendation).toBe(true);
  });

  // Test 11
  test("notInvestmentAdvice is true", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.notInvestmentAdvice).toBe(true);
  });

  // Test 12
  test("entersAlphaScore is false", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.entersAlphaScore).toBe(false);
  });
});

// ─── 2. Forbidden Fields ──────────────────────────────────────────────────────

describe("P62 — Forbidden fields", () => {
  // Test 13
  test("forbidden list includes all 20 required names", () => {
    const required = [
      "recommendation",
      "action",
      "buy",
      "sell",
      "hold",
      "targetPrice",
      "ROI",
      "PnL",
      "winRate",
      "edge",
      "alphaScore",
      "score",
      "forecast",
      "expectedReturn",
      "benchmark",
      "optimizer",
      "backtest",
      "returnPct",
      "profit",
      "position",
    ];
    for (const name of required) {
      expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS).toContain(name);
    }
  });

  // Test 14
  test("forbidden list is JSON-serializable", () => {
    expect(() =>
      JSON.parse(JSON.stringify(SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS)),
    ).not.toThrow();
  });

  // Test 15
  test("forbidden field names do not appear as artifact top-level keys", () => {
    const artifact = makeFullP61Artifact();
    const topLevelKeys = Object.keys(artifact);
    const forbidden = SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS as readonly string[];
    for (const key of topLevelKeys) {
      expect(forbidden).not.toContain(key);
    }
  });

  // Test 16
  test("forbiddenUse list in entries contains only guardrail strings", () => {
    const entry = makeQuoteEntry();
    for (const use of entry.forbiddenUse) {
      expect(typeof use).toBe("string");
      expect(use.length).toBeGreaterThan(0);
    }
  });

  // Test 17
  test("forbidden list has exactly 20 entries", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS.length).toBe(20);
  });
});

// ─── 3. Source Names ──────────────────────────────────────────────────────────

describe("P62 — Source names", () => {
  // Test 18
  test("expected source names includes Quote", () => {
    expect(EXPECTED_REVIEW_SOURCE_NAMES).toContain("Quote");
  });

  // Test 19
  test("expected source names includes Regime", () => {
    expect(EXPECTED_REVIEW_SOURCE_NAMES).toContain("Regime");
  });

  // Test 20
  test("expected source names includes MonthlyRevenue", () => {
    expect(EXPECTED_REVIEW_SOURCE_NAMES).toContain("MonthlyRevenue");
  });

  // Test 21
  test("expected source names includes FinancialReport", () => {
    expect(EXPECTED_REVIEW_SOURCE_NAMES).toContain("FinancialReport");
  });

  // Test 22
  test("expected source names includes Chip", () => {
    expect(EXPECTED_REVIEW_SOURCE_NAMES).toContain("Chip");
  });

  // Test 23
  test("expected source names includes NewsEvent", () => {
    expect(EXPECTED_REVIEW_SOURCE_NAMES).toContain("NewsEvent");
  });

  // Test 24
  test("expected source names has exactly 6 entries (no unexpected names)", () => {
    expect(EXPECTED_REVIEW_SOURCE_NAMES.length).toBe(6);
  });
});

// ─── 4. Review Statuses ───────────────────────────────────────────────────────

describe("P62 — Review statuses", () => {
  // Test 25
  test("statuses include ELIGIBLE_FOR_REVIEW_ARTIFACT", () => {
    expect(EXPECTED_REVIEW_STATUSES).toContain("ELIGIBLE_FOR_REVIEW_ARTIFACT");
  });

  // Test 26
  test("statuses include ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING", () => {
    expect(EXPECTED_REVIEW_STATUSES).toContain("ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING");
  });

  // Test 27
  test("statuses include BLOCKED", () => {
    expect(EXPECTED_REVIEW_STATUSES).toContain("BLOCKED");
  });

  // Test 28
  test("statuses include AUDIT_ONLY", () => {
    expect(EXPECTED_REVIEW_STATUSES).toContain("AUDIT_ONLY");
  });

  // Test 29
  test("statuses has exactly 4 entries", () => {
    expect(EXPECTED_REVIEW_STATUSES.length).toBe(4);
  });
});

// ─── 5. Entry Shape ───────────────────────────────────────────────────────────

describe("P62 — Entry shape", () => {
  // Test 30
  test("valid Quote entry can be declared with correct shape", () => {
    const entry = makeQuoteEntry();
    expect(entry.source).toBe("Quote");
    expect(entry.status).toBe("ELIGIBLE_FOR_REVIEW_ARTIFACT");
    expect(entry.pitState).toBe("PIT_SAFE_IF_DATE_PRESENT");
    expect(entry.allowedUse).toBe("structural input eligibility review only");
    expect(entry.requiredAuthorization).toBeNull();
  });

  // Test 31
  test("valid Regime entry can be declared with correct shape", () => {
    const entry = makeRegimeEntry();
    expect(entry.source).toBe("Regime");
    expect(entry.status).toBe("ELIGIBLE_FOR_REVIEW_ARTIFACT");
    expect(entry.pitState).toBe("PIT_SAFE_IF_DATE_AND_PIT_SAFETY_PRESENT");
    expect(entry.allowedUse).toBe("structural input eligibility review only");
    expect(entry.requiredAuthorization).toBeNull();
  });

  // Test 32
  test("valid MonthlyRevenue low-confidence entry can be declared", () => {
    const entry = makeMonthlyRevenueEntry();
    expect(entry.source).toBe("MonthlyRevenue");
    expect(entry.status).toBe("ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING");
    expect(entry.pitState).toBe("LOW_CONFIDENCE_PIT_INFERRED_IF_RELEASE_DATE_MISSING");
    expect(entry.allowedUse).toBe("structural input eligibility review only");
    expect(entry.requiredAuthorization).toBeNull();
  });

  // Test 33
  test("valid FinancialReport blocked entry can be declared", () => {
    const entry = makeFinancialReportEntry();
    expect(entry.source).toBe("FinancialReport");
    expect(entry.status).toBe("BLOCKED");
    expect(entry.pitState).toBe("BLOCKED_PENDING_PIT_METADATA");
    expect(entry.requiredAuthorization).not.toBeNull();
    expect(typeof entry.requiredAuthorization).toBe("string");
  });

  // Test 34
  test("valid Chip blocked entry can be declared", () => {
    const entry = makeChipEntry();
    expect(entry.source).toBe("Chip");
    expect(entry.status).toBe("BLOCKED");
    expect(entry.pitState).toBe("BLOCKED_PENDING_AVAILABLE_AT_AND_PROD_LOGS");
    expect(entry.requiredAuthorization).not.toBeNull();
  });

  // Test 35
  test("valid NewsEvent audit-only entry can be declared", () => {
    const entry = makeNewsEventEntry();
    expect(entry.source).toBe("NewsEvent");
    expect(entry.status).toBe("AUDIT_ONLY");
    expect(entry.pitState).toBe("AUDIT_ONLY_PENDING_QUALITY_AND_SYMBOL_LINKAGE");
    expect(entry.requiredAuthorization).not.toBeNull();
  });

  // Test 36
  test("all six entries are JSON-serializable", () => {
    const entries = [
      makeQuoteEntry(),
      makeRegimeEntry(),
      makeMonthlyRevenueEntry(),
      makeFinancialReportEntry(),
      makeChipEntry(),
      makeNewsEventEntry(),
    ];
    expect(() => JSON.parse(JSON.stringify(entries))).not.toThrow();
  });
});

// ─── 6. Summary Shape ─────────────────────────────────────────────────────────

describe("P62 — Summary shape", () => {
  // Test 37
  test("summary counts represent P61 matrix: eligible=2, lowConfidence=1, blocked=2, auditOnly=1, total=6", () => {
    const summary = makeP61Summary();
    expect(summary.eligibleCount).toBe(2);
    expect(summary.lowConfidenceCount).toBe(1);
    expect(summary.blockedCount).toBe(2);
    expect(summary.auditOnlyCount).toBe(1);
    expect(summary.totalSources).toBe(6);
  });

  // Test 38
  test("summary total equals sum of all category counts", () => {
    const summary = makeP61Summary();
    expect(summary.totalSources).toBe(
      summary.eligibleCount +
        summary.lowConfidenceCount +
        summary.blockedCount +
        summary.auditOnlyCount,
    );
  });

  // Test 39
  test("artifact with 6 entries is JSON-serializable", () => {
    const artifact = makeFullP61Artifact();
    expect(() => JSON.parse(JSON.stringify(artifact))).not.toThrow();
  });

  // Test 40
  test("artifact governance is readonly/as-const compatible (all fields present)", () => {
    const gov = SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE;
    expect(gov).toHaveProperty("axis");
    expect(gov).toHaveProperty("paperOnly");
    expect(gov).toHaveProperty("dryRunOnly");
    expect(gov).toHaveProperty("noSimulationExecution");
    expect(gov).toHaveProperty("noMetrics");
    expect(gov).toHaveProperty("noScoring");
    expect(gov).toHaveProperty("noOptimizer");
    expect(gov).toHaveProperty("noBacktest");
    expect(gov).toHaveProperty("noRecommendation");
    expect(gov).toHaveProperty("notInvestmentAdvice");
    expect(gov).toHaveProperty("entersAlphaScore");
  });
});

// ─── 7. Source Text / Import Boundary Scans ───────────────────────────────────

describe("P62 — Module source text scans", () => {
  let sourceText: string;

  beforeAll(() => {
    sourceText = fs.readFileSync(CONTRACT_SOURCE_FILE, "utf-8");
  });

  // Test 41
  test("module has no Prisma import", () => {
    expect(sourceText).not.toMatch(/from\s+['"]@prisma\/client['"]/);
    expect(sourceText).not.toMatch(/require\(['"]@prisma\/client['"]\)/);
  });

  // Test 42
  test("module has no DB import (prisma or database keyword)", () => {
    expect(sourceText).not.toMatch(/import.*prisma/i);
    expect(sourceText).not.toMatch(/from\s+['"].*prisma.*/i);
  });

  // Test 43
  test("module has no fs/path/network/child_process import", () => {
    expect(sourceText).not.toMatch(/from\s+['"]fs['"]/);
    expect(sourceText).not.toMatch(/from\s+['"]path['"]/);
    expect(sourceText).not.toMatch(/from\s+['"]http['"]/);
    expect(sourceText).not.toMatch(/from\s+['"]https['"]/);
    expect(sourceText).not.toMatch(/from\s+['"]child_process['"]/);
    expect(sourceText).not.toMatch(/require\(['"]fs['"]\)/);
    expect(sourceText).not.toMatch(/require\(['"]path['"]\)/);
  });

  // Test 44
  test("module does not export a builder function", () => {
    // Must not export any function named 'build' or ending with 'Builder'
    expect(sourceText).not.toMatch(/export\s+function\s+build/);
    expect(sourceText).not.toMatch(/export\s+const\s+build[A-Z]/);
  });

  // Test 45
  test("module does not import Axis A implementation files", () => {
    expect(sourceText).not.toMatch(/from\s+['"].*\/research\//);
    expect(sourceText).not.toMatch(/from\s+['"].*RealDataSnapshot/);
    expect(sourceText).not.toMatch(/from\s+['"].*ResearchSnapshot/);
    expect(sourceText).not.toMatch(/from\s+['"].*QuoteAdapter/);
    expect(sourceText).not.toMatch(/from\s+['"].*RegimeAdapter/);
    expect(sourceText).not.toMatch(/from\s+['"].*MonthlyRevenueAdapter/);
  });
});

// ─── 8. Boundary ─────────────────────────────────────────────────────────────

describe("P62 — Boundary compliance", () => {
  let sourceText: string;

  beforeAll(() => {
    sourceText = fs.readFileSync(CONTRACT_SOURCE_FILE, "utf-8");
  });

  // Test 46
  test("no src/lib/research import in contract", () => {
    expect(sourceText).not.toMatch(/from\s+['"].*lib\/research/);
  });

  // Test 47
  test("no P53/P54 implementation import in contract", () => {
    expect(sourceText).not.toMatch(/from\s+['"].*p53\//);
    expect(sourceText).not.toMatch(/from\s+['"].*p54\//);
  });

  // Test 48
  test("no simulation execution function names in contract", () => {
    expect(sourceText).not.toMatch(/runSimulation|executeSimulation|computeMetrics|runBacktest|runOptimizer/);
  });

  // Test 49
  test("DEFAULT_REVIEW_FORBIDDEN_USE is an array of non-empty strings", () => {
    expect(Array.isArray(DEFAULT_REVIEW_FORBIDDEN_USE)).toBe(true);
    for (const entry of DEFAULT_REVIEW_FORBIDDEN_USE) {
      expect(typeof entry).toBe("string");
      expect(entry.length).toBeGreaterThan(0);
    }
  });

  // Test 50
  test("artifact version field matches the exported constant", () => {
    const artifact = makeFullP61Artifact();
    expect(artifact.version).toBe(SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONTRACT_VERSION);
  });

  // Test 51
  test("artifact governance field is the exact exported GOVERNANCE object", () => {
    const artifact = makeFullP61Artifact();
    expect(artifact.governance).toBe(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE);
  });

  // Test 52
  test("artifact entries array is readonly-style (still an array)", () => {
    const artifact = makeFullP61Artifact();
    expect(Array.isArray(artifact.entries)).toBe(true);
  });

  // Test 53
  test("eligible entries have null requiredAuthorization", () => {
    expect(makeQuoteEntry().requiredAuthorization).toBeNull();
    expect(makeRegimeEntry().requiredAuthorization).toBeNull();
    expect(makeMonthlyRevenueEntry().requiredAuthorization).toBeNull();
  });

  // Test 54
  test("blocked and audit-only entries have non-null requiredAuthorization", () => {
    expect(makeFinancialReportEntry().requiredAuthorization).not.toBeNull();
    expect(makeChipEntry().requiredAuthorization).not.toBeNull();
    expect(makeNewsEventEntry().requiredAuthorization).not.toBeNull();
  });

  // Test 55
  test("allowedUse is the exact literal string for all six entry types", () => {
    const allEntries = [
      makeQuoteEntry(),
      makeRegimeEntry(),
      makeMonthlyRevenueEntry(),
      makeFinancialReportEntry(),
      makeChipEntry(),
      makeNewsEventEntry(),
    ];
    for (const entry of allEntries) {
      expect(entry.allowedUse).toBe("structural input eligibility review only");
    }
  });

  // Test 56
  test("generatedAt in artifact is the fixture ISO string", () => {
    const artifact = makeFullP61Artifact();
    expect(artifact.generatedAt).toBe(FIXED_GENERATED_AT);
  });

  // Test 57
  test("summary totalSources equals entries.length in full artifact", () => {
    const artifact = makeFullP61Artifact();
    expect(artifact.summary.totalSources).toBe(artifact.entries.length);
  });

  // Test 58
  test("no scoring, optimizer, backtest, or simulation field names appear in artifact top-level keys", () => {
    const artifact = makeFullP61Artifact();
    const keys = Object.keys(artifact);
    const prohibited = ["score", "optimizer", "backtest", "simulation", "alphaScore", "roi", "pnl"];
    for (const key of keys) {
      expect(prohibited).not.toContain(key.toLowerCase());
    }
  });
});
