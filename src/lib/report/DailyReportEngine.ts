/**
 * DailyReportEngine
 * 
 * Integrates MarketRegimeEngine, StrategyScreenEngine, watchlist data,
 * and data quality information into a single daily research summary.
 * 
 * IMPORTANT: This is a research summary, NOT investment advice.
 * All outputs must be traceable to underlying engine results.
 */

import { detectRegime, type MarketRegimeResult } from '@/lib/market/MarketRegimeEngine';
import { runScreen, type ScreenResult, type ScreenCandidate } from '@/lib/screen/StrategyScreenEngine';
import { buildComparison, type DailyComparison } from './DailySnapshotEngine';
import { prisma } from '@/lib/prisma';
import type { TrustLevelSummary } from '@/lib/events/EventIngestionService';
import { getMarketEventSummary } from '@/lib/events/EventSummaryEngine';
import { generateTopicSurgeSummary, type TopicSurgeResult } from '@/lib/events/TopicSurgeEngine';
import { generateTopicMomentum, type TopicMomentumResult } from '@/lib/events/TopicMomentumEngine';
import { generateThemeDiffusion, type ThemeDiffusionResult } from '@/lib/events/ThemeDiffusionEngine';
import { generateThemeLinkage, type ThemeLinkageResult } from '@/lib/events/ThemeLinkageEngine';
import { generateSectorRelationGraph, type SectorRelationGraphResult } from '@/lib/events/SectorRelationGraphEngine';
import { generateCrossMarketTheme, type CrossMarketThemeResult } from '@/lib/events/CrossMarketThemeEngine';
import { generateSectorLinkageTimeline, type SectorLinkageTimelineResult } from '@/lib/events/SectorLinkageTimelineEngine';
import {
  buildSignalEffectivenessSummary,
  evaluateAllSignals,
} from '@/lib/signals/SignalEffectivenessEngine';
import { buildAllSignalHistories } from '@/lib/signals/SignalHistoryBuilder';
import type { SignalEffectivenessSummary } from '@/lib/signals/types';

// ─── Types ───────────────────────────────────────────────────────

export interface DailyReport {
  reportDate: string;
  marketSummary: MarketSummary;
  eventSummary: EventSummary;
  topicSummary: TopicSummary;
  themeLinkageSummary: ThemeLinkageSummary;
  crossMarketSummary: CrossMarketSummary;
  signalReliabilitySummary: SignalEffectivenessSummary;
  candidateSummary: CandidateSummary;
  watchlistSummary: WatchlistSummary;
  riskSummary: RiskSummary;
  dataStatusSummary: DataStatusSummary;
  comparison: DailyComparison | null;
  disclaimer: string;
  last_updated: string;
}

export interface EventSummary {
  eventCount: number;
  rawCount: number;
  dedupedCount: number;
  recentThemes: string[];
  catalystSummary: string;
  sourceBreakdown: Record<string, number>;
  trustLevelSummary: TrustLevelSummary;
  limitations: string[];
  dataCoverage: 'full' | 'limited' | 'insufficient';
  recentEventTitles: string[];
}

export interface TopicSummary {
  summary: string;
  topics: TopicSurgeResult[];
  trendItems: Array<{
    topic: string;
    momentum: TopicMomentumResult;
    diffusion: ThemeDiffusionResult;
    trustLevelSummary: string;
  }>;
  limitations: string[];
  generatedAt: string;
}

export interface ThemeLinkageSummary {
  summary: string;
  items: Array<{
    topic: string;
    linkage: ThemeLinkageResult;
    graph: SectorRelationGraphResult;
  }>;
  limitations: string[];
  generatedAt: string;
}

export interface CrossMarketSummary {
  summary: string;
  items: Array<{
    topic: string;
    crossMarket: CrossMarketThemeResult;
    timeline: SectorLinkageTimelineResult;
    trustLevelSummary: string;
  }>;
  limitations: string[];
  generatedAt: string;
}

export interface MarketSummary {
  regime: string;
  regimeConfidence: number;
  summary: string;
  keyFactors: string[];
  limitations: string[];
}

