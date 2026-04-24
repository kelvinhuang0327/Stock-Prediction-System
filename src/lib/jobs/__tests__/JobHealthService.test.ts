import { prisma } from '@/lib/prisma';
import { JobHealthService } from '../JobHealthService';

async function cleanup() {
  await prisma.jobRunLog.deleteMany({
    where: {
      jobName: {
        in: ['autonomous:daily', 'autonomous:monitor', 'autonomous:review', 'autonomous:learning'],
      },
    },
  });
}

describe('JobHealthService', () => {
  const service = new JobHealthService();

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  test('marks never-ran jobs and emits critical alerts', async () => {
    const report = await service.evaluate(new Date('2026-03-31T12:00:00.000Z'));

    expect(report.jobs).toHaveLength(4);
    expect(report.jobs.find((job) => job.jobName === 'autonomous:daily')?.healthStatus).toBe('never-ran');
    expect(report.alerts.some((alert) => alert.jobName === 'autonomous:daily' && alert.severity === 'critical')).toBe(true);
    expect(report.healthSummary.neverRan).toBe(4);
  });

  test('detects ok, delayed and failed jobs', async () => {
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
          scheduledFor: new Date('2026-03-31T09:00:00.000Z'),
          startedAt: new Date('2026-03-31T09:00:00.000Z'),
          finishedAt: new Date('2026-03-31T09:01:00.000Z'),
          status: 'success',
          runMode: 'live_run',
          triggerSource: 'local_scheduler',
          idempotencyKey: 'autonomous:monitor:2026-03-31T09:00:00.000Z',
          summary: 'monitor success',
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

    const report = await service.evaluate(new Date('2026-03-31T12:00:00.000Z'));

    expect(report.jobs.find((job) => job.jobName === 'autonomous:daily')?.healthStatus).toBe('ok');
    expect(report.jobs.find((job) => job.jobName === 'autonomous:monitor')?.healthStatus).toBe('delayed');
    expect(report.jobs.find((job) => job.jobName === 'autonomous:review')?.healthStatus).toBe('failed');
    expect(report.alerts.some((alert) => alert.jobName === 'autonomous:review' && alert.severity !== 'info')).toBe(true);
    expect(report.healthSummary.ok).toBe(1);
    expect(report.healthSummary.delayed).toBe(1);
    expect(report.healthSummary.failed).toBe(1);
  });

  test('detects consecutive failures', async () => {
    await prisma.jobRunLog.createMany({
      data: [
        {
          jobName: 'autonomous:learning',
          scheduledFor: new Date('2026-03-31T00:00:00.000Z'),
          startedAt: new Date('2026-03-31T00:10:00.000Z'),
          finishedAt: new Date('2026-03-31T00:11:00.000Z'),
          status: 'failed',
          runMode: 'live_run',
          triggerSource: 'cli',
          idempotencyKey: 'autonomous:learning:2026-03-31T00:00:00.000Z',
          summary: 'learning failed',
          errorMessage: 'boom-1',
          metadata: null,
        },
        {
          jobName: 'autonomous:learning',
          scheduledFor: new Date('2026-03-30T00:00:00.000Z'),
          startedAt: new Date('2026-03-30T00:10:00.000Z'),
          finishedAt: new Date('2026-03-30T00:11:00.000Z'),
          status: 'failed',
          runMode: 'live_run',
          triggerSource: 'cli',
          idempotencyKey: 'autonomous:learning:2026-03-30T00:00:00.000Z',
          summary: 'learning failed again',
          errorMessage: 'boom-2',
          metadata: null,
        },
      ],
    });

    const report = await service.evaluate(new Date('2026-03-31T12:00:00.000Z'));

    expect(report.jobs.find((job) => job.jobName === 'autonomous:learning')?.failureStreak).toBe(2);
    expect(report.alerts.some((alert) => alert.jobName === 'autonomous:learning' && alert.severity === 'critical')).toBe(true);
    expect(report.jobs.find((job) => job.jobName === 'autonomous:learning')?.healthStatus).toBe('failed');
  });
});
