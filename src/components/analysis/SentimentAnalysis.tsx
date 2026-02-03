"use client";

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Smile, Frown, Meh } from 'lucide-react';
import { stockService } from '@/lib/stockService';

export function SentimentAnalysis() {
    const [sentiment, setSentiment] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await stockService.getSentimentData();
        setSentiment(data);
        setLoading(false);
    };

    if (loading || !sentiment) {
        return (
            <div className="bg-card rounded-lg shadow p-6 h-[400px] flex items-center justify-center">
                <div className="text-muted-foreground">Loading sentiment analysis...</div>
            </div>
        );
    }

    const fearGreedLevel =
        sentiment.fearGreedIndex >= 75 ? { label: 'Extreme Greed', color: 'text-red-600', icon: Smile } :
            sentiment.fearGreedIndex >= 55 ? { label: 'Greed', color: 'text-orange-500', icon: Smile } :
                sentiment.fearGreedIndex >= 45 ? { label: 'Neutral', color: 'text-yellow-500', icon: Meh } :
                    sentiment.fearGreedIndex >= 25 ? { label: 'Fear', color: 'text-blue-500', icon: Frown } :
                        { label: 'Extreme Fear', color: 'text-green-600', icon: Frown };

    const Icon = fearGreedLevel.icon;

    return (
        <div className="bg-card rounded-lg shadow p-6">
            <div className="mb-6">
                <h3 className="text-xl font-bold mb-2">市場情緒分析 Sentiment Analysis</h3>
                <p className="text-sm text-muted-foreground">
                    綜合新聞、社群媒體和技術指標的市場情緒評估
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fear & Greed Index */}
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
                    <div className="text-center">
                        <div className="text-sm text-muted-foreground mb-2">恐懼與貪婪指數</div>
                        <div className="relative inline-block">
                            <svg className="w-48 h-48" viewBox="0 0 200 200">
                                {/* Background arc */}
                                <path
                                    d="M 30 170 A 85 85 0 0 1 170 170"
                                    fill="none"
                                    stroke="hsl(var(--muted))"
                                    strokeWidth="20"
                                    strokeLinecap="round"
                                />
                                {/* Colored segments */}
                                <path
                                    d="M 30 170 A 85 85 0 0 1 170 170"
                                    fill="none"
                                    stroke={`hsl(${sentiment.fearGreedIndex * 1.2}, 70%, 50%)`}
                                    strokeWidth="20"
                                    strokeLinecap="round"
                                    strokeDasharray={`${sentiment.fearGreedIndex * 2.67} 267`}
                                />
                                {/* Center text */}
                                <text x="100" y="130" textAnchor="middle" className="fill-foreground text-4xl font-bold">
                                    {sentiment.fearGreedIndex}
                                </text>
                            </svg>
                        </div>
                        <div className={`text-lg font-bold ${fearGreedLevel.color} flex items-center justify-center gap-2 mt-2`}>
                            <Icon className="w-5 h-5" />
                            {fearGreedLevel.label}
                        </div>
                    </div>
                </div>

                {/* Sentiment Breakdown */}
                <div className="space-y-4">
                    {/* Overall Sentiment */}
                    <div className="bg-background rounded-lg p-4 border">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">整體市場情緒</span>
                            <span className={`text-lg font-bold ${sentiment.sentiment === 'bullish' ? 'text-red-600' :
                                    sentiment.sentiment === 'bearish' ? 'text-green-600' :
                                        'text-yellow-500'
                                }`}>
                                {sentiment.sentiment === 'bullish' ? '看多' :
                                    sentiment.sentiment === 'bearish' ? '看空' : '中性'}
                            </span>
                        </div>
                    </div>

                    {/* News Sentiment */}
                    <div className="bg-background rounded-lg p-4 border">
                        <div className="text-sm font-medium mb-3">新聞情緒分析</div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-red-600" />
                                    <span className="text-sm">正面</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-32 bg-muted rounded-full h-2">
                                        <div
                                            className="bg-red-600 h-2 rounded-full"
                                            style={{ width: `${sentiment.newsPositive}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium w-12 text-right">{sentiment.newsPositive}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4 text-green-600" />
                                    <span className="text-sm">負面</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-32 bg-muted rounded-full h-2">
                                        <div
                                            className="bg-green-600 h-2 rounded-full"
                                            style={{ width: `${sentiment.newsNegative}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium w-12 text-right">{sentiment.newsNegative}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Social Media Buzz */}
                    <div className="bg-background rounded-lg p-4 border">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">社群媒體熱度</span>
                            <span className="text-lg font-bold text-primary">{sentiment.socialMediaBuzz}%</span>
                        </div>
                        <div className="mt-2 w-full bg-muted rounded-full h-2">
                            <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${sentiment.socialMediaBuzz}%` }}
                            />
                        </div>
                    </div>

                    {/* Volatility Index */}
                    <div className="bg-background rounded-lg p-4 border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-orange-500" />
                                <span className="text-sm font-medium">波動率指數</span>
                            </div>
                            <span className="text-lg font-bold">{sentiment.volatilityIndex}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            {sentiment.volatilityIndex < 15 ? '低波動' :
                                sentiment.volatilityIndex < 25 ? '中等波動' : '高波動'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
