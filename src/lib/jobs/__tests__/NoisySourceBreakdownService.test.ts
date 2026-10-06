import { NoisySourceBreakdownService } from '../NoisySourceBreakdownService';
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

describe('NoisySourceBreakdownService', () => {
  test('builds family breakdown with ranked noisy source', async () => {
    const alertService = {
      listAlerts: jest.fn().mockResolvedValue({
        alerts: [],
        summary: { total: 0, critical: 0, warning: 0, info: 0 },
        generatedAt: '2026-03-31T12:00:00.000Z',
        limitations: [],
        jobs: [
          {
            jobName: 'autonomous:monitor',
            scheduledFor: '2026-03-31T12:30:00.000Z',
            latestRun: {
              id: 1,
              jobName: 'autonomous:monitor',
              scheduledFor: new Date('2026-03-31T12:00:00.000Z'),
              startedAt: new Date('2026-03-31T12:00:00.000Z'),
              finishedAt: null,
              status: 'running',
              runMode: 'live_run',
              triggerSource: 'local_scheduler',
              idempotencyKey: 'autonomous:monitor:1',
              summary: null,
              errorMessage: null,
              metadata: null,
              createdAt: new Date('2026-03-31T12:00:00.000Z'),
              updatedAt: new Date('2026-03-31T12:00:00.000Z'),
            },
            missed: true,
            canRerun: true,
            triggerSource: 'local_scheduler',
            runMode: 'live_run',
            lastErrorMessage: null,
            status: 'running',
            healthStatus: 'delayed',
            healthReason: 'No successful run recorded in the recent 60 minutes window.',
            lastSuccessfulRunAt: null,
            failureStreak: 0,
            summary: 'monitor delayed',
            limitations: [],
          },
        ],
        healthSummary: { total: 1, ok: 0, delayed: 1, failed: 0, neverRan: 0 },
      }),
    };

    const historyService = {
      listHistory: jest.fn().mockResolvedValue([
        makeAlert({
          id: 1,
          jobName: 'autonomous:monitor',
          severity: 'warning',
          message: 'autonomous:monitor is missing a successful run in the recent 60 minutes window.',
          status: 'active',
          occurrenceCount: 4,
          firstDetectedAt: '2026-03-30T12:00:00.000Z',
          lastDetectedAt: '2026-03-31T11:55:00.000Z',
        }),
        makeAlert({
          id: 2,
          jobName: 'autonomous:monitor',
          severity: 'critical',
          message: 'autonomous:monitor is missing a successful run in the recent 60 minutes window.',
          status: 'active',
          occurrenceCount: 2,
          firstDetectedAt: '2026-03-31T11:00:00.000Z',
          lastDetectedAt: '2026-03-31T12:00:00.000Z',
        }),
        makeAlert({
          id: 3,
          jobName: 'autonomous:monitor',
          severity: 'critical',
          message: 'autonomous:monitor has 2 consecutive failed runs.',
          status: 'resolved',
          occurrenceCount: 3,
          firstDetectedAt: '2026-03-29T12:00:00.000Z',
          lastDetectedAt: '2026-03-30T12:00:00.000Z',
          resolvedAt: '2026-03-31T08:00:00.000Z',
        }),
        makeAlert({
          id: 4,
          jobName: 'autonomous:monitor',
          severity: 'warning',
          message: 'autonomous:monitor recovered and was resolved recently.',
          status: 'resolved',
          occurrenceCount: 1,
          firstDetectedAt: '2026-03-30T08:00:00.000Z',
          lastDetectedAt: '2026-03-30T10:00:00.000Z',
          resolvedAt: '2026-03-31T10:00:00.000Z',
        }),
      ]),
    };

    const service = new NoisySourceBreakdownService(alertService as never, historyService as never);
    const result = await service.build('autonomous:monitor', 30, new Date('2026-03-31T12:00:00.000Z'));

    expect(result.jobName).toBe('autonomous:monitor');
    expect(result.families.length).toBeGreaterThan(0);
    expect(result.topFamily).not.toBeNull();
    expect(result.summary.totalAlerts).toBe(4);
    expect(result.summary.totalOccurrences).toBe(10);
    expect(result.summary.familyCount).toBeGreaterThanOrEqual(2);
    expect(result.summary.overallSummary).toContain('autonomous:monitor');
    expect(result.families.some((family) => family.family === 'missed_run')).toBe(true);
    expect(result.families.some((family) => family.family === 'consecutive_failure')).toBe(true);
    expect(result.families.some((family) => family.family === 'recovery_event')).toBe(true);
    expect(result.families.every((family) => family.noisyScore >= 0)).toBe(true);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  test('returns degraded output when no alert history exists', async () => {
    const alertService = {
      listAlerts: jest.fn().mockResolvedValue({
        alerts: [],
        summary: { total: 0, critical: 0, warning: 0, info: 0 },
        generatedAt: '2026-03-31T12:00:00.000Z',
        limitations: [],
        jobs: [],
        healthSummary: { total: 0, ok: 0, delayed: 0, failed: 0, neverRan: 0 },
      }),
    };
    const historyService = {
      listHistory: jest.fn().mockResolvedValue([]),
    };

    const service = new NoisySourceBreakdownService(alertService as never, historyService as never);
    const result = await service.build('autonomous:learning', 14, new Date('2026-03-31T12:00:00.000Z'));

    expect(result.families).toHaveLength(0);
    expect(result.topFamily).toBeNull();
    expect(result.summary.source).toBe('empty');
    expect(result.summary.overallSummary).toContain('No noisy alert families');
    expect(result.limitations.some((item) => item.includes('No alert history was found'))).toBe(true);
  });
});
