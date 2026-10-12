/**
 * P65 — Axis B Simulation Input Bundle Preview Tests
 *
 * Test suite for the P65 simulation input bundle preview builder.
 * All tests are pure — no DB, no Prisma, no network, no filesystem (except
 * source text scans which use fs.readFileSync on the P65 source file).
 *
 * 64 tests across 16 groups:
 *   Group 1:  Preview Version (3)
 *   Group 2:  generatedAt (3)
 *   Group 3:  Non-APPROVE rejection (3)
 *   Group 4:  APPROVE acceptance (3)
 *   Group 5:  Eligible — Quote (3)
 *   Group 6:  Eligible — Regime (3)
 *   Group 7:  Low-confidence — MonthlyRevenue (3)
 *   Group 8:  Blocked — FinancialReport + Chip (4)
 *   Group 9:  Audit-only — NewsEvent (2)
 *   Group 10: sourceEntries count (2)
 *   Group 11: Summary counts (6)
 *   Group 12: Governance booleans (6)
 *   Group 13: Serialization / immutability (5)
 *   Group 14: summarizePreviewSources standalone (3)
 *   Group 15: Forbidden field / source scans (10)
 *   Group 16: Boundary / regression (5)
 */

import * as fs from "fs";
import * as path from "path";

import {
  SIMULATION_INPUT_BUNDLE_PREVIEW_VERSION,
  buildSimulationInputBundlePreview,
  summarizePreviewSources,
  type SimulationInputBundlePreview,
  type SimulationInputBundlePreviewSourceEntry,
} from "../p65/SimulationInputBundlePreview";

import {
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS,
  SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE,
  type SimulationInputEligibilityReviewArtifact,
  type SimulationInputEligibilityReviewEntry,
  type SimulationInputPitState,
  type SimulationInputReviewSourceName,
  type SimulationInputReviewStatus,
} from "../p62/SimulationInputEligibilityReviewContract";

import { buildSimulationInputEligibilityReviewArtifact } from "../p63/SimulationInputEligibilityReviewBuilder";

import {
  evaluateSimulationInputEligibilityReviewArtifactForBundlePreview,
} from "../p64/SimulationInputEligibilityReviewConsumerGate";

// ─── Aliases ─────────────────────────────────────────────────────────────────

const buildPreview = buildSimulationInputBundlePreview;
const evaluate = evaluateSimulationInputEligibilityReviewArtifactForBundlePreview;
const TS = "2026-01-01T00:00:00.000Z";
const PREVIEW_VERSION = SIMULATION_INPUT_BUNDLE_PREVIEW_VERSION;

// ─── Source Text ──────────────────────────────────────────────────────────────

const GATE_SOURCE_FILE = path.resolve(
  __dirname,
  "../p65/SimulationInputBundlePreview.ts",
);
const previewSource = fs.readFileSync(GATE_SOURCE_FILE, "utf-8");

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

/** Full P61 six-source artifact — produces APPROVE gate decision. */
function makeP61Artifact(fixedGeneratedAt = TS): SimulationInputEligibilityReviewArtifact {
  return makeArtifact(makeP61Entries(), fixedGeneratedAt);
}

/** APPROVE gate result from the standard P61 artifact. */
function makeApproveGateResult(fixedEvaluatedAt = TS) {
  return evaluate(makeP61Artifact(), fixedEvaluatedAt);
}

/** Artifact with tampered governance for BLOCKED_BY_GOVERNANCE_VIOLATION. */
function makeBadGovernanceArtifact(): SimulationInputEligibilityReviewArtifact {
  const base = makeP61Artifact();
  return {
    ...base,
    governance: { ...base.governance, entersAlphaScore: true as unknown as false },
  } as unknown as SimulationInputEligibilityReviewArtifact;
}

/** Artifact with all sources BLOCKED → BLOCKED_BY_NO_ELIGIBLE_SOURCES. */
function makeAllBlockedArtifact(): SimulationInputEligibilityReviewArtifact {
  return makeArtifact([
    makeEntry("Quote", "BLOCKED", "BLOCKED_PENDING_PIT_METADATA"),
    makeEntry("Regime", "BLOCKED", "BLOCKED_PENDING_PIT_METADATA"),
  ]);
}

