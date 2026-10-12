/**
 * LLM Audit Guard — controlled aiService integration smoke tests.
 *
 * The policy subprocess is mocked, but the audit and usage filesystem writers
 * are real. Every writer is routed to one OS temporary root owned by this Jest
 * process. Provider execution is limited to deterministic local printf calls.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import type { ProjectProfile } from '../types';

jest.mock('../llmExecutionPolicy', () => ({
  evaluateExecutionPolicy: jest.fn(),
  recordLlmExecution: jest.fn(),
  getPolicySkipMessage: jest.fn((reason: string | null) => reason ?? 'SCHEDULER_DISABLED'),
}));

import { executeWorkerProviderCommand } from '../aiService';
import { isExternalProvider } from '../llmAuditGuard';
import {
  evaluateExecutionPolicy,
  recordLlmExecution,
  type LlmPolicyDecision,
} from '../llmExecutionPolicy';
import type { WorkerExecutionInput } from '../providers';

const mockEvaluateExecutionPolicy = evaluateExecutionPolicy as jest.MockedFunction<typeof evaluateExecutionPolicy>;
const mockRecordLlmExecution = recordLlmExecution as jest.MockedFunction<typeof recordLlmExecution>;

let temporaryRoot = '';
let cwdSpy: jest.SpyInstance<string, []>;

function auditLogPath(): string {
  return nodePath.join(temporaryRoot, 'runtime', 'agent_orchestrator', 'llm_audit.jsonl');
}

function usageLogPath(): string {
  return nodePath.join(temporaryRoot, 'runtime', 'agent_orchestrator', 'llm_usage.jsonl');
}

function readJsonl(filePath: string): Record<string, unknown>[] {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function auditRecordsFor(taskId: number): Record<string, unknown>[] {
  return readJsonl(auditLogPath()).filter((record) => record['task_id'] === String(taskId));
}

function usageRecordsFor(taskId: number): Record<string, unknown>[] {
  return readJsonl(usageLogPath()).filter((record) => record['taskId'] === String(taskId));
}

function allowedPolicyDecision(taskId: number): LlmPolicyDecision {
  return {
    allowed: true,
    mode: 'safe-run',
    scheduler_enabled: true,
    caller: 'ai_service',
    caller_context: 'manual',
    provider: 'copilot-daemon',
    model: 'smoke-model',
    task_id: String(taskId),
    skip_reason: null,
    blocked_execution_count: 0,
    last_llm_call_at: null,
    state_path: '',
    event_log_path: '',
  };
}

function buildSmokeInput(taskId: number): WorkerExecutionInput {
  const smokeProfile = {
    project_name: 'smoke-test',
    project_slug: 'smoke',
    backlog_path: nodePath.join(temporaryRoot, 'backlog.md'),
    orchestrator_root: temporaryRoot,
    task_storage_path: temporaryRoot,
    log_storage_path: temporaryRoot,
    database_path: nodePath.join(temporaryRoot, 'unused.db'),
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

  return {
    workerProvider: 'copilot-daemon',
    workerCopilotModel: 'smoke-model',
    callerContext: 'manual',
    taskId,
    promptPath: nodePath.join(temporaryRoot, 'prompt.md'),
    contractPath: nodePath.join(temporaryRoot, 'contract.json'),
    objective: `LLM Audit Guard smoke test ${taskId}`,
    profile: smokeProfile,
  };
}

beforeAll(() => {
  temporaryRoot = mkdtempSync(nodePath.join(tmpdir(), `llm-audit-smoke-${process.pid}-`));
  cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(temporaryRoot);
});

beforeEach(() => {
  mockEvaluateExecutionPolicy.mockReset();
  mockEvaluateExecutionPolicy.mockImplementation(async (input) => (
    allowedPolicyDecision(Number(input.taskId))
  ));
  mockRecordLlmExecution.mockReset();
  mockRecordLlmExecution.mockResolvedValue({
    ok: true,
    last_llm_call_at: '2026-07-13T00:00:00.000Z',
  });
  cwdSpy.mockReturnValue(temporaryRoot);
});

afterAll(() => {
  mockEvaluateExecutionPolicy.mockReset();
  mockRecordLlmExecution.mockReset();
  cwdSpy.mockRestore();
  rmSync(temporaryRoot, { recursive: true, force: true });
});

test('SMOKE-1: allowed execution persists correlated ATTEMPT before command and RESULT', async () => {
  const taskId = 9901;
  let attemptWasPersistedBeforeCommand = false;
  const interpolateCommand = jest.fn((command: string) => {
    const records = auditRecordsFor(taskId);
    attemptWasPersistedBeforeCommand = records.some(
      (record) => record['event_type'] === 'LLM_CALL_ATTEMPT',
    ) && records.every((record) => record['event_type'] !== 'LLM_CALL_RESULT');
    return command;
  });

  const output = await executeWorkerProviderCommand({
    input: buildSmokeInput(taskId),
    externalCommand: "printf '# Worker Completion Summary\\nObjective: smoke-1\\n'",
    callerContext: 'manual',
    interpolateCommand,
    parseChangedFiles: () => [],
    detectProviderRateLimit: () => null,
  });

  expect(output.runtimeFailed).toBe(false);
  expect(interpolateCommand).toHaveBeenCalledTimes(1);
  expect(attemptWasPersistedBeforeCommand).toBe(true);

  const records = auditRecordsFor(taskId);
  expect(records.map((record) => record['event_type'])).toEqual([
    'LLM_CALL_ATTEMPT',
    'LLM_CALL_RESULT',
  ]);
  const [attempt, result] = records;
  expect(attempt['provider']).toBe('copilot-daemon');
  expect(attempt['usage_role']).toBe('worker');
  expect(attempt['runner_type']).toBe('ai_service');
  expect(attempt['trigger_source']).toBe('manual_preview');
  expect(attempt['caller_file']).toBe('aiService.ts');
  expect(result['success']).toBe(true);
  expect(result['correlation_id']).toBe(attempt['correlation_id']);
  expect(typeof result['duration_ms']).toBe('number');
});

test('SMOKE-2: allowed execution writes usage start followed by usage success', async () => {
  const taskId = 9902;

  const output = await executeWorkerProviderCommand({
    input: buildSmokeInput(taskId),
    externalCommand: "printf '# Worker Completion Summary\\nObjective: smoke-2\\n'",
    callerContext: 'manual',
    interpolateCommand: (command) => command,
    parseChangedFiles: () => [],
    detectProviderRateLimit: () => null,
  });

  expect(output.runtimeFailed).toBe(false);
  const records = usageRecordsFor(taskId);
  expect(records.map((record) => record['event'])).toEqual([
    'provider_execution_start',
    'provider_execution_success',
  ]);
  expect(records[0]['decision']).toBe('allow');
  expect(records[1]['decision']).toBe('success');
  expect(records[0]['provider']).toBe('copilot-daemon');
  expect(records[0]['desiredModel']).toBe('smoke-model');
  expect(records[0]['actualModel']).toBe('provider-managed');
});

test('SMOKE-3: policy block writes audit and usage BLOCKED without executing a command', async () => {
  const taskId = 9903;
  mockEvaluateExecutionPolicy.mockResolvedValueOnce({
    ...allowedPolicyDecision(taskId),
    allowed: false,
    mode: 'hard-off',
    skip_reason: 'GLOBAL_HARD_OFF',
    blocked_execution_count: 1,
  });
  const interpolateCommand = jest.fn((command: string) => command);
  const commandSentinel = nodePath.join(temporaryRoot, 'policy-block-command-executed');

  const output = await executeWorkerProviderCommand({
    input: buildSmokeInput(taskId),
    externalCommand: `printf 'executed' > ${JSON.stringify(commandSentinel)}`,
    callerContext: 'manual',
    interpolateCommand,
    parseChangedFiles: () => [],
    detectProviderRateLimit: () => null,
  });

  expect(output.runtimeFailed).toBe(true);
  expect(interpolateCommand).not.toHaveBeenCalled();
  expect(mockRecordLlmExecution).not.toHaveBeenCalled();
  expect(existsSync(commandSentinel)).toBe(false);
  const auditRecords = auditRecordsFor(taskId);
  expect(auditRecords.map((record) => record['event_type'])).toEqual(['LLM_CALL_BLOCKED']);
  expect(auditRecords[0]['block_reason']).toBe('GLOBAL_HARD_OFF');
  expect(auditRecords.some((record) => record['event_type'] === 'LLM_CALL_ATTEMPT')).toBe(false);
  const usageRecords = usageRecordsFor(taskId);
  expect(usageRecords.map((record) => record['event'])).toEqual(['provider_blocked']);
  expect(usageRecords[0]['skipReason']).toBe('GLOBAL_HARD_OFF');
});

test('SMOKE-4: allowlist block writes audit and usage BLOCKED without policy or command execution', async () => {
  const taskId = 9904;
  const input = buildSmokeInput(taskId);
  input.workerProvider = 'unknown-provider-xyz' as WorkerExecutionInput['workerProvider'];
  const interpolateCommand = jest.fn((command: string) => command);
  const commandSentinel = nodePath.join(temporaryRoot, 'allowlist-block-command-executed');

  const output = await executeWorkerProviderCommand({
    input,
    externalCommand: `printf 'executed' > ${JSON.stringify(commandSentinel)}`,
    callerContext: 'manual',
    interpolateCommand,
    parseChangedFiles: () => [],
    detectProviderRateLimit: () => null,
  });

  expect(output.runtimeFailed).toBe(true);
  expect(mockEvaluateExecutionPolicy).not.toHaveBeenCalled();
  expect(mockRecordLlmExecution).not.toHaveBeenCalled();
  expect(interpolateCommand).not.toHaveBeenCalled();
  expect(existsSync(commandSentinel)).toBe(false);
  const auditRecords = auditRecordsFor(taskId);
  expect(auditRecords.map((record) => record['event_type'])).toEqual(['LLM_CALL_BLOCKED']);
  expect(auditRecords[0]['block_reason']).toBe('PROVIDER_NOT_IN_ALLOWLIST');
  expect(auditRecords.some((record) => record['event_type'] === 'LLM_CALL_ATTEMPT')).toBe(false);
  const usageRecords = usageRecordsFor(taskId);
  expect(usageRecords.map((record) => record['event'])).toEqual(['provider_blocked']);
  expect(usageRecords[0]['skipReason']).toBe('PROVIDER_NOT_IN_ALLOWLIST');
});

test('SMOKE-5: local classification stays local and rate limits write failed RESULT and usage', async () => {
  expect(isExternalProvider('local-planner')).toBe(false);
  expect(isExternalProvider('local-review')).toBe(false);
  expect(isExternalProvider('deterministic')).toBe(false);
  expect(isExternalProvider('copilot-daemon')).toBe(true);

  const taskId = 9905;
  const output = await executeWorkerProviderCommand({
    input: buildSmokeInput(taskId),
    externalCommand: "printf 'status 429 rate limit\\n'",
    callerContext: 'manual',
    interpolateCommand: (command) => command,
    parseChangedFiles: () => [],
    detectProviderRateLimit: (message) => message.includes('429')
      ? {
          finalMessage: message.trim(),
          resetHint: 'wait for deterministic reset',
          httpStatus: 429,
        }
      : null,
  });

  expect(output.runtimeFailed).toBe(true);
  expect(output.failureReason).toBe('rate_limit');
  expect(output.httpStatus).toBe(429);
  const auditRecords = auditRecordsFor(taskId);
  expect(auditRecords.map((record) => record['event_type'])).toEqual([
    'LLM_CALL_ATTEMPT',
    'LLM_CALL_RESULT',
  ]);
  expect(auditRecords[1]['success']).toBe(false);
  expect(auditRecords[1]['rate_limit_type']).toBe('provider_rate_limit');
  expect(auditRecords[1]['correlation_id']).toBe(auditRecords[0]['correlation_id']);
  const usageRecords = usageRecordsFor(taskId);
  expect(usageRecords.map((record) => record['event'])).toEqual([
    'provider_execution_start',
    'provider_execution_failed',
  ]);
  expect(usageRecords[1]['errorCode']).toBe('provider_rate_limit');
  expect(usageRecords[1]['decision']).toBe('failed');
});

test('SMOKE-6: ATTEMPT write failure fails closed before record or command execution', async () => {
  const taskId = 9906;
  const failClosedRoot = nodePath.join(temporaryRoot, 'fail-closed');
  mkdirSync(failClosedRoot, { recursive: true });
  writeFileSync(nodePath.join(failClosedRoot, 'runtime'), 'not a directory', 'utf-8');
  const commandSentinel = nodePath.join(failClosedRoot, 'command-executed');
  const interpolateCommand = jest.fn((command: string) => command);
  cwdSpy.mockReturnValue(failClosedRoot);

  const output = await executeWorkerProviderCommand({
    input: buildSmokeInput(taskId),
    externalCommand: `printf 'executed' > ${JSON.stringify(commandSentinel)}`,
    callerContext: 'manual',
    interpolateCommand,
    parseChangedFiles: () => [],
    detectProviderRateLimit: () => null,
  }).finally(() => cwdSpy.mockReturnValue(temporaryRoot));

  expect(output.runtimeFailed).toBe(true);
  expect(interpolateCommand).not.toHaveBeenCalled();
  expect(mockRecordLlmExecution).not.toHaveBeenCalled();
  expect(existsSync(commandSentinel)).toBe(false);
  expect(auditRecordsFor(taskId)).toEqual([]);
});
