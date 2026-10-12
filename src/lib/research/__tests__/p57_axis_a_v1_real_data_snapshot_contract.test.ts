/**
 * P57 — Axis A v1 Source Adapter Contract Stub — Test Suite
 *
 * Tests for RealDataSnapshotInputContract.ts
 * T57.1 – T57.16 (≥16 test groups, ≥16 individual passing tests)
 *
 * Governance:
 *   paperOnly = true | dryRunOnly = true | entersAlphaScore = false
 *   notInvestmentAdvice = true | No DB | No Prisma | No scoring
 *
 * Classification: P57_AXIS_A_V1_SOURCE_ADAPTER_CONTRACT_STUB
 *
 * DISCLAIMER: Research snapshot tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRunOnly = true.
 */

import * as fs from "fs";
import * as path from "path";

import {
  REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION,
  REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE,
  REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS,
  type PitGateStatus,
  type RealDataSourceName,
  type SourceInputFact,
  type SourceInputFactAuditFlag,
  type SourceAdapterContract,
  type QuoteAdapterInput,
  type RegimeAdapterInput,
  type MonthlyRevenueAdapterInput,
} from "@/lib/research/snapshot/v1/RealDataSnapshotInputContract";

// ─── Contract file path (for source-scan tests) ───────────────────────────────

const CONTRACT_FILE = path.resolve(
  __dirname,
  "../snapshot/v1/RealDataSnapshotInputContract.ts",
);

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const MOCK_QUOTE_INPUT: QuoteAdapterInput = {
  stockId: "TSE:2330",
  date: "2024-01-15",
  close: 580,
  open: 575,
  high: 582,
  low: 573,
  volume: 30000,
  change: 5,
  transactions: 12000,
  tradeValue: 17_400_000_000,
};

const MOCK_REGIME_INPUT: RegimeAdapterInput = {
  date: "2024-01-15",
  regimeLabel: "BULL",
  confidence: 0.82,
  pitSafetyJson: { verified: true },
  source: "research-engine",
  version: "v1.0",
};

const MOCK_REVENUE_INPUT: MonthlyRevenueAdapterInput = {
  year: 2024,
  month: 1,
  revenue: 62_000_000_000,
  yoyGrowth: 0.12,
  momGrowth: 0.03,
  releaseDate: "2024-02-10",
  releaseDateSource: "twse",
  releaseDateConfidence: "HIGH",
};

// ─── T57.1 — Contract version constant ───────────────────────────────────────
describe("T57.1 — Contract version constant", () => {
  it("exports a non-empty string version", () => {
    expect(typeof REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION).toBe("string");
    expect(REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION.length).toBeGreaterThan(0);
  });

  it("version string encodes the phase (p57)", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION).toMatch(/p57/i);
  });

  it("version string encodes axis-a-v1", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION).toMatch(/axis-a-v1/i);
  });
});

// ─── T57.2 — Governance constants ────────────────────────────────────────────
describe("T57.2 — Governance constants", () => {
  it("paperOnly = true", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.paperOnly).toBe(true);
  });

  it("dryRunOnly = true", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.dryRunOnly).toBe(true);
  });

  it("entersAlphaScore = false", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  it("notInvestmentAdvice = true", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.notInvestmentAdvice).toBe(true);
  });

  it("noRecommendation = true", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.noRecommendation).toBe(true);
  });

  it("noScoring = true", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.noScoring).toBe(true);
  });

  it("noBacktest = true", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.noBacktest).toBe(true);
  });

  it("noOptimizer = true", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.noOptimizer).toBe(true);
  });
});

// ─── T57.3 — FORBIDDEN_FIELDS array completeness ─────────────────────────────
describe("T57.3 — FORBIDDEN_FIELDS array completeness", () => {
  const EXPECTED: ReadonlyArray<string> = [
    "recommendation",
    "action",
    "buy",
    "sell",
    "hold",
    "targetPrice",
    "ROI",
    "PnL",
    "winRate",
    "edge",
    "alphaScore",
    "score",
    "forecast",
    "expectedReturn",
    "benchmark",
    "optimizer",
    "backtest",
    "returnPct",
    "profit",
    "position",
  ];

  it("exports a non-empty array of at least 20 entries", () => {
    expect(Array.isArray(REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS)).toBe(true);
    expect(REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS.length).toBeGreaterThanOrEqual(20);
  });

  it.each(EXPECTED)('forbidden field "%s" is in the array', (field) => {
    expect(REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS as ReadonlyArray<string>).toContain(field);
  });
});