export interface CandidateDetail {
  symbol: string;
  name: string;
  alphaScore: number;
  recommendationBucket: string;
  confidence: number;
  marketContext: string;
  whyIncluded: string;
  topFactors: string[];
  keyRisks: string[];
}

export interface CandidateSummary {
  strongCandidates: CandidateDetail[];
  watchCandidates: CandidateDetail[];
  strongCount: number;
  watchCount: number;
  neutralCount: number;
  excludedCount: number;
  totalScanned: number;
  keyReasons: string[];
  limitations: string[];
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  currentPrice: number;
  dailyChange: number;
  weeklyChange: number | null;
  volume: number;
  volumeChange: number | null;
  alphaScore: number | null;
  recommendationBucket: string | null;
  hasQuoteData: boolean;
}

export interface WatchlistSummary {
  totalItems: number;
  withQuoteData: number;
  topGainers: WatchlistItem[];
  topLosers: WatchlistItem[];
  insufficientDataItems: string[];
  historyTrackingAvailable: boolean;
  historyNote: string;
  limitations: string[];
}

export interface RiskSummary {
  overallRiskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'unknown';
  marketRiskContext: string;
  cautionNotes: string[];
  dataInsufficiencyWarning: string | null;
}

export interface DataSourceStatus {
  name: string;
  available: boolean;
  coverage: string;
  lastUpdated: string | null;
}

export interface DataStatusSummary {
  sources: DataSourceStatus[];
  overallCoverage: string;
  keyLimitations: string[];
  last_updated: string;
}

