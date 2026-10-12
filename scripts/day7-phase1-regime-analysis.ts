/**
 * Day 7 Phase 1: Regime Analysis (Nov 18 - Dec 17, 2025)
 * Verify if poor Nov-Dec trend performance was regime-driven
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n========== DAY 7 PHASE 1: REGIME ANALYSIS ==========\n');

  try {
    // Check TAIEX data for Nov 18 - Dec 17, 2025
    console.log('[1] Fetching TAIEX data for Nov 18 - Dec 17, 2025...\n');
    
    const taiexData = await prisma.marketIndex.findMany({
      where: {
        name: 'TAIEX',
        date: {
          gte: '2025-11-18',
          lte: '2025-12-17'
        }
      },
      orderBy: { date: 'asc' }
    });

    if (taiexData.length === 0) {
      console.log('  ⚠️  No TAIEX data found for Nov 18 - Dec 17, 2025');
      console.log('  Checking for any TAIEX data available...\n');
      const anyTaiex = await prisma.marketIndex.findMany({
        where: { name: 'TAIEX' },
        orderBy: { date: 'desc' },
        take: 5
      });
      console.log('  Latest TAIEX records:');
      for (const rec of anyTaiex) {
        console.log(`    ${rec.date}: ${rec.value} (${rec.changePercent > 0 ? '+' : ''}${rec.changePercent}%)`);
      }
      console.log('\n  REGIME ANALYSIS: INCONCLUSIVE (no data)\n');
    } else {
      // Compute regime statistics
      const startRecord = taiexData[0];
      const endRecord = taiexData[taiexData.length - 1];
      const periodReturn = ((endRecord.value - startRecord.value) / startRecord.value) * 100;
      
      console.log(`  Start: ${startRecord.date} = ${startRecord.value}`);
      console.log(`  End:   ${endRecord.date} = ${endRecord.value}`);
      console.log(`  Period Return: ${periodReturn.toFixed(2)}%`);
      console.log(`  Trading Days: ${taiexData.length}\n`);

      // Print daily data for inspection
      console.log('[2] Daily TAIEX Movement:\n');
      for (const rec of taiexData) {
        const sign = rec.changePercent >= 0 ? '+' : '';
        console.log(`  ${rec.date}: ${rec.value.toFixed(0)} (${sign}${rec.changePercent.toFixed(2)}%)`);
      }

      console.log('\n[3] Regime Classification:\n');
      
      if (periodReturn < -5) {
        console.log(`  📊 REGIME: BEAR MARKET (${periodReturn.toFixed(2)}% decline)`);
        console.log(`  Verdict: Poor Nov-Dec trend performance is REGIME-DRIVEN`);
        console.log(`  Implication: System correctly learned that trend fails in bear markets`);
      } else if (periodReturn > 5) {
        console.log(`  📊 REGIME: BULL MARKET (${periodReturn.toFixed(2)}% gain)`);
        console.log(`  Verdict: Trend failure in bull market is SETUP-DRIVEN`);
        console.log(`  Implication: System trend-following logic may be defective`);
      } else if (Math.abs(periodReturn) <= 3) {
        console.log(`  📊 REGIME: SIDEWAYS/RANGE-BOUND (${periodReturn.toFixed(2)}% change)`);
        console.log(`  Verdict: Poor trend performance is PARTIALLY SETUP-DRIVEN`);
        console.log(`  Implication: System should have reduced trend sizing in sideways regime`);
      } else {
        console.log(`  📊 REGIME: MIXED (${periodReturn.toFixed(2)}% change)`);
        console.log(`  Verdict: Unclear - performance is regime-context dependent`);
      }

      console.log(`\n  💡 Impact on Day 6 Learning:`);
      if (periodReturn < -5) {
        console.log(`     The system's penalization of trend during Dec 2025 was JUSTIFIED`);
        console.log(`     by poor regime. Learning: REGIME-DRIVEN, not over-penalized.`);
      } else if (periodReturn > 5) {
        console.log(`     The system failed to catch trend in a BULL market.`);
        console.log(`     Learning: Over-penalization suspected, needs recovery test.`);
      } else {
        console.log(`     Context: Sideways regime makes trend-following unreliable.`);
        console.log(`     Learning: Correct to penalize, but regime-dependent.`);
      }
    }

    console.log('\n========== END PHASE 1 ==========\n');
  } catch (error) {
    console.error('Error in Phase 1:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
