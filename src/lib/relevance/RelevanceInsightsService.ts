import { detectRegime } from '@/lib/market/MarketRegimeEngine';
import { getEventSummaryForSymbol, getMarketEventSummary } from '@/lib/events/EventSummaryEngine';
import { generateTopicSurgeSummary, type TopicSurgeResult } from '@/lib/events/TopicSurgeEngine';
import { getLatestPortfolioImpactSnapshot } from '@/lib/portfolio/PortfolioImpactSnapshotEngine';
import { generatePortfolioImpacts } from '@/lib/portfolio/PortfolioImpactEngine';
import type { EventSourceQuality } from '@/lib/events/EventSourceQualityEngine';
import {
  buildSignalEffectivenessBatch,
  buildDegradedSignalEffectivenessBatch,
} from '@/lib/signals/SignalEffectivenessBatchService';
import { buildAllSignalHistories } from '@/lib/signals/SignalHistoryBuilder';
import { SIGNAL_LABELS, type SignalEffectiveness, type SignalHistory } from '@/lib/signals/types';
import { describeRegimeDependency, describeSignalSummary } from '@/lib/signals/SignalEffectivenessEngine';
import { buildStockTabHref } from '@/lib/stockTabNavigation';
import type { EventSummaryResult } from '@/lib/events/EventSummaryEngine';
import type { PortfolioImpact, PortfolioImpactSnapshotRecord, PortfolioImpactSnapshotComparison } from '@/types/portfolio';
import { buildRelevantInsight, rankRelevantInsights } from './RelevanceScoringEngine';
import {
  applyQualityOverlay,
  computeSignalQualityOverlay,
  computeEventQualityOverlay,
  computeGenericQualityOverlay,
} from './RelevanceQualityOverlay';
import type {
  InsightCoverage,
  InsightDirectness,
  InsightPersistence,
  InsightTrust,
  RelevanceInsightsApiResponse,
  RelevanceMode,
  RelevantInsight,
} from './types';

interface InsightSourceLink {
  sourceRef?: string;
  sourceTarget?: string;
  sourceAnchor?: string;
}

const SOURCE_ANCHORS = {
  stockSignal: 'stock-signal-effectiveness',
  stockEvent: 'stock-event-context',
  stockTopic: 'stock-topic-context',
  stockDecision: 'stock-decision-context',
  dailySignal: 'daily-signal-reliability',
  dailyEvents: 'daily-market-events',
  dailyTopics: 'daily-topic-surge',
  dailyPortfolio: 'daily-portfolio-observation',
  dailyRisk: 'daily-risk-summary',
  watchlistPortfolio: 'watchlist-portfolio-context',
  watchlistRisk: 'watchlist-risk-context',
} as const;

