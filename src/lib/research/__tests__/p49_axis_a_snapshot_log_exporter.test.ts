/**
 * P49 — Axis A Snapshot v0 Log Exporter Tests
 *
 * Tests for SnapshotLogExporter:
 *   exportSnapshotLogRecord(), exportSnapshotLogRecords(),
 *   exportSnapshotLogCollector() across all 4 readiness states,
 *   empty input, multi-symbol, deduplication, determinism,
 *   governance invariants, and public index re-export surface.
 *
 * DISCLAIMER: Research snapshot tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 */

import {
  SNAPSHOT_LOG_EXPORTER_VERSION,
  exportSnapshotLogRecord,
  exportSnapshotLogRecords,
  exportSnapshotLogCollector,
  type SnapshotLogExport,
} from "@/lib/research/snapshot/v0/SnapshotLogExporter";

// Index re-exports — used by T49.10
import {
  SNAPSHOT_LOG_EXPORTER_VERSION as IDX_EXPORTER_VERSION,
  exportSnapshotLogRecord as idxExportRecord,
  exportSnapshotLogRecords as idxExportRecords,
  exportSnapshotLogCollector as idxExportCollector,
} from "@/lib/research/snapshot/v0";

import { buildControlledResearchSnapshot } from "@/lib/research/ControlledResearchSnapshotBuilder";
import type { SnapshotBuildInput } from "@/lib/research/ControlledResearchSnapshotBuilder";
import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";
import { emitSnapshot } from "@/lib/research/snapshot/v0/SnapshotEmitter";
import { serializeEmitResult } from "@/lib/research/snapshot/v0/SnapshotLogWriter";
import { createSnapshotLogCollector } from "@/lib/research/snapshot/v0/SnapshotLogCollector";
import type { SnapshotLogRecord } from "@/lib/research/snapshot/v0/SnapshotLogWriter";

// ─── Test constants ───────────────────────────────────────────────────────────

const FIXED_TODAY = "2026-05-25";
const FIXED_GENERATED_AT = "2026-05-25T00:00:00.000Z";
const FIXED_READOUT_AT = "2026-05-25T02:00:00.000Z";
const FIXED_LOGGED_AT = "2026-05-25T04:00:00.000Z";
const FIXED_EXPORTED_AT = "2026-05-25T06:00:00.000Z";
const PAST_DATE = "2026-05-01";
const FUTURE_DATE = "2099-12-31";
const SYMBOL_A = "2330";
const SYMBOL_B = "2317";

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
    sourceTrace: "p49-test-mr",
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
    sourceTrace: "p49-test-quote",
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
    sourceTrace: "p49-test-regime",
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
    sourceTrace: "p49-test-mr-blocked",
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
    sourceTrace: "p49-test-quote-audit-only",
  };
}

// ─── Build input factories ────────────────────────────────────────────────────

function readyInput(symbol = SYMBOL_A): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p49-ready",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeEligibleMR(),
    quoteFacts: makeEligibleQuote(),
    regimeFacts: makeEligibleRegime(),
  };
}

function blockedInput(symbol = SYMBOL_A): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p49-blocked",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeBlockedMR(),
  };
}

function partialInput(symbol = SYMBOL_A): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p49-partial",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeEligibleMR(),
    quoteFacts: makeAuditOnlyQuote(),
    regimeFacts: makeEligibleRegime(),
  };
}

function pitBlockedInput(symbol = SYMBOL_A): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: FUTURE_DATE,
    sourceTrace: "p49-pit-blocked",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeEligibleMR(),
    quoteFacts: makeEligibleQuote(),
    regimeFacts: makeEligibleRegime(),
  };
}

// ─── Pre-built snapshots and records ─────────────────────────────────────────

function makeRecord(input: SnapshotBuildInput): SnapshotLogRecord {
  const snapshot = buildControlledResearchSnapshot(input);
  const emitResult = emitSnapshot(snapshot, FIXED_READOUT_AT);
  return serializeEmitResult(emitResult, FIXED_LOGGED_AT);
}

const recordReady = makeRecord(readyInput());
const recordBlocked = makeRecord(blockedInput());
const recordPartial = makeRecord(partialInput());
const recordPitBlocked = makeRecord(pitBlockedInput());
const recordReadyB = makeRecord(readyInput(SYMBOL_B));
const recordBlockedB = makeRecord(blockedInput(SYMBOL_B));