// ─── T57.4 — PitGateStatus valid literal values ───────────────────────────────
describe("T57.4 — PitGateStatus valid literal values", () => {
  it("PIT_SAFE is assignable as PitGateStatus", () => {
    const s: PitGateStatus = "PIT_SAFE";
    expect(s).toBe("PIT_SAFE");
  });

  it("LOW_CONFIDENCE_PIT_INFERRED is assignable as PitGateStatus", () => {
    const s: PitGateStatus = "LOW_CONFIDENCE_PIT_INFERRED";
    expect(s).toBe("LOW_CONFIDENCE_PIT_INFERRED");
  });

  it("PIT_BLOCKED is assignable as PitGateStatus", () => {
    const s: PitGateStatus = "PIT_BLOCKED";
    expect(s).toBe("PIT_BLOCKED");
  });
});

// ─── T57.5 — RealDataSourceName valid literal values ─────────────────────────
describe("T57.5 — RealDataSourceName valid literal values", () => {
  it("Quote is assignable as RealDataSourceName", () => {
    const n: RealDataSourceName = "Quote";
    expect(n).toBe("Quote");
  });

  it("Regime is assignable as RealDataSourceName", () => {
    const n: RealDataSourceName = "Regime";
    expect(n).toBe("Regime");
  });

  it("MonthlyRevenue is assignable as RealDataSourceName", () => {
    const n: RealDataSourceName = "MonthlyRevenue";
    expect(n).toBe("MonthlyRevenue");
  });
});

// ─── T57.6 — SourceInputFact<T> shape ────────────────────────────────────────
describe("T57.6 — SourceInputFact<T> required field shape", () => {
  const mockFact: SourceInputFact<QuoteAdapterInput> = {
    sourceName: "Quote",
    sourceTrace: "TSE:2330@2024-01-15",
    pitGateField: "date",
    pitGateValue: "2024-01-15",
    pitGateStatus: "PIT_SAFE",
    auditFlags: [],
    observedAt: "2024-01-15T00:00:00.000Z",
    asOfDate: "2024-01-15",
    data: MOCK_QUOTE_INPUT,
  };

  it("has sourceName", () => expect(mockFact.sourceName).toBe("Quote"));
  it("has sourceTrace", () => expect(mockFact.sourceTrace).toBe("TSE:2330@2024-01-15"));
  it("has pitGateField", () => expect(mockFact.pitGateField).toBe("date"));
  it("has pitGateStatus = PIT_SAFE", () => expect(mockFact.pitGateStatus).toBe("PIT_SAFE"));
  it("has asOfDate", () => expect(mockFact.asOfDate).toBe("2024-01-15"));
  it("has auditFlags as array", () => expect(Array.isArray(mockFact.auditFlags)).toBe(true));
  it("has data with stockId", () => expect(mockFact.data.stockId).toBe("TSE:2330"));

  it("SourceInputFact shape contains no forbidden fields at top level", () => {
    const keys = Object.keys(mockFact);
    (REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS as ReadonlyArray<string>).forEach(
      (field) => expect(keys).not.toContain(field),
    );
  });

  it("SourceInputFact.data contains no forbidden fields", () => {
    const keys = Object.keys(mockFact.data);
    (REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS as ReadonlyArray<string>).forEach(
      (field) => expect(keys).not.toContain(field),
    );
  });
});

// ─── T57.7 — SourceInputFactAuditFlag valid literals ─────────────────────────
describe("T57.7 — SourceInputFactAuditFlag literals", () => {
  it("LOW_CONFIDENCE_PIT_INFERRED is assignable as audit flag", () => {
    const flag: SourceInputFactAuditFlag = "LOW_CONFIDENCE_PIT_INFERRED";
    expect(flag).toBe("LOW_CONFIDENCE_PIT_INFERRED");
  });

  it("RELEASE_DATE_INFERRED_FROM_MONTH_END is assignable as audit flag", () => {
    const flag: SourceInputFactAuditFlag = "RELEASE_DATE_INFERRED_FROM_MONTH_END";
    expect(flag).toBe("RELEASE_DATE_INFERRED_FROM_MONTH_END");
  });

  it("auditFlags array accepts multiple flags", () => {
    const flags: ReadonlyArray<SourceInputFactAuditFlag> = [
      "LOW_CONFIDENCE_PIT_INFERRED",
      "RELEASE_DATE_NULL_FALLBACK_USED",
    ];
    expect(flags).toHaveLength(2);
  });
});

