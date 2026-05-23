/**
 * P48 — Paper Simulation Dry-run Result Artifact Golden Fixture Tests
 *
 * 100 tests / 12 groups
 * Authorization: YES design paper simulation dry-run result artifact golden fixture for P48
 */

import { buildDefaultPaperSimulationInputBundle } from "../p39/PaperSimulationInputContractBuilder";
import {
  materializeDryRunResultArtifact,
  type PaperSimulationDryRunResultArtifactResult,
} from "../p47/PaperSimulationDryRunResultArtifact";
import {
  P48_GOLDEN_FIXTURE,
  P48_GOLDEN_FIXTURE_VERSION,
  P48_EXECUTION_STATUS,
} from "../p48/goldenFixtures/P48GoldenFixture";
import { validateAgainstGoldenFixture } from "../p48/P48GoldenFixtureValidator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TS = {
  generatedAt: "2024-01-18T10:00:00.000Z",
  requestedAt: "2024-01-18T10:00:01.000Z",
  startedAt: "2024-01-18T10:00:02.000Z",
  completedAt: "2024-01-18T10:00:03.000Z",
  reportGeneratedAt: "2024-01-18T10:00:04.000Z",
  integrationStartedAt: "2024-01-18T10:00:00.000Z",
  integrationCompletedAt: "2024-01-18T10:00:05.000Z",
  integrationReportGeneratedAt: "2024-01-18T10:00:06.000Z",
  rehearsalStartedAt: "2024-01-18T10:00:00.000Z",
  rehearsalCompletedAt: "2024-01-18T10:00:07.000Z",
  rehearsalReportGeneratedAt: "2024-01-18T10:00:08.000Z",
  fullPipelineRehearsalStartedAt: "2024-01-18T10:00:00.000Z",
  fullPipelineRehearsalCompletedAt: "2024-01-18T10:00:09.000Z",
  fullPipelineRehearsalReportGeneratedAt: "2024-01-18T10:00:10.000Z",
  materializationStartedAt: "2024-01-18T10:00:00.000Z",
  materializationCompletedAt: "2024-01-18T10:00:11.000Z",
};

function makeBundle() {
  return buildDefaultPaperSimulationInputBundle({ asOfDate: TS.generatedAt });
}

function makeResultArtifact(): PaperSimulationDryRunResultArtifactResult {
  return materializeDryRunResultArtifact({
    bundle: makeBundle(),
    ...TS,
  });
}

// ─── Group 1: P48 golden fixture structure (8 tests) ─────────────────────────

describe("P48 — Group 1: golden fixture structure", () => {
  it("fixtureId is a non-empty string", () => {
    expect(typeof P48_GOLDEN_FIXTURE.fixtureId).toBe("string");
    expect(P48_GOLDEN_FIXTURE.fixtureId.length).toBeGreaterThan(0);
  });

  it("fixtureId contains golden-fixture", () => {
    expect(P48_GOLDEN_FIXTURE.fixtureId).toContain("golden-fixture");
  });

  it("phase is P48", () => {
    expect(P48_GOLDEN_FIXTURE.phase).toBe("P48");
  });

  it("version starts with p48", () => {
    expect(P48_GOLDEN_FIXTURE.version).toMatch(/^p48/);
  });

  it("isGoldenFixture is true", () => {
    expect(P48_GOLDEN_FIXTURE.isGoldenFixture).toBe(true);
  });

  it("description is a non-empty string", () => {
    expect(typeof P48_GOLDEN_FIXTURE.description).toBe("string");
    expect(P48_GOLDEN_FIXTURE.description.length).toBeGreaterThan(0);
  });

  it("executedAt is null", () => {
    expect(P48_GOLDEN_FIXTURE.executedAt).toBeNull();
  });

  it("stubResult is DRY_RUN_STUB_ONLY", () => {
    expect(P48_GOLDEN_FIXTURE.stubResult).toBe("DRY_RUN_STUB_ONLY");
  });
});

// ─── Group 2: Governance flags in golden fixture (10 tests) ──────────────────

