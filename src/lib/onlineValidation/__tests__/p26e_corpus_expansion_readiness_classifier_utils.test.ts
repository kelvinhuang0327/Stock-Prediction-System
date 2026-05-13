import * as fs from 'fs';
import * as path from 'path';

import {
  classifyMonthlyRevenueExpansionReadiness,
  classifyNewsEventExpansionReadiness,
  classifyFinancialReportExpansionReadiness,
  classifyOverallExpansionReadiness,
  buildNextActionPlan,
  validateReadinessDoesNotAuthorizeScoring,
} from '../P26ECorpusExpansionReadinessClassifierUtils';

describe('P26ECorpusExpansionReadinessClassifierUtils', () => {
  it('classifyNewsEventExpansionReadiness with fixtureOnly=true returns FIXTURE_ONLY_NOT_READY', () => {
    const sm = { sourceState: 'FIXTURE_ONLY', fixtureFileFound: true, realSourceCandidates: [] };
    expect(classifyNewsEventExpansionReadiness(sm, 0, 'FIXTURE_ONLY')).toBe('FIXTURE_ONLY_NOT_READY');
  });

  it('classifyFinancialReportExpansionReadiness with fixtureOnly=true returns FIXTURE_ONLY_NOT_READY', () => {
    const sm = { sourceState: 'FIXTURE_ONLY', fixtureFileFound: true, realSourceCandidates: [] };
    expect(classifyFinancialReportExpansionReadiness(sm, 0, 'FIXTURE_ONLY')).toBe('FIXTURE_ONLY_NOT_READY');
  });

  it('classifyMonthlyRevenueExpansionReadiness with MISSING_SOURCE returns BLOCKED_BY_MISSING_SOURCE', () => {
    const sm = { sourceState: 'MISSING_SOURCE', pitGateField: null };
    expect(classifyMonthlyRevenueExpansionReadiness(sm, 0, 'MISSING_SOURCE')).toBe('BLOCKED_BY_MISSING_SOURCE');
  });

  it('classifyMonthlyRevenueExpansionReadiness with REAL_DATA_PRESENT_BUT_NOT_MAPPED and coverageRatio=0 returns PARTIAL_SOURCE_MAPPING_REQUIRED', () => {
    const sm = { sourceState: 'REAL_DATA_PRESENT_BUT_NOT_MAPPED', pitGateField: 'releaseDate' };
    expect(classifyMonthlyRevenueExpansionReadiness(sm, 0, 'PARTIAL')).toBe('PARTIAL_SOURCE_MAPPING_REQUIRED');
  });

  it('classifyOverallExpansionReadiness with all fixture-only returns BLOCKED_BY_MISSING_SOURCE', () => {
    const components = {
      monthlyRevenue: 'FIXTURE_ONLY_NOT_READY',
      newsEvent: 'FIXTURE_ONLY_NOT_READY',
      financialReport: 'FIXTURE_ONLY_NOT_READY',
    };
    const overall = classifyOverallExpansionReadiness(components);
    expect(['BLOCKED_BY_MISSING_SOURCE', 'FIXTURE_ONLY_NOT_READY']).toContain(overall);
  });

  it('classifyOverallExpansionReadiness with MonthlyRevenue=PARTIAL and others fixture-only returns PARTIAL_SOURCE_MAPPING_REQUIRED', () => {
    const components = {
      monthlyRevenue: 'PARTIAL_SOURCE_MAPPING_REQUIRED',
      newsEvent: 'FIXTURE_ONLY_NOT_READY',
      financialReport: 'FIXTURE_ONLY_NOT_READY',
    };
    expect(classifyOverallExpansionReadiness(components)).toBe('PARTIAL_SOURCE_MAPPING_REQUIRED');
  });

  it('buildNextActionPlan always has scoringChangeAllowed=false', () => {
    const components = {
      monthlyRevenue: 'PARTIAL_SOURCE_MAPPING_REQUIRED',
      newsEvent: 'FIXTURE_ONLY_NOT_READY',
      financialReport: 'FIXTURE_ONLY_NOT_READY',
    };
    const plan = buildNextActionPlan(components) as Record<string, unknown>;
    expect(plan['scoringChangeAllowed']).toBe(false);
  });

  it('buildNextActionPlan always has optimizerAllowed=false', () => {
    const components = {
      monthlyRevenue: 'READY_FOR_EXPANSION_IMPLEMENTATION',
      newsEvent: 'FIXTURE_ONLY_NOT_READY',
      financialReport: 'FIXTURE_ONLY_NOT_READY',
    };
    const plan = buildNextActionPlan(components) as Record<string, unknown>;
    expect(plan['optimizerAllowed']).toBe(false);
  });

  it('validateReadinessDoesNotAuthorizeScoring passes when both are false', () => {
    const readiness = { scoringChangeAllowed: false, optimizerAllowed: false };
    const check = validateReadinessDoesNotAuthorizeScoring(readiness);
    expect(check.valid).toBe(true);
    expect(check.violations).toHaveLength(0);
  });

  it('validateReadinessDoesNotAuthorizeScoring fails when scoringChangeAllowed=true', () => {
    const readiness = { scoringChangeAllowed: true, optimizerAllowed: false };
    const check = validateReadinessDoesNotAuthorizeScoring(readiness);
    expect(check.valid).toBe(false);
    expect(check.violations.length).toBeGreaterThan(0);
    expect(check.violations[0]).toMatch(/scoringChangeAllowed/);
  });

  it('classifyMonthlyRevenueExpansionReadiness with REAL_DATA_READY and coverage > 0 returns READY_FOR_EXPANSION_IMPLEMENTATION', () => {
    const sm = { sourceState: 'REAL_DATA_READY', pitGateField: 'releaseDate' };
    expect(classifyMonthlyRevenueExpansionReadiness(sm, 0.5, 'GOOD')).toBe('READY_FOR_EXPANSION_IMPLEMENTATION');
  });

  it('source file does not use Math.random()', () => {
    const filePath = path.join(__dirname, '..', 'P26ECorpusExpansionReadinessClassifierUtils.ts');
    const src = fs.readFileSync(filePath, 'utf8');
    expect(src).not.toMatch(/Math\.random\(\)/);
  });

  it('source file has no external imports', () => {
    const filePath = path.join(__dirname, '..', 'P26ECorpusExpansionReadinessClassifierUtils.ts');
    const src = fs.readFileSync(filePath, 'utf8');
    expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
  });

  it('buildNextActionPlan corpusExpansionAllowed is false when no source is READY', () => {
    const components = {
      monthlyRevenue: 'PARTIAL_SOURCE_MAPPING_REQUIRED',
      newsEvent: 'FIXTURE_ONLY_NOT_READY',
      financialReport: 'FIXTURE_ONLY_NOT_READY',
    };
    const plan = buildNextActionPlan(components) as Record<string, unknown>;
    expect(plan['corpusExpansionAllowed']).toBe(false);
  });
});
