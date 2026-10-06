"use client";

import React, { useMemo } from 'react';
import { calculateAllIndicators } from '@/lib/technicalIndicators';
import { StockDataPoint, SignalType } from '@/types/stock';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';



const getSignal = (indicator: string, value: number): SignalType => {
    switch (indicator) {
        case 'RSI':
            if (value > 70) return 'Overbought';
            if (value < 30) return 'Oversold';
            return 'Neutral';
        case 'KD':
            if (value > 80) return 'Overbought';
            if (value < 20) return 'Oversold';
            return 'Neutral';
        case 'MACD':
            return value > 0 ? 'Bullish' : 'Bearish';
        case 'Williams %R':
            if (value > -20) return 'Overbought';
            if (value < -80) return 'Oversold';
            return 'Neutral';
        case 'CCI':
            if (value > 100) return 'Overbought';
            if (value < -100) return 'Oversold';
            return 'Neutral';
        default:
            return 'Neutral';
    }
};

const getTrendIcon = (signal: SignalType) => {
    if (signal === 'Bullish' || signal === 'Buy') {
        return <TrendingUp className="w-3 h-3" />;
    }
    if (signal === 'Bearish' || signal === 'Sell') {
        return <TrendingDown className="w-3 h-3" />;
    }
    return <Minus className="w-3 h-3" />;
};

export function TechnicalIndicators({ symbol, data }: { symbol: string, data?: StockDataPoint[] }) {
    const indicators = useMemo(() => {
        if (!data || data.length === 0) return [];

        const withIndicators = calculateAllIndicators(data);
        const latest = withIndicators[withIndicators.length - 1];

        return [
            {
                name: 'RSI (14)',
                value: latest.rsi?.toFixed(2) || 'N/A',
                signal: (latest.rsi ? getSignal('RSI', latest.rsi) : 'Neutral') as SignalType,
                numValue: latest.rsi
            },
            {
                name: 'MACD',
                value: latest.dif?.toFixed(2) || 'N/A',
                signal: (latest.dif ? getSignal('MACD', latest.dif) : 'Neutral') as SignalType,
                numValue: latest.dif
            },
            {
                name: 'MA (20)',
                value: latest.ma20?.toFixed(2) || 'N/A',
                signal: ((latest.ma20 && latest.close > latest.ma20) ? 'Bullish' : 'Bearish') as SignalType,
                numValue: latest.ma20
            },
            {
                name: 'MA (60)',
                value: latest.ma60?.toFixed(2) || 'N/A',
                signal: ((latest.ma60 && latest.close > latest.ma60) ? 'Bullish' : 'Bearish') as SignalType,
                numValue: latest.ma60
            },
            {
                name: 'KD',
                value: `K:${latest.k?.toFixed(1) || 'N/A'} D:${latest.d?.toFixed(1) || 'N/A'}`,
                signal: (latest.k ? getSignal('KD', latest.k) : 'Neutral') as SignalType,
                numValue: latest.k
            },
            {
                name: 'ATR (14)',
                value: latest.atr?.toFixed(2) || 'N/A',
                signal: 'Neutral' as SignalType,
                numValue: latest.atr
            },
            {
                name: 'Williams %R',
                value: latest.williamsR?.toFixed(2) || 'N/A',
                signal: (latest.williamsR ? getSignal('Williams %R', latest.williamsR) : 'Neutral') as SignalType,
                numValue: latest.williamsR
            },
            {
                name: 'CCI (20)',
                value: latest.cci?.toFixed(2) || 'N/A',
                signal: (latest.cci ? getSignal('CCI', latest.cci) : 'Neutral') as SignalType,
                numValue: latest.cci
            }
        ];
    }, [symbol, data]);

    const bullishCount = indicators.filter(i => i.signal === 'Bullish' || i.signal === 'Buy').length;
    const bearishCount = indicators.filter(i => i.signal === 'Bearish' || i.signal === 'Sell').length;
    const overallSentiment: SignalType = bullishCount > bearishCount ? 'Bullish' : bearishCount > bullishCount ? 'Bearish' : 'Neutral';

    return (
        <div className="space-y-4">
            {indicators.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <div className="text-sm">暫無足夠歷史數據進行技術分析</div>
                </div>
            ) : indicators.map((ind, i) => (
                <div
                    key={ind.name}
                    className="flex items-center justify-between p-3 rounded-lg glass-subtle hover:bg-white/5 transition-all"
                    style={{ animationDelay: `${i * 50}ms` }}
                >
                    <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                            {ind.name}
                            {getTrendIcon(ind.signal)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">{ind.value}</div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${ind.signal === 'Buy' || ind.signal === 'Bullish'
                            ? 'bg-success/10 text-success border-success/20' :
                            ind.signal === 'Sell' || ind.signal === 'Bearish'
                                ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                ind.signal === 'Overbought'
                                    ? 'bg-warning/10 text-warning border-warning/20' :
                                    ind.signal === 'Oversold'
                                        ? 'bg-primary/10 text-primary border-primary/20' :
                                        'bg-muted/50 text-muted-foreground border-border'
                        }`}>
                        {ind.signal}
                    </div>
                </div>
            ))}

            <div className="mt-6 pt-6 border-t border-border/50">
                <div className="glass-subtle p-4 rounded-xl">
                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                        <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
                        AI 綜合分析
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ml-auto border ${overallSentiment === 'Bullish'
                                ? 'bg-success/10 text-success border-success/20' :
                                overallSentiment === 'Bearish'
                                    ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                    'bg-muted/50 text-muted-foreground border-border'
                            }`}>
                            {overallSentiment}
                        </span>
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {overallSentiment === 'Bullish' &&
                            '技術指標顯示多頭趨勢，移動平均線支撐明顯。建議關注超買訊號，適時調整部位。'}
                        {overallSentiment === 'Bearish' &&
                            '技術指標顯示空頭趨勢，建議謹慎操作。若出現超賣訊號，可留意反彈機會。'}
                        {overallSentiment === 'Neutral' &&
                            '技術指標呈現中性，多空力道均衡。建議觀望，等待明確訊號再進場。'}
                    </p>
                </div>
            </div>
        </div>
    );
}
