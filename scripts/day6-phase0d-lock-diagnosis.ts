import { runAutonomousDailyCycle } from '../src/lib/jobs/autonomousJobRunners';
import { prisma } from '../src/lib/prisma';

function parseJsonSafe(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

type LockStatus = 'ACTIVE' | 'PARTIAL' | 'CLEAR';

async function main() {
  console.log('=== PHASE 0d - Learning Lock Diagnosis ===');

  const result = await runAutonomousDailyCycle({
    triggerSource: 'cli',
    force: true,
    scheduledFor: new Date('2026-04-19T09:00:00+08:00'),
  });

  const outcome = result.outcome;
  const snapshotId = outcome?.snapshot?.snapshotId ?? null;
  const proposalsGenerated = outcome?.proposals?.length ?? 0;
  const ordersGenerated = outcome?.orders?.length ?? 0;

  console.log(`Job status: ${result.jobRun.status}`);
  console.log(`Snapshot ID: ${snapshotId}`);
  console.log(`Proposals generated: ${proposalsGenerated}`);
  console.log(`Orders generated: ${ordersGenerated}`);

  if (!snapshotId) {
    console.log('Learning lock status: ACTIVE (no snapshot/proposals generated)');
    return;
  }

  const proposalRows = await prisma.strategyProposal.findMany({
    where: { snapshotId },
    select: {
      id: true,
      symbol: true,
      setupType: true,
      state: true,
      positionSizing: true,
      decisionMeta: true,
    },
    orderBy: { id: 'asc' },
  });

  const sizingRows: Array<{
    id: number;
    symbol: string;
    setupType: string;
    state: string;
    baseSizing: number | null;
    learningAdjustedSizing: number | null;
    riskAdjustedSizing: number | null;
    rejectionReason: string | null;
  }> = proposalRows.map((row) => {
    const meta = parseJsonSafe(row.decisionMeta);
    const learningFeedback = (meta.learningFeedback ?? {}) as Record<string, unknown>;
    const assessment = (meta.assessment ?? {}) as Record<string, unknown>;

    const baseSizing = Number(learningFeedback.baseSizing);
    const learningAdjustedSizing = Number(learningFeedback.adjustedSizing);
    const riskAdjustedSizing = Number(assessment.adjustedPositionSizing);

    return {
      id: row.id,
      symbol: row.symbol,
      setupType: row.setupType,
      state: row.state,
      baseSizing: Number.isFinite(baseSizing) ? baseSizing : null,
      learningAdjustedSizing: Number.isFinite(learningAdjustedSizing) ? learningAdjustedSizing : null,
      riskAdjustedSizing: Number.isFinite(riskAdjustedSizing) ? riskAdjustedSizing : null,
      rejectionReason: typeof assessment.rejectionReason === 'string' ? assessment.rejectionReason : null,
    };
  });

  const belowFloor = sizingRows.filter((r) => r.riskAdjustedSizing !== null && r.riskAdjustedSizing < 0.01);
  const lowSizingRejects = sizingRows.filter((r) => (r.rejectionReason ?? '').includes('倉位過低'));
  const stateCount = sizingRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1;
    return acc;
  }, {});

  console.log('Proposal states:', stateCount);
  console.log(`adjSizing below 0.01 floor: ${belowFloor.length}`);
  console.log(`Rejected due to low sizing: ${lowSizingRejects.length}`);

  console.log('Sizing details:');
  for (const r of sizingRows) {
    console.log(
      `  #${r.id} ${r.symbol} ${r.setupType} state=${r.state} base=${r.baseSizing ?? 'n/a'} learningAdj=${r.learningAdjustedSizing ?? 'n/a'} riskAdj=${r.riskAdjustedSizing ?? 'n/a'}${r.rejectionReason ? ` reason=${r.rejectionReason}` : ''}`,
    );
  }

  let lockStatus: LockStatus;
  if (proposalsGenerated === 0 || (proposalRows.length > 0 && lowSizingRejects.length === proposalRows.length)) {
    lockStatus = 'ACTIVE';
  } else if (ordersGenerated === 0 || belowFloor.length > 0) {
    lockStatus = 'PARTIAL';
  } else {
    lockStatus = 'CLEAR';
  }

  console.log(`Learning lock status: ${lockStatus}${lockStatus === 'ACTIVE' ? ' (no proposals or all blocked by low sizing)' : lockStatus === 'PARTIAL' ? ' (proposals exist but partially blocked)' : ' (proposals and execution flowing)'}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
