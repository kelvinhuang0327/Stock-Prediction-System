/**
 * GET /api/tasks/status
 *
 * Returns last-run status for every Taiwan-stock orchestration task.
 * Used by /settings/system UI to display job health.
 *
 * Response: { tasks: TaskStatus[], generatedAt: string }
 */

import { NextResponse } from 'next/server';
import { getTaiwanStockTaskStatuses } from '@/lib/jobs/TaiwanStockJobOrchestrator';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const tasks = await getTaiwanStockTaskStatuses();
    return NextResponse.json({ tasks, generatedAt: new Date().toISOString() }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
