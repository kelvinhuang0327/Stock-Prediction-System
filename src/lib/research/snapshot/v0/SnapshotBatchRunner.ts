/**
 * P48 — Axis A Controlled Research Snapshot Batch Runner v0
 *
 * Accepts a list of ControlledResearchSnapshot objects, runs the full
 * P42→P46 pipeline for each (Emit → LogWrite → Collect), and returns
 * a SnapshotBatchRunResult containing all generated log records and a
 * pre-populated SnapshotLogCollector.
 *
 * Pipeline executed per snapshot:
 *   P44 emitSnapshot()          → EmitResult { readout, formatted }
 *   P45 serializeEmitResult()   → SnapshotLogRecord
 *   P46 createSnapshotLogCollector  seeds the final collector
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem writes
 *   - Deterministic — same inputs + fixed timestamps always produce same output
 *   - In-memory only — records are lost when the result is garbage-collected
 *   - No scoring, no recommendation, no investment advice
 *   - No alpha score access — entersAlphaScore = false ALWAYS
 *   - No Axis C C6 logic
 *   - Empty input is valid — returns zero records, empty collector
 *
 * DISCLAIMER: Research snapshot batch runner only. Does not constitute
 * investment advice. entersAlphaScore = false. ALWAYS. paperOnly = true.
 * dryRun = true. No profit, return, win-rate, edge, or investment performance
 * claims are made. Axis C C6 remains locked.
 */

import type { ControlledResearchSnapshot } from "../../ControlledResearchSnapshot";
import { emitSnapshot } from "./SnapshotEmitter";
import { serializeEmitResult, type SnapshotLogRecord } from "./SnapshotLogWriter";
import {
  createSnapshotLogCollector,
  type SnapshotLogCollector,
} from "./SnapshotLogCollector";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SNAPSHOT_BATCH_RUNNER_VERSION =
  "p48-axis-a-snapshot-batch-runner-v0";

// ─── Input / Output types ─────────────────────────────────────────────────────

/**
 * Input to runSnapshotBatch().
 *
 * @property snapshots       List of ControlledResearchSnapshot objects to process.
 *                           May be empty — returns zero records in that case.
 * @property fixedReadoutAt  Optional ISO timestamp injected into emitSnapshot() as
 *                           readoutAt. When omitted, each call uses new Date().
 * @property fixedLoggedAt   Optional ISO timestamp injected into serializeEmitResult()
 *                           as loggedAt. When omitted, each call uses new Date().
 */
export type SnapshotBatchRunInput = {
  readonly snapshots: readonly ControlledResearchSnapshot[];
  readonly fixedReadoutAt?: string;
  readonly fixedLoggedAt?: string;
};

/**
 * Result of runSnapshotBatch().
 *
 * GOVERNANCE INVARIANTS (propagated from P42–P46):
 *   entersAlphaScore = false        — never mutates scoring formula
 *   notInvestmentRecommendation = true — NOT buy/sell/hold semantics
 *   paperOnly = true                — paper simulation surface only
 *   dryRun = true                   — no real execution, no DB apply
 */
export type SnapshotBatchRunResult = {
  /** Identifies this batch runner implementation */
  readonly runnerVersion: typeof SNAPSHOT_BATCH_RUNNER_VERSION;
  /** Number of snapshots processed — equals input.snapshots.length */
  readonly totalSnapshots: number;
  /** Pre-populated collector containing all generated log records */
  readonly collector: SnapshotLogCollector;
  /** Frozen array of all generated SnapshotLogRecord objects in input order */
  readonly records: readonly SnapshotLogRecord[];
};

// ─── Batch runner ─────────────────────────────────────────────────────────────

/**
 * Run the full P44→P45→P46 pipeline for every snapshot in the input list.
 *
 * Produces one SnapshotLogRecord per snapshot (in input order).
 * Records are collected into a SnapshotLogCollector and also returned as a
 * frozen array for direct inspection.
 *
 * Empty input is valid — returns zero records and an empty collector.
 *
 * DISCLAIMER: Research snapshot batch runner only. Not investment advice.
 * entersAlphaScore = false. ALWAYS.
 */
export function runSnapshotBatch(
  input: SnapshotBatchRunInput
): SnapshotBatchRunResult {
  const records: SnapshotLogRecord[] = [];

  for (const snapshot of input.snapshots) {
    const emitResult = emitSnapshot(snapshot, input.fixedReadoutAt);
    const record = serializeEmitResult(emitResult, input.fixedLoggedAt);
    records.push(record);
  }

  const frozenRecords: readonly SnapshotLogRecord[] = Object.freeze([
    ...records,
  ]);
  const collector = createSnapshotLogCollector(frozenRecords);

  return {
    runnerVersion: SNAPSHOT_BATCH_RUNNER_VERSION,
    totalSnapshots: input.snapshots.length,
    collector,
    records: frozenRecords,
  };
}
