"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, CircleHelp, BarChart3 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badges';
import type {
  PeerPercentileDetailCategory,
  PeerPercentileDetailRow,
  PeerPercentileDetailTable as PeerPercentileDetailTableType,
} from '@/lib/fundamental/types';

export function PeerPercentileDetailTable({
  table,
  title = '同組百分位明細',
  compact = false,
  maxRows,
  activeCategory,
}: {
  table: PeerPercentileDetailTableType;
  title?: string;
  compact?: boolean;
  maxRows?: number;
  activeCategory?: PeerPercentileDetailCategory | null;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const categoryRefs = useRef<Partial<Record<PeerPercentileDetailCategory, HTMLTableRowElement | null>>>({});
  const open = manualOpen || Boolean(activeCategory);

  const displayRows = useMemo(() => {
    const rows = activeCategory || !maxRows ? table.rows : table.rows.slice(0, maxRows);
    return groupRows(rows);
  }, [activeCategory, maxRows, table.rows]);

  useEffect(() => {
    if (!open || !activeCategory) return;
    const target = categoryRefs.current[activeCategory];
    if (target?.scrollIntoView) {
      const schedule =
        typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame.bind(window)
          : (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
      schedule(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [activeCategory, open]);

  return (
    <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-3">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 text-left"
        onClick={() => setManualOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="space-y-1">
          <div className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {title}
          </div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            點開查看本股值、同組中位與 percentile 的逐項細節。
            {table.basis !== 'none' ? ` 基準：${table.basis}${table.peerSampleSize ? ` · ${table.peerSampleSize} 檔` : ''}` : ' 目前暫無可靠同組比較基準。'}
            {activeCategory ? ` 已聚焦：${categoryGroupLabel(activeCategory)}。` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {table.rows.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {table.rows.length} 筆
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-[11px] text-muted-foreground dark:border-amber-900/40 dark:bg-amber-950/10">
            percentile 為 `null` 代表資料不足或樣本無法穩定計算，不表示本股表現差。
            若 peer sample 很少，請先看 limitations 與 basis，再解讀 PR。
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/20 bg-background/60">
            <table className={`min-w-full ${compact ? 'text-[11px]' : 'text-xs'}`}>
              <thead className="bg-muted/30">
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">類別</th>
                  <th className="px-3 py-2 font-medium">指標</th>
                  <th className="px-3 py-2 font-medium">本股</th>
                  <th className="px-3 py-2 font-medium">同組中位</th>
                  <th className="px-3 py-2 font-medium">百分位</th>
                  <th className="px-3 py-2 font-medium">解讀</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(({ category, rows }) => (
                  <React.Fragment key={category}>
                    <tr
                      ref={(el) => {
                        categoryRefs.current[category] = el;
                      }}
                      className={[
                        'border-t border-border/15',
                        activeCategory === category ? 'bg-primary/5' : 'bg-muted/20',
                      ].join(' ')}
                    >
                      <td colSpan={6} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <CategoryBadge category={category} />
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {categoryGroupLabel(category)}
                            </span>
                          </div>
                          {activeCategory === category && (
                            <span className="text-[10px] font-medium text-primary">目前聚焦</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {rows.map((row) => (
                      <tr
                        key={row.key}
                        className={[
                          'border-t border-border/10 align-top',
                          activeCategory === category ? 'bg-primary/5' : '',
                        ].join(' ')}
                      >
                        <td className="px-3 py-2">
                          <CategoryBadge category={row.category} />
                        </td>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{row.label}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{formatRowValue(row.value, row.displayUnit)}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{formatRowValue(row.median, row.displayUnit)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <PercentileBadge percentile={row.percentile} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground leading-relaxed">
                          <div>{row.interpretation}</div>
                          {row.limitations && row.limitations.length > 0 && row.percentile === null && (
                            <div className="mt-1 text-[10px]">
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                <CircleHelp className="h-3 w-3" />
                                {row.limitations[0]}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {table.limitations.length > 0 && (
            <div className="rounded-lg border border-border/20 bg-background/50 p-3">
              <div className="text-xs font-medium text-muted-foreground">細表限制</div>
              <ul className="mt-2 space-y-1">
                {table.limitations.slice(0, compact ? 3 : 5).map((item) => (
                  <li key={item} className="text-[11px] text-muted-foreground">• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryBadge({
  category,
}: {
  category: PeerPercentileDetailCategory | string;
}) {
  const map: Record<string, string> = {
    growth: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    valuation: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    financialStructure: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
    efficiency: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  };
  const labelMap: Record<string, string> = {
    growth: '成長',
    valuation: '估值',
    financialStructure: '財務體質',
    efficiency: '效率',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${map[category] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
      {labelMap[category] ?? category}
    </span>
  );
}

function categoryGroupLabel(category: PeerPercentileDetailCategory): string {
  switch (category) {
    case 'growth':
      return '成長 / 獲利';
    case 'valuation':
      return '估值';
    case 'financialStructure':
      return '財務體質';
    case 'efficiency':
      return '經營效率';
    default:
      return category;
  }
}

function groupRows(rows: PeerPercentileDetailRow[]): Array<{ category: PeerPercentileDetailCategory; rows: PeerPercentileDetailRow[] }> {
  const order: PeerPercentileDetailCategory[] = ['growth', 'valuation', 'financialStructure', 'efficiency'];
  const grouped = new Map<PeerPercentileDetailCategory, PeerPercentileDetailRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.category) ?? [];
    list.push(row);
    grouped.set(row.category, list);
  }

  return order
    .filter((category) => grouped.has(category))
    .map((category) => ({ category, rows: grouped.get(category) ?? [] }));
}

function PercentileBadge({
  percentile,
}: {
  percentile: number | null;
}) {
  if (percentile === null || Number.isNaN(percentile)) {
    return (
      <StatusBadge status="degraded" label="資料不足" className="text-[10px] px-2 py-0.5" />
    );
  }

  const tone =
    percentile >= 70
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
      : percentile <= 30
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

  const label =
    percentile > 80
      ? '同組相對偏強'
      : percentile < 40
        ? '同組偏弱'
        : '同組中性';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>
      PR {percentile} · {label}
    </span>
  );
}

function formatRowValue(
  value: number | null,
  displayUnit: 'percent' | 'ratio' | 'currency' | 'number' | undefined,
): string {
  if (value === null || Number.isNaN(value)) return '—';
  const formatted = value.toLocaleString('zh-TW', {
    minimumFractionDigits: displayUnit === 'number' ? 2 : 2,
    maximumFractionDigits: displayUnit === 'number' ? 2 : 2,
  });
  if (displayUnit === 'percent') return `${formatted}%`;
  return formatted;
}
