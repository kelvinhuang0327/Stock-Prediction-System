'use strict';
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });
async function main() {
  const total = await p.simulatedTrade.count();
  const closed = await p.simulatedTrade.count({ where: { status: { in: ['shadow-closed', 'closed', 'pending-closed'] } } });
  const open = await p.simulatedTrade.count({ where: { status: { in: ['open', 'shadow-open'] } } });
  const reviews = await p.tradeReviewReport.count();
  const insights = await p.strategyLearningInsight.count();

  const bySetup = await p.$queryRawUnsafe(`
    SELECT setupType,
           COUNT(*) as total,
           SUM(CASE WHEN pnlPct > 0 THEN 1 ELSE 0 END) as wins,
           AVG(pnlPct) as avgPnl
    FROM SimulatedTrade
    WHERE status = 'shadow-closed'
    GROUP BY setupType
  `);

  const latest = await p.$queryRawUnsafe(`
    SELECT id, summary, sourceCount, limitations, successPatterns, failurePatterns, adjustmentSuggestions
    FROM StrategyLearningInsight ORDER BY createdAt DESC LIMIT 1
  `);

  const contaminated = await p.simulatedTrade.findMany({
    where: { marketContext: { contains: '"dataQuality":"contaminated"' } },
    select: { id: true, symbol: true, pnlPct: true, setupType: true }
  });

  console.log('=== Day 5 Final State ===');
  console.log('Total trades in DB:', total);
  console.log('Closed (all modes):', closed);
  console.log('Currently open:', open);
  console.log('Review reports:', reviews);
  console.log('Learning insights:', insights);
  console.log('Contaminated flags:', contaminated.length, contaminated.map(t => 'id=' + t.id + ' ' + t.symbol + ' ' + t.pnlPct.toFixed(2) + '%'));
  console.log('');
  console.log('Shadow-closed by setup:');
  bySetup.forEach(r => {
    const total = Number(r.total);
    const wins = Number(r.wins);
    const winRate = (wins / total * 100).toFixed(0);
    const threshold = winRate >= 55 && r.avgPnl > 0 ? 'ELIGIBLE' : 'not yet';
    console.log('  ' + r.setupType + ': total=' + total + ' wins=' + wins + ' winRate=' + winRate + '% avgPnl=' + Number(r.avgPnl).toFixed(2) + '% => ' + threshold);
  });
  console.log('');
  const ins = latest[0];
  console.log('Latest insight: #' + ins.id);
  console.log('sourceCount:', ins.sourceCount);
  console.log('summary:', ins.summary);
  console.log('successPatterns:', ins.successPatterns);
  console.log('failurePatterns:', ins.failurePatterns);
  console.log('adjustmentSuggestions:', ins.adjustmentSuggestions);
  console.log('limitations:', ins.limitations);
}
main().catch(e => console.error(e)).finally(() => p.$disconnect());
