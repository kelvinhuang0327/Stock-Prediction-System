"use client";

import React from 'react';
import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { FundamentalRiskOverlay } from '@/lib/fundamental/FundamentalRiskOverlayEngine';
import { AlertTriangle, CheckCircle2, DollarSign, FileText, TrendingUp } from 'lucide-react';

export function CandidateFundamentalCue({
  fundamentals,
  overlay,
}: {
  fundamentals: StockFundamentalSnapshot;
  overlay?: FundamentalRiskOverlay | null;
}) {
  if (overlay) {
    return (
      <div className="space-y-1">
        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${overlayToneClass(overlay.riskLevel)}`}>
          {overlayLabel(overlay.riskLevel)}
        </span>
        <div className="max-w-[180px] text-[10px] text-muted-foreground line-clamp-2" title={overlay.summary}>
          {overlay.summary}
        </div>
      </div>
    );
  }

  const tone =
    fundamentals.dataCoverage === 'full'
      ? 'text-emerald-600 dark:text-emerald-400'
      : fundamentals.dataCoverage === 'limited'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground';

  if (fundamentals.kind === 'etf') {
    return (
      <div className={`text-[10px] ${tone}`}>
        基本面：ETF 以估值/收益視角解讀
      </div>
    );
  }

  if (fundamentals.revenue.yoyGrowth !== null) {
    return (
      <div className={`text-[10px] ${tone}`}>
        基本面：營收 YoY {fundamentals.revenue.yoyGrowth >= 0 ? '+' : ''}{fundamentals.revenue.yoyGrowth.toFixed(1)}%
      </div>
    );
  }

  return (
    <div className="text-[10px] text-muted-foreground">
      基本面：資料不足
    </div>
  );
}

export function CandidateFundamentalCard({
  fundamentals,
  overlay,
}: {
  fundamentals: StockFundamentalSnapshot;
  overlay?: FundamentalRiskOverlay | null;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/20 border border-border/20">
      <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
        <FileText className="h-3 w-3 text-primary" /> 基本面研究
      </h4>
      <p className="text-xs text-muted-foreground leading-relaxed">{fundamentals.summary}</p>

      {overlay && (
        <div className="mt-3 rounded-lg border border-border/20 bg-background/60 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium">同組基本面風險 overlay</div>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${overlayToneClass(overlay.riskLevel)}`}>
              {overlayLabel(overlay.riskLevel)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{overlay.summary}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <OverlayList
              title="相對支撐"
              emptyText="暫無明確同組支撐。"
              items={overlay.strengths}
              tone="positive"
            />
            <OverlayList
              title="估值 / 基本面壓力"
              emptyText="暫無明確同組壓力。"
              items={overlay.pressures}
              tone="risk"
            />
          </div>
          {overlay.limitations.length > 0 && (
            <div className="text-[11px] text-muted-foreground">
              解讀限制：{overlay.limitations.slice(0, 2).join('；')}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <MiniMetric
          icon={<TrendingUp className="h-3 w-3 text-primary" />}
          title="營收"
          values={[
            metricLine('月份', fundamentals.revenue.latestMonth ?? '—'),
            metricLine('YoY', formatSignedPercent(fundamentals.revenue.yoyGrowth)),
            metricLine('趨勢', fundamentals.revenue.trend),
          ]}
        />
        <MiniMetric
          icon={<FileText className="h-3 w-3 text-primary" />}
          title="獲利"
          values={[
            metricLine('期間', fundamentals.profitability.latestPeriod ?? '—'),
            metricLine('EPS', formatNumber(fundamentals.profitability.eps)),
            metricLine('毛利率', formatPercent(fundamentals.profitability.grossMargin)),
          ]}
        />
        <MiniMetric
          icon={<DollarSign className="h-3 w-3 text-primary" />}
          title="估值"
          values={[
            metricLine('P/E', formatNumber(fundamentals.valuation.pe)),
            metricLine('P/B', formatNumber(fundamentals.valuation.pb)),
            metricLine('殖利率', formatPercent(fundamentals.valuation.dividendYield)),
          ]}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div className="rounded-lg border border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/40 dark:bg-emerald-950/10 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            基本面支撐
          </div>
          {fundamentals.keySignals.length > 0 ? (
            <ul className="space-y-1">
              {fundamentals.keySignals.slice(0, 3).map((item) => (
                <li key={item} className="text-[11px] text-muted-foreground">{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">暫無明確正向訊號</p>
          )}
        </div>
        <div className="rounded-lg border border-amber-200/50 dark:border-amber-800/30 bg-amber-50/40 dark:bg-amber-950/10 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            基本面風險
          </div>
          {fundamentals.keyRisks.length > 0 ? (
            <ul className="space-y-1">
              {fundamentals.keyRisks.slice(0, 3).map((item) => (
                <li key={item} className="text-[11px] text-muted-foreground">{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">暫無明確風險訊號</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  icon,
  title,
  values,
}: {
  icon: React.ReactNode;
  title: string;
  values: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-lg border border-border/20 bg-background/50 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
        {icon}
        {title}
      </div>
      <div className="space-y-1.5">
        {values.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-mono">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function metricLine(label: string, value: string) {
  return { label, value };
}

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return value.toFixed(2);
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)}%`;
}

function formatSignedPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function overlayLabel(riskLevel: FundamentalRiskOverlay['riskLevel']): string {
  switch (riskLevel) {
    case 'low':
      return '基本面低風險';
    case 'moderate':
      return '基本面中性';
    case 'elevated':
      return '基本面壓力';
    case 'high':
      return '基本面高風險';
    case 'unknown':
    default:
      return '基本面未知';
  }
}

function overlayToneClass(riskLevel: FundamentalRiskOverlay['riskLevel']): string {
  switch (riskLevel) {
    case 'low':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'moderate':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'elevated':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
    case 'high':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

function OverlayList({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone: 'positive' | 'risk';
}) {
  const titleClass =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-300'
      : 'text-amber-700 dark:text-amber-300';

  return (
    <div className="rounded-lg border border-border/20 bg-muted/20 p-2">
      <div className={`text-[11px] font-medium ${titleClass}`}>{title}</div>
      {items.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {items.slice(0, 3).map((item) => (
            <li key={item} className="text-[11px] text-muted-foreground">
              • {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}
