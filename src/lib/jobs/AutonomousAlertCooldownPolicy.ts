import {
  DEFAULT_AUTONOMOUS_ALERT_POLICY,
  getAutonomousAlertPolicySummary,
  type AutonomousAlertPolicyConfig,
  type AutonomousAlertPolicySummary,
} from './AutonomousAlertPolicyConfig';
import { loadAutonomousAlertPolicyState } from './AutonomousAlertPolicyStore';
import type { JobAlert, JobAlertRecord, JobAlertSeverity, JobHealthRow } from './types';

export interface AutonomousAlertDeliverySnapshot {
  digestKey: string;
  jobName: string;
  severity: JobAlertSeverity;
  message: string;
  sentAt: Date;
}

export interface AutonomousAlertCooldownConfig {
  severityCooldownHours?: Partial<Record<JobAlertSeverity, number>>;
  jobCooldownHours?: Partial<Record<string, Partial<Record<JobAlertSeverity, number>>>>;
  allowInfoAlerts?: boolean;
  escalationEnabled?: boolean;
  recoveryResetEnabled?: boolean;
}

export interface AutonomousAlertCooldownDecision {
  alert: JobAlert;
  shouldNotify: boolean;
  reason: 'new' | 'cooldown' | 'job_cooldown' | 'reset' | 'escalated' | 'suppressed';
  cooldownHours: number;
  jobCooldownHours: number;
  lastSentAt: string | null;
  lastSuccessAt: string | null;
}

export interface AutonomousAlertCooldownContext {
  now: Date;
  recentDeliveries: AutonomousAlertDeliverySnapshot[];
  jobs: JobHealthRow[];
  persistedAlerts?: JobAlertRecord[];
}

