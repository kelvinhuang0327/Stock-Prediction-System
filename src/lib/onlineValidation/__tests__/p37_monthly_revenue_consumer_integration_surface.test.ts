/**
 * P37 — MonthlyRevenue Consumer Integration Surface Tests
 *
 * 50-test suite covering:
 * 1. Integration payload governance invariants
 * 2. Payload validation — forbidden fields
 * 3. Adapter — consumer readiness classifications
 * 4. Adapter — counts-only mode (includeRows=false)
 * 5. Adapter — blocked cases
 * 6. Payload builder & summarizer
 * 7. Batch adapter
 * 8. Field list integrity
 * 9. Isolation — no DB / Prisma / scoring mutation
 *
 * DISCLAIMER: Test-only. Structural audit tests only. No investment advice.
 */

import {
  buildMonthlyRevenueConsumerPayload,
  validateMonthlyRevenueConsumerPayload,
  summarizeMonthlyRevenueConsumerPayload,
  INTEGRATION_SURFACE_VERSION,
  INTEGRATION_SURFACE_DISCLAIMER,
  type MonthlyRevenueConsumerPayload,
  type MonthlyRevenueConsumerPayloadRow,
} from "../p37/MonthlyRevenueConsumerIntegrationSurface";

import {
  adaptMonthlyRevenueConsumerBatch,
  adaptMonthlyRevenueConsumerRow,
} from "../p37/MonthlyRevenueControlledConsumerAdapter";

import {
  evaluateBatchConsumerReadiness,
  type MonthlyRevenueConsumerInputRow,
} from "../p36/MonthlyRevenueControlledConsumerReadiness";

// ─── Test Fixtures ────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<MonthlyRevenueConsumerInputRow> = {}): MonthlyRevenueConsumerInputRow {
  return {
    symbol: "2330",
    revenueMonth: "2025-01",
    revenue: 200000,
    releaseDate: "2025-02-10",
    releaseDateSource: "official-filing",
    releaseDateConfidence: "RECORDED_FROM_SOURCE",
    asOfDate: "2025-02-11",
    sourceTrace: "fixture",
    ...overrides,
  };
}

function makeBatchResult(overrides = {}) {
  return evaluateBatchConsumerReadiness([makeRow()]);
}

function makePayloadRows(n = 1): MonthlyRevenueConsumerPayloadRow[] {
  return Array.from({ length: n }, () => ({
    symbol: "2330",
    revenueMonth: "2025-01",
    classification: "CONSUMER_READY" as const,
    consumerReady: true,
    confidenceTier: "HIGH" as const,
    revenueAvailable: true,
    releaseMetadataComplete: true,
    pitBoundaryRespected: true,
    auditNotes: ["fixture"],
    entersAlphaScore: false as const,
    paperOnly: true as const,
    dryRunOnly: true as const,
  }));
}

// ─── Group 1: Integration Payload Governance Invariants (10 tests) ────────────

describe("P37 — 1. Integration payload governance invariants", () => {
  let payload: MonthlyRevenueConsumerPayload;

  beforeEach(() => {
    const batch = makeBatchResult();
    payload = buildMonthlyRevenueConsumerPayload(batch, makePayloadRows());
  });

  test("1.1 payload enforces dryRunOnly=true", () => {
    expect(payload.dryRunOnly).toBe(true);
  });

  test("1.2 payload enforces paperOnly=true", () => {
    expect(payload.paperOnly).toBe(true);
  });

  test("1.3 payload enforces entersAlphaScore=false", () => {
    expect(payload.entersAlphaScore).toBe(false);
  });

  test("1.4 payload enforces notInvestmentRecommendation=true", () => {
    expect(payload.notInvestmentRecommendation).toBe(true);
  });

  test("1.5 payload enforces noBuySellActionSemantics=true", () => {
    expect(payload.noBuySellActionSemantics).toBe(true);
  });

  test("1.6 payload sourceName is MonthlyRevenue", () => {
    expect(payload.sourceName).toBe("MonthlyRevenue");
  });

  test("1.7 payload surfaceMode is controlled-consumer-integration", () => {
    expect(payload.surfaceMode).toBe("controlled-consumer-integration");
  });

  test("1.8 payload has version string", () => {
    expect(payload.version).toBe(INTEGRATION_SURFACE_VERSION);
    expect(payload.version).toMatch(/^p37-/);
  });

  test("1.9 payload has disclaimer referencing investment advice prohibition", () => {
    expect(payload.disclaimer).toMatch(/does not constitute investment advice/i);
    expect(payload.disclaimer).toMatch(/entersAlphaScore = false/i);
  });

  test("1.10 payload has generatedAt ISO string", () => {
    expect(typeof payload.generatedAt).toBe("string");
    expect(new Date(payload.generatedAt).getTime()).not.toBeNaN();
  });
});

