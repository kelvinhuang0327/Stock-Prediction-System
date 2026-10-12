/**
 * p17monthly_revenue_availability.test.ts
 *
 * DISCLAIMER: Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 * Governance / PIT gate tests only.
 *
 * P17-HARDRESET: Full test suite for MonthlyRevenueAvailability helper.
 */
import {
  inferMonthlyRevenueReleaseDate,
  normalizeMonthlyRevenueReleaseDate,
  isMonthlyRevenueAvailableAsOf,
  filterMonthlyRevenueAvailableAsOf,
  validateMonthlyRevenueAvailabilityResult,
  explainMonthlyRevenueAvailability,
  TAIWAN_REVENUE_RELEASE_DAY,
  INFERRED_RELEASE_DATE_SOURCE,
  INFERRED_RELEASE_DATE_CONFIDENCE,
} from '../MonthlyRevenueAvailability';

// ─── Constants ───────────────────────────────────────────────────────────────

describe('Constants', () => {
  it('TAIWAN_REVENUE_RELEASE_DAY is 10', () => {
    expect(TAIWAN_REVENUE_RELEASE_DAY).toBe(10);
  });
  it('INFERRED_RELEASE_DATE_SOURCE is INFERRED_NEXT_MONTH_10TH', () => {
    expect(INFERRED_RELEASE_DATE_SOURCE).toBe('INFERRED_NEXT_MONTH_10TH');
  });
  it('INFERRED_RELEASE_DATE_CONFIDENCE is LOW_TO_MEDIUM', () => {
    expect(INFERRED_RELEASE_DATE_CONFIDENCE).toBe('LOW_TO_MEDIUM');
  });
});

// ─── inferMonthlyRevenueReleaseDate ──────────────────────────────────────────

describe('inferMonthlyRevenueReleaseDate', () => {
  it('infers Jan → Feb 10 same year', () => {
    const result = inferMonthlyRevenueReleaseDate({ year: 2026, month: 1 });
    expect(result).not.toBeNull();
    expect(result!.releaseDate).toBe('2026-02-10');
    expect(result!.releaseDateSource).toBe(INFERRED_RELEASE_DATE_SOURCE);
    expect(result!.releaseDateConfidence).toBe(INFERRED_RELEASE_DATE_CONFIDENCE);
  });

  it('infers Nov → Dec 10 same year', () => {
    const result = inferMonthlyRevenueReleaseDate({ year: 2026, month: 11 });
    expect(result!.releaseDate).toBe('2026-12-10');
  });

  it('infers Dec → Jan 10 next year', () => {
    const result = inferMonthlyRevenueReleaseDate({ year: 2025, month: 12 });
    expect(result!.releaseDate).toBe('2026-01-10');
  });

  it('infers Aug → Sep 10', () => {
    const result = inferMonthlyRevenueReleaseDate({ year: 2026, month: 8 });
    expect(result!.releaseDate).toBe('2026-09-10');
  });

  it('returns null for null year', () => {
    const result = inferMonthlyRevenueReleaseDate({ year: null, month: 3 });
    expect(result).toBeNull();
  });

  it('returns null for null month', () => {
    const result = inferMonthlyRevenueReleaseDate({ year: 2026, month: null });
    expect(result).toBeNull();
  });

  it('returns null for invalid month 0', () => {
    const result = inferMonthlyRevenueReleaseDate({ year: 2026, month: 0 });
    expect(result).toBeNull();
  });

  it('returns null for invalid month 13', () => {
    const result = inferMonthlyRevenueReleaseDate({ year: 2026, month: 13 });
    expect(result).toBeNull();
  });

  it('pads single-digit months correctly', () => {
    const result = inferMonthlyRevenueReleaseDate({ year: 2026, month: 3 });
    expect(result!.releaseDate).toBe('2026-04-10');
  });

  it('pads single-digit release day correctly', () => {
    const result = inferMonthlyRevenueReleaseDate({ year: 2026, month: 9 });
    expect(result!.releaseDate).toBe('2026-10-10');
  });
});

// ─── normalizeMonthlyRevenueReleaseDate ──────────────────────────────────────

