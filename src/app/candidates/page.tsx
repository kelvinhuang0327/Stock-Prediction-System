"use client";

/**
 * /candidates — Alpha Candidates Research Page
 *
 * Full-featured candidate stock research page powered by StrategyScreenEngine.
 * NOT an investment recommendation page — all scores are model estimates.
 *
 * Page role:
 *   /candidates     → full research table, filters, explainability, comparison
 *   /rankings Alpha → summary entry point → links here
 *   /report/daily   → daily narrative summary → not a replacement
 */

import React, { useState, useMemo } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { GlassCard } from '@/components/ui/glass-card';
import { LoadingSpinner } from '@/components/ui/loading';
import { Disclaimer } from '@/components/ui/disclaimer';
import {
  Search, SlidersHorizontal, TrendingUp, TrendingDown, Minus,
  AlertTriangle, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp,
  ArrowDown, Info, Shield, BarChart3, Activity, Eye, Star
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

type CandidateChangeTag =
  | 'new_today' | 'bucket_upgraded' | 'bucket_downgraded'
  | 'alpha_improved' | 'alpha_dropped' | 'newly_insufficient';

interface EnrichedCandidate {
  symbol: string;
  name: string;
  closePrice: number;
  priceChangePercent: number;
  isETF: boolean;
  alphaScore: number;
  recommendationBucket: string;
  confidence: number;
  technicalScore: number;
  chipScore: number;
  fundamentalScore: number;
  marketAdjustment: number;
  riskLevel: string;
  screenBucket: string;
  whyIncluded: string;
  topFactors: string[];
  keyRisks: string[];
  dataCoverage: 'full' | 'limited' | 'insufficient';
  usedSources: string[];
  missingSources: string[];
  limitations: string[];
  summary: string;
  changeTags: CandidateChangeTag[];
  previousAlpha: number | null;
  previousBucket: string | null;
  alphaDelta: number | null;
}

interface CandidatesResponse {
  regime: string;
  regimeConfidence: number;
  candidates: EnrichedCandidate[];
  excludedCount: number;
  totalScanned: number;
  dataCoverageSummary: { full: number; limited: number; insufficient: number };
  screenParams: { minAlphaScore: number; minConfidence: number; respectMarketRegime: boolean; appliedRegimeAdjustment: string };
  comparisonAvailable: boolean;
  previousSnapshotDate: string | null;
  strongCount: number;
  watchCount: number;
  neutralCount: number;
  limitations: string[];
  disclaimer: string;
  last_updated: string | null;
}

// ─── Styles ──────────────────────────────────────────────────────

const REGIME_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  Bull:     { bg: 'bg-red-100 dark:bg-red-950/40',    text: 'text-red-700 dark:text-red-400',    icon: <TrendingUp  className="h-4 w-4" /> },
  Bear:     { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-400', icon: <TrendingDown className="h-4 w-4" /> },
  Sideways: { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', icon: <Minus       className="h-4 w-4" /> },
  Unknown:  { bg: 'bg-gray-100 dark:bg-gray-800',     text: 'text-gray-600 dark:text-gray-400',  icon: <AlertTriangle className="h-4 w-4" /> },
};

const BUCKET_STYLE: Record<string, string> = {
  'Strong Candidate': 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  'Watch':            'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  'Neutral':          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  'Excluded':         'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
  'Insufficient Data':'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
  'Avoid':            'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
};

const COVERAGE_STYLE: Record<string, string> = {
  full:        'text-green-600 dark:text-green-400',
  limited:     'text-amber-600 dark:text-amber-400',
  insufficient:'text-red-600 dark:text-red-400',
};

const CHANGE_TAG_STYLE: Record<CandidateChangeTag, { label: string; cls: string }> = {
  new_today:          { label: '今日新增', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  bucket_upgraded:    { label: '↑ 升級', cls: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' },
  bucket_downgraded:  { label: '↓ 降級', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' },
  alpha_improved:     { label: '▲ 改善', cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
  alpha_dropped:      { label: '▼ 下滑', cls: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' },
  newly_insufficient: { label: '⚠ 缺資料', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
};

type SortKey = 'alphaScore' | 'confidence' | 'technicalScore' | 'chipScore' | 'fundamentalScore' | 'symbol';
type SortDir = 'asc' | 'desc';

// ─── Page ────────────────────────────────────────────────────────

export default function CandidatesPage() {
  const { data, loading, error, refetch } = useApiData<CandidatesResponse>('/api/strategy/candidates');

  // Filters
  const [search, setSearch] = useState('');
  const [bucketFilter, setBucketFilter] = useState<string>('all');
  const [minAlpha, setMinAlpha] = useState(0);
  const [minConf, setMinConf] = useState(0);
  const [coverageFilter, setCoverageFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all'); // all / stock / etf
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('alphaScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Expanded detail row
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  // Page
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    if (!data?.candidates) return [];
    return data.candidates
      .filter(c => {
        if (search) {
          const q = search.toLowerCase();
          if (!c.symbol.toLowerCase().includes(q) && !c.name.toLowerCase().includes(q)) return false;
        }
        if (bucketFilter !== 'all' && c.screenBucket !== bucketFilter) return false;
        if (c.alphaScore < minAlpha) return false;
        if (c.confidence < minConf) return false;
        if (coverageFilter !== 'all' && c.dataCoverage !== coverageFilter) return false;
        if (typeFilter === 'etf' && !c.isETF) return false;
        if (typeFilter === 'stock' && c.isETF) return false;
        return true;
      })
      .sort((a, b) => {
        const mul = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'symbol') return mul * a.symbol.localeCompare(b.symbol);
        return mul * ((a[sortKey] as number) - (b[sortKey] as number));
      });
  }, [data, search, bucketFilter, minAlpha, minConf, coverageFilter, typeFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
          <span className="ml-3 text-muted-foreground">掃描候選股票...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <GlassCard className="p-8 text-center">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-500" />
          <p className="text-muted-foreground mb-4">{error ?? '無法取得候選股資料'}</p>
          <button onClick={refetch} className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm">重試</button>
        </GlassCard>
      </div>
    );
  }

  const regime = REGIME_STYLE[data.regime] ?? REGIME_STYLE.Unknown;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-6 w-6 text-primary" />
            Alpha 候選股研究
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">基於 StrategyScreenEngine · 僅供研究參考，非投資建議</p>
        </div>
        <button onClick={refetch} className="self-start px-3 py-1.5 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          重新掃描
        </button>
      </div>

      {/* Market Context Header */}
      <MarketContextCard data={data} regime={regime} />

      {/* Summary count cards */}
      <SummaryCountBar data={data} />

      {/* Comparison notice */}
      {!data.comparisonAvailable && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted/30 border border-border/20 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          快照比較尚未啟用（昨日無快照），今日標記均為即時資料。請至每日報告頁點擊「建立快照」以啟用歷史追蹤。
        </div>
      )}
      {data.comparisonAvailable && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 text-sm text-green-700 dark:text-green-400">
          <Activity className="h-4 w-4 shrink-0" />
          與 {data.previousSnapshotDate} 快照比較中 · 新增 / 升級 / 改善等標籤基於真實歷史快照
        </div>
      )}

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="搜尋代號或名稱..."
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          {/* Quick bucket filter */}
          <div className="flex flex-wrap gap-1.5">
            {['all', 'Strong Candidate', 'Watch', 'Neutral'].map(b => (
              <button key={b} onClick={() => { setBucketFilter(b); setPage(1); }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  bucketFilter === b ? 'bg-primary text-primary-foreground' : 'bg-muted/30 hover:bg-muted/50'
                }`}>
                {b === 'all' ? '全部' : b === 'Strong Candidate' ? 'Strong' : b}
              </button>
            ))}
          </div>

          {/* Advanced filters toggle */}
          <button onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-muted/30 hover:bg-muted/50 transition-colors whitespace-nowrap">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            進階篩選
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {/* Advanced filter panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border/20 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Alpha 分數 ≥</span>
              <input type="number" min={0} max={100} value={minAlpha}
                onChange={e => { setMinAlpha(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1.5 rounded bg-muted/30 border border-border/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">信心度 ≥</span>
              <input type="number" min={0} max={100} value={minConf}
                onChange={e => { setMinConf(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1.5 rounded bg-muted/30 border border-border/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">資料覆蓋</span>
              <select value={coverageFilter} onChange={e => { setCoverageFilter(e.target.value); setPage(1); }}
                className="px-2 py-1.5 rounded bg-muted/30 border border-border/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="all">全部</option>
                <option value="full">完整</option>
                <option value="limited">部分</option>
                <option value="insufficient">不足</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">類型</span>
              <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                className="px-2 py-1.5 rounded bg-muted/30 border border-border/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="all">全部</option>
                <option value="stock">個股</option>
                <option value="etf">ETF</option>
              </select>
            </label>
          </div>
        )}
      </GlassCard>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>顯示 {filtered.length} / {data.candidates.length} 筆候選（掃描 {data.totalScanned} 檔）</span>
        {data.limitations.length > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />{data.limitations.length} 項資料限制
          </span>
        )}
      </div>

      {/* Candidate table */}
      {filtered.length === 0 ? (
        <GlassCard className="p-10 text-center text-muted-foreground">
          <Eye className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>目前沒有符合條件的候選股</p>
        </GlassCard>
      ) : (
        <>
          <GlassCard className="overflow-hidden">
            {/* Table header */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    <SortTh label="代號/名稱" sortKey="symbol" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Alpha" sortKey="alphaScore" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Bucket</th>
                    <SortTh label="信心" sortKey="confidence" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="技術" sortKey="technicalScore" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="籌碼" sortKey="chipScore" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="基本面" sortKey="fundamentalScore" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">覆蓋</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">變化</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">說明</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(c => (
                    <React.Fragment key={c.symbol}>
                      <CandidateRow
                        candidate={c}
                        expanded={expandedSymbol === c.symbol}
                        onToggle={() => setExpandedSymbol(expandedSymbol === c.symbol ? null : c.symbol)}
                        comparisonAvailable={data.comparisonAvailable}
                      />
                      {expandedSymbol === c.symbol && (
                        <tr>
                          <td colSpan={10} className="px-4 pb-4 bg-muted/10">
                            <CandidateDetailPanel candidate={c} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded bg-muted/30 hover:bg-muted/50 disabled:opacity-40 transition-colors">
                ← 上一頁
              </button>
              <span className="text-muted-foreground">{page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded bg-muted/30 hover:bg-muted/50 disabled:opacity-40 transition-colors">
                下一頁 →
              </button>
            </div>
          )}
        </>
      )}

      {/* Limitations */}
      {data.limitations.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> 資料限制說明
          </h3>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {data.limitations.map((l, i) => <li key={i}>• {l}</li>)}
          </ul>
        </GlassCard>
      )}

      <Disclaimer
        warning={data.disclaimer}
        source="StrategyScreenEngine + SignalFusionEngine + MarketRegimeEngine"
        methodology="規則式評分引擎，非 AI 黑盒預測。alphaScore 為候選評分，非交易指令。"
        variant="detailed"
      />
    </div>
  );
}

// ─── Market Context Card ─────────────────────────────────────────

function MarketContextCard({
  data,
  regime,
}: {
  data: CandidatesResponse;
  regime: { bg: string; text: string; icon: React.ReactNode };
}) {
  return (
    <GlassCard className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${regime.bg} ${regime.text}`}>
          {regime.icon}
          {data.regime} · 信心度 {data.regimeConfidence}%
        </div>
        <p className="text-sm text-muted-foreground flex-1">
          {data.screenParams.appliedRegimeAdjustment}
        </p>
        {data.last_updated && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            最後更新: {new Date(data.last_updated).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </GlassCard>
  );
}

// ─── Summary Count Bar ───────────────────────────────────────────

function SummaryCountBar({ data }: { data: CandidatesResponse }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: '掃描', value: data.totalScanned, color: '' },
        { label: 'Strong', value: data.strongCount, color: 'text-red-600 dark:text-red-400' },
        { label: 'Watch', value: data.watchCount, color: 'text-amber-600 dark:text-amber-400' },
        { label: 'Neutral', value: data.neutralCount, color: 'text-gray-500' },
        { label: '排除', value: data.excludedCount, color: 'text-muted-foreground' },
      ].map(({ label, value, color }) => (
        <GlassCard key={label} className="p-3 text-center" variant="subtle">
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </GlassCard>
      ))}
    </div>
  );
}

// ─── Sort Table Header ───────────────────────────────────────────

function SortTh({ label, sortKey: sk, current, dir, onSort }: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const isActive = current === sk;
  return (
    <th
      onClick={() => onSort(sk)}
      className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap transition-colors"
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive ? (dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </span>
    </th>
  );
}

// ─── Candidate Row ───────────────────────────────────────────────

function CandidateRow({ candidate: c, expanded, onToggle, comparisonAvailable }: {
  candidate: EnrichedCandidate;
  expanded: boolean;
  onToggle: () => void;
  comparisonAvailable: boolean;
}) {
  const coverageColor = COVERAGE_STYLE[c.dataCoverage] ?? '';

  return (
    <tr className={`border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer ${expanded ? 'bg-muted/10' : ''}`}
      onClick={onToggle}>
      {/* Symbol / Name */}
      <td className="px-3 py-2.5">
        <div className="flex flex-col">
          <span className="font-mono font-medium text-sm">{c.symbol}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">{c.name}</span>
          {c.isETF && <span className="text-[10px] text-blue-600 dark:text-blue-400">ETF</span>}
        </div>
      </td>
      {/* Alpha */}
      <td className="px-3 py-2.5">
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{c.alphaScore.toFixed(0)}</span>
          {c.alphaDelta !== null && (
            <span className={`text-[11px] ${c.alphaDelta > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {c.alphaDelta > 0 ? '+' : ''}{c.alphaDelta.toFixed(0)}
            </span>
          )}
        </div>
      </td>
      {/* Bucket */}
      <td className="px-3 py-2.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BUCKET_STYLE[c.screenBucket] ?? ''}`}>
          {c.screenBucket === 'Strong Candidate' ? 'Strong' : c.screenBucket}
        </span>
      </td>
      {/* Confidence */}
      <td className="px-3 py-2.5 text-sm text-muted-foreground">{c.confidence}%</td>
      {/* Technical */}
      <td className="px-3 py-2.5">
        <ScoreBar value={c.technicalScore} />
      </td>
      {/* Chip */}
      <td className="px-3 py-2.5">
        <ScoreBar value={c.chipScore} />
      </td>
      {/* Fundamental */}
      <td className="px-3 py-2.5">
        <ScoreBar value={c.fundamentalScore} />
      </td>
      {/* Coverage */}
      <td className="px-3 py-2.5">
        <span className={`text-xs ${coverageColor}`}>
          {c.dataCoverage === 'full' ? '完整' : c.dataCoverage === 'limited' ? '部分' : '不足'}
        </span>
      </td>
      {/* Change tags */}
      <td className="px-3 py-2.5">
        {comparisonAvailable ? (
          <div className="flex flex-wrap gap-1">
            {c.changeTags.map(tag => (
              <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CHANGE_TAG_STYLE[tag].cls}`}>
                {CHANGE_TAG_STYLE[tag].label}
              </span>
            ))}
            {c.changeTags.length === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </td>
      {/* Why / expand */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground truncate max-w-[140px]">{c.whyIncluded}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        </div>
      </td>
    </tr>
  );
}

// ─── Score Bar ───────────────────────────────────────────────────

function ScoreBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped >= 60 ? 'bg-red-400 dark:bg-red-500'
    : clamped >= 40 ? 'bg-amber-400 dark:bg-amber-500'
    : 'bg-gray-300 dark:bg-gray-600';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{clamped.toFixed(0)}</span>
    </div>
  );
}

// ─── Candidate Detail Panel ──────────────────────────────────────

function CandidateDetailPanel({ candidate: c }: { candidate: EnrichedCandidate }) {
  return (
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Why included */}
      <div className="p-3 rounded-lg bg-muted/20 border border-border/20">
        <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
          <Info className="h-3 w-3 text-primary" /> 為何列入候選
        </h4>
        <p className="text-xs text-muted-foreground">{c.whyIncluded}</p>
        {c.summary && <p className="text-xs text-muted-foreground mt-1 italic">{c.summary}</p>}
      </div>

      {/* Top factors */}
      <div className="p-3 rounded-lg bg-muted/20 border border-border/20">
        <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
          <BarChart3 className="h-3 w-3 text-primary" /> 關鍵正向因子
        </h4>
        {c.topFactors.length > 0 ? (
          <ul className="space-y-0.5">
            {c.topFactors.map((f, i) => (
              <li key={i} className="text-xs flex items-start gap-1">
                <span className="text-green-500 mt-0.5">✓</span>
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted-foreground">無可追溯因子</p>}
      </div>

      {/* Key risks */}
      <div className="p-3 rounded-lg bg-muted/20 border border-border/20">
        <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
          <Shield className="h-3 w-3 text-amber-500" /> 主要風險
        </h4>
        {c.keyRisks.length > 0 ? (
          <ul className="space-y-0.5">
            {c.keyRisks.map((r, i) => (
              <li key={i} className="text-xs flex items-start gap-1">
                <span className="text-amber-500 mt-0.5">⚠</span>
                <span className="text-muted-foreground">{r}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted-foreground">無標記風險</p>}
      </div>

      {/* Score breakdown */}
      <div className="p-3 rounded-lg bg-muted/20 border border-border/20">
        <h4 className="text-xs font-medium mb-2">分數細項</h4>
        <div className="space-y-1.5">
          {[
            { label: '技術面', value: c.technicalScore },
            { label: '籌碼面', value: c.chipScore },
            { label: '基本面', value: c.fundamentalScore },
            { label: '市場調整', value: c.marketAdjustment },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">{label}</span>
              <ScoreBar value={Math.abs(value)} />
              {value < 0 && <span className="text-xs text-muted-foreground">({value.toFixed(0)})</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Data sources */}
      <div className="p-3 rounded-lg bg-muted/20 border border-border/20">
        <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
          <Activity className="h-3 w-3 text-primary" /> 資料來源狀態
        </h4>
        <div className="space-y-0.5">
          {c.usedSources.map(s => (
            <div key={s} className="text-xs flex items-center gap-1 text-green-600 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />{s}
            </div>
          ))}
          {c.missingSources.map(s => (
            <div key={s} className="text-xs flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />{s} (缺失)
            </div>
          ))}
        </div>
      </div>

      {/* Snapshot comparison */}
      {(c.previousAlpha !== null || c.previousBucket !== null) && (
        <div className="p-3 rounded-lg bg-muted/20 border border-border/20">
          <h4 className="text-xs font-medium mb-2">與昨日比較</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            {c.previousAlpha !== null && (
              <p>Alpha: {c.previousAlpha.toFixed(0)} → {c.alphaScore.toFixed(0)}
                {c.alphaDelta !== null && (
                  <span className={c.alphaDelta > 0 ? 'text-red-500' : 'text-green-500'}>
                    {' '}({c.alphaDelta > 0 ? '+' : ''}{c.alphaDelta.toFixed(0)})
                  </span>
                )}
              </p>
            )}
            {c.previousBucket !== null && c.previousBucket !== c.screenBucket && (
              <p>Bucket: {c.previousBucket} → {c.screenBucket}</p>
            )}
          </div>
        </div>
      )}

      {/* Limitations */}
      {c.limitations.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/20 sm:col-span-2 lg:col-span-3">
          <h4 className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">此股票資料限制</h4>
          <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
            {c.limitations.map((l, i) => <li key={i}>• {l}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
