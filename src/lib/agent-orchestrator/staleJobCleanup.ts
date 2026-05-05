/**
 * staleJobCleanup.ts — B-02: Stale Job Cleanup + Lease Expiry
 *
 * Detects and optionally releases:
 *   1. Expired lane locks (RUNNING task whose lease has passed)
 *   2. Stale scheduler heartbeat (scheduler process appears dead)
 *   3. Orphaned RUNNING tasks (last output too old; worker likely crashed)
 *
 * Design constraints:
 *   - dryRun = true (default): read-only — no state mutations, no file writes
 *   - dryRun = false: safe release — marks reclaimable tasks REPLAN_REQUIRED
 *   - schedulerEnabled = false → never reclaim tasks (passive scan only)
 *   - Does NOT call any LLM or policy script
 *   - Does NOT modify provider execution counters
 *   - Always writes stale_cleanup_report.json (even in dryRun)
 *   - Always appends to stale_cleanup_history.json (observability, even in dryRun)
 */

import nodePath from 'node:path';
import { fileExists, nowIso, readJsonFile, writeJsonFile } from './common';
import {
  buildLaneLockFile,
  buildSchedulerHeartbeatFile,
  type LaneLockFile,
  type SchedulerHeartbeatFile,
} from './laneGuard';
import { loadProjectProfile } from './profile';
import { loadSchedulerState, loadTaskIndex, saveTaskIndex, type RuntimePaths } from './storage';
import type { SchedulerLane, SchedulerState, TaskRecord } from './types';
import { SCHEDULER_LANES } from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StaleCleanupOptions {
  /** When true (default), only scan — do not mutate any state files. */
  dryRun?: boolean;
  /**
   * How many ms of silence before a lane lock is considered expired.
   * Defaults to finalize_on_stale_output_minutes × 60_000 from profile,
   * or 30 minutes if not configured.
   */
  leaseDurationMs?: number;
  /**
   * How many ms of silence before the scheduler heartbeat is considered stale.
   * Defaults to 10 minutes.
   */
  heartbeatStaleThresholdMs?: number;
}

export interface ExpiredLockEntry {
  lane: SchedulerLane;
  taskId: number;
  jobName: string | null;
  startedAt: string | null;
  leaseExpiresAt: string | null;
  lastOutputAt: string | null;
  ageMs: number;
  reclaimable: boolean;
}

export interface StaleHeartbeatEntry {
  lane: SchedulerLane;
  lastHeartbeatAt: string | null;
  ageMs: number | null;
}

export interface CleanupAction {
  taskId: number;
  lane: SchedulerLane;
  previousStatus: string;
  newStatus: 'REPLAN_REQUIRED';
  reason: string;
  performedAt: string;
}

// ---------------------------------------------------------------------------
// History types
// ---------------------------------------------------------------------------

/** One row appended to stale_cleanup_history.json per cleanup run. */
export interface CleanupHistoryEntry {
  timestamp: string;
  expiredLockCount: number;
  staleHeartbeatCount: number;
  tasksReclaimed: number;
}

export interface CleanupHistory {
  version: '1.0';
  /** Most-recent entry first. Capped at MAX_HISTORY_ENTRIES. */
  entries: CleanupHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Trend types
// ---------------------------------------------------------------------------

/** Which stability concern this signal represents. */
export type TrendLabel = 'worker_unstable' | 'scheduler_issue' | 'crash_rate_up';

export interface TrendSignal {
  /** Machine-readable label */
  label: TrendLabel;
  /** Human-readable explanation */
  description: string;
  /** Average metric value over the recent half of the analysis window */
  recentAvg: number;
  /** Average metric value over the older half of the analysis window */
  olderAvg: number;
  /** Total entries used for this analysis */
  windowSize: number;
}

export interface CleanupTrendReport {
  analyzedAt: string;
  /** Number of history entries used for the analysis */
  entriesAnalyzed: number;
  /** Whether there were enough entries to run trend detection (min 4) */
  sufficientData: boolean;
  /** Rising trend signals detected (empty when sufficientData=false) */
  signals: TrendSignal[];
  /** True if at least one rising trend was detected */
  hasSignals: boolean;
}

export interface StaleCleanupReport {
  /** ISO timestamp of when the scan ran */
  generatedAt: string;
  dryRun: boolean;
  schedulerEnabled: boolean;
  /** Threshold used for lane lock expiry */
  leaseDurationMs: number;
  /** Threshold used for heartbeat staleness */
  heartbeatStaleThresholdMs: number;

