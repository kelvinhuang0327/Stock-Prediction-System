import { JobOrchestrationService } from './JobOrchestrationService';
import { AUTONOMOUS_JOB_REGISTRY, buildAutonomousIdempotencyKey, getAutonomousJobNames } from './autonomousJobRegistry';
import { JobHealthService } from './JobHealthService';
import type { JobAlert, JobHealthRow, JobHealthSummary, JobRunStatus, JobTriggerSource } from './types';
import { prisma } from '../prisma';

export interface AutonomousJobsStatus {
  jobs: JobHealthRow[];
  missedJobs: string[];
  neverRanJobs: string[];
  alerts: JobAlert[];
  healthSummary: JobHealthSummary;
  summary: string;
  limitations: string[];
}

function coerceTriggerSource(value: string | null | undefined): JobTriggerSource | null {
  if (value === 'api' || value === 'cli' || value === 'local_scheduler' || value === 'os_cron') {
    return value;
  }
  return null;
}

function coerceRunStatus(value: string | null | undefined): JobHealthRow['status'] {
  if (value === 'running' || value === 'success' || value === 'failed' || value === 'skipped') {
    return value;
  }
  return 'never-ran';
}

function describeRunStatus(status: JobHealthRow['status'], missed: boolean): JobHealthRow['status'] {
  if (status === 'never-ran') return 'never-ran';
  if (status === 'running') return 'running';
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  return 'skipped';
}

export async function getAutonomousJobsStatus(now = new Date()): Promise<AutonomousJobsStatus> {
  const service = new JobOrchestrationService();
  const healthService = new JobHealthService();
  const jobNames = getAutonomousJobNames();
  const latestRuns = await service.getLatestRunsByJob(jobNames);
  const health = await healthService.evaluate(now);
  const healthByJob = new Map(health.jobs.map((job) => [job.jobName, job]));

  const jobs: JobHealthRow[] = [];
  const missedJobs: string[] = [];
  const neverRanJobs: string[] = [];

  for (const jobName of jobNames) {
    const definition = AUTONOMOUS_JOB_REGISTRY[jobName];
    const scheduledFor = definition.getScheduledFor(now);
    const idempotencyKey = buildAutonomousIdempotencyKey(jobName, scheduledFor);
    const latestRun = latestRuns[jobName];
    const currentRun = latestRun?.idempotencyKey === idempotencyKey ? latestRun : await service.getLatestJobRun(jobName);
    const windowRun = await prisma.jobRunLog.findUnique({ where: { idempotencyKey } }).catch(() => null);

    const missed = !windowRun || (windowRun.status !== 'success' && windowRun.status !== 'running');
    const canRerun = !windowRun || windowRun.status !== 'running';
    const status: JobHealthRow['status'] = coerceRunStatus(windowRun?.status ?? latestRun?.status);

    if (missed) missedJobs.push(jobName);
    if (!latestRun && !windowRun) neverRanJobs.push(jobName);

    jobs.push({
      jobName,
      scheduledFor: scheduledFor.toISOString(),
      latestRun: currentRun,
      missed,
      canRerun,
      triggerSource: coerceTriggerSource(windowRun?.triggerSource ?? currentRun?.triggerSource),
      lastErrorMessage: windowRun?.errorMessage ?? currentRun?.errorMessage ?? null,
      status: describeRunStatus(status, missed),
      healthStatus: healthByJob.get(jobName)?.healthStatus ?? 'never-ran',
      healthReason: healthByJob.get(jobName)?.healthReason ?? 'No health data available.',
      lastSuccessfulRunAt: healthByJob.get(jobName)?.lastSuccessfulRunAt ?? null,
      failureStreak: healthByJob.get(jobName)?.failureStreak ?? 0,
      summary: windowRun?.summary ?? currentRun?.summary ?? 'No run recorded yet',
      limitations: windowRun ? [] : ['No job run recorded yet.'],
    });
  }

  const summary = [
    `${jobs.length} autonomous jobs tracked.`,
    missedJobs.length > 0 ? `${missedJobs.length} job(s) currently missing their expected window.` : 'No missed windows detected.',
    neverRanJobs.length > 0 ? `${neverRanJobs.length} job(s) have never run.` : 'All jobs have at least one recorded run.',
  ].join(' ');

  return {
    jobs,
    missedJobs,
    neverRanJobs,
    alerts: health.alerts,
    healthSummary: health.healthSummary,
    summary,
    limitations: [
      'Missed detection is based on the current expected window for each job.',
      'Manual force reruns still reuse the same idempotency key, so history remains compact by design.',
    ],
  };
}