/** Artifact with only low-confidence sources → REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY. */
function makeOnlyLowConfidenceArtifact(): SimulationInputEligibilityReviewArtifact {
  return makeArtifact([
    makeEntry(
      "MonthlyRevenue",
      "ELIGIBLE_WITH_LOW_CONFIDENCE_WARNING",
      "LOW_CONFIDENCE_PIT_INFERRED_IF_RELEASE_DATE_MISSING",
    ),
  ]);
}

function getSourceEntry(
  preview: SimulationInputBundlePreview,
  sourceName: string,
): SimulationInputBundlePreviewSourceEntry | undefined {
  return (preview.sourceEntries as readonly SimulationInputBundlePreviewSourceEntry[]).find(
    (e) => e.sourceName === sourceName,
  );
}

// ─── Group 1: Preview Version ─────────────────────────────────────────────────

describe("P65 — Preview Version", () => {
  it("PREVIEW_VERSION constant has exact expected value", () => {
    expect(PREVIEW_VERSION).toBe("p65-axis-b-simulation-input-bundle-preview-v0");
  });

  it("result.version equals PREVIEW_VERSION constant", () => {
    const result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
    expect(result.version).toBe(PREVIEW_VERSION);
  });

  it("version is typeof string", () => {
    const result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
    expect(typeof result.version).toBe("string");
  });
});

// ─── Group 2: generatedAt ─────────────────────────────────────────────────────

describe("P65 — generatedAt", () => {
  it("uses fixedGeneratedAt when provided", () => {
    const result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
    expect(result.generatedAt).toBe(TS);
  });

  it("default generatedAt is a non-empty ISO string when not provided", () => {
    const before = new Date().toISOString();
    const result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
    });
    const after = new Date().toISOString();
    expect(result.generatedAt.length).toBeGreaterThan(0);
    expect(result.generatedAt >= before).toBe(true);
    expect(result.generatedAt <= after).toBe(true);
  });

  it("two calls with same fixedGeneratedAt produce same generatedAt", () => {
    const params = {
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    };
    const r1 = buildPreview(params);
    const r2 = buildPreview(params);
    expect(r1.generatedAt).toBe(r2.generatedAt);
  });
});

// ─── Group 3: Non-APPROVE rejection ──────────────────────────────────────────

describe("P65 — Non-APPROVE rejection", () => {
  it("throws Error for BLOCKED_BY_GOVERNANCE_VIOLATION gate decision", () => {
    const gateResult = evaluate(makeBadGovernanceArtifact(), TS);
    expect(gateResult.decision).toBe("BLOCKED_BY_GOVERNANCE_VIOLATION");
    expect(() =>
      buildPreview({ artifact: makeBadGovernanceArtifact(), gateResult, fixedGeneratedAt: TS }),
    ).toThrow("APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW");
  });

  it("throws Error for BLOCKED_BY_NO_ELIGIBLE_SOURCES gate decision", () => {
    const artifact = makeAllBlockedArtifact();
    const gateResult = evaluate(artifact, TS);
    expect(gateResult.decision).toBe("BLOCKED_BY_NO_ELIGIBLE_SOURCES");
    expect(() =>
      buildPreview({ artifact, gateResult, fixedGeneratedAt: TS }),
    ).toThrow("APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW");
  });

  it("throws Error for REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY gate decision", () => {
    const artifact = makeOnlyLowConfidenceArtifact();
    const gateResult = evaluate(artifact, TS);
    expect(gateResult.decision).toBe("REVIEW_REQUIRED_LOW_CONFIDENCE_ONLY");
    expect(() =>
      buildPreview({ artifact, gateResult, fixedGeneratedAt: TS }),
    ).toThrow("APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW");
  });
});

// ─── Group 4: APPROVE acceptance ─────────────────────────────────────────────

