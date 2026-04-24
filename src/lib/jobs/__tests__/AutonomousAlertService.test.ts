import { prisma } from '@/lib/prisma';
import { AutonomousAlertService } from '../AutonomousAlertService';

async function cleanup() {
  await prisma.jobRunLog.deleteMany({
    where: {
      jobName: {
        in: ['autonomous:daily', 'autonomous:monitor', 'autonomous:review', 'autonomous:learning'],
      },
    },
  });
  await prisma.jobAlert.deleteMany({
    where: {
      jobName: {
        in: ['autonomous:daily', 'autonomous:monitor', 'autonomous:review', 'autonomous:learning'],
      },
    },
  });
}

describe('AutonomousAlertService', () => {
  const service = new AutonomousAlertService();

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  test('returns empty alerts when all jobs are healthy', async () => {
    await prisma.jobRunLog.createMany({
      data: [
        {
          jobName: 'autonomous:daily',
          scheduledFor: new Date('2026-03-31T00:00:00.000Z'),
          startedAt: new Date('2026-03-31T00:10:00.000Z'),
          finishedAt: new Date('2026-03-31T00:20:00.000Z'),
          status: 'success',
          runMode: 'live_run',
          triggerSource: 'cli',
          idempotencyKey: 'autonomous:daily:2026-03-31T00:00:00.000Z',
          summary: 'daily success',
          errorMessage: null,
          metadata: null,
        },
        {
          jobName: 'autonomous:monitor',
          scheduledFor: new Date('2026-03-31T12:30:00.000Z'),
          startedAt: new Date('2026-03-31T12:30:00.000Z'),
          finishedAt: new Date('2026-03-31T12:31:00.000Z'),
          status: 'success',
          runMode: 'live_run',
          triggerSource: 'local_scheduler',
          idempotencyKey: 'autonomous:monitor:2026-03-31T12:30:00.000Z',
          summary: 'monitor success',
          errorMessage: null,
          metadata: null,
        },
        {
          jobName: 'autonomous:review',
          scheduledFor: new Date('2026-03-31T00:00:00.000Z'),
          startedAt: new Date('2026-03-31T00:10:00.000Z'),
          finishedAt: new Date('2026-03-31T00:20:00.000Z'),
          status: 'success',
          runMode: 'live_run',
          triggerSource: 'cli',
          idempotencyKey: 'autonomous:review:2026-03-31T00:00:00.000Z',
          summary: 'review success',
          errorMessage: null,
          metadata: null,
        },
        {
          jobName: 'autonomous:learning',
          scheduledFor: new Date('2026-03-31T00:00:00.000Z'),
          startedAt: new Date('2026-03-31T00:10:00.000Z'),
          finishedAt: new Date('2026-03-31T00:20:00.000Z'),
          status: 'success',
          runMode: 'live_run',
          triggerSource: 'cli',
          idempotencyKey: 'autonomous:learning:2026-03-31T00:00:00.000Z',
          summary: 'learning success',
          errorMessage: null,
          metadata: null,
        },
      ],
    });

    const report = await service.listAlerts({}, new Date('2026-03-31T12:45:00.000Z'));

    expect(report.alerts).toEqual([]);
    expect(report.summary.total).toBe(0);
    expect(report.summary.critical).toBe(0);
    expect(report.summary.warning).toBe(0);
    expect(report.summary.info).toBe(0);
  });

  test('never-ran, failed and missed jobs are included with severity', async () => {
    await prisma.jobRunLog.createMany({
      data: [
        {
          jobName: 'autonomous:daily',
          scheduledFor: new Date('2026-03-31T00:00:00.000Z'),
          startedAt: new Date('2026-03-31T00:10:00.000Z'),
          finishedAt: new Date('2026-03-31T00:20:00.000Z'),
          status: 'success',
          runMode: 'live_run',
          triggerSource: 'cli',
          idempotencyKey: 'autonomous:daily:2026-03-31T00:00:00.000Z',
          summary: 'daily success',
          errorMessage: null,
          metadata: null,
        },
        {
          jobName: 'autonomous:review',
          scheduledFor: new Date('2026-03-31T00:00:00.000Z'),
          startedAt: new Date('2026-03-31T00:10:00.000Z'),
          finishedAt: new Date('2026-03-31T00:11:00.000Z'),
          status: 'failed',
          runMode: 'live_run',
          triggerSource: 'cli',
          idempotencyKey: 'autonomous:review:2026-03-31T00:00:00.000Z',
          summary: 'review failed',
          errorMessage: 'boom',
          metadata: null,
        },
      ],
    });

    const report = await service.listAlerts({}, new Date('2026-03-31T12:00:00.000Z'));

    expect(report.alerts.some((alert) => alert.jobName === 'autonomous:daily')).toBe(false);
    expect(report.alerts.some((alert) => alert.jobName === 'autonomous:review' && alert.severity === 'warning')).toBe(true);
    expect(report.alerts.some((alert) => alert.jobName === 'autonomous:monitor' && alert.severity === 'critical')).toBe(true);
    expect(report.alerts.some((alert) => alert.jobName === 'autonomous:learning' && alert.severity === 'critical')).toBe(true);
  });

  test('supports severity and job filters', async () => {
    await prisma.jobRunLog.create({
      data: {
        jobName: 'autonomous:review',
        scheduledFor: new Date('2026-03-31T00:00:00.000Z'),
        startedAt: new Date('2026-03-31T00:10:00.000Z'),
        finishedAt: new Date('2026-03-31T00:11:00.000Z'),
        status: 'failed',
        runMode: 'live_run',
        triggerSource: 'cli',
        idempotencyKey: 'autonomous:review:2026-03-31T00:00:00.000Z',
        summary: 'review failed',
        errorMessage: 'boom',
        metadata: null,
      },
    });

    const report = await service.listAlerts({ jobName: 'autonomous:review', severity: 'warning' }, new Date('2026-03-31T12:00:00.000Z'));

    expect(report.alerts.every((alert) => alert.jobName === 'autonomous:review')).toBe(true);
    expect(report.alerts.every((alert) => alert.severity === 'warning')).toBe(true);
  });
});
