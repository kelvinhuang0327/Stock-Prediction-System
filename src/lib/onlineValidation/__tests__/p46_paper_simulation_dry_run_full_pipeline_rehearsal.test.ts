/**
 * P46 — Paper Simulation Dry-run Full Pipeline Rehearsal Tests
 *
 * 98 tests / 11 groups
 * Authorization: YES design paper simulation dry-run full pipeline rehearsal for P46
 */

import { buildDefaultPaperSimulationInputBundle } from "../p39/PaperSimulationInputContractBuilder";
import {
  runDryRunFullPipelineRehearsal,
  P46_EXECUTION_STATUS,
  P46_FULL_PIPELINE_REHEARSAL_STEPS_TOTAL,
  PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION,
  type PaperSimulationDryRunFullPipelineRehearsalResult,
} from "../p46/PaperSimulationDryRunFullPipelineRehearsal";
import {
  buildFullPipelineRehearsalReport,
  PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_REPORT_VERSION,
} from "../p46/PaperSimulationDryRunFullPipelineRehearsalReport";
import { DRY_RUN_STUB_RESULT } from "../p41/PaperSimulationDryRunContract";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TS = {
  generatedAt: "2024-01-17T10:00:00.000Z",
  requestedAt: "2024-01-17T10:00:01.000Z",
  startedAt: "2024-01-17T10:00:02.000Z",
  completedAt: "2024-01-17T10:00:03.000Z",
  reportGeneratedAt: "2024-01-17T10:00:04.000Z",
  integrationStartedAt: "2024-01-17T10:00:00.000Z",
  integrationCompletedAt: "2024-01-17T10:00:05.000Z",
  integrationReportGeneratedAt: "2024-01-17T10:00:06.000Z",
  rehearsalStartedAt: "2024-01-17T10:00:00.000Z",
  rehearsalCompletedAt: "2024-01-17T10:00:07.000Z",
  rehearsalReportGeneratedAt: "2024-01-17T10:00:08.000Z",
  fullPipelineRehearsalStartedAt: "2024-01-17T10:00:00.000Z",
  fullPipelineRehearsalCompletedAt: "2024-01-17T10:00:09.000Z",
  fullPipelineRehearsalReportGeneratedAt: "2024-01-17T10:00:10.000Z",
};

function makeBundle() {
  return buildDefaultPaperSimulationInputBundle({ asOfDate: TS.generatedAt });
}

function makeFullPipelineRehearsal(): PaperSimulationDryRunFullPipelineRehearsalResult {
  return runDryRunFullPipelineRehearsal({
    bundle: makeBundle(),
    generatedAt: TS.generatedAt,
    requestedAt: TS.requestedAt,
    startedAt: TS.startedAt,
    completedAt: TS.completedAt,
    reportGeneratedAt: TS.reportGeneratedAt,
    integrationStartedAt: TS.integrationStartedAt,
    integrationCompletedAt: TS.integrationCompletedAt,
    integrationReportGeneratedAt: TS.integrationReportGeneratedAt,
    rehearsalStartedAt: TS.rehearsalStartedAt,
    rehearsalCompletedAt: TS.rehearsalCompletedAt,
    rehearsalReportGeneratedAt: TS.rehearsalReportGeneratedAt,
    fullPipelineRehearsalStartedAt: TS.fullPipelineRehearsalStartedAt,
    fullPipelineRehearsalCompletedAt: TS.fullPipelineRehearsalCompletedAt,
  });
}

// ─── Group 1: Governance invariants (10 tests) ───────────────────────────────

describe("P46 — Group 1: governance invariants", () => {
  let result: PaperSimulationDryRunFullPipelineRehearsalResult;

  beforeAll(() => {
    result = makeFullPipelineRehearsal();
  });

  it("dryRunOnly is true", () => {
    expect(result.dryRunOnly).toBe(true);
  });

  it("paperOnly is true", () => {
    expect(result.paperOnly).toBe(true);
  });

  it("noActualMetrics is true", () => {
    expect(result.noActualMetrics).toBe(true);
  });

  it("entersAlphaScore is false", () => {
    expect(result.entersAlphaScore).toBe(false);
  });

  it("noAlphaScore is true", () => {
    expect(result.noAlphaScore).toBe(true);
  });

  it("noPnL is true", () => {
    expect(result.noPnL).toBe(true);
  });

  it("noROI is true", () => {
    expect(result.noROI).toBe(true);
  });

  it("noWinRate is true", () => {
    expect(result.noWinRate).toBe(true);
  });

  it("noRealExecution is true", () => {
    expect(result.noRealExecution).toBe(true);
  });

  it("executedAt is null", () => {
    expect(result.executedAt).toBeNull();
  });
});