function daysSince(date: string | undefined): number | null {
  if (!date) return null;
  const target = new Date(`${date.slice(0, 10)}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(target)) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.max(0, Math.round((todayUtc - target) / (24 * 60 * 60 * 1000)));
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function parseTrustFromText(text: string, limitations: string[]): InsightTrust {
  const lower = `${text} ${limitations.join(' ')}`.toLowerCase();
  const match = text.match(/official\s+(\d+)\s*\/\s*mainstream\s+(\d+)\s*\/\s*secondary\s+(\d+)\s*\/\s*unknown\s+(\d+)/i);
  if (match) {
    const official = Number(match[1]);
    const mainstream = Number(match[2]);
    const secondary = Number(match[3]);
    const unknown = Number(match[4]);
    const total = official + mainstream + secondary + unknown;
    if (total === 0) return 'unknown';
    const highRatio = (official + mainstream) / total;
    const lowRatio = (secondary + unknown) / total;
    if (highRatio >= 0.6) return 'high';
    if (lowRatio >= 0.75) return 'low';
    return 'medium';
  }
  if (lower.includes('low-trust') || lower.includes('secondary') || lower.includes('unknown')) return 'low';
  if (lower.includes('official') || lower.includes('mainstream')) return 'medium';
  return 'unknown';
}

function inferEventTrust(summary: EventSummaryResult): InsightTrust {
  const total =
    summary.trustLevelSummary.official +
    summary.trustLevelSummary.mainstream +
    summary.trustLevelSummary.secondary +
    summary.trustLevelSummary.unknown;
  if (total === 0) return 'unknown';
  const highRatio = (summary.trustLevelSummary.official + summary.trustLevelSummary.mainstream) / total;
  const lowRatio = (summary.trustLevelSummary.secondary + summary.trustLevelSummary.unknown) / total;
  if (highRatio >= 0.6) return 'high';
  if (lowRatio >= 0.75) return 'low';
  return 'medium';
}

function inferCoverageFromLimitations(limitations: string[], fallback: InsightCoverage = 'limited'): InsightCoverage {
  const lower = limitations.join(' ').toLowerCase();
  if (lower.includes('insufficient') || lower.includes('資料不足') || lower.includes('不可用')) return 'insufficient';
  if (lower.includes('limited') || lower.includes('偏少') || lower.includes('有限')) return 'limited';
  return fallback;
}

function persistenceFromSignal(effectiveness: SignalEffectiveness): InsightPersistence {
  const { avgDuration, continuationRate } = effectiveness.persistence;
  if (avgDuration >= 3 || continuationRate >= 0.55) return 'continuous';
  if (avgDuration >= 2 || continuationRate >= 0.35) return 'persistent';
  if (avgDuration >= 1.2 || continuationRate >= 0.15) return 'developing';
  return 'transient';
}

function persistenceFromTopic(topic: TopicSurgeResult): InsightPersistence {
  if (topic.surgeLevel === 'surging' && topic.diffusionLevel === 'broadening theme') return 'continuous';
  if (topic.surgeLevel === 'surging' || topic.diffusionLevel === 'broadening theme') return 'persistent';
  if (topic.surgeLevel === 'watch' || topic.diffusionLevel === 'multi-stock theme') return 'developing';
  return 'transient';
}

function persistenceFromSnapshot(comparison: PortfolioImpactSnapshotComparison): InsightPersistence {
  const changed = [comparison.themeChanged, comparison.sectorChanged, comparison.riskChanged, comparison.regimeExposureChanged].filter(Boolean).length;
  if (changed >= 3) return 'continuous';
  if (changed >= 2) return 'persistent';
  if (changed >= 1) return 'developing';
  return 'transient';
}

function effectiveRegimes(effectiveness: SignalEffectiveness): string[] {
  const regimes: string[] = [];
  if ((effectiveness.regimeBreakdown.bull?.avgReturn ?? 0) > 0) regimes.push('Bull');
  if ((effectiveness.regimeBreakdown.bear?.avgReturn ?? 0) > 0) regimes.push('Bear');
  if ((effectiveness.regimeBreakdown.neutral?.avgReturn ?? 0) > 0) regimes.push('Neutral');
  return regimes;
}

function inferSignalCoverage(effectiveness: SignalEffectiveness): InsightCoverage {
  if (effectiveness.sampleSize >= 30 && effectiveness.limitations.length <= 2) return 'full';
  if (effectiveness.sampleSize >= 10) return 'limited';
  return 'insufficient';
}

function inferSignalTrust(effectiveness: SignalEffectiveness): InsightTrust {
  if (effectiveness.classification === 'STRONG_SIGNAL' && effectiveness.limitations.length <= 2) return 'high';
  if (effectiveness.classification === 'NOISE') return 'low';
  if (effectiveness.limitations.some((item) => item.includes('missing') || item.includes('缺少') || item.includes('degraded'))) return 'low';
  return 'medium';
}

function findRecentObservationDate(history: SignalHistory, symbol?: string): string | undefined {
  const filtered = symbol
    ? history.observations.filter((observation) => observation.symbol === symbol)
    : history.observations;
  return filtered
    .map((observation) => observation.date)
    .sort()
    .slice(-1)[0];
}

function topicDirectness(topic: TopicSurgeResult, mode: RelevanceMode, watchlistSymbols: string[]): InsightDirectness {
  if (mode === 'symbol') return 'direct';
  if (watchlistSymbols.length === 0) return 'market';
  return topic.relatedSymbols.some((symbol) => watchlistSymbols.includes(symbol.toUpperCase())) ? 'watchlist' : 'market';
}

function signalSource(mode: RelevanceMode, symbol?: string): InsightSourceLink {
  if (mode === 'symbol' && symbol) {
    return {
      sourceRef: '訊號有效性（研究）',
      sourceTarget: buildStockTabHref({
        basePath: `/stocks/${symbol}`,
        tab: 'signals',
        anchor: SOURCE_ANCHORS.stockSignal,
      }),
      sourceAnchor: SOURCE_ANCHORS.stockSignal,
    };
  }

  return {
    sourceRef: '近期訊號可靠度觀察',
    sourceTarget: `/report/daily#${SOURCE_ANCHORS.dailySignal}`,
    sourceAnchor: SOURCE_ANCHORS.dailySignal,
  };
}

