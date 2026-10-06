/**
 * P76 — Stock Research Product Surface Sample Report Contract
 * Test Suite: T76.1 – T76.30
 * Total: 93 tests
 */

import * as fs from "fs";
import * as path from "path";

import type {
  StockResearchProductSurfaceExportResponse,
  StockResearchProductSurfaceExportSection,
} from "../composition/StockResearchProductSurfaceExportContract";

import {
  STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_VERSION,
  STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE,
  validateProductSurfaceExportForSampleReport,
  buildStockResearchProductSurfaceSampleReport,
} from "../composition/StockResearchProductSurfaceSampleReportContract";

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_PATH = path.resolve(
  __dirname,
  "../composition/StockResearchProductSurfaceSampleReportContract.ts",
);
const FIXED_AT = "2026-05-26T00:00:00.000Z";
const FIXED_AT_2 = "2026-01-01T12:00:00.000Z";
const P75_EXPORT_VERSION =
  "p75-stock-research-product-surface-export-contract-v0" as const;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSection(
  sectionLabel: string,
  withNote: string,
  withoutNote: boolean,
): StockResearchProductSurfaceExportSection {
  const cards: { sourceName: string; label: string; status: string; note?: string }[] = [
    { sourceName: "SourceA", label: "Label A", status: "ok", note: withNote },
  ];
  if (withoutNote) {
    cards.push({ sourceName: "SourceB", label: "Label B", status: "ok" });
  }
  return Object.freeze({
    sectionLabel,
    cards: Object.freeze(cards),
    cardCount: cards.length,
  });
}

function makeExportResponse(
  overrides?: Partial<StockResearchProductSurfaceExportResponse>,
): StockResearchProductSurfaceExportResponse {
  const researchSection = makeSection("Research Review", "Axis A note", true);
  const simSection = makeSection("Simulation Input Audit", "Axis B note", true);
  return Object.freeze({
    exportVersion: P75_EXPORT_VERSION,
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
    reportTitle: "Stock Research Product Surface Export",
    researchReviewSection: researchSection,
    simulationInputAuditSection: simSection,
    exportSummary: Object.freeze({
      researchCardCount: 2,
      simulationAuditCardCount: 2,
    }),
    ...overrides,
  } as StockResearchProductSurfaceExportResponse);
}

function makeEmptyExportResponse(): StockResearchProductSurfaceExportResponse {
  const emptySection = (label: string): StockResearchProductSurfaceExportSection =>
    Object.freeze({
      sectionLabel: label,
      cards: Object.freeze([]),
      cardCount: 0,
    });
  return Object.freeze({
    exportVersion: P75_EXPORT_VERSION,
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
    reportTitle: "Stock Research Product Surface Export",
    researchReviewSection: emptySection("Research Review"),
    simulationInputAuditSection: emptySection("Simulation Input Audit"),
    exportSummary: Object.freeze({
      researchCardCount: 0,
      simulationAuditCardCount: 0,
    }),
  });
}

// ─── Source text helpers ──────────────────────────────────────────────────────

function readSourceLines(): string[] {
  return fs.readFileSync(SOURCE_PATH, "utf-8").split("\n");
}

function readSourceNonComment(): string {
  return readSourceLines()
    .filter((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith("*") &&
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("/*")
      );
    })
    .join("\n");
}

// ─── T76.1 — Version ──────────────────────────────────────────────────────────

describe("T76.1 — version constant and reportVersion field", () => {
  it("T76.1.1 — version constant equals exact expected string", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_VERSION).toBe(
      "p76-stock-research-product-surface-sample-report-contract-v0",
    );
  });

  it("T76.1.2 — version starts with p76- prefix", () => {
    expect(
      STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_VERSION.startsWith("p76-"),
    ).toBe(true);
  });

  it("T76.1.3 — response.reportVersion equals version constant", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.reportVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_VERSION);
  });
});

// ─── T76.2 — Governance constants ─────────────────────────────────────────────

