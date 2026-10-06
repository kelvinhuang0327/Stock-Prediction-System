/**
 * P46 — Axis A Controlled Research Snapshot Log Collector v0
 *
 * In-memory, mutable collector for SnapshotLogRecord objects.
 * Intended for test / dev / review use only — accumulates records in a
 * closure-backed list with fluent chaining.
 *
 * Design contract:
 *   - In-memory only — no DB, no Prisma, no network, no filesystem writes
 *   - No persistence — records are lost when the collector is garbage-collected
 *   - No scoring, no recommendation, no investment advice, no forbidden fields
 *   - collect() / clear() mutate internal state and return the collector for
 *     fluent chaining
 *   - getAll() / filterBy*() return frozen shallow copies — callers cannot
 *     mutate the collector's internal list through the returned arrays
 *   - createSnapshotLogCollector(initialRecords) seeds from an initial list
 *     without sharing the reference
 *
 * DISCLAIMER: Research snapshot log collector only. Does not constitute
 * investment advice. entersAlphaScore = false. ALWAYS. paperOnly = true.
 * dryRun = true. No profit, return, win-rate, edge, or investment performance
 * claims are made. Axis C C6 remains locked.
 */

import type { SnapshotLogRecord } from "./SnapshotLogWriter";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SNAPSHOT_LOG_COLLECTOR_VERSION =
  "p46-axis-a-snapshot-log-collector-v0";

// ─── SnapshotLogCollector type ────────────────────────────────────────────────

/**
 * In-memory collector for SnapshotLogRecord objects.
 *
 * All mutating methods (collect, clear) return the same collector instance
 * to allow fluent chaining:
 *
 *   const c = createSnapshotLogCollector();
 *   c.collect(record1).collect(record2);
 *   const all = c.getAll(); // [record1, record2]
 */
export type SnapshotLogCollector = {
  /** Identifies this collector implementation */
  readonly collectorVersion: typeof SNAPSHOT_LOG_COLLECTOR_VERSION;

  /**
   * Append a SnapshotLogRecord to the collector.
   * Mutates internal state. Returns the same collector for fluent chaining.
   */
  collect(record: SnapshotLogRecord): SnapshotLogCollector;

  /**
   * Return a frozen shallow copy of all collected records in insertion order.
   * Callers cannot mutate the internal list through the returned array.
   */
  getAll(): readonly SnapshotLogRecord[];

  /**
   * Return a frozen shallow copy of records whose researchReadinessStatus
   * matches the given status string.
   */
  filterByStatus(status: string): readonly SnapshotLogRecord[];

  /**
   * Return a frozen shallow copy of records whose symbol matches exactly.
   */
  filterBySymbol(symbol: string): readonly SnapshotLogRecord[];

  /**
   * Reset the collector to empty.
   * Mutates internal state. Returns the same collector for fluent chaining.
   */
  clear(): SnapshotLogCollector;
};

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new in-memory SnapshotLogCollector.
 *
 * @param initialRecords  Optional seed records — copied shallowly on creation,
 *                        the caller's array is NOT shared.
 * @returns               A fresh SnapshotLogCollector instance
 *
 * GOVERNANCE: pure in-memory factory — no DB, no Prisma, no network.
 */
export function createSnapshotLogCollector(
  initialRecords?: readonly SnapshotLogRecord[],
): SnapshotLogCollector {
  // Mutable internal list — never exposed directly to callers
  const records: SnapshotLogRecord[] = initialRecords
    ? [...initialRecords]
    : [];

  const collector: SnapshotLogCollector = {
    collectorVersion: SNAPSHOT_LOG_COLLECTOR_VERSION,

    collect(record: SnapshotLogRecord): SnapshotLogCollector {
      records.push(record);
      return collector;
    },

    getAll(): readonly SnapshotLogRecord[] {
      return Object.freeze([...records]);
    },

    filterByStatus(status: string): readonly SnapshotLogRecord[] {
      return Object.freeze(
        records.filter((r) => r.researchReadinessStatus === status),
      );
    },

    filterBySymbol(symbol: string): readonly SnapshotLogRecord[] {
      return Object.freeze(records.filter((r) => r.symbol === symbol));
    },

    clear(): SnapshotLogCollector {
      records.length = 0;
      return collector;
    },
  };

  return collector;
}
