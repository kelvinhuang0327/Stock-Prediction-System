/**
 * P78 — Stock Research Product Surface Static Sample Artifact
 * Test suite: 90+ tests
 *
 * Verifies:
 *   - version and governance constants
 *   - valid P77 fixture response acceptance
 *   - all 10 bad governance flags rejected
 *   - fixed/default generatedAt
 *   - block preservation (4 blocks)
 *   - artifactSummary neutral counts
 *   - no forbidden fields or semantics
 *   - no forbidden imports (source text)
 *   - JSON serialization
 *   - immutability / freezing
 *   - no endpoint / UI / fs / DB runtime behavior
 */

import fs from "fs";
import path from "path";

import {
  STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_VERSION,
  STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE,
  validateFixtureForStaticSampleArtifact,
  buildStockResearchProductSurfaceStaticSampleArtifact,
} from "../composition/StockResearchProductSurfaceStaticSampleArtifact";

import type {
  StockResearchProductSurfaceStaticSampleArtifactValidationResult,
  StockResearchProductSurfaceStaticSampleArtifactBlock,
  StockResearchProductSurfaceStaticSampleArtifactSummary,
  StockResearchProductSurfaceStaticSampleArtifactResponse,
  StockResearchProductSurfaceStaticSampleArtifactParams,
} from "../composition/StockResearchProductSurfaceStaticSampleArtifact";

import type {
  StockResearchProductSurfaceSampleReportFixtureResponse,
} from "../composition/StockResearchProductSurfaceSampleReportFixture";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_PATH = path.resolve(
  __dirname,
  "../composition/StockResearchProductSurfaceStaticSampleArtifact.ts",
);

const SOURCE_TEXT = fs.readFileSync(SOURCE_PATH, "utf-8");

function makeFixtureResponse(
  overrides: Partial<StockResearchProductSurfaceSampleReportFixtureResponse> = {},
): StockResearchProductSurfaceSampleReportFixtureResponse {
  const base: StockResearchProductSurfaceSampleReportFixtureResponse = {
    sampleVersion: "p77-stock-research-product-surface-sample-report-fixture-v0" as const,
    generatedAt: "2026-05-26T00:00:00.000Z",
    reviewOnly: true,
    noInvestmentAdvice: true,
    noForecast: true,
    noRecommendation: true,
    previewOnly: true,
    paperOnly: true,
    noExecution: true,
    noActualMetrics: true,
    entersAlphaScore: false,
    notInvestmentAdvice: true,
    sampleTitle: "Stock Research Product Surface Sample Report Fixture",
    disclaimerBlock: Object.freeze({
      disclaimerLabel: "Disclaimer",
      lines: Object.freeze([
        "This report is review-only and not investment advice.",
        "No forecast. No execution. No actual metrics.",
      ]),
    }),
    researchReviewBlock: Object.freeze({
      blockLabel: "Research Review",
      cards: Object.freeze([
        Object.freeze({ sourceName: "SourceA", label: "Source status", status: "reviewed" }),
        Object.freeze({ sourceName: "SourceB", label: "Source status", status: "excluded", note: "Low trust" }),
      ]),
      cardCount: 2,
    }),
    simulationInputAuditBlock: Object.freeze({
      blockLabel: "Simulation Input Audit",
      cards: Object.freeze([
        Object.freeze({ sourceName: "SimA", label: "Source status", status: "included" }),
      ]),
      cardCount: 1,
    }),
    summaryBlock: Object.freeze({
      researchCardCount: 2,
      simulationAuditCardCount: 1,
    }),
  };
  return { ...base, ...overrides } as StockResearchProductSurfaceSampleReportFixtureResponse;
}

function makeParams(
  overrides: Partial<StockResearchProductSurfaceSampleReportFixtureResponse> = {},
  fixedGeneratedAt?: string,
): StockResearchProductSurfaceStaticSampleArtifactParams {
  return {
    fixtureResponse: makeFixtureResponse(overrides),
    ...(fixedGeneratedAt !== undefined ? { fixedGeneratedAt } : {}),
  };
}

const FIXED_TS = "2026-05-26T12:00:00.000Z";

// ─── T78.01: version constant ─────────────────────────────────────────────────

