const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });
(async () => {
  // Find stocks with most quotes (most data)
  const stocks = await p.stockQuote.groupBy({
    by: ['stockId'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });
  console.log('Top stocks:', stocks.map(s => `${s.stockId}(${s._count.id})`).join(', '));

  // For each top stock, check range and historical entry point
  for (const s of stocks.slice(0, 8)) {
    const first = await p.stockQuote.findFirst({
      where: { stockId: s.stockId },
      orderBy: { date: 'asc' },
      select: { date: true, close: true },
    });
    const last = await p.stockQuote.findFirst({
      where: { stockId: s.stockId },
      orderBy: { date: 'desc' },
      select: { date: true, close: true },
    });
    // Quote at ~90 days before latest (historical entry candidate)
    const entryQ = await p.stockQuote.findFirst({
      where: { stockId: s.stockId, date: { lte: '2026-01-15' } },
      orderBy: { date: 'desc' },
      select: { date: true, close: true },
    });
    // Quote at ~30 days before latest
    const entry30 = await p.stockQuote.findFirst({
      where: { stockId: s.stockId, date: { lte: '2026-03-15' } },
      orderBy: { date: 'desc' },
      select: { date: true, close: true },
    });
    // Compute % change from entry90 to now
    const pct90 = entryQ && last ? ((last.close - entryQ.close) / entryQ.close * 100).toFixed(2) : 'n/a';
    const pct30 = entry30 && last ? ((last.close - entry30.close) / entry30.close * 100).toFixed(2) : 'n/a';
    console.log(`${s.stockId}: first=${first?.date} last=${last?.date}(${last?.close}) entry90=${entryQ?.date}(${entryQ?.close}) pct90=${pct90}% entry30=${entry30?.date}(${entry30?.close}) pct30=${pct30}%`);
  }
  await p.$disconnect();
})().catch(console.error);