// ─── Group 2: runDryRunFullPipelineRehearsal produces valid result (16 tests) ─

describe("P46 — Group 2: runDryRunFullPipelineRehearsal produces valid result", () => {
  let result: PaperSimulationDryRunFullPipelineRehearsalResult;

  beforeAll(() => {
    result = makeFullPipelineRehearsal();
  });

  it("phase is P46", () => {
    expect(result.phase).toBe("P46");
  });

  it("version matches PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION", () => {
    expect(result.version).toBe(
      PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION
    );
  });

  it("executionStatus matches P46_EXECUTION_STATUS", () => {
    expect(result.executionStatus).toBe(P46_EXECUTION_STATUS);
  });

  it("executionStatus is EXECUTION_LIFECYCLE_RUNNER_FULL_PIPELINE_REHEARSAL_READY", () => {
    expect(result.executionStatus).toBe(
      "EXECUTION_LIFECYCLE_RUNNER_FULL_PIPELINE_REHEARSAL_READY"
    );
  });

  it("stubResult is DRY_RUN_STUB_ONLY", () => {
    expect(result.stubResult).toBe(DRY_RUN_STUB_RESULT);
  });

  it("fullPipelineRehearsalId starts with p46-full-pipeline-rehearsal-", () => {
    expect(result.fullPipelineRehearsalId).toMatch(
      /^p46-full-pipeline-rehearsal-/
    );
  });

  it("rehearsalId starts with p45-rehearsal-", () => {
    expect(result.rehearsalId).toMatch(/^p45-rehearsal-/);
  });

  it("integrationId starts with p44-integration-", () => {
    expect(result.integrationId).toMatch(/^p44-integration-/);
  });

  it("runnerId starts with p43-runner-", () => {
    expect(result.runnerId).toMatch(/^p43-runner-/);
  });

  it("runId is a non-empty string", () => {
    expect(typeof result.runId).toBe("string");
    expect(result.runId.length).toBeGreaterThan(0);
  });

  it("fullPipelineRehearsalStepsCompleted is 2", () => {
    expect(result.fullPipelineRehearsalStepsCompleted).toBe(2);
  });

  it("fullPipelineRehearsalStepsTotal is 2", () => {
    expect(result.fullPipelineRehearsalStepsTotal).toBe(2);
  });

  it("rehearsalStepsCompleted is 2", () => {
    expect(result.rehearsalStepsCompleted).toBe(2);
  });

  it("pipelineStepsCompleted is 5", () => {
    expect(result.pipelineStepsCompleted).toBe(5);
  });

  it("fullPipelineRehearsalStartedAt matches input", () => {
    expect(result.fullPipelineRehearsalStartedAt).toBe(
      TS.fullPipelineRehearsalStartedAt
    );
  });

  it("fullPipelineRehearsalCompletedAt matches input", () => {
    expect(result.fullPipelineRehearsalCompletedAt).toBe(
      TS.fullPipelineRehearsalCompletedAt
    );
  });
});

// ─── Group 3: rejects invalid input (8 tests) ────────────────────────────────

describe("P46 — Group 3: rejects invalid input", () => {
  const validInput = () => ({
    bundle: makeBundle(),
    generatedAt: TS.generatedAt,
    requestedAt: TS.requestedAt,
    startedAt: TS.startedAt,
    completedAt: TS.completedAt,
    reportGeneratedAt: TS.reportGeneratedAt,
    integrationStartedAt: TS.integrationStartedAt,
    integrationCompletedAt: TS.integrationCompletedAt,
    integrationReportGeneratedAt: TS.integrationReportGeneratedAt,
    rehearsalStartedAt: TS.rehearsalStartedAt,
    rehearsalCompletedAt: TS.rehearsalCompletedAt,
    rehearsalReportGeneratedAt: TS.rehearsalReportGeneratedAt,
    fullPipelineRehearsalStartedAt: TS.fullPipelineRehearsalStartedAt,
    fullPipelineRehearsalCompletedAt: TS.fullPipelineRehearsalCompletedAt,
  });

  it("throws on empty generatedAt", () => {
    expect(() =>
      runDryRunFullPipelineRehearsal({ ...validInput(), generatedAt: "" })
    ).toThrow();
  });

  it("error message mentions generatedAt for empty generatedAt", () => {
    expect(() =>
      runDryRunFullPipelineRehearsal({ ...validInput(), generatedAt: "" })
    ).toThrow(/generatedAt/);
  });

  it("throws on empty requestedAt", () => {
    expect(() =>
      runDryRunFullPipelineRehearsal({ ...validInput(), requestedAt: "" })
    ).toThrow();
  });

  it("throws on empty startedAt", () => {
    expect(() =>
      runDryRunFullPipelineRehearsal({ ...validInput(), startedAt: "" })
    ).toThrow();
  });

  it("throws on empty fullPipelineRehearsalStartedAt", () => {
    expect(() =>
      runDryRunFullPipelineRehearsal({
        ...validInput(),
        fullPipelineRehearsalStartedAt: "",
      })
    ).toThrow();
  });

  it("throws on empty fullPipelineRehearsalCompletedAt", () => {
    expect(() =>
      runDryRunFullPipelineRehearsal({
        ...validInput(),
        fullPipelineRehearsalCompletedAt: "",
      })
    ).toThrow();
  });

  it("throws on empty rehearsalReportGeneratedAt", () => {
    expect(() =>
      runDryRunFullPipelineRehearsal({
        ...validInput(),
        rehearsalReportGeneratedAt: "",
      })
    ).toThrow();
  });

  it("throws on empty integrationReportGeneratedAt", () => {
    expect(() =>
      runDryRunFullPipelineRehearsal({
        ...validInput(),
        integrationReportGeneratedAt: "",
      })
    ).toThrow();
  });
});

