/**
 * P43 — Axis A Controlled Research Snapshot Formatter v0
 *
 * Renders a SnapshotReadout into a deterministic, human-readable multi-line
 * text string for CLI / display / review use.
 *
 * Design contract:
 *   - Pure function — no DB, no Prisma, no network, no side effects
 *   - Deterministic — same input always produces same output
 *   - No current-time dependency — all timestamps come from the readout
 *   - No scoring, no recommendation, no investment advice
 *   - No forbidden field names or values in the formatted string
 *   - All sections governed by SNAPSHOT_FORBIDDEN_FIELDS guard
 *
 * DISCLAIMER: Research snapshot formatter only. Does not constitute investment
 * advice. entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 */

import { SNAPSHOT_FORBIDDEN_FIELDS } from "../../ControlledResearchSnapshot";
import type { SnapshotReadout } from "./SnapshotReader";

// ─── Version ──────────────────────────────────────────────────────────────────

export const SNAPSHOT_FORMATTER_VERSION = "p43-axis-a-snapshot-formatter-v0";

// ─── Internal Layout Constants ────────────────────────────────────────────────

const DOUBLE_RULE = "═".repeat(62);
const SINGLE_RULE = "─".repeat(62);
const LABEL_WIDTH = 14;

function label(key: string): string {
  return ` ${key.padEnd(LABEL_WIDTH)}: `;
}

function joinSources(sources: string[]): string {
  return sources.length > 0 ? sources.join(", ") : "(none)";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Renders a SnapshotReadout into a deterministic, human-readable multi-line
 * text string.
 *
 * Layout:
 *   ══ header
 *     Identity block (symbol, asOfDate, readiness, versions, timestamps)
 *   ── rule
 *     Governance invariants line
 *   ── rule
 *     Source categorization (ELIGIBLE / AUDIT_ONLY / BLOCKED / NOT_ASSESSED)
 *   ── rule (only if blockingReasons non-empty)
 *     BLOCKING REASONS list
 *   ── rule (only if invariantViolations non-empty)
 *     INVARIANT VIOLATIONS list
 *   ── rule
 *     Invariants summary (VALID or VIOLATIONS DETECTED)
 *   ── rule
 *     Disclaimer (wrapped)
 *   ══ footer
 *
 * Pure function — deterministic, no side effects.
 *
 * @param readout  A SnapshotReadout from readSnapshot()
 */
export function formatSnapshotReadout(readout: SnapshotReadout): string {
  const lines: string[] = [];

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push(DOUBLE_RULE);
  lines.push(` Axis A Research Snapshot — Readout  [${SNAPSHOT_FORMATTER_VERSION}]`);
  lines.push(DOUBLE_RULE);

  // ── Identity block ───────────────────────────────────────────────────────
  lines.push(`${label("Symbol")}${readout.symbol}`);
  lines.push(`${label("AsOf")}${readout.asOfDate}`);
  lines.push(`${label("Readiness")}${readout.researchReadinessStatus}`);
  lines.push(`${label("SnapshotVer")}${readout.snapshotVersion}`);
  lines.push(`${label("ReaderVer")}${readout.readerVersion}`);
  lines.push(`${label("GeneratedAt")}${readout.generatedAt}`);
  lines.push(`${label("ReadoutAt")}${readout.readoutAt}`);

  // ── Governance invariants ────────────────────────────────────────────────
  lines.push(SINGLE_RULE);
  lines.push(
    ` GOVERNANCE    : entersAlphaScore=false | paperOnly=true | dryRun=true | notInvestmentRecommendation=true`
  );

  // ── Source categorization ────────────────────────────────────────────────
  lines.push(SINGLE_RULE);
  lines.push(`${label("ELIGIBLE")}${joinSources(readout.eligibleSources)}`);
  lines.push(`${label("AUDIT_ONLY")}${joinSources(readout.auditOnlySources)}`);
  lines.push(`${label("BLOCKED")}${joinSources(readout.blockedSources)}`);
  lines.push(`${label("NOT_ASSESSED")}${joinSources(readout.notAssessedSources)}`);

  // ── Blocking reasons (only if non-empty) ─────────────────────────────────
  if (readout.blockingReasons.length > 0) {
    lines.push(SINGLE_RULE);
    lines.push(` BLOCKING REASONS:`);
    for (let i = 0; i < readout.blockingReasons.length; i++) {
      lines.push(`   [${i + 1}] ${readout.blockingReasons[i]}`);
    }
  }

  // ── Invariant violations (only if non-empty) ──────────────────────────────
  if (readout.invariantViolations.length > 0) {
    lines.push(SINGLE_RULE);
    lines.push(` INVARIANT VIOLATIONS:`);
    for (let i = 0; i < readout.invariantViolations.length; i++) {
      lines.push(`   [${i + 1}] ${readout.invariantViolations[i]}`);
    }
  }

  // ── Invariants summary ────────────────────────────────────────────────────
  lines.push(SINGLE_RULE);
  lines.push(
    ` INVARIANTS    : ${readout.invariantsValid ? "VALID" : "VIOLATIONS DETECTED"}`
  );

  // ── Disclaimer ────────────────────────────────────────────────────────────
  lines.push(SINGLE_RULE);
  lines.push(` [DISCLAIMER] Research snapshot readout only.`);
  lines.push(`              Does not constitute investment advice.`);
  lines.push(`              entersAlphaScore=false. ALWAYS. paperOnly=true. dryRun=true.`);
  lines.push(`              No buy/sell/hold signals. No ROI/win-rate/edge/profit claims.`);

  // ── Footer ────────────────────────────────────────────────────────────────
  lines.push(DOUBLE_RULE);

  const output = lines.join("\n");

  // ── Forbidden-field guard on the output string ────────────────────────────
  // Ensures the rendered text never contains forbidden field names as label keys.
  assertNoForbiddenLabelsInOutput(output);

  return output;
}

// ─── Internal guard ───────────────────────────────────────────────────────────

/**
 * Throws if the formatted output contains any SNAPSHOT_FORBIDDEN_FIELDS names
 * as label keys (e.g. "alphaScore :", "prediction :").
 * Pure function — no side effects beyond throwing on violation.
 * @internal
 */
function assertNoForbiddenLabelsInOutput(output: string): void {
  const lowerOutput = output.toLowerCase();
  for (const field of SNAPSHOT_FORBIDDEN_FIELDS) {
    // Check for the field name followed by a colon (as a label), ignoring case
    const pattern = field.toLowerCase() + " :";
    if (lowerOutput.includes(pattern)) {
      throw new Error(
        `[SnapshotFormatter] FORBIDDEN_FIELD_IN_OUTPUT: "${field}" found as label in formatted text`
      );
    }
  }
}
