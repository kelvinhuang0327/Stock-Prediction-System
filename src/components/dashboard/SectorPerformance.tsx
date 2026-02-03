"use client";

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { stockService } from '@/lib/stockService';
import { Sector } from '@/lib/mockData';

export function SectorPerformance() {
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'price' | 'revenue'>('price');

    useEffect(() => {
        loadSectors();
    }, []);

    const loadSectors = async () => {
        setLoading(true);
        const data = await stockService.getSectors();
        // Mock revenue data enhancement
        const enhancedData = data.map(s => ({
            ...s,
            revenueYoy: (Math.random() - 0.3) * 20, // Mock YoY -30% to +70%
            revenueMom: (Math.random() - 0.5) * 10  // Mock MoM -5% to +5%
        }));
        setSectors(enhancedData);
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="bg-card rounded-xl shadow-sm border p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-muted rounded w-1/3"></div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="h-24 bg-muted rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Sort sectors by performance
    const sortedSectors = [...sectors].sort((a, b) =>
        viewMode === 'price' ? b.changePercent - a.changePercent : (b as any).revenueYoy - (a as any).revenueYoy
    );
    const topPerformers = sortedSectors.slice(0, 3);
    const worstPerformers = sortedSectors.slice(-3).reverse();

    return (
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    {viewMode === 'price' ? <Activity className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                    {viewMode === 'price' ? '類股表現 (Sector Performance)' : '營收熱圖 (Revenue Heatmap)'}
                </h3>
                <div className="flex bg-background rounded-lg border p-1">
                    <button
                        onClick={() => setViewMode('price')}
                        className={`px-3 py-1 text-sm rounded-md transition-all ${viewMode === 'price' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted'}`}
                    >
                        漲跌幅
                    </button>
                    <button
                        onClick={() => setViewMode('revenue')}
                        className={`px-3 py-1 text-sm rounded-md transition-all ${viewMode === 'revenue' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted'}`}
                    >
                        營收成長
                    </button>
                </div>
            </div>

            <div className="p-4">
                {/* Heat Map Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    {sectors.map((sector: any) => {
                        const value = viewMode === 'price' ? sector.changePercent : sector.revenueYoy;
                        const isPositive = value >= 0;
                        const intensity = Math.min(Math.abs(value) / (viewMode === 'price' ? 3 : 20), 1); // Adjust scale
                        const bgColor = isPositive
                            ? `rgba(239, 68, 68, ${intensity * 0.2 + 0.05})`
                            : `rgba(34, 197, 94, ${intensity * 0.2 + 0.05})`;
                        const textColor = isPositive ? 'text-red-600' : 'text-green-600';

                        return (
                            <div
                                key={sector.id}
                                className="p-3 rounded-lg border hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
                                style={{ backgroundColor: bgColor }}
                            >
                                <div className="text-sm font-medium mb-1 truncate" title={sector.name}>{sector.name}</div>
                                <div className={`text-lg font-bold ${textColor} flex items-center gap-1`}>
                                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                    {value > 0 ? '+' : ''}{value.toFixed(2)}%
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                                    <span>{viewMode === 'price' ? `${sector.stocks} 檔` : 'YoY'}</span>
                                    {viewMode === 'revenue' && (
                                        <span className={sector.revenueMom > 0 ? 'text-red-500' : 'text-green-500'}>
                                            MoM {sector.revenueMom > 0 ? '+' : ''}{sector.revenueMom.toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Top & Worst Performers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Top Performers */}
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 border border-red-200 dark:border-red-900">
                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-red-600" />
                            {viewMode === 'price' ? '強勢類股' : '營收高成長'}
                        </h4>
                        <div className="space-y-2">
                            {topPerformers.map((sector: any, idx) => (
                                <div key={sector.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-muted-foreground w-4">
                                            {idx + 1}
                                        </span>
                                        <span className="text-sm font-medium">{sector.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-red-600">
                                        +{viewMode === 'price' ? sector.changePercent.toFixed(2) : sector.revenueYoy.toFixed(2)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Worst Performers */}
                    <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 border border-green-200 dark:border-green-900">
                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-green-600" />
                            {viewMode === 'price' ? '弱勢類股' : '營收衰退'}
                        </h4>
                        <div className="space-y-2">
                            {worstPerformers.map((sector: any, idx) => (
                                <div key={sector.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-muted-foreground w-4">
                                            {idx + 1}
                                        </span>
                                        <span className="text-sm font-medium">{sector.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-green-600">
                                        {viewMode === 'price' ? sector.changePercent.toFixed(2) : sector.revenueYoy.toFixed(2)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
