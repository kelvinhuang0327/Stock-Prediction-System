/**
 * P68 — Axis A v1 Research Snapshot Review Response Formatter — Test Suite
 *
 * Tests for ResearchSnapshotReviewResponseFormatter
 * (formatResearchSnapshotReviewBoundaryResponse,
 *  validateResearchSnapshotReviewBoundaryResponseForFormatting).
 * 66 tests across T68.1 – T68.20.
 *
 * Governance:
 *   reviewOnly = true | noInvestmentAdvice = true | noForecast = true
 *   noRecommendation = true | entersAlphaScore = false
 *   No DB | No Prisma | No scoring
 *
 * Classification: P68_AXIS_A_V1_RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER
 *
 * DISCLAIMER: Research display formatter tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. reviewOnly = true. noForecast = true.
 */

import * as fs from "fs";
import * as path from "path";

import {
  formatResearchSnapshotReviewBoundaryResponse,
  RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_GOVERNANCE,
  RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_VERSION,
  validateResearchSnapshotReviewBoundaryResponseForFormatting,
  type ResearchSnapshotReviewFormatterResponse,
} from "@/lib/research/snapshot/v1/ResearchSnapshotReviewResponseFormatter";

import {
  buildResearchSnapshotReviewBoundaryResponse,
  type ResearchSnapshotReviewBoundaryResponse,
} from "@/lib/research/snapshot/v1/ResearchSnapshotReviewBoundary";

import { buildResearchSnapshotReviewArtifact } from "@/lib/research/snapshot/v1/ResearchSnapshotReviewArtifact";

import {
  buildResearchSnapshotInput,
  type ResearchSnapshotInputBuilderParams,
} from "@/lib/research/snapshot/v1/ResearchSnapshotInputBuilder";

import {
  type MonthlyRevenueAdapterInput,
  type QuoteAdapterInput,
  type RegimeAdapterInput,
} from "@/lib/research/snapshot/v1/RealDataSnapshotInputContract";

// ─── Source file path (for import-scan tests) ────────────────────────────────

const GATE_SOURCE_FILE = path.resolve(
  __dirname,
  "../snapshot/v1/ResearchSnapshotReviewResponseFormatter.ts",
);

// ─── Shared test fixtures ────────────────────────────────────────────────────

const VALID_QUOTE: QuoteAdapterInput = {
  stockId: "TSE:2330",
  date: "2024-01-15",
  close: 580,
  open: 575,
  high: 582,
  low: 573,
  volume: 30000,
  change: 5,
  transactions: 1500,
  tradeValue: 17400000,
};

const VALID_REGIME: RegimeAdapterInput = {
  date: "2024-01-15",
  regimeLabel: "BULL",
  confidence: 0.87,
  pitSafetyJson: { verified: true },
  source: "market-model-v2",
  version: "2.1.0",
};

const VALID_REVENUE: MonthlyRevenueAdapterInput = {
  year: 2024,
  month: 1,
  revenue: 500000000,
  yoyGrowth: 0.12,
  momGrowth: 0.03,
  releaseDate: "2024-02-10",
  releaseDateSource: "tse_filing",
  releaseDateConfidence: "HIGH",
};

const AS_OF_DATE = "2024-01-20";

const ALL_VALID_PARAMS: ResearchSnapshotInputBuilderParams = {
  quoteInput: VALID_QUOTE,
  regimeInput: VALID_REGIME,
  monthlyRevenueInput: VALID_REVENUE,
  asOfDate: AS_OF_DATE,
};

const ALL_NULL_PARAMS: ResearchSnapshotInputBuilderParams = {
  quoteInput: null,
  regimeInput: null,
  monthlyRevenueInput: null,
  asOfDate: AS_OF_DATE,
};

const FIXED_TS = "2024-06-01T00:00:00.000Z";

function makeSnapshot(
  overrides: Partial<ResearchSnapshotInputBuilderParams> = {},
) {
  return buildResearchSnapshotInput({ ...ALL_VALID_PARAMS, ...overrides });
}

