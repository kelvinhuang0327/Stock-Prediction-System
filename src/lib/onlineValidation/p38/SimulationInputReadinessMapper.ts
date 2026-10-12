/**
 * P38 — Simulation Input Readiness Mapper
 *
 * Pure, deterministic mapping of controlled sources to simulation input
 * readiness classifications. No DB, no Prisma, no scoring formula access.
 *
 * Sources mapped:
 *   MonthlyRevenue → SIMULATION_INPUT_ELIGIBLE (paperOnly=true, entersAlphaScore=false)
 *   NewsEvent      → BLOCKED_QUALITY_EVIDENCE (NLP/symbol/source quality unvalidated)
 *   FinancialReport→ BLOCKED_PIT_METADATA (releaseDate migration required)
 *   Chip           → BLOCKED_AUTHORIZATION / BLOCKED_LAG_EVIDENCE
 *   Quote          → SIMULATION_INPUT_ELIGIBLE if pitSafeConfirmed else SOURCE_PRESENT_AUDIT_ONLY
 *   Regime         → SIMULATION_INPUT_ELIGIBLE if pitSafeConfirmed else SOURCE_PRESENT_AUDIT_ONLY
 *
 * DISCLAIMER: Not investment advice. entersAlphaScore=false. paperOnly=true. dryRunOnly=true.
 */

import {
  SourceName,
  SourceReadinessFacts,
  SimulationInputReadinessEntry,
  SimulationInputReadinessMatrix,
  SimulationInputStatus,
  SIMULATION_INPUT_FORBIDDEN_FIELDS,
  SIMULATION_INPUT_FORBIDDEN_USES,
  SIMULATION_INPUT_READINESS_MATRIX_VERSION,
  SIMULATION_INPUT_READINESS_DISCLAIMER,
} from "./SimulationInputReadinessTypes";

// ─── Public API ───────────────────────────────────────────────────────────────

export { SIMULATION_INPUT_READINESS_MATRIX_VERSION };

/**
 * Map a single source to its simulation input readiness entry.
 * Pure function — deterministic, no side effects, no DB access.
 */
export function mapSourceToSimulationInputReadiness(
  facts: SourceReadinessFacts
): SimulationInputReadinessEntry {
  // Guard: check for forbidden fields in input object (runtime safety)
  const inputKeys = Object.keys(facts as Record<string, unknown>);
  const foundForbidden = inputKeys.filter((k) =>
    (SIMULATION_INPUT_FORBIDDEN_FIELDS as readonly string[]).includes(k)
  );
  if (foundForbidden.length > 0) {
    return buildEntry(facts, "BLOCKED_AUTHORIZATION", [
      ...foundForbidden.map((f) => `FORBIDDEN_FIELD_IN_INPUT: ${f}`),
    ]);
  }

  const blockingReasons: string[] = [];
  let simulationInputStatus: SimulationInputStatus;

  switch (facts.sourceName) {
    case "MonthlyRevenue":
      simulationInputStatus = resolveMonthlyRevenue(facts, blockingReasons);
      break;
    case "NewsEvent":
      simulationInputStatus = resolveNewsEvent(facts, blockingReasons);
      break;
    case "FinancialReport":
      simulationInputStatus = resolveFinancialReport(blockingReasons);
      break;
    case "Chip":
      simulationInputStatus = resolveChip(facts, blockingReasons);
      break;
    case "Quote":
    case "Regime":
      simulationInputStatus = resolveQuoteOrRegime(facts, blockingReasons);
      break;
    default:
      simulationInputStatus = "NOT_APPLICABLE";
  }

  return buildEntry(facts, simulationInputStatus, blockingReasons);
}

/**
 * Build a full simulation input readiness matrix from a list of source facts.
 * All governance invariants are enforced at the matrix level.
 */
export function buildSimulationInputReadinessMatrix(
  factsArray: SourceReadinessFacts[],
  options?: { fixedGeneratedAt?: string }
): SimulationInputReadinessMatrix {
  const entries = factsArray.map(mapSourceToSimulationInputReadiness);
  return {
    generatedAt: options?.fixedGeneratedAt ?? new Date().toISOString(),
    dryRunOnly: true,
    paperOnly: true,
    entersAlphaScore: false,
    notInvestmentRecommendation: true,
    noBuySellActionSemantics: true,
    entries,
    version: SIMULATION_INPUT_READINESS_MATRIX_VERSION,
    disclaimer: SIMULATION_INPUT_READINESS_DISCLAIMER,
  };
}

/**
 * Summarize a readiness matrix into counts by status bucket.
 */
