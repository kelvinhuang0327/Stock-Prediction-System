"use client";

import React, { useState } from 'react';
import { Filter, ChevronRight, TrendingUp, DollarSign, Zap, Award } from 'lucide-react';

const strategies = [
    { id: 'value', name: '價值投資', icon: DollarSign, desc: '低本益比、高殖利率', color: 'bg-blue-100 text-blue-700' },
    { id: 'growth', name: '成長飆股', icon: TrendingUp, desc: '營收成長、獲利爆發', color: 'bg-red-100 text-red-700' },
    { id: 'momentum', name: '動能強勢', icon: Zap, desc: '強勢多頭、量能放大', color: 'bg-yellow-100 text-yellow-700' },
    { id: 'dividend', name: '定存好股', icon: Award, desc: '穩定配息、填息機率高', color: 'bg-green-100 text-green-700' },
];

const mockResults: Record<string, any[]> = {
    value: [
        { symbol: '2330', name: '台積電', price: 580, change: 1.5, reason: '本益比 < 20' },
        { symbol: '2317', name: '鴻海', price: 105, change: 0.5, reason: '殖利率 > 5%' },
        { symbol: '2454', name: '聯發科', price: 950, change: -0.8, reason: '股價淨值比低' },
    ],
    growth: [
        { symbol: '3035', name: '智原', price: 350, change: 5.2, reason: '營收 YoY +50%' },
        { symbol: '3661', name: '世芯-KY', price: 2800, change: 3.1, reason: 'EPS 創新高' },
    ],
    momentum: [
        { symbol: '3231', name: '緯創', price: 110, change: 8.5, reason: '突破均線糾結' },
        { symbol: '2382', name: '廣達', price: 220, change: 4.2, reason: '量能放大' },
    ],
    dividend: [
        { symbol: '2412', name: '中華電', price: 120, change: 0.2, reason: '連續20年配息' },
        { symbol: '2886', name: '兆豐金', price: 38, change: 0.1, reason: '殖利率 4.5%' },
    ]
};

export function SmartScreener() {
    const [activeStrategy, setActiveStrategy] = useState('value');

    return (
        <div className="bg-card rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5 text-primary" />
                    智慧選股
                    <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded">模擬數據</span>
                </h3>
                <button className="text-sm text-primary hover:underline flex items-center">
                    更多策略 <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Strategy Chips */}
            <div className="flex gap-3 overflow-x-auto pb-4 mb-2">
                {strategies.map((strategy) => {
                    const Icon = strategy.icon;
                    const isActive = activeStrategy === strategy.id;
                    return (
                        <button
                            key={strategy.id}
                            onClick={() => setActiveStrategy(strategy.id)}
                            className={`
                                flex flex-col items-start p-3 rounded-lg border min-w-[140px] transition-all
                                ${isActive ? 'ring-2 ring-primary border-primary bg-accent/50' : 'hover:bg-muted/50'}
                            `}
                        >
                            <div className={`p-1.5 rounded-md mb-2 ${strategy.color}`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <div className="font-bold text-sm">{strategy.name}</div>
                            <div className="text-xs text-muted-foreground mt-1">{strategy.desc}</div>
                        </button>
                    );
                })}
            </div>

            {/* Results List */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                    篩選結果 ({mockResults[activeStrategy].length})
                </h4>
                {mockResults[activeStrategy].map((stock) => (
                    <div key={stock.symbol} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground">
                                {stock.symbol}
                            </div>
                            <div>
                                <div className="font-bold">{stock.name}</div>
                                <div className="text-xs text-muted-foreground">{stock.reason}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-mono font-medium">{stock.price}</div>
                            <div className={`text-xs font-bold ${stock.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {stock.change > 0 ? '+' : ''}{stock.change}%
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
