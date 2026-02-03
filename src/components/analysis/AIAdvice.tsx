"use client";

import React from 'react';
import { Activity, TrendingUp, DollarSign, Users, MessageCircle } from 'lucide-react';

export function AIAdvice() {
    const diagnostic = {
        totalScore: 88,
        summary: "Strong Buy",
        breakdown: [
            { label: '技術面', score: 92, icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-100', desc: '均線多頭排列，KD黃金交叉' },
            { label: '基本面', score: 85, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-100', desc: '營收創新高，三率三升' },
            { label: '籌碼面', score: 78, icon: Users, color: 'text-purple-600', bg: 'bg-purple-100', desc: '外資連續買超，大戶持股增' },
            { label: '消息面', score: 95, icon: MessageCircle, color: 'text-orange-600', bg: 'bg-orange-100', desc: 'AI題材發酵，市場熱度高' },
        ]
    };

    return (
        <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Activity className="w-6 h-6 text-primary" />
                    AI 智能診股
                </h2>
                <div className="text-sm text-muted-foreground">
                    AI信心度: 95%
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-center">
                {/* Total Score Circle */}
                <div className="relative w-48 h-48 flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="96"
                            cy="96"
                            r="88"
                            stroke="hsl(var(--muted))"
                            strokeWidth="12"
                            fill="none"
                        />
                        <circle
                            cx="96"
                            cy="96"
                            r="88"
                            stroke="#ef4444"
                            strokeWidth="12"
                            fill="none"
                            strokeDasharray={2 * Math.PI * 88}
                            strokeDashoffset={2 * Math.PI * 88 * (1 - diagnostic.totalScore / 100)}
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-5xl font-bold text-red-600">{diagnostic.totalScore}</span>
                        <span className="text-sm font-medium text-muted-foreground mt-1">總分</span>
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full mt-2">
                            {diagnostic.summary}
                        </span>
                    </div>
                </div>

                {/* Breakdown Grid */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    {diagnostic.breakdown.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="bg-muted/30 p-4 rounded-lg border flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${item.bg}`}>
                                    <Icon className={`w-5 h-5 ${item.color}`} />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold">{item.label}</span>
                                        <span className={`font-bold ${item.score >= 80 ? 'text-red-600' : 'text-green-600'}`}>
                                            {item.score}分
                                        </span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                                        <div
                                            className={`h-1.5 rounded-full ${item.score >= 80 ? 'bg-red-500' : 'bg-green-500'}`}
                                            style={{ width: `${item.score}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {item.desc}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-6 bg-accent/30 p-4 rounded-lg border border-accent">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    AI 綜合短評
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    該股近期表現強勢，技術面呈現多頭排列，且有基本面營收成長支撐。籌碼面外資持續買進，顯示法人偏多操作。建議可沿五日線操作，若回檔至月線不破為絕佳買點。
                </p>
            </div>
        </div>
    );
}

function ScoreCard({ title, score, max, label, color }: any) {
    return (
        <div className="bg-background border rounded-lg p-4 text-center">
            <h3 className="text-sm text-muted-foreground mb-2">{title}</h3>
            <div className={`text-3xl font-bold mb-1 ${color}`}>{score}/{max}</div>
            <div className="text-sm font-medium">{label}</div>
        </div>
    );
}

function AnalysisSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            {children}
        </div>
    );
}
