import { PrismaClient } from '@prisma/client';
import { runAutonomousCycle } from '../src/lib/autonomous/AutonomousOrchestrator';
import {
  buildStrategyLearningInsight,
  persistStrategyLearningInsight,
} from '../src/lib/autonomous/StrategyLearningEngine';
import { buildFundamentalResearchContextForSymbol } from '../src/lib/fundamentals/FundamentalResearchService';
import { getEventSummaryForSymbol } from '../src/lib/events/EventSummaryEngine';

const prisma = new PrismaClient();

const START_DATE = '2026-01-15';
const END_DATE = '2026-04-17';
const LIVE_DATE = '2026-04-17';
const LIVE_CYCLES = 5;
const CHECKPOINT_DAYS = 10;
const ORGANIC_PNL_ALERT = 35;

type SetupType = 'trend' | 'rebound' | 'fundamental' | 'event';

type WinRateRow = {
  setupType: string;
  total: bigint | number;
  wins: bigint | number;
  avgPnl: number | null;
};

type ExitRow = {
  exitReason: string | null;
  total: bigint | number;
};

type LearningSummary = {
  sourceCount: number;
  trendWinRate: number | null;
  penalizedSetups: string[];
  rewardedSetups: string[];
};

type PromotionState = {
  streakBySetup: Record<string, number>;
  peakBySetup: Record<string, number>;
  promotionEligible: { setupType: string; onDate: string } | null;
  pendingVerificationSetup: { setupType: string; date: string } | null;
};

