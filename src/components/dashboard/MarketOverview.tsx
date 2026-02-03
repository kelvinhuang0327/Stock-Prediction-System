import React from 'react';
import { ArrowUp, ArrowDown, Activity, TrendingUp } from 'lucide-react';

export function MarketOverview() {
    // Mock data for Taiwan Market Indices
    const indices = [
        {
            name: '加權指數',
            value: 17853.22,
            change: 125.35,
            changePercent: 0.71,
            volume: 3250.5 // 億
        },
        {
            name: '櫃買指數',
            value: 234.15,
            change: -1.25,
            changePercent: -0.53,
            volume: 850.2
        },
        {
            name: '台指期',
            value: 17860,
            change: 130,
            changePercent: 0.73,
            volume: 125000
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {indices.map((idx) => {
                const isPositive = idx.change >= 0;
                const colorClass = isPositive ? 'text-red-600' : 'text-green-600';
                const bgClass = isPositive ? 'bg-red-50' : 'bg-green-50';
                const borderClass = isPositive ? 'border-red-100' : 'border-green-100';

                return (
                    <div key={idx.name} className={`p-6 rounded-xl border ${borderClass} ${bgClass} shadow-sm transition-all hover:shadow-md`}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                {idx.name}
                                {idx.name === '加權指數' && <Activity className="w-4 h-4 text-muted-foreground" />}
                            </h3>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${isPositive ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {isPositive ? '多頭' : '整理'}
                            </span>
                        </div>

                        <div className={`text-3xl font-bold font-mono my-2 ${colorClass}`}>
                            {idx.value.toLocaleString()}
                        </div>

                        <div className="flex items-center gap-4">
                            <div className={`flex items-center gap-1 font-medium ${colorClass}`}>
                                {isPositive ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
                                <span>{Math.abs(idx.change)}</span>
                                <span>({Math.abs(idx.changePercent)}%)</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-border/50 flex justify-between text-sm text-muted-foreground">
                            <span>成交量</span>
                            <span className="font-mono font-medium text-foreground">
                                {idx.name.includes('期') ? idx.volume.toLocaleString() : `${idx.volume}億`}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
