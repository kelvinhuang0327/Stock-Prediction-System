/**
 * run-rolling-simulation.ts
 * Phase 2+3: Organic rolling simulation over historical data.
 *
 * - Iterates each trading day in [START_DATE, END_DATE]
 * - Closes open shadow trades using quotes ≤ simulation day (not wall-clock latest)
 * - Opens new shadow trades from momentum candidates
 * - Reports every 10 days
 * - Terminates on completion criteria
 *
 * Usage:
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' npx ts-node -r tsconfig-paths/register scripts/run-rolling-simulation.ts
 *   Optional flags: --start=YYYY-MM-DD --end=YYYY-MM-DD
 */

import { prisma } from '../src/lib/prisma';
import { riskDefenseModule } from '../src/lib/risk/RiskDefenseModule';
import type { Position } from '../src/lib/risk/RiskDefenseModule';

// ─── Configuration ───────────────────────────────────────────────────────────

const START_DATE = process.argv.find(a => a.startsWith('--start='))?.split('=')[1] ?? '2025-10-01';
const END_DATE   = process.argv.find(a => a.startsWith('--end='))?.split('=')[1]   ?? '2025-12-31';
const MAX_CONCURRENT_SHADOW = 3;
const MAX_NEW_TRADES_PER_DAY = 2;
const TERMINATE_AT_CLOSED = Number(process.argv.find(a => a.startsWith('--terminateAtClosed='))?.split('=')[1] ?? '15');

// Shadow thresholds (must match TriggerScoringEngine.ts exactly)
const THRESHOLDS = {
  trend:   { target: 0.06,  stop: -0.045, maxHoldDays: 9  },
  rebound: { target: 0.045, stop: -0.038, maxHoldDays: 6  },
  event:   { target: 0.075, stop: -0.053, maxHoldDays: 7  },
  default: { target: 0.06,  stop: -0.045, maxHoldDays: 12 },
};

function getThresholds(setupType: string) {
  return THRESHOLDS[setupType as keyof typeof THRESHOLDS] ?? THRESHOLDS.default;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTradingDays(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + 'T00:00:00Z');
  const endD = new Date(end + 'T00:00:00Z');
  while (cur <= endD) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.floor(
    (new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime())
    / (24 * 60 * 60 * 1000),
  ));
}

function computeATR(quotes: QuoteRow[], period = 14): number {
  if (quotes.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < quotes.length; i++) {
    const tr = Math.max(
      quotes[i].high - quotes[i].low,
      Math.abs(quotes[i].high - quotes[i - 1].close),
      Math.abs(quotes[i].low  - quotes[i - 1].close),
    );
    trs.push(tr);
  }
  const recent = trs.slice(-period);
  return recent.length === 0 ? 0 : recent.reduce((s, v) => s + v, 0) / recent.length;
}

interface QuoteRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Quote Cache (per symbol, all history) ───────────────────────────────────

const quoteCache = new Map<string, QuoteRow[]>();

async function loadAllQuotes(): Promise<void> {
  console.log('[RollingSim] Loading quotes cache...');
  const rows = await prisma.$queryRaw<Array<{
    stockId: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>>`SELECT stockId, date, open, high, low, close, volume FROM StockQuote ORDER BY stockId, date ASC`;

  for (const row of rows) {
    if (!quoteCache.has(row.stockId)) quoteCache.set(row.stockId, []);
    quoteCache.get(row.stockId)!.push({
      date: row.date,
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume),
    });
  }
  console.log(`[RollingSim] Loaded ${quoteCache.size} stocks into cache`);
}

function getQuotesUpTo(symbol: string, ceiling: string): QuoteRow[] {
  const all = quoteCache.get(symbol) ?? [];
  return all.filter(q => q.date <= ceiling);
}

// ─── Ensure rolling sim snapshot exists ──────────────────────────────────────

let rollingSimSnapshotId: number | null = null;

async function getOrCreateRollingSnapshot(simDay: string): Promise<number> {
  // Use one snapshot per simulation day so trades have different snapshotIds
  const snapshotDate = `rolling-sim-${simDay}`;
  const existing = await prisma.autonomousResearchSnapshot.findFirst({
    where: { snapshotDate },
    select: { id: true },
  });
  if (existing) return existing.id;

  const row = await prisma.autonomousResearchSnapshot.create({
    data: {
      snapshotDate,
      marketState: 'sideways',
      dataCoverage: 'limited',
      sectorStrength: '[]',
      candidateStocks: '[]',
      riskSignals: '[]',
      topInsights: '[]',
      limitations: JSON.stringify(['Rolling simulation: organic historical replay', `simDay=${simDay}`]),
    },
    select: { id: true },
  });
  return row.id;
}

