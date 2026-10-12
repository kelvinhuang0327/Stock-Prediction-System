/**
 * P29I: Quote / Regime / Chip PIT Audit Scanner
 *
 * paper-only / audit-only / NOT investment recommendation
 * Does NOT modify any production scoring, DB, corpus, or model.
 *
 * Consumes static audit evidence (from P29F) and applies the P29I PitSafetyRules
 * to produce a deterministic P29IPitScanResult for each source.
 *
 * This scanner does NOT:
 *   - Execute DB queries
 *   - Modify source files
 *   - Produce buy/sell/hold recommendations
 *   - Claim predictive performance or alpha/edge/returns
 */

import {
  isForbiddenField,
  matchedForbiddenPatterns,
  getMandatoryRules,
  getRuleById,
  P29IPitScanResult,
  PitRuleId,
} from "./PitSafetyRules";

// Re-export for consumers
export type { P29IPitScanResult };

// ---------------------------------------------------------------------------
// Scanner input types
// ---------------------------------------------------------------------------

export type SourcePitStatus =
  | "PIT_SAFE_VERIFIED"
  | "HIGH_RISK_SOURCE_ABSENT"
  | "STRUCTURAL_PLACEHOLDER_ONLY"
  | "PIT_UNVERIFIED_NEEDS_REPAIR"
  | "PIT_VIOLATION_CONFIRMED";

export interface SourceAuditInput {
  /**
   * Source name: Quote | Regime | Chip | MonthlyRevenue | FinancialReport | NewsEvent
   */
  sourceName: string;

  /**
   * Whether this source has an identifiable date/asOf field.
   */
  hasDateField: boolean;

  /**
   * The name of the date field (e.g. "date").
   */
  dateFieldName?: string;

  /**
   * Whether the date format is consistent between storage and the gate comparison.
   * true = consistent (e.g., ISO stored, ISO gate).
   * false = mismatch (e.g., YYYYMMDD schema comment but ISO actual — needs normalization).
   */
  dateFormatConsistent: boolean;

  /**
   * Whether a PIT gate (asOf filter) exists in the DB query path.
   */
  hasGate: boolean;

  /**
   * Whether the gate has been confirmed to work correctly (not bypass-able).
   * null = not inspected.
   */
  gateEffective: boolean | null;

  /**
   * Whether asOf is properly propagated from caller to DB query.
   */
  asOfPropagated: boolean | null;

  /**
   * List of field names present in this source's schema or output.
   * The scanner checks these against forbidden patterns.
   */
  knownFields: string[];

  /**
   * P29F classification result for this source.
   */
  p29fStatus: SourcePitStatus;

  /**
   * Whether there is P29F audit evidence backing the p29fStatus.
   */
  hasP29FEvidence: boolean;

  /**
   * Whether this source is permitted to enter alphaScore.
   */
  permittedInAlphaScore: boolean;

  /**
   * Whether a publication lag assumption applies to this source.
   * e.g., T chip data published ~6pm on T.
   */
  hasPublicationLagAssumption: boolean;

  /**
   * Human-readable description of the publication lag assumption, if any.
   */
  publicationLagDescription?: string;

  /**
   * Whether the simulation boundary (paperOnly=true, dryRun=true) is enforced by the runner.
   */
  simulationBoundaryEnforced: boolean;
}

// ---------------------------------------------------------------------------
// Scanner output types
// ---------------------------------------------------------------------------

export interface RuleCheckResult {
  ruleId: PitRuleId;
  passed: boolean;
  detail: string;
}

export interface SourceScanOutput {
  sourceName: string;
  result: P29IPitScanResult;
  ruleChecks: RuleCheckResult[];
  forbiddenFieldsFound: string[];
  assumptionNotes: string[];
  reportLine: string;
}

