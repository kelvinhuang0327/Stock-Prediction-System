/**
 * Central LLM / Agent usage logger for llm_usage.jsonl.
 *
 * Every attempted or completed provider call (planner, worker, CTO, ai_service)
 * must go through one of the exported helper functions below.
 *
 * Design principles:
 * - Never crash: all I/O errors are swallowed.
 * - Never log secrets: any command string is SHA-256 hashed before writing.
 * - Schema is fixed; missing numerics default to 0, missing strings to null.
 * - Backward-compat: exposes legacy appendLlmUsage() as a pass-through.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import nodePath from 'node:path';
import type { LlmSkipReason } from './llmExecutionPolicy';

// ── Schema types ────────────────────────────────────────────────────────────

export type UsagePhase = 'preflight' | 'execution' | 'blocked' | 'failed' | 'fallback';
export type ModelPropagationStatus = 'propagated' | 'provider-managed' | 'not-propagated' | 'not-configured';
/**
 * Why a worker tick had no taskId:
 * - no_queued_task    : policy allowed, but queue was empty (idle cycle — NOT an anomaly)
 * - scheduler_disabled: policy gate rejected the tick before task lookup
 * - policy_blocked    : hard-off or safe-run-block prevented execution
 * - null              : call had a real task OR is a true anomaly (see COPILOT_MISSING_TASK_ID)
 */
export type NoTaskReason = 'no_queued_task' | 'scheduler_disabled' | 'policy_blocked' | null;
export type UsageEvent =
  | 'provider_preflight'
  | 'provider_execution_start'
  | 'provider_execution_success'
  | 'provider_execution_failed'
  | 'provider_blocked'
  | 'provider_fallback';
export type UsageCaller = 'planner' | 'worker' | 'cto' | 'ai_service' | 'frontend' | 'scheduler' | 'manual' | 'unknown';
export type UsageTriggerSource = 'scheduler' | 'manual' | 'api' | 'launchd' | 'worker-cycle' | 'unknown';
export type UsageDecision = 'allow' | 'skip' | 'block' | 'success' | 'failed';

export interface LlmUsageRecord {
  timestamp: string;
  phase: UsagePhase;
  event: UsageEvent;
  caller: UsageCaller;
  triggerSource: UsageTriggerSource;
  provider: string;
  model: string | null;
  taskId: string | null;
  jobName: string | null;
  decision: UsageDecision;
  skipReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  parsed: boolean;
  premiumRequests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  rateLimit: string | null;
  commandHash: string | null;
  durationMs: number;
  source: string;
  /** Desired model requested by caller (e.g. "gpt-5-mini"). */
  desiredModel: string | null;
  /** Actual model used by provider. null when provider does not confirm model. */
  actualModel: string | null;
  /** Model propagation status for this execution record. */
  modelPropagationStatus: ModelPropagationStatus | null;
  /**
   * Why this record has no taskId. null = has a real task, or is a genuine anomaly.
   * Only set for worker preflight records with decision='skip'.
   */
  noTaskReason: NoTaskReason;
}

