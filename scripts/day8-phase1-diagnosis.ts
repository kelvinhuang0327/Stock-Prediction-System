/**
 * Day 8 Phase 1: Diagnose WHY runScreen returns 0 candidates
 * Answer Q1/Q2/Q3 and probe the screening pipeline
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('\n===== DAY 8 PHASE 1: ROOT CAUSE DIAGNOSIS =====\n');

  // Q1: Does DecisionLayerEngine read snapshot.candidates OR call StrategyScreenEngine directly?
  // ANSWER: It reads snapshot.candidateStocks (passed in as parameter from Orchestrator)
  console.log('[Q1] DecisionLayerEngine reads: snapshot.candidateStocks (parameter from Orchestrator)');
  console.log('     Does NOT call runScreen directly.\n');

  // Q2: Does AutonomousResearchEngine store candidates in snapshot OR is candidates field empty by design?
  // ANSWER: It calls runScreen() and stores result → candidateStocks
  // The problem is runScreen() returns 0 candidates
  console.log('[Q2] AutonomousResearchEngine calls runScreen() then stores result → candidateStocks');
  console.log('     If runScreen returns 0, snapshot.candidateStocks = []\n');

  // Q3: Where does setupType = "fundamental" get assigned?
  // ANSWER: In AutonomousResearchEngine.ts setupTypeForCandidate()
  //   if hasStrongFundamental && candidate.priceChangePercent >= 0 → 'fundamental'
  //   if hasEventSupport → 'event'
  //   else → 'trend' or 'rebound'
  console.log('[Q3] setupType assigned in AutonomousResearchEngine.setupTypeForCandidate()');
  console.log('     fundamental: needs fundamentals.dataCoverage=full AND summary includes "偏正向"');
  console.log('     event: needs context.overlay.summary includes "事件" AND limitations < 3\n');

  // Now diagnose WHY runScreen returns 0
  console.log('===== DIAGNOSING runScreen() RETURN VALUE =====\n');

  // Check 1: stock universe - how many stocks have >= 50 quotes?
  const stockCounts = await prisma.stockQuote.groupBy({
    by: ['stockId'],
    _count: { stockId: true },
  });
  const eligible = stockCounts.filter(s => s._count.stockId >= 50);
  console.log(`[A] Stocks with >= 50 quote days: ${eligible.length} (of ${stockCounts.length} total)`);
  console.log(`    Eligible symbols (first 10): ${eligible.slice(0, 10).map(s => s.stockId).join(', ')}`);

  if (eligible.length === 0) {
    console.log('    ❌ NO ELIGIBLE STOCKS → runScreen returns empty immediately!');
    await prisma.$disconnect();
    return;
  }

  // Check 2: What's in StockQuote - latest dates?
  const latestQuote = await prisma.stockQuote.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });
  console.log(`\n[B] Latest StockQuote date: ${latestQuote?.date}`);

  // Check 3: How many quotes does each stock have?
  const counts = stockCounts.map(s => s._count.stockId).sort((a, b) => b - a);
  console.log(`    Max quotes: ${counts[0]}, Median: ${counts[Math.floor(counts.length/2)]}, Min: ${counts[counts.length-1]}`);

  // Check 4: What does the alpha/fusion data look like? Check for alpha scores
  // Look for relevant tables - StockFundamental, AlphaScore, etc.
  const tableNames = await prisma.$queryRawUnsafe<Array<{name: string}>>(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
  );
  console.log('\n[C] Available tables:', tableNames.map(t => t.name).join(', '));

  // Check if there's any signal/alpha data
  for (const table of ['StockFundamental', 'ChipData', 'TechnicalSignal', 'AlphaSignal']) {
    try {
      const count = await prisma.$queryRawUnsafe<Array<{cnt: number}>>(
        `SELECT COUNT(*) as cnt FROM "${table}"`
      );
      console.log(`    ${table}: ${count[0].cnt} rows`);
    } catch {
      console.log(`    ${table}: table not found`);
    }
  }

  // Check 5: The snapshotDate problem
  // runScreen uses latestQuoteDate → snapshotDate
  // Snapshot #19 had candidates. What date was it?
  const snap19 = await prisma.autonomousResearchSnapshot.findUnique({ where: { id: 19 } });
  console.log(`\n[D] Snapshot #19 (last with candidates): snapshotDate=${snap19?.snapshotDate}`);
  const snap77 = await prisma.autonomousResearchSnapshot.findUnique({ where: { id: 77 } });
  console.log(`    Snapshot #77 (latest, 0 candidates): snapshotDate=${snap77?.snapshotDate}`);

  // Key check: how many StockQuotes exist for the dates in snapshot #19 vs #77?
  const snap19Date = snap19?.snapshotDate?.replace('rolling-sim-', '') ?? null;
  const snap77Date = snap77?.snapshotDate?.replace('rolling-sim-', '') ?? null;
  if (snap19Date) {
    const c19 = await prisma.stockQuote.count({ where: { date: snap19Date } });
    console.log(`    StockQuotes on ${snap19Date}: ${c19}`);
  }
  if (snap77Date) {
    const c77 = await prisma.stockQuote.count({ where: { date: snap77Date } });
    console.log(`    StockQuotes on ${snap77Date}: ${c77}`);
  }

  // Check 6: What is the actual latest StockQuote date?
  const latestDate = latestQuote?.date;
  const quotesOnLatestDate = latestDate ? await prisma.stockQuote.count({ where: { date: latestDate } }) : 0;
  console.log(`\n[E] Latest actual StockQuote date: ${latestDate} (${quotesOnLatestDate} stocks)`);

  // The gap: rolling sim is at 2025-12-17, but do we have stock quote data that far?
  // What date range is in StockQuote?
  const oldestQuote = await prisma.stockQuote.findFirst({ orderBy: { date: 'asc' }, select: { date: true } });
  console.log(`    StockQuote date range: ${oldestQuote?.date} → ${latestDate}`);

  // Count quotes per eligible stock for latest date
  if (latestDate) {
    const eligibleOnLatestDate = await prisma.stockQuote.count({ where: { date: latestDate } });
    console.log(`    Stocks with data on ${latestDate}: ${eligibleOnLatestDate}`);
  }

  // Check 7: The >= 50 days threshold — are stocks failing this?
  const under50 = stockCounts.filter(s => s._count.stockId < 50).length;
  const over50 = eligible.length;
  console.log(`\n[F] Stocks with < 50 quote days: ${under50}`);
  console.log(`    Stocks with >= 50 quote days: ${over50}`);
  console.log(`    These ${over50} symbols go into runScreen batch`);

  // Show sample eligible symbols and their quote counts
  console.log('\n[G] Sample eligible stocks (top 5 by quote count):');
  for (const stock of eligible.slice(0, 5)) {
    const latest = await prisma.stockQuote.findFirst({
      where: { stockId: stock.stockId },
      orderBy: { date: 'desc' },
      select: { date: true, close: true, change: true }
    });
    console.log(`    ${stock.stockId}: ${stock._count.stockId} quotes, latest=${latest?.date}, close=${latest?.close}`);
  }

  // Check 8: What does SignalFusionEngine need? Look for ChipData etc.
  // Sample the first eligible symbol and check what data exists
  if (eligible.length > 0) {
    const testSymbol = eligible[0].stockId;
    console.log(`\n[H] Data check for test symbol ${testSymbol}:`);
    try {
      const chip = await prisma.$queryRawUnsafe<Array<{cnt: number}>>(
        `SELECT COUNT(*) as cnt FROM "ChipData" WHERE "stockId" = ?`, testSymbol
      );
      console.log(`    ChipData: ${chip[0].cnt} rows`);
    } catch { console.log('    ChipData: not available'); }
    try {
      const fundamental = await prisma.$queryRawUnsafe<Array<{cnt: number}>>(
        `SELECT COUNT(*) as cnt FROM "StockFundamental" WHERE "stockId" = ?`, testSymbol
      );
      console.log(`    StockFundamental: ${fundamental[0].cnt} rows`);
    } catch { console.log('    StockFundamental: not available'); }
  }

  console.log('\n===== END PHASE 1 =====\n');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