// ─── T57.8 — SourceAdapterContract interface shape ───────────────────────────
describe("T57.8 — SourceAdapterContract interface shape", () => {
  type TInput = { date: string; close: number | null };
  type TFact = { date: string; close: number | null };

  const mockAdapter: SourceAdapterContract<TInput, TFact> = {
    sourceName: "Quote",
    version: REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION,
    adapt: (input, asOfDate) => {
      if (!input.date) return null;
      return {
        sourceName: "Quote",
        sourceTrace: `Quote@${asOfDate}`,
        pitGateField: "date",
        pitGateValue: input.date,
        pitGateStatus: "PIT_SAFE",
        auditFlags: [],
        observedAt: null,
        asOfDate,
        data: { date: input.date, close: input.close },
      };
    },
  };

  it("has sourceName property", () => {
    expect(mockAdapter.sourceName).toBe("Quote");
  });

  it("has version matching REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION", () => {
    expect(mockAdapter.version).toBe(REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION);
  });

  it("adapt() returns SourceInputFact when input is PIT-valid", () => {
    const result = mockAdapter.adapt({ date: "2024-01-15", close: 580 }, "2024-01-15");
    expect(result).not.toBeNull();
    expect(result?.pitGateStatus).toBe("PIT_SAFE");
    expect(result?.data.date).toBe("2024-01-15");
  });

  it("adapt() returns null when PIT gate field is empty/absent", () => {
    const result = mockAdapter.adapt({ date: "", close: null }, "2024-01-15");
    expect(result).toBeNull();
  });

  it("adapt() result has no forbidden fields at any level", () => {
    const result = mockAdapter.adapt({ date: "2024-01-15", close: 580 }, "2024-01-15");
    if (!result) {
      expect(result).not.toBeNull();
      return;
    }
    const topKeys = Object.keys(result);
    const dataKeys = Object.keys(result.data);
    (REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS as ReadonlyArray<string>).forEach((f) => {
      expect(topKeys).not.toContain(f);
      expect(dataKeys).not.toContain(f);
    });
  });
});

// ─── T57.9 — QuoteAdapterInput field shape ───────────────────────────────────
describe("T57.9 — QuoteAdapterInput field shape", () => {
  it("has all required fields", () => {
    expect(MOCK_QUOTE_INPUT.stockId).toBe("TSE:2330");
    expect(MOCK_QUOTE_INPUT.date).toBe("2024-01-15");
    expect(MOCK_QUOTE_INPUT.close).toBe(580);
    expect(MOCK_QUOTE_INPUT.volume).toBe(30000);
  });

  it("accepts null for all numeric fields", () => {
    const nullInput: QuoteAdapterInput = {
      ...MOCK_QUOTE_INPUT,
      close: null,
      open: null,
      high: null,
      low: null,
      volume: null,
      change: null,
      transactions: null,
      tradeValue: null,
    };
    expect(nullInput.close).toBeNull();
    expect(nullInput.volume).toBeNull();
  });

  it("QuoteAdapterInput has no forbidden fields", () => {
    const keys = Object.keys(MOCK_QUOTE_INPUT);
    (REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS as ReadonlyArray<string>).forEach(
      (f) => expect(keys).not.toContain(f),
    );
  });

  it("QuoteAdapterInput does not contain targetPrice, ROI, or returnPct", () => {
    const keys = Object.keys(MOCK_QUOTE_INPUT);
    expect(keys).not.toContain("targetPrice");
    expect(keys).not.toContain("ROI");
    expect(keys).not.toContain("returnPct");
  });
});

