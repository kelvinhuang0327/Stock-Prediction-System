import { prisma } from '@/lib/prisma';
import { JobOrchestrationService } from '../JobOrchestrationService';
import { getAutonomousDashboardSummary } from '../AutonomousDashboardService';

describe('AutonomousDashboardService', () => {
  const orchestration = new JobOrchestrationService();
  const snapshotDate = '2099-01-01';

  afterAll(async () => {
    const review = await prisma.tradeReviewReport.findFirst({
      where: { snapshot: { snapshotDate } },
      select: { tradeId: true },
    });
    if (review) {
      await prisma.tradeReviewReport.deleteMany({ where: { tradeId: review.tradeId } });
      await prisma.simulatedTrade.deleteMany({ where: { id: review.tradeId } });
    }
    await prisma.strategyProposal.deleteMany({
      where: { snapshot: { snapshotDate } },
    });
    await prisma.autonomousResearchSnapshot.deleteMany({
      where: { snapshotDate },
    });
    await prisma.strategyLearningInsight.deleteMany({
      where: { generatedAt: '2099-01-01T00:00:00.000Z' },
    });
    await prisma.jobRunLog.deleteMany({
      where: {
        idempotencyKey: { contains: 'autonomous:daily:2099-01-01T00:00:00.000Z' },
      },
    });
  });

  test('aggregates latest snapshot, proposal, trade, review, learning and job health data', async () => {
    const baseline = await getAutonomousDashboardSummary(new Date('2026-03-30T00:00:00.000Z'));

    const snapshot = await prisma.autonomousResearchSnapshot.create({
      data: {
        snapshotDate,
        marketState: 'recovery',
        sectorStrength: JSON.stringify([{ name: 'Tech', averageChangePercent: 1.2, stockCount: 3, direction: 'strong' }]),
        candidateStocks: JSON.stringify([{ symbol: 'TEST', name: 'Test Corp' }, { symbol: 'DEMO', name: 'Demo Inc' }]),
        riskSignals: JSON.stringify(['risk-a']),
        topInsights: JSON.stringify(['insight-a']),
        dataCoverage: 'full',
        limitations: JSON.stringify(['limited sample']),
      },
    });

    const approvedProposal = await prisma.strategyProposal.create({
      data: {
        snapshotId: snapshot.id,
        symbol: 'TEST',
        setupType: 'trend',
        thesis: 'test thesis',
        entryCondition: 'entry condition',
        invalidationCondition: 'invalidation',
        stopLossRule: 'stop rule',
        takeProfitRule: 'take rule',
        positionSizing: 0.12,
        conviction: 'high',
        supportingSignals: JSON.stringify(['technical', 'fundamental']),
        riskFactors: JSON.stringify(['risk']),
        researchSnapshotId: snapshot.id,
        state: 'approved',
        decisionMeta: JSON.stringify({ source: 'test' }),
      },
    });

    const closedProposal = await prisma.strategyProposal.create({
      data: {
        snapshotId: snapshot.id,
        symbol: 'DEMO',
        setupType: 'rebound',
        thesis: 'second thesis',
        entryCondition: 'entry condition',
        invalidationCondition: 'invalidation',
        stopLossRule: 'stop rule',
        takeProfitRule: 'take rule',
        positionSizing: 0.08,
        conviction: 'mid',
        supportingSignals: JSON.stringify(['event']),
        riskFactors: JSON.stringify(['risk']),
        researchSnapshotId: snapshot.id,
        state: 'triggered',
        decisionMeta: JSON.stringify({ source: 'test' }),
      },
    });

    const openTrade = await prisma.simulatedTrade.create({
      data: {
        proposalId: approvedProposal.id,
        snapshotId: snapshot.id,
        symbol: 'TEST',
        setupType: 'trend',
        entryDate: '20990101',
        entryPrice: 100,
        simulatedFillPrice: 100.5,
        slippageModel: 'flat',
        quantity: 10,
        marketContext: JSON.stringify({ marketState: 'recovery', regime: 'Bull', regimeConfidence: 0.91, note: 'test' }),
        status: 'open',
      },
    });

    const closedTrade = await prisma.simulatedTrade.create({
      data: {
        proposalId: closedProposal.id,
        snapshotId: snapshot.id,
        symbol: 'DEMO',
        setupType: 'rebound',
        entryDate: '20990101',
        entryPrice: 50,
        simulatedFillPrice: 50.25,
        slippageModel: 'flat',
        quantity: 20,
        marketContext: JSON.stringify({ marketState: 'recovery', regime: 'Bull', regimeConfidence: 0.91, note: 'test' }),
        status: 'closed',
        exitTime: new Date('2099-01-02T00:00:00.000Z'),
        exitPrice: 54,
        pnlPct: 7.5,
        pnlAmount: 75,
        mfePct: 8.5,
        maePct: -1.2,
        holdingDays: 3,
        exitReason: 'target',
        stopHit: false,
        targetHit: true,
      },
    });

    await prisma.tradeReviewReport.create({
      data: {
        tradeId: closedTrade.id,
        snapshotId: snapshot.id,
        triggerType: '+5',
        preTrade: JSON.stringify({ thesis: 'second thesis', setupType: 'rebound', marketState: 'recovery', signalStrength: 'event', fundamentalState: 'full' }),
        result: JSON.stringify({ return: 7.5, holdingTime: 3, MFE: 8.5, MAE: -1.2, exitReason: 'target' }),
        analysis: JSON.stringify({ technicalEffective: true, fundamentalSupported: true, eventDominated: false, betaDriven: false }),
        issues: JSON.stringify({ regimeMismatch: false, signalQualityInsufficient: false, enteredWithLowData: false, tooEarlyOrLate: false }),
        recommendations: JSON.stringify({ raiseThresholds: false, removeSetup: false, prioritizeSetup: 'rebound' }),
      },
    });

    await prisma.strategyLearningInsight.create({
      data: {
        generatedAt: '2099-01-01T00:00:00.000Z',
        summary: 'test insight',
        successPatterns: JSON.stringify(['rebound']),
        failurePatterns: JSON.stringify(['trend']),
        adjustmentSuggestions: JSON.stringify(['raise thresholds']),
        sourceCount: 1,
        limitations: JSON.stringify(['tiny sample']),
      },
    });

    const run = await orchestration.startJobRun({
      jobName: 'autonomous:daily',
      scheduledFor: new Date('2099-01-01T00:00:00.000Z'),
      triggerSource: 'cli',
      runMode: 'missed_run',
    });
    await orchestration.completeJobRun(run.run.id ?? 0, { summary: 'daily completed' });

    const dashboard = await getAutonomousDashboardSummary(new Date('2026-03-30T00:00:00.000Z'));

    expect(dashboard.latestSnapshot?.snapshotDate).toBe(snapshotDate);
    expect(dashboard.latestSnapshot?.candidateCount).toBeGreaterThanOrEqual(2);
    expect(dashboard.proposalSummary.total).toBeGreaterThanOrEqual(baseline.proposalSummary.total + 2);
    expect(dashboard.tradeSummary.total).toBeGreaterThanOrEqual(baseline.tradeSummary.total + 2);
    expect(dashboard.reviewSummary.total).toBeGreaterThanOrEqual(baseline.reviewSummary.total + 1);
    expect(dashboard.learningSummary.total).toBeGreaterThanOrEqual(1);
    expect(dashboard.jobHealth.jobs.find((job) => job.jobName === 'autonomous:daily')?.latestRun?.runMode).toBe('missed_run');
    expect(dashboard.jobHealth.jobs.find((job) => job.jobName === 'autonomous:daily')?.status).toBe('success');
    expect(dashboard.limitations.length).toBeGreaterThan(0);

    await prisma.tradeReviewReport.deleteMany({ where: { tradeId: closedTrade.id } });
    await prisma.simulatedTrade.deleteMany({ where: { id: { in: [openTrade.id, closedTrade.id] } } });
    await prisma.strategyProposal.deleteMany({ where: { id: { in: [approvedProposal.id, closedProposal.id] } } });
    await prisma.autonomousResearchSnapshot.deleteMany({ where: { id: snapshot.id } });
    await prisma.strategyLearningInsight.deleteMany({ where: { generatedAt: '2099-01-01T00:00:00.000Z' } });
    await prisma.jobRunLog.deleteMany({ where: { idempotencyKey: run.run.idempotencyKey } });
  });
});
