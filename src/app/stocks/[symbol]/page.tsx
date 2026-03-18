"use client";

/**
 * /stocks/[symbol] — Individual Stock Research Page
 *
 * Research-oriented drill-down page. NOT a trade execution or recommendation page.
 * All scores are model estimates. Data limitations are clearly surfaced.
 *
 * Sections:
 *   1. Stock Header    — symbol, price, data coverage, last updated
 *   2. Market Context  — regime, confidence, summary
 *   3. Analysis Summary — alphaScore, bucket, confidence, risk, summary
 *   4. Score Breakdown  — sub-scores, weights, factors, risks, missing sources
 *   5. Technical Signals — indicators, price levels with methodology
 *   6. Backtest Snapshot — buy & hold return or unavailable notice
 *   7. Candidate / Watchlist Context
 *
 * Degraded mode: any missing section shows a clear "unavailable" notice.
 */

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApiData } from '@/hooks/useApiData';
import { GlassCard } from '@/components/ui/glass-card';
import { LoadingSpinner } from '@/components/ui/loading';
import { Disclaimer } from '@/components/ui/disclaimer';
import { LimitationBlock } from '@/components/ui/limitation-block';
import { BucketBadge } from '@/components/ui/badges';
import type { StockDetailResponse } from '@/app/api/stocks/[id]/detail/route';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, BarChart3,
  ChevronLeft, Database, Shield, Activity, Clock, CheckCircle2,
  XCircle, Info, ExternalLink, Star, Bookmark, Eye, Users, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────

function pct(n: number, decimals = 2): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}

function priceColor(n: number): string {
  if (n > 0) return 'text-red-500 dark:text-red-400';
  if (n < 0) return 'text-green-500 dark:text-green-400';
  return 'text-muted-foreground';
}

function regimeColor(r: string): string {
  if (r === 'Bull') return 'text-red-500 dark:text-red-400';
  if (r === 'Bear') return 'text-green-500 dark:text-green-400';
  if (r === 'Sideways') return 'text-amber-500 dark:text-amber-400';
  return 'text-muted-foreground';
}

function coverageBadge(cov: string, dp: number) {
  const cls =
    cov === 'full' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' :
    cov === 'limited' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
    'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
  const label = cov === 'full' ? '完整' : cov === 'limited' ? '部分' : '不足';
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      <Database className="h-3 w-3" />
      {label} ({dp}天)
    </span>
  );
}