export interface ReportParams {
  includeWatchlist?: boolean;
  candidateLimit?: number;
  includeExcludedSummary?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────

const DEFAULT_CANDIDATE_LIMIT = 5;

const DISCLAIMER = '本報告僅為系統自動產生之研究摘要，不構成任何投資建議或保證。' +
  '所有分析結果基於歷史資料與規則模型推估，不代表未來表現。' +
  '資料來源可能存在延遲或不完整，請搭配其他資訊審慎判斷。' +
  '投資有風險，使用者應自行承擔所有交易決策之責任。';

function emptySignalReliabilitySummary(): SignalEffectivenessSummary {
  return {
    window: 5,
    signals: [],
    generatedAt: new Date().toISOString(),
    dataNote: '訊號有效性研究資料暫時不可用。',
    limitations: ['訊號有效性研究層無法執行，已降級'],
  };
}

async function buildSignalReliabilitySummary(): Promise<SignalEffectivenessSummary> {
  const histories = await buildAllSignalHistories(180);
  const effectiveness = await evaluateAllSignals(histories, 5);
  return buildSignalEffectivenessSummary(effectiveness, 5);
}

// ─── Engine ──────────────────────────────────────────────────────

export async function generateDailyReport(params?: ReportParams): Promise<DailyReport> {
  const includeWatchlist = params?.includeWatchlist !== false;
  const candidateLimit = params?.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT;

  // Run all data fetches in parallel
  const [regimeResult, screenResult, watchlistData, dbStats, marketEvent, topicSurge, signalReliabilitySummary] = await Promise.all([
    detectRegime().catch((): MarketRegimeResult => ({
      regime: 'Unknown' as const,
      confidence: 0,
      factors: [],
      dataCoverage: 'insufficient',
      samplePeriod: 'N/A',
      dataPoints: 0,
      last_updated: new Date().toISOString(),
      limitations: ['MarketRegimeEngine 無法連線或資料不足'],
    })),
    runScreen().catch((): ScreenResult => ({
      regime: 'Unknown',
      regimeConfidence: 0,
      candidates: [],
      excludedCount: 0,
      excluded: [],
      totalScanned: 0,
      dataCoverageSummary: { full: 0, limited: 0, insufficient: 0 },
      screenParams: {
        minAlphaScore: 60,
        minConfidence: 60,
        respectMarketRegime: true,
        appliedRegimeAdjustment: 'fallback',
      },
      last_updated: new Date().toISOString(),
      limitations: ['StrategyScreenEngine 無法執行'],
      disclaimer: '策略篩選暫時不可用，僅提供降級摘要。',
    })),
    includeWatchlist ? fetchWatchlistData() : Promise.resolve(null),
    fetchDataStats(),
    getMarketEventSummary({ days: 1, limit: 50 }).catch(() => ({
      summary: {
        eventCount: 0,
        rawCount: 0,
        dedupedCount: 0,
        recentThemes: [],
        catalystSummary: '事件來源不可用',
        sourceBreakdown: {},
        trustLevelSummary: {
          official: 0,
          mainstream: 0,
          secondary: 0,
          unknown: 0,
          dominant: 'mixed' as const,
          note: '事件來源不可用',
        },
        limitations: ['事件來源抓取失敗，已降級為空資料'],
        dataCoverage: 'insufficient' as const,
        recentEventTitles: [],
      },
      source: 'empty' as const,
    })),
    generateTopicSurgeSummary({ days: 3, minSurgeLevel: 'watch', includeSymbols: true, maxTopics: 5 }).catch(() => ({
      summary: '主題升溫資料暫時不可用',
      topics: [],
      limitations: ['TopicSurgeEngine 不可用，已降級'],
      generatedAt: new Date().toISOString(),
    })),
    buildSignalReliabilitySummary().catch(() => emptySignalReliabilitySummary()),
  ]);
  const trendItems = await Promise.all(
    topicSurge.topics.slice(0, 3).map(async (topic) => {
      const [momentum, diffusion] = await Promise.all([
        generateTopicMomentum({ topic: topic.topic, days: 7, minCount: 0 }),
        generateThemeDiffusion({ topic: topic.topic, days: 7, minCount: 0 }),
      ]);
      return {
        topic: topic.topic,
        momentum,
        diffusion,
        trustLevelSummary: topic.trustLevelSummary,
      };
    }),
  ).catch(() => []);
  const topicSummary: TopicSummary = {
    ...topicSurge,
    trendItems,
    limitations: [...topicSurge.limitations, ...(trendItems.length === 0 ? ['主題趨勢資料不足或不可用'] : [])],
  };
  const linkageItems = await Promise.all(
    topicSurge.topics.slice(0, 3).map(async (topic) => {
      const [linkage, graph] = await Promise.all([
        generateThemeLinkage({ topic: topic.topic, days: 7, minStrength: 'weak', includeSymbols: true }),
        generateSectorRelationGraph({ topic: topic.topic, days: 7, minStrength: 1, includeSymbols: true }),
      ]);
      return { topic: topic.topic, linkage, graph };
    }),
  ).catch(() => []);
  const themeLinkageSummary: ThemeLinkageSummary = {
    summary:
      linkageItems.length === 0
        ? '主題連動資料不足或不可用。'
        : `已分析 ${linkageItems.length} 個主題的連動與產業關聯，僅供研究脈絡觀察。`,
    items: linkageItems,
    limitations: linkageItems.length === 0 ? ['無可用主題連動資料'] : [],
    generatedAt: new Date().toISOString(),
  };
  const crossMarketItems = await Promise.all(
    topicSurge.topics.slice(0, 3).map(async (topic) => {
      const [crossMarket, timeline] = await Promise.all([
        generateCrossMarketTheme({ topic: topic.topic, days: 14, minBreadth: 1 }),
        generateSectorLinkageTimeline({ topic: topic.topic, days: 14, minBreadth: 1 }),
      ]);
      return { topic: topic.topic, crossMarket, timeline, trustLevelSummary: topic.trustLevelSummary };
    }),
  ).catch(() => []);
  const crossMarketSummary: CrossMarketSummary = {
    summary:
      crossMarketItems.length === 0
        ? '主題跨板塊傳導資料不足或不可用。'
        : `已追蹤 ${crossMarketItems.length} 個主題的跨板塊傳導與產業鏈時間序列，僅供研究觀察。`,
    items: crossMarketItems,
    limitations: crossMarketItems.length === 0 ? ['無可用主題跨板塊傳導資料'] : [],
    generatedAt: new Date().toISOString(),
  };

  const marketSummary = buildMarketSummary(regimeResult);
  const eventSummary = {
    ...marketEvent.summary,
    limitations:
      marketEvent.source === 'db'
        ? marketEvent.summary.limitations
        : [...marketEvent.summary.limitations, '目前使用即時來源 fallback，資料穩定性較低'],
  };
  const candidateSummary = buildCandidateSummary(screenResult, candidateLimit);
  const watchlistSummary = buildWatchlistSummary(watchlistData);
  const riskSummary = buildRiskSummary(regimeResult, screenResult, watchlistData);
  const dataStatusSummary = buildDataStatusSummary(regimeResult, screenResult, dbStats);

  // All candidates for comparison (strong + watch + all screen candidates)
  const allCandidateDetails = [
    ...candidateSummary.strongCandidates,
    ...candidateSummary.watchCandidates,
  ];

  const reportDate = new Date().toISOString().split('T')[0];
  const partialReport: DailyReport = {
    reportDate,
    marketSummary,
    eventSummary,
    topicSummary,
    themeLinkageSummary,
    crossMarketSummary,
    signalReliabilitySummary,
    candidateSummary,
    watchlistSummary,
    riskSummary,
    dataStatusSummary,
    comparison: null,
    disclaimer: DISCLAIMER,
    last_updated: new Date().toISOString(),
  };

  // Build comparison from previous snapshot (if available)
  const comparison = await buildComparison(partialReport, allCandidateDetails).catch((): DailyComparison => ({
    comparisonAvailable: false,
    previousSnapshotDate: null,
    market: { available: false, previousDate: null, regimeChanged: false, previousRegime: null, currentRegime: marketSummary.regime, confidenceDelta: null, note: '比較功能暫時無法使用。' },
    candidates: { available: false, previousDate: null, newStrongCandidates: [], removedStrongCandidates: [], bucketUpgrades: [], bucketDowngrades: [], note: '比較功能暫時無法使用。' },
    watchlist: { available: false, previousDate: null, scoreImproved: [], scoreDropped: [], newlyInsufficientData: [], riskEscalated: [], note: '比較功能暫時無法使用。' },
  }));

  return { ...partialReport, comparison };
}

// ─── Market Summary ──────────────────────────────────────────────

function buildMarketSummary(regime: MarketRegimeResult): MarketSummary {
  const summary = generateMarketNarrative(regime);
  return {
    regime: regime.regime,
    regimeConfidence: regime.confidence,
    summary,
    keyFactors: regime.factors.map(f => `${f.name}: ${f.value} (${f.impact})`),
    limitations: regime.limitations,
  };
}

function generateMarketNarrative(regime: MarketRegimeResult): string {
  const conf = regime.confidence;
  const confLabel = conf >= 70 ? '較高' : conf >= 40 ? '中等' : '偏低';

  switch (regime.regime) {
    case 'Bull':
      return `目前市場環境偏多（信心度${confLabel}），趨勢型候選股相對有利，但仍需留意資料覆蓋限制與個股風險。`;
    case 'Bear':
      return `目前市場環境偏空（信心度${confLabel}），建議保守操作，注意停損與倉位控制。`;
    case 'Sideways':
      return `目前市場偏震盪整理（信心度${confLabel}），突破型訊號需搭配量能保守解讀，區間操作可能較適合。`;
    case 'Unknown':
    default:
      return 'MarketIndex 歷史資料不足或無法判斷，市場環境判斷可信度有限，建議保守解讀所有訊號。';
  }
}

// ─── Candidate Summary ───────────────────────────────────────────

function buildCandidateSummary(screen: ScreenResult, limit: number): CandidateSummary {
  const strong = screen.candidates.filter(c => c.screenBucket === 'Strong Candidate');
  const watch = screen.candidates.filter(c => c.screenBucket === 'Watch');
  const neutral = screen.candidates.filter(c => c.screenBucket === 'Neutral');

  const keyReasons = deriveKeyReasons(screen);

  return {
    strongCandidates: strong.slice(0, limit).map(toCandidateDetail),
    watchCandidates: watch.slice(0, limit).map(toCandidateDetail),
    strongCount: strong.length,
    watchCount: watch.length,
    neutralCount: neutral.length,
    excludedCount: screen.excludedCount,
    totalScanned: screen.totalScanned,
    keyReasons,
    limitations: screen.limitations,
  };
}

function toCandidateDetail(c: ScreenCandidate): CandidateDetail {
  return {
    symbol: c.symbol,
    name: c.name,
    alphaScore: c.alphaScore,
    recommendationBucket: c.recommendationBucket,
    confidence: c.confidence,
    marketContext: c.screenBucket,
    whyIncluded: c.whyIncluded,
    topFactors: c.topFactors,
    keyRisks: c.keyRisks,
  };
}

function deriveKeyReasons(screen: ScreenResult): string[] {
  const reasons: string[] = [];
  const strong = screen.candidates.filter(c => c.screenBucket === 'Strong Candidate');

  if (strong.length === 0) {
    reasons.push('目前無達到 Strong Candidate 門檻的候選股');
  } else {
    reasons.push(`${strong.length} 檔股票達到 Strong Candidate 門檻`);
  }

  if (screen.excludedCount > 0) {
    reasons.push(`${screen.excludedCount} 檔因分數不足、資料不足或市場環境濾除`);
  }

  if (screen.regime === 'Bear') {
    reasons.push('市場環境偏空，候選門檻已自動提高');
  } else if (screen.regime === 'Bull') {
    reasons.push('市場環境偏多，候選門檻略為放寬');
  }

  return reasons;
}

// ─── Watchlist Summary ───────────────────────────────────────────

interface RawWatchlistItem {
  stockId: string;
  name?: string;
  currentPrice?: number;
  dailyChange?: number;
  weeklyChange?: number | null;
  volume?: number;
  volumeChange?: number | null;
  hasQuoteData?: boolean;
}

async function fetchWatchlistData(): Promise<RawWatchlistItem[] | null> {
  try {
    const items = await prisma.watchlist.findMany({
      include: { stock: true },
    });
    if (!items.length) return [];

    // Get latest quotes for watchlist stocks
    const stockIds = items.map(i => i.stockId);
    const latestQuotes = await prisma.stockQuote.findMany({
      where: { stockId: { in: stockIds } },
      orderBy: { date: 'desc' },
      distinct: ['stockId'],
    });

    // Get previous day quotes for daily change
    const quoteMap = new Map(latestQuotes.map(q => [q.stockId, q]));

    // Get 5-day-ago quotes for weekly change
    const fiveDaysAgo = latestQuotes.map(q => {
      const d = new Date(q.date);
      d.setDate(d.getDate() - 7);
      return { stockId: q.stockId, date: d.toISOString().split('T')[0] };
    });

    const weekAgoQuotes = await Promise.all(
      fiveDaysAgo.map(async ({ stockId, date }) => {
        const q = await prisma.stockQuote.findFirst({
          where: { stockId, date: { lte: date } },
          orderBy: { date: 'desc' },
        });
        return { stockId, quote: q };
      })
    );
    const weekAgoMap = new Map(weekAgoQuotes.map(w => [w.stockId, w.quote]));

    // Get previous close for daily change
    const prevQuotes = await Promise.all(
      latestQuotes.map(async (lq) => {
        const prev = await prisma.stockQuote.findFirst({
          where: { stockId: lq.stockId, date: { lt: lq.date } },
          orderBy: { date: 'desc' },
        });
        return { stockId: lq.stockId, quote: prev };
      })
    );
    const prevMap = new Map(prevQuotes.map(p => [p.stockId, p.quote]));

    return items.map(item => {
      const latest = quoteMap.get(item.stockId);
      const prev = prevMap.get(item.stockId);
      const weekAgo = weekAgoMap.get(item.stockId);
      const price = latest?.close ?? 0;
      const dailyChange = prev?.close ? ((price - prev.close) / prev.close) * 100 : 0;
      const weeklyChange = weekAgo?.close ? ((price - weekAgo.close) / weekAgo.close) * 100 : null;

      return {
        stockId: item.stockId,
        name: item.stock?.name ?? item.stockId,
        currentPrice: price,
        dailyChange: Math.round(dailyChange * 100) / 100,
        weeklyChange: weeklyChange !== null ? Math.round(weeklyChange * 100) / 100 : null,
        volume: latest?.volume ?? 0,
        volumeChange: null,
        hasQuoteData: !!latest,
      };
    });
  } catch {
    return null;
  }
}

function buildWatchlistSummary(data: RawWatchlistItem[] | null): WatchlistSummary {
  if (data === null) {
    return {
      totalItems: 0,
      withQuoteData: 0,
      topGainers: [],
      topLosers: [],
      insufficientDataItems: [],
      historyTrackingAvailable: false,
      historyNote: 'Watchlist 資料無法取得',
      limitations: ['無法連線 watchlist 資料庫'],
    };
  }

  if (data.length === 0) {
    return {
      totalItems: 0,
      withQuoteData: 0,
      topGainers: [],
      topLosers: [],
      insufficientDataItems: [],
      historyTrackingAvailable: false,
      historyNote: '自選清單目前為空',
      limitations: [],
    };
  }

  const withQuotes = data.filter(d => d.hasQuoteData);
  const sorted = [...withQuotes].sort((a, b) => (b.dailyChange ?? 0) - (a.dailyChange ?? 0));

  const toItem = (d: RawWatchlistItem): WatchlistItem => ({
    symbol: d.stockId,
    name: d.name ?? d.stockId,
    currentPrice: d.currentPrice ?? 0,
    dailyChange: d.dailyChange ?? 0,
    weeklyChange: d.weeklyChange ?? null,
    volume: d.volume ?? 0,
    volumeChange: d.volumeChange ?? null,
    alphaScore: null,
    recommendationBucket: null,
    hasQuoteData: d.hasQuoteData ?? false,
  });

  const noData = data.filter(d => !d.hasQuoteData).map(d => d.stockId);

  return {
    totalItems: data.length,
    withQuoteData: withQuotes.length,
    topGainers: sorted.slice(0, 3).filter(d => (d.dailyChange ?? 0) > 0).map(toItem),
    topLosers: sorted.slice(-3).filter(d => (d.dailyChange ?? 0) < 0).reverse().map(toItem),
    insufficientDataItems: noData,
    historyTrackingAvailable: false,
    historyNote: '尚未建立歷史快照追蹤機制，無法比較昨日 alphaScore 變化。未來版本將支援每日快照比較。',
    limitations: noData.length > 0
      ? [`${noData.length} 檔自選股缺少行情資料`]
      : [],
  };
}

// ─── Risk Summary ────────────────────────────────────────────────

function buildRiskSummary(
  regime: MarketRegimeResult,
  screen: ScreenResult,
  watchlist: RawWatchlistItem[] | null,
): RiskSummary {
  const cautions: string[] = [];
  let riskLevel: RiskSummary['overallRiskLevel'] = 'moderate';
  let dataWarning: string | null = null;

  // Market risk
  switch (regime.regime) {
    case 'Bear':
      riskLevel = 'high';
      cautions.push('市場環境偏空，整體風險較高，建議降低曝險。');
      break;
    case 'Sideways':
      riskLevel = 'moderate';
      cautions.push('市場震盪整理，注意假突破風險。');
      break;
    case 'Bull':
      riskLevel = 'low';
      cautions.push('市場環境偏多，但仍需留意個股風險與反轉訊號。');
      break;
    case 'Unknown':
      riskLevel = 'unknown';
      cautions.push('無法確定市場環境，建議以保守態度解讀所有訊號。');
      break;
  }

  // Confidence risk
  if (regime.confidence < 40) {
    cautions.push(`市場環境信心度偏低 (${regime.confidence}%)，判斷可能不穩定。`);
    if (riskLevel === 'low') riskLevel = 'moderate';
  }

  // Data insufficiency
  if (screen.totalScanned === 0) {
    dataWarning = '候選股掃描無法執行，資料層可能有問題。';
  } else if (screen.limitations.length > 0) {
    dataWarning = `資料覆蓋存在限制：${screen.limitations.slice(0, 2).join('；')}`;
  }

  // Watchlist-specific
  if (watchlist && watchlist.length > 0) {
    const bigDrops = watchlist.filter(w => (w.dailyChange ?? 0) < -3);
    if (bigDrops.length > 0) {
      cautions.push(`自選清單中 ${bigDrops.length} 檔今日跌幅超過 3%，建議留意。`);
      if (riskLevel === 'low') riskLevel = 'moderate';
    }
  }

  const marketContext = regime.regime === 'Unknown'
    ? '市場環境未知'
    : `市場環境: ${regime.regime} (信心度 ${regime.confidence}%)`;

  return {
    overallRiskLevel: riskLevel,
    marketRiskContext: marketContext,
    cautionNotes: cautions,
    dataInsufficiencyWarning: dataWarning,
  };
}

// ─── Data Status Summary ─────────────────────────────────────────

interface DbStats {
  stockQuoteCount: number;
  institutionalChipCount: number;
  monthlyRevenueCount: number;
  marketIndexCount: number;
  watchlistCount: number;
  latestQuoteDate: string | null;
  latestChipDate: string | null;
  latestMarketDate: string | null;
}

async function fetchDataStats(): Promise<DbStats> {
  try {
    const [sqCount, icCount, mrCount, miCount, wlCount, latestSQ, latestIC, latestMI] =
      await Promise.all([
        prisma.stockQuote.count(),
        prisma.institutionalChip.count(),
        prisma.monthlyRevenue.count(),
        prisma.marketIndex.count(),
        prisma.watchlist.count(),
        prisma.stockQuote.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
        prisma.institutionalChip.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
        prisma.marketIndex.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
      ]);

    return {
      stockQuoteCount: sqCount,
      institutionalChipCount: icCount,
      monthlyRevenueCount: mrCount,
      marketIndexCount: miCount,
      watchlistCount: wlCount,
      latestQuoteDate: latestSQ?.date ?? null,
      latestChipDate: latestIC?.date ?? null,
      latestMarketDate: latestMI?.date ?? null,
    };
  } catch {
    return {
      stockQuoteCount: 0,
      institutionalChipCount: 0,
      monthlyRevenueCount: 0,
      marketIndexCount: 0,
      watchlistCount: 0,
      latestQuoteDate: null,
      latestChipDate: null,
      latestMarketDate: null,
    };
  }
}

function buildDataStatusSummary(
  regime: MarketRegimeResult,
  screen: ScreenResult,
  stats: DbStats,
): DataStatusSummary {
  const sources: DataSourceStatus[] = [
    {
      name: '個股行情 (StockQuote)',
      available: stats.stockQuoteCount > 0,
      coverage: stats.stockQuoteCount > 0
        ? `${stats.stockQuoteCount.toLocaleString()} 筆`
        : '無資料',
      lastUpdated: stats.latestQuoteDate,
    },
    {
      name: '法人籌碼 (InstitutionalChip)',
      available: stats.institutionalChipCount > 0,
      coverage: stats.institutionalChipCount > 0
        ? `${stats.institutionalChipCount.toLocaleString()} 筆`
        : '無資料',
      lastUpdated: stats.latestChipDate,
    },
    {
      name: '月營收 (MonthlyRevenue)',
      available: stats.monthlyRevenueCount > 0,
      coverage: stats.monthlyRevenueCount > 0
        ? `${stats.monthlyRevenueCount.toLocaleString()} 筆`
        : '無資料',
      lastUpdated: null,
    },
    {
      name: '大盤指數 (MarketIndex)',
      available: stats.marketIndexCount > 0,
      coverage: stats.marketIndexCount > 0
        ? `${stats.marketIndexCount.toLocaleString()} 筆`
        : '無資料',
      lastUpdated: stats.latestMarketDate,
    },
  ];

  const unavailable = sources.filter(s => !s.available);
  const keyLimitations: string[] = [];

  if (unavailable.length > 0) {
    keyLimitations.push(`${unavailable.map(s => s.name).join('、')} 目前無資料`);
  }
  if (regime.limitations.length > 0) {
    keyLimitations.push(...regime.limitations.slice(0, 2));
  }
  if (screen.limitations.length > 0) {
    keyLimitations.push(...screen.limitations.slice(0, 2));
  }

  const availableCount = sources.filter(s => s.available).length;
  const overallCoverage = availableCount === sources.length
    ? '完整'
    : availableCount >= 2
      ? '部分'
      : '不足';

  return {
    sources,
    overallCoverage,
    keyLimitations: [...new Set(keyLimitations)],
    last_updated: new Date().toISOString(),
  };
}
