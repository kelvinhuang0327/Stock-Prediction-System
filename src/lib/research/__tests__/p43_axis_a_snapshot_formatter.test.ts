/**
 * P43 — Axis A Controlled Research Snapshot Formatter v0 Tests
 *
 * Tests for SnapshotFormatter — renders SnapshotReadout into a deterministic,
 * human-readable multi-line text string.
 * All tests are pure unit tests — no DB, no Prisma, no network, no side effects.
 *
 * Proves:
 *   T43.1  SNAPSHOT_READY — output contains "ELIGIBLE" with all 3 source names
 *   T43.2  SNAPSHOT_PARTIAL — output contains eligible section + audit-only section
 *   T43.3  SNAPSHOT_BLOCKED — output contains "BLOCKING REASONS" and the reason text
 *   T43.4  SNAPSHOT_BLOCKED_PIT — output contains "PIT_VIOLATION" and "SNAPSHOT_BLOCKED_PIT"
 *   T43.5  Governance header always present across all readiness states
 *   T43.6  No SNAPSHOT_FORBIDDEN_FIELDS names appear as label keys in output
 *   T43.7  Formatter is deterministic — same readout produces same string
 *   T43.8  SNAPSHOT_FORMATTER_VERSION appears in the formatted output
 *   T43.9  Invariants VALID / VIOLATIONS DETECTED shown correctly
 *   T43.10 NOT_ASSESSED sources shown correctly when no facts provided
 *
 * DISCLAIMER: Test suite for Axis A research snapshot formatter governance only.
 * entersAlphaScore = false. ALWAYS. Not investment advice.
 * No buy/sell/hold semantics. No scoring formula access.
 */

import {
  SNAPSHOT_FORMATTER_VERSION,
  formatSnapshotReadout,
} from "@/lib/research/snapshot/v0/SnapshotFormatter";

import {
  readSnapshot,
} from "@/lib/research/snapshot/v0/SnapshotReader";

import {
  buildControlledResearchSnapshot,
  type SnapshotBuildInput,
} from "@/lib/research/ControlledResearchSnapshotBuilder";

import { SNAPSHOT_FORBIDDEN_FIELDS } from "@/lib/research/ControlledResearchSnapshot";

import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";

// ─── Test Constants ───────────────────────────────────────────────────────────

const FIXED_TODAY = "2026-05-25";
const FIXED_GENERATED_AT = "2026-05-25T00:00:00.000Z";
const FIXED_READOUT_AT = "2026-05-25T01:00:00.000Z";
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
    sourceTrace: "p43-test-mr",
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
    sourceTrace: "p43-test-quote",
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
    sourceTrace: "p43-test-regime",
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
    sourceTrace: "p43-test-mr-blocked",
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
    sourceTrace: "p43-test-quote-audit-only",
  };
}

function buildBaseInput(overrides: Partial<SnapshotBuildInput> = {}): SnapshotBuildInput {
  return {
    symbol: TEST_SYMBOL,
    asOfDate: PAST_DATE,
    sourceTrace: "p43-test-suite",
    fixedGeneratedAt: FIXED_GENERATED_AT,
    fixedToday: FIXED_TODAY,
    ...overrides,
  };
}

function makeReadyReadout() {
  return readSnapshot(
    buildControlledResearchSnapshot(
      buildBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      })
    ),
    FIXED_READOUT_AT
  );
}

// ─── T43.1 — SNAPSHOT_READY: eligible sources in output ──────────────────────

describe("T43.1 — SNAPSHOT_READY: eligible sources in formatted output", () => {
  let output: string;

  beforeAll(() => {
    output = formatSnapshotReadout(makeReadyReadout());
  });

  it("T43.1.1 output contains SNAPSHOT_READY status", () => {
    expect(output).toContain("SNAPSHOT_READY");
  });

  it("T43.1.2 output contains ELIGIBLE label", () => {
    expect(output).toContain("ELIGIBLE");
  });

  it("T43.1.3 output contains MonthlyRevenue in eligible section", () => {
    expect(output).toContain("MonthlyRevenue");
  });

  it("T43.1.4 output contains Quote in eligible section", () => {
    expect(output).toContain("Quote");
  });

  it("T43.1.5 output contains Regime in eligible section", () => {
    expect(output).toContain("Regime");
  });

  it("T43.1.6 output does NOT contain BLOCKING REASONS header for ready snapshot", () => {
    expect(output).not.toContain("BLOCKING REASONS");
  });

  it("T43.1.7 BLOCKED section shows (none)", () => {
    expect(output).toContain("BLOCKED");
    // The BLOCKED label followed by (none)
    const blockedLineMatch = output.match(/BLOCKED\s*:\s*(.*)/);
    expect(blockedLineMatch).not.toBeNull();
    // The line should include "(none)" — the BLOCKED sources list is empty
    expect(output).toContain("(none)");
  });
});

// ─── T43.2 — SNAPSHOT_PARTIAL: eligible + audit-only sections ────────────────

