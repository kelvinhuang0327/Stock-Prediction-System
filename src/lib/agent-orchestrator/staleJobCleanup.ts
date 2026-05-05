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
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_LEASE_DURATION_MS = 30 * 60_000;       // 30 minutes
const DEFAULT_HEARTBEAT_STALE_MS = 10 * 60_000;      // 10 minutes

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
 * @param options.dryRun                 When true (default), no state is mutated.
 * @param options.leaseDurationMs        Lease expiry window in milliseconds.
 * @param options.heartbeatStaleThresholdMs  Heartbeat stale window in milliseconds.
 *
 * Always writes `runtime/agent_orchestrator/stale_cleanup_report.json`.
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
