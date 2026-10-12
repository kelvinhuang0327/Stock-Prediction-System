import { prisma } from '../prisma';
import { assessProposalRisk } from './AutonomousRiskEngine';
import { riskDefenseModule } from '../risk/RiskDefenseModule';
import type { Position } from '../risk/RiskDefenseModule';
import {
  scoreTriggerReadiness,
  shadowSetupThresholds,
  tradeModePositionMultiplier,
} from './TriggerScoringEngine';
import type { TriggerScore, QuoteRow } from './TriggerScoringEngine';
import type {
  AutonomousResearchSnapshot,
  AutonomousResearchCandidate,
  SectorStrengthItem,
  SimulatedOrder,
  StrategyProposal,
  TradeJournalEntry,
  ReviewReport,
} from './types';

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function movingAverage(quotes: QuoteRow[], period: number): number | null {
  if (quotes.length < period) return null;
  return average(quotes.slice(-period).map((q) => q.close));
}

function recentReturn(quotes: QuoteRow[], days: number): number {
  if (quotes.length <= days) return 0;
  const latest = quotes[quotes.length - 1].close;
  const prev = quotes[quotes.length - 1 - days].close;
  return prev === 0 ? 0 : (latest - prev) / prev;
}

function resolveSlippageBps(quotes: QuoteRow[]): number {
  const recentChanges = quotes.slice(-5).map((q) => Math.abs(q.change / Math.max(1, q.close - q.change)));
  const volProxy = average(recentChanges);
  return Math.round(15 + volProxy * 100);
}

