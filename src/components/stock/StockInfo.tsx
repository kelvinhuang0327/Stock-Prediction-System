"use client";

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown, DollarSign, PieChart, Activity, Bell, Plus, Check } from 'lucide-react';
import { PriceAlertDialog, PriceAlert } from '@/components/watchlist/PriceAlertDialog';
import { AddStockDialog } from '@/components/watchlist/AddStockDialog';
import { Stock } from '@/lib/mockData';

export function StockInfo({ symbol }: { symbol: string }) {
    // Mock data - In a real app, this would come from an API
    const stock: Stock = {
        symbol: symbol,
        name: symbol === '2330' ? '台積電' : 'Sample Stock',
        price: 580,
        change: 12,
        changePercent: 2.1,
        volume: 25430, // 張
        amount: 147.5, // 億
        open: 570,
        high: 585,
        low: 568,
        prevClose: 568,
        // New Data Fields
        pe: 18.5, // 本益比
        pb: 4.2,  // 股價淨值比
        dividendYield: 2.8,    // 殖利率
        eps: 32.1,     // EPS
        institutional: {
            foreign: 1250, // 外資買賣超
            trust: -300,   // 投信買賣超
            dealer: 150,   // 自營商買賣超
        }
    };

    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isInWatchlist, setIsInWatchlist] = useState(false);

    const handleAddAlert = (alert: PriceAlert) => {
        console.log('Alert added:', alert);
        // In a real app, save to backend
    };

    const handleAddToWatchlist = () => {
        setIsInWatchlist(true);
        // In a real app, save to backend
    };

    const isPositive = stock.change >= 0;
    const colorClass = isPositive ? 'text-red-600' : 'text-green-600';

    return (
        <div className="bg-card rounded-xl shadow-sm border p-6 space-y-6">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-foreground">
                            {stock.name}
                        </h1>
                        <span className="text-2xl text-muted-foreground font-mono">{stock.symbol}</span>
                        <Badge variant="outline" className="ml-2">半導體業</Badge>
                        <Badge variant="secondary">上市</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Activity className="w-4 h-4" /> 即時行情</span>
                        <span>|</span>
                        <span>更新時間: 13:30:00</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsAlertDialogOpen(true)}
                            className="flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-accent transition-colors text-sm font-medium"
                        >
                            <Bell className="w-4 h-4" />
                            設定警示
                        </button>
                        <button
                            onClick={handleAddToWatchlist}
                            disabled={isInWatchlist}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors text-sm font-medium ${isInWatchlist
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'hover:bg-accent'
                                }`}
                        >
                            {isInWatchlist ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    已追蹤
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" />
                                    加入自選
                                </>
                            )}
                        </button>
                    </div>

                    <div className={`flex items-end gap-4 ${colorClass}`}>
                        <div className="text-5xl font-bold tracking-tight font-mono">{stock.price}</div>
                        <div className="flex flex-col items-start mb-1">
                            <div className="flex items-center gap-1 text-xl font-bold">
                                {isPositive ? <ArrowUp className="w-6 h-6" /> : <ArrowDown className="w-6 h-6" />}
                                <span>{Math.abs(stock.change)}</span>
                            </div>
                            <div className="text-lg font-medium">
                                ({Math.abs(stock.changePercent)}%)
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 bg-muted/30 rounded-lg border">
                <InfoItem label="成交量 (張)" value={stock.volume.toLocaleString()} />
                <InfoItem label="成交值 (億)" value={stock.amount} />
                <InfoItem label="開盤" value={stock.open} />
                <InfoItem label="最高" value={stock.high} className="text-red-600" />
                <InfoItem label="最低" value={stock.low} className="text-green-600" />
                <InfoItem label="昨收" value={stock.prevClose} />
            </div>

            {/* Financial & Institutional Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fundamental Ratios */}
                <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2 text-foreground">
                        <DollarSign className="w-4 h-4" /> 基本面數據
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <DetailCard label="本益比 (P/E)" value={stock.pe} subtext="倍" />
                        <DetailCard label="股價淨值比 (P/B)" value={stock.pb} subtext="倍" />
                        <DetailCard label="殖利率 (Yield)" value={`${stock.dividendYield}%`} highlight />
                        <DetailCard label="EPS (近四季)" value={stock.eps} subtext="元" />
                    </div>
                </div>

                {/* Institutional Chips */}
                <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2 text-foreground">
                        <PieChart className="w-4 h-4" /> 法人買賣超 (張)
                    </h3>
                    <div className="grid grid-cols-3 gap-3 h-full">
                        <ChipCard title="外資" value={stock.institutional?.foreign || 0} />
                        <ChipCard title="投信" value={stock.institutional?.trust || 0} />
                        <ChipCard title="自營商" value={stock.institutional?.dealer || 0} />
                    </div>
                </div>

                {/* Brokerage Targets (New Feature) */}
                <div className="md:col-span-2 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2 text-foreground">
                        <TrendingUp className="w-4 h-4" /> 法人目標價 (Brokerage Targets)
                    </h3>
                    <div className="bg-background rounded border p-4">
                        <div className="flex items-center justify-between mb-2 text-sm">
                            <span className="text-green-600 font-bold">最低 520</span>
                            <span className="text-primary font-bold">平均 610</span>
                            <span className="text-red-600 font-bold">最高 680</span>
                        </div>
                        <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                            {/* Range Bar */}
                            <div className="absolute top-0 bottom-0 bg-primary/20" style={{ left: '10%', right: '10%' }} />
                            {/* Current Price Marker */}
                            <div
                                className="absolute top-0 bottom-0 w-1 bg-foreground transform -translate-x-1/2"
                                style={{ left: '40%' }} // (580 - 500) / (700 - 500) approx
                            />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>500</span>
                            <span className="font-bold text-foreground">目前股價: {stock.price}</span>
                            <span>700</span>
                        </div>
                    </div>
                </div>
            </div>

            <PriceAlertDialog
                isOpen={isAlertDialogOpen}
                onClose={() => setIsAlertDialogOpen(false)}
                stock={stock}
                onSave={handleAddAlert}
            />
        </div>
    );
}

function InfoItem({ label, value, className }: { label: string; value: string | number; className?: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-xs text-muted-foreground mb-1">{label}</span>
            <span className={`text-lg font-bold font-mono ${className}`}>{value}</span>
        </div>
    );
}

function DetailCard({ label, value, subtext, highlight }: { label: string; value: string | number; subtext?: string; highlight?: boolean }) {
    return (
        <div className="p-3 bg-background rounded border flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{label}</span>
            <div className="flex items-baseline gap-1">
                <span className={`font-bold font-mono ${highlight ? 'text-amber-600' : ''}`}>{value}</span>
                {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
            </div>
        </div>
    );
}

function ChipCard({ title, value }: { title: string; value: number }) {
    const isBuy = value > 0;
    return (
        <div className={`flex flex-col items-center justify-center p-3 rounded border ${isBuy ? 'bg-red-50/50 border-red-100' : 'bg-green-50/50 border-green-100'}`}>
            <span className="text-sm text-muted-foreground mb-1">{title}</span>
            <span className={`font-bold font-mono ${isBuy ? 'text-red-600' : 'text-green-600'}`}>
                {value > 0 ? '+' : ''}{value}
            </span>
        </div>
    );
}
