/**
 * P69 — Axis B v1 Simulation Input Bundle Audit Trail Tests
 *
 * Test suite for the P69 simulation input bundle audit trail builder.
 * All tests are pure — no DB, no Prisma, no network, no filesystem (except
 * source text scans which use fs.readFileSync on the P69 source file).
 *
 * 64 tests across 20 groups:
 *   T69.1:  Version (3)
 *   T69.2:  Governance constants (8)
 *   T69.3:  generatedAt (3)
 *   T69.4:  Accepts valid preview (3)
 *   T69.5:  validate() returns valid (3)
 *   T69.6:  Rejects previewOnly=false (2)
 *   T69.7:  Rejects paperOnly=false (2)
 *   T69.8:  Rejects noExecution=false (2)
 *   T69.9:  Rejects noActualMetrics=false (2)
 *   T69.10: Rejects entersAlphaScore=true (2)
 *   T69.11: Rejects notInvestmentAdvice=false (2)
 *   T69.12: INCLUDED_ELIGIBLE rows (3)
 *   T69.13: INCLUDED_LOW_CONFIDENCE rows (2)
 *   T69.14: EXCLUDED_BLOCKED rows (3)
 *   T69.15: AUDIT_ONLY_REFERENCE rows (2)
 *   T69.16: auditSummary counts (5)
 *   T69.17: Serialization / immutability (5)
 *   T69.18: Forbidden imports (source scan) (5)
 *   T69.19: Forbidden exports / semantics (source scan) (2)
 *   T69.20: Forbidden fields (source scan) (5)
 */

import * as fs from "fs";
import * as path from "path";

import {
  SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_VERSION,
  SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_GOVERNANCE,
  buildSimulationInputBundleAuditTrail,
  validateSimulationInputBundlePreviewForAuditTrail,
  type SimulationInputBundleAuditTrail,
  type SimulationInputBundleAuditTrailSourceRow,
} from "../p69/SimulationInputBundleAuditTrail";

import {
  buildSimulationInputBundlePreview,
  type SimulationInputBundlePreview,
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
  "../p69/SimulationInputBundleAuditTrail.ts",
);
const auditTrailSource = fs.readFileSync(GATE_SOURCE_FILE, "utf-8");

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

function makePreview(fixedGeneratedAt = FIXED_TS): SimulationInputBundlePreview {
  const artifact = buildSimulationInputEligibilityReviewArtifact({
    entries: makeP61Entries(),
    fixedGeneratedAt,
  });
  const gateResult = evaluateSimulationInputEligibilityReviewArtifactForBundlePreview(
    artifact,
    fixedGeneratedAt,
  );
  return buildSimulationInputBundlePreview({ artifact, gateResult, fixedGeneratedAt });
}

function makeAuditTrail(fixedGeneratedAt = FIXED_TS): SimulationInputBundleAuditTrail {
  return buildSimulationInputBundleAuditTrail({
    preview: makePreview(fixedGeneratedAt),
    fixedGeneratedAt,
  });
}

function makeBadPreview(
  override: Record<string, unknown>,
): SimulationInputBundlePreview {
  return { ...makePreview(), ...override } as unknown as SimulationInputBundlePreview;
}

// ─── T69.1: Version ───────────────────────────────────────────────────────────

describe("T69.1 — Version", () => {
  it("SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_VERSION is the exact expected string", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_VERSION).toBe(
      "p69-axis-b-simulation-input-bundle-audit-trail-v0",
    );
  });

  it("version starts with p69-axis-b-", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_VERSION).toMatch(/^p69-axis-b-/);
  });

  it("trail response version matches version constant", () => {
    const trail = makeAuditTrail();
    expect(trail.version).toBe(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_VERSION);
  });
});

// ─── T69.2: Governance constants ──────────────────────────────────────────────

