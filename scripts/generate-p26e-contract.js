'use strict';
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'outputs', 'online_validation');

const contract = {
  contractVersion: 'v2',
  phase: 'P26E-HARDRESET',
  generatedAt: '2026-05-13',
  sourceCategories: {
    MONTHLY_REVENUE: 'MonthlyRevenue',
    NEWS_EVENT: 'NewsEvent',
    FINANCIAL_REPORT: 'FinancialReport'
  },
  sourceStates: {
    REAL_DATA_READY: 'REAL_DATA_READY',
    REAL_DATA_PRESENT_BUT_NOT_MAPPED: 'REAL_DATA_PRESENT_BUT_NOT_MAPPED',
    FIXTURE_ONLY: 'FIXTURE_ONLY',
    MISSING_SOURCE: 'MISSING_SOURCE',
    PIT_GATE_READY_NO_SOURCE: 'PIT_GATE_READY_NO_SOURCE',
    BLOCKED_BY_CONTRACT: 'BLOCKED_BY_CONTRACT',
    UNKNOWN_REQUIRES_MANUAL_MAPPING: 'UNKNOWN_REQUIRES_MANUAL_MAPPING'
  },
  expansionReadiness: {
    READY_FOR_EXPANSION_IMPLEMENTATION: 'READY_FOR_EXPANSION_IMPLEMENTATION',
    PARTIAL_SOURCE_MAPPING_REQUIRED: 'PARTIAL_SOURCE_MAPPING_REQUIRED',
    FIXTURE_ONLY_NOT_READY: 'FIXTURE_ONLY_NOT_READY',
    BLOCKED_BY_MISSING_SOURCE: 'BLOCKED_BY_MISSING_SOURCE',
    BLOCKED_BY_PIT_CONTRACT: 'BLOCKED_BY_PIT_CONTRACT',
    BLOCKED_BY_SCORING_INVARIANCE: 'BLOCKED_BY_SCORING_INVARIANCE'
  },
  requiredChecks: {
    sourceExists: 'sourceExists',
    pitGate: 'pitGate',
    asOfKey: 'asOfKey',
    symbolJoin: 'symbolJoin',
    asOfDateJoin: 'asOfDateJoin',
    readOnly: 'readOnly',
    noOutcomeFields: 'noOutcomeFields',
    doesNotEnterScoring: 'doesNotEnterScoring',
    minCoverageCount: 'minCoverageCount'
  },
  excludedScope: {
    noCorpusGeneration: true,
    noScoringChange: true,
    noOptimizer: true,
    noProductionDbWrite: true,
    noExternalApi: true,
    noPerformanceClaim: true
  },
  outputClassifications: {
    PARTIAL_SOURCE_MAPPING_REQUIRED: 'P26E_PARTIAL_SOURCE_MAPPING_REQUIRED',
    DATA_COVERAGE_EXPANSION_GATE_COMPLETE: 'P26E_DATA_COVERAGE_EXPANSION_GATE_COMPLETE',
    FIXTURE_ONLY_NOT_READY: 'P26E_FIXTURE_ONLY_NOT_READY',
    BLOCKED_BY_MISSING_SOURCE: 'P26E_BLOCKED_BY_MISSING_SOURCE',
    BLOCKED_BY_SCORING_INVARIANCE: 'P26E_BLOCKED_BY_SCORING_INVARIANCE',
    BLOCKED_BY_PIT_CONTRACT: 'P26E_BLOCKED_BY_PIT_CONTRACT'
  },
  disclaimerContext: 'No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims. Research only.'
};

fs.writeFileSync(path.join(OUT, 'p26e_data_coverage_expansion_gate_contract_v2.json'), JSON.stringify(contract, null, 2));
console.log('Written p26e_data_coverage_expansion_gate_contract_v2.json');