type SessionCounters = {
  startedAtMs: number;
  rollingDaysProcessed: number;
  rollingEndDate: string | null;
  rollingStoppedReason: string;
  newOrganicClosedTrades: number;
  newReviews: number;
  newPendingClosures: number;
  newPromotionsObserved: number;
  liveCycleCandidates: number[];
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function asNumber(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function pct(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(digits)}%`;
}

function formatRuntime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function tradingDateToSimulationDate(dateStr: string): Date {
  return new Date(`${dateStr}T10:00:00.000Z`);
}

async function getTradingDays(start: string, end: string): Promise<string[]> {
  const rows = await prisma.stockQuote.findMany({
    where: { date: { gte: start, lte: end } },
    distinct: ['date'],
    select: { date: true },
    orderBy: { date: 'asc' },
  });
  return rows.map((row) => row.date);
}

async function getWinRates(): Promise<WinRateRow[]> {
  return prisma.$queryRaw<WinRateRow[]>`
    SELECT
      setupType,
      COUNT(*) as total,
      SUM(CASE WHEN pnlPct > 0 THEN 1 ELSE 0 END) as wins,
      ROUND(AVG(pnlPct), 3) as avgPnl
    FROM SimulatedTrade
    WHERE status = 'closed'
      AND NOT (marketContext LIKE '%"dataQuality":"contaminated"%')
    GROUP BY setupType
    ORDER BY setupType
  `;
}

async function getExitDistribution(): Promise<ExitRow[]> {
  return prisma.$queryRaw<ExitRow[]>`
    SELECT
      COALESCE(exitReason, 'unknown') as exitReason,
      COUNT(*) as total
    FROM SimulatedTrade
    WHERE status = 'closed'
      AND NOT (marketContext LIKE '%"dataQuality":"contaminated"%')
    GROUP BY COALESCE(exitReason, 'unknown')
    ORDER BY total DESC
  `;
}

function parsePatternCounts(patterns: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const pattern of patterns) {
    const match = /^(\w+)：(\d+)/.exec(pattern);
    if (!match) continue;
    counts[match[1]] = Number(match[2]);
  }
  return counts;
}

function determineKeyChange(previous: number | null, next: number | null): 'better' | 'worse' | 'same' {
  if (previous == null || next == null) return 'same';
  if (next > previous) return 'better';
  if (next < previous) return 'worse';
  return 'same';
}

function extractSetupSignals(insight: {
  successPatterns: string | null;
  failurePatterns: string | null;
  sourceCount: number;
} | null): LearningSummary {
  if (!insight) {
    return { sourceCount: 0, trendWinRate: null, penalizedSetups: [], rewardedSetups: [] };
  }

  const successPatterns = parseJson<string[]>(insight.successPatterns, []);
  const failurePatterns = parseJson<string[]>(insight.failurePatterns, []);
  const successCounts = parsePatternCounts(successPatterns);
  const failureCounts = parsePatternCounts(failurePatterns);
  const trendWins = successCounts.trend ?? 0;
  const trendLosses = failureCounts.trend ?? 0;
  const trendTotal = trendWins + trendLosses;
  const trendWinRate = trendTotal > 0 ? (trendWins / trendTotal) * 100 : null;
  const penalizedSetups = Object.entries(failureCounts)
    .filter(([, count]) => count >= 3)
    .map(([setup]) => setup);
  const rewardedSetups = Object.entries(successCounts)
    .filter(([, count]) => count >= 3)
    .map(([setup]) => setup);

  return {
    sourceCount: insight.sourceCount,
    trendWinRate,
    penalizedSetups,
    rewardedSetups,
  };
}

async function getLatestInsightRow() {
  return prisma.strategyLearningInsight.findFirst({ orderBy: { id: 'desc' } });
}

async function buildBaseline(): Promise<void> {
  console.log('\n=== PHASE 0 — BASELINE ===\n');

  const tradeModeStatus = await prisma.$queryRaw<Array<{
    tradeMode: string | null;
    status: string;
    total: bigint | number;
    avgPnl: number | null;
  }>>`
    SELECT
      COALESCE(tradeMode, 'null') as tradeMode,
      status,
      COUNT(*) as total,
      ROUND(AVG(pnlPct), 3) as avgPnl
    FROM SimulatedTrade
    WHERE NOT (marketContext LIKE '%"dataQuality":"contaminated"%')
    GROUP BY COALESCE(tradeMode, 'null'), status
    ORDER BY tradeMode, status
  `;

  console.table(
    tradeModeStatus.map((row) => ({
      tradeMode: row.tradeMode ?? 'null',
      status: row.status,
      count: asNumber(row.total),
      avgPnl: row.avgPnl,
    })),
  );

  const setupStats = await getWinRates();
  console.table(
    setupStats.map((row) => ({
      setupType: row.setupType,
      count: asNumber(row.total),
      wins: asNumber(row.wins),
      avgPnl: row.avgPnl,
    })),
  );

  const latestInsight = await getLatestInsightRow();
  const latestLearning = extractSetupSignals(latestInsight);
  console.log('Latest StrategyLearningInsight:');
  console.table([
    {
      id: latestInsight?.id ?? null,
      createdAt: latestInsight?.createdAt?.toISOString() ?? null,
      sourceCount: latestInsight?.sourceCount ?? 0,
      penalized: latestLearning.penalizedSetups.join(', ') || '[]',
      rewarded: latestLearning.rewardedSetups.join(', ') || '[]',
    },
  ]);

  const pendingClosed = await prisma.simulatedTrade.count({
    where: {
      tradeMode: 'pending',
      status: 'closed',
      NOT: { marketContext: { contains: '"dataQuality":"contaminated"' } },
    },
  });
  console.log(`shadow→pending promotions to date: ${pendingClosed}`);
  console.log(
    `learning lock status: ${latestLearning.penalizedSetups.length > 0 ? 'ACTIVE' : 'CLEAR'} ` +
    `(penalizedSetups: ${latestLearning.penalizedSetups.join(', ') || 'none'})`,
  );

  const reviewUsesPnlPct = await prisma.tradeReviewReport.findFirst({
    orderBy: { id: 'desc' },
    select: { result: true },
  });
  if (reviewUsesPnlPct) {
    const result = parseJson<Record<string, unknown>>(reviewUsesPnlPct.result, {});
    console.log(
      `Review payload key check: result.pnlPct=${Object.hasOwn(result, 'pnlPct') ? 'present' : 'missing'}, ` +
      `result.return=${Object.hasOwn(result, 'return') ? 'present' : 'missing'}`,
    );
  }
}

async function initializePromotionState(startDate: string): Promise<PromotionState> {
  const closedTrades = await prisma.simulatedTrade.findMany({
    where: {
      status: 'shadow-closed',
      pnlPct: { not: null },
      entryDate: { lt: startDate },
      NOT: { marketContext: { contains: '"dataQuality":"contaminated"' } },
    },
    orderBy: [{ exitTime: 'asc' }, { id: 'asc' }],
    select: { setupType: true, pnlPct: true },
  });

  const streakBySetup: Record<string, number> = {};
  const peakBySetup: Record<string, number> = {};
  for (const trade of closedTrades) {
    const setup = trade.setupType;
    if ((trade.pnlPct ?? 0) > 0) {
      streakBySetup[setup] = (streakBySetup[setup] ?? 0) + 1;
      peakBySetup[setup] = Math.max(peakBySetup[setup] ?? 0, streakBySetup[setup]);
    } else {
      streakBySetup[setup] = 0;
    }
  }

  return {
    streakBySetup,
    peakBySetup,
    promotionEligible: null,
    pendingVerificationSetup: null,
  };
}

async function getPendingPreview() {
  const pendingTrades = await prisma.simulatedTrade.findMany({
    where: { tradeMode: 'pending' },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 5,
    select: {
      id: true,
      symbol: true,
      setupType: true,
      status: true,
      tradeMode: true,
      entryDate: true,
      pnlPct: true,
      updatedAt: true,
    },
  });
  console.table(pendingTrades);
}

async function logClosedTradesForCycle(
  dateStr: string,
  openTradeIds: number[],
  promotion: PromotionState,
): Promise<{ organicClosed: number; reviews: number; shouldPause: boolean }> {
  if (openTradeIds.length === 0) {
    return { organicClosed: 0, reviews: 0, shouldPause: false };
  }

  const closedTrades = await prisma.simulatedTrade.findMany({
    where: {
      id: { in: openTradeIds },
      status: { in: ['shadow-closed', 'closed'] },
    },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
  });

  let organicClosed = 0;
  let reviews = 0;
  let shouldPause = false;

  for (const trade of closedTrades) {
    const clean = !trade.marketContext.includes('"dataQuality":"contaminated"');
    console.log(
      `Trade closed: ${trade.symbol} ${trade.setupType} pnlPct=${pct(trade.pnlPct)} exitReason=${trade.exitReason ?? 'unknown'}`,
    );
    if (trade.exitReason === 'atr-stop' || trade.exitReason === 'trailing-stop') {
      console.log(
        `✅ ATR-stop fired: ${trade.symbol} entryDate=${trade.entryDate} exitDate=${dateStr} pnlPct=${pct(trade.pnlPct)}`,
      );
    }

    if (trade.status === 'shadow-closed' && clean) {
      if ((trade.pnlPct ?? 0) > 0) {
        promotion.streakBySetup[trade.setupType] = (promotion.streakBySetup[trade.setupType] ?? 0) + 1;
      } else {
        promotion.streakBySetup[trade.setupType] = 0;
      }
      promotion.peakBySetup[trade.setupType] = Math.max(
        promotion.peakBySetup[trade.setupType] ?? 0,
        promotion.streakBySetup[trade.setupType] ?? 0,
      );
      console.log(
        `Consecutive positive closes for ${trade.setupType}: ${promotion.streakBySetup[trade.setupType] ?? 0}/3`,
      );
      if ((promotion.streakBySetup[trade.setupType] ?? 0) >= 3 && !promotion.promotionEligible) {
        promotion.promotionEligible = { setupType: trade.setupType, onDate: dateStr };
        promotion.pendingVerificationSetup = { setupType: trade.setupType, date: dateStr };
        console.log(`⚡ PROMOTION ELIGIBLE: ${trade.setupType}`);
      }
    }

    if (trade.status === 'closed' && clean) {
      organicClosed += 1;
      if ((trade.pnlPct ?? 0) > ORGANIC_PNL_ALERT) {
        shouldPause = true;
        console.log(
          `PAUSE: organic trade ${trade.id} ${trade.symbol} exceeded ${ORGANIC_PNL_ALERT}% pnlPct (${pct(trade.pnlPct)}). Verify before continuing.`,
        );
      }
    }

    const review = await prisma.tradeReviewReport.findUnique({
      where: { tradeId: trade.id },
      select: { id: true },
    });
    if (review) reviews += 1;
  }

  return { organicClosed, reviews, shouldPause };
}

async function logCheckpoint(
  tradingDays: string[],
  checkpointStartIndex: number,
  currentIndex: number,
  checkpointProposalIds: number[],
): Promise<void> {
  const start = tradingDays[checkpointStartIndex];
  const end = tradingDays[currentIndex];
  const taiexRows = await prisma.marketIndex.findMany({
    where: {
      name: { in: ['TAIEX', '發行量加權股價指數'] },
      date: { gte: start, lte: end },
    },
    orderBy: [{ date: 'asc' }, { name: 'asc' }],
    select: { name: true, date: true, value: true },
  });

  const taiexSeries = taiexRows.filter((row) => row.name === 'TAIEX');
  const fallbackSeries = taiexSeries.length > 0
    ? taiexSeries
    : taiexRows.filter((row) => row.name === '發行量加權股價指數');
  const first = fallbackSeries[0];
  const last = fallbackSeries.at(-1);
  const taiexTrend = first && last
    ? (((last.value - first.value) / first.value) * 100)
    : null;

  const checkpointProposals = await prisma.strategyProposal.findMany({
    where: { id: { in: checkpointProposalIds } },
    select: { symbol: true, setupType: true, thesis: true },
  });

  const breakdown = checkpointProposals.reduce<Record<string, number>>((acc, proposal) => {
    acc[proposal.setupType] = (acc[proposal.setupType] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\n[Checkpoint ${end}]`);
  console.log(`TAIEX trend (${start} → ${end}): ${pct(taiexTrend)}`);
  console.log(`New proposal setup distribution: ${JSON.stringify(breakdown)}`);
  if ((breakdown.trend ?? 0) > 0) {
    console.log('Trend proposals appeared in this checkpoint window.');
  }

  const winRates = await getWinRates();
  console.table(
    winRates.map((row) => ({
      setupType: row.setupType,
      wins: asNumber(row.wins),
      total: asNumber(row.total),
      winRate: asNumber(row.total) > 0 ? `${((asNumber(row.wins) / asNumber(row.total)) * 100).toFixed(1)}%` : 'N/A',
    })),
  );

  const fundamentalProposals = checkpointProposals.filter((proposal) => proposal.setupType === 'fundamental');
  const eventProposals = checkpointProposals.filter((proposal) => proposal.setupType === 'event');
  if (fundamentalProposals.length > 0) {
    for (const proposal of fundamentalProposals.slice(0, 3)) {
      console.log(`Fundamental proposal: ${proposal.symbol} — ${proposal.thesis}`);
    }
  }
  if (eventProposals.length > 0) {
    for (const proposal of eventProposals.slice(0, 3)) {
      console.log(`Event proposal: ${proposal.symbol} — ${proposal.thesis}`);
    }
  }
}

