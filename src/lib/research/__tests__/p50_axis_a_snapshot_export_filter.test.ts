/**
 * P50 — Axis A Snapshot v0 Export Filter Tests
 *
 * Tests for SnapshotExportFilter: filterSnapshotLogExport()
 * covering no-criteria pass-through, symbol filter, status filter,
 * loggedAt date range filters, combined criteria, no-match empty result,
 * immutability of output arrays, preserved source fields, and public
 * index re-export surface.
 *
 * DISCLAIMER: Research snapshot tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 */

import {
  SNAPSHOT_EXPORT_FILTER_VERSION,
  filterSnapshotLogExport,
  type SnapshotExportFilterCriteria,
} from "@/lib/research/snapshot/v0/SnapshotExportFilter";

// Index re-exports — used by T50.10
import {
  SNAPSHOT_EXPORT_FILTER_VERSION as IDX_FILTER_VERSION,
  filterSnapshotLogExport as idxFilter,
  SNAPSHOT_LOG_EXPORTER_VERSION,
} from "@/lib/research/snapshot/v0";

import { buildControlledResearchSnapshot } from "@/lib/research/ControlledResearchSnapshotBuilder";
import type { SnapshotBuildInput } from "@/lib/research/ControlledResearchSnapshotBuilder";
import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";
import { emitSnapshot } from "@/lib/research/snapshot/v0/SnapshotEmitter";
import { serializeEmitResult } from "@/lib/research/snapshot/v0/SnapshotLogWriter";
import type { SnapshotLogRecord } from "@/lib/research/snapshot/v0/SnapshotLogWriter";
import { exportSnapshotLogRecords } from "@/lib/research/snapshot/v0/SnapshotLogExporter";
import type { SnapshotLogExport } from "@/lib/research/snapshot/v0/SnapshotLogExporter";

// ─── Test constants ───────────────────────────────────────────────────────────

const FIXED_TODAY = "2026-05-25";
const FIXED_GENERATED_AT = "2026-05-25T00:00:00.000Z";
const FIXED_READOUT_AT = "2026-05-25T02:00:00.000Z";
const FIXED_EXPORTED_AT = "2026-05-25T06:00:00.000Z";
const PAST_DATE = "2026-05-01";
const FUTURE_DATE = "2099-12-31";
const SYMBOL_A = "2330";
const SYMBOL_B = "2317";

// loggedAt timestamps used to test date range filtering
const LOGGED_EARLY = "2026-05-01T04:00:00.000Z";  // earliest
const LOGGED_MID   = "2026-05-15T04:00:00.000Z";  // mid
const LOGGED_LATE  = "2026-05-25T04:00:00.000Z";  // latest

// loggedAtFrom / loggedAtTo boundary constants
const FROM_AFTER_EARLY = "2026-05-10T00:00:00.000Z"; // > LOGGED_EARLY, < LOGGED_MID
const FROM_AFTER_MID   = "2026-05-20T00:00:00.000Z"; // > LOGGED_MID, < LOGGED_LATE
const FROM_FUTURE      = "2026-12-01T00:00:00.000Z"; // > all records
const TO_BEFORE_LATE   = "2026-05-20T00:00:00.000Z"; // < LOGGED_LATE, >= LOGGED_MID
const TO_BEFORE_MID    = "2026-05-10T00:00:00.000Z"; // < LOGGED_MID, >= LOGGED_EARLY
const TO_PAST          = "2026-01-01T00:00:00.000Z"; // < all records

// ─── Source readiness fixtures ────────────────────────────────────────────────

function makeEligibleMR(): SourceReadinessFacts {
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
    sourceTrace: "p50-test-mr",
  };
}

function makeEligibleQuote(): SourceReadinessFacts {
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
    sourceTrace: "p50-test-quote",
  };
}

function makeEligibleRegime(): SourceReadinessFacts {
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
    sourceTrace: "p50-test-regime",
  };
}

function makeBlockedMR(): SourceReadinessFacts {
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
    sourceTrace: "p50-test-mr-blocked",
  };
}

function makeAuditOnlyQuote(): SourceReadinessFacts {
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
    sourceTrace: "p50-test-quote-audit-only",
  };
}

// ─── Build input factories ────────────────────────────────────────────────────

function readyInput(symbol: string): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p50-ready",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeEligibleMR(),
    quoteFacts: makeEligibleQuote(),
    regimeFacts: makeEligibleRegime(),
  };
}

function blockedInput(symbol: string): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p50-blocked",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeBlockedMR(),
  };
}

function partialInput(symbol: string): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p50-partial",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeEligibleMR(),
    quoteFacts: makeAuditOnlyQuote(),
    regimeFacts: makeEligibleRegime(),
  };
}

// ─── Record factory ───────────────────────────────────────────────────────────

