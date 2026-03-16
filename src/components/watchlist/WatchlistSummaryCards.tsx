'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { PortfolioSummary } from '@/types/watchlist';

interface Props {
    summary: PortfolioSummary;
}

export function WatchlistSummaryCards({ summary }: Props) {
    return (
        <>
            {/* Daily Strategic Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-600 text-white p-6 rounded-xl shadow-md relative overflow-hidden">
                    <Zap className="absolute -right-4 -top-4 w-24 h-24 opacity-10" />
                    <div className="relative z-10">
                        <div className="text-red-100 text-sm font-bold mb-1 italic">每日進攻建議</div>
                        <div className="text-3xl font-black mb-1">
                            {summary.attackCount} 檔標的
                        </div>
                        <div className="text-xs text-red-100">當前滿足「30/30/30」極限位階</div>
                    </div>
                </div>

                <div className="bg-card p-6 rounded-xl border shadow-sm flex flex-col justify-center">
                    <div className="text-muted-foreground text-sm mb-1 uppercase tracking-wider font-bold">追蹤中標的</div>
                    <div className="text-3xl font-black font-mono">{summary.stockCount}</div>
                </div>

                <div className="bg-card p-6 rounded-xl border shadow-sm flex flex-col justify-center">
                    <div className="text-muted-foreground text-sm mb-1 uppercase tracking-wider font-bold">數據健康度</div>
                    <div className="flex items-center gap-2">
                        <div className="text-3xl font-black font-mono text-green-600">優</div>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">100% 同步</span>
                    </div>
                </div>
            </div>

            {/* Portfolio Summary */}
            {summary.totalValue > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <SummaryCard label="總庫存市值" value={`$${summary.totalValue.toLocaleString()}`} />
                    <SummaryCard label="總投資成本" value={`$${summary.totalCost.toLocaleString()}`} />
                    <SummaryCard
                        label="未實現損益"
                        value={`${summary.totalPL > 0 ? '+' : ''}${summary.totalPL.toLocaleString()}`}
                        colorClass={summary.totalPL >= 0 ? 'text-red-600' : 'text-green-600'}
                    />
                    <SummaryCard
                        label="報酬率"
                        value={`${summary.totalPLPercent > 0 ? '+' : ''}${summary.totalPLPercent.toFixed(2)}%`}
                        colorClass={summary.totalPLPercent >= 0 ? 'text-red-600' : 'text-green-600'}
                    />
                </div>
            )}
        </>
    );
}

function SummaryCard({ label, value, colorClass = '' }: { label: string; value: string; colorClass?: string }) {
    return (
        <div className="bg-card p-4 rounded-xl border shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">{label}</div>
            <div className={`text-2xl font-bold font-mono ${colorClass}`}>{value}</div>
        </div>
    );
}
