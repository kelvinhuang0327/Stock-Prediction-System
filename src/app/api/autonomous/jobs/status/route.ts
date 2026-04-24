import { NextResponse } from 'next/server';
import { getAutonomousJobsStatus } from '@/lib/jobs/autonomousJobStatus';
import { AutonomousAlertService } from '@/lib/jobs/AutonomousAlertService';
import { prisma } from '@/lib/prisma';

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
    const alertService = new AutonomousAlertService();
    const [status, latestSnapshot, openTrades, recentReviews, learningInsight, alertReport] = await Promise.all([
      getAutonomousJobsStatus(),
      prisma.autonomousResearchSnapshot.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.simulatedTrade.findMany({ where: { status: 'open' }, orderBy: { updatedAt: 'desc' }, take: 20 }),
      prisma.tradeReviewReport.findMany({ orderBy: { generatedAt: 'desc' }, take: 20 }),
      prisma.strategyLearningInsight.findFirst({ orderBy: { createdAt: 'desc' } }),
      alertService.listAlerts(),
    ]);

    return NextResponse.json({
      jobs: status.jobs,
      missedJobs: status.missedJobs,
      neverRanJobs: status.neverRanJobs,
      alerts: alertReport.alerts,
      alertSummary: alertReport.summary,
      healthSummary: status.healthSummary,
      summary: status.summary,
      limitations: status.limitations,
      snapshot: latestSnapshot
        ? {
            ...latestSnapshot,
            sectorStrength: safeParse(latestSnapshot.sectorStrength, []),
            candidateStocks: safeParse(latestSnapshot.candidateStocks, []),
            riskSignals: safeParse(latestSnapshot.riskSignals, []),
            topInsights: safeParse(latestSnapshot.topInsights, []),
            limitations: safeParse(latestSnapshot.limitations, []),
          }
        : null,
      openTrades,
      recentReviews,
      learningInsight: learningInsight
        ? {
            ...learningInsight,
            successPatterns: safeParse(learningInsight.successPatterns, []),
            failurePatterns: safeParse(learningInsight.failurePatterns, []),
            adjustmentSuggestions: safeParse(learningInsight.adjustmentSuggestions, []),
            limitations: safeParse(learningInsight.limitations, []),
          }
        : null,
    });
  } catch (error) {
    console.error('Autonomous jobs status failed:', error);
    return NextResponse.json(
      { error: 'Failed to load autonomous jobs status' },
      { status: 500 },
    );
  }
}