function makeRecord(
  input: SnapshotBuildInput,
  fixedLoggedAt: string,
): SnapshotLogRecord {
  const snapshot = buildControlledResearchSnapshot(input);
  const emitResult = emitSnapshot(snapshot, FIXED_READOUT_AT);
  return serializeEmitResult(emitResult, fixedLoggedAt);
}

// ─── Pre-built records ────────────────────────────────────────────────────────
//
//  recordEarlyA — SYMBOL_A, SNAPSHOT_READY,   loggedAt = LOGGED_EARLY
//  recordMidA   — SYMBOL_A, SNAPSHOT_BLOCKED, loggedAt = LOGGED_MID
//  recordLateA  — SYMBOL_A, PARTIAL*,         loggedAt = LOGGED_LATE
//  recordMidB   — SYMBOL_B, SNAPSHOT_READY,   loggedAt = LOGGED_MID
//
// * Exact status string captured via .researchReadinessStatus below.

const recordEarlyA = makeRecord(readyInput(SYMBOL_A), LOGGED_EARLY);
const recordMidA   = makeRecord(blockedInput(SYMBOL_A), LOGGED_MID);
const recordLateA  = makeRecord(partialInput(SYMBOL_A), LOGGED_LATE);
const recordMidB   = makeRecord(readyInput(SYMBOL_B), LOGGED_MID);

// Capture dynamic status strings for use in filter assertions
const STATUS_READY   = "SNAPSHOT_READY";
const STATUS_BLOCKED = "SNAPSHOT_BLOCKED";
const STATUS_PARTIAL = recordLateA.researchReadinessStatus;

// ─── Source export containing all 4 records ───────────────────────────────────

const sourceExport: SnapshotLogExport = exportSnapshotLogRecords(
  [recordEarlyA, recordMidA, recordLateA, recordMidB],
  FIXED_EXPORTED_AT,
);

// ─── T50.1 — No criteria → all records returned ──────────────────────────────

describe("T50.1 — filterSnapshotLogExport: no criteria (empty object)", () => {
  let result: SnapshotLogExport;

  beforeAll(() => {
    result = filterSnapshotLogExport(sourceExport, {});
  });

  it("T50.1.1 totalRecords === 4", () => {
    expect(result.totalRecords).toBe(4);
  });

  it("T50.1.2 records.length === 4", () => {
    expect(result.records).toHaveLength(4);
  });

  it("T50.1.3 symbols.length === 2", () => {
    expect(result.symbols).toHaveLength(2);
  });

  it("T50.1.4 statuses includes STATUS_READY and STATUS_BLOCKED", () => {
    expect(result.statuses).toContain(STATUS_READY);
    expect(result.statuses).toContain(STATUS_BLOCKED);
  });

  it("T50.1.5 exportedAt preserved from source", () => {
    expect(result.exportedAt).toBe(FIXED_EXPORTED_AT);
  });
});

// ─── T50.2 — Filter by symbol ─────────────────────────────────────────────────

describe("T50.2 — filterSnapshotLogExport: filter by symbol", () => {
  let resultA: SnapshotLogExport;
  let resultB: SnapshotLogExport;

  beforeAll(() => {
    resultA = filterSnapshotLogExport(sourceExport, { symbol: SYMBOL_A });
    resultB = filterSnapshotLogExport(sourceExport, { symbol: SYMBOL_B });
  });

  it("T50.2.1 filter SYMBOL_A → totalRecords === 3", () => {
    expect(resultA.totalRecords).toBe(3);
  });

  it("T50.2.2 filter SYMBOL_B → totalRecords === 1", () => {
    expect(resultB.totalRecords).toBe(1);
  });

  it("T50.2.3 filter SYMBOL_A → symbols === [SYMBOL_A]", () => {
    expect(resultA.symbols).toEqual([SYMBOL_A]);
  });

  it("T50.2.4 filter SYMBOL_B → symbols === [SYMBOL_B]", () => {
    expect(resultB.symbols).toEqual([SYMBOL_B]);
  });
});

// ─── T50.3 — Filter by status ─────────────────────────────────────────────────

describe("T50.3 — filterSnapshotLogExport: filter by status", () => {
  let resultReady: SnapshotLogExport;
  let resultBlocked: SnapshotLogExport;

  beforeAll(() => {
    resultReady   = filterSnapshotLogExport(sourceExport, { status: STATUS_READY });
    resultBlocked = filterSnapshotLogExport(sourceExport, { status: STATUS_BLOCKED });
  });

  it("T50.3.1 filter STATUS_READY → totalRecords === 2 (recordEarlyA + recordMidB)", () => {
    expect(resultReady.totalRecords).toBe(2);
  });

  it("T50.3.2 filter STATUS_BLOCKED → totalRecords === 1 (recordMidA)", () => {
    expect(resultBlocked.totalRecords).toBe(1);
  });

  it("T50.3.3 filter STATUS_READY → statuses === [STATUS_READY]", () => {
    expect(resultReady.statuses).toEqual([STATUS_READY]);
  });

  it("T50.3.4 filter STATUS_READY → symbols includes both SYMBOL_A and SYMBOL_B", () => {
    expect(resultReady.symbols).toContain(SYMBOL_A);
    expect(resultReady.symbols).toContain(SYMBOL_B);
  });
});

