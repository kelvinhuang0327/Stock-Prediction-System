'use client';

import React from 'react';
import { Plus, Zap, Clock, Database, HardDrive } from 'lucide-react';
import { MigrationStatus } from '@/types/watchlist';

interface Props {
    dbLastUpdated: string | null;
    isAnalyzing: boolean;
    onRefresh: () => void;
    onAddStock: () => void;
    migrationStatus?: MigrationStatus;
    migrationMessage?: string | null;
    useDbSource?: boolean;
}

export function WatchlistToolbar({ dbLastUpdated, isAnalyzing, onRefresh, onAddStock, migrationStatus, migrationMessage, useDbSource }: Props) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">My Watchlist & Portfolio</h1>
                    <p className="text-muted-foreground">管理您的自選股、庫存與價格警示</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {dbLastUpdated && (
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                最後更新：{dbLastUpdated}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            {useDbSource ? <Database className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
                            {useDbSource ? '資料庫模式' : '本機模式'}
                        </span>
                    </div>
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

            {/* Migration status banner */}
            {migrationMessage && migrationStatus && migrationStatus !== 'db-first' && migrationStatus !== 'idle' && (
                <div className={`text-xs px-3 py-2 rounded-md ${
                    migrationStatus === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                    migrationStatus === 'failed' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                    migrationStatus === 'migrating' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                    'bg-muted text-muted-foreground'
                }`}>
                    {migrationMessage}
                </div>
            )}
        </div>
    );
}
