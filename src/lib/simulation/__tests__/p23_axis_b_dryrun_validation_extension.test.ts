/**
 * P23 — Axis B v2 Dry-Run Validation Extension
 *
 * 25 tests / 5 groups
 *
 * Extends the Axis B fixture-backed dry-run validation surface (P4/P6)
 * with deeper coverage of:
 *   - Extended dryRun / executedAt / noRealExecution invariants (Group 11)
 *   - Optimizer / execution / corpus marker rejection via forbiddenFields (Group 12)
 *   - Action-semantics / alphaScore-mutation marker rejection (Group 13)
 *   - Remaining individual governance flag rejection — noPnL / noROI / noWinRate /
 *     noAlphaScore / noBuySellActionSemantics (Group 14)
 *   - Determinism, fixture marker stability, governance flag boolean typing (Group 15)
 *
 * Groups:
 *   T11 — Extended dryRunOnly / executedAt / noRealExecution invariants across builds (5)
 *   T12 — Optimizer / execution / corpus marker rejection (5)
 *   T13 — Action-semantics / alphaScore mutation marker rejection (5)
 *   T14 — Remaining individual governance flag rejection (5)
 *   T15 — Determinism, fixture marker stability, and boolean-typing exhaustiveness (5)
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
 *   P23_AXIS_B_DRYRUN_VALIDATION_READY
 *   P22_AXIS_A_COMMITTED (gate satisfied)
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

// ─── Shared helpers ───────────────────────────────────────────────────────────

const FIXED_TS = {
  generatedAt: "2026-05-24T00:00:00.000Z",
  requestedAt: "2026-05-24T00:00:01.000Z",
  startedAt: "2026-05-24T00:00:02.000Z",
  completedAt: "2026-05-24T00:00:03.000Z",
  reportGeneratedAt: "2026-05-24T00:00:04.000Z",
  integrationStartedAt: "2026-05-24T00:00:00.000Z",
  integrationCompletedAt: "2026-05-24T00:00:05.000Z",
  integrationReportGeneratedAt: "2026-05-24T00:00:06.000Z",
  rehearsalStartedAt: "2026-05-24T00:00:00.000Z",
  rehearsalCompletedAt: "2026-05-24T00:00:07.000Z",
  rehearsalReportGeneratedAt: "2026-05-24T00:00:08.000Z",
  fullPipelineRehearsalStartedAt: "2026-05-24T00:00:00.000Z",
  fullPipelineRehearsalCompletedAt: "2026-05-24T00:00:09.000Z",
  fullPipelineRehearsalReportGeneratedAt: "2026-05-24T00:00:10.000Z",
  materializationStartedAt: "2026-05-24T00:00:00.000Z",
  materializationCompletedAt: "2026-05-24T00:00:11.000Z",
};

function makeCompliantArtifact() {
  return materializeDryRunResultArtifact({
    bundle: buildDefaultPaperSimulationInputBundle({
      asOfDate: FIXED_TS.generatedAt,
    }),
    ...FIXED_TS,
  });
}

// ─── Group 11: Extended dryRunOnly / executedAt / noRealExecution invariants (5) ─

describe("P23 — Group 11: extended dryRunOnly / executedAt / noRealExecution invariants across builds", () => {
  it("T11.1 — two independently built artifacts both have dryRunOnly === true", () => {
    const a = makeCompliantArtifact();
    const b = makeCompliantArtifact();
    expect(a.dryRunOnly).toBe(true);
    expect(b.dryRunOnly).toBe(true);
  });

  it("T11.2 — two independently built artifacts both have executedAt === null", () => {
    const a = makeCompliantArtifact();
    const b = makeCompliantArtifact();
    expect(a.executedAt).toBeNull();
    expect(b.executedAt).toBeNull();
  });

  it("T11.3 — two independently built artifacts both have noRealExecution === true", () => {
    const a = makeCompliantArtifact();
    const b = makeCompliantArtifact();
    expect(a.noRealExecution).toBe(true);
    expect(b.noRealExecution).toBe(true);
  });

  it("T11.4 — artifact.dryRunOnly is exactly the boolean true, not a truthy alias", () => {
    const artifact = makeCompliantArtifact();
    expect(artifact.dryRunOnly).toBe(true);
    expect(artifact.dryRunOnly).not.toBe(1);
    expect(artifact.dryRunOnly).not.toBe("true");
    expect(typeof artifact.dryRunOnly).toBe("boolean");
  });

  it("T11.5 — artifact.stubResult is exactly 'DRY_RUN_STUB_ONLY' across repeated builds", () => {
    const a = makeCompliantArtifact();
    const b = makeCompliantArtifact();
    expect(a.stubResult).toBe("DRY_RUN_STUB_ONLY");
    expect(b.stubResult).toBe("DRY_RUN_STUB_ONLY");
    expect(a.stubResult).toBe(b.stubResult);
  });
});

// ─── Group 12: Optimizer / execution / corpus marker rejection (5) ────────────

describe("P23 — Group 12: optimizer / execution / corpus marker rejection via forbiddenFields", () => {
  it("T12.1 — fixture.forbiddenFields contains 'runOptimizer'", () => {
    expect(P48_GOLDEN_FIXTURE.forbiddenFields).toContain("runOptimizer");
  });

  it("T12.2 — fixture.forbiddenFields contains 'executeSimulation'", () => {
    expect(P48_GOLDEN_FIXTURE.forbiddenFields).toContain("executeSimulation");
  });

  it("T12.3 — artifact with 'runOptimizer' field injected → violation includes 'runOptimizer'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      runOptimizer: () => { /* forbidden optimizer stub */ },
    } as unknown as ReturnType<typeof makeCompliantArtifact>;
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("runOptimizer"))).toBe(true);
  });

  it("T12.4 — artifact with 'executeSimulation' field injected → violation includes 'executeSimulation'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      executeSimulation: () => { /* forbidden execution stub */ },
    } as unknown as ReturnType<typeof makeCompliantArtifact>;
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("executeSimulation"))).toBe(true);
  });

  it("T12.5 — artifact with 'computePnL' field injected → violation includes 'computePnL'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      computePnL: () => { /* forbidden pnl computation stub */ },
    } as unknown as ReturnType<typeof makeCompliantArtifact>;
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("computePnL"))).toBe(true);
  });
});

