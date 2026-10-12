import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';

type FinalClassification =
  | 'OUTCOME_IMPROVING'
  | 'BEHAVIOR_CHANGED_BUT_OUTCOME_PENDING'
  | 'INSUFFICIENT_DATA'
  | 'NEEDS_FIX';

type SignalQuality = 'IMPROVING' | 'WORSENING' | 'UNCHANGED' | 'INSUFFICIENT_DATA';
type WindowStatus = 'READY' | 'INSUFFICIENT_RUNTIME_WINDOW';

interface TimeWindow {
  start: string;
  end: string;
  observedHours: number;
  targetDays: number;
  sufficientForOutcome: boolean;
}

interface CountRate {
  count: number;
  rate: number | null;
}

interface ExecutionQualityKpis {
  proposalCount: number;
  tradeCount: number;
  fullTradeCount: number;
  pendingTradeCount: number;
  shadowTradeCount: number;
  noneStateProposalCount: number;
  rejectedProposalCount: number;
  gatedProposalCount: number;
  averageTriggerScore: number | null;
  averagePositionSize: number | null;
}

interface TradeQualityKpis {
  closedTradeCount: number;
  winRate: number | null;
  averagePnlPct: number | null;
  averageMfePct: number | null;
  averageMaePct: number | null;
  stopHitRate: number | null;
  targetHitRate: number | null;
  timeExitRate: number | null;
}

interface LearningQualityKpis {
  tradeReviewReportCount: number;
  reviewDistribution: {
    plus5: number;
    minus5: number;
    time: number;
  };
  strategyLearningInsightCount: number;
  activeInsightCount: number;
  expiredInsightCount: number;
  refreshedInsightCount: number;
}

interface SafetyKpis {
  noAllStrategyLockout: boolean;
  duplicateInsightRows: number;
  dataQualityHardGateCount: number;
  riskFloorBypassCount: number;
}

interface WindowMetrics {
  executionQuality: ExecutionQualityKpis;
  tradeQuality: TradeQualityKpis;
  learningQuality: LearningQualityKpis;
  safety: SafetyKpis;
}

interface DeltaSummary {
  proposalCountDelta: number;
  tradeCountDelta: number;
  averageTriggerScoreDelta: number | null;
  averagePositionSizeDelta: number | null;
  winRateDelta: number | null;
  averagePnlPctDelta: number | null;
}

interface ReportShape {
  generatedAt: string;
  insightSource: {
    id: number;
    sourceTaskId: string;
    insightType: string;
    createdAt: string;
    expiresAt: string;
    regimeContext: string | null;
    confidence: number;
    severity: string;
    evidence: string[];
  };
  windowStatus: WindowStatus;
  beforeWindow: TimeWindow;
  afterWindow: TimeWindow;
  kpiDefinitions: {
    executionQuality: string[];
    tradeQuality: string[];
    learningQuality: string[];
    safety: string[];
  };
  dbQueryResult: {
    before: WindowMetrics;
    after: WindowMetrics;
    comparison: DeltaSummary;
  };
  behaviorComparison: {
    proposalsGeneratedBeforeVsAfter: { before: number; after: number };
    tradesOpenedBeforeVsAfter: { before: number; after: number };
    tradeModeDistributionBeforeVsAfter: {
      before: { full: number; pending: number; shadow: number };
      after: { full: number; pending: number; shadow: number };
    };
    sizingDistributionBeforeVsAfter: {
      beforeAverage: number | null;
      afterAverage: number | null;
    };
    reviewDistributionBeforeVsAfter: {
      before: { plus5: number; minus5: number; time: number };
      after: { plus5: number; minus5: number; time: number };
    };
  };
  signalQuality: SignalQuality;
  conclusion: string;
  limitations: string[];
  nextRecommendation: string;
  finalClassification: FinalClassification;
}

