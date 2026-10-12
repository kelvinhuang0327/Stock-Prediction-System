import { NextResponse } from 'next/server';
import { loadAutonomousAlertPolicyState } from '@/lib/jobs/AutonomousAlertPolicyStore';
import { PolicyRecommendationEngine } from '@/lib/jobs/PolicyRecommendationEngine';
import { PolicyRollbackHintService } from '@/lib/jobs/PolicyRollbackHintService';
import { RecommendationPolicyExplanationService } from '@/lib/jobs/RecommendationPolicyExplanationService';
import { PolicyGuardrailService } from '@/lib/jobs/PolicyGuardrailService';
import { normalizeAutonomousAlertPolicyConfig, type AutonomousAlertPolicyConfig } from '@/lib/jobs/AutonomousAlertPolicyConfig';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function parseProposedPolicy(body: unknown, fallback: AutonomousAlertPolicyConfig): Partial<AutonomousAlertPolicyConfig> {
  if (!body || typeof body !== 'object') return fallback;
  const input = body as Record<string, unknown>;
  const policy = input.proposedPolicy ?? input.policy ?? input.config ?? input;
  if (!policy || typeof policy !== 'object') return fallback;
  return normalizeAutonomousAlertPolicyConfig({
    ...fallback,
    ...(policy as Partial<AutonomousAlertPolicyConfig>),
    severityCooldownHours: {
      ...fallback.severityCooldownHours,
      ...((policy as Partial<AutonomousAlertPolicyConfig>).severityCooldownHours ?? {}),
    },
    jobCooldownOverrides: {
      ...fallback.jobCooldownOverrides,
      ...((policy as Partial<AutonomousAlertPolicyConfig>).jobCooldownOverrides ?? {}),
    },
  });
}

export async function POST(request: Request) {
  try {
    const current = await loadAutonomousAlertPolicyState();
    const body = await request.json().catch(() => ({}));
    const proposedPolicy = parseProposedPolicy(body, current.config);
    const now = new Date();

    const [recommendations, rollbackHints, explanations] = await Promise.all([
      new PolicyRecommendationEngine().build({ limit: 5, now }).catch(() => null),
      new PolicyRollbackHintService().build({ limit: 3, now }).catch(() => null),
      new RecommendationPolicyExplanationService().build({ limit: 3, now }).catch(() => null),
    ]);

    const service = new PolicyGuardrailService();
    const result = await service.build({
      currentPolicy: current,
      proposedPolicy,
      currentRecommendations: recommendations,
      rollbackHints,
      policyExplanations: explanations,
      now,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to evaluate autonomous alert policy guardrails:', error);
    return NextResponse.json(
      {
        error: 'Failed to evaluate autonomous alert policy guardrails',
        details: toErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
