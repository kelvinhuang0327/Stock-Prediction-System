/**
 * P67 — Axis A v1 Research Snapshot Review Boundary — Test Suite
 *
 * Tests for ResearchSnapshotReviewBoundary (buildResearchSnapshotReviewBoundaryResponse,
 * validateResearchSnapshotReviewArtifactForBoundary).
 * 62 tests across T67.1 – T67.16.
 *
 * Governance:
 *   reviewOnly = true | noInvestmentAdvice = true | noForecast = true
 *   noRecommendation = true | entersAlphaScore = false
 *   No DB | No Prisma | No scoring
 *
 * Classification: P67_AXIS_A_V1_RESEARCH_SNAPSHOT_REVIEW_BOUNDARY
 *
 * DISCLAIMER: Research review boundary tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. reviewOnly = true. noForecast = true.
 */

import * as fs from "fs";
import * as path from "path";

import {
  buildResearchSnapshotReviewBoundaryResponse,
  RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_GOVERNANCE,
  RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_VERSION,
  validateResearchSnapshotReviewArtifactForBoundary,
  type ResearchSnapshotReviewBoundaryResponse,
} from "@/lib/research/snapshot/v1/ResearchSnapshotReviewBoundary";

import {
  buildResearchSnapshotReviewArtifact,
  type ResearchSnapshotReviewArtifact,
} from "@/lib/research/snapshot/v1/ResearchSnapshotReviewArtifact";

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
  "../snapshot/v1/ResearchSnapshotReviewBoundary.ts",
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

/** Build a full ResearchSnapshotInput with all three valid sources. */
function makeSnapshot(
  overrides: Partial<ResearchSnapshotInputBuilderParams> = {},
) {
  return buildResearchSnapshotInput({ ...ALL_VALID_PARAMS, ...overrides });
}

/** Build a snapshot with all sources null. */
function makeNullSnapshot() {
  return buildResearchSnapshotInput(ALL_NULL_PARAMS);
}

/** Build a full P66 artifact with a fixed generatedAt for determinism. */
function makeArtifact(
  overrides: Partial<ResearchSnapshotInputBuilderParams> = {},
): ResearchSnapshotReviewArtifact {
  return buildResearchSnapshotReviewArtifact({
    snapshot: makeSnapshot(overrides),
    fixedGeneratedAt: FIXED_TS,
  });
}

/** Build a P67 boundary response from a valid artifact. */
function makeResponse(
  overrides: Partial<ResearchSnapshotInputBuilderParams> = {},
): ResearchSnapshotReviewBoundaryResponse {
  return buildResearchSnapshotReviewBoundaryResponse({
    artifact: makeArtifact(overrides),
    fixedGeneratedAt: FIXED_TS,
  });
}

/** Helper to make a "bad" artifact for testing governance rejections. */
function makeBadArtifact(
  override: Record<string, unknown>,
): ResearchSnapshotReviewArtifact {
  return { ...makeArtifact(), ...override } as unknown as ResearchSnapshotReviewArtifact;
}

// ─── T67.1 — Version exact value ─────────────────────────────────────────────

describe("T67.1 — Version exact value", () => {
  it("exports RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_VERSION as a const string", () => {
    expect(typeof RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_VERSION).toBe("string");
  });

  it("version string starts with p67-axis-a-", () => {
    expect(RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_VERSION).toMatch(/^p67-axis-a-/);
  });

  it("response.version equals RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_VERSION", () => {
    expect(makeResponse().version).toBe(RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_VERSION);
  });
});

// ─── T67.2 — generatedAt behavior ────────────────────────────────────────────

