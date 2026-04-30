import { prisma } from '../prisma';
import { AUTONOMOUS_JOB_REGISTRY, getAutonomousJobNames } from './autonomousJobRegistry';
import type { JobAlert, JobHealthRow, JobHealthStatus, JobHealthSummary, JobRunLogRecord } from './types';

export interface JobHealthReport {
  jobs: JobHealthRow[];
  alerts: JobAlert[];
  summary: string;
  limitations: string[];
  healthSummary: JobHealthSummary;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date): Date {
  const day = date.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - offset);
  return start;
}

function minutesAgo(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60_000);
}

function getWindowStart(jobName: string, now: Date): Date {
  const definition = AUTONOMOUS_JOB_REGISTRY[jobName as keyof typeof AUTONOMOUS_JOB_REGISTRY];
  if (definition?.cadence === 'interval') {
    return minutesAgo(now, (definition.intervalMinutes ?? 30) * 2);
  }
  if (definition?.cadence === 'weekly' || jobName === 'autonomous:learning') return startOfUtcWeek(now);
  return startOfUtcDay(now);
}

function getWindowLabel(jobName: string): string {
  const definition = AUTONOMOUS_JOB_REGISTRY[jobName as keyof typeof AUTONOMOUS_JOB_REGISTRY];
  if (definition?.cadence === 'interval') {
    return `recent ${(definition.intervalMinutes ?? 30) * 2} minutes`;
  }
  if (definition?.cadence === 'weekly' || jobName === 'autonomous:learning') return 'current week';
  return 'today';
}

function countConsecutiveFailures(runs: JobRunLogRecord[]): number {
  let count = 0;
  for (const run of runs) {
    if (run.status !== 'failed') break;
    count += 1;
  }
  return count;
}

function findLatestSuccessfulRun(runs: JobRunLogRecord[]): JobRunLogRecord | null {
  return runs.find((run) => run.status === 'success') ?? null;
}

function buildAlert(jobName: string, severity: JobAlert['severity'], message: string, detectedAt: Date): JobAlert {
  return {
    jobName,
    severity,
    message,
    detectedAt: detectedAt.toISOString(),
  };
}

function healthStatusForRun(
  jobName: string,
  latestRun: JobRunLogRecord | null,
  successInWindow: JobRunLogRecord | null,
  failureStreak: number,
  hasAnyHistoricalRun: boolean,
): JobHealthStatus {
  if (!latestRun && !hasAnyHistoricalRun) return 'never-ran';
  if (successInWindow) return 'ok';
  if (latestRun?.status === 'failed') return 'failed';
  if (failureStreak >= 2) return 'failed';
  if (!hasAnyHistoricalRun) return 'never-ran';
  if (jobName === 'autonomous:monitor' && latestRun?.status === 'running') return 'delayed';
  return 'delayed';
}

function healthReasonForStatus(status: JobHealthStatus, windowLabel: string, latestRun: JobRunLogRecord | null): string {
  if (status === 'ok') return `A successful run exists within the ${windowLabel} window.`;
  if (status === 'failed') return latestRun?.errorMessage ? `Latest run failed: ${latestRun.errorMessage}` : `Latest run failed in the ${windowLabel} window.`;
  if (status === 'never-ran') return 'No run has been recorded yet.';
  return `No successful run recorded in the ${windowLabel} window.`;
}