// ─── Group 13: Action-semantics / alphaScore mutation marker rejection (5) ───

describe("P23 — Group 13: action-semantics / alphaScore mutation marker rejection", () => {
  it("T13.1 — artifact with 'generateRecommendation' field injected → violation includes 'generateRecommendation'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      generateRecommendation: () => { /* forbidden recommendation stub */ },
    } as unknown as ReturnType<typeof makeCompliantArtifact>;
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("generateRecommendation"))).toBe(true);
  });

  it("T13.2 — artifact with 'alphaScore' field injected → violation includes 'alphaScore'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      alphaScore: 0.99,
    } as unknown as ReturnType<typeof makeCompliantArtifact>;
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("alphaScore"))).toBe(true);
  });

  it("T13.3 — artifact with 'computeROI' field injected → violation includes 'computeROI'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      computeROI: () => { /* forbidden ROI computation stub */ },
    } as unknown as ReturnType<typeof makeCompliantArtifact>;
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("computeROI"))).toBe(true);
  });

  it("T13.4 — artifact with 'computeWinRate' field injected → violation includes 'computeWinRate'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      computeWinRate: () => { /* forbidden win-rate computation stub */ },
    } as unknown as ReturnType<typeof makeCompliantArtifact>;
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("computeWinRate"))).toBe(true);
  });

  it("T13.5 — artifact with 'runSimulation' field injected → violation includes 'runSimulation'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      runSimulation: () => { /* forbidden simulation execution stub */ },
    } as unknown as ReturnType<typeof makeCompliantArtifact>;
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("runSimulation"))).toBe(true);
  });
});

// ─── Group 14: Remaining individual governance flag rejection (5) ─────────────