describe('normalizeMonthlyRevenueReleaseDate', () => {
  it('converts ISO string to YYYY-MM-DD', () => {
    const norm = normalizeMonthlyRevenueReleaseDate({
      year: 2026, month: 3, releaseDate: '2026-04-10T00:00:00.000Z',
    });
    expect(norm.releaseDate).toBe('2026-04-10');
  });

  it('passes through YYYY-MM-DD unchanged', () => {
    const norm = normalizeMonthlyRevenueReleaseDate({
      year: 2026, month: 3, releaseDate: '2026-04-10',
    });
    expect(norm.releaseDate).toBe('2026-04-10');
  });

  it('converts Date object (UTC) to YYYY-MM-DD', () => {
    const norm = normalizeMonthlyRevenueReleaseDate({
      year: 2026, month: 3, releaseDate: new Date('2026-04-10T00:00:00.000Z'),
    });
    expect(norm.releaseDate).toBe('2026-04-10');
  });

  it('returns null for null releaseDate', () => {
    const norm = normalizeMonthlyRevenueReleaseDate({ year: 2026, month: 3, releaseDate: null });
    expect(norm.releaseDate).toBeNull();
  });

  it('returns null for undefined releaseDate', () => {
    const norm = normalizeMonthlyRevenueReleaseDate({ year: 2026, month: 3 });
    expect(norm.releaseDate).toBeNull();
  });

  it('preserves releaseDateSource', () => {
    const norm = normalizeMonthlyRevenueReleaseDate({
      year: 2026, month: 3,
      releaseDate: '2026-04-10',
      releaseDateSource: INFERRED_RELEASE_DATE_SOURCE,
      releaseDateConfidence: INFERRED_RELEASE_DATE_CONFIDENCE,
    });
    expect(norm.releaseDateSource).toBe(INFERRED_RELEASE_DATE_SOURCE);
    expect(norm.releaseDateConfidence).toBe(INFERRED_RELEASE_DATE_CONFIDENCE);
  });
});

// ─── isMonthlyRevenueAvailableAsOf ───────────────────────────────────────────

describe('isMonthlyRevenueAvailableAsOf', () => {
  describe('explicit releaseDate', () => {
    it('available when releaseDate < asOfDate', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 2, releaseDate: '2026-03-10' },
        '2026-05-01'
      );
      expect(result.available).toBe(true);
      expect(result.inferred).toBe(false);
    });

    it('available when releaseDate === asOfDate (boundary)', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 3, releaseDate: '2026-04-10' },
        '2026-04-10'
      );
      expect(result.available).toBe(true);
    });

    it('unavailable when releaseDate > asOfDate', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 4, releaseDate: '2026-05-10' },
        '2026-04-30'
      );
      expect(result.available).toBe(false);
    });

    it('returns correct releaseDate in result', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 2, releaseDate: '2026-03-10' },
        '2026-05-01'
      );
      expect(result.releaseDate).toBe('2026-03-10');
    });

    it('handles Date object releaseDate', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 3, releaseDate: new Date('2026-04-10T00:00:00.000Z') },
        '2026-04-10'
      );
      expect(result.available).toBe(true);
    });

    it('includes asOfDate in result', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 2, releaseDate: '2026-03-10' },
        '2026-05-01'
      );
      expect(result.asOfDate).toBe('2026-05-01');
    });
  });

  describe('missing releaseDate + allowInferredReleaseDate=false (default)', () => {
    it('unavailable with no releaseDate', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 1 },
        '2026-04-01'
      );
      expect(result.available).toBe(false);
      expect(result.releaseDate).toBeNull();
    });

    it('unavailable explicitly with allowInferred=false', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 3 },
        '2026-05-01',
        { allowInferredReleaseDate: false }
      );
      expect(result.available).toBe(false);
    });
  });

  describe('missing releaseDate + allowInferredReleaseDate=true', () => {
    it('uses inferred releaseDate (next month 10th)', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 3 },
        '2026-04-10',
        { allowInferredReleaseDate: true }
      );
      expect(result.inferred).toBe(true);
      expect(result.releaseDate).toBe('2026-04-10');
    });

    it('available when asOf >= inferred date', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 3 },
        '2026-04-10',
        { allowInferredReleaseDate: true }
      );
      expect(result.available).toBe(true);
    });

    it('unavailable when asOf < inferred date', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 3 },
        '2026-04-09',
        { allowInferredReleaseDate: true }
      );
      expect(result.available).toBe(false);
    });

    it('tags inferred source and confidence', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 3 },
        '2026-04-10',
        { allowInferredReleaseDate: true }
      );
      expect(result.releaseDateSource).toBe(INFERRED_RELEASE_DATE_SOURCE);
      expect(result.releaseDateConfidence).toBe(INFERRED_RELEASE_DATE_CONFIDENCE);
    });

    it('handles Dec → Jan 10 next year', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2025, month: 12 },
        '2026-01-10',
        { allowInferredReleaseDate: true }
      );
      expect(result.available).toBe(true);
      expect(result.releaseDate).toBe('2026-01-10');
    });
  });

  describe('invalid records', () => {
    it('unavailable for null year', () => {
      const result = isMonthlyRevenueAvailableAsOf({ year: null, month: 3 }, '2026-05-01');
      expect(result.available).toBe(false);
    });

    it('unavailable for undefined year', () => {
      const result = isMonthlyRevenueAvailableAsOf({ year: undefined, month: 3 }, '2026-05-01');
      expect(result.available).toBe(false);
    });

    it('unavailable for null month', () => {
      const result = isMonthlyRevenueAvailableAsOf({ year: 2026, month: null }, '2026-05-01');
      expect(result.available).toBe(false);
    });

    it('unavailable for month=0', () => {
      const result = isMonthlyRevenueAvailableAsOf({ year: 2026, month: 0 }, '2026-05-01');
      expect(result.available).toBe(false);
    });

    it('unavailable for month=13', () => {
      const result = isMonthlyRevenueAvailableAsOf({ year: 2026, month: 13 }, '2026-05-01');
      expect(result.available).toBe(false);
    });
  });

  describe('result fields safety', () => {
    const FORBIDDEN = ['outcomePrice','returnPct','realizedReturnClass','futurePrice','horizonReturnPct','outcomeDate','horizonDays','baselineResult','outcomeClose'];

    it('result does not contain forbidden outcome fields', () => {
      const result = isMonthlyRevenueAvailableAsOf(
        { year: 2026, month: 3, releaseDate: '2026-04-10' },
        '2026-05-01'
      );
      const resultKeys = Object.keys(result);
      const found = FORBIDDEN.filter(f => resultKeys.includes(f));
      expect(found).toHaveLength(0);
    });

    it('result always has reason string', () => {
      const result = isMonthlyRevenueAvailableAsOf({ year: 2026, month: 3 }, '2026-05-01');
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it('result always has boolean available', () => {
      const result = isMonthlyRevenueAvailableAsOf({ year: 2026, month: 3 }, '2026-05-01');
      expect(typeof result.available).toBe('boolean');
    });

    it('result always has boolean inferred', () => {
      const result = isMonthlyRevenueAvailableAsOf({ year: 2026, month: 3 }, '2026-05-01');
      expect(typeof result.inferred).toBe('boolean');
    });
  });
});

