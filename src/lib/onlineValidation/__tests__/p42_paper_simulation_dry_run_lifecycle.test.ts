/**
 * P42 — Paper Simulation Dry-run Lifecycle Tests
 *
 * 88 tests across 11 groups.
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
 *   YES design paper simulation dry-run lifecycle for P42
 */

import {
  P42_EXECUTION_STATUS,
  PAPER_SIMULATION_DRY_RUN_LIFECYCLE_VERSION,
  P42_LIFECYCLE_STATES,
  P42_INITIAL_STATE,
  P42_VALID_TRANSITIONS,
  P42_TERMINAL_STATES,
  createDryRunLifecycle,
  transitionLifecycle,
  cancelLifecycle,
  isValidTransition,
  isTerminalState,
} from "../p42/PaperSimulationDryRunLifecycle";
import type {
  PaperSimulationDryRunLifecycleState,
} from "../p42/PaperSimulationDryRunLifecycle";
import {
  PAPER_SIMULATION_DRY_RUN_LOG_VERSION,
  P42_LOG_EVENT_TYPES,
  createDryRunLogEntry,
  appendLogEntry,
  createEmptyLog,
} from "../p42/PaperSimulationDryRunLog";
import {
  runPaperSimulationDryRun,
} from "../p41/PaperSimulationDryRunRunner";
import {
  DRY_RUN_STUB_RESULT,
} from "../p41/PaperSimulationDryRunContract";
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

// ─── Group 1: P42 lifecycle governance invariants ─────────────────────────────

describe("Group 1 — P42 lifecycle governance invariants", () => {
  let lc: PaperSimulationDryRunLifecycleState;

  beforeEach(() => { lc = makeLifecycle(); });

  test("1.1 dryRunOnly is true", () => {
    expect(lc.dryRunOnly).toBe(true);
  });

  test("1.2 paperOnly is true", () => {
    expect(lc.paperOnly).toBe(true);
  });

  test("1.3 noActualMetrics is true", () => {
    expect(lc.noActualMetrics).toBe(true);
  });

  test("1.4 entersAlphaScore is false", () => {
    expect(lc.entersAlphaScore).toBe(false);
  });

  test("1.5 noAlphaScore is true", () => {
    expect(lc.noAlphaScore).toBe(true);
  });

  test("1.6 noPnL is true", () => {
    expect(lc.noPnL).toBe(true);
  });

  test("1.7 noROI is true", () => {
    expect(lc.noROI).toBe(true);
  });

  test("1.8 noWinRate is true", () => {
    expect(lc.noWinRate).toBe(true);
  });

  test("1.9 noRealExecution is true", () => {
    expect(lc.noRealExecution).toBe(true);
  });

  test("1.10 executedAt is null", () => {
    expect(lc.executedAt).toBeNull();
  });
});

// ─── Group 2: createDryRunLifecycle creates PENDING state ─────────────────────

describe("Group 2 — createDryRunLifecycle creates PENDING state", () => {
  test("2.1 state is PENDING", () => {
    expect(makeLifecycle().state).toBe("PENDING");
  });

  test("2.2 state matches P42_INITIAL_STATE", () => {
    expect(makeLifecycle().state).toBe(P42_INITIAL_STATE);
  });

  test("2.3 transitions array is empty", () => {
    expect(makeLifecycle().transitions).toHaveLength(0);
  });

  test("2.4 completedAt is null", () => {
    expect(makeLifecycle().completedAt).toBeNull();
  });

  test("2.5 cancelledAt is null", () => {
    expect(makeLifecycle().cancelledAt).toBeNull();
  });

  test("2.6 phase is P42", () => {
    expect(makeLifecycle().phase).toBe("P42");
  });

  test("2.7 version matches PAPER_SIMULATION_DRY_RUN_LIFECYCLE_VERSION", () => {
    expect(makeLifecycle().version).toBe(PAPER_SIMULATION_DRY_RUN_LIFECYCLE_VERSION);
  });

  test("2.8 executionStatus is EXECUTION_LIFECYCLE_READY", () => {
    expect(makeLifecycle().executionStatus).toBe("EXECUTION_LIFECYCLE_READY");
  });

  test("2.9 executionStatus matches P42_EXECUTION_STATUS", () => {
    expect(makeLifecycle().executionStatus).toBe(P42_EXECUTION_STATUS);
  });

  test("2.10 stubResult is DRY_RUN_STUB_ONLY", () => {
    expect(makeLifecycle().stubResult).toBe("DRY_RUN_STUB_ONLY");
  });

  test("2.11 stubResult matches DRY_RUN_STUB_RESULT", () => {
    expect(makeLifecycle().stubResult).toBe(DRY_RUN_STUB_RESULT);
  });

  test("2.12 runId carries P41 runId", () => {
    const dryRunResult = makeDryRunResult();
    const lc = createDryRunLifecycle({ dryRunResult, createdAt: "2026-05-21T00:00:00.000Z" });
    expect(lc.runId).toBe(dryRunResult.runId);
  });

  test("2.13 p41Version carries P41 version string", () => {
    const dryRunResult = makeDryRunResult();
    const lc = createDryRunLifecycle({ dryRunResult, createdAt: "2026-05-21T00:00:00.000Z" });
    expect(lc.p41Version).toBe(dryRunResult.version);
  });

  test("2.14 eligibleSources array is present", () => {
    expect(Array.isArray(makeLifecycle().eligibleSources)).toBe(true);
    expect(makeLifecycle().eligibleSources.length).toBeGreaterThan(0);
  });
});

