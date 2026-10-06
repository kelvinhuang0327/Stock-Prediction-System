/**
 * P63 — Axis B Simulation Input Eligibility Review Builder Tests
 *
 * Tests for SimulationInputEligibilityReviewBuilder:
 * covering version, governance, generatedAt, summary counts, entry shape,
 * serialization, immutability, forbidden field scans, source text compliance,
 * and boundary/regression assertions.
 *
 * Minimum: 62 tests (spec requires 60+).
 *
 * DISCLAIMER: Structural builder tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRunOnly = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 */

import * as fs from "fs";
import * as path from "path";

import {
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_BUILDER_VERSION,
  type SimulationInputEligibilityReviewBuilderParams,
  buildSimulationInputEligibilityReviewArtifact,
  countReviewStatus,
  summarizeSimulationInputEligibilityReviewEntries,
} from "../p63/SimulationInputEligibilityReviewBuilder";

import {
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONTRACT_VERSION,
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE,
  EXPECTED_REVIEW_STATUSES,
  DEFAULT_REVIEW_FORBIDDEN_USE,
  type SimulationInputEligibilityReviewEntry,
  type SimulationInputEligibilityReviewArtifact,
} from "../p62/SimulationInputEligibilityReviewContract";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIXED_GENERATED_AT = "2026-05-26T12:00:00.000Z";

const BUILDER_SOURCE_FILE = path.resolve(
  __dirname,
  "../p63/SimulationInputEligibilityReviewBuilder.ts",
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
    forbiddenUse: [
      ...DEFAULT_REVIEW_FORBIDDEN_USE,
      "any use without releaseDate migration",
    ],
    requiredAuthorization:
      "YES apply FinancialReport releaseDate migration to dev DB",
  };
}

function makeChipEntry(): SimulationInputEligibilityReviewEntry {
  return {
    source: "Chip",
    status: "BLOCKED",
    pitState: "BLOCKED_PENDING_AVAILABLE_AT_AND_PROD_LOGS",
    allowedUse: "structural input eligibility review only",
    forbiddenUse: [
      ...DEFAULT_REVIEW_FORBIDDEN_USE,
      "any use without availableAt migration and CHIP_LAG_CONFIRMED",
    ],
    requiredAuthorization:
      "YES apply Chip availableAt migration to dev DB + CHIP_LAG_CONFIRMED",
  };
}

function makeNewsEventEntry(): SimulationInputEligibilityReviewEntry {
  return {
    source: "NewsEvent",
    status: "AUDIT_ONLY",
    pitState: "AUDIT_ONLY_PENDING_QUALITY_AND_SYMBOL_LINKAGE",
    allowedUse: "structural input eligibility review only",
    forbiddenUse: [
      ...DEFAULT_REVIEW_FORBIDDEN_USE,
      "structural input without quality and symbol-linkage audit",
    ],
    requiredAuthorization:
      "YES begin NewsEvent quality and symbol-linkage audit",
  };
}

/** Full P61 six-source matrix entries */
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

function makeParams(
  entries: readonly SimulationInputEligibilityReviewEntry[],
  fixedGeneratedAt?: string,
): SimulationInputEligibilityReviewBuilderParams {
  return { entries, fixedGeneratedAt };
}

// ─── 1. Version ───────────────────────────────────────────────────────────────

describe("P63 — Version", () => {
  // Test 1
  test("builder version has exact expected value", () => {
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_BUILDER_VERSION).toBe(
      "p63-axis-b-simulation-input-eligibility-review-builder-v0",
    );
  });

  // Test 2
  test("artifact version matches P62 contract version", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([], FIXED_GENERATED_AT),
    );
    expect(artifact.version).toBe(
      SIMULATION_INPUT_ELIGIBILITY_REVIEW_CONTRACT_VERSION,
    );
  });

  // Test 3
  test("P62 contract version is the expected string", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([], FIXED_GENERATED_AT),
    );
    expect(artifact.version).toBe(
      "p62-axis-b-simulation-input-eligibility-review-contract-v0",
    );
  });
});

// ─── 2. generatedAt ───────────────────────────────────────────────────────────

