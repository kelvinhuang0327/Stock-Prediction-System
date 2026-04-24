"use client";

/**
 * ConfidenceReadinessCard
 *
 * Research-only UI. Answers:
 * "Is this confidence value a calibrated probability, or a heuristic proxy?"
 *
 * Does NOT display alphaScore, recommendationBucket, or any L1 value.
 * Research-layer only.
 */

import React from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { CheckCircle2, AlertTriangle, Info, HelpCircle } from 'lucide-react';
import {
  assessAllConfidenceReadiness,
  CONFIDENCE_TYPE_LABELS,
} from '@/lib/calibration/ConfidenceReadinessEngine';
import type {
  CalibrationStatus,
  ConfidenceReadinessInput,
  ConfidenceReadinessResult,
} from '@/lib/calibration/ConfidenceReadinessEngine';

// ─── Helpers ─────────────────────────────────────────────────────

function statusStyle(status: CalibrationStatus): {
  className: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'CALIBRATED':
      return {
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      };
    case 'PARTIAL':
      return {
        className: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400',
        icon: <Info className="h-3.5 w-3.5" />,
      };
    case 'INSUFFICIENT_DATA':
      return {
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
        icon: <HelpCircle className="h-3.5 w-3.5" />,
      };
    case 'UNCALIBRATED':
      return {
        className: 'bg-muted/40 text-muted-foreground',
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
      };
  }
}

// ─── Single module row ────────────────────────────────────────────

function ReadinessRow({ result }: { result: ConfidenceReadinessResult }) {
  const style = statusStyle(result.calibrationStatus);
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="border border-border/20 rounded-lg bg-muted/5 text-xs">
      {/* ── Summary row ── */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/10 transition-colors rounded-lg"
      >
        <span className="font-medium text-foreground/80 truncate flex-1">
          {result.moduleId}
        </span>
        <span className="text-muted-foreground shrink-0">
          {CONFIDENCE_TYPE_LABELS[result.confidenceType]}
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium shrink-0 ${style.className}`}
        >
          {style.icon}
          {result.readinessLabel}
        </span>
        {result.brierLikeScore !== undefined ? (
          <span className="text-muted-foreground shrink-0">
            Brier {result.brierLikeScore.toFixed(4)}
          </span>
        ) : null}
        <span className="ml-1 text-muted-foreground/60">{expanded ? '▾' : '▸'}</span>
      </button>

      {/* ── Expanded detail ── */}
      {expanded ? (
        <div className="px-3 pb-3 space-y-2 border-t border-border/20 pt-2">
          <p className="text-muted-foreground leading-relaxed">{result.explanation}</p>
          {result.requirementNote ? (
            <p className="text-muted-foreground/70 italic">{result.requirementNote}</p>
          ) : null}
          {result.limitations.length > 0 ? (
            <ul className="space-y-0.5">
              {result.limitations.map((l, i) => (
                <li key={i} className="text-[10px] text-muted-foreground">
                  • {l}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────

export function ConfidenceReadinessCard({
  inputs,
}: {
  inputs: ConfidenceReadinessInput[];
}) {
  const results = assessAllConfidenceReadiness(inputs);

  if (results.length === 0) return null;

  // Summary counts for header
  const calibratedCount = results.filter((r) => r.calibrationStatus === 'CALIBRATED').length;
  const partialCount = results.filter((r) => r.calibrationStatus === 'PARTIAL').length;
  const uncalibratedCount = results.filter(
    (r) => r.calibrationStatus === 'UNCALIBRATED' || r.calibrationStatus === 'INSUFFICIENT_DATA',
  ).length;

  return (
    <GlassCard className="p-4 space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-foreground/80">信心值校準狀態</span>
        <span className="ml-auto text-[10px] italic text-muted-foreground/60">研究層 · 非交易訊號</span>
      </div>

      {/* ── Status summary ── */}
      <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
        {calibratedCount > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400">已校準 {calibratedCount}</span>
        ) : null}
        {partialCount > 0 ? (
          <span className="text-sky-600 dark:text-sky-400">部分指標 {partialCount}</span>
        ) : null}
        {uncalibratedCount > 0 ? (
          <span>未校準 / 資料不足 {uncalibratedCount}</span>
        ) : null}
      </div>

      {/* ── Module rows ── */}
      <div className="space-y-1.5">
        {results.map((r) => (
          <ReadinessRow key={r.moduleId} result={r} />
        ))}
      </div>

      {/* ── Disclaimer ── */}
      <p className="text-[10px] text-muted-foreground/60 italic border-t border-border/20 pt-2">
        校準狀態為研究層分析，不影響 alphaScore、screen bucket 或 backtest 結果。
        「未校準」不代表訊號無效，僅說明信心值的計算方式為啟發式代理，而非機率校準。
      </p>
    </GlassCard>
  );
}
