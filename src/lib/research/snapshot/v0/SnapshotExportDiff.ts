/**
 * P52 — Axis A Controlled Research Snapshot Log Export Diff v0
 *
 * Compares two SnapshotLogExport objects and returns a diff report
 * containing added, removed, and unchanged records by identity key
 * (symbol + loggedAt).
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem writes
 *   - Deterministic when fixedDiffedAt is provided
 *   - JSON-safe — all fields are primitives, arrays, or plain objects
 *   - No scoring, no recommendation, no investment advice, no forbidden fields
 *   - Does not mutate either input export
 *   - Order preservation: added / unchanged follow after.records order;
 *     removed follows before.records order
 *   - Identity key: symbol + "|" + loggedAt
 *
 * DISCLAIMER: Research snapshot diff only. Does not constitute investment
 * advice. entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 * Axis C C6 remains locked.
 *
 * Authorization:
 *   YES design paper simulation dry-run result artifact golden fixture for P48
 */

import type { SnapshotLogRecord } from "./SnapshotLogWriter";
import type { SnapshotLogExport } from "./SnapshotLogExporter";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SNAPSHOT_EXPORT_DIFF_VERSION =
  "p52-axis-a-snapshot-export-diff-v0" as const;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Diff report produced by comparing two SnapshotLogExport objects.
 *
 * All record arrays are readonly — the diff report is immutable after
 * construction. Counts always equal the length of their corresponding arrays.
 *
 * Order guarantees:
 *   - added    preserves the order of after.records
 *   - removed  preserves the order of before.records
 *   - unchanged preserves the order of after.records
 */
export type SnapshotExportDiffReport = {
  /** Identifies this diff implementation */
  readonly diffVersion: typeof SNAPSHOT_EXPORT_DIFF_VERSION;
  /** ISO timestamp when this diff was produced */
  readonly diffedAt: string;
  /** Records present in after but not in before (new records) */
  readonly added: readonly SnapshotLogRecord[];
  /** Records present in before but not in after (deleted records) */
  readonly removed: readonly SnapshotLogRecord[];
  /** Records present in both before and after (identity key matched) */
  readonly unchanged: readonly SnapshotLogRecord[];
  /** Number of added records — always equals added.length */
  readonly addedCount: number;
  /** Number of removed records — always equals removed.length */
  readonly removedCount: number;
  /** Number of unchanged records — always equals unchanged.length */
  readonly unchangedCount: number;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Build the identity key for a SnapshotLogRecord.
 * Uses "|" as separator — a character that cannot appear in ISO timestamps or
 * standard Taiwan stock symbol strings, preventing key collision.
 */
function recordKey(record: SnapshotLogRecord): string {
  return `${record.symbol}|${record.loggedAt}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compare two SnapshotLogExport objects and return a SnapshotExportDiffReport.
 *
 * Algorithm (O(n + m) where n = |before.records|, m = |after.records|):
 *   1. Build a Set of identity keys for before.records.
 *   2. Build a Set of identity keys for after.records.
 *   3. Walk after.records in order:
 *      - key in beforeKeys → unchanged
 *      - key not in beforeKeys → added
 *   4. Walk before.records in order:
 *      - key not in afterKeys → removed
 *
 * Neither input is mutated — both before and after remain unchanged.
 *
 * @param before         The earlier SnapshotLogExport (baseline).
 * @param after          The later SnapshotLogExport (current state).
 * @param fixedDiffedAt  Optional ISO timestamp for deterministic testing.
 *                       If omitted, uses new Date().toISOString().
 */
export function diffSnapshotLogExports(
  before: SnapshotLogExport,
  after: SnapshotLogExport,
  fixedDiffedAt?: string,
): SnapshotExportDiffReport {
  const diffedAt = fixedDiffedAt ?? new Date().toISOString();

  // Build identity-key sets for O(1) membership tests
  const beforeKeys = new Set<string>(before.records.map(recordKey));
  const afterKeys = new Set<string>(after.records.map(recordKey));

  // Walk after.records → added or unchanged (preserves after order)
  const added: SnapshotLogRecord[] = [];
  const unchanged: SnapshotLogRecord[] = [];
  for (const record of after.records) {
    if (beforeKeys.has(recordKey(record))) {
      unchanged.push(record);
    } else {
      added.push(record);
    }
  }

  // Walk before.records → removed (preserves before order)
  const removed: SnapshotLogRecord[] = [];
  for (const record of before.records) {
    if (!afterKeys.has(recordKey(record))) {
      removed.push(record);
    }
  }

  return {
    diffVersion: SNAPSHOT_EXPORT_DIFF_VERSION,
    diffedAt,
    added: Object.freeze([...added]),
    removed: Object.freeze([...removed]),
    unchanged: Object.freeze([...unchanged]),
    addedCount: added.length,
    removedCount: removed.length,
    unchangedCount: unchanged.length,
  };
}