// ─── Group 4: rehearsal embedded correctly (8 tests) ─────────────────────────

describe("P46 — Group 4: rehearsal embedded correctly", () => {
  let result: PaperSimulationDryRunFullPipelineRehearsalResult;

  beforeAll(() => {
    result = makeFullPipelineRehearsal();
  });

  it("rehearsalResult.phase is P45", () => {
    expect(result.rehearsalResult.phase).toBe("P45");
  });

  it("rehearsalResult.executionStatus is EXECUTION_LIFECYCLE_RUNNER_INTEGRATION_REHEARSAL_READY", () => {
    expect(result.rehearsalResult.executionStatus).toBe(
      "EXECUTION_LIFECYCLE_RUNNER_INTEGRATION_REHEARSAL_READY"
    );
  });

  it("rehearsalReport.phase is P45", () => {
    expect(result.rehearsalReport.phase).toBe("P45");
  });

  it("rehearsalReport.isRehearsalReport is true", () => {
    expect(result.rehearsalReport.isRehearsalReport).toBe(true);
  });

  it("rehearsalReport.executedAt is null", () => {
    expect(result.rehearsalReport.executedAt).toBeNull();
  });

  it("rehearsalResult.integrationResult.phase is P44", () => {
    expect(result.rehearsalResult.integrationResult.phase).toBe("P44");
  });

  it("rehearsalResult.integrationResult.runnerReport.phase is P43", () => {
    expect(
      result.rehearsalResult.integrationResult.runnerReport.phase
    ).toBe("P43");
  });

  it("rehearsalResult.integrationResult.runnerReport.finalState is COMPLETE", () => {
    expect(
      result.rehearsalResult.integrationResult.runnerReport.finalState
    ).toBe("COMPLETE");
  });
});

// ─── Group 5: full pipeline rehearsal report basic validation (8 tests) ───────

describe("P46 — Group 5: full pipeline rehearsal report basic validation", () => {
  let result: PaperSimulationDryRunFullPipelineRehearsalResult;

  beforeAll(() => {
    result = makeFullPipelineRehearsal();
  });

  it("buildFullPipelineRehearsalReport phase is P46", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.phase).toBe("P46");
  });

  it("isFullPipelineRehearsalReport is true", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.isFullPipelineRehearsalReport).toBe(true);
  });

  it("report executedAt is null", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.executedAt).toBeNull();
  });

  it("report dryRunOnly is true", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.dryRunOnly).toBe(true);
  });

  it("report entersAlphaScore is false", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.entersAlphaScore).toBe(false);
  });

  it("report noRealExecution is true", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.noRealExecution).toBe(true);
  });

  it("fullPipelineRehearsalReportId starts with p46-full-pipeline-rehearsal-report-", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.fullPipelineRehearsalReportId).toMatch(
      /^p46-full-pipeline-rehearsal-report-/
    );
  });

  it("buildFullPipelineRehearsalReport throws if reportGeneratedAt is empty", () => {
    expect(() => buildFullPipelineRehearsalReport(result, "")).toThrow();
  });
});

// ─── Group 6: full pipeline rehearsal report field correctness (8 tests) ──────

