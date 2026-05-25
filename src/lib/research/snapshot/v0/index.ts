/**
 * P42/P43 — Axis A Controlled Research Snapshot v0 — Public API
 *
 * Re-exports the reader and formatter surfaces for external consumers.
 *
 * DISCLAIMER: Research snapshot surface only. Does not constitute investment
 * advice. entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 */

// ─── Reader (P42) ─────────────────────────────────────────────────────────────
export {
  SNAPSHOT_READER_VERSION,
  SNAPSHOT_READER_DISCLAIMER,
  readSnapshot,
  checkReadoutForbiddenFields,
} from "./SnapshotReader";

export type { SnapshotReadout } from "./SnapshotReader";

// ─── Formatter (P43) ─────────────────────────────────────────────────────────
export {
  SNAPSHOT_FORMATTER_VERSION,
  formatSnapshotReadout,
} from "./SnapshotFormatter";

// ─── Emitter (P44) ───────────────────────────────────────────────────────────
export {
  SNAPSHOT_EMITTER_VERSION,
  emitSnapshot,
} from "./SnapshotEmitter";

export type { EmitResult } from "./SnapshotEmitter";

// ─── Log Writer (P45) ────────────────────────────────────────────────────────
export {
  SNAPSHOT_LOG_WRITER_VERSION,
  serializeEmitResult,
} from "./SnapshotLogWriter";

export type { SnapshotLogRecord } from "./SnapshotLogWriter";

// ─── Log Collector (P46) ─────────────────────────────────────────────────────
export {
  SNAPSHOT_LOG_COLLECTOR_VERSION,
  createSnapshotLogCollector,
} from "./SnapshotLogCollector";

export type { SnapshotLogCollector } from "./SnapshotLogCollector";

// ─── Batch Runner (P48) ──────────────────────────────────────────────────────
export {
  SNAPSHOT_BATCH_RUNNER_VERSION,
  runSnapshotBatch,
} from "./SnapshotBatchRunner";

export type {
  SnapshotBatchRunInput,
  SnapshotBatchRunResult,
} from "./SnapshotBatchRunner";

// ─── Log Exporter (P49) ──────────────────────────────────────────────────────
export {
  SNAPSHOT_LOG_EXPORTER_VERSION,
  exportSnapshotLogRecord,
  exportSnapshotLogRecords,
  exportSnapshotLogCollector,
} from "./SnapshotLogExporter";

export type { SnapshotLogExport } from "./SnapshotLogExporter";

// ─── Export Filter (P50) ─────────────────────────────────────────────────────
export {
  SNAPSHOT_EXPORT_FILTER_VERSION,
  filterSnapshotLogExport,
} from "./SnapshotExportFilter";

export type { SnapshotExportFilterCriteria } from "./SnapshotExportFilter";

// ─── Export Serializer (P51) ──────────────────────────────────────────────────
export {
  SNAPSHOT_EXPORT_SERIALIZER_VERSION,
  serializeSnapshotLogExport,
} from "./SnapshotExportSerializer";

export type { SnapshotExportSerializedEnvelope } from "./SnapshotExportSerializer";
