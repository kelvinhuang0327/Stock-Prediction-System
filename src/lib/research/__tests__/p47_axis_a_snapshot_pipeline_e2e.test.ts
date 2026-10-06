/**
 * P47 — Axis A Snapshot v0 End-to-End Pipeline Integration Test
 *
 * Verifies the full P42→P43→P44→P45→P46 pipeline for all 4 readiness states:
 *   SNAPSHOT_READY · SNAPSHOT_BLOCKED · SNAPSHOT_PARTIAL · SNAPSHOT_BLOCKED_PIT
 *
 * Pipeline stages under test:
 *   P42  readSnapshot()              ControlledResearchSnapshot → SnapshotReadout
 *   P43  formatSnapshotReadout()     SnapshotReadout → string
 *   P44  emitSnapshot()              snapshot → EmitResult { readout, formatted }
 *   P45  serializeEmitResult()       EmitResult → SnapshotLogRecord
 *   P46  createSnapshotLogCollector  SnapshotLogRecord[] → collector
 *
 * Test suites:
 *   T47.1  SNAPSHOT_READY  — end-to-end pipeline
 *   T47.2  SNAPSHOT_BLOCKED — end-to-end pipeline
 *   T47.3  SNAPSHOT_PARTIAL — end-to-end pipeline
 *   T47.4  SNAPSHOT_BLOCKED_PIT — end-to-end pipeline
 *   T47.5  P44 readout equals P42 readout for all 4 states
 *   T47.6  P44 formatted equals P43 formatted for all 4 states
 *   T47.7  P45→P46: record fields preserved through collection
 *   T47.8  Collector filterByStatus on all 4 states in one collector
 *   T47.9  Collector filterBySymbol on multi-symbol pipeline output
 *   T47.10 Governance invariants propagate through all 5 stages
 *   T47.11 Version chain: P42→P46 version constants present at each stage
 *   T47.12 Public index re-exports all pipeline symbols correctly
 *
 * DISCLAIMER: Integration test for Axis A research snapshot pipeline only.
 * entersAlphaScore = false. ALWAYS. Not investment advice.
 * No buy/sell/hold semantics. No scoring formula access.
 */

import { readSnapshot } from "@/lib/research/snapshot/v0/SnapshotReader";
import {
  SNAPSHOT_READER_VERSION,
  type SnapshotReadout,
} from "@/lib/research/snapshot/v0/SnapshotReader";

import { formatSnapshotReadout } from "@/lib/research/snapshot/v0/SnapshotFormatter";
import { SNAPSHOT_FORMATTER_VERSION } from "@/lib/research/snapshot/v0/SnapshotFormatter";

import { emitSnapshot } from "@/lib/research/snapshot/v0/SnapshotEmitter";
import {
  SNAPSHOT_EMITTER_VERSION,
  type EmitResult,
} from "@/lib/research/snapshot/v0/SnapshotEmitter";

import { serializeEmitResult } from "@/lib/research/snapshot/v0/SnapshotLogWriter";
import {
  SNAPSHOT_LOG_WRITER_VERSION,
  type SnapshotLogRecord,
} from "@/lib/research/snapshot/v0/SnapshotLogWriter";

import { createSnapshotLogCollector } from "@/lib/research/snapshot/v0/SnapshotLogCollector";
import {
  SNAPSHOT_LOG_COLLECTOR_VERSION,
  type SnapshotLogCollector,
} from "@/lib/research/snapshot/v0/SnapshotLogCollector";

// Index re-exports — used by T47.12 to verify the public surface
import {
  SNAPSHOT_READER_VERSION as IDX_READER_VERSION,
  SNAPSHOT_FORMATTER_VERSION as IDX_FORMATTER_VERSION,
  SNAPSHOT_EMITTER_VERSION as IDX_EMITTER_VERSION,
  SNAPSHOT_LOG_WRITER_VERSION as IDX_LOG_WRITER_VERSION,
  SNAPSHOT_LOG_COLLECTOR_VERSION as IDX_LOG_COLLECTOR_VERSION,
  readSnapshot as idxReadSnapshot,
  formatSnapshotReadout as idxFormatSnapshotReadout,
  emitSnapshot as idxEmitSnapshot,
  serializeEmitResult as idxSerializeEmitResult,
  createSnapshotLogCollector as idxCreateSnapshotLogCollector,
} from "@/lib/research/snapshot/v0";

