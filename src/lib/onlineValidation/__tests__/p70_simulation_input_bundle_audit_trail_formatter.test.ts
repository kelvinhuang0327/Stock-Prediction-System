/**
 * P70 — Axis B v1 Simulation Input Bundle Audit Trail Formatter Tests
 *
 * Test suite for the P70 simulation input bundle audit trail formatter.
 * All tests are pure — no DB, no Prisma, no network, no filesystem (except
 * source text scans which use fs.readFileSync on the P70 source file).
 *
 * 64 tests across 20 groups:
 *   T70.1:  Version (3)
 *   T70.2:  Governance constants (8)
 *   T70.3:  generatedAt (3)
 *   T70.4:  Accepts valid audit trail (3)
 *   T70.5:  validate() returns valid (3)
 *   T70.6:  Rejects previewOnly=false (2)
 *   T70.7:  Rejects paperOnly=false (2)
 *   T70.8:  Rejects noExecution=false (2)
 *   T70.9:  Rejects noActualMetrics=false (2)
 *   T70.10: Rejects entersAlphaScore=true (2)
 *   T70.11: Rejects notInvestmentAdvice=false (2)
 *   T70.12: INCLUDED_ELIGIBLE display rows (3)
 *   T70.13: INCLUDED_LOW_CONFIDENCE display rows (2)
 *   T70.14: EXCLUDED_BLOCKED display rows (3)
 *   T70.15: AUDIT_ONLY_REFERENCE display rows (2)
 *   T70.16: formatterSummary counts (5)
 *   T70.17: Serialization / immutability (5)
 *   T70.18: Forbidden imports (source scan) (5)
 *   T70.19: Forbidden exports / semantics (source scan) (2)
 *   T70.20: Forbidden fields (source scan) (5)
 */

import * as fs from "fs";
import * as path from "path";

import {
  SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_VERSION,
  SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_GOVERNANCE,
  formatSimulationInputBundleAuditTrail,
  validateSimulationInputBundleAuditTrailForFormatting,
  type SimulationInputBundleAuditTrail,
  type SimulationInputBundleAuditTrailFormatterResponse,
} from "../p70/SimulationInputBundleAuditTrailFormatter";

import {
  buildSimulationInputBundleAuditTrail,
} from "../p69/SimulationInputBundleAuditTrail";

import {
  buildSimulationInputBundlePreview,
} from "../p65/SimulationInputBundlePreview";

import {
  buildSimulationInputEligibilityReviewArtifact,
} from "../p63/SimulationInputEligibilityReviewBuilder";

import {
  evaluateSimulationInputEligibilityReviewArtifactForBundlePreview,
} from "../p64/SimulationInputEligibilityReviewConsumerGate";

import {
  type SimulationInputEligibilityReviewEntry,
  type SimulationInputPitState,
  type SimulationInputReviewSourceName,
  type SimulationInputReviewStatus,
} from "../p62/SimulationInputEligibilityReviewContract";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIXED_TS = "2026-01-01T00:00:00.000Z";

const GATE_SOURCE_FILE = path.resolve(
  __dirname,
  "../p70/SimulationInputBundleAuditTrailFormatter.ts",
);
const formatterSource = fs.readFileSync(GATE_SOURCE_FILE, "utf-8");

// ─── Fixture Helpers ──────────────────────────────────────────────────────────

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

function makeAuditTrail(fixedGeneratedAt = FIXED_TS): SimulationInputBundleAuditTrail {
  const artifact = buildSimulationInputEligibilityReviewArtifact({
    entries: makeP61Entries(),
    fixedGeneratedAt,
  });
  const gateResult = evaluateSimulationInputEligibilityReviewArtifactForBundlePreview(
    artifact,
    fixedGeneratedAt,
  );
  const preview = buildSimulationInputBundlePreview({ artifact, gateResult, fixedGeneratedAt });
  return buildSimulationInputBundleAuditTrail({ preview, fixedGeneratedAt });
}

function makeFormatterResponse(
  fixedGeneratedAt = FIXED_TS,
): SimulationInputBundleAuditTrailFormatterResponse {
  return formatSimulationInputBundleAuditTrail({
    auditTrail: makeAuditTrail(fixedGeneratedAt),
    fixedGeneratedAt,
  });
}

