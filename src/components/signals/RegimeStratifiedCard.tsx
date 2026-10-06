"use client";

/**
 * RegimeStratifiedCard
 *
 * Research-only UI. Displays regime-stratified signal effectiveness:
 * "Is this signal effective across regimes, or only in specific conditions?"
 *
 * Does NOT display alphaScore, recommendationBucket, or L1 data.
 * Research-layer only.
 */

import React from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { CheckCircle2, AlertTriangle, Minus, Info } from 'lucide-react';
import type { RegimeStratifiedResult, RegimeDependencyLabel } from '@/lib/signals/RegimeStratifiedEngine';
import type { SignalType } from '@/lib/signals/types';
import { SIGNAL_LABELS } from '@/lib/signals/types';
import type { Metric } from '@/lib/signals/types';

// ─── Helpers ─────────────────────────────────────────────────────

function dependencyStyle(label: RegimeDependencyLabel): {
  className: string;
  icon: React.ReactNode;
  text: string;
} {
  switch (label) {
    case 'REGIME_STABLE':
      return {
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        text: '跨環境穩定',
      };
    case 'REGIME_CONDITIONAL':
      return {
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
        icon: <Minus className="h-3.5 w-3.5" />,
        text: '條件性有效',
      };
    case 'REGIME_FRAGILE':
      return {
        className: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        text: '環境依賴高',
      };
  }
}

function signedPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const REGIME_LABELS: Record<string, string> = {
  Bull: '多頭',
  Bear: '空頭',
  Neutral: '盤整',
};

// ─── Regime row ───────────────────────────────────────────────────

function RegimeRow({
  name,
  metric,
  isDominant,
}: {
  name: string;
  metric: Metric;
  isDominant: boolean;
}) {
  const label = REGIME_LABELS[name] ?? name;
  const excessPositive = (metric.excessReturn ?? 0) > 0;

  return (
    <div
      className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${
        isDominant
          ? 'border-primary/30 bg-primary/5'
          : 'border-border/20 bg-muted/10'
      }`}
    >
      <span className="font-medium w-10 shrink-0">{label}</span>
      <span className="text-muted-foreground">n={metric.sampleSize}</span>
      <span className="text-muted-foreground">命中 {pct(metric.hitRate)}</span>
      {metric.excessReturn !== undefined ? (
        <span className={excessPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
          超額 {signedPct(metric.excessReturn)}
        </span>
      ) : null}
      {metric.excessHitRate !== undefined ? (
        <span className="text-muted-foreground">超額命中 {pct(metric.excessHitRate)}</span>
      ) : null}
      {isDominant ? (
        <span className="ml-auto text-[10px] text-primary font-medium">主要</span>
      ) : null}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────

export function RegimeStratifiedCard({
  result,
  signalType,
}: {
  result: RegimeStratifiedResult;
  signalType: SignalType;
}) {
  const label = SIGNAL_LABELS[signalType];
  const ds = dependencyStyle(result.regimeDependency.consistencyLabel);

  const hasBreakdown =
    result.regimeBreakdown.bull ||
    result.regimeBreakdown.bear ||
    result.regimeBreakdown.neutral;

  if (!result.hasSufficientRegimeData || !hasBreakdown) {
    return (
      <GlassCard className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="font-medium">{label} · 環境分層</span>
          <span className="ml-auto text-[10px] italic text-muted-foreground/60">研究層 · 非交易訊號</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {result.limitations[0] ?? '環境歷史資料不足，無法執行分層分析。'}
        </p>
        {result.unknownRegimeFraction > 0 ? (
          <p className="text-[10px] text-muted-foreground/60">
            Unknown 比例: {pct(result.unknownRegimeFraction)}
          </p>
        ) : null}
      </GlassCard>
    );
  }

  const regimes: Array<{ name: string; metric: Metric }> = [];
  if (result.regimeBreakdown.bull) regimes.push({ name: 'Bull', metric: result.regimeBreakdown.bull });
  if (result.regimeBreakdown.bear) regimes.push({ name: 'Bear', metric: result.regimeBreakdown.bear });
  if (result.regimeBreakdown.neutral) regimes.push({ name: 'Neutral', metric: result.regimeBreakdown.neutral });

  return (
    <GlassCard className="p-4 space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-foreground/80">{label} · 環境分層</span>
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${ds.className}`}
        >
          {ds.icon}
          {ds.text}
        </span>
        <span className="ml-auto text-[10px] italic text-muted-foreground/60">
          {result.window} 日窗口 · 研究層
        </span>
      </div>

      {/* ── Overall summary ── */}
      <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
        <span>總樣本 {result.sampleSize}</span>
        <span>命中率 {pct(result.overall.hitRate)}</span>
        <span className={(result.overall.excessReturn ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
          超額報酬 {signedPct(result.overall.excessReturn)}
        </span>
        {result.regimeDependency.dominantRegime ? (
          <span>主要市況：{REGIME_LABELS[result.regimeDependency.dominantRegime] ?? result.regimeDependency.dominantRegime}</span>
        ) : null}
      </div>

      {/* ── Regime breakdown ── */}
      <div className="space-y-1.5">
        {regimes.map((r) => (
          <RegimeRow
            key={r.name}
            name={r.name}
            metric={r.metric}
            isDominant={result.regimeDependency.dominantRegime === r.name}
          />
        ))}
      </div>

      {/* ── Unknown fraction warning ── */}
      {result.unknownRegimeFraction > 0.2 ? (
        <div className="flex items-start gap-1.5 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-foreground/70">
            {pct(result.unknownRegimeFraction)} 觀察未能對應到已落地 regime，分層可信度有限。
          </span>
        </div>
      ) : null}

      {/* ── Limitations ── */}
      {result.limitations.length > 0 ? (
        <ul className="space-y-0.5">
          {result.limitations.slice(0, 3).map((l, i) => (
            <li key={i} className="text-[10px] text-muted-foreground">
              • {l}
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── Disclaimer ── */}
      <p className="text-[10px] text-muted-foreground/60 italic border-t border-border/20 pt-2">
        環境分層為研究層觀察，不影響 alphaScore、screen bucket 或 backtest 結果。
      </p>
    </GlassCard>
  );
}
