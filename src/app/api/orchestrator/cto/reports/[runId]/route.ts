import { NextRequest, NextResponse } from 'next/server';
import { getCtoRunById } from '@/lib/agent-orchestrator/ctoReviewTick';
import { getAllBacklogItems } from '@/lib/agent-orchestrator/backlogService';

/**
 * GET /api/orchestrator/cto/reports/[runId]
 * Returns intelligence panel data for a CTO run:
 * - reportJson: { signalState, candidates } from the run
 * - backlog items for the run
 * Mirrors LotteryNew /api/orchestrator/cto/reports/<runId>
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    const [run, allBacklog] = await Promise.all([
      getCtoRunById(runId),
      getAllBacklogItems(),
    ]);

    if (!run) {
      return NextResponse.json({ ok: false, error: 'Run not found' }, { status: 404 });
    }

    // Parse reportJson from the run
    let parsedReport: { signalState?: unknown; candidates?: unknown[] } = {};
    if (run.reportJson) {
      try {
        parsedReport = JSON.parse(run.reportJson);
      } catch {
        parsedReport = {};
      }
    }

    // Filter backlog items to just this run
    const runBacklog = allBacklog.filter((b) => b.ctoRunId === runId);

    // Build a map of findingId -> backlog item for quick lookup
    const backlogByFindingId = new Map(runBacklog.map((b) => [b.findingId, b]));

    // Build candidates with backlog annotation
    const candidates = Array.isArray(parsedReport.candidates)
      ? (parsedReport.candidates as Array<Record<string, unknown>>).map((c) => {
          const findingId = `${runId}-${c.proposalId ?? c.symbol ?? ''}`;
          const backlogItem = backlogByFindingId.get(findingId);
          return {
            ...c,
            finding_id:          findingId,
            backlog_status:      backlogItem?.status ?? null,
            backlog_priority:    backlogItem?.priorityLevel ?? null,
            backlog_id:          backlogItem?.findingId ?? null,
          };
        })
      : [];

    return NextResponse.json({
      ok: true,
      run: {
        runId:           run.runId,
        frequencyMode:   run.frequencyMode,
        startedAt:       run.startedAt,
        completedAt:     run.completedAt,
        durationSeconds: run.durationSeconds,
        candidateCount:  run.candidateCount,
        acceptedCount:   run.acceptedCount,
        rejectedCount:   run.rejectedCount,
        deferredCount:   run.deferredCount,
        reflectedCount:  run.reflectedCount,
        summary:         run.summary,
        isManual:        run.isManual,
        runIntent:       run.runIntent,
      },
      report_json: {
        signal_state: parsedReport.signalState ?? null,
        candidates,
        schema_version: 1,
      },
      backlog_items: runBacklog.map((b) => ({
        findingId:       b.findingId,
        status:          b.status,
        priorityLevel:   b.priorityLevel,
        category:        b.category,
        suggestedAction: b.suggestedAction,
        urgency:         b.urgency,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
