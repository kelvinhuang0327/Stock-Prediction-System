import { NextRequest, NextResponse } from 'next/server';
import { listOrchestratorRuns } from '@/lib/agent-orchestrator/service';

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '100');
    const raw = await listOrchestratorRuns(limit);
    const runs = raw.map((r) => ({
      request_id: r.runId,
      runner:     r.tickType,
      outcome:    r.status === 'success' ? 'NEW_TASK'
                : r.status === 'skipped' ? 'SKIPPED'
                : 'FAILED',
      task_id:    r.taskId ?? null,
      tick_at:    r.startedAt,
      message:    r.reason,
    }));
    return NextResponse.json({ ok: true, runs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