describe("P48 — Group 2: governance flags in golden fixture", () => {
  const gf = P48_GOLDEN_FIXTURE.governanceFlags;

  it("dryRunOnly is true", () => {
    expect(gf.dryRunOnly).toBe(true);
  });

  it("paperOnly is true", () => {
    expect(gf.paperOnly).toBe(true);
  });

  it("noActualMetrics is true", () => {
    expect(gf.noActualMetrics).toBe(true);
  });

  it("entersAlphaScore is false", () => {
    expect(gf.entersAlphaScore).toBe(false);
  });

  it("noAlphaScore is true", () => {
    expect(gf.noAlphaScore).toBe(true);
  });

  it("noPnL is true", () => {
    expect(gf.noPnL).toBe(true);
  });

  it("noROI is true", () => {
    expect(gf.noROI).toBe(true);
  });

  it("noWinRate is true", () => {
    expect(gf.noWinRate).toBe(true);
  });

  it("noRealExecution is true", () => {
    expect(gf.noRealExecution).toBe(true);
  });

  it("noRealBacktest is true", () => {
    expect(gf.noRealBacktest).toBe(true);
  });
});

// ─── Group 3: Step counts and phase chain in golden fixture (8 tests) ─────────

describe("P48 — Group 3: step counts and phase chain in golden fixture", () => {
  const sc = P48_GOLDEN_FIXTURE.stepCounts;
  const pc = P48_GOLDEN_FIXTURE.phaseChain;

  it("materializationStepsCompleted is 2", () => {
    expect(sc.materializationStepsCompleted).toBe(2);
  });

  it("materializationStepsTotal is 2", () => {
    expect(sc.materializationStepsTotal).toBe(2);
  });

  it("fullPipelineRehearsalStepsCompleted is 2", () => {
    expect(sc.fullPipelineRehearsalStepsCompleted).toBe(2);
  });

  it("rehearsalStepsCompleted is 2", () => {
    expect(sc.rehearsalStepsCompleted).toBe(2);
  });

  it("pipelineStepsCompleted is 5", () => {
    expect(sc.pipelineStepsCompleted).toBe(5);
  });

  it("phaseChain.resultArtifactPhase is P47", () => {
    expect(pc.resultArtifactPhase).toBe("P47");
  });

  it("phaseChain.fullPipelineRehearsalPhase is P46", () => {
    expect(pc.fullPipelineRehearsalPhase).toBe("P46");
  });

  it("phaseChain.rehearsalPhase is P45", () => {
    expect(pc.rehearsalPhase).toBe("P45");
  });
});

// ─── Group 4: ID patterns in golden fixture (8 tests) ────────────────────────

describe("P48 — Group 4: ID patterns in golden fixture", () => {
  const ip = P48_GOLDEN_FIXTURE.idPatterns;

  it("resultArtifactId pattern is a RegExp", () => {
    expect(ip.resultArtifactId).toBeInstanceOf(RegExp);
  });

  it("resultArtifactId pattern matches p47-result-artifact-", () => {
    expect(ip.resultArtifactId.test("p47-result-artifact-abc-2024")).toBe(true);
  });

  it("fullPipelineRehearsalId pattern matches p46-full-pipeline-rehearsal-", () => {
    expect(ip.fullPipelineRehearsalId.test("p46-full-pipeline-rehearsal-abc")).toBe(true);
  });

  it("rehearsalId pattern matches p45-rehearsal-", () => {
    expect(ip.rehearsalId.test("p45-rehearsal-xyz")).toBe(true);
  });

  it("integrationId pattern matches p44-integration-", () => {
    expect(ip.integrationId.test("p44-integration-foo")).toBe(true);
  });

  it("runnerId pattern matches p43-runner-", () => {
    expect(ip.runnerId.test("p43-runner-bar")).toBe(true);
  });

  it("lifecycleId pattern matches p42-lifecycle-", () => {
    expect(ip.lifecycleId.test("p42-lifecycle-baz")).toBe(true);
  });

  it("phaseChain.integrationPhase is P44", () => {
    expect(P48_GOLDEN_FIXTURE.phaseChain.integrationPhase).toBe("P44");
  });
});

// ─── Group 5: Validator accepts compliant artifact (10 tests) ─────────────────

describe("P48 — Group 5: validator accepts compliant artifact", () => {
  let result: PaperSimulationDryRunResultArtifactResult;

  beforeAll(() => {
    result = makeResultArtifact();
  });

  it("valid is true", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.valid).toBe(true);
  });

  it("violations array is empty", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.violations).toHaveLength(0);
  });

  it("checkedFields is non-empty", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.checkedFields.length).toBeGreaterThan(0);
  });

  it("isGoldenFixtureValidation is true", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.isGoldenFixtureValidation).toBe(true);
  });

  it("fixtureId matches P48_GOLDEN_FIXTURE.fixtureId", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.fixtureId).toBe(P48_GOLDEN_FIXTURE.fixtureId);
  });

  it("phase is P48", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.phase).toBe("P48");
  });

  it("dryRunOnly is true", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.dryRunOnly).toBe(true);
  });

  it("paperOnly is true", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.paperOnly).toBe(true);
  });

  it("noRealExecution is true", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.noRealExecution).toBe(true);
  });

  it("checkedFields includes dryRunOnly", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.checkedFields).toContain("dryRunOnly");
  });
});