import { buildControlledResearchSnapshot } from "@/lib/research/ControlledResearchSnapshotBuilder";
import type {
  SnapshotBuildInput,
} from "@/lib/research/ControlledResearchSnapshotBuilder";
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

// ─── Source Readiness Fixtures ────────────────────────────────────────────────

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
    sourceTrace: "p47-test-mr",
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
    sourceTrace: "p47-test-quote",
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
    sourceTrace: "p47-test-regime",
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
    sourceTrace: "p47-test-mr-blocked",
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
    sourceTrace: "p47-test-quote-audit-only",
  };
}

// ─── Build Input Factories ────────────────────────────────────────────────────

function readyInput(symbol = SYMBOL_A): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p47-e2e-ready",
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
    sourceTrace: "p47-e2e-blocked",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeBlockedMR(),
  };
}

function partialInput(symbol = SYMBOL_A): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p47-e2e-partial",
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
    sourceTrace: "p47-e2e-pit-blocked",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeEligibleMR(),
    quoteFacts: makeEligibleQuote(),
    regimeFacts: makeEligibleRegime(),
  };
}

// ─── Full-pipeline helper ─────────────────────────────────────────────────────

type PipelineResult = {
  readout: SnapshotReadout;
  formatted: string;
  emitResult: EmitResult;
  record: SnapshotLogRecord;
  collector: SnapshotLogCollector;
};

function runPipeline(input: SnapshotBuildInput): PipelineResult {
  const snapshot = buildControlledResearchSnapshot(input);         // build
  const readout = readSnapshot(snapshot, FIXED_READOUT_AT);        // P42
  const formatted = formatSnapshotReadout(readout);                 // P43
  const emitResult = emitSnapshot(snapshot, FIXED_READOUT_AT);     // P44
  const record = serializeEmitResult(emitResult, FIXED_LOGGED_AT); // P45
  const collector = createSnapshotLogCollector([record]);           // P46
  return { readout, formatted, emitResult, record, collector };
}

// ─── T47.1 — SNAPSHOT_READY end-to-end ───────────────────────────────────────

