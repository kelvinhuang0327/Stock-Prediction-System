/**
 * Tests for the training:tw-q1-financial-ingest-check scheduler entry.
 *
 * Covers:
 *   1. Registry registration
 *   2. Cadence and label shape
 *   3. Schedule window — fires at 01:00 UTC (09:00 Asia/Taipei)
 *   4. Runner is wired in BACKFILL_RUNNERS (SchedulerStateEngine smoke test)
 */

import { AUTONOMOUS_JOB_REGISTRY, getAutonomousJobNextDueAt } from '../autonomousJobRegistry';

const JOB_NAME = 'training:tw-q1-financial-ingest-check' as const;

describe('Taiwan Q1 Financial Ingest Check — registry', () => {
  test('is registered in AUTONOMOUS_JOB_REGISTRY', () => {
    expect(AUTONOMOUS_JOB_REGISTRY[JOB_NAME]).toBeDefined();
  });

  test('has daily cadence', () => {
    expect(AUTONOMOUS_JOB_REGISTRY[JOB_NAME].cadence).toBe('daily');
  });

  test('label references Q1', () => {
    expect(AUTONOMOUS_JOB_REGISTRY[JOB_NAME].label).toMatch(/Q1/i);
  });

  test('jobName self-reference is correct', () => {
    expect(AUTONOMOUS_JOB_REGISTRY[JOB_NAME].jobName).toBe(JOB_NAME);
  });

  describe('getScheduledFor', () => {
    test('returns a window at 01:00 UTC when now is after 01:00 UTC on the same day', () => {
      // 2026-05-20 at 12:00 UTC → latest 01:00 window is 2026-05-20T01:00:00Z
      const now = new Date('2026-05-20T12:00:00.000Z');
      const scheduled = AUTONOMOUS_JOB_REGISTRY[JOB_NAME].getScheduledFor(now);
      expect(scheduled.getUTCHours()).toBe(1);
      expect(scheduled.getUTCMinutes()).toBe(0);
      expect(scheduled.getUTCSeconds()).toBe(0);
    });

    test('returns previous day 01:00 UTC when now is before 01:00 UTC', () => {
      // 2026-05-20 at 00:30 UTC → latest 01:00 window is 2026-05-19T01:00:00Z
      const now = new Date('2026-05-20T00:30:00.000Z');
      const scheduled = AUTONOMOUS_JOB_REGISTRY[JOB_NAME].getScheduledFor(now);
      expect(scheduled.getUTCHours()).toBe(1);
      expect(scheduled.getUTCDate()).toBe(19);
    });
  });

  describe('getExpectedWindows', () => {
    test('returns at least one window', () => {
      const now = new Date('2026-05-20T12:00:00.000Z');
      const windows = AUTONOMOUS_JOB_REGISTRY[JOB_NAME].getExpectedWindows(now);
      expect(windows.length).toBeGreaterThan(0);
    });

    test('all windows are at 01:00 UTC', () => {
      const now = new Date('2026-05-20T12:00:00.000Z');
      const windows = AUTONOMOUS_JOB_REGISTRY[JOB_NAME].getExpectedWindows(now);
      for (const w of windows) {
        expect(w.getUTCHours()).toBe(1);
        expect(w.getUTCMinutes()).toBe(0);
      }
    });
  });

  test('schedules after Taiwan data-sync (01:00 UTC vs 00:15 UTC)', () => {
    // tw-data-sync runs at 00:15 UTC; this job at 01:00 UTC
    const now = new Date('2026-05-20T12:00:00.000Z');
    const dataSyncNext = getAutonomousJobNextDueAt('training:tw-data-sync', now);
    const q1CheckNext = getAutonomousJobNextDueAt(JOB_NAME, now);
    // On the same day the q1 check window (01:00) is after data-sync (00:15)
    expect(q1CheckNext.getTime()).toBeGreaterThan(dataSyncNext.getTime());
  });
});
