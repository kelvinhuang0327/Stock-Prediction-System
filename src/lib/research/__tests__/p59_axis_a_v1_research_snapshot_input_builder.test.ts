/**
 * P59 — Axis A v1 Research Snapshot Input Builder — Test Suite
 *
 * Tests for ResearchSnapshotInputBuilder (buildResearchSnapshotInput).
 * 60+ tests across T59.1 – T59.10.
 *
 * Governance:
 *   paperOnly = true | dryRunOnly = true | entersAlphaScore = false
 *   notInvestmentAdvice = true | No DB | No Prisma | No scoring
 *
 * Classification: P59_AXIS_A_V1_RESEARCH_SNAPSHOT_INPUT_BUILDER
 *
 * DISCLAIMER: Research snapshot tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRunOnly = true.
 */

import * as fs from "fs";
import * as path from "path";

import {
  buildResearchSnapshotInput,
  RESEARCH_SNAPSHOT_INPUT_BUILDER_VERSION,
  type ResearchSnapshotInput,
  type ResearchSnapshotInputBuilderParams,
} from "@/lib/research/snapshot/v1/ResearchSnapshotInputBuilder";

import {
  REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION,
  REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS,
  REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE,
  type MonthlyRevenueAdapterInput,
  type QuoteAdapterInput,
  type RegimeAdapterInput,
} from "@/lib/research/snapshot/v1/RealDataSnapshotInputContract";

// ─── Source file path (for import-scan tests) ────────────────────────────────

const BUILDER_FILE = path.resolve(
  __dirname,
  "../snapshot/v1/ResearchSnapshotInputBuilder.ts",
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

// ─── Helper: recursive forbidden field scan ───────────────────────────────────

function findForbiddenFields(
  obj: unknown,
  path: string[] = [],
): string[] {
  const violations: string[] = [];
  if (obj === null || obj === undefined || typeof obj !== "object") return violations;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const fullPath = [...path, key].join(".");
    const forbidden = REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS as ReadonlyArray<string>;
    if (forbidden.includes(key) && key !== "entersAlphaScore") {
      violations.push(fullPath);
    }
    violations.push(
      ...findForbiddenFields((obj as Record<string, unknown>)[key], [...path, key]),
    );
  }
  return violations;
}

// ─── T59.1 — Builder basics ──────────────────────────────────────────────────

describe("T59.1 — Builder basics", () => {
  test("1. exports the exact builder version string", () => {
    expect(RESEARCH_SNAPSHOT_INPUT_BUILDER_VERSION).toBe(
      "p59-axis-a-v1-research-snapshot-input-builder-v0",
    );
  });

  test("2. output.version equals P57 contract version", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.version).toBe(REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION);
  });

  test("3. output.builderVersion equals P59 builder version", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.builderVersion).toBe(RESEARCH_SNAPSHOT_INPUT_BUILDER_VERSION);
  });

  test("4. output.asOfDate equals param asOfDate", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.asOfDate).toBe(AS_OF_DATE);
  });

  test("5. output includes a governance object", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.governance).toBeDefined();
    expect(typeof result.governance).toBe("object");
  });

  test("6. governance.paperOnly is true", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.governance.paperOnly).toBe(true);
  });

  test("7. governance.dryRunOnly is true", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.governance.dryRunOnly).toBe(true);
  });

  test("8. governance.entersAlphaScore is false", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.governance.entersAlphaScore).toBe(false);
  });

  test("9. governance.notInvestmentAdvice is true", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.governance.notInvestmentAdvice).toBe(true);
  });

  test("10. governance equals the exported REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.governance).toBe(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE);
  });
});

// ─── T59.2 — Null input paths ────────────────────────────────────────────────

