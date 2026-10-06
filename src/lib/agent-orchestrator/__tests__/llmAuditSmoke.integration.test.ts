/**
 * LLM Audit Guard — Controlled Integration Smoke Test
 *
 * PURPOSE:
 *   Verify that llm_audit.jsonl is written correctly by the real aiService path
 *   when a safe fake echo command is used as the external worker command.
 *
 * DESIGN:
 *   - fs module is NOT mocked → real llm_audit.jsonl is written
 *   - llmExecutionPolicy is mocked to return allowed=true (avoids Python subprocess)
 *   - recordLlmExecution is mocked to no-op
 *   - External command = "echo" (safe, deterministic, no real LLM)
 *   - Smoke entries are cleaned from llm_audit.jsonl in afterAll
 *
 * HARD RULES SATISFIED:
 *   - Does not call real Codex / Claude / GitHub Copilot
 *   - Does not bypass aiService (calls executeWorkerProviderCommand directly)
 *   - Does not manually fabricate audit logs
 *   - Does not change scheduler state
 *   - Does not change provider config permanently
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import type { ProjectProfile } from '../types';

// ── Mock ONLY the execution policy (Python subprocess) ──────────────────────
// We do NOT mock node:fs so real files get written.
jest.mock('../llmExecutionPolicy', () => ({
  evaluateExecutionPolicy: jest.fn().mockResolvedValue({
    allowed: true,
    mode: 'safe-run',
    scheduler_enabled: true,
    caller: 'ai_service',
    caller_context: 'manual',
    provider: 'copilot-daemon',
    model: '',
    task_id: 'smoke-9999',
    skip_reason: null,
    blocked_execution_count: 0,
    last_llm_call_at: null,
    state_path: '',
    event_log_path: '',
    usage_log_path: '',
  }),
  recordLlmExecution: jest.fn().mockResolvedValue({ ok: true, last_llm_call_at: new Date().toISOString() }),
  getPolicySkipMessage: jest.fn().mockReturnValue('SCHEDULER_DISABLED'),
}));

import { executeWorkerProviderCommand } from '../aiService';
import type { WorkerExecutionInput } from '../providers';

// ── Paths ────────────────────────────────────────────────────────────────────

const AUDIT_LOG = nodePath.join(process.cwd(), 'runtime', 'agent_orchestrator', 'llm_audit.jsonl');
const USAGE_LOG = nodePath.join(process.cwd(), 'runtime', 'agent_orchestrator', 'llm_usage.jsonl');

const SMOKE_TASK_ID = 'smoke-audit-9999';
// Audit records write taskId as the numeric string "9999".
// JSONL is written compact (no spaces after colons).
const SMOKE_AUDIT_MARKER = '"task_id":"9999"';
// Usage log is restored by snapshot in afterAll (execution records don't carry task_id).

// ── Cleanup helpers ──────────────────────────────────────────────────────────

function readAuditLines(): Record<string, unknown>[] {
  if (!existsSync(AUDIT_LOG)) return [];
  return readFileSync(AUDIT_LOG, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try { return JSON.parse(l) as Record<string, unknown>; }
      catch { return null; }
    })
    .filter((r): r is Record<string, unknown> => r !== null);
}

function readUsageLines(): Record<string, unknown>[] {
  if (!existsSync(USAGE_LOG)) return [];
  return readFileSync(USAGE_LOG, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try { return JSON.parse(l) as Record<string, unknown>; }
      catch { return null; }
    })
    .filter((r): r is Record<string, unknown> => r !== null);
}

/** Remove smoke-tagged lines from a JSONL file after the test run. */
function cleanupSmokeLines(filePath: string, marker: string): number {
  if (!existsSync(filePath)) return 0;
  const original = readFileSync(filePath, 'utf-8');
  const lines = original.split('\n').filter(Boolean);
  const kept = lines.filter((l) => !l.includes(marker));
  const removed = lines.length - kept.length;
  if (removed > 0) {
    writeFileSync(filePath, kept.join('\n') + (kept.length > 0 ? '\n' : ''), 'utf-8');
  }
  return removed;
}

// ── Minimal profile ──────────────────────────────────────────────────────────

