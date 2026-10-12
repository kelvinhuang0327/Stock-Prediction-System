// Day 3 baseline snapshot
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });

async function main() {
  const [latestQuote, openTrades, closedFull, shadowClosed, reviews, insights, fullClosed] = await Promise.all([
    p.stockQuote.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
    p.simulatedTrade.count({ where: { status: { in: ['open','shadow-open'] } } }),
    p.simulatedTrade.count({ where: { status: 'closed' } }),
    p.simulatedTrade.count({ where: { status: 'shadow-closed' } }),
    p.tradeReviewReport.count(),
    p.strategyLearningInsight.count(),
    p.simulatedTrade.count({ where: { status: 'closed', tradeMode: 'full' } }),
  ]);
  const exitDist = await p.simulatedTrade.groupBy({
    by: ['exitReason'], where: { exitReason: { not: null } }, _count: true
  });
  const newsCount = await p.newsEvent.count().catch(() => -1);
  const latestNews = await p.newsEvent.findFirst({ orderBy: { publishedAt: 'desc' }, select: { publishedAt: true } }).catch(() => null);
  const chipLatest = await p.institutionalChip.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }).catch(() => null);
  const revenueLatest = await p.monthlyRevenue.findFirst({ orderBy: { reportDate: 'desc' }, select: { reportDate: true } }).catch(() => null);

  console.log('=== PHASE 0 BASELINE ===');
  console.log(JSON.stringify({
    latestQuote: latestQuote?.date,
    latestChip: chipLatest?.date ?? 'n/a',
    latestRevenue: revenueLatest?.reportDate ?? 'n/a',
    newsEventCount: newsCount,
    latestNewsPublishedAt: latestNews?.publishedAt ?? 'n/a',
    openTrades,
    closedFull, shadowClosed,
    totalClosed: closedFull + shadowClosed,
    reviews,
    insights,
    fullModeClosed: fullClosed,
    exitDist: Object.fromEntries(exitDist.map(r => [r.exitReason ?? 'null', r._count]))
  }, null, 2));
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