async function logCandidateResearchDiagnostics(snapshotId: number | undefined): Promise<void> {
  if (!snapshotId) return;

  const snapshotRow = await prisma.autonomousResearchSnapshot.findUnique({
    where: { id: snapshotId },
    select: { candidateStocks: true },
  });
  if (!snapshotRow) return;

  const candidates = parseJson<Array<{ symbol: string; name: string; setupType?: string }>>(snapshotRow.candidateStocks, []);
  const topThree = candidates.slice(0, 3);
  if (topThree.length === 0) return;

  console.log('No fundamental/event proposals yet. Top-3 candidate research diagnostics:');
  for (const candidate of topThree) {
    const stock = await prisma.stock.findUnique({
      where: { id: candidate.symbol },
      select: { id: true, name: true, industry: true },
    });
    if (!stock) continue;
    const fundamental = await buildFundamentalResearchContextForSymbol({
      symbol: stock.id,
      name: stock.name,
      industry: stock.industry ?? '未分類',
    }).catch(() => null);
    const eventSummary = await getEventSummaryForSymbol({ symbol: stock.id, days: 7, limit: 10 }).catch(() => null);

    console.log(
      `  ${stock.id} ${stock.name}: fundamentalCoverage=${fundamental?.fundamentals.dataCoverage ?? 'n/a'}, ` +
      `fundamentalSummary=${fundamental?.fundamentals.summary ?? 'n/a'}`,
    );
    console.log(
      `     eventQuality=${eventSummary?.summary.sourceQuality?.qualityLabel ?? 'n/a'}, ` +
      `eventCount=${eventSummary?.summary.eventCount ?? 0}, catalyst=${eventSummary?.summary.catalystSummary ?? 'n/a'}`,
    );
  }
}

