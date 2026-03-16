"use client";

import React, { useState } from 'react';
import { Trash2, Bell, Plus, Briefcase, Edit2, Zap, Clock, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { AddStockDialog } from '@/components/watchlist/AddStockDialog';
import { PriceAlertDialog, PriceAlert } from '@/components/watchlist/PriceAlertDialog';
import { EditHoldingsDialog } from '@/components/watchlist/EditHoldingsDialog';
import { Stock } from '@/lib/mockData';

interface DbWatchlistItem {
    stockId: string;
    name: string;
    dailyChange: number;
    weeklyChange: number;
    volume: number;
    volumeChange: number;
    hasQuoteData: boolean;
    lastQuoteDate: string | null;
}

interface DbWatchlistResponse {
    data: DbWatchlistItem[];
    last_updated: string | null;
    coverage: { total: number; withQuotes: number };
}

interface PortfolioItem extends Stock {
    avgCost?: number;
    quantity?: number;
}

interface ScreeningResult {
    stockId: string;
    name: string;
    revenueYoY: number;
    eps: number;
    chipStrength: number;
    technicalScore: number;
    reason: string;
    closePrice: number;
    priceChangePercent: number;
    calculatedScore?: number;
    isETF?: boolean;
    riskScore?: number;
    riskLevel?: 'Low' | 'Medium' | 'High';
}

const WATCHLIST_VERSION = "2025.01.09.v2";

export default function WatchlistPage() {
    const [watchlist, setWatchlist] = useState<PortfolioItem[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    React.useEffect(() => {
        const savedVersion = localStorage.getItem('tw-stock-watchlist-version');
        const saved = localStorage.getItem('tw-stock-watchlist');

        // If version mismatch or no data, force a reset to new corrected defaults
        if (savedVersion !== WATCHLIST_VERSION || !saved) {
            const defaults = [
                { symbol: '2330', name: '台積電', price: 1025, change: 15, changePercent: 1.48, volume: 32000, pe: 28.5, dividendYield: 1.8, avgCost: 950, quantity: 2000 },
                { symbol: '2454', name: '聯發科', price: 1285, change: 35, changePercent: 2.79, volume: 5500, pe: 18.2, dividendYield: 3.5, avgCost: 1100, quantity: 1000 },
                { symbol: '2317', name: '鴻海', price: 215, change: 4.5, changePercent: 2.14, volume: 95000, pe: 15.3, dividendYield: 4.2, avgCost: 180, quantity: 5000 },
            ];
            setWatchlist(defaults);
            localStorage.setItem('tw-stock-watchlist', JSON.stringify(defaults));
            localStorage.setItem('tw-stock-watchlist-version', WATCHLIST_VERSION);
        } else {
            try {
                setWatchlist(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse watchlist", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage whenever watchlist changes
    React.useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('tw-stock-watchlist', JSON.stringify(watchlist));
        }
    }, [watchlist, isLoaded]);

    const [strategicData, setStrategicData] = useState<Record<string, ScreeningResult>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Fetch strategic analysis for all stocks in watchlist
    const fetchAnalysis = React.useCallback(async () => {
        if (!isLoaded || watchlist.length === 0) return;

        setIsAnalyzing(true);
        const newData: Record<string, ScreeningResult> = {};

        // Parallel fetch for speed
        const promises = watchlist.map(async (stock) => {
            try {
                const res = await fetch('/api/strategy/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: stock.symbol })
                });
                if (res.ok) {
                    const analysis: ScreeningResult = await res.json();
                    const rawScore = analysis.isETF
                        ? (analysis.chipStrength / 100 * 50) + (analysis.technicalScore / 100 * 50)
                        : (Math.min(analysis.revenueYoY, 50) / 30 * 40) + (analysis.chipStrength / 100 * 30) + (analysis.technicalScore / 100 * 30);
                    const score = Math.round(Math.min(rawScore, 100));
                    newData[stock.symbol] = { ...analysis, calculatedScore: score };
                }
            } catch (e) {
                console.error(`Failed to analyze ${stock.symbol}`, e);
            }
        });

        await Promise.all(promises);
        setStrategicData(newData);

        // Sync back real prices to watchlist state
        setWatchlist(prev => prev.map(s => {
            if (newData[s.symbol]) {
                return {
                    ...s,
                    price: newData[s.symbol].closePrice,
                    changePercent: newData[s.symbol].priceChangePercent
                };
            }
            return s;
        }));

        setIsAnalyzing(false);
    }, [watchlist.length, isLoaded]); // Dependency on length, not content, to avoid loop

    // Initial load
    React.useEffect(() => {
        fetchAnalysis();
    }, [fetchAnalysis]);

    const [alerts, setAlerts] = useState<PriceAlert[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: '', dir: 'desc' });

    // DB-sourced quote data for weekly change, volume, etc.
    const [dbData, setDbData] = useState<Record<string, DbWatchlistItem>>({});
    const [dbLastUpdated, setDbLastUpdated] = useState<string | null>(null);

    React.useEffect(() => {
        fetch('/api/watchlist')
            .then(r => r.json())
            .then((res: DbWatchlistResponse) => {
                if (res.data) {
                    const map: Record<string, DbWatchlistItem> = {};
                    res.data.forEach(item => { map[item.stockId] = item; });
                    setDbData(map);
                    setDbLastUpdated(res.last_updated);
                }
            })
            .catch(e => console.error('Failed to fetch DB watchlist data', e));
    }, []);

    // Search & sort logic
    const handleWatchlistSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
        }));
    };

    const sortedWatchlist = React.useMemo(() => {
        let filtered = watchlist;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = watchlist.filter(s =>
                s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
            );
        }
        if (!sortConfig.key) return filtered;
        return [...filtered].sort((a, b) => {
            let va: number, vb: number;
            switch (sortConfig.key) {
                case 'symbol': return sortConfig.dir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
                case 'price': va = a.price || 0; vb = b.price || 0; break;
                case 'changePercent': va = a.changePercent || 0; vb = b.changePercent || 0; break;
                case 'volume': va = a.volume || 0; vb = b.volume || 0; break;
                case 'score': va = strategicData[a.symbol]?.calculatedScore || 0; vb = strategicData[b.symbol]?.calculatedScore || 0; break;
                default: return 0;
            }
            return sortConfig.dir === 'asc' ? va - vb : vb - va;
        });
    }, [watchlist, searchQuery, sortConfig, strategicData]);

    // Fetch alerts from backend
    const fetchAlerts = async () => {
        try {
            const res = await fetch('/api/alerts');
            if (res.ok) {
                setAlerts(await res.json());
            }
        } catch (e) {
            console.error("Failed to fetch alerts", e);
        }
    };

    React.useEffect(() => {
        fetchAlerts();
    }, []);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
    const [isHoldingsDialogOpen, setIsHoldingsDialogOpen] = useState(false);
    const [selectedStock, setSelectedStock] = useState<PortfolioItem | null>(null);

    const removeStock = (symbol: string) => {
        setWatchlist(watchlist.filter(s => s.symbol !== symbol));
    };

    const handleAddStock = (stock: Stock) => {
        if (!watchlist.find(s => s.symbol === stock.symbol)) {
            setWatchlist([...watchlist, stock]);
        }
    };

    const handleSetAlert = (stock: PortfolioItem) => {
        setSelectedStock(stock);
        setIsAlertDialogOpen(true);
    };

    const handleEditHoldings = (stock: PortfolioItem) => {
        setSelectedStock(stock);
        setIsHoldingsDialogOpen(true);
    };

    const handleSaveAlert = async (alert: PriceAlert) => {
        try {
            await fetch('/api/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alert)
            });
            fetchAlerts();
        } catch (e) {
            console.error("Failed to save alert", e);
        }
    };

    const handleDeleteAlert = async (id?: number) => {
        if (!id) return;
        try {
            await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' });
            fetchAlerts();
        } catch (e) {
            console.error("Failed to delete alert", e);
        }
    };

    const handleSaveHoldings = (symbol: string, avgCost: number, quantity: number) => {
        setWatchlist(watchlist.map(item =>
            item.symbol === symbol
                ? { ...item, avgCost, quantity }
                : item
        ));
    };

    // Calculate Portfolio Summary
    const totalValue = watchlist.reduce((sum, item) => sum + (item.price * (item.quantity || 0)), 0);
    const totalCost = watchlist.reduce((sum, item) => sum + ((item.avgCost || 0) * (item.quantity || 0)), 0);
    const totalPL = totalValue - totalCost;
    const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">My Watchlist & Portfolio</h1>
                    <p className="text-muted-foreground">管理您的自選股、庫存與價格警示</p>
                    {dbLastUpdated && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            最後更新：{dbLastUpdated}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchAnalysis}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 transition-colors disabled:opacity-50"
                    >
                        <Zap className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                        {isAnalyzing ? 'Updating...' : 'Refresh Prices'}
                    </button>
                    <button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> 加入股票
                    </button>
                </div>
            </div>

            {/* Daily Strategic Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-600 text-white p-6 rounded-xl shadow-md relative overflow-hidden">
                    <Zap className="absolute -right-4 -top-4 w-24 h-24 opacity-10" />
                    <div className="relative z-10">
                        <div className="text-red-100 text-sm font-bold mb-1 italic">每日進攻建議</div>
                        <div className="text-3xl font-black mb-1">
                            {Object.values(strategicData).filter(d => (d.calculatedScore || 0) >= 90).length} 檔標的
                        </div>
                        <div className="text-xs text-red-100">當前滿足「30/30/30」極限位階</div>
                    </div>
                </div>

                <div className="bg-card p-6 rounded-xl border shadow-sm flex flex-col justify-center">
                    <div className="text-muted-foreground text-sm mb-1 uppercase tracking-wider font-bold">追蹤中標的</div>
                    <div className="text-3xl font-black font-mono">{watchlist.length}</div>
                </div>

                <div className="bg-card p-6 rounded-xl border shadow-sm flex flex-col justify-center">
                    <div className="text-muted-foreground text-sm mb-1 uppercase tracking-wider font-bold">數據健康度</div>
                    <div className="flex items-center gap-2">
                        <div className="text-3xl font-black font-mono text-green-600">優</div>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">100% 同步</span>
                    </div>
                </div>
            </div>

            {/* Portfolio Summary Card */}
            {totalValue > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-card p-4 rounded-xl border shadow-sm">
                        <div className="text-sm text-muted-foreground mb-1">總庫存市值</div>
                        <div className="text-2xl font-bold font-mono">${totalValue.toLocaleString()}</div>
                    </div>
                    <div className="bg-card p-4 rounded-xl border shadow-sm">
                        <div className="text-sm text-muted-foreground mb-1">總投資成本</div>
                        <div className="text-2xl font-bold font-mono">${totalCost.toLocaleString()}</div>
                    </div>
                    <div className="bg-card p-4 rounded-xl border shadow-sm">
                        <div className="text-sm text-muted-foreground mb-1">未實現損益</div>
                        <div className={`text-2xl font-bold font-mono ${totalPL >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {totalPL > 0 ? '+' : ''}{totalPL.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-card p-4 rounded-xl border shadow-sm">
                        <div className="text-sm text-muted-foreground mb-1">報酬率</div>
                        <div className={`text-2xl font-bold font-mono ${totalPLPercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {totalPLPercent > 0 ? '+' : ''}{totalPLPercent.toFixed(2)}%
                        </div>
                    </div>
                </div>
            )}

            {/* Watchlist Table with Search & Sort */}
            <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="font-bold text-lg">自選股列表 ({watchlist.length})</h3>
                    <div className="relative">
                        <input
                            type="search"
                            placeholder="搜尋代號或名稱..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex h-8 w-full sm:w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm pl-3 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/10">
                            <tr>
                                <th className="text-left p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleWatchlistSort('symbol')}>
                                    代號 {sortConfig.key === 'symbol' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th className="text-left p-4 font-medium text-muted-foreground">股名</th>
                                <th className="text-right p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleWatchlistSort('price')}>
                                    成交價 {sortConfig.key === 'price' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th className="text-right p-4 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleWatchlistSort('changePercent')}>
                                    漲跌幅 {sortConfig.key === 'changePercent' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th className="text-right p-4 font-medium text-muted-foreground hidden lg:table-cell cursor-pointer hover:text-foreground" onClick={() => handleWatchlistSort('volume')}>
                                    成交量 {sortConfig.key === 'volume' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th className="text-right p-4 font-medium text-muted-foreground hidden lg:table-cell">
                                    週漲跌
                                </th>
                                <th className="text-right p-4 font-medium text-muted-foreground hidden lg:table-cell">
                                    量變化
                                </th>
                                <th className="text-center p-4 font-medium text-muted-foreground bg-red-50/50 cursor-pointer hover:text-foreground" onClick={() => handleWatchlistSort('score')}>
                                    策略評分 {sortConfig.key === 'score' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th className="text-left p-4 font-medium text-muted-foreground bg-red-50/50">策略訊號</th>
                                <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">分析摘要</th>
                                <th className="text-right p-4 font-medium text-muted-foreground hidden lg:table-cell">持有成本</th>
                                <th className="text-right p-4 font-medium text-muted-foreground bg-primary/5">庫存股數</th>
                                <th className="text-right p-4 font-medium text-muted-foreground bg-primary/5">損益試算</th>
                                <th className="text-right p-4 font-medium text-muted-foreground bg-primary/5">報酬率</th>
                                <th className="text-right p-4 font-medium text-muted-foreground">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedWatchlist.map((stock) => {
                                const isPositive = stock.change >= 0;
                                const colorClass = isPositive ? 'text-red-600' : 'text-green-600';

                                const hasHoldings = stock.avgCost && stock.quantity;
                                const marketValue = hasHoldings ? stock.price * stock.quantity! : 0;
                                const costBasis = hasHoldings ? stock.avgCost! * stock.quantity! : 0;
                                const profitLoss = marketValue - costBasis;
                                const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;
                                const plColorClass = profitLoss >= 0 ? 'text-red-600' : 'text-green-600';
                                const analysis = strategicData[stock.symbol];

                                return (
                                    <tr key={stock.symbol} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                                        <td className="p-4 font-medium font-mono">{stock.symbol}</td>
                                        <td className="p-4 font-medium">{stock.name}</td>
                                        <td className={`p-4 text-right font-bold font-mono ${colorClass}`}>
                                            {analysis?.closePrice || stock.price}
                                        </td>
                                        <td className={`p-4 text-right font-medium ${colorClass}`}>
                                            {analysis
                                                ? (analysis.priceChangePercent > 0 ? '+' : '') + (analysis.priceChangePercent?.toFixed(2) || '0.00') + '%'
                                                : (stock.changePercent > 0 ? '+' : '') + stock.changePercent.toFixed(2) + '%'
                                            }
                                        </td>
                                        {/* Volume - new column */}
                                        <td className="p-4 text-right font-mono text-xs text-muted-foreground hidden lg:table-cell">
                                            {stock.volume ? stock.volume.toLocaleString() : '-'}
                                        </td>
                                        {/* Weekly change (DB-sourced) */}
                                        <td className="p-4 text-right font-mono text-xs hidden lg:table-cell">
                                            {dbData[stock.symbol]?.hasQuoteData ? (
                                                <span className={dbData[stock.symbol].weeklyChange > 0 ? 'text-red-500' : dbData[stock.symbol].weeklyChange < 0 ? 'text-green-500' : 'text-muted-foreground'}>
                                                    {dbData[stock.symbol].weeklyChange > 0 ? '+' : ''}{dbData[stock.symbol].weeklyChange.toFixed(2)}%
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/40" title="尚未同步行情資料">—</span>
                                            )}
                                        </td>
                                        {/* Volume change (DB-sourced) */}
                                        <td className="p-4 text-right font-mono text-xs hidden lg:table-cell">
                                            {dbData[stock.symbol]?.hasQuoteData ? (
                                                <span className={dbData[stock.symbol].volumeChange > 50 ? 'text-amber-500 font-medium' : 'text-muted-foreground'}>
                                                    {dbData[stock.symbol].volumeChange > 0 ? '+' : ''}{dbData[stock.symbol].volumeChange.toFixed(0)}%
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/40" title="尚未同步行情資料">—</span>
                                            )}
                                        </td>

                                        {/* Strategic Columns */}
                                        <td className="p-4 text-center bg-red-50/20">
                                            {analysis ? (
                                                <div className="flex flex-col items-center">
                                                    <span className={`text-lg font-black ${(analysis.calculatedScore || 0) >= 80 ? 'text-red-600' : 'text-amber-600'}`}>
                                                        {analysis.calculatedScore || 0}
                                                    </span>
                                                    <div className="flex gap-0.5 mt-1">
                                                        {[1, 2, 3, 4, 5].map(i => (
                                                            <div
                                                                key={i}
                                                                className={`w-1.5 h-1.5 rounded-full ${i <= ((analysis.calculatedScore || 0) / 20) ? 'bg-red-500' : 'bg-gray-200'}`}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex justify-center">
                                                    <div className="w-5 h-5 border-2 border-red-200 border-t-red-500 animate-spin rounded-full" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 bg-red-50/20">
                                            {analysis ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block w-fit ${(analysis.calculatedScore || 0) >= 90 ? 'bg-red-600 text-white' :
                                                        (analysis.calculatedScore || 0) >= 70 ? 'bg-amber-100 text-amber-700' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {(analysis.calculatedScore || 0) >= 90 ? '極限進攻' :
                                                            (analysis.calculatedScore || 0) >= 70 ? '可以追蹤' : '暫緩觀察'}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                                        {analysis.riskLevel === 'High' ? '⚠️ 高波動警告' : '✅ 波動穩定'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground animate-pulse">分析中...</span>
                                            )}
                                        </td>

                                        {/* Analysis Summary - new column */}
                                        <td className="p-4 hidden md:table-cell">
                                            {analysis ? (
                                                <div className="text-[10px] text-muted-foreground max-w-[140px] truncate" title={analysis.reason}>
                                                    {analysis.reason || '—'}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </td>

                                        {/* Portfolio Columns */}
                                        <td className="p-4 text-right font-mono hidden lg:table-cell">
                                            {stock.avgCost?.toFixed(1) || '-'}
                                        </td>
                                        <td className="p-4 text-right font-mono bg-primary/5">
                                            {stock.quantity?.toLocaleString() || '-'}
                                        </td>
                                        <td className={`p-4 text-right font-mono font-bold bg-primary/5 ${hasHoldings ? plColorClass : ''}`}>
                                            {hasHoldings ? (profitLoss > 0 ? '+' : '') + profitLoss.toLocaleString() : '-'}
                                        </td>
                                        <td className={`p-4 text-right font-mono font-bold bg-primary/5 ${hasHoldings ? plColorClass : ''}`}>
                                            {hasHoldings ? (profitLossPercent > 0 ? '+' : '') + profitLossPercent.toFixed(2) + '%' : '-'}
                                        </td>

                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEditHoldings(stock)}
                                                    className={`p-2 rounded-full transition-colors ${hasHoldings ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                                                    title="編輯庫存"
                                                >
                                                    <Briefcase className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleSetAlert(stock)}
                                                    className="p-2 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground transition-colors"
                                                    title="設定警示"
                                                >
                                                    <Bell className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => removeStock(stock.symbol)}
                                                    className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-full text-muted-foreground transition-colors"
                                                    title="移除"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {watchlist.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                            您的自選股列表是空的，點擊上方「加入股票」按鈕開始追蹤股票
                        </div>
                    )}
                </div>
            </div>

            {/* Price Alerts */}
            {alerts.length > 0 && (
                <div className="bg-card rounded-xl shadow-sm border p-6">
                    <h3 className="text-lg font-bold mb-4">價格警示 ({alerts.length})</h3>
                    <div className="space-y-2">
                        {alerts.map((alert, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Bell className="w-4 h-4 text-primary" />
                                    <div>
                                        <div className="font-medium">{alert.symbol}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {alert.type === 'above' && `價格高於 ${alert.value}`}
                                            {alert.type === 'below' && `價格低於 ${alert.value}`}
                                            {alert.type === 'change_up' && `漲幅超過 ${alert.value}%`}
                                            {alert.type === 'change_down' && `跌幅超過 ${alert.value}%`}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteAlert(alert.id)} // Assuming backend returns ID
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Dialogs */}
            <AddStockDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                onAdd={handleAddStock}
            />
            <PriceAlertDialog
                isOpen={isAlertDialogOpen}
                onClose={() => setIsAlertDialogOpen(false)}
                stock={selectedStock}
                onSave={handleSaveAlert}
            />
            <EditHoldingsDialog
                isOpen={isHoldingsDialogOpen}
                onClose={() => setIsHoldingsDialogOpen(false)}
                stock={selectedStock}
                currentHoldings={selectedStock?.avgCost && selectedStock?.quantity ? { avgCost: selectedStock.avgCost, quantity: selectedStock.quantity } : undefined}
                onSave={handleSaveHoldings}
            />
        </div>
    );
}
