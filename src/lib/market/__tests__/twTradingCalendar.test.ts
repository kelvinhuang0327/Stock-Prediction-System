/** @jest-environment node */

import {
  isTaiwanTradingDay,
  getPreviousTaiwanTradingDay,
  getNextTaiwanTradingDay,
  classifyQuoteFreshness,
  toTaiwanDateIso,
} from '../twTradingCalendar';

// ---------------------------------------------------------------------------
// Helper: build a UTC Date that corresponds to a Taiwan-local date ISO string.
// Noon Taiwan time avoids any edge-case around midnight.
// ---------------------------------------------------------------------------
function twDate(iso: string): Date {
  return new Date(`${iso}T12:00:00+08:00`);
}

// ---------------------------------------------------------------------------
// isTaiwanTradingDay
// ---------------------------------------------------------------------------

describe('isTaiwanTradingDay', () => {
  it('2026-05-01 is NOT a trading day (Labor Day)', () => {
    expect(isTaiwanTradingDay(twDate('2026-05-01'))).toBe(false);
  });

  it('2026-04-30 IS a trading day (Thursday, no holiday)', () => {
    expect(isTaiwanTradingDay(twDate('2026-04-30'))).toBe(true);
    // 2026-04-30 is a Thursday — verify day-of-week assumption holds
    const d = new Date('2026-04-30T12:00:00+08:00');
    expect(d.getDay()).toBe(4); // Thursday
    expect(isTaiwanTradingDay(twDate('2026-04-30'))).toBe(true);
  });

  it('Saturday is NOT a trading day', () => {
    // 2026-05-02 is Saturday
    expect(isTaiwanTradingDay(twDate('2026-05-02'))).toBe(false);
  });

  it('Sunday is NOT a trading day', () => {
    // 2026-05-03 is Sunday
    expect(isTaiwanTradingDay(twDate('2026-05-03'))).toBe(false);
  });

  it('2026-04-28 IS a trading day (Tuesday, no holiday)', () => {
    expect(isTaiwanTradingDay(twDate('2026-04-28'))).toBe(true);
  });

  it('2026-01-01 is NOT a trading day (New Year)', () => {
    expect(isTaiwanTradingDay(twDate('2026-01-01'))).toBe(false);
  });

  it('2026-02-28 is NOT a trading day (Peace Memorial Day)', () => {
    expect(isTaiwanTradingDay(twDate('2026-02-28'))).toBe(false);
  });

  it('2026-10-10 is NOT a trading day (National Day)', () => {
    expect(isTaiwanTradingDay(twDate('2026-10-10'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toTaiwanDateIso
// ---------------------------------------------------------------------------

describe('toTaiwanDateIso', () => {
  it('converts UTC midnight to the next Taiwan calendar date', () => {
    // 2026-04-30 16:00 UTC = 2026-05-01 00:00 +08:00
    const utcMidnightTw = new Date('2026-04-30T16:00:00Z');
    expect(toTaiwanDateIso(utcMidnightTw)).toBe('2026-05-01');
  });

  it('keeps the same date for UTC noon', () => {
    const d = new Date('2026-05-01T04:00:00Z'); // 12:00 +08:00
    expect(toTaiwanDateIso(d)).toBe('2026-05-01');
  });
});

// ---------------------------------------------------------------------------
// getPreviousTaiwanTradingDay
// ---------------------------------------------------------------------------

describe('getPreviousTaiwanTradingDay', () => {
  it('on a trading day, returns that day itself', () => {
    expect(getPreviousTaiwanTradingDay(twDate('2026-04-30'))).toBe('2026-04-30');
  });

  it('on Labor Day 2026-05-01 (Friday holiday), returns 2026-04-30', () => {
    expect(getPreviousTaiwanTradingDay(twDate('2026-05-01'))).toBe('2026-04-30');
  });

  it('on Saturday 2026-05-02, returns 2026-04-30', () => {
    expect(getPreviousTaiwanTradingDay(twDate('2026-05-02'))).toBe('2026-04-30');
  });

  it('on Sunday 2026-05-03, returns 2026-04-30', () => {
    expect(getPreviousTaiwanTradingDay(twDate('2026-05-03'))).toBe('2026-04-30');
  });
});

// ---------------------------------------------------------------------------
// getNextTaiwanTradingDay
// ---------------------------------------------------------------------------

describe('getNextTaiwanTradingDay', () => {
  it('after Labor Day 2026-05-01, next trading day is 2026-05-04 (Monday)', () => {
    expect(getNextTaiwanTradingDay(twDate('2026-05-01'))).toBe('2026-05-04');
  });

  it('after Thursday 2026-04-30, next trading day is 2026-05-04 (skips Fri holiday + weekend)', () => {
    expect(getNextTaiwanTradingDay(twDate('2026-04-30'))).toBe('2026-05-04');
  });

  it('after 2026-04-29 (Wed), next trading day is 2026-04-30 (Thu)', () => {
    expect(getNextTaiwanTradingDay(twDate('2026-04-29'))).toBe('2026-04-30');
  });
});

// ---------------------------------------------------------------------------
// classifyQuoteFreshness — core classification rules
// ---------------------------------------------------------------------------

describe('classifyQuoteFreshness', () => {
  describe('MARKET_CLOSED_HOLIDAY + QUOTE_EXPECTED_NEXT_TRADING_DAY', () => {
    it('latestQuote=2026-04-30, now=2026-05-01 (Labor Day) → holiday, expected next trading day', () => {
      const result = classifyQuoteFreshness('2026-04-30', twDate('2026-05-01'));
      expect(result.marketCalendarStatus).toBe('MARKET_CLOSED_HOLIDAY');
      expect(result.freshnessClassification).toBe('QUOTE_EXPECTED_NEXT_TRADING_DAY');
      expect(result.expectedQuoteDate).toBe('2026-04-30');
      expect(result.nextExpectedTradingDate).toBe('2026-05-04');
      expect(result.isStale).toBe(false);
      expect(result.latestQuoteDate).toBe('2026-04-30');
    });
  });

  describe('MARKET_CLOSED_WEEKEND + QUOTE_EXPECTED_NEXT_TRADING_DAY', () => {
    it('latestQuote=2026-04-30, now=2026-05-02 (Saturday) → weekend, expected next trading day', () => {
      const result = classifyQuoteFreshness('2026-04-30', twDate('2026-05-02'));
      expect(result.marketCalendarStatus).toBe('MARKET_CLOSED_WEEKEND');
      expect(result.freshnessClassification).toBe('QUOTE_EXPECTED_NEXT_TRADING_DAY');
      expect(result.expectedQuoteDate).toBe('2026-04-30');
      expect(result.isStale).toBe(false);
    });

    it('latestQuote=2026-04-30, now=2026-05-03 (Sunday) → weekend, expected next trading day', () => {
      const result = classifyQuoteFreshness('2026-04-30', twDate('2026-05-03'));
      expect(result.marketCalendarStatus).toBe('MARKET_CLOSED_WEEKEND');
      expect(result.freshnessClassification).toBe('QUOTE_EXPECTED_NEXT_TRADING_DAY');
      expect(result.isStale).toBe(false);
    });
  });

  describe('MARKET_OPEN + QUOTE_CURRENT', () => {
    it('latestQuote=2026-04-30, now=2026-04-30 (same day, market open) → current', () => {
      const result = classifyQuoteFreshness('2026-04-30', twDate('2026-04-30'));
      expect(result.marketCalendarStatus).toBe('MARKET_OPEN');
      expect(result.freshnessClassification).toBe('QUOTE_CURRENT');
      expect(result.isStale).toBe(false);
    });

    it('latestQuote=2026-04-28, now=2026-04-28 → current', () => {
      const result = classifyQuoteFreshness('2026-04-28', twDate('2026-04-28'));
      expect(result.marketCalendarStatus).toBe('MARKET_OPEN');
      expect(result.freshnessClassification).toBe('QUOTE_CURRENT');
    });
  });

  describe('QUOTE_SYNC_DELAYED', () => {
    it('latestQuote=2026-04-29, now=2026-04-30 (trading day, quote behind but not stale)', () => {
      // now=2026-04-30 08:00 TW — quote is ~16h old, under 48h threshold
      const nowEarlyMorning = new Date('2026-04-30T00:00:00+08:00');
      const result = classifyQuoteFreshness('2026-04-29', nowEarlyMorning);
      expect(result.freshnessClassification).toBe('QUOTE_SYNC_DELAYED');
      expect(result.marketCalendarStatus).toBe('MARKET_OPEN');
      expect(result.isStale).toBe(false);
    });
  });

  describe('QUOTE_STALE_BLOCKED', () => {
    it('latestQuote=2026-04-27, now=2026-04-30 (>48h old on a trading day) → stale blocked', () => {
      // 2026-04-27 EOD (16:00 TW) to 2026-04-30 noon = ~68h
      const result = classifyQuoteFreshness('2026-04-27', twDate('2026-04-30'));
      expect(result.freshnessClassification).toBe('QUOTE_STALE_BLOCKED');
      expect(result.isStale).toBe(true);
    });

    it('latestQuote=2026-04-28, now=2026-05-05 (>48h old) → stale blocked', () => {
      const result = classifyQuoteFreshness('2026-04-28', twDate('2026-05-05'));
      expect(result.freshnessClassification).toBe('QUOTE_STALE_BLOCKED');
      expect(result.isStale).toBe(true);
    });
  });

  describe('nextExpectedTradingDate', () => {
    it('from 2026-05-01, next trading date is 2026-05-04', () => {
      const result = classifyQuoteFreshness('2026-04-30', twDate('2026-05-01'));
      expect(result.nextExpectedTradingDate).toBe('2026-05-04');
    });

    it('from 2026-04-30 (Thu), next trading date is 2026-05-04 (Mon, skip Fri holiday + weekend)', () => {
      const result = classifyQuoteFreshness('2026-04-30', twDate('2026-04-30'));
      expect(result.nextExpectedTradingDate).toBe('2026-05-04');
    });
  });
});

// ---------------------------------------------------------------------------
// isTaiwanTradingDay — corrected 2026-04-30 test
// ---------------------------------------------------------------------------

describe('isTaiwanTradingDay (additional)', () => {
  it('2026-04-30 is a Thursday trading day', () => {
    // Explicitly verify it is Thursday (day 4) and not in KNOWN_TW_HOLIDAYS
    const d = twDate('2026-04-30');
    expect(d.getDay()).toBe(4); // Thursday
    expect(isTaiwanTradingDay(d)).toBe(true);
  });

  it('2026-05-04 is a Monday trading day (first trading day after Labor Day weekend)', () => {
    expect(isTaiwanTradingDay(twDate('2026-05-04'))).toBe(true);
  });
});