describe("T78.01: version constant", () => {
  it("T78.01-a: version constant is exact expected value", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_VERSION).toBe(
      "p78-stock-research-product-surface-static-sample-artifact-v0",
    );
  });

  it("T78.01-b: version constant starts with p78", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_VERSION).toMatch(/^p78/);
  });

  it("T78.01-c: version constant is a string", () => {
    expect(typeof STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_VERSION).toBe("string");
  });
});

// ─── T78.02: governance constants ────────────────────────────────────────────

describe("T78.02: governance constants include all 10 flags", () => {
  it("T78.02-a: reviewOnly is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE.reviewOnly).toBe(true);
  });

  it("T78.02-b: noInvestmentAdvice is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE.noInvestmentAdvice).toBe(true);
  });

  it("T78.02-c: noForecast is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE.noForecast).toBe(true);
  });

  it("T78.02-d: noRecommendation is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE.noRecommendation).toBe(true);
  });

  it("T78.02-e: previewOnly is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE.previewOnly).toBe(true);
  });

  it("T78.02-f: paperOnly is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE.paperOnly).toBe(true);
  });

  it("T78.02-g: noExecution is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE.noExecution).toBe(true);
  });

  it("T78.02-h: noActualMetrics is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE.noActualMetrics).toBe(true);
  });

  it("T78.02-i: entersAlphaScore is false", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  it("T78.02-j: notInvestmentAdvice is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE.notInvestmentAdvice).toBe(true);
  });

  it("T78.02-k: governance object has exactly 10 keys", () => {
    expect(Object.keys(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_GOVERNANCE)).toHaveLength(10);
  });
});

// ─── T78.03: accepts valid P77 fixture response ───────────────────────────────

describe("T78.03: accepts valid P77 fixture response", () => {
  it("T78.03-a: validateFixtureForStaticSampleArtifact returns valid:true for valid input", () => {
    const result = validateFixtureForStaticSampleArtifact(makeFixtureResponse());
    expect(result.valid).toBe(true);
  });

  it("T78.03-b: buildStockResearchProductSurfaceStaticSampleArtifact does not throw for valid input", () => {
    expect(() => buildStockResearchProductSurfaceStaticSampleArtifact(makeParams())).not.toThrow();
  });

  it("T78.03-c: response artifactVersion equals version constant", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.artifactVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_VERSION);
  });
});

// ─── T78.04–T78.13: rejects each bad governance flag ─────────────────────────