  /** Expired lane locks (RUNNING task with overdue lease) */
  expiredLocks: ExpiredLockEntry[];

  /** Stale lane heartbeats (scheduler process may be dead) */
  staleHeartbeats: StaleHeartbeatEntry[];

  /** Total RUNNING tasks scanned */
  runningTasksScanned: number;

  /** Actions taken (empty when dryRun=true) */
  actionsPerformed: CleanupAction[];

  /** Summary counts */
  summary: {
    expiredLockCount: number;
    staleHeartbeatCount: number;
    tasksReclaimed: number;
    skippedBecauseSchedulerDisabled: boolean;
    skippedBecauseDryRun: boolean;
  };

  /** Trend analysis based on cleanup history */
  trends: CleanupTrendReport;

  /**
   * Inline system health summary derived from trend signals.
   * Mirrors the output of systemHealth.computeSystemHealth() without
   * creating a circular import dependency.
   */
  systemHealthStatus: {
    status: 'healthy' | 'degraded' | 'critical';
    hasSignals: boolean;
    signalLabels: TrendLabel[];
  };

  /**
   * Guard warnings emitted during this cleanup run.
   * Captured from systemHealthGuard in-memory buffer.
   * Empty array when system is healthy.
   */
  guardWarnings: Array<{
    guard: string;
    warningLevel: string;
    reason: string;
    signalLabels: string[];
    recordedAt: string;
  }>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_LEASE_DURATION_MS = 30 * 60_000;    // 30 minutes
const DEFAULT_HEARTBEAT_STALE_MS = 10 * 60_000;   // 10 minutes
const MAX_HISTORY_ENTRIES = 100;
const TREND_WINDOW = 10;                           // analyse last N entries
const MIN_ENTRIES_FOR_TREND = 4;                   // need at least 4 to split into two halves

// ---------------------------------------------------------------------------
// Core detection logic
// ---------------------------------------------------------------------------

function detectExpiredLocks(
  tasks: TaskRecord[],
  state: SchedulerState,
  leaseDurationMs: number,
): ExpiredLockEntry[] {
  const now = Date.now();
  const runningTasks = tasks.filter((t) => t.status === 'RUNNING');
  const expired: ExpiredLockEntry[] = [];

  for (const task of runningTasks) {
    const lane: SchedulerLane = task.lane ?? 'L-ONDEMAND';
    // Anchor the lease to the most recent output timestamp, fallback to updatedAt
    const anchor = task.lastOutputAt ?? task.updatedAt ?? null;
    if (!anchor) continue;

    const anchorMs = Date.parse(anchor);
    if (!Number.isFinite(anchorMs)) continue;

    const ageMs = now - anchorMs;
    if (ageMs <= leaseDurationMs) continue;   // lease still valid

    const leaseExpiresAt = new Date(anchorMs + leaseDurationMs).toISOString();
    expired.push({
      lane,
      taskId: task.taskId,
      jobName: task.slug,
      startedAt: anchor,
      leaseExpiresAt,
      lastOutputAt: task.lastOutputAt,
      ageMs,
      // Safe to reclaim only when the lane heartbeat is also stale
      reclaimable: isLaneHeartbeatAgedOut(state, lane, leaseDurationMs),
    });
  }

  return expired;
}

function isLaneHeartbeatAgedOut(
  state: SchedulerState,
  lane: SchedulerLane,
  thresholdMs: number,
): boolean {
  const hb = state.laneHeartbeats?.[lane];
  if (!hb) return true; // No heartbeat → assume dead
  const ageMs = Date.now() - Date.parse(hb.lastHeartbeatAt);
  return Number.isFinite(ageMs) && ageMs > thresholdMs;
}

function detectStaleHeartbeats(
  state: SchedulerState,
  heartbeatStaleThresholdMs: number,
): StaleHeartbeatEntry[] {
  const now = Date.now();
  const stale: StaleHeartbeatEntry[] = [];

  for (const lane of SCHEDULER_LANES) {
    const hb = state.laneHeartbeats?.[lane];
    if (!hb) continue; // No heartbeat — clean start, not stale

    const ageMs = now - Date.parse(hb.lastHeartbeatAt);
    if (!Number.isFinite(ageMs) || ageMs <= heartbeatStaleThresholdMs) continue;

    stale.push({
      lane,
      lastHeartbeatAt: hb.lastHeartbeatAt,
      ageMs,
    });
  }

  return stale;
}

// ---------------------------------------------------------------------------
// Safe release
// ---------------------------------------------------------------------------

async function reclaimExpiredLocks(
  paths: RuntimePaths,
  index: { version: '1.0'; tasks: TaskRecord[] },
  expiredLocks: ExpiredLockEntry[],
): Promise<CleanupAction[]> {
  const actions: CleanupAction[] = [];
  const reclaimable = expiredLocks.filter((e) => e.reclaimable);
  if (reclaimable.length === 0) return actions;

  let mutated = false;
  for (const entry of reclaimable) {
    const task = index.tasks.find((t) => t.taskId === entry.taskId);
    if (!task || task.status !== 'RUNNING') continue;

    const performedAt = nowIso();
    task.status = 'REPLAN_REQUIRED';
    task.gateVerdict = 'WORKER_RUNTIME_FAILED';
    task.latestProgressSummary = `Auto-reclaimed by stale job cleanup (lease expired ${Math.round(entry.ageMs / 60_000)}m ago).`;
    task.lastOutputAt = performedAt;
    task.updatedAt = performedAt;

    actions.push({
      taskId: task.taskId,
      lane: entry.lane,
      previousStatus: 'RUNNING',
      newStatus: 'REPLAN_REQUIRED',
      reason: `Lease expired. Last output was ${Math.round(entry.ageMs / 60_000)} minutes ago.`,
      performedAt,
    });
    mutated = true;
  }

  if (mutated) {
    await saveTaskIndex(paths as Parameters<typeof saveTaskIndex>[0], index);
  }

  return actions;
}

// ---------------------------------------------------------------------------
// History — append + load
// ---------------------------------------------------------------------------

const HISTORY_FILE = 'stale_cleanup_history.json';

function defaultHistory(): CleanupHistory {
  return { version: '1.0', entries: [] };
}

/**
 * Load existing history from disk, gracefully returning empty history on any error.
 */
async function loadCleanupHistory(orchestratorRoot: string): Promise<CleanupHistory> {
  const histPath = nodePath.join(orchestratorRoot, HISTORY_FILE);
  try {
    const stored = await readJsonFile<Partial<CleanupHistory>>(histPath);
    return {
      version: '1.0',
      entries: Array.isArray(stored?.entries) ? stored.entries : [],
    };
  } catch {
    return defaultHistory();
  }
}

/**
 * Append one entry to stale_cleanup_history.json and return the updated history.
 * Caps the log at MAX_HISTORY_ENTRIES (oldest entries dropped).
 * Always writes — this is observability data, not operational state.
 */
export async function appendCleanupHistory(
  orchestratorRoot: string,
  entry: CleanupHistoryEntry,
): Promise<CleanupHistory> {
  const history = await loadCleanupHistory(orchestratorRoot);
  // Prepend (most-recent-first), then cap
  history.entries = [entry, ...history.entries].slice(0, MAX_HISTORY_ENTRIES);
  const histPath = nodePath.join(orchestratorRoot, HISTORY_FILE);
  await writeJsonFile(histPath, history);
  return history;
}

// ---------------------------------------------------------------------------
// Trend detection
// ---------------------------------------------------------------------------

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Detect whether a metric is trending upward by comparing two halves of a window.
 * Returns a TrendSignal when recentAvg > olderAvg AND recentAvg > 0.
 */
function detectRisingTrend(
  entries: CleanupHistoryEntry[],
  metricKey: keyof CleanupHistoryEntry,
  label: TrendLabel,
  description: string,
): TrendSignal | null {
  // entries is already sorted most-recent-first; take the window, then reverse for chronological
  const window = entries.slice(0, TREND_WINDOW).reverse();
  const half = Math.floor(window.length / 2);
  const olderHalf = window.slice(0, half).map((e) => e[metricKey] as number);
  const recentHalf = window.slice(half).map((e) => e[metricKey] as number);

  const olderAvg = avg(olderHalf);
  const recentAvg = avg(recentHalf);

  // Signal fires when the recent half is worse than the older half AND non-zero
  if (recentAvg > 0 && recentAvg > olderAvg) {
    return { label, description, recentAvg, olderAvg, windowSize: window.length };
  }
  return null;
}

/**
 * Analyse the cleanup history for rising trends.
 *
 * - expiredLockCount ↑  → worker_unstable  (workers crashing before lease expires)
 * - staleHeartbeatCount ↑ → scheduler_issue (scheduler process becoming unresponsive)
 * - tasksReclaimed ↑   → crash_rate_up    (forceful reclaims increasing)
 */
export function analyzeCleanupTrends(history: CleanupHistory): CleanupTrendReport {
  const analyzedAt = nowIso();
  const entries = history.entries;

  if (entries.length < MIN_ENTRIES_FOR_TREND) {
    return {
      analyzedAt,
      entriesAnalyzed: entries.length,
      sufficientData: false,
      signals: [],
      hasSignals: false,
    };
  }

  const candidates: Array<[keyof CleanupHistoryEntry, TrendLabel, string]> = [
    [
      'expiredLockCount',
      'worker_unstable',
      'Expired lock count is rising — workers may be crashing before releasing lane locks.',
    ],
    [
      'staleHeartbeatCount',
      'scheduler_issue',
      'Stale heartbeat count is rising — scheduler process may be becoming unresponsive.',
    ],
    [
      'tasksReclaimed',
      'crash_rate_up',
      'Task reclaim count is rising — worker crash rate appears to be increasing.',
    ],
  ];

  const signals: TrendSignal[] = [];
  for (const [key, label, description] of candidates) {
    const signal = detectRisingTrend(entries, key, label, description);
    if (signal) signals.push(signal);
  }

  return {
    analyzedAt,
    entriesAnalyzed: Math.min(entries.length, TREND_WINDOW),
    sufficientData: true,
    signals,
    hasSignals: signals.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

async function writeCleanupReport(
  orchestratorRoot: string,
  report: StaleCleanupReport,
): Promise<void> {
  const reportPath = nodePath.join(orchestratorRoot, 'stale_cleanup_report.json');
  await writeJsonFile(reportPath, report);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the stale job cleanup scan.
 *
 * @param options.dryRun                    When true (default), no state is mutated.
 * @param options.leaseDurationMs           Lease expiry window in milliseconds.
 * @param options.heartbeatStaleThresholdMs Heartbeat stale window in milliseconds.
 *
 * Always writes:
 *   - runtime/agent_orchestrator/stale_cleanup_report.json  (current run)
 *   - runtime/agent_orchestrator/stale_cleanup_history.json (running log)
 *
 * Returns the full report object for programmatic use.
 */
export async function runStaleJobCleanup(
  options: StaleCleanupOptions = {},
): Promise<StaleCleanupReport> {
  const dryRun = options.dryRun !== false; // defaults to true
  const profile = await loadProjectProfile();
  const { paths, state } = await loadSchedulerState(profile);
  const index = await loadTaskIndex(paths);

  const leaseDurationMs =
    options.leaseDurationMs ??
    (profile.worker_rules?.finalize_on_stale_output_minutes
      ? profile.worker_rules.finalize_on_stale_output_minutes * 60_000
      : DEFAULT_LEASE_DURATION_MS);

  const heartbeatStaleThresholdMs =
    options.heartbeatStaleThresholdMs ?? DEFAULT_HEARTBEAT_STALE_MS;

  const runningTasksScanned = index.tasks.filter((t) => t.status === 'RUNNING').length;

  const expiredLocks = detectExpiredLocks(index.tasks, state, leaseDurationMs);
  const staleHeartbeats = detectStaleHeartbeats(state, heartbeatStaleThresholdMs);

  let actionsPerformed: CleanupAction[] = [];
  const skippedBecauseSchedulerDisabled = !state.schedulerEnabled;
  const skippedBecauseDryRun = dryRun;

  if (!dryRun && state.schedulerEnabled) {
    actionsPerformed = await reclaimExpiredLocks(paths, index, expiredLocks);
  }

  // Append to history (always — observability data)
  const historyEntry: CleanupHistoryEntry = {
    timestamp: nowIso(),
    expiredLockCount: expiredLocks.length,
    staleHeartbeatCount: staleHeartbeats.length,
    tasksReclaimed: actionsPerformed.length,
  };
  const updatedHistory = await appendCleanupHistory(paths.orchestratorRoot, historyEntry);
  const trends = analyzeCleanupTrends(updatedHistory);

  // Inline health summary (avoids circular import with systemHealth.ts)
  const signalLabels = trends.signals.map((s) => s.label);
  const healthStatus =
    signalLabels.length === 0 ? 'healthy' : signalLabels.length === 1 ? 'degraded' : 'critical';

  const report: StaleCleanupReport = {
    generatedAt: nowIso(),
    dryRun,
    schedulerEnabled: state.schedulerEnabled,
    leaseDurationMs,
    heartbeatStaleThresholdMs,
    expiredLocks,
    staleHeartbeats,
    runningTasksScanned,
    actionsPerformed,
    summary: {
      expiredLockCount: expiredLocks.length,
      staleHeartbeatCount: staleHeartbeats.length,
      tasksReclaimed: actionsPerformed.length,
      skippedBecauseSchedulerDisabled,
      skippedBecauseDryRun,
    },
    trends,
    systemHealthStatus: {
      status: healthStatus,
      hasSignals: signalLabels.length > 0,
      signalLabels,
    },
    guardWarnings: [],
  };

  await writeCleanupReport(paths.orchestratorRoot, report);
  return report;
}

// ---------------------------------------------------------------------------
// Diagnostic helper — lane snapshot used by the UI / API
// ---------------------------------------------------------------------------

export interface CleanupDiagnosticSnapshot {
  generatedAt: string;
  laneLockFile: LaneLockFile;
  heartbeatFile: SchedulerHeartbeatFile;
  runningTaskCount: number;
}

/**
 * Return a read-only diagnostic snapshot of current lane / heartbeat state.
 * Does not write any files. Used by health-check APIs.
 */
export async function buildCleanupDiagnosticSnapshot(
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
  heartbeatStaleThresholdMs = DEFAULT_HEARTBEAT_STALE_MS,
): Promise<CleanupDiagnosticSnapshot> {
  const profile = await loadProjectProfile();
  const { paths, state } = await loadSchedulerState(profile);
  const index = await loadTaskIndex(paths);

  return {
    generatedAt: nowIso(),
    laneLockFile: buildLaneLockFile(
      index.tasks,
      state,
      state.schedulerEnabled,
      leaseDurationMs,
    ),
    heartbeatFile: buildSchedulerHeartbeatFile(
      state,
      index.tasks,
      heartbeatStaleThresholdMs,
    ),
    runningTaskCount: index.tasks.filter((t) => t.status === 'RUNNING').length,
  };
}
