/**
 * Day 8 Phase 3: Verification
 * Test that the fix produces candidates in the research snapshot
 */
import { buildAutonomousResearchSnapshot } from '../src/lib/autonomous/AutonomousResearchEngine';
import { runScreen } from '../src/lib/screen/StrategyScreenEngine';

async function main() {
  console.log('\n===== DAY 8 PHASE 3: VERIFICATION =====\n');

  // Test 1: runScreen without asOf (broken behavior - uses latest date 2026-04-17)
  console.log('[Test 1] runScreen without asOf (old behavior, only 3 stocks on 2026-04-17)...');
  const broken = await runScreen({ maxResults: 20, respectMarketRegime: true });
  console.log(`  totalScanned: ${broken.totalScanned}, candidates: ${broken.candidates.length}`);
  console.log(`  limitations: ${broken.limitations.join('; ')}`);

  // Test 2: runScreen with asOf = '2025-12-17' (simulation date)
  console.log('\n[Test 2] runScreen with asOf=2025-12-17 (fix applied)...');
  const fixed = await runScreen({ maxResults: 20, respectMarketRegime: true, asOf: '2025-12-17' });
  console.log(`  totalScanned: ${fixed.totalScanned}, candidates: ${fixed.candidates.length}`);
  if (fixed.candidates.length > 0) {
    console.log('  ✅ CANDIDATES FOUND:');
    fixed.candidates.slice(0, 5).forEach(c => {
      console.log(`    ${c.symbol} ${c.name}: bucket=${c.screenBucket}, alpha=${c.alphaScore}`);
    });
  } else {
    console.log('  ❌ Still 0 candidates — need further investigation');
    console.log(`  excluded: ${fixed.excludedCount}`);
    console.log(`  regime: ${fixed.regime} (confidence: ${fixed.regimeConfidence}%)`);
    if (fixed.excluded.length > 0) {
      console.log('  Sample excluded reasons:');
      fixed.excluded.slice(0, 5).forEach(e => console.log(`    ${e.symbol}: ${e.reason}`));
    }
  }

  // Test 3: Full buildAutonomousResearchSnapshot with asOf
  console.log('\n[Test 3] buildAutonomousResearchSnapshot({ asOf: "2025-12-17" })...');
  try {
    const snap = await buildAutonomousResearchSnapshot({ asOf: '2025-12-17' });
    console.log(`  marketState: ${snap.marketState}`);
    console.log(`  candidateStocks count: ${snap.candidateStocks.length}`);
    if (snap.candidateStocks.length > 0) {
      console.log('  ✅ SNAPSHOT HAS CANDIDATES:');
      snap.candidateStocks.slice(0, 5).forEach(c => {
        console.log(`    ${c.symbol} ${c.name}: setupType=${c.setupType}, conviction=${c.conviction}`);
      });
      // Check for fundamental/event setups
      const fundamentalCount = snap.candidateStocks.filter(c => c.setupType === 'fundamental').length;
      const eventCount = snap.candidateStocks.filter(c => c.setupType === 'event').length;
      const trendCount = snap.candidateStocks.filter(c => c.setupType === 'trend').length;
      const reboundCount = snap.candidateStocks.filter(c => c.setupType === 'rebound').length;
      console.log(`\n  Setup type distribution:`);
      console.log(`    trend: ${trendCount}, rebound: ${reboundCount}, fundamental: ${fundamentalCount}, event: ${eventCount}`);
    } else {
      console.log('  ❌ Still 0 candidates in snapshot');
      console.log(`  limitations: ${snap.limitations.join('; ')}`);
    }
  } catch (err) {
    console.error('  ❌ Error:', err);
  }

  console.log('\n===== END VERIFICATION =====\n');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