describe("T78.04: rejects bad reviewOnly flag", () => {
  it("T78.04-a: validator returns valid:false when reviewOnly is not true", () => {
    const result = validateFixtureForStaticSampleArtifact(
      makeFixtureResponse({ reviewOnly: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T78.04-b: build throws when reviewOnly is not true", () => {
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact(
        makeParams({ reviewOnly: false as unknown as true }),
      ),
    ).toThrow(/reviewOnly/);
  });
});

describe("T78.05: rejects bad noInvestmentAdvice flag", () => {
  it("T78.05-a: validator returns valid:false when noInvestmentAdvice is not true", () => {
    const result = validateFixtureForStaticSampleArtifact(
      makeFixtureResponse({ noInvestmentAdvice: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T78.05-b: build throws when noInvestmentAdvice is not true", () => {
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact(
        makeParams({ noInvestmentAdvice: false as unknown as true }),
      ),
    ).toThrow(/noInvestmentAdvice/);
  });
});

describe("T78.06: rejects bad noForecast flag", () => {
  it("T78.06-a: validator returns valid:false when noForecast is not true", () => {
    const result = validateFixtureForStaticSampleArtifact(
      makeFixtureResponse({ noForecast: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T78.06-b: build throws when noForecast is not true", () => {
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact(
        makeParams({ noForecast: false as unknown as true }),
      ),
    ).toThrow(/noForecast/);
  });
});

describe("T78.07: rejects bad noRecommendation flag", () => {
  it("T78.07-a: validator returns valid:false when noRecommendation is not true", () => {
    const result = validateFixtureForStaticSampleArtifact(
      makeFixtureResponse({ noRecommendation: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T78.07-b: build throws when noRecommendation is not true", () => {
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact(
        makeParams({ noRecommendation: false as unknown as true }),
      ),
    ).toThrow(/noRecommendation/);
  });
});

describe("T78.08: rejects bad previewOnly flag", () => {
  it("T78.08-a: validator returns valid:false when previewOnly is not true", () => {
    const result = validateFixtureForStaticSampleArtifact(
      makeFixtureResponse({ previewOnly: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T78.08-b: build throws when previewOnly is not true", () => {
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact(
        makeParams({ previewOnly: false as unknown as true }),
      ),
    ).toThrow(/previewOnly/);
  });
});

describe("T78.09: rejects bad paperOnly flag", () => {
  it("T78.09-a: validator returns valid:false when paperOnly is not true", () => {
    const result = validateFixtureForStaticSampleArtifact(
      makeFixtureResponse({ paperOnly: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T78.09-b: build throws when paperOnly is not true", () => {
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact(
        makeParams({ paperOnly: false as unknown as true }),
      ),
    ).toThrow(/paperOnly/);
  });
});

describe("T78.10: rejects bad noExecution flag", () => {
  it("T78.10-a: validator returns valid:false when noExecution is not true", () => {
    const result = validateFixtureForStaticSampleArtifact(
      makeFixtureResponse({ noExecution: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T78.10-b: build throws when noExecution is not true", () => {
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact(
        makeParams({ noExecution: false as unknown as true }),
      ),
    ).toThrow(/noExecution/);
  });
});

describe("T78.11: rejects bad noActualMetrics flag", () => {
  it("T78.11-a: validator returns valid:false when noActualMetrics is not true", () => {
    const result = validateFixtureForStaticSampleArtifact(
      makeFixtureResponse({ noActualMetrics: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T78.11-b: build throws when noActualMetrics is not true", () => {
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact(
        makeParams({ noActualMetrics: false as unknown as true }),
      ),
    ).toThrow(/noActualMetrics/);
  });
});

describe("T78.12: rejects bad entersAlphaScore flag", () => {
  it("T78.12-a: validator returns valid:false when entersAlphaScore is not false", () => {
    const result = validateFixtureForStaticSampleArtifact(
      makeFixtureResponse({ entersAlphaScore: true as unknown as false }),
    );
    expect(result.valid).toBe(false);
  });

  it("T78.12-b: build throws when entersAlphaScore is not false", () => {
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact(
        makeParams({ entersAlphaScore: true as unknown as false }),
      ),
    ).toThrow(/entersAlphaScore/);
  });
});

describe("T78.13: rejects bad notInvestmentAdvice flag", () => {
  it("T78.13-a: validator returns valid:false when notInvestmentAdvice is not true", () => {
    const result = validateFixtureForStaticSampleArtifact(
      makeFixtureResponse({ notInvestmentAdvice: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T78.13-b: build throws when notInvestmentAdvice is not true", () => {
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact(
        makeParams({ notInvestmentAdvice: false as unknown as true }),
      ),
    ).toThrow(/notInvestmentAdvice/);
  });
});

// ─── T78.14: build throws on validation failure ───────────────────────────────

describe("T78.14: build throws on validation failure", () => {
  it("T78.14-a: thrown error contains 'Governance validation failed'", () => {
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact(
        makeParams({ reviewOnly: false as unknown as true }),
      ),
    ).toThrow("Governance validation failed");
  });

  it("T78.14-b: build does not produce partial output on failure", () => {
    let result: StockResearchProductSurfaceStaticSampleArtifactResponse | undefined;
    try {
      result = buildStockResearchProductSurfaceStaticSampleArtifact(
        makeParams({ noForecast: false as unknown as true }),
      );
    } catch {
      // expected
    }
    expect(result).toBeUndefined();
  });
});

// ─── T78.15: fixed generatedAt behavior ──────────────────────────────────────

describe("T78.15: fixed generatedAt behavior", () => {
  it("T78.15-a: response.generatedAt equals fixedGeneratedAt when provided", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.generatedAt).toBe(FIXED_TS);
  });

  it("T78.15-b: two calls with same fixedGeneratedAt produce same generatedAt", () => {
    const r1 = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    const r2 = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(r1.generatedAt).toBe(r2.generatedAt);
  });

  it("T78.15-c: different fixedGeneratedAt produces different generatedAt", () => {
    const r1 = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    const r2 = buildStockResearchProductSurfaceStaticSampleArtifact(
      makeParams({}, "2026-01-01T00:00:00.000Z"),
    );
    expect(r1.generatedAt).not.toBe(r2.generatedAt);
  });
});

// ─── T78.16: default generatedAt behavior ────────────────────────────────────

describe("T78.16: default generatedAt behavior", () => {
  it("T78.16-a: response.generatedAt is a non-empty string when fixedGeneratedAt not provided", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams());
    expect(typeof resp.generatedAt).toBe("string");
    expect(resp.generatedAt.length).toBeGreaterThan(0);
  });

  it("T78.16-b: default generatedAt is a valid ISO timestamp", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams());
    expect(() => new Date(resp.generatedAt)).not.toThrow();
    expect(new Date(resp.generatedAt).toISOString()).toBe(resp.generatedAt);
  });
});

// ─── T78.17: preserves disclaimerBlock as artifact block ─────────────────────

describe("T78.17: preserves disclaimerBlock as artifact block", () => {
  it("T78.17-a: reportBlocks[0].blockKey is 'disclaimer'", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.reportBlocks[0].blockKey).toBe("disclaimer");
  });

  it("T78.17-b: reportBlocks[0].blockLabel equals disclaimerBlock.disclaimerLabel", () => {
    const fixture = makeFixtureResponse();
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(resp.reportBlocks[0].blockLabel).toBe(fixture.disclaimerBlock.disclaimerLabel);
  });

  it("T78.17-c: reportBlocks[0].lines contains disclaimer text", () => {
    const fixture = makeFixtureResponse();
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(resp.reportBlocks[0].lines).toEqual(
      expect.arrayContaining([fixture.disclaimerBlock.lines[0]]),
    );
  });
});

// ─── T78.18: preserves researchReviewBlock as artifact block ──────────────────

describe("T78.18: preserves researchReviewBlock as artifact block", () => {
  it("T78.18-a: reportBlocks[1].blockKey is 'researchReview'", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.reportBlocks[1].blockKey).toBe("researchReview");
  });

  it("T78.18-b: reportBlocks[1].blockLabel equals researchReviewBlock.blockLabel", () => {
    const fixture = makeFixtureResponse();
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(resp.reportBlocks[1].blockLabel).toBe(fixture.researchReviewBlock.blockLabel);
  });

  it("T78.18-c: reportBlocks[1].lines count equals researchReviewBlock.cardCount", () => {
    const fixture = makeFixtureResponse();
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(resp.reportBlocks[1].lines).toHaveLength(fixture.researchReviewBlock.cardCount);
  });
});

// ─── T78.19: preserves simulationInputAuditBlock as artifact block ────────────

describe("T78.19: preserves simulationInputAuditBlock as artifact block", () => {
  it("T78.19-a: reportBlocks[2].blockKey is 'simulationInputAudit'", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.reportBlocks[2].blockKey).toBe("simulationInputAudit");
  });

  it("T78.19-b: reportBlocks[2].blockLabel equals simulationInputAuditBlock.blockLabel", () => {
    const fixture = makeFixtureResponse();
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(resp.reportBlocks[2].blockLabel).toBe(fixture.simulationInputAuditBlock.blockLabel);
  });

  it("T78.19-c: reportBlocks[2].lines count equals simulationInputAuditBlock.cardCount", () => {
    const fixture = makeFixtureResponse();
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(resp.reportBlocks[2].lines).toHaveLength(fixture.simulationInputAuditBlock.cardCount);
  });
});

// ─── T78.20: preserves summaryBlock as artifact block ────────────────────────

describe("T78.20: preserves summaryBlock as artifact block", () => {
  it("T78.20-a: reportBlocks[3].blockKey is 'summary'", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.reportBlocks[3].blockKey).toBe("summary");
  });

  it("T78.20-b: reportBlocks[3].blockLabel is 'Report Summary'", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.reportBlocks[3].blockLabel).toBe("Report Summary");
  });

  it("T78.20-c: reportBlocks[3].lines contains neutral disclaimer sentence", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.reportBlocks[3].lines).toContain(
      "This report is review-only and not investment advice.",
    );
  });

  it("T78.20-d: reportBlocks total count is 4", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.reportBlocks).toHaveLength(4);
  });
});

