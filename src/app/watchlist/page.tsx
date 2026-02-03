"use client";

import React, { useState } from 'react';
import { Trash2, Bell, Plus, Briefcase, Edit2 } from 'lucide-react';
import { AddStockDialog } from '@/components/watchlist/AddStockDialog';
import { PriceAlertDialog, PriceAlert } from '@/components/watchlist/PriceAlertDialog';
import { EditHoldingsDialog } from '@/components/watchlist/EditHoldingsDialog';
import { Stock } from '@/lib/mockData';

interface PortfolioItem extends Stock {
    avgCost?: number;
    quantity?: number;
}

export default function WatchlistPage() {
    const [watchlist, setWatchlist] = useState<PortfolioItem[]>([
        { symbol: '2330', name: '台積電', price: 580, change: 12, changePercent: 2.1, volume: 45000, pe: 18.5, dividendYield: 2.1, avgCost: 550, quantity: 2000 },
        { symbol: '2454', name: '聯發科', price: 950, change: 25, changePercent: 2.7, volume: 8500, pe: 16.2, dividendYield: 3.2, avgCost: 980, quantity: 1000 },
        { symbol: '2317', name: '鴻海', price: 105, change: 0.5, changePercent: 0.48, volume: 62000, pe: 12.3, dividendYield: 4.5 },
    ]);

    const [alerts, setAlerts] = useState<PriceAlert[]>([]);
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

    const handleSaveAlert = (alert: PriceAlert) => {
        setAlerts([...alerts, alert]);
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
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">My Watchlist & Portfolio</h1>
                    <p className="text-muted-foreground">管理您的自選股、庫存與價格警示</p>
                </div>
                <button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-4 h-4" /> 加入股票
                </button>
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

            <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-muted/30">
                    <h3 className="font-bold text-lg">自選股列表 ({watchlist.length})</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/10">
                            <tr>
                                <th className="text-left p-4 font-medium text-muted-foreground">代號</th>
                                <th className="text-left p-4 font-medium text-muted-foreground">股名</th>
                                <th className="text-right p-4 font-medium text-muted-foreground">成交價</th>
                                <th className="text-right p-4 font-medium text-muted-foreground">漲跌幅</th>
                                <th className="text-right p-4 font-medium text-muted-foreground bg-primary/5">持有成本</th>
                                <th className="text-right p-4 font-medium text-muted-foreground bg-primary/5">庫存股數</th>
                                <th className="text-right p-4 font-medium text-muted-foreground bg-primary/5">損益試算</th>
                                <th className="text-right p-4 font-medium text-muted-foreground bg-primary/5">報酬率</th>
                                <th className="text-right p-4 font-medium text-muted-foreground">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {watchlist.map((stock) => {
                                const isPositive = stock.change >= 0;
                                const colorClass = isPositive ? 'text-red-600' : 'text-green-600';

                                const hasHoldings = stock.avgCost && stock.quantity;
                                const marketValue = hasHoldings ? stock.price * stock.quantity! : 0;
                                const costBasis = hasHoldings ? stock.avgCost! * stock.quantity! : 0;
                                const profitLoss = marketValue - costBasis;
                                const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;
                                const plColorClass = profitLoss >= 0 ? 'text-red-600' : 'text-green-600';

                                return (
                                    <tr key={stock.symbol} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                                        <td className="p-4 font-medium font-mono">{stock.symbol}</td>
                                        <td className="p-4 font-medium">{stock.name}</td>
                                        <td className={`p-4 text-right font-bold font-mono ${colorClass}`}>
                                            {stock.price}
                                        </td>
                                        <td className={`p-4 text-right font-medium ${colorClass}`}>
                                            {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                                        </td>

                                        {/* Portfolio Columns */}
                                        <td className="p-4 text-right font-mono bg-primary/5">
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
                                    onClick={() => setAlerts(alerts.filter((_, i) => i !== idx))}
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