describe("T59.2 — Null input paths", () => {
  test("11. all null inputs → quote null", () => {
    const result = buildResearchSnapshotInput(ALL_NULL_PARAMS);
    expect(result.quote).toBeNull();
  });

  test("12. all null inputs → regime null", () => {
    const result = buildResearchSnapshotInput(ALL_NULL_PARAMS);
    expect(result.regime).toBeNull();
  });

  test("13. all null inputs → monthlyRevenue null", () => {
    const result = buildResearchSnapshotInput(ALL_NULL_PARAMS);
    expect(result.monthlyRevenue).toBeNull();
  });

  test("14. null quoteInput → output.quote is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      quoteInput: null,
    });
    expect(result.quote).toBeNull();
  });

  test("15. null regimeInput → output.regime is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      regimeInput: null,
    });
    expect(result.regime).toBeNull();
  });

  test("16. null monthlyRevenueInput → output.monthlyRevenue is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      monthlyRevenueInput: null,
    });
    expect(result.monthlyRevenue).toBeNull();
  });

  test("17. null quoteInput does not affect regime", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      quoteInput: null,
    });
    expect(result.regime).not.toBeNull();
  });

  test("18. null quoteInput does not affect monthlyRevenue", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      quoteInput: null,
    });
    expect(result.monthlyRevenue).not.toBeNull();
  });

  test("19. null regimeInput does not affect quote", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      regimeInput: null,
    });
    expect(result.quote).not.toBeNull();
  });

  test("20. null regimeInput does not affect monthlyRevenue", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      regimeInput: null,
    });
    expect(result.monthlyRevenue).not.toBeNull();
  });

  test("21. null monthlyRevenueInput does not affect quote", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      monthlyRevenueInput: null,
    });
    expect(result.quote).not.toBeNull();
  });

  test("22. null monthlyRevenueInput does not affect regime", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      monthlyRevenueInput: null,
    });
    expect(result.regime).not.toBeNull();
  });

  test("23. all null inputs still produce valid version", () => {
    const result = buildResearchSnapshotInput(ALL_NULL_PARAMS);
    expect(result.version).toBe(REAL_DATA_SNAPSHOT_INPUT_CONTRACT_VERSION);
  });

  test("24. all null inputs still produce valid governance", () => {
    const result = buildResearchSnapshotInput(ALL_NULL_PARAMS);
    expect(result.governance.entersAlphaScore).toBe(false);
    expect(result.governance.paperOnly).toBe(true);
  });
});

// ─── T59.3 — Adapter PIT fail paths ──────────────────────────────────────────

describe("T59.3 — Adapter PIT fail paths", () => {
  test("25. quote with empty date → adapter returns null → output.quote is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      quoteInput: { ...VALID_QUOTE, date: "" },
    });
    expect(result.quote).toBeNull();
  });

  test("26. quote with whitespace date → adapter returns null → output.quote is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      quoteInput: { ...VALID_QUOTE, date: "   " },
    });
    expect(result.quote).toBeNull();
  });

  test("27. regime with empty date → adapter returns null → output.regime is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      regimeInput: { ...VALID_REGIME, date: "" },
    });
    expect(result.regime).toBeNull();
  });

  test("28. regime with whitespace date → adapter returns null → output.regime is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      regimeInput: { ...VALID_REGIME, date: "   " },
    });
    expect(result.regime).toBeNull();
  });

  test("29. regime with null pitSafetyJson → adapter returns null → output.regime is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      regimeInput: { ...VALID_REGIME, pitSafetyJson: null },
    });
    expect(result.regime).toBeNull();
  });

  test("30. regime with undefined pitSafetyJson → adapter returns null → output.regime is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      regimeInput: { ...VALID_REGIME, pitSafetyJson: undefined },
    });
    expect(result.regime).toBeNull();
  });

  test("31. monthlyRevenue with NaN year → adapter returns null → output.monthlyRevenue is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      monthlyRevenueInput: { ...VALID_REVENUE, year: NaN },
    });
    expect(result.monthlyRevenue).toBeNull();
  });

  test("32. monthlyRevenue with NaN month → adapter returns null → output.monthlyRevenue is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      monthlyRevenueInput: { ...VALID_REVENUE, month: NaN },
    });
    expect(result.monthlyRevenue).toBeNull();
  });

  test("33. monthlyRevenue with Infinity year → adapter returns null → output.monthlyRevenue is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      monthlyRevenueInput: { ...VALID_REVENUE, year: Infinity },
    });
    expect(result.monthlyRevenue).toBeNull();
  });

  test("34. adapter fail on quote does not affect regime or monthlyRevenue", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      quoteInput: { ...VALID_QUOTE, date: "" },
    });
    expect(result.quote).toBeNull();
    expect(result.regime).not.toBeNull();
    expect(result.monthlyRevenue).not.toBeNull();
  });
});

