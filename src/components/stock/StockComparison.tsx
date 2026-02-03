"use client";

import React, { useState } from 'react';
import { Search, Plus, X, ArrowRight } from 'lucide-react';
import { stockService } from '@/lib/stockService';
import { Stock } from '@/lib/mockData';

export function StockComparison({ baseSymbol }: { baseSymbol: string }) {
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(false);

    // Load base stock initially
    React.useEffect(() => {
        const loadBaseStock = async () => {
            const stock = await stockService.getStock(baseSymbol);
            if (stock) {
                setStocks([stock]);
            }
        };
        loadBaseStock();
    }, [baseSymbol]);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 1) {
            setSearchResults([]);
            return;
        }

        setLoading(true);
        const results = await stockService.searchStocks(query);
        // Filter out stocks already in comparison
        setSearchResults(results.filter(r => !stocks.find(s => s.symbol === r.symbol)));
        setLoading(false);
    };

    const addStock = (stock: Stock) => {
        if (stocks.length >= 4) return; // Limit to 4 stocks
        setStocks([...stocks, stock]);
        setSearchQuery('');
        setSearchResults([]);
    };

    const removeStock = (symbol: string) => {
        if (symbol === baseSymbol) return; // Cannot remove base stock
        setStocks(stocks.filter(s => s.symbol !== symbol));
    };

    const metrics = [
        { label: '成交價', key: 'price', format: (v: number) => v.toFixed(2) },
        { label: '漲跌幅', key: 'changePercent', format: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`, color: true },
        { label: '成交量', key: 'volume', format: (v: number) => v.toLocaleString() },
        { label: '本益比 (PE)', key: 'pe', format: (v: number) => v?.toFixed(2) || '-' },
        { label: '股價淨值比 (PB)', key: 'pb', format: (v: number) => v?.toFixed(2) || '-' },
        { label: '殖利率 (%)', key: 'dividendYield', format: (v: number) => `${v?.toFixed(2) || '-'}%` },
        { label: 'EPS', key: 'eps', format: (v: number) => v?.toFixed(2) || '-' },
        { label: '月營收年增 (%)', key: 'revenueYoy', format: (v: number) => `${v > 0 ? '+' : ''}${v?.toFixed(2) || '-'}%`, color: true },
        { label: '月營收月增 (%)', key: 'revenueMom', format: (v: number) => `${v > 0 ? '+' : ''}${v?.toFixed(2) || '-'}%`, color: true },
        { label: '市值 (億)', key: 'marketCap', format: (v: number) => v?.toLocaleString() || '-' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">同業比較</h3>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="加入比較 (輸入代號/名稱)..."
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-8"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        disabled={stocks.length >= 4}
                    />
                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover text-popover-foreground rounded-md border shadow-md z-50 max-h-60 overflow-y-auto">
                            {searchResults.map(stock => (
                                <button
                                    key={stock.symbol}
                                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between items-center"
                                    onClick={() => addStock(stock)}
                                >
                                    <span>{stock.symbol} {stock.name}</span>
                                    <Plus className="w-4 h-4" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left p-3 min-w-[120px] bg-muted/30">項目</th>
                            {stocks.map(stock => (
                                <th key={stock.symbol} className="p-3 min-w-[140px] text-center relative group">
                                    <div className="font-bold text-base">{stock.name}</div>
                                    <div className="text-muted-foreground font-mono">{stock.symbol}</div>
                                    {stock.symbol !== baseSymbol && (
                                        <button
                                            onClick={() => removeStock(stock.symbol)}
                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </th>
                            ))}
                            {/* Placeholders for empty slots */}
                            {[...Array(4 - stocks.length)].map((_, i) => (
                                <th key={`empty-${i}`} className="p-3 min-w-[140px] text-center bg-muted/5 border-l border-dashed">
                                    <div className="text-muted-foreground/50">
                                        <Plus className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        加入比較
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {metrics.map((metric) => (
                            <tr key={metric.key} className="border-b last:border-0 hover:bg-muted/10">
                                <td className="p-3 font-medium text-muted-foreground bg-muted/10">{metric.label}</td>
                                {stocks.map(stock => {
                                    const value = stock[metric.key as keyof Stock] as number;
                                    const isPositive = metric.color && value > 0;
                                    const isNegative = metric.color && value < 0;
                                    const colorClass = isPositive ? 'text-red-600' : isNegative ? 'text-green-600' : '';

                                    return (
                                        <td key={`${stock.symbol}-${metric.key}`} className={`p-3 text-center font-mono font-medium ${colorClass}`}>
                                            {metric.format(value)}
                                        </td>
                                    );
                                })}
                                {[...Array(4 - stocks.length)].map((_, i) => (
                                    <td key={`empty-cell-${i}`} className="p-3 bg-muted/5 border-l border-dashed"></td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
