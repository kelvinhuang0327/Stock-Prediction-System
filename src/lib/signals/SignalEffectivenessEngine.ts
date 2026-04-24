/**
 * Signal Effectiveness Engine
 *
 * Computes retrospective signal effectiveness metrics against historical
 * price outcomes. This is a research-only layer and must not affect
 * alphaScore, screen results, or backtest logic.
 */

import { prisma } from '@/lib/prisma';
import type {
  Metric,
  SignalType,
  SignalHistory,
  SignalObservation,
  SignalEffectiveness,
  SignalClassification,
  SignalRegime,
  SignalWindow,
  SignalEffectivenessSummary,
} from './types';
import { SIGNAL_LABELS } from './types';

const WINDOWS: SignalWindow[] = [3, 5, 10];
const MIN_SAMPLE_STRONG = 30;
const MIN_SAMPLE_DEGRADED = 10;
const MIN_REGIME_SAMPLE = 5;
const MIN_STABILITY_WINDOWS = 2;
const MAX_FORWARD_GAP_MS = 5 * 24 * 60 * 60 * 1000;

interface PriceSeries {
  dates: string[];
  closes: number[];
}

interface ReturnPair {
  signalReturn: number;
  marketReturn: number;
  excessReturn: number;
  regime: SignalRegime;
}

interface ObservationReturnSet {
  pairs: Partial<Record<SignalWindow, ReturnPair>>;
  missingWindows: SignalWindow[];
  missingRegime: boolean;
}

interface WindowAggregate {
  window: SignalWindow;
  sampleSize: number;
  avgReturn: number;
  excessReturn: number;
  hitRate: number;
  excessHitRate: number;
}

const priceCache = new Map<string, PriceSeries>();
let taiexCache: PriceSeries | null = null;

function normalizeDate(d: string): string {
  if (!d) return '';
  if (d.includes('T')) return d.slice(0, 10);
  if (d.includes('-') && d.length >= 10) return d.slice(0, 10);
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d.slice(0, 10);
}

function dateToMs(d: string): number {
  return new Date(`${normalizeDate(d)}T00:00:00.000Z`).getTime();
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function normalizeRegime(value: string | null | undefined): SignalRegime {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'bull') return 'Bull';
  if (normalized === 'bear') return 'Bear';
  if (normalized === 'sideways' || normalized === 'neutral') return 'Neutral';
  return 'Unknown';
}

function findPriceOnOrAfter(series: PriceSeries, targetDate: string): { idx: number; price: number } | null {
  const targetMs = dateToMs(targetDate);

  for (let i = 0; i < series.dates.length; i++) {
    const currentMs = dateToMs(series.dates[i]);
    if (currentMs < targetMs) continue;
    if (currentMs - targetMs > MAX_FORWARD_GAP_MS) return null;
    return { idx: i, price: series.closes[i] };
  }

  return null;
}

async function loadPriceSeries(symbol: string): Promise<PriceSeries | null> {
  if (priceCache.has(symbol)) return priceCache.get(symbol)!;

  const rows = await prisma.stockQuote.findMany({
    where: { stockId: symbol },
    select: { date: true, close: true },
    orderBy: { date: 'asc' },
  });

  if (rows.length < 10) return null;

  const series: PriceSeries = {
    dates: rows.map((row) => normalizeDate(row.date)),
    closes: rows.map((row) => row.close),
  };
  priceCache.set(symbol, series);
  return series;
}

async function loadTaiexSeries(): Promise<PriceSeries | null> {
  if (taiexCache) return taiexCache;

  const rows = await prisma.marketIndex.findMany({
    where: { name: 'TAIEX' },
    select: { date: true, value: true },
    orderBy: { date: 'asc' },
  });

  if (rows.length < 10) return null;

  taiexCache = {
    dates: rows.map((row) => normalizeDate(row.date)),
    closes: rows.map((row) => row.value),
  };
  return taiexCache;
}

