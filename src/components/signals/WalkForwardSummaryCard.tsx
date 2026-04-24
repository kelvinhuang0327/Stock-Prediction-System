"use client";

/**
 * WalkForwardSummaryCard
 *
 * Research-only UI component. Displays the output of WalkForwardValidator.
 *
 * Shows a two-column comparison (前半 / 後半) of signal effectiveness
 * across chronological periods, alongside a consistency label.
 *
 * This card does NOT display alphaScore, recommendationBucket, or L1 data.
 * Research-layer only.
 */

import React from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { CheckCircle2, AlertTriangle, Minus, Info } from 'lucide-react';
import type { WalkForwardResult, WalkForwardPeriod } from '@/lib/signals/WalkForwardValidator';
import type { SignalType } from '@/lib/signals/types';
import { SIGNAL_LABELS } from '@/lib/signals/types';

// ─── Helpers ─────────────────────────────────────────────────────

function consistencyStyle(label: 'STABLE' | 'MIXED' | 'UNSTABLE'): {
  className: string;
  icon: React.ReactNode;
  text: string;
} {
  switch (label) {
    case 'STABLE':
      return {
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        text: '跨期穩定',
      };
    case 'MIXED':
      return {
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
        icon: <Minus className="h-3.5 w-3.5" />,
        text: '部分穩定',
      };
    case 'UNSTABLE':
      return {
        className: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        text: '不穩定',
      };
  }
}

function signedPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}

// ─── Period Column ────────────────────────────────────────────────

function PeriodColumn({ period }: { period: WalkForwardPeriod }) {
  return (
    <div className="flex-1 rounded-lg bg-muted/10 border border-border/20 px-3 py-2.5 space-y-1.5">
      <div className="text-[11px] font-semibold text-muted-foreground">{period.label}</div>
      {period.start ? (
        <div className="text-[10px] text-muted-foreground/60">
          {period.start} → {period.end}
        </div>
      ) : null}
      <div className="space-y-1 pt-0.5">
        <Row label="樣本數" value={String(period.sampleSize)} />
        <Row label="命中率" value={`${(period.hitRate * 100).toFixed(1)}%`} />
        <Row label="超額報酬" value={signedPct(period.excessReturn)} />
        {period.excessHitRate !== undefined ? (
          <Row label="超額命中率" value={`${(period.excessHitRate * 100).toFixed(1)}%`} />
        ) : null}
        <Row label="分類" value={period.classification} mono />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span
        className={`text-[11px] font-medium ${mono ? 'font-mono text-foreground/80' : 'text-foreground/80'}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────

export function WalkForwardSummaryCard({
  result,
  signalType,
}: {
  result: WalkForwardResult;
  signalType: SignalType;
}) {
  const label = SIGNAL_LABELS[signalType];
  const cs = consistencyStyle(result.consistency.overallLabel);

  if (!result.hasSufficientData) {
    return (
      <GlassCard className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="font-medium">{label} · 走勢驗證</span>
          <span className="ml-auto text-[10px] italic text-muted-foreground/60">研究層 · 非交易訊號</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {result.limitations[0] ?? '資料不足，無法執行走勢驗證。'}
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4 space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-foreground/80">{label} · 走勢驗證</span>
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cs.className}`}
        >
          {cs.icon}
          {cs.text}
        </span>
        <span className="ml-auto text-[10px] italic text-muted-foreground/60">
          {result.window} 日窗口 · 研究層
        </span>
      </div>

      {/* ── Period comparison ── */}
      <div className="flex gap-2">
        <PeriodColumn period={result.firstHalf} />
        <PeriodColumn period={result.secondHalf} />
      </div>

      {/* ── Consistency details ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          命中率偏差: {(result.consistency.hitRateDeviation * 100).toFixed(1)}%
        </span>
        <span>
          分類一致:{' '}
          <span className={result.consistency.classificationMatch ? 'text-emerald-500' : 'text-red-500'}>
            {result.consistency.classificationMatch ? '是' : '否'}
          </span>
        </span>
        <span>
          超額方向一致:{' '}
          <span
            className={result.consistency.excessReturnSignMatch ? 'text-emerald-500' : 'text-red-500'}
          >
            {result.consistency.excessReturnSignMatch ? '是' : '否'}
          </span>
        </span>
      </div>

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
        走勢驗證為研究層觀察，不影響 alphaScore、screen bucket 或 backtest 結果。
      </p>
    </GlassCard>
  );
}
