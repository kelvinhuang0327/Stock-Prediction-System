import React, { useMemo } from 'react';
import { calculateAllIndicators } from '@/lib/technicalIndicators';
import { StockDataPoint, SignalType } from '@/types/stock';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Mock data generator (will be replaced with real API data)
const generateMockData = (): StockDataPoint[] => {
    const data: StockDataPoint[] = [];
    let close = 100;

    for (let i = 0; i < 100; i++) {
        const change = (Math.random() - 0.5) * 5;
        close = close + change;
        const open = close - (Math.random() - 0.5) * 2;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;

        data.push({
            date: `2023-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100,
            volume: Math.round(1000 + Math.random() * 2000)
        });
    }

    return data;
};

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

export function TechnicalIndicators({ symbol }: { symbol: string }) {
    const indicators = useMemo(() => {
        const mockData = generateMockData();
        const withIndicators = calculateAllIndicators(mockData);
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
    }, [symbol]);

    const bullishCount = indicators.filter(i => i.signal === 'Bullish' || i.signal === 'Buy').length;
    const bearishCount = indicators.filter(i => i.signal === 'Bearish' || i.signal === 'Sell').length;
    const overallSentiment: SignalType = bullishCount > bearishCount ? 'Bullish' : bearishCount > bullishCount ? 'Bearish' : 'Neutral';

    return (
        <div className="space-y-4">
            {indicators.map((ind) => (
                <div key={ind.name} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                    <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                            {ind.name}
                            {getTrendIcon(ind.signal)}
                        </div>
                        <div className="text-sm text-muted-foreground">{ind.value}</div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${ind.signal === 'Buy' || ind.signal === 'Bullish' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                        ind.signal === 'Sell' || ind.signal === 'Bearish' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                            ind.signal === 'Overbought' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                                ind.signal === 'Oversold' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                        {ind.signal}
                    </div>
                </div>
            ))}

            <div className="mt-6 pt-4 border-t">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                    AI 綜合分析
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${overallSentiment === 'Bullish' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                        overallSentiment === 'Bearish' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                            'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                        {overallSentiment}
                    </span>
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {overallSentiment === 'Bullish' &&
                        '技術指標顯示多頭趨勢，移動平均線支撐明顯。建議關注超買訊號，適時調整部位。'}
                    {overallSentiment === 'Bearish' &&
                        '技術指標顯示空頭趨勢，建議謹慎操作。若出現超賣訊號，可留意反彈機會。'}
                    {overallSentiment === 'Neutral' &&
                        '技術指標呈現中性，多空力道均衡。建議觀望，等待明確訊號再進場。'}
                </p>
            </div>
        </div>
    );
}
