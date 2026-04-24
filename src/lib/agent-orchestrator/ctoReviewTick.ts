// CTO Review Tick
// Adapted from LotteryNew cto_review_tick.py
// Reviews pending StrategyProposals and assigns decisions:
//   ACCEPTED_FOR_LEARNING, REJECTED_ADJUST_SIGNAL, DEFERRED_REGIME_MISMATCH,
//   REFLECTED_IN_INSIGHT, DUPLICATE, SUPERSEDED

import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
import { batchInsertBacklogItems } from './backlogService';
import { classifySignalState } from './signalStateClassifier';
import type {
  BacklogCategory,
  BacklogItemInput,
  BacklogSeverity,
  BacklogUrgency,
  CtoDecision,
  CtoReviewCandidate,
  CtoReviewRunInput,
  CtoReviewRunResult,
} from './ctoTypes';
import {
  CTO_DECISION_SEVERITY,
  CTO_DECISION_URGENCY,
} from './ctoTypes';

// ─── Decision Logic ───────────────────────────────────────────────────────────

interface ProposalRow {
  id: number;
  symbol: string;
  setupType: string;
  conviction: string;
  reviewTriggerType: string | null;
  tradeMode: string;
  pnlPct: number | null;
  exitReason: string | null;
  decisionReason: string | null;
}

function decideProposal(
  proposal: ProposalRow,
  existingInsightSetupTypes: Set<string>,
  reviewedSymbols: Set<string>,
): CtoDecision {
  // REFLECTED_IN_INSIGHT — setupType already learned and in a recent insight
  if (existingInsightSetupTypes.has(proposal.setupType)) {
    return 'REFLECTED_IN_INSIGHT';
  }

  // DUPLICATE — same symbol already reviewed in this run
  if (reviewedSymbols.has(proposal.symbol)) {
    return 'DUPLICATE';
  }

  // No pnl data — not yet closed
  if (proposal.pnlPct === null) {
    return 'DEFERRED_REGIME_MISMATCH';
  }

  // REJECTED_ADJUST_SIGNAL — loss trades with clear exit signal
  const isLoss = proposal.pnlPct < 0;
  const isStopExit = proposal.exitReason === 'stop_loss' || proposal.exitReason === 'atr_stop';
  if (isLoss && isStopExit) {
    return 'REJECTED_ADJUST_SIGNAL';
  }

  // DEFERRED_REGIME_MISMATCH — rebound setup in apparent downtrend regime (heuristic)
  const isRebound = proposal.setupType === 'rebound';
  const isTrendLoss = proposal.exitReason === 'time_exit' && isLoss;
  if (isRebound && isTrendLoss) {
    return 'DEFERRED_REGIME_MISMATCH';
  }

  return 'ACCEPTED_FOR_LEARNING';
}

// ─── Backlog Item Factory ─────────────────────────────────────────────────────

function candidateToBacklogInput(
  candidate: CtoReviewCandidate,
  runId: string,
): BacklogItemInput | null {
  const decision = candidate.decision;
  if (!decision) return null;
  if (decision === 'ACCEPTED_FOR_LEARNING' || decision === 'REFLECTED_IN_INSIGHT') return null;
  if (decision === 'DUPLICATE') return null;

  const rawSeverity = CTO_DECISION_SEVERITY[decision];
  const severity = rawSeverity as BacklogSeverity;
  const rawUrgency = CTO_DECISION_URGENCY[decision];
  const urgency = rawUrgency as BacklogUrgency;

  const category: BacklogCategory =
    decision === 'REJECTED_ADJUST_SIGNAL' ? 'signal' :
    decision === 'DEFERRED_REGIME_MISMATCH' ? 'regime' :
    decision === 'SUPERSEDED' ? 'execution' : 'data';

  const pnlAbs = Math.abs(candidate.pnlPct ?? 0);
  const impactScore = Math.min(100, Math.round(50 + pnlAbs * 2));

  const suggestedAction =
    decision === 'REJECTED_ADJUST_SIGNAL'
      ? `Review ${candidate.setupType} signal parameters for ${candidate.symbol} — stop-loss exit at ${(candidate.pnlPct ?? 0).toFixed(1)}%`
      : decision === 'DEFERRED_REGIME_MISMATCH'
        ? `Re-evaluate ${candidate.setupType} setup for ${candidate.symbol} when regime aligns`
        : undefined;

  return {
    findingId: `cto-${decision.toLowerCase()}-${candidate.proposalId}`,
    ctoRunId:  runId,
    source:    'review',
    severity,
    impactScore,
    urgency,
    category,
    suggestedAction,
    proposalId: candidate.proposalId,
  };
}

