/**
 * P46 — Axis A Snapshot Log Collector v0 Tests
 *
 * Tests for SnapshotLogCollector — in-memory, mutable collector for
 * SnapshotLogRecord objects with fluent chaining.
 * All tests are pure unit tests — no DB, no Prisma, no network, no side effects.
 *
 * Proves:
 *   T46.1  collectorVersion matches SNAPSHOT_LOG_COLLECTOR_VERSION constant
 *   T46.2  createSnapshotLogCollector() returns an empty collector by default
 *   T46.3  createSnapshotLogCollector(initialRecords) seeds from initial records
 *   T46.4  collect() appends a record and returns the same collector (fluent)
 *   T46.5  getAll() returns a frozen copy of records in insertion order
 *   T46.6  filterByStatus() filters correctly for all 4 readiness statuses
 *   T46.7  filterBySymbol() filters correctly by symbol
 *   T46.8  clear() resets to empty and returns the same collector (fluent)
 *   T46.9  Fluent chaining — collect().collect().getAll() accumulates in order
 *   T46.10 Governance — SNAPSHOT_LOG_COLLECTOR_VERSION contains "p46"
 *   T46.11 createSnapshotLogCollector does not share reference with initialRecords
 *   T46.12 collect() after clear() starts fresh
 *
 * DISCLAIMER: Test suite for Axis A research snapshot log collector only.
 * entersAlphaScore = false. ALWAYS. Not investment advice.
 * No buy/sell/hold semantics. No scoring formula access.
 */

import {
  SNAPSHOT_LOG_COLLECTOR_VERSION,
  createSnapshotLogCollector,
  type SnapshotLogCollector,
} from "@/lib/research/snapshot/v0/SnapshotLogCollector";

import {
  serializeEmitResult,
  type SnapshotLogRecord,
} from "@/lib/research/snapshot/v0/SnapshotLogWriter";

import { emitSnapshot } from "@/lib/research/snapshot/v0/SnapshotEmitter";
import { buildControlledResearchSnapshot } from "@/lib/research/ControlledResearchSnapshotBuilder";
import type { SnapshotBuildInput } from "@/lib/research/ControlledResearchSnapshotBuilder";
import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";

// ─── Test Constants ───────────────────────────────────────────────────────────

const FIXED_TODAY = "2026-05-25";
const FIXED_GENERATED_AT = "2026-05-25T00:00:00.000Z";
const FIXED_READOUT_AT = "2026-05-25T02:00:00.000Z";
const FIXED_LOGGED_AT = "2026-05-25T04:00:00.000Z";
const PAST_DATE = "2026-05-01";
const FUTURE_DATE = "2099-12-31";
const SYMBOL_A = "2330";
const SYMBOL_B = "2317";

// ─── Fixture Factories ────────────────────────────────────────────────────────

function makeEligibleMRFacts(): SourceReadinessFacts {
  return {
    sourceName: "MonthlyRevenue",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
    sourceTrace: "p46-test-mr",
  };
}

function makeEligibleQuoteFacts(): SourceReadinessFacts {
  return {
    sourceName: "Quote",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
    sourceTrace: "p46-test-quote",
  };
}

function makeEligibleRegimeFacts(): SourceReadinessFacts {
  return {
    sourceName: "Regime",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "HIGH",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: true,
    sourceTrace: "p46-test-regime",
  };
}

function makeBlockedMRFacts(): SourceReadinessFacts {
  return {
    sourceName: "MonthlyRevenue",
    pitStatus: "PIT_GATE_MISSING",
    pitConfidence: "NONE",
    consumerStatus: "BLOCKED",
    qualityEvidenceComplete: false,
    pitMetadataComplete: false,
    lagEvidenceComplete: false,
    authorizationGranted: false,
    pitSafeConfirmed: false,
    sourceTrace: "p46-test-mr-blocked",
  };
}

function makeAuditOnlyQuoteFacts(): SourceReadinessFacts {
  return {
    sourceName: "Quote",
    pitStatus: "PIT_GATE_PRESENT",
    pitConfidence: "LOW",
    consumerStatus: "CONSUMER_READY",
    qualityEvidenceComplete: true,
    pitMetadataComplete: true,
    lagEvidenceComplete: true,
    authorizationGranted: true,
    pitSafeConfirmed: false,
    sourceTrace: "p46-test-quote-audit-only",
  };
}