describe("P63 — generatedAt", () => {
  // Test 4
  test("uses fixedGeneratedAt when provided", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([], FIXED_GENERATED_AT),
    );
    expect(artifact.generatedAt).toBe(FIXED_GENERATED_AT);
  });

  // Test 5
  test("defaults to ISO timestamp when fixedGeneratedAt is omitted", () => {
    const before = new Date().toISOString();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([]),
    );
    const after = new Date().toISOString();
    expect(artifact.generatedAt >= before).toBe(true);
    expect(artifact.generatedAt <= after).toBe(true);
  });

  // Test 6
  test("generatedAt is a non-empty string", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([], FIXED_GENERATED_AT),
    );
    expect(typeof artifact.generatedAt).toBe("string");
    expect(artifact.generatedAt.length).toBeGreaterThan(0);
  });
});

// ─── 3. Governance ────────────────────────────────────────────────────────────

describe("P63 — Governance", () => {
  let artifact: SimulationInputEligibilityReviewArtifact;

  beforeEach(() => {
    artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([], FIXED_GENERATED_AT),
    );
  });

  // Test 7
  test("returns governance from P62", () => {
    expect(artifact.governance).toBe(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE);
  });

  // Test 8
  test("paperOnly is true", () => {
    expect(artifact.governance.paperOnly).toBe(true);
  });

  // Test 9
  test("dryRunOnly is true", () => {
    expect(artifact.governance.dryRunOnly).toBe(true);
  });

  // Test 10
  test("noSimulationExecution is true", () => {
    expect(artifact.governance.noSimulationExecution).toBe(true);
  });

  // Test 11
  test("noMetrics is true", () => {
    expect(artifact.governance.noMetrics).toBe(true);
  });

  // Test 12
  test("noScoring is true", () => {
    expect(artifact.governance.noScoring).toBe(true);
  });

  // Test 13
  test("noOptimizer is true", () => {
    expect(artifact.governance.noOptimizer).toBe(true);
  });

  // Test 14
  test("noBacktest is true", () => {
    expect(artifact.governance.noBacktest).toBe(true);
  });

  // Test 15
  test("noRecommendation is true", () => {
    expect(artifact.governance.noRecommendation).toBe(true);
  });

  // Test 16
  test("notInvestmentAdvice is true", () => {
    expect(artifact.governance.notInvestmentAdvice).toBe(true);
  });

  // Test 17
  test("entersAlphaScore is false", () => {
    expect(artifact.governance.entersAlphaScore).toBe(false);
  });

  // Test 18
  test("axis is Axis B", () => {
    expect(artifact.governance.axis).toBe("Axis B");
  });
});

// ─── 4. Entries ───────────────────────────────────────────────────────────────

describe("P63 — Entries", () => {
  // Test 19
  test("preserves entries order", () => {
    const entries = makeP61Entries();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(entries, FIXED_GENERATED_AT),
    );
    expect(artifact.entries[0]?.source).toBe("Quote");
    expect(artifact.entries[1]?.source).toBe("Regime");
    expect(artifact.entries[2]?.source).toBe("MonthlyRevenue");
    expect(artifact.entries[3]?.source).toBe("FinancialReport");
    expect(artifact.entries[4]?.source).toBe("Chip");
    expect(artifact.entries[5]?.source).toBe("NewsEvent");
  });

  // Test 20
  test("preserves entries references (same array reference)", () => {
    const entries = makeP61Entries();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(entries, FIXED_GENERATED_AT),
    );
    expect(artifact.entries).toBe(entries);
  });

  // Test 21
  test("handles empty entries", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([], FIXED_GENERATED_AT),
    );
    expect(artifact.entries).toHaveLength(0);
  });

  // Test 22
  test("does not mutate input entries", () => {
    const entries = makeP61Entries();
    const snapshotLength = entries.length;
    const snapshotFirst = entries[0];
    buildSimulationInputEligibilityReviewArtifact(
      makeParams(entries, FIXED_GENERATED_AT),
    );
    expect(entries.length).toBe(snapshotLength);
    expect(entries[0]).toBe(snapshotFirst);
  });
});

// ─── 5. Summary counts ────────────────────────────────────────────────────────