async function computeObservationReturns(
  observation: SignalObservation,
  taiexSeries: PriceSeries,
): Promise<ObservationReturnSet> {
  const regime = normalizeRegime(observation.context.regime);
  const missingRegime = regime === 'Unknown';
  const missingWindows: SignalWindow[] = [];
  const pairs: Partial<Record<SignalWindow, ReturnPair>> = {};

  const marketEntry = findPriceOnOrAfter(taiexSeries, observation.date);
  if (!marketEntry) {
    return { pairs, missingWindows: [...WINDOWS], missingRegime };
  }

  let signalSeries = taiexSeries;
  let signalEntry = marketEntry;

  if (observation.symbol) {
    const series = await loadPriceSeries(observation.symbol);
    if (!series) {
      return { pairs, missingWindows: [...WINDOWS], missingRegime };
    }
    const entry = findPriceOnOrAfter(series, observation.date);
    if (!entry) {
      return { pairs, missingWindows: [...WINDOWS], missingRegime };
    }
    signalSeries = series;
    signalEntry = entry;
  }

  for (const window of WINDOWS) {
    if (
      marketEntry.idx + window >= taiexSeries.closes.length ||
      signalEntry.idx + window >= signalSeries.closes.length
    ) {
      missingWindows.push(window);
      continue;
    }

    const marketReturn =
      (taiexSeries.closes[marketEntry.idx + window] - marketEntry.price) / marketEntry.price;
    const signalReturn =
      (signalSeries.closes[signalEntry.idx + window] - signalEntry.price) / signalEntry.price;

    pairs[window] = {
      signalReturn,
      marketReturn,
      excessReturn: signalReturn - marketReturn,
      regime,
    };
  }

  return { pairs, missingWindows, missingRegime };
}

function computePersistence(observations: SignalObservation[]): SignalEffectiveness['persistence'] {
  if (observations.length < 2) {
    return { avgDuration: observations.length === 0 ? 0 : 1, continuationRate: 0 };
  }

  const groups = new Map<string, string[]>();
  for (const observation of observations) {
    const key = observation.symbol ?? observation.context.topic ?? 'market';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(observation.date);
  }

  const streaks: number[] = [];
  let continuationCount = 0;
  let totalPairs = 0;

  for (const dates of groups.values()) {
    const sorted = [...new Set(dates)].sort();
    let streak = 1;

    for (let i = 1; i < sorted.length; i++) {
      const diffDays = (dateToMs(sorted[i]) - dateToMs(sorted[i - 1])) / (24 * 60 * 60 * 1000);
      totalPairs += 1;
      if (diffDays <= 3) {
        streak += 1;
        continuationCount += 1;
      } else {
        streaks.push(streak);
        streak = 1;
      }
    }

    streaks.push(streak);
  }

  return {
    avgDuration: round4(streaks.length > 0 ? mean(streaks) : 0),
    continuationRate: round4(totalPairs > 0 ? continuationCount / totalPairs : 0),
  };
}

function computeRegimeBreakdown(pairs: ReturnPair[]): SignalEffectiveness['regimeBreakdown'] {
  const buckets: Record<'Bull' | 'Bear' | 'Neutral', ReturnPair[]> = {
    Bull: [],
    Bear: [],
    Neutral: [],
  };

  for (const pair of pairs) {
    if (pair.regime === 'Bull' || pair.regime === 'Bear' || pair.regime === 'Neutral') {
      buckets[pair.regime].push(pair);
    }
  }

  const toMetric = (regimePairs: ReturnPair[]): Metric | undefined => {
    if (regimePairs.length < MIN_REGIME_SAMPLE) return undefined;
    const signalReturns = regimePairs.map((p) => p.signalReturn);
    return {
      sampleSize: regimePairs.length,
      avgReturn: round4(mean(signalReturns)),
      hitRate: round4(regimePairs.filter((p) => p.signalReturn > 0).length / regimePairs.length),
      excessReturn: round4(mean(regimePairs.map((p) => p.excessReturn))),
      excessHitRate: round4(regimePairs.filter((p) => p.excessReturn > 0).length / regimePairs.length),
    };
  };

  return {
    bull: toMetric(buckets.Bull),
    bear: toMetric(buckets.Bear),
    neutral: toMetric(buckets.Neutral),
  };
}