function eventSource(mode: RelevanceMode, symbol?: string): InsightSourceLink {
  if (mode === 'symbol' && symbol) {
    return {
      sourceRef: '事件 / 催化劑（MVP）',
      sourceTarget: `/stocks/${symbol}#${SOURCE_ANCHORS.stockEvent}`,
      sourceAnchor: SOURCE_ANCHORS.stockEvent,
    };
  }

  return {
    sourceRef: '市場事件 / 催化觀察',
    sourceTarget: `/report/daily#${SOURCE_ANCHORS.dailyEvents}`,
    sourceAnchor: SOURCE_ANCHORS.dailyEvents,
  };
}

function topicSource(mode: RelevanceMode, symbol?: string): InsightSourceLink {
  if (mode === 'symbol' && symbol) {
    return {
      sourceRef: '題材趨勢脈絡（研究補充）',
      sourceTarget: `/stocks/${symbol}#${SOURCE_ANCHORS.stockTopic}`,
      sourceAnchor: SOURCE_ANCHORS.stockTopic,
    };
  }

  return {
    sourceRef: '主題升溫觀察',
    sourceTarget: `/report/daily#${SOURCE_ANCHORS.dailyTopics}`,
    sourceAnchor: SOURCE_ANCHORS.dailyTopics,
  };
}

function portfolioSource(mode: RelevanceMode): InsightSourceLink {
  if (mode === 'watchlist') {
    return {
      sourceRef: '組合風險與集中度（研究）',
      sourceTarget: `/watchlist#${SOURCE_ANCHORS.watchlistPortfolio}`,
      sourceAnchor: SOURCE_ANCHORS.watchlistPortfolio,
    };
  }

  return {
    sourceRef: '組合觀察（研究）',
    sourceTarget: `/report/daily#${SOURCE_ANCHORS.dailyPortfolio}`,
    sourceAnchor: SOURCE_ANCHORS.dailyPortfolio,
  };
}

function riskSource(mode: RelevanceMode, symbol?: string): InsightSourceLink {
  if (mode === 'symbol' && symbol) {
    return {
      sourceRef: '決策脈絡（研究輔助）',
      sourceTarget: `/stocks/${symbol}#${SOURCE_ANCHORS.stockDecision}`,
      sourceAnchor: SOURCE_ANCHORS.stockDecision,
    };
  }

  if (mode === 'watchlist') {
    return {
      sourceRef: '組合風險與集中度（研究）',
      sourceTarget: `/watchlist#${SOURCE_ANCHORS.watchlistRisk}`,
      sourceAnchor: SOURCE_ANCHORS.watchlistRisk,
    };
  }

  return {
    sourceRef: '風險摘要',
    sourceTarget: `/report/daily#${SOURCE_ANCHORS.dailyRisk}`,
    sourceAnchor: SOURCE_ANCHORS.dailyRisk,
  };
}

function portfolioCoverage(snapshot: PortfolioImpactSnapshotRecord): InsightCoverage {
  if (snapshot.symbols.length >= 5 && snapshot.riskClusters.overallRiskLevel !== 'unknown') return 'full';
  if (snapshot.symbols.length >= 1) return 'limited';
  return 'insufficient';
}

function portfolioTrust(limitations: string[]): InsightTrust {
  if (limitations.length === 0) return 'high';
  if (limitations.length <= 2) return 'medium';
  return 'low';
}

function eventCoverage(summary: EventSummaryResult): InsightCoverage {
  if (summary.dataCoverage === 'full') return 'full';
  if (summary.dataCoverage === 'limited') return 'limited';
  return 'insufficient';
}

function fallbackSnapshotResult(): {
  snapshot: PortfolioImpactSnapshotRecord;
  comparison: PortfolioImpactSnapshotComparison;
} {
  return {
    snapshot: {
      snapshotDate: new Date().toISOString().split('T')[0],
      scope: 'watchlist',
      symbols: [],
      summary: '尚無組合快照資料',
      themeConcentration: {
        topThemes: [],
        concentrationLevel: 'unknown',
        explanation: '資料不足',
      },
      sectorConcentration: {
        sectors: [],
        concentrationLevel: 'unknown',
        chainBias: 'unknown',
        explanation: '資料不足',
      },
      riskClusters: {
        overallRiskLevel: 'unknown',
        clusters: [],
      },
      regimeExposure: {
        regime: 'Unknown',
        confidence: 0,
        offensiveExposure: 0,
        defensiveExposure: 0,
        neutralExposure: 0,
        sensitivity: 'unknown',
        note: '資料不足',
      },
      limitations: ['portfolio snapshot 暫時不可用'],
    },
    comparison: {
      comparisonAvailable: false,
      previousSnapshotDate: null,
      compareWindow: '1d',
      themeChanged: false,
      sectorChanged: false,
      riskChanged: false,
      regimeExposureChanged: false,
      summaryNote: 'comparison unavailable',
      details: {
        themeLevelChange: { from: 'unknown', to: 'unknown' },
        sectorLevelChange: { from: 'unknown', to: 'unknown' },
        riskLevelChange: { from: 'unknown', to: 'unknown' },
        regimeChange: { from: 'Unknown', to: 'Unknown', fromSensitivity: 'unknown', toSensitivity: 'unknown' },
        topThemeChange: { from: null, to: null },
        topSectorChange: { from: null, to: null },
      },
    },
  };
}

