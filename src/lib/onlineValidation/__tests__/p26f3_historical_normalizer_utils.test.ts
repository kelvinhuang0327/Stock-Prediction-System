import {
  normalizeHistoricalMonthlyRevenueRow,
  buildHistoricalMonthlyRevenueRowHash,
  classifyHistoricalReleaseDateSource,
  validateHistoricalMonthlyRevenueRow,
  normalizeHistoricalMonthlyRevenueBatch,
  summarizeHistoricalNormalization,
  validateHistoricalRowsNoOutcomeFields,
  validateHistoricalRowsDryRunOnly,
  RawHistoricalMonthlyRevenueRow,
} from '../P26F3MonthlyRevenueHistoricalNormalizerUtils';
import * as fs from 'fs';
import * as path from 'path';

const baseRow: RawHistoricalMonthlyRevenueRow = {
  stockId: '2330',
  year: 2025,
  month: 9,
  revenue: 500000,
  releaseDate: null,
  releaseDateSource: null,
};

describe('P26F3MonthlyRevenueHistoricalNormalizerUtils', () => {
  it('normalizeHistoricalMonthlyRevenueRow with valid row sets dryRunOnly=true', () => {
    const result = normalizeHistoricalMonthlyRevenueRow(baseRow);
    expect(result.dryRunOnly).toBe(true);
  });

  it('normalizeHistoricalMonthlyRevenueRow sets dbWriteAllowed=false', () => {
    const result = normalizeHistoricalMonthlyRevenueRow(baseRow);
    expect(result.dbWriteAllowed).toBe(false);
  });

  it('normalizeHistoricalMonthlyRevenueRow sets corpusWriteAllowed=false', () => {
    const result = normalizeHistoricalMonthlyRevenueRow(baseRow);
    expect(result.corpusWriteAllowed).toBe(false);
  });

  it('normalizeHistoricalMonthlyRevenueRow with null releaseDate → releaseDateMissing=true', () => {
    const result = normalizeHistoricalMonthlyRevenueRow(baseRow);
    expect(result.releaseDateMissing).toBe(true);
    expect(result.needsManualReview).toBe(true);
  });

  it('normalizeHistoricalMonthlyRevenueRow with outcomePrice → OUTCOME_FIELD_REJECTED', () => {
    const row = { ...baseRow, outcomePrice: 100 } as RawHistoricalMonthlyRevenueRow;
    const result = normalizeHistoricalMonthlyRevenueRow(row);
    expect(result.normalizationStatus).toBe('OUTCOME_FIELD_REJECTED');
  });

  it('normalizeHistoricalMonthlyRevenueRow with returnPct → OUTCOME_FIELD_REJECTED', () => {
    const row = { ...baseRow, returnPct: 0.05 } as RawHistoricalMonthlyRevenueRow;
    const result = normalizeHistoricalMonthlyRevenueRow(row);
    expect(result.normalizationStatus).toBe('OUTCOME_FIELD_REJECTED');
  });

  it('normalizeHistoricalMonthlyRevenueRow does NOT mutate input row', () => {
    const original = { ...baseRow };
    normalizeHistoricalMonthlyRevenueRow(baseRow);
    expect(baseRow).toEqual(original);
  });

  it('normalizeHistoricalMonthlyRevenueRow with invalid month → INVALID_PERIOD', () => {
    const row = { ...baseRow, month: 13 };
    const result = normalizeHistoricalMonthlyRevenueRow(row);
    expect(result.normalizationStatus).toBe('INVALID_PERIOD');
  });

  it('normalizeHistoricalMonthlyRevenueRow with invalid year → INVALID_PERIOD', () => {
    const row = { ...baseRow, year: 1999 };
    const result = normalizeHistoricalMonthlyRevenueRow(row);
    expect(result.normalizationStatus).toBe('INVALID_PERIOD');
  });

  it('buildHistoricalMonthlyRevenueRowHash is deterministic', () => {
    const rowData = { stockId: '2330', year: 2025, month: 9, revenue: 500000, releaseDate: null };
    const h1 = buildHistoricalMonthlyRevenueRowHash(rowData);
    const h2 = buildHistoricalMonthlyRevenueRowHash(rowData);
    expect(h1).toBe(h2);
  });

  it('buildHistoricalMonthlyRevenueRowHash different inputs → different hash', () => {
    const h1 = buildHistoricalMonthlyRevenueRowHash({ stockId: '2330', year: 2025, month: 9, revenue: null, releaseDate: null });
    const h2 = buildHistoricalMonthlyRevenueRowHash({ stockId: '1210', year: 2025, month: 9, revenue: null, releaseDate: null });
    expect(h1).not.toBe(h2);
  });

  it('classifyHistoricalReleaseDateSource with null releaseDate → MISSING_RELEASE_DATE', () => {
    expect(classifyHistoricalReleaseDateSource({ releaseDate: null })).toBe('MISSING_RELEASE_DATE');
  });

  it('classifyHistoricalReleaseDateSource with OFFICIAL source → VERIFIED_OFFICIAL_DATE', () => {
    expect(classifyHistoricalReleaseDateSource({ releaseDate: '2025-10-10', releaseDateSource: 'OFFICIAL' }))
      .toBe('VERIFIED_OFFICIAL_DATE');
  });

  it('classifyHistoricalReleaseDateSource with INFERRED_NEXT_MONTH_10TH → INFERRED_NEXT_MONTH_10TH', () => {
    expect(classifyHistoricalReleaseDateSource({ releaseDate: '2025-10-10', releaseDateSource: 'INFERRED_NEXT_MONTH_10TH' }))
      .toBe('INFERRED_NEXT_MONTH_10TH');
  });

  it('validateHistoricalMonthlyRevenueRow passes for valid normalized row', () => {
    const row = normalizeHistoricalMonthlyRevenueRow(baseRow);
    const result = validateHistoricalMonthlyRevenueRow(row);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('normalizeHistoricalMonthlyRevenueBatch returns same count as input', () => {
    const rows = [
      { stockId: '2330', year: 2025, month: 9, revenue: 500000 },
      { stockId: '1210', year: 2025, month: 10, revenue: 300000 },
      { stockId: '1326', year: 2025, month: 11, revenue: 200000 },
    ];
    const results = normalizeHistoricalMonthlyRevenueBatch(rows);
    expect(results).toHaveLength(3);
  });

  it('summarizeHistoricalNormalization allDryRunOnly=true when all dryRunOnly', () => {
    const rows = normalizeHistoricalMonthlyRevenueBatch([
      { stockId: '2330', year: 2025, month: 9 },
      { stockId: '1210', year: 2025, month: 10 },
    ]);
    const summary = summarizeHistoricalNormalization(rows) as Record<string, unknown>;
    expect(summary['allDryRunOnly']).toBe(true);
    expect(summary['allDbWriteDisabled']).toBe(true);
  });

  it('validateHistoricalRowsNoOutcomeFields passes for clean rows', () => {
    const rows = normalizeHistoricalMonthlyRevenueBatch([
      { stockId: '2330', year: 2025, month: 9, revenue: 500000 },
    ]);
    const result = validateHistoricalRowsNoOutcomeFields(rows);
    expect(result.valid).toBe(true);
  });

  it('validateHistoricalRowsDryRunOnly passes for all dryRunOnly rows', () => {
    const rows = normalizeHistoricalMonthlyRevenueBatch([
      { stockId: '2330', year: 2025, month: 9 },
    ]);
    const result = validateHistoricalRowsDryRunOnly(rows);
    expect(result.valid).toBe(true);
  });

  it('No Math.random() in source file', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../P26F3MonthlyRevenueHistoricalNormalizerUtils.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/Math\.random\(\)/);
  });

  it('No external (non-relative) imports in source file', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../P26F3MonthlyRevenueHistoricalNormalizerUtils.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
  });
});
