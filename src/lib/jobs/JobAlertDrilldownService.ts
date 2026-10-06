import { JobAlertHistoryService } from './JobAlertHistoryService';
import type { JobAlertRecord, JobAlertSeverity } from './types';

export interface JobAlertDrilldownTimelineItem {
  id: number;
  status: JobAlertRecord['status'];
  severity: JobAlertSeverity;
  message: string;
  detectedAt: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  occurrenceCount: number;
}

export interface JobAlertDrilldownSummary {
  jobName: string;
  activeAlertsCount: number;
  resolvedAlertsCount: number;
  totalOccurrences: number;
  latestAlertStatus: JobAlertRecord['status'] | 'unknown';
  severityDistribution: Record<JobAlertSeverity, number>;
  recentReoccurCount: number;
  recentResolvedCount: number;
  averageHoursToResolve: number | null;
  mostCommonAlertMessage: string | null;
  summaryNote: string;
}

export interface JobAlertDrilldownResult {
  jobName: string;
  summary: JobAlertDrilldownSummary;
  timeline: JobAlertDrilldownTimelineItem[];
  recentAlerts: JobAlertRecord[];
  recentRecoveryEvents: JobAlertRecord[];
  limitations: string[];
  generatedAt: string;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildCutoff(days: number, now = new Date()): Date {
  return new Date(startOfUtcDay(now).getTime() - Math.max(0, days - 1) * 24 * 60 * 60 * 1000);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export class JobAlertDrilldownService {
  constructor(private readonly historyService = new JobAlertHistoryService()) {}

  async build(jobName: string, days = 30, now = new Date()): Promise<JobAlertDrilldownResult> {
    const alerts = await this.historyService.listHistory({
      jobName,
      includeResolved: true,
      status: 'all',
      days,
      sortBy: 'latest',
      sortDir: 'desc',
      limit: 200,
      offset: 0,
    });

    const recentWindow = buildCutoff(days, now);
    const recentAlerts = alerts.filter((row) => {
      const lastDetected = parseDate(row.lastDetectedAt);
      const resolvedAt = parseDate(row.resolvedAt ?? undefined);
      return (lastDetected ? lastDetected >= recentWindow : false) || (resolvedAt ? resolvedAt >= recentWindow : false);
    });

    const activeAlerts = alerts.filter((row) => row.status === 'active');
    const resolvedAlerts = alerts.filter((row) => row.status === 'resolved');
    const totalOccurrences = alerts.reduce((sum, row) => sum + row.occurrenceCount, 0);
    const severityDistribution = alerts.reduce<Record<JobAlertSeverity, number>>(
      (acc, row) => {
        acc[row.severity] += 1;
        return acc;
      },
      { critical: 0, warning: 0, info: 0 },
    );

    const mostCommonAlertMessage = alerts.reduce<Record<string, number>>((acc, row) => {
      acc[row.message] = (acc[row.message] ?? 0) + 1;
      return acc;
    }, {});

    const recoveryEvents = alerts.filter((row) => {
      if (row.status !== 'resolved' || row.resolvedAt === null) return false;
      const resolvedAt = parseDate(row.resolvedAt);
      return resolvedAt ? resolvedAt >= recentWindow : false;
    });

    const averageHoursToResolve = recoveryEvents.length > 0
      ? recoveryEvents.reduce((sum, row) => {
          const first = parseDate(row.firstDetectedAt);
          const resolvedAt = parseDate(row.resolvedAt ?? undefined);
          if (!first || !resolvedAt) return sum;
          return sum + (resolvedAt.getTime() - first.getTime()) / 3_600_000;
        }, 0) / recoveryEvents.length
      : null;

    const latestAlert = alerts[0] ?? null;
    const recentReoccurCount = recentAlerts.filter((row) => row.occurrenceCount > 1).length;
    const summaryNote = (() => {
      if (activeAlerts.length === 0 && resolvedAlerts.length === 0) {
        return 'This job has no persisted alert history yet.';
      }
      if (activeAlerts.length > 0 && resolvedAlerts.length > 0) {
        return 'This job has both active and resolved alert cycles, so lifecycle review is useful.';
      }
      if (activeAlerts.length > 0) {
        return 'This job is currently noisy or delayed, with active alerts still open.';
      }
      return 'This job has recovered from prior alert cycles.';
    })();

    return {
      jobName,
      summary: {
        jobName,
        activeAlertsCount: activeAlerts.length,
        resolvedAlertsCount: resolvedAlerts.length,
        totalOccurrences,
        latestAlertStatus: latestAlert?.status ?? 'unknown',
        severityDistribution,
        recentReoccurCount,
        recentResolvedCount: recoveryEvents.length,
        averageHoursToResolve,
        mostCommonAlertMessage: Object.entries(mostCommonAlertMessage)
          .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null,
        summaryNote,
      },
      timeline: recentAlerts.map((row) => ({
        id: row.id,
        status: row.status,
        severity: row.severity,
        message: row.message,
        detectedAt: row.detectedAt,
        firstDetectedAt: row.firstDetectedAt,
        lastDetectedAt: row.lastDetectedAt,
        resolvedAt: row.resolvedAt,
        occurrenceCount: row.occurrenceCount,
      })),
      recentAlerts,
      recentRecoveryEvents: recoveryEvents,
      limitations: [
        ...(alerts.length === 0 ? ['No persisted job alert history found for this job.'] : []),
        'Timeline is built from persisted JobAlert rows and a selected recent window.',
      ],
      generatedAt: now.toISOString(),
    };
  }
}
