/**
 * P48 — Axis A Snapshot v0 Batch Runner Tests
 *
 * Tests for SnapshotBatchRunner: runSnapshotBatch() across all 4 readiness
 * states, empty batch, multi-symbol, determinism, governance invariants,
 * and public index re-export surface.
 *
 * DISCLAIMER: Research snapshot tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 */

import {
  SNAPSHOT_BATCH_RUNNER_VERSION,
  runSnapshotBatch,
  type SnapshotBatchRunInput,
  type SnapshotBatchRunResult,
} from "@/lib/research/snapshot/v0/SnapshotBatchRunner";

// Index re-exports — used by T48.12
import {
  SNAPSHOT_BATCH_RUNNER_VERSION as IDX_BATCH_VERSION,
  runSnapshotBatch as idxRunSnapshotBatch,
} from "@/lib/research/snapshot/v0";

import { buildControlledResearchSnapshot } from "@/lib/research/ControlledResearchSnapshotBuilder";
import type { SnapshotBuildInput } from "@/lib/research/ControlledResearchSnapshotBuilder";
import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";

// ─── Test constants ───────────────────────────────────────────────────────────

const FIXED_TODAY = "2026-05-25";
const FIXED_GENERATED_AT = "2026-05-25T00:00:00.000Z";
const FIXED_READOUT_AT = "2026-05-25T02:00:00.000Z";
const FIXED_LOGGED_AT = "2026-05-25T04:00:00.000Z";
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
    sourceTrace: "p48-test-mr",
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
    sourceTrace: "p48-test-quote",
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
    sourceTrace: "p48-test-regime",
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
    sourceTrace: "p48-test-mr-blocked",
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
    sourceTrace: "p48-test-quote-audit-only",
  };
}

// ─── Build input factories ────────────────────────────────────────────────────

function readyInput(symbol = SYMBOL_A): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p48-ready",
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
    sourceTrace: "p48-blocked",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeBlockedMR(),
  };
}

function partialInput(symbol = SYMBOL_A): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p48-partial",
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
    sourceTrace: "p48-pit-blocked",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeEligibleMR(),
    quoteFacts: makeEligibleQuote(),
    regimeFacts: makeEligibleRegime(),
  };
}

// ─── Snapshot builders ────────────────────────────────────────────────────────

const snapshotReady = buildControlledResearchSnapshot(readyInput());
const snapshotBlocked = buildControlledResearchSnapshot(blockedInput());
const snapshotPartial = buildControlledResearchSnapshot(partialInput());
const snapshotPitBlocked = buildControlledResearchSnapshot(pitBlockedInput());
const snapshotReadyB = buildControlledResearchSnapshot(readyInput(SYMBOL_B));
const snapshotBlockedB = buildControlledResearchSnapshot(blockedInput(SYMBOL_B));

// ─── T48.1 — Empty batch ─────────────────────────────────────────────────────

