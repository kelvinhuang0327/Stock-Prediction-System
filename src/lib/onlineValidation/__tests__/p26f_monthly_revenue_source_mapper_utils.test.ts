import {
  normalizeMonthlyRevenueSourceRow,
  resolveMonthlyRevenueReleaseDate,
  buildMonthlyRevenueSourceHash,
  isMonthlyRevenueVisibleAsOf,
  selectLatestMonthlyRevenueAsOf,
  buildMonthlyRevenueContextForReplayRow,
  mapMonthlyRevenueToReplayRow,
  validateMonthlyRevenueMappingNoOutcomeFields,
  validateMonthlyRevenueMappingReadOnly,
  validateMonthlyRevenueDoesNotEnterScoring,
  MonthlyRevenueSourceRow,
} from '../P26FMonthlyRevenueSourceMapperUtils';
import * as fs from 'fs';
import * as path from 'path';

const SRC_PATH = path.resolve(__dirname, '../P26FMonthlyRevenueSourceMapperUtils.ts');

const makeRow = (overrides: Partial<MonthlyRevenueSourceRow> = {}): MonthlyRevenueSourceRow => ({
  stockId: '2330',
  year: 2026,
  month: 1,
  revenue: 100,
  ...overrides,
});

describe('P26F MonthlyRevenue Source Mapper Utils', () => {
  describe('resolveMonthlyRevenueReleaseDate', () => {
    it('returns YYYY-MM-DD for valid ISO datetime (UTC+8)', () => {
      const row = makeRow({ releaseDate: '2026-02-10T00:00:00Z' });
      const result = resolveMonthlyRevenueReleaseDate(row);
      expect(result).toBe('2026-02-10');
    });

    it('returns null for null releaseDate', () => {
      const row = makeRow({ releaseDate: null });
      expect(resolveMonthlyRevenueReleaseDate(row)).toBeNull();
    });

    it('returns null for undefined releaseDate', () => {
      const row = makeRow({});
      expect(resolveMonthlyRevenueReleaseDate(row)).toBeNull();
    });

    it('handles Date object input', () => {
      const row = makeRow({ releaseDate: new Date('2026-02-10T00:00:00Z') });
      expect(resolveMonthlyRevenueReleaseDate(row)).toBe('2026-02-10');
    });
  });

  describe('buildMonthlyRevenueSourceHash', () => {
    it('is deterministic: same input produces same output', () => {
      const row = makeRow({ stockId: '2330', year: 2026, month: 1 });
      const h1 = buildMonthlyRevenueSourceHash(row);
      const h2 = buildMonthlyRevenueSourceHash(row);
      expect(h1).toBe(h2);
    });

    it('uses stockId, year, month format', () => {
      const row = makeRow({ stockId: '1101', year: 2025, month: 12 });
      expect(buildMonthlyRevenueSourceHash(row)).toBe('1101|2025|12');
    });

    it('different inputs produce different hashes', () => {
      const rowA = makeRow({ stockId: '2330', year: 2026, month: 1 });
      const rowB = makeRow({ stockId: '1101', year: 2026, month: 1 });
      expect(buildMonthlyRevenueSourceHash(rowA)).not.toBe(buildMonthlyRevenueSourceHash(rowB));
    });
  });

  describe('isMonthlyRevenueVisibleAsOf', () => {
    it('returns true when releaseDate <= asOfDate', () => {
      const row = makeRow({ releaseDate: '2026-02-10T00:00:00Z' });
      expect(isMonthlyRevenueVisibleAsOf(row, '2026-02-11')).toBe(true);
    });

    it('returns false when releaseDate > asOfDate', () => {
      const row = makeRow({ releaseDate: '2026-02-12T00:00:00Z' });
      expect(isMonthlyRevenueVisibleAsOf(row, '2026-02-11')).toBe(false);
    });

    it('returns true when releaseDate equals asOfDate', () => {
      const row = makeRow({ releaseDate: '2026-02-11T00:00:00Z' });
      expect(isMonthlyRevenueVisibleAsOf(row, '2026-02-11')).toBe(true);
    });

    it('returns false when releaseDate is null', () => {
      const row = makeRow({ releaseDate: null });
      expect(isMonthlyRevenueVisibleAsOf(row, '2026-02-11')).toBe(false);
    });

    it('returns false when releaseDate is undefined', () => {
      const row = makeRow({});
      expect(isMonthlyRevenueVisibleAsOf(row, '2026-02-11')).toBe(false);
    });
  });

  describe('selectLatestMonthlyRevenueAsOf', () => {
    it('returns latest visible row by releaseDate', () => {
      const rows: MonthlyRevenueSourceRow[] = [
        makeRow({ stockId: '2330', year: 2026, month: 1, revenue: 100, releaseDate: '2026-01-10T00:00:00Z' }),
        makeRow({ stockId: '2330', year: 2026, month: 2, revenue: 200, releaseDate: '2026-02-10T00:00:00Z' }),
      ];
      const result = selectLatestMonthlyRevenueAsOf(rows, '2330', '2026-02-11');
      expect(result).not.toBeNull();
      expect(result!.month).toBe(2);
      expect(result!.revenue).toBe(200);
    });

    it('returns null when no visible rows exist', () => {
      const rows: MonthlyRevenueSourceRow[] = [
        makeRow({ stockId: '2330', year: 2026, month: 1, revenue: 100, releaseDate: null }),
      ];
      const result = selectLatestMonthlyRevenueAsOf(rows, '2330', '2026-02-11');
      expect(result).toBeNull();
    });

    it('excludes rows with different symbol', () => {
      const rows: MonthlyRevenueSourceRow[] = [
        makeRow({ stockId: '1101', year: 2026, month: 1, revenue: 100, releaseDate: '2026-01-10T00:00:00Z' }),
      ];
      const result = selectLatestMonthlyRevenueAsOf(rows, '2330', '2026-02-11');
      expect(result).toBeNull();
    });

    it('excludes future releaseDate rows', () => {
      const rows: MonthlyRevenueSourceRow[] = [
        makeRow({ stockId: '2330', year: 2026, month: 3, revenue: 300, releaseDate: '2026-03-01T00:00:00Z' }),
      ];
      const result = selectLatestMonthlyRevenueAsOf(rows, '2330', '2026-02-11');
      expect(result).toBeNull();
    });

    it('returns null for empty sourceRows array', () => {
      expect(selectLatestMonthlyRevenueAsOf([], '2330', '2026-02-11')).toBeNull();
    });
  });

  describe('mapMonthlyRevenueToReplayRow', () => {
    const baseCorpusRow = {
      symbol: '2330',
      originalAsOfDate: '2026-02-11',
      activeScoringSnapshot: { alphaScore: 75, asOfDate: '2026-02-11' },
      researchBucket: 'HighPriority',
    };

    it('does NOT mutate input corpusRow', () => {
      const rows: MonthlyRevenueSourceRow[] = [];
      const original = { ...baseCorpusRow };
      mapMonthlyRevenueToReplayRow(baseCorpusRow, rows, 'TEST');
      expect(baseCorpusRow).toEqual(original);
    });

    it('preserves alphaScore in activeScoringSnapshot', () => {
      const rows: MonthlyRevenueSourceRow[] = [];
      const mapped = mapMonthlyRevenueToReplayRow(baseCorpusRow, rows, 'TEST') as any;
      expect(mapped.activeScoringSnapshot.alphaScore).toBe(75);
    });

    it('result has p26fMonthlyRevenueContext.readOnly === true', () => {
      const rows: MonthlyRevenueSourceRow[] = [];
      const mapped = mapMonthlyRevenueToReplayRow(baseCorpusRow, rows, 'TEST') as any;
      expect(mapped.p26fMonthlyRevenueContext.readOnly).toBe(true);
    });

    it('result has p26fMonthlyRevenueContext.entersAlphaScore === false', () => {
      const rows: MonthlyRevenueSourceRow[] = [];
      const mapped = mapMonthlyRevenueToReplayRow(baseCorpusRow, rows, 'TEST') as any;
      expect(mapped.p26fMonthlyRevenueContext.entersAlphaScore).toBe(false);
    });

    it('adds p26fMonthlyRevenueContext to output row', () => {
      const rows: MonthlyRevenueSourceRow[] = [];
      const mapped = mapMonthlyRevenueToReplayRow(baseCorpusRow, rows, 'TEST') as any;
      expect(mapped.p26fMonthlyRevenueContext).toBeDefined();
    });

    it('preserves researchBucket field', () => {
      const rows: MonthlyRevenueSourceRow[] = [];
      const mapped = mapMonthlyRevenueToReplayRow(baseCorpusRow, rows, 'TEST') as any;
      expect(mapped.researchBucket).toBe('HighPriority');
    });
  });

  describe('buildMonthlyRevenueContextForReplayRow', () => {
    it('returns NO_MATCH context when selectedSource is null', () => {
      const ctx = buildMonthlyRevenueContextForReplayRow({}, null, 'TEST_MODE') as any;
      expect(ctx.sourceMatched).toBe(false);
      expect(ctx.sourceHash).toBe('NO_MATCH');
      expect(ctx.pitGateStatus).toBe('NO_VISIBLE_SOURCE_ROW');
      expect(ctx.revenue).toBeNull();
    });

    it('returns matched context when selectedSource is provided', () => {
      const src = makeRow({ stockId: '2330', year: 2026, month: 2, revenue: 200, releaseDate: '2026-02-10T00:00:00Z' });
      const ctx = buildMonthlyRevenueContextForReplayRow({}, src, 'REAL') as any;
      expect(ctx.sourceMatched).toBe(true);
      expect(ctx.pitGateStatus).toBe('VISIBLE_RELEASE_DATE_GATE_PASS');
      expect(ctx.revenue).toBe(200);
    });

    it('context visibilityGate is always releaseDate <= asOfDate', () => {
      const ctx = buildMonthlyRevenueContextForReplayRow({}, null, 'TEST') as any;
      expect(ctx.visibilityGate).toBe('releaseDate <= asOfDate');
    });
  });

  describe('validateMonthlyRevenueMappingNoOutcomeFields', () => {
    it('passes when no forbidden fields in context', () => {
      const row: any = {
        symbol: '2330',
        p26fMonthlyRevenueContext: { readOnly: true, entersAlphaScore: false, revenue: 100 },
      };
      const result = validateMonthlyRevenueMappingNoOutcomeFields(row);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('fails when outcomePrice is in context', () => {
      const row: any = {
        symbol: '2330',
        p26fMonthlyRevenueContext: { readOnly: true, entersAlphaScore: false, outcomePrice: 99.9 },
      };
      const result = validateMonthlyRevenueMappingNoOutcomeFields(row);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('fails when returnPct is in context', () => {
      const row: any = {
        symbol: '2330',
        p26fMonthlyRevenueContext: { readOnly: true, entersAlphaScore: false, returnPct: 0.05 },
      };
      const result = validateMonthlyRevenueMappingNoOutcomeFields(row);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateMonthlyRevenueMappingReadOnly', () => {
    it('passes when readOnly is true', () => {
      const row: any = { p26fMonthlyRevenueContext: { readOnly: true } };
      const result = validateMonthlyRevenueMappingReadOnly(row);
      expect(result.valid).toBe(true);
    });

    it('fails when readOnly is false', () => {
      const row: any = { p26fMonthlyRevenueContext: { readOnly: false } };
      const result = validateMonthlyRevenueMappingReadOnly(row);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateMonthlyRevenueDoesNotEnterScoring', () => {
    it('passes when entersAlphaScore is false', () => {
      const row: any = { p26fMonthlyRevenueContext: { entersAlphaScore: false } };
      const result = validateMonthlyRevenueDoesNotEnterScoring(row);
      expect(result.valid).toBe(true);
    });

    it('fails when entersAlphaScore is true', () => {
      const row: any = { p26fMonthlyRevenueContext: { entersAlphaScore: true } };
      const result = validateMonthlyRevenueDoesNotEnterScoring(row);
      expect(result.valid).toBe(false);
    });
  });

  describe('normalizeMonthlyRevenueSourceRow', () => {
    it('does not mutate input', () => {
      const input = makeRow({ releaseDate: '2026-02-10T00:00:00Z' });
      const original = { ...input };
      normalizeMonthlyRevenueSourceRow(input);
      expect(input).toEqual(original);
    });

    it('converts Date object releaseDate to ISO string', () => {
      const input = makeRow({ releaseDate: new Date('2026-02-10T00:00:00Z') });
      const normalized = normalizeMonthlyRevenueSourceRow(input);
      expect(typeof normalized.releaseDate).toBe('string');
    });

    it('preserves null releaseDate', () => {
      const input = makeRow({ releaseDate: null });
      const normalized = normalizeMonthlyRevenueSourceRow(input);
      expect(normalized.releaseDate).toBeNull();
    });
  });

  describe('source code constraints', () => {
    it('source does not contain Math.random()', () => {
      const src = fs.readFileSync(SRC_PATH, 'utf8');
      expect(src).not.toMatch(/Math\.random\(\)/);
    });

    it('source has no external imports (only relative or none)', () => {
      const src = fs.readFileSync(SRC_PATH, 'utf8');
      expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
    });
  });
});
