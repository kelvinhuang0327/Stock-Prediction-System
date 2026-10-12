/**
 * Day 4 Phase 0 — Full Baseline + Learning Quality Audit
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });

async function main() {
  console.log('\n=== PHASE 0a: DB SNAPSHOT ===\n');

  // Trade status distribution
  const byStatus = await p.simulatedTrade.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log('Trade status dist:', JSON.stringify(byStatus.map(r => `${r.status}:${r._count.id}`)));

  // Full closed breakdown by tradeMode
  const byMode = await p.simulatedTrade.groupBy({
    by: ['tradeMode'],
    where: { status: { in: ['closed', 'shadow-closed'] } },
    _count: { id: true },
    _avg: { pnlPct: true },
    _max: { pnlPct: true },
    _min: { pnlPct: true },
  });
  console.log('\nClosed by tradeMode:');
  for (const r of byMode) {
    console.log(`  ${r.tradeMode}: count=${r._count.id} avg=${r._avg.pnlPct?.toFixed(2)}% max=${r._max.pnlPct?.toFixed(2)}% min=${r._min.pnlPct?.toFixed(2)}%`);
  }

  // Exit reason distribution
  const byExit = await p.simulatedTrade.groupBy({
    by: ['exitReason'],
    where: { status: { in: ['closed', 'shadow-closed'] } },
    _count: { id: true },
  });
  console.log('\nExit reason dist:', JSON.stringify(byExit.map(r => `${r.exitReason}:${r._count.id}`)));

  const reviewCount = await p.tradeReviewReport.count();
  const insightCount = await p.strategyLearningInsight.count();
  console.log(`\nTradeReviewReports: ${reviewCount}`);
  console.log(`StrategyLearningInsights: ${insightCount}`);

  // All closed trades details
  const allClosed = await p.simulatedTrade.findMany({
    where: { status: { in: ['closed', 'shadow-closed'] } },
    select: {
      id: true, symbol: true, setupType: true, tradeMode: true,
      entryDate: true, exitTime: true, holdingDays: true,
      pnlPct: true, exitReason: true, marketContext: true,
    },
    orderBy: { pnlPct: 'desc' },
  });
  console.log('\nAll closed trades (sorted by pnl desc):');
  for (const t of allClosed) {
    const exitDate = t.exitTime ? t.exitTime.toISOString().slice(0, 10) : 'n/a';
    const flag = (t.pnlPct ?? 0) > 20 ? ' ⚠️ OUTLIER>20%' : (t.pnlPct ?? 0) > 40 ? ' 🚨 EXTREME>40%' : '';
    console.log(`  [${t.id}] ${t.symbol} ${t.setupType} ${t.tradeMode} | entry=${t.entryDate} exit=${exitDate} hold=${t.holdingDays}d pnl=${t.pnlPct?.toFixed(2)}% reason=${t.exitReason} ctx=${t.marketContext}${flag}`);
  }

  console.log('\n=== PHASE 0c: OUTLIER TRADE AUDIT ===\n');
  const outliers = allClosed.filter(t => (t.pnlPct ?? 0) > 20);
  console.log(`Trades with pnlPct > 20%: ${outliers.length}`);
  for (const t of outliers) {
    console.log(`  [${t.id}] ${t.symbol} entry=${t.entryDate} hold=${t.holdingDays}d pnl=${t.pnlPct?.toFixed(2)}% reason=${t.exitReason} setupType=${t.setupType} ctx=${t.marketContext}`);
  }

  const day3Batch = allClosed.filter(t => t.entryDate === '2026-01-15' && (t.pnlPct ?? 0) > 20);
  if (day3Batch.length >= 3 && day3Batch.every(t => t.setupType === 'trend')) {
    console.log('\n🚨 DAY3 BATCH TRADES: learning contamination risk = HIGH');
    console.log(`   ${day3Batch.length} trend trades all entered 2026-01-15, pnls: ${day3Batch.map(t => t.pnlPct?.toFixed(1) + '%').join(', ')}`);
  }

  await p.$disconnect();
}

main().catch(console.error);
