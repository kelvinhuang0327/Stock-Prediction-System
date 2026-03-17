"use client";

import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Activity, ShieldCheck, AlertTriangle, TrendingUp } from 'lucide-react';

export function MarketOverview() {
    const [status, setStatus] = useState<any>(null);
    const [indices, setIndices] = useState([
        {
            code: 't00',
            name: '加權指數',
            value: 0,
            change: 0,
            changePercent: 0,
        },
        {
            code: 'o00',
            name: '櫃買指數',
            value: 0,
            change: 0,
            changePercent: 0,
        },
        {
            code: 't13',
            name: '電子指數',
            value: 0,
            change: 0,
            changePercent: 0,
        }
    ]);

    useEffect(() => {
        const fetchData = async () => {
            // 1. Fetch Market Status (Regime)
            try {
                const res = await fetch('/api/market-status');
                if (res.ok) {
                    const data = await res.json();
                    setStatus(data);
                }
            } catch (e) { console.error(e); }

            // 2. Fetch Realtime Indices
            const codes = ['t00', 'o00', 't13'];
            const updates = await Promise.all(codes.map(async (code) => {
                try {
                    const res = await fetch(`/api/stocks/${code}/realtime`);
                    if (!res.ok) return null;
                    const json = await res.json();
                    return json.data;
                } catch (e) {
                    return null;
                }
            }));

            setIndices(prev => prev.map(idx => {
                const rt = updates.find(u => u && u.code === idx.code);
                if (!rt) return idx;

                const currentValue = rt.close > 0 ? rt.close : (rt.open > 0 ? rt.open : idx.value);
                const prevClose = rt.prevClose || currentValue;

                let change = 0;
                let changePercent = 0;

                if (currentValue > 0 && prevClose > 0) {
                    change = currentValue - prevClose;
                    changePercent = (change / prevClose) * 100;
                }

                return {
                    ...idx,
                    value: currentValue,
                    change: change,
                    changePercent: changePercent,
                };
            }));
        };

        const timer = setInterval(fetchData, 5000);
        fetchData();
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Market Regime Card */}
            <div className={`p-6 rounded-xl border flex flex-col justify-between shadow-sm relative overflow-hidden ${status?.status === 'Bullish' ? 'bg-red-50 border-red-200' :
                    status?.status === 'Bearish' ? 'bg-green-50 border-green-200' : // Taiwan green is bearish usually means safe? No, Bearish is bad. Wait.
                        // In Taiwan, Red is Up/Good (Bullish), Green is Down/Bad (Bearish).
                        // But generally "Safe" is Green in UI design.
                        // Let's stick to Taiwan colors: Red = Bullish/Hot, Green = Bearish/Cold.
                        'bg-gray-50 border-gray-200'
                }`}>

                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className={`w-5 h-5 ${status?.status === 'Bullish' ? 'text-red-600' :
                                status?.status === 'Bearish' ? 'text-green-600' : 'text-gray-600'
                            }`} />
                        <span className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Market Regime</span>
                    </div>
                    <div className={`text-2xl font-black ${status?.status === 'Bullish' ? 'text-red-600' :
                            status?.status === 'Bearish' ? 'text-green-600' : 'text-gray-600'
                        }`}>
                        {status?.status || 'Loading...'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">
                        Risk Scale: <span className="font-bold text-foreground">{(status?.scalingFactor || 1) * 100}%</span>
                    </div>
                </div>

                {status?.status === 'Bullish' && <TrendingUp className="absolute bottom-4 right-4 w-12 h-12 text-red-500/10" />}
                {status?.status === 'Bearish' && <AlertTriangle className="absolute bottom-4 right-4 w-12 h-12 text-green-500/10" />}
            </div>

            {/* Indices */}
            {indices.map((index, i) => {
                const isPositive = index.change >= 0;
                const Icon = isPositive ? ArrowUp : ArrowDown;
                // Taiwan: Red Up, Green Down
                const colorClass = isPositive ? 'text-red-600' : 'text-green-600';
                const bgClass = isPositive ? 'bg-red-50' : 'bg-green-50';

                return (
                    <div
                        key={index.code}
                        className="glass-card p-6 hover-lift transition-all duration-300 border"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-muted-foreground font-bold">{index.name}</span>
                            <div className={`${bgClass} rounded-full px-2 py-1`}>
                                <Icon className={`w-3 h-3 ${colorClass}`} />
                            </div>
                        </div>

                        <div className="mb-2">
                            <div className={`text-2xl font-bold tabular-nums ${colorClass}`}>
                                {index.value.toFixed(2)}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                            <span className={`font-semibold ${colorClass} tabular-nums`}>
                                {index.change > 0 ? '+' : ''}{index.change.toFixed(2)}
                            </span>
                            <span className={`font-medium ${colorClass} tabular-nums opacity-80`}>
                                ({index.changePercent > 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