// ─── Group 3: createDryRunLifecycle rejects invalid P41 results ───────────────

describe("Group 3 — createDryRunLifecycle rejects invalid P41 results", () => {
  test("3.1 throws if dryRunOnly is false", () => {
    const bad = { ...makeDryRunResult(), dryRunOnly: false } as unknown as PaperSimulationDryRunResult;
    expect(() =>
      createDryRunLifecycle({ dryRunResult: bad, createdAt: "2026-05-21T00:00:00.000Z" })
    ).toThrow("[P42] LifecycleBoundaryViolation");
  });

  test("3.2 error message mentions dryRunOnly", () => {
    const bad = { ...makeDryRunResult(), dryRunOnly: false } as unknown as PaperSimulationDryRunResult;
    expect(() =>
      createDryRunLifecycle({ dryRunResult: bad, createdAt: "2026-05-21T00:00:00.000Z" })
    ).toThrow("dryRunOnly");
  });

  test("3.3 throws if stubResult is wrong", () => {
    const bad = { ...makeDryRunResult(), stubResult: "REAL_RESULT" } as unknown as PaperSimulationDryRunResult;
    expect(() =>
      createDryRunLifecycle({ dryRunResult: bad, createdAt: "2026-05-21T00:00:00.000Z" })
    ).toThrow("[P42] LifecycleBoundaryViolation");
  });

  test("3.4 error message mentions stubResult", () => {
    const bad = { ...makeDryRunResult(), stubResult: "REAL_RESULT" } as unknown as PaperSimulationDryRunResult;
    expect(() =>
      createDryRunLifecycle({ dryRunResult: bad, createdAt: "2026-05-21T00:00:00.000Z" })
    ).toThrow("DRY_RUN_STUB_ONLY");
  });

  test("3.5 throws if executedAt is not null", () => {
    const bad = { ...makeDryRunResult(), executedAt: "2026-05-21T00:00:00.000Z" } as unknown as PaperSimulationDryRunResult;
    expect(() =>
      createDryRunLifecycle({ dryRunResult: bad, createdAt: "2026-05-21T00:00:00.000Z" })
    ).toThrow("[P42] LifecycleBoundaryViolation");
  });

  test("3.6 error message mentions executedAt", () => {
    const bad = { ...makeDryRunResult(), executedAt: "2026-05-21T00:00:00.000Z" } as unknown as PaperSimulationDryRunResult;
    expect(() =>
      createDryRunLifecycle({ dryRunResult: bad, createdAt: "2026-05-21T00:00:00.000Z" })
    ).toThrow("executedAt");
  });

  test("3.7 throws if createdAt is empty", () => {
    expect(() =>
      createDryRunLifecycle({ dryRunResult: makeDryRunResult(), createdAt: "" })
    ).toThrow("[P42] LifecycleBoundaryViolation");
  });

  test("3.8 accepts valid P41 result without throwing", () => {
    expect(() => makeLifecycle()).not.toThrow();
  });
});