function makeBadAuditTrail(
  override: Record<string, unknown>,
): SimulationInputBundleAuditTrail {
  return { ...makeAuditTrail(), ...override } as unknown as SimulationInputBundleAuditTrail;
}

// ─── T70.1: Version ───────────────────────────────────────────────────────────

describe("T70.1 — Version", () => {
  it("SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_VERSION is the exact expected string", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_VERSION).toBe(
      "p70-axis-b-simulation-input-bundle-audit-trail-formatter-v0",
    );
  });

  it("version starts with p70-axis-b-", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_VERSION).toMatch(/^p70-axis-b-/);
  });

  it("formatter response version matches version constant", () => {
    const response = makeFormatterResponse();
    expect(response.version).toBe(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_VERSION);
  });
});

// ─── T70.2: Governance constants ──────────────────────────────────────────────

describe("T70.2 — Governance constants", () => {
  it("GOVERNANCE.previewOnly is exactly true", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_GOVERNANCE.previewOnly).toBe(true);
  });

  it("GOVERNANCE.paperOnly is exactly true", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_GOVERNANCE.paperOnly).toBe(true);
  });

  it("GOVERNANCE.noExecution is exactly true", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_GOVERNANCE.noExecution).toBe(true);
  });

  it("GOVERNANCE.noActualMetrics is exactly true", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_GOVERNANCE.noActualMetrics).toBe(true);
  });

  it("GOVERNANCE.entersAlphaScore is exactly false", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  it("GOVERNANCE.notInvestmentAdvice is exactly true", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_GOVERNANCE.notInvestmentAdvice).toBe(true);
  });

  it("GOVERNANCE constant is frozen", () => {
    expect(Object.isFrozen(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_GOVERNANCE)).toBe(true);
  });

  it("formatter response carries all six governance flags", () => {
    const response = makeFormatterResponse();
    expect(response.previewOnly).toBe(true);
    expect(response.paperOnly).toBe(true);
    expect(response.noExecution).toBe(true);
    expect(response.noActualMetrics).toBe(true);
    expect(response.entersAlphaScore).toBe(false);
    expect(response.notInvestmentAdvice).toBe(true);
  });
});

// ─── T70.3: generatedAt ───────────────────────────────────────────────────────

