import { NextRequest, NextResponse } from 'next/server';
import { getCtoRunById, listCtoRuns } from '@/lib/agent-orchestrator/ctoReviewTick';

// Terminal outcomes for CTO runs
const CTO_TERMINAL_OUTCOMES = new Set([
  'CTO_REVIEW_COMPLETED',
  'CTO_REVIEW_NO_CANDIDATES',
  'CTO_REVIEW_ERROR',
  'CTO_REVIEW_STALE',
  'CTO_REVIEW_SKIP_EXHAUSTED',
  'CTO_REVIEW_SKIP_COOLDOWN',
]);

function mapCtoOutcome(run: { completedAt: Date | null; candidateCount: number; summary: string | null }): string {
  if (!run.completedAt) return 'RUNNING';
  if (run.candidateCount === 0) return 'CTO_REVIEW_NO_CANDIDATES';
  if (run.summary?.toLowerCase().includes('error')) return 'CTO_REVIEW_ERROR';
  return 'CTO_REVIEW_COMPLETED';
}

/**
 * GET /api/orchestrator/cto/run-status?request_id=<runId>
 * Polls the result of a CTO run triggered via /cto/run-now.
 */
export async function GET(request: NextRequest) {
  try {
    const requestId = request.nextUrl.searchParams.get('request_id') ?? '';

    if (!requestId.trim()) {
      return NextResponse.json({ ok: false, error: 'request_id is required' }, { status: 400 });
    }

    // Try direct lookup first, then scan recent runs
    let run = await getCtoRunById(requestId).catch(() => null);
    if (!run) {
      const recents = await listCtoRuns(50);
      run = recents.find((r) => r.runId === requestId) ?? null;
    }

    if (!run) {
      return NextResponse.json({ ok: true, status: 'PENDING', final: false, run: null });
    }

    const outcome = mapCtoOutcome(run);
    const isFinal = !!run.completedAt && CTO_TERMINAL_OUTCOMES.has(outcome);
    const statusLabel = run.completedAt ? 'FINAL' : 'RUNNING';

    return NextResponse.json({
      ok: true,
      status: statusLabel,
      final:  isFinal,
      run: {
        run_id:          run.runId,
        started_at:      run.startedAt?.toISOString?.() ?? null,
        completed_at:    run.completedAt?.toISOString?.() ?? null,
        outcome,
        candidate_count: run.candidateCount,
        approved_count:  run.acceptedCount,
        rejected_count:  run.rejectedCount,
        summary:         run.summary ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
