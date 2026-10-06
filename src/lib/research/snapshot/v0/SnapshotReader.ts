/**
 * P42 — Axis A Controlled Research Snapshot Reader v0
 *
 * Produces a user-inspectable SnapshotReadout from a ControlledResearchSnapshot.
 * This is the first user-reviewable Axis A output surface.
 *
 * Design:
 *   1. Validate all governance invariants against the snapshot
 *   2. Categorize per-source PIT-safe states into eligible / audit-only / blocked / not-assessed
 *   3. Emit a SnapshotReadout — a clean, read-only diagnostic struct
 *
 * This module is pure TypeScript — no DB access, no Prisma, no network, no side effects.
 * It imports ONLY from governance-safe modules:
 *   - @/lib/research/ControlledResearchSnapshot  (contract types + validator)
 *
 * DISCLAIMER: Research snapshot reader only. Does not constitute investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 * Results must not be used as buy/sell/hold signals or investment recommendations.
 */

import {
  SNAPSHOT_FORBIDDEN_FIELDS,
  validateSnapshotInvariants,
  type ControlledResearchSnapshot,
  type ResearchSnapshotReadinessStatus,
} from "../../ControlledResearchSnapshot";

// ─── Version & Disclaimer ─────────────────────────────────────────────────────

export const SNAPSHOT_READER_VERSION = "p42-axis-a-snapshot-reader-v0";

export const SNAPSHOT_READER_DISCLAIMER =
  "Research snapshot readout only. Does not constitute investment advice. " +
  "No profit, return, win-rate, edge, or investment performance claims are made. " +
  "entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true. " +
  "Results must not be used as buy/sell/hold signals or investment recommendations. " +
  "This readout prohibits: buy, sell, hold, ROI, win-rate, edge, profit, outperform, " +
  "guaranteed-return, expected-return, investment-recommendation, targetPrice, outcomePrice.";

// ─── SnapshotReadout ──────────────────────────────────────────────────────────

/**
 * A user-inspectable digest of a ControlledResearchSnapshot.
 * This is the first user-reviewable Axis A output surface.
 *
 * GOVERNANCE INVARIANTS (must never be violated):
 *   entersAlphaScore = false        — never mutates scoring formula
 *   notInvestmentRecommendation = true — NOT buy/sell/hold semantics
 *   paperOnly = true                — paper simulation surface only
 *   dryRun = true                   — no real execution, no DB apply
 */
export interface SnapshotReadout {
  // ─── Identity ────────────────────────────────────────────────────────────
  /** Target symbol (e.g. "2330") */
  symbol: string;
  /** PIT boundary date (YYYY-MM-DD) */
  asOfDate: string;
  /** Snapshot schema version from the underlying snapshot */
  snapshotVersion: string;
  /** Reader version — identifies this reader implementation */
  readerVersion: string;
  /** ISO timestamp when the underlying snapshot was generated */
  generatedAt: string;
  /** ISO timestamp when this readout was produced */
  readoutAt: string;

  // ─── Readiness Summary ───────────────────────────────────────────────────
  /** Overall readiness classification */
  researchReadinessStatus: ResearchSnapshotReadinessStatus;
  /** Sources with SourceInputState=ELIGIBLE (PIT-safe, paper-only eligible) */
  eligibleSources: string[];
  /** Sources with SourceInputState=AUDIT_ONLY (consumer/source present but not simulation-eligible) */
  auditOnlySources: string[];
  /** Sources with SourceInputState=BLOCKED (blocked by PIT metadata / quality / authorization / lag) */
  blockedSources: string[];
  /** Sources with SourceInputState=NOT_ASSESSED (no facts provided) */
  notAssessedSources: string[];
  /** Reasons blocking eligible or partial snapshot; empty if SNAPSHOT_READY */
  blockingReasons: string[];