// ─── T78.21: artifactSummary uses only neutral counts ────────────────────────

describe("T78.21: artifactSummary uses only neutral counts", () => {
  it("T78.21-a: artifactSummary.researchCardCount equals summaryBlock.researchCardCount", () => {
    const fixture = makeFixtureResponse();
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(resp.artifactSummary.researchCardCount).toBe(fixture.summaryBlock.researchCardCount);
  });

  it("T78.21-b: artifactSummary.simulationAuditCardCount equals summaryBlock.simulationAuditCardCount", () => {
    const fixture = makeFixtureResponse();
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(resp.artifactSummary.simulationAuditCardCount).toBe(
      fixture.summaryBlock.simulationAuditCardCount,
    );
  });

  it("T78.21-c: artifactSummary.summaryLabel is 'Report Summary'", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.artifactSummary.summaryLabel).toBe("Report Summary");
  });

  it("T78.21-d: artifactSummary has exactly 3 keys", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.keys(resp.artifactSummary)).toHaveLength(3);
  });
});

// ─── T78.22: governance flags in response ────────────────────────────────────

describe("T78.22: governance flags in response", () => {
  it("T78.22-a: response.reviewOnly === true", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.reviewOnly).toBe(true);
  });

  it("T78.22-b: response.noForecast === true", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.noForecast).toBe(true);
  });

  it("T78.22-c: response.noInvestmentAdvice === true", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.noInvestmentAdvice).toBe(true);
  });

  it("T78.22-d: response.entersAlphaScore === false", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.entersAlphaScore).toBe(false);
  });

  it("T78.22-e: response.paperOnly === true", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.paperOnly).toBe(true);
  });
});

