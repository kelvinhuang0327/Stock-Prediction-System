import { JobAlertDrilldownService } from '../JobAlertDrilldownService';
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

describe('JobAlertDrilldownService', () => {
  test('summarizes noisy history and recovery timeline', async () => {
    const historyService = {
      listHistory: jest.fn().mockResolvedValue([
        makeAlert({
          id: 11,
          jobName: 'autonomous:monitor',
          severity: 'critical',
          message: 'autonomous:monitor is missing a successful run in the recent 60 minutes window.',
          status: 'active',
          occurrenceCount: 4,
          firstDetectedAt: '2026-03-31T10:00:00.000Z',
          lastDetectedAt: '2026-03-31T12:00:00.000Z',
        }),
        makeAlert({
          id: 12,
          jobName: 'autonomous:monitor',
          severity: 'warning',
          message: 'autonomous:monitor recovered and was resolved recently.',
          status: 'resolved',
          occurrenceCount: 2,
          firstDetectedAt: '2026-03-30T08:00:00.000Z',
          lastDetectedAt: '2026-03-30T09:00:00.000Z',
          resolvedAt: '2026-03-31T11:30:00.000Z',
        }),
      ]),
    };

    const service = new JobAlertDrilldownService(historyService as never);
    const result = await service.build('autonomous:monitor', 14, new Date('2026-03-31T12:00:00.000Z'));

    expect(result.jobName).toBe('autonomous:monitor');
    expect(result.summary.activeAlertsCount).toBe(1);
    expect(result.summary.resolvedAlertsCount).toBe(1);
    expect(result.summary.totalOccurrences).toBe(6);
    expect(result.summary.latestAlertStatus).toBe('active');
    expect(result.summary.severityDistribution.critical).toBe(1);
    expect(result.summary.severityDistribution.warning).toBe(1);
    expect(result.summary.recentReoccurCount).toBe(2);
    expect(result.summary.recentResolvedCount).toBe(1);
    expect(result.summary.averageHoursToResolve).toBeGreaterThan(0);
    expect(result.summary.mostCommonAlertMessage).toContain('monitor');
    expect(result.timeline.length).toBe(2);
    expect(result.recentRecoveryEvents.length).toBe(1);
    expect(result.limitations.some((item) => item.includes('persisted JobAlert rows'))).toBe(true);
  });

  test('returns degraded summary when no alerts exist', async () => {
    const historyService = {
      listHistory: jest.fn().mockResolvedValue([]),
    };

    const service = new JobAlertDrilldownService(historyService as never);
    const result = await service.build('autonomous:learning', 14, new Date('2026-03-31T12:00:00.000Z'));

    expect(result.jobName).toBe('autonomous:learning');
    expect(result.summary.activeAlertsCount).toBe(0);
    expect(result.summary.resolvedAlertsCount).toBe(0);
    expect(result.summary.latestAlertStatus).toBe('unknown');
    expect(result.summary.summaryNote).toContain('no persisted alert history');
    expect(result.timeline).toHaveLength(0);
    expect(result.limitations.some((item) => item.includes('No persisted job alert history'))).toBe(true);
  });
});
