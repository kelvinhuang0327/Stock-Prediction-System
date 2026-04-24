"use client";

/**
 * SignalDisagreementCard
 *
 * Research-only UI component. Displays the output of SignalDisagreementEngine.
 *
 * This card does NOT display alphaScore, recommendationBucket, or any L1 data.
 * It only surfaces "how consistent are the sub-scores with each other?"
 *
 * Design principles:
 * - Subtle by default: does not override the main analysis view
 * - Explicit research framing: header, disclaimer, research-only label
 * - Graceful degraded display: shows a minimal state when data is insufficient
 */

import React from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { AlertTriangle, CheckCircle2, Info, Minus } from 'lucide-react';
import type {
  AdjustedConfidenceLabel,
  DisagreementLevel,
  DisagreementOverlay,
} from '@/lib/signals/SignalDisagreementEngine';

// ─── Level display helpers ────────────────────────────────────────

function levelStyle(level: DisagreementLevel): {
  label: string;
  className: string;
  icon: React.ReactNode;
} {
  switch (level) {
    case 'LOW':
      return {
        label: '一致性高',
        className:
          'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      };
    case 'MODERATE':
      return {
        label: '部分分歧',
        className:
          'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
        icon: <Minus className="h-3.5 w-3.5" />,
      };
    case 'HIGH':
      return {
        label: '明顯衝突',
        className:
          'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
      };
  }
}

function confidenceStyle(label: AdjustedConfidenceLabel): {
  text: string;
  className: string;
} {
  switch (label) {
    case 'HIGH':
      return {
        text: '研究層可信度：高',
        className: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'MEDIUM':
      return {
        text: '研究層可信度：中等',
        className: 'text-amber-600 dark:text-amber-400',
      };
    case 'LOW':
      return {
        text: '研究層可信度：偏低',
        className: 'text-orange-600 dark:text-orange-400',
      };
    case 'VERY_LOW':
      return {
        text: '研究層可信度：低（多項限制）',
        className: 'text-red-600 dark:text-red-400',
      };
  }
}

// ─── Component ───────────────────────────────────────────────────

export function SignalDisagreementCard({
  overlay,
}: {
  overlay: DisagreementOverlay;
}) {
  const level = levelStyle(overlay.disagreementLevel);
  const conf = confidenceStyle(overlay.adjustedConfidenceLabel);

  if (overlay.isDegraded) {
    return (
      <GlassCard className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="font-medium">評分一致性分析</span>
          <span className="ml-auto text-[10px] text-muted-foreground/60 italic">研究層 · 非交易訊號</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {overlay.cautionReasons[0] ?? '資料不足，無法計算一致性。'}
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4 space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-foreground/80">
          評分一致性分析
        </span>
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${level.className}`}
        >
          {level.icon}
          {level.label}
        </span>
        <span className={`ml-auto text-xs font-medium ${conf.className}`}>
          {conf.text}
        </span>
      </div>

      {/* ── Score breakdown ── */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="text-center">
          <div className="text-2xl font-bold font-mono">
            {Math.round(overlay.disagreementScore * 100)}
          </div>
          <div className="text-[10px] text-muted-foreground">衝突指數 /100</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {overlay.activeScores.map((s) => (
            <div
              key={s.name}
              className="text-center rounded-lg bg-muted/10 border border-border/20 px-3 py-1.5 min-w-[64px]"
            >
              <div className="text-xs text-muted-foreground">{s.name}</div>
              <div className="text-sm font-semibold font-mono mt-0.5">
                {s.value.toFixed(0)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Caution reasons ── */}
      {overlay.cautionReasons.length > 0 && (
        <div className="space-y-1">
          {overlay.cautionReasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-foreground/70">{reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Limitations ── */}
      {overlay.limitations.length > 0 && (
        <ul className="space-y-0.5">
          {overlay.limitations.map((l, i) => (
            <li key={i} className="text-[11px] text-muted-foreground">
              • {l}
            </li>
          ))}
        </ul>
      )}

      {/* ── Disclaimer ── */}
      <p className="text-[10px] text-muted-foreground/60 italic border-t border-border/20 pt-2">
        此分析為研究層觀察，反映子分數內部一致性，不修改核心評分，不構成交易建議。
      </p>
    </GlassCard>
  );
}