// ─── Intent Signal Recording ──────────────────────────────────────────────────

async function recordIntentSignals(
  runId: string,
  candidates: CtoReviewCandidate[],
): Promise<void> {
  const accepted  = candidates.filter((c) => c.decision === 'ACCEPTED_FOR_LEARNING').length;
  const rejected  = candidates.filter((c) => c.decision === 'REJECTED_ADJUST_SIGNAL').length;
  const deferred  = candidates.filter((c) => c.decision === 'DEFERRED_REGIME_MISMATCH').length;
  const total     = candidates.length;

  // resubmit_proposal signal: any rejected → partial success; none rejected → success
  const resubmitOutcome = rejected > 0 ? 'partial' : 'success';
  // compare_regimes signal: deferred → partial; no deferred → success
  const compareOutcome  = deferred > 0 ? 'partial' : 'success';
  // force_learning signal: accepted ≥ 1 → success; else failed
  const forceOutcome    = accepted >= 1 ? 'success' : 'failed';

  const signals = [
    {
      runId,
      runIntent:      'resubmit_proposal',
      outcome:        resubmitOutcome,
      candidateCount: total,
      acceptedCount:  accepted,
      rejectedCount:  rejected,
      deferredCount:  deferred,
    },
    {
      runId,
      runIntent:      'compare_regimes',
      outcome:        compareOutcome,
      candidateCount: total,
      acceptedCount:  accepted,
      rejectedCount:  rejected,
      deferredCount:  deferred,
    },
    {
      runId,
      runIntent:      'force_learning',
      outcome:        forceOutcome,
      candidateCount: total,
      acceptedCount:  accepted,
      rejectedCount:  rejected,
      deferredCount:  deferred,
    },
  ];

  await prisma.ctoIntentSignal.createMany({ data: signals });
}

// ─── Main Tick ────────────────────────────────────────────────────────────────

