import { prisma } from '../prisma';
import { AutonomousAlertService, type AutonomousAlertFilter } from './AutonomousAlertService';
import { JobAlertService } from './JobAlertService';
import {
  AutonomousAlertCooldownPolicy,
  normalizeAlertDigestKey,
  parseAutonomousAlertDeliverySnapshot,
  type AutonomousAlertDeliverySnapshot,
} from './AutonomousAlertCooldownPolicy';
import type { JobAlert, JobAlertSeverity, JobHealthSummary } from './types';

export interface AutonomousAlertDigestItem extends JobAlert {
  digestKey: string;
}

export interface AutonomousAlertDigestSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  suppressed: number;
}

export interface AutonomousAlertDigest {
  reportDate: string;
  generatedAt: string;
  summary: string;
  markdown: string;
  structured: {
    reportDate: string;
    summary: string;
    total: number;
    critical: number;
    warning: number;
    info: number;
    suppressed: number;
    alerts: Array<{
      jobName: string;
      severity: JobAlertSeverity;
      message: string;
      detectedAt: string;
      digestKey: string;
    }>;
    healthSummary: JobHealthSummary;
    limitations: string[];
  };
  alerts: AutonomousAlertDigestItem[];
  summaryStats: AutonomousAlertDigestSummary;
  healthSummary: JobHealthSummary;
  limitations: string[];
  suppression: {
    recentWindowHours: number;
    suppressedKeys: string[];
  };
  shouldAttach: boolean;
}

export interface AutonomousAlertNotificationOptions extends AutonomousAlertFilter {
  now?: Date;
  suppressionWindowHours?: number;
}

function digestKeyForAlert(alert: JobAlert): string {
  return normalizeAlertDigestKey(alert);
}

