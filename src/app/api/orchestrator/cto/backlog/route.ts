import { NextResponse } from 'next/server';
import { getAllBacklogItems, insertBacklogItem, resolveBacklogItem, dismissBacklogItem } from '@/lib/agent-orchestrator/backlogService';
import type { BacklogCategory, BacklogSeverity, BacklogUrgency } from '@/lib/agent-orchestrator/ctoTypes';

export async function GET() {
  try {
    const items = await getAllBacklogItems();
    return NextResponse.json({ ok: true, items, count: items.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { findingId, action } = body as { findingId?: string; action?: string };

    if (!findingId || typeof findingId !== 'string') {
      return NextResponse.json({ ok: false, error: 'findingId required' }, { status: 400 });
    }

    if (action === 'resolve') {
      await resolveBacklogItem(findingId);
    } else if (action === 'dismiss') {
      await dismissBacklogItem(findingId);
    } else {
      return NextResponse.json({ ok: false, error: 'action must be resolve or dismiss' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, findingId, action });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/orchestrator/cto/backlog
 * Add a single finding to the backlog.
 * Body: { finding_id, cto_run_id, severity, impact_score, urgency, category, suggested_action }
 * Mirrors LotteryNew cto-backlog-add-btn handler.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const findingId      = (body.finding_id  ?? body.findingId)     as string | undefined;
    const ctoRunId       = (body.cto_run_id  ?? body.ctoRunId)      as string | undefined;
    const severity       = (body.severity    ?? 'MEDIUM')           as BacklogSeverity;
    const impactScore    = Number(body.impact_score ?? body.impactScore ?? 50);
    const urgency        = (body.urgency     ?? 'ROUTINE')          as BacklogUrgency;
    const category       = (body.category    ?? 'signal')           as BacklogCategory;
    const suggestedAction = (body.suggested_action ?? body.suggestedAction ?? null) as string | null;

    if (!findingId) {
      return NextResponse.json({ ok: false, error: 'finding_id required' }, { status: 400 });
    }

    const item = await insertBacklogItem({
      findingId,
      ctoRunId:       ctoRunId ?? undefined,
      source:         'review',
      severity,
      impactScore,
      urgency,
      category,
      suggestedAction: suggestedAction ?? undefined,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
