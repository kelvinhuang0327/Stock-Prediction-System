/**
 * P44 — Axis A Controlled Research Snapshot Emitter v0 Tests
 *
 * Tests for SnapshotEmitter — combines readSnapshot() and formatSnapshotReadout()
 * into a single pure emission call: emitSnapshot(snapshot, fixedReadoutAt?).
 * All tests are pure unit tests — no DB, no Prisma, no network, no side effects.
 *
 * Proves:
 *   T44.1  emitSnapshot returns both readout and formatted
 *   T44.2  readout field equals what readSnapshot() produces independently
 *   T44.3  formatted field equals what formatSnapshotReadout(readout) produces independently
 *   T44.4  Emitter is deterministic — same inputs produce same EmitResult
 *   T44.5  SNAPSHOT_EMITTER_VERSION is exported and is a non-empty string
 *   T44.6  readout governance invariants are intact in EmitResult
 *   T44.7  formatted output contains SNAPSHOT_FORMATTER_VERSION (formatter ran)
 *   T44.8  fixedReadoutAt propagates correctly through to readout.readoutAt
 *   T44.9  EmitResult works across all four readiness states
 *   T44.10 No SNAPSHOT_FORBIDDEN_FIELDS appear as label keys in formatted output
 *
 * DISCLAIMER: Test suite for Axis A research snapshot emitter governance only.
 * entersAlphaScore = false. ALWAYS. Not investment advice.
 * No buy/sell/hold semantics. No scoring formula access.
 */

import {
  SNAPSHOT_EMITTER_VERSION,
  emitSnapshot,
  type EmitResult,
} from "@/lib/research/snapshot/v0/SnapshotEmitter";

import {
  SNAPSHOT_FORMATTER_VERSION,
} from "@/lib/research/snapshot/v0/SnapshotFormatter";

import {
  readSnapshot,
} from "@/lib/research/snapshot/v0/SnapshotReader";

import {
  formatSnapshotReadout,
} from "@/lib/research/snapshot/v0/SnapshotFormatter";

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
const FIXED_READOUT_AT_ALT = "2026-05-25T03:00:00.000Z";
const PAST_DATE = "2026-05-01";
const FUTURE_DATE = "2099-12-31";
const TEST_SYMBOL = "2330";

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
    sourceTrace: "p44-test-mr",
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
    sourceTrace: "p44-test-quote",
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
    sourceTrace: "p44-test-regime",
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
    sourceTrace: "p44-test-mr-blocked",
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
    sourceTrace: "p44-test-quote-audit-only",
  };
}

function buildBaseInput(overrides: Partial<SnapshotBuildInput> = {}): SnapshotBuildInput {
  return {
    symbol: TEST_SYMBOL,
    asOfDate: PAST_DATE,
    sourceTrace: "p44-test-suite",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    ...overrides,
  };
}

function makeReadySnapshot() {
  return buildControlledResearchSnapshot(
    buildBaseInput({
      monthlyRevenueFacts: makeEligibleMRFacts(),
      quoteFacts: makeEligibleQuoteFacts(),
      regimeFacts: makeEligibleRegimeFacts(),
    })
  );
}

function makeBlockedSnapshot() {
  return buildControlledResearchSnapshot(
    buildBaseInput({
      monthlyRevenueFacts: makeBlockedMRFacts(),
    })
  );
}

function makePartialSnapshot() {
  return buildControlledResearchSnapshot(
    buildBaseInput({
      monthlyRevenueFacts: makeEligibleMRFacts(),
      quoteFacts: makeAuditOnlyQuoteFacts(),
      regimeFacts: makeEligibleRegimeFacts(),
    })
  );
}

function makePitBlockedSnapshot() {
  return buildControlledResearchSnapshot(
    buildBaseInput({
      asOfDate: FUTURE_DATE,
      monthlyRevenueFacts: makeEligibleMRFacts(),
      quoteFacts: makeEligibleQuoteFacts(),
      regimeFacts: makeEligibleRegimeFacts(),
    })
  );
}

// ─── T44.1 — emitSnapshot returns both readout and formatted ─────────────────