// ─── Close open trades for simulation day ────────────────────────────────────

interface TradeRecord {
  id: number;
  symbol: string;
  setupType: string;
  entryDate: string;
  entryPrice: number;
  simulatedFillPrice: number;
  quantity: number;
  snapshotId: number;
  status: string;
}

async function closeTradesForDay(simDay: string, stats: RunStats): Promise<number> {
  const openTrades = await prisma.simulatedTrade.findMany({
    where: {
      status: { in: ['shadow-open'] },
      entryDate: { lte: simDay },
      marketContext: { contains: 'rolling-simulation' },
    },
    select: {
      id: true,
      symbol: true,
      setupType: true,
      entryDate: true,
      entryPrice: true,
      simulatedFillPrice: true,
      quantity: true,
      snapshotId: true,
      status: true,
    },
  }) as TradeRecord[];

  let closedCount = 0;

  for (const trade of openTrades) {
    const quotesUpTo = getQuotesUpTo(trade.symbol, simDay);
    const quotesFromEntry = quotesUpTo.filter(q => q.date >= trade.entryDate);
    if (quotesFromEntry.length === 0) continue;

    const currentClose = quotesFromEntry[quotesFromEntry.length - 1].close;
    const highSince = Math.max(...quotesFromEntry.map(q => q.high));
    const lowSince  = Math.min(...quotesFromEntry.map(q => q.low));

    const pnlPct  = (currentClose - trade.simulatedFillPrice) / trade.simulatedFillPrice;
    const mfePct  = (highSince   - trade.simulatedFillPrice) / trade.simulatedFillPrice;
    const maePct  = (lowSince    - trade.simulatedFillPrice) / trade.simulatedFillPrice;
    const holding = daysBetween(trade.entryDate, simDay);

    const thresholds = getThresholds(trade.setupType);
    const stopHit   = pnlPct <= thresholds.stop;
    const targetHit = pnlPct >= thresholds.target;
    const timeExit  = holding >= thresholds.maxHoldDays;

    // Fix 1 (RFA-2): ATR-based stop via RiskDefense — same logic as SimulationExecutionEngine
    const simNow = new Date(simDay + 'T16:00:00+08:00');
    const atr = computeATR(quotesFromEntry);
    const riskPosition: Position = {
      entryPrice: trade.simulatedFillPrice,
      entryDate: new Date(trade.entryDate + 'T00:00:00+08:00'),
      currentPrice: currentClose,
      highestPrice: highSince,
      atr,
    };
    const riskResult = riskDefenseModule.evaluateStopLoss(riskPosition, simNow);
    const riskTriggered = riskResult.shouldExit && riskResult.level !== 'L4_TIME';

    const shouldClose = stopHit || targetHit || timeExit || riskTriggered;
    if (!shouldClose) continue;

    const exitReason = stopHit ? 'stop'
      : targetHit ? 'target'
      : riskTriggered
        ? (riskResult.level === 'L2_ATR' ? 'atr-stop'
          : riskResult.level === 'L3_TRAILING' ? 'trailing-stop'
          : 'stop')
      : 'time';
    const newStatus = 'shadow-closed';

    await prisma.simulatedTrade.update({
      where: { id: trade.id },
      data: {
        status: newStatus,
        exitTime: new Date(simDay + 'T16:00:00+08:00'),
        exitPrice: currentClose,
        pnlPct: pnlPct * 100,
        pnlAmount: trade.quantity * (currentClose - trade.simulatedFillPrice),
        mfePct: mfePct * 100,
        maePct: maePct * 100,
        holdingDays: holding,
        stopHit,
        targetHit,
        exitReason,
      },
    });

    // Update journal if exists
    await prisma.tradeJournalEntry.updateMany({
      where: { tradeId: trade.id },
      data: { lifecycle: newStatus, pnlPct: pnlPct * 100 },
    });

    // Generate review (all time exits + stop/target if |pnl| >= 3%)
    const reviewThreshold = 3;
    if (exitReason === 'time' || Math.abs(pnlPct * 100) >= reviewThreshold) {
      const triggerType: '+5' | '-5' | 'time' = exitReason === 'time' ? 'time'
        : pnlPct * 100 >= reviewThreshold ? '+5' : '-5';

      const analysisText = exitReason === 'time'
        ? `時間到期，持倉 ${holding}d，最終報酬 ${(pnlPct*100).toFixed(2)}%，MFE=${(mfePct*100).toFixed(1)}%`
        : exitReason === 'target'
        ? `達到目標獲利 ${(pnlPct*100).toFixed(2)}%，持倉 ${holding}d，MFE=${(mfePct*100).toFixed(1)}%`
        : `停損出場 ${(pnlPct*100).toFixed(2)}%，持倉 ${holding}d，MAE=${(maePct*100).toFixed(1)}%`;

      await prisma.tradeReviewReport.create({
        data: {
          tradeId: trade.id,
          snapshotId: trade.snapshotId,
          triggerType,
          preTrade: JSON.stringify({
            symbol: trade.symbol,
            setupType: trade.setupType,
            entryDate: trade.entryDate,
            entryPrice: trade.entryPrice,
            simMode: 'rolling-simulation',
          }),
          result: JSON.stringify({
            pnlPct: pnlPct * 100,
            holdingDays: holding,
            exitReason,
            mfePct: mfePct * 100,
            maePct: maePct * 100,
          }),
          analysis: JSON.stringify({ summary: analysisText }),
          issues: JSON.stringify([]),
          recommendations: JSON.stringify([]),
        },
      });
    }

    closedCount++;
    stats.newClosed++;
    const exitKey = (exitReason === 'atr-stop' || exitReason === 'trailing-stop') ? exitReason
      : exitReason as keyof typeof stats.exitDist;
    if (exitKey in stats.exitDist) {
      stats.exitDist[exitKey as keyof typeof stats.exitDist]++;
    }
    stats.pnls.push(pnlPct * 100);

    console.log(`  [close] ${simDay} ${trade.symbol} ${trade.setupType} pnl=${(pnlPct*100).toFixed(2)}% exit=${exitReason} hold=${holding}d`);
  }

  return closedCount;
}