function round(value: number | null, digits = 4): number | null {
  if (value == null || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function safeJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function avg(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

async function getExecutionQuality(start: Date, end: Date): Promise<ExecutionQualityKpis> {
  const proposals = await prisma.strategyProposal.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: {
      id: true,
      state: true,
      positionSizing: true,
      decisionMeta: true,
      trade: {
        select: {
          id: true,
          tradeMode: true,
          triggerScore: true,
        },
      },
    },
  });

  const trades = proposals.flatMap((proposal) => (proposal.trade ? [proposal.trade] : []));
  const triggerScores = proposals.map((proposal) => {
    const meta = safeJsonObject(proposal.decisionMeta);
    const triggerScore = safeJsonObject(typeof meta.triggerScore === 'object' ? JSON.stringify(meta.triggerScore) : undefined);
    const finalScore = triggerScore.finalScore;
    return typeof finalScore === 'number' ? finalScore : proposal.trade?.triggerScore ?? null;
  });

  const gatedProposalCount = proposals.filter((proposal) => {
    const meta = safeJsonObject(proposal.decisionMeta);
    const triggerScore = safeJsonObject(typeof meta.triggerScore === 'object' ? JSON.stringify(meta.triggerScore) : undefined);
    const components = Array.isArray(triggerScore.components) ? triggerScore.components : [];
    return components.some((component) =>
      component && typeof component === 'object' && 'name' in component && component.name === 'insight_gate');
  }).length;

  return {
    proposalCount: proposals.length,
    tradeCount: trades.length,
    fullTradeCount: trades.filter((trade) => trade.tradeMode === 'full').length,
    pendingTradeCount: trades.filter((trade) => trade.tradeMode === 'pending').length,
    shadowTradeCount: trades.filter((trade) => trade.tradeMode === 'shadow').length,
    noneStateProposalCount: proposals.filter((proposal) => proposal.state === 'approved').length,
    rejectedProposalCount: proposals.filter((proposal) => proposal.state === 'rejected').length,
    gatedProposalCount,
    averageTriggerScore: round(avg(triggerScores), 6),
    averagePositionSize: round(avg(proposals.map((proposal) => proposal.positionSizing)), 6),
  };
}

async function getTradeQuality(start: Date, end: Date): Promise<TradeQualityKpis> {
  const trades = await prisma.simulatedTrade.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: {
      status: true,
      pnlPct: true,
      mfePct: true,
      maePct: true,
      stopHit: true,
      targetHit: true,
      exitReason: true,
    },
  });

  const closedTrades = trades.filter((trade) => trade.pnlPct !== null || trade.exitReason !== null || (trade.status ?? '').includes('closed'));
  const wins = closedTrades.filter((trade) => (trade.pnlPct ?? Number.NEGATIVE_INFINITY) > 0).length;

  return {
    closedTradeCount: closedTrades.length,
    winRate: closedTrades.length > 0 ? round(wins / closedTrades.length, 6) : null,
    averagePnlPct: round(avg(closedTrades.map((trade) => trade.pnlPct)), 6),
    averageMfePct: round(avg(closedTrades.map((trade) => trade.mfePct)), 6),
    averageMaePct: round(avg(closedTrades.map((trade) => trade.maePct)), 6),
    stopHitRate: closedTrades.length > 0 ? round(closedTrades.filter((trade) => trade.stopHit === true).length / closedTrades.length, 6) : null,
    targetHitRate: closedTrades.length > 0 ? round(closedTrades.filter((trade) => trade.targetHit === true).length / closedTrades.length, 6) : null,
    timeExitRate: closedTrades.length > 0 ? round(closedTrades.filter((trade) => trade.exitReason === 'time').length / closedTrades.length, 6) : null,
  };
}

async function getLearningQuality(start: Date, end: Date): Promise<LearningQualityKpis> {
  const [reviews, learningCount, activeInsightCount, expiredInsightCount, refreshedInsightCount] = await Promise.all([
    prisma.tradeReviewReport.findMany({
      where: { generatedAt: { gte: start, lt: end } },
      select: { triggerType: true },
    }),
    prisma.strategyLearningInsight.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.optimizationInsightRecord.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.optimizationInsightRecord.count({ where: { expiresAt: { lte: new Date() } } }),
    prisma.optimizationInsightRecord.count({ where: { updatedAt: { gte: start, lt: end }, createdAt: { lt: start } } }),
  ]);

  return {
    tradeReviewReportCount: reviews.length,
    reviewDistribution: {
      plus5: reviews.filter((review) => review.triggerType === '+5').length,
      minus5: reviews.filter((review) => review.triggerType === '-5').length,
      time: reviews.filter((review) => review.triggerType === 'time').length,
    },
    strategyLearningInsightCount: learningCount,
    activeInsightCount,
    expiredInsightCount,
    refreshedInsightCount,
  };
}

