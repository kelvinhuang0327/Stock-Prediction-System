/**
 * P73 — Cross-Axis Review Display Presenter Tests
 *
 * Tests for CrossAxisReviewDisplayPresenter.ts (P73).
 * Covers: version, governance, generatedAt, validation, build, researchCards,
 *         simulationAuditCards, presenterSummary, determinism, mutation-safety,
 *         frozen input support, forbidden field scans, and source-text governance scans.
 *
 * Test groups: T73.1 – T73.24 (78 tests total)
 *
 * GOVERNANCE: reviewOnly=true, noInvestmentAdvice=true, noForecast=true,
 * noRecommendation=true, previewOnly=true, paperOnly=true, noExecution=true,
 * noActualMetrics=true, entersAlphaScore=false, notInvestmentAdvice=true.
 */

import * as fs from "fs";
import * as path from "path";
import type { CrossAxisReviewDisplayContainerResponse } from "@/lib/research/composition/CrossAxisReviewDisplayContainer";
import { CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_VERSION } from "@/lib/research/composition/CrossAxisReviewDisplayContainer";
import {
  CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_VERSION,
  CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE,
  validateCrossAxisReviewDisplayContainerForPresenter,
  presentCrossAxisReviewDisplayContainer,
} from "@/lib/research/composition/CrossAxisReviewDisplayPresenter";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIXED_AT = "2026-05-26T00:00:00.000Z";
const FIXED_AT_2 = "2026-01-01T12:00:00.000Z";

function makeContainerResponse(
  overrides: Record<string, unknown> = {},
): CrossAxisReviewDisplayContainerResponse {
  return {
    version: CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_VERSION,
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
    researchSection: {
      axis: "AXIS_A_RESEARCH_REVIEW",
      version: "p68-axis-a-research-snapshot-review-response-formatter-v0",
      displayRows: [
        {
          sourceName: "ResearchSourceA",
          rowType: "INCLUDED",
          includeInDisplay: true,
        },
        {
          sourceName: "ResearchSourceB",
          rowType: "EXCLUDED",
          includeInDisplay: false,
          displayNote: "excluded from display",
        },
      ],
      summary: {
        totalDisplayRows: 2,
        includedEligibleCount: 1,
        includedLowConfidenceCount: 0,
        excludedCount: 1,
      },
    },
    simulationAuditSection: {
      axis: "AXIS_B_SIMULATION_INPUT_AUDIT",
      version: "p70-axis-b-simulation-input-bundle-audit-trail-formatter-v0",
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
      summary: {
        totalDisplayRows: 2,
        includedEligibleCount: 1,
        includedLowConfidenceCount: 0,
        excludedBlockedCount: 1,
        auditOnlyReferenceCount: 0,
      },
    },
    containerSummary: {
      researchRowCount: 2,
      simulationAuditRowCount: 2,
    },
    ...overrides,
  } as CrossAxisReviewDisplayContainerResponse;
}

function makeEmptyContainerResponse(): CrossAxisReviewDisplayContainerResponse {
  return {
    version: CROSS_AXIS_REVIEW_DISPLAY_CONTAINER_VERSION,
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
    researchSection: {
      axis: "AXIS_A_RESEARCH_REVIEW",
      version: "p68-axis-a-research-snapshot-review-response-formatter-v0",
      displayRows: [],
      summary: {
        totalDisplayRows: 0,
        includedEligibleCount: 0,
        includedLowConfidenceCount: 0,
        excludedCount: 0,
      },
    },
    simulationAuditSection: {
      axis: "AXIS_B_SIMULATION_INPUT_AUDIT",
      version: "p70-axis-b-simulation-input-bundle-audit-trail-formatter-v0",
      displayRows: [],
      summary: {
        totalDisplayRows: 0,
        includedEligibleCount: 0,
        includedLowConfidenceCount: 0,
        excludedBlockedCount: 0,
        auditOnlyReferenceCount: 0,
      },
    },
    containerSummary: {
      researchRowCount: 0,
      simulationAuditRowCount: 0,
    },
  } as CrossAxisReviewDisplayContainerResponse;
}

// ─── Source text (for governance scan tests) ──────────────────────────────────

const SOURCE_PATH = path.resolve(
  __dirname,
  "../composition/CrossAxisReviewDisplayPresenter.ts",
);
let sourceText = "";

beforeAll(() => {
  sourceText = fs.readFileSync(SOURCE_PATH, "utf-8");
});

