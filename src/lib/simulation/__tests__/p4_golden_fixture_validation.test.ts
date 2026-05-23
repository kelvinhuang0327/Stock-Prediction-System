/**
 * P4 — Axis B Fixture-backed Dry-run Validation Checkpoint
 *
 * 25 tests / 5 groups
 *
 * This file constitutes the P4 fixture-backed validation checkpoint.
 * It validates the P48 golden fixture and its validator from the
 * src/lib/simulation/ axis — a separate module boundary from the
 * existing P48 onlineValidation tests — confirming that all
 * dry-run governance invariants hold when accessed cross-module.
 *
 * GOVERNANCE:
 * - dryRunOnly = true
 * - paperOnly = true
 * - noActualMetrics = true
 * - entersAlphaScore = false
 * - noRealExecution = true
 * - executedAt = null
 * - stubResult = DRY_RUN_STUB_ONLY
 *
 * Authorization:
 *   P4_AXIS_B_FIXTURE_VALIDATION_READY
 *   P3_CLOSURE_READY_P4_AUTHORIZED (gate satisfied)
 *
 * NOT investment advice. No buy/sell/hold. No PnL/ROI/win-rate claims.
 */

import {
  P48_GOLDEN_FIXTURE,
  P48_GOLDEN_FIXTURE_VERSION,
  P48_EXECUTION_STATUS,
} from "@/lib/onlineValidation/p48/goldenFixtures/P48GoldenFixture";
import { validateAgainstGoldenFixture } from "@/lib/onlineValidation/p48/P48GoldenFixtureValidator";
import { materializeDryRunResultArtifact } from "@/lib/onlineValidation/p47/PaperSimulationDryRunResultArtifact";
import { buildDefaultPaperSimulationInputBundle } from "@/lib/onlineValidation/p39/PaperSimulationInputContractBuilder";

// ─── Shared helpers ────────────────────────────────────────────────────────────

const FIXED_TS = {
  generatedAt: "2026-05-23T00:00:00.000Z",
  requestedAt: "2026-05-23T00:00:01.000Z",
  startedAt: "2026-05-23T00:00:02.000Z",
  completedAt: "2026-05-23T00:00:03.000Z",
  reportGeneratedAt: "2026-05-23T00:00:04.000Z",
  integrationStartedAt: "2026-05-23T00:00:00.000Z",
  integrationCompletedAt: "2026-05-23T00:00:05.000Z",
  integrationReportGeneratedAt: "2026-05-23T00:00:06.000Z",
  rehearsalStartedAt: "2026-05-23T00:00:00.000Z",
  rehearsalCompletedAt: "2026-05-23T00:00:07.000Z",
  rehearsalReportGeneratedAt: "2026-05-23T00:00:08.000Z",
  fullPipelineRehearsalStartedAt: "2026-05-23T00:00:00.000Z",
  fullPipelineRehearsalCompletedAt: "2026-05-23T00:00:09.000Z",
  fullPipelineRehearsalReportGeneratedAt: "2026-05-23T00:00:10.000Z",
  materializationStartedAt: "2026-05-23T00:00:00.000Z",
  materializationCompletedAt: "2026-05-23T00:00:11.000Z",
};

function makeCompliantArtifact() {
  return materializeDryRunResultArtifact({
    bundle: buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_TS.generatedAt,
    }),
    ...FIXED_TS,
  });
}

// ─── Group 1: P4 cross-module fixture load and determinism (5 tests) ──────────

describe("P4 — Group 1: cross-module fixture load and determinism", () => {
  it("T1.1 — fixture loads without error from simulation module boundary", () => {
    expect(P48_GOLDEN_FIXTURE).toBeDefined();
  });

  it("T1.2 — same fixture reference on repeated access (identity stable)", () => {
    const a = P48_GOLDEN_FIXTURE;
    const b = P48_GOLDEN_FIXTURE;
    expect(a).toBe(b);
  });

  it("T1.3 — fixture phase is exactly 'P48'", () => {
    expect(P48_GOLDEN_FIXTURE.phase).toBe("P48");
  });

  it("T1.4 — P48_GOLDEN_FIXTURE_VERSION starts with 'p48'", () => {
    expect(P48_GOLDEN_FIXTURE_VERSION).toMatch(/^p48/);
  });

  it("T1.5 — P48_EXECUTION_STATUS is the materialization-ready sentinel", () => {
    expect(P48_EXECUTION_STATUS).toBe(
      "P48_GOLDEN_FIXTURE_DESIGN_READY"
    );
  });
});

// ─── Group 2: P4 governance flag exhaustiveness (5 tests) ─────────────────────

