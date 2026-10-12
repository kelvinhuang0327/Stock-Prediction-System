/**
 * One-shot DB probe: prints signal-classifier-relevant DB state as JSON.
 * Usage: npx tsx scripts/db-probe.ts
 */
import { prisma } from '../src/lib/prisma';

async function main(): Promise<void> {

const now = Date.now();
const sevenDaysAgo = new Date(now - 7 * 86_400_000);
const thirtyDaysAgo = new Date(now - 30 * 86_400_000);
const oneDayAgo = new Date(now - 86_400_000);
const twoDaysAgo = new Date(now - 2 * 86_400_000);

const [
  totalTrades,
  closedTrades,
  openTrades,
  stuckTrades,
  latestChip,
  latestQuote,
  failedJobs24h,
  latestInsight,
  reviewsLast7d,
  journalsLast30d,
  closeCount7d,
  setupDist,
  recentScores,
  shadowCount,
] = await Promise.all([
  prisma.simulatedTrade.count(),
  prisma.simulatedTrade.count({ where: { status: 'closed' } }),
  prisma.simulatedTrade.count({ where: { status: { in: ['open', 'pending'] } } }),
  prisma.simulatedTrade.count({ where: { status: { in: ['open', 'pending'] }, createdAt: { lte: oneDayAgo } } }),
  prisma.institutionalChip.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  prisma.stockQuote.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  prisma.jobRunLog.count({ where: { status: 'failed', createdAt: { gte: oneDayAgo } } }),
  prisma.strategyLearningInsight.findFirst({ orderBy: { id: 'desc' }, select: { createdAt: true } }),
  prisma.tradeReviewReport.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
  prisma.tradeJournalEntry.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
  prisma.simulatedTrade.count({ where: { status: 'closed', updatedAt: { gte: sevenDaysAgo } } }),
  prisma.simulatedTrade.groupBy({ by: ['setupType'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
  prisma.simulatedTrade.findMany({ where: { createdAt: { gte: oneDayAgo }, triggerScore: { not: null } }, select: { triggerScore: true }, take: 50 }),
  prisma.simulatedTrade.count({ where: { tradeMode: 'shadow', createdAt: { gte: sevenDaysAgo } } }),
]);

const scores = recentScores.map((t) => t.triggerScore as number);
const scoreRange = scores.length >= 2 ? { min: Math.min(...scores).toFixed(4), max: Math.max(...scores).toFixed(4), range: (Math.max(...scores) - Math.min(...scores)).toFixed(4), count: scores.length } : null;
const totalLast7d = await prisma.simulatedTrade.count({ where: { createdAt: { gte: sevenDaysAgo } } });

const chipAge = latestChip ? `${Math.round((now - latestChip.createdAt.getTime()) / 3_600_000)}h ago` : 'NEVER';
const quoteAge = latestQuote ? `${Math.round((now - latestQuote.createdAt.getTime()) / 3_600_000)}h ago` : 'NEVER';
const insightAge = latestInsight ? `${Math.round((now - new Date(latestInsight.createdAt).getTime()) / (24 * 3_600_000)).toFixed(1)} days ago` : 'NEVER';

console.log(JSON.stringify({
  signal_classifier_inputs: {
    totalTrades,
    closedTrades,
    openTrades,
    stuckTrades_gt24h: stuckTrades,
    closeCount_last7d: closeCount7d,
  },
  data_freshness: {
    latestChip: chipAge,
    latestChipRaw: latestChip?.createdAt ?? null,
    latestQuote: quoteAge,
    latestQuoteRaw: latestQuote?.createdAt ?? null,
    chipStale_gt2d: !latestChip || latestChip.createdAt < twoDaysAgo,
    quoteStale_gt2d: !latestQuote || latestQuote.createdAt < twoDaysAgo,
  },
  learning_pipeline: {
    latestInsight: insightAge,
    reviewsLast7d,
    journalsLast30d,
    failedJobs24h,
  },
  execution_signals: {
    setupTypeDistribution: setupDist.map((r) => ({ type: r.setupType, count: r._count.id })),
    shadowCount_last7d: shadowCount,
    totalTrades_last7d: totalLast7d,
    shadowPct: totalLast7d > 0 ? `${Math.round(shadowCount / totalLast7d * 100)}%` : 'N/A',
    scoreRange,
  },
  miner_state_file: 'runtime/agent_orchestrator/miner_state.json (check separately)',
}, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