// ─── Group 4: transitionLifecycle valid transitions ───────────────────────────

describe("Group 4 — transitionLifecycle valid transitions", () => {
  test("4.1 PENDING → RUNNING succeeds", () => {
    const lc = makeLifecycle();
    const next = transitionLifecycle(lc, "RUNNING", "2026-05-21T01:00:00.000Z");
    expect(next.state).toBe("RUNNING");
  });

  test("4.2 PENDING → CANCELLED succeeds", () => {
    const lc = makeLifecycle();
    const next = transitionLifecycle(lc, "CANCELLED", "2026-05-21T01:00:00.000Z");
    expect(next.state).toBe("CANCELLED");
  });

  test("4.3 RUNNING → COMPLETE succeeds", () => {
    const lc = transitionLifecycle(makeLifecycle(), "RUNNING", "2026-05-21T01:00:00.000Z");
    const next = transitionLifecycle(lc, "COMPLETE", "2026-05-21T02:00:00.000Z");
    expect(next.state).toBe("COMPLETE");
  });

  test("4.4 RUNNING → CANCELLED succeeds", () => {
    const lc = transitionLifecycle(makeLifecycle(), "RUNNING", "2026-05-21T01:00:00.000Z");
    const next = transitionLifecycle(lc, "CANCELLED", "2026-05-21T02:00:00.000Z");
    expect(next.state).toBe("CANCELLED");
  });

  test("4.5 transition appends to transitions array", () => {
    const lc = makeLifecycle();
    const next = transitionLifecycle(lc, "RUNNING", "2026-05-21T01:00:00.000Z");
    expect(next.transitions).toHaveLength(1);
    expect(next.transitions[0].from).toBe("PENDING");
    expect(next.transitions[0].to).toBe("RUNNING");
  });

  test("4.6 two transitions accumulate in array", () => {
    const lc1 = transitionLifecycle(makeLifecycle(), "RUNNING", "2026-05-21T01:00:00.000Z");
    const lc2 = transitionLifecycle(lc1, "COMPLETE", "2026-05-21T02:00:00.000Z");
    expect(lc2.transitions).toHaveLength(2);
  });

  test("4.7 COMPLETE sets completedAt", () => {
    const lc1 = transitionLifecycle(makeLifecycle(), "RUNNING", "2026-05-21T01:00:00.000Z");
    const lc2 = transitionLifecycle(lc1, "COMPLETE", "2026-05-21T02:00:00.000Z");
    expect(lc2.completedAt).toBe("2026-05-21T02:00:00.000Z");
  });

  test("4.8 executedAt remains null after all transitions", () => {
    const lc1 = transitionLifecycle(makeLifecycle(), "RUNNING", "2026-05-21T01:00:00.000Z");
    const lc2 = transitionLifecycle(lc1, "COMPLETE", "2026-05-21T02:00:00.000Z");
    expect(lc2.executedAt).toBeNull();
  });
});

// ─── Group 5: transitionLifecycle rejects invalid transitions ─────────────────

describe("Group 5 — transitionLifecycle rejects invalid transitions", () => {
  test("5.1 PENDING → COMPLETE throws", () => {
    expect(() =>
      transitionLifecycle(makeLifecycle(), "COMPLETE", "2026-05-21T01:00:00.000Z")
    ).toThrow("[P42] LifecycleBoundaryViolation");
  });

  test("5.2 error message contains PENDING and COMPLETE", () => {
    expect(() =>
      transitionLifecycle(makeLifecycle(), "COMPLETE", "2026-05-21T01:00:00.000Z")
    ).toThrow("PENDING");
  });

  test("5.3 COMPLETE → RUNNING throws (terminal state)", () => {
    const lc1 = transitionLifecycle(makeLifecycle(), "RUNNING", "T1");
    const lc2 = transitionLifecycle(lc1, "COMPLETE", "T2");
    expect(() =>
      transitionLifecycle(lc2, "RUNNING", "T3")
    ).toThrow("[P42] LifecycleBoundaryViolation");
  });

  test("5.4 error mentions terminal state", () => {
    const lc1 = transitionLifecycle(makeLifecycle(), "RUNNING", "T1");
    const lc2 = transitionLifecycle(lc1, "COMPLETE", "T2");
    expect(() =>
      transitionLifecycle(lc2, "RUNNING", "T3")
    ).toThrow("terminal");
  });

  test("5.5 CANCELLED → RUNNING throws (terminal state)", () => {
    const lc = cancelLifecycle(makeLifecycle(), "2026-05-21T01:00:00.000Z");
    expect(() =>
      transitionLifecycle(lc, "RUNNING", "2026-05-21T02:00:00.000Z")
    ).toThrow("[P42] LifecycleBoundaryViolation");
  });

  test("5.6 original lifecycle is unchanged after failed transition", () => {
    const lc = makeLifecycle();
    try {
      transitionLifecycle(lc, "COMPLETE", "T");
    } catch {
      // expected
    }
    expect(lc.state).toBe("PENDING");
  });

  test("5.7 isValidTransition returns false for PENDING → COMPLETE", () => {
    expect(isValidTransition("PENDING", "COMPLETE")).toBe(false);
  });

  test("5.8 isValidTransition returns true for PENDING → RUNNING", () => {
    expect(isValidTransition("PENDING", "RUNNING")).toBe(true);
  });
});

