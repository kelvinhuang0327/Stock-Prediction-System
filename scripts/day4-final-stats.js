const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });
async function main() {
  const total = await p.simulatedTrade.count();
  const open = await p.simulatedTrade.count({ where: { status: { in: ['open','shadow-open'] } } });
  const closed = await p.simulatedTrade.count({ where: { status: { in: ['closed','shadow-closed'] } } });
  const reviews = await p.tradeReviewReport.count();
  const insights = await p.strategyLearningInsight.count();

  const modes = await p.$queryRawUnsafe(
    "SELECT tradeMode, status, COUNT(*) as n, ROUND(AVG(pnlPct),2) as avgPnl FROM SimulatedTrade WHERE status IN ('closed','shadow-closed') GROUP BY tradeMode, status"
  );
  const exits = await p.$queryRawUnsafe(
    "SELECT exitReason, COUNT(*) as n FROM SimulatedTrade WHERE status IN ('closed','shadow-closed') AND exitReason IS NOT NULL GROUP BY exitReason"
  );
  const rolling = await p.$queryRawUnsafe(
    "SELECT COUNT(*) as n, ROUND(AVG(pnlPct),2) as avg, ROUND(MAX(pnlPct),2) as maxP, ROUND(MIN(pnlPct),2) as minP, SUM(CASE WHEN pnlPct > 0 THEN 1 ELSE 0 END) as wins FROM SimulatedTrade WHERE status='shadow-closed' AND marketContext LIKE '%rolling-simulation%'"
  );
  const chip = await p.institutionalChip.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });

  const print = (x) => JSON.stringify(x, (k,v) => typeof v === 'bigint' ? Number(v) : v, 2);
  console.log('=== FINAL DB STATE ===');
  console.log('total:', total, 'open:', open, 'closed:', closed, 'reviews:', reviews, 'insights:', insights);
  console.log('chip latest:', chip?.date);
  console.log('\nBy mode+status:');
  for (const row of modes) console.log(' ', JSON.stringify(row, (k,v) => typeof v === 'bigint' ? Number(v) : v));
  console.log('\nExit dist:');
  for (const row of exits) console.log(' ', JSON.stringify(row, (k,v) => typeof v === 'bigint' ? Number(v) : v));
  console.log('\nRolling sim trades:');
  for (const row of rolling) console.log(' ', JSON.stringify(row, (k,v) => typeof v === 'bigint' ? Number(v) : v));
  await p.$disconnect();
}
main().catch(console.error);