// ─── filterMonthlyRevenueAvailableAsOf ───────────────────────────────────────

describe('filterMonthlyRevenueAvailableAsOf', () => {
  const records = [
    { year: 2026, month: 1, revenue: 1e8, releaseDate: '2026-02-10' },
    { year: 2026, month: 2, revenue: 2e8, releaseDate: '2026-03-10' },
    { year: 2026, month: 3, revenue: 3e8, releaseDate: '2026-04-10' },
    { year: 2026, month: 4, revenue: 4e8, releaseDate: '2026-05-10' }, // future
    { year: 2026, month: 5, revenue: 5e8 }, // no releaseDate
  ];

  it('returns only available records as of asOfDate', () => {
    const filtered = filterMonthlyRevenueAvailableAsOf(records, '2026-04-10');
    expect(filtered.map(r => r.month)).toEqual([1, 2, 3]);
  });

  it('excludes future records', () => {
    const filtered = filterMonthlyRevenueAvailableAsOf(records, '2026-04-10');
    expect(filtered.some(r => r.month === 4)).toBe(false);
  });

  it('excludes records without releaseDate (default allowInferred=false)', () => {
    const filtered = filterMonthlyRevenueAvailableAsOf(records, '2026-06-01');
    expect(filtered.some(r => r.month === 5)).toBe(false);
  });

  it('includes inferred records when allowInferred=true', () => {
    const noRelease = [{ year: 2026, month: 3, revenue: 3e8 }];
    const filtered = filterMonthlyRevenueAvailableAsOf(noRelease, '2026-04-10', { allowInferredReleaseDate: true });
    expect(filtered).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    const filtered = filterMonthlyRevenueAvailableAsOf([], '2026-04-10');
    expect(filtered).toHaveLength(0);
  });

  it('returns empty array when all are future', () => {
    const future = [
      { year: 2026, month: 5, revenue: 1e8, releaseDate: '2026-06-10' },
    ];
    const filtered = filterMonthlyRevenueAvailableAsOf(future, '2026-05-01');
    expect(filtered).toHaveLength(0);
  });

  it('preserves original record shape', () => {
    const filtered = filterMonthlyRevenueAvailableAsOf(records, '2026-04-10');
    expect(filtered[0]).toHaveProperty('revenue');
    expect(filtered[0]).toHaveProperty('year');
    expect(filtered[0]).toHaveProperty('month');
  });
});

