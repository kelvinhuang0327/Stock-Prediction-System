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

import type { ProjectProfile } from '../types'; // type-only; module is mocked below
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
import { readJsonFile, writeJsonFile } from '../common';
import {
  runStaleJobCleanup,
  appendCleanupHistory,
  analyzeCleanupTrends,
  type CleanupHistory,
  type CleanupHistoryEntry,
  type StaleCleanupReport,
} from '../staleJobCleanup';

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

// ---------------------------------------------------------------------------
// History tracking tests
// ---------------------------------------------------------------------------

describe('staleJobCleanup — cleanup history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (writeJsonFile as jest.Mock).mockResolvedValue(undefined);
  });

  it('appendCleanupHistory prepends the entry and writes to history file', async () => {
    (readJsonFile as jest.Mock).mockResolvedValue({ version: '1.0', entries: [] });

    const entry: CleanupHistoryEntry = {
      timestamp: NOW_ISO,
      expiredLockCount: 2,
      staleHeartbeatCount: 1,
      tasksReclaimed: 1,
    };

    const result = await appendCleanupHistory('/fake/root', entry);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toEqual(entry);
    expect(writeJsonFile).toHaveBeenCalledWith(
      expect.stringContaining('stale_cleanup_history.json'),
      expect.objectContaining({ version: '1.0', entries: [entry] }),
    );
  });

  it('appendCleanupHistory prepends new entry before existing entries', async () => {
    const existing: CleanupHistoryEntry = {
      timestamp: new Date(NOW_MS - 60_000).toISOString(),
      expiredLockCount: 0,
      staleHeartbeatCount: 0,
      tasksReclaimed: 0,
    };
    (readJsonFile as jest.Mock).mockResolvedValue({ version: '1.0', entries: [existing] });

    const newEntry: CleanupHistoryEntry = {
      timestamp: NOW_ISO,
      expiredLockCount: 1,
      staleHeartbeatCount: 0,
      tasksReclaimed: 1,
    };

    const result = await appendCleanupHistory('/fake/root', newEntry);

    expect(result.entries[0]).toEqual(newEntry);
    expect(result.entries[1]).toEqual(existing);
  });

  it('appendCleanupHistory gracefully starts fresh when history file missing', async () => {
    (readJsonFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));

    const entry: CleanupHistoryEntry = {
      timestamp: NOW_ISO,
      expiredLockCount: 0,
      staleHeartbeatCount: 0,
      tasksReclaimed: 0,
    };

    const result = await appendCleanupHistory('/fake/root', entry);
    expect(result.entries).toHaveLength(1);
  });

  it('runStaleJobCleanup report includes a trends field', async () => {
    (loadProjectProfile as jest.Mock).mockResolvedValue(makeProfile());
    (loadSchedulerState as jest.Mock).mockResolvedValue({ paths: mockPaths(), state: makeState() });
    (loadTaskIndex as jest.Mock).mockResolvedValue(makeTaskIndex([]));
    (readJsonFile as jest.Mock).mockResolvedValue({ version: '1.0', entries: [] });

    const report = await runStaleJobCleanup({ dryRun: true });

    expect(report).toHaveProperty('trends');
    expect(typeof report.trends.hasSignals).toBe('boolean');
    expect(typeof report.trends.sufficientData).toBe('boolean');
    expect(Array.isArray(report.trends.signals)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Trend detection tests
// ---------------------------------------------------------------------------

describe('staleJobCleanup — trend detection', () => {
  function makeHistory(entries: Partial<CleanupHistoryEntry>[]): CleanupHistory {
    return {
      version: '1.0',
      entries: entries.map((e, i) => ({
        timestamp: new Date(NOW_MS - i * 60_000).toISOString(),
        expiredLockCount: 0,
        staleHeartbeatCount: 0,
        tasksReclaimed: 0,
        ...e,
      })),
    };
  }

  it('returns sufficientData=false when fewer than 4 entries', () => {
    const hist = makeHistory([{}, {}]);
    const result = analyzeCleanupTrends(hist);
    expect(result.sufficientData).toBe(false);
    expect(result.signals).toHaveLength(0);
    expect(result.hasSignals).toBe(false);
  });

  it('returns no signals when counts are all zero', () => {
    const hist = makeHistory([{}, {}, {}, {}, {}]);
    const result = analyzeCleanupTrends(hist);
    expect(result.sufficientData).toBe(true);
    expect(result.signals).toHaveLength(0);
    expect(result.hasSignals).toBe(false);
  });

  it('detects worker_unstable signal when expiredLockCount is rising', () => {
    // Most-recent first: high then low (rising recent vs older)
    const hist = makeHistory([
      { expiredLockCount: 5 }, // most recent
      { expiredLockCount: 4 },
      { expiredLockCount: 1 }, // older
      { expiredLockCount: 0 },
    ]);
    const result = analyzeCleanupTrends(hist);
    expect(result.sufficientData).toBe(true);
    const signal = result.signals.find((s) => s.label === 'worker_unstable');
    expect(signal).toBeDefined();
    expect(signal!.recentAvg).toBeGreaterThan(signal!.olderAvg);
    expect(result.hasSignals).toBe(true);
  });

  it('detects scheduler_issue signal when staleHeartbeatCount is rising', () => {
    const hist = makeHistory([
      { staleHeartbeatCount: 3 },
      { staleHeartbeatCount: 2 },
      { staleHeartbeatCount: 0 },
      { staleHeartbeatCount: 0 },
    ]);
    const result = analyzeCleanupTrends(hist);
    const signal = result.signals.find((s) => s.label === 'scheduler_issue');
    expect(signal).toBeDefined();
    expect(signal!.recentAvg).toBeGreaterThan(signal!.olderAvg);
  });

  it('detects crash_rate_up signal when tasksReclaimed is rising', () => {
    const hist = makeHistory([
      { tasksReclaimed: 4 },
      { tasksReclaimed: 3 },
      { tasksReclaimed: 0 },
      { tasksReclaimed: 0 },
    ]);
    const result = analyzeCleanupTrends(hist);
    const signal = result.signals.find((s) => s.label === 'crash_rate_up');
    expect(signal).toBeDefined();
    expect(signal!.recentAvg).toBeGreaterThan(signal!.olderAvg);
  });

  it('does NOT emit a signal when counts are stable', () => {
    const hist = makeHistory([
      { expiredLockCount: 1 },
      { expiredLockCount: 1 },
      { expiredLockCount: 1 },
      { expiredLockCount: 1 },
    ]);
    const result = analyzeCleanupTrends(hist);
    const signal = result.signals.find((s) => s.label === 'worker_unstable');
    expect(signal).toBeUndefined();
  });
});
