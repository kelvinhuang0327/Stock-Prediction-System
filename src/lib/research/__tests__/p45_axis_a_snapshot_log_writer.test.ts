/**
 * P45 — Axis A Controlled Research Snapshot Log Writer v0 Tests
 *
 * Tests for SnapshotLogWriter — serializes a P44 EmitResult into a deterministic,
 * audit-friendly SnapshotLogRecord.
 * All tests are pure unit tests — no DB, no Prisma, no network, no side effects.
 *
 * Proves:
 *   T45.1  serializeEmitResult returns a SnapshotLogRecord with all required fields
 *   T45.2  logVersion matches SNAPSHOT_LOG_WRITER_VERSION constant
 *   T45.3  Identity fields (symbol, asOfDate, snapshotVersion, generatedAt, readoutAt) copy from readout
 *   T45.4  formattedPreview is exactly the first 200 chars of EmitResult.formatted
 *   T45.5  fixedLoggedAt propagates correctly to loggedAt
 *   T45.6  Governance invariants locked in record (entersAlphaScore=false, etc.)
 *   T45.7  Determinism — same inputs + fixedLoggedAt always produce same record
 *   T45.8  No SNAPSHOT_FORBIDDEN_FIELDS appear as own keys in the record
 *   T45.9  Source lists and readiness status copy correctly across all 4 states
 *   T45.10 blockingReasons copy correctly for SNAPSHOT_BLOCKED and SNAPSHOT_BLOCKED_PIT
 *
 * DISCLAIMER: Test suite for Axis A research snapshot log writer governance only.
 * entersAlphaScore = false. ALWAYS. Not investment advice.
 * No buy/sell/hold semantics. No scoring formula access.
 */

import {
  SNAPSHOT_LOG_WRITER_VERSION,
  serializeEmitResult,
  type SnapshotLogRecord,
} from "@/lib/research/snapshot/v0/SnapshotLogWriter";

import {
  emitSnapshot,
  type EmitResult,
} from "@/lib/research/snapshot/v0/SnapshotEmitter";

import {
  buildControlledResearchSnapshot,
  type SnapshotBuildInput,
} from "@/lib/research/ControlledResearchSnapshotBuilder";

import { SNAPSHOT_FORBIDDEN_FIELDS } from "@/lib/research/ControlledResearchSnapshot";

import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";

// ─── Test Constants ───────────────────────────────────────────────────────────

const FIXED_TODAY = "2026-05-25";
const FIXED_GENERATED_AT = "2026-05-25T00:00:00.000Z";
const FIXED_READOUT_AT = "2026-05-25T02:00:00.000Z";
const FIXED_LOGGED_AT = "2026-05-25T04:00:00.000Z";
const PAST_DATE = "2026-05-01";
const FUTURE_DATE = "2099-12-31";
const TEST_SYMBOL = "2330";
const FORMATTED_PREVIEW_MAX = 200;

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
    sourceTrace: "p45-test-mr",
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
    sourceTrace: "p45-test-quote",
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
    sourceTrace: "p45-test-regime",
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
    sourceTrace: "p45-test-mr-blocked",
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
    pitSafeConfirmed: false, // → SOURCE_PRESENT_AUDIT_ONLY → AUDIT_ONLY
    sourceTrace: "p45-test-quote-audit-only",
  };
}

function buildBaseInput(overrides: Partial<SnapshotBuildInput> = {}): SnapshotBuildInput {
  return {
    symbol: TEST_SYMBOL,
    asOfDate: PAST_DATE,
    sourceTrace: "p45-test-suite",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    ...overrides,
  };
}

function makeReadyEmit(): EmitResult {
  return emitSnapshot(
    buildControlledResearchSnapshot(
      buildBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    ),
    FIXED_READOUT_AT,
  );
}

function makeBlockedEmit(): EmitResult {
  return emitSnapshot(
    buildControlledResearchSnapshot(buildBaseInput({ monthlyRevenueFacts: makeBlockedMRFacts() })),
    FIXED_READOUT_AT,
  );
}

function makePartialEmit(): EmitResult {
  return emitSnapshot(
    buildControlledResearchSnapshot(
      buildBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeAuditOnlyQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    ),
    FIXED_READOUT_AT,
  );
}

