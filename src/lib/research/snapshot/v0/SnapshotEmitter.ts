/**
 * P44 — Axis A Controlled Research Snapshot Emitter v0
 *
 * Combines the P42 reader and P43 formatter into a single pure emission call:
 *
 *   emitSnapshot(snapshot, fixedReadoutAt?) => { readout, formatted }
 *
 * This is the Axis A "emission bundle" — the first composited output surface.
 * Consumers receive both the structured SnapshotReadout (machine-inspectable)
 * and the formatted string (human-inspectable) in a single deterministic call.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no side effects
 *   - Deterministic — same inputs and fixedReadoutAt always produce same output
 *   - No current-time dependency unless fixedReadoutAt is omitted (then uses new Date())
 *   - No scoring, no recommendation, no investment advice
 *   - Delegates entirely to readSnapshot() and formatSnapshotReadout()
 *
 * DISCLAIMER: Research snapshot emitter only. Does not constitute investment
 * advice. entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 */

import type { ControlledResearchSnapshot } from "../../ControlledResearchSnapshot";
import { readSnapshot, type SnapshotReadout } from "./SnapshotReader";
import { formatSnapshotReadout } from "./SnapshotFormatter";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SNAPSHOT_EMITTER_VERSION = "p44-axis-a-snapshot-emitter-v0";

// ─── EmitResult ───────────────────────────────────────────────────────────────

/**
 * The emission bundle returned by emitSnapshot().
 *
 * Contains both the structured readout (machine-inspectable) and
 * the formatted string (human-inspectable).
 *
 * GOVERNANCE INVARIANTS (inherited from readout):
 *   entersAlphaScore = false        — never mutates scoring formula
 *   notInvestmentRecommendation = true — NOT buy/sell/hold semantics
 *   paperOnly = true                — paper simulation surface only
 *   dryRun = true                   — no real execution, no DB apply
 */
export interface EmitResult {
  /** Structured SnapshotReadout — machine-inspectable diagnostic struct */
  readonly readout: SnapshotReadout;
  /** Formatted multi-line text string — human-inspectable display output */
  readonly formatted: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Produces an emission bundle from a ControlledResearchSnapshot.
 *
 * Combines readSnapshot() and formatSnapshotReadout() into a single call.
 *
 * @param snapshot        A ControlledResearchSnapshot to emit
 * @param fixedReadoutAt  Optional ISO timestamp to use as readoutAt (for deterministic testing)
 * @returns               EmitResult containing both readout and formatted string
 *
 * Pure function — no DB, no Prisma, no network, no side effects.
 * Deterministic when fixedReadoutAt is provided.
 */
export function emitSnapshot(
  snapshot: ControlledResearchSnapshot,
  fixedReadoutAt?: string,
): EmitResult {
  const readout = readSnapshot(snapshot, fixedReadoutAt);
  const formatted = formatSnapshotReadout(readout);
  return { readout, formatted };
}
