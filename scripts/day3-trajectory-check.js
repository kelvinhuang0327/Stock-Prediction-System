/**
 * Check price trajectories for historical trades:
 * When does each stock first hit shadow stop (-4.5% trend, -3.8% rebound) or target (+6% trend, +4.5% rebound)?
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });

const ENTRY_DATE = '2026-01-15';
const CHECKS = [
  { symbol: '1326', setupType: 'trend', target: 0.06, stop: -0.045, maxHoldDays: 9 },
  { symbol: '1560', setupType: 'trend', target: 0.06, stop: -0.045, maxHoldDays: 9 },
  { symbol: '00891', setupType: 'trend', target: 0.06, stop: -0.045, maxHoldDays: 9 },
  { symbol: '00738U', setupType: 'rebound', target: 0.045, stop: -0.038, maxHoldDays: 6 },
  { symbol: '00712', setupType: 'rebound', target: 0.045, stop: -0.038, maxHoldDays: 6 },
];

async function main() {
  console.log(`\n=== Price Trajectory Check (entry=${ENTRY_DATE}) ===\n`);
  console.log('shadow trend thresholds: target=+6%, stop=-4.5%, maxHoldDays=9');
  console.log('shadow rebound thresholds: target=+4.5%, stop=-3.8%, maxHoldDays=6\n');

  for (const c of CHECKS) {
    // Get entry quote
    const entryQ = await p.stockQuote.findFirst({
      where: { stockId: c.symbol, date: { lte: ENTRY_DATE } },
      orderBy: { date: 'desc' },
      select: { date: true, close: true },
    });
    if (!entryQ) { console.log(`${c.symbol}: NO ENTRY QUOTE`); continue; }

    const fillPrice = entryQ.close * 1.0016;

    // Get subsequent 30 quotes
    const quotes = await p.stockQuote.findMany({
      where: { stockId: c.symbol, date: { gt: entryQ.date } },
      orderBy: { date: 'asc' },
      take: 30,
      select: { date: true, high: true, low: true, close: true },
    });

    // Simulate each day
    let highSince = entryQ.close;
    let outcome = `time (${c.maxHoldDays}d)`;
    let exitDay = c.maxHoldDays;
    let exitPct = 0;

    for (let i = 0; i < Math.min(quotes.length, c.maxHoldDays); i++) {
      const q = quotes[i];
      highSince = Math.max(highSince, q.high);
      const dayClose = q.close;
      const pnl = (dayClose - fillPrice) / fillPrice;
      const trailing = (dayClose - highSince) / highSince;

      // Check target (using close)
      if (pnl >= c.target) {
        outcome = `TARGET +${(pnl*100).toFixed(2)}%`;
        exitDay = i + 1;
        exitPct = pnl * 100;
        break;
      }
      // Check stop (using close)
      if (pnl <= c.stop) {
        outcome = `STOP ${(pnl*100).toFixed(2)}%`;
        exitDay = i + 1;
        exitPct = pnl * 100;
        break;
      }
      // Check trailing (if highSince > fillPrice by 1% and drop 5% from high)
      if (highSince > fillPrice * 1.01 && trailing <= -0.05) {
        outcome = `TRAILING ${(pnl*100).toFixed(2)}%`;
        exitDay = i + 1;
        exitPct = pnl * 100;
        break;
      }
      // At maxHoldDays
      if (i === c.maxHoldDays - 1) {
        outcome = `TIME ${(pnl*100).toFixed(2)}%`;
        exitDay = i + 1;
        exitPct = pnl * 100;
      }
    }

    // Show daily trajectory for first 10 days
    const days = quotes.slice(0, 15).map((q, i) => {
      const pnl = ((q.close - fillPrice) / fillPrice * 100).toFixed(1);
      return `D${i+1}:${pnl}%`;
    }).join(' ');

    console.log(`${c.symbol} (${c.setupType}): entry=${entryQ.date} fill=${fillPrice.toFixed(2)}`);
    console.log(`  → PREDICTED EXIT: ${outcome} at day ${exitDay}`);
    console.log(`  → trajectory: ${days}\n`);
  }

  await p.$disconnect();
}

main().catch(console.error);