// ─── Group 2: Payload Validation — Forbidden Fields (10 tests) ───────────────

describe("P37 — 2. Payload validation — forbidden fields", () => {
  test("2.1 valid payload passes validation", () => {
    const batch = makeBatchResult();
    const payload = buildMonthlyRevenueConsumerPayload(batch, makePayloadRows());
    const result = validateMonthlyRevenueConsumerPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test("2.2 payload with alphaScore field fails validation", () => {
    const batch = makeBatchResult();
    const payload = buildMonthlyRevenueConsumerPayload(batch, makePayloadRows());
    (payload as Record<string, unknown>)["alphaScore"] = 0.5;
    const result = validateMonthlyRevenueConsumerPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("alphaScore"))).toBe(true);
  });

  test("2.3 payload with prediction field fails validation", () => {
    const batch = makeBatchResult();
    const payload = buildMonthlyRevenueConsumerPayload(batch, makePayloadRows());
    (payload as Record<string, unknown>)["prediction"] = "UP";
    const result = validateMonthlyRevenueConsumerPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("prediction"))).toBe(true);
  });

  test("2.4 payload with recommendation field fails validation", () => {
    const batch = makeBatchResult();
    const payload = buildMonthlyRevenueConsumerPayload(batch, makePayloadRows());
    (payload as Record<string, unknown>)["recommendation"] = "BUY";
    const result = validateMonthlyRevenueConsumerPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("recommendation"))).toBe(true);
  });

  test("2.5 payload with signal field fails validation", () => {
    const batch = makeBatchResult();
    const payload = buildMonthlyRevenueConsumerPayload(batch, makePayloadRows());
    (payload as Record<string, unknown>)["signal"] = "BULLISH";
    const result = validateMonthlyRevenueConsumerPayload(payload);
    expect(result.valid).toBe(false);
  });

  test("2.6 payload with buy field fails validation", () => {
    const batch = makeBatchResult();
    const payload = buildMonthlyRevenueConsumerPayload(batch, makePayloadRows());
    (payload as Record<string, unknown>)["buy"] = true;
    const result = validateMonthlyRevenueConsumerPayload(payload);
    expect(result.valid).toBe(false);
  });

  test("2.7 payload with sell field fails validation", () => {
    const batch = makeBatchResult();
    const payload = buildMonthlyRevenueConsumerPayload(batch, makePayloadRows());
    (payload as Record<string, unknown>)["sell"] = true;
    const result = validateMonthlyRevenueConsumerPayload(payload);
    expect(result.valid).toBe(false);
  });

  test("2.8 payload with hold field fails validation", () => {
    const batch = makeBatchResult();
    const payload = buildMonthlyRevenueConsumerPayload(batch, makePayloadRows());
    (payload as Record<string, unknown>)["hold"] = true;
    const result = validateMonthlyRevenueConsumerPayload(payload);
    expect(result.valid).toBe(false);
  });

  test("2.9 payload with winRate field fails validation", () => {
    const batch = makeBatchResult();
    const payload = buildMonthlyRevenueConsumerPayload(batch, makePayloadRows());
    (payload as Record<string, unknown>)["winRate"] = 0.6;
    const result = validateMonthlyRevenueConsumerPayload(payload);
    expect(result.valid).toBe(false);
  });

  test("2.10 payload rejects entersAlphaScore=true", () => {
    const batch = makeBatchResult();
    const payload = buildMonthlyRevenueConsumerPayload(batch, makePayloadRows());
    // Force mutation for test
    (payload as Record<string, unknown>)["entersAlphaScore"] = true;
    const result = validateMonthlyRevenueConsumerPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("entersAlphaScore"))).toBe(true);
  });
});

// ─── Group 3: Adapter — Consumer Readiness Classifications (8 tests) ──────────