describe("P23 — Group 14: remaining individual governance flag rejection (noPnL / noROI / noWinRate / noAlphaScore / noBuySellActionSemantics)", () => {
  it("T14.1 — noPnL=false on artifact → violation includes 'noPnL'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      noPnL: false as unknown as true,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("noPnL"))).toBe(true);
  });

  it("T14.2 — noROI=false on artifact → violation includes 'noROI'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      noROI: false as unknown as true,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("noROI"))).toBe(true);
  });

  it("T14.3 — noWinRate=false on artifact → violation includes 'noWinRate'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      noWinRate: false as unknown as true,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("noWinRate"))).toBe(true);
  });

  it("T14.4 — noAlphaScore=false on artifact → violation includes 'noAlphaScore'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      noAlphaScore: false as unknown as true,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("noAlphaScore"))).toBe(true);
  });

  it("T14.5 — noBuySellActionSemantics=false on artifact → violation includes 'noBuySellActionSemantics'", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      noBuySellActionSemantics: false as unknown as true,
    };
    const result = validateAgainstGoldenFixture(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("noBuySellActionSemantics"))).toBe(true);
  });
});

// ─── Group 15: Determinism, fixture marker stability, boolean-typing exhaustiveness (5) ─

describe("P23 — Group 15: determinism, fixture marker stability, and governance boolean-typing exhaustiveness", () => {
  it("T15.1 — two successive validateAgainstGoldenFixture calls on same artifact both return valid=true (deterministic)", () => {
    const artifact = makeCompliantArtifact();
    const r1 = validateAgainstGoldenFixture(artifact);
    const r2 = validateAgainstGoldenFixture(artifact);
    expect(r1.valid).toBe(true);
    expect(r2.valid).toBe(true);
    expect(r1.violations).toHaveLength(0);
    expect(r2.violations).toHaveLength(0);
  });

  it("T15.2 — two successive calls on tampered artifact (dryRunOnly=false) return identical violation count (deterministic error paths)", () => {
    const artifact = makeCompliantArtifact();
    const tampered = {
      ...artifact,
      dryRunOnly: false as unknown as true,
    };
    const r1 = validateAgainstGoldenFixture(tampered);
    const r2 = validateAgainstGoldenFixture(tampered);
    expect(r1.valid).toBe(false);
    expect(r2.valid).toBe(false);
    expect(r1.violations.length).toBe(r2.violations.length);
    expect(r1.violations.length).toBeGreaterThan(0);
  });

  it("T15.3 — P48_GOLDEN_FIXTURE.fixtureId and P48_GOLDEN_FIXTURE_VERSION are consistent (same embedded version string)", () => {
    expect(P48_GOLDEN_FIXTURE.version).toBe(P48_GOLDEN_FIXTURE_VERSION);
    expect(P48_GOLDEN_FIXTURE.fixtureId).toMatch(/^p48-/);
    expect(P48_GOLDEN_FIXTURE_VERSION).toMatch(/^p48-/);
  });

  it("T15.4 — P48_EXECUTION_STATUS sentinel equals 'P48_GOLDEN_FIXTURE_DESIGN_READY' on every access (immutable export)", () => {
    const s1 = P48_EXECUTION_STATUS;
    const s2 = P48_EXECUTION_STATUS;
    expect(s1).toBe("P48_GOLDEN_FIXTURE_DESIGN_READY");
    expect(s2).toBe("P48_GOLDEN_FIXTURE_DESIGN_READY");
    expect(s1).toBe(s2);
  });

  it("T15.5 — all 15 governance flags on P48_GOLDEN_FIXTURE.governanceFlags are strictly boolean (no numeric or string aliasing)", () => {
    const gf = P48_GOLDEN_FIXTURE.governanceFlags;
    const allFlags: (keyof typeof gf)[] = [
      "dryRunOnly", "paperOnly", "noActualMetrics", "entersAlphaScore",
      "noAlphaScore", "noRecommendation", "noPnL", "noROI",
      "noWinRate", "noReturnPct", "noOptimizer", "noRealBacktest",
      "noInvestmentAdvice", "noBuySellActionSemantics", "noRealExecution",
    ];
    for (const flag of allFlags) {
      expect(typeof gf[flag]).toBe("boolean");
    }
  });
});
