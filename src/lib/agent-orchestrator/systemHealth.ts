/**
 * systemHealth.ts — B-02.2: Cleanup Trend → Orchestrator Feedback Loop
 *
 * Reads cleanup trend data and maps it to a system health status that the
 * orchestrator can observe without changing any scheduling behaviour.
 *
 * Design constraints:
 *   - Pure observation only — does NOT change scheduling behaviour
 *   - Does NOT call any LLM or external service
 *   - Does NOT modify production trading thresholds
 *   - Does NOT start or stop the scheduler
 *   - futureOnly actions are placeholders — not executed by this module
 */

import nodePath from 'node:path';
import { nowIso, readJsonFile } from './common';
import { loadProjectProfile } from './profile';
import { loadSchedulerState } from './storage';
import { analyzeCleanupTrends } from './staleJobCleanup';
import type { CleanupHistory, CleanupTrendReport, TrendLabel, TrendSignal } from './staleJobCleanup';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Overall system health status derived from cleanup trend signals. */
export type HealthStatus = 'healthy' | 'degraded' | 'critical';

/**
 * An action recommended in response to a detected trend signal.
 * Actions marked futureOnly are informational — they are NOT performed
 * automatically by this module.
 */
export interface RecommendedAction {
  /** The trend signal that triggered this recommendation. */
  signal: TrendLabel;
  /** Human-readable description of the recommended action. */
  action: string;
  /** Severity of the recommendation. */
  severity: 'info' | 'warning' | 'critical';
  /**
   * When true this action requires infrastructure changes not yet implemented.
   * It is included only as a forward-looking recommendation.
   */
  futureOnly?: boolean;
}

export interface SystemHealthReport {
  /** ISO timestamp of when the health check ran. */
  evaluatedAt: string;
  /** Aggregate system health status. */
  status: HealthStatus;
  /** Active trend signals that contributed to the status. */
  signals: TrendSignal[];
  /** Recommended actions derived from active signals (may include futureOnly items). */
  recommendedActions: RecommendedAction[];
  /** Whether any trend signals were detected. */
  hasSignals: boolean;
  /** Whether the cleanup history had enough entries to run trend analysis (min 4). */
  sufficientData: boolean;
  /** Number of history entries analysed. */
  entriesAnalyzed: number;
}

// ---------------------------------------------------------------------------
// Signal → recommended-action mapping
// ---------------------------------------------------------------------------

const TREND_ACTION_MAP: Record<TrendLabel, RecommendedAction[]> = {
  worker_unstable: [
    {
      signal: 'worker_unstable',
      action: 'Increase logging level to WARN for worker operations',
      severity: 'warning',
    },
    {
      signal: 'worker_unstable',
      action: 'Mark system as degraded — monitor worker crash frequency closely',
      severity: 'warning',
    },
    {
      signal: 'worker_unstable',
      action: '[Future] Reduce worker concurrency to lower crash pressure',
      severity: 'info',
      futureOnly: true,
    },
  ],
  scheduler_issue: [
    {
      signal: 'scheduler_issue',
      action: 'Log warning: scheduler heartbeat frequency is degrading',
      severity: 'warning',
    },
    {
      signal: 'scheduler_issue',
      action: '[Future] Increase heartbeat check frequency to detect stale scheduler earlier',
      severity: 'info',
      futureOnly: true,
    },
  ],
  crash_rate_up: [
    {
      signal: 'crash_rate_up',
      action: 'Log warning: task reclaim rate rising — potential worker instability',
      severity: 'warning',
    },
    {
      signal: 'crash_rate_up',
      action: '[Future] Reduce task dispatch rate to reduce crash pressure',
      severity: 'info',
      futureOnly: true,
    },
    {
      signal: 'crash_rate_up',
      action: '[Future] Suspend affected lanes if reclaim rate exceeds critical threshold',
      severity: 'critical',
      futureOnly: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Status computation
// ---------------------------------------------------------------------------

/**
 * Map signal count to an overall health status.
 *
 * - 0 signals → healthy
 * - 1 signal  → degraded
 * - 2+ signals → critical
 */
function computeStatus(signals: TrendSignal[]): HealthStatus {
  if (signals.length === 0) return 'healthy';
  if (signals.length === 1) return 'degraded';
  return 'critical';
}

// ---------------------------------------------------------------------------
// Core (pure) computation — accepts pre-analysed trend report
// ---------------------------------------------------------------------------

/**
 * Compute a SystemHealthReport from a CleanupTrendReport.
 * This is a pure synchronous function — no I/O.
 */
export function computeSystemHealth(trends: CleanupTrendReport): SystemHealthReport {
  const status = computeStatus(trends.signals);

  const recommendedActions: RecommendedAction[] = [];
  for (const signal of trends.signals) {
    const actions = TREND_ACTION_MAP[signal.label] ?? [];
    recommendedActions.push(...actions);
  }

  return {
    evaluatedAt: nowIso(),
    status,
    signals: trends.signals,
    recommendedActions,
    hasSignals: trends.signals.length > 0,
    sufficientData: trends.sufficientData,
    entriesAnalyzed: trends.entriesAnalyzed,
  };
}

// ---------------------------------------------------------------------------
// Async entry point — loads history from disk and computes health
// ---------------------------------------------------------------------------

const HISTORY_FILE = 'stale_cleanup_history.json';

/**
 * Load the cleanup history from disk, run trend analysis, and return the
 * resulting SystemHealthReport.
 *
 * Gracefully returns a healthy report with sufficientData=false when:
 *   - the history file does not exist yet
 *   - the file is malformed
 *   - there are not enough entries for trend analysis
 *
 * Never throws.
 */
export async function getSystemHealthStatus(): Promise<SystemHealthReport> {
  try {
    const profile = await loadProjectProfile();
    const { paths } = await loadSchedulerState(profile);
    const histPath = nodePath.join(paths.orchestratorRoot, HISTORY_FILE);

    let history: CleanupHistory;
    try {
      const stored = await readJsonFile<Partial<CleanupHistory>>(histPath);
      history = {
        version: '1.0',
        entries: Array.isArray(stored?.entries) ? stored.entries : [],
      };
    } catch {
      history = { version: '1.0', entries: [] };
    }

    const trends = analyzeCleanupTrends(history);
    return computeSystemHealth(trends);
  } catch {
    // Non-fatal — return a safe no-signal report so callers never crash
    return {
      evaluatedAt: nowIso(),
      status: 'healthy',
      signals: [],
      recommendedActions: [],
      hasSignals: false,
      sufficientData: false,
      entriesAnalyzed: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Logging helpers (used by plannerTick / workerTick)
// ---------------------------------------------------------------------------

/**
 * Emit a non-blocking health warning to stderr when system health is not healthy.
 * Does not throw. Does not change any scheduler state.
 *
 * @param caller  Identifies the caller in the log line (e.g. 'plannerTick')
 * @param health  The health report to log
 */
export function emitHealthWarningIfDegraded(caller: string, health: SystemHealthReport): void {
  if (health.status === 'healthy') return;
  const labels = health.signals.map((s) => s.label).join(', ');
  process.stderr.write(
    `[ORCHESTRATOR_HEALTH][${health.status.toUpperCase()}] ${caller}: signals=[${labels}] — observing only, no behaviour change\n`,
  );
}
