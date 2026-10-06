import { NextResponse } from 'next/server';
import { listOrchestratorRuns, runOrchestratorNow } from '@/lib/agent-orchestrator/service';

type RunTarget = 'planner' | 'worker' | 'both';

function normalizeTarget(value: unknown): RunTarget {
  if (value === 'planner' || value === 'worker' || value === 'both') {
    return value;
  }
  return 'both';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const target = normalizeTarget(body?.target);
    const result = await runOrchestratorNow(target);

    // The tick runs synchronously — the run record is already stored.
    // Find the most recent run that matches the primary runner so the UI
    // can poll run-status with the correct request_id (runId).
    const primaryRunner = target === 'worker' ? 'worker' : 'planner';
    const runs = await listOrchestratorRuns(5);
    const latestRun = runs.find((r) => r.tickType === primaryRunner);
    const request_id = latestRun?.runId ?? `${primaryRunner}-${Date.now()}`;

    return NextResponse.json({ ok: true, target, result, request_id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
