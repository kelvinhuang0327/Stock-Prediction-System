/**
 * laneGuard.ts — Per-lane mutual exclusion for the scheduler.
 *
 * Design:
 *   - Tasks without a lane field are treated as DEFAULT_LANE ('L-ONDEMAND').
 *   - Within the same lane, only one task may be RUNNING at a time.
 *   - Different lanes do NOT block each other.
 *   - A per-lane heartbeat is written to SchedulerState.laneHeartbeats on every
 *     tick so the stale-job cleaner (B-02) can detect dead lanes.
 *
 * Backwards compatibility:
 *   - Existing TaskRecords without a `lane` field are treated as 'L-ONDEMAND'.
 *   - Existing SchedulerState without `laneHeartbeats` is extended in-place.
 *   - profile.worker_rules.single_active_task = true still works: if the profile
 *     has single_active_task enabled but no lane is assigned, the guard falls
 *     back to global single-task behaviour (all tasks in L-ONDEMAND = same lane).
 */

import nodePath from 'node:path';
import { nowIso, writeJsonFile } from './common';
import type {
  LaneHeartbeat,
  SchedulerLane,
  SchedulerState,
  TaskRecord,
  TaskStatus,
} from './types';
import { DEFAULT_LANE, SCHEDULER_LANES } from './types';

// ---------------------------------------------------------------------------
// Lane resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the lane of a TaskRecord.
 * Returns DEFAULT_LANE for legacy records that have no lane field.
 */
export function resolveTaskLane(task: TaskRecord): SchedulerLane {
  return task.lane ?? DEFAULT_LANE;
}

// ---------------------------------------------------------------------------
// Lane lock query
// ---------------------------------------------------------------------------

export interface LaneLockResult {
  /** True when a RUNNING task in the same lane was found. */
  locked: boolean;
  /** The RUNNING task that is holding the lock, if any. */
  lockHolder: TaskRecord | null;
}

/**
 * Check whether the given lane is currently locked by a RUNNING task.
 *
 * @param tasks   All TaskRecord entries from the task index.
 * @param lane    The lane to check.
 */
