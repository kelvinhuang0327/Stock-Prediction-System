import { NextResponse } from 'next/server';
import { getCtoRunById } from '@/lib/agent-orchestrator/ctoReviewTick';
import { getAllBacklogItems } from '@/lib/agent-orchestrator/backlogService';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    const [run, allBacklog] = await Promise.all([
      getCtoRunById(runId),
      getAllBacklogItems(),
    ]);
    if (!run) {
      return NextResponse.json({ ok: false, error: 'run not found' }, { status: 404 });
    }

    // Parse candidates from reportJson to use as "reviews"
    let reviews: unknown[] = [];
    if (run.reportJson) {
      try {
        const parsed = JSON.parse(run.reportJson) as { candidates?: unknown[] };
        reviews = parsed.candidates ?? [];
      } catch { /* ignore */ }
    }

    // Annotate reviews with backlog status
    const backlogByFindingId = new Map(
      allBacklog.filter((b) => b.ctoRunId === runId).map((b) => [b.findingId, b]),
    );

    const annotatedReviews = (reviews as Array<Record<string, unknown>>).map((c) => {
      const findingId = `${runId}-${c.proposalId ?? c.symbol ?? ''}`;
      const bl = backlogByFindingId.get(findingId);
      return { ...c, finding_id: findingId, backlog_status: bl?.status ?? null };
    });

    return NextResponse.json({ ok: true, run, reviews: annotatedReviews });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