export interface ScannerReport {
  scannerVersion: string;
  capturedAt: string;
  overallResult: "ALL_PIT_SAFE" | "PARTIAL_ISSUES" | "SCAN_FAILED";
  allowedAlphaScoreSources: string[];
  blockedSources: string[];
  sourceOutputs: SourceScanOutput[];
  summary: string;
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Scanner constant
// ---------------------------------------------------------------------------

export const P29I_SCANNER_VERSION = "p29i-audit-scanner-v1";

/**
 * Sources that are structurally permitted to enter alphaScore after PIT_SAFE_VERIFIED.
 */
export const ALPHA_SCORE_PERMITTED_SOURCES = ["Quote", "Regime", "Chip"] as const;

/**
 * Sources that are explicitly blocked from alphaScore (absent, high risk).
 */
export const ALPHA_SCORE_BLOCKED_SOURCES = ["FinancialReport", "NewsEvent"] as const;

/**
 * Sources not yet approved for alphaScore (structural placeholder or awaiting source).
 */
export const ALPHA_SCORE_NOT_YET_APPROVED_SOURCES = ["MonthlyRevenue"] as const;

// ---------------------------------------------------------------------------
// Core scanner logic
// ---------------------------------------------------------------------------

/**
 * Scan a single source input and return the classified output.
 * This function is deterministic: same input → same output.
 */
export function scanSource(input: SourceAuditInput): SourceScanOutput {
  const ruleChecks: RuleCheckResult[] = [];
  const forbiddenFieldsFound: string[] = [];
  const assumptionNotes: string[] = [];

  // Whether this source is in the live alphaScore pipeline
  const inPipeline = input.permittedInAlphaScore;

  // Check PSR-01: has date field — only mandatory for pipeline sources
  const r01 = getRuleById("PSR-01")!;
  ruleChecks.push({
    ruleId: "PSR-01",
    passed: !inPipeline || input.hasDateField,
    detail: !inPipeline
      ? `Not applicable — source '${input.sourceName}' is not in alphaScore pipeline`
      : input.hasDateField
      ? `Date field '${input.dateFieldName ?? "date"}' present`
      : "No date field identified — cannot apply PIT gate",
  });

  // Check PSR-02: date format consistency — only mandatory for pipeline sources
  const r02Passed = !inPipeline || input.dateFormatConsistent;
  ruleChecks.push({
    ruleId: "PSR-02",
    passed: r02Passed,
    detail: !inPipeline
      ? `Not applicable — source '${input.sourceName}' is not in alphaScore pipeline`
      : input.dateFormatConsistent
      ? "Date format consistent between storage and gate comparison"
      : "Date format mismatch detected — normalization required (P29F-Repair applies normalizePitDateToIso)",
  });

  // PSR-03, PSR-04, PSR-05, PSR-06, PSR-07: field pattern checks
  const fieldPatternRules: { ruleId: PitRuleId; description: string }[] = [
    { ruleId: "PSR-03", description: "Future price fields" },
    { ruleId: "PSR-04", description: "Future volume fields" },
    { ruleId: "PSR-05", description: "Future regime labels" },
    { ruleId: "PSR-06", description: "Post-outcome label fields" },
    { ruleId: "PSR-07", description: "Realized return fields" },
  ];

  // Combine field check into one pass then tag individual rules
  const allForbiddenFound: string[] = [];
  for (const field of input.knownFields) {
    if (isForbiddenField(field)) {
      allForbiddenFound.push(field);
    }
  }
  forbiddenFieldsFound.push(...allForbiddenFound);

  for (const { ruleId } of fieldPatternRules) {
    const passed = allForbiddenFound.length === 0;
    ruleChecks.push({
      ruleId,
      passed,
      detail: passed
        ? `No forbidden patterns found in ${input.knownFields.length} known fields`
        : `Forbidden fields found: ${allForbiddenFound.join(", ")} — matched by: ${
            allForbiddenFound.flatMap(matchedForbiddenPatterns).join(", ")
          }`,
    });
  }

  // PSR-08: gate presence — only required for sources in alphaScore pipeline
  ruleChecks.push({
    ruleId: "PSR-08",
    passed: !inPipeline || input.hasGate,
    detail: !inPipeline
      ? `Not applicable — source '${input.sourceName}' is not in alphaScore pipeline`
      : input.hasGate
      ? "PIT gate present in DB query path"
      : "PIT gate ABSENT — CRITICAL",
  });

  // PSR-09: asOf propagation — only required for pipeline sources
  const r09Passed = !inPipeline || input.asOfPropagated !== false;
  ruleChecks.push({
    ruleId: "PSR-09",
    passed: r09Passed,
    detail: !inPipeline
      ? `Not applicable — source '${input.sourceName}' is not in alphaScore pipeline`
      : input.asOfPropagated === true
      ? "asOf propagated correctly from caller to DB query"
      : input.asOfPropagated === null
      ? "asOf propagation not inspected (null — treat as unknown)"
      : "asOf NOT propagated — gate ineffective despite code presence",
  });

  // PSR-10: alphaScore governance
  const isPermitted = ALPHA_SCORE_PERMITTED_SOURCES.includes(
    input.sourceName as (typeof ALPHA_SCORE_PERMITTED_SOURCES)[number]
  );
  const alphaGovPass =
    input.permittedInAlphaScore
      ? input.p29fStatus === "PIT_SAFE_VERIFIED" && isPermitted
      : true; // Not permitted = correctly excluded from alphaScore
  ruleChecks.push({
    ruleId: "PSR-10",
    passed: alphaGovPass,
    detail: input.permittedInAlphaScore
      ? isPermitted && input.p29fStatus === "PIT_SAFE_VERIFIED"
        ? `Source '${input.sourceName}' is PIT_SAFE_VERIFIED and on permitted list`
        : `Source '${input.sourceName}' claims permittedInAlphaScore but is ${input.p29fStatus} — VIOLATION`
      : `Source '${input.sourceName}' correctly excluded from alphaScore`,
  });

  // PSR-11: FinancialReport blocked
  const r11Applies = input.sourceName === "FinancialReport";
  ruleChecks.push({
    ruleId: "PSR-11",
    passed: !r11Applies || !input.permittedInAlphaScore,
    detail: r11Applies
      ? input.permittedInAlphaScore
        ? "VIOLATION: FinancialReport must remain blocked"
        : "FinancialReport correctly blocked — filingDate PIT path unaudited"
      : `Not applicable (source is '${input.sourceName}')`,
  });

  // PSR-12: NewsEvent blocked
  const r12Applies = input.sourceName === "NewsEvent";
  ruleChecks.push({
    ruleId: "PSR-12",
    passed: !r12Applies || !input.permittedInAlphaScore,
    detail: r12Applies
      ? input.permittedInAlphaScore
        ? "VIOLATION: NewsEvent must remain blocked"
        : "NewsEvent correctly blocked — publishedAt vs ingestedAt PIT separation unaudited"
      : `Not applicable (source is '${input.sourceName}')`,
  });

  // PSR-13: MonthlyRevenue not in alphaScore
  const r13Applies = input.sourceName === "MonthlyRevenue";
  ruleChecks.push({
    ruleId: "PSR-13",
    passed: !r13Applies || !input.permittedInAlphaScore,
    detail: r13Applies
      ? input.permittedInAlphaScore
        ? "VIOLATION: MonthlyRevenue must not enter alphaScore until P26F4 source arrives and audit completes"
        : "MonthlyRevenue correctly excluded from alphaScore"
      : `Not applicable (source is '${input.sourceName}')`,
  });

  // PSR-14: publication lag documented (warning, not mandatory)
  if (input.hasPublicationLagAssumption) {
    assumptionNotes.push(
      `Publication lag: ${input.publicationLagDescription ?? "documented assumption required"}`
    );
  }
  ruleChecks.push({
    ruleId: "PSR-14",
    passed: !input.hasPublicationLagAssumption || !!input.publicationLagDescription,
    detail: input.hasPublicationLagAssumption
      ? input.publicationLagDescription
        ? `Publication lag documented: "${input.publicationLagDescription}"`
        : "Publication lag flagged but not described — WARN"
      : "No publication lag assumption applies",
  });

  // PSR-15: simulation boundary
  ruleChecks.push({
    ruleId: "PSR-15",
    passed: input.simulationBoundaryEnforced,
    detail: input.simulationBoundaryEnforced
      ? "Simulation boundary enforced (paperOnly=true, dryRun=true)"
      : "Simulation boundary NOT confirmed — WARN",
  });

  // PSR evidence check
  const missingEvidence = input.p29fStatus === "PIT_SAFE_VERIFIED" && !input.hasP29FEvidence;

  // ---------------------------------------------------------------------------
  // Derive result
  // ---------------------------------------------------------------------------
  const mandatoryFailures = ruleChecks
    .filter((rc) => !rc.passed)
    .filter((rc) => getMandatoryRules().some((r) => r.id === rc.ruleId && r.failOnViolation));

  let result: P29IPitScanResult;

  if (missingEvidence) {
    result = "BLOCKED_MISSING_EVIDENCE";
  } else if (mandatoryFailures.length > 0) {
    // Check if failures are only due to source being blocked (which is expected)
    const unexpectedFailures = mandatoryFailures.filter((rc) => {
      // PSR-10 for blocked sources: passing by design (not permittedInAlphaScore = correct)
      if (rc.ruleId === "PSR-10" && !input.permittedInAlphaScore) return false;
      // PSR-11/12/13 for non-relevant sources: passing by design
      if (rc.ruleId === "PSR-11" && input.sourceName !== "FinancialReport") return false;
      if (rc.ruleId === "PSR-12" && input.sourceName !== "NewsEvent") return false;
      if (rc.ruleId === "PSR-13" && input.sourceName !== "MonthlyRevenue") return false;
      return true;
    });
    if (unexpectedFailures.length > 0) {
      result = "FAIL_LEAKAGE_RISK";
    } else {
      result = input.hasPublicationLagAssumption ? "WARN_ASSUMPTION_REQUIRED" : "PASS_PIT_SAFE";
    }
  } else {
    result = input.hasPublicationLagAssumption ? "WARN_ASSUMPTION_REQUIRED" : "PASS_PIT_SAFE";
  }

  const reportLine = buildReportLine(input.sourceName, result, mandatoryFailures, assumptionNotes);

  return {
    sourceName: input.sourceName,
    result,
    ruleChecks,
    forbiddenFieldsFound,
    assumptionNotes,
    reportLine,
  };
}

/**
 * Scan multiple sources and produce a consolidated report.
 * Deterministic: same inputs → same report.
 */
export function runScan(inputs: SourceAuditInput[]): ScannerReport {
  const sourceOutputs = inputs.map(scanSource);

  const allowedAlphaScoreSources = sourceOutputs
    .filter((o) => o.result === "PASS_PIT_SAFE" || o.result === "WARN_ASSUMPTION_REQUIRED")
    .filter((o) =>
      ALPHA_SCORE_PERMITTED_SOURCES.includes(
        o.sourceName as (typeof ALPHA_SCORE_PERMITTED_SOURCES)[number]
      )
    )
    .map((o) => o.sourceName);

  const blockedSources = sourceOutputs
    .filter((o) => o.result === "FAIL_LEAKAGE_RISK" || o.result === "BLOCKED_MISSING_EVIDENCE")
    .map((o) => o.sourceName);

  const hasFail = sourceOutputs.some((o) => o.result === "FAIL_LEAKAGE_RISK");
  const hasMissing = sourceOutputs.some((o) => o.result === "BLOCKED_MISSING_EVIDENCE");
  // WARN_ASSUMPTION_REQUIRED on a pipeline source is still PIT_SAFE (assumption documented)

  let overallResult: ScannerReport["overallResult"];
  if (hasMissing) {
    overallResult = "SCAN_FAILED";
  } else if (hasFail) {
    overallResult = "PARTIAL_ISSUES";
  } else {
    overallResult = "ALL_PIT_SAFE";
  }

  return {
    scannerVersion: P29I_SCANNER_VERSION,
    capturedAt: new Date().toISOString(),
    overallResult,
    allowedAlphaScoreSources,
    blockedSources,
    sourceOutputs,
    summary: buildSummary(sourceOutputs, overallResult),
    disclaimer:
      "AUDIT-ONLY. Does not constitute investment advice. No trading signals generated. " +
      "PIT-safety validation for simulation governance purposes only.",
  };
}

// ---------------------------------------------------------------------------
// Report helpers
// ---------------------------------------------------------------------------

function buildReportLine(
  sourceName: string,
  result: P29IPitScanResult,
  mandatoryFailures: RuleCheckResult[],
  assumptionNotes: string[]
): string {
  const statusTag = {
    PASS_PIT_SAFE: "[PASS PIT_SAFE]",
    WARN_ASSUMPTION_REQUIRED: "[WARN ASSUMPTION_REQUIRED]",
    FAIL_LEAKAGE_RISK: "[FAIL LEAKAGE_RISK]",
    BLOCKED_MISSING_EVIDENCE: "[BLOCKED MISSING_EVIDENCE]",
  }[result];

  const parts = [`${statusTag} ${sourceName}`];
  if (mandatoryFailures.length > 0) {
    parts.push(`| Failed rules: ${mandatoryFailures.map((r) => r.ruleId).join(", ")}`);
  }
  if (assumptionNotes.length > 0) {
    parts.push(`| Assumptions: ${assumptionNotes.join("; ")}`);
  }
  return parts.join(" ");
}

function buildSummary(
  outputs: SourceScanOutput[],
  overallResult: ScannerReport["overallResult"]
): string {
  const pass = outputs.filter((o) => o.result === "PASS_PIT_SAFE").map((o) => o.sourceName);
  const warn = outputs.filter((o) => o.result === "WARN_ASSUMPTION_REQUIRED").map((o) => o.sourceName);
  const fail = outputs.filter((o) => o.result === "FAIL_LEAKAGE_RISK").map((o) => o.sourceName);
  const blocked = outputs.filter((o) => o.result === "BLOCKED_MISSING_EVIDENCE").map((o) => o.sourceName);

  return (
    `P29I PIT Audit Scanner result: ${overallResult}. ` +
    `PASS_PIT_SAFE: [${pass.join(", ")}]. ` +
    `WARN_ASSUMPTION_REQUIRED: [${warn.join(", ")}]. ` +
    `FAIL_LEAKAGE_RISK: [${fail.join(", ")}]. ` +
    `BLOCKED_MISSING_EVIDENCE: [${blocked.join(", ")}].`
  );
}

// ---------------------------------------------------------------------------
// Pre-built canonical inputs (based on P29F static audit evidence)
// ---------------------------------------------------------------------------

/**
 * Canonical scanner inputs derived from P29F audit evidence.
 * These reflect the verified state after P29F-Repair and P29X mainline consolidation.
 */
export const CANONICAL_P29I_SCAN_INPUTS: readonly SourceAuditInput[] = [
  {
    sourceName: "Quote",
    hasDateField: true,
    dateFieldName: "date",
    dateFormatConsistent: true, // ISO stored, normalizePitDateToIso applied (P29F-Repair)
    hasGate: true,
    gateEffective: true,
    asOfPropagated: true,
    knownFields: [
      "id", "symbol", "date", "open", "high", "low", "close", "volume",
      "changePercent", "turnoverRate", "createdAt",
    ],
    p29fStatus: "PIT_SAFE_VERIFIED",
    hasP29FEvidence: true,
    permittedInAlphaScore: true,
    hasPublicationLagAssumption: false,
    simulationBoundaryEnforced: true,
  },
  {
    sourceName: "Regime",
    hasDateField: true,
    dateFieldName: "date",
    dateFormatConsistent: true, // ISO-to-ISO, no normalization needed
    hasGate: true,
    gateEffective: true,
    asOfPropagated: true,
    knownFields: [
      "id", "symbol", "date", "close", "ma50", "ma200", "indexType", "createdAt",
    ],
    p29fStatus: "PIT_SAFE_VERIFIED",
    hasP29FEvidence: true,
    permittedInAlphaScore: true,
    hasPublicationLagAssumption: false,
    simulationBoundaryEnforced: true,
  },
  {
    sourceName: "Chip",
    hasDateField: true,
    dateFieldName: "date",
    dateFormatConsistent: true, // Stored as isoDate (P29F-Repair); schema comment stale
    hasGate: true,
    gateEffective: true,
    asOfPropagated: true,
    knownFields: [
      "id", "symbol", "date", "totalBuy", "totalSell", "foreignBuy", "foreignSell",
      "trustBuy", "trustSell", "dealerBuy", "dealerSell", "createdAt",
    ],
    p29fStatus: "PIT_SAFE_VERIFIED",
    hasP29FEvidence: true,
    permittedInAlphaScore: true,
    hasPublicationLagAssumption: true,
    publicationLagDescription:
      "T+0 institutional chip data published ~6pm on T. Post-close scoring assumption: " +
      "scoring runs after 6pm (T) or uses prior day data. Pre-market intraday use not supported.",
    simulationBoundaryEnforced: true,
  },
  {
    sourceName: "MonthlyRevenue",
    hasDateField: false,
    dateFormatConsistent: false,
    hasGate: false,
    gateEffective: null,
    asOfPropagated: null,
    knownFields: [],
    p29fStatus: "STRUCTURAL_PLACEHOLDER_ONLY",
    hasP29FEvidence: false,
    permittedInAlphaScore: false,
    hasPublicationLagAssumption: false,
    simulationBoundaryEnforced: true,
  },
  {
    sourceName: "FinancialReport",
    hasDateField: false,
    dateFormatConsistent: false,
    hasGate: false,
    gateEffective: null,
    asOfPropagated: null,
    knownFields: [],
    p29fStatus: "HIGH_RISK_SOURCE_ABSENT",
    hasP29FEvidence: false,
    permittedInAlphaScore: false,
    hasPublicationLagAssumption: false,
    simulationBoundaryEnforced: true,
  },
  {
    sourceName: "NewsEvent",
    hasDateField: false,
    dateFormatConsistent: false,
    hasGate: false,
    gateEffective: null,
    asOfPropagated: null,
    knownFields: [],
    p29fStatus: "HIGH_RISK_SOURCE_ABSENT",
    hasP29FEvidence: false,
    permittedInAlphaScore: false,
    hasPublicationLagAssumption: false,
    simulationBoundaryEnforced: true,
  },
] as const;