function ScoreBar({ label, value, max = 100, color = 'bg-primary' }: { label: string; value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toFixed(0)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SectionUnavailable({ reason }: { reason: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 px-2">
      <Info className="h-4 w-4 text-amber-500 shrink-0" />
      <span>{reason}</span>
    </div>
  );
}

function IndicatorSignalIcon({ signal }: { signal: string }) {
  if (signal === 'bullish') return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
  if (signal === 'bearish') return <TrendingDown className="h-3.5 w-3.5 text-green-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

// ─── Section Components ──────────────────────────────────────────

function HeaderSection({ d }: { d: StockDetailResponse }) {
  return (
    <GlassCard className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-bold tracking-wide">{d.symbol}</span>
            {d.isETF && <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 px-1.5 py-0.5 rounded">ETF</span>}
            {d.watchlistCtx.inWatchlist && <Bookmark className="h-4 w-4 text-amber-500" aria-label="已加入自選" />}
            {d.candidateCtx.isCandidate && <Star className="h-4 w-4 text-yellow-500" aria-label="在候選池中" />}
          </div>
          <div className="text-lg font-semibold text-foreground/80">{d.name}</div>
          {d.industry && <div className="text-xs text-muted-foreground">{d.industry}</div>}
        </div>
        <div className="text-right space-y-1">
          {d.closePrice > 0 ? (
            <>
              <div className="text-2xl font-bold font-mono">{d.closePrice.toFixed(2)}</div>
              <div className={`text-sm font-medium ${priceColor(d.priceChangePercent)}`}>
                {d.priceChangePercent >= 0 ? <TrendingUp className="inline h-3.5 w-3.5 mr-1" /> : <TrendingDown className="inline h-3.5 w-3.5 mr-1" />}
                {pct(d.priceChangePercent)} 昨收比
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-sm">無行情資料</div>
          )}
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {d.coverageTier && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${
                d.coverageTier.tier === 'A'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300/50'
                  : d.coverageTier.tier === 'B'
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400 border-yellow-300/50'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400 border-gray-300/50'
              }`}>
                Tier {d.coverageTier.tier}
              </span>
            )}
            {coverageBadge(d.dataCoverage, d.dataPoints)}
            {d.lastUpdated && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />{d.lastUpdated}
              </span>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function RegimeSection({ regime }: { regime: StockDetailResponse['regime'] }) {
  if (!regime) return <SectionUnavailable reason="市場環境資料不可用（TAIEX 歷史不足或分析引擎錯誤）" />;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-2xl font-bold ${regimeColor(regime.regime)}`}>{regime.regime}</span>
        <span className="text-sm text-muted-foreground">信心度 {regime.confidence}%</span>
        <span className="text-xs text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">{regime.samplePeriod}</span>
        <span className="text-xs text-muted-foreground">{regime.dataPoints} 天資料</span>
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="font-medium">市場環境說明：</span>
        {regime.regime === 'Bull' ? '目前大盤處於多頭趨勢，技術面偏正向。' :
         regime.regime === 'Bear' ? '目前大盤處於空頭趨勢，建議謹慎評估持倉。' :
         regime.regime === 'Sideways' ? '目前大盤盤整，方向不明，建議降低曝險。' :
         '大盤環境判斷不足，建議保守解讀所有評分。'}
      </div>
      {regime.limitations.length > 0 && (
        <LimitationBlock items={regime.limitations} compact />
      )}
    </div>
  );
}

function AnalysisSummarySection({ fusion }: { fusion: StockDetailResponse['fusion'] }) {
  if (!fusion) return <SectionUnavailable reason="綜合評分不可用（歷史資料不足或分析引擎暫時無法執行）" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Alpha score gauge */}
        <div className="text-center space-y-1 min-w-[80px]">
          <div className="text-4xl font-bold font-mono">{fusion.alphaScore.toFixed(0)}</div>
          <div className="text-xs text-muted-foreground">AlphaScore</div>
          <div className="text-xs text-muted-foreground">信心 {fusion.confidence}%</div>
        </div>
        {/* Badges */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <BucketBadge bucket={fusion.recommendationBucket} />
            <BucketBadge bucket={fusion.screenBucket} />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              fusion.riskLevel === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
              fusion.riskLevel === 'moderate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
              'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
            }`}>
              風險：{fusion.riskLevel}
            </span>
          </div>
          {fusion.summary && (
            <p className="text-sm text-foreground/80 leading-relaxed">{fusion.summary}</p>
          )}
          {fusion.whyIncluded && (
            <p className="text-xs text-muted-foreground bg-muted/10 rounded px-2 py-1">
              <span className="font-medium">評級依據：</span>{fusion.whyIncluded}
            </p>
          )}
        </div>
      </div>
      {fusion.limitations.length > 0 && <LimitationBlock items={fusion.limitations} compact />}
    </div>
  );
}

function ScoreBreakdownSection({ fusion }: { fusion: StockDetailResponse['fusion'] }) {
  if (!fusion) return <SectionUnavailable reason="分數細項不可用" />;
  return (
    <div className="space-y-5">
      {/* Sub-scores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '技術面', value: fusion.technicalScore, color: 'bg-blue-500' },
          { label: '籌碼面', value: fusion.chipScore, color: 'bg-purple-500' },
          { label: '基本面', value: fusion.fundamentalScore, color: 'bg-emerald-500' },
          { label: '市場調整', value: fusion.marketAdjustment + 50, color: 'bg-amber-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="space-y-2 p-3 rounded-lg bg-muted/10 border border-border/20">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
            </div>
            <div className="text-xl font-bold font-mono">{label === '市場調整' ? (fusion.marketAdjustment >= 0 ? '+' : '') + fusion.marketAdjustment.toFixed(1) : value.toFixed(0)}</div>
            <ScoreBar label="" value={value} color={color} />
          </div>
        ))}
      </div>

      {/* Key factors */}
      {fusion.topFactors.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-red-500" />正向因子
          </h4>
          <ul className="space-y-1">
            {fusion.topFactors.map((f, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key risks */}
      {fusion.keyRisks.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />主要風險
          </h4>
          <ul className="space-y-1">
            {fusion.keyRisks.map((r, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sources */}
      <div className="flex gap-4 text-xs flex-wrap">
        {fusion.usedSources.length > 0 && (
          <div>
            <span className="text-muted-foreground font-medium">資料來源：</span>
            {fusion.usedSources.join('、')}
          </div>
        )}
        {fusion.missingSources.length > 0 && (
          <div className="text-amber-600 dark:text-amber-400">
            <span className="font-medium">缺失：</span>
            {fusion.missingSources.join('、')}
          </div>
        )}
      </div>
    </div>
  );
}

function TechnicalSignalsSection({ signals }: { signals: StockDetailResponse['signals'] }) {
  if (!signals) return <SectionUnavailable reason="技術指標不可用（歷史資料少於 20 天）" />;

  const signalColor =
    signals.signal === 'BUY' ? 'text-red-500 dark:text-red-400' :
    signals.signal === 'SELL' ? 'text-green-500 dark:text-green-400' :
    signals.signal === 'WATCH' ? 'text-amber-500 dark:text-amber-400' :
    'text-muted-foreground';

  return (
    <div className="space-y-4">
      {/* Signal summary */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className={`text-2xl font-bold ${signalColor}`}>{signals.signal}</span>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">訊號強度</div>
          <div className="h-2 w-24 bg-muted/30 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${signals.strength}%` }} />
          </div>
          <div className="text-xs font-medium">{signals.strength}%</div>
        </div>
        <div className="text-xs text-muted-foreground">
          資料區間：{signals.dataPeriod}（{signals.dataPoints} 天）
        </div>
      </div>

      {/* Price levels */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '觀察價', value: signals.watchPrice, cls: 'border-blue-200 dark:border-blue-800' },
          { label: '建議進場參考', value: signals.buyPrice, cls: 'border-red-200 dark:border-red-800' },
          { label: '風險控制參考', value: signals.stopLoss, cls: 'border-green-200 dark:border-green-800' },
          { label: '目標壓力參考', value: signals.targetPrice, cls: 'border-purple-200 dark:border-purple-800' },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`p-3 rounded-lg bg-muted/10 border ${cls} space-y-1`}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-base font-bold font-mono">{value.price.toFixed(2)}</div>
            <div className="text-[10px] text-muted-foreground leading-tight">{value.methodology}</div>
          </div>
        ))}
      </div>

      {/* Indicators table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border/30">
              <th className="text-left py-1.5 pr-3 font-medium">指標</th>
              <th className="text-right py-1.5 pr-3 font-medium">數值</th>
              <th className="text-center py-1.5 pr-3 font-medium">訊號</th>
              <th className="text-left py-1.5 font-medium">說明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {signals.indicators.map((ind, i) => (
              <tr key={i}>
                <td className="py-1.5 pr-3 font-mono font-medium">{ind.name}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}</td>
                <td className="py-1.5 pr-3 text-center">
                  <IndicatorSignalIcon signal={ind.signal} />
                </td>
                <td className="py-1.5 text-muted-foreground">{ind.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Disclaimer
        methodology="MA20/MA60/RSI/MACD/BB/KD/ATR 等技術指標規則計算"
        warning="以上價位為技術指標推估，非買賣建議，不保證成立。"
      />
    </div>
  );
}

function BacktestSection({
  backtest,
  backtestSummary,
  symbol,
}: {
  backtest: StockDetailResponse['backtest'];
  backtestSummary: StockDetailResponse['backtestSummary'];
  symbol: string;
}) {
  const [showLimitations, setShowLimitations] = useState(false);

  if (!backtest.available) {
    return (
      <div className="space-y-3">
        <SectionUnavailable reason={backtest.unavailableReason ?? '回測不可用'} />
        <div className="p-3 rounded-lg bg-muted/10 border border-border/20">
          <div className="text-xs text-muted-foreground">歷史資料：{backtest.dataPoints} 天（需 ≥100 天才可回測）</div>
          <Link href={`/backtest?symbol=${symbol}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
            前往回測頁查看更多設定 <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  const bs = backtestSummary;
  const hasStrategy = bs.available && bs.totalReturn !== null;

  return (
    <div className="space-y-4">
      {/* Strategy summary vs buy & hold */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {hasStrategy ? (
          <div className="p-3 rounded-lg bg-muted/10 border border-amber-200 dark:border-amber-800 space-y-1">
            <div className="text-xs text-muted-foreground">策略報酬（MA Cross）</div>
            <div className={`text-xl font-bold font-mono ${(bs.totalReturn ?? 0) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
              {bs.totalReturn !== null ? pct(bs.totalReturn) : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground">策略：MA Cross，期間：{bs.period ?? backtest.period ?? '—'}</div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-muted/10 border border-border/20 space-y-1">
            <div className="text-xs text-muted-foreground">策略回測</div>
            <div className="text-sm text-muted-foreground">
              {bs.unavailableReason ?? '暫時不可用'}
            </div>
          </div>
        )}

        <div className="p-3 rounded-lg bg-muted/10 border border-border/20 space-y-1">
          <div className="text-xs text-muted-foreground">Buy & Hold 報酬</div>
          <div className={`text-xl font-bold font-mono ${(bs.buyAndHoldReturn ?? backtest.buyAndHoldReturn ?? 0) >= 0 ? 'text-red-500' : 'text-green-500'}`}>
            {(bs.buyAndHoldReturn ?? backtest.buyAndHoldReturn) !== null
              ? pct(bs.buyAndHoldReturn ?? backtest.buyAndHoldReturn ?? 0)
              : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground">持有至今，無交易成本</div>
        </div>

        {hasStrategy && bs.alphaToBuyAndHold !== null ? (
          <div className="p-3 rounded-lg bg-muted/10 border border-blue-200 dark:border-blue-800 space-y-1">
            <div className="text-xs text-muted-foreground">策略 vs Buy & Hold</div>
            <div className={`text-xl font-bold font-mono ${bs.alphaToBuyAndHold >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>
              {pct(bs.alphaToBuyAndHold)}
            </div>
            <div className="text-[10px] text-muted-foreground">Alpha over Buy & Hold</div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-muted/10 border border-border/20 space-y-1">
            <div className="text-xs text-muted-foreground">歷史資料</div>
            <div className="text-xl font-bold font-mono">{backtest.dataPoints} 天</div>
            <div className="text-[10px] text-muted-foreground">期間：{backtest.period ?? '—'}</div>
          </div>
        )}
      </div>

      {/* Secondary stats row */}
      {hasStrategy && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/10 border border-border/20 space-y-1">
            <div className="text-xs text-muted-foreground">最大回撤</div>
            <div className="text-base font-bold font-mono text-orange-500">
              {bs.maxDrawdown !== null ? pct(bs.maxDrawdown) : '—'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/10 border border-border/20 space-y-1">
            <div className="text-xs text-muted-foreground">交易次數</div>
            <div className="text-base font-bold font-mono">{bs.totalTrades ?? '—'}</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/10 border border-border/20 space-y-1">
            <div className="text-xs text-muted-foreground">市場基準</div>
            <div className="text-sm font-medium">
              {bs.marketBenchmarkAvailable
                ? <span className="text-green-500">可用 {bs.marketReturn !== null ? pct(bs.marketReturn) : ''}</span>
                : <span className="text-muted-foreground">不可用</span>}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/10 border border-border/20 space-y-1">
            <div className="text-xs text-muted-foreground">Regime-Aware</div>
            <div className="text-sm font-medium">
              {bs.regimeAwareAvailable
                ? <span className="text-green-500">可用 {bs.regimeAwareReturn !== null ? pct(bs.regimeAwareReturn) : ''}</span>
                : <span className="text-muted-foreground">不可用</span>}
            </div>
          </div>
        </div>
      )}

      {/* Limitations toggle */}
      {bs.limitations.length > 0 && (
        <div>
          <button
            onClick={() => setShowLimitations(v => !v)}
            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {showLimitations ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            回測限制說明 ({bs.limitations.length})
          </button>
          {showLimitations && (
            <ul className="mt-2 text-xs text-muted-foreground space-y-1 pl-4">
              {bs.limitations.map((l, i) => <li key={i} className="list-disc">{l}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Link to full backtest */}
      <div className="p-3 rounded-lg bg-muted/10 border border-border/20 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">此為簡版摘要，支援策略參數調整、完整交易明細與 walk-forward 分析</div>
        <Link
          href={`/backtest?symbol=${symbol}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap ml-3"
        >
          前往完整回測 <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <Disclaimer
        warning="回測為歷史模擬，未計交易成本與滑點。歷史績效不代表未來結果，不構成投資建議。"
      />
    </div>
  );
}

function ComparisonCard({ comparison }: { comparison: StockDetailResponse['comparison'] }) {
  const [expanded, setExpanded] = useState(false);

  if (!comparison.available) {
    return (
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span>前日快照比較：{comparison.summaryNote}</span>
        </div>
      </GlassCard>
    );
  }

  const { alphaDelta, bucketChanged, previousBucket, currentBucket, riskChanged, previousRisk, currentRisk,
    newlyInsufficient, summaryNote, previousDate, currentDate, dataCoverageChanged, previousCoverage } = comparison;

  const deltaColor = alphaDelta === null ? 'text-muted-foreground'
    : alphaDelta > 0 ? 'text-red-500 dark:text-red-400'
    : alphaDelta < 0 ? 'text-green-500 dark:text-green-400'
    : 'text-muted-foreground';

  return (
    <GlassCard className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          今日 vs 前日快照比較
          {newlyInsufficient && (
            <span className="text-[10px] bg-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded-full">資料轉為不足</span>
          )}
        </h3>
        <button onClick={() => setExpanded(v => !v)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          {expanded ? <><ChevronUp className="h-3 w-3" />收合</> : <><ChevronDown className="h-3 w-3" />展開</>}
        </button>
      </div>

      {/* Summary note */}
      <p className="text-xs text-muted-foreground">{summaryNote}</p>

      {/* Quick badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        {alphaDelta !== null && (
          <span className={`text-xs font-mono font-bold ${deltaColor}`}>
            Alpha {alphaDelta > 0 ? '+' : ''}{alphaDelta}
          </span>
        )}
        {bucketChanged && currentBucket && (
          <span className="text-xs bg-blue-500/20 text-blue-500 px-1.5 py-0.5 rounded-full">
            {previousBucket} → {currentBucket}
          </span>
        )}
        {riskChanged && currentRisk && (
          <span className="text-xs bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full">
            風險 {previousRisk} → {currentRisk}
          </span>
        )}
        {dataCoverageChanged && (
          <span className="text-xs bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded-full">
            覆蓋率變化：{previousCoverage} → {comparison.previousCoverage !== comparison.previousCoverage ? 'changed' : ''}
          </span>
        )}
      </div>

      {/* Detail rows on expand */}
      {expanded && (
        <div className="space-y-2 border-t border-border/20 pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">前日快照：</span>
              <span>{previousDate ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">今日快照：</span>
              <span>{currentDate ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">前日 Alpha：</span>
              <span>{comparison.previousAlpha ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">今日 Alpha：</span>
              <span>{comparison.currentAlpha ?? '—'}</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            快照比較基於 DailyCandidateSnapshot 資料。此為歷史觀察，非預測或買賣建議。
          </p>
        </div>
      )}
    </GlassCard>
  );
}

function ContextSection({ d }: { d: StockDetailResponse }) {
  const { candidateCtx, watchlistCtx } = d;
  const hasContext = candidateCtx.isCandidate || watchlistCtx.inWatchlist;

  return (
    <div className="space-y-4">
      {/* Candidate context */}
      <div className="p-3 rounded-lg bg-muted/10 border border-border/20 space-y-2">
        <h4 className="text-xs font-medium flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-yellow-500" />
          候選池狀態
        </h4>
        {candidateCtx.isCandidate ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <BucketBadge bucket={candidateCtx.screenBucket ?? ''} />
              {candidateCtx.snapshotDate && (
                <span className="text-xs text-muted-foreground">快照日期：{candidateCtx.snapshotDate}</span>
              )}
            </div>
            {candidateCtx.whyIncluded && (
              <p className="text-xs text-muted-foreground">{candidateCtx.whyIncluded}</p>
            )}
            {candidateCtx.changeTags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {candidateCtx.changeTags.map((t, i) => (
                  <span key={i} className="text-[10px] bg-muted/20 px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            此股票目前不在候選池中
            {candidateCtx.snapshotDate ? `（最新快照：${candidateCtx.snapshotDate}）` : ''}。
            <Link href="/candidates" className="ml-1 text-primary hover:underline">查看所有候選股</Link>
          </p>
        )}
      </div>

      {/* Watchlist context */}
      <div className="p-3 rounded-lg bg-muted/10 border border-border/20 space-y-2">
        <h4 className="text-xs font-medium flex items-center gap-1.5">
          <Bookmark className="h-3.5 w-3.5 text-amber-500" />
          自選股狀態
        </h4>
        {watchlistCtx.inWatchlist ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {watchlistCtx.holdingShares !== null && (
              <div><span className="text-muted-foreground">持有股數：</span><span className="font-mono">{watchlistCtx.holdingShares.toLocaleString()}</span></div>
            )}
            {watchlistCtx.holdingCost !== null && (
              <div><span className="text-muted-foreground">持有成本：</span><span className="font-mono">{watchlistCtx.holdingCost.toFixed(2)}</span></div>
            )}
            {watchlistCtx.label && (
              <div><span className="text-muted-foreground">標籤：</span>{watchlistCtx.label}</div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            此股票不在自選清單中。
            <Link href="/watchlist" className="ml-1 text-primary hover:underline">前往自選股頁</Link>
          </p>
        )}
      </div>

      {!hasContext && (
        <p className="text-xs text-muted-foreground text-center py-2">此股票目前不在候選池或自選股中。</p>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function StockDetailPage() {
  const params = useParams();
  const symbol = (params?.symbol as string ?? '').toUpperCase();

  const { data, loading, error } = useApiData<StockDetailResponse>(
    symbol ? `/api/stocks/${symbol}/detail` : null
  );

  const [activeTab, setActiveTab] = useState<'analysis' | 'signals' | 'backtest' | 'context' | 'research'>('analysis');

  if (!symbol) {
    return <div className="p-8 text-center text-muted-foreground">無效的股票代號</div>;
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Back navigation */}
      <div className="flex items-center gap-2">
        <Link href="/candidates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />候選股
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <Link href="/watchlist" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          自選股
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-sm font-medium">{symbol}</span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-muted-foreground">載入個股研究資料中…</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <GlassCard className="p-6 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
          <p className="text-sm text-muted-foreground">無法載入 {symbol} 的研究資料</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </GlassCard>
      )}

      {data && !loading && (
        <>
          {/* ── Section 1: Header ── */}
          <HeaderSection d={data} />

          {/* ── Global limitations ── */}
          {data.limitations.length > 0 && (
            <LimitationBlock items={data.limitations} />
          )}

          {/* ── Section 2: Market Context ── */}
          <GlassCard className="p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              市場環境
            </h2>
            <RegimeSection regime={data.regime} />
          </GlassCard>

          {/* ── Section 2.5: Snapshot Comparison ── */}
          <ComparisonCard comparison={data.comparison} />

          <div>
            <div className="flex gap-1 border-b border-border/30 mb-4 overflow-x-auto">
              {[
                { key: 'analysis', label: '綜合分析', icon: <BarChart3 className="h-3.5 w-3.5" /> },
                { key: 'signals', label: '技術指標', icon: <Activity className="h-3.5 w-3.5" /> },
                { key: 'backtest', label: '回測概覽', icon: <Shield className="h-3.5 w-3.5" /> },
                { key: 'research', label: '研究委員會', icon: <Users className="h-3.5 w-3.5" /> },
                { key: 'context', label: '持倉脈絡', icon: <Database className="h-3.5 w-3.5" /> },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as any)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === key
                      ? 'border-primary text-primary font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* ── Section 3 + 4: Analysis Summary + Score Breakdown ── */}
            {activeTab === 'analysis' && (
              <div className="space-y-4">
                <GlassCard className="p-5 space-y-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    分析摘要
                  </h2>
                  <AnalysisSummarySection fusion={data.fusion} />
                </GlassCard>
                <GlassCard className="p-5 space-y-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    分數細項
                    <span className="text-xs font-normal text-muted-foreground ml-auto">模型推估 · 非投資建議</span>
                  </h2>
                  <ScoreBreakdownSection fusion={data.fusion} />
                </GlassCard>
              </div>
            )}

            {/* ── Section 5: Technical Signals ── */}
            {activeTab === 'signals' && (
              <GlassCard className="p-5 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  技術指標
                  <span className="text-xs font-normal text-muted-foreground ml-auto">模型推估 · 非買賣建議</span>
                </h2>
                <TechnicalSignalsSection signals={data.signals} />
              </GlassCard>
            )}

            {/* ── Section 6: Backtest ── */}
            {activeTab === 'backtest' && (
              <GlassCard className="p-5 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  回測概覽
                  <span className="text-xs font-normal text-muted-foreground ml-auto">歷史績效不代表未來</span>
                </h2>
                <BacktestSection backtest={data.backtest} backtestSummary={data.backtestSummary} symbol={symbol} />
              </GlassCard>
            )}

            {/* ── Section 7: Context ── */}
            {activeTab === 'context' && (
              <GlassCard className="p-5 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  候選與自選脈絡
                </h2>
                <ContextSection d={data} />
              </GlassCard>
            )}

            {/* ── Section G: Multi-Agent Research ── */}
            {activeTab === 'research' && (
              <GlassCard className="p-5 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  研究委員會觀點
                  <span className="text-xs font-normal text-muted-foreground ml-auto">模型推估 · 非交易建議</span>
                </h2>
                <MultiAgentResearchSection data={data} />
              </GlassCard>
            )}
          </div>

          {/* ── Global disclaimer ── */}
          <Disclaimer
            source="TWSE 歷史行情（本機資料庫）、SignalFusionEngine、MarketRegimeEngine"
            methodology="技術面/籌碼面/基本面規則加權，市場環境調整"
            warning={data.disclaimer}
            variant="detailed"
          />
        </>
      )}
    </div>
  );
}

// ─── Multi-Agent Research Section ────────────────────────────────

type MAStance = 'Bullish' | 'Neutral' | 'Bearish' | 'Insufficient';
type MAConsensus = 'Positive' | 'Mixed' | 'Negative' | 'Insufficient';

interface MAAgentView {
  name: string;
  stance: MAStance;
  confidence: number;
  rationale: string;
  limitations: string[];
  missingSources: string[];
}

interface MAResearchResult {
  consensus: MAConsensus;
  consensusConfidence: number;
  viewpoints: MAAgentView[];
  disagreementPoints: string[];
  keyRisks: string[];
  scenarioNotes: string[];
  limitations: string[];
  disclaimer: string;
}

const MA_CONSENSUS_STYLE: Record<MAConsensus, { bg: string; text: string; label: string }> = {
  Positive:     { bg: 'bg-red-100 dark:bg-red-950/40',     text: 'text-red-700 dark:text-red-400',    label: '多數偏多' },
  Negative:     { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-400', label: '多數偏空' },
  Mixed:        { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', label: '觀點分歧' },
  Insufficient: { bg: 'bg-gray-100 dark:bg-gray-800',      text: 'text-gray-600 dark:text-gray-400',  label: '資料不足' },
};

const MA_AGENT_DISPLAY: Record<string, string> = {
  TechnicalAgent:   '技術面',
  MarketAgent:      '市場環境',
  ChipAgent:        '籌碼面',
  FundamentalAgent: '基本面',
  CatalystAgent:    '催化因子',
  RiskAgent:        '風險代理人',
};

const MA_STANCE_STYLE: Record<MAStance, { label: string; cls: string; dot: string }> = {
  Bullish:      { label: '偏多', cls: 'text-red-600 dark:text-red-400',    dot: 'bg-red-500' },
  Neutral:      { label: '中性', cls: 'text-amber-600 dark:text-amber-300', dot: 'bg-amber-500' },
  Bearish:      { label: '偏空', cls: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
  Insufficient: { label: '資料不足', cls: 'text-gray-500 dark:text-gray-400', dot: 'bg-gray-400' },
};

function MultiAgentResearchSection({ data }: { data: StockDetailResponse }) {
  const [result, setResult] = React.useState<MAResearchResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = React.useState<string | null>(null);

  const load = useCallback(async () => {
    if (result || loading) return;
    if (!data.fusion && data.dataPoints < 20) {
      setErr('資料不足 20 天，無法執行多 Agent 研究分析');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/research/multi-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: data.symbol,
          marketRegime: data.regime?.regime ?? 'Unknown',
          regimeConfidence: data.regime?.confidence ?? 0,
          alphaScore: data.fusion?.alphaScore ?? 50,
          bucket: data.fusion?.recommendationBucket ?? 'Neutral',
          confidence: data.fusion?.confidence ?? 0,
          dataCoverage: data.dataCoverage,
          technicalScore: data.fusion?.technicalScore ?? 50,
          chipScore: data.fusion?.chipScore ?? 50,
          fundamentalScore: data.fusion?.fundamentalScore ?? 50,
          marketAdjustment: data.fusion?.marketAdjustment ?? 0,
          usedSources: data.fusion?.usedSources ?? [],
          missingSources: data.fusion?.missingSources ?? [],
          limitations: [...(data.limitations ?? []), ...(data.fusion?.limitations ?? [])],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MAResearchResult = await res.json();
      setResult(json);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '研究委員會分析暫時不可用');
    } finally {
      setLoading(false);
    }
  }, [data, result, loading]);

  // Auto-load on mount
  React.useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground">
        <LoadingSpinner size="sm" />
        <span className="text-sm">研究委員會分析中...</span>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/30">
        <p className="text-xs text-amber-600 dark:text-amber-400">⚠ {err}</p>
      </div>
    );
  }

  if (!result) return null;

  const cs = MA_CONSENSUS_STYLE[result.consensus] ?? MA_CONSENSUS_STYLE.Insufficient;

  return (
    <div className="space-y-5">
      {/* Consensus header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${cs.bg} ${cs.text}`}>
          <Eye className="h-3.5 w-3.5" />
          委員會共識：{cs.label}
        </span>
        <span className="text-xs text-muted-foreground">置信度 {result.consensusConfidence}%</span>
        <span className="text-xs text-muted-foreground/60 italic">模型推估，非投資建議</span>
      </div>

      {/* Scenario notes */}
      {result.scenarioNotes.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-muted-foreground">情境說明</h4>
          {result.scenarioNotes.map((n, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">{n}</p>
          ))}
        </div>
      )}

      {/* Agent viewpoints grid */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">各維度觀點</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {result.viewpoints.map((v) => {
            const ss = MA_STANCE_STYLE[v.stance];
            const isExpanded = expandedAgent === v.name;
            return (
              <div key={v.name} className="rounded-lg bg-muted/10 border border-border/20 overflow-hidden">
                <button
                  className="w-full flex items-start justify-between p-3 text-left hover:bg-muted/10 transition-colors"
                  onClick={() => setExpandedAgent(isExpanded ? null : v.name)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full shrink-0 mt-0.5 ${ss.dot}`} />
                    <span className="text-xs font-medium">{MA_AGENT_DISPLAY[v.name] ?? v.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-medium ${ss.cls}`}>{ss.label}</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-border/10">
                    <p className="text-xs text-muted-foreground leading-relaxed pt-2">{v.rationale}</p>
                    {v.stance === 'Insufficient' && v.missingSources.length > 0 && (
                      <p className="text-xs text-amber-500">資料缺口：{v.missingSources.join('、')}</p>
                    )}
                    {v.limitations.length > 0 && (
                      <ul className="space-y-0.5">
                        {v.limitations.map((l, i) => (
                          <li key={i} className="text-[10px] text-muted-foreground/70">• {l}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Key risks */}
      {result.keyRisks.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" /> 主要風險
          </h4>
          <ul className="space-y-1">
            {result.keyRisks.map((r, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disagreement points */}
      {result.disagreementPoints.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Info className="h-3.5 w-3.5" /> 觀點分歧
          </h4>
          <ul className="space-y-1">
            {result.disagreementPoints.map((d, i) => (
              <li key={i} className="text-xs text-muted-foreground">• {d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Limitations */}
      {result.limitations.length > 0 && (
        <LimitationBlock items={result.limitations.slice(0, 4)} />
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground/50 italic border-t border-border/20 pt-2">
        {result.disclaimer}
      </p>
    </div>
  );
}
