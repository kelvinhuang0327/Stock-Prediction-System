"use client";

import React, { useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { GlassCard } from '@/components/ui/glass-card';
import { LoadingSpinner } from '@/components/ui/loading';
import { Disclaimer } from '@/components/ui/disclaimer';
import { RelevantInsightsPanel } from '@/components/relevance/RelevantInsightsPanel';
import { SignalReliabilitySummaryCard } from '@/components/signals/SignalReliabilitySummaryCard';
import type { PortfolioDecisionSupport, PortfolioImpactSnapshotComparison } from '@/types/portfolio';
import type { SignalEffectivenessSummary } from '@/lib/signals/types';
import {
  FileText, TrendingUp, TrendingDown, Shield, Database,
  AlertTriangle, Eye, Star, Minus, ChevronDown, ChevronUp,
  RefreshCw, Activity, Users, ArrowUpRight, ArrowDownRight,
  GitCompare, Camera, Route
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

interface CandidateDetail {
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

interface WatchlistItem {
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

interface DataSourceStatus {
  name: string;
  available: boolean;
  coverage: string;
  lastUpdated: string | null;
}

interface DailyReport {
  reportDate: string;
  marketSummary: {
    regime: string;
    regimeConfidence: number;
    summary: string;
    keyFactors: string[];
    limitations: string[];
  };
  eventSummary: {
    eventCount: number;
    rawCount: number;
    dedupedCount: number;
    recentThemes: string[];
    catalystSummary: string;
    sourceBreakdown: Record<string, number>;
    trustLevelSummary: {
      official: number;
      mainstream: number;
      secondary: number;
      unknown: number;
      dominant: 'official' | 'mainstream' | 'secondary' | 'unknown' | 'mixed';
      note: string;
    };
    recentEventTitles: string[];
    limitations: string[];
    dataCoverage: 'full' | 'limited' | 'insufficient';
  };
  topicSummary: {
    summary: string;
    topics: Array<{
      topic: string;
      recentCount: number;
      previousCount: number;
      delta: number;
      surgeLevel: 'none' | 'watch' | 'surging';
      diffusionLevel: 'single-stock theme' | 'multi-stock theme' | 'broadening theme';
      relatedSymbols: string[];
      trustLevelSummary: string;
      limitations: string[];
    }>;
    trendItems: Array<{
      topic: string;
      momentum: {
        topic: string;
        timeline: Array<{ date: string; count: number }>;
        momentumType: 'spike' | 'rising' | 'stable' | 'cooling' | 'unknown';
        peak: number;
        avg: number;
        recentTrend: number;
        limitations: string[];
      };
      diffusion: {
        topic: string;
        nodes: Array<{ symbol: string; eventCount: number }>;
        breadth: number;
        diffusionType: 'single' | 'cluster' | 'broad';
        sourceDiversity: number;
        limitations: string[];
      };
      trustLevelSummary: string;
    }>;
    limitations: string[];
    generatedAt: string;
  };
  themeLinkageSummary: {
    summary: string;
    items: Array<{
      topic: string;
      linkage: {
        topic: string;
        linkedTopics: Array<{
          topic: string;
          coOccurrence: number;
          overlapSymbols: string[];
          trustLevelSummary: string;
          linkageStrength: 'weak' | 'moderate' | 'strong';
        }>;
        limitations: string[];
      };
      graph: {
        topic: string;
        nodes: Array<{ id: string; type: 'topic' | 'sector' | 'symbol'; label: string; weight: number }>;
        edges: Array<{ source: string; target: string; strength: number; relationType: string }>;
        limitations: string[];
      };
    }>;
    limitations: string[];
    generatedAt: string;
  };
  crossMarketSummary: {
    summary: string;
    items: Array<{
      topic: string;
      crossMarket: {
        topic: string;
        originCluster: { symbols: string[]; sector?: string; firstSeenDate: string };
        spreadClusters: Array<{ symbols: string[]; sector?: string; firstSeenDate: string; spreadDelay: number }>;
        spreadPattern: 'early_cluster' | 'sector_expansion' | 'broad_market' | 'unclear';
        spreadSpeed: 'slow' | 'moderate' | 'fast';
        trustLevelSummary: string;
        limitations: string[];
      };
      timeline: {
        topic: string;
        timeline: Array<{
          date: string;
          sectors: string[];
          symbolCount: number;
          breadth: number;
          linkageStrength: number;
        }>;
        stage: 'early' | 'spreading' | 'mature' | 'fading' | 'unknown';
        trend: 'expanding' | 'stable' | 'contracting';
        limitations: string[];
      };
      trustLevelSummary: string;
    }>;
    limitations: string[];
    generatedAt: string;
  };
  signalReliabilitySummary: SignalEffectivenessSummary;
  candidateSummary: {
    strongCandidates: CandidateDetail[];
    watchCandidates: CandidateDetail[];
    strongCount: number;
    watchCount: number;
    neutralCount: number;
    excludedCount: number;
    totalScanned: number;
    keyReasons: string[];
    limitations: string[];
  };
  watchlistSummary: {
    totalItems: number;
    withQuoteData: number;
    topGainers: WatchlistItem[];
    topLosers: WatchlistItem[];
    insufficientDataItems: string[];
    historyTrackingAvailable: boolean;
    historyNote: string;
    limitations: string[];
  };
  riskSummary: {
    overallRiskLevel: string;
    marketRiskContext: string;
    cautionNotes: string[];
    dataInsufficiencyWarning: string | null;
  };
  dataStatusSummary: {
    sources: DataSourceStatus[];
    overallCoverage: string;
    keyLimitations: string[];
    last_updated: string;
  };
  disclaimer: string;
  last_updated: string;
  comparison: DailyComparison | null;
}

interface DailyComparison {
  comparisonAvailable: boolean;
  previousSnapshotDate: string | null;
  market: {
    available: boolean;
    previousDate: string | null;
    regimeChanged: boolean;
    previousRegime: string | null;
    currentRegime: string;
    confidenceDelta: number | null;
    note: string;
  };
  candidates: {
    available: boolean;
    previousDate: string | null;
    newStrongCandidates: Array<{ symbol: string; name: string; alphaScore: number }>;
    removedStrongCandidates: Array<{ symbol: string; name: string; previousAlpha: number }>;
    bucketUpgrades: Array<{ symbol: string; name: string; previousBucket: string; currentBucket: string; alphaDelta: number }>;
    bucketDowngrades: Array<{ symbol: string; name: string; previousBucket: string; currentBucket: string; alphaDelta: number }>;
    note: string;
  };
  watchlist: {
    available: boolean;
    previousDate: string | null;
    scoreImproved: Array<{ symbol: string; name: string; previousAlpha: number | null; currentAlpha: number | null; alphaDelta: number | null }>;
    scoreDropped: Array<{ symbol: string; name: string; previousAlpha: number | null; currentAlpha: number | null; alphaDelta: number | null }>;
    newlyInsufficientData: string[];
    riskEscalated: Array<{ symbol: string; name: string; previousRisk: string; currentRisk: string }>;
    note: string;
  };
}

interface PortfolioSnapshotApiResponse {
  scope: 'watchlist' | 'candidates';
  compareWindow: '1d' | '7d' | '30d';
  snapshot: PortfolioDecisionSupport & { snapshotDate: string; scope: 'watchlist' | 'candidates'; symbols: string[] };
  comparison: PortfolioImpactSnapshotComparison;
  limitations?: string[];
  generatedAt: string;
}

// ─── Styles ──────────────────────────────────────────────────────

const REGIME_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  Bull: { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', icon: <TrendingUp className="h-4 w-4" /> },
  Bear: { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-400', icon: <TrendingDown className="h-4 w-4" /> },
  Sideways: { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', icon: <Minus className="h-4 w-4" /> },
  Unknown: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: <AlertTriangle className="h-4 w-4" /> },
};

const RISK_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-400', label: '低風險' },
  moderate: { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', label: '中等風險' },
  elevated: { bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', label: '較高風險' },
  high: { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', label: '高風險' },
  unknown: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: '未知' },
};

// ─── Page ────────────────────────────────────────────────────────

export default function DailyReportPage() {
  const { data: report, loading, error, refetch } = useApiData<DailyReport>('/api/report/daily');
  const { data: portfolioObservation } = useApiData<PortfolioSnapshotApiResponse>('/api/portfolio/impact-snapshot?scope=watchlist&comparison=true&compareWindow=1d', { refetchInterval: 180000 });
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);

  const createSnapshot = async () => {
    setSnapshotLoading(true);
    setSnapshotMsg(null);
    try {
      const res = await fetch('/api/report/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: false }),
      });
      const data = await res.json();
      if (data.success) {
        setSnapshotMsg(`快照已建立 (${data.snapshotDate})：市場 ${data.marketCreated ? '✓' : '—'}、候選 ${data.candidatesCreated} 筆、自選 ${data.watchlistCreated} 筆`);
        refetch();
      } else {
        setSnapshotMsg(`快照建立失敗：${data.limitations?.join('；') ?? '未知錯誤'}`);
      }
    } catch {
      setSnapshotMsg('快照建立失敗：網路錯誤');
    } finally {
      setSnapshotLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
          <span className="ml-3 text-muted-foreground">正在產生每日研究報告...</span>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="container mx-auto px-4 py-8">
        <GlassCard className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <h2 className="text-xl font-bold mb-2">報告產生失敗</h2>
          <p className="text-muted-foreground mb-4">{error ?? '無法取得每日報告資料'}</p>
          <button onClick={refetch} className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            <RefreshCw className="h-4 w-4 inline mr-2" />重試
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            每日研究報告
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {report.reportDate} · 自動產生 · 僅供研究參考
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button onClick={createSnapshot} disabled={snapshotLoading} className="px-3 py-1.5 rounded-lg text-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors flex items-center gap-1 disabled:opacity-50">
            <Camera className="h-3.5 w-3.5" />{snapshotLoading ? '建立中...' : '建立快照'}
          </button>
          <button onClick={refetch} className="px-3 py-1.5 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1">
            <RefreshCw className="h-3.5 w-3.5" />更新報告
          </button>
        </div>
      </div>

      {/* Snapshot message */}
      {snapshotMsg && (
        <div className="text-sm px-4 py-2 rounded-lg bg-muted/30 border border-border/30">
          {snapshotMsg}
        </div>
      )}

      {/* Market Summary Card */}
      <MarketSummaryCard data={report.marketSummary} />

      {/* Multi-Agent Market Viewpoints */}
      <MultiAgentMarketPanel marketSummary={report.marketSummary} eventSummary={report.eventSummary} />

      <RelevantInsightsPanel
        mode="report"
        maxItems={5}
        title="今日最值得關注"
        description="依研究層 relevance 排序今日較值得先看的 signal、topic、portfolio 與 risk 線索，不構成交易建議。"
      />

      {/* Market Event Summary */}
      <div id="daily-market-events">
        <MarketEventSummaryCard data={report.eventSummary} />
      </div>
      <div id="daily-topic-surge">
        <TopicSurgeCard data={report.topicSummary} />
      </div>
      <ThemeLinkageCard data={report.themeLinkageSummary} />
      <CrossMarketCard data={report.crossMarketSummary} />
      <div id="daily-signal-reliability">
        <SignalReliabilitySummaryCard summary={report.signalReliabilitySummary} />
      </div>
      <PortfolioObservationCard data={portfolioObservation} />

      {/* Candidate Summary Card */}
      <CandidateSummaryCard data={report.candidateSummary} />

      {/* Watchlist Summary Card */}
      <WatchlistSummaryCard data={report.watchlistSummary} />

      {/* Comparison Cards */}
      <ComparisonSection comparison={report.comparison} />

      {/* Risk Summary Card */}
      <RiskSummaryCard data={report.riskSummary} />

      {/* Data Status Card */}
      <DataStatusCard data={report.dataStatusSummary} />

      {/* Disclaimer */}
      <Disclaimer warning={report.disclaimer} variant="detailed" source="MarketRegimeEngine + StrategyScreenEngine + SignalFusionEngine + NewsEvent + TopicSurgeEngine" methodology="規則式分析引擎綜合評分，非 AI 黑盒模型" />

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        報告產生時間: {new Date(report.last_updated).toLocaleString('zh-TW')}
      </p>
    </div>
  );
}

function PortfolioObservationCard({ data }: { data: PortfolioSnapshotApiResponse | null }) {
  if (!data) return null;
  const snapshot = data.snapshot;
  return (
    <GlassCard id="daily-portfolio-observation" className="p-5 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <GitCompare className="h-4 w-4 text-primary" />
        組合觀察（研究）
      </h3>
      <p className="text-xs text-muted-foreground">{snapshot.summary}</p>
      <p className="text-[11px] text-muted-foreground">
        {data.comparison.summaryNote}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div className="rounded-lg border border-border/40 p-3">
          <div className="text-muted-foreground">主題集中度</div>
          <div className="font-semibold mt-1">{snapshot.themeConcentration.concentrationLevel}</div>
          <div className="text-muted-foreground mt-1">{snapshot.themeConcentration.topThemes[0]?.theme ?? 'insufficient'}</div>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <div className="text-muted-foreground">產業分布</div>
          <div className="font-semibold mt-1">{snapshot.sectorConcentration.concentrationLevel}</div>
          <div className="text-muted-foreground mt-1">{snapshot.sectorConcentration.sectors[0]?.sector ?? 'unknown'}</div>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <div className="text-muted-foreground">風險提示</div>
          <div className="font-semibold mt-1">{snapshot.riskClusters.overallRiskLevel}</div>
          <div className="text-muted-foreground mt-1">{snapshot.riskClusters.clusters[0]?.reason ?? '無顯著群聚'}</div>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <div className="text-muted-foreground">市場曝險</div>
          <div className="font-semibold mt-1">{snapshot.regimeExposure.sensitivity}</div>
          <div className="text-muted-foreground mt-1">{snapshot.regimeExposure.regime} / {snapshot.regimeExposure.confidence}%</div>
        </div>
      </div>
      {snapshot.limitations.length > 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          限制：{snapshot.limitations.slice(0, 2).join('；')}
        </p>
      )}
    </GlassCard>
  );
}

// ─── Market Summary Card ─────────────────────────────────────────

function MarketSummaryCard({ data }: { data: DailyReport['marketSummary'] }) {
  const style = REGIME_STYLE[data.regime] ?? REGIME_STYLE.Unknown;

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">市場環境摘要</h2>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
          {style.icon}
          {data.regime}
          <span className="opacity-70">· 信心度 {data.regimeConfidence}%</span>
        </div>
      </div>

      <p className="text-sm leading-relaxed mb-4">{data.summary}</p>

      {data.keyFactors.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs font-medium text-muted-foreground mb-2">關鍵因子</h3>
          <div className="flex flex-wrap gap-2">
            {data.keyFactors.map((f, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded bg-muted/50">{f}</span>
            ))}
          </div>
        </div>
      )}

      {data.limitations.length > 0 && (
        <LimitationsList items={data.limitations} />
      )}
    </GlassCard>
  );
}

function MarketEventSummaryCard({ data }: { data: DailyReport['eventSummary'] }) {
  const hasEvents = data.eventCount > 0;
  const coverageClass =
    data.dataCoverage === 'full'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
      : data.dataCoverage === 'limited'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">市場熱點 / 事件摘要</h2>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${coverageClass}`}>
          {data.dataCoverage === 'full' ? '事件覆蓋較完整' : data.dataCoverage === 'limited' ? '事件覆蓋有限' : '事件資料不足'}
        </span>
      </div>

      {!hasEvents ? (
        <p className="text-sm text-muted-foreground">目前事件資料不足，暫無可用市場熱點摘要。</p>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            事件數量：{data.eventCount}（原始 {data.rawCount}，去重 {data.dedupedCount} 筆）
          </div>
          <p className="text-sm leading-relaxed">{data.catalystSummary}</p>
          {data.recentThemes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.recentThemes.slice(0, 5).map((theme) => (
                <span key={theme} className="text-xs px-2 py-0.5 rounded bg-muted/40">
                  #{theme}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            來源可信度：official {data.trustLevelSummary.official}、mainstream {data.trustLevelSummary.mainstream}、
            secondary {data.trustLevelSummary.secondary}、unknown {data.trustLevelSummary.unknown}（{data.trustLevelSummary.note}）
          </p>
        </div>
      )}

      {data.limitations.length > 0 && <LimitationsList items={data.limitations} />}
    </GlassCard>
  );
}

function TopicSurgeCard({ data }: { data: DailyReport['topicSummary'] }) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">主題趨勢觀察</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{data.summary}</p>
      {data.topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">目前無明確主題升溫結果（或資料不足）。</p>
      ) : (
        <div className="space-y-2">
          {data.topics.slice(0, 5).map((topic) => {
            const trend = data.trendItems.find((t) => t.topic === topic.topic);
            return (
            <div key={topic.topic} className="rounded-lg border border-border/30 p-3 bg-muted/10">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{topic.topic}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  topic.surgeLevel === 'surging'
                    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}>
                  {topic.surgeLevel}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">
                  {topic.diffusionLevel}
                </span>
                {trend && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {trend.momentum.momentumType}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                次數：{topic.previousCount} → {topic.recentCount}（Δ {topic.delta >= 0 ? '+' : ''}{topic.delta}）
                · 相關股票 {topic.relatedSymbols.length} 檔
              </p>
              <p className="text-xs text-muted-foreground mt-1">{topic.trustLevelSummary}</p>
              {trend && trend.momentum.timeline.length > 0 && (
                <div className="mt-2 flex items-end gap-1 h-8">
                  {trend.momentum.timeline.slice(-7).map((p) => (
                    <div key={p.date} className="flex-1 bg-primary/15 rounded-sm overflow-hidden">
                      <div
                        className="bg-primary/50 w-full"
                        style={{ height: `${Math.max(8, Math.min(100, (p.count / Math.max(1, trend.momentum.peak)) * 100))}%` }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {trend && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  擴散 breadth {trend.diffusion.breadth}（{trend.diffusion.diffusionType}）· source diversity {trend.diffusion.sourceDiversity}
                </p>
              )}
            </div>
            );
          })}
        </div>
      )}
      {data.limitations.length > 0 && <LimitationsList items={data.limitations} />}
    </GlassCard>
  );
}

function ThemeLinkageCard({ data }: { data: DailyReport['themeLinkageSummary'] }) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <GitCompare className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">主題連動觀察</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{data.summary}</p>
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">目前無可用主題連動資料。</p>
      ) : (
        <div className="space-y-3">
          {data.items.slice(0, 3).map((item) => (
            <div key={item.topic} className="rounded-lg border border-border/30 p-3 bg-muted/10">
              <p className="text-sm font-medium mb-1">{item.topic}</p>
              {item.linkage.linkedTopics.length === 0 ? (
                <p className="text-xs text-muted-foreground">無明確 linked topics。</p>
              ) : (
                <div className="space-y-1">
                  {item.linkage.linkedTopics.slice(0, 4).map((linked) => (
                    <div key={linked.topic} className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground/80">{linked.topic}</span>
                      <span className={`px-1.5 py-0.5 rounded ${
                        linked.linkageStrength === 'strong'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          : linked.linkageStrength === 'moderate'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {linked.linkageStrength}
                      </span>
                      <span>co={linked.coOccurrence}</span>
                      <span>symbols={linked.overlapSymbols.length}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">
                graph: nodes {item.graph.nodes.length} / edges {item.graph.edges.length}
              </p>
            </div>
          ))}
        </div>
      )}
      {data.limitations.length > 0 && <LimitationsList items={data.limitations} />}
    </GlassCard>
  );
}

function CrossMarketCard({ data }: { data: DailyReport['crossMarketSummary'] }) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <Route className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">主題跨板塊傳導</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{data.summary}</p>
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">目前無可用主題傳導資料。</p>
      ) : (
        <div className="space-y-3">
          {data.items.slice(0, 3).map((item) => {
            const peakSectors = Math.max(0, ...item.timeline.timeline.map((p) => p.sectors.length));
            const peakBreadth = Math.max(0, ...item.timeline.timeline.map((p) => p.breadth));
            return (
              <div key={item.topic} className="rounded-lg border border-border/30 p-3 bg-muted/10">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{item.topic}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {item.crossMarket.spreadPattern}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">
                    {item.crossMarket.spreadSpeed}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">
                    {item.timeline.stage}/{item.timeline.trend}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  origin {item.crossMarket.originCluster.sector ?? 'symbol-only'}（{item.crossMarket.originCluster.symbols.length} 檔）
                  · 擴散群 {item.crossMarket.spreadClusters.length} · 涉及 sector 峰值 {peakSectors} · breadth 峰值 {peakBreadth}
                </p>
                {item.timeline.timeline.length > 0 && (
                  <div className="mt-2 flex items-end gap-1 h-8">
                    {item.timeline.timeline.slice(-7).map((p) => {
                      const peak = Math.max(1, ...item.timeline.timeline.map((n) => n.breadth));
                      return (
                        <div key={p.date} className="flex-1 bg-primary/15 rounded-sm overflow-hidden">
                          <div
                            className="bg-primary/50 w-full"
                            style={{ height: `${Math.max(8, Math.min(100, (p.breadth / peak) * 100))}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">{item.crossMarket.trustLevelSummary}</p>
              </div>
            );
          })}
        </div>
      )}
      {data.limitations.length > 0 && <LimitationsList items={data.limitations} />}
    </GlassCard>
  );
}

// ─── Candidate Summary Card ──────────────────────────────────────

function CandidateSummaryCard({ data }: { data: DailyReport['candidateSummary'] }) {
  const [expandedSection, setExpandedSection] = useState<'strong' | 'watch' | null>(null);

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">候選股摘要</h2>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <StatBox label="掃描" value={data.totalScanned} />
        <StatBox label="Strong" value={data.strongCount} highlight="red" />
        <StatBox label="Watch" value={data.watchCount} highlight="amber" />
        <StatBox label="Neutral" value={data.neutralCount} />
        <StatBox label="排除" value={data.excludedCount} muted />
      </div>

      {/* Key reasons */}
      {data.keyReasons.length > 0 && (
        <div className="mb-4 text-sm space-y-1">
          {data.keyReasons.map((r, i) => (
            <p key={i} className="text-muted-foreground">• {r}</p>
          ))}
        </div>
      )}

      {/* Strong Candidates */}
      <CandidateSection
        title="強勢候選"
        icon={<TrendingUp className="h-4 w-4 text-red-500" />}
        candidates={data.strongCandidates}
        totalCount={data.strongCount}
        expanded={expandedSection === 'strong'}
        onToggle={() => setExpandedSection(expandedSection === 'strong' ? null : 'strong')}
        accentColor="red"
      />

      {/* Watch Candidates */}
      <CandidateSection
        title="值得觀察"
        icon={<Eye className="h-4 w-4 text-amber-500" />}
        candidates={data.watchCandidates}
        totalCount={data.watchCount}
        expanded={expandedSection === 'watch'}
        onToggle={() => setExpandedSection(expandedSection === 'watch' ? null : 'watch')}
        accentColor="amber"
      />

      {data.limitations.length > 0 && (
        <LimitationsList items={data.limitations} />
      )}
    </GlassCard>
  );
}

function CandidateSection({ title, icon, candidates, totalCount, expanded, onToggle, accentColor }: {
  title: string;
  icon: React.ReactNode;
  candidates: CandidateDetail[];
  totalCount: number;
  expanded: boolean;
  onToggle: () => void;
  accentColor: string;
}) {
  if (totalCount === 0) {
    return (
      <div className="py-3 border-t border-border/30 text-sm text-muted-foreground">
        {icon} <span className="ml-1">{title}：無</span>
      </div>
    );
  }

  return (
    <div className="py-3 border-t border-border/30">
      <button onClick={onToggle} className="w-full flex items-center justify-between text-sm font-medium hover:text-primary transition-colors">
        <span className="flex items-center gap-2">
          {icon} {title} ({totalCount})
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {candidates.map((c) => (
            <CandidateRow key={c.symbol} candidate={c} accentColor={accentColor} />
          ))}
          {totalCount > candidates.length && (
            <p className="text-xs text-muted-foreground">
              …以及其他 {totalCount - candidates.length} 檔（見 Rankings 頁完整列表）
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateRow({ candidate: c, accentColor }: { candidate: CandidateDetail; accentColor: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border/20">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-sm">{c.symbol}</span>
          <span className="text-xs text-muted-foreground">{c.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full bg-${accentColor}-100 text-${accentColor}-700 dark:bg-${accentColor}-950/40 dark:text-${accentColor}-400 font-medium`}>
            α {c.alphaScore.toFixed(0)}
          </span>
          <span className="text-xs text-muted-foreground">
            信心 {c.confidence}%
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-1">{c.whyIncluded}</p>
      {c.topFactors.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {c.topFactors.slice(0, 3).map((f, i) => (
            <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-primary/5 text-primary/70">✓ {f}</span>
          ))}
        </div>
      )}
      {c.keyRisks.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.keyRisks.slice(0, 2).map((r, i) => (
            <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">⚠ {r}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Watchlist Summary Card ──────────────────────────────────────

function WatchlistSummaryCard({ data }: { data: DailyReport['watchlistSummary'] }) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">自選清單摘要</h2>
      </div>

      {data.totalItems === 0 ? (
        <p className="text-sm text-muted-foreground">自選清單目前為空，請先在 Watchlist 頁面加入股票。</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <StatBox label="追蹤數" value={data.totalItems} />
            <StatBox label="有行情" value={data.withQuoteData} />
            <StatBox label="缺資料" value={data.insufficientDataItems.length} muted />
          </div>

          {/* Top Gainers */}
          {data.topGainers.length > 0 && (
            <div className="mb-3">
              <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-red-500" /> 今日漲幅前列
              </h3>
              <div className="space-y-1">
                {data.topGainers.map(item => (
                  <WatchlistRow key={item.symbol} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Top Losers */}
          {data.topLosers.length > 0 && (
            <div className="mb-3">
              <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-green-500" /> 今日跌幅前列
              </h3>
              <div className="space-y-1">
                {data.topLosers.map(item => (
                  <WatchlistRow key={item.symbol} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* History note */}
          <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            {data.historyNote}
          </p>
        </>
      )}

      {data.limitations.length > 0 && (
        <LimitationsList items={data.limitations} />
      )}
    </GlassCard>
  );
}

function WatchlistRow({ item }: { item: WatchlistItem }) {
  const isUp = item.dailyChange > 0;
  const color = isUp ? 'text-red-500' : item.dailyChange < 0 ? 'text-green-500' : 'text-muted-foreground';

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/20">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{item.symbol}</span>
        <span className="text-xs text-muted-foreground">{item.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm">{item.currentPrice.toFixed(2)}</span>
        <span className={`text-sm font-medium ${color}`}>
          {isUp ? '+' : ''}{item.dailyChange.toFixed(2)}%
        </span>
        {item.weeklyChange !== null && (
          <span className="text-xs text-muted-foreground">
            週 {item.weeklyChange > 0 ? '+' : ''}{item.weeklyChange.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Risk Summary Card ───────────────────────────────────────────

function RiskSummaryCard({ data }: { data: DailyReport['riskSummary'] }) {
  const style = RISK_STYLE[data.overallRiskLevel] ?? RISK_STYLE.unknown;

  return (
    <GlassCard id="daily-risk-summary" className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">風險提醒</h2>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
          <AlertTriangle className="h-3.5 w-3.5" />
          {style.label}
        </span>
        <span className="text-sm text-muted-foreground">{data.marketRiskContext}</span>
      </div>

      {data.cautionNotes.length > 0 && (
        <div className="space-y-2 mb-3">
          {data.cautionNotes.map((note, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      {data.dataInsufficiencyWarning && (
        <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30">
          <Database className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
          <span className="text-amber-700 dark:text-amber-300">{data.dataInsufficiencyWarning}</span>
        </div>
      )}
    </GlassCard>
  );
}

// ─── Data Status Card ────────────────────────────────────────────

function DataStatusCard({ data }: { data: DailyReport['dataStatusSummary'] }) {
  const [expanded, setExpanded] = useState(false);
  const coverageColor = data.overallCoverage === '完整'
    ? 'text-green-600 dark:text-green-400'
    : data.overallCoverage === '部分'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <GlassCard className="p-6">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">資料狀態</h2>
          <span className={`text-sm font-medium ${coverageColor}`}>({data.overallCoverage})</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {data.sources.map((src) => (
            <div key={src.name} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${src.available ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">{src.name}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{src.coverage}</span>
                {src.lastUpdated && <span>最新: {src.lastUpdated}</span>}
              </div>
            </div>
          ))}

          {data.keyLimitations.length > 0 && (
            <LimitationsList items={data.keyLimitations} />
          )}
        </div>
      )}
    </GlassCard>
  );
}

// ─── Shared Components ───────────────────────────────────────────

function StatBox({ label, value, highlight, muted }: {
  label: string;
  value: number;
  highlight?: 'red' | 'amber';
  muted?: boolean;
}) {
  const valueColor = highlight === 'red'
    ? 'text-red-600 dark:text-red-400'
    : highlight === 'amber'
      ? 'text-amber-600 dark:text-amber-400'
      : muted
        ? 'text-muted-foreground'
        : '';

  return (
    <div className="text-center p-2 rounded-lg bg-muted/30">
      <div className={`text-xl font-bold ${valueColor}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function LimitationsList({ items }: { items: string[] }) {
  return (
    <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/20">
      <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> 資料限制
      </h4>
      <ul className="text-xs text-muted-foreground space-y-0.5">
        {items.map((item, i) => (
          <li key={i}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

// ─── Comparison Section ──────────────────────────────────────────

function ComparisonSection({ comparison }: { comparison: DailyComparison | null }) {
  if (!comparison || !comparison.comparisonAvailable) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <GitCompare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">歷史比較</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {comparison?.market?.note ?? '尚未建立每日快照，無法進行歷史比較。請點擊「建立快照」保存今日資料，下次報告即可比較。'}
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GitCompare className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">
          歷史比較 <span className="text-sm font-normal text-muted-foreground">vs {comparison.previousSnapshotDate}</span>
        </h2>
      </div>

      <MarketComparisonCard data={comparison.market} />
      <CandidateComparisonCard data={comparison.candidates} />
      <WatchlistComparisonCard data={comparison.watchlist} />
    </div>
  );
}

function MarketComparisonCard({ data }: { data: DailyComparison['market'] }) {
  if (!data.available) return null;

  return (
    <GlassCard className="p-4">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
        <Activity className="h-4 w-4 text-primary" /> 市場環境變化
      </h3>
      <p className="text-sm mb-2">{data.note}</p>
      <div className="flex flex-wrap gap-3 text-xs">
        {data.regimeChanged && (
          <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
            環境轉換: {data.previousRegime} → {data.currentRegime}
          </span>
        )}
        {data.confidenceDelta !== null && Math.abs(data.confidenceDelta) >= 5 && (
          <span className={`px-2 py-1 rounded ${data.confidenceDelta > 0 ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'}`}>
            信心度 {data.confidenceDelta > 0 ? '+' : ''}{data.confidenceDelta.toFixed(0)}%
          </span>
        )}
      </div>
    </GlassCard>
  );
}

function CandidateComparisonCard({ data }: { data: DailyComparison['candidates'] }) {
  if (!data.available) return null;

  const hasChanges = data.newStrongCandidates.length > 0 || data.removedStrongCandidates.length > 0 ||
    data.bucketUpgrades.length > 0 || data.bucketDowngrades.length > 0;

  return (
    <GlassCard className="p-4">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
        <Star className="h-4 w-4 text-primary" /> 候選池變化
      </h3>
      <p className="text-sm mb-2">{data.note}</p>

      {hasChanges && (
        <div className="space-y-2">
          {data.newStrongCandidates.length > 0 && (
            <div>
              <span className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1 mb-1">
                <ArrowUpRight className="h-3 w-3" /> 新進 Strong Candidate
              </span>
              <div className="flex flex-wrap gap-1">
                {data.newStrongCandidates.map(c => (
                  <span key={c.symbol} className="text-xs px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
                    {c.symbol} {c.name} (α{c.alphaScore.toFixed(0)})
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.removedStrongCandidates.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                <ArrowDownRight className="h-3 w-3" /> 離開 Strong Candidate
              </span>
              <div className="flex flex-wrap gap-1">
                {data.removedStrongCandidates.map(c => (
                  <span key={c.symbol} className="text-xs px-2 py-0.5 rounded bg-muted/50">
                    {c.symbol} {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.bucketUpgrades.length > 0 && (
            <div>
              <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1 mb-1">
                <ArrowUpRight className="h-3 w-3" /> Bucket 升級
              </span>
              <div className="flex flex-wrap gap-1">
                {data.bucketUpgrades.map(c => (
                  <span key={c.symbol} className="text-xs px-2 py-0.5 rounded bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
                    {c.symbol} {c.name}: {c.previousBucket} → {c.currentBucket}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.bucketDowngrades.length > 0 && (
            <div>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-1">
                <ArrowDownRight className="h-3 w-3" /> Bucket 降級
              </span>
              <div className="flex flex-wrap gap-1">
                {data.bucketDowngrades.map(c => (
                  <span key={c.symbol} className="text-xs px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
                    {c.symbol} {c.name}: {c.previousBucket} → {c.currentBucket}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

function WatchlistComparisonCard({ data }: { data: DailyComparison['watchlist'] }) {
  if (!data.available) return null;

  const hasChanges = data.scoreImproved.length > 0 || data.scoreDropped.length > 0 ||
    data.newlyInsufficientData.length > 0 || data.riskEscalated.length > 0;

  return (
    <GlassCard className="p-4">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
        <Users className="h-4 w-4 text-primary" /> 自選清單變化
      </h3>
      <p className="text-sm mb-2">{data.note}</p>

      {hasChanges && (
        <div className="space-y-2">
          {data.scoreImproved.length > 0 && (
            <div>
              <span className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1 mb-1">
                <ArrowUpRight className="h-3 w-3" /> 分數改善 (≥5分)
              </span>
              <div className="flex flex-wrap gap-1">
                {data.scoreImproved.map(c => (
                  <span key={c.symbol} className="text-xs px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
                    {c.symbol} {c.name} {c.alphaDelta !== null ? `(${c.alphaDelta > 0 ? '+' : ''}${c.alphaDelta.toFixed(0)})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.scoreDropped.length > 0 && (
            <div>
              <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1 mb-1">
                <ArrowDownRight className="h-3 w-3" /> 分數下滑 (≥5分)
              </span>
              <div className="flex flex-wrap gap-1">
                {data.scoreDropped.map(c => (
                  <span key={c.symbol} className="text-xs px-2 py-0.5 rounded bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
                    {c.symbol} {c.name} ({c.alphaDelta !== null ? c.alphaDelta.toFixed(0) : '?'})
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.riskEscalated.length > 0 && (
            <div>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-1">
                <AlertTriangle className="h-3 w-3" /> 風險升高
              </span>
              <div className="flex flex-wrap gap-1">
                {data.riskEscalated.map(c => (
                  <span key={c.symbol} className="text-xs px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
                    {c.symbol} {c.name}: {c.previousRisk} → {c.currentRisk}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.newlyInsufficientData.length > 0 && (
            <div className="text-xs text-muted-foreground">
              新增資料不足：{data.newlyInsufficientData.join('、')}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

// ─── Multi-Agent Market Panel ─────────────────────────────────────

type AgentStance2 = 'Bullish' | 'Neutral' | 'Bearish' | 'Insufficient';
type Consensus2 = 'Positive' | 'Mixed' | 'Negative' | 'Insufficient';

interface AgentView2 {
  name: string;
  stance: AgentStance2;
  confidence: number;
  rationale: string;
  limitations: string[];
  missingSources: string[];
}

interface ResearchResult2 {
  consensus: Consensus2;
  consensusConfidence: number;
  viewpoints: AgentView2[];
  disagreementPoints: string[];
  keyRisks: string[];
  scenarioNotes: string[];
  limitations: string[];
  disclaimer: string;
}

const CONSENSUS_STYLE2: Record<Consensus2, { bg: string; text: string; label: string }> = {
  Positive:     { bg: 'bg-red-100 dark:bg-red-950/40',    text: 'text-red-700 dark:text-red-400',    label: '多數偏多' },
  Negative:     { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-400', label: '多數偏空' },
  Mixed:        { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', label: '觀點分歧' },
  Insufficient: { bg: 'bg-gray-100 dark:bg-gray-800',      text: 'text-gray-600 dark:text-gray-400',  label: '資料不足' },
};

const AGENT_DISPLAY2: Record<string, string> = {
  TechnicalAgent:   '技術面',
  MarketAgent:      '市場環境',
  ChipAgent:        '籌碼面',
  FundamentalAgent: '基本面',
  CatalystAgent:    '催化因子',
  RiskAgent:        '風險代理人',
};

const STANCE_LABEL2: Record<AgentStance2, { label: string; cls: string }> = {
  Bullish:      { label: '偏多', cls: 'text-red-600 dark:text-red-400' },
  Neutral:      { label: '中性', cls: 'text-amber-600 dark:text-amber-300' },
  Bearish:      { label: '偏空', cls: 'text-green-600 dark:text-green-400' },
  Insufficient: { label: '資料不足', cls: 'text-gray-500 dark:text-gray-400' },
};

function MultiAgentMarketPanel({
  marketSummary,
  eventSummary,
}: {
  marketSummary: DailyReport['marketSummary'];
  eventSummary: DailyReport['eventSummary'];
}) {
  const [result, setResult] = React.useState<ResearchResult2 | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (result || loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/research/multi-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketRegime: marketSummary.regime,
          regimeConfidence: marketSummary.regimeConfidence,
          alphaScore: 50,
          bucket: 'Neutral',
          confidence: marketSummary.regimeConfidence,
          dataCoverage: marketSummary.limitations.length === 0 ? 'full' : 'limited',
          technicalScore: 50,
          chipScore: 50,
          fundamentalScore: 50,
          marketAdjustment: 0,
          usedSources: ['market_index'],
          missingSources: ['chip_data', 'revenue_data'],
          eventCount: eventSummary.eventCount,
          eventTrustLevelSummary: eventSummary.trustLevelSummary,
          recentThemes: eventSummary.recentThemes,
          catalystSummary: eventSummary.catalystSummary,
          limitations: marketSummary.limitations,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ResearchResult2 = await res.json();
      setResult(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '無法載入多 Agent 市場觀點');
    } finally {
      setLoading(false);
    }
  }, [marketSummary, eventSummary, result, loading]);

  const toggle = () => {
    setOpen((v) => !v);
    if (!open) load();
  };

  const cs = result ? (CONSENSUS_STYLE2[result.consensus] ?? CONSENSUS_STYLE2.Insufficient) : null;

  return (
    <GlassCard className="p-5">
      <button className="w-full flex items-center justify-between" onClick={toggle}>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">多 Agent 市場觀點</h2>
          <span className="text-xs text-muted-foreground">（模型推估，非交易建議）</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-muted-foreground">載入中...</span>}
          {result && cs && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cs.bg} ${cs.text}`}>
              {cs.label} · 置信度 {result.consensusConfidence}%
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {err && <p className="text-sm text-amber-600 dark:text-amber-400">⚠ {err}</p>}
          {loading && <p className="text-sm text-muted-foreground">分析中，請稍候...</p>}
          {result && (
            <>
              {result.scenarioNotes.length > 0 && (
                <div className="space-y-1">
                  {result.scenarioNotes.map((n, i) => (
                    <p key={i} className="text-sm text-muted-foreground">{n}</p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {result.viewpoints.map((v) => {
                  const sl = STANCE_LABEL2[v.stance];
                  return (
                    <div key={v.name} className="text-center p-2 rounded-lg bg-muted/20 border border-border/20">
                      <div className="text-xs text-muted-foreground">{AGENT_DISPLAY2[v.name] ?? v.name}</div>
                      <div className={`text-xs font-medium mt-1 ${sl.cls}`}>{sl.label}</div>
                    </div>
                  );
                })}
              </div>

              {result.keyRisks.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">主要市場風險</h5>
                  <ul className="space-y-0.5">
                    {result.keyRisks.slice(0, 3).map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                        <span className="text-amber-500 shrink-0">⚠</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-muted-foreground/60 italic border-t border-border/20 pt-2">
                {result.disclaimer}
              </p>
            </>
          )}
        </div>
      )}
    </GlassCard>
  );
}
