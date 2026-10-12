'use client';

import React from 'react';
import { AlertTriangle, Database, RefreshCw, Clock, BarChart3 } from 'lucide-react';

type Mode = 'full' | 'limited' | 'unavailable';

interface DataAvailabilityGuardProps {
  mode: Mode;
  message: string;
  missing?: string[];
  children: React.ReactNode;
  showInLimited?: boolean;
}

interface DataStatusBarProps {
  mode: Mode;
  coverage?: { stocks: number; total: number };
  lastUpdated?: string;
  limitations?: string[];
}

/**
 * DataAvailabilityGuard - 資料可用性守衛元件
 */
export function DataAvailabilityGuard({
  mode,
  message,
  missing = [],
  children,
  showInLimited = true,
}: DataAvailabilityGuardProps) {
  if (mode === 'unavailable') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Database className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-semibold text-muted-foreground mb-2">
          資料尚未就緒
        </h3>
        <p className="text-sm text-muted-foreground/70 text-center max-w-md mb-4">
          {message}
        </p>
        {missing.length > 0 && (
          <div className="text-xs text-muted-foreground/50 bg-muted/30 rounded-lg px-4 py-2">
            缺少資料: {missing.join(', ')}
          </div>
        )}
        <p className="text-xs text-muted-foreground/40 mt-4">
          請先執行資料同步後再使用此功能
        </p>
      </div>
    );
  }

  if (mode === 'limited' && showInLimited) {
    return (
      <>
        <div className="mx-4 mb-3 p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              精簡模式
            </p>
            <p className="text-[10px] text-amber-600/80 dark:text-amber-400/60 mt-0.5">
              {message}
            </p>
          </div>
        </div>
        {children}
      </>
    );
  }

  return <>{children}</>;
}

/** 資料狀態列 — 在頁面頂端顯示覆蓋率、最後更新時間、限制條件 */
export function DataStatusBar({ mode, coverage, lastUpdated, limitations }: DataStatusBarProps) {
  const modeColors = {
    full: 'text-emerald-500',
    limited: 'text-amber-500',
    unavailable: 'text-red-500',
  };
  const modeLabels = {
    full: '完整模式',
    limited: '精簡模式',
    unavailable: '資料不足',
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[10px] text-muted-foreground/60 border-b border-border/30">
      <span className={`font-medium ${modeColors[mode]}`}>
        {modeLabels[mode]}
      </span>
      {coverage && (
        <span className="flex items-center gap-1">
          <BarChart3 className="w-3 h-3" />
          覆蓋 {coverage.stocks}/{coverage.total} 檔
        </span>
      )}
      {lastUpdated && (
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          最後更新: {lastUpdated}
        </span>
      )}
      {limitations && limitations.length > 0 && (
        <span className="flex items-center gap-1 text-amber-500/70">
          <AlertTriangle className="w-3 h-3" />
          {limitations[0]}
          {limitations.length > 1 && ` (+${limitations.length - 1})`}
        </span>
      )}
    </div>
  );
}

/** 單一欄位的資料不可用提示 */
export function DataUnavailable({ field }: { field?: string }) {
  return (
    <span className="text-muted-foreground/40 text-xs" title={field ? `${field} 資料不可用` : '資料不可用'}>
      —
    </span>
  );
}

/** 建議同步資料的提示 */
export function DataSyncPrompt({ dataSource }: { dataSource: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground/60 py-1">
      <RefreshCw className="w-3 h-3" />
      <span>需同步 {dataSource} 資料</span>
    </div>
  );
}
