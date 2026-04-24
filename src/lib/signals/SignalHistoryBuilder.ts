/**
 * Signal History Builder
 *
 * Reconstructs historical signal occurrences from existing persisted data.
 * NO synthetic backfill. NO guessed missing values.
 * If source coverage is insufficient, observations are left empty and
 * limitations document the gap.
 */

import { prisma } from '@/lib/prisma';
import { extractAndNormalizeTopics } from '@/lib/events/TopicNormalizationService';
import type {
  SignalType,
  SignalObservation,
  SignalHistory,
} from './types';
import type { PortfolioRiskClusters } from '@/types/portfolio';

const TOPIC_SURGE_WINDOW_DAYS = 3;
const THEME_DIFFUSION_WINDOW_DAYS = 7;
const HIGH_ALPHA_THRESHOLD = 75;

type NormalizedNewsEvent = {
  date: string;
  topics: string[];
  symbols: string[];
  source: string;
};

function normalizeDate(d: string): string {
  if (!d) return '';
  if (d.includes('T')) return d.slice(0, 10);
  if (d.includes('-') && d.length >= 10) return d.slice(0, 10);
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d.slice(0, 10);
}

function daysAgoDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${normalizeDate(date)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function uniqueUpperSymbols(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))];
}

function normalizeTopics(title: string, summary: string, relatedThemes: string[]): string[] {
  return extractAndNormalizeTopics({
    title,
    summary,
    relatedThemes,
  }).topics;
}

function computeSurgeLevel(
  recent: number,
  previous: number,
  comparisonAvailable: boolean,
): 'none' | 'watch' | 'surging' {
  if (recent === 0) return 'none';
  if (!comparisonAvailable) return recent >= 3 ? 'watch' : 'none';
  if ((previous === 0 && recent >= 3) || (recent >= previous + 2 && recent >= Math.ceil(previous * 1.5))) {
    return 'surging';
  }
  if (recent > previous && recent >= 2) return 'watch';
  return 'none';
}

function isDiffusingTopic(breadth: number): boolean {
  return breadth >= 2;
}

function safeJsonParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function toObservations(
  base: Omit<SignalObservation, 'symbol'>,
  symbols: string[],
): SignalObservation[] {
  const cleanedSymbols = uniqueUpperSymbols(symbols);
  if (cleanedSymbols.length === 0) {
    return [{ ...base }];
  }
  return cleanedSymbols.map((symbol) => ({
    ...base,
    symbol,
  }));
}

async function loadNormalizedNewsEvents(days: number): Promise<{
  rows: NormalizedNewsEvent[];
  limitations: string[];
}> {
  const since = daysAgoDate(days);
  const limitations: string[] = [];

  const rows = await prisma.newsEvent.findMany({
    where: { publishedAt: { gte: since } },
    select: {
      title: true,
      summary: true,
      publishedAt: true,
      relatedThemes: true,
      relatedSymbols: true,
      source: true,
    },
    orderBy: { publishedAt: 'asc' },
  });

  if (rows.length < 5) {
    limitations.push(`NewsEvent 樣本偏少（${rows.length} 筆），topic 類訊號可信度有限`);
  }

  return {
    rows: rows.map((row) => ({
      date: normalizeDate(row.publishedAt.toISOString()),
      topics: normalizeTopics(row.title, row.summary ?? '', parseStringArray(row.relatedThemes)),
      symbols: uniqueUpperSymbols(parseStringArray(row.relatedSymbols)),
      source: row.source,
    })),
    limitations,
  };
}

function normalizeRegimeLabel(value: string | null | undefined): 'Bull' | 'Bear' | 'Neutral' | 'Unknown' {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'bull') return 'Bull';
  if (normalized === 'bear') return 'Bear';
  if (normalized === 'sideways' || normalized === 'neutral') return 'Neutral';
  return 'Unknown';
}