export class JobHealthService {
  async evaluate(now = new Date()): Promise<JobHealthReport> {
    const jobNames = getAutonomousJobNames();
    const runs = await prisma.jobRunLog.findMany({
      where: { jobName: { in: jobNames } },
      orderBy: [{ jobName: 'asc' }, { createdAt: 'desc' }],
    });

    const runsByJob = runs.reduce<Record<string, JobRunLogRecord[]>>((acc, row) => {
      const jobRuns = acc[row.jobName] ?? [];
      jobRuns.push({
        id: row.id,
        jobName: row.jobName,
        scheduledFor: row.scheduledFor,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        status: row.status as JobRunLogRecord['status'],
        runMode: row.runMode as JobRunLogRecord['runMode'],
        triggerSource: row.triggerSource as JobRunLogRecord['triggerSource'],
        idempotencyKey: row.idempotencyKey,
        summary: row.summary,
        errorMessage: row.errorMessage,
        metadata: row.metadata,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
      acc[row.jobName] = jobRuns;
      return acc;
    }, {});

    const jobs: JobHealthRow[] = [];
    const alerts: JobAlert[] = [];
    const counts: JobHealthSummary = {
      total: jobNames.length,
      ok: 0,
      delayed: 0,
      failed: 0,
      neverRan: 0,
    };

    for (const jobName of jobNames) {
      const jobRuns = runsByJob[jobName] ?? [];
      const latestRun = jobRuns[0] ?? null;
      const latestSuccessfulRun = findLatestSuccessfulRun(jobRuns);
      const windowStart = getWindowStart(jobName, now);
      const windowRuns = jobRuns.filter((run) => run.scheduledFor >= windowStart);
      const successInWindow = windowRuns.find((run) => run.status === 'success') ?? null;
      const failureStreak = countConsecutiveFailures(jobRuns);
      const healthStatus = healthStatusForRun(jobName, latestRun, successInWindow, failureStreak, jobRuns.length > 0);
      const windowLabel = getWindowLabel(jobName);
      const healthReason = healthReasonForStatus(healthStatus, windowLabel, latestRun);
      const missed = healthStatus !== 'ok';
      const canRerun = !latestRun || latestRun.status !== 'running';
      const status = latestRun?.status ?? 'never-ran';

      if (healthStatus === 'ok') counts.ok += 1;
      if (healthStatus === 'delayed') counts.delayed += 1;
      if (healthStatus === 'failed') counts.failed += 1;
      if (healthStatus === 'never-ran') counts.neverRan += 1;

      if (healthStatus === 'never-ran') {
        alerts.push(buildAlert(jobName, 'critical', `${jobName} has never run yet.`, now));
      } else if (healthStatus === 'failed') {
        const severity = failureStreak >= 2 ? 'critical' : 'warning';
        alerts.push(buildAlert(jobName, severity, `${jobName} is failing or has repeated failures.`, now));
      } else if (healthStatus === 'delayed') {
        const severity = jobName === 'autonomous:monitor' ? 'warning' : 'critical';
        alerts.push(buildAlert(jobName, severity, `${jobName} is missing a successful run in the ${windowLabel} window.`, now));
      }

      if (failureStreak >= 2) {
        alerts.push(buildAlert(jobName, 'critical', `${jobName} has ${failureStreak} consecutive failed runs.`, now));
      }

      const summary = latestRun?.summary ?? latestSuccessfulRun?.summary ?? 'No run recorded yet';

      jobs.push({
        jobName,
        scheduledFor: AUTONOMOUS_JOB_REGISTRY[jobName].getScheduledFor(now).toISOString(),
        latestRun,
        missed,
        canRerun,
        triggerSource: latestRun?.triggerSource ?? null,
        runMode: latestRun?.runMode ?? null,
        lastErrorMessage: latestRun?.errorMessage ?? null,
        status: latestRun?.status ?? 'never-ran',
        healthStatus,
        healthReason,
        lastSuccessfulRunAt: latestSuccessfulRun?.finishedAt?.toISOString() ?? latestSuccessfulRun?.startedAt?.toISOString() ?? null,
        failureStreak,
        summary,
        limitations: jobRuns.length === 0 ? ['No job run recorded yet.'] : [],
      });
    }

    const summary = [
      `${counts.total} autonomous jobs tracked.`,
      counts.failed > 0 ? `${counts.failed} job(s) are failing.` : null,
      counts.delayed > 0 ? `${counts.delayed} job(s) are delayed.` : null,
      counts.neverRan > 0 ? `${counts.neverRan} job(s) have never run.` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ');

    return {
      jobs,
      alerts,
      summary,
      limitations: [
        'Health checks are computed from the current local job registry windows.',
        'A single alert may appear alongside a delayed status when a job misses its expected window.',
      ],
      healthSummary: counts,
    };
  }
}
