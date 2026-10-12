/**
 * P43 — Paper Simulation Dry-run Lifecycle Runner Tests
 *
 * 98 tests across 11 groups.
 *
 * GOVERNANCE:
 * - entersAlphaScore = false
 * - paperOnly = true
 * - dryRunOnly = true
 * - noActualMetrics = true
 * - noRealExecution = true
 * - executedAt = null
 * - stubResult = DRY_RUN_STUB_ONLY
 * - No Prisma, DB, scoring import
 *
 * Authorization:
 *   YES design paper simulation dry-run lifecycle runner for P43
 */

import {
  P43_EXECUTION_STATUS,
  PAPER_SIMULATION_DRY_RUN_LIFECYCLE_RUNNER_VERSION,
  runDryRunLifecycle,
} from "../p43/PaperSimulationDryRunLifecycleRunner";
import type {
  PaperSimulationDryRunRunnerResult,
} from "../p43/PaperSimulationDryRunLifecycleRunner";
import {
  PAPER_SIMULATION_DRY_RUN_RUNNER_REPORT_VERSION,
  buildRunnerReport,
} from "../p43/PaperSimulationDryRunRunnerReport";
import {
  createDryRunLifecycle,
  transitionLifecycle,
  cancelLifecycle,
  isTerminalState,
} from "../p42/PaperSimulationDryRunLifecycle";
import type {
  PaperSimulationDryRunLifecycleState,
} from "../p42/PaperSimulationDryRunLifecycle";
import {
  DRY_RUN_STUB_RESULT,
} from "../p41/PaperSimulationDryRunContract";
import {
  runPaperSimulationDryRun,
} from "../p41/PaperSimulationDryRunRunner";
import {
  createPaperSimulationFrameworkPlan,
} from "../p40/PaperSimulationFrameworkBoundary";
import {
  buildDefaultPaperSimulationInputBundle,
} from "../p39/PaperSimulationInputContractBuilder";
import type {
  PaperSimulationDryRunResult,
} from "../p41/PaperSimulationDryRunContract";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDryRunResult(): PaperSimulationDryRunResult {
  const bundle = buildDefaultPaperSimulationInputBundle({
    generatedAt: "2026-05-21T00:00:00.000Z",
  });
  const plan = createPaperSimulationFrameworkPlan(bundle, {
    generatedAt: "2026-05-21T00:00:00.000Z",
  });
  return runPaperSimulationDryRun({
    plan,
    mode: "stub-only",
    requestedAt: "2026-05-21T00:00:00.000Z",
  });
}

function makeLifecycle(): PaperSimulationDryRunLifecycleState {
  return createDryRunLifecycle({
    dryRunResult: makeDryRunResult(),
    createdAt: "2026-05-21T00:00:00.000Z",
  });
}

function makeRunnerResult(): PaperSimulationDryRunRunnerResult {
  return runDryRunLifecycle({
    lifecycle: makeLifecycle(),
    startedAt: "2026-05-21T01:00:00.000Z",
    completedAt: "2026-05-21T02:00:00.000Z",
  });
}

// ─── Group 1: P43 runner governance invariants ────────────────────────────────

describe("Group 1 — P43 runner governance invariants", () => {
  let res: PaperSimulationDryRunRunnerResult;

  beforeEach(() => { res = makeRunnerResult(); });

  test("1.1 dryRunOnly is true", () => {
    expect(res.dryRunOnly).toBe(true);
  });

  test("1.2 paperOnly is true", () => {
    expect(res.paperOnly).toBe(true);
  });

  test("1.3 noActualMetrics is true", () => {
    expect(res.noActualMetrics).toBe(true);
  });

  test("1.4 entersAlphaScore is false", () => {
    expect(res.entersAlphaScore).toBe(false);
  });

  test("1.5 noAlphaScore is true", () => {
    expect(res.noAlphaScore).toBe(true);
  });

  test("1.6 noPnL is true", () => {
    expect(res.noPnL).toBe(true);
  });

  test("1.7 noROI is true", () => {
    expect(res.noROI).toBe(true);
  });

  test("1.8 noWinRate is true", () => {
    expect(res.noWinRate).toBe(true);
  });

  test("1.9 noRealExecution is true", () => {
    expect(res.noRealExecution).toBe(true);
  });

  test("1.10 executedAt is null", () => {
    expect(res.executedAt).toBeNull();
  });
});

