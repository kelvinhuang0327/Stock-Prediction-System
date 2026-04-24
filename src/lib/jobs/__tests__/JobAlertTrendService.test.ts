import { JobAlertTrendService } from '../JobAlertTrendService';
import type { JobAlertRecord } from '../types';

function makeAlert(overrides: Partial<JobAlertRecord>): JobAlertRecord {
  const now = '2026-03-31T12:00:00.000Z';
  return {
    id: overrides.id ?? 1,
    jobName: overrides.jobName ?? 'autonomous:monitor',
    severity: overrides.severity ?? 'warning',
    message: overrides.message ?? 'missing successful run',
    detectedAt: overrides.detectedAt ?? now,
    alertKey: overrides.alertKey ?? (overrides.jobName ?? 'autonomous:monitor'),
    status: overrides.status ?? 'active',
    firstDetectedAt: overrides.firstDetectedAt ?? now,
    lastDetectedAt: overrides.lastDetectedAt ?? now,
    resolvedAt: overrides.resolvedAt ?? null,
    occurrenceCount: overrides.occurrenceCount ?? 1,
    latestJobRunLogId: overrides.latestJobRunLogId ?? null,
    metadata: overrides.metadata ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

describe('JobAlertTrendService', () => {
  test('builds daily trend buckets and detects worsening trend', async () => {
    const historyService = {
      listHistory: jest.fn().mockResolvedValue([
        makeAlert({
          id: 1,
          severity: 'warning',
          status: 'active',
          occurrenceCount: 1,
          lastDetectedAt: '2026-03-25T12:00:00.000Z',
        }),
        makeAlert({
          id: 2,
          severity: 'critical',
          status: 'resolved',
          occurrenceCount: 2,
          lastDetectedAt: '2026-03-26T12:00:00.000Z',
          resolvedAt: '2026-03-26T13:00:00.000Z',
        }),
        makeAlert({
          id: 3,
          severity: 'warning',
          status: 'active',
          occurrenceCount: 4,
          lastDetectedAt: '2026-03-30T12:00:00.000Z',
        }),
        makeAlert({
          id: 4,
          severity: 'critical',
          status: 'active',
          occurrenceCount: 3,
          lastDetectedAt: '2026-03-31T12:00:00.000Z',
        }),
      ]),
    };

    const service = new JobAlertTrendService(historyService as never);
    const result = await service.build('autonomous:monitor', '7d', 'day', new Date('2026-03-31T12:00:00.000Z'));

    expect(result.window).toBe('7d');
    expect(result.bucket).toBe('day');
    expect(result.buckets).toHaveLength(7);
    expect(result.summary.totalOccurrences).toBe(10);
    expect(result.summary.totalResolved).toBe(1);
    expect(result.summary.trendDirection).toBe('worsening');
    expect(result.summary.peakBucket).toBe(4);
    expect(result.buckets.some((bucket) => bucket.date === '2026-03-30' && bucket.total === 4)).toBe(true);
    expect(result.buckets.some((bucket) => bucket.date === '2026-03-31' && bucket.total === 3)).toBe(true);
    expect(result.limitations).toEqual([]);
  });

  test('aggregates weekly buckets and degrades when sparse', async () => {
    const historyService = {
      listHistory: jest.fn().mockResolvedValue([
        makeAlert({
          id: 11,
          severity: 'warning',
          status: 'active',
          occurrenceCount: 2,
          lastDetectedAt: '2026-03-05T12:00:00.000Z',
        }),
        makeAlert({
          id: 12,
          severity: 'critical',
          status: 'resolved',
          occurrenceCount: 1,
          lastDetectedAt: '2026-03-15T12:00:00.000Z',
          resolvedAt: '2026-03-16T12:00:00.000Z',
        }),
      ]),
    };

    const service = new JobAlertTrendService(historyService as never);
    const result = await service.build('autonomous:monitor', '30d', 'week', new Date('2026-03-31T12:00:00.000Z'));

    expect(result.window).toBe('30d');
    expect(result.bucket).toBe('week');
    expect(result.buckets).toHaveLength(5);
    expect(result.summary.trendDirection === 'stable' || result.summary.trendDirection === 'improving' || result.summary.trendDirection === 'worsening').toBe(true);
    expect(result.summary.bucketSizeDays).toBe(7);
    expect(result.buckets.reduce((sum, bucket) => sum + bucket.total, 0)).toBe(3);
  });

  test('returns insufficient trend when no alerts exist', async () => {
    const historyService = {
      listHistory: jest.fn().mockResolvedValue([]),
    };

    const service = new JobAlertTrendService(historyService as never);
    const result = await service.build('autonomous:learning', '14d', 'day', new Date('2026-03-31T12:00:00.000Z'));

    expect(result.summary.trendDirection).toBe('insufficient');
    expect(result.summary.totalOccurrences).toBe(0);
    expect(result.buckets.every((bucket) => bucket.total === 0)).toBe(true);
    expect(result.limitations.some((item) => item.includes('No alerts found'))).toBe(true);
  });
});
