
"use client";

import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface RankingResult {
    stockId: string;
    name: string;
    value: number;
    label?: string;
}

interface SimplifiedIndicatorCardProps {
    title: string;
    metric: string;
    description: string;
}

export function SimplifiedIndicatorCard({ title, metric, description }: SimplifiedIndicatorCardProps) {
    const [rankings, setRankings] = useState<RankingResult[]>([]);
    const [searchId, setSearchId] = useState('');
    const [searchResult, setSearchResult] = useState<RankingResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        const fetchRankings = async () => {
            try {
                const res = await fetch(`/api/metrics/rankings?metric=${metric}`);
                const data = await res.json();
                setRankings(data);
            } catch (error) {
                console.error('Failed to fetch rankings:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRankings();
    }, [metric]);

    const handleSearch = async () => {
        if (!searchId) return;
        setSearching(true);
        try {
            const res = await fetch(`/api/stocks/${searchId}/analysis`); // Assuming this exists or using analyzeStock
            const data = await res.json();
            // Map analysis data to RankingResult structure
            setSearchResult({
                stockId: searchId,
                name: data.name || searchId,
                value: metric === 'rsi' ? data.rsi :
                    metric === 'revenue' ? data.revenueYoY :
                        metric === 'rs' ? data.rsScore : data.technicalScore
            });
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setSearching(false);
        }
    };

    return (
        <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex justify-between items-center">
                    {title}
                    <span className="text-xs font-normal text-muted-foreground">{description}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Search Unit */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="輸入股票代號..."
                            className="pl-9 bg-white/5 border-white/10"
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={searching}
                        className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-md transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : '查詢'}
                    </button>
                </div>

                {/* Search Result Display */}
                {searchResult && (
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-1">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-bold text-sm text-primary">{searchResult.stockId} {searchResult.name}</div>
                                <div className="text-xs text-primary/70 mt-1">當前指標值: {searchResult.value?.toFixed(2)}</div>
                            </div>
                            <button onClick={() => setSearchResult(null)} className="text-primary/50 hover:text-primary text-xs">清除</button>
                        </div>
                    </div>
                )}

                {/* Top 3 Rankings */}
                <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">今日最佳 Top 3</h4>
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground opacity-20" />
                        </div>
                    ) : (
                        rankings.map((stock, idx) => (
                            <div key={stock.stockId} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                            idx === 1 ? 'bg-slate-300/20 text-slate-300' :
                                                'bg-orange-400/20 text-orange-400'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium">{stock.stockId} {stock.name}</div>
                                        <div className="text-[10px] text-muted-foreground">{stock.label}</div>
                                    </div>
                                </div>
                                <div className="text-sm tabular-nums font-mono text-success">
                                    {stock.value?.toFixed(1)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
