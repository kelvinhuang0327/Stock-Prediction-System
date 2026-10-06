/**
 * p1_twse_trading_calendar.test.ts
 * Tests for TwseTradingCalendar.ts (P1)
 */

import {
    isWeekend,
    isKnownTwseHoliday,
    isTwseTradingDay,
    addTwseTradingDays,
    buildOutcomeTargetDatePlan,
    CALENDAR_VERSION,
    InvalidTwseDateError,
    InvalidHorizonError,
} from '../TwseTradingCalendar';

describe('TwseTradingCalendar — isWeekend', () => {
    it('returns true for Sunday', () => {
        expect(isWeekend('2026-05-10')).toBe(true); // Sunday
    });

    it('returns true for Saturday', () => {
        expect(isWeekend('2026-05-09')).toBe(true); // Saturday
    });

    it('returns false for Monday', () => {
        expect(isWeekend('2026-05-11')).toBe(false); // Monday
    });

    it('returns false for Friday', () => {
        expect(isWeekend('2026-05-15')).toBe(false); // Friday
    });

    it('throws on invalid date format', () => {
        expect(() => isWeekend('20260511')).toThrow(InvalidTwseDateError);
    });

    it('throws on null/empty input', () => {
        expect(() => isWeekend('')).toThrow(InvalidTwseDateError);
    });
});

describe('TwseTradingCalendar — isKnownTwseHoliday', () => {
    it('returns true for known 2026 holiday (Labor Day)', () => {
        expect(isKnownTwseHoliday('2026-05-01')).toBe(true);
    });

    it('returns true for New Year 2026', () => {
        expect(isKnownTwseHoliday('2026-01-01')).toBe(true);
    });

    it('returns false for regular trading day', () => {
        expect(isKnownTwseHoliday('2026-05-11')).toBe(false);
    });

    it('throws on invalid date format', () => {
        expect(() => isKnownTwseHoliday('2026/05/01')).toThrow(InvalidTwseDateError);
    });
});

describe('TwseTradingCalendar — isTwseTradingDay', () => {
    it('returns false for weekend', () => {
        expect(isTwseTradingDay('2026-05-09')).toBe(false); // Saturday
        expect(isTwseTradingDay('2026-05-10')).toBe(false); // Sunday
    });

    it('returns false for known holiday (Labor Day)', () => {
        expect(isTwseTradingDay('2026-05-01')).toBe(false);
    });

    it('returns true for regular weekday', () => {
        expect(isTwseTradingDay('2026-05-11')).toBe(true); // Monday
        expect(isTwseTradingDay('2026-05-12')).toBe(true); // Tuesday
    });

    it('throws on invalid date', () => {
        expect(() => isTwseTradingDay('bad-date')).toThrow(InvalidTwseDateError);
    });
});

describe('TwseTradingCalendar — addTwseTradingDays', () => {
    it('5D from 2026-05-11 (Monday) yields 5th trading day after', () => {
        // May 11 (Mon) -> May 12, 13, 14, 15, 18 (5 trading days)
        const result = addTwseTradingDays('2026-05-11', 5);
        expect(result).toBe('2026-05-18');
    });

    it('20D from 2026-05-11 yields targetTradingDate > asOfDate', () => {
        const result = addTwseTradingDays('2026-05-11', 20);
        expect(result > '2026-05-11').toBe(true);
    });

    it('5D target date > asOfDate', () => {
        const result = addTwseTradingDays('2026-05-11', 5);
        expect(result > '2026-05-11').toBe(true);
    });

    it('20D target date > asOfDate', () => {
        const result = addTwseTradingDays('2026-05-11', 20);
        expect(result > '2026-05-11').toBe(true);
    });

    it('skips weekends — 1D from Friday yields Monday', () => {
        // May 15 (Fri) -> next trading day is May 18 (Mon)
        const result = addTwseTradingDays('2026-05-15', 1);
        expect(result).toBe('2026-05-18');
    });

    it('throws InvalidHorizonError for horizonDays <= 0', () => {
        expect(() => addTwseTradingDays('2026-05-11', 0)).toThrow(InvalidHorizonError);
        expect(() => addTwseTradingDays('2026-05-11', -1)).toThrow(InvalidHorizonError);
    });

    it('throws on invalid date format', () => {
        expect(() => addTwseTradingDays('20260511', 5)).toThrow(InvalidTwseDateError);
    });

    it('is deterministic — same input always yields same output', () => {
        const r1 = addTwseTradingDays('2026-05-11', 5);
        const r2 = addTwseTradingDays('2026-05-11', 5);
        expect(r1).toBe(r2);
    });
});

describe('TwseTradingCalendar — buildOutcomeTargetDatePlan', () => {
    it('returns PASS with valid horizons', () => {
        const plan = buildOutcomeTargetDatePlan('2026-05-11', [5, 20]);
        expect(plan.validationStatus).toBe('PASS');
        expect(plan.targets).toHaveLength(2);
        expect(plan.asOfDate).toBe('2026-05-11');
        expect(plan.calendarVersion).toBe(CALENDAR_VERSION);
    });

    it('5D target uses label "5D"', () => {
        const plan = buildOutcomeTargetDatePlan('2026-05-11', [5]);
        expect(plan.targets[0].horizonLabel).toBe('5D');
    });

    it('20D target uses label "20D"', () => {
        const plan = buildOutcomeTargetDatePlan('2026-05-11', [20]);
        expect(plan.targets[0].horizonLabel).toBe('20D');
    });

    it('all targetTradingDates are > asOfDate', () => {
        const plan = buildOutcomeTargetDatePlan('2026-05-11', [5, 20]);
        for (const t of plan.targets) {
            expect(t.targetTradingDate > '2026-05-11').toBe(true);
        }
    });

    it('returns FAIL with invalid horizon 0', () => {
        const plan = buildOutcomeTargetDatePlan('2026-05-11', [0]);
        expect(plan.validationStatus).toBe('FAIL');
    });

    it('throws on invalid asOfDate format', () => {
        expect(() => buildOutcomeTargetDatePlan('20260511', [5])).toThrow(InvalidTwseDateError);
    });

    it('is deterministic snapshot', () => {
        const plan1 = buildOutcomeTargetDatePlan('2026-05-11', [5, 20]);
        const plan2 = buildOutcomeTargetDatePlan('2026-05-11', [5, 20]);
        expect(JSON.stringify(plan1)).toBe(JSON.stringify(plan2));
    });
});
