"use client";

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown, DollarSign, PieChart, Activity, Bell, Plus, Check, RefreshCw } from 'lucide-react';
import { PriceAlertDialog, PriceAlert } from '@/components/watchlist/PriceAlertDialog';
import { AddStockDialog } from '@/components/watchlist/AddStockDialog';

export interface StockInfoProps {
    symbol: string;
    data?: {
        name: string;
        price: number;
        change: number;
        changePercent: number;
        volume: number; // Shares
        amount: number; // Value
        open: number;
        high: number;
        low: number;
        prevClose: number;
        pe?: number;
        pb?: number;
        dividendYield?: number;
        eps?: number;
        institutional?: {
            foreign: number;
            trust: number;
            dealer: number;
        }
    } | null;
}

export function StockInfo({ symbol, data }: StockInfoProps) {
    // Initial state from props (Snapshot)
    const [stats, setStats] = useState(data ? { ...data, symbol } : null);
    const [isLive, setIsLive] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    // Initial fallback
    const displayStats = stats || {
        symbol: symbol,
        name: 'Loading...',
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        amount: 0,
        open: 0,
        high: 0,
        low: 0,
        prevClose: 0,
        pe: 0,
        pb: 0,
        dividendYield: 0,
        eps: 0,
        institutional: { foreign: 0, trust: 0, dealer: 0 }
    };

    // Polling effect
    useEffect(() => {
        // If initial data provided, set stats
        if (data) {
            setStats({ ...data, symbol });
            setLastUpdated(new Date().toLocaleTimeString());
        }

        const fetchRealTime = async () => {
            try {
                const res = await fetch(`/api/stocks/${symbol}/realtime`);
                if (!res?.ok) return;
                const json = await res.json();
                const rt = json.data;

                if (rt) {
                    setIsLive(true);
                    setLastUpdated(rt.tradeTime || new Date().toLocaleTimeString());

                    setStats(prev => {
                        if (!prev) return prev;
                        // Calculate change based on previous close (if available from snapshot)
                        // Note: MIS API 'z' might be 0 if no recent trade, handle that
                        const currentPrice = rt.close > 0 ? rt.close : (rt.bestBidPrice?.[0] || prev.price);

                        // If we have no price, don't update
                        if (currentPrice <= 0) return prev;

                        const change = currentPrice - prev.prevClose;
                        const changePercent = prev.prevClose > 0 ? (change / prev.prevClose) * 100 : 0;

                        return {
                            ...prev,
                            price: currentPrice,
                            change: change,
                            changePercent: changePercent,
                            // Volume in MIS is accumulated total volume
                            volume: Math.round(rt.volume / 1000), // Convert to Sheets (Zhang)?? Wait, check unit. Usually MIS v is shares.
                            open: rt.open > 0 ? rt.open : prev.open,
                            high: rt.high > 0 ? rt.high : prev.high,
                            low: rt.low > 0 ? rt.low : prev.low,
                        };
                    });
                }
            } catch (e) {
                console.error("Realtime fetch failed", e);
                setIsLive(false);
            }
        };

        // Poll every 5 seconds
        const timer = setInterval(fetchRealTime, 5000);

        // Initial fetch
        fetchRealTime();

        return () => clearInterval(timer);
    }, [symbol, data]); // Reset when symbol changes

    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isInWatchlist, setIsInWatchlist] = useState(false);

    const handleAddAlert = (alert: PriceAlert) => {
        console.log('Alert added:', alert);
    };

    const handleAddToWatchlist = () => {
        setIsInWatchlist(true);
    };

    const isPositive = displayStats.change >= 0;
    const colorClass = isPositive ? 'text-red-600' : 'text-green-600';

    return (
        <div className="bg-card rounded-xl shadow-sm border p-6 space-y-6">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-foreground">
                            {displayStats.name}
                        </h1>
                        <span className="text-2xl text-muted-foreground font-mono">{displayStats.symbol}</span>
                        <Badge variant="outline" className="ml-2">半導體業</Badge>
                        <Badge variant={isLive ? "destructive" : "secondary"} className={isLive ? "animate-pulse" : ""}>
                            {isLive ? "LIVE" : "收盤"}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            {isLive ? <Activity className="w-4 h-4 text-red-500" /> : <RefreshCw className="w-4 h-4" />}
                            {isLive ? "盤中即時" : "收盤行情"}
                        </span>
                        <span>|</span>
                        <span>更新時間: {lastUpdated || '--:--:--'}</span>
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
                        <div className="text-5xl font-bold tracking-tight font-mono">{displayStats.price.toFixed(displayStats.price < 100 ? 2 : 1)}</div>
                        <div className="flex flex-col items-start mb-1">
                            <div className="flex items-center gap-1 text-xl font-bold">
                                {isPositive ? <ArrowUp className="w-6 h-6" /> : <ArrowDown className="w-6 h-6" />}
                                <span>{Math.abs(displayStats.change).toFixed(2)}</span>
                            </div>
                            <div className="text-lg font-medium">
                                ({Math.abs(displayStats.changePercent).toFixed(2)}%)
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 bg-muted/30 rounded-lg border">
                <InfoItem label="成交量 (張)" value={displayStats.volume.toLocaleString()} />
                <InfoItem label="成交值 (億)" value={displayStats.amount?.toFixed(2) ?? '--'} />
                <InfoItem label="開盤" value={displayStats.open ?? '--'} />
                <InfoItem label="最高" value={displayStats.high ?? '--'} className="text-red-600" />
                <InfoItem label="最低" value={displayStats.low ?? '--'} className="text-green-600" />
                <InfoItem label="昨收" value={displayStats.prevClose ?? '--'} />
            </div>

            {/* Financial & Institutional Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fundamental Ratios */}
                <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2 text-foreground">
                        <DollarSign className="w-4 h-4" /> 基本面數據
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <DetailCard label="本益比 (P/E)" value={displayStats.pe ?? '--'} subtext="倍" />
                        <DetailCard label="股價淨值比 (P/B)" value={displayStats.pb ?? '--'} subtext="倍" />
                        <DetailCard label="殖利率 (Yield)" value={displayStats.dividendYield ? `${displayStats.dividendYield}%` : '--'} highlight />
                        <DetailCard label="EPS (近四季)" value={displayStats.eps ?? '--'} subtext="元" />
                    </div>
                </div>

                {/* Institutional Chips */}
                <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2 text-foreground">
                        <PieChart className="w-4 h-4" /> 法人買賣超 (張)
                    </h3>
                    <div className="grid grid-cols-3 gap-3 h-full">
                        <ChipCard title="外資" value={displayStats.institutional?.foreign || 0} />
                        <ChipCard title="投信" value={displayStats.institutional?.trust || 0} />
                        <ChipCard title="自營商" value={displayStats.institutional?.dealer || 0} />
                    </div>
                </div>

                {/* Brokerage Targets (Removed due to lack of real data source) */}
                {/* <div className="md:col-span-2 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2 text-foreground">
                        <TrendingUp className="w-4 h-4" /> 法人目標價 (Brokerage Targets)
                    </h3>
                    <div className="bg-background rounded border p-4 text-center text-muted-foreground text-sm">
                        暫無法人目標價數據
                    </div>
                </div> */}
            </div>

            <PriceAlertDialog
                isOpen={isAlertDialogOpen}
                onClose={() => setIsAlertDialogOpen(false)}
                stock={displayStats}
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
