const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });
(async () => {
  const open = await p.simulatedTrade.findMany({
    where: { status: { in: ['open', 'shadow-open'] } },
    select: {
      id: true, symbol: true, setupType: true, tradeMode: true, status: true,
      entryDate: true, entryPrice: true, simulatedFillPrice: true,
    },
    orderBy: { entryDate: 'desc' },
  });
  console.log('Open trades:', JSON.stringify(open, null, 2));
  
  const recent = await p.simulatedTrade.findMany({
    where: { status: { in: ['closed', 'shadow-closed'] } },
    select: {
      id: true, symbol: true, setupType: true, tradeMode: true, status: true,
      exitReason: true, pnlPct: true, holdingDays: true, exitTime: true,
    },
    orderBy: { exitTime: 'desc' },
    take: 10,
  });
  console.log('Recent closed:', JSON.stringify(recent, null, 2));

  const exitDist = await p.simulatedTrade.groupBy({
    by: ['exitReason'],
    where: { status: { in: ['closed', 'shadow-closed'] } },
    _count: { id: true },
  });
  console.log('Exit dist:', JSON.stringify(exitDist, null, 2));

  await p.$disconnect();
})().catch(console.error);
