import { NextResponse } from 'next/server';
import {
  deriveSelfOptimizationKpiFollowup,
  readSelfOptimizationKpiReport,
} from '@/lib/autonomous/selfOptimizationKpiFollowup';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function safeParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const report = await readSelfOptimizationKpiReport();
    const followup = deriveSelfOptimizationKpiFollowup(report);
    const latestFollowupRun = await prisma.jobRunLog.findFirst({
      where: { jobName: 'training:tw-self-optimization-followup' },
      orderBy: { startedAt: 'desc' },
      select: {
        startedAt: true,
        finishedAt: true,
        status: true,
        summary: true,
        metadata: true,
      },
    });
    const metadata = safeParse<Record<string, unknown> | null>(latestFollowupRun?.metadata, null);

    return NextResponse.json({
      ...report,
      followup,
      followupAutomation: latestFollowupRun
        ? {
            lastRunAt: latestFollowupRun.startedAt?.toISOString() ?? null,
            finishedAt: latestFollowupRun.finishedAt?.toISOString() ?? null,
            runStatus: latestFollowupRun.status,
            summary: latestFollowupRun.summary,
            followupStatus:
              typeof metadata?.followupStatus === 'string'
                ? metadata.followupStatus
                : followup.status,
            nextEligibleAt:
              typeof metadata?.nextEligibleAt === 'string'
                ? metadata.nextEligibleAt
                : followup.nextEligibleAt,
            diagnosticTaskCreated: metadata?.diagnosticTaskCreated === true,
            diagnosticTaskId:
              typeof metadata?.diagnosticTaskId === 'number'
                ? metadata.diagnosticTaskId
                : null,
            diagnosticTaskSuppressed: metadata?.diagnosticTaskSuppressed === true,
            recommendedNextAction:
              typeof metadata?.recommendedNextAction === 'string'
                ? metadata.recommendedNextAction
                : followup.recommendedNextAction,
          }
        : null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Self-optimization KPI report not found. Run scripts/generate-self-optimization-kpi-report.ts first.' },
      { status: 404 },
    );
  }
}