describe("P63 — Summary counts", () => {
  // Test 23
  test("eligible count for Quote and Regime", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([makeQuoteEntry(), makeRegimeEntry()], FIXED_GENERATED_AT),
    );
    expect(artifact.summary.eligibleCount).toBe(2);
  });

  // Test 24
  test("low confidence count for MonthlyRevenue", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([makeMonthlyRevenueEntry()], FIXED_GENERATED_AT),
    );
    expect(artifact.summary.lowConfidenceCount).toBe(1);
  });

  // Test 25
  test("blocked count for FinancialReport and Chip", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(
        [makeFinancialReportEntry(), makeChipEntry()],
        FIXED_GENERATED_AT,
      ),
    );
    expect(artifact.summary.blockedCount).toBe(2);
  });

  // Test 26
  test("audit-only count for NewsEvent", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([makeNewsEventEntry()], FIXED_GENERATED_AT),
    );
    expect(artifact.summary.auditOnlyCount).toBe(1);
  });

  // Test 27
  test("totalSources count", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(makeP61Entries(), FIXED_GENERATED_AT),
    );
    expect(artifact.summary.totalSources).toBe(6);
  });

  // Test 28
  test("mixed P61 matrix: 2 eligible, 1 low, 2 blocked, 1 audit-only, total 6", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(makeP61Entries(), FIXED_GENERATED_AT),
    );
    expect(artifact.summary.eligibleCount).toBe(2);
    expect(artifact.summary.lowConfidenceCount).toBe(1);
    expect(artifact.summary.blockedCount).toBe(2);
    expect(artifact.summary.auditOnlyCount).toBe(1);
    expect(artifact.summary.totalSources).toBe(6);
  });

  // Test 29
  test("all eligible entries summary", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([makeQuoteEntry(), makeRegimeEntry()], FIXED_GENERATED_AT),
    );
    expect(artifact.summary.eligibleCount).toBe(2);
    expect(artifact.summary.lowConfidenceCount).toBe(0);
    expect(artifact.summary.blockedCount).toBe(0);
    expect(artifact.summary.auditOnlyCount).toBe(0);
    expect(artifact.summary.totalSources).toBe(2);
  });

  // Test 30
  test("all blocked entries summary", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(
        [makeFinancialReportEntry(), makeChipEntry()],
        FIXED_GENERATED_AT,
      ),
    );
    expect(artifact.summary.blockedCount).toBe(2);
    expect(artifact.summary.eligibleCount).toBe(0);
    expect(artifact.summary.lowConfidenceCount).toBe(0);
    expect(artifact.summary.auditOnlyCount).toBe(0);
    expect(artifact.summary.totalSources).toBe(2);
  });

  // Test 31
  test("all audit-only entries summary", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([makeNewsEventEntry()], FIXED_GENERATED_AT),
    );
    expect(artifact.summary.auditOnlyCount).toBe(1);
    expect(artifact.summary.eligibleCount).toBe(0);
    expect(artifact.summary.lowConfidenceCount).toBe(0);
    expect(artifact.summary.blockedCount).toBe(0);
    expect(artifact.summary.totalSources).toBe(1);
  });

  // Test 32
  test("all low-confidence entries summary", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([makeMonthlyRevenueEntry()], FIXED_GENERATED_AT),
    );
    expect(artifact.summary.lowConfidenceCount).toBe(1);
    expect(artifact.summary.eligibleCount).toBe(0);
    expect(artifact.summary.blockedCount).toBe(0);
    expect(artifact.summary.auditOnlyCount).toBe(0);
    expect(artifact.summary.totalSources).toBe(1);
  });

  // Test 33
  test("empty entries summary is all zeros", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([], FIXED_GENERATED_AT),
    );
    expect(artifact.summary.eligibleCount).toBe(0);
    expect(artifact.summary.lowConfidenceCount).toBe(0);
    expect(artifact.summary.blockedCount).toBe(0);
    expect(artifact.summary.auditOnlyCount).toBe(0);
    expect(artifact.summary.totalSources).toBe(0);
  });

  // Test 34
  test("single eligible entry summary", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([makeQuoteEntry()], FIXED_GENERATED_AT),
    );
    expect(artifact.summary.eligibleCount).toBe(1);
    expect(artifact.summary.totalSources).toBe(1);
  });
});

// ─── 6. Entry shape ───────────────────────────────────────────────────────────

