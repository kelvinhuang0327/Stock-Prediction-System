import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';

// Use local dev DB explicitly when running as script
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/dev.db';

async function main() {
  const outPath = path.join(__dirname, '..', 'docs', 'reports', 'price_data_quality.json');
  const now = new Date();
  const generatedAt = now.toISOString();

  // Get market trading days for last 30 calendar days
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since30Str = since30.toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD

  const marketDays = await prisma.marketIndex.findMany({
    where: { date: { gte: since30Str } },
    select: { date: true }
  });
  const marketDatesSet = new Set(marketDays.map(d => d.date));

  // Active simulated trades -> interpret as Watchlist items with quantity > 0
  const activeWatchlist = await prisma.watchlist.findMany({ where: { quantity: { gt: 0 } } });
  const activeSymbols = activeWatchlist.map(w => w.stockId);

  // Current candidates -> latest DailyCandidateSnapshot symbols in last 7 days
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since7Str = since7.toISOString().slice(0,10);
  const recentCandidates = await prisma.dailyCandidateSnapshot.findMany({
    where: { snapshotDate: { gte: since7Str } },
    select: { symbol: true }
  });
  const candidateSymbols = Array.from(new Set(recentCandidates.map(c => c.symbol)));

  const symbols = Array.from(new Set([...activeSymbols, ...candidateSymbols]));

  const perSymbol: any[] = [];

  for (const stockId of symbols) {
    // latest quote row
    const latestQuoteRow = await prisma.stockQuote.findFirst({ where: { stockId }, orderBy: { date: 'desc' } });
    const latestCreatedAtRow = await prisma.stockQuote.findFirst({ where: { stockId }, orderBy: { createdAt: 'desc' } });

    const latest_quote_date = latestQuoteRow?.date ?? null;
    const latest_quote_createdAt = latestCreatedAtRow?.createdAt?.toISOString?.() ?? null;
    const latest_close = latestQuoteRow?.close ?? null;

    // zero-volume rows (volume <= 0) in last 30 days
    const zeroVolumeCount = await prisma.stockQuote.count({ where: { stockId, date: { gte: since30Str }, volume: { lte: 0 } } });

    // OHLC anomalies in last 30 days
    const anomalies = await prisma.stockQuote.findMany({
      where: {
        stockId,
        date: { gte: since30Str },
        OR: [
          { high: { lt: 0 } },
          { low: { lt: 0 } },
          { open: { lt: 0 } },
          { close: { lt: 0 } },
          // high < low
          { AND: [ { high: { lt: 0 } }, { low: { gt: 0 } } ] } // placeholder to include improbable combos
        ]
      },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true }
    });

    // More precise anomaly checks: check per-row where high < low or open > high or open < low or close > high or close < low
    const ohlcBadRows = [] as any[];
    const recentRows = await prisma.stockQuote.findMany({ where: { stockId, date: { gte: since30Str } }, select: { date: true, open: true, high: true, low: true, close: true, volume: true } });
    for (const r of recentRows) {
      const problems: string[] = [];
      if (r.high < r.low) problems.push('high_lt_low');
      if (r.open > r.high || r.open < r.low) problems.push('open_outside_high_low');
      if (r.close > r.high || r.close < r.low) problems.push('close_outside_high_low');
      if (r.volume <= 0) problems.push('zero_or_negative_volume');
      if (problems.length > 0) ohlcBadRows.push({ date: r.date, issues: problems, row: r });
    }

    // missing trading days in last 30 days (compare marketDatesSet)
    const symbolDates = await prisma.stockQuote.findMany({ where: { stockId, date: { gte: since30Str } }, select: { date: true } });
    const symbolDatesSet = new Set(symbolDates.map(d => d.date));
    let missingCount = 0;
    for (const d of marketDatesSet) if (!symbolDatesSet.has(d)) missingCount++;

    const is_stale = latest_quote_createdAt ? ((Date.now() - new Date(latest_quote_createdAt).getTime()) > (48 * 60 * 60 * 1000)) : true;

    // name lookup
    const stock = await prisma.stock.findUnique({ where: { id: stockId } });

    perSymbol.push({
      stockId,
      name: stock?.name ?? null,
      latest_quote_date,
      latest_quote_createdAt,
      latest_close,
      zero_volume_rows: zeroVolumeCount,
      ohlc_anomalies: ohlcBadRows.length,
      ohlc_bad_rows: ohlcBadRows.slice(0,20),
      missing_trading_days_last_30: missingCount,
      is_stale,
    });
  }

  // overall latest quote createdAt
  const overallLatest = await prisma.stockQuote.findFirst({ orderBy: { createdAt: 'desc' } });

  const report = {
    generatedAt,
    db_path: 'prisma/dev.db',
    overall_latest_quote_createdAt: overallLatest?.createdAt?.toISOString() ?? null,
    market_dates_count_last_30_days: marketDatesSet.size,
    per_symbol: perSymbol
  };

  // Ensure output dir exists
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('Wrote report to', outPath);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
