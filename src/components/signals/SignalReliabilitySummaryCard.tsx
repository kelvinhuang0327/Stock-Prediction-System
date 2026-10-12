import React from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import type {
  SignalClassification,
  SignalEffectivenessSummary,
} from '@/lib/signals/types';

function badgeStyle(classification: SignalClassification): string {
  switch (classification) {
    case 'STRONG_SIGNAL':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
    case 'CONDITIONAL_SIGNAL':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
    case 'WEAK_SIGNAL':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

function signedPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}

export function SignalReliabilitySummaryCard({
  summary,
}: {
  summary: SignalEffectivenessSummary;
}) {
  return (
    <GlassCard className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">近期訊號可靠度觀察</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {summary.window} 日前向窗口 · 純研究層歷史觀察
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{summary.dataNote}</span>
      </div>

      {summary.signals.length === 0 ? (
        <p className="text-sm text-muted-foreground">目前無可用的訊號有效性摘要。</p>
      ) : (
        <div className="space-y-2">
          {summary.signals.map((signal) => (
            <div
              key={signal.signalType}
              className="rounded-lg border border-border/30 bg-muted/10 px-4 py-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="text-sm font-medium">{signal.label}</div>
                <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeStyle(signal.classification)}`}>
                  {signal.classification}
                </span>
                <span className="text-xs text-muted-foreground">
                  {signal.regimeDependency} · {signal.summary}
                </span>
                <span className="text-xs text-muted-foreground sm:ml-auto">
                  n={signal.sampleSize} · avg {signedPct(signal.avgReturn)} · excess {signedPct(signal.excessReturn)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {summary.limitations.length > 0 ? (
        <div className="rounded-lg border border-border/20 bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">限制</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {summary.limitations.slice(0, 4).map((item, index) => (
              <li key={index}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </GlassCard>
  );
}
