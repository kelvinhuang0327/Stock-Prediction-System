import { NextResponse } from 'next/server';
import { ResolveTimeDistributionService } from '@/lib/jobs/ResolveTimeDistributionService';

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
    const service = new ResolveTimeDistributionService();
    const result = await service.build(jobName, days, new Date());

    return NextResponse.json({
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Job alert resolve distribution failed:', error);
    return NextResponse.json(
      {
        jobName: null,
        days: 30,
        families: [],
        overallSummary: 'No resolve-time distribution data available.',
        limitations: ['Failed to load resolve-time distribution.'],
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
