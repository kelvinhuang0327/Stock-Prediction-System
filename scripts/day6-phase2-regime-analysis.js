'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

const START = '2025-11-18';
const END = '2025-12-17';

function pct(n) {
  return `${n.toFixed(2)}%`;
}

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  printHeader('PHASE 2 - REGIME ANALYSIS (2025-11-18 ~ 2025-12-17)');

  const indexRows = await prisma.marketIndex.findMany({
    where: {
      date: { gte: START, lte: END },
      name: { contains: '加權' },
    },
    orderBy: { date: 'asc' },
    select: { date: true, name: true, value: true, changePercent: true },
  });

  // Fallback: if no explicit TAIEX name match, use all market index rows in window.
  const allRows = indexRows.length > 0
    ? indexRows
    : await prisma.marketIndex.findMany({
      where: { date: { gte: START, lte: END } },
      orderBy: [{ name: 'asc' }, { date: 'asc' }],
      select: { date: true, name: true, value: true, changePercent: true },
    });

  if (allRows.length === 0) {
    console.log('No MarketIndex rows found in requested window.');
  } else {
    console.log(`MarketIndex rows: ${allRows.length}`);
    const grouped = new Map();
    for (const r of allRows) {
      if (!grouped.has(r.name)) grouped.set(r.name, []);
      grouped.get(r.name).push(r);
    }

    for (const [name, rows] of grouped.entries()) {
      const first = rows[0];
      const last = rows[rows.length - 1];
      const ret = first.value ? ((last.value - first.value) / first.value) * 100 : 0;
      const upDays = rows.filter((r) => Number(r.changePercent) > 0).length;
      const downDays = rows.filter((r) => Number(r.changePercent) < 0).length;
      console.log(`  ${name}: first=${first.date} ${first.value.toFixed(2)} last=${last.date} ${last.value.toFixed(2)} return=${pct(ret)} upDays=${upDays} downDays=${downDays}`);
    }
  }

  const dailySnapshot = await prisma.dailyMarketSnapshot.findMany({
    where: { snapshotDate: { gte: START, lte: END } },
    orderBy: { snapshotDate: 'asc' },
    select: { snapshotDate: true, regime: true, regimeConfidence: true },
  });

  console.log(`\nDailyMarketSnapshot rows: ${dailySnapshot.length}`);
  if (dailySnapshot.length > 0) {
    const regimeCount = {};
    for (const r of dailySnapshot) {
      regimeCount[r.regime] = (regimeCount[r.regime] ?? 0) + 1;
    }
    console.log('Regime distribution:', regimeCount);
  } else {
    console.log('DailyMarketSnapshot not populated for this period; fallback to AutonomousResearchSnapshot.');
  }

  const autoSnapshots = await prisma.autonomousResearchSnapshot.findMany({
    where: { snapshotDate: { gte: START, lte: END } },
    orderBy: { snapshotDate: 'asc' },
    select: { snapshotDate: true, marketState: true },
  });

  console.log(`AutonomousResearchSnapshot rows in window: ${autoSnapshots.length}`);
  if (autoSnapshots.length > 0) {
    const stateCount = {};
    for (const r of autoSnapshots) {
      stateCount[r.marketState] = (stateCount[r.marketState] ?? 0) + 1;
    }
    console.log('MarketState distribution:', stateCount);
  }

  // Pull Day5 batch split performance directly from rolling-sim trades by entryDate windows.
  const periodTrades = await prisma.simulatedTrade.findMany({
    where: {
      status: { in: ['shadow-closed', 'closed'] },
      marketContext: { contains: 'rolling-simulation' },
      entryDate: { gte: START, lte: END },
    },
    select: { id: true, setupType: true, pnlPct: true, entryDate: true },
  });

  const total = periodTrades.length;
  const wins = periodTrades.filter((t) => Number(t.pnlPct ?? 0) > 0).length;
  const avg = total > 0 ? periodTrades.reduce((s, t) => s + Number(t.pnlPct ?? 0), 0) / total : 0;
  console.log(`\nRolling-sim trades in window: total=${total} wins=${wins} winRate=${total ? ((wins/total)*100).toFixed(1) : '0.0'}% avgPnl=${avg.toFixed(2)}%`);

  // Verdict heuristic.
  let indexReturn = null;
  if (allRows.length > 1) {
    const first = allRows[0];
    const last = allRows[allRows.length - 1];
    indexReturn = ((last.value - first.value) / first.value) * 100;
  }

  const weakRegimeSignal =
    (indexReturn !== null && indexReturn <= -3.0) ||
    (autoSnapshots.filter((s) => s.marketState === 'defensive' || s.marketState === '震盪').length >= Math.ceil(autoSnapshots.length * 0.6));

  let verdict = 'INCONCLUSIVE';
  if (weakRegimeSignal && avg < 0) verdict = 'REGIME-DRIVEN';
  else if (!weakRegimeSignal && avg < 0) verdict = 'SETUP-DRIVEN';

  console.log(`\nVerdict: Nov-Dec poor performance = ${verdict}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