// ─── validateMonthlyRevenueAvailabilityResult ─────────────────────────────────

describe('validateMonthlyRevenueAvailabilityResult', () => {
  it('returns valid=true for well-formed result', () => {
    const result = isMonthlyRevenueAvailableAsOf(
      { year: 2026, month: 3, releaseDate: '2026-04-10' },
      '2026-05-01'
    );
    const v = validateMonthlyRevenueAvailabilityResult(result);
    expect(v.valid).toBe(true);
    expect(v.errors).toHaveLength(0);
  });

  it('returns errors for missing available field', () => {
    const v = validateMonthlyRevenueAvailabilityResult({
      available: undefined as unknown as boolean,
      reason: 'test',
      asOfDate: '2026-05-01',
      inferred: false,
      releaseDate: null,
      releaseDateSource: null,
      releaseDateConfidence: null,
    });
    expect(v.valid).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
  });

  it('returns errors for missing reason', () => {
    const v = validateMonthlyRevenueAvailabilityResult({
      available: true,
      reason: '',
      asOfDate: '2026-05-01',
      inferred: false,
      releaseDate: null,
      releaseDateSource: null,
      releaseDateConfidence: null,
    });
    expect(v.valid).toBe(false);
  });
});

// ─── explainMonthlyRevenueAvailability ───────────────────────────────────────

describe('explainMonthlyRevenueAvailability', () => {
  it('returns RULE_2_EXPLICIT_AVAILABLE for explicit available', () => {
    const exp = explainMonthlyRevenueAvailability(
      { year: 2026, month: 3, releaseDate: '2026-04-10' },
      '2026-05-01'
    );
    expect(exp.rule).toBe('RULE_2_EXPLICIT_AVAILABLE');
    expect(exp.available).toBe(true);
  });

  it('returns RULE_2_EXPLICIT_UNAVAILABLE for explicit unavailable', () => {
    const exp = explainMonthlyRevenueAvailability(
      { year: 2026, month: 4, releaseDate: '2026-05-10' },
      '2026-04-30'
    );
    expect(exp.rule).toBe('RULE_2_EXPLICIT_UNAVAILABLE');
    expect(exp.available).toBe(false);
  });

  it('returns RULE_3_INFERRED_AVAILABLE when inferred available', () => {
    const exp = explainMonthlyRevenueAvailability(
      { year: 2026, month: 3 },
      '2026-04-10',
      { allowInferredReleaseDate: true }
    );
    expect(exp.rule).toBe('RULE_3_INFERRED_AVAILABLE');
    expect(exp.available).toBe(true);
  });

  it('returns RULE_3_INFERRED_UNAVAILABLE when inferred but asOf too early', () => {
    const exp = explainMonthlyRevenueAvailability(
      { year: 2026, month: 3 },
      '2026-04-09',
      { allowInferredReleaseDate: true }
    );
    expect(exp.rule).toBe('RULE_3_INFERRED_UNAVAILABLE');
    expect(exp.available).toBe(false);
  });

  it('returns RULE_4_NO_RELEASE_DATE when no releaseDate and not allowed', () => {
    const exp = explainMonthlyRevenueAvailability(
      { year: 2026, month: 3 },
      '2026-05-01',
      { allowInferredReleaseDate: false }
    );
    expect(exp.rule).toBe('RULE_4_NO_RELEASE_DATE');
  });

  it('returns RULE_4_MISSING_YEAR for null year', () => {
    const exp = explainMonthlyRevenueAvailability(
      { year: null, month: 3 },
      '2026-05-01'
    );
    expect(exp.rule).toBe('RULE_4_MISSING_YEAR');
  });

  it('always has non-empty details string', () => {
    const exp = explainMonthlyRevenueAvailability(
      { year: 2026, month: 3, releaseDate: '2026-04-10' },
      '2026-05-01'
    );
    expect(exp.details.length).toBeGreaterThan(0);
  });

  it('contains TAIWAN_REVENUE_RELEASE_DAY in inferred details', () => {
    const exp = explainMonthlyRevenueAvailability(
      { year: 2026, month: 3 },
      '2026-04-10',
      { allowInferredReleaseDate: true }
    );
    expect(exp.details).toContain('10');
  });
});
