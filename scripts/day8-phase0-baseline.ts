/**
 * Day 8 Phase 0: Baseline check (5 min max)
 * Confirm the contradiction: proposals exist BUT snapshot.candidates = 0
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('\n===== DAY 8 PHASE 0: BASELINE =====\n');

  // 1. Trade status
  const tradeStatus = await prisma.simulatedTrade.groupBy({ by: ['status'], _count: true });
  console.log('[1] SimulatedTrade by status:');
  console.table(tradeStatus.map(t => ({ status: t.status, count: t._count })));

  // 2. Latest insight
  const latestInsight = await prisma.strategyLearningInsight.findFirst({ orderBy: { id: 'desc' } });
  console.log('\n[2] Latest Insight:');
  console.log(`  id: ${latestInsight?.id}, sourceCount: ${latestInsight?.sourceCount}`);

  // 3. Proposals by setup type
  const proposals = await prisma.strategyProposal.groupBy({ by: ['setupType'], _count: true });
  console.log('\n[3] StrategyProposal by setupType:');
  console.table(proposals.map(p => ({ setupType: p.setupType, count: p._count })));

  // 4. Latest 3 snapshots — inspect candidates field
  console.log('\n[4] Latest 3 AutonomousResearchSnapshot:');
  const snapshots = await prisma.autonomousResearchSnapshot.findMany({
    orderBy: { id: 'desc' },
    take: 3,
  });
  for (const snap of snapshots) {
    let candidateCount = 0;
    try {
      const candidates = JSON.parse(snap.candidateStocks || '[]');
      candidateCount = Array.isArray(candidates) ? candidates.length : 0;
    } catch {}
    console.log(`  snapshot #${snap.id}: snapshotDate=${snap.snapshotDate}, candidateStocks count=${candidateCount}`);
    console.log(`    raw candidateStocks (first 200 chars): ${(snap.candidateStocks || 'null').substring(0, 200)}`);
    // Also check all fields
    console.log(`    marketState: ${snap.marketState?.substring(0, 80)}`);
    console.log(`    topInsights: ${snap.topInsights?.substring(0, 100)}`);
  }

  // 5. Latest proposals — do their symbols appear in any snapshot?
  console.log('\n[5] Latest 10 Proposals with symbols:');
  const latestProps = await prisma.strategyProposal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, symbol: true, setupType: true, createdAt: true, snapshotId: true }
  });
  console.table(latestProps.map(p => ({
    id: p.id, symbol: p.symbol, setup: p.setupType,
    snapshotId: p.snapshotId, createdAt: new Date(p.createdAt).toLocaleTimeString()
  })));

  // 6. Check if proposal snapshotId matches the 0-candidates snapshots
  const snapshotIds = latestProps.map(p => p.snapshotId).filter(Boolean);
  const uniqueSnapIds = [...new Set(snapshotIds)];
  console.log(`\n  Proposals reference snapshotIds: ${uniqueSnapIds.join(', ')}`);

  // Show what those snapshots contain
  for (const sid of uniqueSnapIds.slice(0, 3)) {
    const s = await prisma.autonomousResearchSnapshot.findUnique({ where: { id: sid } });
    if (s) {
      let candidateCount = 0;
      try { candidateCount = JSON.parse(s.candidateStocks || '[]').length; } catch {}
      console.log(`  Snapshot #${sid} (proposals came from here): candidates=${candidateCount}`);
    }
  }

  console.log('\n===== END PHASE 0 =====\n');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