async function buildTopicSurgingHistory(days: number): Promise<SignalHistory> {
  const { rows, limitations: sourceLimitations } = await loadNormalizedNewsEvents(days);
  const limitations = [...sourceLimitations];

  if (rows.length === 0) {
    limitations.push('NewsEvent 無可用資料，無法重建 topic_surging 歷史');
    return { signalType: 'topic_surging', observations: [], limitations };
  }

  const anchorDates = [...new Set(rows.map((row) => row.date))].sort();
  const observations: SignalObservation[] = [];
  const seen = new Set<string>();

  for (const anchorDate of anchorDates) {
    const recentStart = shiftDate(anchorDate, -(TOPIC_SURGE_WINDOW_DAYS - 1));
    const previousEnd = shiftDate(recentStart, -1);
    const previousStart = shiftDate(previousEnd, -(TOPIC_SURGE_WINDOW_DAYS - 1));

    const recentRows = rows.filter((row) => row.date >= recentStart && row.date <= anchorDate);
    const previousRows = rows.filter((row) => row.date >= previousStart && row.date <= previousEnd);
    const comparisonAvailable = previousRows.length > 0;

    const recentTopicCounts = new Map<string, number>();
    const previousTopicCounts = new Map<string, number>();
    const recentTopicSymbols = new Map<string, Set<string>>();

    for (const row of recentRows) {
      for (const topic of row.topics) {
        recentTopicCounts.set(topic, (recentTopicCounts.get(topic) ?? 0) + 1);
        if (!recentTopicSymbols.has(topic)) recentTopicSymbols.set(topic, new Set<string>());
        row.symbols.forEach((symbol) => recentTopicSymbols.get(topic)?.add(symbol));
      }
    }

    for (const row of previousRows) {
      for (const topic of row.topics) {
        previousTopicCounts.set(topic, (previousTopicCounts.get(topic) ?? 0) + 1);
      }
    }

    for (const [topic, recentCount] of recentTopicCounts) {
      const previousCount = previousTopicCounts.get(topic) ?? 0;
      if (computeSurgeLevel(recentCount, previousCount, comparisonAvailable) !== 'surging') continue;

      const topicSymbols = [...(recentTopicSymbols.get(topic) ?? new Set<string>())];
      for (const observation of toObservations(
        {
          signalType: 'topic_surging',
          date: anchorDate,
          context: {
            topic,
            confidence: comparisonAvailable ? Math.min(1, recentCount / Math.max(1, previousCount + recentCount)) : undefined,
            metadata: {
              recentCount,
              previousCount,
              windowDays: TOPIC_SURGE_WINDOW_DAYS,
            },
          },
        },
        topicSymbols,
      )) {
        const key = `${observation.date}::${topic}::${observation.symbol ?? 'market'}`;
        if (seen.has(key)) continue;
        seen.add(key);
        observations.push(observation);
      }
    }
  }

  limitations.push('topic_surging 依據 NewsEvent 滾動 3 日視窗重建，未對缺漏日期做任何補值');
  if (observations.length < 10) {
    limitations.push(`topic_surging 樣本量偏低（${observations.length} 筆）`);
  }

  return { signalType: 'topic_surging', observations, limitations };
}

async function buildThemeDiffusingHistory(days: number): Promise<SignalHistory> {
  const { rows, limitations: sourceLimitations } = await loadNormalizedNewsEvents(days);
  const limitations = [...sourceLimitations];

  if (rows.length === 0) {
    limitations.push('NewsEvent 無可用資料，無法重建 theme_diffusing 歷史');
    return { signalType: 'theme_diffusing', observations: [], limitations };
  }

  const anchorDates = [...new Set(rows.map((row) => row.date))].sort();
  const observations: SignalObservation[] = [];
  const seen = new Set<string>();

  for (const anchorDate of anchorDates) {
    const recentStart = shiftDate(anchorDate, -(THEME_DIFFUSION_WINDOW_DAYS - 1));
    const recentRows = rows.filter((row) => row.date >= recentStart && row.date <= anchorDate);

    const topicSymbols = new Map<string, Set<string>>();
    const topicSources = new Map<string, Set<string>>();

    for (const row of recentRows) {
      for (const topic of row.topics) {
        if (!topicSymbols.has(topic)) topicSymbols.set(topic, new Set<string>());
        if (!topicSources.has(topic)) topicSources.set(topic, new Set<string>());
        row.symbols.forEach((symbol) => topicSymbols.get(topic)?.add(symbol));
        topicSources.get(topic)?.add(row.source);
      }
    }

    for (const [topic, symbols] of topicSymbols) {
      const breadth = symbols.size;
      if (!isDiffusingTopic(breadth)) continue;

      for (const observation of toObservations(
        {
          signalType: 'theme_diffusing',
          date: anchorDate,
          context: {
            topic,
            metadata: {
              breadth,
              sourceDiversity: topicSources.get(topic)?.size ?? 0,
              windowDays: THEME_DIFFUSION_WINDOW_DAYS,
            },
          },
        },
        [...symbols],
      )) {
        const key = `${observation.date}::${topic}::${observation.symbol ?? 'market'}`;
        if (seen.has(key)) continue;
        seen.add(key);
        observations.push(observation);
      }
    }
  }

  limitations.push('theme_diffusing 依據 NewsEvent 滾動 7 日視窗的 symbol breadth 重建，未補假資料');
  if (observations.length < 10) {
    limitations.push(`theme_diffusing 樣本量偏低（${observations.length} 筆）`);
  }

  return { signalType: 'theme_diffusing', observations, limitations };
}

