/**
 * P26F-HARDRESET: MonthlyRevenue Source Mapping Contract v1
 *
 * Defines the PIT-safe mapping contract for MonthlyRevenue source.
 * MonthlyRevenue is read-only metadata ONLY — it does NOT enter alphaScore or recommendationBucket.
 * Visibility gate: releaseDate <= asOfDate (ONLY field that gates visibility).
 * stockId = Stock.id = symbol — join key.
 *
 * Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.
 * ZERO external imports.
 */

export const P26F_MAPPING_CONTRACT_VERSION = "v1";

export const P26F_SOURCE_FIELDS = {
  symbol: 'stockId',              // MonthlyRevenue.stockId = Stock.id = symbol
  year: 'year',
  month: 'month',
  revenue: 'revenue',
  yoyGrowth: 'yoyGrowth',
  momGrowth: 'momGrowth',
  releaseDate: 'releaseDate',     // PIT GATE — only this field gates visibility
  releaseDateSource: 'releaseDateSource',
  releaseDateConfidence: 'releaseDateConfidence',
  createdAt: 'createdAt',         // observability only
};

export const P26F_PIT_GATE_FIELD = "releaseDate";

export const P26F_OBSERVABILITY_ONLY_FIELDS: string[] = [
  'createdAt',
  'releaseDateSource',
  'releaseDateConfidence',
  'year',
  'month',
];

export const P26F_JOIN_RULES = {
  corpusJoinKey: 'symbol',
  sourceJoinKey: 'stockId',
  joinDescription: 'corpusRow.symbol === monthlyRevenue.stockId (Stock.id = symbol)',
  joinType: 'LEFT_JOIN_EXACT_SYMBOL',
  caseSensitive: true,
};

export const P26F_PIT_RULES = {
  visibilityGate: "releaseDate <= asOfDate",
  nullReleaseDateIsNotVisible: true,
  yearMonthAreNotVisibilityGates: true,
  createdAtIsNotVisibilityGate: true,
  releaseDateSourceIsNotVisibilityGate: true,
  releaseDateConfidenceIsNotVisibilityGate: true,
};

export const P26F_CANDIDATE_OUTPUT_CONTRACT = {
  outputType: 'CANDIDATE_DRY_RUN_ONLY',
  overwritesFrozenCorpus: false,
  entersAlphaScore: false,
  readOnly: true,
  contextFieldName: 'p26fMonthlyRevenueContext',
  scoringChangeAllowed: false,
  optimizerAllowed: false,
  forbiddenOutputFields: ['outcomePrice', 'returnPct', 'realizedReturnClass'],
};

export const P26F_EXCLUDED_SCOPE = {
  noROI: true,
  noBuy: true,
  noSell: true,
  noProfit: true,
  noOutperform: true,
  noWinRate: true,
  noAlphaClaim: true,
  noEdgeClaim: true,
  noGuarantee: true,
  noInvestmentRecommendation: true,
  noScoringFormulaChange: true,
  noOptimizerAuthorization: true,
  noFormalCorpusReplacement: true,
  noCandidateToProductionPromotion: true,
};

export interface P26FMappingContractV1 {
  contractVersion: string;
  phase: string;
  generatedAt: string;
  pitGateField: string;
  pitRules: typeof P26F_PIT_RULES;
  sourceFields: typeof P26F_SOURCE_FIELDS;
  joinRules: typeof P26F_JOIN_RULES;
  observabilityOnlyFields: string[];
  candidateOutputContract: typeof P26F_CANDIDATE_OUTPUT_CONTRACT;
  excludedScope: typeof P26F_EXCLUDED_SCOPE;
  disclaimer: string;
}

export function buildP26FMappingContractV1(): P26FMappingContractV1 {
  return {
    contractVersion: P26F_MAPPING_CONTRACT_VERSION,
    phase: 'P26F-HARDRESET',
    generatedAt: '2026-05-13T00:00:00.000Z',
    pitGateField: P26F_PIT_GATE_FIELD,
    pitRules: P26F_PIT_RULES,
    sourceFields: P26F_SOURCE_FIELDS,
    joinRules: P26F_JOIN_RULES,
    observabilityOnlyFields: P26F_OBSERVABILITY_ONLY_FIELDS,
    candidateOutputContract: P26F_CANDIDATE_OUTPUT_CONTRACT,
    excludedScope: P26F_EXCLUDED_SCOPE,
    disclaimer: 'No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims. Candidate dry-run only.',
  };
}

export function validateP26FMappingContractCompleteness(contract: P26FMappingContractV1): { valid: boolean; missingFields: string[] } {
  const requiredFields: (keyof P26FMappingContractV1)[] = [
    'contractVersion',
    'phase',
    'generatedAt',
    'pitGateField',
    'pitRules',
    'sourceFields',
    'joinRules',
    'observabilityOnlyFields',
    'candidateOutputContract',
    'excludedScope',
    'disclaimer',
  ];
  const missingFields = requiredFields.filter(f => contract[f] === undefined || contract[f] === null);
  return { valid: missingFields.length === 0, missingFields };
}

export function getP26FPitGateField(): string {
  return P26F_PIT_GATE_FIELD;
}

export function isP26FVisibilityGateField(fieldName: string): boolean {
  return fieldName === P26F_PIT_GATE_FIELD;
}

export function isP26FObservabilityOnlyField(fieldName: string): boolean {
  return P26F_OBSERVABILITY_ONLY_FIELDS.includes(fieldName);
}