describe("T76.2 — governance constant all 10 flags and frozen", () => {
  it("T76.2.1 — reviewOnly is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE.reviewOnly).toBe(true);
  });
  it("T76.2.2 — noInvestmentAdvice is true", () => {
    expect(
      STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE.noInvestmentAdvice,
    ).toBe(true);
  });
  it("T76.2.3 — noForecast is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE.noForecast).toBe(true);
  });
  it("T76.2.4 — noRecommendation is true", () => {
    expect(
      STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE.noRecommendation,
    ).toBe(true);
  });
  it("T76.2.5 — previewOnly is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE.previewOnly).toBe(
      true,
    );
  });
  it("T76.2.6 — paperOnly is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE.paperOnly).toBe(true);
  });
  it("T76.2.7 — noExecution is true", () => {
    expect(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE.noExecution).toBe(
      true,
    );
  });
  it("T76.2.8 — noActualMetrics is true", () => {
    expect(
      STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE.noActualMetrics,
    ).toBe(true);
  });
  it("T76.2.9 — entersAlphaScore is false", () => {
    expect(
      STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE.entersAlphaScore,
    ).toBe(false);
  });
  it("T76.2.10 — notInvestmentAdvice is true", () => {
    expect(
      STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE.notInvestmentAdvice,
    ).toBe(true);
  });
  it("T76.2.11 — governance constant is frozen", () => {
    expect(
      Object.isFrozen(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_GOVERNANCE),
    ).toBe(true);
  });
});

// ─── T76.3 — generatedAt ──────────────────────────────────────────────────────

