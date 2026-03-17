"use client";

import React, { useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { GlassCard } from '@/components/ui/glass-card';
import { LoadingSpinner } from '@/components/ui/loading';
import { Disclaimer } from '@/components/ui/disclaimer';
import {
  FileText, TrendingUp, TrendingDown, Shield, Database,
  AlertTriangle, Eye, Star, Minus, ChevronDown, ChevronUp,
  RefreshCw, Activity, Users
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
        <button onClick={refetch} className="self-start px-3 py-1.5 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1">
          <RefreshCw className="h-3.5 w-3.5" />更新報告
        </button>
      </div>

      {/* Market Summary Card */}
      <MarketSummaryCard data={report.marketSummary} />

      {/* Candidate Summary Card */}
      <CandidateSummaryCard data={report.candidateSummary} />

      {/* Watchlist Summary Card */}
      <WatchlistSummaryCard data={report.watchlistSummary} />

      {/* Risk Summary Card */}
      <RiskSummaryCard data={report.riskSummary} />

      {/* Data Status Card */}
      <DataStatusCard data={report.dataStatusSummary} />

      {/* Disclaimer */}
      <Disclaimer warning={report.disclaimer} variant="detailed" source="MarketRegimeEngine + StrategyScreenEngine + SignalFusionEngine + Watchlist DB" methodology="規則式分析引擎綜合評分，非 AI 黑盒模型" />

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        報告產生時間: {new Date(report.last_updated).toLocaleString('zh-TW')}
      </p>
    </div>
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
    <GlassCard className="p-6">
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
