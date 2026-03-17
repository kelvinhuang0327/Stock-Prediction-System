"use client";

import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

type Stock = {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number; // 張
};

export function HotStocksList() {
    // For "Hot Stocks", usually we need a specific API. 
    // Since we don't have a ranking API yet, let's pick some popular stocks.
    // We can fetch their real-time data.
    // We'll separate them into gainers/losers based on real-time change.
    const [stocks, setStocks] = useState<Stock[]>([]);

    useEffect(() => {
        const fetchStocks = async () => {
            try {
                const listRes = await fetch('/api/stocks?limit=50');
                if (listRes.ok) {
                    const listJson = await listRes.json();
                    const dbStocks = listJson.data.map((s: any) => ({
                        symbol: s.symbol,
                        name: s.name,
                        price: s.price,
                        change: s.change,
                        changePercent: s.changePercent,
                        volume: Math.round(s.volume / 1000)
                    }));

                    dbStocks.sort((a: Stock, b: Stock) => b.changePercent - a.changePercent);
                    setStocks(dbStocks);
                }
            } catch (error) {
                console.error("Failed to fetch hot stocks", error);
            }
        };

        fetchStocks();
    }, []);

    const gainers = stocks.slice(0, 5);
    const losers = [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StockTable key="gainers" title="強勢股排行" stocks={gainers} type="gainer" icon={<TrendingUp className="w-5 h-5 text-red-500" />} />
            <StockTable key="losers" title="弱勢股排行" stocks={losers} type="loser" icon={<TrendingDown className="w-5 h-5 text-green-500" />} />
        </div>
    );
}

function PredictionBadge({ symbol }: { symbol: string }) {
    const [signal, setSignal] = useState<string | null>(null);

    useEffect(() => {
        const fetchSignal = async () => {
            try {
                const res = await fetch(`/api/predictions/${symbol}`);
                if (res.ok) {
                    const data = await res.json();
                    setSignal(data.signal);
                }
            } catch (e) {
                // Silently fail
            }
        };
        fetchSignal();
    }, [symbol]);

    if (!signal) return null;

    const getColor = (s: string) => {
        if (s === 'BUY') return 'bg-red-500 text-white';
        if (s === 'SELL') return 'bg-green-500 text-white';
        if (s === 'CAUTION') return 'bg-yellow-500 text-white';
        return 'bg-muted text-muted-foreground';
    };

    return (
        <Badge className={`${getColor(signal)} text-[8px] px-1 py-0 h-4 min-w-[32px] justify-center scale-90 origin-left`}>
            {signal}
        </Badge>
    );
}

function StockTable({ title, stocks, type, icon }: { title: string; stocks: Stock[]; type: 'gainer' | 'loser'; icon: React.ReactNode }) {
    return (
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
                {icon}
                <h3 className="font-bold text-lg">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/10">
                            <th className="text-left p-3 font-medium text-muted-foreground">股名/代號</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">成交價</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">漲跌</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">漲跌幅</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">成交量</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stocks.length === 0 ? (
                            <tr key="loading"><td colSpan={5} className="p-4 text-center text-muted-foreground">載入中...</td></tr>
                        ) : stocks.map((stock, index) => {
                            const isPositive = stock.change >= 0;
                            const colorClass = isPositive ? 'text-red-600' : 'text-green-600';

                            return (
                                <tr key={`${stock.symbol}-${index}`} className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer group">
                                    <td className="p-3">
                                        <Link href={`/stock/${stock.symbol}`} className="block">
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold group-hover:text-primary transition-colors">{stock.name}</div>
                                                <PredictionBadge symbol={stock.symbol} />
                                            </div>
                                            <div className="text-xs text-muted-foreground font-mono">{stock.symbol}</div>
                                        </Link>
                                    </td>
                                    <td className={`p-3 text-right font-bold font-mono ${colorClass}`}>
                                        {stock.price}
                                    </td>
                                    <td className={`p-3 text-right font-medium ${colorClass}`}>
                                        <div className="flex items-center justify-end gap-1">
                                            {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                            {Math.abs(stock.change)}
                                        </div>
                                    </td>
                                    <td className={`p-3 text-right font-medium ${colorClass}`}>
                                        <Badge variant={isPositive ? "destructive" : "secondary"} className={`bg-opacity-10 hover:bg-opacity-20 text-xs ${isPositive ? 'bg-red-500 text-red-600' : 'bg-green-500 text-green-600'}`}>
                                            {Math.abs(stock.changePercent).toFixed(2)}%
                                        </Badge>
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
    );
}