// ─── T78.23: artifactTitle ────────────────────────────────────────────────────

describe("T78.23: artifactTitle", () => {
  it("T78.23-a: artifactTitle is the expected neutral string", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.artifactTitle).toBe("Stock Research Product Surface Static Sample Artifact");
  });

  it("T78.23-b: artifactTitle does not contain 'buy'", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.artifactTitle.toLowerCase()).not.toContain("buy");
  });

  it("T78.23-c: artifactTitle does not contain 'recommend'", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(resp.artifactTitle.toLowerCase()).not.toContain("recommend");
  });
});

// ─── T78.24: no forbidden fields in response ─────────────────────────────────

describe("T78.24: no forbidden fields in response top-level keys", () => {
  it("T78.24-a: response does not have 'score' key", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.keys(resp)).not.toContain("score");
  });

  it("T78.24-b: response does not have 'verdict' key", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.keys(resp)).not.toContain("verdict");
  });

  it("T78.24-c: response does not have 'recommendation' key", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.keys(resp)).not.toContain("recommendation");
  });

  it("T78.24-d: response does not have 'forecast' key", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.keys(resp)).not.toContain("forecast");
  });

  it("T78.24-e: response does not have 'targetPrice' key", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.keys(resp)).not.toContain("targetPrice");
  });
});

// ─── T78.25: no forbidden fields in blocks ───────────────────────────────────

describe("T78.25: no forbidden fields in block keys", () => {
  it("T78.25-a: no block has 'score' key", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    resp.reportBlocks.forEach((b) => {
      expect(Object.keys(b)).not.toContain("score");
    });
  });

  it("T78.25-b: no block has 'verdict' key", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    resp.reportBlocks.forEach((b) => {
      expect(Object.keys(b)).not.toContain("verdict");
    });
  });

  it("T78.25-c: no block has 'recommendation' key", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    resp.reportBlocks.forEach((b) => {
      expect(Object.keys(b)).not.toContain("recommendation");
    });
  });

  it("T78.25-d: no block has 'alphaScore' key", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    resp.reportBlocks.forEach((b) => {
      expect(Object.keys(b)).not.toContain("alphaScore");
    });
  });
});

// ─── T78.26: JSON serializable ───────────────────────────────────────────────

describe("T78.26: JSON serializable", () => {
  it("T78.26-a: JSON.stringify does not throw", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(() => JSON.stringify(resp)).not.toThrow();
  });

  it("T78.26-b: JSON.parse(JSON.stringify(resp)).generatedAt equals original", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    const parsed = JSON.parse(JSON.stringify(resp)) as typeof resp;
    expect(parsed.generatedAt).toBe(FIXED_TS);
  });

  it("T78.26-c: JSON round-trip preserves artifactVersion", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    const parsed = JSON.parse(JSON.stringify(resp)) as typeof resp;
    expect(parsed.artifactVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_STATIC_SAMPLE_ARTIFACT_VERSION);
  });
});