// ─── Group 2: runDryRunLifecycle produces valid runner result ─────────────────

describe("Group 2 — runDryRunLifecycle produces valid runner result", () => {
  test("2.1 phase is P43", () => {
    expect(makeRunnerResult().phase).toBe("P43");
  });

  test("2.2 version is PAPER_SIMULATION_DRY_RUN_LIFECYCLE_RUNNER_VERSION", () => {
    expect(makeRunnerResult().version).toBe(PAPER_SIMULATION_DRY_RUN_LIFECYCLE_RUNNER_VERSION);
  });

  test("2.3 executionStatus is EXECUTION_LIFECYCLE_RUNNER_READY", () => {
    expect(makeRunnerResult().executionStatus).toBe("EXECUTION_LIFECYCLE_RUNNER_READY");
  });

  test("2.4 executionStatus matches P43_EXECUTION_STATUS", () => {
    expect(makeRunnerResult().executionStatus).toBe(P43_EXECUTION_STATUS);
  });

  test("2.5 stubResult is DRY_RUN_STUB_ONLY", () => {
    expect(makeRunnerResult().stubResult).toBe("DRY_RUN_STUB_ONLY");
  });

  test("2.6 stubResult matches DRY_RUN_STUB_RESULT", () => {
    expect(makeRunnerResult().stubResult).toBe(DRY_RUN_STUB_RESULT);
  });

  test("2.7 initialState is PENDING", () => {
    expect(makeRunnerResult().initialState).toBe("PENDING");
  });

  test("2.8 finalState is COMPLETE", () => {
    expect(makeRunnerResult().finalState).toBe("COMPLETE");
  });

  test("2.9 runnerId starts with p43-runner", () => {
    expect(makeRunnerResult().runnerId).toMatch(/^p43-runner-/);
  });

  test("2.10 lifecycleId matches input lifecycle.lifecycleId", () => {
    const lc = makeLifecycle();
    const res = runDryRunLifecycle({ lifecycle: lc, startedAt: "S", completedAt: "C" });
    expect(res.lifecycleId).toBe(lc.lifecycleId);
  });

  test("2.11 runId matches input lifecycle.runId", () => {
    const lc = makeLifecycle();
    const res = runDryRunLifecycle({ lifecycle: lc, startedAt: "S", completedAt: "C" });
    expect(res.runId).toBe(lc.runId);
  });

  test("2.12 startedAt is preserved", () => {
    const res = runDryRunLifecycle({
      lifecycle: makeLifecycle(),
      startedAt: "2026-05-21T01:00:00.000Z",
      completedAt: "2026-05-21T02:00:00.000Z",
    });
    expect(res.startedAt).toBe("2026-05-21T01:00:00.000Z");
  });

  test("2.13 completedAt is preserved", () => {
    const res = runDryRunLifecycle({
      lifecycle: makeLifecycle(),
      startedAt: "2026-05-21T01:00:00.000Z",
      completedAt: "2026-05-21T02:00:00.000Z",
    });
    expect(res.completedAt).toBe("2026-05-21T02:00:00.000Z");
  });

  test("2.14 p42Version matches input lifecycle.version", () => {
    const lc = makeLifecycle();
    const res = runDryRunLifecycle({ lifecycle: lc, startedAt: "S", completedAt: "C" });
    expect(res.p42Version).toBe(lc.version);
  });
});

// ─── Group 3: runDryRunLifecycle rejects invalid input ────────────────────────

