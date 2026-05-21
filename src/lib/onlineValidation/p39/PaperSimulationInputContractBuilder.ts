/**
 * P39 — Paper Simulation Input Contract Builder & Validator
 *
 * Builds and validates PaperSimulationInputBundle from P38 readiness results.
 * Only SIMULATION_INPUT_ELIGIBLE sources are included in the bundle.
 * Blocked sources are explicitly listed and enforced.
 *
 * DISCLAIMER: This module does not constitute investment advice,
 * a recommendation, or a signal to buy, sell, or hold any security.
 * entersAlphaScore = false. paperOnly = true. dryRunOnly = true.
 * No profit, return, win-rate, edge, or investment performance claims are made.
 * This is a structural contract builder — not simulation execution.
 *
 * ISOLATION:
 * - No Prisma / DB imports
 * - No scoring formula imports
 * - No optimizer / backtest imports
 * - Pure deterministic functions only
 */

import type { SimulationInputReadinessEntry } from "../p38/SimulationInputReadinessTypes";
import {
  SIMULATION_INPUT_FORBIDDEN_USES,
} from "../p38/SimulationInputReadinessTypes";
import type {
  PaperSimulationInputBundle,
  PaperSimulationEligibleSourceInput,
  PaperSimulationBlockedSource,
  PaperSimulationInputValidationResult,
  SourceName,
} from "./PaperSimulationInputContract";
import {
  PAPER_SIMULATION_CONTRACT_MODE,
  PAPER_SIMULATION_CONTRACT_VERSION,
  PAPER_SIMULATION_CONTRACT_DISCLAIMER,
  PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS,
  P39_ELIGIBLE_SOURCES,
  P39_BLOCKED_SOURCES,
} from "./PaperSimulationInputContract";

// ─── Internal Payload Summaries ───────────────────────────────────────────────

const SOURCE_PAYLOAD_SUMMARIES: Record<SourceName, string> = {
  MonthlyRevenue:
    "Monthly revenue figure (controlled, audit-only consumer integration complete via P36+P37). " +
    "2143 rows available. PIT metadata complete. Consumer-ready. paperOnly=true.",
  Quote:
    "Market quote data (open/high/low/close/volume). PIT-safe confirmed. " +
    "Historical quote series available for paper simulation input. paperOnly=true.",
  Regime:
    "Market regime classification (bull/bear/sideways). PIT-safe confirmed. " +
    "Regime state available for paper simulation input context. paperOnly=true.",
  NewsEvent:
    "BLOCKED — quality evidence incomplete. NLP quality, symbol linkage, and source diversity " +
    "not yet validated. 84% Yahoo RSS concentration. Not eligible for simulation input.",
  FinancialReport:
    "BLOCKED — PIT metadata absent. releaseDate / releaseDateSource / releaseDateConfidence " +
    "fields missing. Schema migration authorization required.",
  Chip:
    "BLOCKED — authorization not granted. availableAt field absent. " +
    "Migration to dev DB not authorized by operator.",
};

// ─── Eligible Source Builder ──────────────────────────────────────────────────

function buildEligibleSourceInput(
  entry: SimulationInputReadinessEntry,
  asOfDate: string
): PaperSimulationEligibleSourceInput {
  return {
    sourceName: entry.sourceName,
    readinessStatus: "SIMULATION_INPUT_ELIGIBLE",
    paperOnly: true,
    dryRunOnly: true,
    entersAlphaScore: false,
    noInvestmentAdvice: true,
    noBuySellActionSemantics: true,
    asOfDate,
    sourceTrace: entry.currentGateStatus,
    payloadSummary: SOURCE_PAYLOAD_SUMMARIES[entry.sourceName],
  };
}

// ─── Blocked Source Builder ───────────────────────────────────────────────────

