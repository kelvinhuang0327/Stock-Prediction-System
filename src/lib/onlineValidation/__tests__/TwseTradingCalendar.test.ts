import {
  addTwseTradingDays,
  buildOutcomeTargetDatePlan,
  CALENDAR_VERSION,
  InvalidHorizonError,
  InvalidTwseDateError,
  isKnownTwseHoliday,
  isTwseTradingDay,
  isWeekend,
  TWSE_STATIC_HOLIDAYS,
} from '../TwseTradingCalendar';

describe('TWSE online-validation trading calendar', () => {
  it('identifies weekends, listed holidays, ordinary trading days, and the calendar version', () => {
    expect(isWeekend('2026-05-16')).toBe(true);
    expect(isWeekend('2026-05-18')).toBe(false);
    expect(isKnownTwseHoliday('2025-01-01')).toBe(true);
    expect(isKnownTwseHoliday('2026-05-18')).toBe(false);
    expect(isTwseTradingDay('2025-01-01')).toBe(false);
    expect(isTwseTradingDay('2026-05-18')).toBe(true);
    expect(CALENDAR_VERSION).toBe('twse-static-2024-2026-v1');
    expect(TWSE_STATIC_HOLIDAYS).toContain('2026-02-23');
  });

  it('rejects malformed and impossible calendar dates while accepting leap days', () => {
    expect(() => isWeekend('2026-5-01')).toThrow(InvalidTwseDateError);
    expect(() => isKnownTwseHoliday('2025-02-30')).toThrow(InvalidTwseDateError);
    expect(() => addTwseTradingDays('2026-02-29', 1)).toThrow(InvalidTwseDateError);
    expect(isWeekend('2024-02-29')).toBe(false);
  });

  it('advances by trading days and skips weekends and static holidays', () => {
    expect(addTwseTradingDays('2026-05-11', 5)).toBe('2026-05-18');
    expect(addTwseTradingDays('2026-02-16', 1)).toBe('2026-02-25');
    expect(() => addTwseTradingDays('2026-05-11', 0)).toThrow(InvalidHorizonError);
    expect(() => addTwseTradingDays('2026-05-11', -1)).toThrow(InvalidHorizonError);
    expect(() => addTwseTradingDays('2026-05-11', 1.5)).toThrow(InvalidHorizonError);
    expect(() => addTwseTradingDays('2026-05-11', Number.POSITIVE_INFINITY)).toThrow(InvalidHorizonError);
    expect(() => addTwseTradingDays('2026-05-11', 1_000)).toThrow(/exceeded 500 calendar days/);
  });

  it('builds labeled target dates and returns validation failures for invalid horizons', () => {
    const valid = buildOutcomeTargetDatePlan('2026-05-11', [5, 20, 60, 3]);
    expect(valid).toMatchObject({
      asOfDate: '2026-05-11',
      calendarVersion: CALENDAR_VERSION,
      validationStatus: 'PASS',
      validationMessages: [],
    });
    expect(valid.targets.map(target => target.horizonLabel)).toEqual(['5D', '20D', '60D', '3D']);
    expect(valid.targets.every(target => target.targetTradingDate > valid.asOfDate)).toBe(true);

    const invalid = buildOutcomeTargetDatePlan('2026-05-11', [0, -3, 1.5, Number.NaN]);
    expect(invalid.validationStatus).toBe('FAIL');
    expect(invalid.targets).toEqual([]);
    expect(invalid.validationMessages).toHaveLength(4);
  });
});
