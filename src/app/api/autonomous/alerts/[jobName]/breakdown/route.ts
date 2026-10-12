import { NextResponse } from 'next/server';
import { NoisySourceBreakdownService } from '@/lib/jobs/NoisySourceBreakdownService';

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
    const service = new NoisySourceBreakdownService();
    const result = await service.build(jobName, days, new Date());

    return NextResponse.json({
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Job alert noisy source breakdown failed:', error);
    return NextResponse.json(
      {
        jobName: null,
        families: [],
        topFamily: null,
        summary: {
          jobName: '',
          totalAlerts: 0,
          totalOccurrences: 0,
          familyCount: 0,
          activeCount: 0,
          resolvedCount: 0,
          topFamily: null,
          topFamilyLabel: null,
          topFamilyShare: null,
          overallSummary: 'No noisy source breakdown data available.',
          source: 'empty',
        },
        limitations: ['Failed to load noisy source breakdown.'],
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
