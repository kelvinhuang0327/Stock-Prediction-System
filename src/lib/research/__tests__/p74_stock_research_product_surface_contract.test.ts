/**
 * P74 — Tests for StockResearchProductSurfaceContract
 *
 * Min 80 tests. Groups T74.1–T74.25+.
 *
 * Source under test:
 *   src/lib/research/composition/StockResearchProductSurfaceContract.ts
 *
 * Governance constraints tested:
 *   reviewOnly=true, noInvestmentAdvice=true, noForecast=true,
 *   noRecommendation=true, previewOnly=true, paperOnly=true,
 *   noExecution=true, noActualMetrics=true, entersAlphaScore=false,
 *   notInvestmentAdvice=true.
 *
 * Source text scans:
 *   - No DB / Prisma / fs / path / network / child_process import
 *   - No onlineValidation runtime import
 *   - All imports are import type
 *   - No forbidden export names
 *   - No forbidden financial/action field references
 */

import * as fs from "fs";
import * as path from "path";

import type { CrossAxisReviewDisplayPresenterResponse } from "@/lib/research/composition/CrossAxisReviewDisplayPresenter";
import { CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_VERSION } from "@/lib/research/composition/CrossAxisReviewDisplayPresenter";
import {
  STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_VERSION,
  STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE,
  validateCrossAxisPresenterForProductSurface,
  buildStockResearchProductSurfaceResponse,
} from "@/lib/research/composition/StockResearchProductSurfaceContract";
import type {
  StockResearchProductSurfaceContractValidationResult,
  StockResearchProductSurfaceSection,
  StockResearchProductSurfaceSummary,
  StockResearchProductSurfaceResponse,
  StockResearchProductSurfaceContractParams,
} from "@/lib/research/composition/StockResearchProductSurfaceContract";

// ─── Source Text ──────────────────────────────────────────────────────────────

const SOURCE_PATH = path.resolve(
  __dirname,
  "../composition/StockResearchProductSurfaceContract.ts",
);

let sourceText = "";
beforeAll(() => {
  sourceText = fs.readFileSync(SOURCE_PATH, "utf-8");
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIXED_AT = "2026-05-26T00:00:00.000Z";
const FIXED_AT_2 = "2026-01-01T12:00:00.000Z";

function makePresenterResponse(
  overrides: Partial<CrossAxisReviewDisplayPresenterResponse> = {},
): CrossAxisReviewDisplayPresenterResponse {
  return Object.freeze({
    version: CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_VERSION,
    generatedAt: FIXED_AT,
    reviewOnly: true as const,
    noInvestmentAdvice: true as const,
    noForecast: true as const,
    noRecommendation: true as const,
    previewOnly: true as const,
    paperOnly: true as const,
    noExecution: true as const,
    noActualMetrics: true as const,
    entersAlphaScore: false as const,
    notInvestmentAdvice: true as const,
    researchCards: Object.freeze([
      Object.freeze({ sourceName: "ResearchSourceA", label: "Research review", status: "INCLUDED" }),
      Object.freeze({ sourceName: "ResearchSourceB", label: "Research review", status: "EXCLUDED", note: "excluded note" }),
    ]),
    simulationAuditCards: Object.freeze([
      Object.freeze({ sourceName: "SimSourceA", label: "Simulation input audit", status: "PREVIEW_ELIGIBLE" }),
      Object.freeze({ sourceName: "SimSourceB", label: "Simulation input audit", status: "EXCLUDED_BLOCKED", note: "blocked note" }),
    ]),
    presenterSummary: Object.freeze({ researchCardCount: 2, simulationAuditCardCount: 2 }),
    ...overrides,
  } as CrossAxisReviewDisplayPresenterResponse);
}

function makeEmptyPresenterResponse(): CrossAxisReviewDisplayPresenterResponse {
  return Object.freeze({
    version: CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_VERSION,
    generatedAt: FIXED_AT,
    reviewOnly: true as const,
    noInvestmentAdvice: true as const,
    noForecast: true as const,
    noRecommendation: true as const,
    previewOnly: true as const,
    paperOnly: true as const,
    noExecution: true as const,
    noActualMetrics: true as const,
    entersAlphaScore: false as const,
    notInvestmentAdvice: true as const,
    researchCards: Object.freeze([]),
    simulationAuditCards: Object.freeze([]),
    presenterSummary: Object.freeze({ researchCardCount: 0, simulationAuditCardCount: 0 }),
  });
}

// ─── T74.1 — Version ──────────────────────────────────────────────────────────

describe("T74.1 — Version constant", () => {
  it("T74.1.1 — version constant is exact expected value", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_VERSION).toBe(
      "p74-stock-research-product-surface-contract-v0",
    );
  });

  it("T74.1.2 — version constant starts with p74 prefix", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_VERSION).toMatch(/^p74-/);
  });

  it("T74.1.3 — build response surfaceVersion field equals version constant", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.surfaceVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_VERSION);
  });
});

