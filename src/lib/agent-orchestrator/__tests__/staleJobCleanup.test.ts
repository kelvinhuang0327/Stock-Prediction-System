/**
 * staleJobCleanup.test.ts
 *
 * Tests for the B-02 Stale Job Cleanup + Lease Expiry module.
 *
 * Strategy:
 *   - Mock profile, storage, and filesystem utilities so tests are deterministic
 *     and do NOT depend on the real dev.db / runtime files.
 *   - Simulate stale RUNNING tasks with artificially old timestamps.
 *   - Assert dryRun=true does not write task state.
 *   - Assert dryRun=false reclaims reclaimable expired locks.
 */

import type { ProjectProfile } from '../profile';
import type { SchedulerState, TaskRecord, TaskStoreIndex } from '../types';

// ---------------------------------------------------------------------------
// Module mocks (must be top-level before any imports)
// ---------------------------------------------------------------------------

jest.mock('../profile', () => ({
  loadProjectProfile: jest.fn(),
}));

jest.mock('../storage', () => ({
  loadSchedulerState: jest.fn(),
  loadTaskIndex: jest.fn(),
  saveTaskIndex: jest.fn(),
}));

jest.mock('../common', () => ({
  nowIso: jest.fn(() => '2026-04-24T10:00:00.000Z'),
  readJsonFile: jest.fn(),
  writeJsonFile: jest.fn(),
  fileExists: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { loadProjectProfile } from '../profile';
import { loadSchedulerState, loadTaskIndex, saveTaskIndex } from '../storage';
import { writeJsonFile } from '../common';
import { runStaleJobCleanup, type StaleCleanupReport } from '../staleJobCleanup';

// ---------------------------------------------------------------------------
// Fixed clock — pin Date.now() so ageMs comparisons are deterministic
// ---------------------------------------------------------------------------

const NOW_ISO  = '2026-04-24T10:00:00.000Z';
const NOW_MS   = new Date(NOW_ISO).getTime();
// 2 hours before now → expired (120 min > 30 min lease)
const STALE_TS = new Date(NOW_MS - 2 * 60 * 60_000).toISOString();
// 5 minutes before now → fresh (5 min < 30 min lease)
const FRESH_TS = new Date(NOW_MS - 5 * 60_000).toISOString();

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW_MS);
});
afterAll(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(overrides: Partial<ProjectProfile['worker_rules']> = {}): ProjectProfile {
  return {
    orchestrator_root: 'runtime/agent_orchestrator',
    task_storage_path: 'runtime/agent_orchestrator/tasks',
    log_storage_path: 'runtime/agent_orchestrator/logs',
    database_path: 'dev.db',
    planner_provider: 'codex',
    worker_provider: 'copilot-daemon',
    default_schedule_minutes: 60,
    worker_rules: {
      single_active_task: true,
      finalize_on_permission_block: true,
      finalize_on_stale_output_minutes: 30,
      ...overrides,
    },
  } as unknown as ProjectProfile;
}

function makeState(overrides: Partial<SchedulerState> = {}): SchedulerState {
  return {
    version: '1.0',
    schedulerEnabled: true,
    plannerProvider: 'codex',
    workerProvider: 'copilot-daemon',
    scheduleMinutes: 60,
    nextPlannerRunAt: null,
    nextWorkerRunAt: null,
    lastPlannerRunAt: null,
    lastWorkerRunAt: null,
    updatedAt: NOW_ISO,
    laneHeartbeats: {},
    ...overrides,
  };
}

function makeRunningTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    taskId: 1,
    slug: 'task-stale',
    dayKey: '20260424',
    status: 'RUNNING',
    gateVerdict: null,
    plannerProvider: 'codex',
    workerProvider: 'copilot-daemon',
    createdAt: STALE_TS,
    updatedAt: STALE_TS,
    lastOutputAt: STALE_TS,
    latestProgressSummary: '',
    promptPath: '/tmp/prompt.md',
    contractPath: '/tmp/contract.json',
    completedPath: null,
    resultPath: null,
    metaPath: '/tmp/meta.json',
    workerLogPath: null,
    lane: 'L-ONDEMAND',
    ...overrides,
  };
}

function makeTaskIndex(tasks: TaskRecord[]): TaskStoreIndex {
  return { version: '1.0', tasks };
}