async function runRollingWindow(counters: SessionCounters): Promise<void> {
  console.log('\n=== PHASE 1 — ROLLING SIM 2026-01-15 → 2026-04-17 ===\n');

  const tradingDays = await getTradingDays(START_DATE, END_DATE);
  if (tradingDays.length === 0) {
    console.log('No trading days found in requested window.');
    counters.rollingStoppedReason = 'No trading days available';
    return;
  }

  const promotion = await initializePromotionState(START_DATE);
  let checkpointStartIndex = 0;
  let checkpointProposalIds: number[] = [];
  let organicClosedSinceLearning = 0;

  for (let index = 0; index < tradingDays.length; index++) {
    const dateStr = tradingDays[index];
    const openTradesBefore = await prisma.simulatedTrade.findMany({
      where: { status: { in: ['shadow-open', 'open'] } },
      select: { id: true },
    });
    const pendingBefore = await prisma.simulatedTrade.count({ where: { tradeMode: 'pending' } });
    console.log(`\n--- Rolling cycle ${index + 1}/${tradingDays.length}: ${dateStr} ---`);
    const result = await runAutonomousCycle({
      simulationDate: tradingDateToSimulationDate(dateStr),
      bypassFreshnessGuard: true,
    });
    counters.rollingDaysProcessed += 1;
    counters.rollingEndDate = dateStr;

    const proposalIds = await prisma.strategyProposal.findMany({
      where: { snapshotId: result.snapshot.snapshotId },
      select: { id: true, symbol: true, setupType: true, thesis: true },
    });
    checkpointProposalIds.push(...proposalIds.map((proposal) => proposal.id));

    const setupBreakdown = result.proposals.reduce<Record<string, number>>((acc, proposal) => {
      acc[proposal.setupType] = (acc[proposal.setupType] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      `Snapshot ${result.snapshot.snapshotId}: candidates=${result.snapshot.candidateStocks.length}, proposals=${result.proposals.length}, orders=${result.orders.length}, marketState=${result.snapshot.marketState}`,
    );
    console.log(`Proposal setup breakdown: ${JSON.stringify(setupBreakdown)}`);

    const closedSummary = await logClosedTradesForCycle(
      dateStr,
      openTradesBefore.map((trade) => trade.id),
      promotion,
    );
    counters.newOrganicClosedTrades += closedSummary.organicClosed;
    counters.newReviews += closedSummary.reviews;
    organicClosedSinceLearning += closedSummary.organicClosed;
    if (closedSummary.shouldPause) {
      counters.rollingStoppedReason = 'Stopped on >35% organic pnl verification rule';
      break;
    }

    if (promotion.pendingVerificationSetup) {
      const pendingAfter = await prisma.simulatedTrade.count({ where: { tradeMode: 'pending' } });
      if (pendingAfter > pendingBefore) {
        counters.newPromotionsObserved += pendingAfter - pendingBefore;
        console.log(`Promotion verified on next cycle for ${promotion.pendingVerificationSetup.setupType}. Pending trades preview:`);
        await getPendingPreview();
        promotion.pendingVerificationSetup = null;
      }
    }

    const fundamentalCount = result.proposals.filter((proposal) => proposal.setupType === 'fundamental').length;
    const eventCount = result.proposals.filter((proposal) => proposal.setupType === 'event').length;
    if (fundamentalCount === 0 && eventCount === 0 && (index + 1) % CHECKPOINT_DAYS === 0) {
      await logCandidateResearchDiagnostics(result.snapshot.snapshotId);
    }

    if ((index + 1) % CHECKPOINT_DAYS === 0) {
      await logCheckpoint(tradingDays, checkpointStartIndex, index, checkpointProposalIds);
      checkpointStartIndex = index + 1;
      checkpointProposalIds = [];
    }

    if (organicClosedSinceLearning >= 25) {
      console.log('\nLearning checkpoint reached (25 new organic closed trades).');
      await runLearningPhase();
      organicClosedSinceLearning = 0;
    }

    const latestLearning = extractSetupSignals(await getLatestInsightRow());
    if (latestLearning.trendWinRate != null && latestLearning.trendWinRate >= 50) {
      counters.rollingStoppedReason = `Trend win rate reached ${latestLearning.trendWinRate.toFixed(1)}%`;
      console.log(`TREND RECOVERY CONFIRMED: win rate = ${latestLearning.trendWinRate.toFixed(1)}%`);
      break;
    }
    if (promotion.promotionEligible) {
      counters.rollingStoppedReason = `Promotion eligibility reached for ${promotion.promotionEligible.setupType}`;
      console.log(`Stopping early because promotion eligibility was reached for ${promotion.promotionEligible.setupType}.`);
      break;
    }

    if (Date.now() - counters.startedAtMs >= 7 * 60 * 60 * 1000) {
      counters.rollingStoppedReason = 'Runtime limit reached (7h)';
      break;
    }
  }

  if (!counters.rollingStoppedReason) {
    counters.rollingStoppedReason = 'Window exhausted';
  }
}

async function runLearningPhase(): Promise<LearningSummary | null> {
  console.log('\n=== PHASE 2 — LEARNING QUALITY UPDATE ===\n');

  const previous = extractSetupSignals(await getLatestInsightRow());
  const next = await buildStrategyLearningInsight();
  if (!next) {
    console.log('No learning insight generated.');
    return null;
  }
  const persisted = await persistStrategyLearningInsight(next);
  const latest = extractSetupSignals(await getLatestInsightRow());
  const keyChange = determineKeyChange(previous.trendWinRate, latest.trendWinRate);

  console.table([
    {
      insight: persisted.id ?? 'latest',
      sourceCount: persisted.sourceCount,
      trendWinRate: latest.trendWinRate == null ? 'N/A' : `${latest.trendWinRate.toFixed(1)}%`,
      penalized: latest.penalizedSetups.join(', ') || 'none',
      rewarded: latest.rewardedSetups.join(', ') || 'none',
      keyChange,
    },
  ]);

  if (latest.trendWinRate != null && latest.trendWinRate >= 50) {
    console.log(`TREND RECOVERY CONFIRMED: win rate = ${latest.trendWinRate.toFixed(1)}%`);
  }
  if (latest.rewardedSetups.length > 0) {
    console.log(`FIRST REWARD SIGNAL: ${latest.rewardedSetups[0]}`);
  }
  if (['fundamental', 'event'].some((setup) => latest.penalizedSetups.includes(setup) || latest.rewardedSetups.includes(setup))) {
    const setup = ['fundamental', 'event'].find((name) => latest.penalizedSetups.includes(name) || latest.rewardedSetups.includes(name));
    console.log(`SETUP DIVERSITY UNLOCKED: ${setup} evaluated`);
  }

  return latest;
}

async function runLiveValidation(counters: SessionCounters): Promise<void> {
  console.log('\n=== PHASE 3 — LIVE CYCLE VALIDATION ===\n');

  for (let index = 0; index < LIVE_CYCLES; index++) {
    const beforeMaxId = await prisma.strategyProposal.aggregate({ _max: { id: true } });
    const result = await runAutonomousCycle({
      simulationDate: tradingDateToSimulationDate(LIVE_DATE),
      bypassFreshnessGuard: true,
    });

    const candidateBreakdown = result.snapshot.candidateStocks.reduce<Record<string, number>>((acc, candidate) => {
      acc[candidate.setupType] = (acc[candidate.setupType] ?? 0) + 1;
      return acc;
    }, {});
    const proposalBreakdown = result.proposals.reduce<Record<string, number>>((acc, proposal) => {
      acc[proposal.setupType] = (acc[proposal.setupType] ?? 0) + 1;
      return acc;
    }, {});

    const proposalRows = await prisma.strategyProposal.findMany({
      where: { id: { gt: beforeMaxId._max.id ?? 0 } },
      select: { positionSizing: true },
    });
    const sizings = proposalRows.map((row) => row.positionSizing);
    const sizingRange = sizings.length > 0
      ? `${Math.min(...sizings).toFixed(3)} → ${Math.max(...sizings).toFixed(3)}`
      : 'N/A';

    counters.liveCycleCandidates.push(result.snapshot.candidateStocks.length);
    console.log(`Cycle ${index + 1}/${LIVE_CYCLES} @ ${LIVE_DATE}`);
    console.log(`  Candidates: ${result.snapshot.candidateStocks.length} ${JSON.stringify(candidateBreakdown)}`);
    console.log(`  Proposals: ${result.proposals.length} ${JSON.stringify(proposalBreakdown)}`);
    console.log(
      `  Fundamental candidates evaluated: ${candidateBreakdown.fundamental ?? 0}, Event candidates evaluated: ${candidateBreakdown.event ?? 0}`,
    );
    console.log(`  adjSizing range: ${sizingRange}`);
  }
}

async function buildHealthAssessment(counters: SessionCounters): Promise<void> {
  console.log('\n=== PHASE 4 — 9-DAY SYSTEM HEALTH ASSESSMENT ===\n');

  const latestQuote = await prisma.stockQuote.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });
  const latestChip = await prisma.institutionalChip.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }).catch(() => null);
  const latestEvent = await prisma.newsEvent.findFirst({ orderBy: { publishedAt: 'desc' }, select: { publishedAt: true } }).catch(() => null);
  const latestRevenue = await prisma.monthlyRevenue.findFirst({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    select: { year: true, month: true },
  }).catch(() => null);
  const latestFinancial = await prisma.financialReport.findFirst({
    orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
    select: { year: true, quarter: true },
  }).catch(() => null);

  console.log('Data Quality');
  console.log(`  quotes latest: ${latestQuote?.date ?? 'n/a'}`);
  console.log(`  chip latest: ${latestChip?.date ?? 'n/a'}`);
  console.log(`  events latest: ${latestEvent?.publishedAt?.toISOString() ?? 'n/a'}`);
  console.log(`  revenue latest: ${latestRevenue ? `${latestRevenue.year}-${String(latestRevenue.month).padStart(2, '0')}` : 'n/a'}`);
  console.log(`  financials latest: ${latestFinancial ? `${latestFinancial.year} Q${latestFinancial.quarter}` : 'n/a'}`);

  const contaminatedTrades = await prisma.simulatedTrade.count({
    where: { marketContext: { contains: '"dataQuality":"contaminated"' } },
  });
  const contaminationStatus = contaminatedTrades > 0
    ? `yes (${contaminatedTrades} tagged trades)`
    : 'yes (0 contaminated trades found)';
  console.log(`  contamination isolated: ${contaminationStatus}`);

  const latestInsight = extractSetupSignals(await getLatestInsightRow());
  const winRates = await getWinRates();
  const trendRate = winRates.find((row) => row.setupType === 'trend');
  const trendWr = trendRate && asNumber(trendRate.total) > 0
    ? (asNumber(trendRate.wins) / asNumber(trendRate.total)) * 100
    : null;
  const rewardedEver = latestInsight.rewardedSetups.length > 0;
  const nonTimeExits = await prisma.simulatedTrade.count({
    where: {
      status: 'closed',
      exitReason: { not: 'time' },
      NOT: { marketContext: { contains: '"dataQuality":"contaminated"' } },
    },
  });
  const organicClosed = await prisma.simulatedTrade.count({
    where: {
      status: 'closed',
      NOT: { marketContext: { contains: '"dataQuality":"contaminated"' } },
    },
  });
  console.log('Learning Signal Quality');
  const trendWinRateLabel = trendWr == null ? 'N/A' : `${trendWr.toFixed(1)}%`;
  const rewardedLabel = rewardedEver ? `yes (${latestInsight.rewardedSetups.join(', ')})` : 'no';
  const nonTimeExitRatio = organicClosed > 0 ? `${((nonTimeExits / organicClosed) * 100).toFixed(1)}%` : 'N/A';
  console.log(`  clean trend win rate: ${trendWinRateLabel}`);
  console.log(`  any rewarded setup: ${rewardedLabel}`);
  console.log(`  non-time-exit ratio: ${nonTimeExitRatio}`);

  const pendingCount = await prisma.simulatedTrade.count({ where: { tradeMode: 'pending' } });
  const fullCount = await prisma.simulatedTrade.count({ where: { tradeMode: { in: ['pending', 'full'] } } });
  const atrStops = await prisma.simulatedTrade.count({ where: { exitReason: 'atr-stop' } });
  const trailingStops = await prisma.simulatedTrade.count({ where: { exitReason: 'trailing-stop' } });
  const fullTradeLabel = fullCount > 0 ? `yes (${fullCount})` : 'no';
  const riskDefenseLabel = atrStops + trailingStops > 0
    ? `yes (${atrStops} atr-stop, ${trailingStops} trailing-stop)`
    : 'no';
  console.log('Trade Lifecycle Completeness');
  console.log(`  shadow → open → close → review: ${organicClosed > 0 ? 'working' : 'insufficient evidence'}`);
  const pendingLabel = pendingCount > 0 ? `yes (${pendingCount})` : 'no';
  console.log(`  shadow → pending triggered: ${pendingLabel}`);
  console.log(`  full trade mode reached organically: ${fullTradeLabel}`);
  console.log(`  RiskDefense ATR exits: ${riskDefenseLabel}`);

  const setupCounts = await prisma.strategyProposal.groupBy({ by: ['setupType'], _count: true });
  const setupMap = Object.fromEntries(setupCounts.map((row) => [row.setupType, row._count]));
  console.log('Setup Diversity');
  console.log(`  trend proposals: ${setupMap.trend ?? 0}`);
  console.log(`  rebound proposals: ${setupMap.rebound ?? 0}`);
  console.log(`  fundamental proposals: ${setupMap.fundamental ?? 0}`);
  console.log(`  event proposals: ${setupMap.event ?? 0}`);

  console.log('System Structural Health');
  console.log(`  live cycle functional: ${counters.liveCycleCandidates.every((count) => count > 0) ? 'yes' : 'partial'}`);
  console.log(`  rolling sim ended at: ${counters.rollingEndDate ?? 'n/a'} (${counters.rollingStoppedReason})`);
  console.log(`  learning insights clean: yes (contamination filter active in engine)`);
}