describe("T67.2 — generatedAt behavior", () => {
  it("uses fixedGeneratedAt when provided", () => {
    expect(makeResponse().generatedAt).toBe(FIXED_TS);
  });

  it("falls back to a real ISO string when fixedGeneratedAt is omitted", () => {
    const response = buildResearchSnapshotReviewBoundaryResponse({
      artifact: makeArtifact(),
    });
    expect(response.generatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("two calls with same fixedGeneratedAt produce identical generatedAt", () => {
    const a = makeResponse();
    const b = makeResponse();
    expect(a.generatedAt).toBe(b.generatedAt);
  });
});

// ─── T67.3 — Governance boolean invariants ────────────────────────────────────

describe("T67.3 — Governance boolean invariants", () => {
  it("GOVERNANCE.reviewOnly is true", () => {
    expect(RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_GOVERNANCE.reviewOnly).toBe(true);
  });

  it("GOVERNANCE.noInvestmentAdvice is true", () => {
    expect(RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_GOVERNANCE.noInvestmentAdvice).toBe(true);
  });

  it("GOVERNANCE.noForecast is true", () => {
    expect(RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_GOVERNANCE.noForecast).toBe(true);
  });

  it("GOVERNANCE.noRecommendation is true", () => {
    expect(RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_GOVERNANCE.noRecommendation).toBe(true);
  });

  it("GOVERNANCE.entersAlphaScore is false", () => {
    expect(RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  it("response.reviewOnly is true", () => {
    expect(makeResponse().reviewOnly).toBe(true);
  });

  it("response.noInvestmentAdvice is true", () => {
    expect(makeResponse().noInvestmentAdvice).toBe(true);
  });

  it("response.entersAlphaScore is false", () => {
    expect(makeResponse().entersAlphaScore).toBe(false);
  });
});

// ─── T67.4 — Accepts valid P66 artifact ──────────────────────────────────────

describe("T67.4 — Accepts valid P66 artifact", () => {
  it("accepts a valid artifact without throwing", () => {
    expect(() =>
      buildResearchSnapshotReviewBoundaryResponse({
        artifact: makeArtifact(),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).not.toThrow();
  });

  it("response has a truthy generatedAt string", () => {
    expect(makeResponse().generatedAt).toBeTruthy();
    expect(typeof makeResponse().generatedAt).toBe("string");
  });

  it("response.artifactVersion matches the P66 artifact.version", () => {
    const artifact = makeArtifact();
    const response = buildResearchSnapshotReviewBoundaryResponse({
      artifact,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(response.artifactVersion).toBe(artifact.version);
  });
});

// ─── T67.5 — validate() returns valid for valid artifact ─────────────────────

describe("T67.5 — validate() returns valid for valid artifact", () => {
  it("validate() returns { valid: true } for a compliant P66 artifact", () => {
    const result = validateResearchSnapshotReviewArtifactForBoundary(makeArtifact());
    expect(result.valid).toBe(true);
  });

  it("validate() does not return a reason field when valid", () => {
    const result = validateResearchSnapshotReviewArtifactForBoundary(makeArtifact());
    expect("reason" in result).toBe(false);
  });

  it("validate() does not throw for a valid artifact", () => {
    expect(() =>
      validateResearchSnapshotReviewArtifactForBoundary(makeArtifact()),
    ).not.toThrow();
  });
});

// ─── T67.6 — Rejects reviewOnly=false ────────────────────────────────────────

describe("T67.6 — Rejects reviewOnly=false", () => {
  it("validate() returns { valid: false } when reviewOnly is not true", () => {
    const bad = makeBadArtifact({ reviewOnly: false });
    const result = validateResearchSnapshotReviewArtifactForBoundary(bad);
    expect(result.valid).toBe(false);
  });

  it("build() throws when reviewOnly is not true", () => {
    expect(() =>
      buildResearchSnapshotReviewBoundaryResponse({
        artifact: makeBadArtifact({ reviewOnly: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T67.7 — Rejects noInvestmentAdvice=false ────────────────────────────────

describe("T67.7 — Rejects noInvestmentAdvice=false", () => {
  it("validate() returns { valid: false } when noInvestmentAdvice is not true", () => {
    const bad = makeBadArtifact({ noInvestmentAdvice: false });
    const result = validateResearchSnapshotReviewArtifactForBoundary(bad);
    expect(result.valid).toBe(false);
  });

  it("build() throws when noInvestmentAdvice is not true", () => {
    expect(() =>
      buildResearchSnapshotReviewBoundaryResponse({
        artifact: makeBadArtifact({ noInvestmentAdvice: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T67.8 — Rejects noForecast=false ────────────────────────────────────────

describe("T67.8 — Rejects noForecast=false", () => {
  it("validate() returns { valid: false } when noForecast is not true", () => {
    const bad = makeBadArtifact({ noForecast: false });
    const result = validateResearchSnapshotReviewArtifactForBoundary(bad);
    expect(result.valid).toBe(false);
  });

  it("build() throws when noForecast is not true", () => {
    expect(() =>
      buildResearchSnapshotReviewBoundaryResponse({
        artifact: makeBadArtifact({ noForecast: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T67.9 — Rejects noRecommendation=false ──────────────────────────────────

describe("T67.9 — Rejects noRecommendation=false", () => {
  it("validate() returns { valid: false } when noRecommendation is not true", () => {
    const bad = makeBadArtifact({ noRecommendation: false });
    const result = validateResearchSnapshotReviewArtifactForBoundary(bad);
    expect(result.valid).toBe(false);
  });

  it("build() throws when noRecommendation is not true", () => {
    expect(() =>
      buildResearchSnapshotReviewBoundaryResponse({
        artifact: makeBadArtifact({ noRecommendation: false }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T67.10 — Rejects entersAlphaScore=true ──────────────────────────────────

describe("T67.10 — Rejects entersAlphaScore=true", () => {
  it("validate() returns { valid: false } when entersAlphaScore is not false", () => {
    const bad = makeBadArtifact({ entersAlphaScore: true });
    const result = validateResearchSnapshotReviewArtifactForBoundary(bad);
    expect(result.valid).toBe(false);
  });

  it("build() throws when entersAlphaScore is not false", () => {
    expect(() =>
      buildResearchSnapshotReviewBoundaryResponse({
        artifact: makeBadArtifact({ entersAlphaScore: true }),
        fixedGeneratedAt: FIXED_TS,
      }),
    ).toThrow();
  });
});

// ─── T67.11 — Preserves sourceSections ───────────────────────────────────────

describe("T67.11 — Preserves sourceSections", () => {
  it("response.sourceSections has same length as artifact.sourceSections", () => {
    const artifact = makeArtifact();
    const response = buildResearchSnapshotReviewBoundaryResponse({
      artifact,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(response.sourceSections).toHaveLength(artifact.sourceSections.length);
  });

  it("response.sourceSections[0].sourceName is 'Quote'", () => {
    expect(makeResponse().sourceSections[0]?.sourceName).toBe("Quote");
  });

  it("response.sourceSections order is Quote, Regime, MonthlyRevenue", () => {
    const names = makeResponse().sourceSections.map((s) => s.sourceName);
    expect(names).toEqual(["Quote", "Regime", "MonthlyRevenue"]);
  });
});

// ─── T67.12 — Preserves excludedSources ──────────────────────────────────────

describe("T67.12 — Preserves excludedSources", () => {
  it("response.excludedSources has same length as artifact.excludedSources", () => {
    const artifact = makeArtifact();
    const response = buildResearchSnapshotReviewBoundaryResponse({
      artifact,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(response.excludedSources).toHaveLength(artifact.excludedSources.length);
  });

  it("response.excludedSources order is FinancialReport, Chip, NewsEvent", () => {
    const names = makeResponse().excludedSources.map((s) => s.sourceName);
    expect(names).toEqual(["FinancialReport", "Chip", "NewsEvent"]);
  });

  it("response.excludedSources are exactly the artifact.excludedSources", () => {
    const artifact = makeArtifact();
    const response = buildResearchSnapshotReviewBoundaryResponse({
      artifact,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(response.excludedSources).toBe(artifact.excludedSources);
  });
});

// ─── T67.13 — Summary counts ─────────────────────────────────────────────────

describe("T67.13 — Summary counts", () => {
  it("summary.totalReviewedSources matches artifact.summary.totalReviewedSources", () => {
    const artifact = makeArtifact();
    const response = buildResearchSnapshotReviewBoundaryResponse({
      artifact,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(response.summary.totalReviewedSources).toBe(
      artifact.summary.totalReviewedSources,
    );
  });

  it("summary.includedEligibleCount matches artifact.summary.includedEligibleCount", () => {
    const artifact = makeArtifact();
    const response = buildResearchSnapshotReviewBoundaryResponse({
      artifact,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(response.summary.includedEligibleCount).toBe(
      artifact.summary.includedEligibleCount,
    );
  });

  it("summary.includedLowConfidenceCount matches artifact", () => {
    const artifact = makeArtifact();
    const response = buildResearchSnapshotReviewBoundaryResponse({
      artifact,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(response.summary.includedLowConfidenceCount).toBe(
      artifact.summary.includedLowConfidenceCount,
    );
  });

  it("summary.excludedCount matches artifact.summary.excludedCount", () => {
    const artifact = makeArtifact();
    const response = buildResearchSnapshotReviewBoundaryResponse({
      artifact,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(response.summary.excludedCount).toBe(artifact.summary.excludedCount);
  });

  it("summary.includedEligibleCount + includedLowConfidenceCount = totalReviewedSources", () => {
    const { summary } = makeResponse();
    expect(
      summary.includedEligibleCount + summary.includedLowConfidenceCount,
    ).toBe(summary.totalReviewedSources);
  });
});

// ─── T67.14 — Serialization / immutability ───────────────────────────────────

describe("T67.14 — Serialization / immutability", () => {
  it("response is JSON-serializable (JSON.parse(JSON.stringify) roundtrip)", () => {
    const response = makeResponse();
    expect(() => JSON.stringify(response)).not.toThrow();
    const roundtrip = JSON.parse(JSON.stringify(response)) as Record<
      string,
      unknown
    >;
    expect(roundtrip["version"]).toBe(RESEARCH_SNAPSHOT_REVIEW_BOUNDARY_VERSION);
  });

  it("two calls with same fixedGeneratedAt produce identical JSON", () => {
    const a = makeResponse();
    const b = makeResponse();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("response top level is frozen (Object.isFrozen)", () => {
    expect(Object.isFrozen(makeResponse())).toBe(true);
  });

  it("artifact is not mutated by buildResearchSnapshotReviewBoundaryResponse", () => {
    const artifact = makeArtifact();
    const originalVersion = artifact.version;
    buildResearchSnapshotReviewBoundaryResponse({
      artifact,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(artifact.version).toBe(originalVersion);
  });

  it("accepts a frozen artifact without throwing", () => {
    const artifact = Object.freeze(makeArtifact());
    expect(() =>
      buildResearchSnapshotReviewBoundaryResponse({
        artifact,
        fixedGeneratedAt: FIXED_TS,
      }),
    ).not.toThrow();
  });
});

// ─── T67.15 — Forbidden field / source scans ─────────────────────────────────

describe("T67.15 — Forbidden field / source scans", () => {
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

  it("source file does not reference alphaScore as a property key", () => {
    expect(sourceText).not.toMatch(/\balphaScore\s*[=:]/);
  });
});

// ─── T67.16 — Boundary / regression ──────────────────────────────────────────

describe("T67.16 — Boundary / regression", () => {
  it("response top-level keys do not include any forbidden semantics", () => {
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
    const response = makeResponse();
    for (const key of Object.keys(response)) {
      expect(forbiddenKeys.has(key)).toBe(false);
    }
  });

  it("validate() includes a descriptive reason string when invalid", () => {
    const bad = makeBadArtifact({ reviewOnly: false });
    const result = validateResearchSnapshotReviewArtifactForBoundary(bad);
    if (!result.valid) {
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("null-snapshot artifact is accepted by boundary without throwing", () => {
    const nullArtifact = buildResearchSnapshotReviewArtifact({
      snapshot: makeNullSnapshot(),
      fixedGeneratedAt: FIXED_TS,
    });
    expect(() =>
      buildResearchSnapshotReviewBoundaryResponse({
        artifact: nullArtifact,
        fixedGeneratedAt: FIXED_TS,
      }),
    ).not.toThrow();
  });

  it("null-snapshot boundary response has sourceSections length 3", () => {
    const nullArtifact = buildResearchSnapshotReviewArtifact({
      snapshot: makeNullSnapshot(),
      fixedGeneratedAt: FIXED_TS,
    });
    const response = buildResearchSnapshotReviewBoundaryResponse({
      artifact: nullArtifact,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(response.sourceSections).toHaveLength(3);
  });

  it("response.noForecast is true and response.noRecommendation is true", () => {
    const response = makeResponse();
    expect(response.noForecast).toBe(true);
    expect(response.noRecommendation).toBe(true);
  });

  it("deterministic: two calls with same artifact and fixedGeneratedAt produce identical JSON", () => {
    const artifact = makeArtifact();
    const r1 = buildResearchSnapshotReviewBoundaryResponse({
      artifact,
      fixedGeneratedAt: FIXED_TS,
    });
    const r2 = buildResearchSnapshotReviewBoundaryResponse({
      artifact,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
