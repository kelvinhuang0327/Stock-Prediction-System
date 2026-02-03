"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { stockService } from '@/lib/stockService';
import { Stock, SECTORS } from '@/lib/mockData';

export default function SectorDetailPage() {
    const params = useParams();
    const sectorId = params.id as string;

    const [stocks, setStocks] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(true);

    const sector = SECTORS.find(s => s.id === sectorId);

    useEffect(() => {
        if (sectorId) {
            loadStocks();
        }
    }, [sectorId]);

    const loadStocks = async () => {
        setLoading(true);
        const data = await stockService.getStocksBySector(sectorId);
        setStocks(data.sort((a, b) => b.changePercent - a.changePercent));
        setLoading(false);
    };

    if (!sector) {
        return (
            <div className="text-center py-12">
                <div className="text-muted-foreground">找不到該類股</div>
                <Link href="/sectors" className="text-primary hover:underline mt-4 inline-block">
                    返回類股列表
                </Link>
            </div>
        );
    }

    const topGainers = stocks.filter(s => s.changePercent > 0).slice(0, 5);
    const topLosers = stocks.filter(s => s.changePercent < 0).slice(0, 5);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <Link
                    href="/sectors"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回類股列表
                </Link>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{sector.name}</h1>
                        <p className="text-muted-foreground">
                            {stocks.length} 檔股票
                        </p>
                    </div>
                    <div className={`text-right ${sector.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        <div className="text-3xl font-bold flex items-center gap-2">
                            {sector.changePercent >= 0 ? (
                                <TrendingUp className="w-8 h-8" />
                            ) : (
                                <TrendingDown className="w-8 h-8" />
                            )}
                            {sector.changePercent > 0 ? '+' : ''}
                            {sector.changePercent.toFixed(2)}%
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                            成交量: {sector.volume.toLocaleString()} 張
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Gainers & Losers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Gainers */}
                <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b bg-red-50 dark:bg-red-950/20 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-red-600" />
                        <h3 className="font-bold text-lg">強勢股</h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {topGainers.length > 0 ? (
                            topGainers.map((stock, idx) => (
                                <div key={stock.symbol} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-muted-foreground w-4">
                                            {idx + 1}
                                        </span>
                                        <div>
                                            <div className="font-bold">{stock.name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">
                                                {stock.symbol}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-red-600">
                                            {stock.price}
                                        </div>
                                        <div className="text-sm text-red-600">
                                            +{stock.changePercent.toFixed(2)}%
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-muted-foreground py-4">
                                無上漲股票
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Losers */}
                <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b bg-green-50 dark:bg-green-950/20 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-green-600" />
                        <h3 className="font-bold text-lg">弱勢股</h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {topLosers.length > 0 ? (
                            topLosers.map((stock, idx) => (
                                <div key={stock.symbol} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-muted-foreground w-4">
                                            {idx + 1}
                                        </span>
                                        <div>
                                            <div className="font-bold">{stock.name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">
                                                {stock.symbol}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-green-600">
                                            {stock.price}
                                        </div>
                                        <div className="text-sm text-green-600">
                                            {stock.changePercent.toFixed(2)}%
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-muted-foreground py-4">
                                無下跌股票
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* All Stocks Table */}
            <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-muted/30">
                    <h3 className="font-bold text-lg">所有股票</h3>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-muted-foreground">
                        載入中...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/10">
                                    <th className="text-left p-3 font-medium text-muted-foreground">代號</th>
                                    <th className="text-left p-3 font-medium text-muted-foreground">股名</th>
                                    <th className="text-right p-3 font-medium text-muted-foreground">成交價</th>
                                    <th className="text-right p-3 font-medium text-muted-foreground">漲跌</th>
                                    <th className="text-right p-3 font-medium text-muted-foreground">漲跌幅</th>
                                    <th className="text-right p-3 font-medium text-muted-foreground">成交量</th>
                                    <th className="text-right p-3 font-medium text-muted-foreground">本益比</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stocks.map((stock) => {
                                    const isPositive = stock.change >= 0;
                                    const colorClass = isPositive ? 'text-red-600' : 'text-green-600';

                                    return (
                                        <tr key={stock.symbol} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                            <td className="p-3 font-mono font-medium">{stock.symbol}</td>
                                            <td className="p-3 font-medium">{stock.name}</td>
                                            <td className={`p-3 text-right font-bold font-mono ${colorClass}`}>
                                                {stock.price.toFixed(2)}
                                            </td>
                                            <td className={`p-3 text-right font-medium ${colorClass}`}>
                                                {stock.change > 0 ? '+' : ''}
                                                {stock.change.toFixed(2)}
                                            </td>
                                            <td className={`p-3 text-right font-medium ${colorClass}`}>
                                                {stock.changePercent > 0 ? '+' : ''}
                                                {stock.changePercent.toFixed(2)}%
                                            </td>
                                            <td className="p-3 text-right font-mono">
                                                {stock.volume.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-mono">
                                                {stock.pe?.toFixed(2) || '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
