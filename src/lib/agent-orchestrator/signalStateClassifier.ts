// Signal State Classifier
// Adapted from LotteryNew planner_tick._classify_signal_state()
// Reads stock trading signal health instead of lottery strategy states

import { prisma } from '@/lib/prisma';
import type {
  ClassifierThresholdsConfig,
  SignalState,
  SignalStateFeatures,
  SignalStateResult,
} from './ctoTypes';

const DEFAULT_THRESHOLDS: ClassifierThresholdsConfig = {
  coldWinRateMin: 0.4,
  saturationDeltaMax: 0.03,
  coldMinTrades: 5,
  weightWinRate: 1.0,
  weightTrendDelta: 1.5,
  weightDataCoverage: 0.5,
};

async function loadThresholds(): Promise<ClassifierThresholdsConfig> {
  const row = await prisma.classifierThresholds.findFirst({
    orderBy: { id: 'desc' },
  });
  if (!row) return DEFAULT_THRESHOLDS;
  return {
    coldWinRateMin:     row.coldWinRateMin,
    saturationDeltaMax: row.saturationDeltaMax,
    coldMinTrades:      row.coldMinTrades,
    weightWinRate:      row.weightWinRate,
    weightTrendDelta:   row.weightTrendDelta,
    weightDataCoverage: row.weightDataCoverage,
  };
}

async function gatherFeatures(): Promise<SignalStateFeatures> {
  const isClean = { NOT: { marketContext: { contains: '"dataQuality":"contaminated"' } } };

  const [allTrades, latestInsight, latestSnapshot] = await Promise.all([
    prisma.simulatedTrade.findMany({
      where: { status: 'closed', ...isClean },
      select: { setupType: true, pnlPct: true, tradeMode: true },
    }),
    prisma.strategyLearningInsight.findFirst({
      orderBy: { id: 'desc' },
      select: { adjustmentSuggestions: true, limitations: true },
    }),
    prisma.autonomousResearchSnapshot.findFirst({
      orderBy: { id: 'desc' },
      select: { dataCoverage: true },
    }),
  ]);

  const organic = allTrades.filter((t) => t.tradeMode !== 'shadow' || t.pnlPct !== null);
  const fullTrades = allTrades.filter((t) => t.tradeMode === 'full');
  const organicTradeCount = organic.length;
  const fullTradeCount = fullTrades.length;

  const trendTrades = organic.filter((t) => t.setupType === 'trend');
  const reboundTrades = organic.filter((t) => t.setupType === 'rebound');

  const winRate = (trades: typeof organic) =>
    trades.length === 0 ? null : trades.filter((t) => (t.pnlPct ?? 0) > 0).length / trades.length;

  const trendWinRate = winRate(trendTrades);
  const reboundWinRate = winRate(reboundTrades);

  const allWinnable = organic.filter((t) => t.pnlPct !== null);
  const overallWinRate = allWinnable.length === 0
    ? null
    : allWinnable.filter((t) => (t.pnlPct ?? 0) > 0).length / allWinnable.length;

  // Win rate delta: compare most recent 10 vs. prior 10
  const sorted = [...allWinnable].sort((a, b) => a.pnlPct! - b.pnlPct!); // rough proxy
  const recent10 = sorted.slice(-10);
  const prior10  = sorted.slice(-20, -10);
  const winRateDelta =
    recent10.length >= 5 && prior10.length >= 5
      ? winRate(recent10)! - winRate(prior10)!
      : null;

  const penalizedSetupCount = latestInsight?.adjustmentSuggestions
    ? (JSON.parse(latestInsight.adjustmentSuggestions) as string[]).filter((s) =>
        s.toLowerCase().includes('penali')
      ).length
    : 0;

  const insightCount = await prisma.strategyLearningInsight.count();

  return {
    organicTradeCount,
    fullTradeCount,
    trendWinRate,
    reboundWinRate,
    overallWinRate,
    winRateDelta,
    dataCoverage: latestSnapshot?.dataCoverage ?? 'insufficient',
    penalizedSetupCount,
    insightCount,
  };
}

