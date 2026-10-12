/**
 * P77 Test Suite — Stock Research Product Surface Sample Report Fixture
 *
 * T77.1  – T77.30 (98 tests)
 *
 * Authorization token: P77_GATE_SAMPLE_REPORT_FIXTURE_APPROVED_WITH_STRICT_SCOPE
 * Upstream baseline: P76 — StockResearchProductSurfaceSampleReportContract (d8816f8)
 *
 * Axis A (real-data tests): T77.1–T77.19, T77.26–T77.30
 * Axis B (simulation-scaffold tests): T77.20–T77.25
 *
 * DISCLAIMER: Not investment advice. Research scaffold only.
 * reviewOnly = true. noForecast = true. entersAlphaScore = false. ALWAYS.
 */

import path from "path";
import fs from "fs";
import {
  STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_VERSION,
  STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE,
  validateSampleReportForFixture,
  buildStockResearchProductSurfaceSampleReportFixture,
  buildDefaultStockResearchProductSurfaceSampleReportFixture,
} from "../composition/StockResearchProductSurfaceSampleReportFixture";
import type { StockResearchProductSurfaceSampleReportResponse } from "../composition/StockResearchProductSurfaceSampleReportContract";

// ─── Test Constants ────────────────────────────────────────────────────────────

const FIXED_AT = "2026-05-26T00:00:00.000Z";
const FIXED_AT_2 = "2026-01-01T12:00:00.000Z";
const P76_REPORT_VERSION = "p76-stock-research-product-surface-sample-report-contract-v0" as const;
const SOURCE_PATH = path.resolve(__dirname, "../composition/StockResearchProductSurfaceSampleReportFixture.ts");

// ─── Fixture Helpers ───────────────────────────────────────────────────────────

function makeSampleReportResponse(
  overrides: Record<string, unknown> = {},
): StockResearchProductSurfaceSampleReportResponse {
  return Object.freeze({
    reportVersion: P76_REPORT_VERSION,
    generatedAt: FIXED_AT,
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
    reportTitle: "Stock Research Product Surface Sample Report",
    disclaimerBlock: Object.freeze({
      disclaimerLabel: "Disclaimer",
      lines: Object.freeze([
        "This report is review-only and not investment advice.",
        "No forecast is implied or generated.",
        "No trading execution is authorized or implied.",
      ]),
    }),
    researchReviewBlock: Object.freeze({
      blockLabel: "Research Review",
      cards: Object.freeze([
        Object.freeze({ sourceName: "src-a", label: "Label A", status: "ok", note: "Axis A note" }),
        Object.freeze({ sourceName: "src-b", label: "Label B", status: "ok" }),
      ]),
      cardCount: 2,
    }),
    simulationInputAuditBlock: Object.freeze({
      blockLabel: "Simulation Input Audit",
      cards: Object.freeze([
        Object.freeze({ sourceName: "src-c", label: "Label C", status: "ok", note: "Axis B note" }),
        Object.freeze({ sourceName: "src-d", label: "Label D", status: "ok" }),
      ]),
      cardCount: 2,
    }),
    summaryBlock: Object.freeze({
      researchCardCount: 2,
      simulationAuditCardCount: 2,
    }),
    ...overrides,
  }) as unknown as StockResearchProductSurfaceSampleReportResponse;
}

function makeEmptySampleReportResponse(): StockResearchProductSurfaceSampleReportResponse {
  return Object.freeze({
    reportVersion: P76_REPORT_VERSION,
    generatedAt: FIXED_AT,
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
    reportTitle: "Stock Research Product Surface Sample Report",
    disclaimerBlock: Object.freeze({
      disclaimerLabel: "Disclaimer",
      lines: Object.freeze([
        "This report is review-only and not investment advice.",
        "No forecast is implied or generated.",
        "No trading execution is authorized or implied.",
      ]),
    }),
    researchReviewBlock: Object.freeze({
      blockLabel: "Research Review",
      cards: Object.freeze([] as { sourceName: string; label: string; status: string; note?: string }[]),
      cardCount: 0,
    }),
    simulationInputAuditBlock: Object.freeze({
      blockLabel: "Simulation Input Audit",
      cards: Object.freeze([] as { sourceName: string; label: string; status: string; note?: string }[]),
      cardCount: 0,
    }),
    summaryBlock: Object.freeze({
      researchCardCount: 0,
      simulationAuditCardCount: 0,
    }),
  }) as unknown as StockResearchProductSurfaceSampleReportResponse;
}

