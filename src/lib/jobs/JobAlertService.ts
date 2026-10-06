import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import type { JobAlert, JobAlertRecord } from './types';
import type { JobHealthRow } from './types';
import type { JobHealthReport } from './JobHealthService';

export interface JobAlertFilter {
  jobName?: string;
  severity?: JobAlert['severity'];
  status?: JobAlertRecord['status'] | 'all';
  onlyActive?: boolean;
  includeResolved?: boolean;
}

export interface JobAlertSummary {
  total: number;
  active: number;
  resolved: number;
  suppressed: number;
  critical: number;
  warning: number;
  info: number;
  recentResolved: number;
  topNoisyJobs: Array<{ jobName: string; occurrenceCount: number }>;
}

export interface JobAlertSyncResult {
  activeUpserts: number;
  resolved: number;
  suppressed: number;
  totalObserved: number;
}

export interface JobAlertListOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'latest' | 'occurrenceCount' | 'firstDetectedAt';
  sortDir?: 'asc' | 'desc';
}

export function buildJobAlertKey(alert: Pick<JobAlert, 'jobName' | 'severity' | 'message'>): string {
  return alert.jobName;
}

function toRecord(row: {
  id: number;
  jobName: string;
  severity: string;
  message: string;
  alertKey: string;
  status: string;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  resolvedAt: Date | null;
  occurrenceCount: number;
  latestJobRunLogId: number | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}): JobAlertRecord {
  return {
    id: row.id,
    jobName: row.jobName,
    severity: row.severity as JobAlertRecord['severity'],
    message: row.message,
    detectedAt: row.lastDetectedAt.toISOString(),
    alertKey: row.alertKey,
    status: row.status as JobAlertRecord['status'],
    firstDetectedAt: row.firstDetectedAt.toISOString(),
    lastDetectedAt: row.lastDetectedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    occurrenceCount: row.occurrenceCount,
    latestJobRunLogId: row.latestJobRunLogId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function safeParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function safeStringify(value: Record<string, unknown> | null | undefined): string | null {
  if (!value) return null;
  return JSON.stringify(value);
}

function buildObservationKey(alert: JobAlert, job: JobHealthRow | undefined): string {
  const runId = job?.latestRun?.id ?? 'none';
  const scheduledFor = job?.scheduledFor ?? 'unknown';
  return `${buildJobAlertKey(alert)}|${runId}|${scheduledFor}`;
}

export class JobAlertService {
  async syncFromHealthReport(report: JobHealthReport, now = new Date()): Promise<JobAlertSyncResult> {
    const observed = report.alerts;
    const jobsByName = new Map(report.jobs.map((job) => [job.jobName, job]));
    const activeKeys = new Set<string>();
    let activeUpserts = 0;
    let suppressed = 0;

    for (const alert of observed) {
      const job = jobsByName.get(alert.jobName);
      const alertKey = buildJobAlertKey(alert);
      const observationKey = buildObservationKey(alert, job);
      activeKeys.add(alertKey);
      const existing = await prisma.jobAlert.findUnique({ where: { alertKey } });
      const metadata = {
        observationKey,
        sourceJobRunLogId: job?.latestRun?.id ?? null,
        scheduledFor: job?.scheduledFor ?? null,
        observedAt: now.toISOString(),
      };
      const message = alert.message.trim();

      if (!existing) {
        await prisma.jobAlert.create({
          data: {
            jobName: alert.jobName,
            severity: alert.severity,
            message,
            alertKey,
            status: 'active',
            firstDetectedAt: now,
            lastDetectedAt: now,
            resolvedAt: null,
            occurrenceCount: 1,
            latestJobRunLogId: job?.latestRun?.id ?? null,
            metadata: safeStringify(metadata),
          },
        });
        activeUpserts += 1;
        continue;
      }

      const existingMeta = safeParse<Record<string, unknown>>(existing.metadata, {});
      const existingObservationKey = typeof existingMeta.observationKey === 'string' ? existingMeta.observationKey : null;
      const occurrenceCount =
        existing.status === 'active' && existingObservationKey === observationKey
          ? existing.occurrenceCount
          : existing.occurrenceCount + 1;

      if (existing.status === 'active') {
        await prisma.jobAlert.update({
          where: { alertKey },
          data: {
            jobName: alert.jobName,
            severity: alert.severity,
            message,
            status: 'active',
            lastDetectedAt: now,
            resolvedAt: null,
            occurrenceCount,
            latestJobRunLogId: job?.latestRun?.id ?? existing.latestJobRunLogId ?? null,
            metadata: safeStringify({
              ...existingMeta,
              ...metadata,
              occurrenceCount,
            }),
          },
        });
        activeUpserts += 1;
      } else {
        await prisma.jobAlert.update({
          where: { alertKey },
          data: {
            jobName: alert.jobName,
            severity: alert.severity,
            message,
            status: 'active',
            lastDetectedAt: now,
            resolvedAt: null,
            occurrenceCount,
            latestJobRunLogId: job?.latestRun?.id ?? existing.latestJobRunLogId ?? null,
            metadata: safeStringify({
              ...existingMeta,
              ...metadata,
              occurrenceCount,
            }),
          },
        });
        activeUpserts += 1;
      }
    }

    const resolvedCandidates = await prisma.jobAlert.findMany({
      where: {
        status: 'active',
        jobName: { in: Array.from(jobsByName.keys()) },
      },
    });

    for (const row of resolvedCandidates) {
      if (activeKeys.has(row.alertKey)) continue;
      const job = jobsByName.get(row.jobName);
      const recovered = job?.healthStatus === 'ok' || job?.latestRun?.status === 'success';
      if (!recovered) continue;

      await prisma.jobAlert.update({
        where: { alertKey: row.alertKey },
        data: {
          status: 'resolved',
          resolvedAt: now,
          metadata: safeStringify({
            ...safeParse<Record<string, unknown>>(row.metadata, {}),
            resolvedAt: now.toISOString(),
            recoveredByJobRunId: job?.latestRun?.id ?? null,
          }),
        },
      });
      suppressed += 1;
    }

    return {
      activeUpserts,
      resolved: suppressed,
      suppressed,
      totalObserved: observed.length,
    };
  }

  async listAlerts(filter: JobAlertFilter = {}, options: JobAlertListOptions = {}): Promise<JobAlertRecord[]> {
    const where: Prisma.JobAlertWhereInput = {};
    if (filter.jobName) where.jobName = filter.jobName;
    if (filter.severity) where.severity = filter.severity;
    if (filter.status && filter.status !== 'all') {
      where.status = filter.status;
    }
    if (filter.onlyActive === true) {
      where.status = 'active';
    } else if (filter.includeResolved !== true) {
      where.status = { in: ['active', 'suppressed'] };
    }

    const sortBy = options.sortBy ?? 'latest';
    const sortDir = options.sortDir ?? 'desc';
    const orderBy =
      sortBy === 'occurrenceCount'
        ? [{ occurrenceCount: sortDir }, { lastDetectedAt: 'desc' as const }]
        : sortBy === 'firstDetectedAt'
          ? [{ firstDetectedAt: sortDir }, { lastDetectedAt: 'desc' as const }]
          : [{ lastDetectedAt: sortDir }, { createdAt: 'desc' as const }];

    const rows = await prisma.jobAlert.findMany({
      where,
      orderBy,
      take: options.limit ?? 200,
      skip: options.offset ?? 0,
    });

    return rows.map(toRecord);
  }

  async listRecentAlerts(days = 7): Promise<JobAlertRecord[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.jobAlert.findMany({
      where: { lastDetectedAt: { gte: cutoff } },
      orderBy: [{ lastDetectedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toRecord);
  }

  async markResolved(alertKey: string, resolvedAt = new Date(), metadata?: Record<string, unknown>): Promise<JobAlertRecord | null> {
    const existing = await prisma.jobAlert.findUnique({ where: { alertKey } });
    if (!existing) return null;
    const row = await prisma.jobAlert.update({
      where: { alertKey },
      data: {
        status: 'resolved',
        resolvedAt,
        metadata: safeStringify({
          ...safeParse<Record<string, unknown>>(existing.metadata, {}),
          ...metadata,
          resolvedAt: resolvedAt.toISOString(),
        }),
      },
    });
    return toRecord(row);
  }

  async summarizeAlerts(days = 7): Promise<JobAlertSummary> {
    const recent = await this.listRecentAlerts(days);
    const active = recent.filter((row) => row.status === 'active');
    const resolved = recent.filter((row) => row.status === 'resolved');
    const suppressed = recent.filter((row) => row.status === 'suppressed');
    const counts = recent.reduce<Record<string, number>>((acc, row) => {
      acc[row.severity] = (acc[row.severity] ?? 0) + 1;
      return acc;
    }, {});
    const noisyJobs = recent
      .reduce<Record<string, number>>((acc, row) => {
        acc[row.jobName] = Math.max(acc[row.jobName] ?? 0, row.occurrenceCount);
        return acc;
      }, {});

    return {
      total: recent.length,
      active: active.length,
      resolved: resolved.length,
      suppressed: suppressed.length,
      critical: counts.critical ?? 0,
      warning: counts.warning ?? 0,
      info: counts.info ?? 0,
      recentResolved: resolved.length,
      topNoisyJobs: Object.entries(noisyJobs)
        .map(([jobName, occurrenceCount]) => ({ jobName, occurrenceCount }))
        .sort((left, right) => right.occurrenceCount - left.occurrenceCount)
        .slice(0, 5),
    };
  }
}
