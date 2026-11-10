/** @jest-environment node */

import {
  AUTONOMOUS_ALERT_POLICY_SETTING_KEY,
  DEFAULT_AUTONOMOUS_ALERT_POLICY,
  getAutonomousAlertPolicyConfig,
  getAutonomousAlertPolicySummary,
  type AutonomousAlertPolicyConfig,
} from '../AutonomousAlertPolicyConfig';
import type { AutonomousAlertPolicyState } from '../AutonomousAlertPolicyStore';
import { PolicyChangeHistoryService } from '../PolicyChangeHistoryService';

const mockCreate = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    policyChangeHistory: {
      create: (...args: unknown[]) => mockCreate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

interface HistoryRow {
  id: number;
  policyKey: string;
  changedAt: Date;
  changedBy: string;
  oldValue: string | null;
  newValue: string;
  changedFields: string;
  reason: string | null;
  guardrailCount: number;
  guardrailSummary: string | null;
  requiresConfirmation: boolean;
  guardrailDetails: string | null;
  highestGuardrailSeverity: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const changedAt = new Date('2026-03-03T04:05:06.000Z');

function policyState(
  config: AutonomousAlertPolicyConfig = getAutonomousAlertPolicyConfig(),
  source: 'default' | 'persisted' = 'persisted',
): AutonomousAlertPolicyState {
  return {
    source,
    config,
    summary: getAutonomousAlertPolicySummary(config),
    defaults: DEFAULT_AUTONOMOUS_ALERT_POLICY,
    updatedAt: '2026-03-02T00:00:00.000Z',
    limitations: [],
  };
}

function historyRow(overrides: Partial<HistoryRow> = {}): HistoryRow {
  return {
    id: 17,
    policyKey: AUTONOMOUS_ALERT_POLICY_SETTING_KEY,
    changedAt,
    changedBy: 'manual',
    oldValue: JSON.stringify(getAutonomousAlertPolicyConfig()),
    newValue: JSON.stringify(getAutonomousAlertPolicyConfig()),
    changedFields: '["escalationEnabled", 4, "severityCooldownHours.critical"]',
    reason: null,
    guardrailCount: 0,
    guardrailSummary: null,
    requiresConfirmation: false,
    guardrailDetails: '[]',
    highestGuardrailSeverity: null,
    metadata: null,
    createdAt: changedAt,
    updatedAt: changedAt,
    ...overrides,
  };
}

describe('PolicyChangeHistoryService', () => {
  const service = new PolicyChangeHistoryService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockImplementation(async ({ data }: { data: Partial<HistoryRow> }) => historyRow(data));
    mockFindUnique.mockResolvedValue(historyRow());
    mockFindMany.mockResolvedValue([]);
    mockFindFirst.mockResolvedValue(null);
  });

  it('skips unchanged policies unless the change explicitly resets to defaults', async () => {
    const state = policyState();
    await expect(service.recordChange({ oldState: state, newState: state })).resolves.toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();

    const reset = await service.recordChange({ oldState: state, newState: state, reason: 'reset_to_default' });
    expect(reset).toMatchObject({ changedFields: ['reset_to_default'], reason: 'reset_to_default' });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        changedBy: 'manual',
        oldValue: JSON.stringify(state.config),
        newValue: JSON.stringify(state.config),
        changedFields: '["reset_to_default"]',
        guardrailCount: 0,
        highestGuardrailSeverity: null,
      }),
    }));
  });

  it('records every changed policy field and guardrail metadata with the highest severity', async () => {
    const oldConfig = getAutonomousAlertPolicyConfig({
      jobCooldownOverrides: {
        existing: { critical: 1, warning: 2 },
        removed: { info: 3 },
      },
    });
    const newConfig = getAutonomousAlertPolicyConfig({
      severityCooldownHours: { critical: 4, warning: 12, info: 0 },
      jobCooldownOverrides: {
        existing: { critical: 4, info: 5 },
        added: { warning: 6 },
      },
      infoNotificationEnabled: true,
      escalationEnabled: false,
      recoveryResetEnabled: false,
    });
    const guardrails = {
      guardrails: [
        { severity: 'info' as const, ruleKey: 'i', title: 'Info', message: 'i', rationale: 'i', suggestedCheck: 'i' },
        { severity: 'warning' as const, ruleKey: 'w', title: 'Warning', message: 'w', rationale: 'w', suggestedCheck: 'w' },
        { severity: 'critical' as const, ruleKey: 'c', title: 'Critical', message: 'c', rationale: 'c', suggestedCheck: 'c' },
      ],
      summary: { total: 3, info: 1, warning: 1, critical: 1, requiresConfirmation: true },
      limitations: [],
      generatedAt: '2026-03-03T01:02:03.000Z',
    };
    const result = await service.recordChange({
      oldState: policyState(oldConfig, 'default'),
      newState: policyState(newConfig),
      changedBy: 'operator',
      reason: 'reviewed',
      changedAt,
      guardrails,
      metadata: { oldSource: 'overridden', ticket: 'OPS-14' },
    });

    expect(result).toMatchObject({
      changedBy: 'operator',
      reason: 'reviewed',
      changedFields: [
        'severityCooldownHours.critical',
        'infoNotificationEnabled',
        'escalationEnabled',
        'recoveryResetEnabled',
        'jobCooldownOverrides.existing.critical',
        'jobCooldownOverrides.existing.warning',
        'jobCooldownOverrides.existing.info',
        'jobCooldownOverrides.removed.info',
        'jobCooldownOverrides.added.warning',
      ],
      guardrailCount: 3,
      guardrailSummary: guardrails.summary,
      guardrailDetails: guardrails.guardrails,
      requiresConfirmation: true,
      highestGuardrailSeverity: 'critical',
      metadata: JSON.stringify({
        oldSource: 'overridden',
        newSource: 'persisted',
        oldUpdatedAt: '2026-03-02T00:00:00.000Z',
        newUpdatedAt: '2026-03-02T00:00:00.000Z',
        guardrailGeneratedAt: guardrails.generatedAt,
        ticket: 'OPS-14',
      }),
    });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        policyKey: AUTONOMOUS_ALERT_POLICY_SETTING_KEY,
        changedAt,
        changedFields: JSON.stringify(result?.changedFields),
        highestGuardrailSeverity: 'critical',
      }),
    }));
  });

  it('normalizes nullable values and serializes unsupported or cyclic metadata safely', async () => {
    const oldState = policyState();
    const newState = policyState(getAutonomousAlertPolicyConfig({ escalationEnabled: false }));
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const result = await service.recordChange({
      oldState,
      newState,
      reason: null,
      metadata: circular,
      changedBy: '',
    });

    expect(result?.changedBy).toBe('');
    expect(result?.reason).toBeNull();
    expect(result?.metadata).toBeNull();
    expect(result?.oldValue).toBe(JSON.stringify(oldState.config));
    expect(result?.highestGuardrailSeverity).toBeNull();
  });

  it('reads rows by id and returns null for invalid or missing ids', async () => {
    await expect(service.getChangeById(Number.NaN)).resolves.toBeNull();
    await expect(service.getChangeById(Number.POSITIVE_INFINITY)).resolves.toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();

    const found = await service.getChangeById(17);
    expect(found).toMatchObject({
      id: 17,
      changedAt: changedAt.toISOString(),
      changedFields: ['escalationEnabled', 'severityCooldownHours.critical'],
    });
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 17 } });

    mockFindUnique.mockResolvedValueOnce(null);
    await expect(service.getChangeById(18)).resolves.toBeNull();
  });

  it('lists changes with defaults, custom filters, and bounded pagination', async () => {
    mockFindMany.mockResolvedValueOnce([historyRow()]);
    await expect(service.listChanges()).resolves.toHaveLength(1);
    expect(mockFindMany).toHaveBeenLastCalledWith({
      where: { policyKey: AUTONOMOUS_ALERT_POLICY_SETTING_KEY },
      orderBy: [{ changedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
      skip: 0,
    });

    await service.listChanges({ policyKey: 'custom', limit: 0, offset: -4 });
    expect(mockFindMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { policyKey: 'custom' }, take: 1, skip: 0,
    }));

    await service.listChanges({ limit: 500, offset: 7 });
    expect(mockFindMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 100, skip: 7 }));
  });

  it('returns the latest change or null when history is empty', async () => {
    await expect(service.getLatestChange()).resolves.toBeNull();
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { policyKey: AUTONOMOUS_ALERT_POLICY_SETTING_KEY },
      orderBy: [{ changedAt: 'desc' }, { createdAt: 'desc' }],
    });

    mockFindFirst.mockResolvedValueOnce(historyRow({ highestGuardrailSeverity: 'warning' }));
    await expect(service.getLatestChange()).resolves.toMatchObject({ highestGuardrailSeverity: 'warning' });
  });

  it('tolerates malformed serialized columns while mapping database rows', async () => {
    mockFindUnique.mockResolvedValueOnce(historyRow({
      changedFields: '{broken',
      guardrailSummary: '{broken',
      guardrailDetails: '{broken',
      highestGuardrailSeverity: 'urgent',
      metadata: '{broken',
    }));

    await expect(service.getChangeById(17)).resolves.toMatchObject({
      changedFields: [],
      guardrailSummary: null,
      guardrailDetails: [],
      highestGuardrailSeverity: null,
      metadata: '{broken',
    });

    mockFindUnique.mockResolvedValueOnce(historyRow({
      changedFields: '["valid", 3, null]',
      guardrailSummary: '{"total":1}',
      guardrailDetails: '[{"ruleKey":"x"}]',
      highestGuardrailSeverity: 'info',
    }));
    await expect(service.getChangeById(17)).resolves.toMatchObject({
      changedFields: ['valid'],
      guardrailSummary: { total: 1 },
      guardrailDetails: [{ ruleKey: 'x' }],
      highestGuardrailSeverity: 'info',
    });
  });
});