function mockPaths() {
  return {
    orchestratorRoot: '/fake/runtime/agent_orchestrator',
    taskRoot: '/fake/runtime/agent_orchestrator/tasks',
    logRoot: '/fake/runtime/agent_orchestrator/logs',
    databasePath: '/fake/dev.db',
    schedulerStatePath: '/fake/runtime/agent_orchestrator/scheduler_state.json',
    taskIndexPath: '/fake/runtime/agent_orchestrator/task_index.json',
    runStorePath: '/fake/runtime/agent_orchestrator/runs.json',
  };
}

// ---------------------------------------------------------------------------
// dryRun=true tests
// ---------------------------------------------------------------------------

describe('staleJobCleanup — dryRun=true (default)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadProjectProfile as jest.Mock).mockResolvedValue(makeProfile());
    (loadSchedulerState as jest.Mock).mockResolvedValue({ paths: mockPaths(), state: makeState() });
    (writeJsonFile as jest.Mock).mockResolvedValue(undefined);
    (saveTaskIndex as jest.Mock).mockResolvedValue(undefined);
  });

  it('detects expired lock and returns it in the report', async () => {
    (loadTaskIndex as jest.Mock).mockResolvedValue(makeTaskIndex([makeRunningTask()]));

    const report: StaleCleanupReport = await runStaleJobCleanup({
      dryRun: true,
      leaseDurationMs: 30 * 60_000,
    });

    expect(report.dryRun).toBe(true);
    expect(report.expiredLocks).toHaveLength(1);
    expect(report.expiredLocks[0].taskId).toBe(1);
    expect(report.expiredLocks[0].lane).toBe('L-ONDEMAND');
    expect(report.expiredLocks[0].ageMs).toBeGreaterThan(30 * 60_000);
    expect(report.summary.expiredLockCount).toBe(1);
  });

  it('does NOT mutate task index when dryRun=true', async () => {
    (loadTaskIndex as jest.Mock).mockResolvedValue(makeTaskIndex([makeRunningTask()]));

    await runStaleJobCleanup({ dryRun: true });

    expect(saveTaskIndex).not.toHaveBeenCalled();
  });

  it('still writes stale_cleanup_report.json in dryRun mode', async () => {
    (loadTaskIndex as jest.Mock).mockResolvedValue(makeTaskIndex([]));

    await runStaleJobCleanup({ dryRun: true });

    expect(writeJsonFile).toHaveBeenCalledWith(
      expect.stringContaining('stale_cleanup_report.json'),
      expect.objectContaining({ dryRun: true }),
    );
  });

  it('does NOT report fresh RUNNING task as expired', async () => {
    const freshTask = makeRunningTask({ lastOutputAt: FRESH_TS, updatedAt: FRESH_TS });
    (loadTaskIndex as jest.Mock).mockResolvedValue(makeTaskIndex([freshTask]));

    const report = await runStaleJobCleanup({ dryRun: true, leaseDurationMs: 30 * 60_000 });

    expect(report.expiredLocks).toHaveLength(0);
    expect(report.summary.expiredLockCount).toBe(0);
  });

  it('detects stale heartbeat when lane heartbeat is old', async () => {
    const staleState = makeState({
      laneHeartbeats: {
        'L-ONDEMAND': { lane: 'L-ONDEMAND', lastHeartbeatAt: STALE_TS, runningTaskId: null },
      },
    });
    (loadSchedulerState as jest.Mock).mockResolvedValue({ paths: mockPaths(), state: staleState });
    (loadTaskIndex as jest.Mock).mockResolvedValue(makeTaskIndex([]));

    const report = await runStaleJobCleanup({ dryRun: true, heartbeatStaleThresholdMs: 10 * 60_000 });

    expect(report.staleHeartbeats.length).toBeGreaterThan(0);
    expect(report.staleHeartbeats[0].lane).toBe('L-ONDEMAND');
    expect(report.summary.staleHeartbeatCount).toBeGreaterThan(0);
  });

  it('report JSON is parseable', async () => {
    (loadTaskIndex as jest.Mock).mockResolvedValue(makeTaskIndex([]));
    const report = await runStaleJobCleanup({ dryRun: true });
    const json = JSON.parse(JSON.stringify(report));
    expect(json).toHaveProperty('generatedAt');
    expect(json).toHaveProperty('summary');
  });
});

// ---------------------------------------------------------------------------
// dryRun=false tests
// ---------------------------------------------------------------------------