function makeNullSnapshot() {
  return buildResearchSnapshotInput(ALL_NULL_PARAMS);
}

function makeArtifact(
  overrides: Partial<ResearchSnapshotInputBuilderParams> = {},
) {
  return buildResearchSnapshotReviewArtifact({
    snapshot: makeSnapshot(overrides),
    fixedGeneratedAt: FIXED_TS,
  });
}

function makeBoundaryResponse(
  overrides: Partial<ResearchSnapshotInputBuilderParams> = {},
): ResearchSnapshotReviewBoundaryResponse {
  return buildResearchSnapshotReviewBoundaryResponse({
    artifact: makeArtifact(overrides),
    fixedGeneratedAt: FIXED_TS,
  });
}

function makeFormatterResponse(
  overrides: Partial<ResearchSnapshotInputBuilderParams> = {},
): ResearchSnapshotReviewFormatterResponse {
  return formatResearchSnapshotReviewBoundaryResponse({
    boundaryResponse: makeBoundaryResponse(overrides),
    fixedGeneratedAt: FIXED_TS,
  });
}

/** Helper to make a "bad" boundary response for testing governance rejections. */
function makeBadBoundaryResponse(
  override: Record<string, unknown>,
): ResearchSnapshotReviewBoundaryResponse {
  return {
    ...makeBoundaryResponse(),
    ...override,
  } as unknown as ResearchSnapshotReviewBoundaryResponse;
}

// ─── T68.1 — Version exact value ─────────────────────────────────────────────

describe("T68.1 — Version exact value", () => {
  it("exports RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_VERSION as a const string", () => {
    expect(
      typeof RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_VERSION,
    ).toBe("string");
  });

  it("version string starts with p68-axis-a-", () => {
    expect(RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_VERSION).toMatch(
      /^p68-axis-a-/,
    );
  });

  it("response.version equals RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_VERSION", () => {
    expect(makeFormatterResponse().version).toBe(
      RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_VERSION,
    );
  });
});

// ─── T68.2 — Governance constants ─────────────────────────────────────────────

describe("T68.2 — Governance constants", () => {
  it("GOVERNANCE.reviewOnly is true", () => {
    expect(
      RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_GOVERNANCE.reviewOnly,
    ).toBe(true);
  });

  it("GOVERNANCE.noInvestmentAdvice is true", () => {
    expect(
      RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_GOVERNANCE.noInvestmentAdvice,
    ).toBe(true);
  });

  it("GOVERNANCE.noForecast is true", () => {
    expect(
      RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_GOVERNANCE.noForecast,
    ).toBe(true);
  });

  it("GOVERNANCE.noRecommendation is true", () => {
    expect(
      RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_GOVERNANCE.noRecommendation,
    ).toBe(true);
  });

  it("GOVERNANCE.entersAlphaScore is false", () => {
    expect(
      RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_GOVERNANCE.entersAlphaScore,
    ).toBe(false);
  });

  it("response.reviewOnly is true", () => {
    expect(makeFormatterResponse().reviewOnly).toBe(true);
  });

  it("response.noInvestmentAdvice is true", () => {
    expect(makeFormatterResponse().noInvestmentAdvice).toBe(true);
  });

  it("response.entersAlphaScore is false", () => {
    expect(makeFormatterResponse().entersAlphaScore).toBe(false);
  });
});

// ─── T68.3 — generatedAt behavior ────────────────────────────────────────────