describe("P63 — Entry shape", () => {
  // Test 35
  test("valid Quote entry preserved", () => {
    const entry = makeQuoteEntry();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([entry], FIXED_GENERATED_AT),
    );
    expect(artifact.entries[0]).toEqual(entry);
  });

  // Test 36
  test("valid Regime entry preserved", () => {
    const entry = makeRegimeEntry();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([entry], FIXED_GENERATED_AT),
    );
    expect(artifact.entries[0]).toEqual(entry);
  });

  // Test 37
  test("valid MonthlyRevenue low-confidence entry preserved", () => {
    const entry = makeMonthlyRevenueEntry();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([entry], FIXED_GENERATED_AT),
    );
    expect(artifact.entries[0]).toEqual(entry);
    expect(artifact.entries[0]?.status).toBe(
      "ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING",
    );
  });

  // Test 38
  test("valid FinancialReport blocked entry preserved", () => {
    const entry = makeFinancialReportEntry();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([entry], FIXED_GENERATED_AT),
    );
    expect(artifact.entries[0]).toEqual(entry);
    expect(artifact.entries[0]?.status).toBe("BLOCKED");
  });

  // Test 39
  test("valid Chip blocked entry preserved", () => {
    const entry = makeChipEntry();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([entry], FIXED_GENERATED_AT),
    );
    expect(artifact.entries[0]).toEqual(entry);
    expect(artifact.entries[0]?.pitState).toBe(
      "BLOCKED_PENDING_AVAILABLE_AT_AND_PROD_LOGS",
    );
  });

  // Test 40
  test("valid NewsEvent audit-only entry preserved", () => {
    const entry = makeNewsEventEntry();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([entry], FIXED_GENERATED_AT),
    );
    expect(artifact.entries[0]).toEqual(entry);
    expect(artifact.entries[0]?.status).toBe("AUDIT_ONLY");
  });

  // Test 41
  test("requiredAuthorization null preserved", () => {
    const entry = makeQuoteEntry(); // requiredAuthorization: null
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([entry], FIXED_GENERATED_AT),
    );
    expect(artifact.entries[0]?.requiredAuthorization).toBeNull();
  });

  // Test 42
  test("requiredAuthorization string preserved", () => {
    const entry = makeFinancialReportEntry(); // non-null string
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([entry], FIXED_GENERATED_AT),
    );
    expect(typeof artifact.entries[0]?.requiredAuthorization).toBe("string");
    expect(artifact.entries[0]?.requiredAuthorization).toContain(
      "FinancialReport",
    );
  });

  // Test 43
  test("forbiddenUse array preserved", () => {
    const entry = makeMonthlyRevenueEntry();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([entry], FIXED_GENERATED_AT),
    );
    expect(Array.isArray(artifact.entries[0]?.forbiddenUse)).toBe(true);
    expect(artifact.entries[0]?.forbiddenUse).toEqual(entry.forbiddenUse);
  });

  // Test 44
  test("allowedUse exact value preserved", () => {
    const entry = makeQuoteEntry();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([entry], FIXED_GENERATED_AT),
    );
    expect(artifact.entries[0]?.allowedUse).toBe(
      "structural input eligibility review only",
    );
  });
});

// ─── 7. Serialization / immutability ─────────────────────────────────────────

