import { NextResponse } from 'next/server';
import { updateOrchestratorScheduler } from '@/lib/agent-orchestrator/service';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.enabled !== 'boolean') {
      return NextResponse.json({ ok: false, error: '`enabled` must be boolean' }, { status: 400 });
    }

    const state = await updateOrchestratorScheduler(body.enabled);
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