function buildSignalInsights(params: {
  mode: RelevanceMode;
  symbol?: string;
  currentRegime?: string;
  histories: SignalHistory[];
  signalBatch: Awaited<ReturnType<typeof buildSignalEffectivenessBatch>>;
}): RelevantInsight[] {
  const { mode, symbol, currentRegime, histories, signalBatch } = params;
  const historyMap = new Map(histories.map((history) => [history.signalType, history]));

  return signalBatch.results.map((result) => {
    const history = historyMap.get(result.signalType);
    const latestObservationDate = history ? findRecentObservationDate(history, symbol) : undefined;
    const directness: InsightDirectness = mode === 'symbol' ? 'direct' : 'market';
    const relevance = buildRelevantInsight({
      id: `signal:${result.signalType}:${mode}:${symbol ?? 'all'}`,
      type: result.signalType,
      category: 'signal',
      title: `${SIGNAL_LABELS[result.signalType]} 值得追蹤度`,
      summary: `${SIGNAL_LABELS[result.signalType]}：${result.classification} · hit rate ${pct(result.hitRate)} · 超額 ${signedPct(result.excessReturn)} · ${describeSignalSummary(result.effectiveness)}`,
      sourceType: 'signal_effectiveness',
      directness,
      signalContext: {
        classification: result.classification,
        sampleSize: result.sampleSize,
      },
      recencyDays: daysSince(latestObservationDate),
      persistence: persistenceFromSignal(result.effectiveness),
      regimeContext: {
        currentRegime,
        relevantRegimes: effectiveRegimes(result.effectiveness),
      },
      dataQuality: {
        coverage: inferSignalCoverage(result.effectiveness),
        trust: inferSignalTrust(result.effectiveness),
      },
      limitations: result.limitations,
      ...signalSource(mode, symbol),
    });

    const withSummary: RelevantInsight = {
      ...relevance,
      summary: `${relevance.summary}；${describeRegimeDependency(result.effectiveness)}`,
    };

    const overlay = computeSignalQualityOverlay({
      stabilityScore: result.effectiveness.stabilityScore,
      sampleSize: result.effectiveness.sampleSize,
      regimeBreakdown: result.effectiveness.regimeBreakdown,
      classification: result.effectiveness.classification,
    });

    return applyQualityOverlay(withSummary, overlay);
  });
}

/**
 * Apply simulation-dominance guardrail to event insight trust level.
 * SIMULATION_DOMINATED → force trust to 'low', add limitation.
 * MIXED_SOURCE → cap trust at 'medium'.
 * INSUFFICIENT_EVENT_DATA → cap trust at 'low'.
 * LIVE_CONFIDENT → use inferred trust as-is.
 */
function applySourceQualityGuardrail(
  inferred: InsightTrust,
  sourceQuality: EventSourceQuality | undefined,
): { trust: InsightTrust; extraLimitations: string[] } {
  if (!sourceQuality) return { trust: inferred, extraLimitations: [] };
  const label = sourceQuality.qualityLabel;
  const extraLimitations: string[] = [];

  if (label === 'SIMULATION_DOMINATED') {
    extraLimitations.push(
      `[SIMULATION_DOMINATED] 事件研究結論以模擬來源為主（mock ${(sourceQuality.mockRatio * 100).toFixed(0)}%），可信度大幅降低`,
    );
    extraLimitations.push(...sourceQuality.limitations);
    return { trust: 'low', extraLimitations };
  }

  if (label === 'INSUFFICIENT_EVENT_DATA') {
    extraLimitations.push('[INSUFFICIENT_EVENT_DATA] 事件資料不足，無法形成可信研究結論');
    extraLimitations.push(...sourceQuality.limitations);
    const capTrust: InsightTrust = inferred === 'high' ? 'medium' : inferred;
    return { trust: capTrust, extraLimitations };
  }

  if (label === 'MIXED_SOURCE') {
    extraLimitations.push(`[MIXED_SOURCE] 事件來源混合，含模擬事件 ${sourceQuality.mockCount} 則，建議保守解讀`);
    extraLimitations.push(...sourceQuality.limitations.slice(0, 2));
    const capTrust: InsightTrust = inferred === 'high' ? 'medium' : inferred;
    return { trust: capTrust, extraLimitations };
  }

  // LIVE_CONFIDENT — no override, but add minor note if there are limitations
  if (sourceQuality.limitations.length > 0) {
    extraLimitations.push(...sourceQuality.limitations.slice(0, 1));
  }
  return { trust: inferred, extraLimitations };
}