// ─── T50.4 — Filter by loggedAtFrom ──────────────────────────────────────────

describe("T50.4 — filterSnapshotLogExport: filter by loggedAtFrom", () => {
  it("T50.4.1 loggedAtFrom = FROM_AFTER_EARLY → totalRecords === 3", () => {
    // Excludes recordEarlyA (LOGGED_EARLY < FROM_AFTER_EARLY)
    const result = filterSnapshotLogExport(sourceExport, {
      loggedAtFrom: FROM_AFTER_EARLY,
    });
    expect(result.totalRecords).toBe(3);
  });

  it("T50.4.2 loggedAtFrom = FROM_AFTER_MID → totalRecords === 1 (only recordLateA)", () => {
    // Excludes early + mid records; only LOGGED_LATE survives
    const result = filterSnapshotLogExport(sourceExport, {
      loggedAtFrom: FROM_AFTER_MID,
    });
    expect(result.totalRecords).toBe(1);
  });

  it("T50.4.3 loggedAtFrom = FROM_FUTURE → totalRecords === 0", () => {
    const result = filterSnapshotLogExport(sourceExport, {
      loggedAtFrom: FROM_FUTURE,
    });
    expect(result.totalRecords).toBe(0);
  });
});

// ─── T50.5 — Filter by loggedAtTo ────────────────────────────────────────────

describe("T50.5 — filterSnapshotLogExport: filter by loggedAtTo", () => {
  it("T50.5.1 loggedAtTo = TO_BEFORE_LATE → totalRecords === 3", () => {
    // Excludes recordLateA (LOGGED_LATE > TO_BEFORE_LATE)
    const result = filterSnapshotLogExport(sourceExport, {
      loggedAtTo: TO_BEFORE_LATE,
    });
    expect(result.totalRecords).toBe(3);
  });

  it("T50.5.2 loggedAtTo = TO_BEFORE_MID → totalRecords === 1 (only recordEarlyA)", () => {
    // Excludes mid + late records; only LOGGED_EARLY survives
    const result = filterSnapshotLogExport(sourceExport, {
      loggedAtTo: TO_BEFORE_MID,
    });
    expect(result.totalRecords).toBe(1);
  });

  it("T50.5.3 loggedAtTo = TO_PAST → totalRecords === 0", () => {
    const result = filterSnapshotLogExport(sourceExport, {
      loggedAtTo: TO_PAST,
    });
    expect(result.totalRecords).toBe(0);
  });
});

// ─── T50.6 — loggedAt range (from + to) ──────────────────────────────────────

describe("T50.6 — filterSnapshotLogExport: loggedAt range", () => {
  // Range: FROM_AFTER_EARLY .. TO_BEFORE_LATE
  // → matches recordMidA (LOGGED_MID) and recordMidB (LOGGED_MID)
  let result: SnapshotLogExport;

  beforeAll(() => {
    result = filterSnapshotLogExport(sourceExport, {
      loggedAtFrom: FROM_AFTER_EARLY,
      loggedAtTo: TO_BEFORE_LATE,
    });
  });

  it("T50.6.1 range → totalRecords === 2", () => {
    expect(result.totalRecords).toBe(2);
  });

  it("T50.6.2 range → symbols includes SYMBOL_A and SYMBOL_B", () => {
    expect(result.symbols).toContain(SYMBOL_A);
    expect(result.symbols).toContain(SYMBOL_B);
  });

  it("T50.6.3 range → statuses includes STATUS_BLOCKED and STATUS_READY only", () => {
    expect(result.statuses).toContain(STATUS_BLOCKED); // recordMidA
    expect(result.statuses).toContain(STATUS_READY);   // recordMidB
    expect(result.statuses).not.toContain(STATUS_PARTIAL);
  });
});

// ─── T50.7 — Combined symbol + status ────────────────────────────────────────