export function checkLaneLock(tasks: TaskRecord[], lane: SchedulerLane): LaneLockResult {
  const RUNNING_STATUSES: TaskStatus[] = ['RUNNING'];
  const holder = tasks.find(
    (t) => RUNNING_STATUSES.includes(t.status) && resolveTaskLane(t) === lane,
  ) ?? null;
  return { locked: holder !== null, lockHolder: holder };
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

/**
 * Write a heartbeat for the given lane into the SchedulerState.
 * The state object is mutated in-place — caller must persist it afterwards.
 *
 * @param state         The scheduler state (mutated).
 * @param lane          The lane that ticked.
 * @param runningTaskId The taskId currently RUNNING in this lane, or null.
 */
export function writeLaneHeartbeat(
  state: SchedulerState,
  lane: SchedulerLane,
  runningTaskId: number | null,
): void {
  state.laneHeartbeats ??= {};
  state.laneHeartbeats[lane] = {
    lane,
    lastHeartbeatAt: nowIso(),
    runningTaskId,
  };
}

/**
 * Read the heartbeat for a specific lane.
 * Returns null when no heartbeat has been written yet.
 */
export function readLaneHeartbeat(
  state: SchedulerState,
  lane: SchedulerLane,
): LaneHeartbeat | null {
  return state.laneHeartbeats?.[lane] ?? null;
}

/**
 * Returns true if the lane heartbeat is older than `staleThresholdMs`.
 * A lane is considered "stale" when nothing has ticked it recently —
 * used by the stale-job cleaner (B-02) to detect dead scheduler processes.
 *
 * Returns false (not stale) when no heartbeat exists yet (clean start).
 */
export function isLaneHeartbeatStale(
  state: SchedulerState,
  lane: SchedulerLane,
  staleThresholdMs: number,
): boolean {
  const hb = readLaneHeartbeat(state, lane);
  if (!hb) return false; // no heartbeat yet → not stale (clean start)
  const ageMs = Date.now() - Date.parse(hb.lastHeartbeatAt);
  return Number.isFinite(ageMs) && ageMs > staleThresholdMs;
}

// ---------------------------------------------------------------------------
// Composite lane-aware guard (replaces handleSingleActiveTask logic)
// ---------------------------------------------------------------------------

export interface LaneGuardResult {
  /** 'allowed' — no running task in this lane; caller may proceed. */
  decision: 'allowed' | 'blocked' | 'stale_finalize';
  /** Lane that was checked. */
  lane: SchedulerLane;
  /** The blocking task (when decision = 'blocked' or 'stale_finalize'). */
  lockHolder: TaskRecord | null;
  /** Whether the lock holder is considered stale (output too old). */
  isStale: boolean;
}

/**
 * Run the lane-based guard for a given lane.
 *
 * Replaces the logic previously embedded in `handleSingleActiveTask`:
 * - If no RUNNING task in the lane → `allowed`
 * - If a RUNNING task exists and is NOT stale → `blocked`
 * - If a RUNNING task exists and IS stale → `stale_finalize` (caller must finalize it)
 *
 * @param tasks                 All TaskRecords.
 * @param lane                  The lane the current tick wants to claim.
 * @param staleOutputThresholdMs Age beyond which a RUNNING task's lastOutputAt is stale.
 */
export function evaluateLaneGuard(
  tasks: TaskRecord[],
  lane: SchedulerLane,
  staleOutputThresholdMs: number,
): LaneGuardResult {
  const { locked, lockHolder } = checkLaneLock(tasks, lane);

  if (!locked || !lockHolder) {
    return { decision: 'allowed', lane, lockHolder: null, isStale: false };
  }

  const isStale = isTaskOutputStale(lockHolder, staleOutputThresholdMs);
  return {
    decision: isStale ? 'stale_finalize' : 'blocked',
    lane,
    lockHolder,
    isStale,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTaskOutputStale(task: TaskRecord, thresholdMs: number): boolean {
  if (!task.lastOutputAt) return false;
  const ageMs = Date.now() - Date.parse(task.lastOutputAt);
  return Number.isFinite(ageMs) && ageMs > thresholdMs;
}

// ---------------------------------------------------------------------------
// Lane summary (for observability / API)
// ---------------------------------------------------------------------------

export interface LaneSummary {
  lane: SchedulerLane;
  runningTask: { taskId: number; title?: string; lastOutputAt: string | null } | null;
  lastHeartbeatAt: string | null;
  heartbeatAgeMs: number | null;
}

/**
 * Return a snapshot of all lane states for use in health/status APIs.
 */
export function buildLaneSummaries(
  tasks: TaskRecord[],
  state: SchedulerState,
  lanes: SchedulerLane[],
): LaneSummary[] {
  return lanes.map((lane) => {
    const { lockHolder } = checkLaneLock(tasks, lane);
    const hb = readLaneHeartbeat(state, lane);
    const lastHeartbeatAt = hb?.lastHeartbeatAt ?? null;
    const heartbeatAgeMs = lastHeartbeatAt
      ? Date.now() - Date.parse(lastHeartbeatAt)
      : null;
    return {
      lane,
      runningTask: lockHolder
        ? { taskId: lockHolder.taskId, title: lockHolder.title, lastOutputAt: lockHolder.lastOutputAt }
        : null,
      lastHeartbeatAt,
      heartbeatAgeMs,
    };
  });
}

// ---------------------------------------------------------------------------
// Lane Lock File (runtime/agent_orchestrator/lane_locks.json)
// ---------------------------------------------------------------------------

export interface LaneLockEntry {
  locked: boolean;
  taskId: number | null;
  /** Derived from TaskRecord.slug — human-readable job identifier. */
  jobName: string | null;
  ownerRunner: 'worker' | null;
  startedAt: string | null;
  heartbeatAt: string | null;
  leaseExpiresAt: string | null;
  status: 'running' | 'idle';
}

export interface LaneLockFile {
  generatedAt: string;
  schedulerEnabled: boolean;
  lanes: Partial<Record<SchedulerLane, LaneLockEntry>>;
}

/**
 * Build the in-memory representation of lane_locks.json.
 *
 * @param tasks           All TaskRecords (used to find RUNNING tasks).
 * @param state           Current SchedulerState (used for laneHeartbeats).
 * @param schedulerEnabled Whether the scheduler is currently enabled.
 * @param leaseDurationMs  Duration (ms) before a lock is considered expired.
 */
export function buildLaneLockFile(
  tasks: TaskRecord[],
  state: SchedulerState,
  schedulerEnabled: boolean,
  leaseDurationMs: number,
): LaneLockFile {
  const laneEntries: Partial<Record<SchedulerLane, LaneLockEntry>> = {};

  for (const lane of SCHEDULER_LANES) {
    const { lockHolder } = checkLaneLock(tasks, lane);
    const hb = readLaneHeartbeat(state, lane);

    if (lockHolder) {
      const startedAt = lockHolder.lastOutputAt ?? lockHolder.updatedAt;
      const leaseExpiresAt = startedAt
        ? new Date(Date.parse(startedAt) + leaseDurationMs).toISOString()
        : null;

      laneEntries[lane] = {
        locked: true,
        taskId: lockHolder.taskId,
        jobName: lockHolder.slug,
        ownerRunner: 'worker',
        startedAt,
        heartbeatAt: hb?.lastHeartbeatAt ?? null,
        leaseExpiresAt,
        status: 'running',
      };
    } else {
      laneEntries[lane] = {
        locked: false,
        taskId: null,
        jobName: null,
        ownerRunner: null,
        startedAt: null,
        heartbeatAt: hb?.lastHeartbeatAt ?? null,
        leaseExpiresAt: null,
        status: 'idle',
      };
    }
  }

  return { generatedAt: nowIso(), schedulerEnabled, lanes: laneEntries };
}

/**
 * Persist lane_locks.json to disk.
 * No-op if schedulerEnabled=false — still writes to reflect disabled status.
 * Writing is idempotent (uses atomic rename via writeJsonFile).
 */
export async function writeLaneLockFile(
  orchestratorRoot: string,
  tasks: TaskRecord[],
  state: SchedulerState,
  schedulerEnabled: boolean,
  leaseDurationMs: number,
): Promise<void> {
  const filePath = nodePath.join(orchestratorRoot, 'lane_locks.json');
  const content = buildLaneLockFile(tasks, state, schedulerEnabled, leaseDurationMs);
  await writeJsonFile(filePath, content);
}

// ---------------------------------------------------------------------------
// Scheduler Heartbeat File (runtime/agent_orchestrator/scheduler_heartbeat.json)
// ---------------------------------------------------------------------------

export type SchedulerHeartbeatStatus = 'disabled' | 'healthy' | 'stale' | 'degraded';

export interface SchedulerHeartbeatFile {
  schedulerEnabled: boolean;
  lastHeartbeatAt: string;
  lastTickAt: string | null;
  activeLanes: SchedulerLane[];
  staleLanes: SchedulerLane[];
  status: SchedulerHeartbeatStatus;
}

/**
 * Compute the content of scheduler_heartbeat.json without writing to disk.
 *
 * Status rules:
 *   disabled  — schedulerEnabled = false
 *   healthy   — enabled, no stale lanes
 *   stale     — enabled, all heartbeats stale (nothing is running)
 *   degraded  — enabled, some lanes stale while others are active
 *
 * @param state             Current SchedulerState.
 * @param tasks             All TaskRecords (used to find active lanes).
 * @param staleThresholdMs  Age after which a lane heartbeat is considered stale (default 5 min).
 */
export function buildSchedulerHeartbeatFile(
  state: SchedulerState,
  tasks: TaskRecord[],
  staleThresholdMs = 5 * 60_000,
): SchedulerHeartbeatFile {
  const activeLanes = SCHEDULER_LANES.filter((lane) => checkLaneLock(tasks, lane).locked);
  const staleLanes = SCHEDULER_LANES.filter((lane) => isLaneHeartbeatStale(state, lane, staleThresholdMs));

  let status: SchedulerHeartbeatStatus;
  if (!state.schedulerEnabled) {
    status = 'disabled';
  } else if (staleLanes.length > 0 && activeLanes.length > 0) {
    status = 'degraded';
  } else if (staleLanes.length > 0) {
    status = 'stale';
  } else {
    status = 'healthy';
  }

  const tickCandidates = [state.lastPlannerRunAt, state.lastWorkerRunAt].filter(Boolean) as string[];
  const lastTickAt = tickCandidates.length > 0
    ? [...tickCandidates].sort().at(-1)!
    : null;

  return {
    schedulerEnabled: state.schedulerEnabled,
    lastHeartbeatAt: nowIso(),
    lastTickAt,
    activeLanes,
    staleLanes,
    status,
  };
}

/**
 * Persist scheduler_heartbeat.json to disk.
 * Always safe to call — writes current status including 'disabled'.
 */
export async function writeSchedulerHeartbeatFile(
  orchestratorRoot: string,
  state: SchedulerState,
  tasks: TaskRecord[],
  staleThresholdMs = 5 * 60_000,
): Promise<void> {
  const filePath = nodePath.join(orchestratorRoot, 'scheduler_heartbeat.json');
  const content = buildSchedulerHeartbeatFile(state, tasks, staleThresholdMs);
  await writeJsonFile(filePath, content);
}
