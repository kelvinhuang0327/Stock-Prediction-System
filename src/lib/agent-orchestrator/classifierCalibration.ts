// Classifier Calibration Service
// Adapted from LotteryNew classifier_calibration_tick.py
// Self-optimizing accuracy tracking for the signal state classifier.
// Compares ClassifierCalibrationLog predictions against actual outcomes
// (measured as overallWinRate change in the next classification window).

import { prisma } from '@/lib/prisma';
import type { ClassifierAccuracyReport, ClassifierThresholdsConfig } from './ctoTypes';

// ─── Outcome Matching ─────────────────────────────────────────────────────────

// A classification is "correct" if:
//   NORMAL / SIGNAL_SATURATED → next overallWinRate >= coldWinRateMin (signal was actually healthy)
//   COLD_REGIME               → next overallWinRate <  coldWinRateMin (regime was actually cold)
//   TRUE_EXHAUSTED            → trade count stayed below coldMinTrades (was indeed exhausted)

type ClassificationRow = {
  id:             number;
  state:          string;
  confidenceScore: number;
  featuresJson:   string | null;
  thresholdsJson: string | null;
  classifiedAt:   Date;
};

function evaluateOutcome(
  row:      ClassificationRow,
  nextRow:  ClassificationRow | null,
): 'correct' | 'incorrect' | 'unknown' {
  if (!nextRow) return 'unknown';
  if (!nextRow.featuresJson || !row.thresholdsJson) return 'unknown';

  const nextFeatures = JSON.parse(nextRow.featuresJson) as { overallWinRate: number | null; fullTradeCount: number };
  const thresholds   = JSON.parse(row.thresholdsJson) as ClassifierThresholdsConfig;

  const nextWinRate    = nextFeatures.overallWinRate ?? 0;
  const nextTradeCount = nextFeatures.fullTradeCount ?? 0;

  switch (row.state) {
    case 'NORMAL':
    case 'SIGNAL_SATURATED':
      return nextWinRate >= thresholds.coldWinRateMin ? 'correct' : 'incorrect';
    case 'COLD_REGIME':
      return nextWinRate < thresholds.coldWinRateMin ? 'correct' : 'incorrect';
    case 'TRUE_EXHAUSTED':
      return nextTradeCount < thresholds.coldMinTrades ? 'correct' : 'incorrect';
    default:
      return 'unknown';
  }
}

// ─── Threshold Auto-Tune ──────────────────────────────────────────────────────

// Nudge coldWinRateMin when we have sufficient data showing systematic error:
//   If false positives (flagged COLD but wasn't) dominate → lower threshold by 0.02
//   If false negatives (missed COLD, called NORMAL) dominate → raise threshold by 0.02
// Bounds: [0.20, 0.65]

function proposedThresholdAdjustment(
  falsePositiveCount: number,
  falseNegativeCount: number,
  currentMin: number,
): number | null {
  const total = falsePositiveCount + falseNegativeCount;
  if (total < 5) return null; // not enough signal

  const fpRatio = falsePositiveCount / total;
  const fnRatio = falseNegativeCount / total;

  if (fpRatio > 0.70) {
    return Math.max(0.20, currentMin - 0.02);
  }
  if (fnRatio > 0.70) {
    return Math.min(0.65, currentMin + 0.02);
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function computeClassifierAccuracy(): Promise<ClassifierAccuracyReport> {
  const logs = await prisma.classifierCalibrationLog.findMany({
    orderBy: { classifiedAt: 'asc' },
    select: {
      id:              true,
      state:           true,
      confidenceScore: true,
      featuresJson:    true,
      thresholdsJson:  true,
      classifiedAt:    true,
    },
  });

  let correct     = 0;
  let incorrect   = 0;
  let falsePos    = 0;
  let falseNeg    = 0;
  const recentN   = 20;

  for (let i = 0; i < logs.length; i++) {
    const row     = logs[i];
    const nextRow = logs[i + 1] ?? null;
    const outcome = evaluateOutcome(row, nextRow);

    if (outcome === 'correct')   correct++;
    if (outcome === 'incorrect') {
      incorrect++;
      // COLD_REGIME called but next window was healthy → false positive
      if (row.state === 'COLD_REGIME')  falsePos++;
      // NORMAL called but next window was cold → false negative
      if (row.state === 'NORMAL')       falseNeg++;
    }
  }

  const totalClassifications = logs.length;
  const evaluated = correct + incorrect;
  const accuracyPct = evaluated > 0 ? Math.round((correct / evaluated) * 1000) / 10 : 0;

  // Recent accuracy (last recentN evaluated)
  let recentCorrect   = 0;
  let recentEvaluated = 0;
  for (let i = Math.max(0, logs.length - recentN - 1); i < logs.length - 1; i++) {
    const row     = logs[i];
    const nextRow = logs[i + 1];
    const outcome = evaluateOutcome(row, nextRow);
    if (outcome !== 'unknown') {
      recentEvaluated++;
      if (outcome === 'correct') recentCorrect++;
    }
  }
  const recentAccuracyPct = recentEvaluated > 0
    ? Math.round((recentCorrect / recentEvaluated) * 1000) / 10
    : 0;

  const lastCalibratedAt = logs.length > 0
    ? logs[logs.length - 1].classifiedAt
    : new Date();

  // Attempt threshold auto-tune
  const thresholdRow = await prisma.classifierThresholds.findFirst({ orderBy: { id: 'desc' } });
  if (thresholdRow) {
    const newMin = proposedThresholdAdjustment(falsePos, falseNeg, thresholdRow.coldWinRateMin);
    if (newMin !== null && newMin !== thresholdRow.coldWinRateMin) {
      await prisma.classifierThresholds.update({
        where: { id: thresholdRow.id },
        data: {
          coldWinRateMin:      newMin,
          lastCalibratedAt:    new Date(),
        },
      });
    }

    // Persist accuracy summary
    await prisma.classifierThresholds.update({
      where: { id: thresholdRow.id },
      data: {
        correctClassifications: correct,
      },
    });
  }

  return {
    totalClassifications,
    correctClassifications: correct,
    accuracyPct,
    recentAccuracyPct,
    falsePositiveCount: falsePos,
    falseNegativeCount: falseNeg,
    lastCalibratedAt,
  };
}

export async function getClassifierThresholds(): Promise<ClassifierThresholdsConfig> {
  const row = await prisma.classifierThresholds.findFirst({ orderBy: { id: 'desc' } });
  if (!row) {
    return {
      coldWinRateMin:     0.4,
      saturationDeltaMax: 0.03,
      coldMinTrades:      5,
      weightWinRate:      1.0,
      weightTrendDelta:   1.5,
      weightDataCoverage: 0.5,
    };
  }
  return {
    coldWinRateMin:     row.coldWinRateMin,
    saturationDeltaMax: row.saturationDeltaMax,
    coldMinTrades:      row.coldMinTrades,
    weightWinRate:      row.weightWinRate,
    weightTrendDelta:   row.weightTrendDelta,
    weightDataCoverage: row.weightDataCoverage,
  };
}

export async function updateClassifierThresholds(
  patch: Partial<ClassifierThresholdsConfig>,
): Promise<void> {
  const row = await prisma.classifierThresholds.findFirst({ orderBy: { id: 'desc' } });
  if (!row) {
    await prisma.classifierThresholds.create({ data: { ...patch } as never });
    return;
  }
  await prisma.classifierThresholds.update({
    where: { id: row.id },
    data:  { ...patch, lastCalibratedAt: new Date() },
  });
}