function buildBaseInput(overrides: Partial<SnapshotBuildInput> = {}): SnapshotBuildInput {
  return {
    symbol: SYMBOL_A,
    asOfDate: PAST_DATE,
    sourceTrace: "p46-test-suite",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    ...overrides,
  };
}

function makeRecord(
  overrides: Partial<SnapshotBuildInput> = {},
  loggedAt = FIXED_LOGGED_AT,
): SnapshotLogRecord {
  return serializeEmitResult(
    emitSnapshot(
      buildControlledResearchSnapshot(buildBaseInput(overrides)),
      FIXED_READOUT_AT,
    ),
    loggedAt,
  );
}

function makeReadyRecord(symbol = SYMBOL_A): SnapshotLogRecord {
  return makeRecord({
    symbol,
    monthlyRevenueFacts: makeEligibleMRFacts(),
    quoteFacts: makeEligibleQuoteFacts(),
    regimeFacts: makeEligibleRegimeFacts(),
  });
}

function makeBlockedRecord(symbol = SYMBOL_A): SnapshotLogRecord {
  return makeRecord({ symbol, monthlyRevenueFacts: makeBlockedMRFacts() });
}

function makePartialRecord(symbol = SYMBOL_A): SnapshotLogRecord {
  return makeRecord({
    symbol,
    monthlyRevenueFacts: makeEligibleMRFacts(),
    quoteFacts: makeAuditOnlyQuoteFacts(),
    regimeFacts: makeEligibleRegimeFacts(),
  });
}

function makePitBlockedRecord(symbol = SYMBOL_A): SnapshotLogRecord {
  return makeRecord({
    symbol,
    asOfDate: FUTURE_DATE,
    monthlyRevenueFacts: makeEligibleMRFacts(),
    quoteFacts: makeEligibleQuoteFacts(),
    regimeFacts: makeEligibleRegimeFacts(),
  });
}

// ─── T46.1 — collectorVersion matches constant ────────────────────────────────

describe("T46.1 — collectorVersion matches SNAPSHOT_LOG_COLLECTOR_VERSION", () => {
  it("T46.1.1 collectorVersion equals SNAPSHOT_LOG_COLLECTOR_VERSION", () => {
    const c = createSnapshotLogCollector();
    expect(c.collectorVersion).toBe(SNAPSHOT_LOG_COLLECTOR_VERSION);
  });

  it("T46.1.2 SNAPSHOT_LOG_COLLECTOR_VERSION is a non-empty string", () => {
    expect(typeof SNAPSHOT_LOG_COLLECTOR_VERSION).toBe("string");
    expect(SNAPSHOT_LOG_COLLECTOR_VERSION.length).toBeGreaterThan(0);
  });

  it("T46.1.3 collectorVersion is consistent across multiple createSnapshotLogCollector() calls", () => {
    const c1 = createSnapshotLogCollector();
    const c2 = createSnapshotLogCollector();
    expect(c1.collectorVersion).toBe(c2.collectorVersion);
  });
});

// ─── T46.2 — empty by default ────────────────────────────────────────────────

describe("T46.2 — createSnapshotLogCollector() returns an empty collector by default", () => {
  it("T46.2.1 getAll() returns empty array when no records collected", () => {
    const c = createSnapshotLogCollector();
    expect(c.getAll()).toHaveLength(0);
  });

  it("T46.2.2 getAll() returns empty array when called with no arguments", () => {
    expect(createSnapshotLogCollector().getAll()).toEqual([]);
  });

  it("T46.2.3 filterByStatus returns empty array on empty collector", () => {
    const c = createSnapshotLogCollector();
    expect(c.filterByStatus("SNAPSHOT_READY")).toHaveLength(0);
  });

  it("T46.2.4 filterBySymbol returns empty array on empty collector", () => {
    const c = createSnapshotLogCollector();
    expect(c.filterBySymbol(SYMBOL_A)).toHaveLength(0);
  });
});

