'use client';

import React from 'react';
import { Trash2, Bell, Briefcase } from 'lucide-react';
import { WatchlistRowViewModel, SortConfig, ScreeningResult } from '@/types/watchlist';

interface Props {
    rows: WatchlistRowViewModel[];
    totalCount: number;
    searchQuery: string;
    sortConfig: SortConfig;
    onSearchChange: (q: string) => void;
    onSort: (key: string) => void;
    onEditHoldings: (symbol: string) => void;
    onSetAlert: (symbol: string) => void;
    onRemove: (symbol: string) => void;
}

export function WatchlistTable({
    rows, totalCount, searchQuery, sortConfig,
    onSearchChange, onSort, onEditHoldings, onSetAlert, onRemove,
}: Props) {
    const sortIndicator = (key: string) =>
        sortConfig.key === key ? (sortConfig.dir === 'asc' ? ' ↑' : ' ↓') : '';

    return (
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
            {/* Search header */}
            <div className="p-4 border-b bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-bold text-lg">自選股列表 ({totalCount})</h3>
                <div className="relative">
                    <input
                        type="search"
                        placeholder="搜尋代號或名稱..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="flex h-8 w-full sm:w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm pl-3 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/10">
                        <tr>
                            <SortableTh onClick={() => onSort('symbol')}>代號{sortIndicator('symbol')}</SortableTh>
                            <Th>股名</Th>
                            <SortableTh align="right" onClick={() => onSort('price')}>成交價{sortIndicator('price')}</SortableTh>
                            <SortableTh align="right" onClick={() => onSort('changePercent')}>漲跌幅{sortIndicator('changePercent')}</SortableTh>
                            <SortableTh align="right" className="hidden lg:table-cell" onClick={() => onSort('volume')}>成交量{sortIndicator('volume')}</SortableTh>
                            <Th align="right" className="hidden lg:table-cell">週漲跌</Th>
                            <Th align="right" className="hidden lg:table-cell">量變化</Th>
                            <SortableTh align="center" className="bg-red-50/50" onClick={() => onSort('score')}>策略評分{sortIndicator('score')}</SortableTh>
                            <Th className="bg-red-50/50">策略訊號</Th>
                            <Th className="hidden md:table-cell">分析摘要</Th>
                            <Th align="right" className="hidden lg:table-cell">持有成本</Th>
                            <Th align="right" className="bg-primary/5">庫存股數</Th>
                            <Th align="right" className="bg-primary/5">損益試算</Th>
                            <Th align="right" className="bg-primary/5">報酬率</Th>
                            <Th align="right">操作</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <WatchlistRow
                                key={row.symbol}
                                row={row}
                                onEditHoldings={() => onEditHoldings(row.symbol)}
                                onSetAlert={() => onSetAlert(row.symbol)}
                                onRemove={() => onRemove(row.symbol)}
                            />
                        ))}
                    </tbody>
                </table>
                {totalCount === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                        您的自選股列表是空的，點擊上方「加入股票」按鈕開始追蹤股票
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Row ────────────────────────────────────────────────────────

function WatchlistRow({ row, onEditHoldings, onSetAlert, onRemove }: {
    row: WatchlistRowViewModel;
    onEditHoldings: () => void;
    onSetAlert: () => void;
    onRemove: () => void;
}) {
    const isPositive = row.change >= 0;
    const colorClass = isPositive ? 'text-red-600' : 'text-green-600';
    const plColorClass = row.profitLoss >= 0 ? 'text-red-600' : 'text-green-600';
    const analysis = row.analysis;

    return (
        <tr className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
            <td className="p-4 font-medium font-mono">{row.symbol}</td>
            <td className="p-4 font-medium">{row.name}</td>
            <td className={`p-4 text-right font-bold font-mono ${colorClass}`}>{row.price}</td>
            <td className={`p-4 text-right font-medium ${colorClass}`}>
                {row.changePercent > 0 ? '+' : ''}{row.changePercent.toFixed(2)}%
            </td>
            {/* Volume */}
            <td className="p-4 text-right font-mono text-xs text-muted-foreground hidden lg:table-cell">
                {row.volume ? row.volume.toLocaleString() : '-'}
            </td>
            {/* Weekly change (DB) */}
            <td className="p-4 text-right font-mono text-xs hidden lg:table-cell">
                {row.weeklyChange !== null ? (
                    <span className={row.weeklyChange > 0 ? 'text-red-500' : row.weeklyChange < 0 ? 'text-green-500' : 'text-muted-foreground'}>
                        {row.weeklyChange > 0 ? '+' : ''}{row.weeklyChange.toFixed(2)}%
                    </span>
                ) : (
                    <span className="text-muted-foreground/40" title="尚未同步行情資料">—</span>
                )}
            </td>
            {/* Volume change (DB) */}
            <td className="p-4 text-right font-mono text-xs hidden lg:table-cell">
                {row.volumeChange !== null ? (
                    <span className={row.volumeChange > 50 ? 'text-amber-500 font-medium' : 'text-muted-foreground'}>
                        {row.volumeChange > 0 ? '+' : ''}{row.volumeChange.toFixed(0)}%
                    </span>
                ) : (
                    <span className="text-muted-foreground/40" title="尚未同步行情資料">—</span>
                )}
            </td>
            {/* Score */}
            <td className="p-4 text-center bg-red-50/20">
                <ScoreCell analysis={analysis} />
            </td>
            {/* Signal */}
            <td className="p-4 bg-red-50/20">
                <SignalCell analysis={analysis} />
            </td>
            {/* Reason */}
            <td className="p-4 hidden md:table-cell">
                {analysis ? (
                    <div className="text-[10px] text-muted-foreground max-w-[140px] truncate" title={analysis.reason}>
                        {analysis.reason || '—'}
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                )}
            </td>
            {/* Portfolio columns */}
            <td className="p-4 text-right font-mono hidden lg:table-cell">
                {row.avgCost?.toFixed(1) || '-'}
            </td>
            <td className="p-4 text-right font-mono bg-primary/5">
                {row.quantity?.toLocaleString() || '-'}
            </td>
            <td className={`p-4 text-right font-mono font-bold bg-primary/5 ${row.hasHoldings ? plColorClass : ''}`}>
                {row.hasHoldings ? (row.profitLoss > 0 ? '+' : '') + row.profitLoss.toLocaleString() : '-'}
            </td>
            <td className={`p-4 text-right font-mono font-bold bg-primary/5 ${row.hasHoldings ? plColorClass : ''}`}>
                {row.hasHoldings ? (row.profitLossPercent > 0 ? '+' : '') + row.profitLossPercent.toFixed(2) + '%' : '-'}
            </td>
            {/* Actions */}
            <td className="p-4 text-right">
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={onEditHoldings}
                        className={`p-2 rounded-full transition-colors ${row.hasHoldings ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                        title="編輯庫存"
                    >
                        <Briefcase className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onSetAlert}
                        className="p-2 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground transition-colors"
                        title="設定警示"
                    >
                        <Bell className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onRemove}
                        className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-full text-muted-foreground transition-colors"
                        title="移除"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </td>
        </tr>
    );
}

// ─── Sub-cells ──────────────────────────────────────────────────

function ScoreCell({ analysis }: { analysis: ScreeningResult | null }) {
    if (!analysis) {
        return (
            <div className="flex justify-center">
                <div className="w-5 h-5 border-2 border-red-200 border-t-red-500 animate-spin rounded-full" />
            </div>
        );
    }
    const score = analysis.calculatedScore || 0;
    const hasLimitedData = analysis.technicalScore === 0;
    return (
        <div className="flex flex-col items-center">
            <span className={`text-lg font-black ${hasLimitedData ? 'text-muted-foreground' : score >= 80 ? 'text-red-600' : 'text-amber-600'}`}>
                {score}
            </span>
            <div className="flex gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map(i => (
                    <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${i <= (score / 20) ? 'bg-red-500' : 'bg-gray-200'}`}
                    />
                ))}
            </div>
            {hasLimitedData && <span className="text-[8px] text-amber-500 mt-0.5">資料不足</span>}
        </div>
    );
}

function SignalCell({ analysis }: { analysis: ScreeningResult | null }) {
    if (!analysis) {
        return <span className="text-xs text-muted-foreground animate-pulse">分析中...</span>;
    }
    const score = analysis.calculatedScore || 0;
    return (
        <div className="flex flex-col gap-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block w-fit ${
                score >= 90 ? 'bg-red-600 text-white' :
                score >= 70 ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-600'
            }`}>
                {score >= 90 ? '極限進攻' : score >= 70 ? '可以追蹤' : '暫緩觀察'}
            </span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                {analysis.riskLevel === 'High' ? '⚠️ 高波動警告' : '✅ 波動穩定'}
            </span>
        </div>
    );
}

// ─── Table primitives ───────────────────────────────────────────

function Th({ children, align = 'left', className = '' }: { children?: React.ReactNode; align?: string; className?: string }) {
    return (
        <th className={`text-${align} p-4 font-medium text-muted-foreground ${className}`}>
            {children}
        </th>
    );
}

function SortableTh({ children, align = 'left', className = '', onClick }: { children?: React.ReactNode; align?: string; className?: string; onClick: () => void }) {
    return (
        <th
            className={`text-${align} p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground ${className}`}
            onClick={onClick}
        >
            {children}
        </th>
    );
}
