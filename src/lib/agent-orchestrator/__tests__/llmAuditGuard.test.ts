/**
 * LLM Audit Guard — 25 required test cases covering the full audit lifecycle.
 *
 * Verifies the fail-closed design:
 *   - External provider must write LLM_CALL_ATTEMPT before executing.
 *   - Audit write failure blocks provider execution.
 *   - Policy blocked writes LLM_CALL_BLOCKED.
 *   - Local provider writes no audit.
 *   - Unknown provider is treated as external.
 */

import { appendFileSync, mkdirSync } from 'node:fs';

jest.mock('node:fs', () => ({
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

const mockAppend = appendFileSync as jest.Mock;

import {
  writeAuditAttempt,
  writeAuditResult,
  writeAuditBlocked,
  isExternalProvider,
} from '../llmAuditGuard';

beforeEach(() => {
  mockAppend.mockClear();
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function lastRecord(): Record<string, unknown> {
  const calls = mockAppend.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return JSON.parse(calls[calls.length - 1][1] as string) as Record<string, unknown>;
}

function allRecords(): Record<string, unknown>[] {
  return mockAppend.mock.calls.map((c) => JSON.parse(c[1] as string) as Record<string, unknown>);
}

// ─── 1. External provider writes LLM_CALL_ATTEMPT before execute ────────────
test('1. External provider writes LLM_CALL_ATTEMPT before execute', () => {
  const result = writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'claude',
    taskId: 'task-001',
    triggerSource: 'worker_execute',
    callerFile: 'aiService.ts',
    callerFunction: 'executeWorkerProviderCommand',
  });

  expect(result.written).toBe(true);
  expect(result.correlationId).toBeTruthy();

  const rec = lastRecord();
  expect(rec['event_type']).toBe('LLM_CALL_ATTEMPT');
  expect(rec['provider']).toBe('claude');
  expect(rec['blocked']).toBe(false);
  expect(rec['correlation_id']).toBe(result.correlationId);
});

// ─── 2. External provider writes LLM_CALL_RESULT after success ──────────────
test('2. External provider writes LLM_CALL_RESULT after success', () => {
  const attempt = writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'copilot-daemon',
    taskId: 'task-002',
    triggerSource: 'worker_execute',
  });

  writeAuditResult({
    correlationId: attempt.correlationId,
    provider: 'copilot-daemon',
    usageRole: 'worker',
    runnerType: 'ai_service',
    taskId: 'task-002',
    triggerSource: 'worker_execute',
    success: true,
    durationMs: 1500,
    inputTokens: 300,
    outputTokens: 100,
  });

  const records = allRecords();
  expect(records.length).toBe(2);
  const result = records[1];
  expect(result['event_type']).toBe('LLM_CALL_RESULT');
  expect(result['success']).toBe(true);
  expect(result['duration_ms']).toBe(1500);
  expect(result['input_tokens']).toBe(300);
  expect(result['correlation_id']).toBe(attempt.correlationId);
});

// ─── 3. External provider writes LLM_CALL_RESULT after failure ──────────────
test('3. External provider writes LLM_CALL_RESULT after failure', () => {
  const attempt = writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'codex',
    taskId: 'task-003',
    triggerSource: 'worker_execute',
  });

  writeAuditResult({
    correlationId: attempt.correlationId,
    provider: 'codex',
    usageRole: 'worker',
    runnerType: 'ai_service',
    taskId: 'task-003',
    triggerSource: 'worker_execute',
    success: false,
    error: 'rate_limit: quota exceeded',
    durationMs: 500,
  });

  const records = allRecords();
  expect(records.length).toBe(2);
  const result = records[1];
  expect(result['event_type']).toBe('LLM_CALL_RESULT');
  expect(result['success']).toBe(false);
  expect(result['error']).toContain('rate_limit');
});

// ─── 4. Audit write failure blocks provider execution (fail-closed) ──────────
test('4. Audit write failure blocks provider execution (fail-closed)', () => {
  mockAppend.mockImplementationOnce(() => {
    throw new Error('disk full');
  });

  const result = writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'claude',
    taskId: 'task-004',
    triggerSource: 'worker_execute',
  });

  expect(result.written).toBe(false);
  expect(result.blockReason).toBe('BLOCKED_AUDIT_LOG_UNAVAILABLE');
});