async function getSafety(start: Date, end: Date): Promise<SafetyKpis> {
  const [proposals, duplicateGroups, dataQualityGates, riskFloorBypassCount] = await Promise.all([
    prisma.strategyProposal.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { state: true },
    }),
    prisma.$queryRaw<Array<{ sourceTaskId: string; insightType: string; dupes: bigint | number }>>`
      SELECT sourceTaskId, insightType, COUNT(*) as dupes
      FROM OptimizationInsightRecord
      GROUP BY sourceTaskId, insightType
      HAVING COUNT(*) > 1
    `,
    prisma.strategyProposal.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { decisionMeta: true },
    }),
    prisma.simulatedTrade.count({
      where: {
        createdAt: { gte: start, lt: end },
        proposal: { state: 'rejected' },
      },
    }),
  ]);

  const proposalCount = proposals.length;
  const allLockedOut = proposalCount > 0 && proposals.every((proposal) => proposal.state === 'approved' || proposal.state === 'rejected');

  const dataQualityHardGateCount = dataQualityGates.filter((proposal) => {
    const meta = safeJsonObject(proposal.decisionMeta);
    const triggerScore = safeJsonObject(typeof meta.triggerScore === 'object' ? JSON.stringify(meta.triggerScore) : undefined);
    const components = Array.isArray(triggerScore.components) ? triggerScore.components : [];
    return components.some((component) => {
      if (!component || typeof component !== 'object') return false;
      const name = 'name' in component ? component.name : undefined;
      const detail = 'detail' in component ? component.detail : undefined;
      return name === 'insight_gate' && typeof detail === 'string' && detail.includes('data_quality_issue');
    });
  }).length;

  return {
    noAllStrategyLockout: !allLockedOut,
    duplicateInsightRows: duplicateGroups.length,
    dataQualityHardGateCount,
    riskFloorBypassCount,
  };
}

async function collectWindowMetrics(start: Date, end: Date): Promise<WindowMetrics> {
  const [executionQuality, tradeQuality, learningQuality, safety] = await Promise.all([
    getExecutionQuality(start, end),
    getTradeQuality(start, end),
    getLearningQuality(start, end),
    getSafety(start, end),
  ]);

  return { executionQuality, tradeQuality, learningQuality, safety };
}

function classifySignalQuality(before: WindowMetrics, after: WindowMetrics, afterWindow: TimeWindow): { signalQuality: SignalQuality; finalClassification: FinalClassification; conclusion: string; nextRecommendation: string; limitations: string[] } {
  const limitations: string[] = [];

  if (!afterWindow.sufficientForOutcome) {
    limitations.push(`After-window runtime is only ${afterWindow.observedHours.toFixed(3)}h; minimum 72h target not met.`);
  }
  if (after.tradeQuality.closedTradeCount === 0) {
    limitations.push('No closed trades exist in the after-window, so trade outcome KPIs are pending.');
  }
  if (after.executionQuality.proposalCount === 0) {
    limitations.push('No proposals were generated after the insight activation timestamp yet.');
  }

  if (after.executionQuality.tradeCount === 0 && after.tradeQuality.closedTradeCount === 0) {
    return {
      signalQuality: 'INSUFFICIENT_DATA',
      finalClassification: 'BEHAVIOR_CHANGED_BUT_OUTCOME_PENDING',
      conclusion: 'The active insight is confirmed to change scoring behavior, but there is no post-insight proposal or trade outcome evidence yet to judge trade-quality improvement.',
      nextRecommendation: 'Re-run this KPI report after at least 72 hours of post-insight runtime and after closed trades and review reports have accumulated.',
      limitations,
    };
  }

  if (after.tradeQuality.closedTradeCount < 5 || after.learningQuality.tradeReviewReportCount < 5) {
    limitations.push('After-window closed trades or review reports are below the minimum conservative sample threshold of 5.');
    return {
      signalQuality: 'INSUFFICIENT_DATA',
      finalClassification: 'INSUFFICIENT_DATA',
      conclusion: 'There is some post-insight runtime data, but not enough closed-trade and review evidence to make a conservative claim about trading-quality improvement.',
      nextRecommendation: 'Wait for at least 5 closed trades and 5 review reports in the after-window before reclassifying signal quality.',
      limitations,
    };
  }

  const pnlDelta = (after.tradeQuality.averagePnlPct ?? 0) - (before.tradeQuality.averagePnlPct ?? 0);
  const winRateDelta = (after.tradeQuality.winRate ?? 0) - (before.tradeQuality.winRate ?? 0);
  const stopDelta = (before.tradeQuality.stopHitRate ?? 0) - (after.tradeQuality.stopHitRate ?? 0);

  if (pnlDelta > 0 && winRateDelta >= 0 && stopDelta >= 0) {
    return {
      signalQuality: 'IMPROVING',
      finalClassification: 'OUTCOME_IMPROVING',
      conclusion: 'Post-insight trade outcomes improved on the conservative comparison metrics used by this report.',
      nextRecommendation: 'Keep monitoring for at least one full expiry cycle to verify that the improvement persists beyond the initial window.',
      limitations,
    };
  }

  if (pnlDelta < 0 || winRateDelta < 0) {
    return {
      signalQuality: 'WORSENING',
      finalClassification: 'NEEDS_FIX',
      conclusion: 'Post-insight trade outcomes worsened on the available conservative KPIs, so the insight mechanism should not be credited with improving trading quality yet.',
      nextRecommendation: 'Inspect whether the current insight type is over-penalizing high-quality setups or starving the system of executable trades.',
      limitations,
    };
  }

  return {
    signalQuality: 'UNCHANGED',
    finalClassification: 'INSUFFICIENT_DATA',
    conclusion: 'The post-insight outcomes are materially unchanged versus the baseline window on the currently available KPI set.',
    nextRecommendation: 'Continue monitoring until a larger post-insight review sample accumulates or another insight refresh event occurs.',
    limitations,
  };
}

