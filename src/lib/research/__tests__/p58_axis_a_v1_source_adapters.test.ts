/**
 * P58 — Axis A v1 Source Adapter Implementations — Test Suite
 *
 * Tests for QuoteAdapter, RegimeAdapter, and MonthlyRevenueAdapter.
 * 48+ tests across T58.1 – T58.5 (adapter groups + cross-adapter).
 *
 * Governance:
 *   paperOnly = true | dryRunOnly = true | entersAlphaScore = false
 *   notInvestmentAdvice = true | No DB | No Prisma | No scoring
 *
 * Classification: P58_AXIS_A_V1_SOURCE_ADAPTER_IMPLEMENTATIONS
 *
 * DISCLAIMER: Research snapshot tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRunOnly = true.
 */

import * as fs from "fs";
import * as path from "path";

import { QuoteAdapter } from "@/lib/research/snapshot/v1/adapters/QuoteAdapter";
import { RegimeAdapter } from "@/lib/research/snapshot/v1/adapters/RegimeAdapter";
import { MonthlyRevenueAdapter } from "@/lib/research/snapshot/v1/adapters/MonthlyRevenueAdapter";

import {
  REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION,
  REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS,
  REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE,
  type QuoteAdapterInput,
  type RegimeAdapterInput,
  type MonthlyRevenueAdapterInput,
} from "@/lib/research/snapshot/v1/RealDataSnapshotInputContract";

// ─── Source file paths (for import-scan tests) ────────────────────────────────

