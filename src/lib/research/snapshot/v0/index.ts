/**
 * P42 — Axis A Controlled Research Snapshot v0 Reader — Public API
 *
 * Re-exports the reader surface for external consumers.
 *
 * DISCLAIMER: Research snapshot reader only. Does not constitute investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 */

export {
  SNAPSHOT_READER_VERSION,
  SNAPSHOT_READER_DISCLAIMER,
  readSnapshot,
  checkReadoutForbiddenFields,
} from "./SnapshotReader";

export type { SnapshotReadout } from "./SnapshotReader";
