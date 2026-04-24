// Adaptive Policy Service
// Adapted from LotteryNew adaptive_policy_tick.py
// Tracks success rates of run intents and generates suggestions

import { prisma } from '@/lib/prisma';
import type {
  AdaptivePolicyResult,
  AdaptivePolicySuggestion,
  BacklogCategory,
  CtoRunIntent,
} from './ctoTypes';

// ─── Intent Outcome Analysis ──────────────────────────────────────────────────

async function computeIntentRates(): Promise<{
  resubmitMergeRate: number;
  compareApproveRate: number;
  forceLearningRate: number;
  overallAcceptRate: number;
  runsAnalyzed: number;
}> {
  // Load runs from last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const runs = await prisma.ctoReviewRun.findMany({
    where: { createdAt: { gte: since } },
    select: {
      runIntent:     true,
      candidateCount: true,
      acceptedCount:  true,
      rejectedCount:  true,
      deferredCount:  true,
      reflectedCount: true,
    },
  });

  if (runs.length === 0) {
    return {
      resubmitMergeRate:   0,
      compareApproveRate:  0,
      forceLearningRate:   0,
      overallAcceptRate:   0,
      runsAnalyzed:        0,
    };
  }

  // Overall accept rate across all runs
  const totalCandidates = runs.reduce((s, r) => s + r.candidateCount, 0);
  const totalAccepted   = runs.reduce((s, r) => s + r.acceptedCount, 0);
  const overallAcceptRate = totalCandidates > 0 ? totalAccepted / totalCandidates : 0;

  // Intent-specific rates
  const intentRuns = (intent: CtoRunIntent) => runs.filter((r) => r.runIntent === intent);

  const resubmitRuns = intentRuns('resubmit_proposal');
  const compareRuns  = intentRuns('compare_regimes');
  const forceRuns    = intentRuns('force_learning');

  const acceptRate = (rs: typeof runs) => {
    const tot = rs.reduce((s, r) => s + r.candidateCount, 0);
    const acc = rs.reduce((s, r) => s + r.acceptedCount, 0);
    return tot > 0 ? acc / tot : 0;
  };

  return {
    resubmitMergeRate:  acceptRate(resubmitRuns),
    compareApproveRate: acceptRate(compareRuns),
    forceLearningRate:  acceptRate(forceRuns),
    overallAcceptRate,
    runsAnalyzed:       runs.length,
  };
}

// ─── Category Priority Boosts ─────────────────────────────────────────────────

async function computeCategoryBoosts(): Promise<Record<BacklogCategory, number>> {
  // Count open backlog items by category → high-count categories get priority boost
  const counts = await prisma.ctoBacklogItem.groupBy({
    by: ['category'],
    where: { status: 'open' },
    _count: { id: true },
  });

  const total = counts.reduce((s, c) => s + c._count.id, 0);
  const boosts: Record<BacklogCategory, number> = {
    signal:    0,
    regime:    0,
    data:      0,
    execution: 0,
  };

  for (const row of counts) {
    const cat = row.category as BacklogCategory;
    if (cat in boosts) {
      // Boost proportional to share of open items, max +5
      boosts[cat] = Math.round((row._count.id / Math.max(total, 1)) * 5 * 10) / 10;
    }
  }

  return boosts;
}

// ─── Suggestions Engine ───────────────────────────────────────────────────────