function computeBrierLikeScore(returns: number[], hitRate: number): number {
  const mse = returns.reduce((sum, value) => {
    const actual = value > 0 ? 1 : 0;
    return sum + (hitRate - actual) ** 2;
  }, 0) / returns.length;
  return round4(mse);
}

function aggregateWindow(window: SignalWindow, pairs: ReturnPair[]): WindowAggregate {
  return {
    window,
    sampleSize: pairs.length,
    avgReturn: round4(mean(pairs.map((pair) => pair.signalReturn))),
    excessReturn: round4(mean(pairs.map((pair) => pair.excessReturn))),
    hitRate: round4(pairs.length > 0 ? pairs.filter((pair) => pair.signalReturn > 0).length / pairs.length : 0),
    excessHitRate: round4(pairs.length > 0 ? pairs.filter((pair) => pair.excessReturn > 0).length / pairs.length : 0),
  };
}

function computeStabilityScore(windowStats: WindowAggregate[]): {
  score: number;
  stableAcrossWindows: boolean;
  windowsUsed: number;
} {
  const eligible = windowStats.filter((stat) => stat.sampleSize >= MIN_SAMPLE_DEGRADED);
  if (eligible.length < MIN_STABILITY_WINDOWS) {
    return { score: 0, stableAcrossWindows: false, windowsUsed: eligible.length };
  }

  const positiveWindows = eligible.filter((stat) => stat.excessReturn > 0).length;
  const signConsistency = Math.max(positiveWindows, eligible.length - positiveWindows) / eligible.length;
  const hitRates = eligible.map((stat) => stat.hitRate);
  const hitRateSpread = Math.max(...hitRates) - Math.min(...hitRates);
  const hitConsistency = Math.max(0, 1 - hitRateSpread / 0.25);
  const score = round4(Math.min(1, signConsistency * 0.6 + hitConsistency * 0.4));

  return {
    score,
    stableAcrossWindows:
      eligible.length === WINDOWS.length &&
      positiveWindows === eligible.length &&
      hitRateSpread <= 0.15,
    windowsUsed: eligible.length,
  };
}

function assessRegimeFragility(regimeBreakdown: SignalEffectiveness['regimeBreakdown']): {
  fragile: boolean;
  positiveRegimes: Array<'Bull' | 'Bear' | 'Neutral'>;
  availableRegimes: number;
} {
  const regimes: Array<{ name: 'Bull' | 'Bear' | 'Neutral'; metric?: Metric }> = [
    { name: 'Bull', metric: regimeBreakdown.bull },
    { name: 'Bear', metric: regimeBreakdown.bear },
    { name: 'Neutral', metric: regimeBreakdown.neutral },
  ];

  const available = regimes.filter((item) => item.metric && item.metric.sampleSize >= MIN_REGIME_SAMPLE);
  const positiveRegimes = available
    .filter((item) => (item.metric?.avgReturn ?? 0) > 0)
    .map((item) => item.name);
  const nonPositiveCount = available.length - positiveRegimes.length;

  return {
    fragile: positiveRegimes.length > 0 && (available.length <= 1 || nonPositiveCount > 0),
    positiveRegimes,
    availableRegimes: available.length,
  };
}

function classifySignal(params: {
  sampleSize: number;
  excessReturn: number;
  hitRate: number;
  avgReturn: number;
  stableAcrossWindows: boolean;
  regimeFragile: boolean;
  positiveRegimeCount: number;
  degraded: boolean;
}): SignalClassification {
  if (params.sampleSize < MIN_SAMPLE_DEGRADED || params.degraded) return 'NOISE';

  if (
    params.sampleSize >= MIN_SAMPLE_STRONG &&
    params.excessReturn > 0 &&
    params.stableAcrossWindows &&
    !params.regimeFragile
  ) {
    return 'STRONG_SIGNAL';
  }

  if (params.positiveRegimeCount >= 1 && params.regimeFragile) {
    return 'CONDITIONAL_SIGNAL';
  }

  if (params.excessReturn > 0 || params.avgReturn > 0 || params.hitRate >= 0.5) {
    return 'WEAK_SIGNAL';
  }

  return 'NOISE';
}

