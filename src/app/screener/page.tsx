"use client";

import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Plus } from 'lucide-react';
import { stockService, StockFilter } from '@/lib/stockService';
import { Stock, SECTORS } from '@/lib/mockData';

export default function ScreenerPage() {
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortBy, setSortBy] = useState<keyof Stock>('changePercent');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const [filters, setFilters] = useState<StockFilter>({
        sector: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        minPE: undefined,
        maxPE: undefined,
        minDividendYield: undefined,
        minVolume: undefined,
        minChangePercent: undefined,
        maxChangePercent: undefined,
        minRSI: undefined,
        maxRSI: undefined,
        macdSignal: undefined,
        maSignal: undefined,
    });

    useEffect(() => {
        loadStocks();
    }, []);

    const loadStocks = async () => {
        setLoading(true);
        const data = await stockService.filterStocks({});
        setStocks(data);
        setFilteredStocks(data);
        setLoading(false);
    };

    const applyFilters = async () => {
        setLoading(true);
        const data = await stockService.filterStocks(filters);
        setFilteredStocks(data);
        setLoading(false);
    };

    const resetFilters = () => {
        setFilters({
            sector: undefined,
            minPrice: undefined,
            maxPrice: undefined,
            minPE: undefined,
            maxPE: undefined,
            minDividendYield: undefined,
            minVolume: undefined,
            minChangePercent: undefined,
            maxChangePercent: undefined,
            minRSI: undefined,
            maxRSI: undefined,
            macdSignal: undefined,
            maSignal: undefined,
        });
        setFilteredStocks(stocks);
    };

    const handleSort = (column: keyof Stock) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    const sortedStocks = [...filteredStocks].sort((a, b) => {
        const aVal = a[sortBy] as number;
        const bVal = b[sortBy] as number;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const exportToCSV = () => {
        const headers = ['代號', '股名', '成交價', '漲跌', '漲跌幅', '成交量', '本益比', '殖利率', 'RSI', 'MACD'];
        const rows = sortedStocks.map(s => [
            s.symbol,
            s.name,
            s.price,
            s.change,
            s.changePercent,
            s.volume,
            s.pe || '',
            s.dividendYield || '',
            s.rsi || '',
            s.macd || '',
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock-screener-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Stock Screener</h1>
                    <p className="text-muted-foreground">進階選股工具 - 結合基本面與技術面篩選</p>
                </div>
                <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    匯出 CSV
                </button>
            </div>

            {/* Filter Panel */}
            <div className="bg-card rounded-xl shadow-sm border p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-5 h-5" />
                    <h3 className="font-bold text-lg">篩選條件</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Sector Filter */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">類股</label>
                        <select
                            className="w-full p-2 border rounded-md bg-background"
                            value={filters.sector || ''}
                            onChange={(e) => setFilters({ ...filters, sector: e.target.value || undefined })}
                        >
                            <option value="">全部類股</option>
                            {SECTORS.map(sector => (
                                <option key={sector.id} value={sector.id}>{sector.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Price Range */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">股價範圍</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="最低"
                                className="w-full p-2 border rounded-md bg-background"
                                value={filters.minPrice || ''}
                                onChange={(e) => setFilters({ ...filters, minPrice: e.target.value ? Number(e.target.value) : undefined })}
                            />
                            <input
                                type="number"
                                placeholder="最高"
                                className="w-full p-2 border rounded-md bg-background"
                                value={filters.maxPrice || ''}
                                onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value ? Number(e.target.value) : undefined })}
                            />
                        </div>
                    </div>

                    {/* PE Ratio */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">本益比 (PE)</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="最低"
                                className="w-full p-2 border rounded-md bg-background"
                                value={filters.minPE || ''}
                                onChange={(e) => setFilters({ ...filters, minPE: e.target.value ? Number(e.target.value) : undefined })}
                            />
                            <input
                                type="number"
                                placeholder="最高"
                                className="w-full p-2 border rounded-md bg-background"
                                value={filters.maxPE || ''}
                                onChange={(e) => setFilters({ ...filters, maxPE: e.target.value ? Number(e.target.value) : undefined })}
                            />
                        </div>
                    </div>

                    {/* Dividend Yield */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">最低殖利率 (%)</label>
                        <input
                            type="number"
                            placeholder="例: 3"
                            className="w-full p-2 border rounded-md bg-background"
                            value={filters.minDividendYield || ''}
                            onChange={(e) => setFilters({ ...filters, minDividendYield: e.target.value ? Number(e.target.value) : undefined })}
                        />
                    </div>

                    {/* Volume */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">最低成交量 (張)</label>
                        <input
                            type="number"
                            placeholder="例: 1000"
                            className="w-full p-2 border rounded-md bg-background"
                            value={filters.minVolume || ''}
                            onChange={(e) => setFilters({ ...filters, minVolume: e.target.value ? Number(e.target.value) : undefined })}
                        />
                    </div>

                    {/* Change Percent */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">漲跌幅範圍 (%)</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="最低"
                                className="w-full p-2 border rounded-md bg-background"
                                value={filters.minChangePercent || ''}
                                onChange={(e) => setFilters({ ...filters, minChangePercent: e.target.value ? Number(e.target.value) : undefined })}
                            />
                            <input
                                type="number"
                                placeholder="最高"
                                className="w-full p-2 border rounded-md bg-background"
                                value={filters.maxChangePercent || ''}
                                onChange={(e) => setFilters({ ...filters, maxChangePercent: e.target.value ? Number(e.target.value) : undefined })}
                            />
                        </div>
                    </div>

                    {/* RSI Range */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">RSI (14) 範圍</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="最低"
                                className="w-full p-2 border rounded-md bg-background"
                                value={filters.minRSI || ''}
                                onChange={(e) => setFilters({ ...filters, minRSI: e.target.value ? Number(e.target.value) : undefined })}
                            />
                            <input
                                type="number"
                                placeholder="最高"
                                className="w-full p-2 border rounded-md bg-background"
                                value={filters.maxRSI || ''}
                                onChange={(e) => setFilters({ ...filters, maxRSI: e.target.value ? Number(e.target.value) : undefined })}
                            />
                        </div>
                    </div>

                    {/* Technical Signals */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">技術指標訊號</label>
                        <select
                            className="w-full p-2 border rounded-md bg-background mb-2"
                            value={filters.macdSignal || ''}
                            onChange={(e) => setFilters({ ...filters, macdSignal: e.target.value as any || undefined })}
                        >
                            <option value="">MACD 訊號</option>
                            <option value="bullish">MACD 多頭 (MACD &gt; 0)</option>
                            <option value="bearish">MACD 空頭 (MACD &lt; 0)</option>
                        </select>
                        <select
                            className="w-full p-2 border rounded-md bg-background"
                            value={filters.maSignal || ''}
                            onChange={(e) => setFilters({ ...filters, maSignal: e.target.value as any || undefined })}
                        >
                            <option value="">均線訊號</option>
                            <option value="priceAboveMA20">股價 &gt; 月線 (MA20)</option>
                            <option value="priceAboveMA60">股價 &gt; 季線 (MA60)</option>
                            <option value="bullishCross">黃金交叉 (MA20 &gt; MA60)</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={applyFilters}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors"
                    >
                        <Search className="w-4 h-4" />
                        搜尋
                    </button>
                    <button
                        onClick={resetFilters}
                        className="px-6 py-2 border rounded-md hover:bg-accent transition-colors"
                    >
                        重置
                    </button>
                </div>
            </div>

            {/* Results */}
            <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                    <h3 className="font-bold text-lg">
                        篩選結果 ({sortedStocks.length} 檔股票)
                    </h3>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-muted-foreground">
                        載入中...
                    </div>
                ) : sortedStocks.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        沒有符合條件的股票
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/10">
                                    <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/20" onClick={() => handleSort('symbol')}>
                                        代號 {sortBy === 'symbol' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="text-left p-3 font-medium text-muted-foreground">股名</th>
                                    <th className="text-right p-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/20" onClick={() => handleSort('price')}>
                                        成交價 {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="text-right p-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/20" onClick={() => handleSort('changePercent')}>
                                        漲跌幅 {sortBy === 'changePercent' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="text-right p-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/20" onClick={() => handleSort('volume')}>
                                        成交量 {sortBy === 'volume' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="text-right p-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/20" onClick={() => handleSort('pe')}>
                                        本益比 {sortBy === 'pe' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="text-right p-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/20" onClick={() => handleSort('dividendYield')}>
                                        殖利率 {sortBy === 'dividendYield' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="text-right p-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/20" onClick={() => handleSort('rsi')}>
                                        RSI {sortBy === 'rsi' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="text-right p-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/20" onClick={() => handleSort('macd')}>
                                        MACD {sortBy === 'macd' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="text-center p-3 font-medium text-muted-foreground">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedStocks.slice(0, 50).map((stock) => {
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
                                                {stock.changePercent > 0 ? '+' : ''}
                                                {stock.changePercent.toFixed(2)}%
                                            </td>
                                            <td className="p-3 text-right font-mono">
                                                {stock.volume.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-mono">
                                                {stock.pe?.toFixed(2) || '-'}
                                            </td>
                                            <td className="p-3 text-right font-mono">
                                                {stock.dividendYield?.toFixed(2) || '-'}%
                                            </td>
                                            <td className={`p-3 text-right font-mono ${(stock.rsi || 50) > 70 ? 'text-red-600 font-bold' :
                                                (stock.rsi || 50) < 30 ? 'text-green-600 font-bold' : ''
                                                }`}>
                                                {stock.rsi?.toFixed(1) || '-'}
                                            </td>
                                            <td className={`p-3 text-right font-mono ${(stock.macd || 0) > 0 ? 'text-red-600' : 'text-green-600'
                                                }`}>
                                                {stock.macd?.toFixed(2) || '-'}
                                            </td>
                                            <td className="p-3 text-center">
                                                <button
                                                    className="p-1 hover:bg-primary/10 rounded text-primary"
                                                    title="加入自選股"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
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