function severityRank(severity: JobAlertSeverity): number {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

function parseKeyParts(digestKey: string): { jobName: string; severity: JobAlertSeverity; message: string } | null {
  const [jobName, severityRaw, ...messageParts] = digestKey.split('|');
  if (!jobName || !severityRaw || messageParts.length === 0) return null;
  if (severityRaw !== 'critical' && severityRaw !== 'warning' && severityRaw !== 'info') return null;
  return {
    jobName,
    severity: severityRaw,
    message: messageParts.join('|'),
  };
}

function withinCooldown(now: Date, sentAt: Date | null | undefined, cooldownHours: number): boolean {
  if (!sentAt) return false;
  if (cooldownHours <= 0) return false;
  const elapsedHours = (now.getTime() - sentAt.getTime()) / 3_600_000;
  return elapsedHours < cooldownHours;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeAlertDigestKey(alert: Pick<JobAlert, 'jobName' | 'severity' | 'message'>): string {
  return [alert.jobName, alert.severity, alert.message.trim().toLowerCase()].join('|');
}

export class AutonomousAlertCooldownPolicy {
  constructor(private readonly config: AutonomousAlertCooldownConfig = {}) {}

  static fromConfig(config: Partial<AutonomousAlertPolicyConfig> = {}) {
    return new AutonomousAlertCooldownPolicy({
      severityCooldownHours: config.severityCooldownHours,
      jobCooldownHours: config.jobCooldownOverrides,
      allowInfoAlerts: config.infoNotificationEnabled,
      escalationEnabled: config.escalationEnabled,
      recoveryResetEnabled: config.recoveryResetEnabled,
    });
  }

  static async fromStoredConfig(): Promise<AutonomousAlertCooldownPolicy> {
    const state = await loadAutonomousAlertPolicyState();
    return new AutonomousAlertCooldownPolicy({
      severityCooldownHours: state.config.severityCooldownHours,
      jobCooldownHours: state.config.jobCooldownOverrides,
      allowInfoAlerts: state.config.infoNotificationEnabled,
      escalationEnabled: state.config.escalationEnabled,
      recoveryResetEnabled: state.config.recoveryResetEnabled,
    });
  }

  static getDefaultSummary(): AutonomousAlertPolicySummary {
    return getAutonomousAlertPolicySummary(DEFAULT_AUTONOMOUS_ALERT_POLICY);
  }

  getSeverityCooldownHours(severity: JobAlertSeverity): number {
    return this.config.severityCooldownHours?.[severity] ?? DEFAULT_AUTONOMOUS_ALERT_POLICY.severityCooldownHours[severity];
  }

  getJobCooldownHours(jobName: string, severity: JobAlertSeverity): number {
    const jobOverride = this.config.jobCooldownHours?.[jobName]?.[severity];
    if (typeof jobOverride === 'number') return jobOverride;
    const defaultJobOverride = DEFAULT_AUTONOMOUS_ALERT_POLICY.jobCooldownOverrides[jobName]?.[severity];
    if (typeof defaultJobOverride === 'number') return defaultJobOverride;
    return this.getSeverityCooldownHours(severity);
  }

  shouldNotifyInfoAlerts(): boolean {
    return this.config.allowInfoAlerts ?? DEFAULT_AUTONOMOUS_ALERT_POLICY.infoNotificationEnabled;
  }

  isEscalationEnabled(): boolean {
    return this.config.escalationEnabled ?? DEFAULT_AUTONOMOUS_ALERT_POLICY.escalationEnabled;
  }

  isRecoveryResetEnabled(): boolean {
    return this.config.recoveryResetEnabled ?? DEFAULT_AUTONOMOUS_ALERT_POLICY.recoveryResetEnabled;
  }

  getPolicySummary(): AutonomousAlertPolicySummary {
    return getAutonomousAlertPolicySummary({
      severityCooldownHours: {
        critical: this.getSeverityCooldownHours('critical'),
        warning: this.getSeverityCooldownHours('warning'),
        info: this.getSeverityCooldownHours('info'),
      },
      jobCooldownOverrides: this.config.jobCooldownHours ?? DEFAULT_AUTONOMOUS_ALERT_POLICY.jobCooldownOverrides,
      infoNotificationEnabled: this.shouldNotifyInfoAlerts(),
      escalationEnabled: this.isEscalationEnabled(),
      recoveryResetEnabled: this.isRecoveryResetEnabled(),
    });
  }

  evaluate(
    alert: JobAlert,
    context: AutonomousAlertCooldownContext,
  ): AutonomousAlertCooldownDecision {
    const lastSuccessAt = context.jobs.find((job) => job.jobName === alert.jobName)?.lastSuccessfulRunAt ?? null;
    const persistedAlert = context.persistedAlerts?.find((entry) => entry.jobName === alert.jobName
      && entry.severity === alert.severity
      && entry.message.trim().toLowerCase() === alert.message.trim().toLowerCase()
      && entry.status === 'active') ?? null;
    const normalizedKey = normalizeAlertDigestKey(alert);
    const recentDeliveries = context.recentDeliveries
      .filter((entry) => entry.jobName === alert.jobName)
      .sort((left, right) => right.sentAt.getTime() - left.sentAt.getTime());

    const matchingDelivery = recentDeliveries.find((entry) => entry.digestKey === normalizedKey) ?? null;
    const latestJobDelivery = recentDeliveries[0] ?? null;

    const severityCooldownHours = this.getSeverityCooldownHours(alert.severity);
    const jobCooldownHours = this.getJobCooldownHours(alert.jobName, alert.severity);

    if (persistedAlert) {
      const persistedLastDetectedAt = new Date(persistedAlert.lastDetectedAt);
      if (!Number.isNaN(persistedLastDetectedAt.getTime()) && withinCooldown(context.now, persistedLastDetectedAt, severityCooldownHours)) {
        return {
          alert,
          shouldNotify: false,
          reason: 'cooldown',
          cooldownHours: severityCooldownHours,
          jobCooldownHours,
          lastSentAt: matchingDelivery?.sentAt.toISOString() ?? persistedAlert.lastDetectedAt,
          lastSuccessAt,
        };
      }
    }

    if (alert.severity === 'info' && !this.shouldNotifyInfoAlerts()) {
      return {
        alert,
        shouldNotify: false,
        reason: 'suppressed',
        cooldownHours: severityCooldownHours,
        jobCooldownHours,
        lastSentAt: matchingDelivery?.sentAt.toISOString() ?? null,
        lastSuccessAt,
      };
    }

    const lastSuccessDate = toDate(lastSuccessAt);
    if (this.isRecoveryResetEnabled() && lastSuccessDate && latestJobDelivery && lastSuccessDate.getTime() > latestJobDelivery.sentAt.getTime()) {
      return {
        alert,
        shouldNotify: true,
        reason: 'reset',
        cooldownHours: severityCooldownHours,
        jobCooldownHours,
        lastSentAt: matchingDelivery?.sentAt.toISOString() ?? null,
        lastSuccessAt,
      };
    }

    if (matchingDelivery && withinCooldown(context.now, matchingDelivery.sentAt, severityCooldownHours)) {
      return {
        alert,
        shouldNotify: false,
        reason: 'cooldown',
        cooldownHours: severityCooldownHours,
        jobCooldownHours,
        lastSentAt: matchingDelivery.sentAt.toISOString(),
        lastSuccessAt,
      };
    }

    if (latestJobDelivery && withinCooldown(context.now, latestJobDelivery.sentAt, jobCooldownHours)) {
      const latestRank = severityRank(latestJobDelivery.severity);
      const currentRank = severityRank(alert.severity);
      if (!this.isEscalationEnabled() || currentRank <= latestRank) {
        return {
          alert,
          shouldNotify: false,
          reason: 'job_cooldown',
          cooldownHours: severityCooldownHours,
          jobCooldownHours,
          lastSentAt: latestJobDelivery.sentAt.toISOString(),
          lastSuccessAt,
        };
      }

      return {
        alert,
        shouldNotify: true,
        reason: 'escalated',
        cooldownHours: severityCooldownHours,
        jobCooldownHours,
        lastSentAt: latestJobDelivery.sentAt.toISOString(),
        lastSuccessAt,
      };
    }

    return {
      alert,
      shouldNotify: true,
      reason: 'new',
      cooldownHours: severityCooldownHours,
      jobCooldownHours,
      lastSentAt: matchingDelivery?.sentAt.toISOString() ?? null,
      lastSuccessAt,
    };
  }
}

export function parseAutonomousAlertDeliverySnapshot(
  digestKey: string,
  sentAt: Date,
): AutonomousAlertDeliverySnapshot | null {
  const parsed = parseKeyParts(digestKey);
  if (!parsed) return null;
  return {
    digestKey,
    jobName: parsed.jobName,
    severity: parsed.severity,
    message: parsed.message,
    sentAt,
  };
}