describe("T70.3 — generatedAt", () => {
  it("uses fixedGeneratedAt when supplied", () => {
    const response = makeFormatterResponse(FIXED_TS);
    expect(response.generatedAt).toBe(FIXED_TS);
  });

  it("default generatedAt is a valid ISO string when no fixedGeneratedAt", () => {
    const response = formatSimulationInputBundleAuditTrail({
      auditTrail: makeAuditTrail(),
    });
    expect(() => new Date(response.generatedAt)).not.toThrow();
    expect(response.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("fixedGeneratedAt produces deterministic output across repeated calls", () => {
    const r1 = makeFormatterResponse(FIXED_TS);
    const r2 = makeFormatterResponse(FIXED_TS);
    expect(r1.generatedAt).toBe(r2.generatedAt);
  });
});

// ─── T70.4: Accepts valid audit trail ─────────────────────────────────────────

describe("T70.4 — Accepts valid audit trail", () => {
  it("formatSimulationInputBundleAuditTrail does not throw on valid audit trail", () => {
    expect(() => makeFormatterResponse()).not.toThrow();
  });

  it("response is defined", () => {
    const response = makeFormatterResponse();
    expect(response).toBeDefined();
  });

  it("auditTrailVersion in response matches P69 audit trail version", () => {
    const auditTrail = makeAuditTrail();
    const response = formatSimulationInputBundleAuditTrail({ auditTrail, fixedGeneratedAt: FIXED_TS });
    expect(response.auditTrailVersion).toBe(auditTrail.version);
  });
});

// ─── T70.5: validate() returns valid ──────────────────────────────────────────

describe("T70.5 — validate() returns valid", () => {
  it("validateSimulationInputBundleAuditTrailForFormatting returns {valid:true} for valid audit trail", () => {
    const result = validateSimulationInputBundleAuditTrailForFormatting(makeAuditTrail());
    expect(result.valid).toBe(true);
  });

  it("valid result has no reason field", () => {
    const result = validateSimulationInputBundleAuditTrailForFormatting(makeAuditTrail());
    expect(result).not.toHaveProperty("reason");
  });

  it("returns valid=true twice in a row (idempotent)", () => {
    const trail = makeAuditTrail();
    const r1 = validateSimulationInputBundleAuditTrailForFormatting(trail);
    const r2 = validateSimulationInputBundleAuditTrailForFormatting(trail);
    expect(r1.valid).toBe(true);
    expect(r2.valid).toBe(true);
  });
});

// ─── T70.6: Rejects previewOnly=false ─────────────────────────────────────────

describe("T70.6 — Rejects previewOnly=false", () => {
  it("validateSimulationInputBundleAuditTrailForFormatting returns valid=false when previewOnly=false", () => {
    const result = validateSimulationInputBundleAuditTrailForFormatting(
      makeBadAuditTrail({ previewOnly: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("formatSimulationInputBundleAuditTrail throws when previewOnly=false", () => {
    expect(() =>
      formatSimulationInputBundleAuditTrail({
        auditTrail: makeBadAuditTrail({ previewOnly: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T70.7: Rejects paperOnly=false ───────────────────────────────────────────

describe("T70.7 — Rejects paperOnly=false", () => {
  it("validateSimulationInputBundleAuditTrailForFormatting returns valid=false when paperOnly=false", () => {
    const result = validateSimulationInputBundleAuditTrailForFormatting(
      makeBadAuditTrail({ paperOnly: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("formatSimulationInputBundleAuditTrail throws when paperOnly=false", () => {
    expect(() =>
      formatSimulationInputBundleAuditTrail({
        auditTrail: makeBadAuditTrail({ paperOnly: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T70.8: Rejects noExecution=false ─────────────────────────────────────────

describe("T70.8 — Rejects noExecution=false", () => {
  it("validateSimulationInputBundleAuditTrailForFormatting returns valid=false when noExecution=false", () => {
    const result = validateSimulationInputBundleAuditTrailForFormatting(
      makeBadAuditTrail({ noExecution: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("formatSimulationInputBundleAuditTrail throws when noExecution=false", () => {
    expect(() =>
      formatSimulationInputBundleAuditTrail({
        auditTrail: makeBadAuditTrail({ noExecution: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T70.9: Rejects noActualMetrics=false ────────────────────────────────────

describe("T70.9 — Rejects noActualMetrics=false", () => {
  it("validateSimulationInputBundleAuditTrailForFormatting returns valid=false when noActualMetrics=false", () => {
    const result = validateSimulationInputBundleAuditTrailForFormatting(
      makeBadAuditTrail({ noActualMetrics: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("formatSimulationInputBundleAuditTrail throws when noActualMetrics=false", () => {
    expect(() =>
      formatSimulationInputBundleAuditTrail({
        auditTrail: makeBadAuditTrail({ noActualMetrics: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T70.10: Rejects entersAlphaScore=true ───────────────────────────────────

describe("T70.10 — Rejects entersAlphaScore=true", () => {
  it("validateSimulationInputBundleAuditTrailForFormatting returns valid=false when entersAlphaScore=true", () => {
    const result = validateSimulationInputBundleAuditTrailForFormatting(
      makeBadAuditTrail({ entersAlphaScore: true }),
    );
    expect(result.valid).toBe(false);
  });

  it("formatSimulationInputBundleAuditTrail throws when entersAlphaScore=true", () => {
    expect(() =>
      formatSimulationInputBundleAuditTrail({
        auditTrail: makeBadAuditTrail({ entersAlphaScore: true }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T70.11: Rejects notInvestmentAdvice=false ───────────────────────────────

describe("T70.11 — Rejects notInvestmentAdvice=false", () => {
  it("validateSimulationInputBundleAuditTrailForFormatting returns valid=false when notInvestmentAdvice=false", () => {
    const result = validateSimulationInputBundleAuditTrailForFormatting(
      makeBadAuditTrail({ notInvestmentAdvice: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("formatSimulationInputBundleAuditTrail throws when notInvestmentAdvice=false", () => {
    expect(() =>
      formatSimulationInputBundleAuditTrail({
        auditTrail: makeBadAuditTrail({ notInvestmentAdvice: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T70.12: INCLUDED_ELIGIBLE display rows ───────────────────────────────────

describe("T70.12 — INCLUDED_ELIGIBLE display rows", () => {
  it("Quote and Regime appear as INCLUDED_ELIGIBLE display rows", () => {
    const response = makeFormatterResponse();
    const eligibleRows = response.displayRows.filter(
      (r) => r.auditRowType === "INCLUDED_ELIGIBLE",
    );
    const names = eligibleRows.map((r) => r.sourceName);
    expect(names).toContain("Quote");
    expect(names).toContain("Regime");
  });

  it("INCLUDED_ELIGIBLE display rows have includeInAudit=true", () => {
    const response = makeFormatterResponse();
    const eligibleRows = response.displayRows.filter(
      (r) => r.auditRowType === "INCLUDED_ELIGIBLE",
    );
    for (const row of eligibleRows) {
      expect(row.includeInAudit).toBe(true);
    }
  });

  it("INCLUDED_ELIGIBLE display rows have no displayNote", () => {
    const response = makeFormatterResponse();
    const eligibleRows = response.displayRows.filter(
      (r) => r.auditRowType === "INCLUDED_ELIGIBLE",
    );
    for (const row of eligibleRows) {
      expect(row.displayNote).toBeUndefined();
    }
  });
});

// ─── T70.13: INCLUDED_LOW_CONFIDENCE display rows ────────────────────────────

describe("T70.13 — INCLUDED_LOW_CONFIDENCE display rows", () => {
  it("MonthlyRevenue appears as INCLUDED_LOW_CONFIDENCE display row", () => {
    const response = makeFormatterResponse();
    const lcRows = response.displayRows.filter(
      (r) => r.auditRowType === "INCLUDED_LOW_CONFIDENCE",
    );
    const names = lcRows.map((r) => r.sourceName);
    expect(names).toContain("MonthlyRevenue");
  });

  it("INCLUDED_LOW_CONFIDENCE display rows have a displayNote", () => {
    const response = makeFormatterResponse();
    const lcRows = response.displayRows.filter(
      (r) => r.auditRowType === "INCLUDED_LOW_CONFIDENCE",
    );
    for (const row of lcRows) {
      expect(row.displayNote).toBeDefined();
      expect(typeof row.displayNote).toBe("string");
      expect((row.displayNote as string).length).toBeGreaterThan(0);
    }
  });
});

// ─── T70.14: EXCLUDED_BLOCKED display rows ───────────────────────────────────

describe("T70.14 — EXCLUDED_BLOCKED display rows", () => {
  it("FinancialReport and Chip appear as EXCLUDED_BLOCKED display rows", () => {
    const response = makeFormatterResponse();
    const blockedRows = response.displayRows.filter(
      (r) => r.auditRowType === "EXCLUDED_BLOCKED",
    );
    const names = blockedRows.map((r) => r.sourceName);
    expect(names).toContain("FinancialReport");
    expect(names).toContain("Chip");
  });

  it("EXCLUDED_BLOCKED display rows have includeInAudit=false", () => {
    const response = makeFormatterResponse();
    const blockedRows = response.displayRows.filter(
      (r) => r.auditRowType === "EXCLUDED_BLOCKED",
    );
    for (const row of blockedRows) {
      expect(row.includeInAudit).toBe(false);
    }
  });

  it("EXCLUDED_BLOCKED display rows have a displayNote", () => {
    const response = makeFormatterResponse();
    const blockedRows = response.displayRows.filter(
      (r) => r.auditRowType === "EXCLUDED_BLOCKED",
    );
    for (const row of blockedRows) {
      expect(row.displayNote).toBeDefined();
      expect(typeof row.displayNote).toBe("string");
    }
  });
});

// ─── T70.15: AUDIT_ONLY_REFERENCE display rows ───────────────────────────────

describe("T70.15 — AUDIT_ONLY_REFERENCE display rows", () => {
  it("NewsEvent appears as AUDIT_ONLY_REFERENCE display row", () => {
    const response = makeFormatterResponse();
    const auditOnlyRows = response.displayRows.filter(
      (r) => r.auditRowType === "AUDIT_ONLY_REFERENCE",
    );
    const names = auditOnlyRows.map((r) => r.sourceName);
    expect(names).toContain("NewsEvent");
  });

  it("AUDIT_ONLY_REFERENCE display rows have includeInAudit=false", () => {
    const response = makeFormatterResponse();
    const auditOnlyRows = response.displayRows.filter(
      (r) => r.auditRowType === "AUDIT_ONLY_REFERENCE",
    );
    for (const row of auditOnlyRows) {
      expect(row.includeInAudit).toBe(false);
    }
  });
});

// ─── T70.16: formatterSummary counts ─────────────────────────────────────────

describe("T70.16 — formatterSummary counts", () => {
  it("totalDisplayRows equals number of display rows", () => {
    const response = makeFormatterResponse();
    expect(response.formatterSummary.totalDisplayRows).toBe(response.displayRows.length);
  });

  it("includedEligibleCount matches INCLUDED_ELIGIBLE rows", () => {
    const response = makeFormatterResponse();
    const count = response.displayRows.filter(
      (r) => r.auditRowType === "INCLUDED_ELIGIBLE",
    ).length;
    expect(response.formatterSummary.includedEligibleCount).toBe(count);
  });

  it("includedLowConfidenceCount matches INCLUDED_LOW_CONFIDENCE rows", () => {
    const response = makeFormatterResponse();
    const count = response.displayRows.filter(
      (r) => r.auditRowType === "INCLUDED_LOW_CONFIDENCE",
    ).length;
    expect(response.formatterSummary.includedLowConfidenceCount).toBe(count);
  });

  it("excludedBlockedCount matches EXCLUDED_BLOCKED rows", () => {
    const response = makeFormatterResponse();
    const count = response.displayRows.filter(
      (r) => r.auditRowType === "EXCLUDED_BLOCKED",
    ).length;
    expect(response.formatterSummary.excludedBlockedCount).toBe(count);
  });

  it("auditOnlyReferenceCount matches AUDIT_ONLY_REFERENCE rows", () => {
    const response = makeFormatterResponse();
    const count = response.displayRows.filter(
      (r) => r.auditRowType === "AUDIT_ONLY_REFERENCE",
    ).length;
    expect(response.formatterSummary.auditOnlyReferenceCount).toBe(count);
  });
});

// ─── T70.17: Serialization / immutability ─────────────────────────────────────

describe("T70.17 — Serialization / immutability", () => {
  it("output is JSON serializable without errors", () => {
    const response = makeFormatterResponse();
    expect(() => JSON.stringify(response)).not.toThrow();
  });

  it("JSON.parse(JSON.stringify(response)) matches original values", () => {
    const response = makeFormatterResponse();
    const parsed = JSON.parse(JSON.stringify(response)) as typeof response;
    expect(parsed.version).toBe(response.version);
    expect(parsed.generatedAt).toBe(response.generatedAt);
    expect(parsed.displayRows.length).toBe(response.displayRows.length);
  });

  it("top-level response object is frozen", () => {
    const response = makeFormatterResponse();
    expect(Object.isFrozen(response)).toBe(true);
  });

  it("formatter response does not mutate the input audit trail", () => {
    const auditTrail = makeAuditTrail();
    const originalVersion = auditTrail.version;
    const originalRowCount = auditTrail.auditRows.length;
    formatSimulationInputBundleAuditTrail({ auditTrail, fixedGeneratedAt: FIXED_TS });
    expect(auditTrail.version).toBe(originalVersion);
    expect(auditTrail.auditRows.length).toBe(originalRowCount);
  });

  it("formatter accepts a frozen input audit trail without throwing", () => {
    const auditTrail = makeAuditTrail();
    const frozenTrail = Object.freeze(auditTrail) as SimulationInputBundleAuditTrail;
    expect(() =>
      formatSimulationInputBundleAuditTrail({ auditTrail: frozenTrail, fixedGeneratedAt: FIXED_TS }),
    ).not.toThrow();
  });
});

// ─── T70.18: Forbidden imports (source scan) ──────────────────────────────────

describe("T70.18 — Forbidden imports (source scan)", () => {
  it("source does not import child_process", () => {
    expect(formatterSource).not.toMatch(/from\s+['"]child_process['"]/);
    expect(formatterSource).not.toMatch(/require\(['"]child_process['"]/);
  });

  it("source does not import Prisma or DB client", () => {
    expect(formatterSource).not.toMatch(/from\s+['"][^'"]*prisma['"]/i);
    expect(formatterSource).not.toMatch(/from\s+['"][^'"]*@prisma['"]/i);
  });

  it("source does not import fs, path, or network modules", () => {
    expect(formatterSource).not.toMatch(/from\s+['"]fs['"]/);
    expect(formatterSource).not.toMatch(/from\s+['"]path['"]/);
    expect(formatterSource).not.toMatch(/from\s+['"]https?['"]/);
    expect(formatterSource).not.toMatch(/from\s+['"]node-fetch['"]/);
  });

  it("source does not import from src/lib/research", () => {
    expect(formatterSource).not.toMatch(/from\s+['"][^'"]*lib\/research/);
  });

  it("source only imports from p69 as the single production upstream", () => {
    const importLines = formatterSource
      .split("\n")
      .filter((line) => /^import/.test(line.trim()) && !/^\/\//.test(line.trim()));
    const nonP69Imports = importLines.filter(
      (line) => !line.includes("p69/SimulationInputBundleAuditTrail"),
    );
    // All non-p69 imports should be type-only from this module or zero
    expect(nonP69Imports).toHaveLength(0);
  });
});

// ─── T70.19: Forbidden exports / semantics (source scan) ──────────────────────

describe("T70.19 — Forbidden exports / semantics (source scan)", () => {
  it("source does not export run, execute, simulate, score, optimize, backtest, recommend", () => {
    expect(formatterSource).not.toMatch(
      /export\s+(?:function|const|class|type)\s+[A-Za-z]*(?:run|execute|simulate|score|optimize|backtest|recommend)[A-Za-z]*/i,
    );
  });

  it("source does not export identifiers named ROI, PnL, winRate, benchmark, targetPrice", () => {
    expect(formatterSource).not.toMatch(
      /export\s+(?:function|const|class|type)\s+[A-Za-z]*(?:ROI|PnL|winRate|benchmark|targetPrice)/,
    );
  });
});

// ─── T70.20: Forbidden fields (source scan) ───────────────────────────────────

describe("T70.20 — Forbidden fields (source scan)", () => {
  it("formatter response fields include no prediction field", () => {
    const response = makeFormatterResponse();
    const keys = Object.keys(response);
    expect(keys).not.toContain("prediction");
    expect(keys).not.toContain("recommendation");
    expect(keys).not.toContain("investmentAdvice");
  });

  it("display rows contain no forbidden fields", () => {
    const response = makeFormatterResponse();
    for (const row of response.displayRows) {
      const keys = Object.keys(row);
      expect(keys).not.toContain("score");
      expect(keys).not.toContain("roi");
      expect(keys).not.toContain("pnl");
      expect(keys).not.toContain("targetPrice");
      expect(keys).not.toContain("action");
      expect(keys).not.toContain("recommendation");
    }
  });

  it("source does not reference buy, sell, hold as semantic output labels", () => {
    // Allow the word in JSDoc prohibition comments; check actual output field assignments
    const outputFieldPattern = /:\s*["'](?:buy|sell|hold)["']/i;
    expect(formatterSource).not.toMatch(outputFieldPattern);
  });

  it("source does not reference alphaScore as output field", () => {
    // Only allowed as governance flag name (entersAlphaScore), not as an output field key
    expect(formatterSource).not.toMatch(/alphaScore\s*:/);
  });

  it("source does not reference targetPrice or target_price", () => {
    expect(formatterSource).not.toMatch(/targetPrice|target_price/);
  });
});
