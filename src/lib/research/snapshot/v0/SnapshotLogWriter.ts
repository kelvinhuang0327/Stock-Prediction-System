/**
 * P45 — Axis A Controlled Research Snapshot Log Writer v0
 *
 * Serializes a P44 EmitResult into a deterministic, audit-friendly log record.
 * This is the first Axis A persistence-preparation surface: the record can
 * later be stored or displayed, but this module never writes to DB or filesystem.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no filesystem writes, no side effects
 *   - Deterministic when fixedLoggedAt is provided
 *   - No current-time dependency unless fixedLoggedAt is omitted
 *   - No scoring, no recommendation, no investment advice
 *   - No forbidden fields in the log record
 *   - formattedPreview = first 200 chars of EmitResult.formatted
 *
 * DISCLAIMER: Research snapshot log writer only. Does not constitute investment
 * advice. entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 */

import {
  SNAPSHOT_FORBIDDEN_FIELDS,
  type ResearchSnapshotReadinessStatus,
} from "../../ControlledResearchSnapshot";
import type { EmitResult } from "./SnapshotEmitter";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SNAPSHOT_LOG_WRITER_VERSION = "p45-axis-a-snapshot-log-v0";

// ─── SnapshotLogRecord ────────────────────────────────────────────────────────

/**
 * A deterministic, audit-friendly log record produced from an EmitResult.
 *
 * All fields are readonly — the record is immutable after construction.
 *
 * GOVERNANCE INVARIANTS (must never be violated):
 *   entersAlphaScore = false        — never mutates scoring formula
 *   notInvestmentRecommendation = true — NOT buy/sell/hold semantics
 *   paperOnly = true                — paper simulation surface only
 *   dryRun = true                   — no real execution, no DB apply
 */
export interface SnapshotLogRecord {
  // ─── Log metadata ─────────────────────────────────────────────────────────
  /** Log schema version — identifies this log writer implementation */
  readonly logVersion: typeof SNAPSHOT_LOG_WRITER_VERSION;
  /** ISO timestamp when this log record was created */
  readonly loggedAt: string;

  // ─── Identity ─────────────────────────────────────────────────────────────
  /** Target symbol (e.g. "2330") */
  readonly symbol: string;
  /** PIT boundary date (YYYY-MM-DD) */
  readonly asOfDate: string;
  /** Snapshot schema version from the underlying snapshot */
  readonly snapshotVersion: string;
  /** ISO timestamp when the underlying snapshot was generated */
  readonly generatedAt: string;
  /** ISO timestamp when the readout was produced */
  readonly readoutAt: string;

  // ─── Readiness ────────────────────────────────────────────────────────────
  /** Overall readiness classification */
  readonly researchReadinessStatus: ResearchSnapshotReadinessStatus;
  /** Sources with SourceInputState=ELIGIBLE */
  readonly eligibleSources: readonly string[];
  /** Sources with SourceInputState=AUDIT_ONLY */
  readonly auditOnlySources: readonly string[];
  /** Sources with SourceInputState=BLOCKED */
  readonly blockedSources: readonly string[];
  /** Sources with SourceInputState=NOT_ASSESSED */
  readonly notAssessedSources: readonly string[];
  /** Reasons blocking eligible or partial snapshot */
  readonly blockingReasons: readonly string[];

  // ─── Invariant validation ─────────────────────────────────────────────────
  /** True if the underlying snapshot passed all governance invariant checks */
  readonly invariantsValid: boolean;

  // ─── Governance invariants (locked literal values) ────────────────────────
  /** INVARIANT: log record NEVER enters alphaScore. Must always be false. */
  readonly entersAlphaScore: false;
  /** INVARIANT: not an investment recommendation. Must always be true. */
  readonly notInvestmentRecommendation: true;
  /** INVARIANT: paper-only surface. Must always be true. */
  readonly paperOnly: true;
  /** INVARIANT: dry-run only; no real execution or DB apply. Must always be true. */
  readonly dryRun: true;

  // ─── Formatted preview ────────────────────────────────────────────────────
  /**
   * First 200 characters of the EmitResult.formatted string.
   * Useful for quick log inspection without storing the full formatted block.
   */
  readonly formattedPreview: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Serializes a P44 EmitResult into a SnapshotLogRecord.
 *
 * Pure function — deterministic, no side effects, no DB access, no filesystem writes.
 *
 * @param result       A P44 EmitResult from emitSnapshot()
 * @param fixedLoggedAt Optional ISO timestamp override for deterministic tests
 * @returns            A SnapshotLogRecord — immutable, audit-friendly
 */
export function serializeEmitResult(
  result: EmitResult,
  fixedLoggedAt?: string,
): SnapshotLogRecord {
  const loggedAt = fixedLoggedAt ?? new Date().toISOString();

  const record: SnapshotLogRecord = {
    logVersion: SNAPSHOT_LOG_WRITER_VERSION,
    loggedAt,
    symbol: result.readout.symbol,
    asOfDate: result.readout.asOfDate,
    snapshotVersion: result.readout.snapshotVersion,
    generatedAt: result.readout.generatedAt,
    readoutAt: result.readout.readoutAt,
    researchReadinessStatus: result.readout.researchReadinessStatus,
    eligibleSources: [...result.readout.eligibleSources],
    auditOnlySources: [...result.readout.auditOnlySources],
    blockedSources: [...result.readout.blockedSources],
    notAssessedSources: [...result.readout.notAssessedSources],
    blockingReasons: [...result.readout.blockingReasons],
    invariantsValid: result.readout.invariantsValid,
    entersAlphaScore: false,
    notInvestmentRecommendation: true,
    paperOnly: true,
    dryRun: true,
    formattedPreview: result.formatted.slice(0, 200),
  };

  // ── Forbidden-field guard ─────────────────────────────────────────────────
  assertNoForbiddenFieldsInRecord(record);

  return record;
}

// ─── Internal guard ───────────────────────────────────────────────────────────

/**
 * Throws if the log record contains any SNAPSHOT_FORBIDDEN_FIELDS as own keys.
 * Pure function — no side effects beyond throwing on violation.
 * @internal
 */
function assertNoForbiddenFieldsInRecord(record: SnapshotLogRecord): void {
  const keys = Object.keys(record as Record<string, unknown>);
  for (const field of SNAPSHOT_FORBIDDEN_FIELDS) {
    if (keys.includes(field)) {
      throw new Error(
        `[SnapshotLogWriter] FORBIDDEN_FIELD_IN_RECORD: "${field}" found as key in log record`,
      );
    }
  }
}