// ─── Open new shadow trades for simulation day ────────────────────────────────

async function openTradesForDay(simDay: string, snapshotId: number, stats: RunStats): Promise<number> {
  // Check current open count
  const openCount = await prisma.simulatedTrade.count({
    where: { status: 'shadow-open', marketContext: { contains: 'rolling-simulation' } },
  });
  const availableSlots = MAX_CONCURRENT_SHADOW - openCount;
  if (availableSlots <= 0) return 0;

  // Get symbols already in open trades
  const openTrades = await prisma.simulatedTrade.findMany({
    where: { status: 'shadow-open', marketContext: { contains: 'rolling-simulation' } },
    select: { symbol: true },
  });
  const openSymbols = new Set(openTrades.map(t => t.symbol));

  // Find candidate stocks using momentum signal
  const candidates: Array<{ symbol: string; setupType: string; score: number; entryPrice: number; latestDate: string }> = [];

  for (const [symbol, allQuotes] of quoteCache.entries()) {
    if (openSymbols.has(symbol)) continue;
    const quotesUpTo = allQuotes.filter(q => q.date <= simDay);
    if (quotesUpTo.length < 20) continue;

    const latest = quotesUpTo[quotesUpTo.length - 1];
    // Only use this symbol if its latest quote date matches the sim day (is active)
    if (latest.date !== simDay) continue;

    // Momentum: 5-day return
    const q5ago = quotesUpTo[quotesUpTo.length - 6];
    if (!q5ago) continue;
    const ret5d = (latest.close - q5ago.close) / q5ago.close;

    // Volume: recent vs 20-day average
    const vol20 = quotesUpTo.slice(-20).reduce((s, q) => s + q.volume, 0) / 20;
    const volRatio = latest.volume / Math.max(vol20, 1);

    // Trend: ret5d > 1.5% with volume pickup
    if (ret5d > 0.015 && volRatio > 1.0) {
      candidates.push({
        symbol,
        setupType: ret5d > 0.04 ? 'trend' : 'rebound',
        score: ret5d * volRatio,
        entryPrice: latest.close,
        latestDate: latest.date,
      });
    }
    // Rebound: recent dip with partial recovery
    else if (ret5d < -0.01 && ret5d > -0.04 && volRatio > 0.8) {
      const ret2d = (latest.close - quotesUpTo[quotesUpTo.length - 3].close) / quotesUpTo[quotesUpTo.length - 3].close;
      if (ret2d > 0.005) {
        candidates.push({
          symbol,
          setupType: 'rebound',
          score: ret2d * volRatio,
          entryPrice: latest.close,
          latestDate: latest.date,
        });
      }
    }
  }

  // Sort by score desc, pick top N
  candidates.sort((a, b) => b.score - a.score);
  const toOpen = candidates.slice(0, Math.min(availableSlots, MAX_NEW_TRADES_PER_DAY));

  for (const cand of toOpen) {
    const slippageBps = 8;
    const fillPrice = cand.entryPrice * (1 + slippageBps / 10000);
    const quantity = Math.max(1, Math.floor(1_000_000 * 0.30 * 0.3 / fillPrice)); // shadow 30% sizing

    // Create proposal
    const proposal = await prisma.strategyProposal.create({
      data: {
        snapshotId,
        symbol: cand.symbol,
        setupType: cand.setupType,
        thesis: `有機滾動模擬 ${simDay}：動能信號 ${cand.setupType}`,
        entryCondition: `simDay=${simDay} momentum score=${cand.score.toFixed(4)}`,
        invalidationCondition: `停損 ${getThresholds(cand.setupType).stop * 100}%`,
        stopLossRule: `固定停損 ${getThresholds(cand.setupType).stop * 100}%`,
        takeProfitRule: `目標 ${getThresholds(cand.setupType).target * 100}%`,
        positionSizing: 0.09,
        conviction: cand.score > 0.05 ? 'high' : 'medium',
        supportingSignals: JSON.stringify([`5d-return=${(cand.score * 100).toFixed(1)}%`]),
        riskFactors: JSON.stringify(['歷史回測無前向偏誤驗證']),
        state: 'shadow',
        decisionMeta: JSON.stringify({ simMode: 'rolling-simulation', simDay }),
      },
      select: { id: true },
    });

    const trade = await prisma.simulatedTrade.create({
      data: {
        proposalId: proposal.id,
        snapshotId,
        symbol: cand.symbol,
        setupType: cand.setupType,
        triggerTime: new Date(cand.latestDate + 'T09:00:00+08:00'),
        entryDate: cand.latestDate,
        entryPrice: cand.entryPrice,
        simulatedFillPrice: fillPrice,
        slippageModel: `bps=${slippageBps}`,
        quantity,
        marketContext: JSON.stringify({
          simMode: 'rolling-simulation',
          simDay,
          tradeMode: 'shadow',
          score: cand.score,
        }),
        status: 'shadow-open',
        tradeMode: 'shadow',
      },
      select: { id: true },
    });

    await prisma.tradeJournalEntry.create({
      data: {
        tradeId: trade.id,
        snapshotId,
        decisionReasoning: `有機滾動模擬進場：${cand.setupType} 動能信號，simDay=${simDay}`,
        executionDetail: JSON.stringify({
          entryPrice: cand.entryPrice,
          fillPrice,
          score: cand.score,
          simDay,
        }),
        lifecycle: 'shadow-open',
      },
    });

    stats.newOpened++;
    console.log(`  [open]  ${simDay} ${cand.symbol} ${cand.setupType} @${cand.entryPrice.toFixed(2)} score=${cand.score.toFixed(4)}`);
  }

  return toOpen.length;
}