const ADAPTERS_DIR = path.resolve(__dirname, "../snapshot/v1/adapters");
const QUOTE_FILE = path.join(ADAPTERS_DIR, "QuoteAdapter.ts");
const REGIME_FILE = path.join(ADAPTERS_DIR, "RegimeAdapter.ts");
const REVENUE_FILE = path.join(ADAPTERS_DIR, "MonthlyRevenueAdapter.ts");

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const VALID_QUOTE: QuoteAdapterInput = {
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

const VALID_REGIME: RegimeAdapterInput = {
  date: "2024-01-15",
  regimeLabel: "BULL",
  confidence: 0.82,
  pitSafetyJson: { verified: true },
  source: "research-engine",
  version: "v1.0",
};

const VALID_REVENUE: MonthlyRevenueAdapterInput = {
  year: 2024,
  month: 1,
  revenue: 62_000_000_000,
  yoyGrowth: 0.12,
  momGrowth: 0.03,
  releaseDate: "2024-02-10",
  releaseDateSource: "twse",
  releaseDateConfidence: "HIGH",
};

const AS_OF = "2024-01-15";

// Helper: read a source file for import-scan assertions
function readAdapterSource(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

function hasNoDbImports(source: string): boolean {
  return (
    !/@prisma\/client/.test(source) &&
    !/from ['"]pg['"]/.test(source) &&
    !/from ['"]mysql/.test(source) &&
    !/from ['"]better-sqlite/.test(source) &&
    !/from ['"]fs['"]/.test(source) &&
    !/from ['"]node:fs['"]/.test(source) &&
    !/from ['"]https?['"]/.test(source) &&
    !/from ['"]axios['"]/.test(source) &&
    !/from ['"]node-fetch['"]/.test(source) &&
    !/from ['"]child_process['"]/.test(source)
  );
}

// ─── T58.1 — QuoteAdapter ─────────────────────────────────────────────────────
describe("T58.1 — QuoteAdapter", () => {
  // 1. returns PIT_SAFE fact for valid quote
  it("returns PIT_SAFE fact for valid quote", () => {
    const result = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    expect(result).not.toBeNull();
    expect(result?.pitGateStatus).toBe("PIT_SAFE");
  });

  // 2. returns null for empty date
  it("returns null for empty date", () => {
    const result = QuoteAdapter.adapt({ ...VALID_QUOTE, date: "" }, AS_OF);
    expect(result).toBeNull();
  });

  // 3. trims / rejects whitespace date
  it("returns null for whitespace-only date", () => {
    const result = QuoteAdapter.adapt({ ...VALID_QUOTE, date: "   " }, AS_OF);
    expect(result).toBeNull();
  });

  // 4. preserves input data exactly
  it("preserves input data exactly", () => {
    const result = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    expect(result?.data).toBe(VALID_QUOTE);
  });

  // 5. uses sourceName Quote
  it("uses sourceName Quote", () => {
    const result = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    expect(result?.sourceName).toBe("Quote");
  });

  // 6. uses pitGateField date
  it("uses pitGateField date", () => {
    const result = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    expect(result?.pitGateField).toBe("date");
  });

  // 7. uses observedAt = date
  it("uses observedAt equal to date", () => {
    const result = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    expect(result?.observedAt).toBe(VALID_QUOTE.date);
  });

  // 8. output JSON serializable
  it("output is JSON-serializable", () => {
    const result = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    expect(() => JSON.stringify(result)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(result));
    expect(parsed.sourceName).toBe("Quote");
  });

  // 9. output has no forbidden fields
  it("output has no forbidden fields at any level", () => {
    const result = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    const topKeys = Object.keys(result!);
    const dataKeys = Object.keys(result!.data);
    (REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS as ReadonlyArray<string>).forEach((f) => {
      expect(topKeys).not.toContain(f);
      expect(dataKeys).not.toContain(f);
    });
  });

  // 10. module has no DB / Prisma / FS / network imports
  it("QuoteAdapter source file has no DB/Prisma/FS/network imports", () => {
    const source = readAdapterSource(QUOTE_FILE);
    expect(hasNoDbImports(source)).toBe(true);
  });

  // 11. governance entersAlphaScore=false
  it("governance: entersAlphaScore = false", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  // 12. contract version matches P57
  it("adapter version matches REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION", () => {
    expect(QuoteAdapter.version).toBe(REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION);
  });

  // Extra: sourceTrace
  it("sourceTrace is 'Quote.date'", () => {
    const result = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    expect(result?.sourceTrace).toBe("Quote.date");
  });

  // Extra: asOfDate is forwarded
  it("asOfDate is set from argument", () => {
    const result = QuoteAdapter.adapt(VALID_QUOTE, "2024-03-01");
    expect(result?.asOfDate).toBe("2024-03-01");
  });

  // Extra: auditFlags is empty array for PIT_SAFE
  it("auditFlags is empty for PIT_SAFE quote", () => {
    const result = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    expect(result?.auditFlags).toEqual([]);
  });
});

// ─── T58.2 — RegimeAdapter ────────────────────────────────────────────────────
describe("T58.2 — RegimeAdapter", () => {
  // 13. returns PIT_SAFE fact for valid regime
  it("returns PIT_SAFE fact for valid regime", () => {
    const result = RegimeAdapter.adapt(VALID_REGIME, AS_OF);
    expect(result).not.toBeNull();
    expect(result?.pitGateStatus).toBe("PIT_SAFE");
  });

  // 14. returns null for empty date
  it("returns null for empty date", () => {
    const result = RegimeAdapter.adapt({ ...VALID_REGIME, date: "" }, AS_OF);
    expect(result).toBeNull();
  });

  // 15. returns null for missing pitSafetyJson
  it("returns null for null pitSafetyJson", () => {
    const result = RegimeAdapter.adapt({ ...VALID_REGIME, pitSafetyJson: null }, AS_OF);
    expect(result).toBeNull();
  });

  it("returns null for undefined pitSafetyJson", () => {
    const result = RegimeAdapter.adapt({ ...VALID_REGIME, pitSafetyJson: undefined }, AS_OF);
    expect(result).toBeNull();
  });

  // 16. preserves input data exactly
  it("preserves input data exactly", () => {
    const result = RegimeAdapter.adapt(VALID_REGIME, AS_OF);
    expect(result?.data).toBe(VALID_REGIME);
  });

  // 17. uses sourceName Regime
  it("uses sourceName Regime", () => {
    const result = RegimeAdapter.adapt(VALID_REGIME, AS_OF);
    expect(result?.sourceName).toBe("Regime");
  });

  // 18. uses pitGateField date
  it("uses pitGateField date", () => {
    const result = RegimeAdapter.adapt(VALID_REGIME, AS_OF);
    expect(result?.pitGateField).toBe("date");
  });

  // 19. uses sourceTrace Regime.date+pitSafetyJson
  it("uses sourceTrace 'Regime.date+pitSafetyJson'", () => {
    const result = RegimeAdapter.adapt(VALID_REGIME, AS_OF);
    expect(result?.sourceTrace).toBe("Regime.date+pitSafetyJson");
  });

  // 20. output JSON serializable
  it("output is JSON-serializable", () => {
    const result = RegimeAdapter.adapt(VALID_REGIME, AS_OF);
    expect(() => JSON.stringify(result)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(result));
    expect(parsed.sourceName).toBe("Regime");
  });

  // 21. output has no forbidden fields
  it("output has no forbidden fields at any level", () => {
    const result = RegimeAdapter.adapt(VALID_REGIME, AS_OF);
    const topKeys = Object.keys(result!);
    const dataKeys = Object.keys(result!.data);
    (REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS as ReadonlyArray<string>).forEach((f) => {
      expect(topKeys).not.toContain(f);
      expect(dataKeys).not.toContain(f);
    });
  });

  // 22. module has no DB / Prisma / FS / network imports
  it("RegimeAdapter source file has no DB/Prisma/FS/network imports", () => {
    const source = readAdapterSource(REGIME_FILE);
    expect(hasNoDbImports(source)).toBe(true);
  });

  // 23. governance entersAlphaScore=false
  it("governance: entersAlphaScore = false", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  // 24. contract version matches P57
  it("adapter version matches REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION", () => {
    expect(RegimeAdapter.version).toBe(REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION);
  });

  // Extra: whitespace date returns null
  it("returns null for whitespace-only date", () => {
    const result = RegimeAdapter.adapt({ ...VALID_REGIME, date: "  " }, AS_OF);
    expect(result).toBeNull();
  });

  // Extra: asOfDate is forwarded
  it("asOfDate is set from argument", () => {
    const result = RegimeAdapter.adapt(VALID_REGIME, "2024-06-01");
    expect(result?.asOfDate).toBe("2024-06-01");
  });

  // Extra: observedAt = date
  it("observedAt equals input.date", () => {
    const result = RegimeAdapter.adapt(VALID_REGIME, AS_OF);
    expect(result?.observedAt).toBe(VALID_REGIME.date);
  });
});

// ─── T58.3 — MonthlyRevenueAdapter ───────────────────────────────────────────
describe("T58.3 — MonthlyRevenueAdapter", () => {
  // 25. returns PIT_SAFE when releaseDate present
  it("returns PIT_SAFE when releaseDate is present", () => {
    const result = MonthlyRevenueAdapter.adapt(VALID_REVENUE, AS_OF);
    expect(result).not.toBeNull();
    expect(result?.pitGateStatus).toBe("PIT_SAFE");
  });

  // 26. returns LOW_CONFIDENCE_PIT_INFERRED when releaseDate null
  it("returns LOW_CONFIDENCE_PIT_INFERRED when releaseDate is null", () => {
    const result = MonthlyRevenueAdapter.adapt(
      { ...VALID_REVENUE, releaseDate: null },
      AS_OF,
    );
    expect(result).not.toBeNull();
    expect(result?.pitGateStatus).toBe("LOW_CONFIDENCE_PIT_INFERRED");
  });

  // 27. returns LOW_CONFIDENCE_PIT_INFERRED when releaseDate empty
  it("returns LOW_CONFIDENCE_PIT_INFERRED when releaseDate is empty string", () => {
    const result = MonthlyRevenueAdapter.adapt(
      { ...VALID_REVENUE, releaseDate: "" },
      AS_OF,
    );
    expect(result).not.toBeNull();
    expect(result?.pitGateStatus).toBe("LOW_CONFIDENCE_PIT_INFERRED");
  });

  // 28. returns null for invalid year
  it("returns null for NaN year", () => {
    const result = MonthlyRevenueAdapter.adapt(
      { ...VALID_REVENUE, year: NaN },
      AS_OF,
    );
    expect(result).toBeNull();
  });

  // 29. returns null for invalid month
  it("returns null for Infinity month", () => {
    const result = MonthlyRevenueAdapter.adapt(
      { ...VALID_REVENUE, month: Infinity },
      AS_OF,
    );
    expect(result).toBeNull();
  });

  // 30. preserves input data exactly
  it("preserves input data exactly", () => {
    const result = MonthlyRevenueAdapter.adapt(VALID_REVENUE, AS_OF);
    expect(result?.data).toBe(VALID_REVENUE);
  });

  // 31. uses sourceName MonthlyRevenue
  it("uses sourceName MonthlyRevenue", () => {
    const result = MonthlyRevenueAdapter.adapt(VALID_REVENUE, AS_OF);
    expect(result?.sourceName).toBe("MonthlyRevenue");
  });

  // 32. uses pitGateField releaseDate
  it("uses pitGateField 'releaseDate'", () => {
    const result = MonthlyRevenueAdapter.adapt(VALID_REVENUE, AS_OF);
    expect(result?.pitGateField).toBe("releaseDate");
  });

  // 33. uses observedAt = releaseDate when present
  it("uses observedAt equal to releaseDate when present", () => {
    const result = MonthlyRevenueAdapter.adapt(VALID_REVENUE, AS_OF);
    expect(result?.observedAt).toBe(VALID_REVENUE.releaseDate);
  });

  // 34. uses observedAt null when releaseDate missing
  it("observedAt is null when releaseDate is null", () => {
    const result = MonthlyRevenueAdapter.adapt(
      { ...VALID_REVENUE, releaseDate: null },
      AS_OF,
    );
    expect(result?.observedAt).toBeNull();
  });

  // 35. output JSON serializable
  it("output is JSON-serializable", () => {
    const result = MonthlyRevenueAdapter.adapt(VALID_REVENUE, AS_OF);
    expect(() => JSON.stringify(result)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(result));
    expect(parsed.sourceName).toBe("MonthlyRevenue");
  });

  // 36. output has no forbidden fields
  it("output has no forbidden fields at any level", () => {
    const result = MonthlyRevenueAdapter.adapt(VALID_REVENUE, AS_OF);
    const topKeys = Object.keys(result!);
    const dataKeys = Object.keys(result!.data);
    (REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS as ReadonlyArray<string>).forEach((f) => {
      expect(topKeys).not.toContain(f);
      expect(dataKeys).not.toContain(f);
    });
  });

  // 37. module has no DB / Prisma / FS / network imports
  it("MonthlyRevenueAdapter source file has no DB/Prisma/FS/network imports", () => {
    const source = readAdapterSource(REVENUE_FILE);
    expect(hasNoDbImports(source)).toBe(true);
  });

  // 38. governance entersAlphaScore=false
  it("governance: entersAlphaScore = false", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE.entersAlphaScore).toBe(false);
  });

  // 39. contract version matches P57
  it("adapter version matches REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION", () => {
    expect(MonthlyRevenueAdapter.version).toBe(
      REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION,
    );
  });

  // 40. releaseDateConfidence LOW preserved in data
  it("releaseDateConfidence LOW is preserved in data", () => {
    const input: MonthlyRevenueAdapterInput = {
      ...VALID_REVENUE,
      releaseDateConfidence: "LOW",
    };
    const result = MonthlyRevenueAdapter.adapt(input, AS_OF);
    expect(result?.data.releaseDateConfidence).toBe("LOW");
  });

  // Extra: auditFlags includes both flags when releaseDate is null
  it("auditFlags includes LOW_CONFIDENCE_PIT_INFERRED + RELEASE_DATE_NULL_FALLBACK_USED when null", () => {
    const result = MonthlyRevenueAdapter.adapt(
      { ...VALID_REVENUE, releaseDate: null },
      AS_OF,
    );
    expect(result?.auditFlags).toContain("LOW_CONFIDENCE_PIT_INFERRED");
    expect(result?.auditFlags).toContain("RELEASE_DATE_NULL_FALLBACK_USED");
  });

  // Extra: auditFlags is empty when PIT_SAFE
  it("auditFlags is empty when PIT_SAFE (releaseDate present)", () => {
    const result = MonthlyRevenueAdapter.adapt(VALID_REVENUE, AS_OF);
    expect(result?.auditFlags).toEqual([]);
  });

  // Extra: pitGateValue is null when releaseDate absent
  it("pitGateValue is null when releaseDate is null", () => {
    const result = MonthlyRevenueAdapter.adapt(
      { ...VALID_REVENUE, releaseDate: null },
      AS_OF,
    );
    expect(result?.pitGateValue).toBeNull();
  });

  // Extra: pitGateValue equals releaseDate when present
  it("pitGateValue equals releaseDate when present", () => {
    const result = MonthlyRevenueAdapter.adapt(VALID_REVENUE, AS_OF);
    expect(result?.pitGateValue).toBe(VALID_REVENUE.releaseDate);
  });

  // Extra: asOfDate is set from argument
  it("asOfDate is set from argument", () => {
    const result = MonthlyRevenueAdapter.adapt(VALID_REVENUE, "2024-12-31");
    expect(result?.asOfDate).toBe("2024-12-31");
  });
});

// ─── T58.4 — Cross-adapter shared invariants ──────────────────────────────────
describe("T58.4 — Cross-adapter shared invariants", () => {
  // 41. all adapters expose sourceName
  it("all adapters expose a non-empty sourceName property", () => {
    expect(QuoteAdapter.sourceName).toBeTruthy();
    expect(RegimeAdapter.sourceName).toBeTruthy();
    expect(MonthlyRevenueAdapter.sourceName).toBeTruthy();
  });

  // 42. all adapters expose version
  it("all adapters expose the contract version string", () => {
    expect(QuoteAdapter.version).toBe(REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION);
    expect(RegimeAdapter.version).toBe(REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION);
    expect(MonthlyRevenueAdapter.version).toBe(REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION);
  });

  // 43. all valid outputs include asOfDate
  it("all valid outputs include asOfDate", () => {
    const q = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    const r = RegimeAdapter.adapt(VALID_REGIME, AS_OF);
    const m = MonthlyRevenueAdapter.adapt(VALID_REVENUE, AS_OF);
    expect(q?.asOfDate).toBe(AS_OF);
    expect(r?.asOfDate).toBe(AS_OF);
    expect(m?.asOfDate).toBe(AS_OF);
  });

  // 44. all valid outputs use allowed PitGateStatus values
  it("all valid outputs use an allowed PitGateStatus", () => {
    const allowed = ["PIT_SAFE", "LOW_CONFIDENCE_PIT_INFERRED", "PIT_BLOCKED"];
    const q = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    const r = RegimeAdapter.adapt(VALID_REGIME, AS_OF);
    const m = MonthlyRevenueAdapter.adapt(VALID_REVENUE, AS_OF);
    expect(allowed).toContain(q?.pitGateStatus);
    expect(allowed).toContain(r?.pitGateStatus);
    expect(allowed).toContain(m?.pitGateStatus);
  });

  // 45. none of the adapters mutate input
  it("adapters do not mutate input objects", () => {
    const quoteCopy = { ...VALID_QUOTE };
    const regimeCopy = { ...VALID_REGIME };
    const revenueCopy = { ...VALID_REVENUE };
    QuoteAdapter.adapt(quoteCopy, AS_OF);
    RegimeAdapter.adapt(regimeCopy, AS_OF);
    MonthlyRevenueAdapter.adapt(revenueCopy, AS_OF);
    expect(quoteCopy).toEqual(VALID_QUOTE);
    expect(regimeCopy).toEqual(VALID_REGIME);
    expect(revenueCopy).toEqual(VALID_REVENUE);
  });

  // 46. combined outputs are JSON serializable
  it("all adapter outputs together are JSON-serializable as an array", () => {
    const q = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    const r = RegimeAdapter.adapt(VALID_REGIME, AS_OF);
    const m = MonthlyRevenueAdapter.adapt(VALID_REVENUE, AS_OF);
    expect(() => JSON.stringify([q, r, m])).not.toThrow();
    const parsed = JSON.parse(JSON.stringify([q, r, m]));
    expect(parsed).toHaveLength(3);
  });

  // 47. forbidden field scan across all adapter source files passes
  it("no forbidden field appears as property key in any adapter source file", () => {
    const files = [QUOTE_FILE, REGIME_FILE, REVENUE_FILE];
    const PROPERTY_KEY_CANDIDATES = [
      "recommendation", "targetPrice", "ROI", "PnL", "winRate",
      "edge", "alphaScore", "forecast", "expectedReturn", "benchmark",
      "optimizer", "backtest", "returnPct", "profit",
    ];
    files.forEach((filePath) => {
      const source = fs.readFileSync(filePath, "utf-8");
      PROPERTY_KEY_CANDIDATES.forEach((field) => {
        const propPattern = new RegExp(
          `^\\s+(?:readonly\\s+)?\\b${field}\\b\\s*[?:]`,
          "m",
        );
        expect(source).not.toMatch(propPattern);
      });
    });
  });

  // 48. no FinancialReport / Chip / NewsEvent adapter exists or is imported
  it("no FinancialReport / Chip / NewsEvent adapter file exists in v1/adapters/", () => {
    const entries = fs.readdirSync(ADAPTERS_DIR);
    const forbidden = ["FinancialReport", "Chip", "InstitutionalChip", "NewsEvent"];
    forbidden.forEach((name) => {
      const match = entries.some((e) => e.includes(name));
      expect(match).toBe(false);
    });
  });
});

// ─── T58.5 — Additional edge cases and guard rails ───────────────────────────
describe("T58.5 — Additional edge cases", () => {
  it("QuoteAdapter: stockId is preserved in data", () => {
    const result = QuoteAdapter.adapt(VALID_QUOTE, AS_OF);
    expect(result?.data.stockId).toBe("TSE:2330");
  });

  it("QuoteAdapter: null numeric fields are preserved", () => {
    const input: QuoteAdapterInput = { ...VALID_QUOTE, close: null, volume: null };
    const result = QuoteAdapter.adapt(input, AS_OF);
    expect(result?.data.close).toBeNull();
    expect(result?.data.volume).toBeNull();
  });

  it("RegimeAdapter: returns PIT_SAFE when pitSafetyJson is an empty object", () => {
    const result = RegimeAdapter.adapt({ ...VALID_REGIME, pitSafetyJson: {} }, AS_OF);
    expect(result?.pitGateStatus).toBe("PIT_SAFE");
  });

  it("RegimeAdapter: returns PIT_SAFE when pitSafetyJson is a string", () => {
    const result = RegimeAdapter.adapt({ ...VALID_REGIME, pitSafetyJson: "yes" }, AS_OF);
    expect(result?.pitGateStatus).toBe("PIT_SAFE");
  });

  it("RegimeAdapter: null confidence is preserved in data", () => {
    const result = RegimeAdapter.adapt({ ...VALID_REGIME, confidence: null }, AS_OF);
    expect(result?.data.confidence).toBeNull();
  });

  it("MonthlyRevenueAdapter: returns null for -Infinity year", () => {
    const result = MonthlyRevenueAdapter.adapt({ ...VALID_REVENUE, year: -Infinity }, AS_OF);
    expect(result).toBeNull();
  });

  it("MonthlyRevenueAdapter: yoyGrowth null is preserved", () => {
    const result = MonthlyRevenueAdapter.adapt({ ...VALID_REVENUE, yoyGrowth: null }, AS_OF);
    expect(result?.data.yoyGrowth).toBeNull();
  });

  it("MonthlyRevenueAdapter: revenue null is preserved in data", () => {
    const result = MonthlyRevenueAdapter.adapt({ ...VALID_REVENUE, revenue: null }, AS_OF);
    expect(result?.data.revenue).toBeNull();
  });

  it("MonthlyRevenueAdapter: MEDIUM releaseDateConfidence preserved", () => {
    const result = MonthlyRevenueAdapter.adapt(
      { ...VALID_REVENUE, releaseDateConfidence: "MEDIUM" },
      AS_OF,
    );
    expect(result?.data.releaseDateConfidence).toBe("MEDIUM");
  });

  it("all three adapters have distinct sourceName values", () => {
    const names = new Set([
      QuoteAdapter.sourceName,
      RegimeAdapter.sourceName,
      MonthlyRevenueAdapter.sourceName,
    ]);
    expect(names.size).toBe(3);
  });

  it("all adapters only import from the P57 contract (no external packages)", () => {
    const files = [QUOTE_FILE, REGIME_FILE, REVENUE_FILE];
    files.forEach((filePath) => {
      const source = fs.readFileSync(filePath, "utf-8");
      // All `from "..."` imports must reference P57 contract only
      const importLines = source
        .split("\n")
        .filter((line) => /from ['"]/.test(line));
      importLines.forEach((line) => {
        expect(line).toMatch(/RealDataSnapshotInputContract/);
      });
    });
  });
});
