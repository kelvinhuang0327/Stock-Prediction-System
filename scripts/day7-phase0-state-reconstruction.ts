/**
 * Day 7 Phase 0: Full State Reconstruction (v3)
 * Correctly using Prisma schema
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseJson(str: string | null) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n========== DAY 7 PHASE 0: STATE RECONSTRUCTION ==========\n');

  try {
    // 0a. DB Snapshot
    console.log('--- 0a. DB SNAPSHOT ---\n');

    // Trade status distribution
    console.log('[1] SimulatedTrade Status Distribution:');
    const trades = await prisma.simulatedTrade.groupBy({
      by: ['status'],
      _count: true,
    });
    console.table(trades.map(t => ({ status: t.status, count: t._count })));

    // Trade review count
    console.log('\n[2] TradeReviewReport Count:');
    const reviewCount = await prisma.tradeReviewReport.count();
    console.log(`  Total reviews: ${reviewCount}`);

    // Latest 3 StrategyLearningInsights
    console.log('\n[3] Latest 3 StrategyLearningInsights:');
    const insights = await prisma.strategyLearningInsight.findMany({
      orderBy: { id: 'desc' },
      take: 3,
    });
    for (const insight of insights) {
      const failurePatterns = parseJson(insight.failurePatterns);
      console.log(`ID #${insight.id}, createdAt: ${insight.createdAt}, sources: ${insight.sourceCount}`);
      console.log(`  generatedAt: ${insight.generatedAt}`);
      console.log(`  summary: ${insight.summary?.substring(0, 100)}`);
      if (failurePatterns) {
        console.log(`  penalizedSetups: ${JSON.stringify(failurePatterns.penalizedSetups)}`);
        console.log(`  rewardedSetups: ${JSON.stringify(failurePatterns.rewardedSetups)}`);
      }
    }

    // Setup win rates (no contamination)
    console.log('\n[4] Setup Win Rates (organic, no contamination):');
    const setupStats = await prisma.$queryRaw<any[]>`
      SELECT 
        setupType, 
        tradeMode,
        COUNT(*) as total,
        ROUND(AVG(pnlPct), 3) as avgPnl,
        SUM(CASE WHEN pnlPct > 0 THEN 1 ELSE 0 END) as wins
      FROM SimulatedTrade
      WHERE status = 'closed'
        AND NOT (marketContext LIKE '%"dataQuality":"contaminated"%')
      GROUP BY setupType, tradeMode
      ORDER BY setupType, tradeMode
    `;
    console.table(setupStats);

    // Exit reason distribution
    console.log('\n[5] Exit Reason Distribution (organic, no contamination):');
    const exitReasons = await prisma.$queryRaw<any[]>`
      SELECT exitReason, COUNT(*) as count
      FROM SimulatedTrade
      WHERE status = 'closed'
        AND NOT (marketContext LIKE '%"dataQuality":"contaminated"%')
      GROUP BY exitReason
    `;
    console.table(exitReasons);

    // 0b. Day 6 Completeness Check
    console.log('\n--- 0b. DAY 6 COMPLETENESS CHECK ---\n');

    // Review remediation check
    console.log('[1] Review Remediation Status:');
    const reviews = await prisma.tradeReviewReport.findMany({
      take: 20,
      orderBy: { id: 'desc' },
    });
    const reviewsNeedingFix = reviews.filter(r => {
      const resultObj = parseJson(r.result);
      return resultObj && !resultObj.pnlPct && resultObj.return;
    });
    if (reviewsNeedingFix.length > 0) {
      console.log(`  PENDING: ${reviewsNeedingFix.length} records missing pnlPct but have return`);
      for (const rev of reviewsNeedingFix.slice(0, 3)) {
        console.log(`    ID ${rev.id}: result = ${rev.result}`);
      }
    } else {
      console.log('  DONE: All reviews have pnlPct populated');
    }

    // Insight #23 check
    console.log('\n[2] Insight #23 Check:');
    const insight23Plus = await prisma.strategyLearningInsight.findMany({
      where: { id: { gte: 23 } },
    });
    if (insight23Plus.length > 0) {
      console.log(`  DONE: Found ${insight23Plus.length} insights >= 23`);
      for (const ins of insight23Plus) {
        console.log(`    #${ins.id} - ${ins.createdAt}`);
      }
    } else {
      console.log('  PENDING: Insight #23 does not exist');
    }

    // Jan-Mar 2026 rolling sim check
    console.log('\n[3] Jan-Mar 2026 Rolling Sim Check:');
    const janMarTrades = await prisma.simulatedTrade.findMany({
      where: {
        entryDate: { gte: '2026-01-01' },
        NOT: { marketContext: { contains: '"dataQuality":"contaminated"' } }
      },
      orderBy: { entryDate: 'asc' },
    });
    if (janMarTrades.length > 0) {
      const firstDate = janMarTrades[0].entryDate;
      const lastDate = janMarTrades[janMarTrades.length - 1].entryDate;
      console.log(`  DONE: ${janMarTrades.length} trades from ${firstDate} to ${lastDate}`);
    } else {
      console.log('  PENDING: No Jan-Mar 2026 trades generated');
    }

    // Learning lock check
    console.log('\n[4] Learning Lock Status:');
    if (insights.length > 0) {
      const latestInsight = insights[0];
      const failurePatterns = parseJson(latestInsight.failurePatterns);
      const penalizedSetups = failurePatterns?.penalizedSetups || [];
      const isTrendPenalized = Array.isArray(penalizedSetups) && penalizedSetups.includes('trend');
      console.log(`  Latest Insight: #${latestInsight.id}`);
      console.log(`  Trend Penalized: ${isTrendPenalized ? 'YES (HIGH RISK)' : 'NO'}`);
      console.log(`  Penalized Setups: ${JSON.stringify(penalizedSetups)}`);
      console.log(`  Rewarded Setups: ${JSON.stringify(failurePatterns?.rewardedSetups || [])}`);
    }

    // 0c. Gap List Summary
    console.log('\n--- 0c. GAP LIST SUMMARY ---\n');
    const gaps: { task: string; status: string; detail: string }[] = [];

    // Check review remediation
    gaps.push({
      task: 'Review remediation',
      status: reviewsNeedingFix.length > 0 ? 'PENDING' : 'DONE',
      detail: reviewsNeedingFix.length > 0 ? `${reviewsNeedingFix.length} records` : 'All fixed'
    });

    // Check Insight #23
    gaps.push({
      task: 'Insight #23 (clean)',
      status: insight23Plus.length > 0 ? 'DONE' : 'PENDING',
      detail: insight23Plus.length > 0 ? `Exists` : 'Missing'
    });

    // Check Regime analysis
    gaps.push({
      task: 'Regime analysis Nov-Dec',
      status: 'UNKNOWN',
      detail: 'Check TAIEX data next'
    });

    // Check Jan-Mar sim
    gaps.push({
      task: 'Jan-Mar 2026 rolling sim',
      status: janMarTrades.length > 0 ? 'DONE' : 'PENDING',
      detail: janMarTrades.length > 0 ? `${janMarTrades.length} trades` : 'No trades'
    });

    // Check learning lock
    const failurePatterns = insights.length > 0 ? parseJson(insights[0].failurePatterns) : null;
    const penalizedSetups = failurePatterns?.penalizedSetups || [];
    const lockStatus = Array.isArray(penalizedSetups) && penalizedSetups.includes('trend')
      ? 'ACTIVE'
      : 'CLEAR';
    gaps.push({
      task: 'Learning lock',
      status: lockStatus,
      detail: lockStatus === 'ACTIVE' ? 'Trend penalized' : 'No critical penalties'
    });

    console.table(gaps);

    console.log('\n========== END PHASE 0 ==========\n');
  } catch (error) {
    console.error('Error in Phase 0:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