// ─── Group 6: Validator detects violations on non-compliant artifact (8 tests) -

describe("P48 — Group 6: validator detects violations on non-compliant artifact", () => {
  it("detects wrong pipelineStepsCompleted", () => {
    const result = makeResultArtifact();
    const tampered = { ...result, pipelineStepsCompleted: 3 };
    const vr = validateAgainstGoldenFixture(
      tampered as PaperSimulationDryRunResultArtifactResult
    );
    expect(vr.valid).toBe(false);
    expect(
      vr.violations.some((v) => v.includes("pipelineStepsCompleted"))
    ).toBe(true);
  });

  it("detects wrong materializationStepsCompleted", () => {
    const result = makeResultArtifact();
    const tampered = { ...result, materializationStepsCompleted: 1 };
    const vr = validateAgainstGoldenFixture(
      tampered as PaperSimulationDryRunResultArtifactResult
    );
    expect(vr.valid).toBe(false);
    expect(
      vr.violations.some((v) => v.includes("materializationStepsCompleted"))
    ).toBe(true);
  });

  it("detects wrong entersAlphaScore", () => {
    const result = makeResultArtifact();
    const tampered = { ...result, entersAlphaScore: true };
    const vr = validateAgainstGoldenFixture(
      tampered as unknown as PaperSimulationDryRunResultArtifactResult
    );
    expect(vr.valid).toBe(false);
    expect(vr.violations.some((v) => v.includes("entersAlphaScore"))).toBe(true);
  });

  it("detects non-null executedAt", () => {
    const result = makeResultArtifact();
    const tampered = { ...result, executedAt: "2024-01-18T10:00:00.000Z" };
    const vr = validateAgainstGoldenFixture(
      tampered as unknown as PaperSimulationDryRunResultArtifactResult
    );
    expect(vr.valid).toBe(false);
    expect(vr.violations.some((v) => v.includes("executedAt"))).toBe(true);
  });

  it("detects wrong resultArtifactId prefix", () => {
    const result = makeResultArtifact();
    const tampered = { ...result, resultArtifactId: "bad-id-xyz" };
    const vr = validateAgainstGoldenFixture(
      tampered as PaperSimulationDryRunResultArtifactResult
    );
    expect(vr.valid).toBe(false);
    expect(vr.violations.some((v) => v.includes("resultArtifactId"))).toBe(true);
  });

  it("detects wrong runnerId prefix", () => {
    const result = makeResultArtifact();
    const tampered = { ...result, runnerId: "wrong-runner-abc" };
    const vr = validateAgainstGoldenFixture(
      tampered as PaperSimulationDryRunResultArtifactResult
    );
    expect(vr.valid).toBe(false);
    expect(vr.violations.some((v) => v.includes("runnerId"))).toBe(true);
  });

  it("detects forbidden field pnl", () => {
    const result = makeResultArtifact();
    const tampered = { ...result, pnl: 123 };
    const vr = validateAgainstGoldenFixture(
      tampered as unknown as PaperSimulationDryRunResultArtifactResult
    );
    expect(vr.valid).toBe(false);
    expect(vr.violations.some((v) => v.includes("pnl"))).toBe(true);
  });

  it("validation result is frozen", () => {
    const result = makeResultArtifact();
    const vr = validateAgainstGoldenFixture(result);
    expect(Object.isFrozen(vr)).toBe(true);
  });
});

// ─── Group 7: Forbidden fields absent in real artifact (8 tests) ──────────────