describe("T47.1 — SNAPSHOT_READY end-to-end pipeline", () => {
  let p: PipelineResult;

  beforeAll(() => { p = runPipeline(readyInput()); });

  it("T47.1.1 P42: readout.researchReadinessStatus === SNAPSHOT_READY", () => {
    expect(p.readout.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });

  it("T47.1.2 P42: readout.eligibleSources contains expected sources", () => {
    expect(p.readout.eligibleSources).toContain("MonthlyRevenue");
    expect(p.readout.eligibleSources).toContain("Quote");
    expect(p.readout.eligibleSources).toContain("Regime");
  });

  it("T47.1.3 P43: formatted is a non-empty string", () => {
    expect(typeof p.formatted).toBe("string");
    expect(p.formatted.length).toBeGreaterThan(0);
  });

  it("T47.1.4 P44: emitResult.readout.researchReadinessStatus === SNAPSHOT_READY", () => {
    expect(p.emitResult.readout.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });

  it("T47.1.5 P45: record.researchReadinessStatus === SNAPSHOT_READY", () => {
    expect(p.record.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });

  it("T47.1.6 P46: collector.getAll()[0] researchReadinessStatus === SNAPSHOT_READY", () => {
    expect(p.collector.getAll()[0]!.researchReadinessStatus).toBe("SNAPSHOT_READY");
  });
});

// ─── T47.2 — SNAPSHOT_BLOCKED end-to-end ─────────────────────────────────────

describe("T47.2 — SNAPSHOT_BLOCKED end-to-end pipeline", () => {
  let p: PipelineResult;

  beforeAll(() => { p = runPipeline(blockedInput()); });

  it("T47.2.1 P42: readout.researchReadinessStatus === SNAPSHOT_BLOCKED", () => {
    expect(p.readout.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
  });

  it("T47.2.2 P42: readout.blockedSources is non-empty", () => {
    expect(p.readout.blockedSources.length).toBeGreaterThan(0);
  });

  it("T47.2.3 P44: emitResult.readout.researchReadinessStatus === SNAPSHOT_BLOCKED", () => {
    expect(p.emitResult.readout.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
  });

  it("T47.2.4 P45: record.researchReadinessStatus === SNAPSHOT_BLOCKED", () => {
    expect(p.record.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
  });

  it("T47.2.5 P45: record.blockingReasons is non-empty for BLOCKED", () => {
    expect(p.record.blockingReasons.length).toBeGreaterThan(0);
  });
});

// ─── T47.3 — SNAPSHOT_PARTIAL end-to-end ─────────────────────────────────────

describe("T47.3 — SNAPSHOT_PARTIAL end-to-end pipeline", () => {
  let p: PipelineResult;

  beforeAll(() => { p = runPipeline(partialInput()); });

  it("T47.3.1 P42: readout.researchReadinessStatus === SNAPSHOT_PARTIAL", () => {
    expect(p.readout.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
  });

  it("T47.3.2 P42: readout has both eligible and auditOnly sources", () => {
    expect(p.readout.eligibleSources.length).toBeGreaterThan(0);
    expect(p.readout.auditOnlySources.length).toBeGreaterThan(0);
  });

  it("T47.3.3 P44: emitResult.readout.researchReadinessStatus === SNAPSHOT_PARTIAL", () => {
    expect(p.emitResult.readout.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
  });

  it("T47.3.4 P45: record.researchReadinessStatus === SNAPSHOT_PARTIAL", () => {
    expect(p.record.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
  });

  it("T47.3.5 P45: record.auditOnlySources is non-empty for PARTIAL", () => {
    expect(p.record.auditOnlySources.length).toBeGreaterThan(0);
  });
});

// ─── T47.4 — SNAPSHOT_BLOCKED_PIT end-to-end ─────────────────────────────────

describe("T47.4 — SNAPSHOT_BLOCKED_PIT end-to-end pipeline", () => {
  let p: PipelineResult;

  beforeAll(() => { p = runPipeline(pitBlockedInput()); });

  it("T47.4.1 P42: readout.researchReadinessStatus === SNAPSHOT_BLOCKED_PIT", () => {
    expect(p.readout.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED_PIT");
  });

  it("T47.4.2 P44: emitResult.readout.researchReadinessStatus === SNAPSHOT_BLOCKED_PIT", () => {
    expect(p.emitResult.readout.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED_PIT");
  });

  it("T47.4.3 P45: record.researchReadinessStatus === SNAPSHOT_BLOCKED_PIT", () => {
    expect(p.record.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED_PIT");
  });

  it("T47.4.4 P45: record.asOfDate reflects the future date", () => {
    expect(p.record.asOfDate).toBe(FUTURE_DATE);
  });

  it("T47.4.5 P46: collector preserves BLOCKED_PIT status", () => {
    expect(p.collector.getAll()[0]!.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED_PIT");
  });
});

// ─── T47.5 — P44 readout matches P42 readout for all 4 states ────────────────

describe("T47.5 — P44 emitResult.readout deep-equals P42 readSnapshot output", () => {
  it("T47.5.1 READY: emitResult.readout deep-equals readSnapshot output", () => {
    const snapshot = buildControlledResearchSnapshot(readyInput());
    const direct = readSnapshot(snapshot, FIXED_READOUT_AT);
    const fromEmit = emitSnapshot(snapshot, FIXED_READOUT_AT);
    expect(fromEmit.readout).toEqual(direct);
  });

  it("T47.5.2 BLOCKED: emitResult.readout deep-equals readSnapshot output", () => {
    const snapshot = buildControlledResearchSnapshot(blockedInput());
    const direct = readSnapshot(snapshot, FIXED_READOUT_AT);
    const fromEmit = emitSnapshot(snapshot, FIXED_READOUT_AT);
    expect(fromEmit.readout).toEqual(direct);
  });

  it("T47.5.3 PARTIAL: emitResult.readout deep-equals readSnapshot output", () => {
    const snapshot = buildControlledResearchSnapshot(partialInput());
    const direct = readSnapshot(snapshot, FIXED_READOUT_AT);
    const fromEmit = emitSnapshot(snapshot, FIXED_READOUT_AT);
    expect(fromEmit.readout).toEqual(direct);
  });

  it("T47.5.4 BLOCKED_PIT: emitResult.readout deep-equals readSnapshot output", () => {
    const snapshot = buildControlledResearchSnapshot(pitBlockedInput());
    const direct = readSnapshot(snapshot, FIXED_READOUT_AT);
    const fromEmit = emitSnapshot(snapshot, FIXED_READOUT_AT);
    expect(fromEmit.readout).toEqual(direct);
  });
});

// ─── T47.6 — P44 formatted matches P43 formatted for all 4 states ────────────

describe("T47.6 — P44 emitResult.formatted equals P43 formatSnapshotReadout output", () => {
  it("T47.6.1 READY: emitResult.formatted equals formatSnapshotReadout(readout)", () => {
    const snapshot = buildControlledResearchSnapshot(readyInput());
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    const directFormatted = formatSnapshotReadout(readout);
    const fromEmit = emitSnapshot(snapshot, FIXED_READOUT_AT);
    expect(fromEmit.formatted).toBe(directFormatted);
  });

  it("T47.6.2 BLOCKED: emitResult.formatted equals formatSnapshotReadout(readout)", () => {
    const snapshot = buildControlledResearchSnapshot(blockedInput());
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    const directFormatted = formatSnapshotReadout(readout);
    const fromEmit = emitSnapshot(snapshot, FIXED_READOUT_AT);
    expect(fromEmit.formatted).toBe(directFormatted);
  });

  it("T47.6.3 PARTIAL: emitResult.formatted equals formatSnapshotReadout(readout)", () => {
    const snapshot = buildControlledResearchSnapshot(partialInput());
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    const directFormatted = formatSnapshotReadout(readout);
    const fromEmit = emitSnapshot(snapshot, FIXED_READOUT_AT);
    expect(fromEmit.formatted).toBe(directFormatted);
  });

  it("T47.6.4 BLOCKED_PIT: emitResult.formatted equals formatSnapshotReadout(readout)", () => {
    const snapshot = buildControlledResearchSnapshot(pitBlockedInput());
    const readout = readSnapshot(snapshot, FIXED_READOUT_AT);
    const directFormatted = formatSnapshotReadout(readout);
    const fromEmit = emitSnapshot(snapshot, FIXED_READOUT_AT);
    expect(fromEmit.formatted).toBe(directFormatted);
  });
});

// ─── T47.7 — P45→P46: record fields preserved through collection ──────────────

describe("T47.7 — P45→P46: record fields preserved through collection", () => {
  let readyP: PipelineResult;
  let blockedP: PipelineResult;
  let partialP: PipelineResult;
  let pitP: PipelineResult;

  beforeAll(() => {
    readyP = runPipeline(readyInput());
    blockedP = runPipeline(blockedInput());
    partialP = runPipeline(partialInput());
    pitP = runPipeline(pitBlockedInput());
  });

  it("T47.7.1 record.symbol matches the input symbol", () => {
    expect(readyP.record.symbol).toBe(SYMBOL_A);
    expect(blockedP.record.symbol).toBe(SYMBOL_A);
    expect(partialP.record.symbol).toBe(SYMBOL_A);
    expect(pitP.record.symbol).toBe(SYMBOL_A);
  });

  it("T47.7.2 record.asOfDate matches the input asOfDate", () => {
    expect(readyP.record.asOfDate).toBe(PAST_DATE);
    expect(blockedP.record.asOfDate).toBe(PAST_DATE);
    expect(partialP.record.asOfDate).toBe(PAST_DATE);
    expect(pitP.record.asOfDate).toBe(FUTURE_DATE);
  });

  it("T47.7.3 record.formattedPreview is a non-empty string for all 4 states", () => {
    expect(readyP.record.formattedPreview.length).toBeGreaterThan(0);
    expect(blockedP.record.formattedPreview.length).toBeGreaterThan(0);
    expect(partialP.record.formattedPreview.length).toBeGreaterThan(0);
    expect(pitP.record.formattedPreview.length).toBeGreaterThan(0);
  });

  it("T47.7.4 record.invariantsValid is true for all valid snapshots", () => {
    expect(readyP.record.invariantsValid).toBe(true);
    expect(blockedP.record.invariantsValid).toBe(true);
    expect(partialP.record.invariantsValid).toBe(true);
    expect(pitP.record.invariantsValid).toBe(true);
  });

  it("T47.7.5 record.logVersion equals SNAPSHOT_LOG_WRITER_VERSION for all 4", () => {
    expect(readyP.record.logVersion).toBe(SNAPSHOT_LOG_WRITER_VERSION);
    expect(blockedP.record.logVersion).toBe(SNAPSHOT_LOG_WRITER_VERSION);
    expect(partialP.record.logVersion).toBe(SNAPSHOT_LOG_WRITER_VERSION);
    expect(pitP.record.logVersion).toBe(SNAPSHOT_LOG_WRITER_VERSION);
  });
});

// ─── T47.8 — Collector filterByStatus on all 4 states in one collector ────────

describe("T47.8 — Collector filterByStatus on mixed-state collector", () => {
  let collector: SnapshotLogCollector;

  beforeAll(() => {
    const records = [
      runPipeline(readyInput()).record,
      runPipeline(blockedInput()).record,
      runPipeline(partialInput()).record,
      runPipeline(pitBlockedInput()).record,
    ];
    collector = createSnapshotLogCollector(records);
  });

  it("T47.8.1 total record count in collector is 4", () => {
    expect(collector.getAll()).toHaveLength(4);
  });

  it("T47.8.2 filterByStatus SNAPSHOT_READY returns 1 record", () => {
    expect(collector.filterByStatus("SNAPSHOT_READY")).toHaveLength(1);
  });

  it("T47.8.3 filterByStatus SNAPSHOT_BLOCKED returns 1 record", () => {
    expect(collector.filterByStatus("SNAPSHOT_BLOCKED")).toHaveLength(1);
  });

  it("T47.8.4 filterByStatus SNAPSHOT_PARTIAL returns 1 record", () => {
    expect(collector.filterByStatus("SNAPSHOT_PARTIAL")).toHaveLength(1);
  });

  it("T47.8.5 filterByStatus SNAPSHOT_BLOCKED_PIT returns 1 record", () => {
    expect(collector.filterByStatus("SNAPSHOT_BLOCKED_PIT")).toHaveLength(1);
  });
});

// ─── T47.9 — filterBySymbol on multi-symbol pipeline output ──────────────────

describe("T47.9 — Collector filterBySymbol on multi-symbol pipeline output", () => {
  let collector: SnapshotLogCollector;

  beforeAll(() => {
    const records = [
      runPipeline(readyInput(SYMBOL_A)).record,
      runPipeline(blockedInput(SYMBOL_A)).record,
      runPipeline(readyInput(SYMBOL_B)).record,
      runPipeline(partialInput(SYMBOL_B)).record,
    ];
    collector = createSnapshotLogCollector(records);
  });

  it("T47.9.1 total records in collector is 4", () => {
    expect(collector.getAll()).toHaveLength(4);
  });

  it("T47.9.2 filterBySymbol(SYMBOL_A) returns 2 records", () => {
    expect(collector.filterBySymbol(SYMBOL_A)).toHaveLength(2);
  });

  it("T47.9.3 filterBySymbol(SYMBOL_B) returns 2 records", () => {
    expect(collector.filterBySymbol(SYMBOL_B)).toHaveLength(2);
  });

  it("T47.9.4 filterBySymbol for unknown symbol returns empty", () => {
    expect(collector.filterBySymbol("9999")).toHaveLength(0);
  });

  it("T47.9.5 SYMBOL_A records have correct researchReadinessStatus values", () => {
    const symbolARecords = collector.filterBySymbol(SYMBOL_A);
    const statuses = symbolARecords.map((r) => r.researchReadinessStatus);
    expect(statuses).toContain("SNAPSHOT_READY");
    expect(statuses).toContain("SNAPSHOT_BLOCKED");
  });
});

// ─── T47.10 — Governance invariants propagate through all 5 stages ────────────

describe("T47.10 — Governance invariants propagate through all 5 stages", () => {
  let p: PipelineResult;

  beforeAll(() => { p = runPipeline(readyInput()); });

  it("T47.10.1 P42: readout.entersAlphaScore === false", () => {
    expect(p.readout.entersAlphaScore).toBe(false);
  });

  it("T47.10.2 P42: readout.notInvestmentRecommendation === true", () => {
    expect(p.readout.notInvestmentRecommendation).toBe(true);
  });

  it("T47.10.3 P42: readout.paperOnly === true", () => {
    expect(p.readout.paperOnly).toBe(true);
  });

  it("T47.10.4 P42: readout.dryRun === true", () => {
    expect(p.readout.dryRun).toBe(true);
  });

  it("T47.10.5 P44: emitResult.readout governance fields unchanged", () => {
    expect(p.emitResult.readout.entersAlphaScore).toBe(false);
    expect(p.emitResult.readout.notInvestmentRecommendation).toBe(true);
    expect(p.emitResult.readout.paperOnly).toBe(true);
    expect(p.emitResult.readout.dryRun).toBe(true);
  });

  it("T47.10.6 P45: record.entersAlphaScore === false", () => {
    expect(p.record.entersAlphaScore).toBe(false);
  });

  it("T47.10.7 P45: record governance flags all correct", () => {
    expect(p.record.notInvestmentRecommendation).toBe(true);
    expect(p.record.paperOnly).toBe(true);
    expect(p.record.dryRun).toBe(true);
  });
});

// ─── T47.11 — Version chain: P42→P46 version constants at each stage ──────────

describe("T47.11 — Version chain: P42→P46 version constants present at each stage", () => {
  let p: PipelineResult;

  beforeAll(() => { p = runPipeline(readyInput()); });

  it("T47.11.1 P42: readout.readerVersion === SNAPSHOT_READER_VERSION", () => {
    expect(p.readout.readerVersion).toBe(SNAPSHOT_READER_VERSION);
  });

  it("T47.11.2 P43: SNAPSHOT_FORMATTER_VERSION contains 'p43'", () => {
    expect(SNAPSHOT_FORMATTER_VERSION).toContain("p43");
  });

  it("T47.11.3 P44: SNAPSHOT_EMITTER_VERSION contains 'p44'", () => {
    expect(SNAPSHOT_EMITTER_VERSION).toContain("p44");
  });

  it("T47.11.4 P45: record.logVersion === SNAPSHOT_LOG_WRITER_VERSION", () => {
    expect(p.record.logVersion).toBe(SNAPSHOT_LOG_WRITER_VERSION);
  });

  it("T47.11.5 P46: collector.collectorVersion === SNAPSHOT_LOG_COLLECTOR_VERSION", () => {
    expect(p.collector.collectorVersion).toBe(SNAPSHOT_LOG_COLLECTOR_VERSION);
  });
});

// ─── T47.12 — Public index re-exports all pipeline symbols ────────────────────

describe("T47.12 — Public index re-exports all pipeline symbols correctly", () => {
  it("T47.12.1 index VERSION constants match the source module constants", () => {
    expect(IDX_READER_VERSION).toBe(SNAPSHOT_READER_VERSION);
    expect(IDX_FORMATTER_VERSION).toBe(SNAPSHOT_FORMATTER_VERSION);
    expect(IDX_EMITTER_VERSION).toBe(SNAPSHOT_EMITTER_VERSION);
    expect(IDX_LOG_WRITER_VERSION).toBe(SNAPSHOT_LOG_WRITER_VERSION);
    expect(IDX_LOG_COLLECTOR_VERSION).toBe(SNAPSHOT_LOG_COLLECTOR_VERSION);
  });

  it("T47.12.2 index re-exported readSnapshot and emitSnapshot produce same result as source imports", () => {
    const snapshot = buildControlledResearchSnapshot(readyInput());
    const direct = readSnapshot(snapshot, FIXED_READOUT_AT);
    const fromIndex = idxReadSnapshot(snapshot, FIXED_READOUT_AT);
    expect(fromIndex).toEqual(direct);
  });

  it("T47.12.3 index re-exported emitSnapshot produces same EmitResult as source import", () => {
    const snapshot = buildControlledResearchSnapshot(readyInput());
    const direct = emitSnapshot(snapshot, FIXED_READOUT_AT);
    const fromIndex = idxEmitSnapshot(snapshot, FIXED_READOUT_AT);
    expect(fromIndex).toEqual(direct);
  });

  it("T47.12.4 index re-exported createSnapshotLogCollector is functional", () => {
    const emit = emitSnapshot(buildControlledResearchSnapshot(readyInput()), FIXED_READOUT_AT);
    const record = idxSerializeEmitResult(emit, FIXED_LOGGED_AT);
    const c = idxCreateSnapshotLogCollector([record]);
    expect(c.getAll()).toHaveLength(1);
    expect(c.collectorVersion).toBe(SNAPSHOT_LOG_COLLECTOR_VERSION);
  });
});
