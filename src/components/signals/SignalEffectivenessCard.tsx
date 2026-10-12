"use client";

import React from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { SIGNAL_LABELS, type SignalClassification, type SignalType } from '@/lib/signals/types';

interface RegimeMetricView {
  sampleSize: number;
  avgReturn: number;
  hitRate: number;
}

interface SignalEffectivenessView {
  signalType: SignalType;
  window: 3 | 5 | 10;
  sampleSize: number;
  hitRate: number;
  /** Fraction of obs where forward return beat the market benchmark */
  excessHitRate?: number;
  avgReturn: number;
  excessReturn: number;
  volatility: number;
  stabilityScore: number;
  /**
   * Brier-like MSE (0–1; lower is better).
   * Only present when BRIER_ADJACENT calibration metric is available.
   */
  brierLikeScore?: number;
  classification: SignalClassification;
  regimeBreakdown: {
    bull?: RegimeMetricView;
    bear?: RegimeMetricView;
    neutral?: RegimeMetricView;
  };
  persistence: {
    avgDuration: number;
    continuationRate: number;
  };
  limitations: string[];
}

function clsStyle(c: SignalClassification): { label: string; className: string } {
  switch (c) {
    case 'STRONG_SIGNAL':
      return { label: 'STRONG_SIGNAL', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' };
    case 'CONDITIONAL_SIGNAL':
      return { label: 'CONDITIONAL_SIGNAL', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' };
    case 'WEAK_SIGNAL':
      return { label: 'WEAK_SIGNAL', className: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' };
    default:
      return { label: 'NOISE', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
  }
}

function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function signedPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;
}

export function SignalEffectivenessCard({
  title,
  effectiveness,
}: {
  title?: string;
  effectiveness: SignalEffectivenessView;
}) {
  const badge = clsStyle(effectiveness.classification);

  return (
    <GlassCard className="p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
        <span className="text-xs text-muted-foreground">{SIGNAL_LABELS[effectiveness.signalType] ?? effectiveness.signalType} · {effectiveness.window} 日窗口</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div className="rounded-lg border border-border/40 p-2">
          <div className="text-muted-foreground">樣本數</div>
          <div className="font-semibold mt-1">{effectiveness.sampleSize}</div>
        </div>
        <div className="rounded-lg border border-border/40 p-2">
          <div className="text-muted-foreground">Hit Rate</div>
          <div className="font-semibold mt-1">{pct(effectiveness.hitRate)}</div>
          {effectiveness.excessHitRate !== undefined ? (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              超額命中 {pct(effectiveness.excessHitRate)}
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-border/40 p-2">
          <div className="text-muted-foreground">平均報酬</div>
          <div className="font-semibold mt-1">{signedPct(effectiveness.avgReturn)}</div>
        </div>
        <div className="rounded-lg border border-border/40 p-2">
          <div className="text-muted-foreground">相對大盤超額</div>
          <div className="font-semibold mt-1">{signedPct(effectiveness.excessReturn)}</div>
        </div>
        <div className="rounded-lg border border-border/40 p-2">
          <div className="text-muted-foreground">波動度</div>
          <div className="font-semibold mt-1">{pct(effectiveness.volatility)}</div>
        </div>
      </div>

      {effectiveness.brierLikeScore !== undefined ? (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="shrink-0">Brier-like MSE：</span>
          <span className={
            effectiveness.brierLikeScore < 0.15
              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
              : effectiveness.brierLikeScore < 0.25
                ? 'text-amber-600 dark:text-amber-400 font-medium'
                : 'text-red-500 font-medium'
          }>
            {effectiveness.brierLikeScore.toFixed(4)}
          </span>
          <span className="text-muted-foreground/60">
            （{effectiveness.brierLikeScore < 0.15 ? '偏低·穩定' : effectiveness.brierLikeScore < 0.25 ? '中等' : '偏高·不穩定'}）
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-border/40 p-2">
          <div className="text-muted-foreground">Bull</div>
          <div className="mt-1">
            {effectiveness.regimeBreakdown.bull
              ? `n=${effectiveness.regimeBreakdown.bull.sampleSize} / ${signedPct(effectiveness.regimeBreakdown.bull.avgReturn)}`
              : 'insufficient'}
          </div>
        </div>
        <div className="rounded-lg border border-border/40 p-2">
          <div className="text-muted-foreground">Bear</div>
          <div className="mt-1">
            {effectiveness.regimeBreakdown.bear
              ? `n=${effectiveness.regimeBreakdown.bear.sampleSize} / ${signedPct(effectiveness.regimeBreakdown.bear.avgReturn)}`
              : 'insufficient'}
          </div>
        </div>
        <div className="rounded-lg border border-border/40 p-2">
          <div className="text-muted-foreground">Neutral</div>
          <div className="mt-1">
            {effectiveness.regimeBreakdown.neutral
              ? `n=${effectiveness.regimeBreakdown.neutral.sampleSize} / ${signedPct(effectiveness.regimeBreakdown.neutral.avgReturn)}`
              : 'insufficient'}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        持續性：平均 {effectiveness.persistence.avgDuration.toFixed(1)} 天；延續率 {pct(effectiveness.persistence.continuationRate)}；
        穩定度 {effectiveness.stabilityScore.toFixed(2)}
      </p>

      {effectiveness.limitations.length > 0 && (
        <ul className="space-y-0.5">
          {effectiveness.limitations.slice(0, 4).map((l, i) => (
            <li key={i} className="text-[11px] text-muted-foreground">• {l}</li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-muted-foreground/60 italic border-t border-border/20 pt-2">
        訊號有效性為歷史統計觀察，不構成預測或投資建議。
      </p>
    </GlassCard>
  );
}