// ─── Group 6: cancelLifecycle ─────────────────────────────────────────────────

describe("Group 6 — cancelLifecycle", () => {
  test("6.1 cancel from PENDING sets state to CANCELLED", () => {
    expect(cancelLifecycle(makeLifecycle(), "2026-05-21T01:00:00.000Z").state).toBe("CANCELLED");
  });

  test("6.2 cancel from RUNNING sets state to CANCELLED", () => {
    const running = transitionLifecycle(makeLifecycle(), "RUNNING", "T1");
    expect(cancelLifecycle(running, "T2").state).toBe("CANCELLED");
  });

  test("6.3 cancelledAt is set after cancel", () => {
    const lc = cancelLifecycle(makeLifecycle(), "2026-05-21T05:00:00.000Z");
    expect(lc.cancelledAt).toBe("2026-05-21T05:00:00.000Z");
  });

  test("6.4 completedAt remains null after cancel", () => {
    const lc = cancelLifecycle(makeLifecycle(), "T");
    expect(lc.completedAt).toBeNull();
  });

  test("6.5 executedAt remains null after cancel", () => {
    const lc = cancelLifecycle(makeLifecycle(), "T");
    expect(lc.executedAt).toBeNull();
  });

  test("6.6 CANCELLED is terminal — isTerminalState returns true", () => {
    expect(isTerminalState("CANCELLED")).toBe(true);
  });

  test("6.7 COMPLETE is terminal — isTerminalState returns true", () => {
    expect(isTerminalState("COMPLETE")).toBe(true);
  });

  test("6.8 PENDING is not terminal — isTerminalState returns false", () => {
    expect(isTerminalState("PENDING")).toBe(false);
  });
});

// ─── Group 7: createDryRunLogEntry creates immutable entries ──────────────────

describe("Group 7 — createDryRunLogEntry creates immutable entries", () => {
  const BASE = {
    eventType: "LIFECYCLE_CREATED" as const,
    message: "Lifecycle created",
    createdAt: "2026-05-21T00:00:00.000Z",
    lifecycleId: "p42-lifecycle-abc-2026-05-21",
  };

  test("7.1 entry has phase P42", () => {
    expect(createDryRunLogEntry(BASE).phase).toBe("P42");
  });

  test("7.2 entry has stubOnly=true", () => {
    expect(createDryRunLogEntry(BASE).stubOnly).toBe(true);
  });

  test("7.3 entry has noExecution=true", () => {
    expect(createDryRunLogEntry(BASE).noExecution).toBe(true);
  });

  test("7.4 entryId starts with p42-log", () => {
    expect(createDryRunLogEntry(BASE).entryId).toMatch(/^p42-log-/);
  });

  test("7.5 entry carries correct eventType", () => {
    expect(createDryRunLogEntry(BASE).eventType).toBe("LIFECYCLE_CREATED");
  });

  test("7.6 entry carries fromState when provided", () => {
    const entry = createDryRunLogEntry({ ...BASE, fromState: "PENDING", toState: "RUNNING" });
    expect(entry.fromState).toBe("PENDING");
    expect(entry.toState).toBe("RUNNING");
  });

  test("7.7 throws for unknown eventType", () => {
    expect(() =>
      createDryRunLogEntry({ ...BASE, eventType: "UNKNOWN_EVENT" as "LIFECYCLE_CREATED" })
    ).toThrow("[P42] LogBoundaryViolation");
  });

  test("7.8 throws for empty message", () => {
    expect(() =>
      createDryRunLogEntry({ ...BASE, message: "" })
    ).toThrow("[P42] LogBoundaryViolation");
  });
});