// ─── T57.10 — RegimeAdapterInput field shape ─────────────────────────────────
describe("T57.10 — RegimeAdapterInput field shape", () => {
  it("has all required fields", () => {
    expect(MOCK_REGIME_INPUT.date).toBe("2024-01-15");
    expect(MOCK_REGIME_INPUT.regimeLabel).toBe("BULL");
    expect(MOCK_REGIME_INPUT.confidence).toBe(0.82);
    expect(MOCK_REGIME_INPUT.source).toBe("research-engine");
  });

  it("accepts null confidence", () => {
    const n: RegimeAdapterInput = { ...MOCK_REGIME_INPUT, confidence: null };
    expect(n.confidence).toBeNull();
  });

  it("RegimeAdapterInput has no forbidden fields", () => {
    const keys = Object.keys(MOCK_REGIME_INPUT);
    (REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS as ReadonlyArray<string>).forEach(
      (f) => expect(keys).not.toContain(f),
    );
  });

  it("RegimeAdapterInput does not contain forecast/prediction/recommendation/signal", () => {
    const keys = Object.keys(MOCK_REGIME_INPUT);
    expect(keys).not.toContain("forecast");
    expect(keys).not.toContain("prediction");
    expect(keys).not.toContain("recommendation");
    expect(keys).not.toContain("signal");
  });
});

// ─── T57.11 — MonthlyRevenueAdapterInput field shape ─────────────────────────
describe("T57.11 — MonthlyRevenueAdapterInput field shape", () => {
  it("has year, month, revenue", () => {
    expect(MOCK_REVENUE_INPUT.year).toBe(2024);
    expect(MOCK_REVENUE_INPUT.month).toBe(1);
    expect(MOCK_REVENUE_INPUT.revenue).toBe(62_000_000_000);
  });

  it("has releaseDate and releaseDateConfidence", () => {
    expect(MOCK_REVENUE_INPUT.releaseDate).toBe("2024-02-10");
    expect(MOCK_REVENUE_INPUT.releaseDateConfidence).toBe("HIGH");
  });

  it("accepts null for all release date fields", () => {
    const n: MonthlyRevenueAdapterInput = {
      ...MOCK_REVENUE_INPUT,
      releaseDate: null,
      releaseDateSource: null,
      releaseDateConfidence: null,
    };
    expect(n.releaseDate).toBeNull();
    expect(n.releaseDateSource).toBeNull();
    expect(n.releaseDateConfidence).toBeNull();
  });

  it('releaseDateConfidence accepts "MEDIUM" and "LOW"', () => {
    const med: MonthlyRevenueAdapterInput = {
      ...MOCK_REVENUE_INPUT,
      releaseDateConfidence: "MEDIUM",
    };
    const low: MonthlyRevenueAdapterInput = {
      ...MOCK_REVENUE_INPUT,
      releaseDateConfidence: "LOW",
    };
    expect(med.releaseDateConfidence).toBe("MEDIUM");
    expect(low.releaseDateConfidence).toBe("LOW");
  });

  it("MonthlyRevenueAdapterInput has no forbidden fields", () => {
    const keys = Object.keys(MOCK_REVENUE_INPUT);
    (REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS as ReadonlyArray<string>).forEach(
      (f) => expect(keys).not.toContain(f),
    );
  });

  it("yoyGrowth is NOT decorated as forecast, ROI, or returnPct", () => {
    // yoyGrowth is a raw DB field — must not be aliased as a forbidden derivative
    const keys = Object.keys(MOCK_REVENUE_INPUT);
    expect(keys).toContain("yoyGrowth");
    expect(keys).not.toContain("forecast");
    expect(keys).not.toContain("ROI");
    expect(keys).not.toContain("returnPct");
  });
});

// ─── T57.12 — Contract file has zero Prisma imports ──────────────────────────
describe("T57.12 — Contract file: zero Prisma imports", () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(CONTRACT_FILE, "utf-8");
  });

  it("contract file exists on disk", () => {
    expect(fs.existsSync(CONTRACT_FILE)).toBe(true);
  });

  it("has no @prisma/client import", () => {
    expect(source).not.toMatch(/@prisma\/client/);
  });

  it("has no prisma instance import", () => {
    expect(source).not.toMatch(/import.*\bprisma\b/i);
  });
});

