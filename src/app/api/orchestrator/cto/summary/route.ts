import { NextResponse } from 'next/server';
import { getLatestCtoRun, listCtoRuns } from '@/lib/agent-orchestrator/ctoReviewTick';
import { classifySignalState } from '@/lib/agent-orchestrator/signalStateClassifier';
import { getPrioritizedBacklog } from '@/lib/agent-orchestrator/backlogService';
import { getLatestAdaptivePolicy } from '@/lib/agent-orchestrator/adaptivePolicy';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [latestRun, signalState, openBacklog, policy, schedulerSetting, recentRuns,
           totalAccepted, totalRejected, totalDeferred, totalReflected, pendingCount] =
      await Promise.all([
        getLatestCtoRun(),
        classifySignalState(),
        getPrioritizedBacklog(10),
        getLatestAdaptivePolicy(),
        prisma.orchestratorSetting.findUnique({ where: { key: 'cto_scheduler_enabled' } }),
        listCtoRuns(5),
        prisma.strategyProposal.count({ where: { ctoDecision: 'ACCEPTED_FOR_LEARNING' } }),
        prisma.strategyProposal.count({ where: { ctoDecision: 'REJECTED_ADJUST_SIGNAL' } }),
        prisma.strategyProposal.count({ where: { ctoDecision: 'DEFERRED_REGIME_MISMATCH' } }),
        prisma.strategyProposal.count({ where: { ctoDecision: 'REFLECTED_IN_INSIGHT' } }),
        prisma.strategyProposal.count({
          where: { state: { in: ['approved', 'triggered'] }, ctoDecision: null },
        }),
      ]);

    const schedulerEnabled = schedulerSetting?.value === 'true';
    const frequencyMode    = latestRun?.frequencyMode ?? 'manual';

    // Estimate next run time (30 minutes after last run if scheduler enabled)
    let nextRunAt: string | null = null;
    if (schedulerEnabled && latestRun?.completedAt) {
      const next = new Date(latestRun.completedAt);
      next.setMinutes(next.getMinutes() + 30);
      nextRunAt = next.toISOString();
    }

    return NextResponse.json({
      ok: true,
      schedulerEnabled,
      frequency_mode:   frequencyMode,
      pending_count:    pendingCount,
      accepted_count:   totalAccepted,
      rejected_count:   totalRejected,
      deferred_count:   totalDeferred,
      reflected_count:  totalReflected,
      latest_run_at:    latestRun?.completedAt?.toISOString() ?? null,
      next_run_at:      nextRunAt,
      latest_run_summary: latestRun?.summary ?? null,
      signalState: {
        state:           signalState.state,
        confidenceLabel: signalState.confidenceLabel,
        reason:          signalState.reason,
      },
      latestRun: latestRun
        ? {
            runId:          latestRun.runId,
            candidateCount: latestRun.candidateCount,
            acceptedCount:  latestRun.acceptedCount,
            rejectedCount:  latestRun.rejectedCount,
            deferredCount:  latestRun.deferredCount,
            reflectedCount: latestRun.reflectedCount,
            summary:        latestRun.summary,
            isManual:       latestRun.isManual,
            createdAt:      latestRun.createdAt,
          }
        : null,
      openBacklogCount:  openBacklog.length,
      topBacklogItems:   openBacklog.slice(0, 3).map((i) => ({
        findingId:       i.findingId,
        category:        i.category,
        priorityLevel:   i.priorityLevel,
        suggestedAction: i.suggestedAction,
      })),
      policy: policy
        ? {
            overallAcceptRate: policy.overallAcceptRate,
            policyConfidence:  policy.policyConfidence,
            suggestions:       policy.suggestions.slice(0, 2),
          }
        : null,
      recentRuns: recentRuns.map((r) => ({
        runId:          r.runId,
        candidateCount: r.candidateCount,
        acceptedCount:  r.acceptedCount,
        isManual:       r.isManual,
        createdAt:      r.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
