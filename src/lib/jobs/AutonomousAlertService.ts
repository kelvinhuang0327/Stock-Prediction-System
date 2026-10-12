import { JobHealthService } from './JobHealthService';
import type { JobAlert, JobAlertSeverity, JobHealthRow, JobHealthSummary } from './types';
import { JobAlertService } from './JobAlertService';

export interface AutonomousAlertFilter {
  jobName?: string;
  severity?: JobAlertSeverity;
  onlyActive?: boolean;
}

export interface AutonomousAlertSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
}

export interface AutonomousAlertReport {
  alerts: JobAlert[];
  summary: AutonomousAlertSummary;
  generatedAt: string;
  limitations: string[];
  jobs: JobHealthRow[];
  healthSummary: JobHealthSummary;
}

function summarize(alerts: JobAlert[]): AutonomousAlertSummary {
  return alerts.reduce<AutonomousAlertSummary>(
    (acc, alert) => {
      acc.total += 1;
      acc[alert.severity] += 1;
      return acc;
    },
    { total: 0, critical: 0, warning: 0, info: 0 },
  );
}

export class AutonomousAlertService {
  constructor(
    private readonly healthService = new JobHealthService(),
    private readonly jobAlertService = new JobAlertService(),
  ) {}

  async listAlerts(filter: AutonomousAlertFilter = {}, now = new Date()): Promise<AutonomousAlertReport> {
    const health = await this.healthService.evaluate(now);
    await this.jobAlertService.syncFromHealthReport(health, now).catch(() => null);
    const alerts = health.alerts.filter((alert) => {
      if (filter.jobName && alert.jobName !== filter.jobName) return false;
      if (filter.severity && alert.severity !== filter.severity) return false;
      if (filter.onlyActive === true) return alert.severity !== 'info';
      return true;
    });

    return {
      alerts,
      summary: summarize(alerts),
      generatedAt: now.toISOString(),
      limitations: [
        'Alerts are computed from current job health and are synchronized to persistence best-effort.',
        'onlyActive filters out informational alerts when present.',
      ],
      jobs: health.jobs,
      healthSummary: health.healthSummary,
    };
  }
}
