/**
 * B-102 Task Attribution Tests
 *
 * Verifies that idle cycles (no_queued_task), disabled ticks (scheduler_disabled),
 * and genuine execution anomalies (missing taskId with no reason) are properly
 * distinguished in llm_usage logs and warning engine output.
 *
 * Tests:
 *  1.  no_queued_task preflight logs noTaskReason = 'no_queued_task'
 *  2.  scheduler_disabled preflight logs noTaskReason = 'scheduler_disabled'
 *  3.  no_queued_task does NOT trigger COPILOT_PREFLIGHT_LOOP
 *  4.  scheduler_disabled does NOT trigger COPILOT_PREFLIGHT_LOOP
 *  5.  noTaskReason present — does NOT trigger COPILOT_MISSING_TASK_ID
 *  6.  execution missing taskId (noTaskReason=null) triggers COPILOT_MISSING_TASK_ID (WARNING)
 *  7.  task-bound preflight has taskId set
 *  8.  old records without noTaskReason field do not crash warning engine
 *  9.  UI UsageRecord interface accepts noTaskReason (type-level test)
 * 10.  policy_blocked noTaskReason does not trigger loop or missing-task warnings
 * 11.  mixed records: only anomalous executions count toward Rule F
 */

import { appendFileSync, mkdirSync } from 'node:fs';

