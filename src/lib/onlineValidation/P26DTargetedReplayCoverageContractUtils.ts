// P26DTargetedReplayCoverageContractUtils.ts
// P26D: Targeted Post-Migration Replay / Coverage Comparison
// ZERO external imports. Pure functions only. No random number generation. No mutation.
// No outcome fields (outcomePrice/returnPct/realizedReturnClass).
// No scoring path modification.

export const P26D_COVERAGE_CONTRACT_VERSION = "v0";

export const P26D_COVERAGE_DIMENSIONS = {
  monthlyRevenueAvailableAsOf: {
    description: "MonthlyRevenue row is visible when releaseDate <= asOfDate (Taiwan UTC+8)",
    contextType: "MonthlyRevenue",
    gateField: "releaseDate",
    readOnly: true,
    entersAlphaScore: false,
  },
  monthlyRevenueReasonContextPresent: {
    description: "MonthlyRevenue rows have non-empty reasonContext after P26A enrichment",
    contextType: "MonthlyRevenue",
    gateField: "reasonContext",
    readOnly: true,
    entersAlphaScore: false,
  },
  monthlyRevenueFactorEvidencePresent: {
    description: "MonthlyRevenue rows have non-empty factorEvidence after P26A enrichment",
    contextType: "MonthlyRevenue",
    gateField: "factorEvidence",
    readOnly: true,
    entersAlphaScore: false,
  },
  newsEventContextVisibleAsOf: {
    description: "NewsEvent context visible when publishedAt <= asOfDate (Taiwan UTC+8). ingestedAt is observability only.",
    contextType: "NewsEvent",
    gateField: "publishedAt",
    readOnly: true,
    entersAlphaScore: false,
  },
  financialReportContextVisibleAsOf: {
    description: "FinancialReport context visible per availabilityDate priority: filingDate→announcementDate→publishedAt→availableAt",
    contextType: "FinancialReport",
    gateField: "availabilityDate",
    readOnly: true,
    entersAlphaScore: false,
  },
  contextReadOnly: {
    description: "All three context adapters are read-only — no mutation of input rows or corpus",
    contextType: "ALL",
    readOnly: true,
    entersAlphaScore: false,
  },
  entersAlphaScoreFalseForNewsAndFinancial: {
    description: "NewsEvent and FinancialReport contexts do not enter alphaScore or recommendationBucket computation",
    contextType: "NewsEvent|FinancialReport",
    readOnly: true,
    entersAlphaScore: false,
  },
  alphaScoreInvariant: {
    description: "alphaScore values in P3/P19 corpus are unchanged vs P26C baseline (0 mismatch)",
    contextType: "ScoringInvariant",
    readOnly: true,
    entersAlphaScore: false,
  },
  recommendationBucketInvariant: {
    description: "recommendationBucket values in P3/P19 corpus are unchanged vs P26C baseline (0 mismatch)",
    contextType: "ScoringInvariant",
    readOnly: true,
    entersAlphaScore: false,
  },
};

export const P26D_REPLAY_TARGET_SCOPE = {
  corpusFiles: [
    "outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl",
    "outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl",
  ],
  fixtureTargets: [
    "outputs/online_validation/fixtures/p26b_news_events_fixture.json",
    "outputs/online_validation/fixtures/p26c_financial_reports_fixture.json",
  ],
  walkthrough: "outputs/online_validation/p5walkthrough_review.json",
  reasonQualityCompare: "outputs/online_validation/p26a_walkthrough_reason_quality_compare.json",
  expectedP3Rows: 4500,
  expectedP19Rows: 4500,
  expectedTotalRows: 9000,
  asOfDate: "2026-05-13",
};