// ─── T46.3 — seeded from initialRecords ──────────────────────────────────────

describe("T46.3 — createSnapshotLogCollector(initialRecords) seeds correctly", () => {
  let r1: SnapshotLogRecord;
  let r2: SnapshotLogRecord;

  beforeAll(() => {
    r1 = makeReadyRecord(SYMBOL_A);
    r2 = makeBlockedRecord(SYMBOL_B);
  });

  it("T46.3.1 seeded collector contains both initial records", () => {
    const c = createSnapshotLogCollector([r1, r2]);
    expect(c.getAll()).toHaveLength(2);
  });

  it("T46.3.2 seeded records appear in insertion order", () => {
    const c = createSnapshotLogCollector([r1, r2]);
    const all = c.getAll();
    expect(all[0]).toBe(r1);
    expect(all[1]).toBe(r2);
  });

  it("T46.3.3 empty array seed returns empty collector", () => {
    const c = createSnapshotLogCollector([]);
    expect(c.getAll()).toHaveLength(0);
  });
});

// ─── T46.4 — collect() appends and returns collector ─────────────────────────

describe("T46.4 — collect() appends a record and returns the same collector", () => {
  it("T46.4.1 getAll() has 1 record after one collect()", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord());
    expect(c.getAll()).toHaveLength(1);
  });

  it("T46.4.2 collect() returns the same collector (reference equality)", () => {
    const c = createSnapshotLogCollector();
    const returned = c.collect(makeReadyRecord());
    expect(returned).toBe(c);
  });

  it("T46.4.3 getAll() has 3 records after three collect() calls", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord());
    c.collect(makeBlockedRecord());
    c.collect(makePartialRecord());
    expect(c.getAll()).toHaveLength(3);
  });

  it("T46.4.4 collect() preserves insertion order", () => {
    const r1 = makeReadyRecord(SYMBOL_A);
    const r2 = makeBlockedRecord(SYMBOL_B);
    const c = createSnapshotLogCollector();
    c.collect(r1).collect(r2);
    const all = c.getAll();
    expect(all[0]).toBe(r1);
    expect(all[1]).toBe(r2);
  });
});

// ─── T46.5 — getAll() returns a frozen copy ──────────────────────────────────

describe("T46.5 — getAll() returns a frozen shallow copy", () => {
  it("T46.5.1 returned array is frozen (Object.isFrozen)", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord());
    expect(Object.isFrozen(c.getAll())).toBe(true);
  });

  it("T46.5.2 mutating the returned array does not affect the collector", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord());
    const snap1 = c.getAll() as SnapshotLogRecord[];
    // Attempt to modify — should be a no-op (strict mode) or throw
    try { snap1.push(makeBlockedRecord()); } catch { /* frozen */ }
    // Original collector still has 1 record
    expect(c.getAll()).toHaveLength(1);
  });

  it("T46.5.3 two consecutive getAll() calls return arrays with same content", () => {
    const c = createSnapshotLogCollector();
    const r = makeReadyRecord();
    c.collect(r);
    const a1 = c.getAll();
    const a2 = c.getAll();
    expect(a1).toEqual(a2);
  });

  it("T46.5.4 two consecutive getAll() calls return different array instances", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord());
    expect(c.getAll()).not.toBe(c.getAll());
  });
});

// ─── T46.6 — filterByStatus() ────────────────────────────────────────────────

