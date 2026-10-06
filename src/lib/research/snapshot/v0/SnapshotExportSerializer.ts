/**
 * P51 — Axis A Controlled Research Snapshot Log Export Serializer v0
 *
 * Converts a SnapshotLogExport to a JSON string envelope for
 * filesystem-boundary hand-off. Never writes to disk, DB, or network.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem writes
 *   - Deterministic when fixedSerializedAt is provided
 *   - JSON-safe — payload is JSON.stringify of a JSON-safe export object
 *   - No scoring, no recommendation, no investment advice, no forbidden fields
 *
 * DISCLAIMER: Research snapshot serializer only. Does not constitute
 * investment advice. entersAlphaScore = false. ALWAYS. paperOnly = true.
 * dryRun = true. No profit, return, win-rate, edge, or investment performance
 * claims are made. Axis C C6 remains locked.
 */

import type { SnapshotLogExport } from "./SnapshotLogExporter";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SNAPSHOT_EXPORT_SERIALIZER_VERSION =
  "p51-axis-a-snapshot-export-serializer-v0";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Plain, JSON-safe serialization envelope wrapping a SnapshotLogExport payload.
 *
 * schemaVersion identifies the shape of the serialized payload and is fixed
 * at "snapshot-log-export-v0" for all P51 output. payload is the result of
 * JSON.stringify on the full SnapshotLogExport — safe to write to a file or
 * transmit across a process boundary.
 */
export type SnapshotExportSerializedEnvelope = {
  readonly serializerVersion: typeof SNAPSHOT_EXPORT_SERIALIZER_VERSION;
  readonly serializedAt: string;
  readonly schemaVersion: "snapshot-log-export-v0";
  readonly payload: string;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Serialize a SnapshotLogExport to a SnapshotExportSerializedEnvelope.
 *
 * The payload field contains the JSON string of the full snapshotExport object.
 * This function is pure — it never writes to disk, DB, or network.
 *
 * @param snapshotExport    The export to serialize.
 * @param fixedSerializedAt Optional ISO timestamp for deterministic testing.
 *                          If omitted, uses Date.now().
 */
export function serializeSnapshotLogExport(
  snapshotExport: SnapshotLogExport,
  fixedSerializedAt?: string
): SnapshotExportSerializedEnvelope {
  const serializedAt = fixedSerializedAt ?? new Date().toISOString();

  return {
    serializerVersion: SNAPSHOT_EXPORT_SERIALIZER_VERSION,
    serializedAt,
    schemaVersion: "snapshot-log-export-v0",
    payload: JSON.stringify(snapshotExport),
  };
}