function computeConfidence(
  features: SignalStateFeatures,
  thresholds: ClassifierThresholdsConfig,
): number {
  let score = 0;
  let maxScore = 0;

  // Win rate component
  if (features.overallWinRate !== null) {
    const gap = Math.abs(features.overallWinRate - thresholds.coldWinRateMin);
    score += thresholds.weightWinRate * Math.min(gap / 0.2, 1);
  }
  maxScore += thresholds.weightWinRate;

  // Trend delta component
  if (features.winRateDelta !== null) {
    const clarity = Math.abs(features.winRateDelta) / 0.1;
    score += thresholds.weightTrendDelta * Math.min(clarity, 1);
  }
  maxScore += thresholds.weightTrendDelta;

  // Data coverage component
  const coverageScore =
    features.dataCoverage === 'full' ? 1 :
    features.dataCoverage === 'limited' ? 0.6 : 0.1;
  score += thresholds.weightDataCoverage * coverageScore;
  maxScore += thresholds.weightDataCoverage;

  return maxScore === 0 ? 0 : Math.min(score / maxScore, 1);
}

export async function classifySignalState(): Promise<SignalStateResult> {
  const thresholds = await loadThresholds();
  const features = await gatherFeatures();

  let state: SignalState;
  let reason: string;

  // Rule 1: TRUE_EXHAUSTED — not enough data to learn anything
  if (
    features.fullTradeCount < thresholds.coldMinTrades ||
    features.dataCoverage === 'insufficient'
  ) {
    state = 'TRUE_EXHAUSTED';
    reason =
      features.fullTradeCount < thresholds.coldMinTrades
        ? `fullTradeCount=${features.fullTradeCount} < min=${thresholds.coldMinTrades}`
        : `dataCoverage=insufficient — cannot evaluate signals`;
  }
  // Rule 2: COLD_REGIME — win rate below threshold or all setups penalized
  else if (
    (features.overallWinRate !== null && features.overallWinRate < thresholds.coldWinRateMin) ||
    features.penalizedSetupCount >= 2
  ) {
    state = 'COLD_REGIME';
    reason =
      features.penalizedSetupCount >= 2
        ? `${features.penalizedSetupCount} setup types penalized — signal quality poor`
        : `overallWinRate=${(features.overallWinRate! * 100).toFixed(1)}% < min=${(thresholds.coldWinRateMin * 100).toFixed(1)}%`;
  }
  // Rule 3: SIGNAL_SATURATED — win rate exists but not improving
  else if (
    features.winRateDelta !== null &&
    Math.abs(features.winRateDelta) < thresholds.saturationDeltaMax &&
    features.overallWinRate !== null &&
    features.overallWinRate >= thresholds.coldWinRateMin
  ) {
    state = 'SIGNAL_SATURATED';
    reason = `winRateDelta=${(features.winRateDelta * 100).toFixed(2)}% — plateau detected (threshold ${(thresholds.saturationDeltaMax * 100).toFixed(1)}%)`;
  }
  // Default: NORMAL
  else {
    state = 'NORMAL';
    reason =
      features.overallWinRate !== null
        ? `overallWinRate=${(features.overallWinRate * 100).toFixed(1)}% — healthy signal`
        : `insufficient win rate data but meets minimum trade count`;
  }

  const confidenceScore = computeConfidence(features, thresholds);
  const confidenceLabel: 'low' | 'medium' | 'high' =
    confidenceScore >= 0.7 ? 'high' : confidenceScore >= 0.4 ? 'medium' : 'low';

  // Persist calibration log
  await prisma.classifierCalibrationLog.create({
    data: {
      classifiedAt:   new Date(),
      state,
      confidenceScore,
      confidenceLabel,
      reason,
      featuresJson:   JSON.stringify(features),
      thresholdsJson: JSON.stringify(thresholds),
    },
  });

  // Increment total classification counter
  await prisma.classifierThresholds.updateMany({
    data: { totalClassifications: { increment: 1 } },
  });

  return { state, confidenceScore, confidenceLabel, reason, features };
}
