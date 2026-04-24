import { prisma } from '@/lib/prisma';
import {
  AUTONOMOUS_ALERT_POLICY_SETTING_KEY,
  type AutonomousAlertPolicyConfig,
} from './AutonomousAlertPolicyConfig';
import type { AutonomousAlertPolicyState } from './AutonomousAlertPolicyStore';
import type {
  PolicyGuardrailRow,
  PolicyGuardrailResult,
  PolicyGuardrailSummary,
  PolicyGuardrailSeverity,
} from './PolicyGuardrailService';

export interface PolicyChangeHistoryRecord {
  id: number;
  policyKey: string;
  changedAt: string;
  changedBy: string;
  oldValue: string | null;
  newValue: string;
  changedFields: string[];
  reason: string | null;
  guardrailCount: number;
  guardrailSummary: PolicyGuardrailSummary | null;
  requiresConfirmation: boolean;
  guardrailDetails: PolicyGuardrailRow[];
  highestGuardrailSeverity: PolicyGuardrailSeverity | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyChangeHistoryInput {
  oldState: AutonomousAlertPolicyState;
  newState: AutonomousAlertPolicyState;
  changedBy?: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  guardrails?: PolicyGuardrailResult | null;
  changedAt?: Date;
}

export interface PolicyChangeHistoryFilter {
  policyKey?: string;
  limit?: number;
  offset?: number;
}

function safeStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function safeParseList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function safeParseRows<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function toRecord(row: {
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
}): PolicyChangeHistoryRecord {
  return {
    id: row.id,
    policyKey: row.policyKey,
    changedAt: row.changedAt.toISOString(),
    changedBy: row.changedBy,
    oldValue: row.oldValue,
    newValue: row.newValue,
    changedFields: safeParseList(row.changedFields),
    reason: row.reason,
    guardrailCount: row.guardrailCount,
    guardrailSummary: safeParseObject<PolicyGuardrailSummary>(row.guardrailSummary),
    requiresConfirmation: row.requiresConfirmation,
    guardrailDetails: safeParseRows<PolicyGuardrailRow>(row.guardrailDetails),
    highestGuardrailSeverity: safeParseSeverity(row.highestGuardrailSeverity),
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function safeParseObject<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function safeParseSeverity(value: string | null): PolicyGuardrailSeverity | null {
  if (value === 'info' || value === 'warning' || value === 'critical') return value;
  return null;
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : safeStringify(value);
}

function flattenChangedFields(oldConfig: AutonomousAlertPolicyConfig, newConfig: AutonomousAlertPolicyConfig): string[] {
  const changes = new Set<string>();

  for (const severity of ['critical', 'warning', 'info'] as const) {
    if (oldConfig.severityCooldownHours[severity] !== newConfig.severityCooldownHours[severity]) {
      changes.add(`severityCooldownHours.${severity}`);
    }
  }

  for (const field of ['infoNotificationEnabled', 'escalationEnabled', 'recoveryResetEnabled'] as const) {
    if (oldConfig[field] !== newConfig[field]) {
      changes.add(field);
    }
  }

  const jobNames = new Set([
    ...Object.keys(oldConfig.jobCooldownOverrides ?? {}),
    ...Object.keys(newConfig.jobCooldownOverrides ?? {}),
  ]);
  for (const jobName of jobNames) {
    const oldOverrides = oldConfig.jobCooldownOverrides?.[jobName] ?? {};
    const newOverrides = newConfig.jobCooldownOverrides?.[jobName] ?? {};
    for (const severity of ['critical', 'warning', 'info'] as const) {
      if (oldOverrides[severity] !== newOverrides[severity]) {
        changes.add(`jobCooldownOverrides.${jobName}.${severity}`);
      }
    }
  }

  return [...changes];
}

export class PolicyChangeHistoryService {
  async recordChange(input: PolicyChangeHistoryInput): Promise<PolicyChangeHistoryRecord | null> {
    const changedFields = flattenChangedFields(input.oldState.config, input.newState.config);
    const isReset = input.reason === 'reset_to_default';
    const guardrails = input.guardrails ?? {
      guardrails: [],
      summary: {
        total: 0,
        info: 0,
        warning: 0,
        critical: 0,
        requiresConfirmation: false,
      },
      limitations: [],
      generatedAt: new Date().toISOString(),
    };

    if (!isReset && changedFields.length === 0) {
      return null;
    }

    const row = await prisma.policyChangeHistory.create({
      data: {
        policyKey: AUTONOMOUS_ALERT_POLICY_SETTING_KEY,
        changedAt: input.changedAt ?? new Date(),
        changedBy: input.changedBy ?? 'manual',
        oldValue: normalizeString(input.oldState.config),
        newValue: normalizeString(input.newState.config) ?? '{}',
        changedFields: safeStringify(isReset && changedFields.length === 0 ? ['reset_to_default'] : changedFields) ?? '[]',
        reason: input.reason ?? null,
        guardrailCount: guardrails.guardrails.length,
        guardrailSummary: safeStringify(guardrails.summary),
        requiresConfirmation: guardrails.summary.requiresConfirmation,
        guardrailDetails: safeStringify(guardrails.guardrails),
        highestGuardrailSeverity:
          guardrails.guardrails.length > 0
            ? guardrails.guardrails.reduce<PolicyGuardrailSeverity>((current, row) => {
                const order: Record<PolicyGuardrailSeverity, number> = { info: 1, warning: 2, critical: 3 };
                return order[row.severity] > order[current] ? row.severity : current;
              }, 'info')
            : null,
        metadata: safeStringify({
          oldSource: input.oldState.source,
          newSource: input.newState.source,
          oldUpdatedAt: input.oldState.updatedAt,
          newUpdatedAt: input.newState.updatedAt,
          guardrailGeneratedAt: guardrails.generatedAt,
          ...(input.metadata ?? {}),
        }),
      },
    });

    return toRecord(row);
  }

  async getChangeById(id: number): Promise<PolicyChangeHistoryRecord | null> {
    if (!Number.isFinite(id)) return null;

    const row = await prisma.policyChangeHistory.findUnique({
      where: { id },
    });

    return row ? toRecord(row) : null;
  }

  async listChanges(filter: PolicyChangeHistoryFilter = {}): Promise<PolicyChangeHistoryRecord[]> {
    const rows = await prisma.policyChangeHistory.findMany({
      where: {
        policyKey: filter.policyKey ?? AUTONOMOUS_ALERT_POLICY_SETTING_KEY,
      },
      orderBy: [{ changedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.max(1, Math.min(100, filter.limit ?? 20)),
      skip: Math.max(0, filter.offset ?? 0),
    });

    return rows.map(toRecord);
  }

  async getLatestChange(): Promise<PolicyChangeHistoryRecord | null> {
    const row = await prisma.policyChangeHistory.findFirst({
      where: { policyKey: AUTONOMOUS_ALERT_POLICY_SETTING_KEY },
      orderBy: [{ changedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return row ? toRecord(row) : null;
  }
}
