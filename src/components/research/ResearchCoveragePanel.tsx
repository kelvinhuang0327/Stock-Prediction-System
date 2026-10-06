"use client";

import React from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { LoadingSpinner } from '@/components/ui/loading';
import {
  getCoverageStatusLabel,
  getCoverageStatusColor,
  getPriorityColor,
} from '@/lib/research/ResearchCoverageEngine';
import type { ResearchGapsReport, ResearchCoverageItem } from '@/lib/research/ResearchCoverageEngine';

// ─── Area labels ─────────────────────────────────────────────────────────────

const AREA_LABELS: Record<ResearchCoverageItem['area'], string> = {
  signal: '訊號有效性',
  validation: '時序驗證',
  regime: '市場環境',
  confidence: '信心值校準',
  event: '事件來源',
  relevance: '相關性排序',
};

// ─── Readiness bar ────────────────────────────────────────────────────────────

function readinessTone(score: number): string {
  if (score >= 70) return 'bg-green-500/70';
  if (score >= 40) return 'bg-amber-500/70';
  if (score >= 20) return 'bg-orange-500/70';
  return 'bg-slate-400/60';
}

// ─── Coverage item row ────────────────────────────────────────────────────────

function CoverageItemRow({ item, compact = false }: { item: ResearchCoverageItem; compact?: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  const badgeClass = getCoverageStatusColor(item.status);
  const label = getCoverageStatusLabel(item.status);

  return (
    <div className="rounded-lg border border-border/30 bg-background/30 px-3 py-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-border/30 text-muted-foreground">
          {AREA_LABELS[item.area]}
        </span>
        <span className="text-xs font-medium flex-1 min-w-0 truncate">{item.title}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
          {label}
        </span>
      </div>

      {/* Coverage bar */}
      {item.coverageRatio != null && (
        <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${readinessTone(item.coverageRatio * 100)}`}
            style={{ width: `${Math.max(2, item.coverageRatio * 100)}%` }}
          />
        </div>
      )}

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        {item.sampleSize != null && <span>n={item.sampleSize}</span>}
        {item.coverageRatio != null && <span>覆蓋率 {(item.coverageRatio * 100).toFixed(0)}%</span>}
        <span>信心 {item.confidence}</span>
      </div>

      {/* Top limitation */}
      {item.primaryLimitations.length > 0 && !compact && (
        <div>
          <p className="text-[11px] text-muted-foreground/80 leading-snug">
            {item.primaryLimitations[0]}
          </p>
          {item.primaryLimitations.length > 1 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-primary/70 hover:text-primary mt-0.5"
            >
              {expanded ? '收起' : `+${item.primaryLimitations.length - 1} 更多限制`}
            </button>
          )}
          {expanded && (
            <ul className="mt-1 space-y-0.5">
              {item.primaryLimitations.slice(1).map((lim, i) => (
                <li key={i} className="text-[10px] text-muted-foreground/70 leading-snug">• {lim}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Recommended next step */}
      {item.recommendedNextStep && (
        <p className="text-[10px] text-muted-foreground/60 italic leading-snug">
          建議：{item.recommendedNextStep}
        </p>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ResearchCoveragePanel({
  defaultExpanded = false,
}: {
  defaultExpanded?: boolean;
}) {
  const [data, setData] = React.useState<ResearchGapsReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(defaultExpanded);

  const load = React.useCallback(async () => {
    if (data || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/research/coverage');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ResearchGapsReport;
      setData(json);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '無法載入研究覆蓋報告');
    } finally {
      setLoading(false);
    }
  }, [data, loading]);

  const toggle = () => {
    setOpen((v) => !v);
    if (!open) load();
  };

  const summary = data?.summary;

  return (
    <GlassCard className="p-5">
      {/* Header — always visible */}
      <button className="w-full flex items-center justify-between" onClick={toggle}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">研究覆蓋狀態</span>
          <span className="text-xs text-muted-foreground">（研究透明度，非交易依據）</span>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <>
              <span className="text-[11px] text-green-600 dark:text-green-400">
                可用 {summary.readyCount}
              </span>
              <span className="text-[11px] text-amber-600 dark:text-amber-300">
                部分 {summary.partialCount}
              </span>
              {(summary.degradedCount + summary.insufficientCount + summary.simulationDominatedCount + summary.unavailableCount) > 0 && (
                <span className="text-[11px] text-red-600 dark:text-red-400">
                  待補 {summary.degradedCount + summary.insufficientCount + summary.simulationDominatedCount + summary.unavailableCount}
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground">
                整體 {summary.overallReadiness}%
              </span>
            </>
          )}
          <span className="text-muted-foreground text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="mt-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <LoadingSpinner size="sm" />
              正在評估研究覆蓋狀態…
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
          )}

          {!loading && data && (
            <>
              {/* Overall readiness bar */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>整體研究就緒度</span>
                  <span>{data.summary.overallReadiness}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${readinessTone(data.summary.overallReadiness)}`}
                    style={{ width: `${data.summary.overallReadiness}%` }}
                  />
                </div>
              </div>

              {/* Report-level limitations */}
              {data.limitations.length > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
                  <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mb-1">主要研究限制</p>
                  {data.limitations.map((lim, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">• {lim}</p>
                  ))}
                </div>
              )}

              {/* Top gaps */}
              {data.topGaps.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2">主要研究缺口</h3>
                  <div className="space-y-2">
                    {data.topGaps.slice(0, 4).map((gap) => (
                      <div key={gap.key} className="rounded-lg border border-border/30 bg-background/30 px-3 py-2 space-y-1">
                        <div className="flex items-start gap-2">
                          <span className={`text-[10px] font-bold shrink-0 mt-0.5 ${getPriorityColor(gap.priority)}`}>
                            {gap.priority}
                          </span>
                          <p className="text-[11px] text-foreground/80 leading-snug">{gap.reason}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 italic leading-snug">
                          建議：{gap.recommendedNextStep}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50">
                          影響：{gap.affectedAreas.map((a) => AREA_LABELS[a]).join(' / ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coverage grid — non-signal items */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">研究模組狀態</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {data.items
                    .filter((item) => item.area !== 'signal')
                    .map((item) => (
                      <CoverageItemRow key={item.key} item={item} />
                    ))}
                </div>
              </div>

              {/* Signal items (collapsible section) */}
              <SignalCoverageSection items={data.items.filter((item) => item.area === 'signal')} />

              {/* Footer */}
              <p className="text-[10px] text-muted-foreground/50 text-right">
                產生時間：{new Date(data.generatedAt).toLocaleString('zh-TW')}
              </p>
            </>
          )}
        </div>
      )}
    </GlassCard>
  );
}

function SignalCoverageSection({ items }: { items: ResearchCoverageItem[] }) {
  const [open, setOpen] = React.useState(false);
  if (items.length === 0) return null;

  const readyCount = items.filter((i) => i.status === 'READY').length;
  const insufficientCount = items.filter(
    (i) => i.status === 'INSUFFICIENT_DATA' || i.status === 'UNAVAILABLE',
  ).length;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground mb-2"
      >
        <span>訊號有效性覆蓋（{items.length} 個訊號類型）</span>
        <div className="flex items-center gap-2">
          <span className="text-green-600 dark:text-green-400">可用 {readyCount}</span>
          {insufficientCount > 0 && (
            <span className="text-slate-500">資料不足 {insufficientCount}</span>
          )}
          <span>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {items.map((item) => (
            <CoverageItemRow key={item.key} item={item} compact />
          ))}
        </div>
      )}
    </div>
  );
}
