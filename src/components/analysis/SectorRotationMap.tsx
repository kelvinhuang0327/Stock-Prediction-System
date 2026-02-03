"use client";

import React, { useEffect, useState } from 'react';
import { stockService } from '@/lib/stockService';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ZAxis
} from 'recharts';

export function SectorRotationMap() {
    const [sectors, setSectors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await stockService.getSectors();

        // Transform data for scatter plot
        // X-axis: Relative Strength (momentum)
        // Y-axis: Change Percent (performance)
        // Size: Volume
        const transformed = data.map(sector => ({
            ...sector,
            relativeStrength: Math.random() * 100 + 50, // Mock RS value
            momentum: sector.changePercent + (Math.random() - 0.5) * 2,
            size: sector.volume / 1000,
        }));

        setSectors(transformed);
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="bg-card rounded-lg shadow p-6 h-[500px] flex items-center justify-center">
                <div className="text-muted-foreground">Loading sector rotation map...</div>
            </div>
        );
    }

    // Quadrant labels
    const quadrants = [
        { x: 25, y: 75, label: '領先 Leading', color: 'text-red-600' },
        { x: 75, y: 75, label: '改善 Improving', color: 'text-orange-500' },
        { x: 25, y: 25, label: '落後 Lagging', color: 'text-green-600' },
        { x: 75, y: 25, label: '弱化 Weakening', color: 'text-blue-500' },
    ];

    return (
        <div className="bg-card rounded-lg shadow p-6">
            <div className="mb-4">
                <h3 className="text-xl font-bold mb-2">類股輪動圖 Sector Rotation Map</h3>
                <p className="text-sm text-muted-foreground">
                    根據相對強度和動能分析類股表現趨勢
                </p>
            </div>

            <div className="h-[500px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                            type="number"
                            dataKey="relativeStrength"
                            name="相對強度"
                            domain={[0, 150]}
                            tick={{ fontSize: 12 }}
                            label={{ value: '相對強度 →', position: 'insideBottom', offset: -10 }}
                        />
                        <YAxis
                            type="number"
                            dataKey="momentum"
                            name="動能"
                            tick={{ fontSize: 12 }}
                            label={{ value: '← 動能', angle: -90, position: 'insideLeft' }}
                        />
                        <ZAxis type="number" dataKey="size" range={[100, 1000]} />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-popover border rounded-lg p-3 shadow-lg">
                                            <div className="font-bold mb-1">{data.name}</div>
                                            <div className="text-sm space-y-1">
                                                <div>漲跌: <span className={data.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}>
                                                    {data.changePercent > 0 ? '+' : ''}{data.changePercent.toFixed(2)}%
                                                </span></div>
                                                <div>相對強度: {data.relativeStrength.toFixed(1)}</div>
                                                <div>成交量: {data.volume.toLocaleString()}</div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />

                        {/* Reference lines for quadrants */}
                        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" opacity={0.3} />
                        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" opacity={0.3} />

                        <Scatter name="Sectors" data={sectors} fill="#8884d8">
                            {sectors.map((entry, index) => {
                                const color = entry.changePercent >= 0 ? '#ef4444' : '#22c55e';
                                return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>

                {/* Quadrant Labels */}
                {quadrants.map((q, idx) => (
                    <div
                        key={idx}
                        className={`absolute text-xs font-semibold ${q.color} opacity-50`}
                        style={{
                            left: `${q.x}%`,
                            top: `${100 - q.y}%`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        {q.label}
                    </div>
                ))}
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {sectors.slice(0, 4).map((sector) => (
                    <div key={sector.id} className="bg-muted/50 rounded p-2 text-sm">
                        <div className="font-medium">{sector.name}</div>
                        <div className={sector.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}>
                            {sector.changePercent > 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