describe("P48 — Group 7: forbidden fields absent in real artifact", () => {
  let result: PaperSimulationDryRunResultArtifactResult;

  beforeAll(() => {
    result = makeResultArtifact();
  });

  it("no pnl field", () => {
    expect((result as Record<string, unknown>)["pnl"]).toBeUndefined();
  });

  it("no roi field", () => {
    expect((result as Record<string, unknown>)["roi"]).toBeUndefined();
  });

  it("no ROI field", () => {
    expect((result as Record<string, unknown>)["ROI"]).toBeUndefined();
  });

  it("no winRate field", () => {
    expect((result as Record<string, unknown>)["winRate"]).toBeUndefined();
  });

  it("no alphaScore field", () => {
    expect((result as Record<string, unknown>)["alphaScore"]).toBeUndefined();
  });

  it("no recommendation field", () => {
    expect((result as Record<string, unknown>)["recommendation"]).toBeUndefined();
  });

  it("no prediction field", () => {
    expect((result as Record<string, unknown>)["prediction"]).toBeUndefined();
  });

  it("no backtestResult field", () => {
    expect((result as Record<string, unknown>)["backtestResult"]).toBeUndefined();
  });
});

// ─── Group 8: Golden fixture immutability (8 tests) ───────────────────────────

describe("P48 — Group 8: golden fixture immutability", () => {
  it("P48_GOLDEN_FIXTURE is frozen", () => {
    expect(Object.isFrozen(P48_GOLDEN_FIXTURE)).toBe(true);
  });

  it("governanceFlags is frozen", () => {
    expect(Object.isFrozen(P48_GOLDEN_FIXTURE.governanceFlags)).toBe(true);
  });

  it("stepCounts is frozen", () => {
    expect(Object.isFrozen(P48_GOLDEN_FIXTURE.stepCounts)).toBe(true);
  });

  it("idPatterns is frozen", () => {
    expect(Object.isFrozen(P48_GOLDEN_FIXTURE.idPatterns)).toBe(true);
  });

  it("phaseChain is frozen", () => {
    expect(Object.isFrozen(P48_GOLDEN_FIXTURE.phaseChain)).toBe(true);
  });

  it("forbiddenFields is frozen", () => {
    expect(Object.isFrozen(P48_GOLDEN_FIXTURE.forbiddenFields)).toBe(true);
  });

  it("fixture top-level dryRunOnly is true", () => {
    expect(P48_GOLDEN_FIXTURE.dryRunOnly).toBe(true);
  });

  it("fixture top-level noRealExecution is true", () => {
    expect(P48_GOLDEN_FIXTURE.noRealExecution).toBe(true);
  });
});

// ─── Group 9: Constants and version strings (8 tests) ─────────────────────────

describe("P48 — Group 9: constants and version strings", () => {
  it("P48_GOLDEN_FIXTURE_VERSION starts with p48", () => {
    expect(P48_GOLDEN_FIXTURE_VERSION).toMatch(/^p48/);
  });

  it("P48_GOLDEN_FIXTURE_VERSION contains golden-fixture", () => {
    expect(P48_GOLDEN_FIXTURE_VERSION).toContain("golden-fixture");
  });

  it("P48_GOLDEN_FIXTURE_VERSION is JSON-serializable", () => {
    expect(() => JSON.stringify(P48_GOLDEN_FIXTURE_VERSION)).not.toThrow();
  });

  it("P48_EXECUTION_STATUS is P48_GOLDEN_FIXTURE_DESIGN_READY", () => {
    expect(P48_EXECUTION_STATUS).toBe("P48_GOLDEN_FIXTURE_DESIGN_READY");
  });

  it("P48_GOLDEN_FIXTURE.version matches P48_GOLDEN_FIXTURE_VERSION constant", () => {
    expect(P48_GOLDEN_FIXTURE.version).toBe(P48_GOLDEN_FIXTURE_VERSION);
  });

  it("P48_GOLDEN_FIXTURE.executionStatus is the P47 ready marker", () => {
    expect(P48_GOLDEN_FIXTURE.executionStatus).toBe(
      "EXECUTION_LIFECYCLE_RUNNER_RESULT_ARTIFACT_MATERIALIZATION_READY"
    );
  });

  it("P48_GOLDEN_FIXTURE.forbiddenFields length is >= 8", () => {
    expect(P48_GOLDEN_FIXTURE.forbiddenFields.length).toBeGreaterThanOrEqual(8);
  });

  it("P48_GOLDEN_FIXTURE.fixtureId is deterministic across two references", () => {
    expect(P48_GOLDEN_FIXTURE.fixtureId).toBe(P48_GOLDEN_FIXTURE.fixtureId);
  });
});

// ─── Group 10: No forbidden exports from P48 modules (8 tests) ────────────────