// ─── T78.27: deterministic repeated calls ────────────────────────────────────

describe("T78.27: deterministic repeated calls with fixedGeneratedAt", () => {
  it("T78.27-a: two calls with same fixture and fixedGeneratedAt produce same generatedAt", () => {
    const r1 = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    const r2 = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(r1.generatedAt).toBe(r2.generatedAt);
  });

  it("T78.27-b: two calls with same fixture and fixedGeneratedAt produce same artifactSummary counts", () => {
    const r1 = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    const r2 = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(r1.artifactSummary.researchCardCount).toBe(r2.artifactSummary.researchCardCount);
    expect(r1.artifactSummary.simulationAuditCardCount).toBe(
      r2.artifactSummary.simulationAuditCardCount,
    );
  });
});

// ─── T78.28: input not mutated ───────────────────────────────────────────────

describe("T78.28: input not mutated", () => {
  it("T78.28-a: fixtureResponse.generatedAt unchanged after build", () => {
    const fixture = makeFixtureResponse();
    const originalTs = fixture.generatedAt;
    buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(fixture.generatedAt).toBe(originalTs);
  });

  it("T78.28-b: fixtureResponse.summaryBlock.researchCardCount unchanged after build", () => {
    const fixture = makeFixtureResponse();
    const originalCount = fixture.summaryBlock.researchCardCount;
    buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(fixture.summaryBlock.researchCardCount).toBe(originalCount);
  });
});

// ─── T78.29: frozen input supported ─────────────────────────────────────────

describe("T78.29: frozen input supported", () => {
  it("T78.29-a: does not throw when fixtureResponse is Object.freeze'd", () => {
    const fixture = Object.freeze(makeFixtureResponse());
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact({
        fixtureResponse: fixture,
        fixedGeneratedAt: FIXED_TS,
      }),
    ).not.toThrow();
  });
});

// ─── T78.30: output frozen ───────────────────────────────────────────────────

describe("T78.30: output frozen", () => {
  it("T78.30-a: top-level response is frozen", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.isFrozen(resp)).toBe(true);
  });

  it("T78.30-b: artifactSummary is frozen", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.isFrozen(resp.artifactSummary)).toBe(true);
  });

  it("T78.30-c: reportBlocks array is frozen", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.isFrozen(resp.reportBlocks)).toBe(true);
  });
});

// ─── T78.31: blocks frozen ───────────────────────────────────────────────────

describe("T78.31: blocks frozen", () => {
  it("T78.31-a: disclaimerBlock (reportBlocks[0]) is frozen", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.isFrozen(resp.reportBlocks[0])).toBe(true);
  });

  it("T78.31-b: researchReviewBlock (reportBlocks[1]) is frozen", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.isFrozen(resp.reportBlocks[1])).toBe(true);
  });

  it("T78.31-c: simulationInputAuditBlock (reportBlocks[2]) is frozen", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.isFrozen(resp.reportBlocks[2])).toBe(true);
  });

  it("T78.31-d: summaryBlock (reportBlocks[3]) is frozen", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.isFrozen(resp.reportBlocks[3])).toBe(true);
  });
});

// ─── T78.32: markdown-safe neutral labels ────────────────────────────────────

describe("T78.32: markdown-safe strings contain neutral labels only", () => {
  it("T78.32-a: no block line contains 'buy'", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    resp.reportBlocks.forEach((b) => {
      b.lines.forEach((line) => {
        expect(line.toLowerCase()).not.toContain("buy");
      });
    });
  });

  it("T78.32-b: no block line contains 'sell'", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    resp.reportBlocks.forEach((b) => {
      b.lines.forEach((line) => {
        expect(line.toLowerCase()).not.toContain("sell");
      });
    });
  });

  it("T78.32-c: no block line contains 'alphaScore'", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    resp.reportBlocks.forEach((b) => {
      b.lines.forEach((line) => {
        expect(line.toLowerCase()).not.toContain("alphascore");
      });
    });
  });

  it("T78.32-d: disclaimer block lines are non-empty strings", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    resp.reportBlocks[0].lines.forEach((line) => {
      expect(typeof line).toBe("string");
      expect(line.length).toBeGreaterThan(0);
    });
  });
});