/** Partial input passed to each helper — only the fields specific to each event are required. */
interface CommonInput {
  caller: UsageCaller;
  triggerSource?: UsageTriggerSource;
  provider: string;
  model?: string | null;
  taskId?: string | number | null;
  jobName?: string | null;
  skipReason?: LlmSkipReason | string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  premiumRequests?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  rateLimit?: string | null;
  /** Raw command string — will be SHA-256 hashed before writing. */
  command?: string | null;
  durationMs?: number;
  parsed?: boolean;
  /** Desired model (passed as {model} token; from workerCopilotModel or env var). */
  desiredModel?: string | null;
  /** Actual model confirmed by provider output. null = provider-managed (unconfirmed). */
  actualModel?: string | null;
  /** Propagation status for this record. */
  modelPropagationStatus?: ModelPropagationStatus | null;
  /** Why this preflight has no taskId. null = has real task or is a genuine anomaly. */
  noTaskReason?: NoTaskReason;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function usageLogPath(): string {
  return nodePath.join(process.cwd(), 'runtime', 'agent_orchestrator', 'llm_usage.jsonl');
}

function hashCommand(cmd: string | null | undefined): string | null {
  if (!cmd) return null;
  return createHash('sha256').update(cmd).digest('hex').slice(0, 12);
}

function buildRecord(
  phase: UsagePhase,
  event: UsageEvent,
  decision: UsageDecision,
  input: CommonInput,
): LlmUsageRecord {
  return {
    timestamp: new Date().toISOString(),
    phase,
    event,
    caller: input.caller,
    triggerSource: input.triggerSource ?? 'unknown',
    provider: input.provider || 'unknown',
    model: input.model ?? null,
    taskId: input.taskId != null ? String(input.taskId) : null,
    jobName: input.jobName ?? null,
    decision,
    skipReason: input.skipReason ?? null,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    parsed: input.parsed ?? true,
    premiumRequests: input.premiumRequests ?? 0,
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
    cachedTokens: input.cachedTokens ?? 0,
    rateLimit: input.rateLimit ?? null,
    commandHash: hashCommand(input.command),
    durationMs: input.durationMs ?? 0,
    source: 'llmUsageLogger.ts',
    desiredModel: input.desiredModel ?? null,
    actualModel: input.actualModel ?? null,
    modelPropagationStatus: input.modelPropagationStatus ?? null,
    noTaskReason: input.noTaskReason ?? null,
  };
}

function writeRecord(record: LlmUsageRecord): void {
  try {
    const logPath = usageLogPath();
    mkdirSync(nodePath.dirname(logPath), { recursive: true });
    appendFileSync(logPath, JSON.stringify(record) + '\n', { encoding: 'utf-8' });
  } catch {
    // Intentionally swallowed — logging must never break execution.
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Log a policy preflight evaluation (allow or skip).
 * Called by plannerTick, workerTick, ctoReviewTick after evaluateExecutionPolicy.
 */
export function logProviderPreflight(
  input: CommonInput & { allowed: boolean },
): void {
  writeRecord(buildRecord(
    'preflight',
    'provider_preflight',
    input.allowed ? 'allow' : 'skip',
    input,
  ));
}

/**
 * Log just before the external provider command is executed.
 * Every real exec must log this so interrupted calls are visible.
 */
export function logProviderExecutionStart(input: CommonInput): void {
  writeRecord(buildRecord('execution', 'provider_execution_start', 'allow', input));
}

/**
 * Log after a successful provider execution.
 * Accepts optional token usage parsed from provider output.
 */
export function logProviderExecutionSuccess(input: CommonInput): void {
  writeRecord(buildRecord('execution', 'provider_execution_success', 'success', input));
}

/**
 * Log after a provider execution that threw or returned non-zero.
 */
export function logProviderExecutionFailure(input: CommonInput): void {
  writeRecord(buildRecord('failed', 'provider_execution_failed', 'failed', input));
}

/**
 * Log a call that was blocked before reaching the provider
 * (allowlist gate, quota switch, hard-off, etc.).
 */
export function logProviderBlocked(input: CommonInput): void {
  writeRecord(buildRecord('blocked', 'provider_blocked', 'block', input));
}

/**
 * Log a fallback attempt (e.g. primary provider failed, trying secondary).
 */
export function logProviderFallback(input: CommonInput & { attempted: boolean }): void {
  writeRecord(buildRecord(
    'fallback',
    'provider_fallback',
    input.attempted ? 'allow' : 'block',
    input,
  ));
}

// ── Legacy shim ─────────────────────────────────────────────────────────────
// Kept for existing call sites in aiService.ts (allowlist gate).

/** @deprecated Use logProviderBlocked() or logProviderPreflight() instead. */
export interface LlmUsageEntry {
  phase: 'preflight' | 'execution';
  decision: 'allow' | 'skip' | 'execute' | 'blocked';
  caller: string;
  callerContext?: string | null;
  provider: string;
  model?: string | null;
  taskId?: string | number | null;
  skipReason?: LlmSkipReason | null;
  externalLlmDisabled?: boolean;
}

/** @deprecated Use logProviderBlocked() for blocked paths. */
export function appendLlmUsage(entry: LlmUsageEntry): void {
  const isBlocked = entry.decision === 'blocked';
  const input: CommonInput = {
    caller: (entry.caller as UsageCaller) || 'unknown',
    triggerSource: (entry.callerContext === 'manual' ? 'manual' : 'unknown') as UsageTriggerSource,
    provider: entry.provider,
    model: entry.model,
    taskId: entry.taskId,
    skipReason: entry.skipReason,
  };
  if (isBlocked) {
    logProviderBlocked(input);
  } else {
    logProviderPreflight({ ...input, allowed: entry.decision === 'allow' });
  }
}