// ─── T59.4 — Valid paths: fact content ───────────────────────────────────────

describe("T59.4 — Valid paths: fact content", () => {
  test("35. all valid inputs → all three facts are non-null", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.quote).not.toBeNull();
    expect(result.regime).not.toBeNull();
    expect(result.monthlyRevenue).not.toBeNull();
  });

  test("36. output.quote.sourceName is 'Quote'", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.quote?.sourceName).toBe("Quote");
  });

  test("37. output.regime.sourceName is 'Regime'", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.regime?.sourceName).toBe("Regime");
  });

  test("38. output.monthlyRevenue.sourceName is 'MonthlyRevenue'", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.monthlyRevenue?.sourceName).toBe("MonthlyRevenue");
  });

  test("39. quote.pitGateStatus is PIT_SAFE for valid date", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.quote?.pitGateStatus).toBe("PIT_SAFE");
  });

  test("40. regime.pitGateStatus is PIT_SAFE for valid date + pitSafetyJson", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.regime?.pitGateStatus).toBe("PIT_SAFE");
  });

  test("41. monthlyRevenue.pitGateStatus is PIT_SAFE when releaseDate present", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.monthlyRevenue?.pitGateStatus).toBe("PIT_SAFE");
  });

  test("42. monthlyRevenue.pitGateStatus is LOW_CONFIDENCE_PIT_INFERRED when releaseDate null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      monthlyRevenueInput: REVENUE_NO_RELEASE,
    });
    expect(result.monthlyRevenue?.pitGateStatus).toBe("LOW_CONFIDENCE_PIT_INFERRED");
  });

  test("43. monthlyRevenue LOW_CONFIDENCE auditFlags contain LOW_CONFIDENCE_PIT_INFERRED", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      monthlyRevenueInput: REVENUE_NO_RELEASE,
    });
    expect(result.monthlyRevenue?.auditFlags).toContain("LOW_CONFIDENCE_PIT_INFERRED");
  });

  test("44. monthlyRevenue LOW_CONFIDENCE auditFlags contain RELEASE_DATE_NULL_FALLBACK_USED", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      monthlyRevenueInput: REVENUE_NO_RELEASE,
    });
    expect(result.monthlyRevenue?.auditFlags).toContain("RELEASE_DATE_NULL_FALLBACK_USED");
  });

  test("45. quote.asOfDate matches builder param asOfDate", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.quote?.asOfDate).toBe(AS_OF_DATE);
  });

  test("46. regime.asOfDate matches builder param asOfDate", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.regime?.asOfDate).toBe(AS_OF_DATE);
  });

  test("47. monthlyRevenue.asOfDate matches builder param asOfDate", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.monthlyRevenue?.asOfDate).toBe(AS_OF_DATE);
  });

  test("48. quote.data deep-equals the input quoteInput", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.quote?.data).toEqual(VALID_QUOTE);
  });

  test("49. regime.data deep-equals the input regimeInput", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.regime?.data).toEqual(VALID_REGIME);
  });

  test("50. monthlyRevenue.data deep-equals the input monthlyRevenueInput", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.monthlyRevenue?.data).toEqual(VALID_REVENUE);
  });

  test("51. quote.sourceTrace is 'Quote.date'", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.quote?.sourceTrace).toBe("Quote.date");
  });

  test("52. regime.sourceTrace is 'Regime.date+pitSafetyJson'", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.regime?.sourceTrace).toBe("Regime.date+pitSafetyJson");
  });

  test("53. monthlyRevenue.sourceTrace is 'MonthlyRevenue.releaseDate'", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.monthlyRevenue?.sourceTrace).toBe("MonthlyRevenue.releaseDate");
  });

  test("54. quote.pitGateField is 'date'", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.quote?.pitGateField).toBe("date");
  });

  test("55. monthlyRevenue.pitGateField is 'releaseDate'", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.monthlyRevenue?.pitGateField).toBe("releaseDate");
  });
});