function createResult(
  signalType: SignalType,
  window: SignalWindow,
  persistence: SignalEffectiveness['persistence'],
  limitations: string[],
  overrides?: Partial<SignalEffectiveness>,
): SignalEffectiveness {
  return {
    signalType,
    window,
    sampleSize: 0,
    hitRate: 0,
    avgReturn: 0,
    excessReturn: 0,
    volatility: 0,
    regimeBreakdown: {},
    persistence,
    stabilityScore: 0,
    classification: 'NOISE',
    limitations,
    ...overrides,
  };
}

export function describeRegimeDependency(effectiveness: SignalEffectiveness): string {
  const positiveRegimes: string[] = [];

  if ((effectiveness.regimeBreakdown.bull?.avgReturn ?? 0) > 0) positiveRegimes.push('Bull');
  if ((effectiveness.regimeBreakdown.bear?.avgReturn ?? 0) > 0) positiveRegimes.push('Bear');
  if ((effectiveness.regimeBreakdown.neutral?.avgReturn ?? 0) > 0) positiveRegimes.push('Neutral');

  if (positiveRegimes.length === 0) {
    return effectiveness.limitations.some((item) => item.includes('regime'))
      ? 'regime 資料不足'
      : '無明顯 regime edge';
  }

  if (positiveRegimes.length === 1) {
    return `${positiveRegimes[0]} only`;
  }

  return '跨 regime 相對穩定';
}

export function describeSignalSummary(effectiveness: SignalEffectiveness): string {
  if (effectiveness.classification === 'STRONG_SIGNAL') return '跨窗口相對穩定';
  if (effectiveness.classification === 'CONDITIONAL_SIGNAL') return describeRegimeDependency(effectiveness);
  if (effectiveness.classification === 'WEAK_SIGNAL') {
    return effectiveness.stabilityScore < 0.6 ? '不穩定' : '幅度偏弱';
  }
  if (effectiveness.sampleSize < MIN_SAMPLE_DEGRADED) return '資料不足';
  return '無明顯 edge';
}

export function buildSignalEffectivenessSummary(
  effectivenessList: SignalEffectiveness[],
  window: SignalWindow,
): SignalEffectivenessSummary {
  const classificationRank: Record<SignalClassification, number> = {
    STRONG_SIGNAL: 0,
    CONDITIONAL_SIGNAL: 1,
    WEAK_SIGNAL: 2,
    NOISE: 3,
  };

  const signals = [...effectivenessList]
    .sort((left, right) => {
      const rankDiff = classificationRank[left.classification] - classificationRank[right.classification];
      if (rankDiff !== 0) return rankDiff;
      return right.excessReturn - left.excessReturn;
    })
    .map((effectiveness) => ({
      signalType: effectiveness.signalType,
      label: SIGNAL_LABELS[effectiveness.signalType],
      classification: effectiveness.classification,
      hitRate: effectiveness.hitRate,
      avgReturn: effectiveness.avgReturn,
      excessReturn: effectiveness.excessReturn,
      sampleSize: effectiveness.sampleSize,
      regimeDependency: describeRegimeDependency(effectiveness),
      summary: describeSignalSummary(effectiveness),
      limitations: effectiveness.limitations,
    }));

  return {
    window,
    signals,
    generatedAt: new Date().toISOString(),
    dataNote: '訊號有效性為 L3+ 研究層歷史觀察，不影響 alphaScore、screen 或 backtest。',
    limitations: [...new Set(effectivenessList.flatMap((effectiveness) => effectiveness.limitations))],
  };
}

