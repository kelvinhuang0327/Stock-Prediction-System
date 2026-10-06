/**
 * P75 — Stock Research Product Surface Export Contract
 * Tests: T75.1 – T75.30 (88 tests)
 *
 * Authorization: P75-GATE 2026-05-26
 * Token: P75_GATE_PRODUCT_SURFACE_EXPORT_CONTRACT_APPROVED_WITH_STRICT_SCOPE
 * Upstream baseline: P74 — StockResearchProductSurfaceContract (c1ae678)
 */

import * as fs from "fs";
import * as path from "path";
import {
  STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_VERSION,
  STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE,
  validateProductSurfaceForExport,
  buildStockResearchProductSurfaceExport,
} from "../composition/StockResearchProductSurfaceExportContract";
import type {
  StockResearchProductSurfaceResponse,
  StockResearchProductSurfaceSection,
  StockResearchProductSurfaceSummary,
} from "../composition/StockResearchProductSurfaceContract";

// ─── Source Path ──────────────────────────────────────────────────────────────

const SOURCE_PATH = path.resolve(
  __dirname,
  "../composition/StockResearchProductSurfaceExportContract.ts",
);

// ─── Constants ────────────────────────────────────────────────────────────────

const FIXED_AT = "2026-05-26T00:00:00.000Z";
const FIXED_AT_2 = "2026-01-01T12:00:00.000Z";
const P74_VERSION = "p74-stock-research-product-surface-contract-v0" as const;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSurfaceResponse(
  overrides: Partial<StockResearchProductSurfaceResponse> = {},
): StockResearchProductSurfaceResponse {
  const researchCards = Object.freeze([
    Object.freeze({ sourceName: "AxisA-Source-1", label: "Source status", status: "review-ready" }),
    Object.freeze({
      sourceName: "AxisA-Source-2",
      label: "Review note",
      status: "review-ready",
      note: "Axis A note",
    }),
  ]);

  const simulationCards = Object.freeze([
    Object.freeze({
      sourceName: "AxisB-Source-1",
      label: "Source status",
      status: "audit-ready",
    }),
    Object.freeze({
      sourceName: "AxisB-Source-2",
      label: "Excluded reason",
      status: "audit-ready",
      note: "Axis B note",
    }),
  ]);

  const researchReview = Object.freeze({
    sectionLabel: "Research Review",
    cards: researchCards,
    cardCount: 2,
  } as StockResearchProductSurfaceSection);

  const simulationInputAudit = Object.freeze({
    sectionLabel: "Simulation Input Audit",
    cards: simulationCards,
    cardCount: 2,
  } as StockResearchProductSurfaceSection);

  const surfaceSummary = Object.freeze({
    researchCardCount: 2,
    simulationAuditCardCount: 2,
  } as StockResearchProductSurfaceSummary);

  return Object.freeze({
    surfaceVersion: P74_VERSION,
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
    researchReview,
    simulationInputAudit,
    surfaceSummary,
    ...overrides,
  } as StockResearchProductSurfaceResponse);
}

function makeEmptySurfaceResponse(): StockResearchProductSurfaceResponse {
  const emptyResearchReview = Object.freeze({
    sectionLabel: "Research Review",
    cards: Object.freeze([]),
    cardCount: 0,
  } as StockResearchProductSurfaceSection);

  const emptySimulationInputAudit = Object.freeze({
    sectionLabel: "Simulation Input Audit",
    cards: Object.freeze([]),
    cardCount: 0,
  } as StockResearchProductSurfaceSection);

  const emptySurfaceSummary = Object.freeze({
    researchCardCount: 0,
    simulationAuditCardCount: 0,
  } as StockResearchProductSurfaceSummary);

  return Object.freeze({
    surfaceVersion: P74_VERSION,
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
    researchReview: emptyResearchReview,
    simulationInputAudit: emptySimulationInputAudit,
    surfaceSummary: emptySurfaceSummary,
  } as StockResearchProductSurfaceResponse);
}

// ─── Source text ──────────────────────────────────────────────────────────────

