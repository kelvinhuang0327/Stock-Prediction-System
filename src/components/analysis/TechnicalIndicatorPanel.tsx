'use client';

import React, { useState, useMemo } from 'react';
import { SignalType, IndicatorSummary, StockDataWithIndicators } from '@/types/stock';
import {
    calculateAllIndicators,
    calculateIchimoku,
    calculateParabolicSAR,
    calculateADX,
    calculateStochRSI,
    calculateVWAP,
    calculateMFI,
    calculateCMF,
    calculatePivotPoints
} from '@/lib/technicalIndicators';

interface TechnicalIndicatorPanelProps {
    data: StockDataWithIndicators[];
    symbol?: string;
}

// Signal badge component
const SignalBadge: React.FC<{ signal: SignalType }> = ({ signal }) => {
    const colorClasses: Record<SignalType, string> = {
        'Buy': 'bg-green-500/20 text-green-400 border-green-500/30',
        'Sell': 'bg-red-500/20 text-red-400 border-red-500/30',
        'Neutral': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        'Bullish': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        'Bearish': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        'Overbought': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        'Oversold': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };

    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colorClasses[signal]}`}>
            {signal}
        </span>
    );
};

// Indicator card component
const IndicatorCard: React.FC<{ indicator: IndicatorSummary }> = ({ indicator }) => {
    return (
        <div className="bg-card border border-border rounded-lg p-4 hover:bg-accent/5 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">{indicator.name}</h4>
                <SignalBadge signal={indicator.signal} />
            </div>
            <div className="text-2xl font-bold text-foreground">{indicator.value}</div>
            {indicator.description && (
                <p className="text-xs text-muted-foreground mt-1">{indicator.description}</p>
            )}
        </div>
    );
};

// Category section component
const CategorySection: React.FC<{
    title: string;
    indicators: IndicatorSummary[];
    icon: React.ReactNode;
}> = ({ title, indicators, icon }) => {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
                {icon}
                <h3 className="font-semibold text-sm uppercase tracking-wide">{title}</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {indicators.map((indicator, index) => (
                    <IndicatorCard key={`${title}-${index}`} indicator={indicator} />
                ))}
            </div>
        </div>
    );
};

export const TechnicalIndicatorPanel: React.FC<TechnicalIndicatorPanelProps> = ({
    data,
    symbol = ''
}) => {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Calculate all indicators
    const processedData = useMemo(() => {
        if (!data || data.length === 0) return null;

        let result = calculateAllIndicators(data);
        result = calculateIchimoku(result);
        result = calculateParabolicSAR(result);
        result = calculateADX(result);
        result = calculateStochRSI(result);
        result = calculateVWAP(result);
        result = calculateMFI(result);
        result = calculateCMF(result);
        result = calculatePivotPoints(result);

        return result[result.length - 1]; // Get latest data point
    }, [data]);

    if (!processedData) {
        return (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
                <p className="text-muted-foreground">無法載入技術指標資料</p>
            </div>
        );
    }

    // Helper to get signal based on value and thresholds
    const getSignal = (value: number | undefined, overbought: number, oversold: number): SignalType => {
        if (value === undefined) return 'Neutral';
        if (value >= overbought) return 'Overbought';
        if (value <= oversold) return 'Oversold';
        return 'Neutral';
    };

    const getMacdSignal = (dif: number | undefined, dem: number | undefined): SignalType => {
        if (dif === undefined || dem === undefined) return 'Neutral';
        if (dif > dem && dif > 0) return 'Bullish';
        if (dif < dem && dif < 0) return 'Bearish';
        return 'Neutral';
    };

    const getAdxSignal = (adx: number | undefined): SignalType => {
        if (adx === undefined) return 'Neutral';
        if (adx > 25) return 'Bullish'; // Strong trend
        return 'Neutral'; // Weak or no trend
    };

    const getTrendSignal = (price: number, indicator: number | undefined): SignalType => {
        if (indicator === undefined) return 'Neutral';
        return price > indicator ? 'Bullish' : 'Bearish';
    };

    // Build indicator summaries
    const trendIndicators: IndicatorSummary[] = [
        {
            name: 'MA5',
            value: processedData.ma5?.toFixed(2) || '--',
            signal: getTrendSignal(processedData.close, processedData.ma5),
            description: '5日移動平均線'
        },
        {
            name: 'MA20',
            value: processedData.ma20?.toFixed(2) || '--',
            signal: getTrendSignal(processedData.close, processedData.ma20),
            description: '20日移動平均線'
        },
        {
            name: 'MA60',
            value: processedData.ma60?.toFixed(2) || '--',
            signal: getTrendSignal(processedData.close, processedData.ma60),
            description: '60日移動平均線'
        },
        {
            name: 'Ichimoku (轉換線)',
            value: processedData.tenkanSen?.toFixed(2) || '--',
            signal: getTrendSignal(processedData.close, processedData.tenkanSen),
            description: '一目均衡表轉換線'
        },
        {
            name: 'Ichimoku (基準線)',
            value: processedData.kijunSen?.toFixed(2) || '--',
            signal: getTrendSignal(processedData.close, processedData.kijunSen),
            description: '一目均衡表基準線'
        },
        {
            name: 'Parabolic SAR',
            value: processedData.sar?.toFixed(2) || '--',
            signal: processedData.sar && processedData.close > processedData.sar ? 'Bullish' : 'Bearish',
            description: '拋物線轉向指標'
        },
        {
            name: 'ADX',
            value: processedData.adx?.toFixed(2) || '--',
            signal: getAdxSignal(processedData.adx),
            description: '平均趨向指數 (>25 強趨勢)'
        },
        {
            name: 'VWAP',
            value: processedData.vwap?.toFixed(2) || '--',
            signal: getTrendSignal(processedData.close, processedData.vwap),
            description: '成交量加權平均價'
        },
    ];

    const momentumIndicators: IndicatorSummary[] = [
        {
            name: 'RSI (14)',
            value: processedData.rsi?.toFixed(2) || '--',
            signal: getSignal(processedData.rsi, 70, 30),
            description: '相對強弱指標'
        },
        {
            name: 'Stoch RSI K',
            value: processedData.stochRsiK?.toFixed(2) || '--',
            signal: getSignal(processedData.stochRsiK, 80, 20),
            description: '隨機RSI K線'
        },
        {
            name: 'KD - K',
            value: processedData.k?.toFixed(2) || '--',
            signal: getSignal(processedData.k, 80, 20),
            description: 'K值'
        },
        {
            name: 'KD - D',
            value: processedData.d?.toFixed(2) || '--',
            signal: getSignal(processedData.d, 80, 20),
            description: 'D值'
        },
        {
            name: 'Williams %R',
            value: processedData.williamsR?.toFixed(2) || '--',
            signal: getSignal(processedData.williamsR ? -processedData.williamsR : undefined, 80, 20),
            description: '威廉指標'
        },
        {
            name: 'CCI',
            value: processedData.cci?.toFixed(2) || '--',
            signal: getSignal(processedData.cci, 100, -100),
            description: '商品通道指標'
        },
        {
            name: 'MACD DIF',
            value: processedData.dif?.toFixed(2) || '--',
            signal: getMacdSignal(processedData.dif, processedData.dem),
            description: 'MACD 差離值'
        },
        {
            name: 'MACD柱狀',
            value: processedData.osc?.toFixed(2) || '--',
            signal: (processedData.osc || 0) > 0 ? 'Bullish' : 'Bearish',
            description: 'MACD 柱狀圖'
        },
    ];

    const volumeIndicators: IndicatorSummary[] = [
        {
            name: 'OBV',
            value: processedData.obv ? (processedData.obv / 1000000).toFixed(2) + 'M' : '--',
            signal: 'Neutral',
            description: '能量潮指標'
        },
        {
            name: 'MFI',
            value: processedData.mfi?.toFixed(2) || '--',
            signal: getSignal(processedData.mfi, 80, 20),
            description: '資金流量指標'
        },
        {
            name: 'CMF',
            value: processedData.cmf?.toFixed(4) || '--',
            signal: (processedData.cmf || 0) > 0 ? 'Bullish' : 'Bearish',
            description: '蔡金資金流'
        },
    ];

    const volatilityIndicators: IndicatorSummary[] = [
        {
            name: 'ATR',
            value: processedData.atr?.toFixed(2) || '--',
            signal: 'Neutral',
            description: '平均真實範圍'
        },
        {
            name: '布林上軌',
            value: processedData.bbUpper?.toFixed(2) || '--',
            signal: processedData.close >= (processedData.bbUpper || Infinity) ? 'Overbought' : 'Neutral',
            description: '布林通道上軌'
        },
        {
            name: '布林中軌',
            value: processedData.bbMiddle?.toFixed(2) || '--',
            signal: 'Neutral',
            description: '布林通道中軌 (MA20)'
        },
        {
            name: '布林下軌',
            value: processedData.bbLower?.toFixed(2) || '--',
            signal: processedData.close <= (processedData.bbLower || -Infinity) ? 'Oversold' : 'Neutral',
            description: '布林通道下軌'
        },
    ];

    const supportResistanceIndicators: IndicatorSummary[] = [
        {
            name: 'Pivot Point',
            value: processedData.pivotPoint?.toFixed(2) || '--',
            signal: 'Neutral',
            description: '軸心點'
        },
        {
            name: 'R1',
            value: processedData.pivotR1?.toFixed(2) || '--',
            signal: 'Neutral',
            description: '第一阻力位'
        },
        {
            name: 'R2',
            value: processedData.pivotR2?.toFixed(2) || '--',
            signal: 'Neutral',
            description: '第二阻力位'
        },
        {
            name: 'S1',
            value: processedData.pivotS1?.toFixed(2) || '--',
            signal: 'Neutral',
            description: '第一支撐位'
        },
        {
            name: 'S2',
            value: processedData.pivotS2?.toFixed(2) || '--',
            signal: 'Neutral',
            description: '第二支撐位'
        },
    ];

    const categories = [
        { id: 'all', name: '全部' },
        { id: 'trend', name: '趨勢' },
        { id: 'momentum', name: '動量' },
        { id: 'volume', name: '成交量' },
        { id: 'volatility', name: '波動' },
        { id: 'support', name: '支撐/阻力' },
    ];

    // Calculate overall signal summary
    const allIndicators = [...trendIndicators, ...momentumIndicators, ...volumeIndicators];
    const bullishCount = allIndicators.filter(i => i.signal === 'Bullish' || i.signal === 'Buy').length;
    const bearishCount = allIndicators.filter(i => i.signal === 'Bearish' || i.signal === 'Sell' || i.signal === 'Overbought').length;
    const oversoldCount = allIndicators.filter(i => i.signal === 'Oversold').length;

    const overallSignal: SignalType = bullishCount > bearishCount + 2 ? 'Buy'
        : bearishCount > bullishCount + 2 ? 'Sell'
            : oversoldCount > 2 ? 'Buy'
                : 'Neutral';

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold">技術指標分析</h2>
                        <p className="text-sm text-muted-foreground">
                            {symbol && `${symbol} · `}共 {allIndicators.length} 項指標
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-sm text-muted-foreground">綜合訊號</div>
                            <SignalBadge signal={overallSignal} />
                        </div>
                        <div className="flex gap-2 text-xs">
                            <span className="text-green-400">📈 {bullishCount} 多</span>
                            <span className="text-red-400">📉 {bearishCount} 空</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category tabs */}
            <div className="flex overflow-x-auto border-b border-border bg-muted/30">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat.id
                                ? 'text-primary border-b-2 border-primary bg-primary/5'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Indicator grid */}
            <div className="p-4 space-y-6">
                {(selectedCategory === 'all' || selectedCategory === 'trend') && (
                    <CategorySection
                        title="趨勢指標"
                        indicators={trendIndicators}
                        icon={<span>📈</span>}
                    />
                )}
                {(selectedCategory === 'all' || selectedCategory === 'momentum') && (
                    <CategorySection
                        title="動量指標"
                        indicators={momentumIndicators}
                        icon={<span>⚡</span>}
                    />
                )}
                {(selectedCategory === 'all' || selectedCategory === 'volume') && (
                    <CategorySection
                        title="成交量指標"
                        indicators={volumeIndicators}
                        icon={<span>📊</span>}
                    />
                )}
                {(selectedCategory === 'all' || selectedCategory === 'volatility') && (
                    <CategorySection
                        title="波動指標"
                        indicators={volatilityIndicators}
                        icon={<span>🌊</span>}
                    />
                )}
                {(selectedCategory === 'all' || selectedCategory === 'support') && (
                    <CategorySection
                        title="支撐/阻力位"
                        indicators={supportResistanceIndicators}
                        icon={<span>🎯</span>}
                    />
                )}
            </div>

            {/* Footer note */}
            <div className="p-3 border-t border-border bg-muted/20">
                <p className="text-xs text-muted-foreground text-center">
                    💡 技術指標僅供參考，請搭配基本面與市場情緒綜合判斷
                </p>
            </div>
        </div>
    );
};

export default TechnicalIndicatorPanel;