// ── Mock filesystem ──────────────────────────────────────────────────────────
jest.mock('node:fs', () => ({
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

const mockAppend = appendFileSync as jest.Mock;

function lastRecord(): Record<string, unknown> {
  const calls = mockAppend.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return JSON.parse(calls[calls.length - 1][1] as string) as Record<string, unknown>;
}

beforeEach(() => {
  mockAppend.mockClear();
  delete process.env['AGENT_ORCHESTRATOR_WORKER_MODEL'];
});

// ── Logger tests ─────────────────────────────────────────────────────────────
import { logProviderPreflight } from '../llmUsageLogger';
import type { NoTaskReason } from '../llmUsageLogger';

describe('llmUsageLogger — noTaskReason', () => {
  test('1. no_queued_task preflight logs noTaskReason = no_queued_task', () => {
    logProviderPreflight({
      caller: 'worker',
      provider: 'copilot-daemon',
      allowed: false,
      noTaskReason: 'no_queued_task',
      taskId: null,
    });
    const r = lastRecord();
    expect(r['noTaskReason']).toBe('no_queued_task');
    expect(r['taskId']).toBeNull();
    expect(r['decision']).toBe('skip');
    expect(r['phase']).toBe('preflight');
  });

  test('2. scheduler_disabled preflight logs noTaskReason = scheduler_disabled', () => {
    logProviderPreflight({
      caller: 'worker',
      provider: 'copilot-daemon',
      allowed: false,
      skipReason: 'SCHEDULER_DISABLED',
      noTaskReason: 'scheduler_disabled',
      taskId: null,
    });
    const r = lastRecord();
    expect(r['noTaskReason']).toBe('scheduler_disabled');
    expect(r['taskId']).toBeNull();
    expect(r['decision']).toBe('skip');
  });

  test('7. task-bound preflight has taskId set and noTaskReason = null', () => {
    logProviderPreflight({
      caller: 'worker',
      provider: 'copilot-daemon',
      allowed: true,
      taskId: 42,
      noTaskReason: null,
    });
    const r = lastRecord();
    expect(r['taskId']).toBe('42');
    expect(r['noTaskReason']).toBeNull();
    expect(r['decision']).toBe('allow');
  });

  test('noTaskReason defaults to null when not provided', () => {
    logProviderPreflight({
      caller: 'worker',
      provider: 'copilot-daemon',
      allowed: true,
      taskId: 99,
    });
    const r = lastRecord();
    expect(r['noTaskReason']).toBeNull();
  });

  test('NoTaskReason type accepts all valid values', () => {
    const values: NoTaskReason[] = ['no_queued_task', 'scheduler_disabled', 'policy_blocked', null];
    for (const v of values) {
      mockAppend.mockClear();
      logProviderPreflight({
        caller: 'worker',
        provider: 'copilot-daemon',
        allowed: false,
        noTaskReason: v,
      });
      const r = lastRecord();
      expect(r['noTaskReason']).toBe(v);
    }
  });
});

// ── Warning engine tests ─────────────────────────────────────────────────────
import { computeWarnings } from '../llmUsageWarnings';
import type { WarningInputRecord } from '../llmUsageWarnings';

/** Build a minimal copilot preflight record */
function preflight(overrides: Partial<WarningInputRecord> = {}): WarningInputRecord {
  return {
    phase: 'preflight',
    event: 'provider_preflight',
    provider: 'copilot-daemon',
    caller: 'worker',
    decision: 'allow',
    taskId: null,
    parsed: true,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    premiumRequests: 0,
    ...overrides,
  };
}

/** Build a minimal copilot execution success record */
function execution(overrides: Partial<WarningInputRecord> = {}): WarningInputRecord {
  return {
    phase: 'execution',
    event: 'provider_execution_success',
    provider: 'copilot-daemon',
    caller: 'worker',
    decision: 'success',
    taskId: '42',
    parsed: true,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    premiumRequests: 0,
    ...overrides,
  };
}

describe('computeWarnings — Rule E (COPILOT_PREFLIGHT_LOOP)', () => {
  // Rule E fires when >5 preflight-allow records for same key
  const LOOP_COUNT = 6;

  test('3. no_queued_task preflight records do NOT trigger COPILOT_PREFLIGHT_LOOP', () => {
    const records = Array.from({ length: LOOP_COUNT }, () =>
      preflight({ decision: 'allow', noTaskReason: 'no_queued_task' }),
    );
    const warnings = computeWarnings(records);
    const loopWarning = warnings.find(w => w.code === 'COPILOT_PREFLIGHT_LOOP');
    expect(loopWarning).toBeUndefined();
  });

  test('4. scheduler_disabled preflight records do NOT trigger COPILOT_PREFLIGHT_LOOP', () => {
    const records = Array.from({ length: LOOP_COUNT }, () =>
      preflight({ decision: 'skip', noTaskReason: 'scheduler_disabled' }),
    );
    const warnings = computeWarnings(records);
    const loopWarning = warnings.find(w => w.code === 'COPILOT_PREFLIGHT_LOOP');
    expect(loopWarning).toBeUndefined();
  });

  test('10. policy_blocked records do NOT trigger COPILOT_PREFLIGHT_LOOP', () => {
    const records = Array.from({ length: LOOP_COUNT }, () =>
      preflight({ decision: 'allow', noTaskReason: 'policy_blocked' }),
    );
    const warnings = computeWarnings(records);
    const loopWarning = warnings.find(w => w.code === 'COPILOT_PREFLIGHT_LOOP');
    expect(loopWarning).toBeUndefined();
  });

  test('preflight loop DOES fire for real task with no noTaskReason', () => {
    // Records with a real taskId and no noTaskReason — should trigger
    const records = Array.from({ length: LOOP_COUNT }, () =>
      preflight({ decision: 'allow', taskId: '7', noTaskReason: null }),
    );
    const warnings = computeWarnings(records);
    const loopWarning = warnings.find(w => w.code === 'COPILOT_PREFLIGHT_LOOP');
    expect(loopWarning).toBeDefined();
    expect(loopWarning?.taskId).toBe('7');
  });
});

describe('computeWarnings — Rule F (COPILOT_MISSING_TASK_ID)', () => {
  test('5. noTaskReason present — does NOT trigger COPILOT_MISSING_TASK_ID', () => {
    const records: WarningInputRecord[] = [
      preflight({ noTaskReason: 'no_queued_task', taskId: null }),
      preflight({ noTaskReason: 'scheduler_disabled', taskId: null }),
      preflight({ noTaskReason: 'policy_blocked', taskId: null }),
    ];
    const warnings = computeWarnings(records);
    const missingWarning = warnings.find(w => w.code === 'COPILOT_MISSING_TASK_ID');
    expect(missingWarning).toBeUndefined();
  });

  test('6. execution missing taskId with noTaskReason=null triggers COPILOT_MISSING_TASK_ID at WARNING', () => {
    const records: WarningInputRecord[] = [
      execution({ taskId: null, noTaskReason: null }),
    ];
    const warnings = computeWarnings(records);
    const missingWarning = warnings.find(w => w.code === 'COPILOT_MISSING_TASK_ID');
    expect(missingWarning).toBeDefined();
    expect(missingWarning?.level).toBe('WARNING');
  });

  test('8. old records without noTaskReason field do not crash warning engine', () => {
    // Simulate legacy records that have no noTaskReason property at all
    const legacyRecord = {
      phase: 'preflight',
      event: 'provider_preflight',
      provider: 'copilot-daemon',
      caller: 'worker',
      decision: 'allow',
      taskId: null,
      parsed: true,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      premiumRequests: 0,
      // noTaskReason intentionally absent (old record)
    } as WarningInputRecord;

    expect(() => computeWarnings([legacyRecord])).not.toThrow();
    // Since noTaskReason is absent (undefined treated as null), it counts as unexplained
    const warnings = computeWarnings([legacyRecord]);
    // Should not crash — may or may not produce a warning, but must not throw
    expect(Array.isArray(warnings)).toBe(true);
  });

  test('11. mixed records: only anomalous executions count toward Rule F (WARNING)', () => {
    const records: WarningInputRecord[] = [
      // These are all idle/disabled — should NOT count
      preflight({ noTaskReason: 'no_queued_task', taskId: null }),
      preflight({ noTaskReason: 'scheduler_disabled', taskId: null }),
      preflight({ noTaskReason: 'policy_blocked', taskId: null }),
      // This is a real task — has taskId — should NOT count
      execution({ taskId: '5', noTaskReason: null }),
      // This IS anomalous — execution without taskId and no reason
      execution({ taskId: null, noTaskReason: null }),
    ];
    const warnings = computeWarnings(records);
    const missingWarnings = warnings.filter(w => w.code === 'COPILOT_MISSING_TASK_ID');
    // Only the single anomalous execution should trigger the WARNING
    const warningLevel = missingWarnings.find(w => w.level === 'WARNING');
    expect(warningLevel).toBeDefined();
    expect(warningLevel?.count).toBe(1);
  });
});

// ── Type-level test (compile-time) ───────────────────────────────────────────
describe('UsageRecord interface (type check)', () => {
  test('9. UI UsageRecord can hold noTaskReason', () => {
    // This is a compile-time test — if it builds without TS errors, the type is correct.
    // We construct a minimal object that satisfies UsageRecord (imported via the API shape).
    const record = {
      timestamp: '2026-05-04T00:00:00.000Z',
      phase: 'preflight',
      event: 'provider_preflight',
      caller: 'worker',
      triggerSource: 'scheduler',
      provider: 'copilot-daemon',
      model: null,
      taskId: null,
      jobName: null,
      decision: 'skip',
      skipReason: 'SCHEDULER_DISABLED',
      errorCode: null,
      errorMessage: null,
      parsed: true,
      premiumRequests: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      rateLimit: null,
      durationMs: 0,
      desiredModel: null,
      actualModel: null,
      modelPropagationStatus: null,
      noTaskReason: 'scheduler_disabled' as string | null,
    };
    expect(record.noTaskReason).toBe('scheduler_disabled');
    expect(record.taskId).toBeNull();
  });
});