// ─── 5. Policy blocked writes LLM_CALL_BLOCKED ──────────────────────────────
test('5. Policy blocked writes LLM_CALL_BLOCKED', () => {
  writeAuditBlocked({
    provider: 'claude',
    usageRole: 'worker',
    runnerType: 'ai_service',
    taskId: 'task-005',
    triggerSource: 'worker_execute',
    blockReason: 'GLOBAL_HARD_OFF',
    callerFile: 'aiService.ts',
    callerFunction: 'executeWorkerProviderCommand',
  });

  const rec = lastRecord();
  expect(rec['event_type']).toBe('LLM_CALL_BLOCKED');
  expect(rec['blocked']).toBe(true);
  expect(rec['block_reason']).toBe('GLOBAL_HARD_OFF');
  expect(rec['policy_allowed']).toBe(false);
});

// ─── 6. Local provider writes no audit ──────────────────────────────────────
test('6. Local provider is not external — no audit needed for local calls', () => {
  expect(isExternalProvider('local')).toBe(false);
  expect(isExternalProvider('local-planner')).toBe(false);
  expect(isExternalProvider('local-review')).toBe(false);
  expect(isExternalProvider('deterministic')).toBe(false);
  expect(isExternalProvider('rule-based')).toBe(false);
  expect(isExternalProvider('dry-run')).toBe(false);
  expect(isExternalProvider('none')).toBe(false);

  // No audit calls should have been made
  expect(mockAppend.mock.calls.length).toBe(0);
});

// ─── 7. Unknown provider is treated as external ──────────────────────────────
test('7. Unknown provider is treated as external (conservative)', () => {
  expect(isExternalProvider('unknown-model')).toBe(true);
  expect(isExternalProvider('auto')).toBe(true);
  expect(isExternalProvider('smart')).toBe(true);
});

// ─── 8. Claude is external ──────────────────────────────────────────────────
test('8. Known external providers are classified as external', () => {
  expect(isExternalProvider('claude')).toBe(true);
  expect(isExternalProvider('claude-cli')).toBe(true);
  expect(isExternalProvider('codex')).toBe(true);
  expect(isExternalProvider('codex-cli')).toBe(true);
  expect(isExternalProvider('openai')).toBe(true);
  expect(isExternalProvider('copilot')).toBe(true);
  expect(isExternalProvider('github-copilot')).toBe(true);
  expect(isExternalProvider('copilot-daemon')).toBe(true);
  expect(isExternalProvider('gh-copilot')).toBe(true);
});

// ─── 9. Attempt record has required fields ───────────────────────────────────
test('9. LLM_CALL_ATTEMPT record has all required fields', () => {
  writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'claude',
    taskId: 'task-009',
    triggerSource: 'worker_execute',
    callerFile: 'aiService.ts',
    callerFunction: 'executeWorkerProviderCommand',
    requiresLlm: true,
    policyAllowed: true,
  });

  const rec = lastRecord();
  const requiredFields = [
    'timestamp', 'correlation_id', 'event_type', 'runner_type', 'usage_role',
    'provider', 'task_id', 'trigger_source', 'caller_file', 'caller_function',
    'requires_llm', 'policy_allowed', 'blocked', 'block_reason', 'success',
  ];
  for (const field of requiredFields) {
    expect(rec).toHaveProperty(field);
  }
});

// ─── 10. Result record has required fields ───────────────────────────────────
test('10. LLM_CALL_RESULT record has all required fields including token counters', () => {
  const attempt = writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'claude',
  });

  writeAuditResult({
    correlationId: attempt.correlationId,
    provider: 'claude',
    usageRole: 'worker',
    runnerType: 'ai_service',
    success: true,
    durationMs: 800,
    inputTokens: 200,
    outputTokens: 50,
    cachedTokens: 1000,
    premiumRequests: 1,
  });

  const records = allRecords();
  const rec = records[records.length - 1];
  expect(rec['event_type']).toBe('LLM_CALL_RESULT');
  expect(rec['input_tokens']).toBe(200);
  expect(rec['output_tokens']).toBe(50);
  expect(rec['cached_tokens']).toBe(1000);
  expect(rec['total_tokens']).toBe(1250);
  expect(rec['premium_requests']).toBe(1);
  expect(rec['duration_ms']).toBe(800);
});