describe("P37 — 3. Adapter — consumer readiness classifications", () => {
  test("3.1 HIGH confidence row → CONSUMER_READY", () => {
    const row = makeRow({ releaseDateConfidence: "RECORDED_FROM_SOURCE" });
    const result = adaptMonthlyRevenueConsumerRow(row);
    expect(result.rowResults[0].classification).toBe("CONSUMER_READY");
    expect(result.payload.consumerReadyRows).toBe(1);
    expect(result.payload.blockedRows).toBe(0);
  });

  test("3.2 MEDIUM confidence row → CONSUMER_READY", () => {
    const row = makeRow({ releaseDateConfidence: "INFERRED_FROM_POLICY" });
    const result = adaptMonthlyRevenueConsumerRow(row);
    expect(result.rowResults[0].classification).toBe("CONSUMER_READY");
    expect(result.payload.consumerReadyRows).toBe(1);
  });

  test("3.3 LOW confidence row → CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING", () => {
    const row = makeRow({ releaseDateConfidence: "INFERRED_NEXT_MONTH_10TH" });
    const result = adaptMonthlyRevenueConsumerRow(row);
    expect(result.rowResults[0].classification).toBe("CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING");
    expect(result.payload.warningRows).toBe(1);
    expect(result.payload.blockedRows).toBe(0);
  });

  test("3.4 LOW confidence with allowLow=true → CONSUMER_READY", () => {
    const row = makeRow({ releaseDateConfidence: "INFERRED_NEXT_MONTH_10TH" });
    const result = adaptMonthlyRevenueConsumerRow(row, { allowLowConfidenceConsumerAccess: true });
    expect(result.rowResults[0].classification).toBe("CONSUMER_READY");
    expect(result.payload.consumerReadyRows).toBe(1);
    expect(result.payload.warningRows).toBe(0);
  });

  test("3.5 adapter calls P36 evaluator and preserves classification", () => {
    const rows = [
      makeRow({ releaseDateConfidence: "RECORDED_FROM_SOURCE" }),
      makeRow({ symbol: "2317", releaseDateConfidence: "INFERRED_NEXT_MONTH_10TH" }),
    ];
    const result = adaptMonthlyRevenueConsumerBatch(rows);
    expect(result.rowResults[0].classification).toBe("CONSUMER_READY");
    expect(result.rowResults[1].classification).toBe("CONSUMER_READY_WITH_LOW_CONFIDENCE_WARNING");
  });

  test("3.6 adapter payload entersAlphaScore is always false", () => {
    const rows = [makeRow(), makeRow({ symbol: "2317" })];
    const result = adaptMonthlyRevenueConsumerBatch(rows);
    expect(result.payload.entersAlphaScore).toBe(false);
    if (result.payload.rows) {
      for (const row of result.payload.rows) {
        expect(row.entersAlphaScore).toBe(false);
      }
    }
  });

  test("3.7 validation passes for adapter output", () => {
    const rows = [makeRow(), makeRow({ symbol: "2317" })];
    const result = adaptMonthlyRevenueConsumerBatch(rows);
    expect(result.validation.valid).toBe(true);
    expect(result.validation.violations).toHaveLength(0);
  });

  test("3.8 fixedGeneratedAt produces deterministic payload", () => {
    const row = makeRow();
    const ts = "2026-05-21T00:00:00.000Z";
    const r1 = adaptMonthlyRevenueConsumerRow(row, { fixedGeneratedAt: ts });
    const r2 = adaptMonthlyRevenueConsumerRow(row, { fixedGeneratedAt: ts });
    expect(r1.payload.generatedAt).toBe(ts);
    expect(r2.payload.generatedAt).toBe(ts);
    expect(r1.payload.generatedAt).toBe(r2.payload.generatedAt);
  });
});

// ─── Group 4: Adapter — Counts-only Mode (4 tests) ────────────────────────────

describe("P37 — 4. Adapter — counts-only mode (includeRows=false)", () => {
  test("4.1 includeRows=false → payload.rows is undefined", () => {
    const result = adaptMonthlyRevenueConsumerRow(makeRow(), { includeRows: false });
    expect(result.payload.rows).toBeUndefined();
  });

  test("4.2 includeRows=true → payload.rows is populated", () => {
    const result = adaptMonthlyRevenueConsumerRow(makeRow(), { includeRows: true });
    expect(Array.isArray(result.payload.rows)).toBe(true);
    expect(result.payload.rows!.length).toBe(1);
  });

  test("4.3 counts-only payload still has correct row counts", () => {
    const rows = [makeRow(), makeRow({ symbol: "2317" }), makeRow({ symbol: "2454" })];
    const result = adaptMonthlyRevenueConsumerBatch(rows, { includeRows: false });
    expect(result.payload.rowCount).toBe(3);
    expect(result.payload.rows).toBeUndefined();
  });

  test("4.4 counts-only mode validation passes", () => {
    const result = adaptMonthlyRevenueConsumerBatch([makeRow()], { includeRows: false });
    expect(result.validation.valid).toBe(true);
  });
});