function buildEventInsight(params: {
  mode: RelevanceMode;
  symbol?: string;
  summary: EventSummaryResult;
  alphaScore?: number;
}): RelevantInsight {
  const { mode, symbol, summary, alphaScore } = params;
  const title = mode === 'symbol' ? `${symbol} 事件/催化觀察` : '市場事件/催化觀察';
  const sourceQuality = summary.sourceQuality;

  // Determine base summary text; override if simulation-dominated
  let summaryText: string;
  if (sourceQuality?.qualityLabel === 'SIMULATION_DOMINATED') {
    summaryText = `[模擬主導] 近期事件資料以模擬來源為主，不代表真實市場催化；${summary.catalystSummary}`;
  } else if (sourceQuality?.qualityLabel === 'INSUFFICIENT_EVENT_DATA' || summary.eventCount === 0) {
    summaryText = '近期無明確高可信度事件催化，事件面優先級偏低。';
  } else {
    summaryText = `${summary.catalystSummary}；近期 ${summary.eventCount} 則事件，主題聚焦 ${summary.recentThemes.slice(0, 3).join(' / ') || '有限'}`;
  }

  const inferredTrust = inferEventTrust(summary);
  const { trust, extraLimitations } = applySourceQualityGuardrail(inferredTrust, sourceQuality);

  const builtEventInsight = buildRelevantInsight({
    id: `event:${mode}:${symbol ?? 'market'}`,
    type: 'event_summary',
    category: 'event',
    title,
    summary: summaryText,
    sourceType: 'event_summary',
    directness: mode === 'symbol' ? 'direct' : 'market',
    recencyDays: mode === 'report' ? 1 : 7,
    persistence:
      sourceQuality?.qualityLabel === 'SIMULATION_DOMINATED' || sourceQuality?.qualityLabel === 'INSUFFICIENT_EVENT_DATA'
        ? 'transient'
        : summary.eventCount >= 4
        ? 'persistent'
        : summary.eventCount >= 2
        ? 'developing'
        : 'transient',
    dataQuality: {
      coverage: eventCoverage(summary),
      trust,
    },
    alphaContext: mode === 'symbol' ? { alphaScore } : undefined,
    limitations: [...summary.limitations, ...extraLimitations],
    ...eventSource(mode, symbol),
  });

  return applyQualityOverlay(builtEventInsight, computeEventQualityOverlay(sourceQuality));
}

function buildTopicInsights(params: {
  mode: RelevanceMode;
  symbol?: string;
  alphaScore?: number;
  topics: TopicSurgeResult[];
  globalLimitations: string[];
  watchlistSymbols: string[];
}): RelevantInsight[] {
  const { mode, symbol, alphaScore, topics, globalLimitations, watchlistSymbols } = params;
  const chosen = topics.length > 0
    ? topics.slice(0, mode === 'symbol' ? 2 : 3)
    : [{
        topic: mode === 'symbol' ? `${symbol} 主題脈絡` : '市場主題脈絡',
        recentCount: 0,
        previousCount: 0,
        delta: 0,
        surgeLevel: 'none' as const,
        diffusionLevel: 'single-stock theme' as const,
        relatedSymbols: [],
        trustLevelSummary: '來源不足',
        limitations: ['近期無可用 topic surge 資料，已降級顯示'],
      }];

  return chosen.map((topic, index) => {
    const topicCoverage: InsightCoverage = topic.recentCount > 0 ? (topic.limitations.length > 2 ? 'limited' : 'full') : 'insufficient';
    const topicTrust = parseTrustFromText(topic.trustLevelSummary, topic.limitations);
    const allTopicLimitations = [...globalLimitations, ...topic.limitations];
    const builtTopicInsight = buildRelevantInsight({
      id: `topic:${mode}:${symbol ?? 'market'}:${topic.topic}:${index}`,
      type: 'topic_surge',
      category: 'topic',
      title: `${topic.topic} 主題相關度`,
      summary:
        topic.recentCount > 0
          ? `${topic.surgeLevel} / ${topic.diffusionLevel}；最近 ${topic.recentCount} vs 前期 ${topic.previousCount}；關聯 ${topic.relatedSymbols.length} 檔標的`
          : '目前缺少可用主題升溫資料，主題面優先級降低。',
      sourceType: 'topic_surge',
      directness: topicDirectness(topic, mode, watchlistSymbols),
      recencyDays: 3,
      persistence: persistenceFromTopic(topic),
      dataQuality: { coverage: topicCoverage, trust: topicTrust },
      alphaContext: mode === 'symbol' ? { alphaScore } : undefined,
      limitations: allTopicLimitations,
      ...topicSource(mode, symbol),
    });
    return applyQualityOverlay(
      builtTopicInsight,
      computeGenericQualityOverlay({ coverage: topicCoverage, trust: topicTrust, limitationsCount: allTopicLimitations.length }),
    );
  });
}