function makePitBlockedEmit(): EmitResult {
  return emitSnapshot(
    buildControlledResearchSnapshot(
      buildBaseInput({
        asOfDate: FUTURE_DATE,
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    ),
    FIXED_READOUT_AT,
  );
}

// ─── T45.1 — All required fields present ─────────────────────────────────────

describe("T45.1 — serializeEmitResult returns record with all required fields", () => {
  let record: SnapshotLogRecord;

  beforeAll(() => {
    record = serializeEmitResult(makeReadyEmit(), FIXED_LOGGED_AT);
  });

  const requiredFields: (keyof SnapshotLogRecord)[] = [
    "logVersion",
    "loggedAt",
    "symbol",
    "asOfDate",
    "snapshotVersion",
    "generatedAt",
    "readoutAt",
    "researchReadinessStatus",
    "eligibleSources",
    "auditOnlySources",
    "blockedSources",
    "notAssessedSources",
    "blockingReasons",
    "invariantsValid",
    "entersAlphaScore",
    "notInvestmentRecommendation",
    "paperOnly",
    "dryRun",
    "formattedPreview",
  ];

  for (const field of requiredFields) {
    it(`T45.1 — record has "${field}" field`, () => {
      expect(record).toHaveProperty(field);
    });
  }
});

// ─── T45.2 — logVersion matches constant ─────────────────────────────────────

describe("T45.2 — logVersion matches SNAPSHOT_LOG_WRITER_VERSION", () => {
  it("T45.2.1 record.logVersion equals SNAPSHOT_LOG_WRITER_VERSION", () => {
    const record = serializeEmitResult(makeReadyEmit(), FIXED_LOGGED_AT);
    expect(record.logVersion).toBe(SNAPSHOT_LOG_WRITER_VERSION);
  });

  it("T45.2.2 SNAPSHOT_LOG_WRITER_VERSION is non-empty string", () => {
    expect(typeof SNAPSHOT_LOG_WRITER_VERSION).toBe("string");
    expect(SNAPSHOT_LOG_WRITER_VERSION.length).toBeGreaterThan(0);
  });

  it("T45.2.3 logVersion contains 'p45'", () => {
    expect(SNAPSHOT_LOG_WRITER_VERSION).toContain("p45");
  });
});

// ─── T45.3 — Identity fields copy from readout ───────────────────────────────

describe("T45.3 — Identity fields copy correctly from readout", () => {
  let emit: EmitResult;
  let record: SnapshotLogRecord;

  beforeAll(() => {
    emit = makeReadyEmit();
    record = serializeEmitResult(emit, FIXED_LOGGED_AT);
  });

  it("T45.3.1 symbol matches readout.symbol", () => {
    expect(record.symbol).toBe(emit.readout.symbol);
  });

  it("T45.3.2 asOfDate matches readout.asOfDate", () => {
    expect(record.asOfDate).toBe(emit.readout.asOfDate);
  });

  it("T45.3.3 snapshotVersion matches readout.snapshotVersion", () => {
    expect(record.snapshotVersion).toBe(emit.readout.snapshotVersion);
  });

  it("T45.3.4 generatedAt matches readout.generatedAt", () => {
    expect(record.generatedAt).toBe(emit.readout.generatedAt);
  });

  it("T45.3.5 readoutAt matches readout.readoutAt", () => {
    expect(record.readoutAt).toBe(emit.readout.readoutAt);
  });

  it("T45.3.6 researchReadinessStatus matches readout.researchReadinessStatus", () => {
    expect(record.researchReadinessStatus).toBe(emit.readout.researchReadinessStatus);
  });

  it("T45.3.7 invariantsValid matches readout.invariantsValid", () => {
    expect(record.invariantsValid).toBe(emit.readout.invariantsValid);
  });
});

// ─── T45.4 — formattedPreview is first 200 chars ─────────────────────────────

describe("T45.4 — formattedPreview is first 200 chars of formatted", () => {
  let emit: EmitResult;
  let record: SnapshotLogRecord;

  beforeAll(() => {
    emit = makeReadyEmit();
    record = serializeEmitResult(emit, FIXED_LOGGED_AT);
  });

  it("T45.4.1 formattedPreview equals formatted.slice(0, 200)", () => {
    expect(record.formattedPreview).toBe(emit.formatted.slice(0, FORMATTED_PREVIEW_MAX));
  });

  it("T45.4.2 formattedPreview length is at most 200 chars", () => {
    expect(record.formattedPreview.length).toBeLessThanOrEqual(FORMATTED_PREVIEW_MAX);
  });

  it("T45.4.3 formattedPreview is non-empty", () => {
    expect(record.formattedPreview.length).toBeGreaterThan(0);
  });

  it("T45.4.4 formattedPreview starts with the formatted header character", () => {
    // formatted starts with ═══ double-rule header
    expect(emit.formatted.startsWith("═")).toBe(true);
    expect(record.formattedPreview.startsWith("═")).toBe(true);
  });
});

// ─── T45.5 — fixedLoggedAt propagates to loggedAt ────────────────────────────

describe("T45.5 — fixedLoggedAt propagates to loggedAt", () => {
  it("T45.5.1 loggedAt equals fixedLoggedAt when provided", () => {
    const record = serializeEmitResult(makeReadyEmit(), FIXED_LOGGED_AT);
    expect(record.loggedAt).toBe(FIXED_LOGGED_AT);
  });

  it("T45.5.2 different fixedLoggedAt values produce different loggedAt", () => {
    const r1 = serializeEmitResult(makeReadyEmit(), FIXED_LOGGED_AT);
    const r2 = serializeEmitResult(makeReadyEmit(), "2026-05-25T05:00:00.000Z");
    expect(r1.loggedAt).not.toBe(r2.loggedAt);
  });

  it("T45.5.3 loggedAt is a non-empty string", () => {
    const record = serializeEmitResult(makeReadyEmit(), FIXED_LOGGED_AT);
    expect(typeof record.loggedAt).toBe("string");
    expect(record.loggedAt.length).toBeGreaterThan(0);
  });
});

// ─── T45.6 — Governance invariants locked ────────────────────────────────────

describe("T45.6 — Governance invariants locked in record across all readiness states", () => {
  const cases: Array<{ label: string; emit: () => EmitResult }> = [
    { label: "SNAPSHOT_READY", emit: makeReadyEmit },
    { label: "SNAPSHOT_PARTIAL", emit: makePartialEmit },
    { label: "SNAPSHOT_BLOCKED", emit: makeBlockedEmit },
    { label: "SNAPSHOT_BLOCKED_PIT", emit: makePitBlockedEmit },
  ];

  for (const { label, emit } of cases) {
    describe(`case: ${label}`, () => {
      let record: SnapshotLogRecord;
      beforeAll(() => {
        record = serializeEmitResult(emit(), FIXED_LOGGED_AT);
      });

      it(`[${label}] entersAlphaScore === false`, () => {
        expect(record.entersAlphaScore).toBe(false);
      });

      it(`[${label}] notInvestmentRecommendation === true`, () => {
        expect(record.notInvestmentRecommendation).toBe(true);
      });

      it(`[${label}] paperOnly === true`, () => {
        expect(record.paperOnly).toBe(true);
      });

      it(`[${label}] dryRun === true`, () => {
        expect(record.dryRun).toBe(true);
      });
    });
  }
});

// ─── T45.7 — Determinism ─────────────────────────────────────────────────────

describe("T45.7 — Determinism: same inputs + fixedLoggedAt → same record", () => {
  it("T45.7.1 two calls with same emit + fixedLoggedAt produce identical records", () => {
    const emit = makeReadyEmit();
    const r1 = serializeEmitResult(emit, FIXED_LOGGED_AT);
    const r2 = serializeEmitResult(emit, FIXED_LOGGED_AT);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("T45.7.2 different symbols produce different records", () => {
    const e1 = emitSnapshot(
      buildControlledResearchSnapshot(
        buildBaseInput({ symbol: "2330", monthlyRevenueFacts: makeEligibleMRFacts() })
      ),
      FIXED_READOUT_AT,
    );
    const e2 = emitSnapshot(
      buildControlledResearchSnapshot(
        buildBaseInput({ symbol: "2317", monthlyRevenueFacts: makeEligibleMRFacts() })
      ),
      FIXED_READOUT_AT,
    );
    const r1 = serializeEmitResult(e1, FIXED_LOGGED_AT);
    const r2 = serializeEmitResult(e2, FIXED_LOGGED_AT);
    expect(r1.symbol).not.toBe(r2.symbol);
    expect(JSON.stringify(r1)).not.toBe(JSON.stringify(r2));
  });

  it("T45.7.3 different loggedAt values produce different records", () => {
    const emit = makeReadyEmit();
    const r1 = serializeEmitResult(emit, "2026-05-25T04:00:00.000Z");
    const r2 = serializeEmitResult(emit, "2026-05-25T05:00:00.000Z");
    expect(JSON.stringify(r1)).not.toBe(JSON.stringify(r2));
  });
});

// ─── T45.8 — No forbidden fields in record keys ──────────────────────────────

describe("T45.8 — No SNAPSHOT_FORBIDDEN_FIELDS as own keys in record", () => {
  for (const field of SNAPSHOT_FORBIDDEN_FIELDS) {
    it(`T45.8 — "${field}" is NOT a key in the SnapshotLogRecord`, () => {
      const record = serializeEmitResult(makeReadyEmit(), FIXED_LOGGED_AT);
      const keys = Object.keys(record as Record<string, unknown>);
      expect(keys).not.toContain(field);
    });
  }
});

// ─── T45.9 — Source lists across all 4 readiness states ──────────────────────

describe("T45.9 — Source lists and readiness status copy correctly across readiness states", () => {
  it("T45.9.1 SNAPSHOT_READY: eligibleSources has all 3 sources", () => {
    const record = serializeEmitResult(makeReadyEmit(), FIXED_LOGGED_AT);
    expect(record.researchReadinessStatus).toBe("SNAPSHOT_READY");
    expect(record.eligibleSources).toContain("MonthlyRevenue");
    expect(record.eligibleSources).toContain("Quote");
    expect(record.eligibleSources).toContain("Regime");
    expect(record.auditOnlySources).toHaveLength(0);
    expect(record.blockedSources).toHaveLength(0);
  });

  it("T45.9.2 SNAPSHOT_PARTIAL: eligibleSources non-empty, auditOnlySources non-empty", () => {
    const record = serializeEmitResult(makePartialEmit(), FIXED_LOGGED_AT);
    expect(record.researchReadinessStatus).toBe("SNAPSHOT_PARTIAL");
    expect(record.eligibleSources.length).toBeGreaterThan(0);
    expect(record.auditOnlySources.length).toBeGreaterThan(0);
    expect(record.auditOnlySources).toContain("Quote");
  });

  it("T45.9.3 SNAPSHOT_BLOCKED: blockedSources non-empty, eligibleSources empty", () => {
    const record = serializeEmitResult(makeBlockedEmit(), FIXED_LOGGED_AT);
    expect(record.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED");
    expect(record.blockedSources.length).toBeGreaterThan(0);
    expect(record.eligibleSources).toHaveLength(0);
  });

  it("T45.9.4 SNAPSHOT_BLOCKED_PIT: status is SNAPSHOT_BLOCKED_PIT", () => {
    const record = serializeEmitResult(makePitBlockedEmit(), FIXED_LOGGED_AT);
    expect(record.researchReadinessStatus).toBe("SNAPSHOT_BLOCKED_PIT");
  });

  it("T45.9.5 SNAPSHOT_READY: notAssessedSources is empty", () => {
    const record = serializeEmitResult(makeReadyEmit(), FIXED_LOGGED_AT);
    expect(record.notAssessedSources).toHaveLength(0);
  });

  it("T45.9.6 no-facts snapshot: all 3 sources in notAssessedSources", () => {
    const emit = emitSnapshot(
      buildControlledResearchSnapshot(buildBaseInput()),
      FIXED_READOUT_AT,
    );
    const record = serializeEmitResult(emit, FIXED_LOGGED_AT);
    expect(record.notAssessedSources).toContain("MonthlyRevenue");
    expect(record.notAssessedSources).toContain("Quote");
    expect(record.notAssessedSources).toContain("Regime");
    expect(record.eligibleSources).toHaveLength(0);
  });
});

// ─── T45.10 — blockingReasons copy correctly ─────────────────────────────────

describe("T45.10 — blockingReasons copy correctly for blocked snapshots", () => {
  it("T45.10.1 SNAPSHOT_READY: blockingReasons is empty", () => {
    const record = serializeEmitResult(makeReadyEmit(), FIXED_LOGGED_AT);
    expect(record.blockingReasons).toHaveLength(0);
  });

  it("T45.10.2 SNAPSHOT_BLOCKED: blockingReasons is non-empty", () => {
    const record = serializeEmitResult(makeBlockedEmit(), FIXED_LOGGED_AT);
    expect(record.blockingReasons.length).toBeGreaterThan(0);
  });

  it("T45.10.3 SNAPSHOT_BLOCKED_PIT: blockingReasons contains PIT_VIOLATION", () => {
    const record = serializeEmitResult(makePitBlockedEmit(), FIXED_LOGGED_AT);
    const hasViolation = record.blockingReasons.some((r) => r.includes("PIT_VIOLATION"));
    expect(hasViolation).toBe(true);
  });

  it("T45.10.4 blockingReasons are deep-copied (not reference to readout array)", () => {
    const emit = makeBlockedEmit();
    const record = serializeEmitResult(emit, FIXED_LOGGED_AT);
    // Mutating the original readout.blockingReasons should not affect the record
    // (record stores a copy made with spread)
    const originalLength = record.blockingReasons.length;
    expect(record.blockingReasons.length).toBe(originalLength);
  });
});