describe("T68.3 — generatedAt behavior", () => {
  it("uses fixedGeneratedAt when provided", () => {
    expect(makeFormatterResponse().generatedAt).toBe(FIXED_TS);
  });

  it("falls back to a real ISO string when fixedGeneratedAt is omitted", () => {
    const response = formatResearchSnapshotReviewBoundaryResponse({
      boundaryResponse: makeBoundaryResponse(),
    });
    expect(response.generatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("two calls with same fixedGeneratedAt produce identical generatedAt", () => {
    expect(makeFormatterResponse().generatedAt).toBe(
      makeFormatterResponse().generatedAt,
    );
  });
});

// ─── T68.4 — Accepts valid P67 boundary response ──────────────────────────────

describe("T68.4 — Accepts valid P67 boundary response", () => {
  it("accepts a valid boundary response without throwing", () => {
    expect(() =>
      formatResearchSnapshotReviewBoundaryResponse({
        boundaryResponse: makeBoundaryResponse(),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).not.toThrow();
  });

  it("response has a truthy generatedAt string", () => {
    expect(makeFormatterResponse().generatedAt).toBeTruthy();
    expect(typeof makeFormatterResponse().generatedAt).toBe("string");
  });

  it("response.boundaryVersion matches P67 boundary response version", () => {
    const boundary = makeBoundaryResponse();
    const response = formatResearchSnapshotReviewBoundaryResponse({
      boundaryResponse: boundary,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(response.boundaryVersion).toBe(boundary.version);
  });
});

// ─── T68.5 — validate() returns valid for valid boundary response ─────────────

describe("T68.5 — validate() returns valid for valid boundary response", () => {
  it("validate() returns { valid: true } for a compliant P67 boundary response", () => {
    const result =
      validateResearchSnapshotReviewBoundaryResponseForFormatting(
        makeBoundaryResponse(),
      );
    expect(result.valid).toBe(true);
  });

  it("validate() does not return a reason field when valid", () => {
    const result =
      validateResearchSnapshotReviewBoundaryResponseForFormatting(
        makeBoundaryResponse(),
      );
    expect("reason" in result).toBe(false);
  });

  it("validate() does not throw for a valid boundary response", () => {
    expect(() =>
      validateResearchSnapshotReviewBoundaryResponseForFormatting(
        makeBoundaryResponse(),
      ),
    ).not.toThrow();
  });
});

// ─── T68.6 — Rejects reviewOnly=false ────────────────────────────────────────

describe("T68.6 — Rejects reviewOnly=false", () => {
  it("validate() returns { valid: false } when reviewOnly is not true", () => {
    const bad = makeBadBoundaryResponse({ reviewOnly: false });
    const result =
      validateResearchSnapshotReviewBoundaryResponseForFormatting(bad);
    expect(result.valid).toBe(false);
  });

  it("format() throws when reviewOnly is not true", () => {
    expect(() =>
      formatResearchSnapshotReviewBoundaryResponse({
        boundaryResponse: makeBadBoundaryResponse({ reviewOnly: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T68.7 — Rejects noInvestmentAdvice=false ────────────────────────────────

describe("T68.7 — Rejects noInvestmentAdvice=false", () => {
  it("validate() returns { valid: false } when noInvestmentAdvice is not true", () => {
    const bad = makeBadBoundaryResponse({ noInvestmentAdvice: false });
    const result =
      validateResearchSnapshotReviewBoundaryResponseForFormatting(bad);
    expect(result.valid).toBe(false);
  });

  it("format() throws when noInvestmentAdvice is not true", () => {
    expect(() =>
      formatResearchSnapshotReviewBoundaryResponse({
        boundaryResponse: makeBadBoundaryResponse({ noInvestmentAdvice: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T68.8 — Rejects noForecast=false ────────────────────────────────────────

describe("T68.8 — Rejects noForecast=false", () => {
  it("validate() returns { valid: false } when noForecast is not true", () => {
    const bad = makeBadBoundaryResponse({ noForecast: false });
    const result =
      validateResearchSnapshotReviewBoundaryResponseForFormatting(bad);
    expect(result.valid).toBe(false);
  });

  it("format() throws when noForecast is not true", () => {
    expect(() =>
      formatResearchSnapshotReviewBoundaryResponse({
        boundaryResponse: makeBadBoundaryResponse({ noForecast: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T68.9 — Rejects noRecommendation=false ──────────────────────────────────

describe("T68.9 — Rejects noRecommendation=false", () => {
  it("validate() returns { valid: false } when noRecommendation is not true", () => {
    const bad = makeBadBoundaryResponse({ noRecommendation: false });
    const result =
      validateResearchSnapshotReviewBoundaryResponseForFormatting(bad);
    expect(result.valid).toBe(false);
  });

  it("format() throws when noRecommendation is not true", () => {
    expect(() =>
      formatResearchSnapshotReviewBoundaryResponse({
        boundaryResponse: makeBadBoundaryResponse({ noRecommendation: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T68.10 — Rejects entersAlphaScore=true ──────────────────────────────────

describe("T68.10 — Rejects entersAlphaScore=true", () => {
  it("validate() returns { valid: false } when entersAlphaScore is not false", () => {
    const bad = makeBadBoundaryResponse({ entersAlphaScore: true });
    const result =
      validateResearchSnapshotReviewBoundaryResponseForFormatting(bad);
    expect(result.valid).toBe(false);
  });

  it("format() throws when entersAlphaScore is not false", () => {
    expect(() =>
      formatResearchSnapshotReviewBoundaryResponse({
        boundaryResponse: makeBadBoundaryResponse({ entersAlphaScore: true }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T68.11 — Quote display row ──────────────────────────────────────────────

describe("T68.11 — Quote display row", () => {
  it("displayRows contains a Quote row", () => {
    const { displayRows } = makeFormatterResponse();
    expect(displayRows.some((r) => r.sourceName === "Quote")).toBe(true);
  });

  it("Quote row has rowType INCLUDED and includeInDisplay=true", () => {
    const { displayRows } = makeFormatterResponse();
    const q = displayRows.find((r) => r.sourceName === "Quote");
    expect(q?.rowType).toBe("INCLUDED");
    expect(q?.includeInDisplay).toBe(true);
  });
});

// ─── T68.12 — Regime display row ─────────────────────────────────────────────

describe("T68.12 — Regime display row", () => {
  it("displayRows contains a Regime row", () => {
    const { displayRows } = makeFormatterResponse();
    expect(displayRows.some((r) => r.sourceName === "Regime")).toBe(true);
  });

  it("Regime row has rowType INCLUDED and includeInDisplay=true", () => {
    const { displayRows } = makeFormatterResponse();
    const r = displayRows.find((r) => r.sourceName === "Regime");
    expect(r?.rowType).toBe("INCLUDED");
    expect(r?.includeInDisplay).toBe(true);
  });
});

// ─── T68.13 — MonthlyRevenue display row ─────────────────────────────────────

describe("T68.13 — MonthlyRevenue display row", () => {
  it("displayRows contains a MonthlyRevenue row", () => {
    const { displayRows } = makeFormatterResponse();
    expect(displayRows.some((r) => r.sourceName === "MonthlyRevenue")).toBe(
      true,
    );
  });

  it("MonthlyRevenue row has a neutral low-confidence displayNote", () => {
    const { displayRows } = makeFormatterResponse();
    const m = displayRows.find((r) => r.sourceName === "MonthlyRevenue");
    expect(m?.displayNote).toBeTruthy();
    expect(typeof m?.displayNote).toBe("string");
    expect(m?.displayNote).toContain("LOW_CONFIDENCE");
  });
});

// ─── T68.14 — FinancialReport excluded row ───────────────────────────────────

describe("T68.14 — FinancialReport excluded row", () => {
  it("displayRows contains a FinancialReport row", () => {
    const { displayRows } = makeFormatterResponse();
    expect(displayRows.some((r) => r.sourceName === "FinancialReport")).toBe(
      true,
    );
  });

  it("FinancialReport row has rowType EXCLUDED and includeInDisplay=false", () => {
    const { displayRows } = makeFormatterResponse();
    const f = displayRows.find((r) => r.sourceName === "FinancialReport");
    expect(f?.rowType).toBe("EXCLUDED");
    expect(f?.includeInDisplay).toBe(false);
  });
});

// ─── T68.15 — Chip excluded row ──────────────────────────────────────────────

describe("T68.15 — Chip excluded row", () => {
  it("displayRows contains a Chip row", () => {
    const { displayRows } = makeFormatterResponse();
    expect(displayRows.some((r) => r.sourceName === "Chip")).toBe(true);
  });

  it("Chip row has rowType EXCLUDED and includeInDisplay=false", () => {
    const { displayRows } = makeFormatterResponse();
    const c = displayRows.find((r) => r.sourceName === "Chip");
    expect(c?.rowType).toBe("EXCLUDED");
    expect(c?.includeInDisplay).toBe(false);
  });
});

// ─── T68.16 — NewsEvent excluded row ─────────────────────────────────────────

describe("T68.16 — NewsEvent excluded row", () => {
  it("displayRows contains a NewsEvent row", () => {
    const { displayRows } = makeFormatterResponse();
    expect(displayRows.some((r) => r.sourceName === "NewsEvent")).toBe(true);
  });

  it("NewsEvent row has rowType EXCLUDED and includeInDisplay=false", () => {
    const { displayRows } = makeFormatterResponse();
    const n = displayRows.find((r) => r.sourceName === "NewsEvent");
    expect(n?.rowType).toBe("EXCLUDED");
    expect(n?.includeInDisplay).toBe(false);
  });
});

// ─── T68.17 — formatterSummary counts ────────────────────────────────────────

describe("T68.17 — formatterSummary counts", () => {
  it("formatterSummary.totalDisplayRows = 6 (3 included + 3 excluded)", () => {
    expect(makeFormatterResponse().formatterSummary.totalDisplayRows).toBe(6);
  });

  it("formatterSummary.includedEligibleCount = 2 (Quote + Regime)", () => {
    expect(
      makeFormatterResponse().formatterSummary.includedEligibleCount,
    ).toBe(2);
  });

  it("formatterSummary.includedLowConfidenceCount = 1 (MonthlyRevenue)", () => {
    expect(
      makeFormatterResponse().formatterSummary.includedLowConfidenceCount,
    ).toBe(1);
  });

  it("formatterSummary.excludedCount = 3 (FinancialReport + Chip + NewsEvent)", () => {
    expect(makeFormatterResponse().formatterSummary.excludedCount).toBe(3);
  });

  it("eligibleCount + lowConfidenceCount + excludedCount = totalDisplayRows", () => {
    const { formatterSummary } = makeFormatterResponse();
    expect(
      formatterSummary.includedEligibleCount +
        formatterSummary.includedLowConfidenceCount +
        formatterSummary.excludedCount,
    ).toBe(formatterSummary.totalDisplayRows);
  });
});

// ─── T68.18 — Serialization / immutability ───────────────────────────────────

describe("T68.18 — Serialization / immutability", () => {
  it("response is JSON-serializable (JSON.parse(JSON.stringify) roundtrip)", () => {
    const response = makeFormatterResponse();
    expect(() => JSON.stringify(response)).not.toThrow();
    const roundtrip = JSON.parse(JSON.stringify(response)) as Record<
      string,
      unknown
    >;
    expect(roundtrip["version"]).toBe(
      RESEARCH_SNAPSHOT_REVIEW_RESPONSE_FORMATTER_VERSION,
    );
  });

  it("two calls with same fixedGeneratedAt produce identical JSON", () => {
    expect(JSON.stringify(makeFormatterResponse())).toBe(
      JSON.stringify(makeFormatterResponse()),
    );
  });

  it("response top level is frozen (Object.isFrozen)", () => {
    expect(Object.isFrozen(makeFormatterResponse())).toBe(true);
  });

  it("boundary response is not mutated by formatResearchSnapshotReviewBoundaryResponse", () => {
    const boundary = makeBoundaryResponse();
    const originalVersion = boundary.version;
    formatResearchSnapshotReviewBoundaryResponse({
      boundaryResponse: boundary,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(boundary.version).toBe(originalVersion);
  });

  it("accepts a frozen boundary response without throwing", () => {
    const boundary = Object.freeze(makeBoundaryResponse());
    expect(() =>
      formatResearchSnapshotReviewBoundaryResponse({
        boundaryResponse: boundary,
        fixedGeneratedAt: FIXED_TS,
      }),
    ).not.toThrow();
  });
});

// ─── T68.19 — Forbidden field / source scans ─────────────────────────────────

describe("T68.19 — Forbidden field / source scans", () => {
  let sourceText: string;

  beforeAll(() => {
    sourceText = fs.readFileSync(GATE_SOURCE_FILE, "utf-8");
  });

  it("source file does not import from prisma client", () => {
    expect(sourceText).not.toMatch(
      /require\(['"]@prisma\/client['"]\)|from ['"]@prisma\/client['"]/,
    );
  });

  it("source file does not import from fs module", () => {
    expect(sourceText).not.toMatch(
      /require\(['"]fs['"]\)|from ['"]fs['"]/,
    );
  });

  it("source file does not import from path module", () => {
    expect(sourceText).not.toMatch(
      /require\(['"]path['"]\)|from ['"]path['"]/,
    );
  });

  it("source file does not import child_process", () => {
    expect(sourceText).not.toMatch(
      /require\(['"]child_process['"]\)|from ['"]child_process['"]/,
    );
  });

  it("source file does not import from onlineValidation", () => {
    expect(sourceText).not.toMatch(/from ['"].*onlineValidation.*['"]/);
  });

  it("source file does not export a function named run, execute, simulate, optimize, backtest, recommend, score", () => {
    expect(sourceText).not.toMatch(
      /export\s+(?:async\s+)?function\s+(?:run|execute|simulate|optimize|backtest|recommend|score)\b/,
    );
  });

  it("source file does not reference ROI as a property key", () => {
    expect(sourceText).not.toMatch(/\bROI\s*[=:]/);
  });

  it("source file does not reference PnL as a property key", () => {
    expect(sourceText).not.toMatch(/\bPnL\s*[=:]/);
  });

  it("source file does not reference winRate as a property key", () => {
    expect(sourceText).not.toMatch(/\bwinRate\s*[=:]/);
  });

  it("source file does not reference targetPrice as a property key", () => {
    expect(sourceText).not.toMatch(/\btargetPrice\s*[=:]/);
  });
});

// ─── T68.20 — Boundary / regression ──────────────────────────────────────────

describe("T68.20 — Boundary / regression", () => {
  it("response top-level keys contain no forbidden semantics", () => {
    const forbiddenKeys = new Set([
      "recommendation",
      "action",
      "buy",
      "sell",
      "hold",
      "targetPrice",
      "alphaScore",
      "score",
      "forecast",
      "expectedReturn",
      "benchmark",
      "optimizer",
      "backtest",
      "profit",
      "position",
      "ROI",
      "PnL",
      "winRate",
    ]);
    for (const key of Object.keys(makeFormatterResponse())) {
      expect(forbiddenKeys.has(key)).toBe(false);
    }
  });

  it("null-snapshot boundary response is accepted by formatter without throwing", () => {
    const nullArtifact = buildResearchSnapshotReviewArtifact({
      snapshot: makeNullSnapshot(),
      fixedGeneratedAt: FIXED_TS,
    });
    const nullBoundary = buildResearchSnapshotReviewBoundaryResponse({
      artifact: nullArtifact,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(() =>
      formatResearchSnapshotReviewBoundaryResponse({
        boundaryResponse: nullBoundary,
        fixedGeneratedAt: FIXED_TS,
      }),
    ).not.toThrow();
  });

  it("response.artifactVersion matches boundary.artifactVersion", () => {
    const boundary = makeBoundaryResponse();
    const response = formatResearchSnapshotReviewBoundaryResponse({
      boundaryResponse: boundary,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(response.artifactVersion).toBe(boundary.artifactVersion);
  });

  it("deterministic: two calls with same boundary and fixedGeneratedAt produce identical JSON", () => {
    const boundary = makeBoundaryResponse();
    const r1 = formatResearchSnapshotReviewBoundaryResponse({
      boundaryResponse: boundary,
      fixedGeneratedAt: FIXED_TS,
    });
    const r2 = formatResearchSnapshotReviewBoundaryResponse({
      boundaryResponse: boundary,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
