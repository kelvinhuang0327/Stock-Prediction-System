"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

// --- Column Definition ---
export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (item: T) => React.ReactNode;
  accessor?: (item: T) => string | number | null | undefined;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  hideOnMobile?: boolean;
}

// --- Props ---
export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: string[];
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  emptyDescription?: string;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  loading?: boolean;
  className?: string;
  toolbar?: React.ReactNode;
  getRowKey?: (item: T, index: number) => string;
}

// --- Sort State ---
interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

export function DataTable<T>({
  data,
  columns,
  searchable = false,
  searchPlaceholder = '搜尋...',
  searchKeys,
  defaultSort,
  pageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  emptyIcon,
  emptyMessage = '目前無資料',
  emptyDescription,
  onRowClick,
  rowClassName,
  loading = false,
  className,
  toolbar,
  getRowKey,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortState | null>(defaultSort ?? null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);

  // --- Search ---
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((item) => {
      const record = item as Record<string, unknown>;
      if (searchKeys) {
        return searchKeys.some((key) => {
          const val = record[key];
          return val != null && String(val).toLowerCase().includes(q);
        });
      }
      // Fallback: search all string/number columns
      return columns.some((col) => {
        const val = col.accessor ? col.accessor(item) : record[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      });
    });
  }, [data, searchQuery, searchKeys, columns]);

  // --- Sort ---
  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    const col = columns.find((c) => c.key === sort.key);
    return [...filteredData].sort((a, b) => {
      const recA = a as Record<string, unknown>;
      const recB = b as Record<string, unknown>;
      const valA = col?.accessor ? col.accessor(a) : recA[sort.key];
      const valB = col?.accessor ? col.accessor(b) : recB[sort.key];
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sort.direction === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA);
      const strB = String(valB);
      return sort.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sort, columns]);

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(sortedData.length / currentPageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedData = sortedData.slice((safePage - 1) * currentPageSize, safePage * currentPageSize);

  // Reset page when search changes
  React.useEffect(() => { setCurrentPage(1); }, [searchQuery, currentPageSize]);

  const handleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.direction === 'asc' ? { key, direction: 'desc' } : null;
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sort?.key !== columnKey) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
    return sort.direction === 'asc'
      ? <ChevronUp className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className={cn("glass-card p-4 space-y-3", className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-muted/20 rounded shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar Row */}
      {(searchable || toolbar) && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {searchable && (
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex h-9 w-full sm:w-[260px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm pl-8 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}
          {toolbar && <div className="flex gap-2 flex-wrap">{toolbar}</div>}
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/10">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-3 py-3 font-medium text-muted-foreground whitespace-nowrap",
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.hideOnMobile && 'hidden md:table-cell',
                      col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors',
                      col.headerClassName
                    )}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable && <SortIcon columnKey={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      {emptyIcon && <div className="text-3xl">{emptyIcon}</div>}
                      <p className="text-sm font-medium">{emptyMessage}</p>
                      {emptyDescription && <p className="text-xs">{emptyDescription}</p>}
                    </div>
                  </td>
                </tr>
              ) : (
                pagedData.map((item, idx) => {
                  const key = getRowKey ? getRowKey(item, idx) : idx;
                  return (
                    <tr
                      key={key}
                      className={cn(
                        "border-b border-border/30 transition-colors",
                        onRowClick && "cursor-pointer hover:bg-muted/10",
                        rowClassName?.(item)
                      )}
                      onClick={onRowClick ? () => onRowClick(item) : undefined}
                    >
                      {columns.map((col) => {
                        const record = item as Record<string, unknown>;
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "px-3 py-2.5 whitespace-nowrap",
                              col.align === 'right' && 'text-right',
                              col.align === 'center' && 'text-center',
                              col.hideOnMobile && 'hidden md:table-cell',
                              col.className
                            )}
                          >
                            {col.render
                              ? col.render(item)
                              : record[col.key] != null ? String(record[col.key]) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {sortedData.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-3 py-2 border-t border-border/30 gap-2">
            <div className="text-xs text-muted-foreground">
              共 {sortedData.length} 筆，第 {safePage}/{totalPages} 頁
            </div>
            <div className="flex items-center gap-2">
              <select
                value={currentPageSize}
                onChange={(e) => setCurrentPageSize(Number(e.target.value))}
                className="h-7 rounded border border-input bg-transparent px-2 text-xs"
              >
                {pageSizeOptions.map((s) => (
                  <option key={s} value={s}>{s} 筆/頁</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safePage <= 1}
                  className="h-7 w-7 rounded border border-input flex items-center justify-center disabled:opacity-30 hover:bg-muted/20 transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-2" />
                </button>
                <button
                  onClick={() => setCurrentPage(safePage - 1)}
                  disabled={safePage <= 1}
                  className="h-7 w-7 rounded border border-input flex items-center justify-center disabled:opacity-30 hover:bg-muted/20 transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="text-xs px-2 font-medium">{safePage}</span>
                <button
                  onClick={() => setCurrentPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                  className="h-7 w-7 rounded border border-input flex items-center justify-center disabled:opacity-30 hover:bg-muted/20 transition-colors"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safePage >= totalPages}
                  className="h-7 w-7 rounded border border-input flex items-center justify-center disabled:opacity-30 hover:bg-muted/20 transition-colors"
                >
                  <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-2" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
