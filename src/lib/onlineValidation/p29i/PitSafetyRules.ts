/**
 * P29I: PIT Safety Rules
 * Formal rule set for Quote / Regime / Chip PIT validation audit.
 *
 * paper-only / audit-only / NOT investment recommendation
 * Does NOT modify any production scoring, DB, corpus, or model.
 *
 * These rules define what constitutes PIT-safe behavior for a data source
 * entering the alphaScore pipeline. They are used by the
 * QuoteRegimeChipPitAuditScanner to produce deterministic classifications.
 */

// ---------------------------------------------------------------------------
// Rule classification output types
// ---------------------------------------------------------------------------

/**
 * P29I scanner output classification for a source.
 *
 * PASS_PIT_SAFE             — All mandatory rules pass. No leakage evidence found.
 * WARN_ASSUMPTION_REQUIRED  — Passes mandatory rules but requires an explicit latency
 *                             or availability assumption to be documented.
 * FAIL_LEAKAGE_RISK         — One or more mandatory rules fail: future-data field present,
 *                             label contamination detected, or gate confirmed ineffective.
 * BLOCKED_MISSING_EVIDENCE  — Cannot classify: required evidence fields are absent.
 *                             Treat as untrusted until evidence is provided.
 */
export type P29IPitScanResult =
  | "PASS_PIT_SAFE"
  | "WARN_ASSUMPTION_REQUIRED"
  | "FAIL_LEAKAGE_RISK"
  | "BLOCKED_MISSING_EVIDENCE";

// ---------------------------------------------------------------------------
// Rule IDs and categories
// ---------------------------------------------------------------------------

export type PitRuleId =
  | "PSR-01" | "PSR-02" | "PSR-03" | "PSR-04" | "PSR-05"
  | "PSR-06" | "PSR-07" | "PSR-08" | "PSR-09" | "PSR-10"
  | "PSR-11" | "PSR-12" | "PSR-13" | "PSR-14" | "PSR-15";

export type PitRuleCategory =
  | "DATE_INTEGRITY"
  | "FUTURE_FIELD_REJECTION"
  | "LABEL_CONTAMINATION"
  | "GATE_EFFECTIVENESS"
  | "ALPHA_SCORE_GOVERNANCE"
  | "PUBLICATION_LAG"
  | "SIMULATION_BOUNDARY";

export interface PitSafetyRule {
  id: PitRuleId;
  category: PitRuleCategory;
  description: string;
  mandatory: boolean;
  /** If true, violation → FAIL_LEAKAGE_RISK. If false, violation → WARN_ASSUMPTION_REQUIRED. */
  failOnViolation: boolean;
  rationale: string;
}

// ---------------------------------------------------------------------------
// The 15 PIT Safety Rules
// ---------------------------------------------------------------------------

