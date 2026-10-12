const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });
(async () => {
  const quoteCount = await p.stockQuote.count();
  const latestQ = await p.stockQuote.findFirst({ orderBy: { date: 'desc' }, select: { date: true, stockId: true } });
  const chipCount = await p.institutionalChip.count();
  const latestChip = await p.institutionalChip.findFirst({ orderBy: { date: 'desc' }, select: { date: true, stockId: true } });
  const revCount = await p.monthlyRevenue.count();
  const finCount = await p.financialReport.count();
  const latestEvent = await p.newsEvent.findFirst({ orderBy: { publishedAt: 'desc' }, select: { publishedAt: true } });

  function daysSince(d) {
    if (!d) return null;
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  }

  const dQ = daysSince(latestQ && latestQ.date);
  const dC = daysSince(latestChip && latestChip.date);
  const dE = daysSince(latestEvent && latestEvent.publishedAt);

  console.log(JSON.stringify({
    quotes: {
      count: quoteCount,
      latestDate: latestQ && latestQ.date,
      daysSince: dQ,
      state: dQ != null && dQ <= 5 ? 'fresh' : 'stale'
    },
    chip: {
      count: chipCount,
      latestDate: latestChip && latestChip.date,
      daysSince: dC,
      state: dC != null && dC <= 120 ? 'ok' : 'stale'
    },
    revenue: { monthlyCount: revCount, financialCount: finCount },
    events: {
      count: 167,
      latestDate: latestEvent && latestEvent.publishedAt.toISOString().slice(0, 10),
      freshnessDays: dE,
      state: dE != null && dE <= 1 ? 'fresh' : dE != null && dE <= 3 ? 'degraded' : 'stale'
    }
  }, null, 2));
  await p.$disconnect();
})().catch(console.error);