// ─── T74.2 — Governance Constant ─────────────────────────────────────────────

describe("T74.2 — Governance constants", () => {
  it("T74.2.1 — reviewOnly is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE.reviewOnly).toBe(true);
  });

  it("T74.2.2 — noInvestmentAdvice is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE.noInvestmentAdvice).toBe(true);
  });

  it("T74.2.3 — noForecast is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE.noForecast).toBe(true);
  });

  it("T74.2.4 — noRecommendation is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE.noRecommendation).toBe(true);
  });

  it("T74.2.5 — previewOnly is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE.previewOnly).toBe(true);
  });

  it("T74.2.6 — paperOnly is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE.paperOnly).toBe(true);
  });

  it("T74.2.7 — noExecution is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE.noExecution).toBe(true);
  });

  it("T74.2.8 — noActualMetrics is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE.noActualMetrics).toBe(true);
  });

  it("T74.2.9 — entersAlphaScore is false", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  it("T74.2.10 — notInvestmentAdvice is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE.notInvestmentAdvice).toBe(true);
  });

  it("T74.2.11 — governance constant is frozen", () => {
    expect(Object.isFrozen(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_GOVERNANCE)).toBe(true);
  });
});

// ─── T74.3 — generatedAt ─────────────────────────────────────────────────────

describe("T74.3 — generatedAt", () => {
  it("T74.3.1 — uses fixedGeneratedAt when provided", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.generatedAt).toBe(FIXED_AT);
  });

  it("T74.3.2 — uses alternate fixedGeneratedAt", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT_2,
    });
    expect(result.generatedAt).toBe(FIXED_AT_2);
  });

  it("T74.3.3 — default generatedAt is non-empty ISO string when fixedGeneratedAt not provided", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
    });
    expect(result.generatedAt).toBeTruthy();
    expect(typeof result.generatedAt).toBe("string");
    expect(result.generatedAt.length).toBeGreaterThan(0);
  });
});

// ─── T74.4 — Accepts Valid P73 Presenter Response ─────────────────────────────

