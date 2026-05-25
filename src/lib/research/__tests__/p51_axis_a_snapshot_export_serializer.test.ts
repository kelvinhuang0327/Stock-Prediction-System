/**
 * P51 — Axis A Snapshot v0 Export Serializer Tests
 *
 * Tests for SnapshotExportSerializer: serializeSnapshotLogExport()
 * covering version constant, envelope shape, schemaVersion, serializedAt,
 * payload validity, round-trip fidelity (single + multi-record), empty
 * exports, determinism, and public index re-export surface.
 *
 * DISCLAIMER: Research snapshot tests only. Not investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 */

import {
  SNAPSHOT_EXPORT_SERIALIZER_VERSION,
  serializeSnapshotLogExport,
  type SnapshotExportSerializedEnvelope,
} from "@/lib/research/snapshot/v0/SnapshotExportSerializer";

// Index re-exports — used by T51.10
import {
  SNAPSHOT_EXPORT_SERIALIZER_VERSION as IDX_SERIALIZER_VERSION,
  serializeSnapshotLogExport as idxSerialize,
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
const FIXED_SERIALIZED_AT = "2026-05-25T08:00:00.000Z";
const FIXED_SERIALIZED_AT_2 = "2026-05-25T09:00:00.000Z";
const SYMBOL_A = "2330";
const SYMBOL_B = "2317";
const PAST_DATE = "2026-05-01";
const LOGGED_AT_A = "2026-05-20T04:00:00.000Z";
const LOGGED_AT_B = "2026-05-21T04:00:00.000Z";
const LOGGED_AT_C = "2026-05-22T04:00:00.000Z";

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
    sourceTrace: "p51-test-mr",
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
    sourceTrace: "p51-test-quote",
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
    sourceTrace: "p51-test-regime",
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
    sourceTrace: "p51-test-mr-blocked",
  };
}

// ─── Build input factories ────────────────────────────────────────────────────

