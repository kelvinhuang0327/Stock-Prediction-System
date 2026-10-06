import { ResolveTimeDistributionService } from '../ResolveTimeDistributionService';
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

describe('ResolveTimeDistributionService', () => {
  test('builds per-family resolve-time distribution', async () => {
    const historyService = {
      listHistory: jest.fn().mockResolvedValue([
        makeAlert({
          id: 1,
          severity: 'warning',
          status: 'resolved',
          firstDetectedAt: '2026-03-25T10:00:00.000Z',
          lastDetectedAt: '2026-03-25T12:00:00.000Z',
          resolvedAt: '2026-03-25T16:00:00.000Z',
          message: 'autonomous:monitor recovered and was resolved recently.',
        }),
        makeAlert({
          id: 2,
          severity: 'critical',
          status: 'resolved',
          firstDetectedAt: '2026-03-26T10:00:00.000Z',
          lastDetectedAt: '2026-03-26T12:00:00.000Z',
          resolvedAt: '2026-03-26T22:00:00.000Z',
          message: 'autonomous:monitor has 2 consecutive failed runs.',
        }),
        makeAlert({
          id: 3,
          severity: 'critical',
          status: 'active',
          firstDetectedAt: '2026-03-31T10:00:00.000Z',
          lastDetectedAt: '2026-03-31T12:00:00.000Z',
          message: 'autonomous:monitor is missing a successful run in the recent 60 minutes window.',
        }),
      ]),
    };

    const service = new ResolveTimeDistributionService(historyService as never);
    const result = await service.build('autonomous:monitor', 30, new Date('2026-03-31T12:00:00.000Z'));

    expect(result.jobName).toBe('autonomous:monitor');
    expect(result.families.length).toBeGreaterThan(0);
    expect(result.families.some((family) => family.resolvedCount > 0)).toBe(true);
    expect(result.families.some((family) => family.unresolvedCount > 0)).toBe(true);
    expect(result.families.every((family) => family.unresolvedRatio === null || (family.unresolvedRatio >= 0 && family.unresolvedRatio <= 1))).toBe(true);
    expect(result.overallSummary).toContain('autonomous:monitor');
  });

  test('returns degraded output when no resolved samples exist', async () => {
    const historyService = {
      listHistory: jest.fn().mockResolvedValue([
        makeAlert({
          id: 1,
          severity: 'warning',
          status: 'active',
          message: 'autonomous:monitor is missing a successful run in the recent 60 minutes window.',
        }),
      ]),
    };

    const service = new ResolveTimeDistributionService(historyService as never);
    const result = await service.build('autonomous:learning', 14, new Date('2026-03-31T12:00:00.000Z'));

    expect(result.families[0].resolvedCount).toBe(0);
    expect(result.families[0].avgResolveTimeHours).toBeNull();
    expect(result.limitations.some((item) => item.includes('Resolved sample sizes are sparse'))).toBe(true);
  });
});
