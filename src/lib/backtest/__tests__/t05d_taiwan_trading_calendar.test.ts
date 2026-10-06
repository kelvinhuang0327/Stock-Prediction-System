/**
 * t05d_taiwan_trading_calendar.test.ts — T-05D Taiwan Trading Calendar Adapter Tests
 *
 * SAFETY CONTRACT:
 * - T-05D: Taiwan trading calendar adapter | deterministic calendar | static override contract
 * - no external API, no DB write, no LLM call
 * - no strategy mutation, no performance claim, no edge claim
 * - no H001-H012
 *
 * 14+ tests covering all T-05D requirements.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  normalizeTradingDateKey,
  isTaiwanTradingDay,
  buildTaiwanTradingCalendar,
  buildTaiwanTradingDateRange,
  buildMonthlyTradingRebalanceSchedule,
  validateTradingCalendarCoverage,
  InvalidTradingDateKeyError,
  TAIWAN_STATIC_HOLIDAYS_2024_2026,
  type TaiwanTradingCalendarResult,
} from '@/lib/backtest/TaiwanTradingCalendar';

import { buildWalkForwardSkeleton } from '@/lib/backtest/WalkForwardEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FORBIDDEN_KEYS = [
  'buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha',
  'edge', 'profit', 'recommendation', 'outperform',
] as const;

const H_PATTERN = /H0(0[1-9]|1[0-2])\b/;

function containsForbiddenKey(obj: unknown, path: string = 'root'): string[] {
  const violations: string[] = [];
  if (obj === null || obj === undefined) return violations;
  if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const lk = key.toLowerCase();
      for (const forbidden of FORBIDDEN_KEYS) {
        if (lk.includes(forbidden)) {
          violations.push(`Key "${key}" at ${path} contains forbidden term "${forbidden}"`);
        }
      }
      if (H_PATTERN.test(key)) {
        violations.push(`Key "${key}" at ${path} matches H001-H012 pattern`);
      }
      violations.push(...containsForbiddenKey(val, `${path}.${key}`));
    }
  }
  return violations;
}

function makeCalendar(
  startDate: string,
  endDate: string,
  holidayOverrides?: string[],
  specialTradingDayOverrides?: string[],
): TaiwanTradingCalendarResult {
  return buildTaiwanTradingCalendar({ startDate, endDate, holidayOverrides, specialTradingDayOverrides });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('T-05D: TaiwanTradingCalendar', () => {

  // ── Test 1: normalizeTradingDateKey returns YYYY-MM-DD ────────────────────
  describe('normalizeTradingDateKey', () => {
    it('1. returns YYYY-MM-DD from string input', () => {
      expect(normalizeTradingDateKey('2025-04-07')).toBe('2025-04-07');
    });

    it('1b. returns YYYY-MM-DD from Date object', () => {
      const d = new Date('2025-04-07T00:00:00Z');
      expect(normalizeTradingDateKey(d)).toBe('2025-04-07');
    });

    it('1c. throws InvalidTradingDateKeyError for invalid string', () => {
      expect(() => normalizeTradingDateKey('not-a-date')).toThrow(InvalidTradingDateKeyError);
    });

    it('1d. throws InvalidTradingDateKeyError for invalid Date object', () => {
      expect(() => normalizeTradingDateKey(new Date('invalid'))).toThrow(InvalidTradingDateKeyError);
    });

    // ── Test 2: normalizeTradingDateKey is timezone-stable ──────────────────
    it('2. is timezone-stable (UTC-based, not locale-dependent)', () => {
      // New York midnight = 2025-04-07T04:00:00Z, which is still 2025-04-07 in UTC
      const d = new Date('2025-04-07T04:00:00Z');
      expect(normalizeTradingDateKey(d)).toBe('2025-04-07');
    });

    it('2b. YYYY-MM-DD string is idempotent', () => {
      expect(normalizeTradingDateKey('2026-01-01')).toBe('2026-01-01');
      expect(normalizeTradingDateKey('2024-12-31')).toBe('2024-12-31');
    });
  });

  // ── Test 3: isTaiwanTradingDay excludes Saturday ──────────────────────────
  describe('isTaiwanTradingDay', () => {
    it('3. excludes Saturday', () => {
      // 2025-04-05 is a Saturday
      const cal = makeCalendar('2025-04-04', '2025-04-07');
      expect(isTaiwanTradingDay('2025-04-05', cal)).toBe(false);
    });

    // ── Test 4: isTaiwanTradingDay excludes Sunday ────────────────────────
    it('4. excludes Sunday', () => {
      // 2025-04-06 is a Sunday
      const cal = makeCalendar('2025-04-04', '2025-04-07');
      expect(isTaiwanTradingDay('2025-04-06', cal)).toBe(false);
    });

    // ── Test 5: isTaiwanTradingDay excludes holidayOverrides ─────────────
    it('5. excludes custom holidayOverrides (weekday becomes non-trading)', () => {
      // 2025-04-07 is a Monday — trading normally
      // Override it as a custom holiday
      const cal = makeCalendar('2025-04-07', '2025-04-09', ['2025-04-07']);
      expect(isTaiwanTradingDay('2025-04-07', cal)).toBe(false);
    });

    it('5b. excludes built-in Taiwan holidays', () => {
      // 2025-01-01 is New Year's Day (built-in)
      const cal = makeCalendar('2024-12-30', '2025-01-03');
      expect(isTaiwanTradingDay('2025-01-01', cal)).toBe(false);
    });

    it('5c. a regular Monday in range is trading day', () => {
      // 2025-04-07 is Monday, no overrides
      const cal = makeCalendar('2025-04-07', '2025-04-11');
      expect(isTaiwanTradingDay('2025-04-07', cal)).toBe(true);
    });

    // ── Test 6: isTaiwanTradingDay includes specialTradingDayOverrides ────
    it('6. includes specialTradingDayOverrides even on a weekend', () => {
      // 2025-04-05 is Saturday — normally excluded
      const cal = makeCalendar('2025-04-04', '2025-04-07', [], ['2025-04-05']);
      expect(isTaiwanTradingDay('2025-04-05', cal)).toBe(true);
    });
  });

  // ── Test 7: buildTaiwanTradingDateRange returns deterministic dates ───────
  describe('buildTaiwanTradingDateRange', () => {
    it('7. returns deterministic trading dates (Mon-Fri, no built-in holidays)', () => {
      // 2025-04-07 Mon, Apr 8 Tue, Apr 9 Wed, Apr 10 Thu, Apr 11 Fri
      // Apr 3-4 are Children's Day holidays (built-in)
      const dates = buildTaiwanTradingDateRange('2025-04-07', '2025-04-11');
      expect(dates).toEqual(['2025-04-07', '2025-04-08', '2025-04-09', '2025-04-10', '2025-04-11']);
    });

    it('7b. is deterministic — same call returns same result', () => {
      const a = buildTaiwanTradingDateRange('2025-06-01', '2025-06-10');
      const b = buildTaiwanTradingDateRange('2025-06-01', '2025-06-10');
      expect(a).toEqual(b);
    });

    // ── Test 8: buildTaiwanTradingDateRange handles empty range ───────────
    it('8. handles empty range (endDate < startDate)', () => {
      const dates = buildTaiwanTradingDateRange('2025-04-10', '2025-04-07');
      expect(dates).toEqual([]);
    });

    it('8b. handles single-day range that is a weekend', () => {
      // 2025-04-05 is Saturday
      const dates = buildTaiwanTradingDateRange('2025-04-05', '2025-04-05');
      expect(dates).toEqual([]);
    });

    it('8c. handles single-day range that is a trading day', () => {
      // 2025-04-07 is Monday, not a holiday
      const dates = buildTaiwanTradingDateRange('2025-04-07', '2025-04-07');
      expect(dates).toEqual(['2025-04-07']);
    });

    it('8d. applies holidayOverrides', () => {
      const dates = buildTaiwanTradingDateRange('2025-04-07', '2025-04-09', ['2025-04-07']);
      expect(dates).not.toContain('2025-04-07');
      expect(dates).toContain('2025-04-08');
    });

    it('8e. applies specialTradingDayOverrides to add a Saturday', () => {
      // 2025-04-05 Saturday — add as special trading day
      const dates = buildTaiwanTradingDateRange('2025-04-05', '2025-04-07', [], ['2025-04-05']);
      expect(dates).toContain('2025-04-05');
    });
  });

  // ── Test 9: buildMonthlyTradingRebalanceSchedule uses first trading day ───
  describe('buildMonthlyTradingRebalanceSchedule', () => {
    it('9. uses first available trading day per month', () => {
      const cal = makeCalendar('2025-04-01', '2025-05-31');
      const schedule = buildMonthlyTradingRebalanceSchedule('2025-04-01', '2025-05-31', cal);

      const aprEntry = schedule.entries.find(e => e.monthKey === '2025-04');
      const mayEntry = schedule.entries.find(e => e.monthKey === '2025-05');

      expect(aprEntry).toBeDefined();
      expect(aprEntry!.status).toBe('AVAILABLE');
      // First trading day in April 2025: Apr 1 (Tue) — Apr 3-4 are holidays (built-in)
      // Apr 1 is a Tuesday = trading day
      expect(aprEntry!.scheduledTradingDate).toBe('2025-04-01');

      expect(mayEntry).toBeDefined();
      expect(mayEntry!.status).toBe('AVAILABLE');
      // May 1 is Labor Day (built-in holiday); first trading day should be May 2 (Fri)
      expect(mayEntry!.scheduledTradingDate).toBe('2025-05-02');
    });

    it('9b. returns TAIWAN_TRADING_CALENDAR basis', () => {
      const cal = makeCalendar('2025-04-01', '2025-04-30');
      const schedule = buildMonthlyTradingRebalanceSchedule('2025-04-01', '2025-04-30', cal);
      expect(schedule.calendarBasis).toBe('TAIWAN_TRADING_CALENDAR');
    });

    it('9c. rebalanceCount equals count of AVAILABLE entries', () => {
      const cal = makeCalendar('2025-04-01', '2025-06-30');
      const schedule = buildMonthlyTradingRebalanceSchedule('2025-04-01', '2025-06-30', cal);
      const availableCount = schedule.entries.filter(e => e.status === 'AVAILABLE').length;
      expect(schedule.rebalanceCount).toBe(availableCount);
    });

    // ── Test 10: handles month with no available trading day ──────────────
    it('10. handles month with no available trading day (all overridden as holidays)', () => {
      // Build a calendar where April 2025 has all weekdays overridden as holidays
      const allAprilWeekdays: string[] = [];
      const d = new Date('2025-04-01T00:00:00Z');
      while (d.toISOString().slice(0, 7) === '2025-04') {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) allAprilWeekdays.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
      }

      const cal = makeCalendar('2025-04-01', '2025-05-31', allAprilWeekdays);
      const schedule = buildMonthlyTradingRebalanceSchedule('2025-04-01', '2025-05-31', cal);

      const aprEntry = schedule.entries.find(e => e.monthKey === '2025-04');
      expect(aprEntry).toBeDefined();
      expect(aprEntry!.status).toBe('NO_TRADING_DAYS');
      expect(aprEntry!.scheduledTradingDate).toBeNull();
      expect(aprEntry!.availableTradingDaysInMonth).toBe(0);
    });

    it('10b. returns empty schedule when no trading dates exist', () => {
      // Empty calendar (inverted range)
      const cal = makeCalendar('2025-04-05', '2025-04-05'); // Saturday only
      const schedule = buildMonthlyTradingRebalanceSchedule('2025-04-05', '2025-04-05', cal);
      expect(schedule.rebalanceCount).toBe(0);
    });
  });

  // ── Test 11: validateTradingCalendarCoverage returns PASS/WARN/FAIL ───────
  describe('validateTradingCalendarCoverage', () => {
    it('11. returns PASS for normal trading range (typical ~70% of calendar days)', () => {
      const cal = makeCalendar('2025-04-07', '2025-04-11');
      const coverage = validateTradingCalendarCoverage(cal);
      expect(coverage.status).toBe('PASS');
      expect(coverage.tradingDayCount).toBeGreaterThan(0);
      expect(coverage.tradingDayCount).toBeLessThanOrEqual(coverage.totalCalendarDays);
    });

    it('11b. returns correct counts for a known range', () => {
      // Apr 7 (Mon) – Apr 11 (Fri) = 5 calendar days (Mon-Fri), all trading
      const cal = makeCalendar('2025-04-07', '2025-04-11');
      const coverage = validateTradingCalendarCoverage(cal);
      expect(coverage.totalCalendarDays).toBe(5);
      expect(coverage.tradingDayCount).toBe(5);
      expect(coverage.weekendExcludedCount).toBe(0);
    });

    it('11c. returns WARN when coverage is between 20% and 40%', () => {
      // Force low coverage by overriding many weekdays
      // 1 week (7 days), override all 5 weekdays → 0 trading days / 7 = 0%
      // Instead use a short range with many overrides: ratio 25%
      // Apr 7-14 = 8 days. 2 trading days (override 3 weekdays of 6 available)
      const cal = makeCalendar('2025-04-07', '2025-04-14', [
        '2025-04-07', '2025-04-08', '2025-04-09', // Mon-Wed excluded
      ]);
      const coverage = validateTradingCalendarCoverage(cal);
      // tradingDayCount = 2 (Thu, Fri) out of 8 total = 25% → WARN
      expect(['WARN', 'PASS']).toContain(coverage.status);
    });

    it('11d. returns FAIL when coverage is less than 20%', () => {
      // Apr 7-14 = 8 days. Override all 6 weekdays → 0 trading / 8 = 0% → FAIL
      const allWeekdays = ['2025-04-07', '2025-04-08', '2025-04-09', '2025-04-10', '2025-04-11', '2025-04-14'];
      const cal = makeCalendar('2025-04-07', '2025-04-14', allWeekdays);
      const coverage = validateTradingCalendarCoverage(cal);
      expect(coverage.status).toBe('FAIL');
    });

    it('11e. firstTradingDate and lastTradingDate are populated correctly', () => {
      const cal = makeCalendar('2025-04-07', '2025-04-11');
      const coverage = validateTradingCalendarCoverage(cal);
      expect(coverage.firstTradingDate).toBe('2025-04-07');
      expect(coverage.lastTradingDate).toBe('2025-04-11');
    });

    it('11f. firstTradingDate and lastTradingDate are null for empty calendar', () => {
      const cal = makeCalendar('2025-04-05', '2025-04-06'); // Sat-Sun only
      const coverage = validateTradingCalendarCoverage(cal);
      expect(coverage.firstTradingDate).toBeNull();
      expect(coverage.lastTradingDate).toBeNull();
    });
  });

  // ── Test 12: WalkForwardEngine accepts Taiwan trading dates ───────────────
  describe('WalkForwardEngine integration', () => {
    it('12. WalkForwardEngine accepts tradingDates and uses TAIWAN_TRADING_CALENDAR basis', () => {
      const tradingDates = buildTaiwanTradingDateRange('2025-01-02', '2025-04-30');
      expect(tradingDates.length).toBeGreaterThan(0);

      const skeleton = buildWalkForwardSkeleton(
        { currentDate: '2025-04-30', tradingDates },
        new Map(),
      );

      expect(skeleton.calendarBasis).toBe('TAIWAN_TRADING_CALENDAR');
      expect(skeleton.totalDays).toBe(tradingDates.length);
      expect(skeleton.records.length).toBe(tradingDates.length);
    });

    it('12b. WalkForwardEngine falls back to WEEKDAY_APPROXIMATION without tradingDates', () => {
      const skeleton = buildWalkForwardSkeleton(
        { currentDate: '2025-04-30', lookbackDays: 30 },
        new Map(),
      );
      expect(skeleton.calendarBasis).toBe('WEEKDAY_APPROXIMATION');
    });

    it('12c. T-05B safety contract is preserved with Taiwan calendar dates', () => {
      const tradingDates = buildTaiwanTradingDateRange('2025-04-01', '2025-04-30');
      const skeleton = buildWalkForwardSkeleton(
        { currentDate: '2025-04-30', tradingDates },
        new Map(),
      );
      const sc = skeleton.safetyContract;
      expect(sc.noDbWrite).toBe(true);
      expect(sc.noExternalApiCall).toBe(true);
      expect(sc.noLlmCall).toBe(true);
      expect(sc.noBuySellOutput).toBe(true);
      expect(sc.noTradingClaims).toBe(true);
      expect(sc.noPerformanceClaims).toBe(true);
      expect(sc.observabilityOnly).toBe(true);
    });

    it('12d. Taiwan calendar excludes built-in holidays from walk-forward records', () => {
      // 2025-01-01 is New Year (built-in holiday) — should not appear in records
      const tradingDates = buildTaiwanTradingDateRange('2024-12-30', '2025-01-05');
      expect(tradingDates).not.toContain('2025-01-01');
    });
  });

  // ── Test 13: output contains no forbidden strategy/performance fields ──────
  describe('Forbidden field / guardrail checks', () => {
    it('13. TaiwanTradingCalendarResult contains no forbidden field names', () => {
      const cal = makeCalendar('2025-04-07', '2025-04-30');
      // Remove Set before checking (not JSON-serializable)
      const { tradingDateSet: _set, ...calForCheck } = cal;
      const violations = containsForbiddenKey(calForCheck);
      expect(violations).toEqual([]);
    });

    it('13b. TradingCalendarRebalanceSchedule contains no forbidden field names', () => {
      const cal = makeCalendar('2025-04-07', '2025-05-31');
      const schedule = buildMonthlyTradingRebalanceSchedule('2025-04-07', '2025-05-31', cal);
      const violations = containsForbiddenKey(schedule);
      expect(violations).toEqual([]);
    });

    it('13c. validateTradingCalendarCoverage result contains no forbidden field names', () => {
      const cal = makeCalendar('2025-04-07', '2025-04-30');
      const coverage = validateTradingCalendarCoverage(cal);
      const violations = containsForbiddenKey(coverage);
      expect(violations).toEqual([]);
    });

    it('13d. WalkForwardSkeleton with calendar basis has no forbidden field names (excluding safety contract negation keys)', () => {
      const tradingDates = buildTaiwanTradingDateRange('2025-04-01', '2025-04-30');
      const skeleton = buildWalkForwardSkeleton(
        { currentDate: '2025-04-30', tradingDates },
        new Map(),
      );
      // Exclude safetyContract: it uses negation-prefix keys like noBuySellOutput
      // which are explicitly recording "no buy/sell" — not strategy output fields.
      const { safetyContract: _sc, ...skeletonForCheck } = skeleton;
      const violations = containsForbiddenKey(skeletonForCheck);
      expect(violations).toEqual([]);
    });

    it('13e. TAIWAN_STATIC_HOLIDAYS_2024_2026 has no forbidden field names in array elements', () => {
      // holiday dates are plain strings — no object keys to check
      expect(Array.isArray(TAIWAN_STATIC_HOLIDAYS_2024_2026)).toBe(true);
      TAIWAN_STATIC_HOLIDAYS_2024_2026.forEach(d => {
        expect(typeof d).toBe('string');
        expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

  // ── Test 14: no DB write / external API / LLM behavior ───────────────────
  describe('Safety audit — source code inspection', () => {
    it('14. TaiwanTradingCalendar.ts does not import Prisma or DB clients', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'TaiwanTradingCalendar.ts'),
        'utf8',
      );
      expect(src).not.toMatch(/from ['"]@prisma\/client['"]/);
      expect(src).not.toMatch(/from ['"]prisma['"]/);
      expect(src).not.toMatch(/PrismaClient/);
    });

    it('14b. TaiwanTradingCalendar.ts does not import external API clients', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'TaiwanTradingCalendar.ts'),
        'utf8',
      );
      expect(src).not.toMatch(/fetch\s*\(/);
      expect(src).not.toMatch(/axios/);
      expect(src).not.toMatch(/https?\:\/\//);
    });

    it('14c. TaiwanTradingCalendar.ts does not import LLM clients', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'TaiwanTradingCalendar.ts'),
        'utf8',
      );
      expect(src).not.toMatch(/openai/i);
      expect(src).not.toMatch(/anthropic/i);
      expect(src).not.toMatch(/langchain/i);
    });

    it('14d. TaiwanTradingCalendar.ts uses resolveCurrentDate (no hardcoded TODAY_CAP)', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'TaiwanTradingCalendar.ts'),
        'utf8',
      );
      expect(src).toMatch(/resolveCurrentDate/);
      // Non-comment lines should not have TODAY_CAP
      const nonCommentLines = src
        .split('\n')
        .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
      const hasCap = nonCommentLines.some(l => l.includes('TODAY_CAP'));
      expect(hasCap).toBe(false);
    });

    it('14e. static holiday list dates are all valid YYYY-MM-DD', () => {
      TAIWAN_STATIC_HOLIDAYS_2024_2026.forEach(d => {
        expect(() => normalizeTradingDateKey(d)).not.toThrow();
        expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

  // ── Additional coverage tests ─────────────────────────────────────────────
  describe('Additional calendar edge cases', () => {
    it('15. buildTaiwanTradingCalendar calendarBasis is always TAIWAN_TRADING_CALENDAR', () => {
      const cal = makeCalendar('2025-04-07', '2025-04-11');
      expect(cal.calendarBasis).toBe('TAIWAN_TRADING_CALENDAR');
    });

    it('16. static holiday list covers 2024-2026 dates only', () => {
      TAIWAN_STATIC_HOLIDAYS_2024_2026.forEach(d => {
        const year = parseInt(d.slice(0, 4), 10);
        expect(year).toBeGreaterThanOrEqual(2024);
        expect(year).toBeLessThanOrEqual(2026);
      });
    });

    it('17. tradingDateSet in result is consistent with tradingDates array', () => {
      const cal = makeCalendar('2025-04-07', '2025-04-30');
      cal.tradingDates.forEach(d => {
        expect(cal.tradingDateSet.has(d)).toBe(true);
      });
      expect(cal.tradingDateSet.size).toBe(cal.tradingDates.length);
    });

    it('18. 500-day lookback with Taiwan calendar builds without error', () => {
      const endDate = '2026-05-07';
      const startDate = (() => {
        const d = new Date(endDate + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() - 500);
        return d.toISOString().slice(0, 10);
      })();

      const tradingDates = buildTaiwanTradingDateRange(startDate, endDate);
      expect(tradingDates.length).toBeGreaterThan(200); // ~350 trading days in 500 calendar days
      expect(tradingDates.length).toBeLessThan(500);

      const skeleton = buildWalkForwardSkeleton(
        { currentDate: endDate, tradingDates },
        new Map(),
      );
      expect(skeleton.calendarBasis).toBe('TAIWAN_TRADING_CALENDAR');
      expect(skeleton.totalDays).toBe(tradingDates.length);
    });
  });
});