// ─── 11. BLOCKED record has required fields ──────────────────────────────────
test('11. LLM_CALL_BLOCKED record has all required fields', () => {
  writeAuditBlocked({
    provider: 'claude',
    usageRole: 'cto',
    runnerType: 'cto_review',
    blockReason: 'SCHEDULER_DISABLED',
    triggerSource: 'cto_review',
  });

  const rec = lastRecord();
  expect(rec['event_type']).toBe('LLM_CALL_BLOCKED');
  expect(rec['blocked']).toBe(true);
  expect(rec['block_reason']).toBe('SCHEDULER_DISABLED');
  expect(rec['policy_allowed']).toBe(false);
  expect(rec['usage_role']).toBe('cto');
});

// ─── 12. Planner audit role ──────────────────────────────────────────────────
test('12. Planner role is recorded in audit', () => {
  writeAuditAttempt({
    runnerType: 'planner',
    usageRole: 'planner',
    provider: 'claude',
    triggerSource: 'manual_preview',
  });

  const rec = lastRecord();
  expect(rec['usage_role']).toBe('planner');
  expect(rec['trigger_source']).toBe('manual_preview');
  expect(rec['runner_type']).toBe('planner');
});

// ─── 13. CTO role ────────────────────────────────────────────────────────────
test('13. CTO role is recorded in audit', () => {
  writeAuditAttempt({
    runnerType: 'cto_review',
    usageRole: 'cto',
    provider: 'claude',
    triggerSource: 'cto_review',
  });

  const rec = lastRecord();
  expect(rec['usage_role']).toBe('cto');
  expect(rec['trigger_source']).toBe('cto_review');
});

// ─── 14. ATTEMPT and RESULT share same correlationId ────────────────────────
test('14. ATTEMPT and RESULT share the same correlation_id', () => {
  const attempt = writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'copilot-daemon',
  });

  writeAuditResult({
    correlationId: attempt.correlationId,
    provider: 'copilot-daemon',
    usageRole: 'worker',
    runnerType: 'ai_service',
    success: true,
  });

  const records = allRecords();
  expect(records[0]['correlation_id']).toBe(records[1]['correlation_id']);
  expect(records[0]['event_type']).toBe('LLM_CALL_ATTEMPT');
  expect(records[1]['event_type']).toBe('LLM_CALL_RESULT');
});

// ─── 15. Multiple attempts create unique correlation IDs ─────────────────────
test('15. Multiple ATTEMPT calls produce unique correlation IDs', () => {
  const a1 = writeAuditAttempt({ runnerType: 'ai_service', usageRole: 'worker', provider: 'claude' });
  const a2 = writeAuditAttempt({ runnerType: 'ai_service', usageRole: 'worker', provider: 'claude' });
  expect(a1.correlationId).not.toBe(a2.correlationId);
});

// ─── 16. BLOCKED has no success field ────────────────────────────────────────
test('16. LLM_CALL_BLOCKED has success=null (call never executed)', () => {
  writeAuditBlocked({
    provider: 'claude',
    usageRole: 'worker',
    runnerType: 'ai_service',
    blockReason: 'PROVIDER_NOT_IN_ALLOWLIST',
  });

  const rec = lastRecord();
  expect(rec['success']).toBeNull();
  expect(rec['duration_ms']).toBeNull();
});

// ─── 17. ATTEMPT has success=null (not yet executed) ────────────────────────
test('17. LLM_CALL_ATTEMPT has success=null (not yet executed)', () => {
  writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'codex',
  });

  const rec = lastRecord();
  expect(rec['event_type']).toBe('LLM_CALL_ATTEMPT');
  expect(rec['success']).toBeNull();
});

// ─── 18. RESULT failure records error message ────────────────────────────────
test('18. LLM_CALL_RESULT failure records error message', () => {
  const attempt = writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'claude',
  });

  writeAuditResult({
    correlationId: attempt.correlationId,
    provider: 'claude',
    usageRole: 'worker',
    runnerType: 'ai_service',
    success: false,
    error: 'timeout after 15 minutes',
    durationMs: 900000,
  });

  const rec = lastRecord();
  expect(rec['success']).toBe(false);
  expect(rec['error']).toBe('timeout after 15 minutes');
  expect(rec['duration_ms']).toBe(900000);
});