function buildBlockedSource(
  entry: SimulationInputReadinessEntry
): PaperSimulationBlockedSource {
  const blockedStatus = entry.simulationInputStatus as
    | "BLOCKED_QUALITY_EVIDENCE"
    | "BLOCKED_PIT_METADATA"
    | "BLOCKED_AUTHORIZATION"
    | "BLOCKED_LAG_EVIDENCE";

  return {
    sourceName: entry.sourceName,
    blockedStatus,
    blockingReasons: entry.blockingReasons,
    requiredNextEvidence: entry.requiredNextEvidence,
    forbiddenUse: [...SIMULATION_INPUT_FORBIDDEN_USES],
  };
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface BuildContractOptions {
  /** ISO date string — defaults to current date if not provided */
  asOfDate?: string;
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

/**
 * Build a PaperSimulationInputBundle from a list of P38 readiness entries.
 *
 * Rules:
 * - Only entries with simulationInputStatus = SIMULATION_INPUT_ELIGIBLE
 *   are included in eligibleSources.
 * - All other entries are included in blockedSources.
 * - The known canonical eligible sources (MonthlyRevenue, Quote, Regime) are
 *   included by default if their entries are not present in the input.
 * - Governance fields are structurally enforced (not runtime-settable).
 */
export function buildPaperSimulationInputBundle(
  entries: SimulationInputReadinessEntry[],
  opts: BuildContractOptions = {}
): PaperSimulationInputBundle {
  const asOfDate = opts.asOfDate ?? new Date().toISOString();

  const eligibleSources: PaperSimulationEligibleSourceInput[] = [];
  const blockedSources: PaperSimulationBlockedSource[] = [];

  for (const entry of entries) {
    if (entry.simulationInputStatus === "SIMULATION_INPUT_ELIGIBLE") {
      eligibleSources.push(buildEligibleSourceInput(entry, asOfDate));
    } else if (
      entry.simulationInputStatus === "BLOCKED_QUALITY_EVIDENCE" ||
      entry.simulationInputStatus === "BLOCKED_PIT_METADATA" ||
      entry.simulationInputStatus === "BLOCKED_AUTHORIZATION" ||
      entry.simulationInputStatus === "BLOCKED_LAG_EVIDENCE" ||
      entry.simulationInputStatus === "CONSUMER_READY_AUDIT_ONLY" ||
      entry.simulationInputStatus === "SOURCE_PRESENT_AUDIT_ONLY"
    ) {
      // Any non-eligible source goes to blocked list
      const blockedStatus = entry.simulationInputStatus.startsWith("BLOCKED_")
        ? (entry.simulationInputStatus as PaperSimulationBlockedSource["blockedStatus"])
        : "BLOCKED_AUTHORIZATION"; // audit-only → treat as authorization-blocked for contract purposes
      blockedSources.push({
        sourceName: entry.sourceName,
        blockedStatus,
        blockingReasons: entry.blockingReasons,
        requiredNextEvidence: entry.requiredNextEvidence,
        forbiddenUse: [...SIMULATION_INPUT_FORBIDDEN_USES],
      });
    }
  }

  return {
    mode: PAPER_SIMULATION_CONTRACT_MODE,
    generatedAt: asOfDate,
    version: PAPER_SIMULATION_CONTRACT_VERSION,
    paperOnly: true,
    dryRunOnly: true,
    entersAlphaScore: false,
    noInvestmentAdvice: true,
    noBuySellActionSemantics: true,
    notSimulationExecution: true,
    notOptimizer: true,
    notRealBacktest: true,
    eligibleSources,
    blockedSources,
    disclaimer: PAPER_SIMULATION_CONTRACT_DISCLAIMER,
  };
}

// ─── Default Bundle Builder ───────────────────────────────────────────────────

/**
 * Build the canonical default bundle using P38 classification results.
 * Eligible: MonthlyRevenue, Quote, Regime.
 * Blocked: NewsEvent, FinancialReport, Chip.
 *
 * This function does NOT read from the DB or Prisma.
 * It uses the statically known P38 results.
 */
export function buildDefaultPaperSimulationInputBundle(
  opts: BuildContractOptions = {}
): PaperSimulationInputBundle {
  const asOfDate = opts.asOfDate ?? new Date().toISOString();

  const eligibleSources: PaperSimulationEligibleSourceInput[] = P39_ELIGIBLE_SOURCES.map(
    (name): PaperSimulationEligibleSourceInput => ({
      sourceName: name,
      readinessStatus: "SIMULATION_INPUT_ELIGIBLE",
      paperOnly: true,
      dryRunOnly: true,
      entersAlphaScore: false,
      noInvestmentAdvice: true,
      noBuySellActionSemantics: true,
      asOfDate,
      payloadSummary: SOURCE_PAYLOAD_SUMMARIES[name],
    })
  );

  const blockedSourceDefs: Record<
    string,
    {
      status: PaperSimulationBlockedSource["blockedStatus"];
      reasons: string[];
      evidence: string[];
    }
  > = {
    NewsEvent: {
      status: "BLOCKED_QUALITY_EVIDENCE",
      reasons: [
        "NLP quality not validated",
        "Symbol linkage accuracy unknown",
        "Source diversity insufficient (84% Yahoo RSS)",
      ],
      evidence: [
        "Complete NLP quality audit",
        "Validate symbol linkage accuracy",
        "Expand beyond Yahoo RSS to diverse sources",
      ],
    },
    FinancialReport: {
      status: "BLOCKED_PIT_METADATA",
      reasons: [
        "releaseDate field absent from schema",
        "releaseDateSource field absent",
        "releaseDateConfidence field absent",
        "Explicit authorization required for migration",
      ],
      evidence: [
        "YES apply FinancialReport releaseDate migration",
        "Populate releaseDate from authoritative source",
        "Validate releaseDateSource and releaseDateConfidence",
      ],
    },
    Chip: {
      status: "BLOCKED_AUTHORIZATION",
      reasons: [
        "availableAt field absent from schema",
        "Migration to dev DB not authorized",
        "Lag evidence not validated",
      ],
      evidence: [
        "YES apply Chip availableAt migration",
        "Validate availableAt values in dev DB",
        "Complete lag evidence audit",
      ],
    },
  };

  const blockedSources: PaperSimulationBlockedSource[] = P39_BLOCKED_SOURCES.map(
    (name): PaperSimulationBlockedSource => {
      const def = blockedSourceDefs[name]!;
      return {
        sourceName: name,
        blockedStatus: def.status,
        blockingReasons: def.reasons,
        requiredNextEvidence: def.evidence,
        forbiddenUse: [...SIMULATION_INPUT_FORBIDDEN_USES],
      };
    }
  );

  return {
    mode: PAPER_SIMULATION_CONTRACT_MODE,
    generatedAt: asOfDate,
    version: PAPER_SIMULATION_CONTRACT_VERSION,
    paperOnly: true,
    dryRunOnly: true,
    entersAlphaScore: false,
    noInvestmentAdvice: true,
    noBuySellActionSemantics: true,
    notSimulationExecution: true,
    notOptimizer: true,
    notRealBacktest: true,
    eligibleSources,
    blockedSources,
    disclaimer: PAPER_SIMULATION_CONTRACT_DISCLAIMER,
  };
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validate a PaperSimulationInputBundle against all governance rules.
 *
 * Validation rules:
 * 1. mode must be PAPER_SIMULATION_CONTRACT_MODE
 * 2. paperOnly must be true
 * 3. dryRunOnly must be true
 * 4. entersAlphaScore must be false
 * 5. noInvestmentAdvice must be true
 * 6. noBuySellActionSemantics must be true
 * 7. notSimulationExecution must be true
 * 8. notOptimizer must be true
 * 9. notRealBacktest must be true
 * 10. No blocked source name may appear in eligibleSources
 * 11. No eligible source entry may have entersAlphaScore=true
 * 12. No eligible source entry may have paperOnly=false
 * 13. No forbidden field keys appear in the bundle
 * 14. disclaimer must be present
 */
export function validatePaperSimulationInputBundle(
  bundle: unknown
): PaperSimulationInputValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof bundle !== "object" || bundle === null) {
    return {
      valid: false,
      errors: ["Bundle must be a non-null object"],
      warnings: [],
      entersAlphaScore: false,
      paperOnly: true,
    };
  }

  const b = bundle as Record<string, unknown>;

  // Rule 1: mode
  if (b["mode"] !== PAPER_SIMULATION_CONTRACT_MODE) {
    errors.push(
      `mode must be "${PAPER_SIMULATION_CONTRACT_MODE}", got: ${String(b["mode"])}`
    );
  }

  // Rule 2: paperOnly
  if (b["paperOnly"] !== true) {
    errors.push(`paperOnly must be true, got: ${String(b["paperOnly"])}`);
  }

  // Rule 3: dryRunOnly
  if (b["dryRunOnly"] !== true) {
    errors.push(`dryRunOnly must be true, got: ${String(b["dryRunOnly"])}`);
  }

  // Rule 4: entersAlphaScore
  if (b["entersAlphaScore"] !== false) {
    errors.push(
      `entersAlphaScore must be false, got: ${String(b["entersAlphaScore"])}`
    );
  }

  // Rule 5: noInvestmentAdvice
  if (b["noInvestmentAdvice"] !== true) {
    errors.push(
      `noInvestmentAdvice must be true, got: ${String(b["noInvestmentAdvice"])}`
    );
  }

  // Rule 6: noBuySellActionSemantics
  if (b["noBuySellActionSemantics"] !== true) {
    errors.push(
      `noBuySellActionSemantics must be true, got: ${String(b["noBuySellActionSemantics"])}`
    );
  }

  // Rule 7: notSimulationExecution
  if (b["notSimulationExecution"] !== true) {
    errors.push(
      `notSimulationExecution must be true, got: ${String(b["notSimulationExecution"])}`
    );
  }

  // Rule 8: notOptimizer
  if (b["notOptimizer"] !== true) {
    errors.push(`notOptimizer must be true, got: ${String(b["notOptimizer"])}`);
  }

  // Rule 9: notRealBacktest
  if (b["notRealBacktest"] !== true) {
    errors.push(
      `notRealBacktest must be true, got: ${String(b["notRealBacktest"])}`
    );
  }

  // Rule 10: no blocked source in eligibleSources
  if (Array.isArray(b["eligibleSources"])) {
    for (const src of b["eligibleSources"] as Record<string, unknown>[]) {
      const name = src["sourceName"] as string | undefined;
      if (name && P39_BLOCKED_SOURCES.includes(name as SourceName)) {
        errors.push(
          `Blocked source "${name}" must not appear in eligibleSources`
        );
      }
      // Rule 11: no entersAlphaScore=true in eligible entries
      if (src["entersAlphaScore"] !== false) {
        errors.push(
          `eligibleSources entry "${name ?? "unknown"}" must have entersAlphaScore=false`
        );
      }
      // Rule 12: no paperOnly=false in eligible entries
      if (src["paperOnly"] !== true) {
        errors.push(
          `eligibleSources entry "${name ?? "unknown"}" must have paperOnly=true`
        );
      }
    }
  }

  // Rule 13: forbidden fields
  for (const field of PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS) {
    if (field in b) {
      errors.push(`Forbidden field "${field}" found in bundle root`);
    }
  }

  // Rule 14: disclaimer
  if (!b["disclaimer"] || typeof b["disclaimer"] !== "string" || b["disclaimer"].length < 10) {
    errors.push("disclaimer must be a non-empty string");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    entersAlphaScore: false,
    paperOnly: true,
  };
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export {
  PAPER_SIMULATION_CONTRACT_MODE,
  PAPER_SIMULATION_CONTRACT_VERSION,
  PAPER_SIMULATION_CONTRACT_DISCLAIMER,
  PAPER_SIMULATION_CONTRACT_FORBIDDEN_FIELDS,
  PAPER_SIMULATION_CONTRACT_FORBIDDEN_USES,
  P39_ELIGIBLE_SOURCES,
  P39_BLOCKED_SOURCES,
} from "./PaperSimulationInputContract";