describe("P65 — APPROVE acceptance", () => {
  it("does not throw for APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW decision", () => {
    const gateResult = makeApproveGateResult();
    expect(gateResult.decision).toBe("APPROVE_SIMULATION_INPUT_BUNDLE_PREVIEW");
    expect(() =>
      buildPreview({ artifact: makeP61Artifact(), gateResult, fixedGeneratedAt: TS }),
    ).not.toThrow();
  });

  it("result.previewOnly is true", () => {
    const result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
    expect(result.previewOnly).toBe(true);
  });

  it("buildPreview returns synchronously (no promise)", () => {
    const result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe("object");
  });
});

// ─── Group 5: Eligible — Quote ───────────────────────────────────────────────

describe("P65 — Eligible — Quote", () => {
  let result: SimulationInputBundlePreview;
  beforeAll(() => {
    result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
  });

  it("Quote appears in sourceEntries", () => {
    const entry = getSourceEntry(result, "Quote");
    expect(entry).toBeDefined();
  });

  it("Quote previewStatus is INCLUDED_ELIGIBLE", () => {
    const entry = getSourceEntry(result, "Quote");
    expect(entry?.previewStatus).toBe("INCLUDED_ELIGIBLE");
  });

  it("Quote includeInPreview is true", () => {
    const entry = getSourceEntry(result, "Quote");
    expect(entry?.includeInPreview).toBe(true);
  });
});

// ─── Group 6: Eligible — Regime ──────────────────────────────────────────────

describe("P65 — Eligible — Regime", () => {
  let result: SimulationInputBundlePreview;
  beforeAll(() => {
    result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
  });

  it("Regime appears in sourceEntries", () => {
    const entry = getSourceEntry(result, "Regime");
    expect(entry).toBeDefined();
  });

  it("Regime previewStatus is INCLUDED_ELIGIBLE", () => {
    const entry = getSourceEntry(result, "Regime");
    expect(entry?.previewStatus).toBe("INCLUDED_ELIGIBLE");
  });

  it("Regime includeInPreview is true", () => {
    const entry = getSourceEntry(result, "Regime");
    expect(entry?.includeInPreview).toBe(true);
  });
});

// ─── Group 7: Low-confidence — MonthlyRevenue ─────────────────────────────────

describe("P65 — Low-confidence — MonthlyRevenue", () => {
  let result: SimulationInputBundlePreview;
  beforeAll(() => {
    result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
  });

  it("MonthlyRevenue appears in sourceEntries", () => {
    const entry = getSourceEntry(result, "MonthlyRevenue");
    expect(entry).toBeDefined();
  });

  it("MonthlyRevenue previewStatus is INCLUDED_LOW_CONFIDENCE", () => {
    const entry = getSourceEntry(result, "MonthlyRevenue");
    expect(entry?.previewStatus).toBe("INCLUDED_LOW_CONFIDENCE");
  });

  it("MonthlyRevenue warning is a non-empty string", () => {
    const entry = getSourceEntry(result, "MonthlyRevenue");
    expect(typeof entry?.warning).toBe("string");
    expect((entry?.warning ?? "").length).toBeGreaterThan(0);
  });
});

// ─── Group 8: Blocked — FinancialReport + Chip ────────────────────────────────

describe("P65 — Blocked — FinancialReport + Chip", () => {
  let result: SimulationInputBundlePreview;
  beforeAll(() => {
    result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
  });

  it("FinancialReport previewStatus is EXCLUDED_BLOCKED", () => {
    const entry = getSourceEntry(result, "FinancialReport");
    expect(entry?.previewStatus).toBe("EXCLUDED_BLOCKED");
  });

  it("FinancialReport includeInPreview is false", () => {
    const entry = getSourceEntry(result, "FinancialReport");
    expect(entry?.includeInPreview).toBe(false);
  });

  it("Chip previewStatus is EXCLUDED_BLOCKED", () => {
    const entry = getSourceEntry(result, "Chip");
    expect(entry?.previewStatus).toBe("EXCLUDED_BLOCKED");
  });

  it("Chip exclusionReason is a non-empty string", () => {
    const entry = getSourceEntry(result, "Chip");
    expect(typeof entry?.exclusionReason).toBe("string");
    expect((entry?.exclusionReason ?? "").length).toBeGreaterThan(0);
  });
});