describe("T76.3 — generatedAt field", () => {
  it("T76.3.1 — uses fixedGeneratedAt when provided", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.generatedAt).toBe(FIXED_AT);
  });

  it("T76.3.2 — uses alternate fixedGeneratedAt", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT_2,
    });
    expect(r.generatedAt).toBe(FIXED_AT_2);
  });

  it("T76.3.3 — uses current ISO string when no fixedGeneratedAt", () => {
    const before = Date.now();
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
    });
    const after = Date.now();
    const ts = new Date(r.generatedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ─── T76.4 — Accepts valid P75 export response ────────────────────────────────

describe("T76.4 — accepts valid P75 export response", () => {
  it("T76.4.1 — does not throw for a valid export response", () => {
    expect(() =>
      buildStockResearchProductSurfaceSampleReport({
        surfaceExportResponse: makeExportResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T76.4.2 — returns an object", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(typeof r).toBe("object");
    expect(r).not.toBeNull();
  });

  it("T76.4.3 — accepts frozen export response", () => {
    const frozen = makeExportResponse();
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() =>
      buildStockResearchProductSurfaceSampleReport({
        surfaceExportResponse: frozen,
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });
});

// ─── T76.5 — validator returns valid: true ────────────────────────────────────

describe("T76.5 — validator returns { valid: true } for valid response", () => {
  it("T76.5.1 — validator returns { valid: true }", () => {
    const result = validateProductSurfaceExportForSampleReport(makeExportResponse());
    expect(result.valid).toBe(true);
  });

  it("T76.5.2 — valid result has no reason field", () => {
    const result = validateProductSurfaceExportForSampleReport(makeExportResponse());
    expect("reason" in result).toBe(false);
  });
});

// ─── T76.6 — Rejects each of 10 bad flags ────────────────────────────────────

describe("T76.6 — validator rejects each bad governance flag", () => {
  it("T76.6.1 — rejects reviewOnly=false", () => {
    const r = validateProductSurfaceExportForSampleReport(
      makeExportResponse({ reviewOnly: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
  });

  it("T76.6.2 — rejects noInvestmentAdvice=false", () => {
    const r = validateProductSurfaceExportForSampleReport(
      makeExportResponse({ noInvestmentAdvice: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
  });

  it("T76.6.3 — rejects noForecast=false", () => {
    const r = validateProductSurfaceExportForSampleReport(
      makeExportResponse({ noForecast: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
  });

  it("T76.6.4 — rejects noRecommendation=false", () => {
    const r = validateProductSurfaceExportForSampleReport(
      makeExportResponse({ noRecommendation: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
  });

  it("T76.6.5 — rejects previewOnly=false", () => {
    const r = validateProductSurfaceExportForSampleReport(
      makeExportResponse({ previewOnly: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
  });

  it("T76.6.6 — rejects paperOnly=false", () => {
    const r = validateProductSurfaceExportForSampleReport(
      makeExportResponse({ paperOnly: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
  });

  it("T76.6.7 — rejects noExecution=false", () => {
    const r = validateProductSurfaceExportForSampleReport(
      makeExportResponse({ noExecution: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
  });

  it("T76.6.8 — rejects noActualMetrics=false", () => {
    const r = validateProductSurfaceExportForSampleReport(
      makeExportResponse({ noActualMetrics: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
  });

  it("T76.6.9 — rejects entersAlphaScore=true", () => {
    const r = validateProductSurfaceExportForSampleReport(
      makeExportResponse({ entersAlphaScore: true as unknown as false }),
    );
    expect(r.valid).toBe(false);
  });

  it("T76.6.10 — rejects notInvestmentAdvice=false", () => {
    const r = validateProductSurfaceExportForSampleReport(
      makeExportResponse({ notInvestmentAdvice: false as unknown as true }),
    );
    expect(r.valid).toBe(false);
  });
});

// ─── T76.7 — build throws on governance violation ─────────────────────────────

describe("T76.7 — build throws on governance violation", () => {
  it("T76.7.1 — throws when reviewOnly=false", () => {
    expect(() =>
      buildStockResearchProductSurfaceSampleReport({
        surfaceExportResponse: makeExportResponse({ reviewOnly: false as unknown as true }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow();
  });

  it("T76.7.2 — throws when entersAlphaScore=true", () => {
    expect(() =>
      buildStockResearchProductSurfaceSampleReport({
        surfaceExportResponse: makeExportResponse({
          entersAlphaScore: true as unknown as false,
        }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow();
  });

  it("T76.7.3 — thrown error message contains the flag name", () => {
    let message = "";
    try {
      buildStockResearchProductSurfaceSampleReport({
        surfaceExportResponse: makeExportResponse({
          noForecast: false as unknown as true,
        }),
        fixedGeneratedAt: FIXED_AT,
      });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("noForecast");
  });
});

// ─── T76.8 — researchReviewBlock mapping ──────────────────────────────────────

describe("T76.8 — researchReviewBlock mapping", () => {
  it("T76.8.1 — researchReviewBlock.blockLabel is 'Research Review'", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.researchReviewBlock.blockLabel).toBe("Research Review");
  });

  it("T76.8.2 — researchReviewBlock.cardCount matches source section", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.researchReviewBlock.cardCount).toBe(2);
  });

  it("T76.8.3 — researchReviewBlock.cards.length matches cardCount", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.researchReviewBlock.cards.length).toBe(r.researchReviewBlock.cardCount);
  });
});

// ─── T76.9 — simulationInputAuditBlock mapping ────────────────────────────────

describe("T76.9 — simulationInputAuditBlock mapping", () => {
  it("T76.9.1 — simulationInputAuditBlock.blockLabel is 'Simulation Input Audit'", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.simulationInputAuditBlock.blockLabel).toBe("Simulation Input Audit");
  });

  it("T76.9.2 — simulationInputAuditBlock.cardCount matches source section", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.simulationInputAuditBlock.cardCount).toBe(2);
  });

  it("T76.9.3 — simulationInputAuditBlock.cards.length matches cardCount", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.simulationInputAuditBlock.cards.length).toBe(
      r.simulationInputAuditBlock.cardCount,
    );
  });
});

// ─── T76.10 — summaryBlock ────────────────────────────────────────────────────

describe("T76.10 — summaryBlock counts and exactly 2 keys", () => {
  it("T76.10.1 — summaryBlock.researchCardCount equals 2", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.summaryBlock.researchCardCount).toBe(2);
  });

  it("T76.10.2 — summaryBlock.simulationAuditCardCount equals 2", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.summaryBlock.simulationAuditCardCount).toBe(2);
  });

  it("T76.10.3 — summaryBlock has exactly 2 keys", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.keys(r.summaryBlock).length).toBe(2);
  });
});

// ─── T76.11 — disclaimerBlock lines ───────────────────────────────────────────

describe("T76.11 — disclaimerBlock lines contain required text", () => {
  it("T76.11.1 — lines contain no-advice text", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const combined = r.disclaimerBlock.lines.join(" ");
    expect(combined).toContain("not investment advice");
  });

  it("T76.11.2 — lines contain no-forecast text", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const combined = r.disclaimerBlock.lines.join(" ");
    expect(combined).toContain("No forecast");
  });

  it("T76.11.3 — lines contain no-execution text", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const combined = r.disclaimerBlock.lines.join(" ");
    expect(combined).toContain("No trading execution");
  });
});

// ─── T76.12 — Neutral block labels ────────────────────────────────────────────

describe("T76.12 — neutral block labels (no advisory semantics)", () => {
  it("T76.12.1 — researchReviewBlock.blockLabel has no buy/sell/score/recommend/forecast", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const label = r.researchReviewBlock.blockLabel.toLowerCase();
    expect(label).not.toMatch(/buy|sell|score|recommend|forecast/);
  });

  it("T76.12.2 — simulationInputAuditBlock.blockLabel has no buy/sell/score/recommend/forecast", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const label = r.simulationInputAuditBlock.blockLabel.toLowerCase();
    expect(label).not.toMatch(/buy|sell|score|recommend|forecast/);
  });
});

// ─── T76.13 — No merged score/verdict/recommendation ─────────────────────────

describe("T76.13 — no merged score, verdict, or recommendation fields", () => {
  it("T76.13.1 — response has no mergedScore field", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    }) as Record<string, unknown>;
    expect("mergedScore" in r).toBe(false);
  });

  it("T76.13.2 — response has no verdict field", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    }) as Record<string, unknown>;
    expect("verdict" in r).toBe(false);
  });

  it("T76.13.3 — response has no recommendation field", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    }) as Record<string, unknown>;
    expect("recommendation" in r).toBe(false);
  });
});

// ─── T76.14 — JSON serializable ───────────────────────────────────────────────

describe("T76.14 — JSON serializable and round-trip reportVersion", () => {
  it("T76.14.1 — response is JSON serializable without throwing", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(() => JSON.stringify(r)).not.toThrow();
  });

  it("T76.14.2 — JSON round-trip preserves reportVersion", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const parsed = JSON.parse(JSON.stringify(r)) as { reportVersion: string };
    expect(parsed.reportVersion).toBe(
      STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_VERSION,
    );
  });

  it("T76.14.3 — JSON round-trip preserves generatedAt", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const parsed = JSON.parse(JSON.stringify(r)) as { generatedAt: string };
    expect(parsed.generatedAt).toBe(FIXED_AT);
  });
});

// ─── T76.15 — Deterministic repeated calls ────────────────────────────────────

describe("T76.15 — deterministic repeated calls", () => {
  it("T76.15.1 — two calls with same fixedGeneratedAt produce same reportVersion", () => {
    const params = { surfaceExportResponse: makeExportResponse(), fixedGeneratedAt: FIXED_AT };
    const r1 = buildStockResearchProductSurfaceSampleReport(params);
    const r2 = buildStockResearchProductSurfaceSampleReport(params);
    expect(r1.reportVersion).toBe(r2.reportVersion);
  });

  it("T76.15.2 — two calls with same fixedGeneratedAt produce same generatedAt", () => {
    const params = { surfaceExportResponse: makeExportResponse(), fixedGeneratedAt: FIXED_AT };
    const r1 = buildStockResearchProductSurfaceSampleReport(params);
    const r2 = buildStockResearchProductSurfaceSampleReport(params);
    expect(r1.generatedAt).toBe(r2.generatedAt);
  });
});

// ─── T76.16 — Input not mutated ───────────────────────────────────────────────

describe("T76.16 — input not mutated", () => {
  it("T76.16.1 — export response fields are unchanged after build", () => {
    const exp = makeExportResponse();
    const beforeResearchCount = exp.researchReviewSection.cardCount;
    buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: exp,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(exp.researchReviewSection.cardCount).toBe(beforeResearchCount);
  });

  it("T76.16.2 — export response cards are unchanged after build", () => {
    const exp = makeExportResponse();
    const beforeLen = exp.researchReviewSection.cards.length;
    buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: exp,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(exp.researchReviewSection.cards.length).toBe(beforeLen);
  });
});

// ─── T76.17 — Frozen input supported ─────────────────────────────────────────

describe("T76.17 — frozen input is accepted", () => {
  it("T76.17.1 — build does not throw when given frozen export response", () => {
    const frozen = Object.freeze(makeExportResponse());
    expect(() =>
      buildStockResearchProductSurfaceSampleReport({
        surfaceExportResponse: frozen,
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T76.17.2 — result is valid when given deeply frozen input", () => {
    const frozen = makeExportResponse();
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: frozen,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.reportVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_VERSION);
  });
});

// ─── T76.18 — Output frozen ───────────────────────────────────────────────────

describe("T76.18 — output objects are frozen", () => {
  it("T76.18.1 — top-level response is frozen", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("T76.18.2 — disclaimerBlock is frozen", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(r.disclaimerBlock)).toBe(true);
  });

  it("T76.18.3 — researchReviewBlock is frozen", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(r.researchReviewBlock)).toBe(true);
  });

  it("T76.18.4 — simulationInputAuditBlock is frozen", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(r.simulationInputAuditBlock)).toBe(true);
  });

  it("T76.18.5 — summaryBlock is frozen", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(r.summaryBlock)).toBe(true);
  });
});