function readSourceNonComment(): string {
  const raw = fs.readFileSync(SOURCE_PATH, "utf-8");
  return raw
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return (
        !trimmed.startsWith("*") &&
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("/*")
      );
    })
    .join("\n");
}

// ─── T77.1: version constant exact value + response.sampleVersion field ────────

describe("T77.1: version constant", () => {
  it("T77.1-a: FIXTURE_VERSION equals exact string", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_VERSION).toBe(
      "p77-stock-research-product-surface-sample-report-fixture-v0",
    );
  });

  it("T77.1-b: typeof FIXTURE_VERSION is string", () => {
    expect(typeof STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_VERSION).toBe("string");
  });

  it("T77.1-c: response.sampleVersion equals FIXTURE_VERSION", () => {
    const r = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: makeSampleReportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.sampleVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_VERSION);
  });
});

// ─── T77.2: governance constant all 10 flags + frozen ─────────────────────────

describe("T77.2: governance constant", () => {
  it("T77.2-a: GOVERNANCE.reviewOnly === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE.reviewOnly).toBe(true);
  });

  it("T77.2-b: GOVERNANCE.noInvestmentAdvice === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE.noInvestmentAdvice).toBe(true);
  });

  it("T77.2-c: GOVERNANCE.noForecast === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE.noForecast).toBe(true);
  });

  it("T77.2-d: GOVERNANCE.noRecommendation === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE.noRecommendation).toBe(true);
  });

  it("T77.2-e: GOVERNANCE.previewOnly === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE.previewOnly).toBe(true);
  });

  it("T77.2-f: GOVERNANCE.paperOnly === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE.paperOnly).toBe(true);
  });

  it("T77.2-g: GOVERNANCE.noExecution === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE.noExecution).toBe(true);
  });

  it("T77.2-h: GOVERNANCE.noActualMetrics === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE.noActualMetrics).toBe(true);
  });

  it("T77.2-i: GOVERNANCE.entersAlphaScore === false", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  it("T77.2-j: GOVERNANCE.notInvestmentAdvice === true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE.notInvestmentAdvice).toBe(true);
  });

  it("T77.2-k: GOVERNANCE is frozen", () => {
    expect(Object.isFrozen(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_GOVERNANCE)).toBe(true);
  });
});

// ─── T77.3: generatedAt fixed / alternate / default ───────────────────────────

describe("T77.3: generatedAt", () => {
  it("T77.3-a: generatedAt equals FIXED_AT when fixedGeneratedAt is FIXED_AT", () => {
    const r = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: makeSampleReportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.generatedAt).toBe(FIXED_AT);
  });

  it("T77.3-b: generatedAt equals FIXED_AT_2 when fixedGeneratedAt is FIXED_AT_2", () => {
    const r = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: makeSampleReportResponse(),
      fixedGeneratedAt: FIXED_AT_2,
    });
    expect(r.generatedAt).toBe(FIXED_AT_2);
  });

  it("T77.3-c: without fixedGeneratedAt generatedAt is a non-empty string", () => {
    const r = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: makeSampleReportResponse(),
    });
    expect(typeof r.generatedAt).toBe("string");
    expect(r.generatedAt.length).toBeGreaterThan(0);
  });
});

// ─── T77.4: accepts valid P76 sample report response ──────────────────────────

