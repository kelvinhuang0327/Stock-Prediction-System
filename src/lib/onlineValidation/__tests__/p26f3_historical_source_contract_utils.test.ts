import {
  P26F3_TARGET_PERIODS,
  P26F3_TARGET_SYMBOLS,
  P26F3_SOURCE_DRY_RUN_CONTRACT,
  P26F3_PIT_SOURCE_RULES,
  buildP26F3HistoricalSourceContractV1,
  validateP26F3ContractCompleteness,
  isP26F3PeriodInTargetRange,
  isP26F3SymbolInTargetSet,
  classifyP26F3ReleaseDateSource,
} from '../P26F3MonthlyRevenueHistoricalSourceContractUtils';
import * as fs from 'fs';
import * as path from 'path';

describe('P26F3MonthlyRevenueHistoricalSourceContractUtils', () => {
  it('P26F3_TARGET_PERIODS has 5 periods', () => {
    expect(P26F3_TARGET_PERIODS).toHaveLength(5);
  });

  it('P26F3_TARGET_PERIODS includes 2025-09', () => {
    expect(P26F3_TARGET_PERIODS).toContain('2025-09');
  });

  it('P26F3_TARGET_PERIODS includes 2026-01', () => {
    expect(P26F3_TARGET_PERIODS).toContain('2026-01');
  });

  it('P26F3_TARGET_PERIODS does not include 2026-02', () => {
    expect(P26F3_TARGET_PERIODS).not.toContain('2026-02');
  });

  it('P26F3_TARGET_SYMBOLS has 25 symbols', () => {
    expect(P26F3_TARGET_SYMBOLS).toHaveLength(25);
  });

  it('P26F3_SOURCE_DRY_RUN_CONTRACT.dbWriteAllowed === false', () => {
    expect(P26F3_SOURCE_DRY_RUN_CONTRACT.dbWriteAllowed).toBe(false);
  });

  it('P26F3_SOURCE_DRY_RUN_CONTRACT.fabricatedDataAllowed === false', () => {
    expect(P26F3_SOURCE_DRY_RUN_CONTRACT.fabricatedDataAllowed).toBe(false);
  });

  it('P26F3_SOURCE_DRY_RUN_CONTRACT.externalFetchAllowed === false', () => {
    expect(P26F3_SOURCE_DRY_RUN_CONTRACT.externalFetchAllowed).toBe(false);
  });

  it('P26F3_SOURCE_DRY_RUN_CONTRACT.corpusOverwriteAllowed === false', () => {
    expect(P26F3_SOURCE_DRY_RUN_CONTRACT.corpusOverwriteAllowed).toBe(false);
  });

  it('P26F3_PIT_SOURCE_RULES.yearMonthAreRevenuePeriodsOnly === true', () => {
    expect(P26F3_PIT_SOURCE_RULES.yearMonthAreRevenuePeriodsOnly).toBe(true);
  });

  it('P26F3_PIT_SOURCE_RULES.templateOnlyIsNotRealCoverage === true', () => {
    expect(P26F3_PIT_SOURCE_RULES.templateOnlyIsNotRealCoverage).toBe(true);
  });

  it('P26F3_PIT_SOURCE_RULES.ingestionDateIsObservabilityOnly === true', () => {
    expect(P26F3_PIT_SOURCE_RULES.ingestionDateIsObservabilityOnly).toBe(true);
  });

  it('isP26F3PeriodInTargetRange("2025-09") returns true', () => {
    expect(isP26F3PeriodInTargetRange('2025-09')).toBe(true);
  });

  it('isP26F3PeriodInTargetRange("2026-02") returns false', () => {
    expect(isP26F3PeriodInTargetRange('2026-02')).toBe(false);
  });

  it('isP26F3PeriodInTargetRange("2026-01") returns true', () => {
    expect(isP26F3PeriodInTargetRange('2026-01')).toBe(true);
  });

  it('isP26F3SymbolInTargetSet("2330") returns true', () => {
    expect(isP26F3SymbolInTargetSet('2330')).toBe(true);
  });

  it('isP26F3SymbolInTargetSet("9999") returns false', () => {
    expect(isP26F3SymbolInTargetSet('9999')).toBe(false);
  });

  it('classifyP26F3ReleaseDateSource with no releaseDate returns MISSING_RELEASE_DATE', () => {
    expect(classifyP26F3ReleaseDateSource({})).toBe('MISSING_RELEASE_DATE');
  });

  it('classifyP26F3ReleaseDateSource with OFFICIAL source returns VERIFIED_OFFICIAL_DATE', () => {
    expect(classifyP26F3ReleaseDateSource({ releaseDate: '2025-10-10', releaseDateSource: 'OFFICIAL' }))
      .toBe('VERIFIED_OFFICIAL_DATE');
  });

  it('classifyP26F3ReleaseDateSource with INFERRED_NEXT_MONTH_10TH returns INFERRED_NEXT_MONTH_10TH', () => {
    expect(classifyP26F3ReleaseDateSource({ releaseDate: '2025-10-10', releaseDateSource: 'INFERRED_NEXT_MONTH_10TH' }))
      .toBe('INFERRED_NEXT_MONTH_10TH');
  });

  it('validateP26F3ContractCompleteness passes for complete contract', () => {
    const contract = buildP26F3HistoricalSourceContractV1() as Record<string, unknown>;
    const result = validateP26F3ContractCompleteness(contract);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('validateP26F3ContractCompleteness fails for missing version', () => {
    const result = validateP26F3ContractCompleteness({ targetPeriods: [], targetSymbols: [], requiredSourceFields: [], dryRunContract: { dbWriteAllowed: false, fabricatedDataAllowed: false }, pitSourceRules: {} });
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('No Math.random() in source file', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../P26F3MonthlyRevenueHistoricalSourceContractUtils.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/Math\.random\(\)/);
  });

  it('No external imports in source file', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../P26F3MonthlyRevenueHistoricalSourceContractUtils.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
  });
});
