/**
 * P36 — MonthlyRevenue Controlled Feature Consumer Readiness Tests
 *
 * Tests the consumer contract and readiness evaluator. All tests are pure unit
 * tests — no DB access, no side effects, fully deterministic.
 *
 * DISCLAIMER: Test suite for structural audit contract only.
 * MonthlyRevenue entersAlphaScore = false. ALWAYS.
 * No buy/sell/hold semantics. Not investment advice.
 */

import {
  MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT,
  validateControlledConsumerContract,
  checkConsumerOutputRow,
  CONTROLLED_CONSUMER_CONTRACT_VERSION,
  FORBIDDEN_CONSUMER_OUTPUT_FIELDS,
  ALLOWED_CONSUMER_INPUT_FIELDS,
  mapConfidenceTier,
} from "../p36/MonthlyRevenueControlledConsumerContract";

import {
  evaluateRowConsumerReadiness,
  evaluateBatchConsumerReadiness,
  type MonthlyRevenueConsumerInputRow,
} from "../p36/MonthlyRevenueControlledConsumerReadiness";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<MonthlyRevenueConsumerInputRow> = {}): MonthlyRevenueConsumerInputRow {
  return {
    symbol: "2330",
    revenueMonth: "2026-02",
    revenue: 100000000,
    releaseDate: "2026-03-10",
    releaseDateSource: "INFERRED_NEXT_MONTH_10TH",
    releaseDateConfidence: "LOW",
    asOfDate: "2026-03-15",
    sourceTrace: "monthly_revenue_sync_v1",
    ...overrides,
  };
}

// ─── 1. Contract Core Invariants ─────────────────────────────────────────────

describe("1. Contract core invariants", () => {
  it("1.1 Contract enforces dryRunOnly=true", () => {
    expect(MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT.dryRunOnly).toBe(true);
  });

  it("1.2 Contract enforces paperOnly=true", () => {
    expect(MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT.paperOnly).toBe(true);
  });

  it("1.3 Contract enforces entersAlphaScore=false", () => {
    expect(MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT.entersAlphaScore).toBe(false);
  });

  it("1.4 Contract enforces notInvestmentRecommendation=true", () => {
    expect(MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT.notInvestmentRecommendation).toBe(true);
  });

  it("1.5 Contract enforces noBuySellActionSemantics=true", () => {
    expect(MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT.noBuySellActionSemantics).toBe(true);
  });

  it("1.6 Contract mode is controlled-feature-consumer-readiness", () => {
    expect(MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT.consumerMode).toBe(
      "controlled-feature-consumer-readiness"
    );
  });

  it("1.7 Contract sourceName is MonthlyRevenue", () => {
    expect(MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT.sourceName).toBe("MonthlyRevenue");
  });
});

// ─── 2. Contract Validation ───────────────────────────────────────────────────

describe("2. Contract validation", () => {
  it("2.1 validateControlledConsumerContract returns valid for canonical contract", () => {
    const result = validateControlledConsumerContract(MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("2.2 validateControlledConsumerContract rejects entersAlphaScore=true", () => {
    const badContract = {
      ...MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT,
      entersAlphaScore: true as unknown as false,
    };
    const result = validateControlledConsumerContract(badContract);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("entersAlphaScore"))).toBe(true);
  });

  it("2.3 validateControlledConsumerContract rejects paperOnly=false", () => {
    const badContract = {
      ...MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT,
      paperOnly: false as unknown as true,
    };
    const result = validateControlledConsumerContract(badContract);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("paperOnly"))).toBe(true);
  });

  it("2.4 validateControlledConsumerContract rejects dryRunOnly=false", () => {
    const badContract = {
      ...MONTHLY_REVENUE_CONTROLLED_CONSUMER_CONTRACT,
      dryRunOnly: false as unknown as true,
    };
    const result = validateControlledConsumerContract(badContract);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("dryRunOnly"))).toBe(true);
  });
});

// ─── 3. Forbidden Field Enforcement ──────────────────────────────────────────