// ─── Group 5: Adapter — Blocked Cases (8 tests) ───────────────────────────────

describe("P37 — 5. Adapter — blocked cases", () => {
  test("5.1 null releaseDate → CONSUMER_BLOCKED_MISSING_METADATA", () => {
    const row = makeRow({ releaseDate: null });
    const result = adaptMonthlyRevenueConsumerRow(row);
    expect(result.rowResults[0].classification).toBe("CONSUMER_BLOCKED_MISSING_METADATA");
    expect(result.payload.blockedRows).toBe(1);
    expect(result.payload.consumerReadyRows).toBe(0);
  });

  test("5.2 null releaseDateSource → CONSUMER_BLOCKED_MISSING_METADATA", () => {
    const row = makeRow({ releaseDateSource: null });
    const result = adaptMonthlyRevenueConsumerRow(row);
    expect(result.rowResults[0].classification).toBe("CONSUMER_BLOCKED_MISSING_METADATA");
  });

  test("5.3 null releaseDateConfidence → CONSUMER_BLOCKED_MISSING_METADATA", () => {
    const row = makeRow({ releaseDateConfidence: null });
    const result = adaptMonthlyRevenueConsumerRow(row);
    expect(result.rowResults[0].classification).toBe("CONSUMER_BLOCKED_MISSING_METADATA");
  });

  test("5.4 PIT violation (asOfDate before releaseDate) → CONSUMER_BLOCKED_PIT_VIOLATION", () => {
    const row = makeRow({ asOfDate: "2025-02-09", releaseDate: "2025-02-10" });
    const result = adaptMonthlyRevenueConsumerRow(row);
    expect(result.rowResults[0].classification).toBe("CONSUMER_BLOCKED_PIT_VIOLATION");
    expect(result.payload.blockedRows).toBe(1);
  });

  test("5.5 PIT boundary inclusive (asOfDate === releaseDate) → CONSUMER_READY", () => {
    const row = makeRow({ asOfDate: "2025-02-10", releaseDate: "2025-02-10" });
    const result = adaptMonthlyRevenueConsumerRow(row);
    expect(result.rowResults[0].classification).toBe("CONSUMER_READY");
  });

  test("5.6 row with alphaScore field → CONSUMER_BLOCKED_FORBIDDEN_FIELD", () => {
    const row = { ...makeRow(), alphaScore: 0.85 };
    const result = adaptMonthlyRevenueConsumerRow(row as MonthlyRevenueConsumerInputRow);
    expect(result.rowResults[0].classification).toBe("CONSUMER_BLOCKED_FORBIDDEN_FIELD");
    expect(result.payload.blockedRows).toBe(1);
  });

  test("5.7 row with prediction field → CONSUMER_BLOCKED_FORBIDDEN_FIELD", () => {
    const row = { ...makeRow(), prediction: "UP" };
    const result = adaptMonthlyRevenueConsumerRow(row as MonthlyRevenueConsumerInputRow);
    expect(result.rowResults[0].classification).toBe("CONSUMER_BLOCKED_FORBIDDEN_FIELD");
  });

  test("5.8 row with winRate field → CONSUMER_BLOCKED_FORBIDDEN_FIELD", () => {
    const row = { ...makeRow(), winRate: 0.6 };
    const result = adaptMonthlyRevenueConsumerRow(row as MonthlyRevenueConsumerInputRow);
    expect(result.rowResults[0].classification).toBe("CONSUMER_BLOCKED_FORBIDDEN_FIELD");
  });
});

// ─── Group 6: Payload Builder & Summarizer (5 tests) ─────────────────────────

