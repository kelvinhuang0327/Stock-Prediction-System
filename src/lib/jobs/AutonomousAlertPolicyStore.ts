import { prisma } from '@/lib/prisma';
import {
  AUTONOMOUS_ALERT_POLICY_SETTING_KEY,
  DEFAULT_AUTONOMOUS_ALERT_POLICY,
  getAutonomousAlertPolicyConfig,
  getAutonomousAlertPolicySummary,
  normalizeAutonomousAlertPolicyConfig,
  type AutonomousAlertPolicyConfig,
  type AutonomousAlertPolicySummary,
} from './AutonomousAlertPolicyConfig';

export interface AutonomousAlertPolicyState {
  source: 'default' | 'persisted';
  config: AutonomousAlertPolicyConfig;
  summary: AutonomousAlertPolicySummary;
  defaults: AutonomousAlertPolicyConfig;
  updatedAt: string | null;
  limitations: string[];
}

function safeParse(value: string | null | undefined): Partial<AutonomousAlertPolicyConfig> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Partial<AutonomousAlertPolicyConfig>;
  } catch {
    return {};
  }
}

function buildState(
  config: AutonomousAlertPolicyConfig,
  source: 'default' | 'persisted',
  updatedAt: string | null,
  limitations: string[] = [],
): AutonomousAlertPolicyState {
  return {
    source,
    config,
    summary: getAutonomousAlertPolicySummary(config),
    defaults: DEFAULT_AUTONOMOUS_ALERT_POLICY,
    updatedAt,
    limitations,
  };
}

export async function loadAutonomousAlertPolicyState(): Promise<AutonomousAlertPolicyState> {
  const row = prisma.orchestratorSetting?.findUnique
    ? await prisma.orchestratorSetting.findUnique({
        where: { key: AUTONOMOUS_ALERT_POLICY_SETTING_KEY },
      }).catch(() => null)
    : null;

  if (!row?.value) {
    return buildState(DEFAULT_AUTONOMOUS_ALERT_POLICY, 'default', row?.updatedAt?.toISOString?.() ?? null, [
      'Using default autonomous alert policy settings.',
    ]);
  }

  const raw = safeParse(row.value);
  const config = getAutonomousAlertPolicyConfig(raw);
  return buildState(config, 'persisted', row.updatedAt.toISOString(), []);
}

export async function saveAutonomousAlertPolicyState(
  input: Partial<AutonomousAlertPolicyConfig>,
): Promise<AutonomousAlertPolicyState> {
  const merged = normalizeAutonomousAlertPolicyConfig({
    ...DEFAULT_AUTONOMOUS_ALERT_POLICY,
    ...input,
    severityCooldownHours: {
      ...DEFAULT_AUTONOMOUS_ALERT_POLICY.severityCooldownHours,
      ...(input.severityCooldownHours ?? {}),
    },
    jobCooldownOverrides: {
      ...DEFAULT_AUTONOMOUS_ALERT_POLICY.jobCooldownOverrides,
      ...(input.jobCooldownOverrides ?? {}),
    },
  });

  if (prisma.orchestratorSetting?.upsert) {
    await prisma.orchestratorSetting.upsert({
      where: { key: AUTONOMOUS_ALERT_POLICY_SETTING_KEY },
      create: {
        key: AUTONOMOUS_ALERT_POLICY_SETTING_KEY,
        value: JSON.stringify(merged),
      },
      update: {
        value: JSON.stringify(merged),
      },
    }).catch(() => null);
  }

  return buildState(merged, 'persisted', new Date().toISOString(), []);
}

export async function resetAutonomousAlertPolicyState(): Promise<AutonomousAlertPolicyState> {
  if (prisma.orchestratorSetting?.delete) {
    await prisma.orchestratorSetting.delete({
      where: { key: AUTONOMOUS_ALERT_POLICY_SETTING_KEY },
    }).catch(() => null);
  }

  return buildState(DEFAULT_AUTONOMOUS_ALERT_POLICY, 'default', null, [
    'Policy reset to defaults.',
  ]);
}