export const PIT_SAFETY_RULES: readonly PitSafetyRule[] = [
  {
    id: "PSR-01",
    category: "DATE_INTEGRITY",
    description: "Source must have an asOfDate or equivalent date field on every record.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "Without a date field, it is impossible to apply a PIT gate. Records without dates cannot be filtered by asOf and would leak future data into any time-stamped query.",
  },
  {
    id: "PSR-02",
    category: "DATE_INTEGRITY",
    description:
      "The date field format must be consistent between storage and the PIT gate comparison operator.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "Mixing ISO (YYYY-MM-DD) and YYYYMMDD formats in string comparison produces wrong results: " +
      "ISO '2026-06-01' compares as less than YYYYMMDD '20260115' due to ASCII '-' < '0'. " +
      "This would allow same-year future records to pass a YYYYMMDD gate. " +
      "Confirmed repaired by P29F-Repair (normalizePitDateToIso).",
  },
  {
    id: "PSR-03",
    category: "FUTURE_FIELD_REJECTION",
    description:
      "Source metadata and computed output must not contain future-price fields: " +
      "outcomePrice, outcomeClose, forecastReturn, horizonReturn, futureClose.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "These fields by definition reference a price that is not available at the prediction timestamp. " +
      "Their presence in any input to alphaScore constitutes direct future-data contamination.",
  },
  {
    id: "PSR-04",
    category: "FUTURE_FIELD_REJECTION",
    description:
      "Source must not contain forward-looking volume or order-flow fields: " +
      "nextVolume, futureVolume, nextTurnover, anticipatedFlow.",
    mandatory: true,
    failOnViolation: true,
    rationale: "Forward volume is unavailable at prediction time and introduces look-ahead bias.",
  },
  {
    id: "PSR-05",
    category: "FUTURE_FIELD_REJECTION",
    description:
      "Source must not contain future regime labels or forward-looking market state annotations: " +
      "nextRegime, regimeAfter, regimeOutcome, futureMarketState.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "Future regime labels require knowledge of future market data to assign. Their use in alphaScore " +
      "is equivalent to using future price path information.",
  },
  {
    id: "PSR-06",
    category: "LABEL_CONTAMINATION",
    description:
      "Source must not contain post-outcome label fields: " +
      "label, targetLabel, outcomeLabel, classLabel, winLabel, returnLabel.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "Labels derived from future outcomes encode the answer to the prediction problem. " +
      "Any source that includes such fields in the feature pipeline creates a trivial look-ahead leak.",
  },
  {
    id: "PSR-07",
    category: "LABEL_CONTAMINATION",
    description:
      "Source must not contain realized return fields used as features: " +
      "realizedReturn, returnPct, actualReturn, exPostReturn, holdingReturn.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "Realized returns require knowledge of future prices. Using them as features in scoring " +
      "is equivalent to trading on future price information.",
  },
  {
    id: "PSR-08",
    category: "GATE_EFFECTIVENESS",
    description:
      "The PIT gate (asOf filter) must be present in the DB query path for every source that enters alphaScore.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "Without a gate, all available records (including any future-dated ones) are included. " +
      "The gate is the primary defense against future-data contamination.",
  },
  {
    id: "PSR-09",
    category: "GATE_EFFECTIVENESS",
    description:
      "The asOf parameter must be correctly propagated from the caller " +
      "(ActiveScoringSnapshotBuilder / SignalFusionEngine) all the way to the DB query.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "A gate that exists in code but is never called with the correct asOf value provides no protection. " +
      "The propagation chain must be traceable end-to-end.",
  },
  {
    id: "PSR-10",
    category: "ALPHA_SCORE_GOVERNANCE",
    description:
      "Only sources with classification PIT_SAFE_VERIFIED may enter alphaScore. " +
      "Sources classified as HIGH_RISK_SOURCE_ABSENT, BLOCKED, or STRUCTURAL_PLACEHOLDER_ONLY must not influence the score.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "This is the hard governance gate established in P29A/P29B/P29C. Allowing unaudited sources into alphaScore " +
      "would invalidate the entire audit trail.",
  },
  {
    id: "PSR-11",
    category: "ALPHA_SCORE_GOVERNANCE",
    description:
      "FinancialReport must remain blocked from alphaScore until its filingDate PIT path is separately audited.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "FinancialReport filing dates are complex: announcement date, XBRL submission date, and market availability " +
      "are all different. Without a specific audit of this path, leakage risk is HIGH.",
  },
  {
    id: "PSR-12",
    category: "ALPHA_SCORE_GOVERNANCE",
    description:
      "NewsEvent must remain blocked from alphaScore until its publishedAt vs ingestedAt PIT separation is audited.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "News events may be ingested after the market close, potentially including post-announcement information. " +
      "The separation between event timestamp and ingestion timestamp is critical for PIT correctness.",
  },
  {
    id: "PSR-13",
    category: "ALPHA_SCORE_GOVERNANCE",
    description:
      "MonthlyRevenue must not enter alphaScore until source arrival (P26F4) and a separate PIT audit are complete.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "Monthly revenue data has a complex publication delay structure (filed weeks after month end). " +
      "Without a confirmed source and PIT audit, inclusion risk is HIGH.",
  },
  {
    id: "PSR-14",
    category: "PUBLICATION_LAG",
    description:
      "If a source has a known publication lag (e.g., chip data published ~6pm on T), " +
      "the lag assumption must be explicitly documented in the source's audit record.",
    mandatory: false,
    failOnViolation: false,
    rationale:
      "Publication lag is a known industry phenomenon. Documenting it explicitly allows " +
      "downstream consumers to reason about the assumption and validate it for their use case. " +
      "Undocumented lag assumptions create hidden look-ahead risk.",
  },
  {
    id: "PSR-15",
    category: "SIMULATION_BOUNDARY",
    description:
      "In simulation or dry-run mode, the paperOnly=true and dryRun=true flags must be set " +
      "and enforced by the runner before any source data is consumed.",
    mandatory: true,
    failOnViolation: true,
    rationale:
      "The simulation boundary is the last defense before any paper-mode logic could be mistaken " +
      "for production trading signals. Runtime enforcement (not just type-level) is required.",
  },
] as const;

