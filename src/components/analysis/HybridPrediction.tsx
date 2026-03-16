"use client";

import React, { useEffect, useState } from 'react';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Info, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface HybridPredictionProps {
    symbol: string;
}

export function HybridPrediction({ symbol }: HybridPredictionProps) {
    const [prediction, setPrediction] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (symbol) {
            fetchPrediction();
        }
    }, [symbol]);

    const fetchPrediction = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/predictions/${symbol}`);
            if (!res.ok) throw new Error('Failed to fetch prediction');
            const data = await res.json();
            setPrediction(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-card rounded-lg shadow-lg border p-6 animate-pulse">
                <div className="h-6 w-1/3 bg-muted rounded mb-4"></div>
                <div className="h-20 bg-muted rounded"></div>
            </div>
        );
    }

    if (error || !prediction) {
        return (
            <div className="bg-card rounded-lg shadow-lg border p-6 text-center">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                <p className="text-muted-foreground">{error || '無法生成預估結果'}</p>
            </div>
        );
    }

    const getSignalColor = (signal: string) => {
        switch (signal) {
            case 'BUY': return 'bg-red-600';
            case 'SELL': return 'bg-green-600';
            case 'CAUTION': return 'bg-yellow-500';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div className="bg-card rounded-lg shadow-xl border overflow-hidden">
            <div className="bg-primary/5 p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Brain className="w-6 h-6 text-primary" />
                    <h3 className="text-lg font-bold">AI 混合預估系統 (Hybrid Prediction)</h3>
                </div>
                <Badge className={`${getSignalColor(prediction.signal)} text-white px-3 py-1 text-sm font-bold`}>
                    建議：{prediction.signal}
                </Badge>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Visual Score Comparison */}
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-blue-500" /> 技術面評分 (Technical)
                                </span>
                                <span className="text-lg font-bold">{prediction.technicalScore}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-3">
                                <div
                                    className="bg-blue-500 h-3 rounded-full transition-all duration-1000"
                                    style={{ width: `${prediction.technicalScore}%` }}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-orange-500" /> 時事新聞情緒 (News Sentiment)
                                </span>
                                <span className="text-lg font-bold">{prediction.newsScore}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-3">
                                <div
                                    className="bg-orange-500 h-3 rounded-full transition-all duration-1000"
                                    style={{ width: `${prediction.newsScore}%` }}
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <div className="flex items-center justify-between">
                                <span className="text-base font-bold">綜合成績 (Total Score)</span>
                                <span className="text-2xl font-black text-primary">{prediction.totalScore}</span>
                            </div>
                        </div>
                    </div>

                    {/* Analysis Summary */}
                    <div className="space-y-4">
                        <div className="bg-muted/30 rounded-xl p-5 border border-dashed border-muted-foreground/30">
                            <div className="flex items-center gap-2 mb-3">
                                <Info className="w-4 h-4 text-muted-foreground" />
                                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">分析彙整</h4>
                            </div>
                            <div className="space-y-3">
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">關鍵因素：</span>
                                    <p className="text-sm font-medium">{prediction.factors.techFactors}</p>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">新聞動能：</span>
                                    <p className="text-sm font-medium">{prediction.factors.newsAnalysis}</p>
                                </div>
                            </div>
                        </div>

                        {/* Major Player Section */}
                        {prediction.majorPlayer && (
                            <div className="bg-primary/5 rounded-xl p-5 border border-primary/20">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Zap className="w-4 h-4" /> 主力籌碼診斷
                                    </h4>
                                    <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30 text-primary">
                                        {prediction.majorPlayer.dominantPlayer}主導
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-[10px] text-muted-foreground uppercase">
                                            {prediction.majorPlayer.dominantPlayer}預估進價
                                        </span>
                                        <div className="text-lg font-bold text-foreground">
                                            ${prediction.majorPlayer.averageCost}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-muted-foreground uppercase">波段目標預估</span>
                                        <div className="text-lg font-bold text-red-600">
                                            ${prediction.majorPlayer.targetPrice}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground italic">
                                    {prediction.majorPlayer.description}
                                </div>
                            </div>
                        )}

                        <div className="mt-1 p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded border border-amber-200/50 text-[10px] leading-relaxed text-muted-foreground">
                            ⚠️ 本預估結合 60 日技術指標、新聞情緒與籌碼分析，屬模型推估而非預測。信心分數基於訊號一致性計算，非準確度保證。所有目標價位僅為技術參考，不構成投資建議。實際交易涉及交易成本、滑價與流動性風險。
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