async function buildStrongAlphaCandidateHistory(days: number): Promise<SignalHistory> {
  const limitations: string[] = [];
  const since = daysAgoDate(days).toISOString().slice(0, 10);

  const totalSnapshots = await prisma.dailyCandidateSnapshot.count();
  if (totalSnapshots === 0) {
    limitations.push('DailyCandidateSnapshot 尚無資料，無法重建 strong_alpha_candidate 歷史');
    return { signalType: 'strong_alpha_candidate', observations: [], limitations };
  }

  const rows = await prisma.dailyCandidateSnapshot.findMany({
    where: {
      snapshotDate: { gte: since },
      alphaScore: { gte: HIGH_ALPHA_THRESHOLD },
    },
    select: {
      snapshotDate: true,
      symbol: true,
      alphaScore: true,
      confidence: true,
      recommendationBucket: true,
      screenBucket: true,
    },
    orderBy: [{ snapshotDate: 'asc' }, { alphaScore: 'desc' }],
  });

  if (rows.length < 10) {
    limitations.push(`strong_alpha_candidate 快照樣本偏低（${rows.length} 筆）`);
  }
  limitations.push(`以 alphaScore >= ${HIGH_ALPHA_THRESHOLD} 定義高 alpha bucket；此定義對齊 SignalFusionEngine，且不回寫既有 screen 結果`);

  return {
    signalType: 'strong_alpha_candidate',
    observations: rows.map((row) => ({
      signalType: 'strong_alpha_candidate',
      symbol: row.symbol.toUpperCase(),
      date: normalizeDate(row.snapshotDate),
      context: {
        confidence: row.confidence,
        metadata: {
          alphaScore: row.alphaScore,
          recommendationBucket: row.recommendationBucket,
          screenBucket: row.screenBucket,
        },
      },
    })),
    limitations,
  };
}

async function buildChipAccumulationHistory(days: number): Promise<SignalHistory> {
  const limitations: string[] = [];
  const since = normalizeDate(daysAgoDate(days).toISOString()).replace(/-/g, '');

  const rows = await prisma.institutionalChip.findMany({
    where: {
      date: { gte: since },
      totalBuy: { gt: 0 },
    },
    select: {
      date: true,
      stockId: true,
      foreignBuy: true,
      trustBuy: true,
      dealerBuy: true,
      totalBuy: true,
    },
    orderBy: [{ date: 'asc' }, { totalBuy: 'desc' }],
  });

  if (rows.length === 0) {
    limitations.push('InstitutionalChip 無可追溯的正向淨買超資料，無法建立 chip_accumulation_signal 歷史');
    return { signalType: 'chip_accumulation_signal', observations: [], limitations };
  }

  if (rows.length < 10) {
    limitations.push(`chip_accumulation_signal 樣本偏低（${rows.length} 筆）`);
  }
  limitations.push('以 InstitutionalChip.totalBuy > 0 作為可追溯 proxy；目前系統無獨立的 chip_accumulation snapshot');

  return {
    signalType: 'chip_accumulation_signal',
    observations: rows.map((row) => ({
      signalType: 'chip_accumulation_signal',
      symbol: row.stockId.toUpperCase(),
      date: normalizeDate(row.date),
      context: {
        metadata: {
          totalBuy: row.totalBuy,
          foreignBuy: row.foreignBuy,
          trustBuy: row.trustBuy,
          dealerBuy: row.dealerBuy,
        },
      },
    })),
    limitations,
  };
}

