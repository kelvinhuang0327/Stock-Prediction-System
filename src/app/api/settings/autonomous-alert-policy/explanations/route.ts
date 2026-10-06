import { NextResponse } from 'next/server';
import {
  RecommendationPolicyExplanationService,
  type RecommendationPolicyExplanationResult,
} from '@/lib/jobs/RecommendationPolicyExplanationService';
import type { PolicyRecommendationType } from '@/lib/jobs/PolicyRecommendationEngine';

function isPolicyRecommendationType(value: string | null): value is PolicyRecommendationType {
  return (
    value === 'cooldown_increase' ||
    value === 'cooldown_decrease' ||
    value === 'review_monitor_frequency' ||
    value === 'review_scheduler_reliability' ||
    value === 'consider_severity_escalation' ||
    value === 'consider_severity_downgrade' ||
    value === 'no_change_recommended'
  );
}

function toInt(value: string | null): number | undefined {
  if (value == null) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobName = url.searchParams.get('jobName') || undefined;
    const recommendationTypeParam = url.searchParams.get('recommendationType');
    const recommendationType = isPolicyRecommendationType(recommendationTypeParam)
      ? recommendationTypeParam
      : undefined;
    const limit = toInt(url.searchParams.get('limit'));

    const service = new RecommendationPolicyExplanationService();
    const result = await service.build({
      jobName,
      recommendationType,
      limit,
    });

    return NextResponse.json<RecommendationPolicyExplanationResult>(result);
  } catch (error) {
    console.error('Failed to build recommendation policy explanations:', error);
    return NextResponse.json(
      {
        error: 'Failed to build recommendation policy explanations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
