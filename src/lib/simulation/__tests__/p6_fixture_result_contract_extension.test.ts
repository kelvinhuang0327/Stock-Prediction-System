/**
 * P6 — Axis B Fixture-backed Dry-run Result Contract Extension
 *
 * 25 tests / 5 groups
 *
 * Extends the P4 golden fixture validation surface with deeper contract
 * hardening: validator metadata, individual governance flag rejection,
 * step-count and ID-pattern rejection, forbidden field individual coverage,
 * and full phase-chain validation.
 *
 * Groups:
 *   T6 — Validator metadata exhaustiveness (5)
 *   T7 — Individual governance flag rejection (5)
 *   T8 — Step count and ID pattern rejection (5)
 *   T9 — Forbidden field individual coverage (5)
 *   T10 — Phase chain validation (5)
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
 *   P6_AXIS_B_FIXTURE_RESULT_CONTRACT_READY
 *   P5_AXIS_A_RESEARCH_SNAPSHOT_EXTENSION_READY (gate satisfied)
 *
 * NOT investment advice. No buy/sell/hold. No PnL/ROI/win-rate claims.
 */

import {
  P48_GOLDEN_FIXTURE,
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

// ─── Group 6: Validator metadata exhaustiveness (5 tests) ─────────────────────

describe("P6 — Group 6: validator metadata exhaustiveness", () => {
  it("T6.1 — validator result object is frozen (immutable)", () => {
    const result = validateAgainstGoldenFixture(makeCompliantArtifact());
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("T6.2 — validator violations array is frozen", () => {
    const result = validateAgainstGoldenFixture(makeCompliantArtifact());
    expect(Object.isFrozen(result.violations)).toBe(true);
  });

  it("T6.3 — checkedFields covers at least 30 distinct field checks", () => {
    const result = validateAgainstGoldenFixture(makeCompliantArtifact());
    expect(result.checkedFields.length).toBeGreaterThanOrEqual(30);
  });

  it("T6.4 — isGoldenFixtureValidation is exactly true on a valid artifact", () => {
    const result = validateAgainstGoldenFixture(makeCompliantArtifact());
    expect(result.isGoldenFixtureValidation).toBe(true);
  });

  it("T6.5 — fixtureId starts with 'p48-'", () => {
    const result = validateAgainstGoldenFixture(makeCompliantArtifact());
    expect(result.fixtureId).toMatch(/^p48-/);
  });
});

// ─── Group 7: Individual governance flag rejection (5 tests) ──────────────────

describe("P6 — Group 7: individual governance flag rejection", () => {
  it("T7.1 — noActualMetrics=false on artifact → violation includes 'noActualMetrics'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      noActualMetrics: false as unknown as true,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("noActualMetrics"))).toBe(true);
  });

  it("T7.2 — noOptimizer=false on artifact → violation includes 'noOptimizer'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      noOptimizer: false as unknown as true,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("noOptimizer"))).toBe(true);
  });

  it("T7.3 — noRealBacktest=false on artifact → violation includes 'noRealBacktest'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      noRealBacktest: false as unknown as true,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("noRealBacktest"))).toBe(true);
  });

  it("T7.4 — noInvestmentAdvice=false on artifact → violation includes 'noInvestmentAdvice'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      noInvestmentAdvice: false as unknown as true,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("noInvestmentAdvice"))).toBe(true);
  });

  it("T7.5 — noReturnPct=false on artifact → violation includes 'noReturnPct'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      noReturnPct: false as unknown as true,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("noReturnPct"))).toBe(true);
  });
});

// ─── Group 8: Step count and ID pattern rejection (5 tests) ───────────────────

describe("P6 — Group 8: step count and ID pattern rejection", () => {
  it("T8.1 — materializationStepsCompleted=1 (wrong) → violation includes 'materializationStepsCompleted'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      materializationStepsCompleted: 1 as unknown as 2,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.includes("materializationStepsCompleted"))
    ).toBe(true);
  });

  it("T8.2 — pipelineStepsCompleted=3 (wrong) → violation includes 'pipelineStepsCompleted'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      pipelineStepsCompleted: 3,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.includes("pipelineStepsCompleted"))
    ).toBe(true);
  });

  it("T8.3 — malformed resultArtifactId (missing 'p47-' prefix) → violation includes 'resultArtifactId'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      resultArtifactId: "bad-result-artifact-id-no-prefix",
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v) => v.includes("resultArtifactId"))
    ).toBe(true);
  });

  it("T8.4 — malformed rehearsalId (wrong prefix) → violation includes 'rehearsalId'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      rehearsalId: "wrong-prefix-rehearsal-id",
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("rehearsalId"))).toBe(true);
  });

  it("T8.5 — malformed integrationId (wrong prefix) → violation includes 'integrationId'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      integrationId: "no-p44-prefix-here",
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("integrationId"))).toBe(true);
  });
});

// ─── Group 9: Forbidden field individual coverage (5 tests) ───────────────────

describe("P6 — Group 9: forbidden field individual coverage", () => {
  it("T9.1 — fixture.forbiddenFields contains 'roi'", () => {
    expect(P48_GOLDEN_FIXTURE.forbiddenFields).toContain("roi");
  });

  it("T9.2 — fixture.forbiddenFields contains 'winRate'", () => {
    expect(P48_GOLDEN_FIXTURE.forbiddenFields).toContain("winRate");
  });

  it("T9.3 — fixture.forbiddenFields contains 'backtestResult'", () => {
    expect(P48_GOLDEN_FIXTURE.forbiddenFields).toContain("backtestResult");
  });

  it("T9.4 — artifact with forbidden field 'roi' injected → violation includes 'roi'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      roi: 0.42,
    } as unknown as ReturnType<typeof makeCompliantArtifact>;
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("roi"))).toBe(true);
  });

  it("T9.5 — artifact with forbidden field 'runBacktest' injected → violation includes 'runBacktest'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      runBacktest: () => { /* forbidden stub */ },
    } as unknown as ReturnType<typeof makeCompliantArtifact>;
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("runBacktest"))).toBe(true);
  });
});

// ─── Group 10: Phase chain validation (5 tests) ───────────────────────────────

describe("P6 — Group 10: phase chain validation", () => {
  it("T10.1 — fixture.phaseChain.resultArtifactPhase is 'P47'", () => {
    expect(P48_GOLDEN_FIXTURE.phaseChain.resultArtifactPhase).toBe("P47");
  });

  it("T10.2 — fixture.phaseChain.fullPipelineRehearsalPhase is 'P46'", () => {
    expect(P48_GOLDEN_FIXTURE.phaseChain.fullPipelineRehearsalPhase).toBe("P46");
  });

  it("T10.3 — fixture.phaseChain.rehearsalPhase is 'P45'", () => {
    expect(P48_GOLDEN_FIXTURE.phaseChain.rehearsalPhase).toBe("P45");
  });

  it("T10.4 — fixture.phaseChain.integrationPhase is 'P44'", () => {
    expect(P48_GOLDEN_FIXTURE.phaseChain.integrationPhase).toBe("P44");
  });

  it("T10.5 — artifact with wrong phase ('P46') → validator detects and reports phase violation", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      phase: "P46" as unknown as "P47",
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("phase"))).toBe(true);
  });
});
