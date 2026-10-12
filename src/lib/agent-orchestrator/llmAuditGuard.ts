/**
 * LLM Audit Guard — fail-closed audit log for all external LLM calls.
 *
 * HARD RULE: No external LLM call may happen without a prior LLM_CALL_ATTEMPT.
 * If the ATTEMPT write fails, the call must be BLOCKED (fail-closed).
 *
 * Event types:
 *   LLM_CALL_ATTEMPT  — written BEFORE calling the provider
 *   LLM_CALL_RESULT   — written AFTER provider returns (success or failure)
 *   LLM_CALL_BLOCKED  — written when policy prevents the call
 *
 * All I/O errors in RESULT/BLOCKED writes are swallowed (non-fatal).
 * ATTEMPT write failure is NOT swallowed — it must surface as a block.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import nodePath from 'node:path';

// ── Types ────────────────────────────────────────────────────────────────────

export type AuditEventType =
  | 'LLM_CALL_ATTEMPT'
  | 'LLM_CALL_RESULT'
  | 'LLM_CALL_BLOCKED';

export type AuditUsageRole = 'planner' | 'worker' | 'cto' | 'copilot_daemon' | 'ai_service' | 'unknown';

export type AuditTriggerSource =
  | 'scheduler_tick'
  | 'manual_preview'
  | 'run_once'
  | 'worker_claim'
  | 'worker_execute'
  | 'light_worker_execute'
  | 'copilot_daemon_execute'
  | 'cto_review'
  | 'test'
  | 'unknown';

export interface LlmAuditRecord {
  timestamp: string;
  correlation_id: string;
  event_type: AuditEventType;
  runner_type: string;
  usage_role: AuditUsageRole;
  provider: string;
  model: string | null;
  task_id: string | null;
  run_id: string | null;
  trigger_source: AuditTriggerSource;
  command_hash: string | null;
  caller_file: string;
  caller_function: string;
  requires_llm: boolean;
  policy_allowed: boolean;
  blocked: boolean;
  block_reason: string | null;
  success: boolean | null;
  error: string | null;
  duration_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  premium_requests: number;
  rate_limit_type: string | null;
  rate_limit_used_pct: number | null;
  rate_limit_reset_raw: string | null;
  raw_usage_excerpt: string | null;
  desired_model: string | null;
  actual_model: string | null;
  model_propagation_status: string | null;
  model_mismatch: boolean | null;
  /** Mirrors llm_usage noTaskReason — only set on worker preflight/blocked records. */
  no_task_reason: string | null;
}

export interface AuditAttemptInput {
  correlationId?: string;
  runnerType: string;
  usageRole: AuditUsageRole;
  provider: string;
  model?: string | null;
  taskId?: string | number | null;
  runId?: string | null;
  desiredModel?: string | null;
  actualModel?: string | null;
  modelPropagationStatus?: string | null;
  triggerSource?: AuditTriggerSource;
  callerFile?: string;
  callerFunction?: string;
  requiresLlm?: boolean;
  policyAllowed?: boolean;
  noTaskReason?: string | null;
}

export interface AuditResultInput {
  correlationId: string;
  provider: string;
  usageRole: AuditUsageRole;
  runnerType: string;
  taskId?: string | number | null;
  triggerSource?: AuditTriggerSource;
  success: boolean;
  actualModel?: string | null;
  modelPropagationStatus?: string | null;
  error?: string | null;
  durationMs?: number | null;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  premiumRequests?: number;
  rateLimitType?: string | null;
  rateLimitUsedPct?: number | null;
  rateLimitResetRaw?: string | null;
  rawUsageExcerpt?: string | null;
  callerFile?: string;
  callerFunction?: string;
}

export interface AuditBlockedInput {
  correlationId?: string;
  provider: string;
  usageRole: AuditUsageRole;
  runnerType: string;
  taskId?: string | number | null;
  triggerSource?: AuditTriggerSource;
  blockReason: string;
  callerFile?: string;
  callerFunction?: string;
  requiresLlm?: boolean;
  noTaskReason?: string | null;
}

/** Returned by writeAuditAttempt — contains the correlationId for subsequent RESULT write. */
export interface AttemptResult {
  correlationId: string;
  /** true if ATTEMPT was successfully written; false means BLOCKED (fail-closed). */
  written: boolean;
  /** Populated only when written=false */
  blockReason?: string;
}

// ── External provider classification ────────────────────────────────────────

const EXTERNAL_PROVIDERS = new Set([
  'claude', 'claude-cli', 'codex', 'codex-cli', 'openai',
  'copilot', 'github-copilot', 'copilot-daemon', 'gh-copilot',
  'external-worker', 'worker_backfill',
]);

const LOCAL_PROVIDERS = new Set([
  'local', 'local-planner', 'local-review', 'deterministic',
  'rule-based', 'adaptive_regime', 'none', 'dry-run',
]);

export function isExternalProvider(provider: string): boolean {
  const p = provider.toLowerCase().trim();
  if (LOCAL_PROVIDERS.has(p)) return false;
  if (EXTERNAL_PROVIDERS.has(p)) return true;
  // Unknown providers are treated as external (conservative)
  return true;
}

// ── File path ────────────────────────────────────────────────────────────────

function auditLogPath(): string {
  return nodePath.join(process.cwd(), 'runtime', 'agent_orchestrator', 'llm_audit.jsonl');
}

function ensureAuditDir(): void {
  mkdirSync(nodePath.dirname(auditLogPath()), { recursive: true });
}

