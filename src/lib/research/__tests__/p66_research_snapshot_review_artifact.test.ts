/**
 * P66 — Axis A v1 Research Snapshot Review Artifact — Test Suite
 *
 * Tests for ResearchSnapshotReviewArtifact (buildResearchSnapshotReviewArtifact,
 * summarizeResearchSnapshotReviewSources).
 * 62 tests across T66.1 – T66.16.
 *
 * Governance:
 *   reviewOnly = true | noInvestmentAdvice = true | noForecast = true
 *   noRecommendation = true | entersAlphaScore = false
 *   No DB | No Prisma | No scoring
 *
 * Classification: P66_AXIS_A_V1_RESEARCH_SNAPSHOT_REVIEW_ARTIFACT
 *
 * DISCLAIMER: Research review artifact tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. reviewOnly = true. noForecast = true.
 */

import * as fs from "fs";
import * as path from "path";

import {
  buildResearchSnapshotReviewArtifact,
  RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_GOVERNANCE,
  RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_VERSION,
  summarizeResearchSnapshotReviewSources,
  type ResearchSnapshotReviewArtifact,
  type ResearchSnapshotReviewExcludedSource,
  type ResearchSnapshotReviewSourceSection,
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
  "../snapshot/v1/ResearchSnapshotReviewArtifact.ts",
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

const REVENUE_NO_RELEASE: MonthlyRevenueAdapterInput = {
  year: 2024,
  month: 1,
  revenue: 500000000,
  yoyGrowth: 0.12,
  momGrowth: 0.03,
  releaseDate: null,
  releaseDateSource: null,
  releaseDateConfidence: null,
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

/** Build a full artifact with a fixed generatedAt for determinism. */
function makeArtifact(
  overrides: Partial<ResearchSnapshotInputBuilderParams> = {},
): ResearchSnapshotReviewArtifact {
  return buildResearchSnapshotReviewArtifact({
    snapshot: makeSnapshot(overrides),
    fixedGeneratedAt: FIXED_TS,
  });
}

// ─── T66.1 — Version exact value ─────────────────────────────────────────────

describe("T66.1 — Version exact value", () => {
  it("exports RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_VERSION as a const string", () => {
    expect(typeof RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_VERSION).toBe("string");
  });

  it("version string starts with p66-axis-a-", () => {
    expect(RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_VERSION).toMatch(/^p66-axis-a-/);
  });

  it("artifact.version equals RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_VERSION", () => {
    const artifact = makeArtifact();
    expect(artifact.version).toBe(RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_VERSION);
  });
});

// ─── T66.2 — generatedAt behavior ────────────────────────────────────────────

describe("T66.2 — generatedAt behavior", () => {
  it("uses fixedGeneratedAt when provided", () => {
    const artifact = makeArtifact();
    expect(artifact.generatedAt).toBe(FIXED_TS);
  });

  it("falls back to a real ISO string when fixedGeneratedAt is omitted", () => {
    const artifact = buildResearchSnapshotReviewArtifact({
      snapshot: makeSnapshot(),
    });
    expect(artifact.generatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("two calls with same fixedGeneratedAt produce identical generatedAt", () => {
    const a = makeArtifact();
    const b = makeArtifact();
    expect(a.generatedAt).toBe(b.generatedAt);
  });
});

// ─── T66.3 — Governance boolean invariants ────────────────────────────────────

describe("T66.3 — Governance boolean invariants", () => {
  it("artifact.reviewOnly is true", () => {
    expect(makeArtifact().reviewOnly).toBe(true);
  });

  it("artifact.noInvestmentAdvice is true", () => {
    expect(makeArtifact().noInvestmentAdvice).toBe(true);
  });

  it("artifact.noForecast is true", () => {
    expect(makeArtifact().noForecast).toBe(true);
  });

  it("artifact.noRecommendation is true", () => {
    expect(makeArtifact().noRecommendation).toBe(true);
  });

  it("artifact.entersAlphaScore is false", () => {
    expect(makeArtifact().entersAlphaScore).toBe(false);
  });

  it("RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_GOVERNANCE.entersAlphaScore is false", () => {
    expect(RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_GOVERNANCE.entersAlphaScore).toBe(
      false,
    );
  });

  it("RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_GOVERNANCE.reviewOnly is true", () => {
    expect(RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_GOVERNANCE.reviewOnly).toBe(true);
  });
});

// ─── T66.4 — Quote section INCLUDED_ELIGIBLE ─────────────────────────────────

describe("T66.4 — Quote section INCLUDED_ELIGIBLE", () => {
  it("sourceSections includes a Quote section", () => {
    const { sourceSections } = makeArtifact();
    expect(sourceSections.some((s) => s.sourceName === "Quote")).toBe(true);
  });

  it("Quote section has reviewStatus INCLUDED_ELIGIBLE", () => {
    const { sourceSections } = makeArtifact();
    const q = sourceSections.find((s) => s.sourceName === "Quote");
    expect(q?.reviewStatus).toBe("INCLUDED_ELIGIBLE");
  });

  it("Quote section has includeInReview = true", () => {
    const { sourceSections } = makeArtifact();
    const q = sourceSections.find((s) => s.sourceName === "Quote");
    expect(q?.includeInReview).toBe(true);
  });
});

// ─── T66.5 — Regime section INCLUDED_ELIGIBLE ────────────────────────────────

describe("T66.5 — Regime section INCLUDED_ELIGIBLE", () => {
  it("sourceSections includes a Regime section", () => {
    const { sourceSections } = makeArtifact();
    expect(sourceSections.some((s) => s.sourceName === "Regime")).toBe(true);
  });

  it("Regime section has reviewStatus INCLUDED_ELIGIBLE", () => {
    const { sourceSections } = makeArtifact();
    const r = sourceSections.find((s) => s.sourceName === "Regime");
    expect(r?.reviewStatus).toBe("INCLUDED_ELIGIBLE");
  });

  it("Regime section has includeInReview = true", () => {
    const { sourceSections } = makeArtifact();
    const r = sourceSections.find((s) => s.sourceName === "Regime");
    expect(r?.includeInReview).toBe(true);
  });
});

// ─── T66.6 — MonthlyRevenue INCLUDED_LOW_CONFIDENCE with warning ──────────────

describe("T66.6 — MonthlyRevenue INCLUDED_LOW_CONFIDENCE with warning", () => {
  it("sourceSections includes a MonthlyRevenue section", () => {
    const { sourceSections } = makeArtifact();
    expect(sourceSections.some((s) => s.sourceName === "MonthlyRevenue")).toBe(
      true,
    );
  });

  it("MonthlyRevenue section has reviewStatus INCLUDED_LOW_CONFIDENCE", () => {
    const { sourceSections } = makeArtifact();
    const m = sourceSections.find((s) => s.sourceName === "MonthlyRevenue");
    expect(m?.reviewStatus).toBe("INCLUDED_LOW_CONFIDENCE");
  });

  it("MonthlyRevenue section has a non-empty lowConfidenceWarning", () => {
    const { sourceSections } = makeArtifact();
    const m = sourceSections.find((s) => s.sourceName === "MonthlyRevenue");
    expect(m?.lowConfidenceWarning).toBeTruthy();
    expect(typeof m?.lowConfidenceWarning).toBe("string");
  });

  it("MonthlyRevenue lowConfidenceWarning mentions LOW_CONFIDENCE_PIT_INFERRED", () => {
    const { sourceSections } = makeArtifact();
    const m = sourceSections.find((s) => s.sourceName === "MonthlyRevenue");
    expect(m?.lowConfidenceWarning).toContain("LOW_CONFIDENCE_PIT_INFERRED");
  });

  it("MonthlyRevenue INCLUDED_LOW_CONFIDENCE even when releaseDate is null", () => {
    const artifact = buildResearchSnapshotReviewArtifact({
      snapshot: makeSnapshot({ monthlyRevenueInput: REVENUE_NO_RELEASE }),
      fixedGeneratedAt: FIXED_TS,
    });
    const m = artifact.sourceSections.find(
      (s) => s.sourceName === "MonthlyRevenue",
    );
    expect(m?.reviewStatus).toBe("INCLUDED_LOW_CONFIDENCE");
  });
});

// ─── T66.7 — FinancialReport in excludedSources ───────────────────────────────

describe("T66.7 — FinancialReport in excludedSources", () => {
  it("excludedSources contains FinancialReport", () => {
    const { excludedSources } = makeArtifact();
    expect(
      excludedSources.some((s) => s.sourceName === "FinancialReport"),
    ).toBe(true);
  });

  it("FinancialReport has a non-empty exclusionReason", () => {
    const { excludedSources } = makeArtifact();
    const f = excludedSources.find((s) => s.sourceName === "FinancialReport");
    expect(f?.exclusionReason).toBeTruthy();
  });
});

// ─── T66.8 — Chip in excludedSources ─────────────────────────────────────────

describe("T66.8 — Chip in excludedSources", () => {
  it("excludedSources contains Chip", () => {
    const { excludedSources } = makeArtifact();
    expect(excludedSources.some((s) => s.sourceName === "Chip")).toBe(true);
  });

  it("Chip has a non-empty exclusionReason", () => {
    const { excludedSources } = makeArtifact();
    const c = excludedSources.find((s) => s.sourceName === "Chip");
    expect(c?.exclusionReason).toBeTruthy();
  });
});

// ─── T66.9 — NewsEvent in excludedSources ────────────────────────────────────

describe("T66.9 — NewsEvent in excludedSources", () => {
  it("excludedSources contains NewsEvent", () => {
    const { excludedSources } = makeArtifact();
    expect(excludedSources.some((s) => s.sourceName === "NewsEvent")).toBe(
      true,
    );
  });

  it("NewsEvent has a non-empty exclusionReason", () => {
    const { excludedSources } = makeArtifact();
    const n = excludedSources.find((s) => s.sourceName === "NewsEvent");
    expect(n?.exclusionReason).toBeTruthy();
  });
});

// ─── T66.10 — sourceSections count and names ─────────────────────────────────

describe("T66.10 — sourceSections count and names", () => {
  it("sourceSections has exactly 3 entries", () => {
    expect(makeArtifact().sourceSections).toHaveLength(3);
  });

  it("sourceSections order is Quote, Regime, MonthlyRevenue", () => {
    const names = makeArtifact().sourceSections.map((s) => s.sourceName);
    expect(names).toEqual(["Quote", "Regime", "MonthlyRevenue"]);
  });

  it("sourceSections count is 3 even when all snapshot sources are null", () => {
    const artifact = buildResearchSnapshotReviewArtifact({
      snapshot: makeNullSnapshot(),
      fixedGeneratedAt: FIXED_TS,
    });
    expect(artifact.sourceSections).toHaveLength(3);
  });
});

// ─── T66.11 — excludedSources count and names ────────────────────────────────

describe("T66.11 — excludedSources count and names", () => {
  it("excludedSources has exactly 3 entries", () => {
    expect(makeArtifact().excludedSources).toHaveLength(3);
  });

  it("excludedSources order is FinancialReport, Chip, NewsEvent", () => {
    const names = makeArtifact().excludedSources.map((s) => s.sourceName);
    expect(names).toEqual(["FinancialReport", "Chip", "NewsEvent"]);
  });

  it("excludedSources count is 3 regardless of snapshot content", () => {
    const artifact = buildResearchSnapshotReviewArtifact({
      snapshot: makeNullSnapshot(),
      fixedGeneratedAt: FIXED_TS,
    });
    expect(artifact.excludedSources).toHaveLength(3);
  });
});

// ─── T66.12 — Summary counts ─────────────────────────────────────────────────

describe("T66.12 — Summary counts", () => {
  it("summary.totalReviewedSources = 3", () => {
    expect(makeArtifact().summary.totalReviewedSources).toBe(3);
  });

  it("summary.includedEligibleCount = 2 (Quote + Regime)", () => {
    expect(makeArtifact().summary.includedEligibleCount).toBe(2);
  });

  it("summary.includedLowConfidenceCount = 1 (MonthlyRevenue)", () => {
    expect(makeArtifact().summary.includedLowConfidenceCount).toBe(1);
  });

  it("summary.excludedCount = 3 (FinancialReport + Chip + NewsEvent)", () => {
    expect(makeArtifact().summary.excludedCount).toBe(3);
  });

  it("summary counts are consistent when snapshot sources are null", () => {
    const artifact = buildResearchSnapshotReviewArtifact({
      snapshot: makeNullSnapshot(),
      fixedGeneratedAt: FIXED_TS,
    });
    expect(artifact.summary.totalReviewedSources).toBe(3);
    expect(artifact.summary.includedEligibleCount).toBe(2);
    expect(artifact.summary.includedLowConfidenceCount).toBe(1);
    expect(artifact.summary.excludedCount).toBe(3);
  });

  it("summary.includedEligibleCount + summary.includedLowConfidenceCount = totalReviewedSources", () => {
    const { summary } = makeArtifact();
    expect(
      summary.includedEligibleCount + summary.includedLowConfidenceCount,
    ).toBe(summary.totalReviewedSources);
  });
});

// ─── T66.13 — Serialization / immutability ───────────────────────────────────

describe("T66.13 — Serialization / immutability", () => {
  it("artifact is JSON-serializable (JSON.parse(JSON.stringify) roundtrip)", () => {
    const artifact = makeArtifact();
    expect(() => JSON.stringify(artifact)).not.toThrow();
    const roundtrip = JSON.parse(JSON.stringify(artifact)) as Record<
      string,
      unknown
    >;
    expect(roundtrip["version"]).toBe(RESEARCH_SNAPSHOT_REVIEW_ARTIFACT_VERSION);
  });

  it("two calls with same fixedGeneratedAt produce identical JSON", () => {
    const a = makeArtifact();
    const b = makeArtifact();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("artifact top level is frozen (Object.isFrozen)", () => {
    expect(Object.isFrozen(makeArtifact())).toBe(true);
  });

  it("sourceSections array is frozen", () => {
    expect(Object.isFrozen(makeArtifact().sourceSections)).toBe(true);
  });

  it("snapshot is not mutated by buildResearchSnapshotReviewArtifact", () => {
    const snapshot = makeSnapshot();
    const originalAsOfDate = snapshot.asOfDate;
    buildResearchSnapshotReviewArtifact({
      snapshot,
      fixedGeneratedAt: FIXED_TS,
    });
    expect(snapshot.asOfDate).toBe(originalAsOfDate);
  });
});

// ─── T66.14 — summarizeResearchSnapshotReviewSources standalone ───────────────

describe("T66.14 — summarizeResearchSnapshotReviewSources standalone", () => {
  it("computes eligible / low-confidence counts from sections array", () => {
    const sections: ResearchSnapshotReviewSourceSection[] = [
      {
        sourceName: "Quote",
        reviewStatus: "INCLUDED_ELIGIBLE",
        pitGateStatus: "PIT_SAFE",
        includeInReview: true,
      },
      {
        sourceName: "MonthlyRevenue",
        reviewStatus: "INCLUDED_LOW_CONFIDENCE",
        pitGateStatus: "LOW_CONFIDENCE_PIT_INFERRED",
        includeInReview: true,
        lowConfidenceWarning: "test warning",
      },
    ];
    const summary = summarizeResearchSnapshotReviewSources(sections);
    expect(summary.totalReviewedSources).toBe(2);
    expect(summary.includedEligibleCount).toBe(1);
    expect(summary.includedLowConfidenceCount).toBe(1);
    expect(summary.excludedCount).toBe(0);
  });

  it("returns excludedCount = 0 when excludedSources is omitted", () => {
    const sections: ResearchSnapshotReviewSourceSection[] = [
      {
        sourceName: "Regime",
        reviewStatus: "INCLUDED_ELIGIBLE",
        pitGateStatus: "PIT_SAFE",
        includeInReview: true,
      },
    ];
    const summary = summarizeResearchSnapshotReviewSources(sections);
    expect(summary.excludedCount).toBe(0);
  });

  it("returns excludedCount = N when excludedSources array is provided", () => {
    const sections: ResearchSnapshotReviewSourceSection[] = [];
    const excluded: ResearchSnapshotReviewExcludedSource[] = [
      { sourceName: "FinancialReport", exclusionReason: "test" },
      { sourceName: "Chip", exclusionReason: "test2" },
    ];
    const summary = summarizeResearchSnapshotReviewSources(sections, excluded);
    expect(summary.excludedCount).toBe(2);
  });
});

// ─── T66.15 — Forbidden field / source scans ─────────────────────────────────

describe("T66.15 — Forbidden field / source scans", () => {
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

  it("source file does not reference targetPrice as a property key", () => {
    expect(sourceText).not.toMatch(/\btargetPrice\s*[=:]/);
  });
});

// ─── T66.16 — Boundary / regression ──────────────────────────────────────────

describe("T66.16 — Boundary / regression", () => {
  it("pitGateStatus is NOT_AVAILABLE for Quote when snapshot.quote is null", () => {
    const artifact = buildResearchSnapshotReviewArtifact({
      snapshot: buildResearchSnapshotInput({
        quoteInput: null,
        regimeInput: VALID_REGIME,
        monthlyRevenueInput: VALID_REVENUE,
        asOfDate: AS_OF_DATE,
      }),
      fixedGeneratedAt: FIXED_TS,
    });
    const q = artifact.sourceSections.find((s) => s.sourceName === "Quote");
    expect(q?.pitGateStatus).toBe("NOT_AVAILABLE");
  });

  it("pitGateStatus is NOT_AVAILABLE for Regime when snapshot.regime is null", () => {
    const artifact = buildResearchSnapshotReviewArtifact({
      snapshot: buildResearchSnapshotInput({
        quoteInput: VALID_QUOTE,
        regimeInput: null,
        monthlyRevenueInput: VALID_REVENUE,
        asOfDate: AS_OF_DATE,
      }),
      fixedGeneratedAt: FIXED_TS,
    });
    const r = artifact.sourceSections.find((s) => s.sourceName === "Regime");
    expect(r?.pitGateStatus).toBe("NOT_AVAILABLE");
  });

  it("accepts a frozen snapshot without throwing", () => {
    const snapshot = Object.freeze(makeSnapshot());
    expect(() =>
      buildResearchSnapshotReviewArtifact({
        snapshot,
        fixedGeneratedAt: FIXED_TS,
      }),
    ).not.toThrow();
  });

  it("artifact top-level keys do not include any forbidden semantics", () => {
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
    const artifact = makeArtifact();
    for (const key of Object.keys(artifact)) {
      expect(forbiddenKeys.has(key)).toBe(false);
    }
  });
});