describe("T44.1 — emitSnapshot returns both readout and formatted", () => {
  let result: EmitResult;

  beforeAll(() => {
    result = emitSnapshot(makeReadySnapshot(), FIXED_READOUT_AT);
  });

  it("T44.1.1 result has readout property", () => {
    expect(result).toHaveProperty("readout");
  });

  it("T44.1.2 result has formatted property", () => {
    expect(result).toHaveProperty("formatted");
  });

  it("T44.1.3 readout is a non-null object", () => {
    expect(result.readout).toBeDefined();
    expect(typeof result.readout).toBe("object");
    expect(result.readout).not.toBeNull();
  });

  it("T44.1.4 formatted is a non-empty string", () => {
    expect(typeof result.formatted).toBe("string");
    expect(result.formatted.length).toBeGreaterThan(0);
  });
});

// ─── T44.2 — readout matches readSnapshot() independently ────────────────────

describe("T44.2 — readout field matches independent readSnapshot() call", () => {
  let result: EmitResult;
  let independentReadout: ReturnType<typeof readSnapshot>;

  beforeAll(() => {
    const snapshot = makeReadySnapshot();
    result = emitSnapshot(snapshot, FIXED_READOUT_AT);
    independentReadout = readSnapshot(snapshot, FIXED_READOUT_AT);
  });

  it("T44.2.1 symbol matches", () => {
    expect(result.readout.symbol).toBe(independentReadout.symbol);
  });

  it("T44.2.2 asOfDate matches", () => {
    expect(result.readout.asOfDate).toBe(independentReadout.asOfDate);
  });

  it("T44.2.3 researchReadinessStatus matches", () => {
    expect(result.readout.researchReadinessStatus).toBe(independentReadout.researchReadinessStatus);
  });

  it("T44.2.4 eligibleSources matches", () => {
    expect(result.readout.eligibleSources).toEqual(independentReadout.eligibleSources);
  });

  it("T44.2.5 readoutAt matches", () => {
    expect(result.readout.readoutAt).toBe(independentReadout.readoutAt);
  });

  it("T44.2.6 invariantsValid matches", () => {
    expect(result.readout.invariantsValid).toBe(independentReadout.invariantsValid);
  });
});

// ─── T44.3 — formatted matches formatSnapshotReadout(readout) independently ──

describe("T44.3 — formatted field matches independent formatSnapshotReadout() call", () => {
  let result: EmitResult;
  let independentFormatted: string;

  beforeAll(() => {
    const snapshot = makeReadySnapshot();
    result = emitSnapshot(snapshot, FIXED_READOUT_AT);
    const independentReadout = readSnapshot(snapshot, FIXED_READOUT_AT);
    independentFormatted = formatSnapshotReadout(independentReadout);
  });

  it("T44.3.1 formatted equals independent formatSnapshotReadout output", () => {
    expect(result.formatted).toBe(independentFormatted);
  });
});

// ─── T44.4 — Emitter is deterministic ────────────────────────────────────────

describe("T44.4 — emitSnapshot is deterministic with same inputs", () => {
  it("T44.4.1 same snapshot + same fixedReadoutAt produces identical formatted", () => {
    const snapshot = makeReadySnapshot();
    const result1 = emitSnapshot(snapshot, FIXED_READOUT_AT);
    const result2 = emitSnapshot(snapshot, FIXED_READOUT_AT);
    expect(result1.formatted).toBe(result2.formatted);
  });

  it("T44.4.2 same snapshot + same fixedReadoutAt produces identical readoutAt", () => {
    const snapshot = makeReadySnapshot();
    const result1 = emitSnapshot(snapshot, FIXED_READOUT_AT);
    const result2 = emitSnapshot(snapshot, FIXED_READOUT_AT);
    expect(result1.readout.readoutAt).toBe(result2.readout.readoutAt);
  });

  it("T44.4.3 different fixedReadoutAt produces different readoutAt", () => {
    const snapshot = makeReadySnapshot();
    const result1 = emitSnapshot(snapshot, FIXED_READOUT_AT);
    const result2 = emitSnapshot(snapshot, FIXED_READOUT_AT_ALT);
    expect(result1.readout.readoutAt).not.toBe(result2.readout.readoutAt);
  });
});

