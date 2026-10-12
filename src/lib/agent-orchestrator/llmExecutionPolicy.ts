import { execFile as execFileCallback } from 'node:child_process';
import nodePath from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

export type LlmExecutionMode = 'safe-run' | 'hard-off';
export type LlmSkipReason = 'GLOBAL_HARD_OFF' | 'SCHEDULER_DISABLED' | 'SAFE_RUN_BLOCK' | 'PROVIDER_NOT_IN_ALLOWLIST';
export type LlmCallerContext = 'background' | 'manual';

export interface LlmPolicyDecision {
  allowed: boolean;
  mode: LlmExecutionMode;
  scheduler_enabled: boolean;
  caller: string;
  caller_context: LlmCallerContext;
  provider: string;
  model: string;
  task_id: string;
  skip_reason: LlmSkipReason | null;
  blocked_execution_count: number;
  last_llm_call_at: string | null;
  state_path: string;
  event_log_path: string;
}

export interface LlmPolicyState {
  version: string;
  mode: LlmExecutionMode;
  blocked_execution_count: number;
  allowed_execution_count: number;
  last_llm_call_at: string | null;
  last_blocked_at: string | null;
  last_skip_reason: LlmSkipReason | null;
  last_caller: string | null;
  last_provider: string | null;
  last_model: string | null;
  last_task_id: string | null;
  updated_at: string;
  scheduler_enabled: boolean;
  state_path: string;
  event_log_path: string;
}

interface PolicyCommandInput {
  caller: string;
  callerContext?: LlmCallerContext;
  provider?: string | null;
  model?: string | null;
  taskId?: number | string | null;
}

function executionPolicyScriptPath(): string {
  return nodePath.join(process.cwd(), 'execution_policy.py');
}

function serializeOptional(value: string | number | null | undefined): string {
  if (value == null) return '';
  return String(value);
}

async function runPolicyCommand<T>(command: string, args: string[] = []): Promise<T> {
  const { stdout } = await execFile('python3', [executionPolicyScriptPath(), command, '--project-root', process.cwd(), ...args], {
    cwd: process.cwd(),
  });
  return JSON.parse(stdout) as T;
}

export async function getLlmPolicyState(): Promise<LlmPolicyState> {
  return runPolicyCommand<LlmPolicyState>('get-state');
}

export async function setLlmExecutionMode(mode: LlmExecutionMode): Promise<{ ok: boolean; mode: LlmExecutionMode }> {
  return runPolicyCommand<{ ok: boolean; mode: LlmExecutionMode }>('set-mode', ['--mode', mode]);
}

export async function evaluateExecutionPolicy(input: PolicyCommandInput): Promise<LlmPolicyDecision> {
  return runPolicyCommand<LlmPolicyDecision>('evaluate', [
    '--caller', input.caller,
    '--caller-context', input.callerContext ?? 'background',
    '--provider', serializeOptional(input.provider),
    '--model', serializeOptional(input.model),
    '--task-id', serializeOptional(input.taskId),
  ]);
}

export async function recordLlmExecution(input: PolicyCommandInput): Promise<{ ok: boolean; last_llm_call_at: string }> {
  return runPolicyCommand<{ ok: boolean; last_llm_call_at: string }>('record-execution', [
    '--caller', input.caller,
    '--provider', serializeOptional(input.provider),
    '--model', serializeOptional(input.model),
    '--task-id', serializeOptional(input.taskId),
  ]);
}

export function getPolicySkipMessage(reason: LlmSkipReason | null): string {
  if (reason === 'GLOBAL_HARD_OFF') return 'GLOBAL_HARD_OFF — skip execution';
  if (reason === 'PROVIDER_NOT_IN_ALLOWLIST') return 'PROVIDER_NOT_IN_ALLOWLIST — skip execution';
  if (reason === 'SAFE_RUN_BLOCK') return 'SAFE_RUN_BLOCK — skip execution';
  return 'SCHEDULER_DISABLED — skip execution';
}