// ── Core writer ──────────────────────────────────────────────────────────────

/**
 * Writes a single audit record to llm_audit.jsonl.
 * Returns true on success, false on I/O failure.
 * For ATTEMPT events, false means fail-closed (block the call).
 */
function writeAuditRecord(record: LlmAuditRecord): boolean {
  try {
    ensureAuditDir();
    appendFileSync(auditLogPath(), JSON.stringify(record) + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Write LLM_CALL_ATTEMPT before any external provider call.
 *
 * FAIL-CLOSED: if write fails, returns written=false.
 * Caller MUST check written and abort the provider call if false.
 */
export function writeAuditAttempt(input: AuditAttemptInput): AttemptResult {
  const correlationId = input.correlationId ?? randomUUID();
  const record: LlmAuditRecord = {
    timestamp: new Date().toISOString(),
    correlation_id: correlationId,
    event_type: 'LLM_CALL_ATTEMPT',
    runner_type: input.runnerType,
    usage_role: input.usageRole,
    provider: input.provider,
    model: input.model ?? null,
    task_id: input.taskId != null ? String(input.taskId) : null,
    run_id: input.runId ?? null,
    trigger_source: input.triggerSource ?? 'unknown',
    command_hash: null,
    caller_file: input.callerFile ?? 'unknown',
    caller_function: input.callerFunction ?? 'unknown',
    requires_llm: input.requiresLlm ?? true,
    policy_allowed: input.policyAllowed ?? true,
    blocked: false,
    block_reason: null,
    success: null,
    error: null,
    duration_ms: null,
    input_tokens: 0,
    output_tokens: 0,
    cached_tokens: 0,
    total_tokens: 0,
    premium_requests: 0,
    rate_limit_type: null,
    rate_limit_used_pct: null,
    rate_limit_reset_raw: null,
    raw_usage_excerpt: null,
    desired_model: input.desiredModel ?? null,
    actual_model: input.actualModel ?? null,
    model_propagation_status: input.modelPropagationStatus ?? null,
    model_mismatch: null,
    no_task_reason: input.noTaskReason ?? null,
  };

  const written = writeAuditRecord(record);
  if (!written) {
    return { correlationId, written: false, blockReason: 'BLOCKED_AUDIT_LOG_UNAVAILABLE' };
  }
  return { correlationId, written: true };
}

/**
 * Write LLM_CALL_RESULT after provider returns.
 * I/O errors are swallowed (non-fatal).
 */
export function writeAuditResult(input: AuditResultInput): void {
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const cachedTokens = input.cachedTokens ?? 0;
  const record: LlmAuditRecord = {
    timestamp: new Date().toISOString(),
    correlation_id: input.correlationId,
    event_type: 'LLM_CALL_RESULT',
    runner_type: input.runnerType,
    usage_role: input.usageRole,
    provider: input.provider,
    model: null,
    task_id: input.taskId != null ? String(input.taskId) : null,
    run_id: null,
    trigger_source: input.triggerSource ?? 'unknown',
    command_hash: null,
    caller_file: input.callerFile ?? 'unknown',
    caller_function: input.callerFunction ?? 'unknown',
    requires_llm: true,
    policy_allowed: true,
    blocked: false,
    block_reason: null,
    success: input.success,
    error: input.error ?? null,
    duration_ms: input.durationMs ?? null,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_tokens: cachedTokens,
    total_tokens: inputTokens + outputTokens + cachedTokens,
    premium_requests: input.premiumRequests ?? 0,
    rate_limit_type: input.rateLimitType ?? null,
    rate_limit_used_pct: input.rateLimitUsedPct ?? null,
    rate_limit_reset_raw: input.rateLimitResetRaw ?? null,
    raw_usage_excerpt: input.rawUsageExcerpt ?? null,
    desired_model: null,
    actual_model: input.actualModel ?? null,
    model_propagation_status: input.modelPropagationStatus ?? null,
    model_mismatch: null,
    no_task_reason: null,
  };
  writeAuditRecord(record);
}

/**
 * Write LLM_CALL_BLOCKED when policy blocks a provider call.
 * I/O errors are swallowed (non-fatal).
 */
export function writeAuditBlocked(input: AuditBlockedInput): void {
  const record: LlmAuditRecord = {
    timestamp: new Date().toISOString(),
    correlation_id: input.correlationId ?? randomUUID(),
    event_type: 'LLM_CALL_BLOCKED',
    runner_type: input.runnerType,
    usage_role: input.usageRole,
    provider: input.provider,
    model: null,
    task_id: input.taskId != null ? String(input.taskId) : null,
    run_id: null,
    trigger_source: input.triggerSource ?? 'unknown',
    command_hash: null,
    caller_file: input.callerFile ?? 'unknown',
    caller_function: input.callerFunction ?? 'unknown',
    requires_llm: input.requiresLlm ?? true,
    policy_allowed: false,
    blocked: true,
    block_reason: input.blockReason,
    success: null,
    error: null,
    duration_ms: null,
    input_tokens: 0,
    output_tokens: 0,
    cached_tokens: 0,
    total_tokens: 0,
    premium_requests: 0,
    rate_limit_type: null,
    rate_limit_used_pct: null,
    rate_limit_reset_raw: null,
    raw_usage_excerpt: null,
    desired_model: null,
    actual_model: null,
    model_propagation_status: null,
    model_mismatch: null,
    no_task_reason: input.noTaskReason ?? null,
  };
  writeAuditRecord(record);
}
