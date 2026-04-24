import { NextResponse } from 'next/server';
import { listCtoRuns } from '@/lib/agent-orchestrator/ctoReviewTick';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const date   = searchParams.get('date')   ?? undefined;   // YYYYMMDD filter
    const status = searchParams.get('status') ?? undefined;   // 'manual'|'scheduled'

    let runs = await listCtoRuns(limit);

    if (date) {
      runs = runs.filter((r) => {
        const d = new Date(r.startedAt);
        const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        return ymd === date;
      });
    }
    if (status) {
      runs = runs.filter((r) => r.frequencyMode === status);
    }

    return NextResponse.json({ ok: true, runs, count: runs.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
