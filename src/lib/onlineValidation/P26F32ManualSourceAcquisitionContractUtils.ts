// P26F3-2-HARDRESET: Manual Source Acquisition Contract Utils
// DISCLAIMER: Does not constitute investment advice.
// No DB write. No corpus overwrite. No scoring change. Manual acceptance only.

export const P26F3_2_CONTRACT_VERSION = "v1";

export const P26F3_2_TARGET_PERIODS: string[] = [
  "2025-09", "2025-10", "2025-11", "2025-12", "2026-01",
];

export const P26F3_2_TARGET_SYMBOLS: string[] = [
  "0055","00712","00738U","00830","00891","00903",
  "1210","1308","1314","1319","1326","1402","1434",
  "1513","1536","1560","1598","1605","1710","1717",
  "1802","2317","2330","2454","6415",
];

export const P26F3_2_ACCEPTED_FORMATS: string[] = ["csv", "json", "jsonl"];

export const P26F3_2_REQUIRED_FIELDS: string[] = [
  "stockId",
  "year",
  "month",
  "revenue",
  "releaseDate",
  "sourceName",
  "sourceFileName",
];

export const P26F3_2_OPTIONAL_FIELDS: string[] = [
  "companyName",
  "yoyGrowth",
  "momGrowth",
  "accumulatedRevenue",
  "accumulatedYoyGrowth",
  "sourceUrl",
  "sourceHash",
];

export const P26F3_2_FORBIDDEN_FIELDS: string[] = [
  "outcomePrice",
  "returnPct",
  "realizedReturnClass",
];

export const P26F3_2_ALLOWED_SOURCE_NAMES: string[] = [
  "TWSE", "MOPS", "OFFICIAL", "MANUAL",
];

export const P26F3_2_DRY_RUN_CONTRACT = {
  outputMode: "MANUAL_SOURCE_ACCEPTANCE_ONLY",
  dbWriteAllowed: false,
  corpusWriteAllowed: false,
  scoringChangeAllowed: false,
  optimizerAllowed: false,
  externalFetchAllowed: false,
  fabricatedDataAllowed: false,
  unknownSourceAllowed: false,
  requiresManualApproval: true,
};

export const P26F3_2_PIT_RULES = {
  visibilityGate: "releaseDate <= asOfDate",
  yearMonthAreRevenuePeriodsOnly: true,
  releaseDateMustBeVerifiedOfficial: true,
  inferredReleaseDateNotAllowed: false,
  createdAtIsNotVisibilityGate: true,
};

export const P26F3_2_CLASSIFICATIONS = {
  SOURCE_NOT_PROVIDED_PACKAGE_READY: "P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY",
  MANUAL_SOURCE_ACCEPTED_DRY_RUN: "P26F3_2_MANUAL_SOURCE_ACCEPTED_DRY_RUN",
  SOURCE_FILES_REJECTED: "P26F3_2_SOURCE_FILES_REJECTED",
  ACCEPTED_SOURCE_COVERAGE_AVAILABLE: "P26F3_2_ACCEPTED_SOURCE_COVERAGE_AVAILABLE",
  UNEXPECTED_WRITE_DETECTED: "P26F3_2_UNEXPECTED_WRITE_DETECTED",
  FAILED_TESTS: "P26F3_2_FAILED_TESTS",
  BLOCKED_BY_P26F3_ARTIFACTS: "P26F3_2_BLOCKED_BY_P26F3_ARTIFACTS",
};

export function buildP26F32ManualSourceAcquisitionContractV1(): object {
  return {
    version: P26F3_2_CONTRACT_VERSION,
    targetPeriods: P26F3_2_TARGET_PERIODS,
    targetSymbols: P26F3_2_TARGET_SYMBOLS,
    acceptedFormats: P26F3_2_ACCEPTED_FORMATS,
    requiredFields: P26F3_2_REQUIRED_FIELDS,
    optionalFields: P26F3_2_OPTIONAL_FIELDS,
    forbiddenFields: P26F3_2_FORBIDDEN_FIELDS,
    allowedSourceNames: P26F3_2_ALLOWED_SOURCE_NAMES,
    dryRunContract: P26F3_2_DRY_RUN_CONTRACT,
    pitRules: P26F3_2_PIT_RULES,
    classifications: P26F3_2_CLASSIFICATIONS,
    dropzonePath: "data/manual/monthly-revenue/p26f3-2-dropzone/",
    disclaimer: [
      "Does not constitute investment advice.",
      "Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.",
    ],
  };
}

export function validateP26F32ContractCompleteness(contract: Record<string, unknown>): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const required = ["version","targetPeriods","targetSymbols","acceptedFormats","requiredFields","dryRunContract","pitRules"];
  for (const f of required) {
    if (!(f in contract)) violations.push(`Missing: ${f}`);
  }
  const drc = contract["dryRunContract"] as Record<string, unknown> | undefined;
  if (drc) {
    if (drc["dbWriteAllowed"] !== false) violations.push("dryRunContract.dbWriteAllowed must be false");
    if (drc["corpusWriteAllowed"] !== false) violations.push("dryRunContract.corpusWriteAllowed must be false");
    if (drc["fabricatedDataAllowed"] !== false) violations.push("dryRunContract.fabricatedDataAllowed must be false");
  }
  return { valid: violations.length === 0, violations };
}

export function isP26F32PeriodInTargetRange(period: string): boolean {
  return P26F3_2_TARGET_PERIODS.includes(period);
}

export function isP26F32SymbolInTargetSet(symbol: string): boolean {
  return P26F3_2_TARGET_SYMBOLS.includes(symbol);
}

export function isP26F32FormatAccepted(format: string): boolean {
  return P26F3_2_ACCEPTED_FORMATS.includes(format.toLowerCase());
}

export function isP26F32SourceNameAllowed(sourceName: string): boolean {
  return P26F3_2_ALLOWED_SOURCE_NAMES.includes(sourceName.toUpperCase());
}

export function detectP26F32ForbiddenFields(row: Record<string, unknown>): string[] {
  return P26F3_2_FORBIDDEN_FIELDS.filter(f => f in row && row[f] !== undefined && row[f] !== null);
}
