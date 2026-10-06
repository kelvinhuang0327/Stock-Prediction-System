import {
  inferMonthlyRevenueCandidateReleaseDate,
  classifyReleaseDatePopulationStatus,
  buildReleaseDatePopulationCandidate,
  buildReleaseDatePopulationBatch,
  validateReleaseDateCandidateNoOutcomeFields,
  validateReleaseDateCandidateIsDryRunOnly,
  validateReleaseDateCandidateDoesNotOverwriteExisting,
  summarizeReleaseDatePopulationBatch,
  normalizeMonthlyRevenueRowForReleaseDate,
} from '../P26F2MonthlyRevenueReleaseDateInferenceUtils';
import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(
  path.join(__dirname, '..', 'P26F2MonthlyRevenueReleaseDateInferenceUtils.ts'),
  'utf8'
);

function makeRow(overrides = {}) {
  return {
    id: 1,
    stockId: 'AAAA',
    year: 2026,
    month: 2,
    revenue: 100,
    yoyGrowth: null,
    momGrowth: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('P26F2MonthlyRevenueReleaseDateInferenceUtils', () => {
  test('1. inferMonthlyRevenueCandidateReleaseDate year=2026,month=2 → "2026-03-10"', () => {
    const row = makeRow({ id: 10, stockId: 'AAAA', year: 2026, month: 2 });
    expect(inferMonthlyRevenueCandidateReleaseDate(row)).toBe('2026-03-10');
  });

  test('2. inferMonthlyRevenueCandidateReleaseDate year=2026,month=12 → "2027-01-10"', () => {
    const row = makeRow({ id: 11, stockId: 'BBBB', year: 2026, month: 12 });
    expect(inferMonthlyRevenueCandidateReleaseDate(row)).toBe('2027-01-10');
  });

  test('3. inferMonthlyRevenueCandidateReleaseDate year=2026,month=3 → "2026-04-10"', () => {
    const row = makeRow({ id: 12, stockId: 'CCCC', year: 2026, month: 3 });
    expect(inferMonthlyRevenueCandidateReleaseDate(row)).toBe('2026-04-10');
  });

  test('4. inferMonthlyRevenueCandidateReleaseDate invalid month=0 → "INVALID"', () => {
    const row = makeRow({ id: 13, stockId: 'DDDD', year: 2026, month: 0 });
    expect(inferMonthlyRevenueCandidateReleaseDate(row)).toBe('INVALID');
  });

  test('5. inferMonthlyRevenueCandidateReleaseDate invalid month=13 → "INVALID"', () => {
    const row = makeRow({ id: 14, stockId: 'EEEE', year: 2026, month: 13 });
    expect(inferMonthlyRevenueCandidateReleaseDate(row)).toBe('INVALID');
  });

  test('6. classifyReleaseDatePopulationStatus with null releaseDate → "CANDIDATE_GENERATED"', () => {
    const row = { ...makeRow({ id: 20, stockId: 'FFFF', year: 2026, month: 2 }), releaseDate: null };
    expect(classifyReleaseDatePopulationStatus(row)).toBe('CANDIDATE_GENERATED');
  });

  test('7. classifyReleaseDatePopulationStatus with existing releaseDate → "EXISTING_RELEASE_DATE_KEEP"', () => {
    const row = { ...makeRow({ id: 21, stockId: 'GGGG', year: 2026, month: 2 }), releaseDate: '2026-03-10' };
    expect(classifyReleaseDatePopulationStatus(row)).toBe('EXISTING_RELEASE_DATE_KEEP');
  });

  test('8. classifyReleaseDatePopulationStatus with invalid month → "INVALID_YEAR_MONTH"', () => {
    const row = { ...makeRow({ id: 22, stockId: 'HHHH', year: 2026, month: 0 }), releaseDate: null };
    expect(classifyReleaseDatePopulationStatus(row)).toBe('INVALID_YEAR_MONTH');
  });

  test('9. buildReleaseDatePopulationCandidate has dryRunOnly=true', () => {
    const row = makeRow({ id: 30, stockId: 'IIII', year: 2026, month: 2 });
    const c = buildReleaseDatePopulationCandidate(row);
    expect(c.dryRunOnly).toBe(true);
  });

  test('10. buildReleaseDatePopulationCandidate has productionWriteAllowed=false', () => {
    const row = makeRow({ id: 31, stockId: 'JJJJ', year: 2026, month: 3 });
    const c = buildReleaseDatePopulationCandidate(row);
    expect(c.productionWriteAllowed).toBe(false);
  });

  test('11. buildReleaseDatePopulationCandidate does NOT mutate input row', () => {
    const row = makeRow({ id: 32, stockId: 'KKKK', year: 2026, month: 4 });
    const rowCopy = { ...row };
    buildReleaseDatePopulationCandidate(row);
    expect(row).toEqual(rowCopy);
  });

  test('12. validateReleaseDateCandidateNoOutcomeFields passes for clean candidate', () => {
    const row = makeRow({ id: 40, stockId: 'LLLL', year: 2026, month: 2 });
    const c = buildReleaseDatePopulationCandidate(row);
    const result = validateReleaseDateCandidateNoOutcomeFields(c);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('13. validateReleaseDateCandidateIsDryRunOnly passes when dryRunOnly=true, productionWriteAllowed=false', () => {
    const row = makeRow({ id: 41, stockId: 'MMMM', year: 2026, month: 5 });
    const c = buildReleaseDatePopulationCandidate(row);
    const result = validateReleaseDateCandidateIsDryRunOnly(c);
    expect(result.valid).toBe(true);
  });

  test('14. validateReleaseDateCandidateIsDryRunOnly fails when productionWriteAllowed=true', () => {
    const row = makeRow({ id: 42, stockId: 'NNNN', year: 2026, month: 6 });
    const c = buildReleaseDatePopulationCandidate(row);
    const tampered = { ...c, productionWriteAllowed: true as unknown as false };
    const result = validateReleaseDateCandidateIsDryRunOnly(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  test('15. validateReleaseDateCandidateDoesNotOverwriteExisting passes when no existing releaseDate', () => {
    const row = { ...makeRow({ id: 50, stockId: 'OOOO', year: 2026, month: 7 }), releaseDate: null };
    const c = buildReleaseDatePopulationCandidate(row);
    const result = validateReleaseDateCandidateDoesNotOverwriteExisting(row, c);
    expect(result.valid).toBe(true);
  });

  test('16. buildReleaseDatePopulationBatch returns same count as input', () => {
    const rows = [
      makeRow({ id: 60, stockId: 'PPPP', year: 2026, month: 2 }),
      makeRow({ id: 61, stockId: 'QQQQ', year: 2026, month: 3 }),
      makeRow({ id: 62, stockId: 'RRRR', year: 2026, month: 4 }),
    ];
    const batch = buildReleaseDatePopulationBatch(rows);
    expect(batch).toHaveLength(rows.length);
  });

  test('17. summarizeReleaseDatePopulationBatch allDryRunOnly=true when all dryRunOnly=true', () => {
    const rows = [
      makeRow({ id: 70, stockId: 'SSSS', year: 2026, month: 2 }),
      makeRow({ id: 71, stockId: 'TTTT', year: 2026, month: 3 }),
    ];
    const batch = buildReleaseDatePopulationBatch(rows);
    const summary = summarizeReleaseDatePopulationBatch(batch) as Record<string, unknown>;
    expect(summary.allDryRunOnly).toBe(true);
  });

  test('18. No Math.random() calls in source', () => {
    expect(src).not.toMatch(/Math\.random\(\)/);
  });

  test('19. No external (non-relative) imports in source', () => {
    expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
  });
});