// ─── T76.19 — reportVersion field ────────────────────────────────────────────

describe("T76.19 — reportVersion field is present and correct", () => {
  it("T76.19.1 — response has reportVersion field", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    }) as Record<string, unknown>;
    expect("reportVersion" in r).toBe(true);
  });

  it("T76.19.2 — reportVersion equals the version constant", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.reportVersion).toBe(STOCK_RESEARCH_PRODUCT_SURFACE_SAMPLE_REPORT_CONTRACT_VERSION);
  });
});

// ─── T76.20 — Source text: forbidden dependencies ─────────────────────────────

describe("T76.20 — source text has no forbidden dependencies", () => {
  it("T76.20.1 — no Prisma client import", () => {
    const src = fs.readFileSync(SOURCE_PATH, "utf-8");
    expect(src).not.toMatch(/from ['"]@prisma\/client['"]/);
  });

  it("T76.20.2 — no child_process import (non-comment lines)", () => {
    const src = readSourceNonComment();
    expect(src).not.toContain("child_process");
  });

  it("T76.20.3 — no fs import", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/from ['"]fs['"]/);
  });

  it("T76.20.4 — no path import", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/from ['"]path['"]/);
  });

  it("T76.20.5 — no http/https import", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/from ['"]https?['"]/);
  });
});

// ─── T76.21 — No onlineValidation runtime import ──────────────────────────────

describe("T76.21 — no onlineValidation runtime import", () => {
  it("T76.21.1 — source does not import from onlineValidation runtime", () => {
    const src = fs.readFileSync(SOURCE_PATH, "utf-8");
    expect(src).not.toContain("onlineValidation");
  });
});

// ─── T76.22 — All imports are import type ─────────────────────────────────────

describe("T76.22 — all production imports are import type", () => {
  it("T76.22.1 — no bare import { } from non-type in source", () => {
    const lines = readSourceLines().filter((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith("*") &&
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("/*")
      );
    });
    const bareImports = lines.filter(
      (line) =>
        /^\s*import\s+\{/.test(line) && !/^\s*import\s+type\s+\{/.test(line),
    );
    expect(bareImports).toHaveLength(0);
  });
});

// ─── T76.23 — Forbidden export names ──────────────────────────────────────────

describe("T76.23 — forbidden export names absent from source", () => {
  it("T76.23.1 — no export named run/execute/simulate", () => {
    const src = fs.readFileSync(SOURCE_PATH, "utf-8");
    expect(src).not.toMatch(/export\s+function\s+(run|execute|simulate)\b/);
  });

  it("T76.23.2 — no export named score/optimize/backtest", () => {
    const src = fs.readFileSync(SOURCE_PATH, "utf-8");
    expect(src).not.toMatch(/export\s+function\s+(score|optimize|backtest)\b/);
  });

  it("T76.23.3 — no export named recommend", () => {
    const src = fs.readFileSync(SOURCE_PATH, "utf-8");
    expect(src).not.toMatch(/export\s+function\s+recommend\b/);
  });
});

// ─── T76.24 — Forbidden financial field references ────────────────────────────

describe("T76.24 — forbidden financial field references absent from source", () => {
  it("T76.24.1 — no roi reference in source (non-comment)", () => {
    const src = readSourceNonComment().toLowerCase();
    expect(src).not.toMatch(/\broi\b/);
  });

  it("T76.24.2 — no pnl reference in source (non-comment)", () => {
    const src = readSourceNonComment().toLowerCase();
    expect(src).not.toMatch(/\bpnl\b/);
  });

  it("T76.24.3 — no targetPrice reference in source (non-comment)", () => {
    const src = readSourceNonComment();
    expect(src).not.toContain("targetPrice");
  });
});

// ─── T76.25 — Forbidden action semantics ──────────────────────────────────────

describe("T76.25 — forbidden action semantics absent from source", () => {
  it("T76.25.1 — no buy/sell keyword in source (non-comment)", () => {
    const src = readSourceNonComment().toLowerCase();
    expect(src).not.toMatch(/\b(buy|sell)\b/);
  });

  it("T76.25.2 — no action field name in source (non-comment)", () => {
    const src = readSourceNonComment();
    expect(src).not.toMatch(/\baction\s*:/);
  });
});

// ─── T76.26 — cardCount matches cards.length ──────────────────────────────────

describe("T76.26 — cardCount matches cards.length for both blocks", () => {
  it("T76.26.1 — researchReviewBlock.cardCount === cards.length", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.researchReviewBlock.cardCount).toBe(r.researchReviewBlock.cards.length);
  });

  it("T76.26.2 — simulationInputAuditBlock.cardCount === cards.length", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.simulationInputAuditBlock.cardCount).toBe(
      r.simulationInputAuditBlock.cards.length,
    );
  });
});

