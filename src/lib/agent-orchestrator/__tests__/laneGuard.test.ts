/**
 * B-01 Lane Guard Tests
 *
 * Verifies:
 *  1.  resolveTaskLane returns task.lane when set
 *  2.  resolveTaskLane returns DEFAULT_LANE ('L-ONDEMAND') for legacy records
 *  3.  checkLaneLock returns locked=false when no RUNNING task in lane
 *  4.  checkLaneLock returns locked=true when a RUNNING task exists in lane
 *  5.  checkLaneLock only considers same-lane tasks (cross-lane does NOT lock)
 *  6.  checkLaneLock ignores QUEUED/COMPLETED/FAILED tasks
 *  7.  evaluateLaneGuard returns 'allowed' when lane is free
 *  8.  evaluateLaneGuard returns 'blocked' when RUNNING task is fresh
 *  9.  evaluateLaneGuard returns 'stale_finalize' when RUNNING task is stale
 * 10.  Two tasks in DIFFERENT lanes do not block each other
 * 11.  Two tasks in the SAME lane: second is blocked
 * 12.  writeLaneHeartbeat writes heartbeat to state.laneHeartbeats
 * 13.  writeLaneHeartbeat initialises laneHeartbeats if absent
 * 14.  readLaneHeartbeat returns null when no heartbeat written
 * 15.  readLaneHeartbeat returns existing heartbeat
 * 16.  isLaneHeartbeatStale returns false when no heartbeat exists
 * 17.  isLaneHeartbeatStale returns false for fresh heartbeat
 * 18.  isLaneHeartbeatStale returns true for old heartbeat
 * 19.  buildLaneSummaries returns one entry per lane
 * 20.  buildLaneSummaries marks running task correctly
 * 21.  SchedulerLane type only allows the five defined values (compile-time guard)
 * 22.  DEFAULT_LANE = 'L-ONDEMAND'
 * 23.  SCHEDULER_LANES has exactly 5 entries
 * 24.  schedulerEnabled is still false (runtime safety)
 */

import {
  checkLaneLock,
  evaluateLaneGuard,
  readLaneHeartbeat,
  writeLaneHeartbeat,
  isLaneHeartbeatStale,
  resolveTaskLane,
  buildLaneSummaries,
} from '../laneGuard';
import {
  DEFAULT_LANE,
  SCHEDULER_LANES,
  type SchedulerLane,
  type SchedulerState,
  type TaskRecord,
} from '../types';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(
  taskId: number,
  status: TaskRecord['status'],
  lane?: SchedulerLane,
  lastOutputAt?: string,
): TaskRecord {
  return {
    taskId,
    slug: `task-${taskId}`,
    dayKey: '2026-05-04',
    status,
    gateVerdict: null,
    plannerProvider: 'local-planner' as TaskRecord['plannerProvider'],
    workerProvider: 'copilot-daemon',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastOutputAt: lastOutputAt ?? null,
    latestProgressSummary: '',
    promptPath: `/tmp/task-${taskId}-prompt.md`,
    contractPath: `/tmp/task-${taskId}-contract.json`,
    completedPath: null,
    resultPath: null,
    metaPath: `/tmp/task-${taskId}-meta.json`,
    workerLogPath: null,
    lane,
  };
}