export async function evaluateSignalEffectiveness(
  history: SignalHistory,
  window: SignalWindow,
): Promise<SignalEffectiveness> {
  const { signalType, observations, limitations: historyLimitations } = history;
  const limitations = [...historyLimitations];
  const persistence = computePersistence(observations);

  if (observations.length === 0) {
    limitations.push('觀察記錄為空，無法計算歷史效果');
    return createResult(signalType, window, persistence, limitations);
  }

  const taiexSeries = await loadTaiexSeries();
  if (!taiexSeries) {
    limitations.push('TAIEX 基準資料不可用，無法計算 forward return 與超額報酬');
    return createResult(signalType, window, persistence, limitations);
  }

  const uniqueSymbols = [...new Set(observations.map((observation) => observation.symbol).filter(Boolean) as string[])];
  await Promise.all(uniqueSymbols.map((symbol) => loadPriceSeries(symbol)));

  const observationSets = await Promise.all(
    observations.map((observation) => computeObservationReturns(observation, taiexSeries)),
  );

  const pairsByWindow: Record<SignalWindow, ReturnPair[]> = {
    3: [],
    5: [],
    10: [],
  };
  const missingPriceCounts: Record<SignalWindow, number> = { 3: 0, 5: 0, 10: 0 };
  let missingRegimeCount = 0;

  for (const set of observationSets) {
    if (set.missingRegime) missingRegimeCount += 1;

    for (const currentWindow of WINDOWS) {
      const pair = set.pairs[currentWindow];
      if (pair) {
        pairsByWindow[currentWindow].push(pair);
      } else {
        missingPriceCounts[currentWindow] += 1;
      }
    }
  }

  const selectedPairs = pairsByWindow[window];
  const windowStats = WINDOWS.map((currentWindow) => aggregateWindow(currentWindow, pairsByWindow[currentWindow]));
  const selectedStats = windowStats.find((stat) => stat.window === window)!;

  if (selectedPairs.length === 0) {
    limitations.push('無可計算的前向報酬資料，可能因訊號日期超出行情覆蓋範圍');
    return createResult(signalType, window, persistence, limitations);
  }

  if (selectedPairs.length < MIN_SAMPLE_DEGRADED) {
    limitations.push(`有效樣本僅 ${selectedPairs.length} 筆，低於最低研究門檻 ${MIN_SAMPLE_DEGRADED}`);
  }

  if (missingPriceCounts[window] > 0) {
    limitations.push(
      `${missingPriceCounts[window]} 筆觀察缺少對應價格資料或 forward window 不完整；依 degraded mode 降級為 NOISE`,
    );
  }

  if (missingRegimeCount > 0) {
    limitations.push(
      `${missingRegimeCount} 筆觀察缺少已落地的市場 regime；依 degraded mode 降級為 NOISE`,
    );
  }

  const stability = computeStabilityScore(windowStats);
  if (stability.windowsUsed < WINDOWS.length) {
    limitations.push('跨窗口穩定度可用樣本不足，stabilityScore 僅基於部分窗口');
  }

  const signalReturns = selectedPairs.map((pair) => pair.signalReturn);
  const regimeBreakdown = computeRegimeBreakdown(selectedPairs);
  const regimeAssessment = assessRegimeFragility(regimeBreakdown);
  const degraded =
    selectedPairs.length < MIN_SAMPLE_DEGRADED ||
    missingPriceCounts[window] > 0 ||
    missingRegimeCount > 0;

  const result = createResult(signalType, window, persistence, [...new Set(limitations)], {
    sampleSize: selectedPairs.length,
    hitRate: selectedStats.hitRate,
    excessHitRate: selectedStats.excessHitRate,
    avgReturn: selectedStats.avgReturn,
    excessReturn: selectedStats.excessReturn,
    volatility: round4(stddev(signalReturns)),
    brierLikeScore:
      selectedPairs.length >= MIN_SAMPLE_DEGRADED
        ? computeBrierLikeScore(signalReturns, selectedStats.hitRate)
        : undefined,
    regimeBreakdown,
    stabilityScore: stability.score,
    classification: classifySignal({
      sampleSize: selectedPairs.length,
      excessReturn: selectedStats.excessReturn,
      hitRate: selectedStats.hitRate,
      avgReturn: selectedStats.avgReturn,
      stableAcrossWindows: stability.stableAcrossWindows,
      regimeFragile: regimeAssessment.fragile,
      positiveRegimeCount: regimeAssessment.positiveRegimes.length,
      degraded,
    }),
  });

  return result;
}

export async function evaluateAllSignals(
  histories: SignalHistory[],
  window: SignalWindow = 5,
): Promise<SignalEffectiveness[]> {
  return Promise.all(histories.map((history) => evaluateSignalEffectiveness(history, window)));
}
