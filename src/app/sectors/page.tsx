"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { stockService } from '@/lib/stockService';
import { Sector } from '@/lib/mockData';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';

const CustomContent = (props: any) => {
    const { root, depth, x, y, width, height, index, payload, colors, rank, name } = props;

    if (!payload) return null;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: (payload.changePercent || 0) >= 0 ? '#ef4444' : '#22c55e',
                    stroke: '#fff',
                    strokeWidth: 2 / (depth + 1e-10),
                    strokeOpacity: 1 / (depth + 1e-10),
                }}
            />
            {width > 50 && height > 30 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={14}
                    fontWeight="bold"
                >
                    {name}
                </text>
            )}
            {width > 50 && height > 50 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 20}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={12}
                >
                    {(payload.changePercent || 0) > 0 ? '+' : ''}{payload.changePercent}%
                </text>
            )}
        </g>
    );
};

export default function SectorsPage() {
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSectors();
    }, []);

    const loadSectors = async () => {
        setLoading(true);
        const data = await stockService.getSectors();
        setSectors(data.sort((a, b) => b.changePercent - a.changePercent));
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-muted rounded w-1/3"></div>
                    <div className="h-64 bg-muted rounded"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="h-32 bg-muted rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const treemapData = sectors.map(s => ({
        ...s,
        size: s.volume, // Use volume as size
    }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Sector Analysis</h1>
                <p className="text-muted-foreground">台股類股分析與表現追蹤</p>
            </div>

            {/* Sector Treemap */}
            <div className="bg-card rounded-xl shadow-sm border p-6">
                <h3 className="font-bold text-lg mb-4">類股熱力圖 (依成交量)</h3>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                            data={treemapData}
                            dataKey="size"
                            aspectRatio={4 / 3}
                            stroke="#fff"
                            content={<CustomContent />}
                        >
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-background border rounded p-2 shadow-lg text-sm">
                                                <div className="font-bold">{data.name}</div>
                                                <div className={data.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}>
                                                    漲跌幅: {data.changePercent > 0 ? '+' : ''}{data.changePercent}%
                                                </div>
                                                <div>成交量: {data.volume.toLocaleString()} 張</div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                        </Treemap>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Sector Performance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-6 border border-red-200 dark:border-red-900">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-red-600" />
                        <span className="text-sm text-muted-foreground">上漲類股</span>
                    </div>
                    <div className="text-3xl font-bold text-red-600">
                        {sectors.filter(s => s.changePercent > 0).length}
                    </div>
                </div>

                <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-6 border border-green-200 dark:border-green-900">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-muted-foreground">下跌類股</span>
                    </div>
                    <div className="text-3xl font-bold text-green-600">
                        {sectors.filter(s => s.changePercent < 0).length}
                    </div>
                </div>

                <div className="bg-primary/10 rounded-xl p-6 border border-primary/20">
                    <div className="text-sm text-muted-foreground mb-2">平均漲跌幅</div>
                    <div className={`text-3xl font-bold ${sectors.reduce((sum, s) => sum + s.changePercent, 0) / sectors.length >= 0
                        ? 'text-red-600'
                        : 'text-green-600'
                        }`}>
                        {(sectors.reduce((sum, s) => sum + s.changePercent, 0) / sectors.length).toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* Sector List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sectors.map((sector) => {
                    const isPositive = sector.changePercent >= 0;
                    const colorClass = isPositive ? 'text-red-600' : 'text-green-600';
                    const bgClass = isPositive
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                        : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900';

                    return (
                        <Link
                            key={sector.id}
                            href={`/sectors/${sector.id}`}
                            className={`block rounded-xl p-6 border hover:shadow-lg transition-all ${bgClass}`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-xl font-bold mb-1">{sector.name}</h3>
                                    <div className="text-sm text-muted-foreground">
                                        {sector.stocks} 檔股票
                                    </div>
                                </div>
                                <div className={`text-right ${colorClass}`}>
                                    <div className="text-2xl font-bold flex items-center gap-1">
                                        {isPositive ? (
                                            <TrendingUp className="w-6 h-6" />
                                        ) : (
                                            <TrendingDown className="w-6 h-6" />
                                        )}
                                        {sector.changePercent > 0 ? '+' : ''}
                                        {sector.changePercent.toFixed(2)}%
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-muted-foreground mb-1">漲跌點數</div>
                                    <div className={`font-bold ${colorClass}`}>
                                        {sector.change > 0 ? '+' : ''}
                                        {sector.change.toFixed(2)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-1">成交量</div>
                                    <div className="font-bold">
                                        {sector.volume.toLocaleString()} 張
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-2 text-sm text-primary font-medium">
                                查看詳情
                                <ArrowRight className="w-4 h-4" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
