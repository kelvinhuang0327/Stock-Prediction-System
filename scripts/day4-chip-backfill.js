/**
 * Day 4 Phase 1 — Chip Data Backfill
 * Fetches TWSE T86 institutional chip data for each missing trading day.
 * Current gap: 2026-03-18 → today (31 days stale)
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });

// Date helpers
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0=Sun, 6=Sat
  return dow === 0 || dow === 6;
}

function getTradingDays(start, end) {
  const days = [];
  let cur = start;
  while (cur <= end) {
    if (!isWeekend(cur)) days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

async function syncOneDay(dateStr) {
  const targetDate = dateStr.replace(/-/g, '');
  const url = `https://www.twse.com.tw/rwd/zh/fund/T86?date=${targetDate}&selectType=ALL&response=json`;
  
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockSim/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return { date: dateStr, success: false, count: 0, error: `HTTP ${resp.status}` };
    
    const data = await resp.json();
    if (data?.stat !== 'OK' || !Array.isArray(data?.data) || data.data.length === 0) {
      return { date: dateStr, success: true, count: 0, note: 'non-trading-day or no data' };
    }

    const validStocks = await p.stock.findMany({ select: { id: true } });
    const validIds = new Set(validStocks.map(s => s.id));

    const clean = (s) => parseFloat(String(s).replace(/,/g, '').replace(/--/g, '0')) || 0;
    let count = 0;
    const upserts = [];

    for (const row of data.data) {
      const stockId = String(row[0]).trim();
      if (!validIds.has(stockId)) continue;
      const foreignBuy = clean(row[4]);
      const trustBuy   = clean(row[7]);
      const dealerBuy  = clean(row[8]);
      const totalBuy   = clean(row[9]);
      upserts.push(
        p.institutionalChip.upsert({
          where: { stockId_date: { stockId, date: dateStr } },
          update: { foreignBuy, trustBuy, dealerBuy, totalBuy },
          create: { stockId, date: dateStr, foreignBuy, trustBuy, dealerBuy, totalBuy },
        }).then(() => { count++; })
      );
    }

    // Batch upserts
    for (let i = 0; i < upserts.length; i += 50) {
      await Promise.all(upserts.slice(i, i + 50));
    }

    return { date: dateStr, success: true, count };
  } catch (err) {
    return { date: dateStr, success: false, count: 0, error: String(err) };
  }
}

async function main() {
  console.log('\n=== PHASE 1: CHIP DATA BACKFILL ===\n');

  // Check current latest chip date
  const latestChip = await p.institutionalChip.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  console.log(`Current latest chip date: ${latestChip?.date ?? 'none'}`);

  const today = new Date().toISOString().slice(0, 10);
  const startFrom = latestChip?.date ? addDays(latestChip.date, 1) : '2026-03-19';
  const endDate = addDays(today, -1); // yesterday (today's data may not be published yet)

  console.log(`Backfill range: ${startFrom} → ${endDate}`);

  const tradingDays = getTradingDays(startFrom, endDate);
  console.log(`Trading days to sync: ${tradingDays.length}\n`);

  if (tradingDays.length === 0) {
    console.log('No missing trading days. Chip data is up to date.');
    await p.$disconnect();
    return;
  }

  let totalInserted = 0;
  let succeeded = 0;
  let failed = 0;
  let nonTrading = 0;

  for (const day of tradingDays) {
    const result = await syncOneDay(day);
    if (result.success && result.count > 0) {
      totalInserted += result.count;
      succeeded++;
      console.log(`  ✓ ${day}: ${result.count} records`);
    } else if (result.success && result.count === 0) {
      nonTrading++;
      console.log(`  - ${day}: no data (${result.note ?? 'holiday/no data'})`);
    } else {
      failed++;
      console.log(`  ✗ ${day}: FAILED — ${result.error}`);
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nSummary: ${succeeded} days synced (${totalInserted} records), ${nonTrading} non-trading, ${failed} failed`);

  // Verify new latest chip date
  const newLatest = await p.institutionalChip.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  const now = new Date(today + 'T00:00:00Z');
  const latestDate = new Date((newLatest?.date ?? today) + 'T00:00:00Z');
  const daysSince = Math.floor((now - latestDate) / (24 * 60 * 60 * 1000));
  console.log(`\nNew latest chip date: ${newLatest?.date ?? 'none'} (${daysSince}d ago)`);
  console.log(`Chip freshness: ${daysSince <= 7 ? 'FRESH (≤7d)' : daysSince <= 30 ? 'DEGRADED (≤30d)' : 'STALE (>30d)'}`);

  await p.$disconnect();
}

main().catch(console.error);
