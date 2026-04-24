"use client";

import React from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { LoadingSpinner } from '@/components/ui/loading';
import {
  getExperimentStatusLabel,
  getExperimentStatusColor,
  getEvidenceLevelLabel,
  getEvidenceLevelColor,
  getExperimentPriorityColor,
} from '@/lib/research/ExperimentRegistry';
import type { ExperimentRegistry, ResearchExperiment } from '@/lib/research/ExperimentRegistry';

// ─── Area labels ─────────────────────────────────────────────────────────────

const AREA_LABELS: Record<ResearchExperiment['area'], string> = {
  signal: '訊號有效性',
  validation: '時序驗證',
  regime: '市場環境',
  confidence: '信心值校準',
  event: '事件來源',
  relevance: '相關性排序',
  data: '資料基礎',
};

// ─── Experiment row ───────────────────────────────────────────────────────────

function ExperimentRow({ experiment: exp }: { experiment: ResearchExperiment }) {
  const [expanded, setExpanded] = React.useState(false);
  const statusClass = getExperimentStatusColor(exp.status);
  const evidenceClass = getEvidenceLevelColor(exp.evidenceLevel);
  const priorityClass = getExperimentPriorityColor(exp.priority);

  return (
    <div className="rounded-lg border border-border/30 bg-background/30 px-3 py-2 space-y-1.5">
      {/* Collapsed header — always visible */}
      <button
        className="w-full flex flex-wrap items-center gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-border/30 text-muted-foreground shrink-0">
          {AREA_LABELS[exp.area]}
        </span>
        <span className="text-xs font-medium flex-1 min-w-0 truncate">{exp.title}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${statusClass}`}>
          {getExperimentStatusLabel(exp.status)}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${evidenceClass}`}>
          {getEvidenceLevelLabel(exp.evidenceLevel)}
        </span>
        <span className={`text-[10px] font-bold shrink-0 ${priorityClass}`}>
          {exp.priority}
        </span>
        <span className="text-muted-foreground text-[10px] shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="space-y-2 pt-1 border-t border-border/20">
          {/* Hypothesis */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">假設</p>
            <p className="text-[11px] text-foreground/80 leading-snug">{exp.hypothesis}</p>
          </div>

          {/* Blockers */}
          {exp.blockers.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 mb-0.5">受阻原因</p>
              <ul className="space-y-0.5">
                {exp.blockers.map((b, i) => (
                  <li key={i} className="text-[11px] text-red-700 dark:text-red-400/80 leading-snug">
                    • {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Current findings */}
          {exp.currentFindings.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">目前發現</p>
              <ul className="space-y-0.5">
                {exp.currentFindings.map((f, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground/80 leading-snug">
                    • {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Success criteria */}
          {exp.successCriteria.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">驗證標準</p>
              <ul className="space-y-0.5">
                {exp.successCriteria.map((c, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground/70 leading-snug">
                    ○ {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next step */}
          {exp.recommendedNextStep && (
            <p className="text-[10px] text-muted-foreground/60 italic leading-snug">
              建議：{exp.recommendedNextStep}
            </p>
          )}

          {/* Required data */}
          {exp.requiredData.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">所需資料</p>
              <p className="text-[10px] text-muted-foreground/60 leading-snug">
                {exp.requiredData.join('、')}
              </p>
            </div>
          )}

          {/* Owner hint */}
          {exp.ownerHint && (
            <p className="text-[10px] text-muted-foreground/50">負責人建議：{exp.ownerHint}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ExperimentRegistryPanel({
  defaultExpanded = false,
}: {
  defaultExpanded?: boolean;
}) {
  const [data, setData] = React.useState<ExperimentRegistry | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(defaultExpanded);

  const load = React.useCallback(async () => {
    if (data || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/research/experiments');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ExperimentRegistry;
      setData(json);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '無法載入研究實驗追蹤');
    } finally {
      setLoading(false);
    }
  }, [data, loading]);

  const toggle = () => {
    setOpen((v) => !v);
    if (!open) load();
  };

  const summary = data?.summary;
  const blocked = data?.experiments.filter((e) => e.status === 'BLOCKED') ?? [];

  return (
    <GlassCard className="p-5">
      {/* Header — always visible */}
      <button className="w-full flex items-center justify-between" onClick={toggle}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">研究實驗追蹤</span>
          <span className="text-xs text-muted-foreground">（研究治理，非交易依據）</span>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <>
              <span className="text-[11px] text-muted-foreground">
                共 {summary.total} 項
              </span>
              {summary.blocked > 0 && (
                <span className="text-[11px] text-red-600 dark:text-red-400">
                  受阻 {summary.blocked}
                </span>
              )}
              {summary.validated > 0 && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  已驗證 {summary.validated}
                </span>
              )}
              {summary.idea > 0 && (
                <span className="text-[11px] text-blue-600 dark:text-blue-400">
                  構想 {summary.idea}
                </span>
              )}
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
              正在載入研究實驗追蹤…
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
          )}

          {!loading && data && (
            <>
              {/* Blocked experiments — highlighted section */}
              {blocked.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                    受阻實驗（{blocked.length} 項需要解除 blocker）
                  </h3>
                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2 space-y-2">
                    {blocked.map((exp) => (
                      <ExperimentRow key={exp.id} experiment={exp} />
                    ))}
                  </div>
                </div>
              )}

              {/* All experiments */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                  所有研究實驗（{data.experiments.length} 項）
                </h3>
                <div className="space-y-2">
                  {data.experiments.map((exp) => (
                    <ExperimentRow key={exp.id} experiment={exp} />
                  ))}
                </div>
              </div>

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