describe("T74.4 — Accepts valid P73 presenter response", () => {
  it("T74.4.1 — does not throw on valid 2-card presenter response", () => {
    expect(() =>
      buildStockResearchProductSurfaceResponse({
        presenterResponse: makePresenterResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T74.4.2 — result is non-null", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result).not.toBeNull();
  });

  it("T74.4.3 — does not throw on empty presenter response", () => {
    expect(() =>
      buildStockResearchProductSurfaceResponse({
        presenterResponse: makeEmptyPresenterResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });
});

// ─── T74.5 — validateCrossAxisPresenterForProductSurface (valid) ──────────────

describe("T74.5 — validateCrossAxisPresenterForProductSurface — valid", () => {
  it("T74.5.1 — returns { valid: true } for valid presenter response", () => {
    const result = validateCrossAxisPresenterForProductSurface(makePresenterResponse());
    expect(result.valid).toBe(true);
  });

  it("T74.5.2 — valid result has no reason field", () => {
    const result = validateCrossAxisPresenterForProductSurface(makePresenterResponse());
    expect("reason" in result).toBe(false);
  });
});

// ─── T74.6 — Rejects Each of 10 Bad Flags ────────────────────────────────────

describe("T74.6 — Rejects each of 10 bad flags", () => {
  it("T74.6.1 — rejects reviewOnly !== true", () => {
    const r = validateCrossAxisPresenterForProductSurface(
      makePresenterResponse({ reviewOnly: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/reviewOnly/);
  });

  it("T74.6.2 — rejects noInvestmentAdvice !== true", () => {
    const r = validateCrossAxisPresenterForProductSurface(
      makePresenterResponse({ noInvestmentAdvice: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/noInvestmentAdvice/);
  });

  it("T74.6.3 — rejects noForecast !== true", () => {
    const r = validateCrossAxisPresenterForProductSurface(
      makePresenterResponse({ noForecast: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/noForecast/);
  });

  it("T74.6.4 — rejects noRecommendation !== true", () => {
    const r = validateCrossAxisPresenterForProductSurface(
      makePresenterResponse({ noRecommendation: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/noRecommendation/);
  });

  it("T74.6.5 — rejects previewOnly !== true", () => {
    const r = validateCrossAxisPresenterForProductSurface(
      makePresenterResponse({ previewOnly: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/previewOnly/);
  });

  it("T74.6.6 — rejects paperOnly !== true", () => {
    const r = validateCrossAxisPresenterForProductSurface(
      makePresenterResponse({ paperOnly: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/paperOnly/);
  });

  it("T74.6.7 — rejects noExecution !== true", () => {
    const r = validateCrossAxisPresenterForProductSurface(
      makePresenterResponse({ noExecution: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/noExecution/);
  });

  it("T74.6.8 — rejects noActualMetrics !== true", () => {
    const r = validateCrossAxisPresenterForProductSurface(
      makePresenterResponse({ noActualMetrics: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/noActualMetrics/);
  });

  it("T74.6.9 — rejects entersAlphaScore !== false", () => {
    const r = validateCrossAxisPresenterForProductSurface(
      makePresenterResponse({ entersAlphaScore: true as unknown as false }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/entersAlphaScore/);
  });

  it("T74.6.10 — rejects notInvestmentAdvice !== true", () => {
    const r = validateCrossAxisPresenterForProductSurface(
      makePresenterResponse({ notInvestmentAdvice: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/notInvestmentAdvice/);
  });
});

// ─── T74.7 — Build Throws on Governance Violation ────────────────────────────

describe("T74.7 — build throws on governance violation", () => {
  it("T74.7.1 — throws when reviewOnly is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceResponse({
        presenterResponse: makePresenterResponse({ reviewOnly: false as unknown as true }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow(/reviewOnly/);
  });

  it("T74.7.2 — throws when previewOnly is false", () => {
    expect(() =>
      buildStockResearchProductSurfaceResponse({
        presenterResponse: makePresenterResponse({ previewOnly: false as unknown as true }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow(/previewOnly/);
  });

  it("T74.7.3 — throws when entersAlphaScore is true", () => {
    expect(() =>
      buildStockResearchProductSurfaceResponse({
        presenterResponse: makePresenterResponse({ entersAlphaScore: true as unknown as false }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow(/entersAlphaScore/);
  });
});

// ─── T74.8 — researchReview Section Mapping ───────────────────────────────────

describe("T74.8 — researchReview section mapping", () => {
  it("T74.8.1 — researchReview sectionLabel is 'Research Review'", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchReview.sectionLabel).toBe("Research Review");
  });

  it("T74.8.2 — researchReview cardCount equals number of researchCards in presenter", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchReview.cardCount).toBe(2);
  });

  it("T74.8.3 — researchReview cards array length equals cardCount", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchReview.cards.length).toBe(result.researchReview.cardCount);
  });
});

// ─── T74.9 — simulationInputAudit Section Mapping ────────────────────────────

describe("T74.9 — simulationInputAudit section mapping", () => {
  it("T74.9.1 — simulationInputAudit sectionLabel is 'Simulation Input Audit'", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationInputAudit.sectionLabel).toBe("Simulation Input Audit");
  });

  it("T74.9.2 — simulationInputAudit cardCount equals number of simulationAuditCards in presenter", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationInputAudit.cardCount).toBe(2);
  });

  it("T74.9.3 — simulationInputAudit cards array length equals cardCount", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationInputAudit.cards.length).toBe(result.simulationInputAudit.cardCount);
  });
});

// ─── T74.10 — surfaceSummary ──────────────────────────────────────────────────

describe("T74.10 — surfaceSummary counts", () => {
  it("T74.10.1 — surfaceSummary.researchCardCount equals researchCards length", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.surfaceSummary.researchCardCount).toBe(2);
  });

  it("T74.10.2 — surfaceSummary.simulationAuditCardCount equals simulationAuditCards length", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.surfaceSummary.simulationAuditCardCount).toBe(2);
  });

  it("T74.10.3 — surfaceSummary has exactly 2 keys", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.keys(result.surfaceSummary)).toHaveLength(2);
  });
});

// ─── T74.11 — Neutral Section Labels ─────────────────────────────────────────

describe("T74.11 — Neutral section labels", () => {
  it("T74.11.1 — researchReview.sectionLabel is 'Research Review'", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchReview.sectionLabel).toBe("Research Review");
  });

  it("T74.11.2 — simulationInputAudit.sectionLabel is 'Simulation Input Audit'", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationInputAudit.sectionLabel).toBe("Simulation Input Audit");
  });
});

// ─── T74.12 — No Merged Score / Verdict / Recommendation ─────────────────────

describe("T74.12 — No merged score / verdict / recommendation", () => {
  it("T74.12.1 — response has no 'score' key", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect("score" in result).toBe(false);
  });

  it("T74.12.2 — response has no 'verdict' key", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect("verdict" in result).toBe(false);
  });

  it("T74.12.3 — response has no 'recommendation' key", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect("recommendation" in result).toBe(false);
  });
});

// ─── T74.13 — JSON Serializable ───────────────────────────────────────────────

describe("T74.13 — JSON serializable", () => {
  it("T74.13.1 — JSON.stringify does not throw", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("T74.13.2 — JSON output is non-empty string", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const json = JSON.stringify(result);
    expect(json.length).toBeGreaterThan(0);
  });

  it("T74.13.3 — surfaceVersion survives JSON round-trip", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const parsed = JSON.parse(JSON.stringify(result)) as StockResearchProductSurfaceResponse;
    expect(parsed.surfaceVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_VERSION);
  });
});

// ─── T74.14 — Deterministic ───────────────────────────────────────────────────

describe("T74.14 — Deterministic repeated calls", () => {
  it("T74.14.1 — same fixedGeneratedAt produces same generatedAt", () => {
    const r1 = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const r2 = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r1.generatedAt).toBe(r2.generatedAt);
  });

  it("T74.14.2 — same input produces same surfaceSummary counts", () => {
    const r1 = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const r2 = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r1.surfaceSummary.researchCardCount).toBe(r2.surfaceSummary.researchCardCount);
    expect(r1.surfaceSummary.simulationAuditCardCount).toBe(r2.surfaceSummary.simulationAuditCardCount);
  });
});

// ─── T74.15 — Input Not Mutated ───────────────────────────────────────────────

describe("T74.15 — Input not mutated", () => {
  it("T74.15.1 — input researchCards array is unchanged after build", () => {
    const input = makePresenterResponse();
    const originalLength = input.researchCards.length;
    buildStockResearchProductSurfaceResponse({
      presenterResponse: input,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(input.researchCards.length).toBe(originalLength);
  });

  it("T74.15.2 — input simulationAuditCards array is unchanged after build", () => {
    const input = makePresenterResponse();
    const originalLength = input.simulationAuditCards.length;
    buildStockResearchProductSurfaceResponse({
      presenterResponse: input,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(input.simulationAuditCards.length).toBe(originalLength);
  });
});

// ─── T74.16 — Frozen Input Supported ─────────────────────────────────────────

describe("T74.16 — Frozen input supported", () => {
  it("T74.16.1 — accepts frozen presenter response without throwing", () => {
    const frozen = Object.freeze(makePresenterResponse());
    expect(() =>
      buildStockResearchProductSurfaceResponse({
        presenterResponse: frozen,
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T74.16.2 — accepts empty frozen presenter response without throwing", () => {
    const frozen = Object.freeze(makeEmptyPresenterResponse());
    expect(() =>
      buildStockResearchProductSurfaceResponse({
        presenterResponse: frozen,
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });
});

// ─── T74.17 — Output Frozen ───────────────────────────────────────────────────

describe("T74.17 — Output frozen", () => {
  it("T74.17.1 — response object is frozen", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("T74.17.2 — researchReview section is frozen", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(result.researchReview)).toBe(true);
  });

  it("T74.17.3 — simulationInputAudit section is frozen", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(result.simulationInputAudit)).toBe(true);
  });
});

// ─── T74.18 — surfaceVersion Field ───────────────────────────────────────────

describe("T74.18 — surfaceVersion field", () => {
  it("T74.18.1 — surfaceVersion field is present in response", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect("surfaceVersion" in result).toBe(true);
  });

  it("T74.18.2 — surfaceVersion value equals version constant", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.surfaceVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_CONTRACT_VERSION);
  });
});

// ─── T74.19 — Source Text: Forbidden Imports ──────────────────────────────────

describe("T74.19 — Source text: forbidden imports", () => {
  it("T74.19.1 — no Prisma import (import @prisma/client)", () => {
    expect(sourceText).not.toMatch(/from\s+["']@prisma\/client["']/);
    expect(sourceText).not.toMatch(/require\(["']@prisma\/client["']\)/);
  });

  it("T74.19.2 — no child_process import (check non-comment lines)", () => {
    const codeLines = sourceText.split("\n").filter((line) => {
      const t = line.trim();
      return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
    });
    const code = codeLines.join("\n");
    expect(code).not.toMatch(/child_process/);
  });

  it("T74.19.3 — no fs import", () => {
    expect(sourceText).not.toMatch(/from\s+["']fs["']/);
    expect(sourceText).not.toMatch(/require\(["']fs["']\)/);
  });

  it("T74.19.4 — no path import", () => {
    expect(sourceText).not.toMatch(/from\s+["']path["']/);
    expect(sourceText).not.toMatch(/require\(["']path["']\)/);
  });

  it("T74.19.5 — no http / https / fetch import", () => {
    expect(sourceText).not.toMatch(/from\s+["']https?["']/);
    expect(sourceText).not.toMatch(/require\(["']https?["']\)/);
    expect(sourceText).not.toMatch(/\bimport\s+fetch\b/);
  });
});

// ─── T74.20 — No onlineValidation Runtime Import ──────────────────────────────

describe("T74.20 — No onlineValidation runtime import", () => {
  it("T74.20.1 — no runtime onlineValidation import", () => {
    const importLines = sourceText
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));
    const hasOnlineValidationImport = importLines.some((line) =>
      /onlineValidation/.test(line),
    );
    expect(hasOnlineValidationImport).toBe(false);
  });
});

// ─── T74.21 — All Imports Are import type ────────────────────────────────────

describe("T74.21 — All production imports are import type", () => {
  it("T74.21.1 — every import line uses import type (no bare import {{ ... }})", () => {
    const importLines = sourceText
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));
    const bareImports = importLines.filter(
      (line) => !line.trim().startsWith("import type"),
    );
    expect(bareImports).toHaveLength(0);
  });
});

// ─── T74.22 — Forbidden Export Names ─────────────────────────────────────────

describe("T74.22 — Forbidden export names", () => {
  it("T74.22.1 — no exported function named run, execute, or simulate", () => {
    expect(sourceText).not.toMatch(/export\s+function\s+(run|execute|simulate)\b/);
  });

  it("T74.22.2 — no exported function named score, optimize, or backtest", () => {
    expect(sourceText).not.toMatch(/export\s+function\s+(score|optimize|backtest)\b/);
  });

  it("T74.22.3 — no exported function named recommend", () => {
    expect(sourceText).not.toMatch(/export\s+function\s+recommend\b/);
  });
});

// ─── T74.23 — Forbidden Financial Field References ────────────────────────────

describe("T74.23 — Forbidden financial / action field references", () => {
  it("T74.23.1 — no ROI or roi as output property key", () => {
    expect(sourceText).not.toMatch(/\broi\s*:/i);
  });

  it("T74.23.2 — no PnL or pnl as output property key", () => {
    expect(sourceText).not.toMatch(/\bpnl\s*:/i);
  });

  it("T74.23.3 — no targetPrice as output property key", () => {
    expect(sourceText).not.toMatch(/\btargetPrice\s*:/);
  });
});

// ─── T74.24 — Forbidden Action Semantics ─────────────────────────────────────

describe("T74.24 — Forbidden action semantics", () => {
  it("T74.24.1 — no buy or sell as output property key", () => {
    expect(sourceText).not.toMatch(/\b(buy|sell)\s*:/i);
  });

  it("T74.24.2 — no action as output property key", () => {
    expect(sourceText).not.toMatch(/\baction\s*:/);
  });
});

// ─── T74.25 — cardCount Matches cards.length ──────────────────────────────────

describe("T74.25 — cardCount matches cards.length in each section", () => {
  it("T74.25.1 — researchReview.cardCount matches researchReview.cards.length", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchReview.cardCount).toBe(result.researchReview.cards.length);
  });

  it("T74.25.2 — simulationInputAudit.cardCount matches simulationInputAudit.cards.length", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationInputAudit.cardCount).toBe(result.simulationInputAudit.cards.length);
  });
});

// ─── T74.26 — Zero-card Sections ─────────────────────────────────────────────

describe("T74.26 — Zero-card sections", () => {
  it("T74.26.1 — empty presenter produces researchReview.cardCount = 0", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makeEmptyPresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchReview.cardCount).toBe(0);
  });

  it("T74.26.2 — empty presenter produces simulationInputAudit.cardCount = 0", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makeEmptyPresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationInputAudit.cardCount).toBe(0);
  });

  it("T74.26.3 — empty presenter surfaceSummary = { researchCardCount: 0, simulationAuditCardCount: 0 }", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makeEmptyPresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.surfaceSummary.researchCardCount).toBe(0);
    expect(result.surfaceSummary.simulationAuditCardCount).toBe(0);
  });
});

// ─── T74.27 — Governance Flags in Response ────────────────────────────────────

describe("T74.27 — Governance flags present in response", () => {
  it("T74.27.1 — response.reviewOnly is true", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.reviewOnly).toBe(true);
  });

  it("T74.27.2 — response.noInvestmentAdvice is true", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.noInvestmentAdvice).toBe(true);
  });

  it("T74.27.3 — response.entersAlphaScore is false", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.entersAlphaScore).toBe(false);
  });

  it("T74.27.4 — response.noForecast is true", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.noForecast).toBe(true);
  });

  it("T74.27.5 — response.paperOnly is true", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.paperOnly).toBe(true);
  });
});

// ─── T74.28 — Card Note Preservation ─────────────────────────────────────────

describe("T74.28 — Card note preservation", () => {
  it("T74.28.1 — research card with note has note in output section", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const cardWithNote = result.researchReview.cards.find((c) => c.sourceName === "ResearchSourceB");
    expect(cardWithNote?.note).toBe("excluded note");
  });

  it("T74.28.2 — simulation card with note has note in output section", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const cardWithNote = result.simulationInputAudit.cards.find((c) => c.sourceName === "SimSourceB");
    expect(cardWithNote?.note).toBe("blocked note");
  });

  it("T74.28.3 — research card without note has no note key in output", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const cardNoNote = result.researchReview.cards.find((c) => c.sourceName === "ResearchSourceA");
    expect("note" in (cardNoNote ?? {})).toBe(false);
  });
});

// ─── T74.29 — surfaceSummary Frozen ───────────────────────────────────────────

describe("T74.29 — surfaceSummary frozen", () => {
  it("T74.29.1 — surfaceSummary is frozen", () => {
    const result = buildStockResearchProductSurfaceResponse({
      presenterResponse: makePresenterResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(result.surfaceSummary)).toBe(true);
  });
});

// ─── T74.30 — Source Text: Version Prefix ────────────────────────────────────

describe("T74.30 — Source text: version prefix", () => {
  it("T74.30.1 — source contains p74 version string literal", () => {
    expect(sourceText).toContain("p74-stock-research-product-surface-contract-v0");
  });
});