// ---------------------------------------------------------------------------
// Rule lookup helpers
// ---------------------------------------------------------------------------

/**
 * Get a rule by ID. Returns undefined if not found.
 */
export function getRuleById(id: PitRuleId): PitSafetyRule | undefined {
  return PIT_SAFETY_RULES.find((r) => r.id === id);
}

/**
 * Get all mandatory rules.
 */
export function getMandatoryRules(): PitSafetyRule[] {
  return PIT_SAFETY_RULES.filter((r) => r.mandatory);
}

/**
 * Get all rules in a given category.
 */
export function getRulesByCategory(category: PitRuleCategory): PitSafetyRule[] {
  return PIT_SAFETY_RULES.filter((r) => r.category === category);
}

// ---------------------------------------------------------------------------
// Field pattern lists (shared with scanner)
// ---------------------------------------------------------------------------

/**
 * Field name substrings that indicate future price data.
 * Case-insensitive partial match.
 */
export const FUTURE_PRICE_PATTERNS = [
  "outcomeprice",
  "outcomeclose",
  "forecastreturn",
  "horizonreturn",
  "futureclose",
  "futureprice",
  "nextclose",
  "nextprice",
  "nextopen",
] as const;

/**
 * Field name substrings that indicate future volume / flow data.
 */
export const FUTURE_VOLUME_PATTERNS = [
  "nextvolume",
  "futurevolume",
  "nextturnover",
  "anticipatedflow",
  "futureflow",
] as const;

/**
 * Field name substrings that indicate forward regime labels.
 */
export const FUTURE_REGIME_PATTERNS = [
  "nextregime",
  "regimeafter",
  "regimeoutcome",
  "futuremarketstate",
  "forwardregime",
] as const;

/**
 * Field name substrings that indicate post-outcome labels.
 */
export const LABEL_CONTAMINATION_PATTERNS = [
  "label",
  "targetlabel",
  "outcomelabel",
  "classlabel",
  "winlabel",
  "returnlabel",
  "targetclass",
  "targetreturn",
] as const;

/**
 * Field name substrings that indicate realized returns.
 */
export const REALIZED_RETURN_PATTERNS = [
  "realizedreturn",
  "returnpct",
  "actualreturn",
  "expostreturn",
  "holdingreturn",
  "outcomepct",
  "futurereturns",
  "futurereturn",
] as const;

/**
 * Combined set of all forbidden field patterns.
 */
export const ALL_FORBIDDEN_FIELD_PATTERNS: readonly string[] = [
  ...FUTURE_PRICE_PATTERNS,
  ...FUTURE_VOLUME_PATTERNS,
  ...FUTURE_REGIME_PATTERNS,
  ...LABEL_CONTAMINATION_PATTERNS,
  ...REALIZED_RETURN_PATTERNS,
];

/**
 * Check whether a field name matches any forbidden pattern.
 * Case-insensitive.
 */
export function isForbiddenField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase().replace(/[_\-\s]/g, "");
  return ALL_FORBIDDEN_FIELD_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Return which specific patterns a field name matches.
 */
export function matchedForbiddenPatterns(fieldName: string): string[] {
  const lower = fieldName.toLowerCase().replace(/[_\-\s]/g, "");
  return ALL_FORBIDDEN_FIELD_PATTERNS.filter((p) => lower.includes(p));
}