function buildPortfolioInsight(params: {
  mode: RelevanceMode;
  snapshot: PortfolioImpactSnapshotRecord;
  comparison: PortfolioImpactSnapshotComparison;
}): RelevantInsight {
  const { mode, snapshot, comparison } = params;
  const directness: InsightDirectness = mode === 'report' ? 'portfolio' : 'watchlist';
  const pCoverage = portfolioCoverage(snapshot);
  const pTrust = portfolioTrust(snapshot.limitations);
  const pLimitations = [...snapshot.limitations, ...(comparison.comparisonAvailable ? [] : [comparison.summaryNote])];
  const builtPortfolioInsight = buildRelevantInsight({
    id: `portfolio:${mode}:${snapshot.scope}:${snapshot.snapshotDate}`,
    type: 'portfolio_snapshot',
    category: 'portfolio',
    title: mode === 'report' ? '今日組合結構變化' : 'watchlist 組合結構變化',
    summary: comparison.comparisonAvailable ? comparison.summaryNote : snapshot.summary,
    sourceType: 'portfolio_impact_snapshot',
    directness,
    recencyDays: 1,
    persistence: persistenceFromSnapshot(comparison),
    regimeContext: {
      currentRegime: snapshot.regimeExposure.regime,
      relevantRegimes: snapshot.regimeExposure.regime !== 'Unknown' ? [snapshot.regimeExposure.regime] : [],
    },
    dataQuality: { coverage: pCoverage, trust: pTrust },
    limitations: pLimitations,
    ...portfolioSource(mode),
  });
  return applyQualityOverlay(
    builtPortfolioInsight,
    computeGenericQualityOverlay({ coverage: pCoverage, trust: pTrust, limitationsCount: pLimitations.length }),
  );
}

function buildPortfolioRiskInsight(params: {
  mode: RelevanceMode;
  snapshot: PortfolioImpactSnapshotRecord;
  comparison: PortfolioImpactSnapshotComparison;
}): RelevantInsight {
  const { mode, snapshot, comparison } = params;
  const topCluster = snapshot.riskClusters.clusters[0];
  const summary = topCluster
    ? `風險群聚 ${snapshot.riskClusters.overallRiskLevel}；${topCluster.clusterType}：${topCluster.reason}`
    : `風險群聚等級 ${snapshot.riskClusters.overallRiskLevel}；${comparison.summaryNote}`;
  const rCoverage = portfolioCoverage(snapshot);
  const rTrust = portfolioTrust(snapshot.limitations);
  const builtRiskInsight = buildRelevantInsight({
    id: `risk:${mode}:${snapshot.scope}:${snapshot.snapshotDate}`,
    type: 'portfolio_risk',
    category: 'risk',
    title: mode === 'report' ? '今日風險重點' : 'watchlist 風險重點',
    summary,
    sourceType: 'portfolio_impact_snapshot',
    directness: mode === 'report' ? 'portfolio' : 'watchlist',
    recencyDays: 1,
    persistence: persistenceFromSnapshot(comparison),
    dataQuality: { coverage: rCoverage, trust: rTrust },
    limitations: snapshot.limitations,
    ...riskSource(mode),
  });
  return applyQualityOverlay(
    builtRiskInsight,
    computeGenericQualityOverlay({ coverage: rCoverage, trust: rTrust, limitationsCount: snapshot.limitations.length }),
  );
}