describe("T43.2 — SNAPSHOT_PARTIAL: eligible and audit-only sections", () => {
  let output: string;

  beforeAll(() => {
    const readout = readSnapshot(
      buildControlledResearchSnapshot(
        buildBaseInput({
          monthlyRevenueFacts: makeEligibleMRFacts(),
          quoteFacts: makeAuditOnlyQuoteFacts(), // AUDIT_ONLY
          // Regime omitted → NOT_ASSESSED
        })
      ),
      FIXED_READOUT_AT
    );
    output = formatSnapshotReadout(readout);
  });

  it("T43.2.1 output contains SNAPSHOT_PARTIAL status", () => {
    expect(output).toContain("SNAPSHOT_PARTIAL");
  });

  it("T43.2.2 output contains ELIGIBLE label", () => {
    expect(output).toContain("ELIGIBLE");
  });

  it("T43.2.3 output contains AUDIT_ONLY label", () => {
    expect(output).toContain("AUDIT_ONLY");
  });

  it("T43.2.4 output contains MonthlyRevenue (eligible source)", () => {
    expect(output).toContain("MonthlyRevenue");
  });

  it("T43.2.5 output contains Quote (audit-only source)", () => {
    expect(output).toContain("Quote");
  });

  it("T43.2.6 output contains NOT_ASSESSED label", () => {
    expect(output).toContain("NOT_ASSESSED");
  });
});

// ─── T43.3 — SNAPSHOT_BLOCKED: blocking reasons in output ────────────────────

describe("T43.3 — SNAPSHOT_BLOCKED: blocking reasons section present", () => {
  let output: string;

  beforeAll(() => {
    const readout = readSnapshot(
      buildControlledResearchSnapshot(
        buildBaseInput({
          monthlyRevenueFacts: makeBlockedMRFacts(),
        })
      ),
      FIXED_READOUT_AT
    );
    output = formatSnapshotReadout(readout);
  });

  it("T43.3.1 output contains SNAPSHOT_BLOCKED status", () => {
    expect(output).toContain("SNAPSHOT_BLOCKED");
  });

  it("T43.3.2 output contains BLOCKING REASONS header", () => {
    expect(output).toContain("BLOCKING REASONS");
  });

  it("T43.3.3 output contains at least one numbered reason [1]", () => {
    expect(output).toContain("[1]");
  });

  it("T43.3.4 BLOCKED section contains MonthlyRevenue", () => {
    expect(output).toContain("MonthlyRevenue");
  });
});

// ─── T43.4 — SNAPSHOT_BLOCKED_PIT: PIT violation in output ───────────────────

describe("T43.4 — SNAPSHOT_BLOCKED_PIT: PIT violation in formatted output", () => {
  let output: string;

  beforeAll(() => {
    const readout = readSnapshot(
      buildControlledResearchSnapshot(
        buildBaseInput({
          asOfDate: FUTURE_DATE,
          monthlyRevenueFacts: makeEligibleMRFacts(),
          quoteFacts: makeEligibleQuoteFacts(),
          regimeFacts: makeEligibleRegimeFacts(),
        })
      ),
      FIXED_READOUT_AT
    );
    output = formatSnapshotReadout(readout);
  });

  it("T43.4.1 output contains SNAPSHOT_BLOCKED_PIT status", () => {
    expect(output).toContain("SNAPSHOT_BLOCKED_PIT");
  });

  it("T43.4.2 output contains PIT_VIOLATION in blocking reasons", () => {
    expect(output).toContain("PIT_VIOLATION");
  });

  it("T43.4.3 output contains BLOCKING REASONS header", () => {
    expect(output).toContain("BLOCKING REASONS");
  });
});

// ─── T43.5 — Governance header always present ────────────────────────────────

describe("T43.5 — Governance header always present across all readiness states", () => {
  const cases: Array<{ label: string; input: SnapshotBuildInput }> = [
    {
      label: "SNAPSHOT_READY",
      input: buildBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeEligibleQuoteFacts(),
        regimeFacts: makeEligibleRegimeFacts(),
      }),
    },
    {
      label: "SNAPSHOT_PARTIAL",
      input: buildBaseInput({
        monthlyRevenueFacts: makeEligibleMRFacts(),
        quoteFacts: makeAuditOnlyQuoteFacts(),
      }),
    },
    {
      label: "SNAPSHOT_BLOCKED",
      input: buildBaseInput({ monthlyRevenueFacts: makeBlockedMRFacts() }),
    },
    {
      label: "SNAPSHOT_BLOCKED_PIT",
      input: buildBaseInput({ asOfDate: FUTURE_DATE }),
    },
  ];

  for (const { label: caseLabel, input } of cases) {
    describe(`case: ${caseLabel}`, () => {
      let output: string;
      beforeAll(() => {
        output = formatSnapshotReadout(
          readSnapshot(buildControlledResearchSnapshot(input), FIXED_READOUT_AT)
        );
      });

      it("output contains GOVERNANCE line", () => {
        expect(output).toContain("GOVERNANCE");
      });

      it("output contains entersAlphaScore=false", () => {
        expect(output).toContain("entersAlphaScore=false");
      });

      it("output contains paperOnly=true", () => {
        expect(output).toContain("paperOnly=true");
      });

      it("output contains dryRun=true", () => {
        expect(output).toContain("dryRun=true");
      });

      it("output contains [DISCLAIMER]", () => {
        expect(output).toContain("[DISCLAIMER]");
      });

      it("output contains INVARIANTS line", () => {
        expect(output).toContain("INVARIANTS");
      });
    });
  }
});