describe("T69.2 — Governance constants", () => {
  it("GOVERNANCE.previewOnly is exactly true", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_GOVERNANCE.previewOnly).toBe(true);
  });

  it("GOVERNANCE.paperOnly is exactly true", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_GOVERNANCE.paperOnly).toBe(true);
  });

  it("GOVERNANCE.noExecution is exactly true", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_GOVERNANCE.noExecution).toBe(true);
  });

  it("GOVERNANCE.noActualMetrics is exactly true", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_GOVERNANCE.noActualMetrics).toBe(true);
  });

  it("GOVERNANCE.entersAlphaScore is exactly false", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  it("GOVERNANCE.notInvestmentAdvice is exactly true", () => {
    expect(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_GOVERNANCE.notInvestmentAdvice).toBe(true);
  });

  it("GOVERNANCE constant is frozen", () => {
    expect(Object.isFrozen(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_GOVERNANCE)).toBe(true);
  });

  it("trail response carries all six governance flags", () => {
    const trail = makeAuditTrail();
    expect(trail.previewOnly).toBe(true);
    expect(trail.paperOnly).toBe(true);
    expect(trail.noExecution).toBe(true);
    expect(trail.noActualMetrics).toBe(true);
    expect(trail.entersAlphaScore).toBe(false);
    expect(trail.notInvestmentAdvice).toBe(true);
  });
});

// ─── T69.3: generatedAt ───────────────────────────────────────────────────────

