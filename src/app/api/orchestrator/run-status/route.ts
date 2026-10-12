import { NextRequest, NextResponse } from 'next/server';
import { listOrchestratorRuns } from '@/lib/agent-orchestrator/service';

/**
 * GET /api/orchestrator/run-status?runner=planner&request_id=<uuid>
 * Polls the run store for the outcome of a specific request_id (run-now trigger).
 * Returns { final: boolean, run: RunRecord | null }
 * Mirrors LotteryNew /api/orchestrator/run-status
 */
export async function GET(request: NextRequest) {
  try {
    const runner     = request.nextUrl.searchParams.get('runner') ?? '';
    const requestId  = request.nextUrl.searchParams.get('request_id') ?? '';

    if (!requestId || requestId.trim() === '') {
      return NextResponse.json({ ok: false, error: 'request_id is required' }, { status: 400 });
    }

    const runs = await listOrchestratorRuns(100);

    // Find the run matching the request – in the TARGET system runs store a runId
    // that equals the request_id emitted by run-now when triggered manually.
    const matched = runs.find((r) => {
      const tickMatch = !runner || r.tickType === runner;
      const idMatch   = !requestId || r.runId === requestId;
      return tickMatch && idMatch;
    });

    if (!matched) {
      return NextResponse.json({ ok: true, final: false, run: null });
    }

    // In the synchronous execution model every stored run is already finished
    const isFinal = matched.finishedAt != null;

    // Map to the shape the UI expects (mirrors LotteryNew run row shape)
    let outcome: string;
    if (matched.status === 'success') outcome = 'NEW_TASK';
    else if (matched.status === 'skipped') outcome = 'SKIPPED';
    else outcome = 'FAILED';

    const run = {
      request_id: matched.runId,
      runner:     matched.tickType,
      outcome,
      task_id:    matched.taskId ?? null,
      tick_at:    matched.startedAt,
      message:    matched.reason,
    };

    return NextResponse.json({ ok: true, final: isFinal, run });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