// ─── Group 9: Audit-only — NewsEvent ─────────────────────────────────────────

describe("P65 — Audit-only — NewsEvent", () => {
  let result: SimulationInputBundlePreview;
  beforeAll(() => {
    result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
  });

  it("NewsEvent previewStatus is AUDIT_ONLY_REFERENCE", () => {
    const entry = getSourceEntry(result, "NewsEvent");
    expect(entry?.previewStatus).toBe("AUDIT_ONLY_REFERENCE");
  });

  it("NewsEvent includeInPreview is false", () => {
    const entry = getSourceEntry(result, "NewsEvent");
    expect(entry?.includeInPreview).toBe(false);
  });
});

// ─── Group 10: sourceEntries count ───────────────────────────────────────────

describe("P65 — sourceEntries count", () => {
  let result: SimulationInputBundlePreview;
  beforeAll(() => {
    result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
  });

  it("P61 six-source matrix produces 6 source entries", () => {
    expect(result.sourceEntries.length).toBe(6);
  });

  it("all 6 P61 source names appear in entries", () => {
    const names = (result.sourceEntries as readonly SimulationInputBundlePreviewSourceEntry[]).map(
      (e) => e.sourceName,
    );
    expect(names).toContain("Quote");
    expect(names).toContain("Regime");
    expect(names).toContain("MonthlyRevenue");
    expect(names).toContain("FinancialReport");
    expect(names).toContain("Chip");
    expect(names).toContain("NewsEvent");
  });
});

// ─── Group 11: Summary counts ─────────────────────────────────────────────────

describe("P65 — Summary counts", () => {
  let result: SimulationInputBundlePreview;
  beforeAll(() => {
    result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
  });

  it("summary.totalSources is 6", () => {
    expect(result.summary.totalSources).toBe(6);
  });

  it("summary.includedEligibleCount is 2 (Quote + Regime)", () => {
    expect(result.summary.includedEligibleCount).toBe(2);
  });

  it("summary.includedLowConfidenceCount is 1 (MonthlyRevenue)", () => {
    expect(result.summary.includedLowConfidenceCount).toBe(1);
  });

  it("summary.excludedBlockedCount is 2 (FinancialReport + Chip)", () => {
    expect(result.summary.excludedBlockedCount).toBe(2);
  });

  it("summary.auditOnlyReferenceCount is 1 (NewsEvent)", () => {
    expect(result.summary.auditOnlyReferenceCount).toBe(1);
  });

  it("summary counts sum to totalSources", () => {
    const { totalSources, includedEligibleCount, includedLowConfidenceCount,
      excludedBlockedCount, auditOnlyReferenceCount } = result.summary;
    expect(
      includedEligibleCount + includedLowConfidenceCount +
      excludedBlockedCount + auditOnlyReferenceCount,
    ).toBe(totalSources);
  });
});

// ─── Group 12: Governance booleans ───────────────────────────────────────────

describe("P65 — Governance booleans", () => {
  let result: SimulationInputBundlePreview;
  beforeAll(() => {
    result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
  });

  it("result.previewOnly is true", () => {
    expect(result.previewOnly).toBe(true);
  });

  it("result.paperOnly is true", () => {
    expect(result.paperOnly).toBe(true);
  });

  it("result.noExecution is true", () => {
    expect(result.noExecution).toBe(true);
  });

  it("result.noActualMetrics is true", () => {
    expect(result.noActualMetrics).toBe(true);
  });

  it("result.entersAlphaScore is false", () => {
    expect(result.entersAlphaScore).toBe(false);
  });

  it("result.notInvestmentAdvice is true", () => {
    expect(result.notInvestmentAdvice).toBe(true);
  });
});

// ─── Group 13: Serialization / immutability ───────────────────────────────────