describe("P48 — Group 10: no forbidden exports from P48 modules", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fixtureModule = require("../p48/goldenFixtures/P48GoldenFixture");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const validatorModule = require("../p48/P48GoldenFixtureValidator");

  it("no executeSimulation export from fixture module", () => {
    expect(fixtureModule.executeSimulation).toBeUndefined();
  });

  it("no computePnL export from fixture module", () => {
    expect(fixtureModule.computePnL).toBeUndefined();
  });

  it("no computeROI export from fixture module", () => {
    expect(fixtureModule.computeROI).toBeUndefined();
  });

  it("no runSimulation export from fixture module", () => {
    expect(fixtureModule.runSimulation).toBeUndefined();
  });

  it("no computeWinRate export from validator module", () => {
    expect(validatorModule.computeWinRate).toBeUndefined();
  });

  it("no generateRecommendation export from validator module", () => {
    expect(validatorModule.generateRecommendation).toBeUndefined();
  });

  it("no runBacktest export from validator module", () => {
    expect(validatorModule.runBacktest).toBeUndefined();
  });

  it("no runOptimizer export from validator module", () => {
    expect(validatorModule.runOptimizer).toBeUndefined();
  });
});

// ─── Group 11: End-to-end golden fixture validation (8 tests) ─────────────────

describe("P48 — Group 11: end-to-end golden fixture validation", () => {
  let result: PaperSimulationDryRunResultArtifactResult;

  beforeAll(() => {
    result = makeResultArtifact();
  });

  it("validator produces valid result for real artifact", () => {
    expect(validateAgainstGoldenFixture(result).valid).toBe(true);
  });

  it("checkedFields includes entersAlphaScore", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.checkedFields).toContain("entersAlphaScore");
  });

  it("checkedFields includes pipelineStepsCompleted", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.checkedFields).toContain("pipelineStepsCompleted");
  });

  it("result artifact resultArtifactId matches golden fixture pattern", () => {
    expect(P48_GOLDEN_FIXTURE.idPatterns.resultArtifactId.test(result.resultArtifactId)).toBe(true);
  });

  it("result artifact fullPipelineRehearsalId matches golden fixture pattern", () => {
    expect(
      P48_GOLDEN_FIXTURE.idPatterns.fullPipelineRehearsalId.test(result.fullPipelineRehearsalId)
    ).toBe(true);
  });

  it("result artifact lifecycle chain phase is P44 at deepest level", () => {
    expect(
      result.fullPipelineRehearsalResult.rehearsalResult.integrationResult.phase
    ).toBe(P48_GOLDEN_FIXTURE.phaseChain.integrationPhase);
  });

  it("checkedFields includes executedAt", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(vr.checkedFields).toContain("executedAt");
  });

  it("violations array is frozen", () => {
    const vr = validateAgainstGoldenFixture(result);
    expect(Object.isFrozen(vr.violations)).toBe(true);
  });
});

// ─── Group 12: Golden fixture schema completeness (8 tests) ───────────────────

describe("P48 — Group 12: golden fixture schema completeness", () => {
  it("governanceFlags has 15 keys", () => {
    expect(Object.keys(P48_GOLDEN_FIXTURE.governanceFlags).length).toBe(15);
  });

  it("stepCounts has 5 keys", () => {
    expect(Object.keys(P48_GOLDEN_FIXTURE.stepCounts).length).toBe(5);
  });

  it("idPatterns has 6 keys", () => {
    expect(Object.keys(P48_GOLDEN_FIXTURE.idPatterns).length).toBe(6);
  });

  it("phaseChain has 4 keys", () => {
    expect(Object.keys(P48_GOLDEN_FIXTURE.phaseChain).length).toBe(4);
  });

  it("forbiddenFields includes alphaScore", () => {
    expect(P48_GOLDEN_FIXTURE.forbiddenFields).toContain("alphaScore");
  });

  it("forbiddenFields includes winRate", () => {
    expect(P48_GOLDEN_FIXTURE.forbiddenFields).toContain("winRate");
  });

  it("fixture executionStatus references P47 ready marker", () => {
    expect(P48_GOLDEN_FIXTURE.executionStatus).toContain(
      "RESULT_ARTIFACT_MATERIALIZATION_READY"
    );
  });

  it("fixture fixtureId is deterministic — same value every time", () => {
    const id1 = P48_GOLDEN_FIXTURE.fixtureId;
    const id2 = P48_GOLDEN_FIXTURE.fixtureId;
    expect(id1).toBe(id2);
  });
});