describe("T46.6 — filterByStatus() filters correctly for all 4 readiness statuses", () => {
  let collector: SnapshotLogCollector;
  let ready: SnapshotLogRecord;
  let blocked: SnapshotLogRecord;
  let partial: SnapshotLogRecord;
  let pitBlocked: SnapshotLogRecord;

  beforeAll(() => {
    ready = makeReadyRecord();
    blocked = makeBlockedRecord();
    partial = makePartialRecord();
    pitBlocked = makePitBlockedRecord();
    collector = createSnapshotLogCollector([ready, blocked, partial, pitBlocked]);
  });

  it("T46.6.1 filterByStatus('SNAPSHOT_READY') returns only READY records", () => {
    const result = collector.filterByStatus("SNAPSHOT_READY");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(ready);
  });

  it("T46.6.2 filterByStatus('SNAPSHOT_BLOCKED') returns only BLOCKED records", () => {
    const result = collector.filterByStatus("SNAPSHOT_BLOCKED");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(blocked);
  });

  it("T46.6.3 filterByStatus('SNAPSHOT_PARTIAL') returns only PARTIAL records", () => {
    const result = collector.filterByStatus("SNAPSHOT_PARTIAL");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(partial);
  });

  it("T46.6.4 filterByStatus('SNAPSHOT_BLOCKED_PIT') returns only PIT records", () => {
    const result = collector.filterByStatus("SNAPSHOT_BLOCKED_PIT");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(pitBlocked);
  });

  it("T46.6.5 filterByStatus returns empty for unknown status", () => {
    expect(collector.filterByStatus("UNKNOWN_STATUS")).toHaveLength(0);
  });

  it("T46.6.6 filterByStatus returns frozen array", () => {
    expect(Object.isFrozen(collector.filterByStatus("SNAPSHOT_READY"))).toBe(true);
  });
});

// ─── T46.7 — filterBySymbol() ────────────────────────────────────────────────

describe("T46.7 — filterBySymbol() filters correctly by symbol", () => {
  let collector: SnapshotLogCollector;
  let r_a1: SnapshotLogRecord;
  let r_a2: SnapshotLogRecord;
  let r_b: SnapshotLogRecord;

  beforeAll(() => {
    r_a1 = makeReadyRecord(SYMBOL_A);
    r_a2 = makeBlockedRecord(SYMBOL_A);
    r_b = makeReadyRecord(SYMBOL_B);
    collector = createSnapshotLogCollector([r_a1, r_a2, r_b]);
  });

  it("T46.7.1 filterBySymbol(SYMBOL_A) returns both SYMBOL_A records", () => {
    const result = collector.filterBySymbol(SYMBOL_A);
    expect(result).toHaveLength(2);
  });

  it("T46.7.2 filterBySymbol(SYMBOL_A) records are in insertion order", () => {
    const result = collector.filterBySymbol(SYMBOL_A);
    expect(result[0]).toBe(r_a1);
    expect(result[1]).toBe(r_a2);
  });

  it("T46.7.3 filterBySymbol(SYMBOL_B) returns only SYMBOL_B record", () => {
    const result = collector.filterBySymbol(SYMBOL_B);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(r_b);
  });

  it("T46.7.4 filterBySymbol returns empty for unknown symbol", () => {
    expect(collector.filterBySymbol("9999")).toHaveLength(0);
  });

  it("T46.7.5 filterBySymbol returns frozen array", () => {
    expect(Object.isFrozen(collector.filterBySymbol(SYMBOL_A))).toBe(true);
  });
});

// ─── T46.8 — clear() resets and returns collector ────────────────────────────

describe("T46.8 — clear() resets collector to empty and returns the same collector", () => {
  it("T46.8.1 getAll() is empty after clear()", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord()).collect(makeBlockedRecord());
    c.clear();
    expect(c.getAll()).toHaveLength(0);
  });

  it("T46.8.2 clear() returns the same collector (reference equality)", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord());
    expect(c.clear()).toBe(c);
  });

  it("T46.8.3 clear() on empty collector is a no-op", () => {
    const c = createSnapshotLogCollector();
    c.clear();
    expect(c.getAll()).toHaveLength(0);
  });

  it("T46.8.4 seeded collector is empty after clear()", () => {
    const c = createSnapshotLogCollector([makeReadyRecord(), makeBlockedRecord()]);
    c.clear();
    expect(c.getAll()).toHaveLength(0);
  });
});

// ─── T46.9 — Fluent chaining ──────────────────────────────────────────────────