describe("Group 3 — runDryRunLifecycle rejects invalid input", () => {
  test("3.1 throws if lifecycle.dryRunOnly is false", () => {
    const bad = { ...makeLifecycle(), dryRunOnly: false } as unknown as PaperSimulationDryRunLifecycleState;
    expect(() =>
      runDryRunLifecycle({ lifecycle: bad, startedAt: "S", completedAt: "C" })
    ).toThrow("[P43] RunnerBoundaryViolation");
  });

  test("3.2 error message mentions dryRunOnly", () => {
    const bad = { ...makeLifecycle(), dryRunOnly: false } as unknown as PaperSimulationDryRunLifecycleState;
    expect(() =>
      runDryRunLifecycle({ lifecycle: bad, startedAt: "S", completedAt: "C" })
    ).toThrow("dryRunOnly");
  });

  test("3.3 throws if lifecycle.executedAt is non-null", () => {
    const bad = { ...makeLifecycle(), executedAt: "2026-05-21T00:00:00.000Z" } as unknown as PaperSimulationDryRunLifecycleState;
    expect(() =>
      runDryRunLifecycle({ lifecycle: bad, startedAt: "S", completedAt: "C" })
    ).toThrow("[P43] RunnerBoundaryViolation");
  });

  test("3.4 error message mentions executedAt", () => {
    const bad = { ...makeLifecycle(), executedAt: "2026-05-21T00:00:00.000Z" } as unknown as PaperSimulationDryRunLifecycleState;
    expect(() =>
      runDryRunLifecycle({ lifecycle: bad, startedAt: "S", completedAt: "C" })
    ).toThrow("executedAt");
  });

  test("3.5 throws if lifecycle is not in PENDING state", () => {
    const running = transitionLifecycle(makeLifecycle(), "RUNNING", "T");
    expect(() =>
      runDryRunLifecycle({ lifecycle: running, startedAt: "S", completedAt: "C" })
    ).toThrow("[P43] RunnerBoundaryViolation");
  });

  test("3.6 error message mentions PENDING", () => {
    const running = transitionLifecycle(makeLifecycle(), "RUNNING", "T");
    expect(() =>
      runDryRunLifecycle({ lifecycle: running, startedAt: "S", completedAt: "C" })
    ).toThrow("PENDING");
  });

  test("3.7 throws if startedAt is empty", () => {
    expect(() =>
      runDryRunLifecycle({ lifecycle: makeLifecycle(), startedAt: "", completedAt: "C" })
    ).toThrow("[P43] RunnerBoundaryViolation");
  });

  test("3.8 throws if completedAt is empty", () => {
    expect(() =>
      runDryRunLifecycle({ lifecycle: makeLifecycle(), startedAt: "S", completedAt: "" })
    ).toThrow("[P43] RunnerBoundaryViolation");
  });
});

// ─── Group 4: runner lifecycle transitions ────────────────────────────────────

describe("Group 4 — runner lifecycle transitions", () => {
  test("4.1 transitions array has exactly 2 entries", () => {
    expect(makeRunnerResult().transitions).toHaveLength(2);
  });

  test("4.2 first transition is PENDING → RUNNING", () => {
    const t = makeRunnerResult().transitions[0];
    expect(t.from).toBe("PENDING");
    expect(t.to).toBe("RUNNING");
  });

  test("4.3 second transition is RUNNING → COMPLETE", () => {
    const t = makeRunnerResult().transitions[1];
    expect(t.from).toBe("RUNNING");
    expect(t.to).toBe("COMPLETE");
  });

  test("4.4 first transition transitionedAt equals startedAt", () => {
    const res = runDryRunLifecycle({
      lifecycle: makeLifecycle(),
      startedAt: "2026-05-21T01:00:00.000Z",
      completedAt: "2026-05-21T02:00:00.000Z",
    });
    expect(res.transitions[0].transitionedAt).toBe("2026-05-21T01:00:00.000Z");
  });

  test("4.5 second transition transitionedAt equals completedAt", () => {
    const res = runDryRunLifecycle({
      lifecycle: makeLifecycle(),
      startedAt: "2026-05-21T01:00:00.000Z",
      completedAt: "2026-05-21T02:00:00.000Z",
    });
    expect(res.transitions[1].transitionedAt).toBe("2026-05-21T02:00:00.000Z");
  });

  test("4.6 finalState is COMPLETE", () => {
    expect(makeRunnerResult().finalState).toBe("COMPLETE");
  });

  test("4.7 initialState is PENDING", () => {
    expect(makeRunnerResult().initialState).toBe("PENDING");
  });

  test("4.8 isTerminalState(finalState) is true", () => {
    expect(isTerminalState(makeRunnerResult().finalState)).toBe(true);
  });
});

// ─── Group 5: runner produces log entries ─────────────────────────────────────

