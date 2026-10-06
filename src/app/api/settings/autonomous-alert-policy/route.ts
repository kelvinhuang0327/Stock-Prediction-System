import { NextResponse } from 'next/server';
import {
  loadAutonomousAlertPolicyState,
  resetAutonomousAlertPolicyState,
  saveAutonomousAlertPolicyState,
} from '@/lib/jobs/AutonomousAlertPolicyStore';
import { PolicyChangeHistoryService } from '@/lib/jobs/PolicyChangeHistoryService';
import { PolicyGuardrailService } from '@/lib/jobs/PolicyGuardrailService';
import { PolicyRecommendationEngine } from '@/lib/jobs/PolicyRecommendationEngine';
import { PolicyRollbackHintService } from '@/lib/jobs/PolicyRollbackHintService';
import { RecommendationPolicyExplanationService } from '@/lib/jobs/RecommendationPolicyExplanationService';
import type { AutonomousAlertPolicyConfig } from '@/lib/jobs/AutonomousAlertPolicyConfig';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function normalizeProposedPolicy(
  current: AutonomousAlertPolicyConfig,
  proposed: Partial<AutonomousAlertPolicyConfig>,
): AutonomousAlertPolicyConfig {
  return {
    severityCooldownHours: {
      critical: proposed.severityCooldownHours?.critical ?? current.severityCooldownHours.critical,
      warning: proposed.severityCooldownHours?.warning ?? current.severityCooldownHours.warning,
      info: proposed.severityCooldownHours?.info ?? current.severityCooldownHours.info,
    },
    jobCooldownOverrides: {
      ...current.jobCooldownOverrides,
      ...(proposed.jobCooldownOverrides ?? {}),
    },
    infoNotificationEnabled: proposed.infoNotificationEnabled ?? current.infoNotificationEnabled,
    escalationEnabled: proposed.escalationEnabled ?? current.escalationEnabled,
    recoveryResetEnabled: proposed.recoveryResetEnabled ?? current.recoveryResetEnabled,
  };
}

async function buildGuardrailsForChange(
  previous: Awaited<ReturnType<typeof loadAutonomousAlertPolicyState>>,
  proposedState: Awaited<ReturnType<typeof saveAutonomousAlertPolicyState>>,
): Promise<Awaited<ReturnType<PolicyGuardrailService['build']>>> {
  const now = new Date();
  const [recommendations, rollbackHints, explanations] = await Promise.all([
    new PolicyRecommendationEngine().build({ limit: 5, now }).catch(() => null),
    new PolicyRollbackHintService().build({ limit: 3, now }).catch(() => null),
    new RecommendationPolicyExplanationService().build({ limit: 3, now }).catch(() => null),
  ]);

  return new PolicyGuardrailService().build({
    currentPolicy: previous,
    proposedPolicy: normalizeProposedPolicy(previous.config, proposedState.config),
    currentRecommendations: recommendations,
    rollbackHints,
    policyExplanations: explanations,
    now,
  });
}

export async function GET() {
  try {
    const state = await loadAutonomousAlertPolicyState();
    return NextResponse.json({
      ...state,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to load autonomous alert policy:', error);
    return NextResponse.json(
      {
        error: 'Failed to load autonomous alert policy',
        details: toErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const previous = await loadAutonomousAlertPolicyState();
    const body = await request.json().catch(() => ({}));
    const state = await saveAutonomousAlertPolicyState(body ?? {});
    const guardrails = await buildGuardrailsForChange(previous, state);
    const auditService = new PolicyChangeHistoryService();
    await auditService.recordChange({
      oldState: previous,
      newState: state,
      changedBy: 'manual',
      reason: 'manual_settings_update',
      guardrails,
      metadata: {
        source: 'settings_ui',
        requestBodyKeys: Object.keys(body ?? {}),
      },
    });
    return NextResponse.json({
      ...state,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to save autonomous alert policy:', error);
    return NextResponse.json(
      {
        error: 'Failed to save autonomous alert policy',
        details: toErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const previous = await loadAutonomousAlertPolicyState();
    const state = await resetAutonomousAlertPolicyState();
    const guardrails = await buildGuardrailsForChange(previous, state);
    const auditService = new PolicyChangeHistoryService();
    await auditService.recordChange({
      oldState: previous,
      newState: state,
      changedBy: 'manual',
      reason: 'reset_to_default',
      guardrails,
      metadata: {
        source: 'settings_ui',
      },
    });
    return NextResponse.json({
      ...state,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to reset autonomous alert policy:', error);
    return NextResponse.json(
      {
        error: 'Failed to reset autonomous alert policy',
        details: toErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
