/**
 * systemHealth.test.ts
 *
 * Tests for the B-02.2 Cleanup Trend → Orchestrator Feedback Loop module.
 *
 * Strategy:
 *   - Test computeSystemHealth() as a pure function (no I/O)
 *   - Test getSystemHealthStatus() with mocked profile, storage, and fs utilities
 *   - Verify signal → action mapping and status thresholds
 *   - Verify graceful degradation on errors (must never throw)
 */

// ---------------------------------------------------------------------------
// Module mocks (must be top-level before any imports)
// ---------------------------------------------------------------------------

jest.mock('../profile', () => ({
  loadProjectProfile: jest.fn(),
}));

jest.mock('../storage', () => ({
  loadSchedulerState: jest.fn(),
}));

jest.mock('../common', () => ({
  nowIso: jest.fn(() => '2026-05-05T04:35:00.000Z'),
  readJsonFile: jest.fn(),
  writeJsonFile: jest.fn(),
}));

// staleJobCleanup is NOT mocked — we use its real analyzeCleanupTrends() to
// keep the pipeline integration honest.

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { loadProjectProfile } from '../profile';
import { loadSchedulerState } from '../storage';
import { readJsonFile } from '../common';
import {
  computeSystemHealth,
  getSystemHealthStatus,
  emitHealthWarningIfDegraded,
  type HealthStatus,
  type SystemHealthReport,
} from '../systemHealth';
import type { CleanupTrendReport, TrendSignal } from '../staleJobCleanup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW_ISO = '2026-05-05T04:35:00.000Z';

function makeTrend(signals: Partial<TrendSignal>[] = [], sufficientData = true): CleanupTrendReport {
  const full: TrendSignal[] = signals.map((s) => ({
    label: s.label ?? 'worker_unstable',
    description: s.description ?? 'test',
    recentAvg: s.recentAvg ?? 1,
    olderAvg: s.olderAvg ?? 0,
    windowSize: s.windowSize ?? 4,
  }));
  return {
    analyzedAt: NOW_ISO,
    entriesAnalyzed: sufficientData ? 4 : 2,
    sufficientData,
    signals: full,
    hasSignals: full.length > 0,
  };
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
// computeSystemHealth — pure function tests
// ---------------------------------------------------------------------------

describe('systemHealth — computeSystemHealth (pure)', () => {
  it('returns healthy when no signals', () => {
    const result = computeSystemHealth(makeTrend([]));
    expect(result.status).toBe('healthy');
    expect(result.signals).toHaveLength(0);
    expect(result.recommendedActions).toHaveLength(0);
    expect(result.hasSignals).toBe(false);
  });

  it('returns false for hasSignals when healthy', () => {
    const result = computeSystemHealth(makeTrend([]));
    expect(result.hasSignals).toBe(false);
  });

  it('returns degraded with 1 signal', () => {
    const result = computeSystemHealth(makeTrend([{ label: 'worker_unstable' }]));
    expect(result.status).toBe('degraded');
  });

  it('returns critical with 2 signals', () => {
    const result = computeSystemHealth(
      makeTrend([{ label: 'worker_unstable' }, { label: 'scheduler_issue' }]),
    );
    expect(result.status).toBe('critical');
  });

  it('returns critical with 3 signals', () => {
    const result = computeSystemHealth(
      makeTrend([
        { label: 'worker_unstable' },
        { label: 'scheduler_issue' },
        { label: 'crash_rate_up' },
      ]),
    );
    expect(result.status).toBe('critical');
  });

  it('maps worker_unstable signal to recommended actions', () => {
    const result = computeSystemHealth(makeTrend([{ label: 'worker_unstable' }]));
    const actions = result.recommendedActions;
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a.signal === 'worker_unstable')).toBe(true);
    // At least one immediate warning action (not futureOnly)
    const immediateActions = actions.filter((a) => !a.futureOnly);
    expect(immediateActions.length).toBeGreaterThan(0);
    expect(immediateActions.some((a) => a.severity === 'warning')).toBe(true);
  });

  it('maps scheduler_issue signal to recommended actions', () => {
    const result = computeSystemHealth(makeTrend([{ label: 'scheduler_issue' }]));
    const actions = result.recommendedActions.filter((a) => a.signal === 'scheduler_issue');
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some((a) => a.severity === 'warning')).toBe(true);
  });

  it('maps crash_rate_up signal to recommended actions', () => {
    const result = computeSystemHealth(makeTrend([{ label: 'crash_rate_up' }]));
    const actions = result.recommendedActions.filter((a) => a.signal === 'crash_rate_up');
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some((a) => a.severity === 'warning')).toBe(true);
  });

  it('includes futureOnly actions but does not execute them', () => {
    const result = computeSystemHealth(makeTrend([{ label: 'worker_unstable' }]));
    const futureActions = result.recommendedActions.filter((a) => a.futureOnly);
    expect(futureActions.length).toBeGreaterThan(0);
    // futureOnly actions have [Future] marker in the description
    expect(futureActions.every((a) => a.action.startsWith('[Future]'))).toBe(true);
  });

  it('exposes sufficientData and entriesAnalyzed from the trend', () => {
    const trend = makeTrend([], false); // insufficient data
    const result = computeSystemHealth(trend);
    expect(result.sufficientData).toBe(false);
    expect(result.entriesAnalyzed).toBe(2);
  });

  it('returns hasSignals=true when status is degraded or critical', () => {
    const degraded = computeSystemHealth(makeTrend([{ label: 'worker_unstable' }]));
    expect(degraded.hasSignals).toBe(true);
  });

  it('report is JSON-serialisable', () => {
    const result = computeSystemHealth(makeTrend([{ label: 'crash_rate_up' }]));
    const json = JSON.parse(JSON.stringify(result));
    expect(json).toHaveProperty('status');
    expect(json).toHaveProperty('signals');
    expect(json).toHaveProperty('recommendedActions');
  });
});

