import { prisma } from '@/lib/prisma';

const mockListAlerts = jest.fn();

jest.mock('../AutonomousAlertService', () => ({
  AutonomousAlertService: jest.fn().mockImplementation(() => ({
    listAlerts: mockListAlerts,
  })),
}));

jest.mock('../../prisma', () => ({
  prisma: {
    notificationDeliveryLog: {
      findMany: jest.fn(),
    },
  },
}));

import { AutonomousAlertNotificationAdapter } from '../AutonomousAlertNotificationAdapter';

const mockFindMany = prisma.notificationDeliveryLog.findMany as jest.Mock;

function buildReport(overrides: Partial<Awaited<ReturnType<typeof mockListAlerts>>>) {
  return {
    alerts: [
      {
        jobName: 'autonomous:daily',
        severity: 'critical',
        message: 'autonomous:daily has never run yet.',
        detectedAt: '2026-03-31T12:00:00.000Z',
      },
      {
        jobName: 'autonomous:review',
        severity: 'warning',
        message: 'autonomous:review is missing a successful run in the today window.',
        detectedAt: '2026-03-31T12:00:00.000Z',
      },
    ],
    summary: '2 active alerts.',
    generatedAt: '2026-03-31T12:00:00.000Z',
    limitations: [],
    healthSummary: {
      total: 4,
      ok: 1,
      delayed: 1,
      failed: 1,
      neverRan: 1,
    },
    jobs: [
      {
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
        limitations: ['No job run recorded yet.'],
      },
      {
        jobName: 'autonomous:review',
        scheduledFor: '2026-03-31T00:00:00.000Z',
        latestRun: null,
        missed: true,
        canRerun: true,
        triggerSource: null,
        runMode: null,
        lastErrorMessage: null,
        status: 'never-ran',
        healthStatus: 'delayed',
        healthReason: 'No successful run recorded in the today window.',
        lastSuccessfulRunAt: null,
        failureStreak: 0,
        summary: 'No run recorded yet',
        limitations: ['No job run recorded yet.'],
      },
      {
        jobName: 'autonomous:monitor',
        scheduledFor: '2026-03-31T12:00:00.000Z',
        latestRun: null,
        missed: true,
        canRerun: true,
        triggerSource: null,
        runMode: null,
        lastErrorMessage: null,
        status: 'never-ran',
        healthStatus: 'delayed',
        healthReason: 'No successful run recorded in the recent 60 minutes window.',
        lastSuccessfulRunAt: null,
        failureStreak: 0,
        summary: 'No run recorded yet',
        limitations: ['No job run recorded yet.'],
      },
      {
        jobName: 'autonomous:learning',
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
        limitations: ['No job run recorded yet.'],
      },
    ],
    ...overrides,
  };
}

describe('AutonomousAlertNotificationAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockListAlerts.mockResolvedValue(buildReport({}));
  });

  test('builds a digest when alerts are active', async () => {
    const adapter = new AutonomousAlertNotificationAdapter();
    const digest = await adapter.buildDigest({ now: new Date('2026-03-31T12:00:00.000Z') });

    expect(digest.shouldAttach).toBe(true);
    expect(digest.alerts).toHaveLength(2);
    expect(digest.summaryStats.total).toBe(2);
    expect(digest.summary).toContain('Autonomous alerts: 2 active.');
  });

  test('suppresses duplicate alerts from recent delivery logs', async () => {
    mockFindMany.mockResolvedValue([
      {
        sentAt: new Date('2026-03-31T11:30:00.000Z'),
        metadata: JSON.stringify({
          autonomousAlertKeys: [
            'autonomous:daily|critical|autonomous:daily has never run yet.',
          ],
        }),
      },
      {
        sentAt: new Date('2026-03-31T10:30:00.000Z'),
        metadata: JSON.stringify({
          autonomousAlertKeys: [
            'autonomous:review|warning|autonomous:review is missing a successful run in the today window.',
          ],
        }),
      },
    ]);

    const adapter = new AutonomousAlertNotificationAdapter();
    const digest = await adapter.buildDigest({ now: new Date('2026-03-31T12:00:00.000Z') });

    expect(digest.shouldAttach).toBe(false);
    expect(digest.alerts).toHaveLength(0);
    expect(digest.summaryStats.suppressed).toBe(2);
  });

  test('allows a critical escalation even when a warning was sent recently', async () => {
    mockListAlerts.mockResolvedValue(buildReport({
      alerts: [
        {
          jobName: 'autonomous:review',
          severity: 'critical',
          message: 'autonomous:review is missing a successful run in the today window.',
          detectedAt: '2026-03-31T12:00:00.000Z',
        },
      ],
      jobs: [
        {
          jobName: 'autonomous:review',
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
          limitations: ['No job run recorded yet.'],
        },
      ],
    }));

    mockFindMany.mockResolvedValue([
      {
        sentAt: new Date('2026-03-31T10:00:00.000Z'),
        metadata: JSON.stringify({
          autonomousAlertKeys: [
            'autonomous:review|warning|autonomous:review is missing a successful run in the today window.',
          ],
        }),
      },
    ]);

    const adapter = new AutonomousAlertNotificationAdapter();
    const digest = await adapter.buildDigest({ now: new Date('2026-03-31T12:00:00.000Z') });

    expect(digest.shouldAttach).toBe(true);
    expect(digest.alerts).toHaveLength(1);
    expect(digest.alerts[0].severity).toBe('critical');
  });

  test('re-allows the same alert after a successful reset', async () => {
    mockFindMany.mockResolvedValue([
      {
        sentAt: new Date('2026-03-31T08:00:00.000Z'),
        metadata: JSON.stringify({
          autonomousAlertKeys: [
            'autonomous:daily|critical|autonomous:daily has never run yet.',
          ],
        }),
      },
    ]);

    mockListAlerts.mockResolvedValue(buildReport({
      jobs: [
        {
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
          lastSuccessfulRunAt: '2026-03-31T09:30:00.000Z',
          failureStreak: 0,
          summary: 'No run recorded yet',
          limitations: ['No job run recorded yet.'],
        },
      ],
    }));

    const adapter = new AutonomousAlertNotificationAdapter();
    const digest = await adapter.buildDigest({ now: new Date('2026-03-31T12:00:00.000Z') });

    expect(digest.shouldAttach).toBe(true);
    expect(digest.alerts.some((alert) => alert.jobName === 'autonomous:daily')).toBe(true);
    expect(digest.summaryStats.suppressed).toBe(0);
  });
});
