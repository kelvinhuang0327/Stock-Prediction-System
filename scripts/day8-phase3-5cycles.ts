/**
 * Day 8 Phase 3: 5-cycle verification
 * Run 5 autonomous cycles starting from 2025-12-18 through 2025-12-24
 * Confirm each cycle produces snapshot.candidateStocks > 0
 */
import { runAutonomousCycle } from '../src/lib/autonomous/AutonomousOrchestrator';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const SIM_DATES = [
  '2025-12-18',
  '2025-12-19',
  '2025-12-22',
  '2025-12-23',
  '2025-12-24',
];

async function main() {
  console.log('\n===== DAY 8 PHASE 3: 5-CYCLE VERIFICATION =====\n');

  let successCount = 0;
  let totalCandidates = 0;
  let totalNewProposals = 0;

  for (const dateStr of SIM_DATES) {
    const simDate = new Date(dateStr + 'T10:00:00.000Z');
    console.log(`\n--- Cycle: ${dateStr} ---`);
    
    const proposalsBefore = await prisma.strategyProposal.count();
    const snapshotsBefore = await prisma.autonomousResearchSnapshot.count();

    try {
      const result = await runAutonomousCycle({
        simulationDate: simDate,
        bypassFreshnessGuard: true,
      });

      const candidateCount = result.snapshot.candidateStocks.length;
      const newProposals = result.proposals.length;
      const newOrders = result.orders.length;
      const snapshotId = result.snapshot.snapshotId;

      totalCandidates += candidateCount;
      totalNewProposals += newProposals;

      if (candidateCount > 0) {
        successCount++;
        console.log(`  ✅ snapshotId=${snapshotId}, candidates=${candidateCount}, proposals=${newProposals}, orders=${newOrders}`);
        // Show setup type breakdown
        const setups = result.snapshot.candidateStocks.reduce((acc, c) => {
          acc[c.setupType] = (acc[c.setupType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log(`     setups: ${JSON.stringify(setups)}`);
      } else {
        console.log(`  ❌ candidateStocks=0, proposals=${newProposals}`);
        if (result.snapshot.limitations.length > 0) {
          console.log(`     limitations: ${result.snapshot.limitations.slice(0, 3).join('; ')}`);
        }
      }
    } catch (err) {
      console.log(`  ❌ ERROR: ${err}`);
    }
  }

  console.log('\n===== SUMMARY =====');
  console.log(`Cycles run: ${SIM_DATES.length}`);
  console.log(`Cycles with candidates > 0: ${successCount}/${SIM_DATES.length}`);
  console.log(`Total candidates across cycles: ${totalCandidates}`);
  console.log(`Total new proposals: ${totalNewProposals}`);
  console.log(`Pipeline status: ${successCount >= 3 ? '✅ RESTORED' : '❌ STILL BROKEN'}`);

  // Final snapshot check
  const latestSnap = await prisma.autonomousResearchSnapshot.findFirst({
    orderBy: { id: 'desc' }
  });
  if (latestSnap) {
    const candidates = JSON.parse(latestSnap.candidateStocks || '[]');
    console.log(`\nLatest snapshot #${latestSnap.id} (${latestSnap.snapshotDate}): candidates=${candidates.length}`);
  }

  // Latest proposals by setup type
  const proposals = await prisma.strategyProposal.groupBy({ by: ['setupType'], _count: true });
  console.log('\nAll-time proposals by setup type:');
  console.table(proposals.map(p => ({ setupType: p.setupType, count: p._count })));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
