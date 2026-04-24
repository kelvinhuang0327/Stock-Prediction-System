import { AlertFamilyGroupingService } from '../AlertFamilyGroupingService';
import type { JobAlertRecord, JobHealthRow } from '../types';

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

function makeHealthRow(overrides: Partial<JobHealthRow>): JobHealthRow {
  return {
    jobName: overrides.jobName ?? 'autonomous:monitor',
    scheduledFor: overrides.scheduledFor ?? '2026-03-31T12:30:00.000Z',
    latestRun: overrides.latestRun ?? null,
    missed: overrides.missed ?? false,
    canRerun: overrides.canRerun ?? true,
    triggerSource: overrides.triggerSource ?? 'cli',
    runMode: overrides.runMode ?? 'live_run',
    lastErrorMessage: overrides.lastErrorMessage ?? null,
    status: overrides.status ?? 'never-ran',
    healthStatus: overrides.healthStatus ?? 'never-ran',
    healthReason: overrides.healthReason ?? 'No run has been recorded yet.',
    lastSuccessfulRunAt: overrides.lastSuccessfulRunAt ?? null,
    failureStreak: overrides.failureStreak ?? 0,
    summary: overrides.summary ?? 'No run recorded yet',
    limitations: overrides.limitations ?? [],
  };
}

describe('AlertFamilyGroupingService', () => {
  const service = new AlertFamilyGroupingService();

  test('classifies never-ran, consecutive failure, delayed, missed and recovery families', () => {
    expect(
      service.classify({
        alert: makeAlert({ message: 'autonomous:daily has never run yet.', severity: 'critical' }),
        healthRow: makeHealthRow({ healthStatus: 'never-ran' }),
      }).family,
    ).toBe('never_ran');

    expect(
      service.classify({
        alert: makeAlert({ message: 'autonomous:daily has 2 consecutive failed runs.', severity: 'critical' }),
        healthRow: makeHealthRow({ healthStatus: 'failed', failureStreak: 2 }),
      }).family,
    ).toBe('consecutive_failure');

    expect(
      service.classify({
        alert: makeAlert({ message: 'autonomous:review is failing or has repeated failures.', severity: 'warning' }),
        healthRow: makeHealthRow({ healthStatus: 'failed', failureStreak: 1 }),
      }).family,
    ).toBe('failed_run');

    expect(
      service.classify({
        alert: makeAlert({ message: 'autonomous:monitor is still running beyond its expected window.', severity: 'warning' }),
        healthRow: makeHealthRow({
          healthStatus: 'delayed',
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
        }),
      }).family,
    ).toBe('delayed_run');

    expect(
      service.classify({
        alert: makeAlert({ message: 'autonomous:learning is missing a successful run in the current week.', severity: 'critical' }),
        healthRow: makeHealthRow({ healthStatus: 'delayed' }),
      }).family,
    ).toBe('missed_run');

    expect(
      service.classify({
        alert: makeAlert({ message: 'autonomous:review recovered and was resolved recently.', status: 'resolved', severity: 'warning' }),
        healthRow: makeHealthRow({ healthStatus: 'ok' }),
      }).family,
    ).toBe('recovery_event');

    expect(
      service.classify({
        alert: makeAlert({ message: 'ambiguous alert text', severity: 'info' }),
        healthRow: makeHealthRow({ healthStatus: 'ok' }),
      }).family,
    ).toBe('unknown_family');
  });
});
