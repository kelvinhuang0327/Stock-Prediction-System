import { NextResponse } from 'next/server';
import { RecommendationHistoryService } from '@/lib/jobs/RecommendationHistoryService';

function parseOptionalString(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseStatus(value: string | null): 'active' | 'resolved' | 'stale' | 'all' | undefined {
  const parsed = parseOptionalString(value);
  if (!parsed) return undefined;
  return parsed === 'active' || parsed === 'resolved' || parsed === 'stale' || parsed === 'all' ? parsed : undefined;
}

function parseNumber(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseSort(value: string | null): 'latest' | 'occurrenceCount' | 'firstDetectedAt' | undefined {
  const parsed = parseOptionalString(value);
  if (!parsed) return undefined;
  return parsed === 'latest' || parsed === 'occurrenceCount' || parsed === 'firstDetectedAt' ? parsed : undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobName = parseOptionalString(url.searchParams.get('jobName'));
    const recommendationType = parseOptionalString(url.searchParams.get('recommendationType')) as
      | 'cooldown_increase'
      | 'cooldown_decrease'
      | 'review_monitor_frequency'
      | 'review_scheduler_reliability'
      | 'consider_severity_escalation'
      | 'consider_severity_downgrade'
      | 'no_change_recommended'
      | undefined;
    const status = parseStatus(url.searchParams.get('status'));
    const limit = parseNumber(url.searchParams.get('limit'), 50);
    const offset = parseNumber(url.searchParams.get('offset'), 0);
    const sortBy = parseSort(url.searchParams.get('sort'));
    const sortDir = url.searchParams.get('direction') === 'asc' ? 'asc' : 'desc';
    const service = new RecommendationHistoryService();

    const recommendations = await service.listHistory({
      jobName,
      recommendationType,
      status,
      limit,
      offset,
      sortBy,
      sortDir,
    });
    const summary = await service.buildSummary({ jobName, recommendationType, status });

    return NextResponse.json({
      recommendations,
      summary,
      generatedAt: new Date().toISOString(),
      limitations: recommendations.length === 0 ? ['No recommendation history was found for the selected filters.'] : [],
    });
  } catch (error) {
    console.error('Recommendation history load failed:', error);
    return NextResponse.json(
      {
        recommendations: [],
        summary: {
          total: 0,
          active: 0,
          resolved: 0,
          stale: 0,
          critical: 0,
          warning: 0,
          info: 0,
          topJobs: [],
          topTypes: [],
          recurringRecommendations: [],
          recentResolvedRecommendations: [],
        },
        generatedAt: new Date().toISOString(),
        limitations: ['Failed to load recommendation history.'],
      },
      { status: 200 },
    );
  }
}
