import { AutonomousAlertCooldownPolicy } from '../AutonomousAlertCooldownPolicy';
import type { JobHealthRow } from '../types';

function buildJob(overrides: Partial<JobHealthRow>): JobHealthRow {
  return {
    jobName: 'autonomous:daily',
    scheduledFor: '2026-03-31T00:00:00.000Z',
    latestRun: null,
    missed: true,
    canRerun: true,
    triggerSource: null,
    runMode: null,
    lastErrorMessage: null,
    status: 'never-ran',
    healthStatus: 'never-ran',
    healthReason: 'No run has been recorded yet.',
    lastSuccessfulRunAt: null,
    failureStreak: 0,
    summary: 'No run recorded yet',
    limitations: [],
    ...overrides,
  };
}

describe('AutonomousAlertCooldownPolicy', () => {
  const policy = new AutonomousAlertCooldownPolicy();
  const now = new Date('2026-03-31T12:00:00.000Z');

  test('suppresses same warning within cooldown', () => {
    const decision = policy.evaluate(
      {
        jobName: 'autonomous:review',
        severity: 'warning',
        message: 'missing a successful run',
        detectedAt: now.toISOString(),
      },
      {
        now,
        recentDeliveries: [
          {
            digestKey: 'autonomous:review|warning|missing a successful run',
            jobName: 'autonomous:review',
            severity: 'warning',
            message: 'missing a successful run',
            sentAt: new Date('2026-03-31T10:30:00.000Z'),
          },
        ],
        jobs: [buildJob({ jobName: 'autonomous:review' })],
      },
    );

    expect(decision.shouldNotify).toBe(false);
    expect(decision.reason).toBe('cooldown');
  });

  test('suppresses same critical within cooldown', () => {
    const decision = policy.evaluate(
      {
        jobName: 'autonomous:daily',
        severity: 'critical',
        message: 'has never run yet',
        detectedAt: now.toISOString(),
      },
      {
        now,
        recentDeliveries: [
          {
            digestKey: 'autonomous:daily|critical|has never run yet',
            jobName: 'autonomous:daily',
            severity: 'critical',
            message: 'has never run yet',
            sentAt: new Date('2026-03-31T11:30:00.000Z'),
          },
        ],
        jobs: [buildJob({ jobName: 'autonomous:daily' })],
      },
    );

    expect(decision.shouldNotify).toBe(false);
    expect(decision.reason).toBe('cooldown');
  });

  test('allows critical escalation after warning', () => {
    const decision = policy.evaluate(
      {
        jobName: 'autonomous:review',
        severity: 'critical',
        message: 'missing a successful run',
        detectedAt: now.toISOString(),
      },
      {
        now,
        recentDeliveries: [
          {
            digestKey: 'autonomous:review|warning|missing a successful run',
            jobName: 'autonomous:review',
            severity: 'warning',
            message: 'missing a successful run',
            sentAt: new Date('2026-03-31T10:30:00.000Z'),
          },
        ],
        jobs: [buildJob({ jobName: 'autonomous:review' })],
      },
    );

    expect(decision.shouldNotify).toBe(true);
    expect(decision.reason).toBe('escalated');
  });

  test('re-allows after success reset', () => {
    const decision = policy.evaluate(
      {
        jobName: 'autonomous:daily',
        severity: 'critical',
        message: 'has never run yet',
        detectedAt: now.toISOString(),
      },
      {
        now,
        recentDeliveries: [
          {
            digestKey: 'autonomous:daily|critical|has never run yet',
            jobName: 'autonomous:daily',
            severity: 'critical',
            message: 'has never run yet',
            sentAt: new Date('2026-03-31T08:00:00.000Z'),
          },
        ],
        jobs: [
          buildJob({
            jobName: 'autonomous:daily',
            lastSuccessfulRunAt: '2026-03-31T09:30:00.000Z',
          }),
        ],
      },
    );

    expect(decision.shouldNotify).toBe(true);
    expect(decision.reason).toBe('reset');
  });

  test('allows when there is no delivery history', () => {
    const decision = policy.evaluate(
      {
        jobName: 'autonomous:learning',
        severity: 'critical',
        message: 'has never run yet',
        detectedAt: now.toISOString(),
      },
      {
        now,
        recentDeliveries: [],
        jobs: [buildJob({ jobName: 'autonomous:learning' })],
      },
    );

    expect(decision.shouldNotify).toBe(true);
    expect(decision.reason).toBe('new');
  });

  test('respects configurable severity and job overrides', () => {
    const customPolicy = new AutonomousAlertCooldownPolicy({
      severityCooldownHours: { critical: 4, warning: 6, info: 0 },
      jobCooldownHours: { 'autonomous:review': { warning: 24 } },
      allowInfoAlerts: true,
    });

    const warningDecision = customPolicy.evaluate(
      {
        jobName: 'autonomous:review',
        severity: 'warning',
        message: 'missing a successful run',
        detectedAt: now.toISOString(),
      },
      {
        now,
        recentDeliveries: [
          {
            digestKey: 'autonomous:review|warning|missing a successful run',
            jobName: 'autonomous:review',
            severity: 'warning',
            message: 'missing a successful run',
            sentAt: new Date('2026-03-31T11:15:00.000Z'),
          },
        ],
        jobs: [buildJob({ jobName: 'autonomous:review' })],
      },
    );

    const infoDecision = customPolicy.evaluate(
      {
        jobName: 'autonomous:learning',
        severity: 'info',
        message: 'watchlist summary available',
        detectedAt: now.toISOString(),
      },
      {
        now,
        recentDeliveries: [],
        jobs: [buildJob({ jobName: 'autonomous:learning' })],
      },
    );

    expect(warningDecision.shouldNotify).toBe(false);
    expect(warningDecision.reason).toBe('cooldown');
    expect(infoDecision.shouldNotify).toBe(true);
    expect(infoDecision.reason).toBe('new');
  });

  test('can disable escalation and recovery reset via config', () => {
    const customPolicy = new AutonomousAlertCooldownPolicy({
      escalationEnabled: false,
      recoveryResetEnabled: false,
      severityCooldownHours: { critical: 2, warning: 12, info: 0 },
    });

    const escalationDecision = customPolicy.evaluate(
      {
        jobName: 'autonomous:review',
        severity: 'critical',
        message: 'missing a successful run',
        detectedAt: now.toISOString(),
      },
      {
        now,
        recentDeliveries: [
          {
            digestKey: 'autonomous:review|warning|missing a successful run',
            jobName: 'autonomous:review',
            severity: 'warning',
            message: 'missing a successful run',
            sentAt: new Date('2026-03-31T10:30:00.000Z'),
          },
        ],
        jobs: [buildJob({ jobName: 'autonomous:review' })],
      },
    );

    const resetDecision = customPolicy.evaluate(
      {
        jobName: 'autonomous:daily',
        severity: 'critical',
        message: 'has never run yet',
        detectedAt: now.toISOString(),
      },
      {
        now,
        recentDeliveries: [
          {
            digestKey: 'autonomous:daily|critical|has never run yet',
            jobName: 'autonomous:daily',
            severity: 'critical',
            message: 'has never run yet',
            sentAt: new Date('2026-03-31T11:30:00.000Z'),
          },
        ],
        jobs: [
          buildJob({
            jobName: 'autonomous:daily',
            lastSuccessfulRunAt: '2026-03-31T11:45:00.000Z',
          }),
        ],
      },
    );

    expect(escalationDecision.shouldNotify).toBe(false);
    expect(escalationDecision.reason).toBe('job_cooldown');
    expect(resetDecision.shouldNotify).toBe(false);
    expect(resetDecision.reason).toBe('cooldown');
  });
});
