/**
 * P72 — Cross-Axis Review Display Container Tests
 *
 * Tests for CrossAxisReviewDisplayContainer.ts (P72).
 * Covers: version, governance, generatedAt, validation, build, sections,
 *         containerSummary, determinism, mutation-safety, frozen input support,
 *         and source-text governance scans.
 *
 * Test groups: T72.1 – T72.24 (79 tests total)
 *
 * GOVERNANCE: reviewOnly=true, noInvestmentAdvice=true, noForecast=true,
 * noRecommendation=true, previewOnly=true, paperOnly=true, noExecution=true,
 * noActualMetrics=true, entersAlphaScore=false, notInvestmentAdvice=true.
 */

import * as fs from "fs";
import * as path from "path";
import type { ResearchSnapshotReviewFormatterResponse } from "@/lib/research/snapshot/v1/ResearchSnapshotReviewResponseFormatter";
import type { SimulationInputBundleAuditTrailFormatterResponse } from "@/lib/onlineValidation/p70/SimulationInputBundleAuditTrailFormatter";
import { RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_VERSION } from "@/lib/research/snapshot/v1/ResearchSnapshotReviewResponseFormatter";
import { SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_VERSION } from "@/lib/onlineValidation/p70/SimulationInputBundleAuditTrailFormatter";
import {
  CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_VERSION,
  CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE,
  buildCrossAxisReviewDisplayContainer,
  validateResearchResponseForContainer,
  validateSimulationAuditResponseForContainer,
} from "@/lib/research/composition/CrossAxisReviewDisplayContainer";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIXED_AT = "2026-05-26T00:00:00.000Z";
const FIXED_AT_2 = "2026-01-01T12:00:00.000Z";

function makeResearchResponse(
  overrides: Record<string, unknown> = {},
): ResearchSnapshotReviewFormatterResponse {
  return {
    version: RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_VERSION,
    generatedAt: FIXED_AT,
    reviewOnly: true,
    noInvestmentAdvice: true,
    noForecast: true,
    noRecommendation: true,
    entersAlphaScore: false,
    boundaryVersion: "test-boundary-v1",
    artifactVersion: "test-artifact-v1",
    displayRows: [
      { sourceName: "ResearchSourceA", rowType: "INCLUDED", includeInDisplay: true },
      {
        sourceName: "ResearchSourceB",
        rowType: "EXCLUDED",
        includeInDisplay: false,
        displayNote: "excluded from display",
      },
    ],
    formatterSummary: {
      totalDisplayRows: 2,
      includedEligibleCount: 1,
      includedLowConfidenceCount: 0,
      excludedCount: 1,
    },
    ...overrides,
  } as ResearchSnapshotReviewFormatterResponse;
}

function makeSimulationAuditResponse(
  overrides: Record<string, unknown> = {},
): SimulationInputBundleAuditTrailFormatterResponse {
  return {
    version: SIMULATION_INPUT_BUNDLE_AUDIT_TRAIL_FORMATTER_VERSION,
    generatedAt: FIXED_AT,
    previewOnly: true,
    paperOnly: true,
    noExecution: true,
    noActualMetrics: true,
    entersAlphaScore: false,
    notInvestmentAdvice: true,
    auditTrailVersion: "test-audit-v1",
    displayRows: [
      {
        sourceName: "SimSourceA",
        auditRowType: "INCLUDED_ELIGIBLE",
        previewStatus: "PREVIEW_ELIGIBLE",
        includeInAudit: true,
        includeInPreview: true,
      },
      {
        sourceName: "SimSourceB",
        auditRowType: "EXCLUDED_BLOCKED",
        previewStatus: "EXCLUDED_BLOCKED",
        includeInAudit: false,
        includeInPreview: false,
        displayNote: "blocked from preview",
      },
    ],
    formatterSummary: {
      totalDisplayRows: 2,
      includedEligibleCount: 1,
      includedLowConfidenceCount: 0,
      excludedBlockedCount: 1,
      auditOnlyReferenceCount: 0,
    },
    ...overrides,
  } as SimulationInputBundleAuditTrailFormatterResponse;
}

// ─── Source text (for governance scan tests) ──────────────────────────────────

const SOURCE_PATH = path.resolve(
  __dirname,
  "../composition/CrossAxisReviewDisplayContainer.ts",
);
let sourceText = "";

