/**
 * P1 — Axis A Controlled Research Snapshot Builder v0
 *
 * Builds a ControlledResearchSnapshot by:
 *   1. Validating the PIT boundary (asOfDate must not be in the future)
 *   2. Calling P38 mapSourceToSimulationInputReadiness for each provided source
 *   3. Classifying overall readiness as READY / PARTIAL / BLOCKED
 *   4. Producing a deterministic, immutable snapshot object
 *
 * This module is pure TypeScript — no DB access, no Prisma, no side effects.
 * It imports ONLY from governance-safe modules:
 *   - @/lib/research/ControlledResearchSnapshot  (contract types)
 *   - @/lib/onlineValidation/p38/*               (PIT-safe readiness mapper)
 *   - @/lib/time/currentDate                     (injectable date source)
 *
 * DISCLAIMER: Builder for research snapshot only. Does not constitute investment advice.
 * entersAlphaScore = false. ALWAYS. paperOnly = true. dryRun = true.
 * No buy/sell/hold semantics. No scoring formula access. No DB apply.
 */

import { getCurrentDateISO } from "@/lib/time/currentDate";
import { mapSourceToSimulationInputReadiness } from "@/lib/onlineValidation/p38/SimulationInputReadinessMapper";
import type { SourceReadinessFacts } from "@/lib/onlineValidation/p38/SimulationInputReadinessTypes";
import {
  CONTROLLED_RESEARCH_SNAPSHOT_VERSION,
  CONTROLLED_RESEARCH_SNAPSHOT_DISCLAIMER,
  SNAPSHOT_FORBIDDEN_FIELDS,
  type ControlledResearchSnapshot,
  type ResearchSnapshotReadinessStatus,
  type SourceInputState,
  type PitSafeInputState,
} from "./ControlledResearchSnapshot";

// ─── Build Input ──────────────────────────────────────────────────────────────

/**
 * Inputs for building a controlled research snapshot.
 * All source facts are optional; missing sources yield "NOT_ASSESSED".
 */