// ─── T76.27 — Zero-card report ────────────────────────────────────────────────

describe("T76.27 — zero-card export produces zero-card report", () => {
  it("T76.27.1 — researchReviewBlock.cardCount is 0 for empty export", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeEmptyExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.researchReviewBlock.cardCount).toBe(0);
  });

  it("T76.27.2 — simulationInputAuditBlock.cardCount is 0 for empty export", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeEmptyExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.simulationInputAuditBlock.cardCount).toBe(0);
  });

  it("T76.27.3 — summaryBlock counts are 0 for empty export", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeEmptyExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.summaryBlock.researchCardCount).toBe(0);
    expect(r.summaryBlock.simulationAuditCardCount).toBe(0);
  });
});

// ─── T76.28 — Governance flags in response ────────────────────────────────────

describe("T76.28 — governance flags present in response", () => {
  it("T76.28.1 — response.reviewOnly is true", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.reviewOnly).toBe(true);
  });

  it("T76.28.2 — response.noInvestmentAdvice is true", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.noInvestmentAdvice).toBe(true);
  });

  it("T76.28.3 — response.noForecast is true", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.noForecast).toBe(true);
  });

  it("T76.28.4 — response.entersAlphaScore is false", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.entersAlphaScore).toBe(false);
  });

  it("T76.28.5 — response.notInvestmentAdvice is true", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r.notInvestmentAdvice).toBe(true);
  });
});

// ─── T76.29 — Card note preservation ─────────────────────────────────────────

describe("T76.29 — card note is preserved or absent correctly", () => {
  it("T76.29.1 — card with note has note preserved in researchReviewBlock", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const card = r.researchReviewBlock.cards[0];
    expect(card.note).toBe("Axis A note");
  });

  it("T76.29.2 — card without note has no note key in researchReviewBlock", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const card = r.researchReviewBlock.cards[1] as Record<string, unknown>;
    expect("note" in card).toBe(false);
  });

  it("T76.29.3 — card with note has note preserved in simulationInputAuditBlock", () => {
    const r = buildStockResearchProductSurfaceSampleReport({
      surfaceExportResponse: makeExportResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const card = r.simulationInputAuditBlock.cards[0];
    expect(card.note).toBe("Axis B note");
  });
});

// ─── T76.30 — Source text version prefix ─────────────────────────────────────

describe("T76.30 — source text contains version prefix", () => {
  it("T76.30.1 — source text contains p76- version prefix", () => {
    const src = fs.readFileSync(SOURCE_PATH, "utf-8");
    expect(src).toContain("p76-stock-research-product-surface-sample-report-contract-v0");
  });
});