export async function runCtoReviewTick(input: CtoReviewRunInput): Promise<CtoReviewRunResult> {
  const runId    = randomUUID();
  const startedAt = new Date();

  // 1. Classify signal state — determines how aggressively to review
  const signalState = await classifySignalState();

  // 2. Load proposals pending review
  //    - Any proposal not yet CTO-reviewed (state: approved or triggered, ctoDecision null)
  //    - Limit to 30 per run to keep runs fast
  const proposals = await prisma.strategyProposal.findMany({
    where: {
      state:       { in: ['approved', 'triggered'] },
      ctoDecision: null,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id:        true,
      symbol:    true,
      setupType: true,
      conviction: true,
    },
  });

  // 3. Load latest insight setup types (to detect REFLECTED)
  //    Parse adjustmentSuggestions to find mentioned setup types
  const recentInsights = await prisma.strategyLearningInsight.findMany({
    orderBy: { id: 'desc' },
    take: 5,
    select: { adjustmentSuggestions: true, successPatterns: true },
  });
  const insightText = recentInsights
    .flatMap((i) => [i.adjustmentSuggestions ?? '', i.successPatterns ?? ''])
    .join(' ')
    .toLowerCase();
  const SETUP_TYPES = ['trend', 'rebound', 'breakout', 'momentum'] as const;
  const existingInsightSetupTypes = new Set(
    SETUP_TYPES.filter((s) => insightText.includes(s)),
  );

  // 4. Load closed trades for pnl lookup
  const closedTrades = await prisma.simulatedTrade.findMany({
    where: {
      status: 'closed',
      proposalId: { in: proposals.map((p) => p.id) },
    },
    select: { proposalId: true, pnlPct: true, exitReason: true, tradeMode: true },
  });
  const tradeByProposal = new Map(closedTrades.map((t) => [t.proposalId, t]));

  // 5. Run decisions
  const reviewedSymbols = new Set<string>();
  const candidates: CtoReviewCandidate[] = [];

  for (const proposal of proposals) {
    const trade = tradeByProposal.get(proposal.id) ?? null;

    const proposalRow: ProposalRow = {
      id:                proposal.id,
      symbol:            proposal.symbol,
      setupType:         proposal.setupType,
      conviction:        proposal.conviction,
      reviewTriggerType: null,
      tradeMode:         trade?.tradeMode ?? 'full',
      pnlPct:            trade?.pnlPct ?? null,
      exitReason:        trade?.exitReason ?? null,
      decisionReason:    null,
    };

    const decision = decideProposal(proposalRow, existingInsightSetupTypes, reviewedSymbols);
    reviewedSymbols.add(proposal.symbol);

    const decisionReason =
      decision === 'REFLECTED_IN_INSIGHT' ? `setupType=${proposal.setupType} already in recent insight` :
      decision === 'DUPLICATE' ? `symbol=${proposal.symbol} already reviewed this run` :
      decision === 'REJECTED_ADJUST_SIGNAL' ? `pnlPct=${(trade?.pnlPct ?? 0).toFixed(1)}% — stop-loss exit` :
      decision === 'DEFERRED_REGIME_MISMATCH' ? `rebound in time-exit loss — regime mismatch` :
      `accepted for learning (pnlPct=${(trade?.pnlPct ?? 0).toFixed(1)}%)`;

    candidates.push({
      proposalId:        proposal.id,
      symbol:            proposal.symbol,
      setupType:         proposal.setupType,
      conviction:        proposal.conviction,
      pnlPct:            trade?.pnlPct ?? null,
      exitReason:        trade?.exitReason ?? null,
      tradeMode:         proposalRow.tradeMode,
      reviewTriggerType: proposalRow.reviewTriggerType,
      decision,
      decisionReason,
    });
  }

  // 6. Persist ctoDecision back to proposals
  await Promise.all(
    candidates.map((c) =>
      prisma.strategyProposal.update({
        where: { id: c.proposalId },
        data:  { ctoDecision: c.decision, ctoDecisionReason: c.decisionReason },
      }),
    ),
  );

  // 7. Count outcomes
  const accepted  = candidates.filter((c) => c.decision === 'ACCEPTED_FOR_LEARNING').length;
  const rejected  = candidates.filter((c) => c.decision === 'REJECTED_ADJUST_SIGNAL').length;
  const deferred  = candidates.filter((c) => c.decision === 'DEFERRED_REGIME_MISMATCH').length;
  const reflected = candidates.filter((c) => c.decision === 'REFLECTED_IN_INSIGHT').length;

  const completedAt = new Date();
  const durationSeconds = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

  const summary =
    `Reviewed ${candidates.length} proposals: ` +
    `${accepted} accepted, ${rejected} rejected, ${deferred} deferred, ${reflected} reflected. ` +
    `Signal state: ${signalState.state} (${signalState.confidenceLabel} confidence)`;

  // 8. Persist CtoReviewRun
  const run = await prisma.ctoReviewRun.create({
    data: {
      runId,
      frequencyMode:  input.isManual ? 'manual' : 'scheduled',
      startedAt,
      completedAt,
      durationSeconds,
      candidateCount: candidates.length,
      acceptedCount:  accepted,
      rejectedCount:  rejected,
      deferredCount:  deferred,
      reflectedCount: reflected,
      summary,
      reportJson:     JSON.stringify({ signalState, candidates }),
      isManual:       input.isManual,
      runIntent:      input.runIntent ?? null,
      parentRunId:    input.parentRunId ?? null,
    },
  });

  // 9. Record intent signals
  await recordIntentSignals(runId, candidates);

  // 10. Create backlog items for rejected/deferred
  const backlogInputs = candidates
    .map((c) => candidateToBacklogInput(c, runId))
    .filter((b): b is BacklogItemInput => b !== null);
  const backlogItemsCreated = await batchInsertBacklogItems(backlogInputs);

  return {
    runId,
    candidateCount: candidates.length,
    acceptedCount:  accepted,
    rejectedCount:  rejected,
    deferredCount:  deferred,
    reflectedCount: reflected,
    summary,
    candidates,
    backlogItemsCreated,
  };
}

// ─── Latest Run Query ─────────────────────────────────────────────────────────

export async function getLatestCtoRun() {
  return prisma.ctoReviewRun.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { intentSignals: true },
  });
}

export async function getCtoRunById(runId: string) {
  return prisma.ctoReviewRun.findUnique({
    where: { runId },
    include: { intentSignals: true },
  });
}

export async function listCtoRuns(limit = 20) {
  return prisma.ctoReviewRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    include: { intentSignals: { take: 4 } },
  });
}