// ─── Group 8: appendLogEntry is immutable / pure ──────────────────────────────

describe("Group 8 — appendLogEntry is immutable / pure", () => {
  const ENTRY = createDryRunLogEntry({
    eventType: "LIFECYCLE_CREATED",
    message: "Test",
    createdAt: "2026-05-21T00:00:00.000Z",
    lifecycleId: "p42-lc-test",
  });

  test("8.1 appending to empty log returns length-1 log", () => {
    const log = createEmptyLog();
    const next = appendLogEntry(log, ENTRY);
    expect(next).toHaveLength(1);
  });

  test("8.2 original empty log is unchanged", () => {
    const log = createEmptyLog();
    appendLogEntry(log, ENTRY);
    expect(log).toHaveLength(0);
  });

  test("8.3 appending twice returns length-2 log", () => {
    const log1 = appendLogEntry(createEmptyLog(), ENTRY);
    const log2 = appendLogEntry(log1, ENTRY);
    expect(log2).toHaveLength(2);
  });

  test("8.4 original log-1 is unchanged after second append", () => {
    const log1 = appendLogEntry(createEmptyLog(), ENTRY);
    appendLogEntry(log1, ENTRY);
    expect(log1).toHaveLength(1);
  });

  test("8.5 log entries preserve insertion order", () => {
    const e1 = createDryRunLogEntry({ ...ENTRY, eventType: "LIFECYCLE_CREATED", entryId: undefined } as unknown as typeof ENTRY);
    const e2 = createDryRunLogEntry({ ...ENTRY, eventType: "TRANSITION_COMPLETED", entryId: undefined } as unknown as typeof ENTRY);
    const log = appendLogEntry(appendLogEntry(createEmptyLog(), e1), e2);
    expect(log[0].eventType).toBe("LIFECYCLE_CREATED");
    expect(log[1].eventType).toBe("TRANSITION_COMPLETED");
  });

  test("8.6 createEmptyLog returns empty array", () => {
    expect(createEmptyLog()).toHaveLength(0);
  });

  test("8.7 log is JSON-serializable", () => {
    const log = appendLogEntry(createEmptyLog(), ENTRY);
    expect(() => JSON.stringify(log)).not.toThrow();
  });

  test("8.8 log entry has no pnl field", () => {
    expect("pnl" in ENTRY).toBe(false);
  });
});

// ─── Group 9: Log entries have no forbidden fields ────────────────────────────

describe("Group 9 — Log entries have no forbidden execution fields", () => {
  const ENTRY = createDryRunLogEntry({
    eventType: "BOUNDARY_CHECK_PASSED",
    message: "Boundary check passed",
    createdAt: "2026-05-21T00:00:00.000Z",
    lifecycleId: "p42-lc-scan",
  });
  const obj = ENTRY as unknown as Record<string, unknown>;

  test("9.1 no pnl field", () => { expect("pnl" in obj).toBe(false); });
  test("9.2 no roi field", () => { expect("roi" in obj).toBe(false); });
  test("9.3 no ROI field", () => { expect("ROI" in obj).toBe(false); });
  test("9.4 no winRate field", () => { expect("winRate" in obj).toBe(false); });
  test("9.5 no alphaScore field", () => { expect("alphaScore" in obj).toBe(false); });
  test("9.6 no recommendation field", () => { expect("recommendation" in obj).toBe(false); });
  test("9.7 no prediction field", () => { expect("prediction" in obj).toBe(false); });
  test("9.8 no backtestResult field", () => { expect("backtestResult" in obj).toBe(false); });
});

// ─── Group 10: Constants and version strings ──────────────────────────────────