export interface SnapshotBuildInput {
  /** Target symbol */
  symbol: string;
  /** PIT boundary date (YYYY-MM-DD). Must not be in the future. */
  asOfDate: string;
  /** Human-readable trace of the calling context */
  sourceTrace?: string;
  /** Optional P38-compatible facts for MonthlyRevenue */
  monthlyRevenueFacts?: SourceReadinessFacts;
  /** Optional P38-compatible facts for Quote */
  quoteFacts?: SourceReadinessFacts;
  /** Optional P38-compatible facts for Regime */
  regimeFacts?: SourceReadinessFacts;
  /** Override generatedAt for deterministic test fixtures */
  fixedGeneratedAt?: string;
  /** Override "today" for deterministic test fixtures */
  fixedToday?: string;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Builds a ControlledResearchSnapshot from the provided inputs.
 * Pure function — deterministic, no side effects, no DB access.
 *
 * PIT safety: asOfDate must be <= today (or fixedToday). Any future date
 * produces SNAPSHOT_BLOCKED_PIT immediately.
 */
export function buildControlledResearchSnapshot(
  input: SnapshotBuildInput
): ControlledResearchSnapshot {
  const generatedAt = input.fixedGeneratedAt ?? new Date().toISOString();
  const today = input.fixedToday ?? getCurrentDateISO();
  const blockingReasons: string[] = [];

  // ── Step 1: PIT boundary check ────────────────────────────────────────────
  if (!ISO_DATE_REGEX.test(input.asOfDate)) {
    blockingReasons.push(
      `PIT_VIOLATION: asOfDate "${input.asOfDate}" is not a valid YYYY-MM-DD date`
    );
    return buildBlockedPitSnapshot(input, generatedAt, blockingReasons);
  }
  if (input.asOfDate > today) {
    blockingReasons.push(
      `PIT_VIOLATION: asOfDate "${input.asOfDate}" is after today "${today}"; future-dated input rejected`
    );
    return buildBlockedPitSnapshot(input, generatedAt, blockingReasons);
  }

  // ── Step 2: Forbidden-field guard on input keys ───────────────────────────
  const inputKeys = Object.keys(input as Record<string, unknown>);
  for (const key of inputKeys) {
    if ((SNAPSHOT_FORBIDDEN_FIELDS as readonly string[]).includes(key)) {
      blockingReasons.push(`FORBIDDEN_FIELD_IN_INPUT: "${key}"`);
    }
  }
  if (blockingReasons.length > 0) {
    return buildBlockedSnapshot(input, generatedAt, blockingReasons);
  }

  // ── Step 3: Evaluate per-source readiness via P38 mapper ──────────────────
  const mrEntry = input.monthlyRevenueFacts
    ? mapSourceToSimulationInputReadiness(input.monthlyRevenueFacts)
    : null;
  const quoteEntry = input.quoteFacts
    ? mapSourceToSimulationInputReadiness(input.quoteFacts)
    : null;
  const regimeEntry = input.regimeFacts
    ? mapSourceToSimulationInputReadiness(input.regimeFacts)
    : null;

  const mrStatus = mrEntry ? mrEntry.simulationInputStatus : "NOT_ASSESSED";
  const quoteStatus = quoteEntry ? quoteEntry.simulationInputStatus : "NOT_ASSESSED";
  const regimeStatus = regimeEntry ? regimeEntry.simulationInputStatus : "NOT_ASSESSED";

  // Collect all source-level blockers
  for (const r of mrEntry?.blockingReasons ?? []) {
    blockingReasons.push(`MonthlyRevenue: ${r}`);
  }
  for (const r of quoteEntry?.blockingReasons ?? []) {
    blockingReasons.push(`Quote: ${r}`);
  }
  for (const r of regimeEntry?.blockingReasons ?? []) {
    blockingReasons.push(`Regime: ${r}`);
  }

  // ── Step 4: Map P38 status → SourceInputState ─────────────────────────────
  const pitSafeInputs: PitSafeInputState = {
    monthlyRevenue: mapSimStatusToInputState(mrStatus),
    quote: mapSimStatusToInputState(quoteStatus),
    regime: mapSimStatusToInputState(regimeStatus),
  };

  // ── Step 5: Overall readiness classification ──────────────────────────────
  const researchReadinessStatus = classifyOverallReadiness(pitSafeInputs);

  if (
    researchReadinessStatus === "SNAPSHOT_BLOCKED" &&
    blockingReasons.length === 0
  ) {
    blockingReasons.push(
      "No sources are eligible; snapshot cannot proceed. Provide at least one source with eligible readiness."
    );
  }

  return {
    symbol: input.symbol,
    asOfDate: input.asOfDate,
    snapshotVersion: CONTROLLED_RESEARCH_SNAPSHOT_VERSION,
    generatedAt,
    sourceTrace: input.sourceTrace ?? "ControlledResearchSnapshotBuilder-v0",
    pitSafeInputs,
    monthlyRevenueReadiness: mrStatus,
    quoteReadiness: quoteStatus,
    regimeReadiness: regimeStatus,
    researchReadinessStatus,
    blockingReasons,
    disclaimer: CONTROLLED_RESEARCH_SNAPSHOT_DISCLAIMER,
    entersAlphaScore: false,
    notInvestmentRecommendation: true,
    paperOnly: true,
    dryRun: true,
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function mapSimStatusToInputState(status: string): SourceInputState {
  if (status === "SIMULATION_INPUT_ELIGIBLE") return "ELIGIBLE";
  if (
    status === "CONSUMER_READY_AUDIT_ONLY" ||
    status === "SOURCE_PRESENT_AUDIT_ONLY"
  ) {
    return "AUDIT_ONLY";
  }
  if (status === "NOT_ASSESSED" || status === "NOT_APPLICABLE") {
    return "NOT_ASSESSED";
  }
  return "BLOCKED";
}

function classifyOverallReadiness(
  inputs: PitSafeInputState
): ResearchSnapshotReadinessStatus {
  const states = [inputs.monthlyRevenue, inputs.quote, inputs.regime];
  const assessed = states.filter((s) => s !== "NOT_ASSESSED");
  const eligible = states.filter((s) => s === "ELIGIBLE");

  if (assessed.length === 0) return "SNAPSHOT_BLOCKED";
  if (eligible.length === assessed.length && assessed.length > 0) {
    return "SNAPSHOT_READY";
  }
  if (eligible.length > 0) return "SNAPSHOT_PARTIAL";
  return "SNAPSHOT_BLOCKED";
}

function buildBlockedPitSnapshot(
  input: SnapshotBuildInput,
  generatedAt: string,
  blockingReasons: string[]
): ControlledResearchSnapshot {
  return {
    symbol: input.symbol,
    asOfDate: input.asOfDate,
    snapshotVersion: CONTROLLED_RESEARCH_SNAPSHOT_VERSION,
    generatedAt,
    sourceTrace: input.sourceTrace ?? "ControlledResearchSnapshotBuilder-v0",
    pitSafeInputs: {
      monthlyRevenue: "NOT_ASSESSED",
      quote: "NOT_ASSESSED",
      regime: "NOT_ASSESSED",
    },
    monthlyRevenueReadiness: "NOT_ASSESSED",
    quoteReadiness: "NOT_ASSESSED",
    regimeReadiness: "NOT_ASSESSED",
    researchReadinessStatus: "SNAPSHOT_BLOCKED_PIT",
    blockingReasons,
    disclaimer: CONTROLLED_RESEARCH_SNAPSHOT_DISCLAIMER,
    entersAlphaScore: false,
    notInvestmentRecommendation: true,
    paperOnly: true,
    dryRun: true,
  };
}

function buildBlockedSnapshot(
  input: SnapshotBuildInput,
  generatedAt: string,
  blockingReasons: string[]
): ControlledResearchSnapshot {
  return {
    symbol: input.symbol,
    asOfDate: input.asOfDate,
    snapshotVersion: CONTROLLED_RESEARCH_SNAPSHOT_VERSION,
    generatedAt,
    sourceTrace: input.sourceTrace ?? "ControlledResearchSnapshotBuilder-v0",
    pitSafeInputs: {
      monthlyRevenue: "NOT_ASSESSED",
      quote: "NOT_ASSESSED",
      regime: "NOT_ASSESSED",
    },
    monthlyRevenueReadiness: "NOT_ASSESSED",
    quoteReadiness: "NOT_ASSESSED",
    regimeReadiness: "NOT_ASSESSED",
    researchReadinessStatus: "SNAPSHOT_BLOCKED",
    blockingReasons,
    disclaimer: CONTROLLED_RESEARCH_SNAPSHOT_DISCLAIMER,
    entersAlphaScore: false,
    notInvestmentRecommendation: true,
    paperOnly: true,
    dryRun: true,
  };
}
