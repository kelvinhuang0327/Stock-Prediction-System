import { runAutonomousDailyCycle } from '../src/lib/jobs/autonomousJobRunners';
import { prisma } from '../src/lib/prisma';

async function runOneCycle(iso: string) {
  const res = await runAutonomousDailyCycle({
    triggerSource: 'cli',
    force: true,
    scheduledFor: new Date(iso),
  });
  return res.outcome;
}

function countSetups(proposals: Array<{ setupType: string }>) {
  const out: Record<string, number> = {};
  for (const p of proposals) out[p.setupType] = (out[p.setupType] ?? 0) + 1;
  return out;
}

async function main() {
  console.log('=== PHASE 4 - FUNDAMENTAL / EVENT SETUP EXPLORATION ===');

  const latestInsight = await prisma.strategyLearningInsight.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, failurePatterns: true },
  });

  const penalizedSetups: string[] = [];
  if (latestInsight?.failurePatterns) {
    try {
      const patterns = JSON.parse(latestInsight.failurePatterns) as string[];
      for (const p of patterns) {
        const m = p.match(/^(\w+)：(\d+)/);
        if (m && Number(m[2]) >= 3) penalizedSetups.push(m[1]);
      }
    } catch {
      // noop
    }
  }

  console.log(`Latest insight #${latestInsight?.id ?? 'n/a'} penalizedSetups=${JSON.stringify(penalizedSetups)}`);

  const base = new Date('2026-04-19T09:00:00+08:00').getTime();
  const cycles: Array<{ i: number; proposalCount: number; setupCount: Record<string, number> }> = [];

  for (let i = 0; i < 5; i++) {
    const dt = new Date(base + i * 60 * 1000).toISOString();
    const out = await runOneCycle(dt);
    const proposals = (out?.proposals ?? []) as Array<{ setupType: string }>;
    cycles.push({
      i: i + 1,
      proposalCount: proposals.length,
      setupCount: countSetups(proposals),
    });
    console.log(`Cycle ${i + 1}: proposals=${proposals.length} setupBreakdown=${JSON.stringify(cycles[i].setupCount)}`);
  }

  const eventN = cycles.reduce((s, c) => s + (c.setupCount.event ?? 0), 0);
  const fundamentalN = cycles.reduce((s, c) => s + (c.setupCount.fundamental ?? 0), 0);

  console.log(`Fundamental proposals generated: ${fundamentalN}`);
  console.log(`Event proposals generated: ${eventN}`);

  const latestSnapshot = await prisma.autonomousResearchSnapshot.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, snapshotDate: true, candidateStocks: true, limitations: true },
  });

  if (latestSnapshot) {
    let candidates: Array<{ setupType?: string }> = [];
    let limitations: string[] = [];
    try { candidates = JSON.parse(latestSnapshot.candidateStocks || '[]'); } catch {}
    try { limitations = JSON.parse(latestSnapshot.limitations || '[]'); } catch {}
    const bySetup: Record<string, number> = {};
    for (const c of candidates) {
      const key = c.setupType || 'unknown';
      bySetup[key] = (bySetup[key] ?? 0) + 1;
    }
    console.log(`Latest snapshot #${latestSnapshot.id} (${latestSnapshot.snapshotDate}) candidate setup distribution=${JSON.stringify(bySetup)}`);
    if (limitations.length > 0) console.log(`Latest snapshot limitations=${JSON.stringify(limitations)}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
