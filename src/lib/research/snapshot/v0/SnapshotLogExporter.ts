/**
 * P49 — Axis A Controlled Research Snapshot Log Exporter v0
 *
 * Converts SnapshotLogRecord / SnapshotLogCollector output to a plain,
 * JSON-safe export object for audit logging and display.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem writes
 *   - Deterministic when fixedExportedAt is provided
 *   - JSON-safe — all fields are primitives, arrays of primitives, or plain objects
 *   - No scoring, no recommendation, no investment advice, no forbidden fields
 *   - records array and symbols/statuses arrays are frozen
 *
 * DISCLAIMER: Research snapshot log exporter only. Does not constitute
 * investment advice. entersAlphaScore = false. ALWAYS. paperOnly = true.
 * dryRun = true. No profit, return, win-rate, edge, or investment performance
 * claims are made. Axis C C6 remains locked.
 */

import type { SnapshotLogRecord } from "./SnapshotLogWriter";
import type { SnapshotLogCollector } from "./SnapshotLogCollector";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SNAPSHOT_LOG_EXPORTER_VERSION =
  "p49-axis-a-snapshot-log-exporter-v0";

// ─── SnapshotLogExport ────────────────────────────────────────────────────────

/**
 * Plain, JSON-safe export envelope produced from a set of SnapshotLogRecord
 * objects.
 *
 * All fields are readonly primitives, readonly primitive arrays, or a plain
 * governance summary object — safe to JSON.stringify without custom replacers.
 */
export type SnapshotLogExport = {
  /** Identifies this exporter implementation */
  readonly exporterVersion: typeof SNAPSHOT_LOG_EXPORTER_VERSION;
  /** ISO timestamp when this export was produced */
  readonly exportedAt: string;
  /** Total number of records in this export */
  readonly totalRecords: number;
  /** Frozen copy of the records included in this export */
  readonly records: readonly SnapshotLogRecord[];
  /** Deduplicated, sorted list of all symbol values across records */
  readonly symbols: readonly string[];
  /** Deduplicated, sorted list of all researchReadinessStatus values across records */
  readonly statuses: readonly string[];
  /** Governance summary computed across all records in this export */
  readonly governanceSummary: {
    readonly allEnterAlphaScoreFalse: boolean;
    readonly allPaperOnly: boolean;
    readonly allDryRun: boolean;
    readonly allNotInvestmentRecommendation: boolean;
  };
};

// ─── Internal helper ──────────────────────────────────────────────────────────

function buildExport(
  records: readonly SnapshotLogRecord[],
  fixedExportedAt?: string
): SnapshotLogExport {
  const frozenRecords = Object.freeze([...records]);
  const exportedAt = fixedExportedAt ?? new Date().toISOString();

  const symbols = Object.freeze(
    [...new Set(frozenRecords.map((r) => r.symbol))].sort()
  );
  const statuses = Object.freeze(
    [...new Set(frozenRecords.map((r) => r.researchReadinessStatus))].sort()
  );

  const governanceSummary = {
    allEnterAlphaScoreFalse: frozenRecords.every(
      (r) => r.entersAlphaScore === false
    ),
    allPaperOnly: frozenRecords.every((r) => r.paperOnly === true),
    allDryRun: frozenRecords.every((r) => r.dryRun === true),
    allNotInvestmentRecommendation: frozenRecords.every(
      (r) => r.notInvestmentRecommendation === true
    ),
  };

  return {
    exporterVersion: SNAPSHOT_LOG_EXPORTER_VERSION,
    exportedAt,
    totalRecords: frozenRecords.length,
    records: frozenRecords,
    symbols,
    statuses,
    governanceSummary,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Export a single SnapshotLogRecord as a SnapshotLogExport envelope.
 *
 * @param record         The record to export.
 * @param fixedExportedAt Optional ISO timestamp to use as exportedAt (for
 *                        deterministic testing). If omitted, uses Date.now().
 */
export function exportSnapshotLogRecord(
  record: SnapshotLogRecord,
  fixedExportedAt?: string
): SnapshotLogExport {
  return buildExport([record], fixedExportedAt);
}

/**
 * Export a readonly list of SnapshotLogRecord objects as a SnapshotLogExport.
 *
 * @param records         The records to export (may be empty).
 * @param fixedExportedAt Optional ISO timestamp for deterministic testing.
 */
export function exportSnapshotLogRecords(
  records: readonly SnapshotLogRecord[],
  fixedExportedAt?: string
): SnapshotLogExport {
  return buildExport(records, fixedExportedAt);
}

/**
 * Export all records in a SnapshotLogCollector as a SnapshotLogExport.
 *
 * Calls collector.getAll() and delegates to exportSnapshotLogRecords.
 *
 * @param collector       The collector whose records to export.
 * @param fixedExportedAt Optional ISO timestamp for deterministic testing.
 */
export function exportSnapshotLogCollector(
  collector: SnapshotLogCollector,
  fixedExportedAt?: string
): SnapshotLogExport {
  return buildExport(collector.getAll(), fixedExportedAt);
}
