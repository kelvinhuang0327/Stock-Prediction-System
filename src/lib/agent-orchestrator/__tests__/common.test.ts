import { safeSlug, toDayKey, toTimestampCompact, scheduleNextRunAt, nowIso } from '../common';

describe('common utilities', () => {
  it('safeSlug normalizes strings', () => {
    expect(safeSlug(' Hello WORLD!! ')).toBe('hello-world');
    expect(safeSlug('$$$')).toBe('task');
  });

  it('toDayKey returns YYYYMMDD', () => {
    const d = new Date('2026-04-24T12:00:00Z');
    expect(toDayKey(d)).toBe('20260424');
  });

  it('toTimestampCompact returns YYYYMMDDHHMM', () => {
    const d = new Date('2026-04-24T08:05:00Z');
    expect(toTimestampCompact(d)).toBe('202604240805');
  });

  it('scheduleNextRunAt advances minutes correctly', () => {
    const now = new Date('2026-04-24T00:00:00Z');
    const next = scheduleNextRunAt(30, now);
    expect(new Date(next).toISOString()).toBe(new Date('2026-04-24T00:30:00Z').toISOString());
  });
});