  // ─── Governance Invariants (must always equal these literal values) ───────
  /** INVARIANT: readout NEVER enters alphaScore. Must always be false. */
  readonly entersAlphaScore: false;
  /** INVARIANT: not an investment recommendation. Must always be true. */
  readonly notInvestmentRecommendation: true;
  /** INVARIANT: paper-only surface. Must always be true. */
  readonly paperOnly: true;
  /** INVARIANT: dry-run only; no real execution or DB apply. Must always be true. */
  readonly dryRun: true;

  // ─── Invariant Validation ────────────────────────────────────────────────
  /** True if the underlying snapshot passed all governance invariant checks */
  invariantsValid: boolean;
  /** List of invariant violations found; empty if invariantsValid=true */
  invariantViolations: string[];

  // ─── Disclaimer ──────────────────────────────────────────────────────────
  disclaimer: string;
}

// ─── Internal Constants ───────────────────────────────────────────────────────

/** All tracked PIT-safe sources for categorization */
const SOURCE_ENTRIES: Array<{
  key: keyof ControlledResearchSnapshot["pitSafeInputs"];
  label: string;
}> = [
  { key: "monthlyRevenue", label: "MonthlyRevenue" },
  { key: "quote", label: "Quote" },
  { key: "regime", label: "Regime" },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Reads a ControlledResearchSnapshot and returns a SnapshotReadout.
 * Pure function — deterministic, no side effects, no DB access.
 *
 * Steps:
 *   1. Validate snapshot governance invariants
 *   2. Categorize per-source PIT-safe states
 *   3. Assemble SnapshotReadout with governance fields locked
 *
 * @param snapshot      A ControlledResearchSnapshot from buildControlledResearchSnapshot
 * @param fixedReadoutAt Optional ISO timestamp override for deterministic tests
 */
export function readSnapshot(
  snapshot: ControlledResearchSnapshot,
  fixedReadoutAt?: string
): SnapshotReadout {
  const readoutAt = fixedReadoutAt ?? new Date().toISOString();

  // ── Step 1: Validate snapshot invariants ──────────────────────────────────
  const validation = validateSnapshotInvariants(snapshot);

  // ── Step 2: Categorize sources ────────────────────────────────────────────
  const eligibleSources: string[] = [];
  const auditOnlySources: string[] = [];
  const blockedSources: string[] = [];
  const notAssessedSources: string[] = [];

  for (const { key, label } of SOURCE_ENTRIES) {
    const state = snapshot.pitSafeInputs[key];
    switch (state) {
      case "ELIGIBLE":
        eligibleSources.push(label);
        break;
      case "AUDIT_ONLY":
        auditOnlySources.push(label);
        break;
      case "BLOCKED":
        blockedSources.push(label);
        break;
      default:
        notAssessedSources.push(label);
    }
  }

  // ── Step 3: Assemble readout ──────────────────────────────────────────────
  const readout: SnapshotReadout = {
    symbol: snapshot.symbol,
    asOfDate: snapshot.asOfDate,
    snapshotVersion: snapshot.snapshotVersion,
    readerVersion: SNAPSHOT_READER_VERSION,
    generatedAt: snapshot.generatedAt,
    readoutAt,
    researchReadinessStatus: snapshot.researchReadinessStatus,
    eligibleSources,
    auditOnlySources,
    blockedSources,
    notAssessedSources,
    blockingReasons: [...snapshot.blockingReasons],
    entersAlphaScore: false,
    notInvestmentRecommendation: true,
    paperOnly: true,
    dryRun: true,
    invariantsValid: validation.valid,
    invariantViolations: validation.violations,
    disclaimer: SNAPSHOT_READER_DISCLAIMER,
  };

  return readout;
}

/**
 * Checks that a readout contains no forbidden fields.
 * Returns a list of any found forbidden field names.
 * Pure function — used in tests and runtime guards.
 */
export function checkReadoutForbiddenFields(readout: SnapshotReadout): string[] {
  const keys = Object.keys(readout as Record<string, unknown>);
  return keys.filter((k) =>
    (SNAPSHOT_FORBIDDEN_FIELDS as readonly string[]).includes(k)
  );
}