function buildSymbolRiskInsight(symbol: string, impact: PortfolioImpact): RelevantInsight {
  const srCoverage = inferCoverageFromLimitations(impact.limitations, impact.topicContext.topics.length > 0 ? 'limited' : 'insufficient');
  const srTrust: InsightTrust = impact.limitations.length === 0 ? 'high' : impact.limitations.length <= 2 ? 'medium' : 'low';
  const builtSymbolRiskInsight = buildRelevantInsight({
    id: `risk:symbol:${symbol}`,
    type: 'symbol_risk_context',
    category: 'risk',
    title: `${symbol} 風險脈絡`,
    summary:
      impact.riskContext.warnings.length > 0
        ? `${impact.riskContext.riskLevel}；${impact.riskContext.warnings.slice(0, 2).join('；')}`
        : `${impact.riskContext.riskLevel}；目前無額外高優先風險警示。`,
    sourceType: 'portfolio_impact',
    directness: 'direct',
    recencyDays: 1,
    persistence: impact.riskContext.riskLevel === 'high' || impact.riskContext.riskLevel === 'elevated' ? 'persistent' : 'developing',
    regimeContext: {
      currentRegime: impact.regimeContext.regime,
      relevantRegimes: impact.regimeContext.regime !== 'Unknown' ? [impact.regimeContext.regime] : [],
    },
    dataQuality: { coverage: srCoverage, trust: srTrust },
    alphaContext: {
      alphaScore: impact.alphaContext.alphaScore,
      confidence: impact.alphaContext.confidence,
    },
    limitations: impact.limitations,
    ...riskSource('symbol', symbol),
  });
  return applyQualityOverlay(
    builtSymbolRiskInsight,
    computeGenericQualityOverlay({ coverage: srCoverage, trust: srTrust, limitationsCount: impact.limitations.length }),
  );
}

async function buildSymbolRelevantInsights(symbol: string, maxItems: number): Promise<RelevanceInsightsApiResponse> {
  const upperSymbol = symbol.trim().toUpperCase();
  const [regime, signalBatch, histories, eventRes, topicSummary, impacts] = await Promise.all([
    detectRegime().catch(() => null),
    buildSignalEffectivenessBatch({ symbol: upperSymbol, window: 5 }).catch(() =>
      buildDegradedSignalEffectivenessBatch(5, upperSymbol, 'signal batch unavailable'),
    ),
    buildAllSignalHistories(30).catch(() => []),
    getEventSummaryForSymbol({ symbol: upperSymbol, days: 7, limit: 20 }).catch(() => ({
      summary: {
        eventCount: 0,
        rawCount: 0,
        dedupedCount: 0,
        recentThemes: [],
        catalystSummary: '事件資料暫時不可用',
        sourceBreakdown: {},
        trustLevelSummary: { official: 0, mainstream: 0, secondary: 0, unknown: 0, dominant: 'mixed' as const, note: '來源不足' },
        limitations: ['事件資料暫時不可用'],
        dataCoverage: 'insufficient' as const,
        recentEventTitles: [],
      },
      source: 'empty' as const,
    })),
    generateTopicSurgeSummary({ days: 3, minSurgeLevel: 'watch', includeSymbols: true, maxTopics: 5, symbol: upperSymbol }).catch(() => ({
      summary: '主題資料暫時不可用',
      topics: [],
      limitations: ['主題資料暫時不可用'],
      generatedAt: new Date().toISOString(),
    })),
    generatePortfolioImpacts([upperSymbol]).catch(() => []),
  ]);

  const impact = impacts[0] ?? {
    symbol: upperSymbol,
    alphaContext: { alphaScore: 0, bucket: 'Insufficient Data', confidence: 0 },
    regimeContext: { regime: regime?.regime ?? 'Unknown', confidence: regime?.confidence ?? 0, implication: '資料不足' },
    topicContext: { topics: [] },
    eventContext: { eventCount: 0, recentAlertTypes: [], trustLevelSummary: '來源不足' },
    crossMarketContext: { spreadPattern: 'unavailable', spreadSpeed: 'unavailable', positionInChain: 'unclear' },
    riskContext: { riskLevel: 'unknown', warnings: ['portfolio impact 暫時不可用'] },
    narrative: 'portfolio impact 暫時不可用',
    limitations: ['portfolio impact 暫時不可用'],
  };

  const insights = [
    ...buildSignalInsights({
      mode: 'symbol',
      symbol: upperSymbol,
      currentRegime: regime?.regime,
      histories,
      signalBatch,
    }),
    buildEventInsight({
      mode: 'symbol',
      symbol: upperSymbol,
      summary: eventRes.summary,
      alphaScore: impact.alphaContext.alphaScore,
    }),
    ...buildTopicInsights({
      mode: 'symbol',
      symbol: upperSymbol,
      alphaScore: impact.alphaContext.alphaScore,
      topics: topicSummary.topics,
      globalLimitations: topicSummary.limitations,
      watchlistSymbols: [upperSymbol],
    }),
    buildSymbolRiskInsight(upperSymbol, impact),
  ];

  const ranked = rankRelevantInsights(insights).slice(0, maxItems);
  return {
    insights: ranked,
    generatedAt: new Date().toISOString(),
    limitations: [...new Set(ranked.flatMap((insight) => insight.limitations))],
  };
}