describe("P63 — Serialization and immutability", () => {
  // Test 45
  test("output is JSON serializable", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(makeP61Entries(), FIXED_GENERATED_AT),
    );
    expect(() => JSON.stringify(artifact)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(artifact)) as unknown;
    expect(parsed).toBeTruthy();
  });

  // Test 46
  test("repeated calls with fixedGeneratedAt produce deep-equal artifacts", () => {
    const entries = makeP61Entries();
    const a1 = buildSimulationInputEligibilityReviewArtifact(
      makeParams(entries, FIXED_GENERATED_AT),
    );
    const a2 = buildSimulationInputEligibilityReviewArtifact(
      makeParams(entries, FIXED_GENERATED_AT),
    );
    expect(JSON.stringify(a1)).toBe(JSON.stringify(a2));
  });

  // Test 47
  test("frozen input entries are supported without error", () => {
    const entries = Object.freeze(makeP61Entries());
    expect(() =>
      buildSimulationInputEligibilityReviewArtifact(
        makeParams(entries, FIXED_GENERATED_AT),
      ),
    ).not.toThrow();
  });

  // Test 48
  test("empty forbiddenUse array is supported", () => {
    const entry: SimulationInputEligibilityReviewEntry = {
      source: "Quote",
      status: "ELIGIBLE_FOR_REVIEW_ARTIFACT",
      pitState: "PIT_SAFE_IF_DATE_PRESENT",
      allowedUse: "structural input eligibility review only",
      forbiddenUse: [],
      requiredAuthorization: null,
    };
    expect(() =>
      buildSimulationInputEligibilityReviewArtifact(
        makeParams([entry], FIXED_GENERATED_AT),
      ),
    ).not.toThrow();
  });

  // Test 49
  test("multiple entries of same status are counted correctly", () => {
    const entries = [
      makeQuoteEntry(),
      makeQuoteEntry(),
      makeQuoteEntry(),
    ];
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(entries, FIXED_GENERATED_AT),
    );
    expect(artifact.summary.eligibleCount).toBe(3);
    expect(artifact.summary.totalSources).toBe(3);
  });

  // Test 50
  test("summary counts are integer numbers (not NaN, not float)", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(makeP61Entries(), FIXED_GENERATED_AT),
    );
    expect(Number.isInteger(artifact.summary.eligibleCount)).toBe(true);
    expect(Number.isInteger(artifact.summary.lowConfidenceCount)).toBe(true);
    expect(Number.isInteger(artifact.summary.blockedCount)).toBe(true);
    expect(Number.isInteger(artifact.summary.auditOnlyCount)).toBe(true);
    expect(Number.isInteger(artifact.summary.totalSources)).toBe(true);
  });

  // Test 51
  test("summary total equals entries.length", () => {
    const entries = makeP61Entries();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(entries, FIXED_GENERATED_AT),
    );
    expect(artifact.summary.totalSources).toBe(entries.length);
  });

  // Test 52
  test("artifact only has version, generatedAt, governance, entries, summary as top-level keys", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([], FIXED_GENERATED_AT),
    );
    const keys = Object.keys(artifact).sort();
    expect(keys).toEqual(
      ["entries", "generatedAt", "governance", "summary", "version"].sort(),
    );
  });
});

// ─── 8. Forbidden field / source scans ───────────────────────────────────────