// ─── T78.33: card note preserved in lines ────────────────────────────────────

describe("T78.33: card note preserved in block lines", () => {
  it("T78.33-a: research card with note includes review note in line", () => {
    const fixture = makeFixtureResponse();
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    // card index 1 has note: "Low trust"
    const lineWithNote = resp.reportBlocks[1].lines[1];
    expect(lineWithNote).toContain("Review note");
    expect(lineWithNote).toContain("Low trust");
  });

  it("T78.33-b: research card without note has no review note in line", () => {
    const fixture = makeFixtureResponse();
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    // card index 0 has no note
    const lineWithoutNote = resp.reportBlocks[1].lines[0];
    expect(lineWithoutNote).not.toContain("Review note");
  });
});

// ─── T78.34: zero-card fixture ───────────────────────────────────────────────

describe("T78.34: zero-card fixture", () => {
  it("T78.34-a: zero-card report does not throw", () => {
    const fixture = makeFixtureResponse({
      researchReviewBlock: Object.freeze({
        blockLabel: "Research Review",
        cards: Object.freeze([]),
        cardCount: 0,
      }),
      simulationInputAuditBlock: Object.freeze({
        blockLabel: "Simulation Input Audit",
        cards: Object.freeze([]),
        cardCount: 0,
      }),
      summaryBlock: Object.freeze({
        researchCardCount: 0,
        simulationAuditCardCount: 0,
      }),
    });
    expect(() =>
      buildStockResearchProductSurfaceStaticSampleArtifact({
        fixtureResponse: fixture,
        fixedGeneratedAt: FIXED_TS,
      }),
    ).not.toThrow();
  });

  it("T78.34-b: zero-card report has reportBlocks[1].lines.length === 0", () => {
    const fixture = makeFixtureResponse({
      researchReviewBlock: Object.freeze({
        blockLabel: "Research Review",
        cards: Object.freeze([]),
        cardCount: 0,
      }),
      simulationInputAuditBlock: Object.freeze({
        blockLabel: "Simulation Input Audit",
        cards: Object.freeze([]),
        cardCount: 0,
      }),
      summaryBlock: Object.freeze({
        researchCardCount: 0,
        simulationAuditCardCount: 0,
      }),
    });
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(resp.reportBlocks[1].lines).toHaveLength(0);
  });

  it("T78.34-c: zero-card report has artifactSummary.researchCardCount === 0", () => {
    const fixture = makeFixtureResponse({
      researchReviewBlock: Object.freeze({
        blockLabel: "Research Review",
        cards: Object.freeze([]),
        cardCount: 0,
      }),
      simulationInputAuditBlock: Object.freeze({
        blockLabel: "Simulation Input Audit",
        cards: Object.freeze([]),
        cardCount: 0,
      }),
      summaryBlock: Object.freeze({
        researchCardCount: 0,
        simulationAuditCardCount: 0,
      }),
    });
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact({
      fixtureResponse: fixture,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(resp.artifactSummary.researchCardCount).toBe(0);
  });
});

// ─── T78.35: source text — no DB / Prisma import ─────────────────────────────

describe("T78.35: source text has no DB / Prisma import", () => {
  it("T78.35-a: source does not import from '@prisma/client'", () => {
    expect(SOURCE_TEXT).not.toMatch(/@prisma\/client/);
  });

  it("T78.35-b: source does not import from '@/lib/prisma'", () => {
    expect(SOURCE_TEXT).not.toMatch(/@\/lib\/prisma/);
  });

  it("T78.35-c: source does not reference 'prisma.' accessor", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bprisma\./);
  });
});

// ─── T78.36: source text — no fs / path import ───────────────────────────────

describe("T78.36: source text has no fs / path / network import", () => {
  it("T78.36-a: source does not import 'fs'", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ['"]fs['"]/);
  });

  it("T78.36-b: source does not import 'path'", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ['"]path['"]/);
  });

  it("T78.36-c: source does not import 'child_process'", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ['"]child_process['"]/);
  });

  it("T78.36-d: source does not use 'fetch'", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bfetch\s*\(/);
  });
});

