import { prisma } from '@/lib/prisma';
import { JobAlertHistoryService } from '../JobAlertHistoryService';

const historyJobName = 'test:job-alert-history';
const jobNames = [
  'autonomous:daily',
  'autonomous:monitor',
  'autonomous:review',
  'autonomous:learning',
  historyJobName,
] as const;

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
        jobName: historyJobName,
        severity: 'critical',
        message: 'autonomous:daily is missing a successful run in the today window.',
        alertKey: `${historyJobName}:daily-active`,
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
        jobName: historyJobName,
        severity: 'warning',
        message: 'autonomous:monitor is missing a successful run in the recent 60 minutes window.',
        alertKey: `${historyJobName}:monitor-active`,
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
        jobName: historyJobName,
        severity: 'critical',
        message: 'autonomous:review has recovered and was resolved recently.',
        alertKey: `${historyJobName}:review-resolved`,
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
        jobName: historyJobName,
        severity: 'critical',
        message: 'autonomous:learning is missing a successful run in the current week.',
        alertKey: `${historyJobName}:learning-active`,
        status: 'active',
        firstDetectedAt: new Date('2026-03-29T12:00:00.000Z'),
        lastDetectedAt: base,
        resolvedAt: null,
        occurrenceCount: 2,
        latestJobRunLogId: null,
        metadata: null,
      },
    });

    for (const alertKey of [`${historyJobName}:training-daily`, `${historyJobName}:training-financial`]) {
      await prisma.jobAlert.create({
        data: {
          jobName: historyJobName,
          severity: 'critical',
          message: `${alertKey} is missing a successful run in the current window.`,
          alertKey,
          status: 'active',
          firstDetectedAt: base,
          lastDetectedAt: base,
          resolvedAt: null,
          occurrenceCount: 1,
          latestJobRunLogId: null,
          metadata: null,
        },
      });
    }

    const [summary, alerts] = await Promise.all([
      historyService.buildSummary({ days: 14, jobName: historyJobName }, base),
      historyService.listHistory({ includeResolved: true, jobName: historyJobName }, base),
    ]);

    expect(alerts).toHaveLength(6);
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ alertKey: `${historyJobName}:daily-active`, severity: 'critical', status: 'active' }),
        expect.objectContaining({ alertKey: `${historyJobName}:monitor-active`, severity: 'warning', status: 'active' }),
        expect.objectContaining({ alertKey: `${historyJobName}:review-resolved`, severity: 'critical', status: 'resolved' }),
        expect.objectContaining({ alertKey: `${historyJobName}:learning-active`, severity: 'critical', status: 'active' }),
        expect.objectContaining({ alertKey: `${historyJobName}:training-daily`, severity: 'critical', status: 'active' }),
        expect.objectContaining({ alertKey: `${historyJobName}:training-financial`, severity: 'critical', status: 'active' }),
      ]),
    );
    expect(summary.total).toBe(alerts.length);
    expect(summary.active).toBe(5);
    expect(summary.resolvedRecently).toBe(1);
    expect(summary.critical + summary.warning + summary.info).toBe(alerts.length);
    expect(summary.topNoisyJobs.length).toBeGreaterThan(0);
    expect(summary.recentReoccurAlerts.length).toBeGreaterThan(0);
    expect(summary.recentResolvedAlerts.length).toBeGreaterThan(0);
    expect(summary.severityDistribution.critical).toBe(5);
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