// ─── 19. RESULT I/O failure is non-fatal ─────────────────────────────────────
test('19. RESULT write failure is swallowed (non-fatal)', () => {
  mockAppend
    .mockImplementationOnce(() => { /* ATTEMPT succeeds */ })
    .mockImplementationOnce(() => { throw new Error('disk full on result write'); });

  const attempt = writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'claude',
  });

  // This should NOT throw
  expect(() => {
    writeAuditResult({
      correlationId: attempt.correlationId,
      provider: 'claude',
      usageRole: 'worker',
      runnerType: 'ai_service',
      success: true,
    });
  }).not.toThrow();
});

// ─── 20. BLOCKED I/O failure is non-fatal ────────────────────────────────────
test('20. BLOCKED write failure is swallowed (non-fatal)', () => {
  mockAppend.mockImplementationOnce(() => { throw new Error('disk full'); });

  expect(() => {
    writeAuditBlocked({
      provider: 'claude',
      usageRole: 'worker',
      runnerType: 'ai_service',
      blockReason: 'GLOBAL_HARD_OFF',
    });
  }).not.toThrow();
});

// ─── 21. ATTEMPT I/O failure is fatal (fail-closed) ─────────────────────────
test('21. ATTEMPT write failure returns written=false (fail-closed)', () => {
  mockAppend.mockImplementationOnce(() => { throw new Error('disk full'); });

  const result = writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'claude',
  });

  expect(result.written).toBe(false);
  expect(result.blockReason).toBe('BLOCKED_AUDIT_LOG_UNAVAILABLE');
});

// ─── 22. BLOCKED can have a correlationId ────────────────────────────────────
test('22. BLOCKED with explicit correlationId records it', () => {
  const correlationId = 'test-correlation-blocked-22';
  writeAuditBlocked({
    correlationId,
    provider: 'claude',
    usageRole: 'cto',
    runnerType: 'cto_review',
    blockReason: 'SAFE_RUN_BLOCK',
  });

  const rec = lastRecord();
  expect(rec['correlation_id']).toBe(correlationId);
});

// ─── 23. Rate limit metadata in RESULT ───────────────────────────────────────
test('23. RESULT records rate_limit metadata', () => {
  const attempt = writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'copilot-daemon',
  });

  writeAuditResult({
    correlationId: attempt.correlationId,
    provider: 'copilot-daemon',
    usageRole: 'worker',
    runnerType: 'ai_service',
    success: false,
    error: 'rate_limit hit',
    rateLimitType: 'weekly',
    rateLimitUsedPct: 95.5,
    rateLimitResetRaw: '2026-05-05T00:00:00Z',
    rawUsageExcerpt: 'Requests 5 Premium',
  });

  const rec = lastRecord();
  expect(rec['rate_limit_type']).toBe('weekly');
  expect(rec['rate_limit_used_pct']).toBe(95.5);
  expect(rec['rate_limit_reset_raw']).toBe('2026-05-05T00:00:00Z');
  expect(rec['raw_usage_excerpt']).toBe('Requests 5 Premium');
});

// ─── 24. JSONL format — one JSON object per line ─────────────────────────────
test('24. Each write call appends exactly one JSON object per line', () => {
  writeAuditAttempt({ runnerType: 'ai_service', usageRole: 'worker', provider: 'claude' });
  writeAuditBlocked({ provider: 'codex', usageRole: 'worker', runnerType: 'ai_service', blockReason: 'HARD_OFF' });

  const calls = mockAppend.mock.calls;
  expect(calls.length).toBe(2);

  for (const call of calls) {
    const line = String(call[1]);
    expect(line.endsWith('\n')).toBe(true);
    // Should be valid JSON
    expect(() => JSON.parse(line.trim())).not.toThrow();
  }
});

// ─── 25. copilot_daemon role ─────────────────────────────────────────────────
test('25. copilot_daemon usage role is recorded in audit', () => {
  writeAuditAttempt({
    runnerType: 'copilot_daemon',
    usageRole: 'copilot_daemon',
    provider: 'copilot-daemon',
    triggerSource: 'copilot_daemon_execute',
  });

  const rec = lastRecord();
  expect(rec['usage_role']).toBe('copilot_daemon');
  expect(rec['runner_type']).toBe('copilot_daemon');
  expect(rec['trigger_source']).toBe('copilot_daemon_execute');
});
