'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, HelpCircle, BarChart3, AlertTriangle, Info } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

// ─── Types ──────────────────────────────────────────────────────

export type MarketRegime = 'Bull' | 'Bear' | 'Sideways' | 'Unknown';

interface RegimeFactor {
    name: string;
    value: number | string | boolean;
    impact: 'bullish' | 'bearish' | 'neutral';
    note: string;
}

export interface MarketRegimeData {
    regime: MarketRegime;
    confidence: number;
    factors: RegimeFactor[];
    dataCoverage: 'full' | 'limited' | 'insufficient';
    samplePeriod: string;
    dataPoints: number;
    last_updated: string | null;
    limitations: string[];
}

// ─── Config ─────────────────────────────────────────────────────

const REGIME_CONFIG: Record<MarketRegime, {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ReactNode;
    signalHint: string;
}> = {
    Bull: {
        label: '偏多',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        icon: <TrendingUp className="w-4 h-4" />,
        signalHint: '趨勢訊號參考價值較高，順勢操作可適度積極',
    },
    Bear: {
        label: '偏空',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        icon: <TrendingDown className="w-4 h-4" />,
        signalHint: '買進訊號需保守解讀，宜控制倉位並注意停損',
    },
    Sideways: {
        label: '盤整',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        icon: <Minus className="w-4 h-4" />,
        signalHint: '突破訊號需搭配量能確認，短線區間操作為主',
    },
    Unknown: {
        label: '資料不足',
        color: 'text-muted-foreground',
        bgColor: 'bg-muted/20',
        borderColor: 'border-border/30',
        icon: <HelpCircle className="w-4 h-4" />,
        signalHint: '市場資料不足，個股分析應保守解讀',
    },
};

// ─── MarketRegimeBadge (inline, compact) ────────────────────────

export function MarketRegimeBadge({
    regime,
    confidence,
    size = 'sm',
}: {
    regime: MarketRegime;
    confidence?: number;
    size?: 'xs' | 'sm';
}) {
    const config = REGIME_CONFIG[regime];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${config.bgColor} ${config.color} ${config.borderColor} ${size === 'xs' ? 'text-[10px] px-1.5 py-0' : ''}`}>
            {config.icon}
            市場{config.label}
            {confidence != null && confidence > 0 && (
                <span className="opacity-70 font-mono">{confidence}%</span>
            )}
        </span>
    );
}

// ─── MarketRegimeSummaryCard (full detail) ──────────────────────

export function MarketRegimeSummaryCard({
    data,
    showFactors = false,
    contextLabel,
}: {
    data: MarketRegimeData | null;
    showFactors?: boolean;
    contextLabel?: string;
}) {
    if (!data) {
        return (
            <GlassCard className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BarChart3 className="w-4 h-4" />
                    市場環境分析載入中...
                </div>
            </GlassCard>
        );
    }

    const config = REGIME_CONFIG[data.regime];

    return (
        <GlassCard className={`p-4 space-y-3 ${config.borderColor}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">
                        {contextLabel || '市場環境'}
                    </span>
                </div>
                <MarketRegimeBadge regime={data.regime} confidence={data.confidence} />
            </div>

            {/* Signal hint */}
            <div className={`text-xs px-3 py-2 rounded-md ${config.bgColor} ${config.color}`}>
                <div className="flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{config.signalHint}</span>
                </div>
            </div>

            {/* Factors */}
            {showFactors && data.factors.length > 0 && (
                <div className="space-y-1.5">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">判斷因子</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {data.factors.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-muted/20">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    f.impact === 'bullish' ? 'bg-red-400' :
                                    f.impact === 'bearish' ? 'bg-green-400' : 'bg-yellow-400'
                                }`} />
                                <span className="text-muted-foreground truncate">{f.note}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Limitations */}
            {data.limitations.length > 0 && (
                <div className="flex items-start gap-2 text-[11px] text-amber-400/80">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{data.limitations.join('；')}</span>
                </div>
            )}

            {/* Footer meta */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                <span>TAIEX {data.dataPoints} 天</span>
                <span>{data.samplePeriod}</span>
                {data.last_updated && <span>更新：{data.last_updated}</span>}
                <span className="ml-auto italic">模型推估，非保證</span>
            </div>
        </GlassCard>
    );
}

// ─── Compact regime bar (for signals page header) ───────────────

export function MarketRegimeBar({
    data,
}: {
    data: MarketRegimeData | null;
}) {
    if (!data) return null;
    const config = REGIME_CONFIG[data.regime];

    return (
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm ${config.bgColor} ${config.borderColor}`}>
            <div className={`flex items-center gap-1.5 font-medium ${config.color}`}>
                {config.icon}
                當前大盤環境：{config.label}
                {data.confidence > 0 && (
                    <span className="text-xs opacity-70 font-mono">({data.confidence}%)</span>
                )}
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">
                {config.signalHint}
            </span>
            {data.limitations.length > 0 && (
                <span className="ml-auto text-[10px] text-amber-400/70 hidden md:inline">
                    {data.limitations[0]}
                </span>
            )}
        </div>
    );
}