let sourceText = "";
beforeAll(() => {
  sourceText = fs.readFileSync(SOURCE_PATH, "utf-8");
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.1 — Version exact value / prefix / exportVersion field
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.1 — Version exact value / prefix / exportVersion field", () => {
  it("T75.1.1 — version constant has exact value", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_VERSION).toBe(
      "p75-stock-research-product-surface-export-contract-v0",
    );
  });

  it("T75.1.2 — version constant starts with p75 prefix", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_VERSION).toMatch(/^p75-/);
  });

  it("T75.1.3 — exportVersion field in response equals the version constant", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.exportVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_VERSION);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.2 — Governance constants — all 10 flags + frozen
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.2 — Governance constants — all 10 flags + frozen", () => {
  it("T75.2.1 — reviewOnly is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE.reviewOnly).toBe(true);
  });

  it("T75.2.2 — noInvestmentAdvice is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE.noInvestmentAdvice).toBe(true);
  });

  it("T75.2.3 — noForecast is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE.noForecast).toBe(true);
  });

  it("T75.2.4 — noRecommendation is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE.noRecommendation).toBe(true);
  });

  it("T75.2.5 — previewOnly is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE.previewOnly).toBe(true);
  });

  it("T75.2.6 — paperOnly is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE.paperOnly).toBe(true);
  });

  it("T75.2.7 — noExecution is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE.noExecution).toBe(true);
  });

  it("T75.2.8 — noActualMetrics is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE.noActualMetrics).toBe(true);
  });

  it("T75.2.9 — entersAlphaScore is false", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  it("T75.2.10 — notInvestmentAdvice is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE.notInvestmentAdvice).toBe(
      true,
    );
  });

  it("T75.2.11 — governance constant is frozen", () => {
    expect(Object.isFrozen(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_GOVERNANCE)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.3 — generatedAt fixed / alternate fixed / default
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.3 — generatedAt fixed / alternate fixed / default", () => {
  it("T75.3.1 — uses fixedGeneratedAt when provided", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.generatedAt).toBe(FIXED_AT);
  });

  it("T75.3.2 — uses alternate fixedGeneratedAt value correctly", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT_2,
    });
    expect(result.generatedAt).toBe(FIXED_AT_2);
  });

  it("T75.3.3 — produces non-empty generatedAt when fixedGeneratedAt is omitted", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
    });
    expect(typeof result.generatedAt).toBe("string");
    expect(result.generatedAt.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.4 — Accepts valid P74 surface response
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.4 — Accepts valid P74 surface response", () => {
  it("T75.4.1 — does not throw for standard surface response", () => {
    expect(() =>
      buildStockResearchProductSurfaceExport({
        surfaceResponse: makeSurfaceResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T75.4.2 — returns non-null result", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result).not.toBeNull();
  });

  it("T75.4.3 — does not throw for empty-card surface response", () => {
    expect(() =>
      buildStockResearchProductSurfaceExport({
        surfaceResponse: makeEmptySurfaceResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.5 — Validator returns { valid: true }
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.5 — Validator returns { valid: true }", () => {
  it("T75.5.1 — validator returns valid: true for a fully compliant surface response", () => {
    const result = validateProductSurfaceForExport(makeSurfaceResponse());
    expect(result.valid).toBe(true);
  });

  it("T75.5.2 — valid result has no reason field", () => {
    const result = validateProductSurfaceForExport(makeSurfaceResponse());
    expect(result).not.toHaveProperty("reason");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.6 — Rejects each of 10 bad flags
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.6 — Rejects each of 10 bad flags", () => {
  it("T75.6.1 — rejects when reviewOnly is not true", () => {
    const result = validateProductSurfaceForExport(
      makeSurfaceResponse({ reviewOnly: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/reviewOnly/);
    }
  });

  it("T75.6.2 — rejects when noInvestmentAdvice is not true", () => {
    const result = validateProductSurfaceForExport(
      makeSurfaceResponse({ noInvestmentAdvice: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/noInvestmentAdvice/);
    }
  });

  it("T75.6.3 — rejects when noForecast is not true", () => {
    const result = validateProductSurfaceForExport(
      makeSurfaceResponse({ noForecast: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/noForecast/);
    }
  });

  it("T75.6.4 — rejects when noRecommendation is not true", () => {
    const result = validateProductSurfaceForExport(
      makeSurfaceResponse({ noRecommendation: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/noRecommendation/);
    }
  });

  it("T75.6.5 — rejects when previewOnly is not true", () => {
    const result = validateProductSurfaceForExport(
      makeSurfaceResponse({ previewOnly: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/previewOnly/);
    }
  });

  it("T75.6.6 — rejects when paperOnly is not true", () => {
    const result = validateProductSurfaceForExport(
      makeSurfaceResponse({ paperOnly: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/paperOnly/);
    }
  });

  it("T75.6.7 — rejects when noExecution is not true", () => {
    const result = validateProductSurfaceForExport(
      makeSurfaceResponse({ noExecution: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/noExecution/);
    }
  });

  it("T75.6.8 — rejects when noActualMetrics is not true", () => {
    const result = validateProductSurfaceForExport(
      makeSurfaceResponse({ noActualMetrics: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/noActualMetrics/);
    }
  });

  it("T75.6.9 — rejects when entersAlphaScore is not false", () => {
    const result = validateProductSurfaceForExport(
      makeSurfaceResponse({ entersAlphaScore: true as unknown as false }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/entersAlphaScore/);
    }
  });

  it("T75.6.10 — rejects when notInvestmentAdvice is not true", () => {
    const result = validateProductSurfaceForExport(
      makeSurfaceResponse({ notInvestmentAdvice: false as unknown as true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toMatch(/notInvestmentAdvice/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.7 — Build throws on governance violation
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.7 — Build throws on governance violation", () => {
  it("T75.7.1 — throws when reviewOnly is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceExport({
        surfaceResponse: makeSurfaceResponse({ reviewOnly: false as unknown as true }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow();
  });

  it("T75.7.2 — throws when noForecast is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceExport({
        surfaceResponse: makeSurfaceResponse({ noForecast: false as unknown as true }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow();
  });

  it("T75.7.3 — error message mentions governance validation failure", () => {
    expect(() =>
      buildStockResearchProductSurfaceExport({
        surfaceResponse: makeSurfaceResponse({ noRecommendation: false as unknown as true }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow(/governance validation failed/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.8 — researchReviewSection mapping
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.8 — researchReviewSection mapping", () => {
  it("T75.8.1 — researchReviewSection.sectionLabel is Research Review", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchReviewSection.sectionLabel).toBe("Research Review");
  });

  it("T75.8.2 — researchReviewSection.cards has correct length", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchReviewSection.cards.length).toBe(2);
  });

  it("T75.8.3 — researchReviewSection.cardCount equals cards.length", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchReviewSection.cardCount).toBe(
      result.researchReviewSection.cards.length,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.9 — simulationInputAuditSection mapping
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.9 — simulationInputAuditSection mapping", () => {
  it("T75.9.1 — simulationInputAuditSection.sectionLabel is Simulation Input Audit", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationInputAuditSection.sectionLabel).toBe("Simulation Input Audit");
  });

  it("T75.9.2 — simulationInputAuditSection.cards has correct length", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationInputAuditSection.cards.length).toBe(2);
  });

  it("T75.9.3 — simulationInputAuditSection.cardCount equals cards.length", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationInputAuditSection.cardCount).toBe(
      result.simulationInputAuditSection.cards.length,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.10 — exportSummary counts + exactly 2 keys
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.10 — exportSummary counts + exactly 2 keys", () => {
  it("T75.10.1 — exportSummary.researchCardCount equals 2", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.exportSummary.researchCardCount).toBe(2);
  });

  it("T75.10.2 — exportSummary.simulationAuditCardCount equals 2", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.exportSummary.simulationAuditCardCount).toBe(2);
  });

  it("T75.10.3 — exportSummary has exactly 2 keys", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.keys(result.exportSummary)).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.11 — Neutral section labels
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.11 — Neutral section labels", () => {
  it("T75.11.1 — researchReviewSection label does not contain investment advice language", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchReviewSection.sectionLabel).not.toMatch(
      /buy|sell|hold|score|recommend|forecast/i,
    );
  });

  it("T75.11.2 — simulationInputAuditSection label does not contain investment advice language", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationInputAuditSection.sectionLabel).not.toMatch(
      /buy|sell|hold|score|recommend|forecast/i,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.12 — No merged score / verdict / recommendation
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.12 — No merged score / verdict / recommendation", () => {
  it("T75.12.1 — response has no mergedScore field", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result).not.toHaveProperty("mergedScore");
  });

  it("T75.12.2 — response has no verdict field", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result).not.toHaveProperty("verdict");
  });

  it("T75.12.3 — response has no recommendation field", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result).not.toHaveProperty("recommendation");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.13 — JSON serializable
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.13 — JSON serializable", () => {
  it("T75.13.1 — JSON.stringify does not throw", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("T75.13.2 — JSON.stringify produces a non-empty string", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(JSON.stringify(result).length).toBeGreaterThan(0);
  });

  it("T75.13.3 — round-trip parse survives (exportVersion preserved)", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const parsed = JSON.parse(JSON.stringify(result)) as typeof result;
    expect(parsed.exportVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_VERSION);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.14 — Deterministic repeated calls
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.14 — Deterministic repeated calls", () => {
  it("T75.14.1 — two calls with same fixedGeneratedAt produce identical generatedAt", () => {
    const r1 = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const r2 = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r1.generatedAt).toBe(r2.generatedAt);
  });

  it("T75.14.2 — two calls with same fixedGeneratedAt produce identical exportVersion", () => {
    const r1 = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const r2 = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r1.exportVersion).toBe(r2.exportVersion);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.15 — Input not mutated
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.15 — Input not mutated", () => {
  it("T75.15.1 — surface response researchReview cardCount unchanged after build", () => {
    const input = makeSurfaceResponse();
    const before = input.researchReview.cardCount;
    buildStockResearchProductSurfaceExport({ surfaceResponse: input, fixedGeneratedAt: FIXED_AT });
    expect(input.researchReview.cardCount).toBe(before);
  });

  it("T75.15.2 — surface response simulationInputAudit cardCount unchanged after build", () => {
    const input = makeSurfaceResponse();
    const before = input.simulationInputAudit.cardCount;
    buildStockResearchProductSurfaceExport({ surfaceResponse: input, fixedGeneratedAt: FIXED_AT });
    expect(input.simulationInputAudit.cardCount).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.16 — Frozen input supported
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.16 — Frozen input supported", () => {
  it("T75.16.1 — does not throw when input is deeply frozen", () => {
    const frozen = makeSurfaceResponse();
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() =>
      buildStockResearchProductSurfaceExport({ surfaceResponse: frozen, fixedGeneratedAt: FIXED_AT }),
    ).not.toThrow();
  });

  it("T75.16.2 — empty frozen input does not throw", () => {
    const frozen = makeEmptySurfaceResponse();
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() =>
      buildStockResearchProductSurfaceExport({ surfaceResponse: frozen, fixedGeneratedAt: FIXED_AT }),
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.17 — Output frozen
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.17 — Output frozen", () => {
  it("T75.17.1 — top-level response is frozen", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("T75.17.2 — researchReviewSection is frozen", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(result.researchReviewSection)).toBe(true);
  });

  it("T75.17.3 — simulationInputAuditSection is frozen", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(result.simulationInputAuditSection)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.18 — exportVersion field present + equals constant
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.18 — exportVersion field present + equals constant", () => {
  it("T75.18.1 — response has exportVersion field", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result).toHaveProperty("exportVersion");
  });

  it("T75.18.2 — exportVersion equals STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_VERSION", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.exportVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_EXPORT_CONTRACT_VERSION);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.19 — Source text: no Prisma / child_process / fs / path / http imports
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.19 — Source text: no Prisma / child_process / fs / path / http imports", () => {
  it("T75.19.1 — source does not import from @prisma/client", () => {
    expect(sourceText).not.toMatch(/from\s+["']@prisma\/client["']/);
  });

  it("T75.19.2 — source does not import child_process (non-comment lines)", () => {
    const codeLines = sourceText.split("\n").filter((line) => {
      const t = line.trim();
      return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
    });
    expect(codeLines.join("\n")).not.toMatch(/child_process/);
  });

  it("T75.19.3 — source does not import node:fs or require fs", () => {
    const importLines = sourceText
      .split("\n")
      .filter((line) => line.trim().startsWith("import "))
      .join("\n");
    expect(importLines).not.toMatch(/['"](fs|node:fs)['"]/);
  });

  it("T75.19.4 — source does not import node:path or require path", () => {
    const importLines = sourceText
      .split("\n")
      .filter((line) => line.trim().startsWith("import "))
      .join("\n");
    expect(importLines).not.toMatch(/['"](path|node:path)['"]/);
  });

  it("T75.19.5 — source does not import http or https", () => {
    const importLines = sourceText
      .split("\n")
      .filter((line) => line.trim().startsWith("import "))
      .join("\n");
    expect(importLines).not.toMatch(/['"]https?['"]/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.20 — No onlineValidation runtime import
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.20 — No onlineValidation runtime import", () => {
  it("T75.20.1 — source does not import from onlineValidation at runtime", () => {
    const importLines = sourceText
      .split("\n")
      .filter((line) => line.trim().startsWith("import "))
      .join("\n");
    expect(importLines).not.toMatch(/onlineValidation/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.21 — All imports are import type
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.21 — All imports are import type", () => {
  it("T75.21.1 — all production import statements use import type", () => {
    const importLines = sourceText
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));
    const bareImports = importLines.filter((line) => !line.trim().startsWith("import type"));
    expect(bareImports).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.22 — Forbidden export names
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.22 — Forbidden export names", () => {
  it("T75.22.1 — source does not export a function named run or execute", () => {
    expect(sourceText).not.toMatch(/export\s+(async\s+)?function\s+(run|execute)\b/);
  });

  it("T75.22.2 — source does not export a function named simulate or score", () => {
    expect(sourceText).not.toMatch(/export\s+(async\s+)?function\s+(simulate|score)\b/);
  });

  it("T75.22.3 — source does not export a function named optimize or backtest or recommend", () => {
    expect(sourceText).not.toMatch(
      /export\s+(async\s+)?function\s+(optimize|backtest|recommend)\b/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.23 — Forbidden financial field references
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.23 — Forbidden financial field references", () => {
  it("T75.23.1 — source does not reference roi as an output field key", () => {
    const codeLines = sourceText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      })
      .join("\n");
    expect(codeLines).not.toMatch(/\broi\s*:/i);
  });

  it("T75.23.2 — source does not reference pnl as an output field key", () => {
    const codeLines = sourceText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      })
      .join("\n");
    expect(codeLines).not.toMatch(/\bpnl\s*:/i);
  });

  it("T75.23.3 — source does not reference targetPrice as an output field key", () => {
    const codeLines = sourceText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      })
      .join("\n");
    expect(codeLines).not.toMatch(/\btargetPrice\s*:/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.24 — Forbidden action semantics
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.24 — Forbidden action semantics", () => {
  it("T75.24.1 — source does not include buy or sell as an output field key", () => {
    const codeLines = sourceText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      })
      .join("\n");
    expect(codeLines).not.toMatch(/\b(buy|sell)\s*:/i);
  });

  it("T75.24.2 — source does not include action as an output field key", () => {
    const codeLines = sourceText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
      })
      .join("\n");
    expect(codeLines).not.toMatch(/\baction\s*:/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.25 — cardCount matches cards.length
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.25 — cardCount matches cards.length", () => {
  it("T75.25.1 — researchReviewSection cardCount matches cards.length", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchReviewSection.cardCount).toBe(
      result.researchReviewSection.cards.length,
    );
  });

  it("T75.25.2 — simulationInputAuditSection cardCount matches cards.length", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationInputAuditSection.cardCount).toBe(
      result.simulationInputAuditSection.cards.length,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.26 — Zero-card export
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.26 — Zero-card export", () => {
  it("T75.26.1 — empty surface produces researchReviewSection with 0 cards", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeEmptySurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchReviewSection.cards.length).toBe(0);
  });

  it("T75.26.2 — empty surface produces simulationInputAuditSection with 0 cards", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeEmptySurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationInputAuditSection.cards.length).toBe(0);
  });

  it("T75.26.3 — empty surface exportSummary has both counts as 0", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeEmptySurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.exportSummary.researchCardCount).toBe(0);
    expect(result.exportSummary.simulationAuditCardCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.27 — Governance flags in response
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.27 — Governance flags in response", () => {
  it("T75.27.1 — response.reviewOnly is true", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.reviewOnly).toBe(true);
  });

  it("T75.27.2 — response.noInvestmentAdvice is true", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.noInvestmentAdvice).toBe(true);
  });

  it("T75.27.3 — response.noForecast is true", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.noForecast).toBe(true);
  });

  it("T75.27.4 — response.entersAlphaScore is false", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.entersAlphaScore).toBe(false);
  });

  it("T75.27.5 — response.notInvestmentAdvice is true", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.notInvestmentAdvice).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.28 — Card note preservation
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.28 — Card note preservation", () => {
  it("T75.28.1 — research card with note has note in export", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const cardWithNote = result.researchReviewSection.cards.find((c) => c.note !== undefined);
    expect(cardWithNote).toBeDefined();
    expect(cardWithNote?.note).toBe("Axis A note");
  });

  it("T75.28.2 — simulation card with note has note in export", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const cardWithNote = result.simulationInputAuditSection.cards.find(
      (c) => c.note !== undefined,
    );
    expect(cardWithNote).toBeDefined();
    expect(cardWithNote?.note).toBe("Axis B note");
  });

  it("T75.28.3 — research card without note has no note key in export", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const cardWithoutNote = result.researchReviewSection.cards.find(
      (c) => c.note === undefined,
    );
    expect(cardWithoutNote).toBeDefined();
    expect(cardWithoutNote).not.toHaveProperty("note");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.29 — exportSummary frozen
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.29 — exportSummary frozen", () => {
  it("T75.29.1 — exportSummary is frozen", () => {
    const result = buildStockResearchProductSurfaceExport({
      surfaceResponse: makeSurfaceResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(result.exportSummary)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T75.30 — Source text version prefix present
// ─────────────────────────────────────────────────────────────────────────────

describe("T75.30 — Source text version prefix present", () => {
  it("T75.30.1 — source text contains p75- version prefix string", () => {
    expect(sourceText).toMatch(/p75-stock-research-product-surface-export-contract-v0/);
  });
});