beforeAll(() => {
  sourceText = fs.readFileSync(SOURCE_PATH, "utf-8");
});

// ─── T72.1 Version ────────────────────────────────────────────────────────────

describe("T72.1 Version", () => {
  it("T72.1.1 VERSION constant equals expected string", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_VERSION).toBe(
      "p72-cross-axis-review-display-container-v0",
    );
  });

  it("T72.1.2 VERSION contains p72 prefix", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_VERSION).toMatch(/^p72-/);
  });

  it("T72.1.3 container response version field matches VERSION constant", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.version).toBe(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_VERSION);
  });
});

// ─── T72.2 Governance constants ───────────────────────────────────────────────

describe("T72.2 Governance constants", () => {
  it("T72.2.1 reviewOnly === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE.reviewOnly).toBe(true);
  });

  it("T72.2.2 noInvestmentAdvice === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE.noInvestmentAdvice).toBe(true);
  });

  it("T72.2.3 noForecast === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE.noForecast).toBe(true);
  });

  it("T72.2.4 noRecommendation === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE.noRecommendation).toBe(true);
  });

  it("T72.2.5 previewOnly === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE.previewOnly).toBe(true);
  });

  it("T72.2.6 paperOnly === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE.paperOnly).toBe(true);
  });

  it("T72.2.7 noExecution === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE.noExecution).toBe(true);
  });

  it("T72.2.8 noActualMetrics === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE.noActualMetrics).toBe(true);
  });

  it("T72.2.9 entersAlphaScore === false", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  it("T72.2.10 notInvestmentAdvice === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE.notInvestmentAdvice).toBe(true);
  });

  it("T72.2.11 governance object is frozen", () => {
    expect(Object.isFrozen(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_GOVERNANCE)).toBe(true);
  });
});

// ─── T72.3 generatedAt ────────────────────────────────────────────────────────

describe("T72.3 generatedAt", () => {
  it("T72.3.1 uses fixedGeneratedAt when provided", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.generatedAt).toBe(FIXED_AT);
  });

  it("T72.3.2 uses a different fixedGeneratedAt correctly", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT_2,
    });
    expect(result.generatedAt).toBe(FIXED_AT_2);
  });

  it("T72.3.3 generatedAt is a non-empty string when fixedGeneratedAt is omitted", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
    });
    expect(typeof result.generatedAt).toBe("string");
    expect(result.generatedAt.length).toBeGreaterThan(0);
  });
});

// ─── T72.4 accepts valid inputs ───────────────────────────────────────────────

