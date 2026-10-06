"use client";

import React from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import type { StockPeerComparison } from '@/lib/fundamentals/StockPeerComparison';
import { LimitationBlock } from '@/components/ui/limitation-block';

const COVERAGE_STYLE: Record<
  StockPeerComparison['dataCoverage'],
  { label: string; tone: string }
> = {
  full: {
    label: '資料完整',
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  limited: {
    label: '資料有限',
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
  insufficient: {
    label: '資料不足',
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
  },
};

export function FundamentalPeerComparisonCard({
  comparison,
}: {
  comparison: StockPeerComparison | null | undefined;
}) {
  if (!comparison) {
    return (
      <div className="text-sm text-muted-foreground py-4 px-2">
        同產業相對比較暫時不可用。
      </div>
    );
  }

  const coverage = COVERAGE_STYLE[comparison.dataCoverage];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">同組相對比較</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${coverage.tone}`}>
            {coverage.label}
          </span>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-primary/10 text-primary">
            {comparison.basis === 'industry' ? 'industry' : 'sector'} · {comparison.groupLabel}
          </span>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">{comparison.summary}</p>
        <p className="text-xs text-muted-foreground">同組可比樣本 {comparison.peerCount} 檔</p>
      </div>

      {comparison.metrics.length > 0 ? (
        <div className="space-y-2">
          {comparison.metrics.map((metric) => (
            <div key={metric.key} className="rounded-lg border border-border/30 bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{metric.label}</div>
                  <div className="text-[11px] text-muted-foreground">{metric.interpretation}</div>
                </div>
                <span className={`text-[11px] font-medium ${percentileTone(metric.percentile)}`}>
                  {metric.percentile === null ? '—' : `PR ${metric.percentile}`}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <Metric label="本股" value={formatMetric(metric.targetValue)} />
                <Metric label="同組中位" value={formatMetric(metric.peerMedian)} />
                <Metric label="相對位置" value={metric.percentile === null ? '資料不足' : `${metric.percentile}%`} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/40 px-4 py-5 text-sm text-muted-foreground">
          目前沒有足夠的同組資料可供比較。
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SummaryList
          title="相對優勢"
          icon={<Shield className="h-4 w-4 text-emerald-500" />}
          items={comparison.strengths}
          emptyText="目前未觀察到明確的同組相對優勢。"
          tone="positive"
        />
        <SummaryList
          title="相對壓力"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          items={comparison.cautions}
          emptyText="目前未觀察到明確的同組相對壓力。"
          tone="risk"
        />
      </div>

      {comparison.limitations.length > 0 && (
        <div className="rounded-lg border border-border/20 bg-muted/10 p-3">
          <LimitationBlock title="相對比較限制" items={comparison.limitations} compact />
        </div>
      )}
    </div>
  );
}

function SummaryList({
  title,
  icon,
  items,
  emptyText,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  emptyText: string;
  tone: 'positive' | 'risk';
}) {
  const itemTone =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-300'
      : 'text-amber-700 dark:text-amber-300';

  return (
    <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item} className={`text-xs ${itemTone}`}>
              • {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/50 p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function formatMetric(value: number | null): string {
  if (value === null) return '—';
  return value.toFixed(2);
}

function percentileTone(percentile: number | null): string {
  if (percentile === null) return 'text-muted-foreground';
  if (percentile >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (percentile <= 30) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}
