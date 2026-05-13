/**
 * LLM Usage Warning Engine — READ-ONLY pure functions.
 *
 * Consumes normalised UsageRecord objects (same shape as the API) and returns
 * an array of structured Warning objects.  No I/O, no side effects.
 *
 * Warning levels:
 *   INFO     — attribution gaps, token unavailability
 *   WARNING  — preflight loops, blocked / failed calls
 *   CRITICAL — high execution counts, repeated single-task calls
 *
 * Counting rules (same as TASK 3):
 *   - Only external providers count: copilot-daemon, github-copilot, github-cli,
 *     codex, claude, openai, external-worker
 *   - local-planner / local-review never generate Copilot warnings
 *   - preflight calls counted separately from real executions
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type WarningLevel = 'INFO' | 'WARNING' | 'CRITICAL';

export type WarningCode =
  | 'COPILOT_EXECUTION_HIGH'         // Rule A — daily exec > 10
  | 'COPILOT_TASK_REPEATED'          // Rule B — single task exec > 3
  | 'COPILOT_FAILED_CALLS'           // Rule C — failed > 0
  | 'COPILOT_BLOCKED_CALLS'          // Rule D — blocked > 0
  | 'COPILOT_PREFLIGHT_LOOP'         // Rule E — preflight-allow > 5 for same task/no-task
  | 'COPILOT_MISSING_TASK_ID';       // Rule F — calls without taskId

export interface UsageWarning {
  level: WarningLevel;
  code: WarningCode;
  message: string;
  provider: string;
  taskId: string | null;
  count: number;
  /** Human-readable suggested action */
  action: string;
}

