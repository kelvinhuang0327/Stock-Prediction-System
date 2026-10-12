"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Info, Database } from 'lucide-react';

interface DisclaimerProps {
  source?: string;
  methodology?: string;
  warning?: string;
  className?: string;
  variant?: 'compact' | 'detailed';
}

/**
 * 資料來源、計算依據、免責聲明標示元件。
 * 所有分析頁面必須使用此元件。
 */
export function Disclaimer({
  source,
  methodology,
  warning = '本頁資訊為模型推估結果，僅供參考，不構成投資建議。',
  className,
  variant = 'compact',
}: DisclaimerProps) {
  if (variant === 'compact') {
    return (
      <div className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground px-3 py-2 rounded-lg bg-muted/10 border border-border/30",
        className
      )}>
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />
          {warning}
        </span>
        {source && (
          <span className="inline-flex items-center gap-1">
            <Database className="w-3 h-3 shrink-0" />
            資料來源：{source}
          </span>
        )}
        {methodology && (
          <span className="inline-flex items-center gap-1">
            <Info className="w-3 h-3 shrink-0" />
            計算依據：{methodology}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "space-y-2 p-4 rounded-lg bg-muted/10 border border-border/30 text-sm",
      className
    )}>
      <div className="flex items-center gap-2 text-yellow-500 font-medium">
        <AlertTriangle className="w-4 h-4" />
        免責聲明
      </div>
      <p className="text-muted-foreground text-xs">{warning}</p>
      {source && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Database className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div><span className="font-medium text-foreground/70">資料來源：</span>{source}</div>
        </div>
      )}
      {methodology && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div><span className="font-medium text-foreground/70">計算依據：</span>{methodology}</div>
        </div>
      )}
    </div>
  );
}

/** Inline methodology tag for individual data points */
export function MethodologyTag({ label, detail }: { label: string; detail: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/20 px-1.5 py-0.5 rounded cursor-help"
      title={detail}
    >
      <Info className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
