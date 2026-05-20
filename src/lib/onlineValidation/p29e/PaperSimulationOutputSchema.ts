/**
 * P29E: Paper Simulation Output Schema
 * paper-only / simulation-only / NOT investment recommendation
 *
 * All simulation runs MUST produce output conforming to this schema.
 * Production scoring fields are FORBIDDEN in this schema.
 */

export type SimulationMode = "paper_only";

export type LeakageGateStatus =
  | "NOT_EVALUATED_SCAFFOLD_ONLY"
  | "PASSED"
  | "FAILED_FUTURE_LABEL_DETECTED"
  | "FAILED_OUTCOME_FIELD_DETECTED"
  | "FAILED_MUTATION_FLAG_TRUE"
  | "FAILED_MISSING_PAPER_ONLY_MARKER"
  | "FAILED_MISSING_NOT_INVESTMENT_RECOMMENDATION";

export type SourceFeaturePitStatus =
  | "AVAILABLE_NEEDS_VALIDATION"
  | "AVAILABLE_PIT_SAFE"
  | "HIGH_RISK_SOURCE_ABSENT"
  | "WAITING_FOR_OPERATOR_SOURCE"
  | "UNKNOWN";

/**
 * Core paper simulation run output.
 * Fields that assert real performance, ROI, alpha, edge, or investment
 * recommendations are STRUCTURALLY FORBIDDEN (not present in this interface).
 */
export interface PaperSimulationOutput {
  /** Unique run identifier. Deterministic from seed + asOfDate + candidateId. */
  runId: string;

  /** Simulation date (YYYY-MM-DD). Must be in the past for scaffold runs. */
  asOfDate: string;

  /** Always "paper_only" — enforced by LeakageGatePlaceholder. */
  simulationMode: SimulationMode;

  /** Contract version from P29C. */
  contractVersion: string;

  /** Strategy candidate identifier. */
  candidateId: string;

  /** Feature set snapshot identifier used as input. */
  sourceFeatureSet: string;

  /** PIT safety status of source features at time of run. */
  sourceFeaturePitStatus: SourceFeaturePitStatus;

  /** Reference to the input snapshot (file path or identifier, never real data). */
  inputSnapshotRef: string;

  /** Reference to the output artifact (file path or identifier). */
  outputRef: string;

  /** Leakage gate check result. SCAFFOLD_ONLY = placeholder not yet fully implemented. */
  leakageGateStatus: LeakageGateStatus;

  /**
   * Mutation safety flags — ALL must be false in paper mode.
   * A true value MUST be treated as a critical error.
   */
  scoringMutation: false;
  corpusMutation: false;
  optimizerExecuted: false;
  realBacktestExecuted: false;

  /** ISO8601 timestamp of when this scaffold output was generated. */
  generatedAt: string;

  /** Non-binding observational notes. Must not contain performance claims. */
  warnings: string[];

  /**
   * Mandatory disclaimer flag.
   * MUST always be true. If false, the output must be rejected.
   */
  notInvestmentRecommendation: true;

  /** Observability-only notes for pipeline tracing. */
  scaffoldNotes?: string[];
}

/**
 * Fields that MUST NOT appear in PaperSimulationOutput.
 * Listed here for documentation and LeakageGatePlaceholder enforcement.
 *
 * FORBIDDEN_OUTPUT_FIELDS = [
 *   "roi", "returnPct", "winRate", "alpha", "edge", "profit",
 *   "outperformance", "realizedReturn", "outcomePrice",
 *   "buySignal", "sellSignal", "recommendation",
 *   "forecastedReturn", "expectedAlpha", "strategyEdge"
 * ]
 */
export const FORBIDDEN_OUTPUT_FIELDS = [
  "roi",
  "returnPct",
  "winRate",
  "alpha",
  "edge",
  "profit",
  "outperformance",
  "realizedReturn",
  "outcomePrice",
  "buySignal",
  "sellSignal",
  "recommendation",
  "forecastedReturn",
  "expectedAlpha",
  "strategyEdge",
] as const;

export type ForbiddenOutputField = (typeof FORBIDDEN_OUTPUT_FIELDS)[number];

/** Validate that an output object contains no forbidden fields. */
export function assertNoForbiddenFields(
  output: Record<string, unknown>
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const field of FORBIDDEN_OUTPUT_FIELDS) {
    if (field in output) {
      violations.push(field);
    }
  }
  return { valid: violations.length === 0, violations };
}
