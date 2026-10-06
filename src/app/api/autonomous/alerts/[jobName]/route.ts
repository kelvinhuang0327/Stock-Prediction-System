import { NextResponse } from 'next/server';
import { JobAlertDrilldownService } from '@/lib/jobs/JobAlertDrilldownService';

function parseNumber(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobName: string }> },
) {
  try {
    const { jobName } = await context.params;
    const url = new URL(request.url);
    const days = parseNumber(url.searchParams.get('days'), 30);
    const service = new JobAlertDrilldownService();
    const result = await service.build(jobName, days, new Date());

    return NextResponse.json({
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Job alert drilldown failed:', error);
    return NextResponse.json(
      {
        jobName: null,
        summary: {
          jobName: '',
          activeAlertsCount: 0,
          resolvedAlertsCount: 0,
          totalOccurrences: 0,
          latestAlertStatus: 'unknown',
          severityDistribution: { critical: 0, warning: 0, info: 0 },
          recentReoccurCount: 0,
          recentResolvedCount: 0,
          averageHoursToResolve: null,
          mostCommonAlertMessage: null,
          summaryNote: 'No alert drill-down data available.',
        },
        timeline: [],
        recentAlerts: [],
        recentRecoveryEvents: [],
        limitations: ['Failed to load job alert drill-down.'],
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
