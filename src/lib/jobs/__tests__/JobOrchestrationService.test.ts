import { prisma } from '@/lib/prisma';
import { JobOrchestrationService } from '../JobOrchestrationService';

function buildKey(prefix: string): string {
  return `test:${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

async function cleanup(jobNames: string[]) {
  await prisma.jobRunLog.deleteMany({
    where: {
      jobName: { in: jobNames },
    },
  });
}

describe('JobOrchestrationService', () => {
  const service = new JobOrchestrationService();
  const jobName = buildKey('job');

  afterAll(async () => {
    await cleanup([jobName]);
  });

  test('does not create duplicate success runs for the same idempotency key', async () => {
    const scheduledFor = new Date('2026-03-30T00:00:00.000Z');
    await cleanup([jobName]);

    const first = await service.startJobRun({
      jobName,
      scheduledFor,
      triggerSource: 'cli',
    });
    expect(first.shouldRun).toBe(true);
    await service.completeJobRun(first.run.id ?? 0, { summary: 'completed once' });

    const second = await service.startJobRun({
      jobName,
      scheduledFor,
      triggerSource: 'cli',
    });
    expect(second.shouldRun).toBe(false);
    expect(second.reason).toBe('duplicate_success');

    const rows = await prisma.jobRunLog.findMany({ where: { jobName } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('success');
  });

  test('force rerun reopens the same key after success', async () => {
    const scheduledFor = new Date('2026-03-30T00:30:00.000Z');
    await cleanup([jobName]);

    const first = await service.startJobRun({
      jobName,
      scheduledFor,
      triggerSource: 'api',
    });
    await service.completeJobRun(first.run.id ?? 0, { summary: 'completed once' });

    const rerun = await service.startJobRun({
      jobName,
      scheduledFor,
      triggerSource: 'api',
      force: true,
    });

    expect(rerun.shouldRun).toBe(true);
    expect(rerun.reason).toBe('forced');

    const row = await prisma.jobRunLog.findUnique({ where: { idempotencyKey: JobOrchestrationService.buildIdempotencyKey(jobName, scheduledFor) } });
    expect(row?.status).toBe('running');
  });

  test('force rerun success clears stale skipped metadata', async () => {
    const scheduledFor = new Date('2026-03-30T00:45:00.000Z');
    await cleanup([jobName]);

    const first = await service.startJobRun({
      jobName,
      scheduledFor,
      triggerSource: 'local_scheduler',
    });
    await service.skipJobRun(first.run.id ?? 0, 'skipped once', {
      schedulerOutcome: 'skipped',
      skippedReason: 'scheduler_disabled',
    });

    const rerun = await service.startJobRun({
      jobName,
      scheduledFor,
      triggerSource: 'local_scheduler',
      force: true,
    });

    const completed = await service.completeJobRun(rerun.run.id ?? 0, {
      summary: 'completed after rerun',
      metadata: {
        schedulerOutcome: 'success',
        skippedReason: null,
      },
    });

    expect(completed.status).toBe('success');
    expect(completed.metadata).toContain('schedulerOutcome');
    expect(completed.metadata).not.toContain('skippedReason');
  });

  test('running status blocks re-entry', async () => {
    const scheduledFor = new Date('2026-03-30T01:00:00.000Z');
    await cleanup([jobName]);

    const first = await service.startJobRun({
      jobName,
      scheduledFor,
      triggerSource: 'local_scheduler',
    });
    expect(first.shouldRun).toBe(true);

    const second = await service.startJobRun({
      jobName,
      scheduledFor,
      triggerSource: 'cli',
    });
    expect(second.shouldRun).toBe(false);
    expect(second.reason).toBe('already_running');
  });

  test('failed runs are recorded with error message', async () => {
    const scheduledFor = new Date('2026-03-30T01:30:00.000Z');
    await cleanup([jobName]);

    const first = await service.startJobRun({
      jobName,
      scheduledFor,
      triggerSource: 'os_cron',
    });
    const failed = await service.failJobRun(first.run.id ?? 0, {
      error: new Error('boom'),
      summary: 'failed run',
      metadata: { retryable: false },
    });

    expect(failed.status).toBe('failed');
    expect(failed.errorMessage).toBe('boom');
    expect(failed.metadata).toContain('retryable');
  });

  test('missed runs are detected from expected windows', async () => {
    const missJob = buildKey('miss');
    const day1 = new Date('2026-03-29T00:00:00.000Z');
    const day2 = new Date('2026-03-30T00:00:00.000Z');
    const day3 = new Date('2026-03-31T00:00:00.000Z');
    await cleanup([missJob]);

    const day1Run = await service.startJobRun({
      jobName: missJob,
      scheduledFor: day1,
      triggerSource: 'api',
    });
    await service.completeJobRun(day1Run.run.id ?? 0, { summary: 'ok' });

    const day2Run = await service.startJobRun({
      jobName: missJob,
      scheduledFor: day2,
      triggerSource: 'api',
    });
    await service.failJobRun(day2Run.run.id ?? 0, new Error('fail'));

    const missed = await service.findMissedRuns(missJob, [day1, day2, day3]);
    expect(missed).toHaveLength(2);
    expect(missed.map((value) => value.toISOString())).toEqual([day2.toISOString(), day3.toISOString()]);

    await cleanup([missJob]);
  });
});
