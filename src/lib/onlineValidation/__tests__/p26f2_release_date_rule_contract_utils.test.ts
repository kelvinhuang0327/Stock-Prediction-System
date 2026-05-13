import {
  buildP26F2ReleaseRuleDateContractV1,
  P26F2_DRY_RUN_CONTRACT,
  P26F2_PIT_SAFETY_RULES,
  isP26F2CandidateDateVisibilityGate,
  getP26F2InferredCandidateReleaseDate,
  validateP26F2ContractCompleteness,
  P26F2_RELEASE_DATE_RULE_CONTRACT_VERSION,
} from '../P26F2MonthlyRevenueReleaseDateRuleContractUtils';
import * as fs from 'fs';
import * as path from 'path';

describe('P26F2MonthlyRevenueReleaseDateRuleContractUtils', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'P26F2MonthlyRevenueReleaseDateRuleContractUtils.ts'),
    'utf8'
  );

  test('1. buildP26F2ReleaseRuleDateContractV1 has inferenceRule with ruleName = INFERRED_NEXT_MONTH_10TH', () => {
    const contract = buildP26F2ReleaseRuleDateContractV1() as Record<string, any>;
    expect(contract.inferenceRule.ruleName).toBe('INFERRED_NEXT_MONTH_10TH');
  });

  test('2. P26F2_DRY_RUN_CONTRACT.writeAllowed === false', () => {
    expect(P26F2_DRY_RUN_CONTRACT.writeAllowed).toBe(false);
  });

  test('3. P26F2_DRY_RUN_CONTRACT.databaseWriteAllowed === false', () => {
    expect(P26F2_DRY_RUN_CONTRACT.databaseWriteAllowed).toBe(false);
  });

  test('4. P26F2_DRY_RUN_CONTRACT.productionBackfillAllowed === false', () => {
    expect(P26F2_DRY_RUN_CONTRACT.productionBackfillAllowed).toBe(false);
  });

  test('5. isP26F2CandidateDateVisibilityGate("candidateReleaseDate") returns true', () => {
    expect(isP26F2CandidateDateVisibilityGate('candidateReleaseDate')).toBe(true);
  });

  test('6. isP26F2CandidateDateVisibilityGate("year") returns false', () => {
    expect(isP26F2CandidateDateVisibilityGate('year')).toBe(false);
  });

  test('7. isP26F2CandidateDateVisibilityGate("month") returns false', () => {
    expect(isP26F2CandidateDateVisibilityGate('month')).toBe(false);
  });

  test('8. isP26F2CandidateDateVisibilityGate("createdAt") returns false', () => {
    expect(isP26F2CandidateDateVisibilityGate('createdAt')).toBe(false);
  });

  test('9. getP26F2InferredCandidateReleaseDate(2026, 2) returns "2026-03-10"', () => {
    expect(getP26F2InferredCandidateReleaseDate(2026, 2)).toBe('2026-03-10');
  });

  test('10. getP26F2InferredCandidateReleaseDate(2026, 12) returns "2027-01-10"', () => {
    expect(getP26F2InferredCandidateReleaseDate(2026, 12)).toBe('2027-01-10');
  });

  test('11. getP26F2InferredCandidateReleaseDate(2026, 3) returns "2026-04-10"', () => {
    expect(getP26F2InferredCandidateReleaseDate(2026, 3)).toBe('2026-04-10');
  });

  test('12. P26F2_PIT_SAFETY_RULES.yearMonthAreNotVisibilityGates === true', () => {
    expect(P26F2_PIT_SAFETY_RULES.yearMonthAreNotVisibilityGates).toBe(true);
  });

  test('13. P26F2_PIT_SAFETY_RULES.createdAtIsNotVisibilityGate === true', () => {
    expect(P26F2_PIT_SAFETY_RULES.createdAtIsNotVisibilityGate).toBe(true);
  });

  test('14. validateP26F2ContractCompleteness passes for complete contract', () => {
    const contract = buildP26F2ReleaseRuleDateContractV1() as Record<string, unknown>;
    const result = validateP26F2ContractCompleteness(contract);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('15. No Math.random() calls in source', () => {
    expect(src).not.toMatch(/Math\.random\(\)/);
  });

  test('16. No external (non-relative) imports in source', () => {
    expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
  });
});