async function main() {
  const generatedAt = new Date();
  const activeInsights = await prisma.optimizationInsightRecord.findMany({
    where: { expiresAt: { gt: generatedAt } },
    orderBy: { createdAt: 'desc' },
  });
  const targetInsight = activeInsights.find((insight) => insight.sourceTaskId === 'price_analysis_quality__data_audit');

  if (!targetInsight) {
    throw new Error('Active price_analysis_quality__data_audit insight not found');
  }

  const targetDays = 7;
  const minHoursForOutcome = 72;
  const beforeStartDate = new Date(targetInsight.createdAt.getTime() - targetDays * 24 * 60 * 60 * 1000);
  const beforeEndDate = new Date(targetInsight.createdAt);
  const afterStartDate = new Date(targetInsight.createdAt);
  const afterEndDate = new Date();

  const beforeWindow: TimeWindow = {
    start: beforeStartDate.toISOString(),
    end: beforeEndDate.toISOString(),
    observedHours: round((beforeEndDate.getTime() - beforeStartDate.getTime()) / 3600000, 3) ?? 0,
    targetDays,
    sufficientForOutcome: true,
  };

  const afterWindow: TimeWindow = {
    start: afterStartDate.toISOString(),
    end: afterEndDate.toISOString(),
    observedHours: round((afterEndDate.getTime() - afterStartDate.getTime()) / 3600000, 3) ?? 0,
    targetDays,
    sufficientForOutcome: (afterEndDate.getTime() - afterStartDate.getTime()) / 3600000 >= minHoursForOutcome,
  };

  const [beforeMetrics, afterMetrics] = await Promise.all([
    collectWindowMetrics(beforeStartDate, beforeEndDate),
    collectWindowMetrics(afterStartDate, afterEndDate),
  ]);

  const comparison: DeltaSummary = {
    proposalCountDelta: afterMetrics.executionQuality.proposalCount - beforeMetrics.executionQuality.proposalCount,
    tradeCountDelta: afterMetrics.executionQuality.tradeCount - beforeMetrics.executionQuality.tradeCount,
    averageTriggerScoreDelta:
      afterMetrics.executionQuality.averageTriggerScore != null && beforeMetrics.executionQuality.averageTriggerScore != null
        ? round(afterMetrics.executionQuality.averageTriggerScore - beforeMetrics.executionQuality.averageTriggerScore, 6)
        : null,
    averagePositionSizeDelta:
      afterMetrics.executionQuality.averagePositionSize != null && beforeMetrics.executionQuality.averagePositionSize != null
        ? round(afterMetrics.executionQuality.averagePositionSize - beforeMetrics.executionQuality.averagePositionSize, 6)
        : null,
    winRateDelta: beforeMetrics.tradeQuality.winRate != null && afterMetrics.tradeQuality.winRate != null
      ? round(afterMetrics.tradeQuality.winRate - beforeMetrics.tradeQuality.winRate, 6)
      : null,
    averagePnlPctDelta: beforeMetrics.tradeQuality.averagePnlPct != null && afterMetrics.tradeQuality.averagePnlPct != null
      ? round(afterMetrics.tradeQuality.averagePnlPct - beforeMetrics.tradeQuality.averagePnlPct, 6)
      : null,
  };

  const classification = classifySignalQuality(beforeMetrics, afterMetrics, afterWindow);

  const report: ReportShape = {
    generatedAt: generatedAt.toISOString(),
    insightSource: {
      id: targetInsight.id,
      sourceTaskId: targetInsight.sourceTaskId,
      insightType: targetInsight.insightType,
      createdAt: targetInsight.createdAt.toISOString(),
      expiresAt: targetInsight.expiresAt.toISOString(),
      regimeContext: targetInsight.regimeContext,
      confidence: targetInsight.confidence,
      severity: targetInsight.severity,
      evidence: JSON.parse(targetInsight.evidence || '[]') as string[],
    },
    windowStatus: afterWindow.sufficientForOutcome ? 'READY' : 'INSUFFICIENT_RUNTIME_WINDOW',
    beforeWindow,
    afterWindow,
    kpiDefinitions: {
      executionQuality: [
        'Proposal count, opened trade count, and full/pending/shadow distribution.',
        'Rejected proposal count and gated proposal count derived from persisted decisionMeta trigger components.',
        'Average triggerScore and average persisted positionSizing across proposals.',
      ],
      tradeQuality: [
        'Closed-trade win rate, average pnlPct, average MFE, and average MAE.',
        'Stop-hit rate, target-hit rate, and time-exit rate across closed trades only.',
      ],
      learningQuality: [
        'TradeReviewReport count and +5 / -5 / time review mix.',
        'StrategyLearningInsight count plus active / expired / refreshed OptimizationInsightRecord counts.',
      ],
      safety: [
        'No all-strategy lockout if at least one proposal in-window remained executable or monitorable.',
        'Duplicate insight rows from grouped OptimizationInsightRecord uniqueness check.',
        'Hard-gate count where persisted trigger components show insight_gate tied to data_quality_issue.',
        'Risk-floor bypass count where a trade exists for a proposal persisted as rejected.',
      ],
    },
    dbQueryResult: {
      before: beforeMetrics,
      after: afterMetrics,
      comparison,
    },
    behaviorComparison: {
      proposalsGeneratedBeforeVsAfter: {
        before: beforeMetrics.executionQuality.proposalCount,
        after: afterMetrics.executionQuality.proposalCount,
      },
      tradesOpenedBeforeVsAfter: {
        before: beforeMetrics.executionQuality.tradeCount,
        after: afterMetrics.executionQuality.tradeCount,
      },
      tradeModeDistributionBeforeVsAfter: {
        before: {
          full: beforeMetrics.executionQuality.fullTradeCount,
          pending: beforeMetrics.executionQuality.pendingTradeCount,
          shadow: beforeMetrics.executionQuality.shadowTradeCount,
        },
        after: {
          full: afterMetrics.executionQuality.fullTradeCount,
          pending: afterMetrics.executionQuality.pendingTradeCount,
          shadow: afterMetrics.executionQuality.shadowTradeCount,
        },
      },
      sizingDistributionBeforeVsAfter: {
        beforeAverage: beforeMetrics.executionQuality.averagePositionSize,
        afterAverage: afterMetrics.executionQuality.averagePositionSize,
      },
      reviewDistributionBeforeVsAfter: {
        before: beforeMetrics.learningQuality.reviewDistribution,
        after: afterMetrics.learningQuality.reviewDistribution,
      },
    },
    signalQuality: classification.signalQuality,
    conclusion: classification.conclusion,
    limitations: classification.limitations,
    nextRecommendation: classification.nextRecommendation,
    finalClassification: classification.finalClassification,
  };

  const reportPath = path.join(process.cwd(), 'docs', 'reports', 'self_optimization_kpi_report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({ reportPath, finalClassification: report.finalClassification, windowStatus: report.windowStatus }, null, 2));
}

main()
  .catch((error) => {
    console.error('[generate-self-optimization-kpi-report] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