/** Minimal shape of a usage record the warning engine needs */
export interface WarningInputRecord {
  phase: string;
  event: string;
  provider: string;
  caller: string;
  decision: string;
  taskId: string | null;
  parsed: boolean;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  premiumRequests: number;
  /**
   * Why this record has no taskId. When present, the record is an expected idle /
   * disabled tick and must NOT count toward COPILOT_PREFLIGHT_LOOP or
   * COPILOT_MISSING_TASK_ID. Old records without this field are treated as
   * null (no reason — may be a real anomaly).
   */
  noTaskReason?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Providers that belong to Copilot / GitHub Copilot family */
export const COPILOT_PROVIDERS = new Set([
  'copilot-daemon',
  'github-copilot',
  'github-cli',
]);

/** All external providers (quota-consuming) */
export const EXTERNAL_PROVIDERS = new Set([
  'copilot-daemon',
  'github-copilot',
  'github-cli',
  'codex',
  'claude',
  'openai',
  'external-worker',
  'worker_backfill',
]);

const THRESHOLDS = {
  /** Rule A: daily Copilot execution count → CRITICAL */
  COPILOT_EXEC_HIGH: 10,
  /** Rule B: single-task Copilot call count → CRITICAL */
  TASK_EXEC_REPEATED: 3,
  /** Rule E: preflight-allow count per task/no-task → WARNING */
  PREFLIGHT_LOOP: 5,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isCopilot(provider: string): boolean {
  return COPILOT_PROVIDERS.has(provider);
}

function isRealExecution(r: WarningInputRecord): boolean {
  return (
    (r.phase === 'execution' || r.phase === 'failed') &&
    EXTERNAL_PROVIDERS.has(r.provider) &&
    r.decision !== 'skip' &&
    r.decision !== 'block' &&
    (r.event === 'provider_execution_success' || r.event === 'provider_execution_failed')
  );
}

function isPreflightAllow(r: WarningInputRecord): boolean {
  return r.phase === 'preflight' && (r.decision === 'allow' || r.decision === 'execute');
}

// ── Main engine ───────────────────────────────────────────────────────────────

/**
 * Compute all active warnings from a set of usage records.
 *
 * @param records  Normalised records from llm_usage.jsonl (any date range).
 * @returns        Array of warnings, ordered CRITICAL → WARNING → INFO.
 */
export function computeWarnings(records: WarningInputRecord[]): UsageWarning[] {
  const warnings: UsageWarning[] = [];

  // Scope to Copilot providers only for most rules
  const copilotRecords = records.filter(r => isCopilot(r.provider));

  if (copilotRecords.length === 0) return warnings;

  // ── Rule A — Copilot execution high ─────────────────────────────────────
  const copilotExecs = copilotRecords.filter(isRealExecution);
  if (copilotExecs.length > THRESHOLDS.COPILOT_EXEC_HIGH) {
    warnings.push({
      level: 'CRITICAL',
      code: 'COPILOT_EXECUTION_HIGH',
      message: `Copilot usage high today (${copilotExecs.length} executions)`,
      provider: 'copilot-daemon',
      taskId: null,
      count: copilotExecs.length,
      action: '請檢查 Top Tasks 並考慮暫停 Worker scheduler',
    });
  }

  // ── Rule B — Single task repeated Copilot calls ──────────────────────────
  const execByTask = new Map<string, { count: number; provider: string }>();
  for (const r of copilotExecs) {
    const key = r.taskId ?? '(no task)';
    const existing = execByTask.get(key);
    if (existing) {
      existing.count++;
    } else {
      execByTask.set(key, { count: 1, provider: r.provider });
    }
  }
  for (const [taskId, { count, provider }] of execByTask) {
    if (count > THRESHOLDS.TASK_EXEC_REPEATED) {
      warnings.push({
        level: 'CRITICAL',
        code: 'COPILOT_TASK_REPEATED',
        message: `Task #${taskId} has repeated Copilot calls (${count} executions)`,
        provider,
        taskId: taskId === '(no task)' ? null : taskId,
        count,
        action: '請檢查該 task 是否陷入重試迴圈，考慮手動 cancel',
      });
    }
  }

  // ── Rule C — Copilot failed calls ────────────────────────────────────────
  const copilotFailed = copilotRecords.filter(
    r => r.phase === 'failed' || r.event === 'provider_execution_failed',
  );
  if (copilotFailed.length > 0) {
    const providers = [...new Set(copilotFailed.map(r => r.provider))].join(', ');
    warnings.push({
      level: 'WARNING',
      code: 'COPILOT_FAILED_CALLS',
      message: `Copilot failed calls detected (${copilotFailed.length})`,
      provider: providers,
      taskId: copilotFailed[0]?.taskId ?? null,
      count: copilotFailed.length,
      action: '請檢查 Recent table 的 failed 記錄，確認是否為 rate limit 或 auth 問題',
    });
  }

  // ── Rule D — Copilot blocked calls ───────────────────────────────────────
  const copilotBlocked = copilotRecords.filter(
    r => r.phase === 'blocked' || r.decision === 'block',
  );
  if (copilotBlocked.length > 0) {
    const reasons = [...new Set(
      copilotBlocked
        .map(r => (r as unknown as { skipReason?: string }).skipReason)
        .filter(Boolean),
    )].join(', ');
    warnings.push({
      level: 'WARNING',
      code: 'COPILOT_BLOCKED_CALLS',
      message: `Copilot blocked attempts detected (${copilotBlocked.length})`,
      provider: 'copilot-daemon',
      taskId: null,
      count: copilotBlocked.length,
      action: reasons
        ? `Block 原因：${reasons}。請確認 execution policy 設定`
        : '請確認 execution policy 是否正確啟用 copilot-daemon',
    });
  }

  // ── Rule E — Preflight loop ──────────────────────────────────────────────
  const preflightByTask = new Map<string, number>();
  for (const r of copilotRecords) {
    if (!isPreflightAllow(r)) continue;
    // Skip idle cycles (no_queued_task) and policy-blocked ticks (scheduler_disabled,
    // policy_blocked) — these are expected; not an indicator of a loop.
    if (r.noTaskReason === 'no_queued_task' || r.noTaskReason === 'scheduler_disabled' || r.noTaskReason === 'policy_blocked') continue;
    const key = r.taskId ?? '(no task)';
    preflightByTask.set(key, (preflightByTask.get(key) ?? 0) + 1);
  }
  for (const [taskId, count] of preflightByTask) {
    if (count > THRESHOLDS.PREFLIGHT_LOOP) {
      warnings.push({
        level: 'WARNING',
        code: 'COPILOT_PREFLIGHT_LOOP',
        message: `Possible Copilot preflight loop (${count} preflight-allow for task ${taskId})`,
        provider: 'copilot-daemon',
        taskId: taskId === '(no task)' ? null : taskId,
        count,
        action: '請檢查 Worker claim loop — 多次 preflight 但無 execution 可能是 worker 卡住',
      });
    }
  }

  // ── Rule F — Missing task attribution ───────────────────────────────────
  //
  // Two distinct sub-cases:
  //   F1. Execution records (phase='execution') missing taskId with noTaskReason=null
  //       → genuine anomaly — WARNING level
  //   F2. Preflight/blocked records missing taskId with noTaskReason=null (and not idle/disabled)
  //       → attribution gap — INFO level
  //
  // Records with noTaskReason set (no_queued_task, scheduler_disabled, policy_blocked)
  // are intentional and must NOT count toward this warning.

  const anomalousExecMissingTask = copilotRecords.filter(
    r => isRealExecution(r) && !r.taskId && !r.noTaskReason,
  );

  // F2: any other copilot records missing taskId AND lacking noTaskReason explanation
  const unexplainedMissingTask = copilotRecords.filter(
    r => !r.taskId && !r.noTaskReason && !isRealExecution(r),
  );

  // Merge logic:
  // - If only anomalous executions exist → WARNING (genuine anomaly)
  // - If only unexplained preflight/blocked exist → INFO (attribution gap)
  // - If both exist → treat as INFO but aggregate counts (UI prefers INFO summary)
  const totalMissing = anomalousExecMissingTask.length + unexplainedMissingTask.length;
  if (totalMissing > 0) {
    if (unexplainedMissingTask.length > 0 && anomalousExecMissingTask.length === 0) {
      warnings.push({
        level: 'INFO',
        code: 'COPILOT_MISSING_TASK_ID',
        message: `Copilot calls missing task attribution (${unexplainedMissingTask.length} unexplained preflight/blocked records)`,
        provider: 'copilot-daemon',
        taskId: null,
        count: unexplainedMissingTask.length,
        action: '請確認 Worker 呼叫 logProviderPreflight / logProviderExecutionStart 時有帶 taskId 或 noTaskReason',
      });
    } else if (anomalousExecMissingTask.length > 0 && unexplainedMissingTask.length === 0) {
      warnings.push({
        level: 'WARNING',
        code: 'COPILOT_MISSING_TASK_ID',
        message: `Copilot execution records missing task attribution (${anomalousExecMissingTask.length} anomalous records)`,
        provider: 'copilot-daemon',
        taskId: null,
        count: anomalousExecMissingTask.length,
        action: 'Execution with no taskId and no noTaskReason — 請檢查 Worker claim 路徑是否正確傳遞 taskId',
      });
    } else {
      // Both types present → aggregate as INFO for UI summary
      warnings.push({
        level: 'INFO',
        code: 'COPILOT_MISSING_TASK_ID',
        message: `Copilot calls missing task attribution (${totalMissing} records)`,
        provider: 'copilot-daemon',
        taskId: null,
        count: totalMissing,
        action: '請確認 Worker 呼叫 logProviderPreflight / logProviderExecutionStart 時有帶 taskId 或 noTaskReason',
      });
    }
  }

  // Sort: CRITICAL first, then WARNING, then INFO
  const order: Record<WarningLevel, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  return warnings.sort((a, b) => order[a.level] - order[b.level]);
}