describe("T72.4 accepts valid inputs", () => {
  it("T72.4.1 builds without error with valid P68 + P70 responses", () => {
    expect(() =>
      buildCrossAxisReviewDisplayContainer({
        researchResponse: makeResearchResponse(),
        simulationAuditResponse: makeSimulationAuditResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T72.4.2 returns a non-null object", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("T72.4.3 version field in output is the P72 version string", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.version).toBe("p72-cross-axis-review-display-container-v0");
  });
});

// ─── T72.5 validateResearchResponseForContainer — valid ───────────────────────

describe("T72.5 validateResearchResponseForContainer accepts valid Axis A", () => {
  it("T72.5.1 returns { valid: true } for a fully compliant Axis A response", () => {
    const result = validateResearchResponseForContainer(makeResearchResponse());
    expect(result.valid).toBe(true);
  });

  it("T72.5.2 valid field is strictly true (not merely truthy)", () => {
    const result = validateResearchResponseForContainer(makeResearchResponse());
    expect(result.valid).toStrictEqual(true);
  });
});

// ─── T72.6 validateResearchResponseForContainer — rejects bad flags ───────────

describe("T72.6 validateResearchResponseForContainer rejects each bad Axis A flag", () => {
  it("T72.6.1 rejects when reviewOnly is not true", () => {
    const bad = makeResearchResponse({ reviewOnly: false });
    const result = validateResearchResponseForContainer(bad);
    expect(result.valid).toBe(false);
  });

  it("T72.6.2 rejects when noInvestmentAdvice is not true", () => {
    const bad = makeResearchResponse({ noInvestmentAdvice: false });
    const result = validateResearchResponseForContainer(bad);
    expect(result.valid).toBe(false);
  });

  it("T72.6.3 rejects when noForecast is not true", () => {
    const bad = makeResearchResponse({ noForecast: false });
    const result = validateResearchResponseForContainer(bad);
    expect(result.valid).toBe(false);
  });

  it("T72.6.4 rejects when noRecommendation is not true", () => {
    const bad = makeResearchResponse({ noRecommendation: false });
    const result = validateResearchResponseForContainer(bad);
    expect(result.valid).toBe(false);
  });

  it("T72.6.5 rejects when entersAlphaScore is not false", () => {
    const bad = makeResearchResponse({ entersAlphaScore: true });
    const result = validateResearchResponseForContainer(bad);
    expect(result.valid).toBe(false);
  });
});

// ─── T72.7 validateSimulationAuditResponseForContainer — valid ────────────────

describe("T72.7 validateSimulationAuditResponseForContainer accepts valid Axis B", () => {
  it("T72.7.1 returns { valid: true } for a fully compliant Axis B response", () => {
    const result = validateSimulationAuditResponseForContainer(makeSimulationAuditResponse());
    expect(result.valid).toBe(true);
  });

  it("T72.7.2 valid field is strictly true (not merely truthy)", () => {
    const result = validateSimulationAuditResponseForContainer(makeSimulationAuditResponse());
    expect(result.valid).toStrictEqual(true);
  });
});

// ─── T72.8 validateSimulationAuditResponseForContainer — rejects bad flags ────

describe("T72.8 validateSimulationAuditResponseForContainer rejects each bad Axis B flag", () => {
  it("T72.8.1 rejects when previewOnly is not true", () => {
    const bad = makeSimulationAuditResponse({ previewOnly: false });
    const result = validateSimulationAuditResponseForContainer(bad);
    expect(result.valid).toBe(false);
  });

  it("T72.8.2 rejects when paperOnly is not true", () => {
    const bad = makeSimulationAuditResponse({ paperOnly: false });
    const result = validateSimulationAuditResponseForContainer(bad);
    expect(result.valid).toBe(false);
  });

  it("T72.8.3 rejects when noExecution is not true", () => {
    const bad = makeSimulationAuditResponse({ noExecution: false });
    const result = validateSimulationAuditResponseForContainer(bad);
    expect(result.valid).toBe(false);
  });

  it("T72.8.4 rejects when noActualMetrics is not true", () => {
    const bad = makeSimulationAuditResponse({ noActualMetrics: false });
    const result = validateSimulationAuditResponseForContainer(bad);
    expect(result.valid).toBe(false);
  });

  it("T72.8.5 rejects when entersAlphaScore is not false", () => {
    const bad = makeSimulationAuditResponse({ entersAlphaScore: true });
    const result = validateSimulationAuditResponseForContainer(bad);
    expect(result.valid).toBe(false);
  });

  it("T72.8.6 rejects when notInvestmentAdvice is not true", () => {
    const bad = makeSimulationAuditResponse({ notInvestmentAdvice: false });
    const result = validateSimulationAuditResponseForContainer(bad);
    expect(result.valid).toBe(false);
  });
});

// ─── T72.9 build throws on Axis A violation ───────────────────────────────────

describe("T72.9 build throws on Axis A governance violation", () => {
  it("T72.9.1 throws when reviewOnly is wrong", () => {
    expect(() =>
      buildCrossAxisReviewDisplayContainer({
        researchResponse: makeResearchResponse({ reviewOnly: false }),
        simulationAuditResponse: makeSimulationAuditResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow();
  });

  it("T72.9.2 throws when noInvestmentAdvice is wrong", () => {
    expect(() =>
      buildCrossAxisReviewDisplayContainer({
        researchResponse: makeResearchResponse({ noInvestmentAdvice: false }),
        simulationAuditResponse: makeSimulationAuditResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow();
  });

  it("T72.9.3 error message references Axis A", () => {
    expect(() =>
      buildCrossAxisReviewDisplayContainer({
        researchResponse: makeResearchResponse({ noForecast: false }),
        simulationAuditResponse: makeSimulationAuditResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow(/Axis A/);
  });
});

// ─── T72.10 build throws on Axis B violation ──────────────────────────────────

describe("T72.10 build throws on Axis B governance violation", () => {
  it("T72.10.1 throws when previewOnly is wrong", () => {
    expect(() =>
      buildCrossAxisReviewDisplayContainer({
        researchResponse: makeResearchResponse(),
        simulationAuditResponse: makeSimulationAuditResponse({ previewOnly: false }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow();
  });

  it("T72.10.2 throws when paperOnly is wrong", () => {
    expect(() =>
      buildCrossAxisReviewDisplayContainer({
        researchResponse: makeResearchResponse(),
        simulationAuditResponse: makeSimulationAuditResponse({ paperOnly: false }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow();
  });

  it("T72.10.3 error message references Axis B", () => {
    expect(() =>
      buildCrossAxisReviewDisplayContainer({
        researchResponse: makeResearchResponse(),
        simulationAuditResponse: makeSimulationAuditResponse({ noExecution: false }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow(/Axis B/);
  });
});

// ─── T72.11 researchSection displayRows preserved ─────────────────────────────

describe("T72.11 researchSection displayRows preserved unchanged", () => {
  const research = makeResearchResponse();
  let result: ReturnType<typeof buildCrossAxisReviewDisplayContainer>;

  beforeAll(() => {
    result = buildCrossAxisReviewDisplayContainer({
      researchResponse: research,
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
  });

  it("T72.11.1 researchSection.displayRows is the same reference as input", () => {
    expect(result.researchSection.displayRows).toBe(research.displayRows);
  });

  it("T72.11.2 first row sourceName is preserved", () => {
    expect(
      (result.researchSection.displayRows[0] as { sourceName: string }).sourceName,
    ).toBe("ResearchSourceA");
  });

  it("T72.11.3 first row rowType is preserved", () => {
    expect(
      (result.researchSection.displayRows[0] as { rowType: string }).rowType,
    ).toBe("INCLUDED");
  });

  it("T72.11.4 displayRows length is preserved", () => {
    expect(result.researchSection.displayRows.length).toBe(2);
  });
});

// ─── T72.12 simulationAuditSection displayRows preserved ─────────────────────

describe("T72.12 simulationAuditSection displayRows preserved unchanged", () => {
  const simAudit = makeSimulationAuditResponse();
  let result: ReturnType<typeof buildCrossAxisReviewDisplayContainer>;

  beforeAll(() => {
    result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: simAudit,
      fixedGeneratedAt: FIXED_AT,
    });
  });

  it("T72.12.1 simulationAuditSection.displayRows is the same reference as input", () => {
    expect(result.simulationAuditSection.displayRows).toBe(simAudit.displayRows);
  });

  it("T72.12.2 first row sourceName is preserved", () => {
    expect(
      (result.simulationAuditSection.displayRows[0] as { sourceName: string }).sourceName,
    ).toBe("SimSourceA");
  });

  it("T72.12.3 first row auditRowType is preserved", () => {
    expect(
      (result.simulationAuditSection.displayRows[0] as { auditRowType: string }).auditRowType,
    ).toBe("INCLUDED_ELIGIBLE");
  });

  it("T72.12.4 displayRows length is preserved", () => {
    expect(result.simulationAuditSection.displayRows.length).toBe(2);
  });
});

// ─── T72.13 section summaries preserved ──────────────────────────────────────

describe("T72.13 section summaries preserved unchanged", () => {
  const research = makeResearchResponse();
  const simAudit = makeSimulationAuditResponse();
  let result: ReturnType<typeof buildCrossAxisReviewDisplayContainer>;

  beforeAll(() => {
    result = buildCrossAxisReviewDisplayContainer({
      researchResponse: research,
      simulationAuditResponse: simAudit,
      fixedGeneratedAt: FIXED_AT,
    });
  });

  it("T72.13.1 researchSection.summary.totalDisplayRows matches input", () => {
    expect(
      (result.researchSection.summary as { totalDisplayRows: number }).totalDisplayRows,
    ).toBe(2);
  });

  it("T72.13.2 researchSection.summary.excludedCount matches input", () => {
    expect(
      (result.researchSection.summary as { excludedCount: number }).excludedCount,
    ).toBe(1);
  });

  it("T72.13.3 simulationAuditSection.summary.totalDisplayRows matches input", () => {
    expect(
      (result.simulationAuditSection.summary as { totalDisplayRows: number }).totalDisplayRows,
    ).toBe(2);
  });

  it("T72.13.4 simulationAuditSection.summary.excludedBlockedCount matches input", () => {
    expect(
      (result.simulationAuditSection.summary as { excludedBlockedCount: number })
        .excludedBlockedCount,
    ).toBe(1);
  });
});

// ─── T72.14 containerSummary counts ──────────────────────────────────────────

describe("T72.14 containerSummary counts", () => {
  it("T72.14.1 researchRowCount matches researchSection.displayRows.length", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.containerSummary.researchRowCount).toBe(
      result.researchSection.displayRows.length,
    );
  });

  it("T72.14.2 simulationAuditRowCount matches simulationAuditSection.displayRows.length", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.containerSummary.simulationAuditRowCount).toBe(
      result.simulationAuditSection.displayRows.length,
    );
  });

  it("T72.14.3 containerSummary has exactly researchRowCount and simulationAuditRowCount", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const keys = Object.keys(result.containerSummary);
    expect(keys).toHaveLength(2);
    expect(keys).toContain("researchRowCount");
    expect(keys).toContain("simulationAuditRowCount");
  });
});

// ─── T72.15 no merged score or verdict ───────────────────────────────────────

describe("T72.15 no merged score or combined verdict in output", () => {
  let result: ReturnType<typeof buildCrossAxisReviewDisplayContainer>;

  beforeAll(() => {
    result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
  });

  it("T72.15.1 containerSummary does not have a score field", () => {
    expect((result.containerSummary as Record<string, unknown>).score).toBeUndefined();
  });

  it("T72.15.2 container response root does not have a score field", () => {
    expect((result as Record<string, unknown>).score).toBeUndefined();
  });

  it("T72.15.3 containerSummary does not have a combinedVerdict field", () => {
    expect(
      (result.containerSummary as Record<string, unknown>).combinedVerdict,
    ).toBeUndefined();
  });
});

// ─── T72.16 JSON serializable ────────────────────────────────────────────────

describe("T72.16 output is JSON serializable", () => {
  it("T72.16.1 JSON.stringify does not throw", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("T72.16.2 round-trip preserves version field", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const parsed = JSON.parse(JSON.stringify(result)) as { version: string };
    expect(parsed.version).toBe(CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_VERSION);
  });

  it("T72.16.3 round-trip preserves generatedAt field", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const parsed = JSON.parse(JSON.stringify(result)) as { generatedAt: string };
    expect(parsed.generatedAt).toBe(FIXED_AT);
  });
});

// ─── T72.17 determinism ───────────────────────────────────────────────────────

describe("T72.17 determinism", () => {
  it("T72.17.1 two calls with the same fixedGeneratedAt produce the same generatedAt", () => {
    const r1 = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const r2 = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r1.generatedAt).toBe(r2.generatedAt);
  });

  it("T72.17.2 same research input reference produces same displayRows reference", () => {
    const research = makeResearchResponse();
    const r1 = buildCrossAxisReviewDisplayContainer({
      researchResponse: research,
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const r2 = buildCrossAxisReviewDisplayContainer({
      researchResponse: research,
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r1.researchSection.displayRows).toBe(r2.researchSection.displayRows);
  });
});

// ─── T72.18 input not mutated ─────────────────────────────────────────────────

describe("T72.18 input objects are not mutated", () => {
  it("T72.18.1 research response version is unchanged after build", () => {
    const research = makeResearchResponse();
    const originalVersion = research.version;
    buildCrossAxisReviewDisplayContainer({
      researchResponse: research,
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(research.version).toBe(originalVersion);
  });

  it("T72.18.2 simulation audit response auditTrailVersion is unchanged after build", () => {
    const simAudit = makeSimulationAuditResponse();
    const originalAuditTrailVersion = simAudit.auditTrailVersion;
    buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: simAudit,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(simAudit.auditTrailVersion).toBe(originalAuditTrailVersion);
  });
});

// ─── T72.19 frozen input supported ───────────────────────────────────────────

describe("T72.19 frozen input is accepted without error", () => {
  it("T72.19.1 frozen research response is accepted", () => {
    const frozen = Object.freeze(makeResearchResponse());
    expect(() =>
      buildCrossAxisReviewDisplayContainer({
        researchResponse: frozen,
        simulationAuditResponse: makeSimulationAuditResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T72.19.2 frozen simulation audit response is accepted", () => {
    const frozen = Object.freeze(makeSimulationAuditResponse());
    expect(() =>
      buildCrossAxisReviewDisplayContainer({
        researchResponse: makeResearchResponse(),
        simulationAuditResponse: frozen,
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });
});

// ─── T72.20 forbidden imports in source ───────────────────────────────────────

describe("T72.20 source text — forbidden imports", () => {
  it("T72.20.1 source does not import Prisma", () => {
    expect(sourceText).not.toMatch(/from\s+["']@prisma\/client["']/);
    expect(sourceText).not.toMatch(/require\(["']@prisma\/client["']\)/);
  });

  it("T72.20.2 source code does not import child_process", () => {
    // Strip doc/inline comment lines before checking (comments may document what is forbidden)
    const codeLines = sourceText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      });
    const code = codeLines.join("\n");
    expect(code).not.toMatch(/child_process/);
  });

  it("T72.20.3 source does not import fs", () => {
    expect(sourceText).not.toMatch(/from\s+["']fs["']/);
    expect(sourceText).not.toMatch(/require\(["']fs["']\)/);
  });

  it("T72.20.4 source does not import path", () => {
    expect(sourceText).not.toMatch(/from\s+["']path["']/);
    expect(sourceText).not.toMatch(/require\(["']path["']\)/);
  });

  it("T72.20.5 all import statements in source are import type (no runtime imports)", () => {
    const runtimeImportLines = sourceText
      .split("\n")
      .filter(
        (line) =>
          line.trim().startsWith("import ") &&
          !line.trim().startsWith("import type"),
      );
    expect(runtimeImportLines).toHaveLength(0);
  });
});

// ─── T72.21 forbidden export names in source ──────────────────────────────────

describe("T72.21 source text — forbidden export names", () => {
  it("T72.21.1 source does not export run, execute, or simulate", () => {
    expect(sourceText).not.toMatch(
      /export\s+(function|const)\s+(run|execute|simulate)\b/,
    );
  });

  it("T72.21.2 source does not export score, optimize, or backtest", () => {
    expect(sourceText).not.toMatch(
      /export\s+(function|const)\s+(score|optimize|backtest)\b/,
    );
  });

  it("T72.21.3 source does not export recommend", () => {
    expect(sourceText).not.toMatch(/export\s+(function|const)\s+recommend\b/);
  });
});

// ─── T72.22 forbidden field references in source ──────────────────────────────

describe("T72.22 source text — forbidden field references", () => {
  it("T72.22.1 source does not reference ROI or roi as identifiers", () => {
    // Strip comment lines before checking
    const codeLines = sourceText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      });
    const code = codeLines.join("\n");
    expect(code).not.toMatch(/\bROI\b|\broi\b/);
  });

  it("T72.22.2 source does not reference PnL or pnl as identifiers", () => {
    const codeLines = sourceText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      });
    const code = codeLines.join("\n");
    expect(code).not.toMatch(/\bPnL\b|\bpnl\b/);
  });

  it("T72.22.3 source does not reference targetPrice", () => {
    const codeLines = sourceText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      });
    const code = codeLines.join("\n");
    expect(code).not.toMatch(/\btargetPrice\b/);
  });
});

// ─── T72.23 forbidden semantics in source ─────────────────────────────────────

describe("T72.23 source text — forbidden action semantics", () => {
  it("T72.23.1 source code lines do not contain buy or sell as output keys", () => {
    const codeLines = sourceText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      });
    const code = codeLines.join("\n");
    expect(code).not.toMatch(/\bbuy\s*:/);
    expect(code).not.toMatch(/\bsell\s*:/);
  });

  it("T72.23.2 source code lines do not contain action as an output property key", () => {
    const codeLines = sourceText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      });
    const code = codeLines.join("\n");
    expect(code).not.toMatch(/\baction\s*:/);
  });
});

// ─── T72.24 governance in output ─────────────────────────────────────────────

describe("T72.24 governance fields in output", () => {
  it("T72.24.1 container response does not expose an alphaScore field", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect((result as Record<string, unknown>).alphaScore).toBeUndefined();
  });

  it("T72.24.2 section axis labels are exactly AXIS_A_RESEARCH_REVIEW and AXIS_B_SIMULATION_INPUT_AUDIT", () => {
    const result = buildCrossAxisReviewDisplayContainer({
      researchResponse: makeResearchResponse(),
      simulationAuditResponse: makeSimulationAuditResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchSection.axis).toBe("AXIS_A_RESEARCH_REVIEW");
    expect(result.simulationAuditSection.axis).toBe("AXIS_B_SIMULATION_INPUT_AUDIT");
  });
});