// ─── T59.5 — Determinism / immutability ──────────────────────────────────────

describe("T59.5 — Determinism / immutability", () => {
  test("56. repeated calls with same inputs produce deep-equal results", () => {
    const result1 = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    const result2 = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result1).toEqual(result2);
  });

  test("57. quoteInput object is not mutated by the builder", () => {
    const input: QuoteAdapterInput = { ...VALID_QUOTE };
    const frozen = Object.freeze({ ...input });
    buildResearchSnapshotInput({ ...ALL_VALID_PARAMS, quoteInput: frozen });
    expect(frozen).toEqual(VALID_QUOTE);
  });

  test("58. regimeInput object is not mutated by the builder", () => {
    const frozen = Object.freeze({ ...VALID_REGIME });
    buildResearchSnapshotInput({ ...ALL_VALID_PARAMS, regimeInput: frozen });
    expect(frozen.date).toBe(VALID_REGIME.date);
    expect(frozen.regimeLabel).toBe(VALID_REGIME.regimeLabel);
  });

  test("59. monthlyRevenueInput object is not mutated by the builder", () => {
    const frozen = Object.freeze({ ...VALID_REVENUE });
    buildResearchSnapshotInput({ ...ALL_VALID_PARAMS, monthlyRevenueInput: frozen });
    expect(frozen.year).toBe(VALID_REVENUE.year);
    expect(frozen.revenue).toBe(VALID_REVENUE.revenue);
  });

  test("60. builder has no side effects: second call after null call still valid", () => {
    buildResearchSnapshotInput(ALL_NULL_PARAMS);
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.quote).not.toBeNull();
    expect(result.regime).not.toBeNull();
    expect(result.monthlyRevenue).not.toBeNull();
  });
});

// ─── T59.6 — JSON safety and forbidden fields ─────────────────────────────────

describe("T59.6 — JSON safety and forbidden fields", () => {
  test("61. all-valid output is JSON-serializable without throwing", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  test("62. all-null output is JSON-serializable without throwing", () => {
    const result = buildResearchSnapshotInput(ALL_NULL_PARAMS);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  test("63. all-valid output has no forbidden fields (recursive scan)", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    const violations = findForbiddenFields(result);
    expect(violations).toHaveLength(0);
  });

  test("64. all-null output has no forbidden fields", () => {
    const result = buildResearchSnapshotInput(ALL_NULL_PARAMS);
    const violations = findForbiddenFields(result);
    expect(violations).toHaveLength(0);
  });

  test("65. output top-level keys are exactly the expected set", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    const keys = Object.keys(result).sort();
    expect(keys).toEqual(
      ["asOfDate", "builderVersion", "governance", "monthlyRevenue", "quote", "regime", "version"].sort(),
    );
  });

  test("66. output.quote fact has expected top-level keys", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    const keys = Object.keys(result.quote!).sort();
    expect(keys).toEqual(
      ["asOfDate", "auditFlags", "data", "observedAt", "pitGateField", "pitGateStatus", "pitGateValue", "sourceName", "sourceTrace"].sort(),
    );
  });

  test("67. output.regime fact has expected top-level keys", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    const keys = Object.keys(result.regime!).sort();
    expect(keys).toEqual(
      ["asOfDate", "auditFlags", "data", "observedAt", "pitGateField", "pitGateStatus", "pitGateValue", "sourceName", "sourceTrace"].sort(),
    );
  });

  test("68. output.monthlyRevenue fact has expected top-level keys", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    const keys = Object.keys(result.monthlyRevenue!).sort();
    expect(keys).toEqual(
      ["asOfDate", "auditFlags", "data", "observedAt", "pitGateField", "pitGateStatus", "pitGateValue", "sourceName", "sourceTrace"].sort(),
    );
  });
});

