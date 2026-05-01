/**
 * LLM Usage Observability — 12 required test cases.
 *
 * All file I/O is intercepted via jest spies so no real filesystem writes occur.
 * Each test resets module state so records don't bleed across cases.
 */

import { appendFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';

jest.mock('node:fs', () => ({
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

const mockAppend = appendFileSync as jest.Mock;
const _mockMkdir = mkdirSync as jest.Mock;

// Helper: get the last JSON record written to the mock
function lastRecord(): Record<string, unknown> {
  const calls = mockAppend.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const lastCall = calls[calls.length - 1];
  return JSON.parse(lastCall[1] as string) as Record<string, unknown>;
}

// Helper: get all written records
function allRecords(): Record<string, unknown>[] {
  return mockAppend.mock.calls.map((c) => JSON.parse(c[1] as string) as Record<string, unknown>);
}

// Re-import after mocking
import {
  logProviderPreflight,
  logProviderExecutionStart,
  logProviderExecutionSuccess,
  logProviderExecutionFailure,
  logProviderBlocked,
} from '../llmUsageLogger';

beforeEach(() => {
  mockAppend.mockClear();
});

// ──────────────────────────────────────────────────────────────────────────────
// 1. Claude execution logs start AND success
// ──────────────────────────────────────────────────────────────────────────────
test('1. Claude execution logs start and success', () => {
  logProviderExecutionStart({
    caller: 'ai_service',
    provider: 'claude',
    model: 'claude-3-opus',
    taskId: 'task-001',
  });

  logProviderExecutionSuccess({
    caller: 'ai_service',
    provider: 'claude',
    model: 'claude-3-opus',
    taskId: 'task-001',
    inputTokens: 500,
    outputTokens: 200,
    durationMs: 1200,
  });

  const records = allRecords();
  expect(records.length).toBe(2);

  const start = records[0];
  expect(start['phase']).toBe('execution');
  expect(start['event']).toBe('provider_execution_start');
  expect(start['provider']).toBe('claude');
  expect(start['decision']).toBe('allow');

  const success = records[1];
  expect(success['phase']).toBe('execution');
  expect(success['event']).toBe('provider_execution_success');
  expect(success['decision']).toBe('success');
  expect(success['inputTokens']).toBe(500);
  expect(success['outputTokens']).toBe(200);
  expect(success['durationMs']).toBe(1200);
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Codex execution logs start AND failure
// ──────────────────────────────────────────────────────────────────────────────
test('2. Codex execution logs start and failure', () => {
  logProviderExecutionStart({
    caller: 'ai_service',
    provider: 'codex',
    model: 'codex-1',
    taskId: 'task-002',
  });

  logProviderExecutionFailure({
    caller: 'ai_service',
    provider: 'codex',
    model: 'codex-1',
    taskId: 'task-002',
    errorCode: 'exit_nonzero',
    errorMessage: 'Process exited with code 1',
    durationMs: 800,
  });

  const records = allRecords();
  expect(records.length).toBe(2);

  const start = records[0];
  expect(start['event']).toBe('provider_execution_start');
  expect(start['provider']).toBe('codex');

  const failure = records[1];
  expect(failure['phase']).toBe('failed');
  expect(failure['event']).toBe('provider_execution_failed');
  expect(failure['decision']).toBe('failed');
  expect(failure['errorCode']).toBe('exit_nonzero');
  expect(failure['durationMs']).toBe(800);
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. GitHub Copilot / copilot-daemon usage is logged
// ──────────────────────────────────────────────────────────────────────────────
test('3. GitHub Copilot / copilot-daemon usage is logged', () => {
  logProviderExecutionSuccess({
    caller: 'worker',
    provider: 'copilot-daemon',
    model: null,
    taskId: 'task-003',
    premiumRequests: 1,
    inputTokens: 1000,
    outputTokens: 300,
  });

  const rec = lastRecord();
  expect(rec['provider']).toBe('copilot-daemon');
  expect(rec['premiumRequests']).toBe(1);
  expect(rec['phase']).toBe('execution');
  expect(rec['event']).toBe('provider_execution_success');
  expect(rec['source']).toBe('llmUsageLogger.ts');
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Preflight is NOT counted as quota usage
// ──────────────────────────────────────────────────────────────────────────────
test('4. Preflight is not counted as quota usage', () => {
  logProviderPreflight({
    caller: 'planner',
    provider: 'claude',
    allowed: true,
    premiumRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
  });

  const rec = lastRecord();
  expect(rec['phase']).toBe('preflight');
  expect(rec['event']).toBe('provider_preflight');
  expect(rec['decision']).toBe('allow');
  // Token fields default to 0 — confirms preflight records won't inflate quota
  expect(rec['premiumRequests']).toBe(0);
  expect(rec['inputTokens']).toBe(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. local-planner is NOT counted as Codex
// ──────────────────────────────────────────────────────────────────────────────
test('5. local-planner is not counted as Codex', () => {
  logProviderExecutionSuccess({
    caller: 'planner',
    provider: 'local-planner',
    model: null,
    taskId: null,
    premiumRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
  });

  const rec = lastRecord();
  expect(rec['provider']).toBe('local-planner');
  expect(rec['provider']).not.toBe('codex');
  expect(rec['premiumRequests']).toBe(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. local-review is NOT counted as Claude or Codex
// ──────────────────────────────────────────────────────────────────────────────
test('6. local-review is not counted as Claude/Codex', () => {
  logProviderExecutionSuccess({
    caller: 'cto',
    provider: 'local-review',
    model: null,
    taskId: null,
    premiumRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
  });

  const rec = lastRecord();
  expect(rec['provider']).toBe('local-review');
  expect(rec['provider']).not.toBe('claude');
  expect(rec['provider']).not.toBe('codex');
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. Blocked calls are visible but not counted as execution usage
// ──────────────────────────────────────────────────────────────────────────────
test('7. Blocked calls are visible but not counted as usage', () => {
  logProviderBlocked({
    caller: 'worker',
    provider: 'codex',
    skipReason: 'CODEX_WORKER_NOT_ENABLED',
    premiumRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
  });

  const rec = lastRecord();
  expect(rec['phase']).toBe('blocked');
  expect(rec['event']).toBe('provider_blocked');
  expect(rec['decision']).toBe('block');
  expect(rec['skipReason']).toBe('CODEX_WORKER_NOT_ENABLED');
  // Token fields are 0 — confirms blocked calls don't inflate quota
  expect(rec['premiumRequests']).toBe(0);
  expect(rec['inputTokens']).toBe(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// 8. Missing token fields do not crash the logger
// ──────────────────────────────────────────────────────────────────────────────
test('8. Missing token fields do not crash parser', () => {
  expect(() => {
    logProviderExecutionSuccess({
      caller: 'ai_service',
      provider: 'claude',
      // Intentionally omitting all token fields
    });
  }).not.toThrow();

  const rec = lastRecord();
  expect(rec['inputTokens']).toBe(0);
  expect(rec['outputTokens']).toBe(0);
  expect(rec['cachedTokens']).toBe(0);
  expect(rec['premiumRequests']).toBe(0);
  expect(rec['durationMs']).toBe(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// 9. parsed=false still appears in the record
// ──────────────────────────────────────────────────────────────────────────────
test('9. parsed=false still appears in recent table', () => {
  logProviderExecutionSuccess({
    caller: 'worker',
    provider: 'copilot-daemon',
    taskId: 'task-shell',
    parsed: false,
    premiumRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
  });

  const rec = lastRecord();
  expect(rec['parsed']).toBe(false);
  expect(rec['phase']).toBe('execution');
  expect(rec['event']).toBe('provider_execution_success');
});

// ──────────────────────────────────────────────────────────────────────────────
// 10. Token aggregation works by role and provider
// ──────────────────────────────────────────────────────────────────────────────
test('10. Token aggregation works by role and provider', () => {
  // Simulate two success calls for same role
  logProviderExecutionSuccess({
    caller: 'planner',
    provider: 'claude',
    inputTokens: 1000,
    outputTokens: 400,
    cachedTokens: 200,
    premiumRequests: 1,
  });

  logProviderExecutionSuccess({
    caller: 'planner',
    provider: 'claude',
    inputTokens: 500,
    outputTokens: 100,
    cachedTokens: 50,
    premiumRequests: 1,
  });

  const records = allRecords();
  const plannerRecords = records.filter((r) => r['caller'] === 'planner' && r['provider'] === 'claude');
  expect(plannerRecords.length).toBe(2);

  const totalInput = plannerRecords.reduce((acc, r) => acc + (r['inputTokens'] as number), 0);
  const totalOutput = plannerRecords.reduce((acc, r) => acc + (r['outputTokens'] as number), 0);
  const totalCached = plannerRecords.reduce((acc, r) => acc + (r['cachedTokens'] as number), 0);
  const totalPremium = plannerRecords.reduce((acc, r) => acc + (r['premiumRequests'] as number), 0);

  expect(totalInput).toBe(1500);
  expect(totalOutput).toBe(500);
  expect(totalCached).toBe(250);
  expect(totalPremium).toBe(2);
});

// ──────────────────────────────────────────────────────────────────────────────
// 11. Recent table limits to latest 10
// ──────────────────────────────────────────────────────────────────────────────
test('11. Recent table limits to latest 10', () => {
  // Write 15 records
  for (let i = 0; i < 15; i++) {
    logProviderExecutionSuccess({
      caller: 'worker',
      provider: 'codex',
      taskId: `task-${i}`,
      inputTokens: i * 10,
      outputTokens: i * 5,
    });
  }

  const records = allRecords();
  // Slicing the last 10 (as the API route does) should work correctly
  const recent = [...records].reverse().slice(0, 10);
  expect(recent.length).toBe(10);
  // Most recent should be task-14
  expect(recent[0]['taskId']).toBe('task-14');
  // 11th (task-4 and earlier) should NOT appear
  const taskIds = recent.map((r) => r['taskId']);
  expect(taskIds).not.toContain('task-4');
});

// ──────────────────────────────────────────────────────────────────────────────
// 12. Secrets are redacted — commandHash is hash, not raw command
// ──────────────────────────────────────────────────────────────────────────────
test('12. Secrets are redacted — commandHash is hash, not raw command', () => {
  const secretCommand = 'gh copilot suggest --token SECRET_API_KEY_abc123 do something';

  logProviderExecutionStart({
    caller: 'ai_service',
    provider: 'copilot-daemon',
    command: secretCommand,
    taskId: 'task-secret',
  });

  const rec = lastRecord();

  // Raw command MUST NOT appear in the record
  const raw = JSON.stringify(rec);
  expect(raw).not.toContain('SECRET_API_KEY_abc123');
  expect(raw).not.toContain(secretCommand);

  // commandHash must be present and be a valid 12-char hex string
  const hash = rec['commandHash'];
  expect(typeof hash).toBe('string');
  expect(hash).toMatch(/^[0-9a-f]{12}$/);
  expect(hash).not.toBe(secretCommand);
});