describe("T48.1 — Empty batch returns zero records", () => {
  let result: SnapshotBatchRunResult;

  beforeAll(() => {
    result = runSnapshotBatch({
      snapshots: [],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
  });

  it("T48.1.1 totalSnapshots === 0", () => {
    expect(result.totalSnapshots).toBe(0);
  });

  it("T48.1.2 records is empty", () => {
    expect(result.records).toHaveLength(0);
  });
});

// ─── T48.2 — Single snapshot READY ───────────────────────────────────────────

describe("T48.2 — Single snapshot SNAPSHOT_READY", () => {
  let result: SnapshotBatchRunResult;

  beforeAll(() => {
    result = runSnapshotBatch({
      snapshots: [snapshotReady],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
  });

  it("T48.2.1 totalSnapshots === 1", () => {
    expect(result.totalSnapshots).toBe(1);
  });

  it("T48.2.2 records[0].researchReadinessStatus === SNAPSHOT_READY", () => {
    expect(result.records[0]!.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });

  it("T48.2.3 collector.getAll() has 1 record", () => {
    expect(result.collector.getAll()).toHaveLength(1);
  });

  it("T48.2.4 runnerVersion is SNAPSHOT_BATCH_RUNNER_VERSION", () => {
    expect(result.runnerVersion).toBe(SNAPSHOT_BATCH_RUNNER_VERSION);
  });
});

// ─── T48.3 — Single snapshot BLOCKED ─────────────────────────────────────────

describe("T48.3 — Single snapshot SNAPSHOT_BLOCKED", () => {
  let result: SnapshotBatchRunResult;

  beforeAll(() => {
    result = runSnapshotBatch({
      snapshots: [snapshotBlocked],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
  });

  it("T48.3.1 records[0].researchReadinessStatus === SNAPSHOT_BLOCKED", () => {
    expect(result.records[0]!.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
  });

  it("T48.3.2 records[0].blockedSources is non-empty", () => {
    expect(result.records[0]!.blockedSources.length).toBeGreaterThan(0);
  });

  it("T48.3.3 records[0].blockingReasons is non-empty", () => {
    expect(result.records[0]!.blockingReasons.length).toBeGreaterThan(0);
  });
});

// ─── T48.4 — Single snapshot PARTIAL ─────────────────────────────────────────

describe("T48.4 — Single snapshot SNAPSHOT_PARTIAL", () => {
  let result: SnapshotBatchRunResult;

  beforeAll(() => {
    result = runSnapshotBatch({
      snapshots: [snapshotPartial],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
  });

  it("T48.4.1 records[0].researchReadinessStatus === SNAPSHOT_PARTIAL", () => {
    expect(result.records[0]!.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
  });

  it("T48.4.2 records[0].auditOnlySources is non-empty", () => {
    expect(result.records[0]!.auditOnlySources.length).toBeGreaterThan(0);
  });

  it("T48.4.3 records[0].eligibleSources is non-empty alongside auditOnly", () => {
    expect(result.records[0]!.eligibleSources.length).toBeGreaterThan(0);
  });
});

// ─── T48.5 — Single snapshot BLOCKED_PIT ─────────────────────────────────────

describe("T48.5 — Single snapshot SNAPSHOT_BLOCKED_PIT", () => {
  let result: SnapshotBatchRunResult;

  beforeAll(() => {
    result = runSnapshotBatch({
      snapshots: [snapshotPitBlocked],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
  });

  it("T48.5.1 records[0].researchReadinessStatus === SNAPSHOT_BLOCKED_PIT", () => {
    expect(result.records[0]!.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED_PIT");
  });

  it("T48.5.2 records[0].asOfDate reflects the future date", () => {
    expect(result.records[0]!.asOfDate).toBe(FUTURE_DATE);
  });

  it("T48.5.3 collector filterByStatus BLOCKED_PIT returns 1", () => {
    expect(result.collector.filterByStatus("SNAPSHOT_BLOCKED_PIT")).toHaveLength(1);
  });
});

// ─── T48.6 — Multi-state batch of all 4 ──────────────────────────────────────

describe("T48.6 — Multi-state batch: all 4 readiness states", () => {
  let result: SnapshotBatchRunResult;

  beforeAll(() => {
    result = runSnapshotBatch({
      snapshots: [snapshotReady, snapshotBlocked, snapshotPartial, snapshotPitBlocked],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
  });

  it("T48.6.1 totalSnapshots === 4", () => {
    expect(result.totalSnapshots).toBe(4);
  });

  it("T48.6.2 records has 4 entries", () => {
    expect(result.records).toHaveLength(4);
  });

  it("T48.6.3 collector.getAll() has 4 entries", () => {
    expect(result.collector.getAll()).toHaveLength(4);
  });

  it("T48.6.4 all 4 statuses present in records", () => {
    const statuses = result.records.map((r) => r.researchReadinessStatus);
    expect(statuses).toContain("SNAPSHOT_READY");
    expect(statuses).toContain("SNAPSHOT_BLOCKED");
    expect(statuses).toContain("SNAPSHOT_PARTIAL");
    expect(statuses).toContain("SNAPSHOT_BLOCKED_PIT");
  });

  it("T48.6.5 record order matches input snapshot order", () => {
    expect(result.records[0]!.researchReadinessStatus).toBe("SNAPSHOT_READY");
    expect(result.records[1]!.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
    expect(result.records[2]!.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
    expect(result.records[3]!.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED_PIT");
  });
});

// ─── T48.7 — Multi-symbol batch filterBySymbol ───────────────────────────────

describe("T48.7 — Multi-symbol batch: filterBySymbol", () => {
  let result: SnapshotBatchRunResult;

  beforeAll(() => {
    result = runSnapshotBatch({
      snapshots: [snapshotReady, snapshotBlocked, snapshotReadyB, snapshotBlockedB],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
  });

  it("T48.7.1 totalSnapshots === 4", () => {
    expect(result.totalSnapshots).toBe(4);
  });

  it("T48.7.2 filterBySymbol(SYMBOL_A) returns 2 records", () => {
    expect(result.collector.filterBySymbol(SYMBOL_A)).toHaveLength(2);
  });

  it("T48.7.3 filterBySymbol(SYMBOL_B) returns 2 records", () => {
    expect(result.collector.filterBySymbol(SYMBOL_B)).toHaveLength(2);
  });

  it("T48.7.4 filterBySymbol for unknown symbol returns empty", () => {
    expect(result.collector.filterBySymbol("9999")).toHaveLength(0);
  });

  it("T48.7.5 SYMBOL_A records all have symbol === SYMBOL_A", () => {
    const symbolARecords = result.collector.filterBySymbol(SYMBOL_A);
    expect(symbolARecords.every((r) => r.symbol === SYMBOL_A)).toBe(true);
  });
});

// ─── T48.8 — records equals collector.getAll() ───────────────────────────────

describe("T48.8 — result.records content matches collector.getAll() content", () => {
  let result: SnapshotBatchRunResult;

  beforeAll(() => {
    result = runSnapshotBatch({
      snapshots: [snapshotReady, snapshotBlocked],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
  });

  it("T48.8.1 result.records.length equals collector.getAll().length", () => {
    expect(result.records.length).toBe(result.collector.getAll().length);
  });

  it("T48.8.2 each record in result.records deep-equals the corresponding collector record", () => {
    const all = result.collector.getAll();
    for (let i = 0; i < result.records.length; i++) {
      expect(result.records[i]).toEqual(all[i]);
    }
  });

  it("T48.8.3 result.records is frozen", () => {
    expect(Object.isFrozen(result.records)).toBe(true);
  });

  it("T48.8.4 collector.getAll() returns a frozen array", () => {
    expect(Object.isFrozen(result.collector.getAll())).toBe(true);
  });
});

// ─── T48.9 — Determinism with fixed timestamps ───────────────────────────────

describe("T48.9 — Determinism: same inputs + fixed timestamps yield identical records", () => {
  it("T48.9.1 two runs with same fixed timestamps produce equal records", () => {
    const run1 = runSnapshotBatch({
      snapshots: [snapshotReady],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
    const run2 = runSnapshotBatch({
      snapshots: [snapshotReady],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
    expect(run1.records[0]).toEqual(run2.records[0]);
  });

  it("T48.9.2 records[0].readoutAt equals the injected FIXED_READOUT_AT", () => {
    const result = runSnapshotBatch({
      snapshots: [snapshotReady],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
    expect(result.records[0]!.readoutAt).toBe(FIXED_READOUT_AT);
  });

  it("T48.9.3 records[0].loggedAt equals the injected FIXED_LOGGED_AT", () => {
    const result = runSnapshotBatch({
      snapshots: [snapshotReady],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
    expect(result.records[0]!.loggedAt).toBe(FIXED_LOGGED_AT);
  });

  it("T48.9.4 formattedPreview is identical across two deterministic runs", () => {
    const run1 = runSnapshotBatch({
      snapshots: [snapshotBlocked],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
    const run2 = runSnapshotBatch({
      snapshots: [snapshotBlocked],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
    expect(run1.records[0]!.formattedPreview).toBe(run2.records[0]!.formattedPreview);
  });
});

// ─── T48.10 — Governance invariants in all records ───────────────────────────

describe("T48.10 — Governance invariants propagate through batch runner", () => {
  let result: SnapshotBatchRunResult;

  beforeAll(() => {
    result = runSnapshotBatch({
      snapshots: [snapshotReady, snapshotBlocked, snapshotPartial, snapshotPitBlocked],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
  });

  it("T48.10.1 every record.entersAlphaScore === false", () => {
    expect(result.records.every((r) => r.entersAlphaScore === false)).toBe(true);
  });

  it("T48.10.2 every record.notInvestmentRecommendation === true", () => {
    expect(result.records.every((r) => r.notInvestmentRecommendation === true)).toBe(true);
  });

  it("T48.10.3 every record.paperOnly === true", () => {
    expect(result.records.every((r) => r.paperOnly === true)).toBe(true);
  });

  it("T48.10.4 every record.dryRun === true", () => {
    expect(result.records.every((r) => r.dryRun === true)).toBe(true);
  });

  it("T48.10.5 every record.invariantsValid === true", () => {
    expect(result.records.every((r) => r.invariantsValid === true)).toBe(true);
  });
});

// ─── T48.11 — runnerVersion and totalSnapshots ────────────────────────────────

describe("T48.11 — runnerVersion and totalSnapshots correctness", () => {
  it("T48.11.1 SNAPSHOT_BATCH_RUNNER_VERSION contains 'p48'", () => {
    expect(SNAPSHOT_BATCH_RUNNER_VERSION).toContain("p48");
  });

  it("T48.11.2 result.runnerVersion === SNAPSHOT_BATCH_RUNNER_VERSION", () => {
    const result = runSnapshotBatch({ snapshots: [snapshotReady], fixedReadoutAt: FIXED_READOUT_AT, fixedLoggedAt: FIXED_LOGGED_AT });
    expect(result.runnerVersion).toBe(SNAPSHOT_BATCH_RUNNER_VERSION);
  });

  it("T48.11.3 totalSnapshots matches input.snapshots.length for batch of 3", () => {
    const result = runSnapshotBatch({
      snapshots: [snapshotReady, snapshotBlocked, snapshotPartial],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
    expect(result.totalSnapshots).toBe(3);
  });

  it("T48.11.4 totalSnapshots === 0 for empty input", () => {
    const result = runSnapshotBatch({ snapshots: [], fixedReadoutAt: FIXED_READOUT_AT, fixedLoggedAt: FIXED_LOGGED_AT });
    expect(result.totalSnapshots).toBe(0);
  });
});

// ─── T48.12 — Public index re-exports SnapshotBatchRunner symbols ─────────────

describe("T48.12 — Public index re-exports SnapshotBatchRunner symbols correctly", () => {
  it("T48.12.1 IDX_BATCH_VERSION === SNAPSHOT_BATCH_RUNNER_VERSION", () => {
    expect(IDX_BATCH_VERSION).toBe(SNAPSHOT_BATCH_RUNNER_VERSION);
  });

  it("T48.12.2 idxRunSnapshotBatch produces same result as direct import", () => {
    const direct = runSnapshotBatch({
      snapshots: [snapshotReady],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
    const fromIndex = idxRunSnapshotBatch({
      snapshots: [snapshotReady],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
    expect(fromIndex.records).toEqual(direct.records);
  });

  it("T48.12.3 idxRunSnapshotBatch works for multi-state batch", () => {
    const result = idxRunSnapshotBatch({
      snapshots: [snapshotReady, snapshotBlocked],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
    expect(result.totalSnapshots).toBe(2);
    expect(result.records).toHaveLength(2);
  });

  it("T48.12.4 idxRunSnapshotBatch result preserves governance invariants", () => {
    const result = idxRunSnapshotBatch({
      snapshots: [snapshotReady],
      fixedReadoutAt: FIXED_READOUT_AT,
      fixedLoggedAt: FIXED_LOGGED_AT,
    });
    expect(result.records[0]!.entersAlphaScore).toBe(false);
    expect(result.records[0]!.paperOnly).toBe(true);
  });
});
