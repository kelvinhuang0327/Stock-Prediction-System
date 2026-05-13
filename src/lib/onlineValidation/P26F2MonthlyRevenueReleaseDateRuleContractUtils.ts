// P26F2-HARDRESET: MonthlyRevenue ReleaseDate Population Rule Contract v1
// ZERO external imports — pure TypeScript, no side-effects, no DB access

export const P26F2_RELEASE_DATE_RULE_CONTRACT_VERSION = "v1";

export const P26F2_INFERENCE_RULE = {
  ruleName: "INFERRED_NEXT_MONTH_10TH",
  description: "candidateReleaseDate = first day of (year/month + 1 month), specifically the 10th day",
  examples: [
    { year: 2026, month: 2, candidateReleaseDate: "2026-03-10" },
    { year: 2026, month: 3, candidateReleaseDate: "2026-04-10" },
    { year: 2026, month: 12, candidateReleaseDate: "2027-01-10" },
  ],
  confidence: "LOW",
  source: "INFERRED_NEXT_MONTH_10TH",
  needsManualReview: true,
  isVerifiedOfficialDate: false,
};

export const P26F2_PIT_SAFETY_RULES = {
  visibilityGate: "candidateReleaseDate <= asOfDate",
  nullCandidateIsNotVisible: true,
  yearMonthAreNotVisibilityGates: true,
  createdAtIsNotVisibilityGate: true,
  existingReleaseDateNotOverwritten: true,
};

export const P26F2_DRY_RUN_CONTRACT = {
  outputMode: "DRY_RUN_ONLY",
  writeAllowed: false,
  productionBackfillAllowed: false,
  corpusOverwriteAllowed: false,
  databaseWriteAllowed: false,
  migrationApplyAllowed: false,
  requiresManualApproval: true,
};

export const P26F2_EXCLUDED_SCOPE = {
  dbWrite: false,
  corpusGeneration: false,
  scoringChange: false,
  optimizer: false,
  externalApi: false,
  performanceClaim: false,
};

export const P26F2_OUTPUT_CLASSIFICATIONS = {
  NO_COVERAGE: "P26F2_RELEASE_DATE_CANDIDATE_NO_COVERAGE",
  PARTIAL_COVERAGE: "P26F2_RELEASE_DATE_CANDIDATE_PARTIAL_COVERAGE",
  FULL_COVERAGE: "P26F2_RELEASE_DATE_CANDIDATE_FULL_COVERAGE",
  INVALID_CANDIDATES: "P26F2_RELEASE_DATE_CANDIDATE_INVALID",
  DRY_RUN_ONLY: "P26F2_RELEASE_DATE_DRY_RUN_ONLY",
  PREFLIGHT_PASS: "P26F2_PREFLIGHT_PASS",
  QUALITY_GATE_PASS: "P26F2_QUALITY_GATE_PASS",
  PIT_SAFETY_PASS: "P26F2_PIT_SAFETY_VALIDATION_PASS",
};

export function buildP26F2ReleaseRuleDateContractV1(): object {
  return {
    version: P26F2_RELEASE_DATE_RULE_CONTRACT_VERSION,
    phase: "P26F2-HARDRESET",
    inferenceRule: P26F2_INFERENCE_RULE,
    pitSafetyRules: P26F2_PIT_SAFETY_RULES,
    dryRunContract: P26F2_DRY_RUN_CONTRACT,
    excludedScope: P26F2_EXCLUDED_SCOPE,
    outputClassifications: P26F2_OUTPUT_CLASSIFICATIONS,
    status: "CONTRACT_ACTIVE",
  };
}

export function validateP26F2ContractCompleteness(contract: Record<string, unknown>): { valid: boolean; violations: string[] } {
  const required = ["version", "phase", "inferenceRule", "pitSafetyRules", "dryRunContract", "excludedScope", "outputClassifications", "status"];
  const violations: string[] = [];
  for (const field of required) {
    if (!(field in contract)) {
      violations.push(`Missing required field: ${field}`);
    }
  }
  return { valid: violations.length === 0, violations };
}

export function isP26F2CandidateDateVisibilityGate(fieldName: string): boolean {
  return fieldName === "candidateReleaseDate";
}

export function getP26F2InferredCandidateReleaseDate(year: number, month: number): string {
  if (month < 1 || month > 12 || !Number.isInteger(year) || !Number.isInteger(month)) {
    return "INVALID";
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const mm = String(nextMonth).padStart(2, '0');
  return `${nextYear}-${mm}-10`;
}
