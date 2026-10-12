"use client";

import React from 'react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { GlassCard } from '@/components/ui/glass-card';

interface DataPoint {
    date: string;
    value: number;
    [key: string]: string | number;
}

interface InteractiveLineChartProps {
    data: DataPoint[];
    dataKey: string;
    title?: string;
    color?: string;
    showGradient?: boolean;
    height?: number;
}

// Minimal payload shape that recharts passes to custom tooltip content
interface TooltipPayloadItem {
    name?: string;
    value?: number | string;
    color?: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: string | number;
}

// Custom glassmorphism tooltip
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="glass-card p-3 min-w-[120px] shadow-xl">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            {payload.map((entry, index) => (
                <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium" style={{ color: entry.color }}>
                        {entry.name}
                    </span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: entry.color }}>
                        {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

export function InteractiveLineChart({
    data,
    dataKey,
    title,
    color = 'hsl(var(--primary))',
    showGradient = true,
    height = 300
}: InteractiveLineChartProps) {
    const ChartComponent = showGradient ? AreaChart : LineChart;

    return (
        <GlassCard className="p-6">
            {title && (
                <h4 className="text-sm font-bold mb-4 text-foreground">{title}</h4>
            )}

            <ResponsiveContainer width="100%" height={height}>
                <ChartComponent
                    data={data}
                    margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                >
                    <defs>
                        <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        opacity={0.3}
                        vertical={false}
                    />

                    <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                    />

                    <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        dx={-10}
                        tickFormatter={(value) => value.toLocaleString()}
                    />

                    <Tooltip
                        content={<CustomTooltip />}
                        cursor={{
                            stroke: 'hsl(var(--primary))',
                            strokeWidth: 1,
                            strokeDasharray: '5 5'
                        }}
                    />

                    {showGradient ? (
                        <Area
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            strokeWidth={2}
                            fill={`url(#gradient-${dataKey})`}
                            animationDuration={1000}
                            animationEasing="ease-in-out"
                        />
                    ) : (
                        <Line
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{
                                r: 6,
                                fill: color,
                                stroke: 'hsl(var(--background))',
                                strokeWidth: 2
                            }}
                            animationDuration={1000}
                            animationEasing="ease-in-out"
                        />
                    )}
                </ChartComponent>
            </ResponsiveContainer>
        </GlassCard>
    );
}
