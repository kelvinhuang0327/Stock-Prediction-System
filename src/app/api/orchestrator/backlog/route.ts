import { NextResponse } from 'next/server';
import nodeFs from 'node:fs/promises';
import { BACKLOG_PATH } from '@/lib/agent-orchestrator/common';

/**
 * GET /api/orchestrator/backlog
 * Returns the full content of backlog.md as { content, path }.
 */
export async function GET() {
  try {
    let content = '';
    try {
      content = await nodeFs.readFile(BACKLOG_PATH, 'utf-8');
    } catch {
      content = '(backlog.md not found)';
    }
    return NextResponse.json({ ok: true, content, path: BACKLOG_PATH });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
