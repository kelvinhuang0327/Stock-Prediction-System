import * as fs from 'fs';
import * as path from 'path';

import {
  buildP26EDataCoverageGateContractV2,
  validateP26EContractCompleteness,
  isP26EClassificationValid,
  P26E_SOURCE_STATES,
  P26E_EXPANSION_READINESS,
  P26E_EXCLUDED_SCOPE,
  P26E_OUTPUT_CLASSIFICATIONS,
} from '../P26EDataCoverageExpansionGateContractUtils';

describe('P26EDataCoverageExpansionGateContractUtils', () => {
  const contract = buildP26EDataCoverageGateContractV2();

  it('buildP26EDataCoverageGateContractV2 returns object with all source categories', () => {
    expect(contract.sourceCategories.MONTHLY_REVENUE).toBe('MonthlyRevenue');
    expect(contract.sourceCategories.NEWS_EVENT).toBe('NewsEvent');
    expect(contract.sourceCategories.FINANCIAL_REPORT).toBe('FinancialReport');
  });

  it('P26E_SOURCE_STATES has all 7 source states', () => {
    const states = Object.keys(P26E_SOURCE_STATES);
    expect(states).toContain('REAL_DATA_READY');
    expect(states).toContain('REAL_DATA_PRESENT_BUT_NOT_MAPPED');
    expect(states).toContain('FIXTURE_ONLY');
    expect(states).toContain('MISSING_SOURCE');
    expect(states).toContain('PIT_GATE_READY_NO_SOURCE');
    expect(states).toContain('BLOCKED_BY_CONTRACT');
    expect(states).toContain('UNKNOWN_REQUIRES_MANUAL_MAPPING');
    expect(states).toHaveLength(7);
  });

  it('P26E_EXPANSION_READINESS has all 6 readiness values', () => {
    const readiness = Object.keys(P26E_EXPANSION_READINESS);
    expect(readiness).toContain('READY_FOR_EXPANSION_IMPLEMENTATION');
    expect(readiness).toContain('PARTIAL_SOURCE_MAPPING_REQUIRED');
    expect(readiness).toContain('FIXTURE_ONLY_NOT_READY');
    expect(readiness).toContain('BLOCKED_BY_MISSING_SOURCE');
    expect(readiness).toContain('BLOCKED_BY_PIT_CONTRACT');
    expect(readiness).toContain('BLOCKED_BY_SCORING_INVARIANCE');
    expect(readiness).toHaveLength(6);
  });

  it('excludedScope has noCorpusGeneration=true, noScoringChange=true, noOptimizer=true', () => {
    expect(P26E_EXCLUDED_SCOPE.noCorpusGeneration).toBe(true);
    expect(P26E_EXCLUDED_SCOPE.noScoringChange).toBe(true);
    expect(P26E_EXCLUDED_SCOPE.noOptimizer).toBe(true);
    expect(P26E_EXCLUDED_SCOPE.noProductionDbWrite).toBe(true);
    expect(P26E_EXCLUDED_SCOPE.noExternalApi).toBe(true);
    expect(P26E_EXCLUDED_SCOPE.noPerformanceClaim).toBe(true);
  });

  it('validateP26EContractCompleteness passes for complete contract', () => {
    const result = validateP26EContractCompleteness(contract);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('isP26EClassificationValid accepts all 6 valid classifications', () => {
    for (const cls of Object.values(P26E_OUTPUT_CLASSIFICATIONS)) {
      expect(isP26EClassificationValid(cls)).toBe(true);
    }
    expect(Object.values(P26E_OUTPUT_CLASSIFICATIONS)).toHaveLength(6);
  });

  it('isP26EClassificationValid rejects invalid classification', () => {
    expect(isP26EClassificationValid('INVALID_CLASSIFICATION')).toBe(false);
    expect(isP26EClassificationValid('')).toBe(false);
    expect(isP26EClassificationValid('P26E_MADE_UP')).toBe(false);
  });

  it('source file does not use Math.random()', () => {
    const filePath = path.join(
      __dirname,
      '..',
      'P26EDataCoverageExpansionGateContractUtils.ts'
    );
    const src = fs.readFileSync(filePath, 'utf8');
    expect(src).not.toMatch(/Math\.random\(\)/);
  });

  it('source file has no external imports', () => {
    const filePath = path.join(
      __dirname,
      '..',
      'P26EDataCoverageExpansionGateContractUtils.ts'
    );
    const src = fs.readFileSync(filePath, 'utf8');
    // No "import ... from '..." with non-relative path
    expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
  });
});