// ─── T59.7 — Edge cases ───────────────────────────────────────────────────────

describe("T59.7 — Edge cases", () => {
  test("69. empty asOfDate is preserved in output without throwing", () => {
    const result = buildResearchSnapshotInput({ ...ALL_VALID_PARAMS, asOfDate: "" });
    expect(result.asOfDate).toBe("");
  });

  test("70. whitespace-only asOfDate is preserved without throwing", () => {
    const result = buildResearchSnapshotInput({ ...ALL_VALID_PARAMS, asOfDate: "   " });
    expect(result.asOfDate).toBe("   ");
  });

  test("71. quote.observedAt equals input.date when valid", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.quote?.observedAt).toBe(VALID_QUOTE.date);
  });

  test("72. regime.observedAt equals input.date when valid", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.regime?.observedAt).toBe(VALID_REGIME.date);
  });

  test("73. monthlyRevenue.observedAt equals releaseDate when present", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.monthlyRevenue?.observedAt).toBe(VALID_REVENUE.releaseDate);
  });

  test("74. monthlyRevenue.observedAt is null when releaseDate is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      monthlyRevenueInput: REVENUE_NO_RELEASE,
    });
    expect(result.monthlyRevenue?.observedAt).toBeNull();
  });

  test("75. monthlyRevenue.pitGateValue is null when releaseDate is null", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      monthlyRevenueInput: REVENUE_NO_RELEASE,
    });
    expect(result.monthlyRevenue?.pitGateValue).toBeNull();
  });

  test("76. monthlyRevenue releaseDate whitespace → LOW_CONFIDENCE_PIT_INFERRED", () => {
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      monthlyRevenueInput: { ...VALID_REVENUE, releaseDate: "   " },
    });
    expect(result.monthlyRevenue?.pitGateStatus).toBe("LOW_CONFIDENCE_PIT_INFERRED");
  });

  test("77. distinct sourceNames on all three facts", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    const names = new Set([
      result.quote?.sourceName,
      result.regime?.sourceName,
      result.monthlyRevenue?.sourceName,
    ]);
    expect(names.size).toBe(3);
  });

  test("78. governance.noRecommendation is true", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.governance.noRecommendation).toBe(true);
  });

  test("79. governance.noScoring is true", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.governance.noScoring).toBe(true);
  });

  test("80. governance.noBacktest is true", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.governance.noBacktest).toBe(true);
  });
});

// ─── T59.8 — Import scan (source file forbidden imports) ─────────────────────

