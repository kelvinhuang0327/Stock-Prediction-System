"use client";

import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Activity, TrendingUp } from 'lucide-react';
import { stockService } from '@/lib/stockService';

export function MarketBreadth() {
    const [breadth, setBreadth] = useState<any>(null);
    const [foreignData, setForeignData] = useState<any>(null);
    const [volumeLeaders, setVolumeLeaders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [breadthData, foreign, leaders] = await Promise.all([
            stockService.getMarketBreadth(),
            stockService.getForeignInvestorData(),
            stockService.getVolumeLeaders(5),
        ]);
        setBreadth(breadthData);
        setForeignData(foreign);
        setVolumeLeaders(leaders);
        setLoading(false);
    };

    if (loading || !breadth) {
        return (
            <div className="bg-card rounded-xl shadow-sm border p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-muted rounded w-1/3"></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-20 bg-muted rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const advanceDeclineRatio = (breadth.advancing / breadth.declining).toFixed(2);
    const marketSentiment = breadth.advancing > breadth.declining ? 'bullish' : 'bearish';

    return (
        <div className="space-y-4">
            {/* Market Breadth Stats */}
            <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-lg">市場廣度 Market Breadth</h3>
                </div>

                <div className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        {/* Advancing */}
                        <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 border border-red-200 dark:border-red-900">
                            <div className="flex items-center gap-2 mb-2">
                                <ArrowUp className="w-4 h-4 text-red-600" />
                                <span className="text-sm text-muted-foreground">上漲家數</span>
                            </div>
                            <div className="text-2xl font-bold text-red-600">{breadth.advancing}</div>
                        </div>

                        {/* Declining */}
                        <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 border border-green-200 dark:border-green-900">
                            <div className="flex items-center gap-2 mb-2">
                                <ArrowDown className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-muted-foreground">下跌家數</span>
                            </div>
                            <div className="text-2xl font-bold text-green-600">{breadth.declining}</div>
                        </div>

                        {/* Unchanged */}
                        <div className="bg-muted/50 rounded-lg p-4 border">
                            <div className="text-sm text-muted-foreground mb-2">平盤家數</div>
                            <div className="text-2xl font-bold">{breadth.unchanged}</div>
                        </div>

                        {/* A/D Ratio */}
                        <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                            <div className="text-sm text-muted-foreground mb-2">漲跌比</div>
                            <div className="text-2xl font-bold text-primary">{advanceDeclineRatio}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {marketSentiment === 'bullish' ? '多頭' : '空頭'}
                            </div>
                        </div>
                    </div>

                    {/* New Highs/Lows */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-background rounded-lg p-3 border">
                            <div className="text-sm text-muted-foreground mb-1">創新高</div>
                            <div className="text-xl font-bold text-red-600">{breadth.newHighs} 檔</div>
                        </div>
                        <div className="bg-background rounded-lg p-3 border">
                            <div className="text-sm text-muted-foreground mb-1">創新低</div>
                            <div className="text-xl font-bold text-green-600">{breadth.newLows} 檔</div>
                        </div>
                    </div>

                    {/* Foreign Investor */}
                    {foreignData && (
                        <div className={`rounded-lg p-4 border ${foreignData.trend === 'buying'
                                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                                : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                            }`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-muted-foreground mb-1">外資買賣超</div>
                                    <div className={`text-2xl font-bold ${foreignData.trend === 'buying' ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                        {foreignData.netBuy > 0 ? '+' : ''}
                                        {foreignData.netBuy.toLocaleString()} 億
                                    </div>
                                </div>
                                <div className="text-right text-sm">
                                    <div className="text-muted-foreground">買進: {foreignData.buyAmount.toLocaleString()} 億</div>
                                    <div className="text-muted-foreground">賣出: {foreignData.sellAmount.toLocaleString()} 億</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Volume Leaders */}
            <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-lg">成交量排行 Volume Leaders</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/10">
                                <th className="text-left p-3 font-medium text-muted-foreground">股名/代號</th>
                                <th className="text-right p-3 font-medium text-muted-foreground">成交價</th>
                                <th className="text-right p-3 font-medium text-muted-foreground">漲跌幅</th>
                                <th className="text-right p-3 font-medium text-muted-foreground">成交量</th>
                            </tr>
                        </thead>
                        <tbody>
                            {volumeLeaders.map((stock) => {
                                const isPositive = stock.change >= 0;
                                const colorClass = isPositive ? 'text-red-600' : 'text-green-600';

                                return (
                                    <tr key={stock.symbol} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                        <td className="p-3">
                                            <div className="font-bold">{stock.name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{stock.symbol}</div>
                                        </td>
                                        <td className={`p-3 text-right font-bold font-mono ${colorClass}`}>
                                            {stock.price}
                                        </td>
                                        <td className={`p-3 text-right font-medium ${colorClass}`}>
                                            {stock.changePercent > 0 ? '+' : ''}
                                            {stock.changePercent.toFixed(2)}%
                                        </td>
                                        <td className="p-3 text-right font-mono text-muted-foreground">
                                            {stock.volume.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
