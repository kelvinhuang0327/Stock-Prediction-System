import { NextResponse } from 'next/server';
import { PolicyAuditChartService } from '@/lib/jobs/PolicyAuditChartService';

function toInt(value: string | null): number | undefined {
  if (value == null) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toWindowDays(value: string | null): 7 | 14 | 30 | undefined {
  if (value === '7') return 7;
  if (value === '14') return 14;
  if (value === '30') return 30;
  return undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const service = new PolicyAuditChartService();
    const result = await service.build({
      changeId: toInt(url.searchParams.get('changeId')),
      windowDays: toWindowDays(url.searchParams.get('windowDays')),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to build autonomous alert policy audit chart:', error);
    return NextResponse.json(
      {
        error: 'Failed to build autonomous alert policy audit chart',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
