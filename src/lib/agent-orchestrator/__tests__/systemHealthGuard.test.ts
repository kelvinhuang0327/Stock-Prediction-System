/**
 * systemHealthGuard.test.ts — B-02.3: System Health Guard tests
 *
 * Tests guard decision logic, warning level mapping, logging, and
 * in-memory warning accumulation.  All external I/O is mocked so
 * the suite is fully deterministic.
 */

import {
  shouldWarnOnDispatch,
  shouldWarnOnWorkerRun,
  shouldAnnotateTask,
  logGuardDecision,
  recordGuardWarning,
  flushGuardWarnings,
  peekGuardWarnings,
  type GuardDecision,
} from '../systemHealthGuard';

// ---------------------------------------------------------------------------
// Mock profile + storage so getSystemHealthStatus() does not touch disk
// ---------------------------------------------------------------------------

jest.mock('../profile', () => ({
  loadProjectProfile: jest.fn().mockResolvedValue({
    project_slug: 'test-project',
    orchestrator_root: '/mock/runtime',
  }),
}));

jest.mock('../storage', () => ({
  loadSchedulerState: jest.fn().mockResolvedValue({
    paths: { orchestratorRoot: '/mock/runtime' },
    state: { schedulerEnabled: true },
  }),
}));

// Inject mock history via readJsonFile
const mockHistoryEntries: unknown[] = [];

