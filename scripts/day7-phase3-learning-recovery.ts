/**
 * Day 7 Phase 3: Learning Recovery Check
 * Analyze insight progression and check if trend has recovered
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
  console.log('\n========== DAY 7 PHASE 3: LEARNING RECOVERY CHECK ==========\n');

  try {
    // Get all insights from #22 onwards
    console.log('[1] Fetching insight progression from #22 onwards...\n');
    
    const insights = await prisma.strategyLearningInsight.findMany({
      where: { id: { gte: 22 } },
      orderBy: { id: 'asc' }
    });

    if (insights.length === 0) {
      console.log('  No insights found from #22 onwards');
      process.exit(1);
    }

    // Analyze each insight's setup patterns
    console.log('[2] Insight Analysis:\n');
    
    const progressTable: any[] = [];
    
    for (const insight of insights) {
      const successPatterns = parseJson(insight.successPatterns);
      const failurePatterns = parseJson(insight.failurePatterns);
      
      // Extract setup stats
      const successSetups = successPatterns?.setupStats || {};
      const failureSetups = failurePatterns?.setupStats || {};
      
      // Count wins/losses per setup type
      const trendSuccess = successSetups.trend || 0;
      const trendFailure = failureSetups.trend || 0;
      const trendTotal = trendSuccess + trendFailure;
      const trendWinRate = trendTotal > 0 ? ((trendSuccess / trendTotal) * 100).toFixed(1) : 'N/A';

      const reboundSuccess = successSetups.rebound || 0;
      const reboundFailure = failureSetups.rebound || 0;
      const reboundTotal = reboundSuccess + reboundFailure;
      const reboundWinRate = reboundTotal > 0 ? ((reboundSuccess / reboundTotal) * 100).toFixed(1) : 'N/A';

      const fundamentalSuccess = successSetups.fundamental || 0;
      const fundamentalTotal = fundamentalSuccess + (failureSetups.fundamental || 0);
      const fundamentalWinRate = fundamentalTotal > 0 ? ((fundamentalSuccess / fundamentalTotal) * 100).toFixed(1) : 'N/A';

      const eventSuccess = successSetups.event || 0;
      const eventTotal = eventSuccess + (failureSetups.event || 0);
      const eventWinRate = eventTotal > 0 ? ((eventSuccess / eventTotal) * 100).toFixed(1) : 'N/A';

      // Check if penalized/rewarded
      const penalizedSetups = failurePatterns?.penalizedSetups || [];
      const rewardedSetups = failurePatterns?.rewardedSetups || [];
      const isTrendPenalized = Array.isArray(penalizedSetups) && penalizedSetups.includes('trend');
      const isTrendRewarded = Array.isArray(rewardedSetups) && rewardedSetups.includes('trend');

      progressTable.push({
        'Insight': `#${insight.id}`,
        'Date': new Date(insight.createdAt).toLocaleString(),
        'Trend WR': `${trendWinRate}% (${trendSuccess}/${trendTotal})`,
        'Rebound WR': `${reboundWinRate}% (${reboundSuccess}/${reboundTotal})`,
        'Fund WR': `${fundamentalWinRate}% (${fundamentalSuccess}/${fundamentalTotal})`,
        'Event WR': `${eventWinRate}% (${eventSuccess}/${eventTotal})`,
        'Trend Status': isTrendPenalized ? '❌ PENALIZED' : isTrendRewarded ? '✅ REWARDED' : '⚪ NEUTRAL'
      });
    }

    console.table(progressTable);

    // Detailed latest insight analysis
    console.log('\n[3] Latest Insight (#' + insights[insights.length - 1].id + ') Detailed Analysis:\n');
    
    const latestInsight = insights[insights.length - 1];
    const latestSuccess = parseJson(latestInsight.successPatterns);
    const latestFailure = parseJson(latestInsight.failurePatterns);
    
    console.log(`  Generated: ${latestInsight.createdAt}`);
    console.log(`  Source: ${latestInsight.sourceCount} reviews analyzed`);
    console.log(`  Summary: ${latestInsight.summary?.substring(0, 150)}...`);
    
    if (latestFailure) {
      const penalizedSetups = latestFailure.penalizedSetups || [];
      const rewardedSetups = latestFailure.rewardedSetups || [];
      
      console.log(`\n  Penalized Setups: ${penalizedSetups.length > 0 ? penalizedSetups.join(', ') : 'None'}`);
      console.log(`  Rewarded Setups: ${rewardedSetups.length > 0 ? rewardedSetups.join(', ') : 'None'}`);
    }

    // Compare #22 vs latest
    console.log('\n[4] Trend Recovery Assessment (Insight #22 vs Latest):\n');
    
    const insight22 = insights.find(i => i.id === 22);
    if (insight22 && insights.length > 0) {
      const s22 = parseJson(insight22.successPatterns);
      const f22 = parseJson(insight22.failurePatterns);
      const s22Trend = s22?.setupStats?.trend || 0;
      const f22Trend = f22?.setupStats?.trend || 0;
      const wr22 = s22Trend + f22Trend > 0 ? ((s22Trend / (s22Trend + f22Trend)) * 100).toFixed(1) : 'N/A';

      const sLatest = parseJson(latestInsight.successPatterns);
      const fLatest = parseJson(latestInsight.failurePatterns);
      const sLatestTrend = sLatest?.setupStats?.trend || 0;
      const fLatestTrend = fLatest?.setupStats?.trend || 0;
      const wrLatest = sLatestTrend + fLatestTrend > 0 ? ((sLatestTrend / (sLatestTrend + fLatestTrend)) * 100).toFixed(1) : 'N/A';

      console.log(`  Insight #22 Trend WR: ${wr22}% (${s22Trend}/${s22Trend + f22Trend})`);
      console.log(`  Latest (#${latestInsight.id}) Trend WR: ${wrLatest}% (${sLatestTrend}/${sLatestTrend + fLatestTrend})`);
      
      const wr22Num = parseFloat(wr22.toString()) || 0;
      const wrLatestNum = parseFloat(wrLatest.toString()) || 0;
      const improvement = wrLatestNum - wr22Num;
      
      if (wrLatestNum >= 50) {
        console.log(`\n  ✅ TREND RECOVERY: Win rate ≥ 50% (${wrLatestNum.toFixed(1)}%)`);
        console.log(`     Trend is no longer a liability. System learning is healing.`);
      } else if (improvement > 10) {
        console.log(`\n  📈 PARTIAL RECOVERY: +${improvement.toFixed(1)}% improvement`);
        console.log(`     Trend shows positive momentum but still below 50%.`);
      } else if (improvement > 0) {
        console.log(`\n  ↗️  SLIGHT IMPROVEMENT: +${improvement.toFixed(1)}% gain`);
        console.log(`     Trend recovery in early stages.`);
      } else {
        console.log(`\n  ❌ NO RECOVERY: ${improvement.toFixed(1)}% change (${improvement < 0 ? 'worse' : 'flat'})`);
        console.log(`     Trend penalization may be justified by persistent poor performance.`);
      }
    }

    // Check current trade generation status
    console.log('\n[5] Trade Generation Status:\n');
    
    const latestTrades = await prisma.simulatedTrade.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    if (latestTrades.length > 0) {
      console.log(`  Latest 5 trades generated:`);
      for (const trade of latestTrades) {
        const status = trade.status;
        const type = trade.setupType;
        console.log(`    #${trade.id} (${type}) ${status} - ${trade.createdAt.toLocaleString()}`);
      }
      
      // Count setup types in recent trades
      const trendCount = latestTrades.filter(t => t.setupType === 'trend').length;
      const reboundCount = latestTrades.filter(t => t.setupType === 'rebound').length;
      const fundamentalCount = latestTrades.filter(t => t.setupType === 'fundamental').length;
      const eventCount = latestTrades.filter(t => t.setupType === 'event').length;
      
      console.log(`\n  Setup distribution in recent trades:`);
      console.log(`    Trend: ${trendCount}, Rebound: ${reboundCount}, Fundamental: ${fundamentalCount}, Event: ${eventCount}`);
      
      if (trendCount > 0) {
        console.log(`\n  ✅ Trend proposals are being generated - learning lock has lifted`);
      } else if (reboundCount > 0) {
        console.log(`\n  ⚪ Only rebound proposals generated - trend still inactive or awaiting recovery`);
      }
    } else {
      console.log(`  No recent trades found`);
    }

    console.log('\n========== END PHASE 3 ==========\n');
  } catch (error) {
    console.error('Error in Phase 3:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
