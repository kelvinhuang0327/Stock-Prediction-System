/**
 * SafetyGuard.ts — T-04 LLM Hard-Off / Safe-Run / Missing-TaskId Alert
 *
 * Provides scheduler/orchestrator safety controls:
 * - evaluateSafetyMode(): determines mode and llmHardOff flag
 * - validateTaskId(): returns NONE/WARNING/CRITICAL alert for taskId presence
 * - assertLlmAllowed(): throws if LLM is not allowed
 *
 * Pure utility — no DB writes, no external API calls, no LLM calls.
 * No H001-H012. No strategy validation. No buy/sell/signal.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type SafetyMode = 'NORMAL' | 'SAFE_RUN' | 'LLM_HARD_OFF' | 'DEGRADED' | 'BLOCKED';

export type TaskIdAlertLevel = 'NONE' | 'WARNING' | 'CRITICAL';

export interface TaskIdAlert {
  level: TaskIdAlertLevel;
  message: string | null;
  requiresAction: boolean;
}

export interface SafetyDecision {
  mode: SafetyMode;
  llmHardOff: boolean;
  allowExternalAi: boolean;
  allowExternalApi: boolean;
  allowDbWrite: boolean;
  taskIdAlert: TaskIdAlert;
  reasons: string[];
  source: 'T04_SAFETY_GUARD';
}

export interface ValidateTaskIdParams {
  taskId?: string | null;
  dryRun: boolean;
  mayMutateState: boolean;
  mayCallExternalAi: boolean;
}

export interface EvaluateSafetyModeParams {
  safeRun?: boolean;
  llmHardOffEnv?: boolean;
  opsReportStatus?: string;
  opsGuardrailOk?: boolean;
  taskId?: string | null;
  dryRun: boolean;
  mayMutateState: boolean;
  mayCallExternalAi: boolean;
}

// ─── validateTaskId ───────────────────────────────────────────────────────────

/**
 * Validates whether a taskId is present and appropriate for the task type.
 *
 * Alert levels:
 *   NONE     — taskId exists and non-empty
 *   WARNING  — taskId missing but task is dry-run / non-mutating / no external AI
 *   CRITICAL — taskId missing and task may mutate state or call external AI
 */
export function validateTaskId(params: ValidateTaskIdParams): TaskIdAlert {
  const { taskId, dryRun, mayMutateState, mayCallExternalAi } = params;

  const hasTaskId = typeof taskId === 'string' && taskId.trim().length > 0;

  if (hasTaskId) {
    return { level: 'NONE', message: null, requiresAction: false };
  }

  // taskId is missing
  if (mayMutateState) {
    return {
      level: 'CRITICAL',
      message: 'taskId is missing for a state-mutating task. Task must not proceed without a trackable taskId.',
      requiresAction: true,
    };
  }

  if (mayCallExternalAi) {
    return {
      level: 'CRITICAL',
      message: 'taskId is missing for a task that may call external AI. Task must not proceed without a trackable taskId.',
      requiresAction: true,
    };
  }

  if (dryRun) {
    return {
      level: 'WARNING',
      message: 'taskId missing for dry-run / non-mutating task. No immediate block, but traceability is reduced.',
      requiresAction: true,
    };
  }

  return {
    level: 'WARNING',
    message: 'taskId missing. Task is non-mutating but traceability is reduced.',
    requiresAction: true,
  };
}

// ─── evaluateSafetyMode ──────────────────────────────────────────────────────

/**
 * Evaluates the overall safety mode for a scheduled task.
 *
 * LLM hard-off is triggered by ANY of:
 * - safeRun = true
 * - llmHardOffEnv = true
 * - opsReportStatus !== 'PASS'
 * - opsGuardrailOk = false
 * - taskIdAlert.level = 'CRITICAL'
 * - env vars SAFE_RUN=true or LLM_HARD_OFF=true (checked internally)
 *
 * No external calls are made. Pure function.
 */
export function evaluateSafetyMode(params: EvaluateSafetyModeParams): SafetyDecision {
  const {
    safeRun,
    llmHardOffEnv,
    opsReportStatus,
    opsGuardrailOk,
    taskId,
    dryRun,
    mayMutateState,
    mayCallExternalAi,
  } = params;

  const reasons: string[] = [];
  const taskIdAlert = validateTaskId({ taskId, dryRun, mayMutateState, mayCallExternalAi });

  // Check env vars (read here so evaluateSafetyMode is self-contained)
  const envSafeRun = process.env.SAFE_RUN === 'true';
  const envLlmHardOff = process.env.LLM_HARD_OFF === 'true';

  let llmHardOff = false;
  let mode: SafetyMode = 'NORMAL';

  // Collect all reasons for hard-off
  if (safeRun || envSafeRun) {
    llmHardOff = true;
    reasons.push('SAFE_RUN mode is enabled.');
    if (mode === 'NORMAL') mode = 'SAFE_RUN';
  }

  if (llmHardOffEnv || envLlmHardOff) {
    llmHardOff = true;
    reasons.push('LLM_HARD_OFF env var is set.');
    if (mode === 'NORMAL' || mode === 'SAFE_RUN') mode = 'LLM_HARD_OFF';
  }

  if (opsReportStatus !== undefined && opsReportStatus !== 'PASS') {
    llmHardOff = true;
    reasons.push(`Ops Report status is ${opsReportStatus} (not PASS). Degraded mode.`);
    if (mode === 'NORMAL' || mode === 'SAFE_RUN') mode = 'DEGRADED';
  }

  if (opsGuardrailOk === false) {
    llmHardOff = true;
    reasons.push('Ops Report guardrail check failed. Blocking external AI.');
    mode = 'BLOCKED';
  }

  if (taskIdAlert.level === 'CRITICAL') {
    llmHardOff = true;
    reasons.push('CRITICAL missing-taskId alert. Blocking task execution.');
    mode = 'BLOCKED';
  }

  const allowExternalAi = !llmHardOff;
  const allowExternalApi = !llmHardOff;
  // DB writes: only blocked in BLOCKED mode
  const allowDbWrite = mode !== 'BLOCKED';

  return {
    mode,
    llmHardOff,
    allowExternalAi,
    allowExternalApi,
    allowDbWrite,
    taskIdAlert,
    reasons,
    source: 'T04_SAFETY_GUARD',
  };
}

// ─── assertLlmAllowed ────────────────────────────────────────────────────────

/**
 * Throws an error if LLM calls are not allowed per the safety decision.
 *
 * Call this at the beginning of any function that may invoke LLM / external AI.
 * If it throws, the LLM call must not proceed.
 */
export function assertLlmAllowed(decision: SafetyDecision): void {
  if (decision.llmHardOff || !decision.allowExternalAi) {
    throw new Error(
      `[SafetyGuard] LLM call blocked. mode=${decision.mode}, llmHardOff=${decision.llmHardOff}. ` +
        `Reasons: ${decision.reasons.join(' | ')}`,
    );
  }
}
