'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { PortfolioSummary } from '@/types/watchlist';
import { useApiData } from '@/hooks/useApiData';
import { MarketRegimeBadge, MarketRegimeData } from '@/components/ui/market-regime';

const REGIME_SUMMARY: Record<string, string> = {
    Bull: '目前大盤環境偏多，技術轉強訊號可信度較高',
    Bear: '目前大盤偏空，買進訊號需保守解讀',
    Sideways: '大盤盤整中，突破訊號需搭配量能確認',
    Unknown: '市場環境資料不足，個股分析應保守解讀',
};

interface Props {
    summary: PortfolioSummary;
}

export function WatchlistSummaryCards({ summary }: Props) {
    const { data: regimeData } = useApiData<MarketRegimeData>('/api/market/regime');

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
                    <div className="text-muted-foreground text-sm mb-2 uppercase tracking-wider font-bold">市場環境</div>
                    {regimeData ? (
                        <div className="space-y-1.5">
                            <MarketRegimeBadge regime={regimeData.regime} confidence={regimeData.confidence} />
                            <div className="text-[10px] text-muted-foreground">
                                {REGIME_SUMMARY[regimeData.regime] || REGIME_SUMMARY.Unknown}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">載入中...</div>
                    )}
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