describe("3. Forbidden output field enforcement", () => {
  it("3.1 Contract rejects alphaScore field in output row", () => {
    const result = checkConsumerOutputRow({ alphaScore: 0.5 });
    expect(result.passes).toBe(false);
    expect(result.violations.some((v) => v.includes("alphaScore"))).toBe(true);
    expect(result.entersAlphaScore).toBe(false);
  });

  it("3.2 Contract rejects prediction field in output row", () => {
    const result = checkConsumerOutputRow({ prediction: "up" });
    expect(result.passes).toBe(false);
    expect(result.violations.some((v) => v.includes("prediction"))).toBe(true);
  });

  it("3.3 Contract rejects recommendation field in output row", () => {
    const result = checkConsumerOutputRow({ recommendation: "buy" });
    expect(result.passes).toBe(false);
    expect(result.violations.some((v) => v.includes("recommendation"))).toBe(true);
  });

  it("3.4 Contract rejects buy field in output row", () => {
    const result = checkConsumerOutputRow({ buy: true });
    expect(result.passes).toBe(false);
    expect(result.violations.some((v) => v.includes('"buy"'))).toBe(true);
  });

  it("3.5 Contract rejects sell field in output row", () => {
    const result = checkConsumerOutputRow({ sell: true });
    expect(result.passes).toBe(false);
    expect(result.violations.some((v) => v.includes('"sell"'))).toBe(true);
  });

  it("3.6 Contract rejects hold field in output row", () => {
    const result = checkConsumerOutputRow({ hold: true });
    expect(result.passes).toBe(false);
    expect(result.violations.some((v) => v.includes('"hold"'))).toBe(true);
  });

  it("3.7 Contract rejects targetPrice field in output row", () => {
    const result = checkConsumerOutputRow({ targetPrice: 1000 });
    expect(result.passes).toBe(false);
    expect(result.violations.some((v) => v.includes("targetPrice"))).toBe(true);
  });

  it("3.8 Contract rejects winRate field in output row", () => {
    const result = checkConsumerOutputRow({ winRate: 0.6 });
    expect(result.passes).toBe(false);
    expect(result.violations.some((v) => v.includes("winRate"))).toBe(true);
  });

  it("3.9 Contract rejects profit field in output row", () => {
    const result = checkConsumerOutputRow({ profit: 50000 });
    expect(result.passes).toBe(false);
    expect(result.violations.some((v) => v.includes("profit"))).toBe(true);
  });

  it("3.10 Contract accepts clean allowed-field-only row", () => {
    const result = checkConsumerOutputRow({
      symbol: "2330",
      revenueMonth: "2026-02",
      revenueAvailable: true,
      releaseMetadataComplete: true,
      confidenceBucket: "LOW",
    });
    expect(result.passes).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.entersAlphaScore).toBe(false);
  });
});

// ─── 4. Evaluator — CONSUMER_READY ───────────────────────────────────────────

describe("4. Evaluator — CONSUMER_READY cases", () => {
  it("4.1 Returns CONSUMER_READY for complete metadata with HIGH confidence", () => {
    const row = makeRow({
      releaseDateSource: "RECORDED_FROM_SOURCE",
      releaseDateConfidence: "HIGH",
    });
    const result = evaluateRowConsumerReadiness(row);
    expect(result.classification).toBe("CONSUMER_READY");
    expect(result.consumerReady).toBe(true);
    expect(result.entersAlphaScore).toBe(false);
    expect(result.paperOnly).toBe(true);
    expect(result.dryRunOnly).toBe(true);
  });

  it("4.2 Returns CONSUMER_READY for complete metadata with MEDIUM confidence", () => {
    const row = makeRow({
      releaseDateSource: "INFERRED_FROM_POLICY",
      releaseDateConfidence: "MEDIUM",
    });
    const result = evaluateRowConsumerReadiness(row);
    expect(result.classification).toBe("CONSUMER_READY");
    expect(result.consumerReady).toBe(true);
  });

  it("4.3 Returns CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING for LOW confidence (default)", () => {
    const row = makeRow(); // LOW confidence is default
    const result = evaluateRowConsumerReadiness(row);
    expect(result.classification).toBe("CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING");
    expect(result.consumerReady).toBe(true);
    expect(result.confidenceTier).toBe("LOW");
  });

  it("4.4 Returns CONSUMER_READY when allowLowConfidenceConsumerAccess=true", () => {
    const row = makeRow(); // LOW confidence
    const result = evaluateRowConsumerReadiness(row, { allowLowConfidenceConsumerAccess: true });
    expect(result.classification).toBe("CONSUMER_READY");
    expect(result.consumerReady).toBe(true);
  });
});