// ─── Run statistics ───────────────────────────────────────────────────────────

interface RunStats {
  newOpened: number;
  newClosed: number;
  exitDist: { stop: number; target: number; time: number; 'atr-stop': number; 'trailing-stop': number };
  pnls: number[];
  dayIndex: number;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 2+3: ORGANIC ROLLING SIMULATION                       ║');
  console.log(`║  Range: ${START_DATE} → ${END_DATE}                              ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const tradingDays = getTradingDays(START_DATE, END_DATE);
  console.log(`Trading days in window: ${tradingDays.length}`);

  // Load all quotes into memory
  await loadAllQuotes();

  // Count existing rolling-sim trades before start
  const existingBefore = await prisma.simulatedTrade.count({
    where: { marketContext: { contains: 'rolling-simulation' } },
  });
  console.log(`Pre-existing rolling sim trades: ${existingBefore}\n`);

  const stats: RunStats = {
    newOpened: 0,
    newClosed: 0,
    exitDist: { stop: 0, target: 0, time: 0, 'atr-stop': 0, 'trailing-stop': 0 },
    pnls: [],
    dayIndex: 0,
  };

  for (const simDay of tradingDays) {
    stats.dayIndex++;

    // Get or create daily snapshot
    const snapshotId = await getOrCreateRollingSnapshot(simDay);

    // Step 1: Close trades that hit exit on this day
    await closeTradesForDay(simDay, stats);

    // Step 2: Open new shadow trades
    await openTradesForDay(simDay, snapshotId, stats);

    // Every 10 days: print summary
    if (stats.dayIndex % 10 === 0) {
      const avg = stats.pnls.length > 0
        ? (stats.pnls.reduce((a, b) => a + b, 0) / stats.pnls.length).toFixed(2)
        : 'n/a';
      const win = stats.pnls.filter(p => p > 0).length;
      console.log(`\n── Day ${stats.dayIndex} / ${tradingDays.length} (${simDay}) ────────────────────`);
      console.log(`  Opened: ${stats.newOpened}  Closed: ${stats.newClosed}`);
      console.log(`  Exit dist — stop:${stats.exitDist.stop} target:${stats.exitDist.target} time:${stats.exitDist.time} atr-stop:${stats.exitDist['atr-stop']} trailing-stop:${stats.exitDist['trailing-stop']}`);
      console.log(`  Closed pnls — avg:${avg}% wins:${win}/${stats.pnls.length}`);
      console.log(`────────────────────────────────────────────────\n`);
    }

    // Termination check
    if (stats.newClosed >= TERMINATE_AT_CLOSED) {
      console.log(`\n[RollingSim] TERMINATED: reached ${TERMINATE_AT_CLOSED} new closed trades`);
      break;
    }
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ROLLING SIMULATION COMPLETE                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Days simulated : ${stats.dayIndex} / ${tradingDays.length}`);
  console.log(`New opened     : ${stats.newOpened}`);
  console.log(`New closed     : ${stats.newClosed}`);
  console.log(`Exit dist      : stop=${stats.exitDist.stop} target=${stats.exitDist.target} time=${stats.exitDist.time} atr-stop=${stats.exitDist['atr-stop']} trailing-stop=${stats.exitDist['trailing-stop']}`);