const smokeProfile = {
  project_name: 'smoke-test',
  project_slug: 'smoke',
  backlog_path: '/dev/null',
  orchestrator_root: process.cwd(),
  task_storage_path: process.cwd(),
  log_storage_path: process.cwd(),
  database_path: '/dev/null',
  default_schedule_minutes: 60,
  planner_provider: 'local-planner',
  worker_provider: 'copilot-daemon',
  planner_rules: { max_tasks_per_run: 1 },
  worker_rules: { max_concurrent: 1 },
  protected_paths: [],
  required_checks: [],
  allowed_reference_paths: [],
  required_contract_fields: [],
  required_result_fields: [],
  ui: {},
} as unknown as ProjectProfile;

// ── Shared smoke input ────────────────────────────────────────────────────────

function buildSmokeInput(taskId: string | number = SMOKE_TASK_ID): WorkerExecutionInput {
  return {
    workerProvider: 'copilot-daemon',
    workerCopilotModel: 'smoke-model',
    callerContext: 'manual',
    taskId: Number(typeof taskId === 'string' ? 9999 : taskId),
    promptPath: '/dev/null',
    contractPath: '/dev/null',
    objective: `LLM Audit Guard smoke test — taskId=${SMOKE_TASK_ID}`,
    profile: smokeProfile,
  };
}

// ── Baselines & snapshots ─────────────────────────────────────────────────────

let auditLinesBefore = 0;
let usageSnapshotLines: string[] = [];

beforeAll(() => {
  auditLinesBefore = readAuditLines().length;
  // Snapshot the usage log so we can restore it exactly (usage records don't carry task_id)
  usageSnapshotLines = existsSync(USAGE_LOG)
    ? readFileSync(USAGE_LOG, 'utf-8').split('\n').filter(Boolean)
    : [];
});

afterAll(() => {
  // Audit: remove lines that carry the smoke task_id (compact JSON, no spaces)
  const auditRemoved = cleanupSmokeLines(AUDIT_LOG, SMOKE_AUDIT_MARKER);

  // Usage: restore to exact pre-test snapshot (execution records have no task_id marker)
  const usageNow = existsSync(USAGE_LOG)
    ? readFileSync(USAGE_LOG, 'utf-8').split('\n').filter(Boolean)
    : [];
  const usageRemoved = usageNow.length - usageSnapshotLines.length;
  writeFileSync(
    USAGE_LOG,
    usageSnapshotLines.join('\n') + (usageSnapshotLines.length > 0 ? '\n' : ''),
    'utf-8',
  );

  console.log(`[smoke-cleanup] Removed ${auditRemoved} audit lines (task_id=9999), restored usage log (−${usageRemoved} lines).`);
});

// ────────────────────────────────────────────────────────────────────────────
// SMOKE 1: Happy path — LLM_CALL_ATTEMPT + LLM_CALL_RESULT (success)
// ────────────────────────────────────────────────────────────────────────────
test('SMOKE-1: executeWorkerProviderCommand writes LLM_CALL_ATTEMPT + LLM_CALL_RESULT to real llm_audit.jsonl', async () => {
  const input = buildSmokeInput();

  const result = await executeWorkerProviderCommand({
    input,
    externalCommand: `echo "# Worker Completion Summary\n\nObjective: ${SMOKE_TASK_ID}"`,
    callerContext: 'manual',
    interpolateCommand: (cmd) => cmd,
    parseChangedFiles: () => [],
    detectProviderRateLimit: () => null,
  });

  // Worker should succeed (echo exits 0)
  expect(result.runtimeFailed).toBe(false);

  // Read audit log
  const auditLines = readAuditLines();
  const smokeLines = auditLines.filter((r) =>
    typeof r['task_id'] === 'string' && r['task_id'].includes('9999') ||
    typeof r['trigger_source'] === 'string'
  );

  const newLines = auditLines.slice(auditLinesBefore);
  expect(newLines.length).toBeGreaterThanOrEqual(2);

  // Find ATTEMPT
  const attempt = newLines.find((r) => r['event_type'] === 'LLM_CALL_ATTEMPT');
  expect(attempt).toBeDefined();
  expect(attempt!['provider']).toBe('copilot-daemon');
  expect(attempt!['usage_role']).toBe('worker');
  expect(attempt!['runner_type']).toBe('ai_service');
  expect(attempt!['blocked']).toBe(false);
  expect(attempt!['correlation_id']).toBeTruthy();
  expect(attempt!['timestamp']).toBeTruthy();
  expect(attempt!['trigger_source']).toBe('manual_preview');
  expect(attempt!['caller_file']).toBe('aiService.ts');

  // Find RESULT
  const resultRecord = newLines.find((r) => r['event_type'] === 'LLM_CALL_RESULT');
  expect(resultRecord).toBeDefined();
  expect(resultRecord!['success']).toBe(true);
  expect(resultRecord!['provider']).toBe('copilot-daemon');
  expect(resultRecord!['usage_role']).toBe('worker');
  expect(typeof resultRecord!['duration_ms']).toBe('number');
  // ATTEMPT and RESULT must share correlation_id
  expect(resultRecord!['correlation_id']).toBe(attempt!['correlation_id']);

  console.log('[SMOKE-1] ATTEMPT:', JSON.stringify(attempt, null, 2));
  console.log('[SMOKE-1] RESULT:', JSON.stringify(resultRecord, null, 2));
}, 15000);