// ─── 5. Evaluator — BLOCKED cases ────────────────────────────────────────────

describe("5. Evaluator — BLOCKED cases", () => {
  it("5.1 Blocks row with missing releaseDate", () => {
    const row = makeRow({ releaseDate: null });
    const result = evaluateRowConsumerReadiness(row);
    expect(result.classification).toBe("CONSUMER_BLOCKED_MISSING_METADATA");
    expect(result.consumerReady).toBe(false);
    expect(result.entersAlphaScore).toBe(false);
  });

  it("5.2 Blocks row with missing releaseDateSource", () => {
    const row = makeRow({ releaseDateSource: null });
    const result = evaluateRowConsumerReadiness(row);
    expect(result.classification).toBe("CONSUMER_BLOCKED_MISSING_METADATA");
    expect(result.consumerReady).toBe(false);
  });

  it("5.3 Blocks row with missing releaseDateConfidence", () => {
    const row = makeRow({ releaseDateConfidence: null });
    const result = evaluateRowConsumerReadiness(row);
    expect(result.classification).toBe("CONSUMER_BLOCKED_MISSING_METADATA");
    expect(result.consumerReady).toBe(false);
  });

  it("5.4 Blocks row when asOfDate is before releaseDate (PIT violation)", () => {
    const row = makeRow({
      releaseDate: "2026-03-10",
      asOfDate: "2026-03-09", // one day before releaseDate
    });
    const result = evaluateRowConsumerReadiness(row);
    expect(result.classification).toBe("CONSUMER_BLOCKED_PIT_VIOLATION");
    expect(result.consumerReady).toBe(false);
    expect(result.pitBoundaryRespected).toBe(false);
  });

  it("5.5 Does NOT block when asOfDate equals releaseDate (boundary inclusive)", () => {
    const row = makeRow({
      releaseDate: "2026-03-10",
      asOfDate: "2026-03-10",
      releaseDateConfidence: "HIGH",
      releaseDateSource: "RECORDED_FROM_SOURCE",
    });
    const result = evaluateRowConsumerReadiness(row);
    expect(result.classification).toBe("CONSUMER_READY");
    expect(result.consumerReady).toBe(true);
  });

  it("5.6 Blocks row containing alphaScore field (forbidden future-looking)", () => {
    const row = makeRow({ alphaScore: 0.9 } as unknown as MonthlyRevenueConsumerInputRow);
    const result = evaluateRowConsumerReadiness(row);
    expect(result.classification).toBe("CONSUMER_BLOCKED_FORBIDDEN_FIELD");
    expect(result.consumerReady).toBe(false);
  });

  it("5.7 Blocks row containing prediction field", () => {
    const row = makeRow({ prediction: "up" } as unknown as MonthlyRevenueConsumerInputRow);
    const result = evaluateRowConsumerReadiness(row);
    expect(result.classification).toBe("CONSUMER_BLOCKED_FORBIDDEN_FIELD");
    expect(result.consumerReady).toBe(false);
  });

  it("5.8 Blocks row containing winRate field", () => {
    const row = makeRow({ winRate: 0.7 } as unknown as MonthlyRevenueConsumerInputRow);
    const result = evaluateRowConsumerReadiness(row);
    expect(result.classification).toBe("CONSUMER_BLOCKED_FORBIDDEN_FIELD");
    expect(result.consumerReady).toBe(false);
  });
});

// ─── 6. Output Integrity ─────────────────────────────────────────────────────