describe("Group 5 — runner produces log entries", () => {
  test("5.1 log is non-empty", () => {
    expect(makeRunnerResult().log.length).toBeGreaterThan(0);
  });

  test("5.2 log has exactly 4 entries", () => {
    expect(makeRunnerResult().log).toHaveLength(4);
  });

  test("5.3 log contains a VALIDATION_PASSED entry", () => {
    const types = makeRunnerResult().log.map(e => e.eventType);
    expect(types).toContain("VALIDATION_PASSED");
  });

  test("5.4 log contains two TRANSITION_COMPLETED entries", () => {
    const types = makeRunnerResult().log.map(e => e.eventType);
    expect(types.filter(t => t === "TRANSITION_COMPLETED")).toHaveLength(2);
  });

  test("5.5 log contains a BOUNDARY_CHECK_PASSED entry", () => {
    const types = makeRunnerResult().log.map(e => e.eventType);
    expect(types).toContain("BOUNDARY_CHECK_PASSED");
  });

  test("5.6 all log entries have phase P42", () => {
    makeRunnerResult().log.forEach(e => expect(e.phase).toBe("P42"));
  });

  test("5.7 all log entries have stubOnly=true", () => {
    makeRunnerResult().log.forEach(e => expect(e.stubOnly).toBe(true));
  });

  test("5.8 all log entries have noExecution=true", () => {
    makeRunnerResult().log.forEach(e => expect(e.noExecution).toBe(true));
  });
});

// ─── Group 6: runner rejects non-PENDING input lifecycle ──────────────────────

describe("Group 6 — runner rejects non-PENDING input lifecycle", () => {
  test("6.1 throws if lifecycle is in RUNNING state", () => {
    const running = transitionLifecycle(makeLifecycle(), "RUNNING", "T");
    expect(() =>
      runDryRunLifecycle({ lifecycle: running, startedAt: "S", completedAt: "C" })
    ).toThrow("[P43] RunnerBoundaryViolation");
  });

  test("6.2 throws if lifecycle is in COMPLETE state", () => {
    const lc1 = transitionLifecycle(makeLifecycle(), "RUNNING", "T1");
    const complete = transitionLifecycle(lc1, "COMPLETE", "T2");
    expect(() =>
      runDryRunLifecycle({ lifecycle: complete, startedAt: "S", completedAt: "C" })
    ).toThrow("[P43] RunnerBoundaryViolation");
  });

  test("6.3 throws if lifecycle is in CANCELLED state", () => {
    const cancelled = cancelLifecycle(makeLifecycle(), "T");
    expect(() =>
      runDryRunLifecycle({ lifecycle: cancelled, startedAt: "S", completedAt: "C" })
    ).toThrow("[P43] RunnerBoundaryViolation");
  });

  test("6.4 error mentions PENDING for RUNNING input", () => {
    const running = transitionLifecycle(makeLifecycle(), "RUNNING", "T");
    expect(() =>
      runDryRunLifecycle({ lifecycle: running, startedAt: "S", completedAt: "C" })
    ).toThrow("PENDING");
  });

  test("6.5 error mentions PENDING for COMPLETE input", () => {
    const lc1 = transitionLifecycle(makeLifecycle(), "RUNNING", "T1");
    const complete = transitionLifecycle(lc1, "COMPLETE", "T2");
    expect(() =>
      runDryRunLifecycle({ lifecycle: complete, startedAt: "S", completedAt: "C" })
    ).toThrow("PENDING");
  });

  test("6.6 error mentions PENDING for CANCELLED input", () => {
    const cancelled = cancelLifecycle(makeLifecycle(), "T");
    expect(() =>
      runDryRunLifecycle({ lifecycle: cancelled, startedAt: "S", completedAt: "C" })
    ).toThrow("PENDING");
  });

  test("6.7 error is [P43] RunnerBoundaryViolation", () => {
    const running = transitionLifecycle(makeLifecycle(), "RUNNING", "T");
    expect(() =>
      runDryRunLifecycle({ lifecycle: running, startedAt: "S", completedAt: "C" })
    ).toThrow("[P43] RunnerBoundaryViolation");
  });

  test("6.8 original lifecycle is unchanged after failed run", () => {
    const lc = makeLifecycle();
    const running = transitionLifecycle(lc, "RUNNING", "T");
    try {
      runDryRunLifecycle({ lifecycle: running, startedAt: "S", completedAt: "C" });
    } catch {
      // expected
    }
    // running state is still RUNNING (not mutated)
    expect(running.state).toBe("RUNNING");
  });
});

// ─── Group 7: buildRunnerReport creates valid report ──────────────────────────