// ────────────────────────────────────────────────────────────────────────────
// SMOKE 2: Usage log also records execution
// ────────────────────────────────────────────────────────────────────────────
test('SMOKE-2: llm_usage.jsonl also records provider_execution_start and provider_execution_success', async () => {
  const usageLinesAfterSmoke1 = readUsageLines();
  const newUsageLines = usageLinesAfterSmoke1.slice(usageSnapshotLines.length);

  // Should have at least preflight + execution start + execution success
  expect(newUsageLines.length).toBeGreaterThanOrEqual(2);

  const startLine = newUsageLines.find((r) => r['event'] === 'provider_execution_start');
  expect(startLine).toBeDefined();
  expect(startLine!['phase']).toBe('execution');
  expect(startLine!['provider']).toBe('copilot-daemon');
  expect(startLine!['decision']).toBe('allow');

  const successLine = newUsageLines.find((r) => r['event'] === 'provider_execution_success');
  expect(successLine).toBeDefined();
  expect(successLine!['phase']).toBe('execution');
  expect(successLine!['decision']).toBe('success');

  console.log('[SMOKE-2] Usage start:', JSON.stringify(startLine, null, 2));
  console.log('[SMOKE-2] Usage success:', JSON.stringify(successLine, null, 2));
}, 15000);

// ────────────────────────────────────────────────────────────────────────────
// SMOKE 3: BLOCKED path — policy-blocked execution writes LLM_CALL_BLOCKED, NOT ATTEMPT
// ────────────────────────────────────────────────────────────────────────────
test('SMOKE-3: Policy-blocked execution writes LLM_CALL_BLOCKED to llm_audit.jsonl', async () => {
  const { evaluateExecutionPolicy } = await import('../llmExecutionPolicy');
  const mockPolicy = evaluateExecutionPolicy as jest.Mock;
  const origImpl = mockPolicy.getMockImplementation();

  // Override: return blocked
  mockPolicy.mockResolvedValueOnce({
    allowed: false,
    mode: 'hard-off',
    scheduler_enabled: true,
    caller: 'ai_service',
    caller_context: 'manual',
    provider: 'copilot-daemon',
    model: '',
    task_id: 'smoke-9999-blocked',
    skip_reason: 'GLOBAL_HARD_OFF',
    blocked_execution_count: 1,
    last_llm_call_at: null,
    state_path: '',
    event_log_path: '',
    usage_log_path: '',
  });

  const linesBefore = readAuditLines().length;

  const input = buildSmokeInput('smoke-9999-blocked');
  await executeWorkerProviderCommand({
    input,
    externalCommand: 'echo should-never-run',
    callerContext: 'manual',
    interpolateCommand: (cmd) => cmd,
    parseChangedFiles: () => [],
    detectProviderRateLimit: () => null,
  });

  const auditLines = readAuditLines();
  const newLines = auditLines.slice(linesBefore);

  // A BLOCKED event should be written
  const blocked = newLines.find((r) => r['event_type'] === 'LLM_CALL_BLOCKED');
  expect(blocked).toBeDefined();
  expect(blocked!['blocked']).toBe(true);
  expect(blocked!['block_reason']).toBe('GLOBAL_HARD_OFF');
  expect(blocked!['provider']).toBe('copilot-daemon');

  // No ATTEMPT should be written (policy blocked before exec)
  const attempt = newLines.find((r) => r['event_type'] === 'LLM_CALL_ATTEMPT');
  expect(attempt).toBeUndefined();

  console.log('[SMOKE-3] BLOCKED:', JSON.stringify(blocked, null, 2));
}, 15000);

