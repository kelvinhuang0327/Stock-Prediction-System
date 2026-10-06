import { NextResponse } from 'next/server';
import { RecommendationTrendService, type RecommendationTrendBucket, type RecommendationTrendWindow } from '@/lib/jobs/RecommendationTrendService';
import type { PolicyRecommendationType } from '@/lib/jobs/PolicyRecommendationEngine';
import type { RecommendationHistoryStatus } from '@/lib/jobs/RecommendationHistoryService';

function parseString(value: string | null): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseWindow(value: string | null): RecommendationTrendWindow {
  const parsed = parseString(value);
  return parsed === '7d' || parsed === '14d' || parsed === '30d' ? parsed : '14d';
}

function parseBucket(value: string | null): RecommendationTrendBucket {
  const parsed = parseString(value);
  return parsed === 'day' || parsed === 'week' ? parsed : 'day';
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const service = new RecommendationTrendService();

  try {
    const result = await service.build(
      {
        recommendationType: parseRecommendationType(url.searchParams.get('recommendationType')),
        targetJob: parseString(url.searchParams.get('targetJob')),
        status: parseStatus(url.searchParams.get('status')),
      },
      parseWindow(url.searchParams.get('window')),
      parseBucket(url.searchParams.get('bucket')),
      new Date(),
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build recommendation trend.';
    return NextResponse.json(
      {
        recommendationType: null,
        targetJob: null,
        status: 'all',
        window: '14d',
        bucket: 'day',
        buckets: [],
        summary: {
          trendDirection: 'insufficient',
          totalOccurrences: 0,
          totalResolved: 0,
          avgPerBucket: 0,
          peakBucket: 0,
          bucketCount: 0,
          windowDays: 14,
          bucketSizeDays: 1,
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
        },
        limitations: [message],
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
