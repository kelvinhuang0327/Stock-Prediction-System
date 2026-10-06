import { NextResponse } from 'next/server';
import { getPrioritizedBacklog } from '@/lib/agent-orchestrator/backlogService';
import { selectNextBatch, getExecutionPolicyMode, setExecutionPolicyMode } from '@/lib/agent-orchestrator/executionPolicy';
import type { ExecutionPolicyMode } from '@/lib/agent-orchestrator/ctoTypes';

const VALID_MODES: ExecutionPolicyMode[] = ['strict_priority', 'balanced', 'fairness'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const [items, mode] = await Promise.all([
      getPrioritizedBacklog(limit),
      getExecutionPolicyMode(),
    ]);
    return NextResponse.json({ ok: true, items, count: items.length, executionMode: mode });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, mode, batchSize } = body as {
      action?: string;
      mode?: string;
      batchSize?: number;
    };

    if (action === 'select') {
      const size = Math.min(Math.max(batchSize ?? 5, 1), 20);
      const selected = await selectNextBatch(size);
      return NextResponse.json({ ok: true, selected, count: selected.length });
    }

    if (action === 'set_mode') {
      if (!mode || !(VALID_MODES as string[]).includes(mode)) {
        return NextResponse.json({ ok: false, error: 'invalid mode' }, { status: 400 });
      }
      await setExecutionPolicyMode(mode as ExecutionPolicyMode);
      return NextResponse.json({ ok: true, mode });
    }

    return NextResponse.json({ ok: false, error: 'action must be select or set_mode' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