jest.mock('../common', () => ({
  nowIso: () => '2026-05-05T00:00:00.000Z',
  readJsonFile: jest.fn().mockImplementation(async () => ({
    version: '1.0',
    entries: mockHistoryEntries,
  })),
  writeJsonFile: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// In appendCleanupHistory, entries are prepended (most-recent-first).
// Provide values in old-to-new order; helper reverses to most-recent-first.
function makeHistoryEntries(expiredLocks: number[], staleHeartbeats: number[], reclaimed: number[]) {
  const entries = expiredLocks.map((el, i) => ({
    timestamp: `2026-05-0${i + 1}T00:00:00.000Z`,
    expiredLockCount: el,
    staleHeartbeatCount: staleHeartbeats[i] ?? 0,
    tasksReclaimed: reclaimed[i] ?? 0,
  }));
  // Reverse so index 0 is the most-recent entry (matches appendCleanupHistory ordering).
  return entries.reverse();
}

// ---------------------------------------------------------------------------
// Global: clear guard warning buffer before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  flushGuardWarnings();
});

// ---------------------------------------------------------------------------
// Guard decisions — healthy system
// ---------------------------------------------------------------------------

describe('systemHealthGuard — healthy system', () => {
  beforeEach(() => {
    mockHistoryEntries.length = 0;
  });

  it('shouldWarnOnDispatch returns allowed=true with warningLevel=none when healthy', async () => {
    const decision = await shouldWarnOnDispatch();
    expect(decision.allowed).toBe(true);
    expect(decision.warningLevel).toBe('none');
    expect(decision.signals).toEqual([]);
    expect(decision.reason).toContain('healthy');
  });

  it('shouldWarnOnWorkerRun returns allowed=true with warningLevel=none when healthy', async () => {
    const decision = await shouldWarnOnWorkerRun();
    expect(decision.allowed).toBe(true);
    expect(decision.warningLevel).toBe('none');
  });

  it('shouldAnnotateTask returns healthy status with empty signals when healthy', async () => {
    const annotation = await shouldAnnotateTask();
    expect(annotation.status).toBe('healthy');
    expect(annotation.signals).toEqual([]);
    expect(annotation.evaluatedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Guard decisions — degraded system (1 rising trend)
// ---------------------------------------------------------------------------

describe('systemHealthGuard — degraded system', () => {
  beforeEach(() => {
    // 6 entries: older half (0) vs recent half (10) → worker_unstable rising
    mockHistoryEntries.length = 0;
    const entries = makeHistoryEntries(
      [0, 0, 0, 10, 10, 10],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    );
    mockHistoryEntries.push(...entries);
  });

  it('shouldWarnOnDispatch returns warningLevel=elevated when degraded', async () => {
    const decision = await shouldWarnOnDispatch();
    expect(decision.allowed).toBe(true);
    expect(decision.warningLevel).toBe('elevated');
    expect(decision.signals.length).toBeGreaterThan(0);
    expect(decision.reason).toContain('degraded');
  });

  it('shouldWarnOnWorkerRun returns warningLevel=elevated when degraded', async () => {
    const decision = await shouldWarnOnWorkerRun();
    expect(decision.allowed).toBe(true);
    expect(decision.warningLevel).toBe('elevated');
  });

  it('shouldAnnotateTask returns degraded status with signals when degraded', async () => {
    const annotation = await shouldAnnotateTask();
    expect(annotation.status).toBe('degraded');
    expect(annotation.signals.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Guard decisions — critical system (2+ rising trends)
// ---------------------------------------------------------------------------

describe('systemHealthGuard — critical system', () => {
  beforeEach(() => {
    // 6 entries: both expiredLockCount and staleHeartbeatCount rising
    mockHistoryEntries.length = 0;
    const entries = makeHistoryEntries(
      [0, 0, 0, 10, 10, 10],
      [0, 0, 0, 5, 5, 5],
      [0, 0, 0, 0, 0, 0],
    );
    mockHistoryEntries.push(...entries);
  });

  it('shouldWarnOnDispatch returns warningLevel=high when critical', async () => {
    const decision = await shouldWarnOnDispatch();
    expect(decision.allowed).toBe(true);
    expect(decision.warningLevel).toBe('high');
    expect(decision.signals.length).toBeGreaterThanOrEqual(2);
    expect(decision.reason).toContain('critical');
  });

  it('shouldAnnotateTask returns critical status when critical', async () => {
    const annotation = await shouldAnnotateTask();
    expect(annotation.status).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// logGuardDecision — warning accumulation
// ---------------------------------------------------------------------------

describe('logGuardDecision — warning accumulation', () => {
  beforeEach(() => {
    mockHistoryEntries.length = 0;
  });

  it('does NOT record a warning when warningLevel=none', () => {
    const decision: GuardDecision = {
      allowed: true,
      warningLevel: 'none',
      reason: 'healthy',
      signals: [],
    };
    logGuardDecision('plannerTick', 'dispatch', decision);
    expect(peekGuardWarnings()).toHaveLength(0);
  });

  it('records a warning when warningLevel=elevated', () => {
    const decision: GuardDecision = {
      allowed: true,
      warningLevel: 'elevated',
      reason: 'degraded — worker_unstable',
      signals: [{ label: 'worker_unstable', description: 'rising', recentAvg: 5, olderAvg: 0, windowSize: 6 }],
    };
    logGuardDecision('plannerTick', 'dispatch', decision);
    const warnings = peekGuardWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0].guard).toBe('dispatch');
    expect(warnings[0].warningLevel).toBe('elevated');
    expect(warnings[0].signalLabels).toContain('worker_unstable');
  });

  it('records a warning when warningLevel=high', () => {
    const decision: GuardDecision = {
      allowed: true,
      warningLevel: 'high',
      reason: 'critical — multiple signals',
      signals: [
        { label: 'worker_unstable', description: 'r', recentAvg: 5, olderAvg: 0, windowSize: 6 },
        { label: 'crash_rate_up', description: 'r', recentAvg: 3, olderAvg: 0, windowSize: 6 },
      ],
    };
    logGuardDecision('workerTick', 'worker_run', decision);
    const warnings = peekGuardWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0].signalLabels).toEqual(['worker_unstable', 'crash_rate_up']);
  });

  it('accumulates multiple warnings', () => {
    const elevated: GuardDecision = {
      allowed: true, warningLevel: 'elevated', reason: 'degraded', signals: [
        { label: 'worker_unstable', description: 'r', recentAvg: 5, olderAvg: 0, windowSize: 6 },
      ],
    };
    logGuardDecision('plannerTick', 'dispatch', elevated);
    logGuardDecision('workerTick', 'worker_run', elevated);
    expect(peekGuardWarnings()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// flushGuardWarnings — clears buffer
// ---------------------------------------------------------------------------

describe('flushGuardWarnings', () => {
  it('returns all warnings and empties the buffer', () => {
    recordGuardWarning({
      guard: 'dispatch',
      warningLevel: 'elevated',
      reason: 'test',
      signalLabels: ['worker_unstable'],
      recordedAt: '2026-05-05T00:00:00.000Z',
    });
    const flushed = flushGuardWarnings();
    expect(flushed).toHaveLength(1);
    expect(peekGuardWarnings()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Error resilience — getSystemHealthStatus failure
// ---------------------------------------------------------------------------

describe('systemHealthGuard — error resilience', () => {
  const { readJsonFile } = jest.requireMock('../common') as { readJsonFile: jest.Mock };

  beforeEach(() => {
    flushGuardWarnings();
    readJsonFile.mockReset();
  });

  afterEach(() => {
    readJsonFile.mockResolvedValue({ version: '1.0', entries: mockHistoryEntries });
  });

  it('shouldWarnOnDispatch returns none/allowed even when health check throws', async () => {
    readJsonFile.mockRejectedValueOnce(new Error('disk failure'));
    const decision = await shouldWarnOnDispatch();
    expect(decision.allowed).toBe(true);
    expect(decision.warningLevel).toBe('none');
  });

  it('shouldWarnOnWorkerRun returns none/allowed even when health check throws', async () => {
    readJsonFile.mockRejectedValueOnce(new Error('disk failure'));
    const decision = await shouldWarnOnWorkerRun();
    expect(decision.allowed).toBe(true);
    expect(decision.warningLevel).toBe('none');
  });

  it('shouldAnnotateTask returns healthy even when health check throws', async () => {
    readJsonFile.mockRejectedValueOnce(new Error('disk failure'));
    const annotation = await shouldAnnotateTask();
    expect(annotation.status).toBe('healthy');
    expect(annotation.signals).toEqual([]);
  });
});
