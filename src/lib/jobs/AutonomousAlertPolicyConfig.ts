import type { JobAlertSeverity } from './types';

export interface AutonomousAlertPolicyConfig {
  severityCooldownHours: Record<JobAlertSeverity, number>;
  jobCooldownOverrides: Record<string, Partial<Record<JobAlertSeverity, number>>>;
  infoNotificationEnabled: boolean;
  escalationEnabled: boolean;
  recoveryResetEnabled: boolean;
}

export interface AutonomousAlertPolicySummary {
  defaults: {
    severityCooldownHours: Record<JobAlertSeverity, number>;
    infoNotificationEnabled: boolean;
    escalationEnabled: boolean;
    recoveryResetEnabled: boolean;
  };
  jobOverrides: Record<string, Partial<Record<JobAlertSeverity, number>>>;
  infoNotificationEnabled: boolean;
  escalationEnabled: boolean;
  recoveryResetEnabled: boolean;
}

export const AUTONOMOUS_ALERT_POLICY_SETTING_KEY = 'autonomous_alert_policy_v1';

const MIN_COOLDOWN_HOURS = 0.25;
const MAX_COOLDOWN_HOURS = 168;

export const DEFAULT_AUTONOMOUS_ALERT_POLICY: AutonomousAlertPolicyConfig = {
  severityCooldownHours: {
    critical: 2,
    warning: 12,
    info: 0,
  },
  jobCooldownOverrides: {
    'autonomous:monitor': {
      critical: 1,
      warning: 1,
    },
  },
  infoNotificationEnabled: false,
  escalationEnabled: true,
  recoveryResetEnabled: true,
};

export const AUTONOMOUS_ALERT_POLICY_CONFIG = getAutonomousAlertPolicyConfig();

function clampCooldownHours(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < MIN_COOLDOWN_HOURS) return MIN_COOLDOWN_HOURS;
  if (parsed > MAX_COOLDOWN_HOURS) return MAX_COOLDOWN_HOURS;
  return Math.round(parsed * 100) / 100;
}

function clampInfoCooldownHours(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > MAX_COOLDOWN_HOURS) return MAX_COOLDOWN_HOURS;
  return Math.round(parsed * 100) / 100;
}

function normalizeJobOverrides(
  overrides: Partial<Record<string, Partial<Record<JobAlertSeverity, number>>>> | undefined,
): Record<string, Partial<Record<JobAlertSeverity, number>>> {
  const result: Record<string, Partial<Record<JobAlertSeverity, number>>> = {};
  for (const [jobName, cfg] of Object.entries(overrides ?? {})) {
    if (!cfg || typeof cfg !== 'object') continue;
    const normalized: Partial<Record<JobAlertSeverity, number>> = {};
    for (const severity of ['critical', 'warning', 'info'] as const) {
      const value = cfg[severity];
      if (typeof value === 'number' || typeof value === 'string') {
        const fallback = DEFAULT_AUTONOMOUS_ALERT_POLICY.jobCooldownOverrides[jobName]?.[severity]
          ?? DEFAULT_AUTONOMOUS_ALERT_POLICY.severityCooldownHours[severity];
        normalized[severity] = clampCooldownHours(value, fallback);
      }
    }
    if (Object.keys(normalized).length > 0) {
      result[jobName] = normalized;
    }
  }
  return result;
}

export function normalizeAutonomousAlertPolicyConfig(
  input: Partial<AutonomousAlertPolicyConfig> = {},
): AutonomousAlertPolicyConfig {
  const critical = clampCooldownHours(
    input.severityCooldownHours?.critical,
    DEFAULT_AUTONOMOUS_ALERT_POLICY.severityCooldownHours.critical,
  );
  const warning = Math.max(
    critical,
    clampCooldownHours(
      input.severityCooldownHours?.warning,
      DEFAULT_AUTONOMOUS_ALERT_POLICY.severityCooldownHours.warning,
    ),
  );

  return {
    severityCooldownHours: {
      critical,
      warning,
      info: clampInfoCooldownHours(
        input.severityCooldownHours?.info,
        DEFAULT_AUTONOMOUS_ALERT_POLICY.severityCooldownHours.info,
      ),
    },
    jobCooldownOverrides: {
      ...DEFAULT_AUTONOMOUS_ALERT_POLICY.jobCooldownOverrides,
      ...normalizeJobOverrides(input.jobCooldownOverrides),
    },
    infoNotificationEnabled:
      input.infoNotificationEnabled ?? DEFAULT_AUTONOMOUS_ALERT_POLICY.infoNotificationEnabled,
    escalationEnabled: input.escalationEnabled ?? DEFAULT_AUTONOMOUS_ALERT_POLICY.escalationEnabled,
    recoveryResetEnabled: input.recoveryResetEnabled ?? DEFAULT_AUTONOMOUS_ALERT_POLICY.recoveryResetEnabled,
  };
}

export function getAutonomousAlertPolicyConfig(
  overrides: Partial<AutonomousAlertPolicyConfig> = {},
): AutonomousAlertPolicyConfig {
  return normalizeAutonomousAlertPolicyConfig(overrides);
}

export function getAutonomousAlertPolicySummary(
  config: AutonomousAlertPolicyConfig = DEFAULT_AUTONOMOUS_ALERT_POLICY,
): AutonomousAlertPolicySummary {
  return {
    defaults: {
      severityCooldownHours: config.severityCooldownHours,
      infoNotificationEnabled: config.infoNotificationEnabled,
      escalationEnabled: config.escalationEnabled,
      recoveryResetEnabled: config.recoveryResetEnabled,
    },
    jobOverrides: config.jobCooldownOverrides,
    infoNotificationEnabled: config.infoNotificationEnabled,
    escalationEnabled: config.escalationEnabled,
    recoveryResetEnabled: config.recoveryResetEnabled,
  };
}
