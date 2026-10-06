import { NextRequest, NextResponse } from 'next/server';
import nodeFs from 'node:fs/promises';
import { listOrchestratorTasks } from '@/lib/agent-orchestrator/service';
import { isTerminalTaskStatus } from '@/lib/agent-orchestrator/types';
import type { TaskResult } from '@/lib/agent-orchestrator/types';

async function readChangedFilesCount(resultPath: string | null): Promise<number | null> {
  if (!resultPath) return null;
  try {
    const raw = await nodeFs.readFile(resultPath, 'utf-8');
    const result = JSON.parse(raw) as TaskResult;
    return Array.isArray(result.changed_files) ? result.changed_files.length : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const page     = Number(request.nextUrl.searchParams.get('page')     ?? '1');
    const pageSize = Number(request.nextUrl.searchParams.get('pageSize') ?? request.nextUrl.searchParams.get('page_size') ?? '20');
    const date     = request.nextUrl.searchParams.get('date')    ?? undefined;   // YYYYMMDD
    const status   = request.nextUrl.searchParams.get('status')  ?? undefined;

    const tasks = await listOrchestratorTasks({ page, pageSize, date, status });

    // Enrich with derived fields the UI expects
    const enriched = await Promise.all(
      tasks.rows.map(async (t) => {
        const isTerminal = isTerminalTaskStatus(t.status);
        const createdMs  = Date.parse(t.createdAt);
        const updatedMs  = Date.parse(t.updatedAt);
        const durationMs = isTerminal && Number.isFinite(createdMs) && Number.isFinite(updatedMs)
          ? updatedMs - createdMs
          : null;
        const completedAt   = t.status === 'COMPLETED' ? t.updatedAt : null;
        const changedFilesCount = isTerminal ? await readChangedFilesCount(t.resultPath ?? null) : null;
        return { ...t, durationMs, completedAt, changedFilesCount };
      }),
    );

    return NextResponse.json({ ok: true, ...tasks, rows: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
