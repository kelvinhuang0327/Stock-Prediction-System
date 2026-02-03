"use client";

import React, { useMemo, useState } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    LineChart,
    Line
} from 'recharts';

const rawData = [
    { date: '11/20', foreign: 500, trust: 100, dealer: 50, holders400: 65.2, holders1000: 52.1 },
    { date: '11/21', foreign: 800, trust: 150, dealer: -20, holders400: 65.3, holders1000: 52.2 },
    { date: '11/22', foreign: -200, trust: 50, dealer: 10, holders400: 65.1, holders1000: 52.0 },
    { date: '11/23', foreign: 1200, trust: 200, dealer: 100, holders400: 65.5, holders1000: 52.4 },
    { date: '11/24', foreign: 1500, trust: 180, dealer: 50, holders400: 65.8, holders1000: 52.7 },
    { date: '11/27', foreign: 1500, trust: 200, dealer: 100, holders400: 66.0, holders1000: 53.0 },
    { date: '11/28', foreign: -500, trust: 300, dealer: -50, holders400: 65.9, holders1000: 52.9 },
    { date: '11/29', foreign: 2000, trust: 150, dealer: 80, holders400: 66.2, holders1000: 53.2 },
    { date: '11/30', foreign: 800, trust: -100, dealer: 200, holders400: 66.3, holders1000: 53.3 },
    { date: '12/01', foreign: -1200, trust: 50, dealer: -150, holders400: 66.1, holders1000: 53.1 },
];

export function InstitutionalChips({ symbol }: { symbol: string }) {
    const [viewMode, setViewMode] = useState<'daily' | 'cumulative' | 'insider'>('daily');

    const processedData = useMemo(() => {
        let accForeign = 0;
        let accTrust = 0;
        let accDealer = 0;

        return rawData.map(item => {
            accForeign += item.foreign;
            accTrust += item.trust;
            accDealer += item.dealer;
            return {
                ...item,
                accForeign,
                accTrust,
                accDealer
            };
        });
    }, []);

    // Calculate last 5 days sum for summary cards
    const last5 = rawData.slice(-5);
    const sumForeign = last5.reduce((acc, curr) => acc + curr.foreign, 0);
    const sumTrust = last5.reduce((acc, curr) => acc + curr.trust, 0);
    const sumDealer = last5.reduce((acc, curr) => acc + curr.dealer, 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard title="外資近五日" value={sumForeign} />
                <SummaryCard title="投信近五日" value={sumTrust} />
                <SummaryCard title="自營商近五日" value={sumDealer} />
            </div>

            <div className="bg-card rounded-lg border p-4 h-[450px]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">籌碼分析</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('daily')}
                            className={`px-3 py-1 text-sm rounded transition-colors border ${viewMode === 'daily' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                        >
                            每日買賣超
                        </button>
                        <button
                            onClick={() => setViewMode('cumulative')}
                            className={`px-3 py-1 text-sm rounded transition-colors border ${viewMode === 'cumulative' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                        >
                            累計買賣超
                        </button>
                        <button
                            onClick={() => setViewMode('insider')}
                            className={`px-3 py-1 text-sm rounded transition-colors border ${viewMode === 'insider' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                        >
                            大戶持股
                        </button>
                    </div>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    {viewMode === 'daily' ? (
                        <BarChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                            <Legend />
                            <ReferenceLine y={0} stroke="hsl(var(--border))" />
                            <Bar dataKey="foreign" name="外資" fill="#ef4444" />
                            <Bar dataKey="trust" name="投信" fill="#8b5cf6" />
                            <Bar dataKey="dealer" name="自營商" fill="#f59e0b" />
                        </BarChart>
                    ) : viewMode === 'cumulative' ? (
                        <LineChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                            <Legend />
                            <ReferenceLine y={0} stroke="hsl(var(--border))" />
                            <Line type="monotone" dataKey="accForeign" name="外資累計" stroke="#ef4444" strokeWidth={2} dot={true} />
                            <Line type="monotone" dataKey="accTrust" name="投信累計" stroke="#8b5cf6" strokeWidth={2} dot={true} />
                            <Line type="monotone" dataKey="accDealer" name="自營商累計" stroke="#f59e0b" strokeWidth={2} dot={true} />
                        </LineChart>
                    ) : (
                        <LineChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                            <Legend />
                            <Line type="monotone" dataKey="holders400" name="400張以上大戶" stroke="#ef4444" strokeWidth={2} dot={true} />
                            <Line type="monotone" dataKey="holders1000" name="1000張以上大戶" stroke="#8b5cf6" strokeWidth={2} dot={true} />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
    const isPositive = value > 0;
    return (
        <div className="bg-card p-4 rounded-lg border flex justify-between items-center">
            <span className="text-muted-foreground">{title}</span>
            <span className={`text-xl font-bold font-mono ${isPositive ? 'text-red-600' : 'text-green-600'}`}>
                {value > 0 ? '+' : ''}{value}
            </span>
        </div>
    );
}
