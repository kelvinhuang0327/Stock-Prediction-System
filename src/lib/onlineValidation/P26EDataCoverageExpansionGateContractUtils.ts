// P26EDataCoverageExpansionGateContractUtils.ts
// ZERO external imports — no import statements allowed. Pure functions only.

export const P26E_CONTRACT_VERSION = "v2";

export const P26E_SOURCE_CATEGORIES = {
  MONTHLY_REVENUE: 'MonthlyRevenue',
  NEWS_EVENT: 'NewsEvent',
  FINANCIAL_REPORT: 'FinancialReport',
} as const;

export const P26E_SOURCE_STATES = {
  REAL_DATA_READY: 'REAL_DATA_READY',
  REAL_DATA_PRESENT_BUT_NOT_MAPPED: 'REAL_DATA_PRESENT_BUT_NOT_MAPPED',
  FIXTURE_ONLY: 'FIXTURE_ONLY',
  MISSING_SOURCE: 'MISSING_SOURCE',
  PIT_GATE_READY_NO_SOURCE: 'PIT_GATE_READY_NO_SOURCE',
  BLOCKED_BY_CONTRACT: 'BLOCKED_BY_CONTRACT',
  UNKNOWN_REQUIRES_MANUAL_MAPPING: 'UNKNOWN_REQUIRES_MANUAL_MAPPING',
} as const;

export const P26E_EXPANSION_READINESS = {
  READY_FOR_EXPANSION_IMPLEMENTATION: 'READY_FOR_EXPANSION_IMPLEMENTATION',
  PARTIAL_SOURCE_MAPPING_REQUIRED: 'PARTIAL_SOURCE_MAPPING_REQUIRED',
  FIXTURE_ONLY_NOT_READY: 'FIXTURE_ONLY_NOT_READY',
  BLOCKED_BY_MISSING_SOURCE: 'BLOCKED_BY_MISSING_SOURCE',
  BLOCKED_BY_PIT_CONTRACT: 'BLOCKED_BY_PIT_CONTRACT',
  BLOCKED_BY_SCORING_INVARIANCE: 'BLOCKED_BY_SCORING_INVARIANCE',
} as const;

export const P26E_REQUIRED_CHECKS = {
  sourceExists: 'sourceExists',
  pitGate: 'pitGate',
  asOfKey: 'asOfKey',
  symbolJoin: 'symbolJoin',
  asOfDateJoin: 'asOfDateJoin',
  readOnly: 'readOnly',
  noOutcomeFields: 'noOutcomeFields',
  doesNotEnterScoring: 'doesNotEnterScoring',
  minCoverageCount: 'minCoverageCount',
} as const;

export const P26E_EXCLUDED_SCOPE = {
  noCorpusGeneration: true,
  noScoringChange: true,
  noOptimizer: true,
  noProductionDbWrite: true,
  noExternalApi: true,
  noPerformanceClaim: true,
} as const;

export const P26E_OUTPUT_CLASSIFICATIONS = {
  PARTIAL_SOURCE_MAPPING_REQUIRED: 'P26E_PARTIAL_SOURCE_MAPPING_REQUIRED',
  DATA_COVERAGE_EXPANSION_GATE_COMPLETE: 'P26E_DATA_COVERAGE_EXPANSION_GATE_COMPLETE',
  FIXTURE_ONLY_NOT_READY: 'P26E_FIXTURE_ONLY_NOT_READY',
  BLOCKED_BY_MISSING_SOURCE: 'P26E_BLOCKED_BY_MISSING_SOURCE',
  BLOCKED_BY_SCORING_INVARIANCE: 'P26E_BLOCKED_BY_SCORING_INVARIANCE',
  BLOCKED_BY_PIT_CONTRACT: 'P26E_BLOCKED_BY_PIT_CONTRACT',
} as const;

export interface P26EDataCoverageGateContractV2 {
  contractVersion: string;
  phase: string;
  generatedAt: string;
  sourceCategories: typeof P26E_SOURCE_CATEGORIES;
  sourceStates: typeof P26E_SOURCE_STATES;
  expansionReadiness: typeof P26E_EXPANSION_READINESS;
  requiredChecks: typeof P26E_REQUIRED_CHECKS;
  excludedScope: typeof P26E_EXCLUDED_SCOPE;
  outputClassifications: typeof P26E_OUTPUT_CLASSIFICATIONS;
  disclaimerContext: string;
}

export function buildP26EDataCoverageGateContractV2(): P26EDataCoverageGateContractV2 {
  return {
    contractVersion: P26E_CONTRACT_VERSION,
    phase: "P26E-HARDRESET",
    generatedAt: "2026-05-13",
    sourceCategories: P26E_SOURCE_CATEGORIES,
    sourceStates: P26E_SOURCE_STATES,
    expansionReadiness: P26E_EXPANSION_READINESS,
    requiredChecks: P26E_REQUIRED_CHECKS,
    excludedScope: P26E_EXCLUDED_SCOPE,
    outputClassifications: P26E_OUTPUT_CLASSIFICATIONS,
    disclaimerContext: "No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims. Research only.",
  };
}

export function validateP26EContractCompleteness(contract: object): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const c = contract as Record<string, unknown>;

  if (!c['contractVersion']) violations.push('Missing contractVersion');
  if (!c['phase']) violations.push('Missing phase');
  if (!c['generatedAt']) violations.push('Missing generatedAt');
  if (!c['sourceCategories']) violations.push('Missing sourceCategories');
  if (!c['sourceStates']) violations.push('Missing sourceStates');
  if (!c['expansionReadiness']) violations.push('Missing expansionReadiness');
  if (!c['requiredChecks']) violations.push('Missing requiredChecks');
  if (!c['excludedScope']) violations.push('Missing excludedScope');
  if (!c['outputClassifications']) violations.push('Missing outputClassifications');
  if (!c['disclaimerContext']) violations.push('Missing disclaimerContext');

  const sc = c['sourceCategories'] as Record<string, unknown> | undefined;
  if (sc) {
    if (!sc['MONTHLY_REVENUE']) violations.push('Missing sourceCategories.MONTHLY_REVENUE');
    if (!sc['NEWS_EVENT']) violations.push('Missing sourceCategories.NEWS_EVENT');
    if (!sc['FINANCIAL_REPORT']) violations.push('Missing sourceCategories.FINANCIAL_REPORT');
  }

  const es = c['excludedScope'] as Record<string, unknown> | undefined;
  if (es) {
    if (es['noCorpusGeneration'] !== true) violations.push('excludedScope.noCorpusGeneration must be true');
    if (es['noScoringChange'] !== true) violations.push('excludedScope.noScoringChange must be true');
    if (es['noOptimizer'] !== true) violations.push('excludedScope.noOptimizer must be true');
  }

  return { valid: violations.length === 0, violations };
}

export function isP26EClassificationValid(classification: string): boolean {
  return Object.values(P26E_OUTPUT_CLASSIFICATIONS).includes(
    classification as (typeof P26E_OUTPUT_CLASSIFICATIONS)[keyof typeof P26E_OUTPUT_CLASSIFICATIONS]
  );
}