describe("T50.7 — filterSnapshotLogExport: combined symbol + status criteria", () => {
  it("T50.7.1 SYMBOL_A + STATUS_READY → totalRecords === 1 (recordEarlyA)", () => {
    const result = filterSnapshotLogExport(sourceExport, {
      symbol: SYMBOL_A,
      status: STATUS_READY,
    });
    expect(result.totalRecords).toBe(1);
    expect(result.records[0]!.loggedAt).toBe(LOGGED_EARLY);
  });

  it("T50.7.2 SYMBOL_A + STATUS_BLOCKED → totalRecords === 1 (recordMidA)", () => {
    const result = filterSnapshotLogExport(sourceExport, {
      symbol: SYMBOL_A,
      status: STATUS_BLOCKED,
    });
    expect(result.totalRecords).toBe(1);
    expect(result.records[0]!.loggedAt).toBe(LOGGED_MID);
  });

  it("T50.7.3 SYMBOL_B + STATUS_READY → totalRecords === 1 (recordMidB)", () => {
    const result = filterSnapshotLogExport(sourceExport, {
      symbol: SYMBOL_B,
      status: STATUS_READY,
    });
    expect(result.totalRecords).toBe(1);
    expect(result.records[0]!.symbol).toBe(SYMBOL_B);
  });

  it("T50.7.4 SYMBOL_B + STATUS_BLOCKED → totalRecords === 0", () => {
    const result = filterSnapshotLogExport(sourceExport, {
      symbol: SYMBOL_B,
      status: STATUS_BLOCKED,
    });
    expect(result.totalRecords).toBe(0);
  });
});

// ─── T50.8 — No match → empty result ─────────────────────────────────────────

describe("T50.8 — filterSnapshotLogExport: no match returns empty result", () => {
  let result: SnapshotLogExport;

  beforeAll(() => {
    result = filterSnapshotLogExport(sourceExport, { symbol: "9999" });
  });

  it("T50.8.1 no match → totalRecords === 0", () => {
    expect(result.totalRecords).toBe(0);
  });

  it("T50.8.2 no match → symbols === []", () => {
    expect(result.symbols).toHaveLength(0);
  });

  it("T50.8.3 no match → statuses === []", () => {
    expect(result.statuses).toHaveLength(0);
  });

  it("T50.8.4 no match → governance vacuously true", () => {
    expect(result.governanceSummary.allEnterAlphaScoreFalse).toBe(true);
    expect(result.governanceSummary.allPaperOnly).toBe(true);
    expect(result.governanceSummary.allDryRun).toBe(true);
    expect(result.governanceSummary.allNotInvestmentRecommendation).toBe(true);
  });
});

// ─── T50.9 — Immutability + preserved source fields ──────────────────────────

describe("T50.9 — filterSnapshotLogExport: immutability and preserved fields", () => {
  let result: SnapshotLogExport;

  beforeAll(() => {
    result = filterSnapshotLogExport(sourceExport, { symbol: SYMBOL_A });
  });

  it("T50.9.1 records array is frozen", () => {
    expect(Object.isFrozen(result.records)).toBe(true);
  });

  it("T50.9.2 symbols array is frozen", () => {
    expect(Object.isFrozen(result.symbols)).toBe(true);
  });

  it("T50.9.3 statuses array is frozen", () => {
    expect(Object.isFrozen(result.statuses)).toBe(true);
  });

  it("T50.9.4 exportedAt preserved from source export", () => {
    expect(result.exportedAt).toBe(sourceExport.exportedAt);
  });
});

// ─── T50.10 — Public index re-exports ────────────────────────────────────────

describe("T50.10 — Public index re-exports SnapshotExportFilter symbols correctly", () => {
  it("T50.10.1 IDX_FILTER_VERSION === SNAPSHOT_EXPORT_FILTER_VERSION", () => {
    expect(IDX_FILTER_VERSION).toBe(SNAPSHOT_EXPORT_FILTER_VERSION);
  });

  it("T50.10.2 idxFilter produces same result as direct import", () => {
    const criteria: SnapshotExportFilterCriteria = { symbol: SYMBOL_A };
    const direct = filterSnapshotLogExport(sourceExport, criteria);
    const fromIdx = idxFilter(sourceExport, criteria);
    expect(fromIdx.totalRecords).toBe(direct.totalRecords);
    expect(fromIdx.symbols).toEqual(direct.symbols);
    expect(fromIdx.statuses).toEqual(direct.statuses);
  });

  it("T50.10.3 idxFilter with complex criteria works", () => {
    const result = idxFilter(sourceExport, {
      symbol: SYMBOL_A,
      status: STATUS_READY,
    });
    expect(result.totalRecords).toBe(1);
    expect(result.symbols).toEqual([SYMBOL_A]);
  });

  it("T50.10.4 filtered result preserves exporterVersion === SNAPSHOT_LOG_EXPORTER_VERSION", () => {
    const result = idxFilter(sourceExport, {});
    expect(result.exporterVersion).toBe(SNAPSHOT_LOG_EXPORTER_VERSION);
  });
});