describe("6. Output integrity", () => {
  it("6.1 Row result serializes deterministically (JSON round-trip)", () => {
    const row = makeRow({ releaseDateConfidence: "HIGH", releaseDateSource: "RECORDED_FROM_SOURCE" });
    const result = evaluateRowConsumerReadiness(row);
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed.entersAlphaScore).toBe(false);
    expect(parsed.paperOnly).toBe(true);
    expect(parsed.dryRunOnly).toBe(true);
    expect(parsed.classification).toBe("CONSUMER_READY");
  });

  it("6.2 Batch result serializes deterministically (JSON round-trip)", () => {
    const rows = [
      makeRow({ symbol: "2330", releaseDateConfidence: "HIGH", releaseDateSource: "RECORDED_FROM_SOURCE" }),
      makeRow({ symbol: "2317", releaseDateConfidence: "HIGH", releaseDateSource: "RECORDED_FROM_SOURCE" }),
    ];
    const result = evaluateBatchConsumerReadiness(rows);
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed.entersAlphaScore).toBe(false);
    expect(parsed.paperOnly).toBe(true);
    expect(parsed.dryRunOnly).toBe(true);
    expect(parsed.noBuySellActionSemantics).toBe(true);
    expect(parsed.rowCount).toBe(2);
  });

  it("6.3 Batch result disclaimer contains no investment advice claim", () => {
    const rows = [makeRow()];
    const result = evaluateBatchConsumerReadiness(rows);
    expect(result.disclaimer).toContain("Does not constitute investment advice");
    // "guaranteed-return" appears in the prohibition list only (benign prohibition reference)
    // Verify no standalone guarantee promise is present
    expect(result.disclaimer).not.toMatch(/guaranteed\s+return/i);
    expect(result.disclaimer).not.toMatch(/guaranteed profits/i);
  });

  it("6.4 Batch result does not contain forbidden output fields", () => {
    const rows = [makeRow()];
    const result = evaluateBatchConsumerReadiness(rows) as Record<string, unknown>;
    const forbidden = ["alphaScore", "prediction", "recommendation", "buy", "sell", "hold", "profit", "winRate"];
    for (const field of forbidden) {
      expect(result[field]).toBeUndefined();
    }
  });
});

// ─── 7. Batch Evaluator ───────────────────────────────────────────────────────

describe("7. Batch evaluator", () => {
  it("7.1 Returns CONSUMER_BATCH_READY when all rows are ready", () => {
    const rows = [
      makeRow({ symbol: "2330", releaseDateConfidence: "HIGH", releaseDateSource: "RECORDED_FROM_SOURCE" }),
      makeRow({ symbol: "2317", releaseDateConfidence: "HIGH", releaseDateSource: "RECORDED_FROM_SOURCE" }),
      makeRow({ symbol: "2454", releaseDateConfidence: "HIGH", releaseDateSource: "RECORDED_FROM_SOURCE" }),
    ];
    const result = evaluateBatchConsumerReadiness(rows);
    expect(result.overallClassification).toBe("CONSUMER_BATCH_READY");
    expect(result.blockedRows).toBe(0);
    expect(result.rowCount).toBe(3);
    expect(result.entersAlphaScore).toBe(false);
  });

  it("7.2 Returns CONSUMER_BATCH_BLOCKED when any row is blocked", () => {
    const rows = [
      makeRow({ symbol: "2330", releaseDateConfidence: "HIGH", releaseDateSource: "RECORDED_FROM_SOURCE" }),
      makeRow({ symbol: "2317", releaseDate: null }), // blocked
    ];
    const result = evaluateBatchConsumerReadiness(rows);
    expect(result.overallClassification).toBe("CONSUMER_BATCH_BLOCKED");
    expect(result.blockedRows).toBe(1);
    expect(result.consumerReadyRows).toBe(1);
  });

  it("7.3 Counts warning rows separately from blocked rows", () => {
    const rows = [
      makeRow({ symbol: "2330", releaseDateConfidence: "LOW" }),    // warning
      makeRow({ symbol: "2317", releaseDateConfidence: "HIGH", releaseDateSource: "RECORDED_FROM_SOURCE" }), // ready
      makeRow({ symbol: "2454", releaseDate: null }),                 // blocked
    ];
    const result = evaluateBatchConsumerReadiness(rows);
    expect(result.warningRows).toBe(1);
    expect(result.consumerReadyRows).toBe(1);
    expect(result.blockedRows).toBe(1);
  });

  it("7.4 Confidence distribution sums to rowCount", () => {
    const rows = [
      makeRow({ releaseDateConfidence: "HIGH", releaseDateSource: "RECORDED_FROM_SOURCE" }),
      makeRow({ releaseDateConfidence: "MEDIUM", releaseDateSource: "INFERRED_FROM_POLICY" }),
      makeRow({ releaseDateConfidence: "LOW" }),
    ];
    const result = evaluateBatchConsumerReadiness(rows);
    const total =
      result.confidenceDistribution.HIGH +
      result.confidenceDistribution.MEDIUM +
      result.confidenceDistribution.LOW;
    expect(total).toBe(rows.length);
  });
});