function generateSuggestions(
  resubmitMergeRate: number,
  compareApproveRate: number,
  forceLearningRate: number,
  overallAcceptRate: number,
  runsAnalyzed: number,
): AdaptivePolicySuggestion[] {
  const suggestions: AdaptivePolicySuggestion[] = [];

  if (runsAnalyzed < 3) {
    suggestions.push({
      level: 'info',
      text: `Only ${runsAnalyzed} run(s) analyzed — more data needed for reliable suggestions`,
    });
    return suggestions;
  }

  // Overall accept rate
  if (overallAcceptRate < 0.30) {
    suggestions.push({
      level: 'warn',
      text: `Overall accept rate is ${(overallAcceptRate * 100).toFixed(0)}% — signal quality may be degrading`,
    });
  } else if (overallAcceptRate > 0.80) {
    suggestions.push({
      level: 'recommend',
      text: `High accept rate ${(overallAcceptRate * 100).toFixed(0)}% — consider increasing review batch size`,
    });
  }

  // Resubmit intent
  if (resubmitMergeRate < 0.20) {
    suggestions.push({
      level: 'warn',
      text: `resubmit_proposal accept rate ${(resubmitMergeRate * 100).toFixed(0)}% — rejected proposals not recovering`,
    });
  } else if (resubmitMergeRate > 0.70) {
    suggestions.push({
      level: 'recommend',
      text: `resubmit_proposal accept rate ${(resubmitMergeRate * 100).toFixed(0)}% — run resubmit intent more frequently`,
    });
  }

  // Compare regimes intent
  if (compareApproveRate < 0.25) {
    suggestions.push({
      level: 'warn',
      text: `compare_regimes accept rate ${(compareApproveRate * 100).toFixed(0)}% — regime comparison not resolving deferrals`,
    });
  }

  // Force learning intent
  if (forceLearningRate > 0.60) {
    suggestions.push({
      level: 'recommend',
      text: `force_learning accept rate ${(forceLearningRate * 100).toFixed(0)}% — consider enabling auto force-learning`,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      level: 'info',
      text: `Policy metrics healthy — no adjustments recommended`,
    });
  }

  return suggestions;
}

// ─── Policy Confidence ────────────────────────────────────────────────────────

function computePolicyConfidence(
  runsAnalyzed: number,
): 'low' | 'medium' | 'high' {
  if (runsAnalyzed < 3)  return 'low';
  if (runsAnalyzed < 10) return 'medium';
  return 'high';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function computeAdaptivePolicy(): Promise<AdaptivePolicyResult> {
  const [rates, categoryPriorityBoosts] = await Promise.all([
    computeIntentRates(),
    computeCategoryBoosts(),
  ]);

  const {
    resubmitMergeRate,
    compareApproveRate,
    forceLearningRate,
    overallAcceptRate,
    runsAnalyzed,
  } = rates;

  const suggestions = generateSuggestions(
    resubmitMergeRate,
    compareApproveRate,
    forceLearningRate,
    overallAcceptRate,
    runsAnalyzed,
  );

  const policyConfidence = computePolicyConfidence(runsAnalyzed);
  const computedAt = new Date();

  // Persist to AdaptivePolicyState
  await prisma.adaptivePolicyState.create({
    data: {
      resubmitMergeRate,
      compareApproveRate,
      forceLearningRate,
      overallAcceptRate,
      categoryPriorityBoosts: JSON.stringify(categoryPriorityBoosts),
      suggestions:            JSON.stringify(suggestions),
      policyConfidence,
      runsAnalyzed,
      computedAt,
    },
  });

  return {
    resubmitMergeRate,
    compareApproveRate,
    forceLearningRate,
    overallAcceptRate,
    categoryPriorityBoosts,
    suggestions,
    policyConfidence,
    runsAnalyzed,
    computedAt,
  };
}

export async function getLatestAdaptivePolicy(): Promise<AdaptivePolicyResult | null> {
  const row = await prisma.adaptivePolicyState.findFirst({
    orderBy: { computedAt: 'desc' },
  });

  if (!row) return null;

  return {
    resubmitMergeRate:  row.resubmitMergeRate,
    compareApproveRate: row.compareApproveRate,
    forceLearningRate:  row.forceLearningRate,
    overallAcceptRate:  row.overallAcceptRate,
    categoryPriorityBoosts: JSON.parse(row.categoryPriorityBoosts) as Record<BacklogCategory, number>,
    suggestions:        JSON.parse(row.suggestions) as AdaptivePolicySuggestion[],
    policyConfidence:   row.policyConfidence as 'low' | 'medium' | 'high',
    runsAnalyzed:       row.runsAnalyzed,
    computedAt:         row.computedAt,
  };
}
