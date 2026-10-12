import { NextResponse } from 'next/server';
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
    const [latestSnapshot, openTrades, recentReviews, learningInsight, proposals] = await Promise.all([
      prisma.autonomousResearchSnapshot.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.simulatedTrade.findMany({ where: { status: 'open' }, orderBy: { updatedAt: 'desc' }, take: 20 }),
      prisma.tradeReviewReport.findMany({ orderBy: { generatedAt: 'desc' }, take: 20 }),
      prisma.strategyLearningInsight.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.strategyProposal.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    return NextResponse.json({
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
      recentProposals: proposals,
    });
  } catch (error) {
    console.error('Autonomous status failed:', error);
    return NextResponse.json(
      { error: 'Failed to load autonomous status' },
      { status: 500 },
    );
  }
}