describe("T77.4: accepts valid P76 sample report response", () => {
  it("T77.4-a: does not throw with valid input", () => {
    expect(() =>
      buildStockResearchProductSurfaceSampleReportFixture({
        sampleReportResponse: makeSampleReportResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T77.4-b: returns a truthy object", () => {
    const r = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: makeSampleReportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r).toBeTruthy();
  });

  it("T77.4-c: response is not null or undefined", () => {
    const r = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: makeSampleReportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r).not.toBeNull();
    expect(r).not.toBeUndefined();
  });
});

// ─── T77.5: validator returns { valid: true }, no reason field ────────────────

describe("T77.5: validator returns valid: true", () => {
  it("T77.5-a: validateSampleReportForFixture returns valid: true for valid input", () => {
    const result = validateSampleReportForFixture(makeSampleReportResponse());
    expect(result.valid).toBe(true);
  });

  it("T77.5-b: valid result has no reason field", () => {
    const result = validateSampleReportForFixture(makeSampleReportResponse());
    expect("reason" in result).toBe(false);
  });
});

// ─── T77.6: validator rejects each of 10 bad flags ───────────────────────────

describe("T77.6: validator rejects bad governance flags", () => {
  it("T77.6-a: rejects reviewOnly = false", () => {
    const result = validateSampleReportForFixture(makeSampleReportResponse({ reviewOnly: false }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("reviewOnly");
  });

  it("T77.6-b: rejects noInvestmentAdvice = false", () => {
    const result = validateSampleReportForFixture(
      makeSampleReportResponse({ noInvestmentAdvice: false }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("noInvestmentAdvice");
  });

  it("T77.6-c: rejects noForecast = false", () => {
    const result = validateSampleReportForFixture(makeSampleReportResponse({ noForecast: false }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("noForecast");
  });

  it("T77.6-d: rejects noRecommendation = false", () => {
    const result = validateSampleReportForFixture(
      makeSampleReportResponse({ noRecommendation: false }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("noRecommendation");
  });

  it("T77.6-e: rejects previewOnly = false", () => {
    const result = validateSampleReportForFixture(makeSampleReportResponse({ previewOnly: false }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("previewOnly");
  });

  it("T77.6-f: rejects paperOnly = false", () => {
    const result = validateSampleReportForFixture(makeSampleReportResponse({ paperOnly: false }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("paperOnly");
  });

  it("T77.6-g: rejects noExecution = false", () => {
    const result = validateSampleReportForFixture(makeSampleReportResponse({ noExecution: false }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("noExecution");
  });

  it("T77.6-h: rejects noActualMetrics = false", () => {
    const result = validateSampleReportForFixture(
      makeSampleReportResponse({ noActualMetrics: false }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("noActualMetrics");
  });

  it("T77.6-i: rejects entersAlphaScore = true", () => {
    const result = validateSampleReportForFixture(
      makeSampleReportResponse({ entersAlphaScore: true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("entersAlphaScore");
  });

  it("T77.6-j: rejects notInvestmentAdvice = false", () => {
    const result = validateSampleReportForFixture(
      makeSampleReportResponse({ notInvestmentAdvice: false }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("notInvestmentAdvice");
  });
});

// ─── T77.7: build throws on governance violation ──────────────────────────────

describe("T77.7: build throws on governance violation", () => {
  it("T77.7-a: throws if reviewOnly is not true, message includes reviewOnly", () => {
    expect(() =>
      buildStockResearchProductSurfaceSampleReportFixture({
        sampleReportResponse: makeSampleReportResponse({ reviewOnly: false }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow("reviewOnly");
  });

  it("T77.7-b: throws if noForecast is not true, message includes noForecast", () => {
    expect(() =>
      buildStockResearchProductSurfaceSampleReportFixture({
        sampleReportResponse: makeSampleReportResponse({ noForecast: false }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow("noForecast");
  });

  it("T77.7-c: throws if entersAlphaScore is not false, message includes entersAlphaScore", () => {
    expect(() =>
      buildStockResearchProductSurfaceSampleReportFixture({
        sampleReportResponse: makeSampleReportResponse({ entersAlphaScore: true }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow("entersAlphaScore");
  });
});

// ─── T77.8: sampleTitle is neutral ────────────────────────────────────────────

describe("T77.8: sampleTitle is neutral", () => {
  it("T77.8-a: sampleTitle equals expected neutral label", () => {
    const r = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: makeSampleReportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.sampleTitle).toBe("Stock Research Product Surface Sample Report Fixture");
  });

  it("T77.8-b: sampleTitle does not contain advisory or action terms", () => {
    const r = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: makeSampleReportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.sampleTitle).not.toMatch(/buy|sell|hold|forecast|recommend/i);
  });
});

// ─── T77.9: preserves disclaimerBlock ─────────────────────────────────────────

describe("T77.9: preserves disclaimerBlock", () => {
  const input = makeSampleReportResponse();
  const r = buildStockResearchProductSurfaceSampleReportFixture({
    sampleReportResponse: input,
    fixedGeneratedAt: FIXED_AT,
  });

  it("T77.9-a: disclaimerBlock.disclaimerLabel matches input", () => {
    expect(r.disclaimerBlock.disclaimerLabel).toBe(input.disclaimerBlock.disclaimerLabel);
  });

  it("T77.9-b: disclaimerBlock.lines.length matches input", () => {
    expect(r.disclaimerBlock.lines.length).toBe(input.disclaimerBlock.lines.length);
  });

  it("T77.9-c: disclaimerBlock.lines[0] matches input", () => {
    expect(r.disclaimerBlock.lines[0]).toBe(input.disclaimerBlock.lines[0]);
  });
});

// ─── T77.10: preserves researchReviewBlock ────────────────────────────────────

describe("T77.10: preserves researchReviewBlock", () => {
  const r = buildStockResearchProductSurfaceSampleReportFixture({
    sampleReportResponse: makeSampleReportResponse(),
    fixedGeneratedAt: FIXED_AT,
  });

  it("T77.10-a: researchReviewBlock.blockLabel equals 'Research Review'", () => {
    expect(r.researchReviewBlock.blockLabel).toBe("Research Review");
  });

  it("T77.10-b: researchReviewBlock.cardCount equals 2", () => {
    expect(r.researchReviewBlock.cardCount).toBe(2);
  });

  it("T77.10-c: researchReviewBlock.cards.length equals 2", () => {
    expect(r.researchReviewBlock.cards.length).toBe(2);
  });
});

// ─── T77.11: preserves simulationInputAuditBlock ──────────────────────────────

describe("T77.11: preserves simulationInputAuditBlock", () => {
  const r = buildStockResearchProductSurfaceSampleReportFixture({
    sampleReportResponse: makeSampleReportResponse(),
    fixedGeneratedAt: FIXED_AT,
  });

  it("T77.11-a: simulationInputAuditBlock.blockLabel equals 'Simulation Input Audit'", () => {
    expect(r.simulationInputAuditBlock.blockLabel).toBe("Simulation Input Audit");
  });

  it("T77.11-b: simulationInputAuditBlock.cardCount equals 2", () => {
    expect(r.simulationInputAuditBlock.cardCount).toBe(2);
  });

  it("T77.11-c: simulationInputAuditBlock.cards.length equals 2", () => {
    expect(r.simulationInputAuditBlock.cards.length).toBe(2);
  });
});

// ─── T77.12: preserves summaryBlock ──────────────────────────────────────────

describe("T77.12: preserves summaryBlock", () => {
  const r = buildStockResearchProductSurfaceSampleReportFixture({
    sampleReportResponse: makeSampleReportResponse(),
    fixedGeneratedAt: FIXED_AT,
  });

  it("T77.12-a: summaryBlock.researchCardCount equals 2", () => {
    expect(r.summaryBlock.researchCardCount).toBe(2);
  });

  it("T77.12-b: summaryBlock.simulationAuditCardCount equals 2", () => {
    expect(r.summaryBlock.simulationAuditCardCount).toBe(2);
  });

  it("T77.12-c: summaryBlock has exactly 2 keys", () => {
    expect(Object.keys(r.summaryBlock).length).toBe(2);
  });
});

// ─── T77.13: no merged score / verdict / recommendation ───────────────────────

describe("T77.13: no merged score, verdict, recommendation", () => {
  const r = buildStockResearchProductSurfaceSampleReportFixture({
    sampleReportResponse: makeSampleReportResponse(),
    fixedGeneratedAt: FIXED_AT,
  });

  it("T77.13-a: 'score' is not a top-level key in response", () => {
    expect("score" in r).toBe(false);
  });

  it("T77.13-b: 'verdict' is not a top-level key in response", () => {
    expect("verdict" in r).toBe(false);
  });

  it("T77.13-c: 'recommendation' is not a top-level key in response", () => {
    expect("recommendation" in r).toBe(false);
  });
});

// ─── T77.14: JSON serializable + round-trip ───────────────────────────────────

describe("T77.14: JSON serializable and round-trip", () => {
  const r = buildStockResearchProductSurfaceSampleReportFixture({
    sampleReportResponse: makeSampleReportResponse(),
    fixedGeneratedAt: FIXED_AT,
  });

  it("T77.14-a: JSON.stringify does not throw", () => {
    expect(() => JSON.stringify(r)).not.toThrow();
  });

  it("T77.14-b: round-trip preserves sampleVersion", () => {
    const parsed = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
    expect(parsed["sampleVersion"]).toBe(
      STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_VERSION,
    );
  });

  it("T77.14-c: round-trip preserves generatedAt", () => {
    const parsed = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
    expect(parsed["generatedAt"]).toBe(FIXED_AT);
  });
});

// ─── T77.15: deterministic repeated calls ─────────────────────────────────────

describe("T77.15: deterministic repeated calls", () => {
  it("T77.15-a: two calls with same fixedGeneratedAt produce same sampleVersion", () => {
    const input = makeSampleReportResponse();
    const r1 = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: input,
      fixedGeneratedAt: FIXED_AT,
    });
    const r2 = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: input,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r1.sampleVersion).toBe(r2.sampleVersion);
  });

  it("T77.15-b: two calls with same fixedGeneratedAt produce same generatedAt", () => {
    const input = makeSampleReportResponse();
    const r1 = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: input,
      fixedGeneratedAt: FIXED_AT,
    });
    const r2 = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: input,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r1.generatedAt).toBe(r2.generatedAt);
  });
});

// ─── T77.16: input not mutated ────────────────────────────────────────────────

describe("T77.16: input not mutated", () => {
  it("T77.16-a: input.researchReviewBlock.cardCount is unchanged after build", () => {
    const input = makeSampleReportResponse();
    const originalCount = input.researchReviewBlock.cardCount;
    buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: input,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(input.researchReviewBlock.cardCount).toBe(originalCount);
  });

  it("T77.16-b: input.summaryBlock.researchCardCount is unchanged after build", () => {
    const input = makeSampleReportResponse();
    const originalCount = input.summaryBlock.researchCardCount;
    buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: input,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(input.summaryBlock.researchCardCount).toBe(originalCount);
  });
});

// ─── T77.17: frozen input supported ──────────────────────────────────────────

describe("T77.17: frozen input supported", () => {
  it("T77.17-a: frozen input does not cause build to throw", () => {
    const frozenInput = Object.freeze(makeSampleReportResponse());
    expect(() =>
      buildStockResearchProductSurfaceSampleReportFixture({
        sampleReportResponse: frozenInput,
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T77.17-b: frozen input produces response with correct sampleVersion", () => {
    const frozenInput = Object.freeze(makeSampleReportResponse());
    const r = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: frozenInput,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.sampleVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_VERSION);
  });
});

// ─── T77.18: output frozen — top-level + each block ──────────────────────────

describe("T77.18: output frozen", () => {
  const r = buildStockResearchProductSurfaceSampleReportFixture({
    sampleReportResponse: makeSampleReportResponse(),
    fixedGeneratedAt: FIXED_AT,
  });

  it("T77.18-a: top-level response is frozen", () => {
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("T77.18-b: disclaimerBlock is frozen", () => {
    expect(Object.isFrozen(r.disclaimerBlock)).toBe(true);
  });

  it("T77.18-c: researchReviewBlock is frozen", () => {
    expect(Object.isFrozen(r.researchReviewBlock)).toBe(true);
  });

  it("T77.18-d: simulationInputAuditBlock is frozen", () => {
    expect(Object.isFrozen(r.simulationInputAuditBlock)).toBe(true);
  });

  it("T77.18-e: summaryBlock is frozen", () => {
    expect(Object.isFrozen(r.summaryBlock)).toBe(true);
  });
});

// ─── T77.19: sampleVersion field present + correct ───────────────────────────

describe("T77.19: sampleVersion field", () => {
  const r = buildStockResearchProductSurfaceSampleReportFixture({
    sampleReportResponse: makeSampleReportResponse(),
    fixedGeneratedAt: FIXED_AT,
  });

  it("T77.19-a: 'sampleVersion' is a key in response", () => {
    expect("sampleVersion" in r).toBe(true);
  });

  it("T77.19-b: sampleVersion starts with 'p77-'", () => {
    expect(r.sampleVersion.startsWith("p77-")).toBe(true);
  });
});

// ─── T77.20: source text no forbidden dependencies ────────────────────────────

describe("T77.20: source text no forbidden dependencies", () => {
  it("T77.20-a: source does not import @prisma/client", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/@prisma\/client/);
  });

  it("T77.20-b: source does not import child_process", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/child_process/);
  });

  it("T77.20-c: source does not import fs", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/from ['"]fs['"]/);
  });

  it("T77.20-d: source does not import path", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/from ['"]path['"]/);
  });

  it("T77.20-e: source does not import http or https", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/from ['"]https?['"]/);
  });
});

// ─── T77.21: no onlineValidation runtime import ───────────────────────────────

describe("T77.21: no onlineValidation runtime import", () => {
  it("T77.21-a: source does not reference onlineValidation", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/onlineValidation/);
  });
});

// ─── T77.22: all imports are import type ──────────────────────────────────────

describe("T77.22: all imports are import type", () => {
  it("T77.22-a: every import line in source starts with import type", () => {
    const src = readSourceNonComment();
    const importLines = src
      .split("\n")
      .filter((line) => line.trimStart().startsWith("import "));
    const bareImportLines = importLines.filter(
      (line) => !line.trimStart().startsWith("import type"),
    );
    expect(bareImportLines).toHaveLength(0);
  });
});

// ─── T77.23: forbidden export names absent ────────────────────────────────────

describe("T77.23: forbidden export names absent", () => {
  it("T77.23-a: source does not export alphaScore", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/export\s+.*\balphaScore\b/);
  });

  it("T77.23-b: source does not export mergedScore", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/export\s+.*\bmergedScore\b/);
  });

  it("T77.23-c: source does not export recommendation", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/export\s+.*\brecommendation\b/);
  });
});

// ─── T77.24: forbidden financial fields absent ────────────────────────────────

describe("T77.24: forbidden financial fields absent", () => {
  it("T77.24-a: source does not contain 'pnl' (word boundary)", () => {
    const src = readSourceNonComment();
    expect(src.toLowerCase()).not.toMatch(/\bpnl\b/);
  });

  it("T77.24-b: source does not contain 'winRate' or 'win_rate'", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/\bwinRate\b|\bwin_rate\b/i);
  });

  it("T77.24-c: source does not contain 'benchmark'", () => {
    const src = readSourceNonComment();
    expect(src.toLowerCase()).not.toMatch(/\bbenchmark\b/);
  });
});

// ─── T77.25: forbidden action semantics absent ────────────────────────────────

describe("T77.25: forbidden action semantics absent", () => {
  it("T77.25-a: source does not use 'buy' as a field or identifier", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/\bbuy\b/i);
  });

  it("T77.25-b: source does not use 'sell' as a field or identifier", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/\bsell\b/i);
  });
});

// ─── T77.26: zero-card report ─────────────────────────────────────────────────

describe("T77.26: zero-card report", () => {
  it("T77.26-a: empty report does not throw", () => {
    expect(() =>
      buildStockResearchProductSurfaceSampleReportFixture({
        sampleReportResponse: makeEmptySampleReportResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T77.26-b: empty report researchReviewBlock.cards.length equals 0", () => {
    const r = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: makeEmptySampleReportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.researchReviewBlock.cards.length).toBe(0);
  });

  it("T77.26-c: empty report simulationInputAuditBlock.cards.length equals 0", () => {
    const r = buildStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: makeEmptySampleReportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.simulationInputAuditBlock.cards.length).toBe(0);
  });
});

// ─── T77.27: governance flags in response ─────────────────────────────────────

describe("T77.27: governance flags in response", () => {
  const r = buildStockResearchProductSurfaceSampleReportFixture({
    sampleReportResponse: makeSampleReportResponse(),
    fixedGeneratedAt: FIXED_AT,
  });

  it("T77.27-a: response.reviewOnly === true", () => {
    expect(r.reviewOnly).toBe(true);
  });

  it("T77.27-b: response.noForecast === true", () => {
    expect(r.noForecast).toBe(true);
  });

  it("T77.27-c: response.noInvestmentAdvice === true", () => {
    expect(r.noInvestmentAdvice).toBe(true);
  });

  it("T77.27-d: response.entersAlphaScore === false", () => {
    expect(r.entersAlphaScore).toBe(false);
  });

  it("T77.27-e: response.paperOnly === true", () => {
    expect(r.paperOnly).toBe(true);
  });
});

// ─── T77.28: card note preserved or absent ────────────────────────────────────

describe("T77.28: card note preserved or absent", () => {
  const r = buildStockResearchProductSurfaceSampleReportFixture({
    sampleReportResponse: makeSampleReportResponse(),
    fixedGeneratedAt: FIXED_AT,
  });

  it("T77.28-a: research card with note has note preserved", () => {
    const cardWithNote = r.researchReviewBlock.cards[0];
    expect(cardWithNote.note).toBe("Axis A note");
  });

  it("T77.28-b: research card without note has no note key", () => {
    const cardWithoutNote = r.researchReviewBlock.cards[1];
    expect("note" in cardWithoutNote).toBe(false);
  });

  it("T77.28-c: simulation audit card with note has note preserved", () => {
    const cardWithNote = r.simulationInputAuditBlock.cards[0];
    expect(cardWithNote.note).toBe("Axis B note");
  });
});

// ─── T77.29: buildDefaultStockResearchProductSurfaceSampleReportFixture ────────

describe("T77.29: buildDefaultStockResearchProductSurfaceSampleReportFixture", () => {
  it("T77.29-a: buildDefault does not throw", () => {
    expect(() =>
      buildDefaultStockResearchProductSurfaceSampleReportFixture({
        sampleReportResponse: makeSampleReportResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T77.29-b: buildDefault returns correct sampleVersion", () => {
    const r = buildDefaultStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: makeSampleReportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.sampleVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_FIXTURE_VERSION);
  });

  it("T77.29-c: buildDefault returns correct sampleTitle", () => {
    const r = buildDefaultStockResearchProductSurfaceSampleReportFixture({
      sampleReportResponse: makeSampleReportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.sampleTitle).toBe("Stock Research Product Surface Sample Report Fixture");
  });
});

// ─── T77.30: source text contains p77 version prefix ─────────────────────────

describe("T77.30: source text version prefix", () => {
  it("T77.30-a: source text contains p77 fixture version string", () => {
    const raw = fs.readFileSync(SOURCE_PATH, "utf-8");
    expect(raw).toContain("p77-stock-research-product-surface-sample-report-fixture-v0");
  });
});