describe("Group 7 — buildRunnerReport creates valid report", () => {
  const GENERATED_AT = "2026-05-21T03:00:00.000Z";

  test("7.1 report.phase is P43", () => {
    expect(buildRunnerReport(makeRunnerResult(), GENERATED_AT).phase).toBe("P43");
  });

  test("7.2 report.version is PAPER_SIMULATION_DRY_RUN_RUNNER_REPORT_VERSION", () => {
    expect(buildRunnerReport(makeRunnerResult(), GENERATED_AT).version)
      .toBe(PAPER_SIMULATION_DRY_RUN_RUNNER_REPORT_VERSION);
  });

  test("7.3 report.reportId starts with p43-report", () => {
    expect(buildRunnerReport(makeRunnerResult(), GENERATED_AT).reportId).toMatch(/^p43-report-/);
  });

  test("7.4 report.isStubReport is true", () => {
    expect(buildRunnerReport(makeRunnerResult(), GENERATED_AT).isStubReport).toBe(true);
  });

  test("7.5 report.executedAt is null", () => {
    expect(buildRunnerReport(makeRunnerResult(), GENERATED_AT).executedAt).toBeNull();
  });

  test("7.6 report.dryRunOnly is true", () => {
    expect(buildRunnerReport(makeRunnerResult(), GENERATED_AT).dryRunOnly).toBe(true);
  });

  test("7.7 report.entersAlphaScore is false", () => {
    expect(buildRunnerReport(makeRunnerResult(), GENERATED_AT).entersAlphaScore).toBe(false);
  });

  test("7.8 report.noRealExecution is true", () => {
    expect(buildRunnerReport(makeRunnerResult(), GENERATED_AT).noRealExecution).toBe(true);
  });
});

// ─── Group 8: report field correctness ───────────────────────────────────────

describe("Group 8 — report field correctness", () => {
  const GENERATED_AT = "2026-05-21T03:00:00.000Z";

  test("8.1 report.initialState is PENDING", () => {
    expect(buildRunnerReport(makeRunnerResult(), GENERATED_AT).initialState).toBe("PENDING");
  });

  test("8.2 report.finalState is COMPLETE", () => {
    expect(buildRunnerReport(makeRunnerResult(), GENERATED_AT).finalState).toBe("COMPLETE");
  });

  test("8.3 report.transitionCount is 2", () => {
    expect(buildRunnerReport(makeRunnerResult(), GENERATED_AT).transitionCount).toBe(2);
  });

  test("8.4 report.logEntryCount is 4", () => {
    expect(buildRunnerReport(makeRunnerResult(), GENERATED_AT).logEntryCount).toBe(4);
  });

  test("8.5 report.runnerId matches runner result", () => {
    const res = makeRunnerResult();
    const report = buildRunnerReport(res, GENERATED_AT);
    expect(report.runnerId).toBe(res.runnerId);
  });

  test("8.6 report.lifecycleId matches lifecycle", () => {
    const lc = makeLifecycle();
    const res = runDryRunLifecycle({ lifecycle: lc, startedAt: "S", completedAt: "C" });
    const report = buildRunnerReport(res, GENERATED_AT);
    expect(report.lifecycleId).toBe(lc.lifecycleId);
  });

  test("8.7 report.startedAt matches runner startedAt", () => {
    const res = runDryRunLifecycle({
      lifecycle: makeLifecycle(),
      startedAt: "2026-05-21T01:00:00.000Z",
      completedAt: "2026-05-21T02:00:00.000Z",
    });
    expect(buildRunnerReport(res, GENERATED_AT).startedAt).toBe("2026-05-21T01:00:00.000Z");
  });

  test("8.8 buildRunnerReport throws if reportGeneratedAt is empty", () => {
    expect(() =>
      buildRunnerReport(makeRunnerResult(), "")
    ).toThrow("[P43] ReportBoundaryViolation");
  });
});

// ─── Group 9: no forbidden fields in runner result / report ───────────────────

describe("Group 9 — no forbidden execution fields in runner result", () => {
  const obj = makeRunnerResult() as unknown as Record<string, unknown>;

  test("9.1 no pnl field", () => { expect("pnl" in obj).toBe(false); });
  test("9.2 no roi field", () => { expect("roi" in obj).toBe(false); });
  test("9.3 no ROI field", () => { expect("ROI" in obj).toBe(false); });
  test("9.4 no winRate field", () => { expect("winRate" in obj).toBe(false); });
  test("9.5 no alphaScore field", () => { expect("alphaScore" in obj).toBe(false); });
  test("9.6 no recommendation field", () => { expect("recommendation" in obj).toBe(false); });
  test("9.7 no prediction field", () => { expect("prediction" in obj).toBe(false); });
  test("9.8 no backtestResult field", () => { expect("backtestResult" in obj).toBe(false); });
});

