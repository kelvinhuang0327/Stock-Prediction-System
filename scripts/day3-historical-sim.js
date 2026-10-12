/**
 * Day 3 — Historical Simulation Script
 * ─────────────────────────────────────
 * Problem: Trades entered at 2026-04-17 have no future quote data, so
 * pnl never moves and all exits are time-based (maxHoldDays=6 for shadow).
 *
 * Fix: Insert trades with HISTORICAL entry dates where ample future
 * quote data exists, then run closeOpenTrades() through that history.
 *
 * Stocks chosen by price-movement analysis:
 *   - 1326 (long trend): +48% over 90 days → should hit target
 *   - 00738U (short rebound): -10.4% over 90 days → should hit stop
 *   - 00830 (long trend): +18% over 30 days → should hit target
 *   - 1560 (long trend): +26% over 90 days → should hit target
 */

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });

const ENTRY_DATE = '2026-01-15'; // 90+ days before latest quote
const SLIPPAGE_PCT = 0.0016;

// Trades to inject: { symbol, setupType, direction }
// All will use shadow mode (eventQuality insufficient, same as real proposals)
const TRADE_PLAN = [
  { symbol: '1326', setupType: 'trend', thesis: 'Historical trend: +48% detected in 90d window — target exit expected' },
  { symbol: '1560', setupType: 'trend', thesis: 'Historical trend: +26% detected in 90d window — target exit expected' },
  { symbol: '00891', setupType: 'trend', thesis: 'Historical trend: +25% detected in 90d window — target exit expected' },
  { symbol: '00738U', setupType: 'rebound', thesis: 'Historical rebound fail: -10.4% detected — stop loss exit expected' },
  { symbol: '00712', setupType: 'rebound', thesis: 'Historical rebound fail: -5.7% detected — stop loss exit expected' },
];

async function getEntryQuote(symbol) {
  const q = await p.stockQuote.findFirst({
    where: { stockId: symbol, date: { lte: ENTRY_DATE } },
    orderBy: { date: 'desc' },
    select: { date: true, close: true, open: true, high: true, low: true },
  });
  return q;
}

async function getOrCreateSnapshot() {
  const today = new Date().toISOString().slice(0, 10);
  // Reuse the latest research snapshot
  const existing = await p.autonomousResearchSnapshot.findFirst({
    orderBy: { snapshotDate: 'desc' },
    select: { id: true, snapshotDate: true },
  });
  if (existing) return existing;
  // Create minimal snapshot if none exists
  return p.autonomousResearchSnapshot.create({
    data: {
      snapshotDate: today,
      marketState: 'neutral',
      sectorStrength: '{}',
      candidateStocks: '[]',
      riskSignals: '[]',
      topInsights: '[]',
      dataCoverage: 'limited',
      limitations: '[]',
    },
  });
}

async function main() {
  console.log(`\n=== Day 3 Historical Simulation (entry=${ENTRY_DATE}) ===\n`);

  const snapshot = await getOrCreateSnapshot();
  console.log(`Using research snapshot: id=${snapshot.id} date=${snapshot.snapshotDate}`);

  const inserted = [];

  for (const plan of TRADE_PLAN) {
    const quote = await getEntryQuote(plan.symbol);
    if (!quote) {
      console.log(`  SKIP ${plan.symbol}: no quote on/before ${ENTRY_DATE}`);
      continue;
    }

    const entryPrice = quote.close;
    const simulatedFillPrice = entryPrice * (1 + SLIPPAGE_PCT);

    // Create a minimal StrategyProposal
    const proposal = await p.strategyProposal.create({
      data: {
        snapshotId: snapshot.id,
        symbol: plan.symbol,
        setupType: plan.setupType,
        thesis: plan.thesis,
        entryCondition: `Historical entry at ${quote.date} close=${entryPrice}`,
        invalidationCondition: 'Price below stop loss',
        stopLossRule: plan.setupType === 'trend' ? 'ATR stop 2x or -6%' : '-3.8% shadow stop',
        takeProfitRule: plan.setupType === 'trend' ? '+6% target' : '+4.5% target',
        positionSizing: 0.05,
        conviction: 'medium',
        supportingSignals: JSON.stringify([`pct90=${plan.thesis}`]),
        riskFactors: JSON.stringify(['historical simulation']),
        researchSnapshotId: snapshot.id,
        state: 'approved',
        decisionMeta: JSON.stringify({ source: 'day3-historical-sim', entryDate: ENTRY_DATE }),
      },
    });

    // Insert the SimulatedTrade directly with historical entry date
    const trade = await p.simulatedTrade.create({
      data: {
        proposalId: proposal.id,
        snapshotId: snapshot.id,
        symbol: plan.symbol,
        setupType: plan.setupType,
        triggerTime: new Date(`${quote.date}T09:00:00+08:00`),
        entryDate: quote.date,
        entryPrice,
        simulatedFillPrice,
        slippageModel: 'standard',
        quantity: Math.floor(10000 / simulatedFillPrice),
        marketContext: 'historical-sim',
        status: 'shadow-open',
        tradeMode: 'shadow',
      },
    });

    // Create journal entry
    await p.tradeJournalEntry.create({
      data: {
        tradeId: trade.id,
        snapshotId: snapshot.id,
        decisionReasoning: plan.thesis,
        executionDetail: JSON.stringify({ entryDate: quote.date, entryPrice, simulatedFillPrice }),
        lifecycle: 'shadow-open',
        researchSnapshot: JSON.stringify({ source: 'historical-sim', entryDate: ENTRY_DATE }),
        pnlPct: 0,
      },
    });

    console.log(`  INSERTED trade ${trade.id}: ${plan.symbol} (${plan.setupType}) entry=${quote.date} price=${entryPrice}`);
    inserted.push({ id: trade.id, symbol: plan.symbol, entryDate: quote.date, entryPrice });
  }

  console.log(`\nInserted ${inserted.length} historical trades.`);
  console.log('\nNext: run fast-forward from 2026-01-16 → 2026-04-17 (90 days of real data)');
  console.log('Command: npm run autonomous:fast-forward -- --days=90\n');

  await p.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
