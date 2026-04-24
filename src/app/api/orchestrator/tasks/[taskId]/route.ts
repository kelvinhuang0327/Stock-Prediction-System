import { NextResponse } from 'next/server';
import { getOrchestratorTaskDetail } from '@/lib/agent-orchestrator/service';

interface Params {
  params: Promise<{ taskId: string }>;
}

export async function GET(_: Request, { params }: Params) {
  try {
    const resolved = await params;
    const taskId = Number(resolved.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid taskId' }, { status: 400 });
    }

    const detail = await getOrchestratorTaskDetail(taskId);
    if (!detail) {
      return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