describe("P46 — Group 6: full pipeline rehearsal report field correctness", () => {
  let result: PaperSimulationDryRunFullPipelineRehearsalResult;

  beforeAll(() => {
    result = makeFullPipelineRehearsal();
  });

  it("report fullPipelineRehearsalId matches result", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.fullPipelineRehearsalId).toBe(result.fullPipelineRehearsalId);
  });

  it("report rehearsalId matches result.rehearsalId", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.rehearsalId).toBe(result.rehearsalId);
  });

  it("report integrationId matches result.integrationId", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.integrationId).toBe(result.integrationId);
  });

  it("report fullPipelineRehearsalStepsCompleted is 2", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.fullPipelineRehearsalStepsCompleted).toBe(2);
  });

  it("report fullPipelineRehearsalStepsTotal is 2", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.fullPipelineRehearsalStepsTotal).toBe(2);
  });

  it("report rehearsalStepsCompleted is 2", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.rehearsalStepsCompleted).toBe(2);
  });

  it("report pipelineStepsCompleted is 5", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.pipelineStepsCompleted).toBe(5);
  });

  it("report fullPipelineRehearsalStartedAt matches result", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.fullPipelineRehearsalStartedAt).toBe(
      result.fullPipelineRehearsalStartedAt
    );
  });
});

// ─── Group 7: no forbidden fields (8 tests) ──────────────────────────────────

describe("P46 — Group 7: no forbidden fields", () => {
  let result: PaperSimulationDryRunFullPipelineRehearsalResult;

  beforeAll(() => {
    result = makeFullPipelineRehearsal();
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
    expect(
      (result as Record<string, unknown>)["recommendation"]
    ).toBeUndefined();
  });

  it("no prediction field", () => {
    expect((result as Record<string, unknown>)["prediction"]).toBeUndefined();
  });

  it("no backtestResult field", () => {
    expect(
      (result as Record<string, unknown>)["backtestResult"]
    ).toBeUndefined();
  });
});

// ─── Group 8: boundary protection and error handling (8 tests) ───────────────

describe("P46 — Group 8: boundary protection and error handling", () => {
  let result: PaperSimulationDryRunFullPipelineRehearsalResult;

  beforeAll(() => {
    result = makeFullPipelineRehearsal();
  });

  it("throws [P46] for empty generatedAt", () => {
    const bundle = makeBundle();
    expect(() =>
      runDryRunFullPipelineRehearsal({
        bundle,
        generatedAt: "",
        requestedAt: TS.requestedAt,
        startedAt: TS.startedAt,
        completedAt: TS.completedAt,
        reportGeneratedAt: TS.reportGeneratedAt,
        integrationStartedAt: TS.integrationStartedAt,
        integrationCompletedAt: TS.integrationCompletedAt,
        integrationReportGeneratedAt: TS.integrationReportGeneratedAt,
        rehearsalStartedAt: TS.rehearsalStartedAt,
        rehearsalCompletedAt: TS.rehearsalCompletedAt,
        rehearsalReportGeneratedAt: TS.rehearsalReportGeneratedAt,
        fullPipelineRehearsalStartedAt: TS.fullPipelineRehearsalStartedAt,
        fullPipelineRehearsalCompletedAt: TS.fullPipelineRehearsalCompletedAt,
      })
    ).toThrow(/\[P46\]/);
  });

  it("fullPipelineRehearsalId starts with p46-full-pipeline-rehearsal-", () => {
    expect(result.fullPipelineRehearsalId).toMatch(
      /^p46-full-pipeline-rehearsal-/
    );
  });

  it("rehearsalReport.runnerId starts with p43-runner-", () => {
    expect(result.rehearsalReport.runnerId).toMatch(/^p43-runner-/);
  });

  it("all runner log entries have phase P42", () => {
    const entries =
      result.rehearsalResult.integrationResult.runnerResult.log;
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.phase).toBe("P42");
    }
  });

  it("all runner log entries have stubOnly true", () => {
    const entries =
      result.rehearsalResult.integrationResult.runnerResult.log;
    for (const entry of entries) {
      expect(entry.stubOnly).toBe(true);
    }
  });

  it("full pipeline rehearsal result is frozen", () => {
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("full pipeline rehearsal report is frozen", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(Object.isFrozen(report)).toBe(true);
  });

  it("stubResult matches DRY_RUN_STUB_RESULT constant", () => {
    expect(result.stubResult).toBe(DRY_RUN_STUB_RESULT);
    expect(result.stubResult).toBe("DRY_RUN_STUB_ONLY");
  });
});

// ─── Group 9: constants and version strings (8 tests) ────────────────────────

