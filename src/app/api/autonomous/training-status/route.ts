/**
 * GET /api/autonomous/training-status
 *
 * Returns the full Autonomous Training Scheduler status for observability:
 *   - Per-layer last-run times and status
 *   - Active/expired insight counts by type
 *   - Currently gated setup types
 *   - Probe activity summary
 *   - Recovery event summary
 *   - Recent task execution log (last 50)
 *   - Daily quota remaining
 *
 * This endpoint is read-only and non-mutating.
 */

import { NextResponse } from 'next/server';
import { getTrainingSchedulerStatus } from '@/lib/training/TrainingScheduler';

export async function GET() {
  try {
    const status = await getTrainingSchedulerStatus();
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