describe("P65 — Serialization / immutability", () => {
  let result: SimulationInputBundlePreview;
  beforeAll(() => {
    result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
  });

  it("JSON.stringify does not throw", () => {
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("JSON.parse(JSON.stringify(result)) equals result structurally", () => {
    const parsed = JSON.parse(JSON.stringify(result));
    expect(parsed.version).toBe(result.version);
    expect(parsed.generatedAt).toBe(result.generatedAt);
    expect(parsed.previewOnly).toBe(true);
    expect(parsed.summary.totalSources).toBe(result.summary.totalSources);
  });

  it("Object.isFrozen(result) is true", () => {
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("two calls with same params produce deep-equal generatedAt and version", () => {
    const params = {
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    };
    const r1 = buildPreview(params);
    const r2 = buildPreview(params);
    expect(r1.generatedAt).toBe(r2.generatedAt);
    expect(r1.version).toBe(r2.version);
    expect(r1.summary.totalSources).toBe(r2.summary.totalSources);
  });

  it("result.sourceEntries is an array", () => {
    expect(Array.isArray(result.sourceEntries)).toBe(true);
  });
});

// ─── Group 14: summarizePreviewSources standalone ─────────────────────────────

describe("P65 — summarizePreviewSources standalone", () => {
  it("empty array produces all-zero summary", () => {
    const summary = summarizePreviewSources([]);
    expect(summary.totalSources).toBe(0);
    expect(summary.includedEligibleCount).toBe(0);
    expect(summary.includedLowConfidenceCount).toBe(0);
    expect(summary.excludedBlockedCount).toBe(0);
    expect(summary.auditOnlyReferenceCount).toBe(0);
  });

  it("single INCLUDED_ELIGIBLE entry produces includedEligibleCount=1", () => {
    const summary = summarizePreviewSources([
      { sourceName: "Quote", previewStatus: "INCLUDED_ELIGIBLE", includeInPreview: true },
    ]);
    expect(summary.includedEligibleCount).toBe(1);
    expect(summary.totalSources).toBe(1);
  });

  it("mixed entries produce correct counts for each status type", () => {
    const sources: SimulationInputBundlePreviewSourceEntry[] = [
      { sourceName: "Quote", previewStatus: "INCLUDED_ELIGIBLE", includeInPreview: true },
      { sourceName: "Regime", previewStatus: "INCLUDED_ELIGIBLE", includeInPreview: true },
      { sourceName: "MonthlyRevenue", previewStatus: "INCLUDED_LOW_CONFIDENCE", includeInPreview: true, warning: "test" },
      { sourceName: "FinancialReport", previewStatus: "EXCLUDED_BLOCKED", includeInPreview: false, exclusionReason: "blocked" },
      { sourceName: "Chip", previewStatus: "EXCLUDED_BLOCKED", includeInPreview: false, exclusionReason: "blocked" },
      { sourceName: "NewsEvent", previewStatus: "AUDIT_ONLY_REFERENCE", includeInPreview: false },
    ];
    const summary = summarizePreviewSources(sources);
    expect(summary.totalSources).toBe(6);
    expect(summary.includedEligibleCount).toBe(2);
    expect(summary.includedLowConfidenceCount).toBe(1);
    expect(summary.excludedBlockedCount).toBe(2);
    expect(summary.auditOnlyReferenceCount).toBe(1);
  });
});

// ─── Group 15: Forbidden field / source scans ─────────────────────────────────

describe("P65 — Forbidden field / source scans", () => {
  it("P65 source does not import from prisma", () => {
    expect(previewSource).not.toMatch(/@prisma|from ['"]@prisma|prisma\/client/);
  });

  it("P65 source does not import fs or path at runtime", () => {
    // Must not have runtime fs/path imports (only tests may use them)
    expect(previewSource).not.toMatch(/^import \* as fs|^import \* as path|require\(['"]fs['"]\)|require\(['"]path['"]\)/m);
  });

  it("P65 source does not import child_process at runtime", () => {
    expect(previewSource).not.toMatch(
      /require\(['"]child_process['"]\)|from ['"]child_process['"]/,
    );
  });

  it("P65 source does not import from P53", () => {
    expect(previewSource).not.toContain('from "../p53/');
  });

  it("P65 source does not import from P54", () => {
    expect(previewSource).not.toContain('from "../p54/');
  });

  it("P65 source does not import from Axis A modules (p57/p58/p59)", () => {
    expect(previewSource).not.toMatch(/from ['"]\.\.\/p5[789]\//);
  });

  it("P65 source does not import P63 builder (only types from P62 and P64)", () => {
    expect(previewSource).not.toContain('from "../p63/');
  });

  it("P65 source does not contain network import (axios, fetch, http, https)", () => {
    expect(previewSource).not.toMatch(/from ['"]axios['"]|from ['"]node-fetch['"]|require\(['"]https?['"]\)/);
  });

  it("output top-level keys do not include any SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS", () => {
    const result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
    const keys = Object.keys(result);
    const forbidden = SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS as readonly string[];
    for (const forbiddenKey of forbidden) {
      expect(keys).not.toContain(forbiddenKey);
    }
  });

  it("sourceEntry keys do not include any SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS", () => {
    const result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
    const forbidden = SIMULATION_INPUT_ELIGIBILITY_REVIEW_FORBIDDEN_FIELDS as readonly string[];
    for (const entry of result.sourceEntries) {
      const entryKeys = Object.keys(entry);
      for (const forbiddenKey of forbidden) {
        expect(entryKeys).not.toContain(forbiddenKey);
      }
    }
  });
});

// ─── Group 16: Boundary / regression ─────────────────────────────────────────

describe("P65 — Boundary / regression", () => {
  it("result has exactly the expected top-level keys", () => {
    const result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
    const keys = Object.keys(result).sort();
    expect(keys).toEqual([
      "entersAlphaScore",
      "generatedAt",
      "noActualMetrics",
      "noExecution",
      "notInvestmentAdvice",
      "paperOnly",
      "previewOnly",
      "sourceEntries",
      "summary",
      "version",
    ]);
  });

  it("error message from non-APPROVE throw includes received decision name", () => {
    const artifact = makeAllBlockedArtifact();
    const gateResult = evaluate(artifact, TS);
    expect(() =>
      buildPreview({ artifact, gateResult, fixedGeneratedAt: TS }),
    ).toThrow("BLOCKED_BY_NO_ELIGIBLE_SOURCES");
  });

  it("INCLUDED_ELIGIBLE entries have no exclusionReason field with a value", () => {
    const result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
    const eligibleEntries = (result.sourceEntries as readonly SimulationInputBundlePreviewSourceEntry[]).filter(
      (e) => e.previewStatus === "INCLUDED_ELIGIBLE",
    );
    for (const entry of eligibleEntries) {
      expect(entry.exclusionReason).toBeUndefined();
    }
  });

  it("EXCLUDED_BLOCKED entries have no warning field with a value", () => {
    const result = buildPreview({
      artifact: makeP61Artifact(),
      gateResult: makeApproveGateResult(),
      fixedGeneratedAt: TS,
    });
    const blockedEntries = (result.sourceEntries as readonly SimulationInputBundlePreviewSourceEntry[]).filter(
      (e) => e.previewStatus === "EXCLUDED_BLOCKED",
    );
    for (const entry of blockedEntries) {
      expect(entry.warning).toBeUndefined();
    }
  });

  it("GOVERNANCE constant from P62 is referenced for governance flags consistency", () => {
    // P65 builder uses governance flags from P62 (via P63 artifact) to produce the gateResult.
    // Verify that the P62 governance object has the expected shape used in P65.
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.paperOnly).toBe(true);
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.noSimulationExecution).toBe(true);
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.entersAlphaScore).toBe(false);
    expect(SIMULATION_INPUT_ELIGIBILITY_REVIEW_GOVERNANCE.notInvestmentAdvice).toBe(true);
  });
});