// ─── T44.5 — SNAPSHOT_EMITTER_VERSION is exported and valid ──────────────────

describe("T44.5 — SNAPSHOT_EMITTER_VERSION export", () => {
  it("T44.5.1 SNAPSHOT_EMITTER_VERSION is a non-empty string", () => {
    expect(typeof SNAPSHOT_EMITTER_VERSION).toBe("string");
    expect(SNAPSHOT_EMITTER_VERSION.length).toBeGreaterThan(0);
  });

  it("T44.5.2 SNAPSHOT_EMITTER_VERSION contains 'p44'", () => {
    expect(SNAPSHOT_EMITTER_VERSION).toContain("p44");
  });

  it("T44.5.3 SNAPSHOT_EMITTER_VERSION contains 'emitter'", () => {
    expect(SNAPSHOT_EMITTER_VERSION).toContain("emitter");
  });
});

// ─── T44.6 — Governance invariants intact in EmitResult ──────────────────────

describe("T44.6 — readout governance invariants intact in EmitResult", () => {
  let result: EmitResult;

  beforeAll(() => {
    result = emitSnapshot(makeReadySnapshot(), FIXED_READOUT_AT);
  });

  it("T44.6.1 readout.entersAlphaScore === false", () => {
    expect(result.readout.entersAlphaScore).toBe(false);
  });

  it("T44.6.2 readout.paperOnly === true", () => {
    expect(result.readout.paperOnly).toBe(true);
  });

  it("T44.6.3 readout.dryRun === true", () => {
    expect(result.readout.dryRun).toBe(true);
  });

  it("T44.6.4 readout.notInvestmentRecommendation === true", () => {
    expect(result.readout.notInvestmentRecommendation).toBe(true);
  });

  it("T44.6.5 readout.invariantsValid === true for ready snapshot", () => {
    expect(result.readout.invariantsValid).toBe(true);
  });

  it("T44.6.6 readout.disclaimer is a non-empty string", () => {
    expect(typeof result.readout.disclaimer).toBe("string");
    expect(result.readout.disclaimer.length).toBeGreaterThan(0);
  });
});

// ─── T44.7 — formatted contains SNAPSHOT_FORMATTER_VERSION ───────────────────

describe("T44.7 — formatted output contains SNAPSHOT_FORMATTER_VERSION", () => {
  let result: EmitResult;

  beforeAll(() => {
    result = emitSnapshot(makeReadySnapshot(), FIXED_READOUT_AT);
  });

  it("T44.7.1 formatted contains SNAPSHOT_FORMATTER_VERSION string", () => {
    expect(result.formatted).toContain(SNAPSHOT_FORMATTER_VERSION);
  });

  it("T44.7.2 formatted contains 'Axis A Research Snapshot' header", () => {
    expect(result.formatted).toContain("Axis A Research Snapshot");
  });
});

// ─── T44.8 — fixedReadoutAt propagates to readout.readoutAt ──────────────────

describe("T44.8 — fixedReadoutAt propagates correctly to readout.readoutAt", () => {
  it("T44.8.1 readout.readoutAt equals fixedReadoutAt when provided", () => {
    const result = emitSnapshot(makeReadySnapshot(), FIXED_READOUT_AT);
    expect(result.readout.readoutAt).toBe(FIXED_READOUT_AT);
  });

  it("T44.8.2 readout.readoutAt equals FIXED_READOUT_AT_ALT when alt provided", () => {
    const result = emitSnapshot(makeReadySnapshot(), FIXED_READOUT_AT_ALT);
    expect(result.readout.readoutAt).toBe(FIXED_READOUT_AT_ALT);
  });

  it("T44.8.3 readout.readoutAt is a valid ISO string when fixedReadoutAt provided", () => {
    const result = emitSnapshot(makeReadySnapshot(), FIXED_READOUT_AT);
    expect(() => new Date(result.readout.readoutAt)).not.toThrow();
    expect(isNaN(new Date(result.readout.readoutAt).getTime())).toBe(false);
  });
});