/** Compute 14-period Average True Range from quote history. */
function computeATR(quotes: QuoteRow[], period = 14): number {
  if (quotes.length < 2) return 0;
  const trueRanges: number[] = [];
  for (let i = 1; i < quotes.length; i++) {
    const high = quotes[i].high;
    const low = quotes[i].low;
    const prevClose = quotes[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }
  const recent = trueRanges.slice(-period);
  return recent.length === 0 ? 0 : recent.reduce((s, v) => s + v, 0) / recent.length;
}

function normalizeDateStr(d: string): string {
  if (!d) return d;
  if (d.includes('-')) return d;
  if (d.length === 8) return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
  return d;
}

function dateFromStr(d: string): Date {
  const iso = normalizeDateStr(d);
  return new Date(`${iso}T00:00:00+08:00`);
}

function setupThresholds(setupType: StrategyProposal['setupType']) {
  if (setupType === 'trend') return { target: 0.08, stop: -0.06, maxHoldDays: 15 };
  if (setupType === 'rebound') return { target: 0.06, stop: -0.05, maxHoldDays: 10 };
  if (setupType === 'event') return { target: 0.1, stop: -0.07, maxHoldDays: 12 };
  return { target: 0.08, stop: -0.06, maxHoldDays: 20 };
}

function buildResearchSnapshotPayload(
  snapshot: AutonomousResearchSnapshot,
  proposal: StrategyProposal,
  quotes: QuoteRow[],
  assessment: Awaited<ReturnType<typeof assessProposalRisk>>,
): Record<string, unknown> {
  const latest = quotes[quotes.length - 1];
  return {
    snapshotDate: snapshot.snapshotDate,
    marketState: snapshot.marketState,
    marketRegime: snapshot.marketRegime,
    marketRegimeConfidence: snapshot.marketRegimeConfidence,
    symbol: proposal.symbol,
    setupType: proposal.setupType,
    latestClose: latest?.close ?? null,
    ma20: movingAverage(quotes, 20),
    ret5: recentReturn(quotes, 5),
    ret10: recentReturn(quotes, 10),
    dataCoverage: snapshot.dataCoverage,
    conviction: proposal.conviction,
    positionSizing: proposal.positionSizing,
    riskAssessment: assessment,
  };
}

function buildReview(
  trade: {
    id: number;
    symbol: string;
    setupType: string;
    entryPrice: number;
    simulatedFillPrice: number;
    pnlPct: number | null;
    holdingDays: number | null;
    mfePct: number | null;
    maePct: number | null;
    exitReason: string | null;
    marketContext: string;
  },
  snapshot: AutonomousResearchSnapshot,
  triggerType: '+5' | '-5' | 'time',
): ReviewReport {
  // Extract tradeMode and promotionSource from marketContext for learning segmentation
  let tradeMode: string | undefined;
  let promotionSource: string | undefined;
  try {
    const ctx = JSON.parse(trade.marketContext);
    tradeMode = ctx.tradeMode;
    promotionSource = ctx.promotionSource;
  } catch { /* non-critical */ }

  const preTrade = {
    thesis: trade.marketContext,
    setupType: trade.setupType,
    marketState: snapshot.marketState,
    signalStrength: trade.marketContext,
    fundamentalState: snapshot.dataCoverage,
    tradeMode: tradeMode ?? 'full',
    ...(promotionSource ? { promotionSource } : {}),
  };
  const result = {
    pnlPct: trade.pnlPct,
    return: trade.pnlPct,
    holdingTime: trade.holdingDays,
    MFE: trade.mfePct,
    MAE: trade.maePct,
    exitReason: trade.exitReason,
  };
  const analysis = {
    technicalEffective: triggerType === '+5' ? '可能' : triggerType === 'time' ? '中性（時間到期）' : '需檢討',
    fundamentalSupported: snapshot.dataCoverage !== 'insufficient',
    eventDominated: snapshot.riskSignals.some((s) => s.includes('事件')),
    betaDriven: snapshot.marketState === 'defensive',
  };
  const issues = {
    regimeMismatch: snapshot.marketState === 'defensive' && trade.setupType === 'trend',
    signalQualityInsufficient: snapshot.dataCoverage !== 'full',
    enteredWithLowData: snapshot.dataCoverage === 'insufficient',
    tooEarlyOrLate: trade.holdingDays != null && trade.holdingDays < 3,
  };
  const recommendations = {
    raiseThresholds: triggerType === '-5',
    removeSetup: trade.setupType === 'trend' && snapshot.marketState === 'defensive',
    prioritizeSetup: trade.setupType,
  };

  return {
    tradeId: trade.id,
    snapshotId: snapshot.snapshotId ?? 0,
    triggerType,
    preTrade,
    result,
    analysis,
    issues,
    recommendations,
  };
}

export async function executeSimulationCycle(
  snapshot: AutonomousResearchSnapshot,
  proposals: StrategyProposal[],
): Promise<{
  orders: SimulatedOrder[];
  journalEntries: TradeJournalEntry[];
  reviewReports: ReviewReport[];
}> {
  const orders: SimulatedOrder[] = [];
  const journalEntries: TradeJournalEntry[] = [];
  const reviewReports: ReviewReport[] = [];

  // Bootstrap detection: if system has 0 closed/shadow-closed trades, lower thresholds
  const closedTradeCount = await prisma.simulatedTrade.count({
    where: { status: { in: ['closed', 'shadow-closed'] } },
  });
  const bootstrapMode = closedTradeCount === 0;

  // Bootstrap cap: stop forced promotions after N bootstrap trades to bound contamination
  const MAX_BOOTSTRAP_TRADES = 10;
  const bootstrapTradeCount = await prisma.simulatedTrade.count({
    where: { tradeMode: 'shadow', marketContext: { contains: '"bootstrapActive":true' } },
  });
  const bootstrapCapReached = bootstrapTradeCount >= MAX_BOOTSTRAP_TRADES;

  // Phase 1: Score all approved proposals
  interface ScoredProposal {
    proposal: StrategyProposal;
    assessment: Awaited<ReturnType<typeof assessProposalRisk>>;
    quotes: QuoteRow[];
    triggerScore: TriggerScore;
    isPromoted?: boolean;
    promotionEvidence?: { total: number; wins: number; winRate: number; avgPnl: number };
  }
  const scoredProposals: ScoredProposal[] = [];

  for (const proposal of proposals) {
    let assessment = await assessProposalRisk(proposal, snapshot);

    // Bootstrap data-coverage exception:
    // When the system has never produced a closed trade, the risk rejection floor
    // (adjSizing ≤ 0.01) must not block bootstrap seeding. The typical cause is
    // dataCoverage='insufficient' due to NewsEvent staleness (3-day threshold),
    // which drives dataWeight=0.4 and pushes sizing below the floor even for
    // sound proposals. In bootstrap mode, re-assess using 'limited' coverage so
    // the system can generate its first shadow trades and begin accumulating a
    // track record. Shadow sizing (0.3×) already applies sufficient conservatism.
    if (!assessment.approved && bootstrapMode && snapshot.dataCoverage === 'insufficient') {
      const bootstrapSnapshot = { ...snapshot, dataCoverage: 'limited' as const };
      const bootstrapAssessment = await assessProposalRisk(proposal, bootstrapSnapshot);
      if (bootstrapAssessment.approved) {
        assessment = { ...bootstrapAssessment, warnings: [...bootstrapAssessment.warnings, '⚡ bootstrap: dataCoverage upgraded from insufficient→limited for seeding'] };
      }
    }

    if (!assessment.approved) {
      await prisma.strategyProposal.create({
        data: {
          snapshotId: snapshot.snapshotId ?? 0,
          symbol: proposal.symbol,
          setupType: proposal.setupType,
          thesis: proposal.thesis,
          entryCondition: proposal.entryCondition,
          invalidationCondition: proposal.invalidationCondition,
          stopLossRule: proposal.stopLossRule,
          takeProfitRule: proposal.takeProfitRule,
          positionSizing: proposal.positionSizing,
          conviction: proposal.conviction,
          supportingSignals: JSON.stringify(proposal.supportingSignals),
          riskFactors: JSON.stringify(proposal.riskFactors),
          researchSnapshotId: proposal.researchSnapshotId ?? snapshot.snapshotId ?? null,
          state: 'rejected',
          decisionMeta: JSON.stringify({
            ...proposal.decisionMeta,
            assessment,
          }),
        },
      });
      continue;
    }

    const quotes = await prisma.stockQuote.findMany({
      where: { stockId: proposal.symbol },
      orderBy: { date: 'asc' },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true, change: true },
    }) as QuoteRow[];
    if (quotes.length < 20) continue;

    // Quote freshness guard: reject proposals whose latest quote is too stale.
    // Without this, trades are created with an entryDate 15-20 days ago, causing
    // immediate time-exit (holdingDays >= maxHoldDays) and contaminating the track record.
    const STALE_ENTRY_DAYS = 5;
    const latestQuoteDate = quotes[quotes.length - 1].date;
    const daysSinceLatestQuote = Math.floor(
      (Date.now() - new Date(`${latestQuoteDate}T00:00:00+08:00`).getTime()) / (24 * 60 * 60 * 1000),
    );
    if (daysSinceLatestQuote > STALE_ENTRY_DAYS) {
      console.warn(
        `[ExecutionEngine] Skipping ${proposal.symbol}: latest quote ${latestQuoteDate} is ${daysSinceLatestQuote} days old (threshold: ${STALE_ENTRY_DAYS})`,
      );
      continue;
    }

    const triggerScore = scoreTriggerReadiness(proposal, quotes, snapshot, { bootstrapMode });
    scoredProposals.push({ proposal, assessment, quotes, triggerScore });
  }

  // Phase 2: Bootstrap guarantee — if all proposals scored 'none', promote the highest to 'shadow'
  // Respects bootstrap cap to prevent unbounded low-quality trade accumulation
  if (bootstrapMode && !bootstrapCapReached && scoredProposals.length > 0 && scoredProposals.every((sp) => sp.triggerScore.tradeMode === 'none')) {
    const best = scoredProposals.reduce((a, b) => (a.triggerScore.finalScore >= b.triggerScore.finalScore ? a : b));
    best.triggerScore = {
      ...best.triggerScore,
      tradeMode: 'shadow',
      bootstrapActive: true,
    };
  }

  // Phase 2.5: Shadow Track Record Promotion
  // In defensive markets, shadow trades can never reach pending/full thresholds
  // (max score = 1.0 × 0.65 = 0.65 < 0.8). If a setup type has proven shadow
  // track record, promote to pending for learning capability.
  const MAX_PROMOTIONS_PER_CYCLE = 2;
  let promotionCount = 0;

  if (!bootstrapMode) {
    for (const sp of scoredProposals) {
      if (promotionCount >= MAX_PROMOTIONS_PER_CYCLE) break;
      if (sp.triggerScore.tradeMode !== 'shadow') continue;

      const history = await prisma.$queryRawUnsafe<Array<{
        total: number;
        wins: number;
        avgPnl: number;
      }>>(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN pnlPct > 0 THEN 1 ELSE 0 END) as wins,
           AVG(pnlPct) as avgPnl
         FROM SimulatedTrade
         WHERE status = 'shadow-closed'
           AND setupType = ?`,
        sp.proposal.setupType,
      );

      if (history.length === 0) continue;
      const { total, wins, avgPnl } = history[0];
      if (total < 5) continue;

      const winRate = total > 0 ? wins / total : 0;
      if (winRate < 0.55 && avgPnl <= 0) continue;

      // Promote shadow → pending (NOT full) with track record evidence
      sp.triggerScore = {
        ...sp.triggerScore,
        tradeMode: 'pending',
      };
      sp.isPromoted = true;
      sp.promotionEvidence = { total, wins, winRate, avgPnl };
      promotionCount++;
    }
  }

  // Phase 3: Execute based on trade mode
  for (const { proposal, assessment, quotes, triggerScore, isPromoted } of scoredProposals) {
    const tradeMode = triggerScore.tradeMode;
    const latest = quotes[quotes.length - 1];
    const fillSlippageBps = resolveSlippageBps(quotes);
    const simulatedFillPrice = latest.close * (1 + fillSlippageBps / 10000);

    // Apply trade mode position multiplier to sizing
    const modeSizingMultiplier = tradeModePositionMultiplier(tradeMode);
    const effectiveSizing = assessment.adjustedPositionSizing * modeSizingMultiplier;
    const quantity = Math.max(0, Math.floor((1_000_000 * effectiveSizing) / simulatedFillPrice));

    const proposalState = tradeMode === 'none' ? 'approved'
      : tradeMode === 'shadow' ? 'shadow'
      : tradeMode === 'pending' ? 'pending'
      : 'triggered';

    const marketContext = {
      marketState: snapshot.marketState,
      regime: snapshot.marketRegime,
      regimeConfidence: snapshot.marketRegimeConfidence,
      note: tradeMode === 'none'
        ? '條件未成立，保留為候選提案'
        : tradeMode === 'shadow'
          ? `影子交易：觸發分數 ${triggerScore.finalScore.toFixed(2)}，紙上追蹤`
          : tradeMode === 'pending' && isPromoted
            ? `影子實績晉升：${proposal.setupType} 歷史勝率達標，半倉待確認`
            : tradeMode === 'pending'
              ? `待確認交易：觸發分數 ${triggerScore.finalScore.toFixed(2)}，半倉進場`
              : `條件成立（分數 ${triggerScore.finalScore.toFixed(2)}），已進入模擬執行`,
    };

    const proposalRow = await prisma.strategyProposal.create({
      data: {
        snapshotId: snapshot.snapshotId ?? 0,
        symbol: proposal.symbol,
        setupType: proposal.setupType,
        thesis: proposal.thesis,
        entryCondition: proposal.entryCondition,
        invalidationCondition: proposal.invalidationCondition,
        stopLossRule: proposal.stopLossRule,
        takeProfitRule: proposal.takeProfitRule,
        positionSizing: effectiveSizing,
        conviction: proposal.conviction,
        supportingSignals: JSON.stringify(proposal.supportingSignals),
        riskFactors: JSON.stringify(proposal.riskFactors),
        researchSnapshotId: proposal.researchSnapshotId ?? snapshot.snapshotId ?? null,
        state: proposalState,
        decisionMeta: JSON.stringify({
          ...proposal.decisionMeta,
          assessment,
          triggerScore: {
            finalScore: triggerScore.finalScore,
            rawScore: triggerScore.rawScore,
            regimeMultiplier: triggerScore.regimeMultiplier,
            tradeMode: triggerScore.tradeMode,
            bootstrapActive: triggerScore.bootstrapActive,
            components: triggerScore.components.map((c) => ({ name: c.name, score: c.score, met: c.met })),
          },
        }),
      },
    });

    // Skip if no trade action
    if (tradeMode === 'none' || quantity <= 0) {
      continue;
    }

    // Determine thresholds based on trade mode
    // Promoted pending trades keep shadow thresholds (tighter stops) for conservative risk
    const isShadow = tradeMode === 'shadow';
    const useStricterThresholds = isShadow || !!isPromoted;
    const thresholds = useStricterThresholds ? shadowSetupThresholds(proposal.setupType) : setupThresholds(proposal.setupType);
    const reviewPctThreshold = useStricterThresholds ? 3 : 5;
    const tradeStatus = isShadow ? 'shadow-open' : 'open';

    // Build full marketContext JSON once — used for both DB storage and review generation
    const fullMarketContextJson = JSON.stringify({
      ...marketContext,
      tradeMode,
      triggerScore: triggerScore.finalScore,
      ...(isPromoted ? { promotionSource: 'shadow_track_record' } : {}),
    });

    const trade = await prisma.simulatedTrade.create({
      data: {
        proposalId: proposalRow.id,
        snapshotId: snapshot.snapshotId ?? 0,
        symbol: proposal.symbol,
        setupType: proposal.setupType,
        triggerTime: new Date(),
        entryDate: latest.date,
        entryPrice: latest.close,
        simulatedFillPrice,
        slippageModel: `bps=${fillSlippageBps}`,
        quantity,
        marketContext: fullMarketContextJson,
        status: tradeStatus,
        tradeMode,
      },
    });

    await prisma.tradeJournalEntry.create({
      data: {
        tradeId: trade.id,
        snapshotId: snapshot.snapshotId ?? 0,
        decisionReasoning: proposal.thesis,
        executionDetail: JSON.stringify({
          entryCondition: proposal.entryCondition,
          invalidationCondition: proposal.invalidationCondition,
          stopLossRule: proposal.stopLossRule,
          takeProfitRule: proposal.takeProfitRule,
          tradeMode,
          triggerScore: triggerScore.finalScore,
          bootstrapActive: triggerScore.bootstrapActive,
        }),
        lifecycle: tradeStatus,
        researchSnapshot: JSON.stringify(buildResearchSnapshotPayload(snapshot, proposal, quotes, assessment)),
        pnlPct: 0,
      },
    });

    // Evaluate immediate exit conditions using historical data from entry date forward
    const updatedQuotes = quotes.filter((q) => {
      try {
        const qDate = dateFromStr(q.date);
        const entryDateObj = dateFromStr(trade.entryDate);
        return qDate >= entryDateObj;
      } catch { return false; }
    });
    const highSinceEntry = Math.max(...updatedQuotes.map((q) => q.high));
    const lowSinceEntry = Math.min(...updatedQuotes.map((q) => q.low));
    const currentClose = updatedQuotes[updatedQuotes.length - 1].close;
    const pnlPct = (currentClose - simulatedFillPrice) / simulatedFillPrice;
    const mfePct = (highSinceEntry - simulatedFillPrice) / simulatedFillPrice;
    const maePct = (lowSinceEntry - simulatedFillPrice) / simulatedFillPrice;
    const holdingDays = Math.max(0, Math.floor((new Date().getTime() - new Date(`${trade.entryDate}T00:00:00+08:00`).getTime()) / (24 * 60 * 60 * 1000)));
    const stopHit = pnlPct <= thresholds.stop;
    const targetHit = pnlPct >= thresholds.target;
    const shouldClose = stopHit || targetHit || holdingDays >= thresholds.maxHoldDays;

    let exitReason: string | null = null;
    let status: string = tradeStatus;
    let exitPrice: number | null = null;
    if (shouldClose) {
      status = isShadow ? 'shadow-closed' : 'closed';
      exitPrice = currentClose;
      exitReason = stopHit ? 'stop' : targetHit ? 'target' : 'time';
    }

    const updatedTrade = await prisma.simulatedTrade.update({
      where: { id: trade.id },
      data: {
        status,
        exitTime: shouldClose ? new Date() : null,
        exitPrice,
        pnlPct: pnlPct * 100,
        pnlAmount: quantity * (currentClose - simulatedFillPrice),
        mfePct: mfePct * 100,
        maePct: maePct * 100,
        holdingDays,
        exitReason,
        stopHit,
        targetHit,
      },
    });

    await prisma.tradeJournalEntry.update({
      where: { tradeId: trade.id },
      data: {
        lifecycle: status,
        pnlPct: pnlPct * 100,
      },
    });

    orders.push({
      proposalId: proposalRow.id,
      snapshotId: snapshot.snapshotId,
      symbol: proposal.symbol,
      setupType: proposal.setupType,
      triggerTime: new Date().toISOString(),
      simulatedFillPrice,
      slippageModel: `bps=${fillSlippageBps}`,
      quantity,
      marketContext,
    });
    journalEntries.push({
      tradeId: trade.id,
      snapshotId: snapshot.snapshotId,
      decisionReasoning: proposal.thesis,
      executionDetail: JSON.stringify({
        entryCondition: proposal.entryCondition,
        invalidationCondition: proposal.invalidationCondition,
        stopLossRule: proposal.stopLossRule,
        takeProfitRule: proposal.takeProfitRule,
        tradeMode,
      }),
      lifecycle: status,
      researchSnapshot: JSON.parse(JSON.stringify(buildResearchSnapshotPayload(snapshot, proposal, quotes, assessment))),
      pnlPct: pnlPct * 100,
    });

    // Generate review for closed/shadow-closed trades that exceed threshold
    const isClosed = status === 'closed' || status === 'shadow-closed';
    if (isClosed && Math.abs(pnlPct * 100) >= reviewPctThreshold) {
      const triggerType: '+5' | '-5' | 'time' = exitReason === 'time' ? 'time' : pnlPct >= reviewPctThreshold / 100 ? '+5' : '-5';
      const review = buildReview(
        {
          id: updatedTrade.id,
          symbol: updatedTrade.symbol,
          setupType: updatedTrade.setupType,
          entryPrice: updatedTrade.entryPrice,
          simulatedFillPrice: updatedTrade.simulatedFillPrice,
          pnlPct: updatedTrade.pnlPct,
          holdingDays: updatedTrade.holdingDays,
          mfePct: updatedTrade.mfePct,
          maePct: updatedTrade.maePct,
          exitReason: updatedTrade.exitReason,
          marketContext: fullMarketContextJson,
        },
        snapshot,
        triggerType,
      );

      await prisma.tradeReviewReport.create({
        data: {
          tradeId: trade.id,
          snapshotId: snapshot.snapshotId ?? 0,
          triggerType,
          preTrade: JSON.stringify(review.preTrade),
          result: JSON.stringify(review.result),
          analysis: JSON.stringify(review.analysis),
          issues: JSON.stringify(review.issues),
          recommendations: JSON.stringify(review.recommendations),
        },
      });
      reviewReports.push(review);
    }
  }

  return { orders, journalEntries, reviewReports };
}

// ---------------------------------------------------------------------------
// TradeCloser — re-evaluates all open/shadow-open trades on each daily cycle.
//
// Called BEFORE executeSimulationCycle so the risk engine sees correct open
// exposure, and so the learning engine can act on reviews generated here.
//
// Design:
//   • Idempotent — safe to call multiple times; reviews are skipped if they
//     already exist, and closed trades are ignored by the status filter.
//   • Always updates live P&L metrics (pnlPct / mfePct / maePct / holdingDays)
//     even when the trade does not yet hit a close condition, so the monitor
//     always reflects current unrealised P&L.
//   • Mirrors creation-time threshold logic exactly:
//       - full / pending-promoted  → setupThresholds()
//       - shadow / shadow-promoted → shadowSetupThresholds()
//   • Quote freshness guard matches the entry guard (STALE_ENTRY_DAYS = 5) to
//     prevent stale-price false exits.
// ---------------------------------------------------------------------------
export async function closeOpenTrades(options?: {
  /** Override wall-clock time for simulation / fast-forward mode. */
  simulationDate?: Date;
  /** Skip the quote-freshness guard — required when simulating future dates with available historical data. */
  bypassFreshnessGuard?: boolean;
}): Promise<{
  evaluated: number;
  closed: number;
  reviewsGenerated: number;
}> {
  const STALE_ENTRY_DAYS = 5;
  const now = options?.simulationDate ?? new Date();
  const bypassFreshness = options?.bypassFreshnessGuard ?? false;

  const openTrades = await prisma.simulatedTrade.findMany({
    where: { status: { in: ['open', 'shadow-open'] } },
    orderBy: { entryDate: 'asc' },
  });

  let closed = 0;
  let reviewsGenerated = 0;

  for (const trade of openTrades) {
    // ── 1. Load quotes ─────────────────────────────────────────────────────
    const quotes = await prisma.stockQuote.findMany({
      where: { stockId: trade.symbol },
      orderBy: { date: 'asc' },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true, change: true },
    }) as QuoteRow[];

    if (quotes.length === 0) {
      console.warn(`[TradeCloser] trade ${trade.id} (${trade.symbol}): no quotes — skipping`);
      continue;
    }

    // ── 2. Freshness guard ─────────────────────────────────────────────────
    const latestQuoteDate = quotes[quotes.length - 1].date;
    if (!bypassFreshness) {
      const daysSinceLatestQuote = Math.floor(
        (now.getTime() - new Date(`${latestQuoteDate}T00:00:00+08:00`).getTime()) / (24 * 60 * 60 * 1000),
      );
      if (daysSinceLatestQuote > STALE_ENTRY_DAYS) {
        console.warn(
          `[TradeCloser] trade ${trade.id} (${trade.symbol}): latest quote ${latestQuoteDate} is ${daysSinceLatestQuote}d old — skipping`,
        );
        continue;
      }
    }

    // ── 3. Compute metrics from entry date forward ─────────────────────────
    // Apply an upper date ceiling equal to `now` to prevent future-quote leakage
    // when closeOpenTrades is invoked with a historical simulationDate.
    const simDateCeiling = now.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const updatedQuotes = quotes.filter((q) => {
      try {
        const qDate = dateFromStr(q.date);
        const entryDateObj = dateFromStr(trade.entryDate);
        const ceilingDate = dateFromStr(simDateCeiling);
        return qDate >= entryDateObj && qDate <= ceilingDate;
      } catch { return false; }
    });
    if (updatedQuotes.length === 0) {
      console.warn(`[TradeCloser] trade ${trade.id} (${trade.symbol}): no quotes on/after entryDate ${trade.entryDate} — skipping`);
      continue;
    }

    const highSinceEntry = Math.max(...updatedQuotes.map((q) => q.high));
    const lowSinceEntry = Math.min(...updatedQuotes.map((q) => q.low));
    const currentClose = updatedQuotes[updatedQuotes.length - 1].close;
    const pnlPct = (currentClose - trade.simulatedFillPrice) / trade.simulatedFillPrice;
    const mfePct = (highSinceEntry - trade.simulatedFillPrice) / trade.simulatedFillPrice;
    const maePct = (lowSinceEntry - trade.simulatedFillPrice) / trade.simulatedFillPrice;
    const holdingDays = Math.max(
      0,
      Math.floor(
        (now.getTime() - new Date(`${trade.entryDate}T00:00:00+08:00`).getTime()) / (24 * 60 * 60 * 1000),
      ),
    );

    // ── 4. Determine thresholds — mirror creation-time logic ───────────────
    const isShadow = trade.status === 'shadow-open';
    const tradeMode = trade.tradeMode ?? (isShadow ? 'shadow' : 'full');
    const useStricterThresholds = isShadow || tradeMode === 'shadow' || tradeMode === 'pending';
    const thresholds = useStricterThresholds
      ? shadowSetupThresholds(trade.setupType as StrategyProposal['setupType'])
      : setupThresholds(trade.setupType as StrategyProposal['setupType']);
    const reviewPctThreshold = useStricterThresholds ? 3 : 5;

    // ── 5. Evaluate exit conditions ────────────────────────────────────────
    const stopHit = pnlPct <= thresholds.stop;
    const targetHit = pnlPct >= thresholds.target;

    // ── 5a. RiskDefense layered stop evaluation (Fix 1) ───────────────────
    const atr = computeATR(updatedQuotes);
    const riskPosition: Position = {
      entryPrice: trade.simulatedFillPrice,
      entryDate: new Date(`${trade.entryDate}T00:00:00+08:00`),
      currentPrice: currentClose,
      highestPrice: highSinceEntry,
      atr,
    };
    const riskResult = riskDefenseModule.evaluateStopLoss(riskPosition, now);
    // Skip L4_TIME — superseded by setup-specific maxHoldDays
    const riskTriggered = riskResult.shouldExit && riskResult.level !== 'L4_TIME';

    const shouldClose = stopHit || targetHit || holdingDays >= thresholds.maxHoldDays || riskTriggered;

    const newStatus = shouldClose ? (isShadow ? 'shadow-closed' : 'closed') : trade.status;
    const exitReason: string | null = shouldClose
      ? stopHit ? 'stop'
        : targetHit ? 'target'
        : riskTriggered
          ? (riskResult.level === 'L2_ATR' ? 'atr-stop'
            : riskResult.level === 'L3_TRAILING' ? 'trailing-stop'
            : 'stop')  // L1_EMERGENCY → 'stop'
        : 'time'
      : null;

    // ── 6. Persist updates — always refresh P&L, close only when triggered ─
    await prisma.simulatedTrade.update({
      where: { id: trade.id },
      data: {
        status: newStatus,
        ...(shouldClose ? { exitTime: new Date(), exitPrice: currentClose } : {}),
        pnlPct: pnlPct * 100,
        pnlAmount: trade.quantity * (currentClose - trade.simulatedFillPrice),
        mfePct: mfePct * 100,
        maePct: maePct * 100,
        holdingDays,
        stopHit,
        targetHit,
        ...(exitReason !== null ? { exitReason } : {}),
      },
    });

    // updateMany is safe here — some trades may not have a journal entry
    await prisma.tradeJournalEntry.updateMany({
      where: { tradeId: trade.id },
      data: {
        lifecycle: newStatus,
        pnlPct: pnlPct * 100,
      },
    });

    if (!shouldClose) continue;

    closed++;
    console.log(
      `[TradeCloser] closed trade ${trade.id} (${trade.symbol}): pnl=${(pnlPct * 100).toFixed(2)}% reason=${exitReason} holding=${holdingDays}d${riskTriggered ? ` [RiskDefense L=${riskResult.level}]` : ''}`,
    );

    // ── 7. Generate review if exit qualifies ─────────────────────────────
    // Always review time-exits so the learning engine receives signal from
    // every completed trade, regardless of P&L magnitude. Stop/target exits
    // still require the |pnlPct| threshold so low-quality micro-moves don't
    // contaminate the learning engine with noisy ±0.x% signals.
    const isTimeExit = exitReason === 'time';
    if (!isTimeExit && Math.abs(pnlPct * 100) < reviewPctThreshold) continue;

    const existingReview = await prisma.tradeReviewReport.findUnique({ where: { tradeId: trade.id } });
    if (existingReview) continue;

    const snapshotRow = await prisma.autonomousResearchSnapshot.findUnique({
      where: { id: trade.snapshotId },
    });
    if (!snapshotRow) continue;

    // Reconstruct minimal snapshot from stored DB row — only the fields
    // consumed by buildReview() are required; the rest are safe defaults.
    let sectorStrength: SectorStrengthItem[] = [];
    let candidateStocks: AutonomousResearchCandidate[] = [];
    let riskSignals: string[] = [];
    let topInsights: string[] = [];
    let limitations: string[] = [];
    try { sectorStrength = JSON.parse(snapshotRow.sectorStrength ?? '[]') as SectorStrengthItem[]; } catch { /* ignore */ }
    try { candidateStocks = JSON.parse(snapshotRow.candidateStocks ?? '[]') as AutonomousResearchCandidate[]; } catch { /* ignore */ }
    try { riskSignals = JSON.parse(snapshotRow.riskSignals ?? '[]') as string[]; } catch { /* ignore */ }
    try { topInsights = JSON.parse(snapshotRow.topInsights ?? '[]') as string[]; } catch { /* ignore */ }
    try { limitations = JSON.parse(snapshotRow.limitations ?? '[]') as string[]; } catch { /* ignore */ }

    const minimalSnapshot: AutonomousResearchSnapshot = {
      snapshotId: snapshotRow.id,
      snapshotDate: snapshotRow.snapshotDate,
      generatedAt: snapshotRow.snapshotDate,
      marketState: snapshotRow.marketState as AutonomousResearchSnapshot['marketState'],
      marketRegime: 'unknown',
      marketRegimeConfidence: 0.5,
      sectorStrength,
      candidateStocks,
      riskSignals,
      topInsights,
      dataCoverage: (snapshotRow.dataCoverage ?? 'insufficient') as AutonomousResearchSnapshot['dataCoverage'],
      limitations,
    };

    const triggerType: '+5' | '-5' | 'time' = exitReason === 'time' ? 'time' : pnlPct * 100 >= reviewPctThreshold ? '+5' : '-5';
    const review = buildReview(
      {
        id: trade.id,
        symbol: trade.symbol,
        setupType: trade.setupType,
        entryPrice: trade.entryPrice,
        simulatedFillPrice: trade.simulatedFillPrice,
        pnlPct: pnlPct * 100,
        holdingDays,
        mfePct: mfePct * 100,
        maePct: maePct * 100,
        exitReason,
        marketContext: trade.marketContext ?? '{}',
      },
      minimalSnapshot,
      triggerType,
    );

    await prisma.tradeReviewReport.create({
      data: {
        tradeId: trade.id,
        snapshotId: trade.snapshotId,
        triggerType,
        preTrade: JSON.stringify(review.preTrade),
        result: JSON.stringify(review.result),
        analysis: JSON.stringify(review.analysis),
        issues: JSON.stringify(review.issues),
        recommendations: JSON.stringify(review.recommendations),
      },
    });
    reviewsGenerated++;
  }

  return { evaluated: openTrades.length, closed, reviewsGenerated };
}

// ---------------------------------------------------------------------------
// Shadow → Pending Promotion Engine (Fix 2)
//
// Runs at the start of each daily cycle, before closeOpenTrades().
// Promotes open shadow trades to pending when:
//   1. The last 3 shadow-closed trades for the same setupType all have pnlPct > 0
//   2. At least 1 shadow-closed trade exists for this specific symbol
//
// Promoted trades keep status='shadow-open' (lifecycle is unchanged) but get
// tradeMode='pending', causing StrategyLearningEngine to apply 0.7× weight.
// ---------------------------------------------------------------------------
export async function promoteShadowTrades(): Promise<{
  promoted: number;
  details: Array<{ id: number; symbol: string; setupType: string }>;
}> {
  const shadowTrades = await prisma.simulatedTrade.findMany({
    where: { status: 'shadow-open', tradeMode: 'shadow' },
    orderBy: { entryDate: 'asc' },
  });

  if (shadowTrades.length === 0) return { promoted: 0, details: [] };

  const details: Array<{ id: number; symbol: string; setupType: string }> = [];

  for (const trade of shadowTrades) {
    // Criterion 1: last N shadow-closed trades for same setupType — STRICTLY consecutive wins
    // Fetch all shadow-closed for this setupType ordered ASC, then walk from the most recent
    // backwards counting consecutive positives. Non-positive breaks the streak immediately.
    const allClosed = await prisma.simulatedTrade.findMany({
      where: {
        status: 'shadow-closed',
        setupType: trade.setupType,
        pnlPct: { not: null },
      },
      orderBy: { exitTime: 'asc' },
    });
    let consecutiveWins = 0;
    for (let i = allClosed.length - 1; i >= 0; i--) {
      if ((allClosed[i].pnlPct ?? 0) > 0) {
        consecutiveWins++;
      } else {
        break; // streak broken — stop counting
      }
    }
    if (consecutiveWins < 3) continue;

    // Criterion 2: at least 1 shadow-closed trade for this symbol
    const symbolHistory = await prisma.simulatedTrade.count({
      where: { status: 'shadow-closed', symbol: trade.symbol },
    });
    if (symbolHistory < 1) continue;

    // Promote: update tradeMode and marketContext
    let ctx: Record<string, unknown> = {};
    try { ctx = JSON.parse(trade.marketContext ?? '{}') as Record<string, unknown>; } catch { /* ignore */ }
    const updatedCtx = { ...ctx, tradeMode: 'pending', promotionSource: 'shadow_promotion_cycle' };

    await prisma.simulatedTrade.update({
      where: { id: trade.id },
      data: {
        tradeMode: 'pending',
        marketContext: JSON.stringify(updatedCtx),
      },
    });

    console.log(
      `[PromotionEngine] PROMOTED: ${trade.symbol} shadow→pending, based on ${consecutiveWins} strictly consecutive positive shadow exits (setupType=${trade.setupType})`,
    );
    details.push({ id: trade.id, symbol: trade.symbol, setupType: trade.setupType });
  }

  return { promoted: details.length, details };
}