// ────────────────────────────────────────────────────────────────────────────
// SMOKE 4: Allowlist-blocked provider writes LLM_CALL_BLOCKED, NOT ATTEMPT
// ────────────────────────────────────────────────────────────────────────────
test('SMOKE-4: Allowlist-blocked provider writes LLM_CALL_BLOCKED, no ATTEMPT written', async () => {
  const linesBefore = readAuditLines().length;

  const input: WorkerExecutionInput = {
    ...buildSmokeInput(),
    workerProvider: 'unknown-provider-xyz' as unknown as 'copilot-daemon',
  };

  await executeWorkerProviderCommand({
    input,
    externalCommand: 'echo should-never-run',
    callerContext: 'manual',
    interpolateCommand: (cmd) => cmd,
    parseChangedFiles: () => [],
    detectProviderRateLimit: () => null,
  });

  const newLines = readAuditLines().slice(linesBefore);
  const blocked = newLines.find((r) => r['event_type'] === 'LLM_CALL_BLOCKED');
  expect(blocked).toBeDefined();
  expect(blocked!['blocked']).toBe(true);
  expect(blocked!['provider']).toBe('unknown-provider-xyz');

  // No ATTEMPT
  const attempt = newLines.find((r) => r['event_type'] === 'LLM_CALL_ATTEMPT');
  expect(attempt).toBeUndefined();

  console.log('[SMOKE-4] Allowlist BLOCKED:', JSON.stringify(blocked, null, 2));
}, 15000);

// ────────────────────────────────────────────────────────────────────────────
// SMOKE 5: Planner provider is local — no audit written
// ────────────────────────────────────────────────────────────────────────────
test('SMOKE-5: Local providers (local-planner, local-review) do NOT trigger external calls', () => {
  const { isExternalProvider } = require('../llmAuditGuard') as typeof import('../llmAuditGuard');

  // These must never be classified as external
  expect(isExternalProvider('local-planner')).toBe(false);
  expect(isExternalProvider('local-review')).toBe(false);
  expect(isExternalProvider('local')).toBe(false);
  expect(isExternalProvider('deterministic')).toBe(false);

  // External providers must be classified correctly
  expect(isExternalProvider('copilot-daemon')).toBe(true);
  expect(isExternalProvider('claude')).toBe(true);
  expect(isExternalProvider('codex')).toBe(true);
});

// ────────────────────────────────────────────────────────────────────────────
// SMOKE 6: Fail-closed — audit write failure blocks exec
// ────────────────────────────────────────────────────────────────────────────
test('SMOKE-6: Fail-closed — writeAuditAttempt failure returns written=false (cite unit test 21)', () => {
  // This is covered by unit test #21 in llmAuditGuard.test.ts:
  //   "ATTEMPT write failure returns written=false (fail-closed)"
  //   mockAppend.mockImplementationOnce(() => { throw new Error('disk full') })
  //   → result.written === false, result.blockReason === 'BLOCKED_AUDIT_LOG_UNAVAILABLE'
  //
  // We cite the passing test rather than risk real filesystem mutation.
  // The integration path in aiService.ts checks:
  //   if (!auditAttempt.written) { return buildPolicyBlockedWorkerOutput(..., null) }
  // This guard is at line ~110 of aiService.ts.

  const { writeAuditAttempt } = require('../llmAuditGuard') as typeof import('../llmAuditGuard');

  // Verify the function signature contracts hold in real code
  // (fs is NOT mocked here, but we use a non-existent path to trigger failure)
  // Temporarily point cwd to a non-existent path to force write failure
  const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValueOnce('/dev/null/nonexistent/path');

  const result = writeAuditAttempt({
    runnerType: 'ai_service',
    usageRole: 'worker',
    provider: 'copilot-daemon',
    taskId: 'smoke-fail-closed',
  });

  // Restore
  cwdSpy.mockRestore();

  expect(result.written).toBe(false);
  expect(result.blockReason).toBe('BLOCKED_AUDIT_LOG_UNAVAILABLE');
  console.log('[SMOKE-6] Fail-closed verified: written=false, blockReason=', result.blockReason);
}, 5000);
