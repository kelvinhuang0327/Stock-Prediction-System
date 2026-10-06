import { FamilyTrendService } from '../FamilyTrendService';
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

describe('FamilyTrendService', () => {
  test('builds family trends and detects improving, worsening and oscillating patterns', async () => {
    const historyService = {
      listHistory: jest.fn().mockResolvedValue([
        makeAlert({
          id: 1,
          severity: 'warning',
          status: 'active',
          occurrenceCount: 1,
          lastDetectedAt: '2026-03-25T12:00:00.000Z',
          message: 'autonomous:monitor is missing a successful run in the recent 60 minutes window.',
        }),
        makeAlert({
          id: 2,
          severity: 'warning',
          status: 'active',
          occurrenceCount: 2,
          lastDetectedAt: '2026-03-27T12:00:00.000Z',
          message: 'autonomous:monitor is missing a successful run in the recent 60 minutes window.',
        }),
        makeAlert({
          id: 3,
          severity: 'critical',
          status: 'active',
          occurrenceCount: 4,
          lastDetectedAt: '2026-03-30T12:00:00.000Z',
          message: 'autonomous:monitor is missing a successful run in the recent 60 minutes window.',
        }),
        makeAlert({
          id: 4,
          severity: 'critical',
          status: 'resolved',
          occurrenceCount: 2,
          lastDetectedAt: '2026-03-26T12:00:00.000Z',
          resolvedAt: '2026-03-26T14:00:00.000Z',
          message: 'autonomous:monitor has 2 consecutive failed runs.',
        }),
        makeAlert({
          id: 5,
          severity: 'warning',
          status: 'resolved',
          occurrenceCount: 1,
          lastDetectedAt: '2026-03-28T12:00:00.000Z',
          resolvedAt: '2026-03-28T13:00:00.000Z',
          message: 'autonomous:monitor recovered and was resolved recently.',
        }),
      ]),
    };

    const service = new FamilyTrendService(historyService as never);
    const result = await service.build('autonomous:monitor', '7d', 'day', new Date('2026-03-31T12:00:00.000Z'));

    expect(result.jobName).toBe('autonomous:monitor');
    expect(result.families.length).toBeGreaterThan(0);
    expect(result.overallSummary).toContain('autonomous:monitor');
    expect(result.families.some((family) => family.trendDirection === 'worsening' || family.trendDirection === 'stable' || family.trendDirection === 'improving' || family.trendDirection === 'oscillating')).toBe(true);
    expect(result.families.every((family) => family.buckets.length === 7)).toBe(true);
  });

  test('returns insufficient trend when no data exists', async () => {
    const historyService = {
      listHistory: jest.fn().mockResolvedValue([]),
    };

    const service = new FamilyTrendService(historyService as never);
    const result = await service.build('autonomous:learning', '14d', 'day', new Date('2026-03-31T12:00:00.000Z'));

    expect(result.families).toHaveLength(0);
    expect(result.overallSummary).toContain('No family trend data');
    expect(result.limitations.some((item) => item.includes('No family trend data'))).toBe(true);
  });
});