// ─── 8. Contract Allowed / Forbidden Field Lists ─────────────────────────────

describe("8. Contract field list integrity", () => {
  it("8.1 ALLOWED_CONSUMER_INPUT_FIELDS includes required fields", () => {
    const required = ["symbol", "revenueMonth", "revenue", "releaseDate", "asOfDate"];
    for (const f of required) {
      expect(ALLOWED_CONSUMER_INPUT_FIELDS).toContain(f);
    }
  });

  it("8.2 FORBIDDEN_CONSUMER_OUTPUT_FIELDS includes all critical forbidden fields", () => {
    const required = [
      "alphaScore", "prediction", "recommendation", "signal",
      "buy", "sell", "hold", "targetPrice", "outcomePrice",
      "returnPct", "winRate", "profit",
    ];
    for (const f of required) {
      expect(FORBIDDEN_CONSUMER_OUTPUT_FIELDS).toContain(f);
    }
  });

  it("8.3 mapConfidenceTier maps LOW correctly", () => {
    expect(mapConfidenceTier("LOW")).toBe("LOW");
    expect(mapConfidenceTier("INFERRED_NEXT_MONTH_10TH")).toBe("LOW");
    expect(mapConfidenceTier(null)).toBe("LOW");
  });

  it("8.4 mapConfidenceTier maps HIGH correctly", () => {
    expect(mapConfidenceTier("HIGH")).toBe("HIGH");
    expect(mapConfidenceTier("RECORDED")).toBe("HIGH");
    expect(mapConfidenceTier("RECORDED_FROM_SOURCE")).toBe("HIGH");
  });

  it("8.5 mapConfidenceTier maps MEDIUM correctly", () => {
    expect(mapConfidenceTier("MEDIUM")).toBe("MEDIUM");
    expect(mapConfidenceTier("INFERRED_FROM_POLICY")).toBe("MEDIUM");
  });

  it("8.6 Contract version is set", () => {
    expect(CONTROLLED_CONSUMER_CONTRACT_VERSION).toBe(
      "p36-monthly-revenue-controlled-consumer-contract-v1"
    );
  });
});

// ─── 9. No DB / Corpus / Scoring Mutation ────────────────────────────────────

describe("9. Isolation — no DB, corpus, or scoring mutation", () => {
  it("9.1 evaluateRowConsumerReadiness has no side effects (pure function)", () => {
    const row = makeRow();
    const r1 = evaluateRowConsumerReadiness(row);
    const r2 = evaluateRowConsumerReadiness(row);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("9.2 evaluateBatchConsumerReadiness has no side effects (pure function)", () => {
    const rows = [makeRow(), makeRow({ symbol: "2317" })];
    const r1 = evaluateBatchConsumerReadiness(rows);
    const r2 = evaluateBatchConsumerReadiness(rows);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("9.3 evaluateRowConsumerReadiness never produces entersAlphaScore=true", () => {
    const rows = [
      makeRow(),
      makeRow({ releaseDate: null }),
      makeRow({ asOfDate: "2020-01-01" }),
    ];
    for (const row of rows) {
      const result = evaluateRowConsumerReadiness(row);
      expect(result.entersAlphaScore).toBe(false);
    }
  });
});
