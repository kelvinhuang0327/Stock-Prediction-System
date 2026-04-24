import { NextResponse } from 'next/server';
import { getOrchestratorSummary } from '@/lib/agent-orchestrator/service';

export async function GET() {
  try {
    const summary = await getOrchestratorSummary();
    // Spread fields at top level so the UI can read summary.nextPlannerRunAt directly
    return NextResponse.json({ ok: true, ...summary, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