export const P26D_EXCLUDED_SCOPE = {
  noCorpusRegeneration: true,
  noDBWrite: true,
  noScoringChange: true,
  noExternalAPI: true,
  noLLM: true,
  noMathRandom: true,
  noOutcomeFields: true,
  description: "P26D is read-only coverage analysis. No corpus files are modified. No scoring path is touched. No external API or LLM calls. No outcome fields (outcomePrice/returnPct/realizedReturnClass) are read.",
  forbiddenFieldAccess: ["outcomePrice", "returnPct", "realizedReturnClass"],
  forbiddenClaims: ["ROI", "win-rate", "alpha edge", "profit guarantee", "outperform", "investment recommendation"],
};

export const P26D_OUTPUT_CLASSIFICATIONS = {
  COVERAGE_READY_FOR_CORPUS_EXPANSION: "COVERAGE_READY_FOR_CORPUS_EXPANSION",
  COVERAGE_PARTIAL_NEEDS_SOURCE_MAPPING: "COVERAGE_PARTIAL_NEEDS_SOURCE_MAPPING",
  COVERAGE_BLOCKED_BY_ARTIFACTS: "COVERAGE_BLOCKED_BY_ARTIFACTS",
  SCORING_INVARIANCE_BROKEN: "SCORING_INVARIANCE_BROKEN",
  PIT_CONTEXT_GATE_BROKEN: "PIT_CONTEXT_GATE_BROKEN",
  FAILED_TESTS: "FAILED_TESTS",
};

const VALID_CLASSIFICATIONS = new Set(Object.values(P26D_OUTPUT_CLASSIFICATIONS));

export function buildP26DCoverageContractV0(): {
  version: string;
  phase: string;
  generatedAt: string;
  coverageDimensions: typeof P26D_COVERAGE_DIMENSIONS;
  replayTargetScope: typeof P26D_REPLAY_TARGET_SCOPE;
  excludedScope: typeof P26D_EXCLUDED_SCOPE;
  outputClassifications: typeof P26D_OUTPUT_CLASSIFICATIONS;
  disclaimer: string;
} {
  return {
    version: P26D_COVERAGE_CONTRACT_VERSION,
    phase: "P26D-HARDRESET",
    generatedAt: "2026-05-13",
    coverageDimensions: P26D_COVERAGE_DIMENSIONS,
    replayTargetScope: P26D_REPLAY_TARGET_SCOPE,
    excludedScope: P26D_EXCLUDED_SCOPE,
    outputClassifications: P26D_OUTPUT_CLASSIFICATIONS,
    disclaimer:
      "No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims. Research and coverage analysis only.",
  };
}

export function validateP26DCoverageContractCompleteness(contract: ReturnType<typeof buildP26DCoverageContractV0>): {
  valid: boolean;
  missingFields: string[];
} {
  const requiredFields = [
    "version",
    "phase",
    "generatedAt",
    "coverageDimensions",
    "replayTargetScope",
    "excludedScope",
    "outputClassifications",
    "disclaimer",
  ];
  const missingFields = requiredFields.filter(
    (f) => !(f in contract) || contract[f as keyof typeof contract] === undefined
  );

  const requiredDimensions = [
    "monthlyRevenueAvailableAsOf",
    "monthlyRevenueReasonContextPresent",
    "monthlyRevenueFactorEvidencePresent",
    "newsEventContextVisibleAsOf",
    "financialReportContextVisibleAsOf",
    "contextReadOnly",
    "entersAlphaScoreFalseForNewsAndFinancial",
    "alphaScoreInvariant",
    "recommendationBucketInvariant",
  ];
  const missingDimensions = requiredDimensions.filter(
    (d) => !(d in (contract.coverageDimensions || {}))
  );
  missingFields.push(...missingDimensions.map((d) => `coverageDimensions.${d}`));

  const requiredClassifications = Object.keys(P26D_OUTPUT_CLASSIFICATIONS);
  const missingClassifications = requiredClassifications.filter(
    (c) => !(c in (contract.outputClassifications || {}))
  );
  missingFields.push(...missingClassifications.map((c) => `outputClassifications.${c}`));

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

export function isP26DCoverageClassificationValid(classification: string): boolean {
  return VALID_CLASSIFICATIONS.has(classification);
}