// ---------------------------------------------------------------------------
// getSystemHealthStatus — async integration tests
// ---------------------------------------------------------------------------

describe('systemHealth — getSystemHealthStatus (async)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadProjectProfile as jest.Mock).mockResolvedValue({
      orchestrator_root: 'runtime/agent_orchestrator',
    });
    (loadSchedulerState as jest.Mock).mockResolvedValue({ paths: mockPaths(), state: {} });
  });

  it('returns healthy when history is empty', async () => {
    (readJsonFile as jest.Mock).mockResolvedValue({ version: '1.0', entries: [] });

    const result = await getSystemHealthStatus();
    expect(result.status).toBe('healthy');
    expect(result.sufficientData).toBe(false);
  });

  it('returns healthy when history file is missing (ENOENT)', async () => {
    (readJsonFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));

    const result = await getSystemHealthStatus();
    expect(result.status).toBe('healthy');
    expect(result.sufficientData).toBe(false);
  });

  it('never throws even when profile loading fails', async () => {
    (loadProjectProfile as jest.Mock).mockRejectedValue(new Error('profile not found'));

    const result = await getSystemHealthStatus();
    expect(result.status).toBe('healthy');
    expect(result.entriesAnalyzed).toBe(0);
  });

  it('returns degraded when history shows rising expiredLockCount', async () => {
    // 4 entries: recent 2 high, older 2 low — triggers worker_unstable
    (readJsonFile as jest.Mock).mockResolvedValue({
      version: '1.0',
      entries: [
        { timestamp: '2026-05-05T04:00:00Z', expiredLockCount: 5, staleHeartbeatCount: 0, tasksReclaimed: 0 },
        { timestamp: '2026-05-05T03:00:00Z', expiredLockCount: 4, staleHeartbeatCount: 0, tasksReclaimed: 0 },
        { timestamp: '2026-05-05T02:00:00Z', expiredLockCount: 0, staleHeartbeatCount: 0, tasksReclaimed: 0 },
        { timestamp: '2026-05-05T01:00:00Z', expiredLockCount: 0, staleHeartbeatCount: 0, tasksReclaimed: 0 },
      ],
    });

    const result = await getSystemHealthStatus();
    expect(result.status).toBe('degraded');
    expect(result.signals.some((s) => s.label === 'worker_unstable')).toBe(true);
    expect(result.hasSignals).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// emitHealthWarningIfDegraded — stderr tests
// ---------------------------------------------------------------------------

describe('systemHealth — emitHealthWarningIfDegraded', () => {
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('does NOT write to stderr when system is healthy', () => {
    const health: SystemHealthReport = {
      evaluatedAt: NOW_ISO,
      status: 'healthy',
      signals: [],
      recommendedActions: [],
      hasSignals: false,
      sufficientData: false,
      entriesAnalyzed: 0,
    };
    emitHealthWarningIfDegraded('plannerTick', health);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('writes to stderr when system is degraded', () => {
    const health: SystemHealthReport = {
      evaluatedAt: NOW_ISO,
      status: 'degraded',
      signals: [
        {
          label: 'worker_unstable',
          description: 'test',
          recentAvg: 3,
          olderAvg: 0,
          windowSize: 4,
        },
      ],
      recommendedActions: [],
      hasSignals: true,
      sufficientData: true,
      entriesAnalyzed: 4,
    };
    emitHealthWarningIfDegraded('plannerTick', health);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const written = stderrSpy.mock.calls[0][0] as string;
    expect(written).toContain('DEGRADED');
    expect(written).toContain('plannerTick');
    expect(written).toContain('worker_unstable');
  });

  it('writes CRITICAL label when status is critical', () => {
    const health: SystemHealthReport = {
      evaluatedAt: NOW_ISO,
      status: 'critical',
      signals: [
        { label: 'worker_unstable', description: '', recentAvg: 3, olderAvg: 0, windowSize: 4 },
        { label: 'crash_rate_up', description: '', recentAvg: 2, olderAvg: 0, windowSize: 4 },
      ],
      recommendedActions: [],
      hasSignals: true,
      sufficientData: true,
      entriesAnalyzed: 4,
    };
    emitHealthWarningIfDegraded('workerTick', health);
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const written = stderrSpy.mock.calls[0][0] as string;
    expect(written).toContain('CRITICAL');
    expect(written).toContain('workerTick');
  });
});
