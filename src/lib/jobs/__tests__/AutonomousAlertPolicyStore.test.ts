import { prisma } from '@/lib/prisma';
import {
  AUTONOMOUS_ALERT_POLICY_SETTING_KEY,
  DEFAULT_AUTONOMOUS_ALERT_POLICY,
} from '../AutonomousAlertPolicyConfig';
import {
  loadAutonomousAlertPolicyState,
  resetAutonomousAlertPolicyState,
  saveAutonomousAlertPolicyState,
} from '../AutonomousAlertPolicyStore';

async function cleanup() {
  await prisma.systemSetting.deleteMany({
    where: { key: AUTONOMOUS_ALERT_POLICY_SETTING_KEY },
  });
}

describe('AutonomousAlertPolicyStore', () => {
  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  test('falls back to defaults when no setting exists', async () => {
    const state = await loadAutonomousAlertPolicyState();
    expect(state.source).toBe('default');
    expect(state.config.severityCooldownHours.critical).toBe(DEFAULT_AUTONOMOUS_ALERT_POLICY.severityCooldownHours.critical);
    expect(state.config.infoNotificationEnabled).toBe(DEFAULT_AUTONOMOUS_ALERT_POLICY.infoNotificationEnabled);
  });

  test('saves settings with guardrails and reloads them', async () => {
    const saved = await saveAutonomousAlertPolicyState({
      severityCooldownHours: {
        critical: 4,
        warning: 1,
        info: 0,
      },
      jobCooldownOverrides: {
        'autonomous:monitor': {
          critical: 0.1,
          warning: 0.2,
        },
      },
      infoNotificationEnabled: true,
      escalationEnabled: false,
      recoveryResetEnabled: false,
    });

    expect(saved.source).toBe('persisted');
    expect(saved.config.severityCooldownHours.critical).toBe(4);
    expect(saved.config.severityCooldownHours.warning).toBe(4);
    expect(saved.config.severityCooldownHours.info).toBe(0);
    expect(saved.config.jobCooldownOverrides['autonomous:monitor']?.critical).toBe(0.25);
    expect(saved.config.jobCooldownOverrides['autonomous:monitor']?.warning).toBe(0.25);
    expect(saved.config.infoNotificationEnabled).toBe(true);
    expect(saved.config.escalationEnabled).toBe(false);
    expect(saved.config.recoveryResetEnabled).toBe(false);

    const loaded = await loadAutonomousAlertPolicyState();
    expect(loaded.source).toBe('persisted');
    expect(loaded.config.severityCooldownHours.critical).toBe(4);
    expect(loaded.config.severityCooldownHours.warning).toBe(4);
    expect(loaded.config.infoNotificationEnabled).toBe(true);
  });

  test('resets settings to defaults', async () => {
    await saveAutonomousAlertPolicyState({
      infoNotificationEnabled: true,
    });

    const reset = await resetAutonomousAlertPolicyState();
    expect(reset.source).toBe('default');
    expect(reset.config).toEqual(DEFAULT_AUTONOMOUS_ALERT_POLICY);
    const loaded = await loadAutonomousAlertPolicyState();
    expect(loaded.source).toBe('default');
    expect(loaded.config).toEqual(DEFAULT_AUTONOMOUS_ALERT_POLICY);
  });
});