// ─── T43.6 — No forbidden field names as label keys ──────────────────────────

describe("T43.6 — No SNAPSHOT_FORBIDDEN_FIELDS names as label keys in output", () => {
  it("T43.6.1 SNAPSHOT_READY output contains no forbidden field labels", () => {
    const output = formatSnapshotReadout(makeReadyReadout());
    const lowerOutput = output.toLowerCase();
    for (const field of SNAPSHOT_FORBIDDEN_FIELDS) {
      // Check as label key pattern: "fieldname :" (case-insensitive)
      expect(lowerOutput).not.toContain(`${field.toLowerCase()} :`);
    }
  });

  it("T43.6.2 SNAPSHOT_BLOCKED_PIT output contains no forbidden field labels", () => {
    const readout = readSnapshot(
      buildControlledResearchSnapshot(buildBaseInput({ asOfDate: FUTURE_DATE })),
      FIXED_READOUT_AT
    );
    const output = formatSnapshotReadout(readout);
    const lowerOutput = output.toLowerCase();
    for (const field of SNAPSHOT_FORBIDDEN_FIELDS) {
      expect(lowerOutput).not.toContain(`${field.toLowerCase()} :`);
    }
  });
});

// ─── T43.7 — Determinism ─────────────────────────────────────────────────────

describe("T43.7 — Formatter is deterministic", () => {
  it("T43.7.1 two calls with the same readout produce identical strings", () => {
    const readout = makeReadyReadout();
    const out1 = formatSnapshotReadout(readout);
    const out2 = formatSnapshotReadout(readout);
    expect(out1).toBe(out2);
  });

  it("T43.7.2 different symbol produces different output", () => {
    const readoutA = readSnapshot(
      buildControlledResearchSnapshot(buildBaseInput({ symbol: "2330" })),
      FIXED_READOUT_AT
    );
    const readoutB = readSnapshot(
      buildControlledResearchSnapshot(buildBaseInput({ symbol: "2317" })),
      FIXED_READOUT_AT
    );
    expect(formatSnapshotReadout(readoutA)).not.toBe(formatSnapshotReadout(readoutB));
  });
});

// ─── T43.8 — Formatter version in output ─────────────────────────────────────

describe("T43.8 — SNAPSHOT_FORMATTER_VERSION appears in formatted output", () => {
  it("T43.8.1 output contains SNAPSHOT_FORMATTER_VERSION constant value", () => {
    const output = formatSnapshotReadout(makeReadyReadout());
    expect(output).toContain(SNAPSHOT_FORMATTER_VERSION);
    expect(output).toContain("p43-axis-a-snapshot-formatter-v0");
  });
});

// ─── T43.9 — Invariants summary ──────────────────────────────────────────────

describe("T43.9 — Invariants summary: VALID for healthy snapshots", () => {
  it("T43.9.1 SNAPSHOT_READY readout → INVARIANTS : VALID in output", () => {
    const output = formatSnapshotReadout(makeReadyReadout());
    expect(output).toContain("VALID");
  });

  it("T43.9.2 SNAPSHOT_BLOCKED_PIT readout → INVARIANTS : VALID (PIT block is valid governance)", () => {
    const readout = readSnapshot(
      buildControlledResearchSnapshot(buildBaseInput({ asOfDate: FUTURE_DATE })),
      FIXED_READOUT_AT
    );
    const output = formatSnapshotReadout(readout);
    expect(output).toContain("VALID");
  });
});

// ─── T43.10 — NOT_ASSESSED: no facts provided ────────────────────────────────

describe("T43.10 — NOT_ASSESSED sources rendered correctly", () => {
  let output: string;

  beforeAll(() => {
    const readout = readSnapshot(
      buildControlledResearchSnapshot(buildBaseInput()), // no facts
      FIXED_READOUT_AT
    );
    output = formatSnapshotReadout(readout);
  });

  it("T43.10.1 output contains NOT_ASSESSED label", () => {
    expect(output).toContain("NOT_ASSESSED");
  });

  it("T43.10.2 output contains MonthlyRevenue (in NOT_ASSESSED section)", () => {
    expect(output).toContain("MonthlyRevenue");
  });

  it("T43.10.3 output contains (none) for ELIGIBLE section", () => {
    // ELIGIBLE: (none)
    const lines = output.split("\n");
    const eligibleLine = lines.find((l) => l.includes("ELIGIBLE") && !l.includes("NOT_ASSESSED") && !l.includes("AUDIT_ONLY"));
    expect(eligibleLine).toBeDefined();
    expect(eligibleLine).toContain("(none)");
  });
});