function readyInput(symbol: string): SnapshotBuildInput {
  return {
    symbol,
    asOfDate: PAST_DATE,
    sourceTrace: "p51-ready",
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
    sourceTrace: "p51-blocked",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    monthlyRevenueFacts: makeBlockedMR(),
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
//  recordReadyA   — SYMBOL_A, SNAPSHOT_READY,   loggedAt = LOGGED_AT_A
//  recordBlockedA — SYMBOL_A, SNAPSHOT_BLOCKED, loggedAt = LOGGED_AT_B
//  recordReadyB   — SYMBOL_B, SNAPSHOT_READY,   loggedAt = LOGGED_AT_C

const recordReadyA = makeRecord(readyInput(SYMBOL_A), LOGGED_AT_A);
const recordBlockedA = makeRecord(blockedInput(SYMBOL_A), LOGGED_AT_B);
const recordReadyB = makeRecord(readyInput(SYMBOL_B), LOGGED_AT_C);

// ─── Pre-built exports ────────────────────────────────────────────────────────

const singleExport: SnapshotLogExport = exportSnapshotLogRecords(
  [recordReadyA],
  FIXED_EXPORTED_AT,
);

const multiExport: SnapshotLogExport = exportSnapshotLogRecords(
  [recordReadyA, recordBlockedA, recordReadyB],
  FIXED_EXPORTED_AT,
);

const emptyExport: SnapshotLogExport = exportSnapshotLogRecords(
  [],
  FIXED_EXPORTED_AT,
);

// ─── T51.1 — Version constant ─────────────────────────────────────────────────

describe("T51.1 — SNAPSHOT_EXPORT_SERIALIZER_VERSION constant", () => {
  it("T51.1.1 constant value is correct", () => {
    expect(SNAPSHOT_EXPORT_SERIALIZER_VERSION).toBe(
      "p51-axis-a-snapshot-export-serializer-v0",
    );
  });

  it("T51.1.2 envelope.serializerVersion equals constant", () => {
    const envelope = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    expect(envelope.serializerVersion).toBe(SNAPSHOT_EXPORT_SERIALIZER_VERSION);
  });

  it("T51.1.3 constant is a string", () => {
    expect(typeof SNAPSHOT_EXPORT_SERIALIZER_VERSION).toBe("string");
  });
});

// ─── T51.2 — Envelope shape ───────────────────────────────────────────────────

describe("T51.2 — serializeSnapshotLogExport: envelope shape", () => {
  let envelope: SnapshotExportSerializedEnvelope;

  beforeAll(() => {
    envelope = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
  });

  it("T51.2.1 envelope has serializerVersion field", () => {
    expect(envelope).toHaveProperty("serializerVersion");
  });

  it("T51.2.2 envelope has serializedAt field", () => {
    expect(envelope).toHaveProperty("serializedAt");
  });

  it("T51.2.3 envelope has schemaVersion field", () => {
    expect(envelope).toHaveProperty("schemaVersion");
  });

  it("T51.2.4 envelope has payload field", () => {
    expect(envelope).toHaveProperty("payload");
  });
});

// ─── T51.3 — schemaVersion ────────────────────────────────────────────────────

describe("T51.3 — serializeSnapshotLogExport: schemaVersion", () => {
  it("T51.3.1 schemaVersion is \"snapshot-log-export-v0\" for single-record export", () => {
    const envelope = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    expect(envelope.schemaVersion).toBe("snapshot-log-export-v0");
  });

  it("T51.3.2 schemaVersion is \"snapshot-log-export-v0\" for empty export", () => {
    const envelope = serializeSnapshotLogExport(emptyExport, FIXED_SERIALIZED_AT);
    expect(envelope.schemaVersion).toBe("snapshot-log-export-v0");
  });

  it("T51.3.3 schemaVersion is \"snapshot-log-export-v0\" for multi-record export", () => {
    const envelope = serializeSnapshotLogExport(multiExport, FIXED_SERIALIZED_AT);
    expect(envelope.schemaVersion).toBe("snapshot-log-export-v0");
  });
});

// ─── T51.4 — serializedAt ─────────────────────────────────────────────────────

describe("T51.4 — serializeSnapshotLogExport: serializedAt", () => {
  it("T51.4.1 fixedSerializedAt provided → serializedAt equals it", () => {
    const envelope = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    expect(envelope.serializedAt).toBe(FIXED_SERIALIZED_AT);
  });

  it("T51.4.2 fixedSerializedAt omitted → serializedAt is a non-empty string", () => {
    const envelope = serializeSnapshotLogExport(singleExport);
    expect(typeof envelope.serializedAt).toBe("string");
    expect(envelope.serializedAt.length).toBeGreaterThan(0);
  });

  it("T51.4.3 two calls with same fixedSerializedAt → identical serializedAt", () => {
    const e1 = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    const e2 = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    expect(e1.serializedAt).toBe(e2.serializedAt);
  });
});

// ─── T51.5 — payload is valid JSON ───────────────────────────────────────────

describe("T51.5 — serializeSnapshotLogExport: payload is valid JSON", () => {
  let envelope: SnapshotExportSerializedEnvelope;
  let parsed: Record<string, unknown>;

  beforeAll(() => {
    envelope = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    parsed = JSON.parse(envelope.payload) as Record<string, unknown>;
  });

  it("T51.5.1 JSON.parse(envelope.payload) does not throw", () => {
    expect(() => JSON.parse(envelope.payload)).not.toThrow();
  });

  it("T51.5.2 parsed payload has exporterVersion field", () => {
    expect(parsed).toHaveProperty("exporterVersion");
  });

  it("T51.5.3 parsed payload has totalRecords field", () => {
    expect(parsed).toHaveProperty("totalRecords");
  });

  it("T51.5.4 parsed payload has records array", () => {
    expect(Array.isArray(parsed["records"])).toBe(true);
  });
});

// ─── T51.6 — payload round-trip fidelity (single-record) ─────────────────────

describe("T51.6 — serializeSnapshotLogExport: payload round-trip (single export)", () => {
  let parsedPayload: SnapshotLogExport;

  beforeAll(() => {
    const envelope = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    parsedPayload = JSON.parse(envelope.payload) as SnapshotLogExport;
  });

  it("T51.6.1 parsedPayload.totalRecords === singleExport.totalRecords", () => {
    expect(parsedPayload.totalRecords).toBe(singleExport.totalRecords);
  });

  it("T51.6.2 parsedPayload.exportedAt === singleExport.exportedAt", () => {
    expect(parsedPayload.exportedAt).toBe(singleExport.exportedAt);
  });

  it("T51.6.3 parsedPayload.exporterVersion === singleExport.exporterVersion", () => {
    expect(parsedPayload.exporterVersion).toBe(singleExport.exporterVersion);
  });

  it("T51.6.4 parsedPayload.records.length === singleExport.records.length", () => {
    expect(parsedPayload.records.length).toBe(singleExport.records.length);
  });
});

// ─── T51.7 — payload round-trip fidelity (multi-record) ──────────────────────

describe("T51.7 — serializeSnapshotLogExport: payload round-trip (multi-record export)", () => {
  let parsedPayload: SnapshotLogExport;

  beforeAll(() => {
    const envelope = serializeSnapshotLogExport(multiExport, FIXED_SERIALIZED_AT);
    parsedPayload = JSON.parse(envelope.payload) as SnapshotLogExport;
  });

  it("T51.7.1 parsedPayload.records.length === 3", () => {
    expect(parsedPayload.records.length).toBe(3);
  });

  it("T51.7.2 parsedPayload.symbols is an array", () => {
    expect(Array.isArray(parsedPayload.symbols)).toBe(true);
  });

  it("T51.7.3 parsedPayload.statuses is an array", () => {
    expect(Array.isArray(parsedPayload.statuses)).toBe(true);
  });

  it("T51.7.4 parsedPayload.governanceSummary.allEnterAlphaScoreFalse === true", () => {
    expect(parsedPayload.governanceSummary.allEnterAlphaScoreFalse).toBe(true);
  });
});

// ─── T51.8 — Empty export ─────────────────────────────────────────────────────

describe("T51.8 — serializeSnapshotLogExport: empty export", () => {
  let envelope: SnapshotExportSerializedEnvelope;
  let parsedPayload: SnapshotLogExport;

  beforeAll(() => {
    envelope = serializeSnapshotLogExport(emptyExport, FIXED_SERIALIZED_AT);
    parsedPayload = JSON.parse(envelope.payload) as SnapshotLogExport;
  });

  it("T51.8.1 empty export: parsedPayload.totalRecords === 0", () => {
    expect(parsedPayload.totalRecords).toBe(0);
  });

  it("T51.8.2 empty export: parsedPayload.records is empty array", () => {
    expect(parsedPayload.records.length).toBe(0);
  });

  it("T51.8.3 empty export: payload is valid JSON", () => {
    expect(() => JSON.parse(envelope.payload)).not.toThrow();
  });
});

// ─── T51.9 — Determinism ─────────────────────────────────────────────────────

describe("T51.9 — serializeSnapshotLogExport: determinism", () => {
  it("T51.9.1 same export + fixedSerializedAt → identical payload strings", () => {
    const e1 = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    const e2 = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    expect(e1.payload).toBe(e2.payload);
  });

  it("T51.9.2 same export + fixedSerializedAt → identical envelopes", () => {
    const e1 = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    const e2 = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    expect(e1).toEqual(e2);
  });

  it("T51.9.3 different fixedSerializedAt → different serializedAt", () => {
    const e1 = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    const e2 = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT_2);
    expect(e1.serializedAt).not.toBe(e2.serializedAt);
  });

  it("T51.9.4 different fixedSerializedAt → same payload (payload is export-derived only)", () => {
    const e1 = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT);
    const e2 = serializeSnapshotLogExport(singleExport, FIXED_SERIALIZED_AT_2);
    expect(e1.payload).toBe(e2.payload);
  });
});

// ─── T51.10 — Public index re-exports ────────────────────────────────────────

describe("T51.10 — serializeSnapshotLogExport: public index re-exports", () => {
  it("T51.10.1 SNAPSHOT_EXPORT_SERIALIZER_VERSION from index equals direct import", () => {
    expect(IDX_SERIALIZER_VERSION).toBe(SNAPSHOT_EXPORT_SERIALIZER_VERSION);
  });

  it("T51.10.2 serializeSnapshotLogExport from index is a function", () => {
    expect(typeof idxSerialize).toBe("function");
  });

  it("T51.10.3 index-imported serialize returns correct serializerVersion", () => {
    const envelope = idxSerialize(singleExport, FIXED_SERIALIZED_AT);
    expect(envelope.serializerVersion).toBe(SNAPSHOT_EXPORT_SERIALIZER_VERSION);
  });

  it("T51.10.4 index-imported serialize: schemaVersion === \"snapshot-log-export-v0\"", () => {
    const envelope = idxSerialize(singleExport, FIXED_SERIALIZED_AT);
    expect(envelope.schemaVersion).toBe("snapshot-log-export-v0");
  });
});
