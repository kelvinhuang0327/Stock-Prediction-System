'use client';

import React from 'react';
import { Plus, Zap, Clock } from 'lucide-react';

interface Props {
    dbLastUpdated: string | null;
    isAnalyzing: boolean;
    onRefresh: () => void;
    onAddStock: () => void;
}

export function WatchlistToolbar({ dbLastUpdated, isAnalyzing, onRefresh, onAddStock }: Props) {
    return (
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
                    onClick={onRefresh}
                    disabled={isAnalyzing}
                    className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 transition-colors disabled:opacity-50"
                >
                    <Zap className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    {isAnalyzing ? 'Updating...' : 'Refresh Prices'}
                </button>
                <button
                    onClick={onAddStock}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-4 h-4" /> 加入股票
                </button>
            </div>
        </div>
    );
}