// ─── T57.13 — Contract file has zero DB / network / filesystem imports ────────
describe("T57.13 — Contract file: zero DB / network / filesystem imports", () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(CONTRACT_FILE, "utf-8");
  });

  it("has no pg / mysql / sqlite driver imports", () => {
    expect(source).not.toMatch(/from ['"]pg['"]/);
    expect(source).not.toMatch(/from ['"]mysql/);
    expect(source).not.toMatch(/from ['"]better-sqlite/);
  });

  it("has no node:fs or fs import", () => {
    expect(source).not.toMatch(/from ['"]fs['"]/);
    expect(source).not.toMatch(/from ['"]node:fs['"]/);
  });

  it("has no http / https / axios / node-fetch imports", () => {
    expect(source).not.toMatch(/from ['"]https?['"]/);
    expect(source).not.toMatch(/from ['"]axios['"]/);
    expect(source).not.toMatch(/from ['"]node-fetch['"]/);
  });
});

// ─── T57.14 — Forbidden fields absent from type property definitions ──────────
describe("T57.14 — Forbidden fields absent from type property definitions", () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(CONTRACT_FILE, "utf-8");
  });

  // Fields most likely to appear as property names in investment-logic types
  const PROPERTY_KEY_CANDIDATES = [
    "recommendation",
    "targetPrice",
    "ROI",
    "PnL",
    "winRate",
    "edge",
    "alphaScore",
    "forecast",
    "expectedReturn",
    "benchmark",
    "optimizer",
    "backtest",
    "returnPct",
    "profit",
  ] as const;

  it.each(PROPERTY_KEY_CANDIDATES)(
    '"%s" does not appear as a readonly property key in any exported type',
    (field) => {
      // Pattern: line beginning with spaces, optional `readonly`, then the exact field name, then `: ` or `?:`
      const propPattern = new RegExp(
        `^\\s+(?:readonly\\s+)?\\b${field}\\b\\s*[?:]`,
        "m",
      );
      expect(source).not.toMatch(propPattern);
    },
  );
});

// ─── T57.15 — All mock shapes are JSON-serializable ───────────────────────────
describe("T57.15 — Exported shapes are JSON-serializable", () => {
  it("QuoteAdapterInput round-trips through JSON.stringify / JSON.parse", () => {
    const serialized = JSON.stringify(MOCK_QUOTE_INPUT);
    const parsed = JSON.parse(serialized) as QuoteAdapterInput;
    expect(parsed.stockId).toBe("TSE:2330");
    expect(parsed.close).toBe(580);
  });

  it("RegimeAdapterInput round-trips through JSON", () => {
    const serialized = JSON.stringify(MOCK_REGIME_INPUT);
    const parsed = JSON.parse(serialized) as RegimeAdapterInput;
    expect(parsed.regimeLabel).toBe("BULL");
    expect(parsed.confidence).toBe(0.82);
  });

  it("MonthlyRevenueAdapterInput round-trips through JSON", () => {
    const serialized = JSON.stringify(MOCK_REVENUE_INPUT);
    const parsed = JSON.parse(serialized) as MonthlyRevenueAdapterInput;
    expect(parsed.year).toBe(2024);
    expect(parsed.releaseDateConfidence).toBe("HIGH");
  });

  it("SourceInputFact<QuoteAdapterInput> round-trips through JSON", () => {
    const fact: SourceInputFact<QuoteAdapterInput> = {
      sourceName: "Quote",
      sourceTrace: "TSE:2330@2024-01-15",
      pitGateField: "date",
      pitGateValue: "2024-01-15",
      pitGateStatus: "PIT_SAFE",
      auditFlags: [],
      observedAt: "2024-01-15T00:00:00.000Z",
      asOfDate: "2024-01-15",
      data: MOCK_QUOTE_INPUT,
    };
    const serialized = JSON.stringify(fact);
    const parsed = JSON.parse(serialized) as typeof fact;
    expect(parsed.sourceName).toBe("Quote");
    expect(parsed.pitGateStatus).toBe("PIT_SAFE");
    expect(parsed.data.stockId).toBe("TSE:2330");
  });
});

// ─── T57.16 — Governance flags are all boolean ───────────────────────────────
describe("T57.16 — All governance flags are boolean", () => {
  const FLAGS = [
    "paperOnly",
    "dryRunOnly",
    "entersAlphaScore",
    "notInvestmentAdvice",
    "noRecommendation",
    "noScoring",
    "noBacktest",
    "noOptimizer",
  ] as const;

  it.each(FLAGS)('governance flag "%s" is of type boolean', (flag) => {
    expect(typeof REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE[flag]).toBe("boolean");
  });
});