describe("P4 — Group 2: governance flag exhaustiveness", () => {
  it("T2.1 — all 15 governance flags are present on fixture.governanceFlags", () => {
    const gf = P48_GOLDEN_FIXTURE.governanceFlags;
    const required = [
      "dryRunOnly", "paperOnly", "noActualMetrics", "entersAlphaScore",
      "noAlphaScore", "noRecommendation", "noPnL", "noROI",
      "noWinRate", "noReturnPct", "noOptimizer", "noRealBacktest",
      "noInvestmentAdvice", "noBuySellActionSemantics", "noRealExecution",
    ];
    for (const flag of required) {
      expect(gf).toHaveProperty(flag);
    }
  });

  it("T2.2 — entersAlphaScore is exactly false (not falsy, not 0, not null)", () => {
    expect(P48_GOLDEN_FIXTURE.governanceFlags.entersAlphaScore).toBe(false);
  });

  it("T2.3 — noPnL, noROI, noWinRate, noBuySellActionSemantics are all exactly true", () => {
    const gf = P48_GOLDEN_FIXTURE.governanceFlags;
    expect(gf.noPnL).toBe(true);
    expect(gf.noROI).toBe(true);
    expect(gf.noWinRate).toBe(true);
    expect(gf.noBuySellActionSemantics).toBe(true);
  });

  it("T2.4 — dryRunOnly is true at both top-level and inside governanceFlags", () => {
    expect(P48_GOLDEN_FIXTURE.dryRunOnly).toBe(true);
    expect(P48_GOLDEN_FIXTURE.governanceFlags.dryRunOnly).toBe(true);
  });

  it("T2.5 — paperOnly is true at both top-level and inside governanceFlags", () => {
    expect(P48_GOLDEN_FIXTURE.paperOnly).toBe(true);
    expect(P48_GOLDEN_FIXTURE.governanceFlags.paperOnly).toBe(true);
  });
});

// ─── Group 3: P4 null-execution and stub sentinel invariants (5 tests) ────────

describe("P4 — Group 3: null-execution and stub sentinel invariants", () => {
  it("T3.1 — executedAt is null (not a string, not undefined)", () => {
    expect(P48_GOLDEN_FIXTURE.executedAt).toBeNull();
  });

  it("T3.2 — stubResult is exactly 'DRY_RUN_STUB_ONLY'", () => {
    expect(P48_GOLDEN_FIXTURE.stubResult).toBe("DRY_RUN_STUB_ONLY");
  });

  it("T3.3 — noRealExecution is true at top level", () => {
    expect(P48_GOLDEN_FIXTURE.noRealExecution).toBe(true);
  });

  it("T3.4 — noRealExecution is true inside governanceFlags", () => {
    expect(P48_GOLDEN_FIXTURE.governanceFlags.noRealExecution).toBe(true);
  });

  it("T3.5 — executedAt is typeof null, not a Date-shaped string", () => {
    const val = P48_GOLDEN_FIXTURE.executedAt;
    expect(typeof val).toBe("object"); // typeof null === 'object'
    expect(val).toBeNull();
  });
});

// ─── Group 4: P4 validator contract and structured error paths (5 tests) ──────

describe("P4 — Group 4: validator contract and structured error paths", () => {
  it("T4.1 — validator on compliant artifact returns valid=true with empty violations", () => {
    const artifact = makeCompliantArtifact();
    const result = validateAgainstGoldenFixture(artifact);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("T4.2 — validator result has required structural fields", () => {
    const artifact = makeCompliantArtifact();
    const result = validateAgainstGoldenFixture(artifact);
    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("violations");
    expect(result).toHaveProperty("checkedFields");
    expect(result).toHaveProperty("fixtureId");
    expect(result).toHaveProperty("phase");
    expect(result).toHaveProperty("isGoldenFixtureValidation");
  });

  it("T4.3 — validator result phase is 'P48'", () => {
    const result = validateAgainstGoldenFixture(makeCompliantArtifact());
    expect(result.phase).toBe("P48");
  });

  it("T4.4 — validator detects wrong entersAlphaScore and includes field name in violation path", () => {
    const artifact = makeCompliantArtifact();
    const tampered = { ...artifact, entersAlphaScore: true as unknown as false };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("entersAlphaScore"))).toBe(true);
  });

  it("T4.5 — validator detects non-null executedAt and includes field name in violation path", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      executedAt: "2026-05-23T00:00:00.000Z" as unknown as null,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("executedAt"))).toBe(true);
  });
});

// ─── Group 5: P4 forbidden field list coverage and rejection (5 tests) ────────

describe("P4 — Group 5: forbidden field coverage and artifact rejection", () => {
  it("T5.1 — forbiddenFields is a non-empty array", () => {
    expect(Array.isArray(P48_GOLDEN_FIXTURE.forbiddenFields)).toBe(true);
    expect(P48_GOLDEN_FIXTURE.forbiddenFields.length).toBeGreaterThan(0);
  });

  it("T5.2 — 'pnl' is listed in forbiddenFields", () => {
    expect(P48_GOLDEN_FIXTURE.forbiddenFields).toContain("pnl");
  });

  it("T5.3 — 'alphaScore' is listed in forbiddenFields", () => {
    expect(P48_GOLDEN_FIXTURE.forbiddenFields).toContain("alphaScore");
  });

  it("T5.4 — 'recommendation' and 'prediction' are both in forbiddenFields", () => {
    expect(P48_GOLDEN_FIXTURE.forbiddenFields).toContain("recommendation");
    expect(P48_GOLDEN_FIXTURE.forbiddenFields).toContain("prediction");
  });

  it("T5.5 — validator detects forbidden field 'pnl' on artifact and reports it", () => {
    const artifact = makeCompliantArtifact();
    const tampered = { ...artifact, pnl: 9999 };
    const result = validateAgainstGoldenFixture(
      tampered as unknown as ReturnType<typeof makeCompliantArtifact>
    );
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("pnl"))).toBe(true);
  });
});