// ─── T73.1 Version ────────────────────────────────────────────────────────────

describe("T73.1 Version", () => {
  it("T73.1.1 VERSION constant equals expected string", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_VERSION).toBe(
      "p73-cross-axis-review-display-presenter-v0",
    );
  });

  it("T73.1.2 VERSION contains p73 prefix", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_VERSION).toMatch(/^p73-/);
  });

  it("T73.1.3 presenter response version field matches VERSION constant", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.version).toBe(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_VERSION);
  });
});

// ─── T73.2 Governance constants ───────────────────────────────────────────────

describe("T73.2 Governance constants", () => {
  it("T73.2.1 reviewOnly === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE.reviewOnly).toBe(true);
  });

  it("T73.2.2 noInvestmentAdvice === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE.noInvestmentAdvice).toBe(true);
  });

  it("T73.2.3 noForecast === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE.noForecast).toBe(true);
  });

  it("T73.2.4 noRecommendation === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE.noRecommendation).toBe(true);
  });

  it("T73.2.5 previewOnly === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE.previewOnly).toBe(true);
  });

  it("T73.2.6 paperOnly === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE.paperOnly).toBe(true);
  });

  it("T73.2.7 noExecution === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE.noExecution).toBe(true);
  });

  it("T73.2.8 noActualMetrics === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE.noActualMetrics).toBe(true);
  });

  it("T73.2.9 entersAlphaScore === false", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  it("T73.2.10 notInvestmentAdvice === true", () => {
    expect(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE.notInvestmentAdvice).toBe(true);
  });

  it("T73.2.11 governance object is frozen", () => {
    expect(Object.isFrozen(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_GOVERNANCE)).toBe(true);
  });
});

// ─── T73.3 generatedAt ────────────────────────────────────────────────────────

describe("T73.3 generatedAt", () => {
  it("T73.3.1 uses fixedGeneratedAt when provided", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.generatedAt).toBe(FIXED_AT);
  });

  it("T73.3.2 uses a different fixedGeneratedAt correctly", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT_2,
    });
    expect(result.generatedAt).toBe(FIXED_AT_2);
  });

  it("T73.3.3 generatedAt is a non-empty string when fixedGeneratedAt is omitted", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
    });
    expect(typeof result.generatedAt).toBe("string");
    expect(result.generatedAt.length).toBeGreaterThan(0);
  });
});

// ─── T73.4 accepts valid P72 container response ───────────────────────────────