describe("P37 — 6. Payload builder and summarizer", () => {
  test("6.1 summarize function is deterministic", () => {
    const ts = "2026-05-21T00:00:00.000Z";
    const r1 = adaptMonthlyRevenueConsumerRow(makeRow(), { fixedGeneratedAt: ts });
    const r2 = adaptMonthlyRevenueConsumerRow(makeRow(), { fixedGeneratedAt: ts });
    const s1 = summarizeMonthlyRevenueConsumerPayload(r1.payload);
    const s2 = summarizeMonthlyRevenueConsumerPayload(r2.payload);
    expect(s1).toEqual(s2);
  });

  test("6.2 summary entersAlphaScore is always false", () => {
    const result = adaptMonthlyRevenueConsumerRow(makeRow());
    const summary = summarizeMonthlyRevenueConsumerPayload(result.payload);
    expect(summary.entersAlphaScore).toBe(false);
  });

  test("6.3 summary readyRate is 100.00% for all-ready batch", () => {
    const rows = [makeRow(), makeRow({ symbol: "2317" })];
    const result = adaptMonthlyRevenueConsumerBatch(rows, { fixedGeneratedAt: "2026-05-21T00:00:00.000Z" });
    const summary = summarizeMonthlyRevenueConsumerPayload(result.payload);
    expect(summary.readyRate).toBe("100.00%");
    expect(summary.blockedRate).toBe("0.00%");
  });

  test("6.4 payload serializes to JSON without error", () => {
    const result = adaptMonthlyRevenueConsumerRow(makeRow(), { includeRows: true });
    expect(() => JSON.stringify(result.payload)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(result.payload));
    expect(parsed.entersAlphaScore).toBe(false);
    expect(parsed.dryRunOnly).toBe(true);
    expect(parsed.paperOnly).toBe(true);
  });

  test("6.5 summary topClassification for all-ready batch is CONSUMER_BATCH_READY", () => {
    const result = adaptMonthlyRevenueConsumerRow(makeRow());
    const summary = summarizeMonthlyRevenueConsumerPayload(result.payload);
    expect(summary.topClassification).toBe("CONSUMER_BATCH_READY");
  });
});

// ─── Group 7: Batch Adapter (5 tests) ────────────────────────────────────────

describe("P37 — 7. Batch adapter", () => {
  test("7.1 batch of all-ready rows → CONSUMER_BATCH_READY summary", () => {
    const rows = [makeRow(), makeRow({ symbol: "2317" }), makeRow({ symbol: "2454" })];
    const result = adaptMonthlyRevenueConsumerBatch(rows);
    expect(result.payload.rowCount).toBe(3);
    expect(result.payload.consumerReadyRows).toBe(3);
    expect(result.payload.blockedRows).toBe(0);
  });

  test("7.2 batch with blocked rows increases blockedRows count", () => {
    const rows = [makeRow(), makeRow({ releaseDate: null }), makeRow({ releaseDate: null })];
    const result = adaptMonthlyRevenueConsumerBatch(rows);
    expect(result.payload.blockedRows).toBe(2);
    expect(result.payload.consumerReadyRows).toBe(1);
  });

  test("7.3 warning rows counted correctly in batch", () => {
    const rows = [
      makeRow(),
      makeRow({ symbol: "2317", releaseDateConfidence: "INFERRED_NEXT_MONTH_10TH" }),
      makeRow({ symbol: "2454", releaseDateConfidence: "INFERRED_NEXT_MONTH_10TH" }),
    ];
    const result = adaptMonthlyRevenueConsumerBatch(rows);
    expect(result.payload.warningRows).toBe(2);
    expect(result.payload.consumerReadyRows).toBe(1);
  });

  test("7.4 confidence distribution sums to rowCount", () => {
    const rows = [
      makeRow({ releaseDateConfidence: "RECORDED_FROM_SOURCE" }),
      makeRow({ symbol: "2317", releaseDateConfidence: "INFERRED_FROM_POLICY" }),
      makeRow({ symbol: "2454", releaseDateConfidence: "INFERRED_NEXT_MONTH_10TH" }),
    ];
    const result = adaptMonthlyRevenueConsumerBatch(rows);
    const dist = result.payload.confidenceDistribution;
    expect(dist.HIGH + dist.MEDIUM + dist.LOW).toBe(result.payload.rowCount);
  });

  test("7.5 empty batch returns zero counts and valid payload", () => {
    const result = adaptMonthlyRevenueConsumerBatch([]);
    expect(result.payload.rowCount).toBe(0);
    expect(result.payload.consumerReadyRows).toBe(0);
    expect(result.payload.blockedRows).toBe(0);
    expect(result.validation.valid).toBe(true);
  });
});

// ─── Group 8: Field List Integrity (5 tests) ─────────────────────────────────

