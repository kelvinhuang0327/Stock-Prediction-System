/**
 * POST /api/tasks/run
 *
 * Trigger a named Taiwan-stock orchestration task on demand.
 * Auth: CRON_SECRET header (same pattern as daily-sync).
 *
 * Request body:
 *   { "taskName": "twstock:data_quality_check", "dryRun": false, "force": false }
 *
 * Response:
 *   { "jobId": number, "status": string, "summary": string, "metadata": object,
 *     "skipped": boolean, "skipReason": string | undefined }
 */

import { NextRequest, NextResponse } from 'next/server';
import { TAIWAN_STOCK_JOB_REGISTRY, type TaiwanStockTaskName } from '@/lib/jobs/taiwanStockJobRegistry';
import { runTaiwanStockTask } from '@/lib/jobs/TaiwanStockJobOrchestrator';
import type { JobTriggerSource } from '@/lib/jobs/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isTaiwanStockTaskName(value: unknown): value is TaiwanStockTaskName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TAIWAN_STOCK_JOB_REGISTRY, value);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth check — accept CRON_SECRET or internal bearer token
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    const secretHeader = req.headers.get('x-cron-secret');
    const providedSecret =
      authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : secretHeader;
    if (providedSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
  }

  const { taskName, dryRun = false, force = false } = body as Record<string, unknown>;

  if (!isTaiwanStockTaskName(taskName)) {
    return NextResponse.json(
      {
        error: 'Invalid taskName',
        validNames: Object.keys(TAIWAN_STOCK_JOB_REGISTRY),
      },
      { status: 400 },
    );
  }

  const definition = TAIWAN_STOCK_JOB_REGISTRY[taskName];
  if (dryRun && !definition.supportsDryRun) {
    return NextResponse.json(
      { error: `Task "${taskName}" does not support dry-run mode` },
      { status: 400 },
    );
  }

  try {
    const result = await runTaiwanStockTask({
      taskName,
      dryRun: Boolean(dryRun),
      force: Boolean(force),
      triggerSource: 'api' as JobTriggerSource,
    });

    const jobRun = result.jobRun;
    return NextResponse.json(
      {
        jobId: jobRun.id,
        status: jobRun.status,
        summary: jobRun.summary,
        metadata: jobRun.metadata ? JSON.parse(jobRun.metadata as string) : null,
        skipped: result.skipped,
        skipReason: result.skipReason,
        startedAt: jobRun.startedAt,
        finishedAt: jobRun.finishedAt,
        taskName,
        dryRun: Boolean(dryRun),
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