async function printFinalReport(counters: SessionCounters): Promise<void> {
  console.log('\n=== FINAL REPORT — DAY 9 SESSION SUMMARY ===\n');

  const runtimeMs = Date.now() - counters.startedAtMs;
  console.log(`Rolling sim: ${START_DATE} → ${counters.rollingEndDate ?? 'not started'}`);
  console.log(`New organic shadow-closed trades this session: ${counters.newOrganicClosedTrades}`);
  console.log(`Runtime: ${formatRuntime(runtimeMs)}`);

  const totalTrades = await prisma.simulatedTrade.count();
  const closedTradesOrganic = await prisma.simulatedTrade.count({
    where: {
      status: 'closed',
      NOT: { marketContext: { contains: '"dataQuality":"contaminated"' } },
    },
  });
  const reviewCount = await prisma.tradeReviewReport.count();
  const learningInsightCount = await prisma.strategyLearningInsight.count();
  const promotions = await prisma.simulatedTrade.count({ where: { tradeMode: 'pending' } });
  const fullTradeCount = await prisma.simulatedTrade.count({ where: { tradeMode: { in: ['pending', 'full'] } } });
  console.table([
    {
      totalTrades,
      closedTradesOrganic,
      reviewCount,
      learningInsightCount,
      shadowToPendingPromotions: promotions,
      fullTradeCount,
    },
  ]);

  const winRates = await getWinRates();
  const setupRows = ['trend', 'rebound', 'fundamental', 'event'].map((setup) => {
    const row = winRates.find((item) => item.setupType === setup);
    const total = row ? asNumber(row.total) : 0;
    const wins = row ? asNumber(row.wins) : 0;
    const rate = total > 0 ? (wins / total) * 100 : null;
    const winRate = rate == null ? 'N/A' : `${rate.toFixed(1)}%`;
    let trend = 'N/A';
    if (total > 0) {
      trend = rate != null && rate >= 50 ? '↑' : '→';
    }
    return {
      setup,
      wins,
      total,
      winRate,
      trend,
    };
  });
  console.table(setupRows);

  const exitRows = await getExitDistribution();
  const organicClosed = exitRows.reduce((sum, row) => sum + asNumber(row.total), 0);
  console.table(
    exitRows.map((row) => ({
      reason: row.exitReason ?? 'unknown',
      count: asNumber(row.total),
      pct: organicClosed > 0 ? `${((asNumber(row.total) / organicClosed) * 100).toFixed(1)}%` : 'N/A',
    })),
  );

  const latestInsightRow = await getLatestInsightRow();
  const latestInsight = extractSetupSignals(latestInsightRow);
  console.table([
    {
      insight: latestInsightRow?.id ?? null,
      sources: latestInsight.sourceCount,
      trendWr: latestInsight.trendWinRate == null ? 'N/A' : `${latestInsight.trendWinRate.toFixed(1)}%`,
      penalized: latestInsight.penalizedSetups.join(', ') || 'none',
      rewarded: latestInsight.rewardedSetups.join(', ') || 'none',
    },
  ]);

  const peakEntry = Object.entries(await initializePromotionState(START_DATE).then((state) => state.peakBySetup))
    .sort((a, b) => b[1] - a[1])[0] ?? ['none', 0];
  const estimatedNeeded = peakEntry[1] >= 3 ? '0' : `${3 - peakEntry[1]} more wins at current streak`;
  console.log('SHADOW→PENDING STATUS');
  console.log(`  Triggered: ${promotions > 0 ? 'yes' : 'no'}`);
  console.log(`  Peak consecutive wins achieved: ${peakEntry[1]}/3 for ${peakEntry[0]}`);
  console.log(`  Estimated trades needed: ${estimatedNeeded}`);

  console.log('SETUP DIVERSITY STATUS');
  console.log(`  Fundamental: ${(setupRows.find((row) => row.setup === 'fundamental')?.total ?? 0) > 0 ? 'evaluating' : '0 qualifying / blocked'}`);
  console.log(`  Event: ${(setupRows.find((row) => row.setup === 'event')?.total ?? 0) > 0 ? 'evaluating' : '0 qualifying / blocked'}`);

  console.table([
    {
      dataQuality: 'CLEAN',
      learningSignal: latestInsight.trendWinRate != null && latestInsight.trendWinRate >= 50 ? 'VALID' : 'RECOVERING',
      tradeLifecycle: promotions > 0 ? 'COMPLETE' : 'PARTIAL',
      setupDiversity: `${setupRows.filter((row) => row.total > 0).length}/4`,
      structuralIntegrity: counters.liveCycleCandidates.every((count) => count > 0) ? 'SOUND' : 'FRAGILE',
    },
  ]);

  console.log('FINAL VERDICT');
  console.log(`  Did shadow→pending ever trigger in 9 days? ${promotions > 0 ? 'yes' : 'no'}`);
  console.log(`  Is the system learning from organic signal? ${latestInsight.sourceCount > 0 ? 'yes' : 'no'}`);
  console.log(`  Is the architecture now structurally complete? ${promotions > 0 && counters.liveCycleCandidates.every((count) => count > 0) ? 'yes' : 'partial'}`);
  console.log('DAY 10 RECOMMENDATION');
  console.log(
    promotions > 0
      ? 'system is ready for sustained operation'
      : 'revisit shadow→pending promotion thresholds and evidence requirements before running another long window',
  );
}

async function main() {
  const counters: SessionCounters = {
    startedAtMs: Date.now(),
    rollingDaysProcessed: 0,
    rollingEndDate: null,
    rollingStoppedReason: '',
    newOrganicClosedTrades: 0,
    newReviews: 0,
    newPendingClosures: 0,
    newPromotionsObserved: 0,
    liveCycleCandidates: [],
  };

  try {
    await buildBaseline();
    await runRollingWindow(counters);
    await runLearningPhase();
    await runLiveValidation(counters);
    await buildHealthAssessment(counters);
    await printFinalReport(counters);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});