function summaryText(items: AutonomousAlertDigestItem[]): string {
  if (items.length === 0) return 'Autonomous system currently has no active alerts.';
  const critical = items.filter((item) => item.severity === 'critical').length;
  const warning = items.filter((item) => item.severity === 'warning').length;
  const info = items.filter((item) => item.severity === 'info').length;
  return [
    `Autonomous alerts: ${items.length} active.`,
    critical > 0 ? `${critical} critical.` : null,
    warning > 0 ? `${warning} warning.` : null,
    info > 0 ? `${info} info.` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

function markdownDigest(items: AutonomousAlertDigestItem[], reportDate: string, healthSummary: JobHealthSummary): string {
  if (items.length === 0) {
    return [
      `## Autonomous System Health`,
      ``,
      `No active autonomous alerts.`,
      ``,
      `- OK: ${healthSummary.ok}`,
      `- Delayed: ${healthSummary.delayed}`,
      `- Failed: ${healthSummary.failed}`,
      `- Never ran: ${healthSummary.neverRan}`,
    ].join('\n');
  }

  const lines = [
    `## Autonomous System Health (${reportDate})`,
    ``,
    `> ${summaryText(items)}`,
    ``,
  ];

  const groups: Record<JobAlertSeverity, AutonomousAlertDigestItem[]> = { critical: [], warning: [], info: [] };
  items.forEach((item) => groups[item.severity].push(item));

  for (const severity of ['critical', 'warning', 'info'] as JobAlertSeverity[]) {
    if (groups[severity].length === 0) continue;
    lines.push(`### ${severity.toUpperCase()}`);
    for (const item of groups[severity]) {
      lines.push(`- **${item.jobName}**: ${item.message}`);
    }
    lines.push('');
  }

  lines.push(`- OK: ${healthSummary.ok}`);
  lines.push(`- Delayed: ${healthSummary.delayed}`);
  lines.push(`- Failed: ${healthSummary.failed}`);
  lines.push(`- Never ran: ${healthSummary.neverRan}`);
  return lines.join('\n');
}

function buildRecentLogWindow(now: Date, suppressionWindowHours: number): Date {
  return new Date(now.getTime() - suppressionWindowHours * 60 * 60 * 1000);
}

function safeParseMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function buildRecentDeliveries(
  recentLogs: Array<{ sentAt: Date; metadata: string | null }>,
): AutonomousAlertDeliverySnapshot[] {
  const deliveries: AutonomousAlertDeliverySnapshot[] = [];
  for (const log of recentLogs) {
    const metadata = safeParseMetadata(log.metadata);
    const keys = metadata.autonomousAlertKeys;
    if (!Array.isArray(keys)) continue;
    for (const key of keys) {
      if (typeof key !== 'string') continue;
      const snapshot = parseAutonomousAlertDeliverySnapshot(key, log.sentAt);
      if (snapshot) deliveries.push(snapshot);
    }
  }
  return deliveries;
}

export class AutonomousAlertNotificationAdapter {
  constructor(
    private readonly alertService = new AutonomousAlertService(),
    private readonly alertHistoryService = new JobAlertService(),
  ) {}

  async buildDigest(options: AutonomousAlertNotificationOptions = {}): Promise<AutonomousAlertDigest> {
    const now = options.now ?? new Date();
    const suppressionWindowHours = options.suppressionWindowHours ?? 24;
    const report = await this.alertService.listAlerts(
      {
        jobName: options.jobName,
        severity: options.severity,
        onlyActive: options.onlyActive,
      },
      now,
    );

    const recentLogs = await prisma.notificationDeliveryLog.findMany({
      where: { sentAt: { gte: buildRecentLogWindow(now, suppressionWindowHours) } },
      orderBy: { sentAt: 'desc' },
      take: 50,
    }).catch(() => []);

    const recentDeliveries = buildRecentDeliveries(recentLogs);
    const persistedAlerts = await this.alertHistoryService.listAlerts({ onlyActive: true }).catch(() => []);
    const policy = await AutonomousAlertCooldownPolicy.fromStoredConfig();

    const alerts = report.alerts.map((alert) => ({
        ...alert,
        digestKey: digestKeyForAlert(alert),
      }));

    const decisions = alerts.map((alert) => policy.evaluate(alert, {
      now,
      recentDeliveries,
      jobs: report.jobs,
      persistedAlerts,
    }));

    const activeAlerts = decisions.filter((decision) => decision.shouldNotify).map((decision) => ({
      ...decision.alert,
      digestKey: digestKeyForAlert(decision.alert),
    }));

    const suppressedKeys = decisions
      .filter((decision) => !decision.shouldNotify)
      .map((decision) => digestKeyForAlert(decision.alert));

    const suppressed = alerts.length - activeAlerts.length;
    const stats: AutonomousAlertDigestSummary = {
      total: activeAlerts.length,
      critical: activeAlerts.filter((a) => a.severity === 'critical').length,
      warning: activeAlerts.filter((a) => a.severity === 'warning').length,
      info: activeAlerts.filter((a) => a.severity === 'info').length,
      suppressed,
    };

    return {
      reportDate: now.toISOString().slice(0, 10),
      generatedAt: now.toISOString(),
      summary: summaryText(activeAlerts),
      markdown: markdownDigest(activeAlerts, now.toISOString().slice(0, 10), report.healthSummary),
      structured: {
        reportDate: now.toISOString().slice(0, 10),
        summary: summaryText(activeAlerts),
        total: activeAlerts.length,
        critical: stats.critical,
        warning: stats.warning,
        info: stats.info,
        suppressed: stats.suppressed,
        alerts: activeAlerts.map((alert) => ({
          jobName: alert.jobName,
          severity: alert.severity,
          message: alert.message,
          detectedAt: alert.detectedAt,
          digestKey: alert.digestKey,
        })),
        healthSummary: report.healthSummary,
        limitations: report.limitations,
      },
      alerts: activeAlerts,
      summaryStats: stats,
      healthSummary: report.healthSummary,
      limitations: report.limitations,
      suppression: {
        recentWindowHours: suppressionWindowHours,
        suppressedKeys,
      },
      shouldAttach: activeAlerts.length > 0,
    };
  }
}

export function autonomousAlertDigestKey(alert: JobAlert): string {
  return digestKeyForAlert(alert);
}