describe("P46 — Group 9: constants and version strings", () => {
  it("PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION starts with p46", () => {
    expect(
      PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION
    ).toMatch(/^p46/);
  });

  it("PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION contains full-pipeline-rehearsal", () => {
    expect(
      PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION
    ).toContain("full-pipeline-rehearsal");
  });

  it("PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_REPORT_VERSION starts with p46", () => {
    expect(
      PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_REPORT_VERSION
    ).toMatch(/^p46/);
  });

  it("PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_REPORT_VERSION contains full-pipeline-rehearsal-report", () => {
    expect(
      PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_REPORT_VERSION
    ).toContain("full-pipeline-rehearsal-report");
  });

  it("P46_EXECUTION_STATUS is EXECUTION_LIFECYCLE_RUNNER_FULL_PIPELINE_REHEARSAL_READY", () => {
    expect(P46_EXECUTION_STATUS).toBe(
      "EXECUTION_LIFECYCLE_RUNNER_FULL_PIPELINE_REHEARSAL_READY"
    );
  });

  it("PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION is JSON-serializable", () => {
    expect(() =>
      JSON.stringify(PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_VERSION)
    ).not.toThrow();
  });

  it("PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_REPORT_VERSION is JSON-serializable", () => {
    expect(() =>
      JSON.stringify(
        PAPER_SIMULATION_DRY_RUN_FULL_PIPELINE_REHEARSAL_REPORT_VERSION
      )
    ).not.toThrow();
  });

  it("P46_FULL_PIPELINE_REHEARSAL_STEPS_TOTAL is 2", () => {
    expect(P46_FULL_PIPELINE_REHEARSAL_STEPS_TOTAL).toBe(2);
  });
});

// ─── Group 10: no forbidden exports from FullPipelineRehearsal module (8 tests)

describe("P46 — Group 10: no forbidden exports from FullPipelineRehearsal module", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require("../p46/PaperSimulationDryRunFullPipelineRehearsal");

  it("no executeSimulation export", () => {
    expect(module.executeSimulation).toBeUndefined();
  });

  it("no computePnL export", () => {
    expect(module.computePnL).toBeUndefined();
  });

  it("no computeROI export", () => {
    expect(module.computeROI).toBeUndefined();
  });

  it("no runSimulation export", () => {
    expect(module.runSimulation).toBeUndefined();
  });

  it("no computeWinRate export", () => {
    expect(module.computeWinRate).toBeUndefined();
  });

  it("no generateRecommendation export", () => {
    expect(module.generateRecommendation).toBeUndefined();
  });

  it("no runBacktest export", () => {
    expect(module.runBacktest).toBeUndefined();
  });

  it("no runOptimizer export", () => {
    expect(module.runOptimizer).toBeUndefined();
  });
});

// ─── Group 11: full end-to-end pipeline verification (8 tests) ───────────────

describe("P46 — Group 11: full end-to-end pipeline verification", () => {
  let result: PaperSimulationDryRunFullPipelineRehearsalResult;

  beforeAll(() => {
    result = makeFullPipelineRehearsal();
  });

  it("rehearsalResult is defined and not null", () => {
    expect(result.rehearsalResult).toBeDefined();
    expect(result.rehearsalResult).not.toBeNull();
  });

  it("rehearsalResult.integrationResult.runnerReport.transitionCount is 2", () => {
    expect(
      result.rehearsalResult.integrationResult.runnerReport.transitionCount
    ).toBe(2);
  });

  it("rehearsalResult.integrationResult.runnerReport.logEntryCount is 4", () => {
    expect(
      result.rehearsalResult.integrationResult.runnerReport.logEntryCount
    ).toBe(4);
  });

  it("rehearsalReport.pipelineStepsCompleted is 5", () => {
    expect(result.rehearsalReport.pipelineStepsCompleted).toBe(5);
  });

  it("full pipeline rehearsal result phase is P46", () => {
    expect(result.phase).toBe("P46");
  });

  it("fullPipelineRehearsalId starts with p46-full-pipeline-rehearsal-", () => {
    expect(result.fullPipelineRehearsalId).toMatch(
      /^p46-full-pipeline-rehearsal-/
    );
  });

  it("buildFullPipelineRehearsalReport produces id starting with p46-full-pipeline-rehearsal-report-", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(report.fullPipelineRehearsalReportId).toMatch(
      /^p46-full-pipeline-rehearsal-report-/
    );
  });

  it("full pipeline rehearsal report is frozen", () => {
    const report = buildFullPipelineRehearsalReport(
      result,
      TS.fullPipelineRehearsalReportGeneratedAt
    );
    expect(Object.isFrozen(report)).toBe(true);
  });
});