export function summarizeSimulationInputReadinessMatrix(
  matrix: SimulationInputReadinessMatrix
): {
  totalSources: number;
  eligible: number;
  auditOnly: number;
  blocked: number;
  entersAlphaScore: false;
  paperOnly: true;
  byStatus: Record<string, number>;
} {
  const byStatus: Record<string, number> = {};
  let eligible = 0;
  let auditOnly = 0;
  let blocked = 0;

  for (const entry of matrix.entries) {
    byStatus[entry.simulationInputStatus] =
      (byStatus[entry.simulationInputStatus] ?? 0) + 1;
    if (entry.simulationInputStatus === "SIMULATION_INPUT_ELIGIBLE") {
      eligible++;
    } else if (
      entry.simulationInputStatus === "CONSUMER_READY_AUDIT_ONLY" ||
      entry.simulationInputStatus === "SOURCE_PRESENT_AUDIT_ONLY"
    ) {
      auditOnly++;
    } else {
      blocked++;
    }
  }

  return {
    totalSources: matrix.entries.length,
    eligible,
    auditOnly,
    blocked,
    entersAlphaScore: false,
    paperOnly: true,
    byStatus,
  };
}

// ─── Source Resolver Functions ────────────────────────────────────────────────

function resolveMonthlyRevenue(
  facts: SourceReadinessFacts,
  blockingReasons: string[]
): SimulationInputStatus {
  if (!facts.pitMetadataComplete) {
    blockingReasons.push(
      "PIT metadata incomplete: releaseDate coverage or confidence missing"
    );
    return "BLOCKED_PIT_METADATA";
  }
  if (!facts.qualityEvidenceComplete) {
    blockingReasons.push("Quality evidence incomplete: spec conformance not confirmed");
    return "BLOCKED_QUALITY_EVIDENCE";
  }
  if (facts.consumerStatus !== "CONSUMER_READY") {
    blockingReasons.push(
      "Consumer integration not complete: P36/P37 pipeline not deployed"
    );
    return "CONSUMER_READY_AUDIT_ONLY";
  }
  // All gates cleared → ELIGIBLE (paperOnly=true enforced at entry level)
  return "SIMULATION_INPUT_ELIGIBLE";
}

function resolveNewsEvent(
  facts: SourceReadinessFacts,
  blockingReasons: string[]
): SimulationInputStatus {
  if (!facts.qualityEvidenceComplete) {
    blockingReasons.push("NLP quality not validated");
    blockingReasons.push("Symbol linkage not validated");
    blockingReasons.push("Source diversity concern: 84% Yahoo RSS concentration");
    return "BLOCKED_QUALITY_EVIDENCE";
  }
  if (facts.consumerStatus === "SOURCE_PRESENT_AUDIT_ONLY") {
    blockingReasons.push("No consumer integration code: src/ not yet touched for NewsEvent");
    return "SOURCE_PRESENT_AUDIT_ONLY";
  }
  if (facts.consumerStatus !== "CONSUMER_READY") {
    return "SOURCE_PRESENT_AUDIT_ONLY";
  }
  // publishedAt PIT gate is RECORDED_FROM_SOURCE (strongest confidence)
  // but source diversity and NLP must be validated before simulation input
  return "SOURCE_PRESENT_AUDIT_ONLY";
}

function resolveFinancialReport(blockingReasons: string[]): SimulationInputStatus {
  // Always BLOCKED — schema migration required and not yet authorized
  blockingReasons.push("releaseDate field missing from schema");
  blockingReasons.push("releaseDateSource field missing from schema");
  blockingReasons.push("releaseDateConfidence field missing from schema");
  blockingReasons.push(
    "Authorization required: YES apply FinancialReport releaseDate migration to dev DB"
  );
  return "BLOCKED_PIT_METADATA";
}

function resolveChip(
  facts: SourceReadinessFacts,
  blockingReasons: string[]
): SimulationInputStatus {
  if (!facts.authorizationGranted) {
    blockingReasons.push(
      "Authorization required: YES apply Chip availableAt migration to dev DB"
    );
    blockingReasons.push("availableAt field absent from schema");
    return "BLOCKED_AUTHORIZATION";
  }
  // Authorization granted but lag evidence not yet validated
  blockingReasons.push("availableAt prod logs not validated");
  blockingReasons.push("Lag evidence incomplete: distribution lag not quantified");
  return "BLOCKED_LAG_EVIDENCE";
}

function resolveQuoteOrRegime(
  facts: SourceReadinessFacts,
  blockingReasons: string[]
): SimulationInputStatus {
  if (facts.pitSafeConfirmed) {
    return "SIMULATION_INPUT_ELIGIBLE";
  }
  blockingReasons.push(
    `PIT_SAFE_CONFIRMED not set for ${facts.sourceName}: point-in-time safety not verified`
  );
  return "SOURCE_PRESENT_AUDIT_ONLY";
}

