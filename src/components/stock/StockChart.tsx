"use client";

import React, { useMemo, useState } from 'react';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Cell,
    ReferenceLine
} from 'recharts';
import { calculateAllIndicators, calculateVolumeProfile } from '@/lib/technicalIndicators';
import { StockDataPoint } from '@/types/stock';

// --- Mock Data Generation ---

const generateData = (): StockDataPoint[] => {
    const rawData: StockDataPoint[] = [
        { date: '2023-01-01', open: 100, high: 105, low: 98, close: 102, volume: 1000 },
        { date: '2023-01-02', open: 102, high: 108, low: 101, close: 107, volume: 1200 },
        { date: '2023-01-03', open: 107, high: 110, low: 105, close: 104, volume: 900 },
        { date: '2023-01-04', open: 104, high: 106, low: 100, close: 101, volume: 1100 },
        { date: '2023-01-05', open: 101, high: 105, low: 99, close: 103, volume: 1300 },
    ];

    for (let i = 6; i <= 100; i++) {
        const prev = rawData[rawData.length - 1];
        const open = prev.close;
        const change = (Math.random() - 0.5) * 5;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;
        rawData.push({
            date: `2023-01-${i.toString().padStart(3, '0')}`,
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100,
            volume: Math.round(1000 + Math.random() * 1000),
        });
    }
    return rawData;
};

export function StockChart({ symbol }: { symbol: string }) {
    const [showBollinger, setShowBollinger] = useState(false);
    const [showVolumeProfile, setShowVolumeProfile] = useState(false);
    const [showRSI, setShowRSI] = useState(true);
    const [showATR, setShowATR] = useState(false);

    const chartData = useMemo(() => {
        const data = generateData();
        const withIndicators = calculateAllIndicators(data);
        return withIndicators.slice(30);
    }, []);

    const volumeProfileData = useMemo(() => {
        return calculateVolumeProfile(chartData);
    }, [chartData]);

    // Calculate dynamic heights based on visible charts
    const visibleSubcharts = [true, showRSI, showATR, true].filter(Boolean).length; // KD and MACD always visible
    const subchartHeight = 100;
    const mainChartHeight = 600 - (visibleSubcharts * subchartHeight);

    return (
        <div className="bg-card rounded-lg shadow p-4 relative">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">技術分析圖表</h3>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-sm flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showBollinger}
                                onChange={(e) => setShowBollinger(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            布林通道
                        </label>
                        <label className="text-sm flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showVolumeProfile}
                                onChange={(e) => setShowVolumeProfile(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            分價量表
                        </label>
                        <label className="text-sm flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showRSI}
                                onChange={(e) => setShowRSI(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            RSI
                        </label>
                        <label className="text-sm flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showATR}
                                onChange={(e) => setShowATR(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            ATR
                        </label>
                    </div>
                    <div className="flex gap-2">
                        {['日', '週', '月'].map((period) => (
                            <button key={period} className="px-3 py-1 text-sm rounded hover:bg-accent transition-colors border">
                                {period}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2 relative" style={{ height: `${600}px` }}>
                {/* Main Price Chart */}
                <div className="relative" style={{ height: `${mainChartHeight}px` }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} syncId="stockId" margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis dataKey="date" hide />
                            <YAxis yAxisId="price" domain={['auto', 'auto']} orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="volume" orientation="left" tick={false} axisLine={false} domain={[0, 'dataMax * 4']} />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                            <Legend verticalAlign="top" height={36} />

                            <Bar yAxisId="volume" dataKey="volume" name="成交量" fill="hsl(var(--muted-foreground))" opacity={0.3} barSize={20} />
                            <Line yAxisId="price" type="monotone" dataKey="close" name="收盤價" stroke="#ef4444" strokeWidth={2} dot={false} />

                            {!showBollinger && (
                                <>
                                    <Line yAxisId="price" type="monotone" dataKey="ma5" name="MA5" stroke="#f59e0b" strokeWidth={1} dot={false} />
                                    <Line yAxisId="price" type="monotone" dataKey="ma20" name="MA20" stroke="#8b5cf6" strokeWidth={1} dot={false} />
                                    <Line yAxisId="price" type="monotone" dataKey="ma60" name="MA60" stroke="#10b981" strokeWidth={1} dot={false} />
                                </>
                            )}

                            {showBollinger && (
                                <>
                                    <Line yAxisId="price" type="monotone" dataKey="bbUpper" name="BB Upper" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                                    <Line yAxisId="price" type="monotone" dataKey="bbMiddle" name="BB MA20" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                                    <Line yAxisId="price" type="monotone" dataKey="bbLower" name="BB Lower" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                                </>
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>

                    {/* Volume Profile Overlay */}
                    {showVolumeProfile && (
                        <div className="absolute top-0 right-0 bottom-0 w-1/4 pointer-events-none opacity-30 flex flex-col-reverse justify-between py-2">
                            {volumeProfileData.map((bucket, i) => (
                                <div key={i} className="flex justify-end items-center h-full w-full">
                                    <div
                                        className="bg-blue-500 h-[80%] rounded-l-sm transition-all"
                                        style={{ width: `${bucket.width}%` }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* RSI Chart */}
                {showRSI && (
                    <div style={{ height: `${subchartHeight}px` }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} syncId="stockId" margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis dataKey="date" hide />
                                <YAxis domain={[0, 100]} orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} ticks={[30, 50, 70]} />
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                                <Legend verticalAlign="top" iconSize={10} height={20} wrapperStyle={{ fontSize: '12px' }} />
                                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '超買', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                                <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" label={{ value: '超賣', position: 'right', fill: '#22c55e', fontSize: 10 }} />
                                <Line type="monotone" dataKey="rsi" name="RSI(14)" stroke="#10b981" strokeWidth={2} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* ATR Chart */}
                {showATR && (
                    <div style={{ height: `${subchartHeight}px` }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} syncId="stockId" margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis dataKey="date" hide />
                                <YAxis orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                                <Legend verticalAlign="top" iconSize={10} height={20} wrapperStyle={{ fontSize: '12px' }} />
                                <Line type="monotone" dataKey="atr" name="ATR(14)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* KD Chart */}
                <div style={{ height: `${subchartHeight}px` }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} syncId="stockId" margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis dataKey="date" hide />
                            <YAxis domain={[0, 100]} orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} ticks={[20, 50, 80]} />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                            <Legend verticalAlign="top" iconSize={10} height={20} wrapperStyle={{ fontSize: '12px' }} />
                            <Line type="monotone" dataKey="k" name="K(9)" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                            <Line type="monotone" dataKey="d" name="D(9)" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* MACD Chart */}
                <div style={{ height: `${subchartHeight}px` }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} syncId="stockId" margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={30} axisLine={false} tickLine={false} />
                            <YAxis orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                            <Legend verticalAlign="top" iconSize={10} height={20} wrapperStyle={{ fontSize: '12px' }} />
                            <Bar dataKey="osc" name="OSC" fill="#ef4444" barSize={20}>
                                {chartData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.osc >= 0 ? '#ef4444' : '#22c55e'} />
                                ))}
                            </Bar>
                            <Line type="monotone" dataKey="dif" name="DIF" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                            <Line type="monotone" dataKey="dem" name="MACD" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