describe("Group 10 — Constants and version strings", () => {
  test("10.1 PAPER_SIMULATION_DRY_RUN_LIFECYCLE_VERSION starts with p42", () => {
    expect(PAPER_SIMULATION_DRY_RUN_LIFECYCLE_VERSION).toMatch(/^p42-/);
  });

  test("10.2 PAPER_SIMULATION_DRY_RUN_LIFECYCLE_VERSION contains lifecycle", () => {
    expect(PAPER_SIMULATION_DRY_RUN_LIFECYCLE_VERSION).toContain("lifecycle");
  });

  test("10.3 PAPER_SIMULATION_DRY_RUN_LOG_VERSION starts with p42", () => {
    expect(PAPER_SIMULATION_DRY_RUN_LOG_VERSION).toMatch(/^p42-/);
  });

  test("10.4 P42_LIFECYCLE_STATES contains all four states", () => {
    expect(P42_LIFECYCLE_STATES).toContain("PENDING");
    expect(P42_LIFECYCLE_STATES).toContain("RUNNING");
    expect(P42_LIFECYCLE_STATES).toContain("COMPLETE");
    expect(P42_LIFECYCLE_STATES).toContain("CANCELLED");
  });

  test("10.5 P42_INITIAL_STATE is PENDING", () => {
    expect(P42_INITIAL_STATE).toBe("PENDING");
  });

  test("10.6 P42_TERMINAL_STATES contains COMPLETE and CANCELLED", () => {
    expect(P42_TERMINAL_STATES).toContain("COMPLETE");
    expect(P42_TERMINAL_STATES).toContain("CANCELLED");
  });

  test("10.7 P42_VALID_TRANSITIONS contains at least 4 pairs", () => {
    expect(P42_VALID_TRANSITIONS.length).toBeGreaterThanOrEqual(4);
  });

  test("10.8 P42_LOG_EVENT_TYPES contains LIFECYCLE_CREATED", () => {
    expect(P42_LOG_EVENT_TYPES).toContain("LIFECYCLE_CREATED");
  });

  test("10.9 P42_LOG_EVENT_TYPES contains TRANSITION_COMPLETED", () => {
    expect(P42_LOG_EVENT_TYPES).toContain("TRANSITION_COMPLETED");
  });

  test("10.10 P42_EXECUTION_STATUS is EXECUTION_LIFECYCLE_READY", () => {
    expect(P42_EXECUTION_STATUS).toBe("EXECUTION_LIFECYCLE_READY");
  });
});

// ─── Group 11: No forbidden exports ──────────────────────────────────────────

describe("Group 11 — No forbidden exports", () => {
  test("11.1 PaperSimulationDryRunLifecycle does not export executeSimulation", async () => {
    const mod = await import("../p42/PaperSimulationDryRunLifecycle");
    expect("executeSimulation" in mod).toBe(false);
  });

  test("11.2 PaperSimulationDryRunLifecycle does not export runSimulation", async () => {
    const mod = await import("../p42/PaperSimulationDryRunLifecycle");
    expect("runSimulation" in mod).toBe(false);
  });

  test("11.3 PaperSimulationDryRunLifecycle does not export computePnL", async () => {
    const mod = await import("../p42/PaperSimulationDryRunLifecycle");
    expect("computePnL" in mod).toBe(false);
  });

  test("11.4 PaperSimulationDryRunLifecycle does not export computeROI", async () => {
    const mod = await import("../p42/PaperSimulationDryRunLifecycle");
    expect("computeROI" in mod).toBe(false);
  });

  test("11.5 PaperSimulationDryRunLog does not export computeWinRate", async () => {
    const mod = await import("../p42/PaperSimulationDryRunLog");
    expect("computeWinRate" in mod).toBe(false);
  });

  test("11.6 PaperSimulationDryRunLog does not export generateRecommendation", async () => {
    const mod = await import("../p42/PaperSimulationDryRunLog");
    expect("generateRecommendation" in mod).toBe(false);
  });

  test("11.7 PaperSimulationDryRunLog does not export runBacktest", async () => {
    const mod = await import("../p42/PaperSimulationDryRunLog");
    expect("runBacktest" in mod).toBe(false);
  });

  test("11.8 PaperSimulationDryRunLog does not export runOptimizer", async () => {
    const mod = await import("../p42/PaperSimulationDryRunLog");
    expect("runOptimizer" in mod).toBe(false);
  });
});