// ─── T49.1 — Empty export ─────────────────────────────────────────────────────

describe("T49.1 — exportSnapshotLogRecords: empty input", () => {
  let result: SnapshotLogExport;

  beforeAll(() => {
    result = exportSnapshotLogRecords([], FIXED_EXPORTED_AT);
  });

  it("T49.1.1 totalRecords === 0", () => {
    expect(result.totalRecords).toBe(0);
  });

  it("T49.1.2 records is empty", () => {
    expect(result.records).toHaveLength(0);
  });

  it("T49.1.3 symbols is empty", () => {
    expect(result.symbols).toHaveLength(0);
  });

  it("T49.1.4 statuses is empty", () => {
    expect(result.statuses).toHaveLength(0);
  });

  it("T49.1.5 governance vacuously true for empty set", () => {
    expect(result.governanceSummary.allEnterAlphaScoreFalse).toBe(true);
    expect(result.governanceSummary.allPaperOnly).toBe(true);
    expect(result.governanceSummary.allDryRun).toBe(true);
    expect(result.governanceSummary.allNotInvestmentRecommendation).toBe(true);
  });
});

// ─── T49.2 — exportSnapshotLogRecord: single READY record ────────────────────

describe("T49.2 — exportSnapshotLogRecord: single SNAPSHOT_READY", () => {
  let result: SnapshotLogExport;

  beforeAll(() => {
    result = exportSnapshotLogRecord(recordReady, FIXED_EXPORTED_AT);
  });

  it("T49.2.1 exporterVersion === SNAPSHOT_LOG_EXPORTER_VERSION", () => {
    expect(result.exporterVersion).toBe(SNAPSHOT_LOG_EXPORTER_VERSION);
  });

  it("T49.2.2 totalRecords === 1", () => {
    expect(result.totalRecords).toBe(1);
  });

  it("T49.2.3 records[0].researchReadinessStatus === SNAPSHOT_READY", () => {
    expect(result.records[0]!.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });

  it("T49.2.4 symbols contains SYMBOL_A", () => {
    expect(result.symbols).toContain(SYMBOL_A);
  });

  it("T49.2.5 exportedAt === FIXED_EXPORTED_AT", () => {
    expect(result.exportedAt).toBe(FIXED_EXPORTED_AT);
  });
});

// ─── T49.3 — exportSnapshotLogRecord: single BLOCKED record ──────────────────

describe("T49.3 — exportSnapshotLogRecord: single SNAPSHOT_BLOCKED", () => {
  let result: SnapshotLogExport;

  beforeAll(() => {
    result = exportSnapshotLogRecord(recordBlocked, FIXED_EXPORTED_AT);
  });

  it("T49.3.1 records[0].researchReadinessStatus === SNAPSHOT_BLOCKED", () => {
    expect(result.records[0]!.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
  });

  it("T49.3.2 statuses === ['SNAPSHOT_BLOCKED']", () => {
    expect(result.statuses).toEqual(["SNAPSHOT_BLOCKED"]);
  });

  it("T49.3.3 totalRecords === 1", () => {
    expect(result.totalRecords).toBe(1);
  });
});

// ─── T49.4 — exportSnapshotLogRecords: all 4 readiness states ────────────────

describe("T49.4 — exportSnapshotLogRecords: all 4 readiness states", () => {
  let result: SnapshotLogExport;

  beforeAll(() => {
    result = exportSnapshotLogRecords(
      [recordReady, recordBlocked, recordPartial, recordPitBlocked],
      FIXED_EXPORTED_AT
    );
  });

  it("T49.4.1 totalRecords === 4", () => {
    expect(result.totalRecords).toBe(4);
  });

  it("T49.4.2 statuses contains all 4 status values", () => {
    expect(result.statuses).toContain("SNAPSHOT_READY");
    expect(result.statuses).toContain("SNAPSHOT_BLOCKED");
    expect(result.statuses).toContain("SNAPSHOT_PARTIAL");
    expect(result.statuses).toContain("SNAPSHOT_BLOCKED_PIT");
  });

  it("T49.4.3 statuses has no duplicates", () => {
    expect(result.statuses.length).toBe(new Set(result.statuses).size);
  });

  it("T49.4.4 statuses is sorted", () => {
    const sorted = [...result.statuses].sort();
    expect([...result.statuses]).toEqual(sorted);
  });

  it("T49.4.5 records array is frozen", () => {
    expect(Object.isFrozen(result.records)).toBe(true);
  });
});

// ─── T49.5 — exportSnapshotLogCollector ──────────────────────────────────────

describe("T49.5 — exportSnapshotLogCollector", () => {
  let result: SnapshotLogExport;

  beforeAll(() => {
    const collector = createSnapshotLogCollector();
    collector
      .collect(recordReady)
      .collect(recordBlocked)
      .collect(recordPartial)
      .collect(recordPitBlocked);
    result = exportSnapshotLogCollector(collector, FIXED_EXPORTED_AT);
  });

  it("T49.5.1 totalRecords === 4", () => {
    expect(result.totalRecords).toBe(4);
  });

  it("T49.5.2 exportedAt === FIXED_EXPORTED_AT", () => {
    expect(result.exportedAt).toBe(FIXED_EXPORTED_AT);
  });

  it("T49.5.3 records[0].researchReadinessStatus === SNAPSHOT_READY", () => {
    expect(result.records[0]!.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });

  it("T49.5.4 exporterVersion matches SNAPSHOT_LOG_EXPORTER_VERSION", () => {
    expect(result.exporterVersion).toBe(SNAPSHOT_LOG_EXPORTER_VERSION);
  });

  it("T49.5.5 empty collector produces totalRecords === 0", () => {
    const emptyCollector = createSnapshotLogCollector();
    const emptyResult = exportSnapshotLogCollector(emptyCollector, FIXED_EXPORTED_AT);
    expect(emptyResult.totalRecords).toBe(0);
  });
});

// ─── T49.6 — symbols deduplication and sorting ───────────────────────────────

describe("T49.6 — symbols: deduplication and sorting", () => {
  it("T49.6.1 two SYMBOL_A records produce one symbol entry", () => {
    const result = exportSnapshotLogRecords(
      [recordReady, makeRecord(readyInput(SYMBOL_A))],
      FIXED_EXPORTED_AT
    );
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0]).toBe(SYMBOL_A);
  });

  it("T49.6.2 SYMBOL_A + SYMBOL_B deduplicated to 2 entries", () => {
    const result = exportSnapshotLogRecords(
      [recordReady, recordReadyB],
      FIXED_EXPORTED_AT
    );
    expect(result.symbols).toHaveLength(2);
  });

  it("T49.6.3 symbols is sorted ascending", () => {
    const result = exportSnapshotLogRecords(
      [recordReadyB, recordReady],
      FIXED_EXPORTED_AT
    );
    const sorted = [...result.symbols].sort();
    expect([...result.symbols]).toEqual(sorted);
  });

  it("T49.6.4 symbols array is frozen", () => {
    const result = exportSnapshotLogRecords([recordReady], FIXED_EXPORTED_AT);
    expect(Object.isFrozen(result.symbols)).toBe(true);
  });
});

// ─── T49.7 — statuses deduplication and sorting ──────────────────────────────

describe("T49.7 — statuses: deduplication and sorting", () => {
  it("T49.7.1 two READY records produce one status entry", () => {
    const result = exportSnapshotLogRecords(
      [recordReady, makeRecord(readyInput(SYMBOL_B))],
      FIXED_EXPORTED_AT
    );
    expect(result.statuses).toHaveLength(1);
    expect(result.statuses[0]).toBe("SNAPSHOT_READY");
  });

  it("T49.7.2 READY + BLOCKED deduplicated to 2 entries", () => {
    const result = exportSnapshotLogRecords(
      [recordReady, recordBlocked],
      FIXED_EXPORTED_AT
    );
    expect(result.statuses).toHaveLength(2);
  });

  it("T49.7.3 statuses is sorted ascending", () => {
    const result = exportSnapshotLogRecords(
      [recordPitBlocked, recordBlocked, recordReady, recordPartial],
      FIXED_EXPORTED_AT
    );
    const sorted = [...result.statuses].sort();
    expect([...result.statuses]).toEqual(sorted);
  });

  it("T49.7.4 statuses array is frozen", () => {
    const result = exportSnapshotLogRecords([recordReady], FIXED_EXPORTED_AT);
    expect(Object.isFrozen(result.statuses)).toBe(true);
  });
});

// ─── T49.8 — governanceSummary invariants ────────────────────────────────────

describe("T49.8 — governanceSummary: governance invariants across batch", () => {
  let result: SnapshotLogExport;

  beforeAll(() => {
    result = exportSnapshotLogRecords(
      [recordReady, recordBlocked, recordPartial, recordPitBlocked],
      FIXED_EXPORTED_AT
    );
  });

  it("T49.8.1 allEnterAlphaScoreFalse === true", () => {
    expect(result.governanceSummary.allEnterAlphaScoreFalse).toBe(true);
  });

  it("T49.8.2 allPaperOnly === true", () => {
    expect(result.governanceSummary.allPaperOnly).toBe(true);
  });

  it("T49.8.3 allDryRun === true", () => {
    expect(result.governanceSummary.allDryRun).toBe(true);
  });

  it("T49.8.4 allNotInvestmentRecommendation === true", () => {
    expect(result.governanceSummary.allNotInvestmentRecommendation).toBe(true);
  });

  it("T49.8.5 multi-symbol batch governance all true", () => {
    const multiResult = exportSnapshotLogRecords(
      [recordReady, recordReadyB, recordBlocked, recordBlockedB],
      FIXED_EXPORTED_AT
    );
    expect(multiResult.governanceSummary.allEnterAlphaScoreFalse).toBe(true);
    expect(multiResult.governanceSummary.allPaperOnly).toBe(true);
    expect(multiResult.governanceSummary.allDryRun).toBe(true);
    expect(multiResult.governanceSummary.allNotInvestmentRecommendation).toBe(true);
  });
});

// ─── T49.9 — Determinism with fixed exportedAt ───────────────────────────────

describe("T49.9 — Determinism: same inputs + fixedExportedAt yield identical exports", () => {
  it("T49.9.1 two calls with same fixed timestamp produce identical exportedAt", () => {
    const r1 = exportSnapshotLogRecords([recordReady], FIXED_EXPORTED_AT);
    const r2 = exportSnapshotLogRecords([recordReady], FIXED_EXPORTED_AT);
    expect(r1.exportedAt).toBe(r2.exportedAt);
  });

  it("T49.9.2 records content is identical across deterministic calls", () => {
    const r1 = exportSnapshotLogRecords([recordReady], FIXED_EXPORTED_AT);
    const r2 = exportSnapshotLogRecords([recordReady], FIXED_EXPORTED_AT);
    expect(r1.records[0]).toEqual(r2.records[0]);
  });

  it("T49.9.3 exportSnapshotLogRecord and exportSnapshotLogRecords([record]) produce equal result", () => {
    const single = exportSnapshotLogRecord(recordReady, FIXED_EXPORTED_AT);
    const list = exportSnapshotLogRecords([recordReady], FIXED_EXPORTED_AT);
    expect(single.totalRecords).toBe(list.totalRecords);
    expect(single.symbols).toEqual(list.symbols);
    expect(single.statuses).toEqual(list.statuses);
    expect(single.exportedAt).toBe(list.exportedAt);
    expect(single.records[0]).toEqual(list.records[0]);
  });
});

// ─── T49.10 — Public index re-exports ────────────────────────────────────────

describe("T49.10 — Public index re-exports SnapshotLogExporter symbols correctly", () => {
  it("T49.10.1 IDX_EXPORTER_VERSION === SNAPSHOT_LOG_EXPORTER_VERSION", () => {
    expect(IDX_EXPORTER_VERSION).toBe(SNAPSHOT_LOG_EXPORTER_VERSION);
  });

  it("T49.10.2 idxExportRecord produces same result as direct import", () => {
    const direct = exportSnapshotLogRecord(recordReady, FIXED_EXPORTED_AT);
    const idx = idxExportRecord(recordReady, FIXED_EXPORTED_AT);
    expect(idx.totalRecords).toBe(direct.totalRecords);
    expect(idx.exportedAt).toBe(direct.exportedAt);
    expect(idx.symbols).toEqual(direct.symbols);
  });

  it("T49.10.3 idxExportRecords works for multi-record list", () => {
    const result = idxExportRecords(
      [recordReady, recordBlocked],
      FIXED_EXPORTED_AT
    );
    expect(result.totalRecords).toBe(2);
  });

  it("T49.10.4 idxExportCollector preserves governance invariants", () => {
    const collector = createSnapshotLogCollector();
    collector.collect(recordReady).collect(recordBlocked);
    const result = idxExportCollector(collector, FIXED_EXPORTED_AT);
    expect(result.governanceSummary.allEnterAlphaScoreFalse).toBe(true);
    expect(result.governanceSummary.allPaperOnly).toBe(true);
  });
});