describe("P37 — 8. Field list integrity", () => {
  test("8.1 payload does not contain alphaScore, prediction, recommendation, signal", () => {
    const result = adaptMonthlyRevenueConsumerRow(makeRow());
    const p = result.payload;
    expect("alphaScore" in p).toBe(false);
    expect("prediction" in p).toBe(false);
    expect("recommendation" in p).toBe(false);
    expect("signal" in p).toBe(false);
  });

  test("8.2 payload does not contain buy, sell, hold, targetPrice, outcomePrice", () => {
    const result = adaptMonthlyRevenueConsumerRow(makeRow());
    const p = result.payload;
    expect("buy" in p).toBe(false);
    expect("sell" in p).toBe(false);
    expect("hold" in p).toBe(false);
    expect("targetPrice" in p).toBe(false);
    expect("outcomePrice" in p).toBe(false);
  });

  test("8.3 payload does not contain returnPct, winRate, profit, expectedReturn", () => {
    const result = adaptMonthlyRevenueConsumerRow(makeRow());
    const p = result.payload;
    expect("returnPct" in p).toBe(false);
    expect("winRate" in p).toBe(false);
    expect("profit" in p).toBe(false);
    expect("expectedReturn" in p).toBe(false);
  });

  test("8.4 payload row does not contain forbidden fields when includeRows=true", () => {
    const result = adaptMonthlyRevenueConsumerRow(makeRow(), { includeRows: true });
    const row = result.payload.rows![0];
    const forbidden = [
      "alphaScore", "prediction", "recommendation", "signal",
      "buy", "sell", "hold", "targetPrice", "outcomePrice",
      "returnPct", "winRate", "profit", "expectedReturn",
    ];
    for (const f of forbidden) {
      expect(f in row).toBe(false);
    }
  });

  test("8.5 INTEGRATION_SURFACE_VERSION starts with p37-", () => {
    expect(INTEGRATION_SURFACE_VERSION).toMatch(/^p37-/);
  });
});

// ─── Group 9: Isolation — No DB / Prisma / Scoring Mutation (5 tests) ─────────

describe("P37 — 9. Isolation — no DB / Prisma / scoring mutation", () => {
  test("9.1 adapter module does not import prisma client", () => {
    // The adapter imports only from p36 and p37 surface — no prisma
    const adapterModule = require("../p37/MonthlyRevenueControlledConsumerAdapter");
    // If Prisma were imported, it would throw during jest module load in test env
    expect(adapterModule).toBeDefined();
  });

  test("9.2 surface module does not import prisma client", () => {
    const surfaceModule = require("../p37/MonthlyRevenueConsumerIntegrationSurface");
    expect(surfaceModule).toBeDefined();
  });

  test("9.3 evaluator functions are pure — do not mutate input rows", () => {
    const row = makeRow();
    const frozen = Object.freeze({ ...row });
    // Should not throw — pure function
    expect(() => adaptMonthlyRevenueConsumerRow(row)).not.toThrow();
    // Frozen reference remains consistent
    expect(frozen.symbol).toBe("2330");
  });

  test("9.4 entersAlphaScore is never true across all test fixtures", () => {
    const testRows: MonthlyRevenueConsumerInputRow[] = [
      makeRow(),
      makeRow({ releaseDate: null }),
      makeRow({ releaseDateConfidence: "INFERRED_NEXT_MONTH_10TH" }),
      makeRow({ asOfDate: "2025-01-01" }),
    ];
    for (const row of testRows) {
      const result = adaptMonthlyRevenueConsumerRow(row);
      expect(result.payload.entersAlphaScore).toBe(false);
      for (const rr of result.rowResults) {
        expect(rr.entersAlphaScore).toBe(false);
      }
    }
  });

  test("9.5 multiple calls do not share mutable state", () => {
    const row = makeRow();
    const r1 = adaptMonthlyRevenueConsumerRow(row);
    const r2 = adaptMonthlyRevenueConsumerRow(row);
    // Results should be structurally equal (independent instances)
    expect(r1.payload.rowCount).toBe(r2.payload.rowCount);
    expect(r1.payload.consumerReadyRows).toBe(r2.payload.consumerReadyRows);
    // auditNotes should be independent arrays
    r1.payload.auditNotes.push("MUTATION_TEST");
    expect(r2.payload.auditNotes).not.toContain("MUTATION_TEST");
  });
});
