import { JobAlertService, type JobAlertFilter } from './JobAlertService';
import type { JobAlertRecord, JobAlertSeverity } from './types';

export interface JobAlertHistorySummary {
  total: number;
  active: number;
  resolvedRecently: number;
  critical: number;
  warning: number;
  info: number;
  topNoisyJobs: Array<{ jobName: string; occurrenceCount: number }>;
  recentReoccurAlerts: JobAlertRecord[];
  recentResolvedAlerts: JobAlertRecord[];
  severityDistribution: Record<JobAlertSeverity, number>;
}

export interface JobAlertHistoryParams extends JobAlertFilter {
  days?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'latest' | 'occurrenceCount' | 'firstDetectedAt';
  sortDir?: 'asc' | 'desc';
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildCutoff(days: number, now = new Date()): Date {
  return new Date(startOfUtcDay(now).getTime() - Math.max(0, days - 1) * 24 * 60 * 60 * 1000);
}

export class JobAlertHistoryService {
  constructor(private readonly alertService = new JobAlertService()) {}

  async listHistory(params: JobAlertHistoryParams = {}, now = new Date()): Promise<JobAlertRecord[]> {
    void now;
    return this.alertService.listAlerts(
      {
        jobName: params.jobName,
        severity: params.severity,
        status: params.status,
        onlyActive: params.onlyActive,
        includeResolved: params.includeResolved,
      },
      {
        limit: params.limit ?? 200,
        offset: params.offset ?? 0,
        sortBy: params.sortBy ?? 'latest',
        sortDir: params.sortDir ?? 'desc',
      },
    );
  }

  async buildSummary(params: JobAlertHistoryParams = {}, now = new Date()): Promise<JobAlertHistorySummary> {
    const days = params.days ?? 14;
    const cutoff = buildCutoff(days, now);
    const [allRecent, active] = await Promise.all([
      this.alertService.listRecentAlerts(days),
      this.alertService.listAlerts({ jobName: params.jobName, severity: params.severity, onlyActive: true }),
    ]);

    const filteredRecent = allRecent.filter((row) => {
      if (params.jobName && row.jobName !== params.jobName) return false;
      if (params.severity && row.severity !== params.severity) return false;
      return new Date(row.lastDetectedAt) >= cutoff || (row.resolvedAt ? new Date(row.resolvedAt) >= cutoff : false);
    });

    const recentResolvedAlerts = filteredRecent.filter((row) => row.status === 'resolved' && row.resolvedAt !== null);
    const recentReoccurAlerts = filteredRecent.filter((row) => row.occurrenceCount > 1);
    const counts = filteredRecent.reduce<Record<JobAlertSeverity, number>>(
      (acc, row) => {
        acc[row.severity] += 1;
        return acc;
      },
      { critical: 0, warning: 0, info: 0 },
    );

    const noisyJobs = filteredRecent.reduce<Record<string, number>>((acc, row) => {
      acc[row.jobName] = Math.max(acc[row.jobName] ?? 0, row.occurrenceCount);
      return acc;
    }, {});

    return {
      total: filteredRecent.length,
      active: active.length,
      resolvedRecently: recentResolvedAlerts.length,
      critical: counts.critical,
      warning: counts.warning,
      info: counts.info,
      topNoisyJobs: Object.entries(noisyJobs)
        .map(([jobName, occurrenceCount]) => ({ jobName, occurrenceCount }))
        .sort((left, right) => right.occurrenceCount - left.occurrenceCount)
        .slice(0, 5),
      recentReoccurAlerts,
      recentResolvedAlerts,
      severityDistribution: counts,
    };
  }
}