describe('staleJobCleanup — dryRun=false', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadProjectProfile as jest.Mock).mockResolvedValue(makeProfile());
    (writeJsonFile as jest.Mock).mockResolvedValue(undefined);
    (saveTaskIndex as jest.Mock).mockResolvedValue(undefined);
  });

  it('reclaims reclaimable expired lock when schedulerEnabled=true', async () => {
    (loadSchedulerState as jest.Mock).mockResolvedValue({
      paths: mockPaths(),
      state: makeState({ laneHeartbeats: {} }), // no heartbeat → reclaimable
    });
    (loadTaskIndex as jest.Mock).mockResolvedValue(makeTaskIndex([makeRunningTask()]));

    const report = await runStaleJobCleanup({ dryRun: false, leaseDurationMs: 30 * 60_000 });

    expect(report.actionsPerformed).toHaveLength(1);
    expect(report.actionsPerformed[0].taskId).toBe(1);
    expect(report.actionsPerformed[0].newStatus).toBe('REPLAN_REQUIRED');
    expect(report.summary.tasksReclaimed).toBe(1);
    expect(saveTaskIndex).toHaveBeenCalledTimes(1);
  });

  it('does NOT reclaim when schedulerEnabled=false', async () => {
    (loadSchedulerState as jest.Mock).mockResolvedValue({
      paths: mockPaths(),
      state: makeState({ schedulerEnabled: false }),
    });
    (loadTaskIndex as jest.Mock).mockResolvedValue(makeTaskIndex([makeRunningTask()]));

    const report = await runStaleJobCleanup({ dryRun: false });

    expect(report.actionsPerformed).toHaveLength(0);
    expect(report.summary.skippedBecauseSchedulerDisabled).toBe(true);
    expect(saveTaskIndex).not.toHaveBeenCalled();
  });

  it('does NOT reclaim a lock that is still fresh (active runner)', async () => {
    (loadSchedulerState as jest.Mock).mockResolvedValue({
      paths: mockPaths(),
      state: makeState({ laneHeartbeats: {} }),
    });
    const freshTask = makeRunningTask({ lastOutputAt: FRESH_TS, updatedAt: FRESH_TS });
    (loadTaskIndex as jest.Mock).mockResolvedValue(makeTaskIndex([freshTask]));

    const report = await runStaleJobCleanup({ dryRun: false, leaseDurationMs: 30 * 60_000 });

    expect(report.actionsPerformed).toHaveLength(0);
    expect(report.summary.tasksReclaimed).toBe(0);
    expect(saveTaskIndex).not.toHaveBeenCalled();
  });

  it('does NOT reclaim when lane heartbeat is still fresh (active runner)', async () => {
    (loadSchedulerState as jest.Mock).mockResolvedValue({
      paths: mockPaths(),
      state: makeState({
        laneHeartbeats: {
          'L-ONDEMAND': { lane: 'L-ONDEMAND', lastHeartbeatAt: FRESH_TS, runningTaskId: 1 },
        },
      }),
    });
    (loadTaskIndex as jest.Mock).mockResolvedValue(makeTaskIndex([makeRunningTask()]));

    const report = await runStaleJobCleanup({ dryRun: false, leaseDurationMs: 30 * 60_000 });

    expect(report.expiredLocks[0].reclaimable).toBe(false);
    expect(report.actionsPerformed).toHaveLength(0);
    expect(saveTaskIndex).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// schedulerEnabled=false passive scan
// ---------------------------------------------------------------------------

describe('staleJobCleanup — schedulerEnabled=false scan', () => { 
  it('still detects expired locks in disabled mode (passive scan)', async () => {
    (loadProjectProfile as jest.Mock).mockResolvedValue(makeProfile());
    (loadSchedulerState as jest.Mock).mockResolvedValue({
      paths: mockPaths(),
      state: makeState({ schedulerEnabled: false }),
    });
    (loadTaskIndex as jest.Mock).mockResolvedValue(makeTaskIndex([makeRunningTask()]));
    (writeJsonFile as jest.Mock).mockResolvedValue(undefined);

    const report = await runStaleJobCleanup({ dryRun: true });

    expect(report.schedulerEnabled).toBe(false);
    expect(report.expiredLocks).toHaveLength(1);
    expect(report.actionsPerformed).toHaveLength(0);
  });
});
