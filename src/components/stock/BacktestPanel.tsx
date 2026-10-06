"use client";

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { Disclaimer } from '@/components/ui/disclaimer';
import { LoadingSpinner } from '@/components/ui/loading';
import { useApiPost } from '@/hooks/useApiData';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
    Play, BarChart3, Info, Calculator
} from 'lucide-react';

interface Trade {
    entryDate: string;
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    returnPct: number;
    reason: string;
}

interface BacktestResponse {
    symbol: string;
    strategy: string;
    period: string;
    trades: Trade[];
    summary: {
        totalTrades: number;
        winRate: number;
        avgReturn: number;
        maxDrawdown: number;
        totalReturn: number;
        sharpeRatio: number;
    };
    equityCurve: { date: string; value: number }[];
    methodology: string;
    source: string;
    disclaimer: string;
}

const STRATEGIES = [
    { key: 'ma_cross', label: 'MA 交叉策略', description: 'MA5/MA20 黃金交叉買進，死亡交叉賣出' },
    { key: 'rsi', label: 'RSI 策略', description: 'RSI<30 買進，RSI>70 賣出' },
    { key: 'bb', label: '布林通道策略', description: '跌破布林下軌買進，突破布林上軌賣出' },
];

const PERIOD_OPTIONS = [
    { months: 3, label: '3 個月' },
    { months: 6, label: '6 個月' },
    { months: 12, label: '1 年' },
];

export function BacktestPanel({ symbol }: { symbol: string }) {
    const [strategy, setStrategy] = useState('ma_cross');
    const [months, setMonths] = useState(6);
    const [result, setResult] = useState<BacktestResponse | null>(null);
    const { post, loading, error } = useApiPost<{ symbol: string; strategy: string; months: number }, BacktestResponse>();

    const runBacktest = async () => {
        const res = await post('/api/stocks/backtest', { symbol, strategy, months });
        if (res) setResult(res);
    };

    return (
        <div className="space-y-6">
            {/* Controls */}
            <GlassCard className="p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                    <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground font-medium">策略</label>
                        <div className="flex flex-wrap gap-2">
                            {STRATEGIES.map(s => (
                                <button
                                    key={s.key}
                                    onClick={() => setStrategy(s.key)}
                                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                                        strategy === s.key
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                                    }`}
                                    title={s.description}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground font-medium">回測期間</label>
                        <div className="flex gap-2">
                            {PERIOD_OPTIONS.map(p => (
                                <button
                                    key={p.months}
                                    onClick={() => setMonths(p.months)}
                                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                                        months === p.months
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={runBacktest}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
                    >
                        {loading ? <LoadingSpinner size="sm" /> : <Play className="w-4 h-4" />}
                        {loading ? '執行中...' : '執行回測'}
                    </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    {STRATEGIES.find(s => s.key === strategy)?.description}
                </p>
            </GlassCard>

            {error && (
                <GlassCard className="p-4 text-destructive text-sm">回測失敗：{error}</GlassCard>
            )}

            {/* Results */}
            {result && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <MetricCard label="總交易次數" value={result.summary.totalTrades} unit="次" />
                        <MetricCard
                            label="勝率"
                            value={result.summary.winRate}
                            unit="%"
                            color={result.summary.winRate >= 50 ? 'text-red-500' : 'text-green-500'}
                        />
                        <MetricCard
                            label="平均報酬"
                            value={result.summary.avgReturn}
                            unit="%"
                            color={result.summary.avgReturn >= 0 ? 'text-red-500' : 'text-green-500'}
                        />
                        <MetricCard
                            label="總報酬"
                            value={result.summary.totalReturn}
                            unit="%"
                            color={result.summary.totalReturn >= 0 ? 'text-red-500' : 'text-green-500'}
                        />
                        <MetricCard
                            label="最大回撤"
                            value={-result.summary.maxDrawdown}
                            unit="%"
                            color="text-green-500"
                        />
                        <MetricCard
                            label="Sharpe Ratio"
                            value={result.summary.sharpeRatio}
                            color={result.summary.sharpeRatio >= 1 ? 'text-red-500' : 'text-muted-foreground'}
                        />
                    </div>

                    {/* Equity Curve */}
                    {result.equityCurve.length > 0 && (
                        <GlassCard className="p-4">
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-primary" />
                                資金曲線
                            </h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={result.equityCurve}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(d) => d.slice(5)}
                                    />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{ background: 'hsl(220 20% 12%)', border: '1px solid hsl(217 32.6% 20%)', borderRadius: '8px' }}
                                        formatter={(value: number) => [`${value.toFixed(2)}`, '資金']}
                                    />
                                    <ReferenceLine y={100} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="hsl(200 100% 55%)"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </GlassCard>
                    )}

                    {/* Trade History */}
                    {result.trades.length > 0 && (
                        <GlassCard className="p-4">
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <Calculator className="w-4 h-4 text-primary" />
                                交易明細 ({result.trades.length} 筆)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border/50 text-muted-foreground text-xs">
                                            <th className="py-2 px-3 text-left">進場日</th>
                                            <th className="py-2 px-3 text-right">進場價</th>
                                            <th className="py-2 px-3 text-left">出場日</th>
                                            <th className="py-2 px-3 text-right">出場價</th>
                                            <th className="py-2 px-3 text-right">報酬率</th>
                                            <th className="py-2 px-3 text-left hidden md:table-cell">出場原因</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.trades.map((trade, idx) => (
                                            <tr key={idx} className="border-b border-border/30">
                                                <td className="py-2 px-3 font-mono text-xs">{trade.entryDate}</td>
                                                <td className="py-2 px-3 text-right font-mono">${trade.entryPrice}</td>
                                                <td className="py-2 px-3 font-mono text-xs">{trade.exitDate}</td>
                                                <td className="py-2 px-3 text-right font-mono">${trade.exitPrice}</td>
                                                <td className={`py-2 px-3 text-right font-mono font-medium ${trade.returnPct >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                    {trade.returnPct > 0 ? '+' : ''}{trade.returnPct}%
                                                </td>
                                                <td className="py-2 px-3 text-xs text-muted-foreground hidden md:table-cell">{trade.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </GlassCard>
                    )}

                    {result.trades.length === 0 && (
                        <GlassCard className="p-8 text-center text-muted-foreground">
                            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>此策略在此期間未產生任何交易信號</p>
                        </GlassCard>
                    )}

                    <Disclaimer
                        source={result.source}
                        methodology={result.methodology}
                        warning={result.disclaimer}
                    />
                </>
            )}

            {!result && !loading && (
                <GlassCard className="p-12 text-center text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">選擇策略與期間後，點擊「執行回測」開始分析</p>
                    <p className="text-xs mt-1">回測將模擬歷史交易，計算策略績效</p>
                </GlassCard>
            )}
        </div>
    );
}

function MetricCard({ label, value, unit, color }: { label: string; value: number; unit?: string; color?: string }) {
    return (
        <GlassCard className="p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={`text-xl font-bold font-mono ${color || ''}`}>
                {typeof value === 'number' ? (value > 0 && unit === '%' ? '+' : '') + value.toFixed(unit === '%' ? 1 : 2) : value}
                {unit && <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>}
            </div>
        </GlassCard>
    );
}
