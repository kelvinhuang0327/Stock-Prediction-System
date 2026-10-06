import { prisma } from '@/lib/prisma';
import { JobAlertHistoryService } from '../JobAlertHistoryService';

const jobNames = ['autonomous:daily', 'autonomous:monitor', 'autonomous:review', 'autonomous:learning'] as const;

async function cleanup() {
  await prisma.jobAlert.deleteMany({
    where: { jobName: { in: [...jobNames] } },
  });
  await prisma.jobRunLog.deleteMany({
    where: { jobName: { in: [...jobNames] } },
  });
}

describe('JobAlertHistoryService', () => {
  const historyService = new JobAlertHistoryService();

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  test('summarizes active, resolved, reoccur and noisy alerts', async () => {
    const base = new Date('2026-03-31T12:00:00.000Z');

    await prisma.jobAlert.create({
      data: {
        jobName: 'autonomous:daily',
        severity: 'critical',
        message: 'autonomous:daily is missing a successful run in the today window.',
        alertKey: 'autonomous:daily',
        status: 'active',
        firstDetectedAt: base,
        lastDetectedAt: base,
        resolvedAt: null,
        occurrenceCount: 3,
        latestJobRunLogId: null,
        metadata: null,
      },
    });

    await prisma.jobAlert.create({
      data: {
        jobName: 'autonomous:monitor',
        severity: 'warning',
        message: 'autonomous:monitor is missing a successful run in the recent 60 minutes window.',
        alertKey: 'autonomous:monitor',
        status: 'active',
        firstDetectedAt: new Date('2026-03-31T11:20:00.000Z'),
        lastDetectedAt: base,
        resolvedAt: null,
        occurrenceCount: 1,
        latestJobRunLogId: null,
        metadata: null,
      },
    });

    await prisma.jobAlert.create({
      data: {
        jobName: 'autonomous:review',
        severity: 'critical',
        message: 'autonomous:review has recovered and was resolved recently.',
        alertKey: 'autonomous:review',
        status: 'resolved',
        firstDetectedAt: new Date('2026-03-30T11:00:00.000Z'),
        lastDetectedAt: new Date('2026-03-30T12:00:00.000Z'),
        resolvedAt: new Date('2026-03-31T08:00:00.000Z'),
        occurrenceCount: 2,
        latestJobRunLogId: null,
        metadata: null,
      },
    });

    await prisma.jobAlert.create({
      data: {
        jobName: 'autonomous:learning',
        severity: 'critical',
        message: 'autonomous:learning is missing a successful run in the current week.',
        alertKey: 'autonomous:learning',
        status: 'active',
        firstDetectedAt: new Date('2026-03-29T12:00:00.000Z'),
        lastDetectedAt: base,
        resolvedAt: null,
        occurrenceCount: 2,
        latestJobRunLogId: null,
        metadata: null,
      },
    });

    const summary = await historyService.buildSummary({ days: 14 }, base);
    expect(summary.total).toBe(4);
    expect(summary.active).toBe(3);
    expect(summary.resolvedRecently).toBe(1);
    expect(summary.critical + summary.warning + summary.info).toBe(4);
    expect(summary.topNoisyJobs.length).toBeGreaterThan(0);
    expect(summary.recentReoccurAlerts.length).toBeGreaterThan(0);
    expect(summary.recentResolvedAlerts.length).toBeGreaterThan(0);
    expect(summary.severityDistribution.critical).toBe(3);
    expect(summary.severityDistribution.warning).toBe(1);
  });

  test('lists history with filters and sorting', async () => {
    const now = new Date('2026-03-31T12:00:00.000Z');
    await prisma.jobAlert.create({
      data: {
        jobName: 'autonomous:daily',
        severity: 'critical',
        message: 'autonomous:daily is missing a successful run in the today window.',
        alertKey: 'autonomous:daily',
        status: 'active',
        firstDetectedAt: now,
        lastDetectedAt: now,
        resolvedAt: null,
        occurrenceCount: 4,
        latestJobRunLogId: null,
        metadata: null,
      },
    });
    await prisma.jobAlert.create({
      data: {
        jobName: 'autonomous:monitor',
        severity: 'warning',
        message: 'autonomous:monitor is missing a successful run in the recent 60 minutes window.',
        alertKey: 'autonomous:monitor',
        status: 'active',
        firstDetectedAt: now,
        lastDetectedAt: now,
        resolvedAt: null,
        occurrenceCount: 2,
        latestJobRunLogId: null,
        metadata: null,
      },
    });

    const alerts = await historyService.listHistory(
      { status: 'active', sortBy: 'occurrenceCount', sortDir: 'desc', limit: 10 },
      now,
    );

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].status).toBe('active');
    expect(alerts[0].occurrenceCount).toBeGreaterThanOrEqual(1);
    expect(alerts[0].occurrenceCount).toBeGreaterThanOrEqual(alerts[alerts.length - 1].occurrenceCount);
  });
});
