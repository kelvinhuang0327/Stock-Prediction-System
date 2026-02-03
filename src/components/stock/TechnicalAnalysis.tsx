"use client";

import React, { useMemo } from 'react';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from 'recharts';
import { calculateAllIndicators } from '@/lib/technicalIndicators';
import { StockDataPoint } from '@/types/stock';

// Mock Data Generation
const generateData = (count: number): StockDataPoint[] => {
    const data: StockDataPoint[] = [];
    let close = 100;

    for (let i = 0; i < count; i++) {
        const change = (Math.random() - 0.5) * 5;
        close = close + change;
        const open = close - (Math.random() - 0.5) * 2;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;

        data.push({
            date: `12/${i + 1}`,
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100,
            volume: Math.round(1000 + Math.random() * 2000)
        });
    }

    return data;
};

export function TechnicalAnalysis({ symbol }: { symbol: string }) {
    const data = useMemo(() => {
        const rawData = generateData(60);
        return calculateAllIndicators(rawData);
    }, [symbol]);

    return (
        <div className="space-y-8">
            {/* KD Chart */}
            <ChartContainer title="KD 隨機指標 (Stochastic Oscillator)">
                <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend />
                    <ReferenceLine y={80} stroke="red" strokeDasharray="3 3" label={{ value: '超買', position: 'insideTopRight', fill: 'red', fontSize: 10 }} />
                    <ReferenceLine y={20} stroke="green" strokeDasharray="3 3" label={{ value: '超賣', position: 'insideBottomRight', fill: 'green', fontSize: 10 }} />
                    <Line type="monotone" dataKey="k" name="K" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="d" name="D" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </ComposedChart>
            </ChartContainer>

            {/* MACD Chart */}
            <ChartContainer title="MACD 指數平滑異同移動平均線">
                <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                    <Bar dataKey="osc" name="OSC" fill="#ef4444" barSize={10}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={(entry.osc || 0) > 0 ? '#ef4444' : '#22c55e'} />
                        ))}
                    </Bar>
                    <Line type="monotone" dataKey="dif" name="DIF" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="dem" name="MACD" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </ComposedChart>
            </ChartContainer>

            {/* RSI Chart */}
            <ChartContainer title="RSI 相對強弱指標 (Relative Strength Index)">
                <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend />
                    <ReferenceLine y={70} stroke="red" strokeDasharray="3 3" label={{ value: '超買', position: 'insideTopRight', fill: 'red', fontSize: 10 }} />
                    <ReferenceLine y={30} stroke="green" strokeDasharray="3 3" label={{ value: '超賣', position: 'insideBottomRight', fill: 'green', fontSize: 10 }} />
                    <Line type="monotone" dataKey="rsi" name="RSI" stroke="#10b981" strokeWidth={2} dot={false} />
                </ComposedChart>
            </ChartContainer>

            {/* Williams %R Chart */}
            <ChartContainer title="Williams %R 威廉指標">
                <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[-100, 0]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend />
                    <ReferenceLine y={-20} stroke="red" strokeDasharray="3 3" label={{ value: '超買', position: 'insideTopRight', fill: 'red', fontSize: 10 }} />
                    <ReferenceLine y={-80} stroke="green" strokeDasharray="3 3" label={{ value: '超賣', position: 'insideBottomRight', fill: 'green', fontSize: 10 }} />
                    <Line type="monotone" dataKey="williamsR" name="Williams %R" stroke="#ec4899" strokeWidth={2} dot={false} />
                </ComposedChart>
            </ChartContainer>

            {/* CCI Chart */}
            <ChartContainer title="CCI 商品通道指標 (Commodity Channel Index)">
                <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend />
                    <ReferenceLine y={100} stroke="red" strokeDasharray="3 3" label={{ value: '超買', position: 'insideTopRight', fill: 'red', fontSize: 10 }} />
                    <ReferenceLine y={-100} stroke="green" strokeDasharray="3 3" label={{ value: '超賣', position: 'insideBottomRight', fill: 'green', fontSize: 10 }} />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                    <Line type="monotone" dataKey="cci" name="CCI" stroke="#06b6d4" strokeWidth={2} dot={false} />
                </ComposedChart>
            </ChartContainer>
        </div>
    );
}

function ChartContainer({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card rounded-lg border p-4 h-[350px] flex flex-col">
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    {children as React.ReactElement}
                </ResponsiveContainer>
            </div>
        </div>
    );
}
