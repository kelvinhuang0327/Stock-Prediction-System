/**
 * Phase 1c: Generate clean Insight #20 using StrategyLearningEngine
 * (with contamination filter active)
 *
 * Calls buildStrategyLearningInsight() + persistStrategyLearningInsight() directly.
 */
import { buildStrategyLearningInsight, persistStrategyLearningInsight } from '../src/lib/autonomous/StrategyLearningEngine';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('=== Phase 1c: Generate Clean Insight #20 ===\n');

  const insight = await buildStrategyLearningInsight();

  if (!insight) {
    console.log('ERROR: buildStrategyLearningInsight returned null — no clean reports available');
    process.exit(1);
  }

  console.log('\n--- Clean Insight Preview ---');
  console.log('summary:', insight.summary);
  console.log('successPatterns:', JSON.stringify(insight.successPatterns));
  console.log('failurePatterns:', JSON.stringify(insight.failurePatterns));
  console.log('adjustmentSuggestions:', JSON.stringify(insight.adjustmentSuggestions));
  console.log('sourceCount:', insight.sourceCount);
  console.log('limitations:', JSON.stringify(insight.limitations));

  const saved = await persistStrategyLearningInsight(insight);
  console.log(`\n✓ Persisted as Insight #${saved.id} (generatedAt=${saved.generatedAt})`);

  // Verify it's now the latest
  const latest = await prisma.$queryRawUnsafe<Array<{ id: number; summary: string; sourceCount: number }>>(
    'SELECT id, summary, sourceCount FROM StrategyLearningInsight ORDER BY createdAt DESC LIMIT 1',
  );
  if (latest[0]) {
    console.log(`\n✓ Latest insight in DB: #${latest[0].id} (sourceCount=${latest[0].sourceCount})`);
    console.log('  summary:', latest[0].summary.slice(0, 120) + '...');
    if (latest[0].id !== saved.id) {
      console.warn('WARNING: Latest insight is NOT the one we just generated!');
    }
  }
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
