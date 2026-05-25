/**
 * P50 — Axis A Controlled Research Snapshot Export Filter v0
 *
 * Filters a SnapshotLogExport by symbol, readiness status, and loggedAt
 * date/time range. Returns a new SnapshotLogExport with recomputed
 * totalRecords, symbols, statuses, and governanceSummary.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem writes
 *   - Deterministic — same input + criteria always produces same output
 *   - JSON-safe — all fields are primitives, arrays of primitives, or plain objects
 *   - No scoring, no recommendation, no investment advice, no forbidden fields
 *   - Multiple criteria are ANDed (all must match)
 *   - records / symbols / statuses arrays in the result are frozen
 *   - exporterVersion and exportedAt are preserved from the source export
 *
 * DISCLAIMER: Research snapshot export filter only. Does not constitute
 * investment advice. entersAlphaScore = false. ALWAYS. paperOnly = true.
 * dryRun = true. No profit, return, win-rate, edge, or investment performance
 * claims are made. Axis C C6 remains locked.
 */

import type { SnapshotLogRecord } from "./SnapshotLogWriter";
import type { SnapshotLogExport } from "./SnapshotLogExporter";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SNAPSHOT_EXPORT_FILTER_VERSION =
  "p50-axis-a-snapshot-export-filter-v0";

// ─── SnapshotExportFilterCriteria ─────────────────────────────────────────────

/**
 * Criteria for filtering a SnapshotLogExport.
 *
 * All fields are optional — omitted fields apply no constraint.
 * When multiple fields are specified they are ANDed (a record must satisfy all).
 *
 * loggedAtFrom / loggedAtTo perform lexicographic ISO string comparison.
 * This is correct for full ISO timestamps (YYYY-MM-DDTHH:mm:ss.sssZ) where
 * string order matches chronological order.
 */
export type SnapshotExportFilterCriteria = {
  /** Keep only records whose symbol exactly equals this value */
  readonly symbol?: string;
  /** Keep only records whose researchReadinessStatus exactly equals this value */
  readonly status?: string;
  /** Keep only records where loggedAt >= loggedAtFrom (ISO string, inclusive) */
  readonly loggedAtFrom?: string;
  /** Keep only records where loggedAt <= loggedAtTo (ISO string, inclusive) */
  readonly loggedAtTo?: string;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Filters a SnapshotLogExport by the provided criteria.
 *
 * Returns a new SnapshotLogExport containing only the records that satisfy
 * every specified criterion. The following fields are recomputed from the
 * filtered record set:
 *   - totalRecords
 *   - records  (frozen)
 *   - symbols  (deduplicated, sorted, frozen)
 *   - statuses (deduplicated, sorted, frozen)
 *   - governanceSummary
 *
 * The following fields are preserved from the source export unchanged:
 *   - exporterVersion
 *   - exportedAt
 *
 * Pure function — deterministic, no side effects, no DB access, no filesystem
 * writes, no network calls.
 *
 * @param snapshotExport  A SnapshotLogExport produced by SnapshotLogExporter
 * @param criteria        Filter criteria; all fields optional (AND semantics)
 * @returns               A new SnapshotLogExport with only matching records
 */
export function filterSnapshotLogExport(
  snapshotExport: SnapshotLogExport,
  criteria: SnapshotExportFilterCriteria,
): SnapshotLogExport {
  let filtered: SnapshotLogRecord[] = [...snapshotExport.records];

  if (criteria.symbol !== undefined) {
    const sym = criteria.symbol;
    filtered = filtered.filter((r) => r.symbol === sym);
  }
  if (criteria.status !== undefined) {
    const st = criteria.status;
    filtered = filtered.filter((r) => r.researchReadinessStatus === st);
  }
  if (criteria.loggedAtFrom !== undefined) {
    const from = criteria.loggedAtFrom;
    filtered = filtered.filter((r) => r.loggedAt >= from);
  }
  if (criteria.loggedAtTo !== undefined) {
    const to = criteria.loggedAtTo;
    filtered = filtered.filter((r) => r.loggedAt <= to);
  }

  const frozenRecords = Object.freeze([...filtered]);
  const symbols = Object.freeze(
    [...new Set(frozenRecords.map((r) => r.symbol))].sort(),
  );
  const statuses = Object.freeze(
    [...new Set(frozenRecords.map((r) => r.researchReadinessStatus))].sort(),
  );

  const governanceSummary = {
    allEnterAlphaScoreFalse: frozenRecords.every(
      (r) => r.entersAlphaScore === false,
    ),
    allPaperOnly: frozenRecords.every((r) => r.paperOnly === true),
    allDryRun: frozenRecords.every((r) => r.dryRun === true),
    allNotInvestmentRecommendation: frozenRecords.every(
      (r) => r.notInvestmentRecommendation === true,
    ),
  };

  return {
    exporterVersion: snapshotExport.exporterVersion,
    exportedAt: snapshotExport.exportedAt,
    totalRecords: frozenRecords.length,
    records: frozenRecords,
    symbols,
    statuses,
    governanceSummary,
  };
}
