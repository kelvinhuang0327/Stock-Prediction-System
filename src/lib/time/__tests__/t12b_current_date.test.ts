/**
 * T-12b: Dynamic Current Date Source Tests
 *
 * Tests for src/lib/time/currentDate.ts
 *
 * No DB writes. No external API calls. No strategy signals. No H001-H012.
 * All date assertions use fixed input — tests do NOT depend on real system date.
 */

import { getCurrentDateISO, resolveCurrentDate } from '@/lib/time/currentDate';

describe('getCurrentDateISO', () => {
  it('returns YYYY-MM-DD for injected date', () => {
    const result = getCurrentDateISO(new Date('2026-05-06T12:00:00Z'));
    expect(result).toBe('2026-05-06');
  });

  it('returns YYYY-MM-DD format for another injected date', () => {
    const result = getCurrentDateISO(new Date('2024-01-15T00:00:00Z'));
    expect(result).toBe('2024-01-15');
  });

  it('result has exactly 10 characters', () => {
    const result = getCurrentDateISO(new Date('2026-05-06T08:30:00Z'));
    expect(result).toHaveLength(10);
  });

  it('result matches YYYY-MM-DD regex', () => {
    const result = getCurrentDateISO(new Date('2026-12-31T23:59:59Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses system date when no argument provided (returns ISO format)', () => {
    const result = getCurrentDateISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('resolveCurrentDate', () => {
  it('returns valid YYYY-MM-DD input unchanged', () => {
    expect(resolveCurrentDate('2026-05-06')).toBe('2026-05-06');
  });

  it('returns another valid date unchanged', () => {
    expect(resolveCurrentDate('2024-01-15')).toBe('2024-01-15');
  });

  it('returns ISO date format for null input', () => {
    const result = resolveCurrentDate(null);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns ISO date format for undefined input', () => {
    const result = resolveCurrentDate(undefined);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to system date for empty string', () => {
    const result = resolveCurrentDate('');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to system date for malformed date string (no dashes)', () => {
    const result = resolveCurrentDate('20260506');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).not.toBe('20260506');
  });

  it('falls back to system date for invalid date format (letters)', () => {
    const result = resolveCurrentDate('not-a-date');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not throw on any input', () => {
    expect(() => resolveCurrentDate(null)).not.toThrow();
    expect(() => resolveCurrentDate(undefined)).not.toThrow();
    expect(() => resolveCurrentDate('')).not.toThrow();
    expect(() => resolveCurrentDate('bad')).not.toThrow();
    expect(() => resolveCurrentDate('2026-05-06')).not.toThrow();
  });

  it('accepts boundary date: beginning of year', () => {
    expect(resolveCurrentDate('2026-01-01')).toBe('2026-01-01');
  });

  it('accepts boundary date: end of year', () => {
    expect(resolveCurrentDate('2026-12-31')).toBe('2026-12-31');
  });
});
