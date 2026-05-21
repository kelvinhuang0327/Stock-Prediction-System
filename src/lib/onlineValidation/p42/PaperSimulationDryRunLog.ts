/**
 * P42 — Paper Simulation Dry-run Log
 *
 * Immutable append-only stub log entries.
 * No PnL, ROI, win-rate, alphaScore, or recommendation in log entries.
 *
 * Authorization:
 *   YES design paper simulation dry-run lifecycle for P42
 */

import type { P42LifecycleState } from "./PaperSimulationDryRunLifecycle";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAPER_SIMULATION_DRY_RUN_LOG_VERSION =
  "p42-paper-simulation-dry-run-log-v1" as const;

export type P42LogEventType =
  | "LIFECYCLE_CREATED"
  | "TRANSITION_REQUESTED"
  | "TRANSITION_COMPLETED"
  | "TRANSITION_REJECTED"
  | "LIFECYCLE_CANCELLED"
  | "VALIDATION_PASSED"
  | "BOUNDARY_CHECK_PASSED";

export const P42_LOG_EVENT_TYPES: readonly P42LogEventType[] = [
  "LIFECYCLE_CREATED",
  "TRANSITION_REQUESTED",
  "TRANSITION_COMPLETED",
  "TRANSITION_REJECTED",
  "LIFECYCLE_CANCELLED",
  "VALIDATION_PASSED",
  "BOUNDARY_CHECK_PASSED",
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaperSimulationDryRunLogEntry {
  readonly entryId: string;
  readonly eventType: P42LogEventType;
  readonly message: string;
  readonly createdAt: string;
  readonly lifecycleId: string;
  readonly phase: "P42";
  readonly stubOnly: true;
  readonly noExecution: true;
  readonly fromState?: P42LifecycleState;
  readonly toState?: P42LifecycleState;
}

export interface CreateDryRunLogEntryParams {
  readonly eventType: P42LogEventType;
  readonly message: string;
  readonly createdAt: string;
  readonly lifecycleId: string;
  readonly fromState?: P42LifecycleState;
  readonly toState?: P42LifecycleState;
}

export type PaperSimulationDryRunLog = readonly PaperSimulationDryRunLogEntry[];

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Create an immutable dry-run log entry.
 * Throws [P42] LogBoundaryViolation on unknown eventType or missing required fields.
 * No PnL, ROI, win-rate, alphaScore, or recommendation fields are accepted.
 */
export function createDryRunLogEntry(
  params: CreateDryRunLogEntryParams
): PaperSimulationDryRunLogEntry {
  const { eventType, message, createdAt, lifecycleId, fromState, toState } = params;

  if (!eventType || !(P42_LOG_EVENT_TYPES as readonly string[]).includes(eventType)) {
    throw new Error(`[P42] LogBoundaryViolation: unknown eventType ${eventType}`);
  }
  if (!message) {
    throw new Error("[P42] LogBoundaryViolation: message is required");
  }
  if (!createdAt) {
    throw new Error("[P42] LogBoundaryViolation: createdAt is required");
  }
  if (!lifecycleId) {
    throw new Error("[P42] LogBoundaryViolation: lifecycleId is required");
  }

  const entryId = `p42-log-${lifecycleId}-${eventType}-${createdAt}`;

  const entry: PaperSimulationDryRunLogEntry = Object.freeze({
    entryId,
    eventType,
    message,
    createdAt,
    lifecycleId,
    phase: "P42" as const,
    stubOnly: true as const,
    noExecution: true as const,
    ...(fromState !== undefined ? { fromState } : {}),
    ...(toState !== undefined ? { toState } : {}),
  });

  return entry;
}

/**
 * Append a log entry to a log. Returns a new log (immutable, pure function).
 */
export function appendLogEntry(
  log: PaperSimulationDryRunLog,
  entry: PaperSimulationDryRunLogEntry
): PaperSimulationDryRunLog {
  return Object.freeze([...log, entry]);
}

/**
 * Create an empty immutable log.
 */
export function createEmptyLog(): PaperSimulationDryRunLog {
  return Object.freeze([]) as PaperSimulationDryRunLog;
}