describe("T69.3 — generatedAt", () => {
  it("uses fixedGeneratedAt when supplied", () => {
    const trail = makeAuditTrail(FIXED_TS);
    expect(trail.generatedAt).toBe(FIXED_TS);
  });

  it("default generatedAt is an ISO string when not fixed", () => {
    const trail = buildSimulationInputBundleAuditTrail({
      preview: makePreview(),
    });
    expect(trail.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("two calls with fixedGeneratedAt produce identical generatedAt", () => {
    const t1 = makeAuditTrail(FIXED_TS);
    const t2 = makeAuditTrail(FIXED_TS);
    expect(t1.generatedAt).toBe(t2.generatedAt);
  });
});

// ─── T69.4: Accepts valid preview ────────────────────────────────────────────

describe("T69.4 — Accepts valid preview", () => {
  it("does not throw for a valid P65 preview", () => {
    expect(() => makeAuditTrail()).not.toThrow();
  });

  it("response has a truthy generatedAt", () => {
    const trail = makeAuditTrail();
    expect(trail.generatedAt).toBeTruthy();
  });

  it("previewVersion matches the P65 preview version constant", () => {
    const preview = makePreview();
    const trail = buildSimulationInputBundleAuditTrail({ preview, fixedGeneratedAt: FIXED_TS });
    expect(trail.previewVersion).toBe(preview.version);
  });
});

// ─── T69.5: validate() returns valid ─────────────────────────────────────────

describe("T69.5 — validate() returns valid for valid preview", () => {
  it("returns { valid: true } for a valid preview", () => {
    const result = validateSimulationInputBundlePreviewForAuditTrail(makePreview());
    expect(result.valid).toBe(true);
  });

  it("valid result has no reason property", () => {
    const result = validateSimulationInputBundlePreviewForAuditTrail(makePreview());
    expect("reason" in result).toBe(false);
  });

  it("validate does not throw for a valid preview", () => {
    expect(() =>
      validateSimulationInputBundlePreviewForAuditTrail(makePreview()),
    ).not.toThrow();
  });
});

// ─── T69.6: Rejects previewOnly=false ────────────────────────────────────────

describe("T69.6 — Rejects previewOnly=false", () => {
  it("validate returns { valid: false } when previewOnly is false", () => {
    const result = validateSimulationInputBundlePreviewForAuditTrail(
      makeBadPreview({ previewOnly: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("build throws when previewOnly is false", () => {
    expect(() =>
      buildSimulationInputBundleAuditTrail({
        preview: makeBadPreview({ previewOnly: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T69.7: Rejects paperOnly=false ──────────────────────────────────────────

describe("T69.7 — Rejects paperOnly=false", () => {
  it("validate returns { valid: false } when paperOnly is false", () => {
    const result = validateSimulationInputBundlePreviewForAuditTrail(
      makeBadPreview({ paperOnly: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("build throws when paperOnly is false", () => {
    expect(() =>
      buildSimulationInputBundleAuditTrail({
        preview: makeBadPreview({ paperOnly: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T69.8: Rejects noExecution=false ────────────────────────────────────────

describe("T69.8 — Rejects noExecution=false", () => {
  it("validate returns { valid: false } when noExecution is false", () => {
    const result = validateSimulationInputBundlePreviewForAuditTrail(
      makeBadPreview({ noExecution: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("build throws when noExecution is false", () => {
    expect(() =>
      buildSimulationInputBundleAuditTrail({
        preview: makeBadPreview({ noExecution: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T69.9: Rejects noActualMetrics=false ────────────────────────────────────

describe("T69.9 — Rejects noActualMetrics=false", () => {
  it("validate returns { valid: false } when noActualMetrics is false", () => {
    const result = validateSimulationInputBundlePreviewForAuditTrail(
      makeBadPreview({ noActualMetrics: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("build throws when noActualMetrics is false", () => {
    expect(() =>
      buildSimulationInputBundleAuditTrail({
        preview: makeBadPreview({ noActualMetrics: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T69.10: Rejects entersAlphaScore=true ───────────────────────────────────

describe("T69.10 — Rejects entersAlphaScore=true", () => {
  it("validate returns { valid: false } when entersAlphaScore is true", () => {
    const result = validateSimulationInputBundlePreviewForAuditTrail(
      makeBadPreview({ entersAlphaScore: true }),
    );
    expect(result.valid).toBe(false);
  });

  it("build throws when entersAlphaScore is true", () => {
    expect(() =>
      buildSimulationInputBundleAuditTrail({
        preview: makeBadPreview({ entersAlphaScore: true }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T69.11: Rejects notInvestmentAdvice=false ───────────────────────────────

describe("T69.11 — Rejects notInvestmentAdvice=false", () => {
  it("validate returns { valid: false } when notInvestmentAdvice is false", () => {
    const result = validateSimulationInputBundlePreviewForAuditTrail(
      makeBadPreview({ notInvestmentAdvice: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("build throws when notInvestmentAdvice is false", () => {
    expect(() =>
      buildSimulationInputBundleAuditTrail({
        preview: makeBadPreview({ notInvestmentAdvice: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T69.12: INCLUDED_ELIGIBLE rows ──────────────────────────────────────────

describe("T69.12 — INCLUDED_ELIGIBLE rows", () => {
  it("Quote source produces an INCLUDED_ELIGIBLE audit row", () => {
    const trail = makeAuditTrail();
    const quoteRow = trail.auditRows.find((r) => r.sourceName === "Quote");
    expect(quoteRow).toBeDefined();
    expect(quoteRow!.auditRowType).toBe("INCLUDED_ELIGIBLE");
  });

  it("Regime source produces an INCLUDED_ELIGIBLE audit row", () => {
    const trail = makeAuditTrail();
    const regimeRow = trail.auditRows.find((r) => r.sourceName === "Regime");
    expect(regimeRow).toBeDefined();
    expect(regimeRow!.auditRowType).toBe("INCLUDED_ELIGIBLE");
  });

  it("INCLUDED_ELIGIBLE rows have includeInAudit=true", () => {
    const trail = makeAuditTrail();
    const eligibleRows = trail.auditRows.filter(
      (r) => r.auditRowType === "INCLUDED_ELIGIBLE",
    );
    expect(eligibleRows.length).toBeGreaterThan(0);
    for (const row of eligibleRows) {
      expect(row.includeInAudit).toBe(true);
    }
  });
});

// ─── T69.13: INCLUDED_LOW_CONFIDENCE rows ────────────────────────────────────

describe("T69.13 — INCLUDED_LOW_CONFIDENCE rows", () => {
  it("MonthlyRevenue source produces an INCLUDED_LOW_CONFIDENCE audit row", () => {
    const trail = makeAuditTrail();
    const row = trail.auditRows.find((r) => r.sourceName === "MonthlyRevenue");
    expect(row).toBeDefined();
    expect(row!.auditRowType).toBe("INCLUDED_LOW_CONFIDENCE");
  });

  it("low-confidence audit row has a neutral auditNote mentioning low-confidence", () => {
    const trail = makeAuditTrail();
    const row = trail.auditRows.find(
      (r) => r.auditRowType === "INCLUDED_LOW_CONFIDENCE",
    );
    expect(row).toBeDefined();
    expect(row!.auditNote).toBeDefined();
    expect(row!.auditNote!.toLowerCase()).toMatch(/low.?confidence/);
  });
});

// ─── T69.14: EXCLUDED_BLOCKED rows ───────────────────────────────────────────

describe("T69.14 — EXCLUDED_BLOCKED rows", () => {
  it("FinancialReport source produces an EXCLUDED_BLOCKED audit row", () => {
    const trail = makeAuditTrail();
    const row = trail.auditRows.find((r) => r.sourceName === "FinancialReport");
    expect(row).toBeDefined();
    expect(row!.auditRowType).toBe("EXCLUDED_BLOCKED");
  });

  it("Chip source produces an EXCLUDED_BLOCKED audit row", () => {
    const trail = makeAuditTrail();
    const row = trail.auditRows.find((r) => r.sourceName === "Chip");
    expect(row).toBeDefined();
    expect(row!.auditRowType).toBe("EXCLUDED_BLOCKED");
  });

  it("EXCLUDED_BLOCKED rows have includeInAudit=false", () => {
    const trail = makeAuditTrail();
    const blockedRows = trail.auditRows.filter(
      (r) => r.auditRowType === "EXCLUDED_BLOCKED",
    );
    expect(blockedRows.length).toBeGreaterThan(0);
    for (const row of blockedRows) {
      expect(row.includeInAudit).toBe(false);
    }
  });
});

// ─── T69.15: AUDIT_ONLY_REFERENCE rows ───────────────────────────────────────

describe("T69.15 — AUDIT_ONLY_REFERENCE rows", () => {
  it("NewsEvent source produces an AUDIT_ONLY_REFERENCE audit row", () => {
    const trail = makeAuditTrail();
    const row = trail.auditRows.find((r) => r.sourceName === "NewsEvent");
    expect(row).toBeDefined();
    expect(row!.auditRowType).toBe("AUDIT_ONLY_REFERENCE");
  });

  it("AUDIT_ONLY_REFERENCE rows have includeInAudit=false", () => {
    const trail = makeAuditTrail();
    const auditOnlyRows = trail.auditRows.filter(
      (r) => r.auditRowType === "AUDIT_ONLY_REFERENCE",
    );
    expect(auditOnlyRows.length).toBeGreaterThan(0);
    for (const row of auditOnlyRows) {
      expect(row.includeInAudit).toBe(false);
    }
  });
});

// ─── T69.16: auditSummary counts ─────────────────────────────────────────────

describe("T69.16 — auditSummary counts", () => {
  it("totalAuditRows is 6 (one per P61 source)", () => {
    const trail = makeAuditTrail();
    expect(trail.auditSummary.totalAuditRows).toBe(6);
  });

  it("includedEligibleCount is 2 (Quote + Regime)", () => {
    const trail = makeAuditTrail();
    expect(trail.auditSummary.includedEligibleCount).toBe(2);
  });

  it("includedLowConfidenceCount is 1 (MonthlyRevenue)", () => {
    const trail = makeAuditTrail();
    expect(trail.auditSummary.includedLowConfidenceCount).toBe(1);
  });

  it("excludedBlockedCount is 2 (FinancialReport + Chip)", () => {
    const trail = makeAuditTrail();
    expect(trail.auditSummary.excludedBlockedCount).toBe(2);
  });

  it("auditOnlyReferenceCount is 1 (NewsEvent)", () => {
    const trail = makeAuditTrail();
    expect(trail.auditSummary.auditOnlyReferenceCount).toBe(1);
  });
});

// ─── T69.17: Serialization / immutability ────────────────────────────────────

describe("T69.17 — Serialization / immutability", () => {
  it("trail is JSON serializable and roundtrip preserves version", () => {
    const trail = makeAuditTrail();
    const json = JSON.parse(JSON.stringify(trail)) as SimulationInputBundleAuditTrail;
    expect(json.version).toBe(SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_VERSION);
  });

  it("two calls with fixedGeneratedAt produce identical JSON", () => {
    const t1 = makeAuditTrail(FIXED_TS);
    const t2 = makeAuditTrail(FIXED_TS);
    expect(JSON.stringify(t1)).toBe(JSON.stringify(t2));
  });

  it("trail top-level is frozen", () => {
    const trail = makeAuditTrail();
    expect(Object.isFrozen(trail)).toBe(true);
  });

  it("input preview is not mutated after buildSimulationInputBundleAuditTrail", () => {
    const preview = makePreview();
    const originalEntryCount = preview.sourceEntries.length;
    buildSimulationInputBundleAuditTrail({ preview, fixedGeneratedAt: FIXED_TS });
    expect(preview.sourceEntries.length).toBe(originalEntryCount);
  });

  it("frozen preview input does not cause build to throw", () => {
    const frozenPreview = Object.freeze(makePreview());
    expect(() =>
      buildSimulationInputBundleAuditTrail({ preview: frozenPreview, fixedGeneratedAt: FIXED_TS }),
    ).not.toThrow();
  });
});

// ─── T69.18: Forbidden imports (source scan) ─────────────────────────────────

describe("T69.18 — Forbidden imports (source scan)", () => {
  it("source does not import @prisma/client", () => {
    expect(auditTrailSource).not.toMatch(/@prisma\/client/);
  });

  it("source does not import 'fs'", () => {
    expect(auditTrailSource).not.toMatch(/from\s+['"]fs['"]/);
  });

  it("source does not import 'path'", () => {
    expect(auditTrailSource).not.toMatch(/from\s+['"]path['"]/);
  });

  it("source does not import 'child_process'", () => {
    expect(auditTrailSource).not.toMatch(/from\s+['"]child_process['"]/)
    expect(auditTrailSource).not.toMatch(/require\(['"]child_process['"]/)
  });

  it("source does not import from src/lib/research", () => {
    expect(auditTrailSource).not.toMatch(/from\s+['"][^'"]*lib\/research/);
  });
});

// ─── T69.19: Forbidden exports / semantics (source scan) ─────────────────────

describe("T69.19 — Forbidden exports / semantics (source scan)", () => {
  it("source does not export run/execute/simulate/score/optimize/backtest/recommend", () => {
    expect(auditTrailSource).not.toMatch(
      /export\s+(function|const|class)\s+(run|execute|simulate|score|optimize|backtest|recommend)/,
    );
  });

  it("source does not reference ROI/PnL/winRate/benchmark in exported identifiers", () => {
    expect(auditTrailSource).not.toMatch(
      /export\s+(?:function|const|class|type)\s+[A-Za-z]*(?:ROI|PnL|winRate|benchmark)/,
    );
  });
});

// ─── T69.20: Forbidden fields (source scan) ───────────────────────────────────

describe("T69.20 — Forbidden fields (source scan)", () => {
  it("source does not reference targetPrice", () => {
    expect(auditTrailSource).not.toMatch(/targetPrice/);
  });

  it("source does not contain buy/sell/hold/action in field semantics", () => {
    expect(auditTrailSource).not.toMatch(/\b(buySignal|sellSignal|holdSignal|actionSignal)\b/);
  });

  it("trail response has no prediction field", () => {
    const trail = makeAuditTrail();
    expect("prediction" in trail).toBe(false);
  });

  it("trail response has no recommendation field", () => {
    const trail = makeAuditTrail();
    expect("recommendation" in trail).toBe(false);
  });

  it("trail response entersAlphaScore is exactly false", () => {
    const trail = makeAuditTrail();
    expect(trail.entersAlphaScore).toBe(false);
  });
});