describe("T59.8 — Import scan (source file guardrails)", () => {
  let builderSource: string;

  beforeAll(() => {
    builderSource = fs.readFileSync(BUILDER_FILE, "utf-8");
  });

  test("34. source file has no Prisma import", () => {
    // Use precise pattern — JSDoc comment mentions "Prisma" as a negation
    expect(builderSource).not.toMatch(/@prisma\/client/);
  });

  test("35. source file has no DB import (@prisma/client)", () => {
    expect(builderSource).not.toMatch(/@prisma\/client/);
  });

  test("36. source file has no fs / path / network / child_process import", () => {
    // Use precise from 'X' patterns — JSDoc comment text mentions "child_process" as negation
    expect(builderSource).not.toMatch(/from ['"]fs['"]/);
    expect(builderSource).not.toMatch(/from ['"]node:fs['"]/);
    expect(builderSource).not.toMatch(/from ['"]path['"]/);
    expect(builderSource).not.toMatch(/from ['"]http['"]/);
    expect(builderSource).not.toMatch(/from ['"]https['"]/);
    expect(builderSource).not.toMatch(/from ['"]node-fetch['"]/);
    expect(builderSource).not.toMatch(/from ['"]axios['"]/);
    expect(builderSource).not.toMatch(/from ['"]child_process['"]/);
  });

  test("37. source file does not import FinancialReport", () => {
    // JSDoc comment mentions "FinancialReport" as a negation — check import paths only
    const fromPaths = Array.from(
      builderSource.matchAll(/from ['"]([^'"]+)['"]/g),
      (m) => m[1],
    );
    for (const p of fromPaths) {
      expect(p).not.toMatch(/FinancialReport/);
    }
  });

  test("38. source file does not import ChipAdapter", () => {
    const fromPaths = Array.from(
      builderSource.matchAll(/from ['"]([^'"]+)['"]/g),
      (m) => m[1],
    );
    for (const p of fromPaths) {
      expect(p).not.toMatch(/ChipAdapter/);
    }
  });

  test("39. source file does not import NewsEvent", () => {
    // JSDoc comment mentions "NewsEvent" as a negation — check import paths only
    const fromPaths = Array.from(
      builderSource.matchAll(/from ['"]([^'"]+)['"]/g),
      (m) => m[1],
    );
    for (const p of fromPaths) {
      expect(p).not.toMatch(/NewsEvent/);
    }
  });

  test("40. source file does not mention optimizer or backtest outside comments", () => {
    const lines = builderSource.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"));
    const joined = lines.join("\n");
    expect(joined).not.toMatch(/optimizer|backtest/i);
  });

  test("41. source file does not mention recommendation outside comments", () => {
    const lines = builderSource.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"));
    const joined = lines.join("\n");
    expect(joined).not.toMatch(/recommendation/i);
  });

  test("42. source file only imports from P57 contract and P58 adapters", () => {
    // Extract from "..." paths from all import statements
    const fromMatches = Array.from(
      builderSource.matchAll(/from ['"](.*?)['"];/g),
      (m) => m[1],
    );
    for (const fromPath of fromMatches) {
      expect(fromPath).toMatch(
        /RealDataSnapshotInputContract|QuoteAdapter|RegimeAdapter|MonthlyRevenueAdapter/,
      );
    }
  });
});

// ─── T59.9 — P57/P58 contract compatibility ───────────────────────────────────

describe("T59.9 — P57/P58 contract compatibility", () => {
  test("60. P59 is compatible: builder uses P57 contract version in output", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.version).toBe("p57-axis-a-v1-real-data-snapshot-input-contract-v0");
  });

  test("P57 forbidden fields list is non-empty", () => {
    expect(REAL_DATA_SNAPSHOT_INPUT_FORBIDDEN_FIELDS.length).toBeGreaterThan(0);
  });

  test("P59 builder version contains 'p59'", () => {
    expect(RESEARCH_SNAPSHOT_INPUT_BUILDER_VERSION).toMatch(/^p59/);
  });

  test("all facts asOfDate are forwarded correctly from builder params", () => {
    const customDate = "2025-06-01";
    const result = buildResearchSnapshotInput({
      ...ALL_VALID_PARAMS,
      asOfDate: customDate,
    });
    expect(result.quote?.asOfDate).toBe(customDate);
    expect(result.regime?.asOfDate).toBe(customDate);
    expect(result.monthlyRevenue?.asOfDate).toBe(customDate);
  });
});

// ─── T59.10 — P59 governance constants ───────────────────────────────────────

describe("T59.10 — Governance invariants", () => {
  test("governance object is the exact same reference as REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.governance).toBe(REAL_DATA_SNAPSHOT_INPUT_GOVERNANCE);
  });

  test("governance.noOptimizer is true", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(result.governance.noOptimizer).toBe(true);
  });

  test("governance object has exactly 8 keys", () => {
    const result = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    expect(Object.keys(result.governance)).toHaveLength(8);
  });

  test("entersAlphaScore is never true in any output shape", () => {
    const r1 = buildResearchSnapshotInput(ALL_VALID_PARAMS);
    const r2 = buildResearchSnapshotInput(ALL_NULL_PARAMS);
    expect(r1.governance.entersAlphaScore).toBe(false);
    expect(r2.governance.entersAlphaScore).toBe(false);
  });
});
