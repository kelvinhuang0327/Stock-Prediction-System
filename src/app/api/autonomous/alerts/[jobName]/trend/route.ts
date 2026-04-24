import { NextResponse } from 'next/server';
import { JobAlertTrendService } from '@/lib/jobs/JobAlertTrendService';

function parseWindow(value: string | null): '7d' | '14d' | '30d' {
  if (value === '7d' || value === '14d' || value === '30d') return value;
  return '14d';
}

function parseBucket(value: string | null): 'day' | 'week' {
  if (value === 'day' || value === 'week') return value;
  return 'day';
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobName: string }> },
) {
  try {
    const { jobName } = await context.params;
    const url = new URL(request.url);
    const window = parseWindow(url.searchParams.get('window'));
    const bucket = parseBucket(url.searchParams.get('bucket'));
    const service = new JobAlertTrendService();
    const result = await service.build(jobName, window, bucket, new Date());

    return NextResponse.json({
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Job alert trend failed:', error);
    return NextResponse.json(
      {
        jobName: null,
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
        limitations: ['Failed to load job alert trend.'],
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