// ─── T78.37: source text — no onlineValidation import ────────────────────────

describe("T78.37: source text has no onlineValidation runtime import", () => {
  it("T78.37-a: source does not import from onlineValidation", () => {
    expect(SOURCE_TEXT).not.toMatch(/onlineValidation/);
  });
});

// ─── T78.38: source text — no forbidden export names ─────────────────────────

describe("T78.38: source text does not export forbidden names", () => {
  it("T78.38-a: source does not export 'run'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+(?:function|const)\s+run\b/);
  });

  it("T78.38-b: source does not export 'execute'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+(?:function|const)\s+execute\b/);
  });

  it("T78.38-c: source does not export 'simulate'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+(?:function|const)\s+simulate\b/);
  });

  it("T78.38-d: source does not export 'recommend'", () => {
    expect(SOURCE_TEXT).not.toMatch(/export\s+(?:function|const)\s+recommend\b/);
  });
});

// ─── T78.39: source text — no ROI / PnL / winRate / benchmark ────────────────

describe("T78.39: source text does not reference forbidden financial terms", () => {
  it("T78.39-a: source does not contain 'ROI'", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bROI\b/);
  });

  it("T78.39-b: source does not contain 'PnL'", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bPnL\b/);
  });

  it("T78.39-c: source does not contain 'winRate'", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bwinRate\b/);
  });

  it("T78.39-d: source does not contain 'benchmark'", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bbenchmark\b/);
  });

  it("T78.39-e: source does not contain 'targetPrice'", () => {
    expect(SOURCE_TEXT).not.toMatch(/\btargetPrice\b/);
  });
});

// ─── T78.40: source text — no buy / sell / hold / action semantics ────────────

describe("T78.40: source text does not contain buy/sell/hold/action semantics", () => {
  it("T78.40-a: source does not use 'buy' as identifier or field", () => {
    expect(SOURCE_TEXT).not.toMatch(/\b(?:buy|BUY)\b/);
  });

  it("T78.40-b: source does not use 'sell' as identifier or field", () => {
    expect(SOURCE_TEXT).not.toMatch(/\b(?:sell|SELL)\b/);
  });

  it("T78.40-c: source does not use 'hold' in trading context", () => {
    // Reject 'hold' only as standalone identifier — not in 'threshold', 'withhold', etc.
    expect(SOURCE_TEXT).not.toMatch(/\bhold\b.*recommendation|\brecommendation\b.*hold/i);
  });
});

// ─── T78.41: source text — all upstream imports are import type ───────────────

describe("T78.41: all upstream fixture imports are import type", () => {
  it("T78.41-a: source imports StockResearchProductSurfaceSampleReportFixtureResponse as type only", () => {
    expect(SOURCE_TEXT).toMatch(/import\s+type\s+\{[\s\S]*?StockResearchProductSurfaceSampleReportFixtureResponse/);
  });

  it("T78.41-b: source has no value import from the fixture module", () => {
    // Should not have: import { something } from "./StockResearchProductSurfaceSampleReportFixture"
    // (only import type is allowed)
    expect(SOURCE_TEXT).not.toMatch(/^import\s+\{[^}]+\}\s+from\s+['"]\.\/StockResearchProductSurfaceSampleReportFixture['"]/m);
  });
});

// ─── T78.42: source text version string ──────────────────────────────────────

describe("T78.42: source text version prefix", () => {
  it("T78.42-a: source text contains p78 artifact version string", () => {
    expect(SOURCE_TEXT).toContain("p78-stock-research-product-surface-static-sample-artifact-v0");
  });
});

// ─── T78.43: no prediction / investment-advice / recommendation fields ────────

describe("T78.43: no prediction / investment-advice / recommendation fields", () => {
  it("T78.43-a: response does not have 'prediction' key", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.keys(resp)).not.toContain("prediction");
  });

  it("T78.43-b: response does not have 'advice' key", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.keys(resp)).not.toContain("advice");
  });

  it("T78.43-c: artifactSummary does not have 'recommendation' key", () => {
    const resp = buildStockResearchProductSurfaceStaticSampleArtifact(makeParams({}, FIXED_TS));
    expect(Object.keys(resp.artifactSummary)).not.toContain("recommendation");
  });
});