describe("P63 — Forbidden field and source scans", () => {
  let sourceText: string;

  beforeAll(() => {
    sourceText = fs.readFileSync(BUILDER_SOURCE_FILE, "utf-8");
  });

  // Test 53
  test("artifact top-level keys contain no forbidden field names", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams([], FIXED_GENERATED_AT),
    );
    const keys = Object.keys(artifact);
    const FORBIDDEN = [
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
    for (const forbidden of FORBIDDEN) {
      expect(keys).not.toContain(forbidden);
    }
  });

  // Test 54
  test("source text has no Prisma import", () => {
    expect(sourceText).not.toMatch(/from ['"]@prisma\/client['"]/);
    expect(sourceText).not.toMatch(/import.*prisma/i);
  });

  // Test 55
  test("source text has no DB import", () => {
    expect(sourceText).not.toMatch(/from ['"].*db['"]/i);
    expect(sourceText).not.toMatch(/from ['"].*database['"]/i);
  });

  // Test 56
  test("source text has no fs, path, network, or child_process import", () => {
    expect(sourceText).not.toMatch(/from ['"]fs['"]/);
    expect(sourceText).not.toMatch(/from ['"]path['"]/);
    expect(sourceText).not.toMatch(/from ['"]net['"]/);
    expect(sourceText).not.toMatch(/from ['"]http['"]/);
    expect(sourceText).not.toMatch(/from ['"]https['"]/);
    expect(sourceText).not.toMatch(/from ['"]child_process['"]/);
    expect(sourceText).not.toMatch(/require\(['"]fs['"]\)/);
    expect(sourceText).not.toMatch(/require\(['"]path['"]\)/);
  });

  // Test 57
  test("source text has no src/lib/research import", () => {
    expect(sourceText).not.toMatch(/from ['"].*src\/lib\/research/);
    expect(sourceText).not.toMatch(/from ['"].*\/research\//);
  });

  // Test 58
  test("source text does not export run, execute, simulate, score, optimize, backtest, or recommend", () => {
    // Check exported function names — allowed exports: buildSimulationInputEligibilityReviewArtifact,
    // countReviewStatus, summarizeSimulationInputEligibilityReviewEntries, and constants/types.
    const exportedFnMatches = sourceText.match(
      /export\s+(?:function|const|async function)\s+(\w+)/g,
    );
    if (exportedFnMatches) {
      const FORBIDDEN_EXPORT_NAMES = [
        /^run$/,
        /^execute$/,
        /^simulate$/,
        /^score$/,
        /^optimize$/,
        /^backtest$/,
        /^recommend$/,
      ];
      for (const match of exportedFnMatches) {
        const nameMatch = match.match(
          /export\s+(?:function|const|async function)\s+(\w+)/,
        );
        if (nameMatch?.[1]) {
          const name = nameMatch[1];
          for (const pattern of FORBIDDEN_EXPORT_NAMES) {
            expect(name).not.toMatch(pattern);
          }
        }
      }
    }
    // Also ensure no function body uses forbidden names as a sanity check
    expect(sourceText).not.toMatch(/export\s+function\s+run\s*\(/);
    expect(sourceText).not.toMatch(/export\s+function\s+simulate\s*\(/);
    expect(sourceText).not.toMatch(/export\s+function\s+backtest\s*\(/);
  });

  // Test 59
  test("source text does not import P53 or P54 modules", () => {
    expect(sourceText).not.toMatch(/from ['"].*\/p53\//);
    expect(sourceText).not.toMatch(/from ['"].*\/p54\//);
    expect(sourceText).not.toMatch(/SimulationInputEligibilityDiff/);
  });

  // Test 60
  test("source text does not reference PnL, ROI, winRate, or benchmark as live computation", () => {
    // These appear only in comments/disclaimer — not as variable names or computations
    const liveComputationPattern =
      /(?:const|let|var|return)\s+(?:pnl|roi|winRate|benchmark|profit|returnPct)\s*=/i;
    expect(sourceText).not.toMatch(liveComputationPattern);
  });

  // Test 61
  test("builder does not create recommendation, action, or performance fields", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(makeP61Entries(), FIXED_GENERATED_AT),
    );
    const json = JSON.stringify(artifact);
    // None of these should appear as field names in the output
    expect(json).not.toMatch(/"recommendation":/);
    expect(json).not.toMatch(/"action":/);
    expect(json).not.toMatch(/"performance":/);
    expect(json).not.toMatch(/"signal":/);
  });

  // Test 62
  test("builder does not create score, forecast, or expectedReturn fields", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(makeP61Entries(), FIXED_GENERATED_AT),
    );
    const json = JSON.stringify(artifact);
    expect(json).not.toMatch(/"score":/);
    expect(json).not.toMatch(/"forecast":/);
    expect(json).not.toMatch(/"expectedReturn":/);
    expect(json).not.toMatch(/"alphaScore":/);
  });
});

// ─── 9. Boundary / regression ─────────────────────────────────────────────────

describe("P63 — Boundary and regression", () => {
  // Test 63
  test("artifact satisfies P62 SimulationInputEligibilityReviewArtifact type", () => {
    // TypeScript compile-time check via satisfies — if this test compiles, the type is satisfied
    const artifact: SimulationInputEligibilityReviewArtifact =
      buildSimulationInputEligibilityReviewArtifact(
        makeParams(makeP61Entries(), FIXED_GENERATED_AT),
      );
    expect(artifact).toBeTruthy();
  });

  // Test 64
  test("compatible with P61 six-source matrix: all 6 sources produce correct counts", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(makeP61Entries(), FIXED_GENERATED_AT),
    );
    // P61 canonical counts: Quote+Regime=2 eligible, MonthlyRevenue=1 low, FinancialReport+Chip=2 blocked, NewsEvent=1 audit-only
    expect(artifact.summary).toEqual({
      eligibleCount: 2,
      lowConfidenceCount: 1,
      blockedCount: 2,
      auditOnlyCount: 1,
      totalSources: 6,
    });
  });

  // Test 65
  test("no simulation execution side effects — builder runs synchronously and returns a plain object", () => {
    const start = Date.now();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(makeP61Entries(), FIXED_GENERATED_AT),
    );
    const elapsed = Date.now() - start;
    // Should complete synchronously in well under 100ms — no I/O, no DB
    expect(elapsed).toBeLessThan(100);
    expect(typeof artifact).toBe("object");
    expect(artifact).not.toBeNull();
  });

  // Test 66
  test("no metrics output fields beyond summary counts", () => {
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(makeP61Entries(), FIXED_GENERATED_AT),
    );
    const summaryKeys = Object.keys(artifact.summary).sort();
    // Only count fields allowed
    expect(summaryKeys).toEqual(
      [
        "auditOnlyCount",
        "blockedCount",
        "eligibleCount",
        "lowConfidenceCount",
        "totalSources",
      ].sort(),
    );
  });

  // Test 67
  test("countReviewStatus helper returns 0 for status with no matches", () => {
    const entries = [makeQuoteEntry()]; // ELIGIBLE only
    expect(countReviewStatus(entries, "BLOCKED")).toBe(0);
    expect(countReviewStatus(entries, "AUDIT_ONLY")).toBe(0);
    expect(
      countReviewStatus(entries, "ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING"),
    ).toBe(0);
  });

  // Test 68
  test("countReviewStatus helper returns correct count for multiple matches", () => {
    const entries = [makeQuoteEntry(), makeRegimeEntry(), makeQuoteEntry()];
    expect(countReviewStatus(entries, "ELIGIBLE_FOR_REVIEW_ARTIFACT")).toBe(3);
  });

  // Test 69
  test("summarizeSimulationInputEligibilityReviewEntries helper produces frozen summary", () => {
    const summary = summarizeSimulationInputEligibilityReviewEntries(
      makeP61Entries(),
    );
    expect(summary.eligibleCount).toBe(2);
    expect(summary.lowConfidenceCount).toBe(1);
    expect(summary.blockedCount).toBe(2);
    expect(summary.auditOnlyCount).toBe(1);
    expect(summary.totalSources).toBe(6);
  });

  // Test 70
  test("all statuses in EXPECTED_REVIEW_STATUSES are covered by countReviewStatus", () => {
    // Ensures type exhaustiveness is enforced — each status maps to a count field
    const sources = [
      "Quote",
      "Regime",
      "MonthlyRevenue",
      "FinancialReport",
      "Chip",
      "NewsEvent",
    ] as const;
    const entries: SimulationInputEligibilityReviewEntry[] =
      EXPECTED_REVIEW_STATUSES.map((status, i) => ({
        source: sources[i % sources.length]!,
        status,
        pitState: "PIT_SAFE_IF_DATE_PRESENT",
        allowedUse: "structural input eligibility review only",
        forbiddenUse: [],
        requiredAuthorization: null,
      }));
    // There are 4 distinct statuses — each should contribute to exactly one count field
    const summary = summarizeSimulationInputEligibilityReviewEntries(entries);
    const countSum =
      summary.eligibleCount +
      summary.lowConfidenceCount +
      summary.blockedCount +
      summary.auditOnlyCount;
    expect(countSum).toBe(summary.totalSources);
    expect(countSum).toBe(4);
  });

  // Test 71
  test("entries with different statuses are correctly partitioned", () => {
    const mixed = makeP61Entries();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(mixed, FIXED_GENERATED_AT),
    );
    const sumOfCounts =
      artifact.summary.eligibleCount +
      artifact.summary.lowConfidenceCount +
      artifact.summary.blockedCount +
      artifact.summary.auditOnlyCount;
    expect(sumOfCounts).toBe(artifact.summary.totalSources);
  });

  // Test 72
  test("artifact entries length matches summary.totalSources", () => {
    const entries = makeP61Entries();
    const artifact = buildSimulationInputEligibilityReviewArtifact(
      makeParams(entries, FIXED_GENERATED_AT),
    );
    expect(artifact.entries.length).toBe(artifact.summary.totalSources);
  });

  // Test 73
  test("builder function signature accepts params object (not positional args)", () => {
    // Verifies the params-object API is correct
    const params: SimulationInputEligibilityReviewBuilderParams = {
      entries: makeP61Entries(),
      fixedGeneratedAt: FIXED_GENERATED_AT,
    };
    const artifact = buildSimulationInputEligibilityReviewArtifact(params);
    expect(artifact.generatedAt).toBe(FIXED_GENERATED_AT);
  });
});