// ─── Entry Builder ────────────────────────────────────────────────────────────

function buildEntry(
  facts: SourceReadinessFacts,
  simulationInputStatus: SimulationInputStatus,
  blockingReasons: string[]
): SimulationInputReadinessEntry {
  return {
    sourceName: facts.sourceName,
    currentGateStatus: mapConsumerStatusToGateStatus(facts.consumerStatus, simulationInputStatus),
    pitStatus: facts.pitStatus,
    consumerStatus: facts.consumerStatus,
    simulationInputStatus,
    blockingReasons,
    allowedUse: getAllowedUse(facts.sourceName, simulationInputStatus),
    forbiddenUse: [...SIMULATION_INPUT_FORBIDDEN_USES],
    requiredNextEvidence: getRequiredNextEvidence(facts.sourceName, simulationInputStatus),
    entersAlphaScore: false,
    paperOnly: true,
    noInvestmentAdvice: true,
  };
}

function mapConsumerStatusToGateStatus(
  consumerStatus: SourceReadinessFacts["consumerStatus"],
  simulationInputStatus: SimulationInputStatus
): string {
  if (simulationInputStatus === "SIMULATION_INPUT_ELIGIBLE") {
    return "ALL_GATES_CLEARED";
  }
  if (simulationInputStatus === "CONSUMER_READY_AUDIT_ONLY") {
    return "CONSUMER_GATE_CLEARED";
  }
  if (
    simulationInputStatus === "SOURCE_PRESENT_AUDIT_ONLY" &&
    consumerStatus === "SOURCE_PRESENT_AUDIT_ONLY"
  ) {
    return "SOURCE_PRESENT_GATE_CLEARED";
  }
  if (simulationInputStatus.startsWith("BLOCKED_")) {
    return `BLOCKED: ${simulationInputStatus}`;
  }
  return consumerStatus;
}

function getAllowedUse(
  sourceName: SourceName,
  status: SimulationInputStatus
): string[] {
  if (status === "SIMULATION_INPUT_ELIGIBLE") {
    return [
      "paper-only simulation input (dryRunOnly=true, paperOnly=true)",
      "structural readiness audit",
      "controlled consumer pipeline testing (P36/P37/P38 path)",
    ];
  }
  if (status === "CONSUMER_READY_AUDIT_ONLY") {
    return [
      "controlled consumer audit (dryRunOnly=true)",
      "structural readiness verification",
    ];
  }
  if (status === "SOURCE_PRESENT_AUDIT_ONLY") {
    return [
      "source-present gate verification",
      "structural audit only",
    ];
  }
  // BLOCKED statuses
  return [
    "structural audit only",
    "source-present gate verification",
  ];
}

function getRequiredNextEvidence(
  sourceName: SourceName,
  status: SimulationInputStatus
): string[] {
  switch (sourceName) {
    case "MonthlyRevenue":
      if (status === "SIMULATION_INPUT_ELIGIBLE") {
        return [
          "Confirm simulation framework design before execution",
          "Do not execute simulation without explicit P39+ authorization",
        ];
      }
      if (status === "CONSUMER_READY_AUDIT_ONLY") {
        return ["Complete P36/P37 consumer integration pipeline"];
      }
      return ["Resolve PIT metadata or quality evidence gaps"];

    case "NewsEvent":
      return [
        "NLP quality audit (entity extraction, relevance scoring)",
        "Symbol linkage validation (ticker mapping accuracy)",
        "Source diversity analysis (reduce 84% Yahoo RSS concentration)",
        "Consumer integration design in src/lib/onlineValidation/",
      ];

    case "FinancialReport":
      return [
        "Explicit authorization: YES apply FinancialReport releaseDate migration to dev DB",
        "Apply schema migration (releaseDate, releaseDateSource, releaseDateConfidence)",
        "Re-run source-present gate scan after migration",
      ];

    case "Chip":
      return [
        "Explicit authorization: YES apply Chip availableAt migration to dev DB",
        "Apply schema migration (availableAt field)",
        "Validate availableAt prod logs against distribution lag data",
        "Lag evidence quantification (lag distribution, P50/P95)",
      ];

    case "Quote":
      if (status === "SIMULATION_INPUT_ELIGIBLE") {
        return [
          "Confirm simulation framework design before execution",
        ];
      }
      return ["Confirm PIT_SAFE_CONFIRMED for Quote OHLCV data"];

    case "Regime":
      if (status === "SIMULATION_INPUT_ELIGIBLE") {
        return [
          "Confirm simulation framework design before execution",
        ];
      }
      return ["Confirm PIT_SAFE_CONFIRMED for Regime classification data"];

    default:
      return [];
  }
}