// ─── Group 10: constants, version strings, and immutability ───────────────────

describe("Group 10 — constants, version strings, and immutability", () => {
  test("10.1 PAPER_SIMULATION_DRY_RUN_LIFECYCLE_RUNNER_VERSION starts with p43", () => {
    expect(PAPER_SIMULATION_DRY_RUN_LIFECYCLE_RUNNER_VERSION).toMatch(/^p43-/);
  });

  test("10.2 PAPER_SIMULATION_DRY_RUN_LIFECYCLE_RUNNER_VERSION contains lifecycle-runner", () => {
    expect(PAPER_SIMULATION_DRY_RUN_LIFECYCLE_RUNNER_VERSION).toContain("lifecycle-runner");
  });

  test("10.3 PAPER_SIMULATION_DRY_RUN_RUNNER_REPORT_VERSION starts with p43", () => {
    expect(PAPER_SIMULATION_DRY_RUN_RUNNER_REPORT_VERSION).toMatch(/^p43-/);
  });

  test("10.4 PAPER_SIMULATION_DRY_RUN_RUNNER_REPORT_VERSION contains runner-report", () => {
    expect(PAPER_SIMULATION_DRY_RUN_RUNNER_REPORT_VERSION).toContain("runner-report");
  });

  test("10.5 P43_EXECUTION_STATUS is EXECUTION_LIFECYCLE_RUNNER_READY", () => {
    expect(P43_EXECUTION_STATUS).toBe("EXECUTION_LIFECYCLE_RUNNER_READY");
  });

  test("10.6 runner result is JSON-serializable", () => {
    expect(() => JSON.stringify(makeRunnerResult())).not.toThrow();
  });

  test("10.7 runner report is JSON-serializable", () => {
    const report = buildRunnerReport(makeRunnerResult(), "2026-05-21T03:00:00.000Z");
    expect(() => JSON.stringify(report)).not.toThrow();
  });

  test("10.8 runner result is frozen", () => {
    expect(Object.isFrozen(makeRunnerResult())).toBe(true);
  });

  test("10.9 runner report is frozen", () => {
    const report = buildRunnerReport(makeRunnerResult(), "2026-05-21T03:00:00.000Z");
    expect(Object.isFrozen(report)).toBe(true);
  });

  test("10.10 stubResult in result matches DRY_RUN_STUB_RESULT", () => {
    expect(makeRunnerResult().stubResult).toBe(DRY_RUN_STUB_RESULT);
  });
});

// ─── Group 11: no forbidden exports ──────────────────────────────────────────

describe("Group 11 — No forbidden exports", () => {
  test("11.1 LifecycleRunner does not export executeSimulation", async () => {
    const mod = await import("../p43/PaperSimulationDryRunLifecycleRunner");
    expect("executeSimulation" in mod).toBe(false);
  });

  test("11.2 LifecycleRunner does not export computePnL", async () => {
    const mod = await import("../p43/PaperSimulationDryRunLifecycleRunner");
    expect("computePnL" in mod).toBe(false);
  });

  test("11.3 LifecycleRunner does not export computeROI", async () => {
    const mod = await import("../p43/PaperSimulationDryRunLifecycleRunner");
    expect("computeROI" in mod).toBe(false);
  });

  test("11.4 LifecycleRunner does not export runSimulation", async () => {
    const mod = await import("../p43/PaperSimulationDryRunLifecycleRunner");
    expect("runSimulation" in mod).toBe(false);
  });

  test("11.5 RunnerReport does not export computeWinRate", async () => {
    const mod = await import("../p43/PaperSimulationDryRunRunnerReport");
    expect("computeWinRate" in mod).toBe(false);
  });

  test("11.6 RunnerReport does not export generateRecommendation", async () => {
    const mod = await import("../p43/PaperSimulationDryRunRunnerReport");
    expect("generateRecommendation" in mod).toBe(false);
  });

  test("11.7 RunnerReport does not export runBacktest", async () => {
    const mod = await import("../p43/PaperSimulationDryRunRunnerReport");
    expect("runBacktest" in mod).toBe(false);
  });

  test("11.8 RunnerReport does not export runOptimizer", async () => {
    const mod = await import("../p43/PaperSimulationDryRunRunnerReport");
    expect("runOptimizer" in mod).toBe(false);
  });
});
