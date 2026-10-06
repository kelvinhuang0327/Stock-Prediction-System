import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const insights = await prisma.optimizationInsightRecord.findMany({
    orderBy: { id: 'desc' },
    take: 5,
    select: { id: true, insightType: true, severity: true, affectedScope: true, expiresAt: true, createdAt: true },
  });

  const learning = await prisma.strategyLearningInsight.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true, generatedAt: true, sourceCount: true, summary: true },
  });

  const lastWorker = await prisma.jobRunLog.findFirst({
    where: { jobName: 'training:tw-worker-cycle' },
    orderBy: { id: 'desc' },
    select: { id: true, status: true, startedAt: true, finishedAt: true, summary: true, errorMessage: true },
  });

  const shadowOpen = await prisma.simulatedTrade.count({ where: { status: 'shadow-open' } });
  const openCount = await prisma.simulatedTrade.count({ where: { status: 'open' } });

  // Check for review reports on trade IDs 314/315/316 (post-recovery trades)
  const reviews = await prisma.tradeReviewReport.findMany({
    where: { tradeId: { in: [314, 315, 316] } },
    select: { id: true, tradeId: true, triggerType: true, createdAt: true },
  });

  // Monitor cycle: latest job run that touches monitoring
  const lastMonitor = await prisma.jobRunLog.findFirst({
    where: { jobName: { in: ['training:tw-worker-cycle', 'training:tw-daily-monitor'] } },
    orderBy: { id: 'desc' },
    select: { id: true, jobName: true, status: true, startedAt: true, finishedAt: true, summary: true },
  });

  // Trade updatedAt timestamps for the 3 recovery trades
  const recoveryTrades = await prisma.simulatedTrade.findMany({
    where: { id: { in: [314, 315, 316] } },
    select: { id: true, symbol: true, entryDate: true, pnlPct: true, mfePct: true, maePct: true, updatedAt: true },
  });

  // Monitor job names from JobRunLog
  const monitorJobs = await prisma.jobRunLog.findMany({
    where: { jobName: { contains: 'monitor' } },
    orderBy: { id: 'desc' },
    take: 3,
    select: { id: true, jobName: true, status: true, finishedAt: true, summary: true },
  });

  // Worker cycle last 5 runs
  const workerRuns = await prisma.jobRunLog.findMany({
    where: { jobName: 'training:tw-worker-cycle' },
    orderBy: { id: 'desc' },
    take: 5,
    select: { id: true, status: true, summary: true, finishedAt: true },
  });

  console.log(JSON.stringify({
    activeInsights: insights,
    latestLearning: learning,
    lastWorkerJobRun: lastWorker,
    lastMonitorJobRun: lastMonitor,
    openTradeCount: openCount,
    shadowOpenCount: shadowOpen,
    reviewsOnRecoveryTrades: reviews,
    recoveryTradesUpdatedAt: recoveryTrades,
    monitorJobs,
    workerRuns,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(e => { console.error(String(e)); process.exitCode = 1; });
