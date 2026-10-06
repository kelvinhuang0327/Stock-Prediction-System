import { prisma } from '@/lib/prisma';
import { JobHealthService } from '../JobHealthService';
import { JobAlertService } from '../JobAlertService';

const jobNames = ['autonomous:daily', 'autonomous:monitor', 'autonomous:review', 'autonomous:learning'] as const;

async function cleanup() {
  await prisma.jobAlert.deleteMany({
    where: { jobName: { in: [...jobNames] } },
  });
  await prisma.jobRunLog.deleteMany({
    where: { jobName: { in: [...jobNames] } },
  });
}

describe('JobAlertService', () => {
  const alertService = new JobAlertService();
  const healthService = new JobHealthService();

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  test('persists a new active alert and keeps occurrence count stable on same observation', async () => {
    const now = new Date('2026-03-31T12:00:00.000Z');
    const health = await healthService.evaluate(now);

    const first = await alertService.syncFromHealthReport(health, now);
    expect(first.activeUpserts).toBeGreaterThan(0);

    const dailyAlerts = await alertService.listAlerts({ jobName: 'autonomous:daily', onlyActive: true });
    expect(dailyAlerts.length).toBe(1);
    expect(dailyAlerts[0].status).toBe('active');
    expect(dailyAlerts[0].occurrenceCount).toBe(1);

    const second = await alertService.syncFromHealthReport(health, now);
    expect(second.activeUpserts).toBeGreaterThan(0);

    const dailyAgain = await alertService.listAlerts({ jobName: 'autonomous:daily', onlyActive: true });
    expect(dailyAgain[0].occurrenceCount).toBe(1);
  });

  test('marks alert resolved on recovery and reactivates on reoccurrence', async () => {
    const day1 = new Date('2026-03-31T12:00:00.000Z');
    const health1 = await healthService.evaluate(day1);
    await alertService.syncFromHealthReport(health1, day1);

    await prisma.jobRunLog.create({
      data: {
        jobName: 'autonomous:daily',
        scheduledFor: new Date('2026-03-31T00:00:00.000Z'),
        startedAt: new Date('2026-03-31T00:05:00.000Z'),
        finishedAt: new Date('2026-03-31T00:10:00.000Z'),
        status: 'success',
        runMode: 'live_run',
        triggerSource: 'cli',
        idempotencyKey: 'autonomous:daily:2026-03-31T00:00:00.000Z',
        summary: 'daily success',
        errorMessage: null,
        metadata: null,
      },
    });

    const resolvedHealth = await healthService.evaluate(day1);
    await alertService.syncFromHealthReport(resolvedHealth, day1);

    const resolved = await alertService.listAlerts({ jobName: 'autonomous:daily', includeResolved: true });
    expect(resolved.some((alert) => alert.status === 'resolved')).toBe(true);

    const day2 = new Date('2026-04-01T12:00:00.000Z');
    const health2 = await healthService.evaluate(day2);
    await alertService.syncFromHealthReport(health2, day2);

    const reactivated = await alertService.listAlerts({ jobName: 'autonomous:daily', onlyActive: true });
    expect(reactivated.length).toBe(1);
    expect(reactivated[0].status).toBe('active');
    expect(reactivated[0].occurrenceCount).toBeGreaterThanOrEqual(2);
  });

  test('summarizes active and resolved alerts', async () => {
    const day1 = new Date('2026-03-31T12:00:00.000Z');
    const health = await healthService.evaluate(day1);
    await alertService.syncFromHealthReport(health, day1);

    const summary = await alertService.summarizeAlerts(14);
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.active).toBeGreaterThan(0);
    expect(summary.critical + summary.warning + summary.info).toBeGreaterThan(0);
  });
});
