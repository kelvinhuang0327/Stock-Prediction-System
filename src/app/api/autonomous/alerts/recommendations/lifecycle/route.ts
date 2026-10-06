import { NextResponse } from 'next/server';
import { RecommendationLifecycleService } from '@/lib/jobs/RecommendationLifecycleService';
import type { PolicyRecommendationType } from '@/lib/jobs/PolicyRecommendationEngine';
import type { RecommendationHistoryStatus } from '@/lib/jobs/RecommendationHistoryService';

function parseString(value: string | null): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseStatus(value: string | null): RecommendationHistoryStatus | 'all' {
  const parsed = parseString(value);
  return parsed === 'active' || parsed === 'resolved' || parsed === 'stale' || parsed === 'all' ? parsed : 'all';
}

function parseRecommendationType(value: string | null): PolicyRecommendationType | undefined {
  const parsed = parseString(value);
  if (!parsed) return undefined;
  return parsed as PolicyRecommendationType;
}

function parseNumber(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const service = new RecommendationLifecycleService();

  try {
    const result = await service.build(
      {
        recommendationKey: parseString(url.searchParams.get('recommendationKey')),
        recommendationType: parseRecommendationType(url.searchParams.get('recommendationType')),
        targetJob: parseString(url.searchParams.get('targetJob')),
        status: parseStatus(url.searchParams.get('status')),
        limit: parseNumber(url.searchParams.get('limit'), 10),
      },
      new Date(),
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build recommendation lifecycle.';
    return NextResponse.json(
      {
        recommendationKey: null,
        recommendationType: null,
        targetJob: null,
        status: 'all',
        recommendations: [],
        summary: {
          total: 0,
          active: 0,
          resolved: 0,
          stale: 0,
          recurring: 0,
          resolvedCycles: 0,
          reoccurCount: 0,
          avgOccurrences: 0,
          topRecommendationKey: null,
        },
        limitations: [message],
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