async function buildRiskClusterElevatedHistory(days: number): Promise<SignalHistory> {
  const limitations: string[] = [];
  const since = daysAgoDate(days).toISOString().slice(0, 10);

  const totalSnapshots = await prisma.portfolioImpactSnapshot.count();
  if (totalSnapshots === 0) {
    limitations.push('PortfolioImpactSnapshot 尚無資料，無法重建 risk_cluster_elevated 歷史');
    return { signalType: 'risk_cluster_elevated', observations: [], limitations };
  }

  const rows = await prisma.portfolioImpactSnapshot.findMany({
    where: { snapshotDate: { gte: since } },
    select: {
      snapshotDate: true,
      scope: true,
      riskClusters: true,
    },
    orderBy: { snapshotDate: 'asc' },
  });

  const observations: SignalObservation[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const parsed = safeJsonParse<PortfolioRiskClusters>(row.riskClusters);
    if (!parsed || !Array.isArray(parsed.clusters) || parsed.clusters.length === 0) continue;

    const elevatedClusters = parsed.clusters.filter((cluster) =>
      cluster.riskLevel === 'elevated' || cluster.riskLevel === 'high',
    );

    if (elevatedClusters.length === 0 && parsed.overallRiskLevel !== 'elevated' && parsed.overallRiskLevel !== 'high') {
      continue;
    }

    for (const cluster of elevatedClusters) {
      const symbols = uniqueUpperSymbols(cluster.symbols ?? []);
      for (const observation of toObservations(
        {
          signalType: 'risk_cluster_elevated',
          date: normalizeDate(row.snapshotDate),
          context: {
            metadata: {
              scope: row.scope,
              clusterType: cluster.clusterType,
              riskLevel: cluster.riskLevel,
              reason: cluster.reason,
            },
          },
        },
        symbols,
      )) {
        const key = `${observation.date}::${cluster.clusterType}::${observation.symbol ?? 'market'}`;
        if (seen.has(key)) continue;
        seen.add(key);
        observations.push(observation);
      }
    }
  }

  if (observations.length < 10) {
    limitations.push(`risk_cluster_elevated 樣本偏低（${observations.length} 筆）`);
  }
  limitations.push('risk_cluster_elevated 來自 PortfolioImpactSnapshot 的高風險 cluster；若 cluster 未附 symbols，僅能視為市場級觀察');

  return { signalType: 'risk_cluster_elevated', observations, limitations };
}

async function buildRegimeShiftHistory(days: number): Promise<SignalHistory> {
  const limitations: string[] = [];
  const since = daysAgoDate(days).toISOString().slice(0, 10);

  const totalSnapshots = await prisma.dailyMarketSnapshot.count();
  if (totalSnapshots === 0) {
    limitations.push('DailyMarketSnapshot 尚無資料，無法重建 regime_shift_signal 歷史');
    return { signalType: 'regime_shift_signal', observations: [], limitations };
  }

  const rows = await prisma.dailyMarketSnapshot.findMany({
    where: { snapshotDate: { gte: since } },
    select: {
      snapshotDate: true,
      regime: true,
      regimeConfidence: true,
    },
    orderBy: { snapshotDate: 'asc' },
  });

  const observations: SignalObservation[] = [];

  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1];
    const current = rows[i];
    if (previous.regime === current.regime) continue;

    observations.push({
      signalType: 'regime_shift_signal',
      date: normalizeDate(current.snapshotDate),
      context: {
        regime: normalizeRegimeLabel(current.regime),
        confidence: current.regimeConfidence,
        metadata: {
          from: previous.regime,
          to: current.regime,
        },
      },
    });
  }

  if (observations.length < 10) {
    limitations.push(`regime_shift_signal 樣本偏低（${observations.length} 筆）；regime shift 本身屬低頻訊號`);
  }
  limitations.push('regime_shift_signal 僅使用 DailyMarketSnapshot 已落地的 regime 歷史，不額外推測缺漏日的 regime');

  return { signalType: 'regime_shift_signal', observations, limitations };
}

export async function buildAllSignalHistories(days = 180): Promise<SignalHistory[]> {
  const [
    topicSurging,
    themeDiffusing,
    strongAlpha,
    chipAccum,
    riskCluster,
    regimeShift,
  ] = await Promise.all([
    buildTopicSurgingHistory(days),
    buildThemeDiffusingHistory(days),
    buildStrongAlphaCandidateHistory(days),
    buildChipAccumulationHistory(days),
    buildRiskClusterElevatedHistory(days),
    buildRegimeShiftHistory(days),
  ]);

  return [topicSurging, themeDiffusing, strongAlpha, chipAccum, riskCluster, regimeShift];
}

export async function buildSignalHistory(
  signalType: SignalType,
  days = 180,
): Promise<SignalHistory> {
  switch (signalType) {
    case 'topic_surging':
      return buildTopicSurgingHistory(days);
    case 'theme_diffusing':
      return buildThemeDiffusingHistory(days);
    case 'strong_alpha_candidate':
      return buildStrongAlphaCandidateHistory(days);
    case 'chip_accumulation_signal':
      return buildChipAccumulationHistory(days);
    case 'risk_cluster_elevated':
      return buildRiskClusterElevatedHistory(days);
    case 'regime_shift_signal':
      return buildRegimeShiftHistory(days);
  }
}