describe("T46.9 — Fluent chaining collect().collect().getAll()", () => {
  it("T46.9.1 chained collects accumulate in order", () => {
    const r1 = makeReadyRecord(SYMBOL_A);
    const r2 = makeBlockedRecord(SYMBOL_B);
    const r3 = makePartialRecord(SYMBOL_A);
    const c = createSnapshotLogCollector();
    c.collect(r1).collect(r2).collect(r3);
    const all = c.getAll();
    expect(all).toHaveLength(3);
    expect(all[0]).toBe(r1);
    expect(all[1]).toBe(r2);
    expect(all[2]).toBe(r3);
  });

  it("T46.9.2 clear().collect() starts fresh after chain", () => {
    const r1 = makeReadyRecord(SYMBOL_A);
    const r2 = makeBlockedRecord(SYMBOL_B);
    const c = createSnapshotLogCollector();
    c.collect(r1).clear().collect(r2);
    const all = c.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toBe(r2);
  });

  it("T46.9.3 chained collect/clear/collect returns same collector throughout", () => {
    const c = createSnapshotLogCollector();
    const c2 = c.collect(makeReadyRecord());
    const c3 = c2.clear();
    const c4 = c3.collect(makeBlockedRecord());
    expect(c).toBe(c2);
    expect(c2).toBe(c3);
    expect(c3).toBe(c4);
  });
});

// ─── T46.10 — Governance ─────────────────────────────────────────────────────

describe("T46.10 — Governance: SNAPSHOT_LOG_COLLECTOR_VERSION contains 'p46'", () => {
  it("T46.10.1 SNAPSHOT_LOG_COLLECTOR_VERSION contains 'p46'", () => {
    expect(SNAPSHOT_LOG_COLLECTOR_VERSION).toContain("p46");
  });

  it("T46.10.2 SNAPSHOT_LOG_COLLECTOR_VERSION contains 'axis-a'", () => {
    expect(SNAPSHOT_LOG_COLLECTOR_VERSION).toContain("axis-a");
  });

  it("T46.10.3 SNAPSHOT_LOG_COLLECTOR_VERSION contains 'collector'", () => {
    expect(SNAPSHOT_LOG_COLLECTOR_VERSION).toContain("collector");
  });

  it("T46.10.4 collected records preserve entersAlphaScore=false", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord());
    const record = c.getAll()[0]!;
    expect(record.entersAlphaScore).toBe(false);
  });

  it("T46.10.5 collected records preserve notInvestmentRecommendation=true", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord());
    const record = c.getAll()[0]!;
    expect(record.notInvestmentRecommendation).toBe(true);
  });

  it("T46.10.6 collected records preserve paperOnly=true", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord());
    const record = c.getAll()[0]!;
    expect(record.paperOnly).toBe(true);
  });

  it("T46.10.7 collected records preserve dryRun=true", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord());
    const record = c.getAll()[0]!;
    expect(record.dryRun).toBe(true);
  });
});

// ─── T46.11 — Reference isolation from initialRecords ────────────────────────

describe("T46.11 — createSnapshotLogCollector does not share reference with initialRecords", () => {
  it("T46.11.1 pushing to the original array after creation does not affect collector", () => {
    const initial = [makeReadyRecord()];
    const c = createSnapshotLogCollector(initial);
    initial.push(makeBlockedRecord());
    // collector was seeded from a copy — internal list is unaffected
    expect(c.getAll()).toHaveLength(1);
  });

  it("T46.11.2 two collectors seeded from same array are independent", () => {
    const initial = [makeReadyRecord()];
    const c1 = createSnapshotLogCollector(initial);
    const c2 = createSnapshotLogCollector(initial);
    c1.collect(makeBlockedRecord());
    // c2 should still have 1 record
    expect(c2.getAll()).toHaveLength(1);
  });
});

// ─── T46.12 — collect() after clear() starts fresh ───────────────────────────

describe("T46.12 — collect() after clear() behaves correctly", () => {
  it("T46.12.1 1 record after clear().collect()", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord()).collect(makeBlockedRecord()).clear();
    c.collect(makePartialRecord());
    expect(c.getAll()).toHaveLength(1);
    expect(c.getAll()[0]!.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
  });

  it("T46.12.2 filterByStatus works correctly after clear().collect()", () => {
    const c = createSnapshotLogCollector();
    c.collect(makeReadyRecord()).clear();
    c.collect(makeBlockedRecord());
    expect(c.filterByStatus("SNAPSHOT_READY")).toHaveLength(0);
    expect(c.filterByStatus("SNAPSHOT_BLOCKED")).toHaveLength(1);
  });
});