  if (stats.pnls.length > 0) {
    const avg = (stats.pnls.reduce((a, b) => a + b, 0) / stats.pnls.length).toFixed(2);
    const maxP = Math.max(...stats.pnls).toFixed(2);
    const minP = Math.min(...stats.pnls).toFixed(2);
    const wins = stats.pnls.filter(p => p > 0).length;
    console.log(`PnL dist       : avg=${avg}% max=${maxP}% min=${minP}%`);
    console.log(`Win rate       : ${wins}/${stats.pnls.length} (${((wins/stats.pnls.length)*100).toFixed(0)}%)`);
  }

  // Final DB state
  const totalClosed = await prisma.simulatedTrade.count({
    where: { status: { in: ['closed', 'shadow-closed'] } },
  });
  const rollingClosed = await prisma.simulatedTrade.count({
    where: { status: 'shadow-closed', marketContext: { contains: 'rolling-simulation' } },
  });
  const reviews = await prisma.tradeReviewReport.count();
  console.log(`\nDB state: totalClosed=${totalClosed} (rollingNew=${rollingClosed}) reviews=${reviews}`);

  // Check shadow→pending promotion eligibility
  const shadowStats = await prisma.$queryRaw<Array<{ setupType: string; total: bigint; wins: bigint; avgPnl: number }>>`
    SELECT setupType,
           COUNT(*) as total,
           SUM(CASE WHEN pnlPct > 0 THEN 1 ELSE 0 END) as wins,
           AVG(pnlPct) as avgPnl
    FROM SimulatedTrade
    WHERE status = 'shadow-closed'
    GROUP BY setupType
  `;
  console.log('\nShadow→Pending eligibility (need ≥5 trades, winRate≥55%, avgPnl>0):');
  for (const row of shadowStats) {
    const total = Number(row.total);
    const wins = Number(row.wins);
    const winRate = total > 0 ? wins / total : 0;
    const eligible = total >= 5 && winRate >= 0.55 && row.avgPnl > 0;
    console.log(`  ${row.setupType}: total=${total} winRate=${(winRate*100).toFixed(0)}% avgPnl=${Number(row.avgPnl).toFixed(2)}% → ${eligible ? '✅ ELIGIBLE' : '❌ not yet'}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[RollingSim] Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