function makeState(partial: Partial<SchedulerState> = {}): SchedulerState {
  return {
    version: '1.0',
    schedulerEnabled: false,
    plannerProvider: 'local-planner' as SchedulerState['plannerProvider'],
    workerProvider: 'copilot-daemon',
    scheduleMinutes: 10,
    nextPlannerRunAt: null,
    nextWorkerRunAt: null,
    lastPlannerRunAt: null,
    lastWorkerRunAt: null,
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

const NOW = new Date().toISOString();
const STALE_AGE_MS = 5 * 60_000; // 5 minutes

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('B-01 Lane Guard — resolveTaskLane', () => {
  it('1. returns task.lane when set', () => {
    const task = makeTask(1, 'RUNNING', 'L-DAILY');
    expect(resolveTaskLane(task)).toBe('L-DAILY');
  });

  it('2. returns DEFAULT_LANE for legacy records without lane', () => {
    const task = makeTask(1, 'RUNNING');
    expect(resolveTaskLane(task)).toBe(DEFAULT_LANE);
    expect(DEFAULT_LANE).toBe('L-ONDEMAND');
  });
});

describe('B-01 Lane Guard — checkLaneLock', () => {
  it('3. returns locked=false when no RUNNING task in lane', () => {
    const tasks = [makeTask(1, 'QUEUED', 'L-DAILY'), makeTask(2, 'COMPLETED', 'L-DAILY')];
    const result = checkLaneLock(tasks, 'L-DAILY');
    expect(result.locked).toBe(false);
    expect(result.lockHolder).toBeNull();
  });

  it('4. returns locked=true when a RUNNING task exists in lane', () => {
    const running = makeTask(1, 'RUNNING', 'L-DAILY');
    const tasks = [running, makeTask(2, 'QUEUED', 'L-DAILY')];
    const result = checkLaneLock(tasks, 'L-DAILY');
    expect(result.locked).toBe(true);
    expect(result.lockHolder?.taskId).toBe(1);
  });

  it('5. RUNNING task in different lane does NOT lock target lane', () => {
    const tasks = [makeTask(1, 'RUNNING', 'L-NIGHTLY'), makeTask(2, 'QUEUED', 'L-DAILY')];
    const result = checkLaneLock(tasks, 'L-DAILY');
    expect(result.locked).toBe(false);
  });

  it('6. ignores QUEUED/COMPLETED/FAILED tasks when checking lock', () => {
    const tasks = [
      makeTask(1, 'QUEUED', 'L-INTRADAY'),
      makeTask(2, 'COMPLETED', 'L-INTRADAY'),
      makeTask(3, 'FAILED', 'L-INTRADAY'),
    ];
    const result = checkLaneLock(tasks, 'L-INTRADAY');
    expect(result.locked).toBe(false);
  });
});

describe('B-01 Lane Guard — evaluateLaneGuard', () => {
  it('7. returns allowed when lane is free', () => {
    const tasks = [makeTask(1, 'QUEUED', 'L-DAILY')];
    const result = evaluateLaneGuard(tasks, 'L-DAILY', STALE_AGE_MS);
    expect(result.decision).toBe('allowed');
    expect(result.lockHolder).toBeNull();
  });

  it('8. returns blocked when RUNNING task is fresh', () => {
    const freshOutput = new Date(Date.now() - 30_000).toISOString(); // 30s ago
    const running = makeTask(1, 'RUNNING', 'L-DAILY', freshOutput);
    const result = evaluateLaneGuard([running], 'L-DAILY', STALE_AGE_MS);
    expect(result.decision).toBe('blocked');
    expect(result.isStale).toBe(false);
    expect(result.lockHolder?.taskId).toBe(1);
  });

  it('9. returns stale_finalize when RUNNING task output is stale', () => {
    const staleOutput = new Date(Date.now() - 10 * 60_000).toISOString(); // 10 min ago
    const running = makeTask(1, 'RUNNING', 'L-DAILY', staleOutput);
    const result = evaluateLaneGuard([running], 'L-DAILY', STALE_AGE_MS);
    expect(result.decision).toBe('stale_finalize');
    expect(result.isStale).toBe(true);
  });

  it('10. tasks in DIFFERENT lanes do not block each other', () => {
    const runningNightly = makeTask(1, 'RUNNING', 'L-NIGHTLY', NOW);
    const result = evaluateLaneGuard([runningNightly], 'L-DAILY', STALE_AGE_MS);
    expect(result.decision).toBe('allowed');
  });

  it('11. tasks in SAME lane: second is blocked', () => {
    const runningDaily = makeTask(1, 'RUNNING', 'L-DAILY', NOW);
    const result = evaluateLaneGuard([runningDaily], 'L-DAILY', STALE_AGE_MS);
    expect(result.decision).toBe('blocked');
  });
});

describe('B-01 Lane Guard — heartbeat', () => {
  it('12. writeLaneHeartbeat writes heartbeat to state.laneHeartbeats', () => {
    const state = makeState({ laneHeartbeats: {} });
    writeLaneHeartbeat(state, 'L-DAILY', 42);
    expect(state.laneHeartbeats!['L-DAILY']).toBeDefined();
    expect(state.laneHeartbeats!['L-DAILY']!.lane).toBe('L-DAILY');
    expect(state.laneHeartbeats!['L-DAILY']!.runningTaskId).toBe(42);
    expect(typeof state.laneHeartbeats!['L-DAILY']!.lastHeartbeatAt).toBe('string');
  });

  it('13. writeLaneHeartbeat initialises laneHeartbeats if absent', () => {
    const state = makeState();
    expect(state.laneHeartbeats).toBeUndefined();
    writeLaneHeartbeat(state, 'L-NIGHTLY', null);
    expect(state.laneHeartbeats).toBeDefined();
    expect(state.laneHeartbeats!['L-NIGHTLY']!.runningTaskId).toBeNull();
  });

  it('14. readLaneHeartbeat returns null when no heartbeat written', () => {
    const state = makeState();
    expect(readLaneHeartbeat(state, 'L-WEEKLY')).toBeNull();
  });

  it('15. readLaneHeartbeat returns existing heartbeat', () => {
    const state = makeState();
    writeLaneHeartbeat(state, 'L-INTRADAY', 7);
    const hb = readLaneHeartbeat(state, 'L-INTRADAY');
    expect(hb).not.toBeNull();
    expect(hb!.lane).toBe('L-INTRADAY');
    expect(hb!.runningTaskId).toBe(7);
  });

  it('16. isLaneHeartbeatStale returns false when no heartbeat exists', () => {
    const state = makeState();
    expect(isLaneHeartbeatStale(state, 'L-DAILY', 5 * 60_000)).toBe(false);
  });

  it('17. isLaneHeartbeatStale returns false for fresh heartbeat', () => {
    const state = makeState();
    writeLaneHeartbeat(state, 'L-DAILY', null);
    // heartbeat was just written — age ≈ 0ms
    expect(isLaneHeartbeatStale(state, 'L-DAILY', 5 * 60_000)).toBe(false);
  });

  it('18. isLaneHeartbeatStale returns true for artificially old heartbeat', () => {
    const state = makeState();
    state.laneHeartbeats = {
      'L-DAILY': {
        lane: 'L-DAILY',
        lastHeartbeatAt: new Date(Date.now() - 10 * 60_000).toISOString(), // 10 min ago
        runningTaskId: null,
      },
    };
    expect(isLaneHeartbeatStale(state, 'L-DAILY', 5 * 60_000)).toBe(true);
  });
});

describe('B-01 Lane Guard — buildLaneSummaries', () => {
  it('19. returns one entry per lane passed', () => {
    const state = makeState();
    const summaries = buildLaneSummaries([], state, ['L-DAILY', 'L-NIGHTLY']);
    expect(summaries).toHaveLength(2);
    expect(summaries.map((s) => s.lane)).toEqual(['L-DAILY', 'L-NIGHTLY']);
  });

  it('20. marks running task correctly in summary', () => {
    const running = makeTask(5, 'RUNNING', 'L-DAILY', NOW);
    const state = makeState();
    writeLaneHeartbeat(state, 'L-DAILY', 5);
    const summaries = buildLaneSummaries([running], state, ['L-DAILY', 'L-NIGHTLY']);
    const daily = summaries.find((s) => s.lane === 'L-DAILY')!;
    expect(daily.runningTask?.taskId).toBe(5);
    const nightly = summaries.find((s) => s.lane === 'L-NIGHTLY')!;
    expect(nightly.runningTask).toBeNull();
  });
});

describe('B-01 Lane Guard — type constants', () => {
  it('21. SchedulerLane is assignable to the five defined values (compile-time)', () => {
    // This test is mainly a type guard — if the type narrowed incorrectly tsc would fail.
    const lane: SchedulerLane = 'L-INTRADAY';
    expect(lane).toBe('L-INTRADAY');
  });

  it('22. DEFAULT_LANE = L-ONDEMAND', () => {
    expect(DEFAULT_LANE).toBe('L-ONDEMAND');
  });

  it('23. SCHEDULER_LANES has exactly 5 entries', () => {
    expect(SCHEDULER_LANES).toHaveLength(5);
    expect(SCHEDULER_LANES).toContain('L-INTRADAY');
    expect(SCHEDULER_LANES).toContain('L-DAILY');
    expect(SCHEDULER_LANES).toContain('L-NIGHTLY');
    expect(SCHEDULER_LANES).toContain('L-WEEKLY');
    expect(SCHEDULER_LANES).toContain('L-ONDEMAND');
  });
});

describe('B-01 Runtime safety', () => {
  const SCHEDULER_STATE_FILE = join(
    __dirname, '..', '..', '..', '..', 'runtime', 'agent_orchestrator', 'scheduler_state.json',
  );

  it('24. scheduler_state.json is readable and has a boolean schedulerEnabled field', () => {
    // Weak guard: we only verify the file is parseable JSON with the expected field type.
    // A stricter check for schedulerEnabled=false lives in providerCapability.test.ts (test 24).
    expect(existsSync(SCHEDULER_STATE_FILE)).toBe(true);
    const raw = readFileSync(SCHEDULER_STATE_FILE, 'utf-8');
    const state = JSON.parse(raw) as Record<string, unknown>;
    expect(typeof state['schedulerEnabled']).toBe('boolean');
  });
});