// ─── T44.9 — EmitResult works across all four readiness states ───────────────

const readinessStateFixtures: Array<{
  label: string;
  makeSnapshot: () => ReturnType<typeof buildControlledResearchSnapshot>;
  expectedStatus: string;
}> = [
  {
    label: "SNAPSHOT_READY",
    makeSnapshot: makeReadySnapshot,
    expectedStatus: "SNAPSHOT_READY",
  },
  {
    label: "SNAPSHOT_PARTIAL",
    makeSnapshot: makePartialSnapshot,
    expectedStatus: "SNAPSHOT_PARTIAL",
  },
  {
    label: "SNAPSHOT_BLOCKED",
    makeSnapshot: makeBlockedSnapshot,
    expectedStatus: "SNAPSHOT_BLOCKED",
  },
  {
    label: "SNAPSHOT_BLOCKED_PIT",
    makeSnapshot: makePitBlockedSnapshot,
    expectedStatus: "SNAPSHOT_BLOCKED_PIT",
  },
];

describe("T44.9 — EmitResult across all four readiness states", () => {
  readinessStateFixtures.forEach(({ label, makeSnapshot, expectedStatus }) => {
    describe(`T44.9 — ${label}`, () => {
      let result: EmitResult;

      beforeAll(() => {
        result = emitSnapshot(makeSnapshot(), FIXED_READOUT_AT);
      });

      it(`T44.9.1 [${label}] readout.researchReadinessStatus === "${expectedStatus}"`, () => {
        expect(result.readout.researchReadinessStatus).toBe(expectedStatus);
      });

      it(`T44.9.2 [${label}] formatted contains "${expectedStatus}"`, () => {
        expect(result.formatted).toContain(expectedStatus);
      });

      it(`T44.9.3 [${label}] readout.entersAlphaScore === false`, () => {
        expect(result.readout.entersAlphaScore).toBe(false);
      });

      it(`T44.9.4 [${label}] readout.paperOnly === true`, () => {
        expect(result.readout.paperOnly).toBe(true);
      });

      it(`T44.9.5 [${label}] formatted is non-empty string`, () => {
        expect(typeof result.formatted).toBe("string");
        expect(result.formatted.length).toBeGreaterThan(0);
      });

      it(`T44.9.6 [${label}] readout and formatted are consistent (status in both)`, () => {
        expect(result.formatted).toContain(result.readout.researchReadinessStatus);
      });
    });
  });
});

// ─── T44.10 — No SNAPSHOT_FORBIDDEN_FIELDS appear as label keys in formatted ─

describe("T44.10 — No SNAPSHOT_FORBIDDEN_FIELDS appear as label keys in formatted", () => {
  let result: EmitResult;

  beforeAll(() => {
    result = emitSnapshot(makeReadySnapshot(), FIXED_READOUT_AT);
  });

  SNAPSHOT_FORBIDDEN_FIELDS.forEach((field) => {
    it(`T44.10 — "${field}" does NOT appear as a label key in formatted output`, () => {
      // Check the lowercase-key label format: "  fieldname      : "
      const labelPattern = `${field.toLowerCase()} `;
      const lowerOutput = result.formatted.toLowerCase();
      // Forbidden field should not appear as a label prefix (key + colon)
      const colonIdx = lowerOutput.indexOf(`${field.toLowerCase()}:`);
      // It is acceptable if the field name appears as part of other text (e.g. in disclaimer)
      // but must not appear as a standalone label key followed by ":"
      const labelIdx = lowerOutput.indexOf(labelPattern);
      if (labelIdx !== -1) {
        // Found the pattern — check there is no ":" following it within 5 chars
        const afterLabel = lowerOutput.slice(labelIdx + labelPattern.length, labelIdx + labelPattern.length + 5);
        expect(afterLabel).not.toMatch(/^[\s]*:/);
      }
      // Also: must not appear as direct key:value (no space before colon)
      expect(colonIdx).toBe(-1);
    });
  });
});
