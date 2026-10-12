/**
 * Day 5 Phase 0 — Baseline Snapshot
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });

async function main() {
  console.log('\n=== DAY 5 PHASE 0: BASELINE SNAPSHOT ===\n');

  // 1. Last 5 closed trades
  const closedTop5 = await p.simulatedTrade.findMany({
    where: { status: 'closed' },
    orderBy: { id: 'desc' },
    take: 5,
    select: { id: true, symbol: true, setupType: true, entryDate: true, pnlPct: true, exitReason: true, tradeMode: true },
  });
  console.log('── Recent closed trades (status=closed, DESC):');
  closedTop5.forEach(t => console.log(`  id=${t.id} ${t.symbol} ${t.setupType} entry=${t.entryDate} pnl=${t.pnlPct?.toFixed(2)}% exit=${t.exitReason} mode=${t.tradeMode}`));

  // 2. Last 3 insights
  const insights = await p.strategyLearningInsight.findMany({
    orderBy: { id: 'desc' },
    take: 3,
    select: { id: true, createdAt: true, summary: true, sourceCount: true },
  });
  console.log('\n── Recent insights (DESC):');
  insights.forEach(i => console.log(`  id=${i.id} sourceCount=${i.sourceCount} date=${new Date(i.createdAt).toISOString().slice(0,10)}\n    summary: ${i.summary}`));

  // 3. closed trades by tradeMode
  const modeStats = await p.$queryRawUnsafe(
    "SELECT tradeMode, COUNT(*) as n, ROUND(AVG(pnlPct),2) as avg, ROUND(MIN(pnlPct),2) as min, ROUND(MAX(pnlPct),2) as max FROM SimulatedTrade WHERE status='closed' GROUP BY tradeMode"
  );
  console.log('\n── Closed trades by tradeMode:');
  modeStats.forEach(r => console.log(`  ${r.tradeMode}: count=${r.n} avg=${r.avg}% min=${r.min}% max=${r.max}%`));

  // 4. Chip + quote freshness
  const latestChip = await p.institutionalChip.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });
  const latestQuote = await p.stockQuote.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });
  const today = new Date().toISOString().slice(0, 10);
  const chipDays = latestChip ? Math.floor((new Date(today) - new Date(latestChip.date)) / 86400000) : 999;
  const quoteDays = latestQuote ? Math.floor((new Date(today) - new Date(latestQuote.date)) / 86400000) : 999;
  console.log(`\n── Data freshness (today=${today}):`);
  console.log(`  Chip  latest=${latestChip?.date} (${chipDays}d ago) → ${chipDays <= 7 ? 'FRESH' : chipDays <= 30 ? 'DEGRADED' : 'STALE'}`);
  console.log(`  Quote latest=${latestQuote?.date} (${quoteDays}d ago) → ${quoteDays <= 7 ? 'FRESH' : quoteDays <= 30 ? 'DEGRADED' : 'STALE'}`);

  // 5. Contaminated trade IDs check
  const contam = await p.simulatedTrade.findMany({
    where: { id: { in: [40, 41, 42] } },
    select: { id: true, symbol: true, pnlPct: true, status: true, metadata: true },
  });
  console.log('\n── Day 3 batch trades (IDs 40-42) metadata check:');
  contam.forEach(t => console.log(`  id=${t.id} ${t.symbol} pnl=${t.pnlPct?.toFixed(2)}% status=${t.status} metadata=${t.metadata ?? 'null'}`));

  await p.$disconnect();
}

main().catch(console.error);
