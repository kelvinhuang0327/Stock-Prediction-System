/**
 * systemHealthGuard.ts — B-02.3: System Health Guard (Non-Intrusive)
 *
 * Provides health-aware guard decisions that annotate orchestrator operations
 * with a warningLevel without ever blocking or changing scheduling behaviour.
 *
 * Design constraints:
 *   - allowed is ALWAYS true — no task is blocked
 *   - No scheduler state is mutated
 *   - No external service is called
 *   - No production trading thresholds are modified
 *   - Purely observational — adds context / logging only
 */

import type { SystemHealthReport } from './systemHealth';
import { getSystemHealthStatus } from './systemHealth';
import type { TrendSignal } from './staleJobCleanup';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WarningLevel = 'none' | 'elevated' | 'high';

/** Guard decision returned for every call.  allowed is always true. */
export interface GuardDecision {
  /** Always true — guard never blocks. */
  allowed: true;
  /** Severity of the health warning (none = healthy). */
  warningLevel: WarningLevel;
  /** Human-readable reason string suitable for logging. */
  reason: string;
  /** Active trend signals at decision time. */
  signals: TrendSignal[];
}

/** A warning entry recorded in a report when a guard fires. */
export interface GuardWarning {
  /** Which guard was called. */
  guard: 'dispatch' | 'worker_run' | 'task_annotation';
  /** Warning level at the time of the call. */
  warningLevel: WarningLevel;
  /** Reason string. */
  reason: string;
  /** Signal labels active at call time. */
  signalLabels: string[];
  /** ISO timestamp. */
  recordedAt: string;
}

/** Health context stamped onto a TaskRecord when annotated. */
export interface TaskHealthContext {
  status: 'healthy' | 'degraded' | 'critical';
  signals: TrendSignal[];
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function warningLevelFromReport(health: SystemHealthReport): WarningLevel {
  if (health.status === 'critical') return 'high';
  if (health.status === 'degraded') return 'elevated';
  return 'none';
}

function buildReason(health: SystemHealthReport, context: string): string {
  if (health.status === 'healthy') return `${context}: system healthy`;
  const labels = health.signals.map((s) => s.label).join(', ');
  return `${context}: system ${health.status} — active signals: [${labels}]`;
}

function buildDecision(health: SystemHealthReport, context: string): GuardDecision {
  return {
    allowed: true,
    warningLevel: warningLevelFromReport(health),
    reason: buildReason(health, context),
    signals: health.signals,
  };
}

// ---------------------------------------------------------------------------
// Guard API
// ---------------------------------------------------------------------------

/**
 * Evaluate health guard before dispatching (creating) a task.
 * Returns a decision with warningLevel and reason — never blocks.
 * Never throws.
 */
export async function shouldWarnOnDispatch(): Promise<GuardDecision> {
  try {
    const health = await getSystemHealthStatus();
    return buildDecision(health, 'shouldWarnOnDispatch');
  } catch {
    return { allowed: true, warningLevel: 'none', reason: 'shouldWarnOnDispatch: health check unavailable', signals: [] };
  }
}

/**
 * Evaluate health guard before a worker runs a task.
 * Returns a decision with warningLevel and reason — never blocks.
 * Never throws.
 */
export async function shouldWarnOnWorkerRun(): Promise<GuardDecision> {
  try {
    const health = await getSystemHealthStatus();
    return buildDecision(health, 'shouldWarnOnWorkerRun');
  } catch {
    return { allowed: true, warningLevel: 'none', reason: 'shouldWarnOnWorkerRun: health check unavailable', signals: [] };
  }
}

/**
 * Build a TaskHealthContext annotation for a task record.
 * Always returns a valid context object — never throws.
 */
export async function shouldAnnotateTask(): Promise<TaskHealthContext> {
  try {
    const health = await getSystemHealthStatus();
    return {
      status: health.status,
      signals: health.signals,
      evaluatedAt: health.evaluatedAt,
    };
  } catch {
    return {
      status: 'healthy',
      signals: [],
      evaluatedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Guard warning collector (for report injection)
// ---------------------------------------------------------------------------

/** In-memory list of guard warnings accumulated during a process lifetime. */
const _guardWarnings: GuardWarning[] = [];

/**
 * Record a guard warning in the in-memory list.
 * Called automatically by logGuardDecision() — exported for testing.
 */
export function recordGuardWarning(warning: GuardWarning): void {
  _guardWarnings.push(warning);
}

/**
 * Return a snapshot of all accumulated guard warnings and clear the buffer.
 */
export function flushGuardWarnings(): GuardWarning[] {
  return _guardWarnings.splice(0);
}

/**
 * Return all accumulated guard warnings without clearing.
 */
export function peekGuardWarnings(): GuardWarning[] {
  return [..._guardWarnings];
}

/**
 * Log a guard decision to stderr (non-blocking) and record the warning if elevated.
 *
 * @param caller     Caller label for log line (e.g. 'plannerTick')
 * @param guard      Which guard was invoked
 * @param decision   The GuardDecision from shouldWarnOnDispatch / shouldWarnOnWorkerRun
 */
export function logGuardDecision(
  caller: string,
  guard: GuardWarning['guard'],
  decision: GuardDecision,
): void {
  if (decision.warningLevel === 'none') return;

  const warning: GuardWarning = {
    guard,
    warningLevel: decision.warningLevel,
    reason: decision.reason,
    signalLabels: decision.signals.map((s) => s.label),
    recordedAt: new Date().toISOString(),
  };
  recordGuardWarning(warning);

  process.stderr.write(
    `[health_guard_warning] caller=${caller} guard=${guard} level=${decision.warningLevel} reason="${decision.reason}"\n`,
  );
}
