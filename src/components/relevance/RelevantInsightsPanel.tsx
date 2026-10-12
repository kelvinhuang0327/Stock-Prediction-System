"use client";

import React from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/glass-card';
import { LoadingSpinner } from '@/components/ui/loading';
import type { OverlayQualityLabel, RelevanceInsightsApiResponse, RelevanceMode, RelevantInsight } from '@/lib/relevance/types';

const CATEGORY_LABELS: Record<RelevantInsight['category'], string> = {
  signal: 'Signal',
  event: 'Event',
  topic: 'Topic',
  risk: 'Risk',
  portfolio: 'Portfolio',
};

function scoreTone(score: number): string {
  if (score >= 75) return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
  if (score >= 55) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function barTone(contribution: number): string {
  if (contribution >= 75) return 'bg-red-400/80 dark:bg-red-500/80';
  if (contribution >= 50) return 'bg-amber-400/80 dark:bg-amber-500/80';
  return 'bg-slate-300 dark:bg-slate-600';
}

const OVERLAY_LABELS: Record<OverlayQualityLabel, string> = {
  RESEARCH_CONFIDENT: '研究可信',
  RESEARCH_CAUTION: '研究謹慎',
  RESEARCH_WEAK: '研究偏弱',
  RESEARCH_INSUFFICIENT: '研究不足',
};

function overlayTone(label: OverlayQualityLabel): string {
  if (label === 'RESEARCH_CONFIDENT') return 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400';
  if (label === 'RESEARCH_CAUTION') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  if (label === 'RESEARCH_WEAK') return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400';
  return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
}

export function RelevantInsightsPanel({
  mode,
  symbol,
  maxItems = 5,
  title,
  description,
  variant = 'default',
  minimumScore = 0,
  emptyStateMessage,
}: {
  mode: RelevanceMode;
  symbol?: string;
  maxItems?: number;
  title: string;
  description: string;
  variant?: 'default' | 'compact';
  minimumScore?: number;
  emptyStateMessage?: string;
}) {
  const [data, setData] = React.useState<RelevanceInsightsApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/relevance/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, symbol, maxItems }),
        });
        const json = (await res.json()) as RelevanceInsightsApiResponse;
        if (!res.ok && (!json || !Array.isArray(json.insights))) {
          throw new Error(`relevance insights request failed (${res.status})`);
        }
        if (!cancelled) setData(json);
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : '無法載入重要性排序');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [mode, symbol, maxItems]);

  const visibleInsights = React.useMemo(
    () => (data?.insights ?? []).filter((insight) => insight.relevanceScore >= minimumScore),
    [data?.insights, minimumScore],
  );
  const isCompact = variant === 'compact';
  const rootClassName = isCompact ? 'p-4 space-y-3' : 'p-5 space-y-4';
  const itemClassName = isCompact ? 'rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2' : 'rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2.5';
  const finalEmptyMessage = emptyStateMessage ?? '目前沒有可優先排序的 insight，系統已保守降級。';

  return (
    <GlassCard className={rootClassName}>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground py-3">
          <LoadingSpinner size="sm" />
          正在整理最值得優先查看的研究資訊…
        </div>
      ) : null}

      {!loading && error ? (
        <div className="text-sm text-amber-600 dark:text-amber-400">{error}</div>
      ) : null}

      {!loading && !error && visibleInsights.length ? (
        <div className="space-y-3">
          {visibleInsights.map((insight) => (
            <div key={insight.id} className={itemClassName}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground">
                  {CATEGORY_LABELS[insight.category]}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${scoreTone(insight.relevanceScore)}`}>
                  Relevance {insight.relevanceScore.toFixed(1)}
                </span>
                {insight.qualityOverlay ? (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${overlayTone(insight.qualityOverlay.qualityLabel)}`}>
                    {OVERLAY_LABELS[insight.qualityOverlay.qualityLabel]}
                  </span>
                ) : null}
                <span className="text-[11px] text-muted-foreground ml-auto">Confidence {insight.confidence.toFixed(0)}</span>
              </div>
              <div>
                <h3 className="text-sm font-medium">{insight.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{insight.summary}</p>
              </div>
              <p className="text-[12px] text-foreground/80">{insight.explanation}</p>
              {insight.qualityOverlay?.reasons.length ? (
                <p className="text-[11px] text-muted-foreground/80">
                  研究品質：{insight.qualityOverlay.reasons.slice(0, 2).join('；')}
                </p>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {insight.breakdown.map((factor) => (
                  <div key={`${insight.id}:${factor.key}`} className="rounded-lg border border-border/30 bg-background/40 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-muted-foreground">{factor.label}</span>
                      <span className="font-medium text-foreground/80">
                        {factor.available ? `${factor.score}/${factor.maxScore}` : 'n/a'}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barTone(factor.contribution)}`}
                        style={{ width: `${factor.available ? factor.contribution : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {insight.sourceTarget ? (
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground">來源：{insight.sourceRef ?? insight.sourceType}</span>
                  <Link href={insight.sourceTarget} className="text-primary hover:underline">
                    查看來源
                  </Link>
                </div>
              ) : null}
              {insight.limitations.length > 0 ? (
                <p className="text-[11px] text-muted-foreground">限制：{insight.limitations.slice(0, 2).join('；')}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && visibleInsights.length === 0 ? (
        <p className="text-sm text-muted-foreground">{finalEmptyMessage}</p>
      ) : null}
    </GlassCard>
  );
}
