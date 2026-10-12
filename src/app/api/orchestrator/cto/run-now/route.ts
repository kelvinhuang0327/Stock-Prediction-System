import { NextResponse } from 'next/server';
import { runCtoReviewTick } from '@/lib/agent-orchestrator/ctoReviewTick';
import type { CtoRunIntent } from '@/lib/agent-orchestrator/ctoTypes';

const VALID_INTENTS: CtoRunIntent[] = ['resubmit_proposal', 'compare_regimes', 'force_learning'];

function isValidIntent(v: unknown): v is CtoRunIntent {
  return typeof v === 'string' && (VALID_INTENTS as string[]).includes(v);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const runIntent = isValidIntent(body?.runIntent) ? body.runIntent : undefined;
    const parentRunId = typeof body?.parentRunId === 'string' ? body.parentRunId : undefined;

    const result = await runCtoReviewTick({
      isManual: true,
      runIntent,
      parentRunId,
    });

    // Return request_id so the UI trace panel can display the run outcome
    return NextResponse.json({ ok: true, result, request_id: result.runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