describe("T73.4 accepts valid P72 container response", () => {
  it("T73.4.1 builds without error with valid P72 container", () => {
    expect(() =>
      presentCrossAxisReviewDisplayContainer({
        containerResponse: makeContainerResponse(),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T73.4.2 returns a non-null object", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("T73.4.3 version field in output is the P73 version string", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.version).toBe("p73-cross-axis-review-display-presenter-v0");
  });
});

// ─── T73.5 validateCrossAxisReviewDisplayContainerForPresenter — valid ─────────

describe("T73.5 validateCrossAxisReviewDisplayContainerForPresenter — valid", () => {
  it("T73.5.1 returns object with valid === true for valid container", () => {
    const result = validateCrossAxisReviewDisplayContainerForPresenter(
      makeContainerResponse(),
    );
    expect(result.valid).toBe(true);
  });

  it("T73.5.2 valid result has no reason field", () => {
    const result = validateCrossAxisReviewDisplayContainerForPresenter(
      makeContainerResponse(),
    );
    expect("reason" in result).toBe(false);
  });
});

// ─── T73.6 validateCrossAxisReviewDisplayContainerForPresenter — rejects bad flags ─

describe("T73.6 validateCrossAxisReviewDisplayContainerForPresenter — rejects bad flags", () => {
  it("T73.6.1 rejects when reviewOnly is not true", () => {
    const result = validateCrossAxisReviewDisplayContainerForPresenter(
      makeContainerResponse({ reviewOnly: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("T73.6.2 rejects when noInvestmentAdvice is not true", () => {
    const result = validateCrossAxisReviewDisplayContainerForPresenter(
      makeContainerResponse({ noInvestmentAdvice: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("T73.6.3 rejects when noForecast is not true", () => {
    const result = validateCrossAxisReviewDisplayContainerForPresenter(
      makeContainerResponse({ noForecast: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("T73.6.4 rejects when noRecommendation is not true", () => {
    const result = validateCrossAxisReviewDisplayContainerForPresenter(
      makeContainerResponse({ noRecommendation: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("T73.6.5 rejects when previewOnly is not true", () => {
    const result = validateCrossAxisReviewDisplayContainerForPresenter(
      makeContainerResponse({ previewOnly: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("T73.6.6 rejects when paperOnly is not true", () => {
    const result = validateCrossAxisReviewDisplayContainerForPresenter(
      makeContainerResponse({ paperOnly: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("T73.6.7 rejects when noExecution is not true", () => {
    const result = validateCrossAxisReviewDisplayContainerForPresenter(
      makeContainerResponse({ noExecution: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("T73.6.8 rejects when noActualMetrics is not true", () => {
    const result = validateCrossAxisReviewDisplayContainerForPresenter(
      makeContainerResponse({ noActualMetrics: false }),
    );
    expect(result.valid).toBe(false);
  });

  it("T73.6.9 rejects when entersAlphaScore is not false", () => {
    const result = validateCrossAxisReviewDisplayContainerForPresenter(
      makeContainerResponse({ entersAlphaScore: true }),
    );
    expect(result.valid).toBe(false);
  });

  it("T73.6.10 rejects when notInvestmentAdvice is not true", () => {
    const result = validateCrossAxisReviewDisplayContainerForPresenter(
      makeContainerResponse({ notInvestmentAdvice: false }),
    );
    expect(result.valid).toBe(false);
  });
});

// ─── T73.7 presentCrossAxisReviewDisplayContainer throws on governance violation ─

describe("T73.7 presentCrossAxisReviewDisplayContainer throws on governance violation", () => {
  it("T73.7.1 throws when reviewOnly is invalid", () => {
    expect(() =>
      presentCrossAxisReviewDisplayContainer({
        containerResponse: makeContainerResponse({ reviewOnly: false }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow();
  });

  it("T73.7.2 throws when previewOnly is invalid", () => {
    expect(() =>
      presentCrossAxisReviewDisplayContainer({
        containerResponse: makeContainerResponse({ previewOnly: false }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow();
  });

  it("T73.7.3 throws when entersAlphaScore is invalid", () => {
    expect(() =>
      presentCrossAxisReviewDisplayContainer({
        containerResponse: makeContainerResponse({ entersAlphaScore: true }),
        fixedGeneratedAt: FIXED_AT,
      }),
    ).toThrow();
  });
});

// ─── T73.8 researchCards length ───────────────────────────────────────────────

describe("T73.8 researchCards length", () => {
  it("T73.8.1 researchCards length equals researchSection displayRows length", () => {
    const container = makeContainerResponse();
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: container,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchCards.length).toBe(
      container.researchSection.displayRows.length,
    );
  });

  it("T73.8.2 researchCards is empty array when researchSection has no rows", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeEmptyContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.researchCards.length).toBe(0);
  });
});

// ─── T73.9 researchCards card fields ─────────────────────────────────────────

describe("T73.9 researchCards card fields", () => {
  it("T73.9.1 each researchCard has sourceName field", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    for (const card of result.researchCards) {
      expect(typeof card.sourceName).toBe("string");
      expect(card.sourceName.length).toBeGreaterThan(0);
    }
  });

  it("T73.9.2 each researchCard has label set to Research review", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    for (const card of result.researchCards) {
      expect(card.label).toBe("Research review");
    }
  });

  it("T73.9.3 each researchCard has status field as string", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    for (const card of result.researchCards) {
      expect(typeof card.status).toBe("string");
      expect(card.status.length).toBeGreaterThan(0);
    }
  });
});

// ─── T73.10 simulationAuditCards length ───────────────────────────────────────

describe("T73.10 simulationAuditCards length", () => {
  it("T73.10.1 simulationAuditCards length equals simulationAuditSection displayRows length", () => {
    const container = makeContainerResponse();
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: container,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationAuditCards.length).toBe(
      container.simulationAuditSection.displayRows.length,
    );
  });

  it("T73.10.2 simulationAuditCards is empty array when simulationAuditSection has no rows", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeEmptyContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.simulationAuditCards.length).toBe(0);
  });
});

// ─── T73.11 simulationAuditCards card fields ──────────────────────────────────

describe("T73.11 simulationAuditCards card fields", () => {
  it("T73.11.1 each simulationAuditCard has sourceName field", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    for (const card of result.simulationAuditCards) {
      expect(typeof card.sourceName).toBe("string");
      expect(card.sourceName.length).toBeGreaterThan(0);
    }
  });

  it("T73.11.2 each simulationAuditCard has label set to Simulation input audit", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    for (const card of result.simulationAuditCards) {
      expect(card.label).toBe("Simulation input audit");
    }
  });

  it("T73.11.3 each simulationAuditCard has status field as string", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    for (const card of result.simulationAuditCards) {
      expect(typeof card.status).toBe("string");
      expect(card.status.length).toBeGreaterThan(0);
    }
  });
});

// ─── T73.12 presenterSummary ──────────────────────────────────────────────────

describe("T73.12 presenterSummary", () => {
  it("T73.12.1 presenterSummary.researchCardCount matches researchCards.length", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.presenterSummary.researchCardCount).toBe(
      result.researchCards.length,
    );
  });

  it("T73.12.2 presenterSummary.simulationAuditCardCount matches simulationAuditCards.length", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.presenterSummary.simulationAuditCardCount).toBe(
      result.simulationAuditCards.length,
    );
  });

  it("T73.12.3 presenterSummary has exactly two keys", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const keys = Object.keys(result.presenterSummary);
    expect(keys).toHaveLength(2);
    expect(keys).toContain("researchCardCount");
    expect(keys).toContain("simulationAuditCardCount");
  });
});

// ─── T73.13 No merged score, verdict, or recommendation ───────────────────────

describe("T73.13 No merged score, verdict, or recommendation", () => {
  it("T73.13.1 output does not have score field", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect("score" in result).toBe(false);
  });

  it("T73.13.2 output does not have verdict field", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect("verdict" in result).toBe(false);
  });

  it("T73.13.3 output does not have recommendation field", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect("recommendation" in result).toBe(false);
  });
});

// ─── T73.14 JSON serializable ─────────────────────────────────────────────────

describe("T73.14 JSON serializable", () => {
  it("T73.14.1 JSON.stringify does not throw", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("T73.14.2 JSON.stringify produces non-empty string", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const json = JSON.stringify(result);
    expect(typeof json).toBe("string");
    expect(json.length).toBeGreaterThan(0);
  });

  it("T73.14.3 JSON round-trip preserves version and generatedAt", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const parsed = JSON.parse(JSON.stringify(result)) as typeof result;
    expect(parsed.version).toBe(result.version);
    expect(parsed.generatedAt).toBe(result.generatedAt);
  });
});

// ─── T73.15 Deterministic with fixedGeneratedAt ───────────────────────────────

describe("T73.15 Deterministic with fixedGeneratedAt", () => {
  it("T73.15.1 two calls with same fixedGeneratedAt produce same generatedAt", () => {
    const r1 = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const r2 = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r1.generatedAt).toBe(r2.generatedAt);
  });

  it("T73.15.2 two calls with same fixedGeneratedAt produce same presenterSummary counts", () => {
    const r1 = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    const r2 = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(r1.presenterSummary.researchCardCount).toBe(
      r2.presenterSummary.researchCardCount,
    );
    expect(r1.presenterSummary.simulationAuditCardCount).toBe(
      r2.presenterSummary.simulationAuditCardCount,
    );
  });
});

// ─── T73.16 Input not mutated ─────────────────────────────────────────────────

describe("T73.16 Input not mutated", () => {
  it("T73.16.1 containerResponse object reference is not mutated", () => {
    const container = makeContainerResponse();
    const originalGeneratedAt = container.generatedAt;
    presentCrossAxisReviewDisplayContainer({
      containerResponse: container,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(container.generatedAt).toBe(originalGeneratedAt);
  });

  it("T73.16.2 researchSection displayRows length is not mutated", () => {
    const container = makeContainerResponse();
    const originalLength = container.researchSection.displayRows.length;
    presentCrossAxisReviewDisplayContainer({
      containerResponse: container,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(container.researchSection.displayRows.length).toBe(originalLength);
  });
});

// ─── T73.17 Frozen input supported ───────────────────────────────────────────

describe("T73.17 Frozen input supported", () => {
  it("T73.17.1 frozen container response is accepted without error", () => {
    const frozen = Object.freeze(makeContainerResponse());
    expect(() =>
      presentCrossAxisReviewDisplayContainer({
        containerResponse: frozen,
        fixedGeneratedAt: FIXED_AT,
      }),
    ).not.toThrow();
  });

  it("T73.17.2 produces valid result from frozen input", () => {
    const frozen = Object.freeze(makeContainerResponse());
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: frozen,
      fixedGeneratedAt: FIXED_AT,
    });
    expect(result.version).toBe(CROSS_AXIS_REVIEW_DISPLAY_PRESENTER_VERSION);
    expect(result.presenterSummary.researchCardCount).toBeGreaterThan(0);
  });
});

// ─── T73.18 Output is frozen ──────────────────────────────────────────────────

describe("T73.18 Output is frozen", () => {
  it("T73.18.1 presenter response top-level object is frozen", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("T73.18.2 presenterSummary is frozen", () => {
    const result = presentCrossAxisReviewDisplayContainer({
      containerResponse: makeContainerResponse(),
      fixedGeneratedAt: FIXED_AT,
    });
    expect(Object.isFrozen(result.presenterSummary)).toBe(true);
  });
});

// ─── T73.19 Source text — no forbidden imports ────────────────────────────────

describe("T73.19 source text — forbidden imports", () => {
  it("T73.19.1 source does not import Prisma client", () => {
    expect(sourceText).not.toMatch(/from\s+["']@prisma\/client["']/);
    expect(sourceText).not.toMatch(/require\(["']@prisma\/client["']\)/);
  });

  it("T73.19.2 source code does not import child_process", () => {
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

  it("T73.19.3 source does not import fs", () => {
    expect(sourceText).not.toMatch(/from\s+['"]fs['"]/);
  });

  it("T73.19.4 source does not import path", () => {
    expect(sourceText).not.toMatch(/from\s+['"]path['"]/);
  });

  it("T73.19.5 source does not import http or https or fetch", () => {
    expect(sourceText).not.toMatch(/from\s+['"]https?['"]/);
    expect(sourceText).not.toMatch(/\bfetch\s*\(/);
  });
});

// ─── T73.20 Source text — no onlineValidation runtime import ──────────────────

describe("T73.20 source text — no onlineValidation runtime import", () => {
  it("T73.20.1 source does not import from onlineValidation", () => {
    expect(sourceText).not.toMatch(/from\s+['"].*onlineValidation/);
  });
});

// ─── T73.21 Source text — all imports are import type ────────────────────────

describe("T73.21 source text — all imports are import type", () => {
  it("T73.21.1 source does not contain bare import statements without type modifier", () => {
    expect(sourceText).not.toMatch(/^import\s+\{/m);
  });
});

// ─── T73.22 Source text — forbidden export names ─────────────────────────────

describe("T73.22 source text — forbidden export names", () => {
  it("T73.22.1 source does not export run, execute, or simulate", () => {
    expect(sourceText).not.toMatch(/export\s+(function|const)\s+(run|execute|simulate)\b/);
  });

  it("T73.22.2 source does not export score, optimize, or backtest", () => {
    expect(sourceText).not.toMatch(/export\s+(function|const)\s+(score|optimize|backtest)\b/);
  });

  it("T73.22.3 source does not export recommend", () => {
    expect(sourceText).not.toMatch(/export\s+(function|const)\s+recommend\b/);
  });
});

// ─── T73.23 Source text — forbidden field references ─────────────────────────

describe("T73.23 source text — forbidden field references", () => {
  it("T73.23.1 source does not reference ROI or roi as identifiers", () => {
    expect(sourceText).not.toMatch(/\bROI\b|\broi\b/);
  });

  it("T73.23.2 source does not reference PnL or pnl as identifiers", () => {
    expect(sourceText).not.toMatch(/\bPnL\b|\bpnl\b/);
  });

  it("T73.23.3 source does not reference targetPrice", () => {
    expect(sourceText).not.toMatch(/targetPrice/);
  });
});

// ─── T73.24 Source text — forbidden action semantics ─────────────────────────

describe("T73.24 source text — forbidden action semantics", () => {
  it("T73.24.1 source code lines do not contain buy or sell as output keys", () => {
    const lines = sourceText.split("\n");
    const outputLines = lines.filter(
      (l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"),
    );
    for (const line of outputLines) {
      expect(line).not.toMatch(/\b(buy|sell):\s/);
    }
  });

  it("T73.24.2 source code lines do not contain action as an output property key", () => {
    const lines = sourceText.split("\n");
    const outputLines = lines.filter(
      (l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"),
    );
    for (const line of outputLines) {
      expect(line).not.toMatch(/\baction:\s/);
    }
  });
});