async function buildReportLikeRelevantInsights(mode: 'report' | 'watchlist', maxItems: number): Promise<RelevanceInsightsApiResponse> {
  const [regime, signalBatch, histories, marketEvent, topicSummary, snapshotResult] = await Promise.all([
    detectRegime().catch(() => null),
    buildSignalEffectivenessBatch({ window: 5 }).catch(() =>
      buildDegradedSignalEffectivenessBatch(5, undefined, 'signal batch unavailable'),
    ),
    buildAllSignalHistories(30).catch(() => []),
    getMarketEventSummary({ days: 1, limit: 30 }).catch(() => ({
      summary: {
        eventCount: 0,
        rawCount: 0,
        dedupedCount: 0,
        recentThemes: [],
        catalystSummary: '市場事件資料暫時不可用',
        sourceBreakdown: {},
        trustLevelSummary: { official: 0, mainstream: 0, secondary: 0, unknown: 0, dominant: 'mixed' as const, note: '來源不足' },
        limitations: ['市場事件資料暫時不可用'],
        dataCoverage: 'insufficient' as const,
        recentEventTitles: [],
      },
      source: 'empty' as const,
    })),
    generateTopicSurgeSummary({ days: 3, minSurgeLevel: 'watch', includeSymbols: true, maxTopics: 5 }).catch(() => ({
      summary: '主題資料暫時不可用',
      topics: [],
      limitations: ['主題資料暫時不可用'],
      generatedAt: new Date().toISOString(),
    })),
    getLatestPortfolioImpactSnapshot({ scope: 'watchlist', comparison: true, compareWindow: '1d' }).catch(() =>
      fallbackSnapshotResult(),
    ),
  ]);

  const watchlistSymbols = snapshotResult.snapshot.symbols.map((symbol) => symbol.toUpperCase());
  if (mode === 'watchlist' && watchlistSymbols.length === 0) {
    return {
      insights: [],
      generatedAt: new Date().toISOString(),
      limitations: [...new Set([
        'watchlist 缺少可用持倉資料，已保守降級為空狀態',
        ...snapshotResult.snapshot.limitations,
      ])],
    };
  }

  const insights = [
    buildPortfolioInsight({ mode, snapshot: snapshotResult.snapshot, comparison: snapshotResult.comparison }),
    buildPortfolioRiskInsight({ mode, snapshot: snapshotResult.snapshot, comparison: snapshotResult.comparison }),
    buildEventInsight({ mode, summary: marketEvent.summary }),
    ...buildTopicInsights({
      mode,
      topics: topicSummary.topics,
      globalLimitations: topicSummary.limitations,
      watchlistSymbols,
    }),
    ...buildSignalInsights({
      mode,
      currentRegime: regime?.regime,
      histories,
      signalBatch,
    }),
  ];

  const ranked = rankRelevantInsights(insights).slice(0, maxItems);
  return {
    insights: ranked,
    generatedAt: new Date().toISOString(),
    limitations: [...new Set(ranked.flatMap((insight) => insight.limitations))],
  };
}

export async function buildRelevantInsights(params: {
  mode: RelevanceMode;
  symbol?: string;
  maxItems?: number;
}): Promise<RelevanceInsightsApiResponse> {
  const mode = params.mode;
  const maxItems = Math.min(Math.max(params.maxItems ?? 5, 1), 10);

  if (mode === 'symbol') {
    if (!params.symbol) {
      return {
        insights: [],
        generatedAt: new Date().toISOString(),
        limitations: ['mode=symbol requires symbol'],
      };
    }
    return buildSymbolRelevantInsights(params.symbol, maxItems);
  }

  if (mode === 'watchlist') {
    return buildReportLikeRelevantInsights('watchlist', maxItems);
  }

  return buildReportLikeRelevantInsights('report', maxItems);
}
