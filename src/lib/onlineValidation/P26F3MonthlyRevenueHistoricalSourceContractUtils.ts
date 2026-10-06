// P26F3-HARDRESET: MonthlyRevenue Historical Source Acquisition Contract Utils v1
// DISCLAIMER: Does not constitute investment advice.
// Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
// No DB write. No corpus overwrite. No scoring formula change. Dry-run only.

export const P26F3_HISTORICAL_SOURCE_CONTRACT_VERSION = "v1";

export const P26F3_TARGET_PERIODS: string[] = [
  "2025-09",
  "2025-10",
  "2025-11",
  "2025-12",
  "2026-01",
];

export const P26F3_TARGET_SYMBOLS: string[] = [
  "0055","00712","00738U","00830","00891","00903",
  "1210","1308","1314","1319","1326","1402","1434",
  "1513","1536","1560","1598","1605","1710","1717",
  "1802","2317","2330","2454","6415",
];

export const P26F3_REQUIRED_SOURCE_FIELDS: string[] = [
  "stockId",
  "year",
  "month",
  "revenue",
  "releaseDate",
  "releaseDateSource",
];

export const P26F3_OPTIONAL_SOURCE_FIELDS: string[] = [
  "yoyGrowth",
  "momGrowth",
  "accumulatedRevenue",
  "accumulatedYoyGrowth",
  "industryCode",
  "companyName",
  "sourceFile",
  "sourceUrlHash",
  "rowHash",
];

export const P26F3_SOURCE_DRY_RUN_CONTRACT = {
  outputMode: "DRY_RUN_SOURCE_SYNC_ONLY",
  dbWriteAllowed: false,
  corpusOverwriteAllowed: false,
  scoringChangeAllowed: false,
  optimizerAllowed: false,
  externalFetchAllowed: false,
  fabricatedDataAllowed: false,
  requiresManualApproval: true,
};

export const P26F3_PIT_SOURCE_RULES = {
  visibilityGate: "releaseDate <= asOfDate",
  yearMonthAreRevenuePeriodsOnly: true,
  ingestionDateIsObservabilityOnly: true,
  inferredReleaseDateRequiresManualReview: true,
  verifiedReleaseDateRequiresOfficialSource: true,
  templateOnlyIsNotRealCoverage: true,
  createdAtIsNotVisibilityGate: true,
};

export const P26F3_RELEASE_DATE_CLASSIFICATIONS = {
  VERIFIED_OFFICIAL_DATE: "VERIFIED_OFFICIAL_DATE",
  INFERRED_NEXT_MONTH_10TH: "INFERRED_NEXT_MONTH_10TH",
  MISSING_RELEASE_DATE: "MISSING_RELEASE_DATE",
  NEEDS_MANUAL_REVIEW: "NEEDS_MANUAL_REVIEW",
};

export const P26F3_SOURCE_CLASSIFICATIONS = {
  HISTORICAL_SOURCE_COVERAGE_AVAILABLE: "P26F3_HISTORICAL_SOURCE_COVERAGE_AVAILABLE",
  SOURCE_NOT_FOUND_TEMPLATE_ONLY: "P26F3_SOURCE_NOT_FOUND_TEMPLATE_ONLY",
  SOURCE_FOUND_NO_COVERAGE: "P26F3_SOURCE_FOUND_NO_COVERAGE",
  BLOCKED_BY_P26F2_ARTIFACTS: "P26F3_BLOCKED_BY_P26F2_ARTIFACTS",
  PIT_LEAKAGE_DETECTED: "P26F3_PIT_LEAKAGE_DETECTED",
  SCORING_INVARIANCE_BROKEN: "P26F3_SCORING_INVARIANCE_BROKEN",
  UNEXPECTED_DB_WRITE_DETECTED: "P26F3_UNEXPECTED_DB_WRITE_DETECTED",
  FAILED_TESTS: "P26F3_FAILED_TESTS",
};

export function buildP26F3HistoricalSourceContractV1(): object {
  return {
    version: P26F3_HISTORICAL_SOURCE_CONTRACT_VERSION,
    targetPeriods: P26F3_TARGET_PERIODS,
    targetSymbols: P26F3_TARGET_SYMBOLS,
    requiredSourceFields: P26F3_REQUIRED_SOURCE_FIELDS,
    optionalSourceFields: P26F3_OPTIONAL_SOURCE_FIELDS,
    dryRunContract: P26F3_SOURCE_DRY_RUN_CONTRACT,
    pitSourceRules: P26F3_PIT_SOURCE_RULES,
    releaseDateClassifications: P26F3_RELEASE_DATE_CLASSIFICATIONS,
    sourceClassifications: P26F3_SOURCE_CLASSIFICATIONS,
    excludedScope: [
      "no production DB write",
      "no corpus overwrite",
      "no scoring formula change",
      "no external API without explicit fetch flag (disabled by default)",
      "no performance claims",
      "no fabricated revenue data",
    ],
    disclaimer: [
      "Does not constitute investment advice.",
      "Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.",
    ],
  };
}

export function validateP26F3ContractCompleteness(contract: Record<string, unknown>): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const required = ["version","targetPeriods","targetSymbols","requiredSourceFields","dryRunContract","pitSourceRules"];
  for (const field of required) {
    if (!(field in contract)) violations.push(`Missing field: ${field}`);
  }
  const drc = contract["dryRunContract"] as Record<string, unknown> | undefined;
  if (drc) {
    if (drc["dbWriteAllowed"] !== false) violations.push("dryRunContract.dbWriteAllowed must be false");
    if (drc["fabricatedDataAllowed"] !== false) violations.push("dryRunContract.fabricatedDataAllowed must be false");
  }
  return { valid: violations.length === 0, violations };
}

export function isP26F3PeriodInTargetRange(period: string): boolean {
  return P26F3_TARGET_PERIODS.includes(period);
}

export function isP26F3SymbolInTargetSet(symbol: string): boolean {
  return P26F3_TARGET_SYMBOLS.includes(symbol);
}

export function classifyP26F3ReleaseDateSource(row: { releaseDate?: string | null; releaseDateSource?: string | null }): string {
  if (!row.releaseDate) return P26F3_RELEASE_DATE_CLASSIFICATIONS.MISSING_RELEASE_DATE;
  if (row.releaseDateSource === "OFFICIAL") return P26F3_RELEASE_DATE_CLASSIFICATIONS.VERIFIED_OFFICIAL_DATE;
  if (row.releaseDateSource === "INFERRED_NEXT_MONTH_10TH") return P26F3_RELEASE_DATE_CLASSIFICATIONS.INFERRED_NEXT_MONTH_10TH;
  return P26F3_RELEASE_DATE_CLASSIFICATIONS.NEEDS_MANUAL_REVIEW;
}
