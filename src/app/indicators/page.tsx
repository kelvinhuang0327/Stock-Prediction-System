'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { TrendingUp, Activity, BarChart3, DollarSign, Target } from 'lucide-react';
import { calculateAllIndicators, calculateIchimoku, calculateParabolicSAR, calculateADX, calculateStochRSI, calculateVWAP, calculateMFI, calculateCMF, calculatePivotPoints } from '@/lib/technicalIndicators';
import { StockDataWithIndicators } from '@/types/stock';

type SignalType = 'Bullish' | 'Bearish' | 'Neutral' | 'Overbought' | 'Oversold';
type Category = 'all' | 'trend' | 'oscillator' | 'volatility' | 'volume' | 'institutional';

interface IndicatorData {
    name: string;
    nameEn: string;
    value: string;
    signal: SignalType;
    category: Category;
    description: string;
    interpretation: string;
}

export default function IndicatorsPage() {
    const [symbol, setSymbol] = useState('2330');
    const [data, setData] = useState<StockDataWithIndicators[]>([]);
    const [institutionalData, setInstitutionalData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<Category>('all');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch technical indicators data (3 months sufficient for MA60)
                const res = await fetch(`/api/stocks/${symbol}/history?months=3`);
                if (!res.ok) {
                    console.error('Fetch failed:', res.status, res.statusText);
                    throw new Error(`Failed to fetch data: ${res.status}`);
                }

                const json = await res.json();
                const historyData = (Array.isArray(json) ? json : []).map((item: any) => ({
                    date: item.date,
                    open: item.open,
                    high: item.high,
                    low: item.low,
                    close: item.close,
                    volume: item.volume,
                }));

                if (historyData.length > 0) {
                    let result = calculateAllIndicators(historyData);
                    result = calculateIchimoku(result);
                    result = calculateParabolicSAR(result);
                    result = calculateADX(result);
                    result = calculateStochRSI(result);
                    result = calculateVWAP(result);
                    result = calculateMFI(result);
                    result = calculateCMF(result);
                    result = calculatePivotPoints(result);
                    setData(result);
                }

                // Fetch institutional data
                try {
                    const instRes = await fetch(`/api/stocks/${symbol}/institutional`);
                    if (instRes.ok) {
                        const instJson = await instRes.json();
                        if (instJson.success) {
                            setInstitutionalData(instJson.data);
                        }
                    }
                } catch (err) {
                    console.log('Institutional data not available');
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [symbol]);

    const indicators = useMemo(() => {
        if (data.length === 0) return [];

        const latest = data[data.length - 1];
        const prev = data.length > 1 ? data[data.length - 2] : latest;

        const getSignal = (value: number | undefined, overbought: number, oversold: number): SignalType => {
            if (value === undefined) return 'Neutral';
            if (value >= overbought) return 'Overbought';
            if (value <= oversold) return 'Oversold';
            return 'Neutral';
        };

        const getMacdSignal = (): SignalType => {
            if (!latest.dif || !latest.dem) return 'Neutral';
            if (latest.dif > latest.dem && latest.dif > 0) return 'Bullish';
            if (latest.dif < latest.dem && latest.dif < 0) return 'Bearish';
            return 'Neutral';
        };

        const getAdxSignal = (): SignalType => {
            if (!latest.adx || !latest.plusDI || !latest.minusDI) return 'Neutral';
            if (latest.adx > 25 && latest.plusDI > latest.minusDI) return 'Bullish';
            if (latest.adx > 25 && latest.minusDI > latest.plusDI) return 'Bearish';
            return 'Neutral';
        };

        const indicators: IndicatorData[] = [
            // Trend Indicators
            {
                name: 'MACD',
                nameEn: 'Moving Average Convergence Divergence',
                value: `DIF: ${latest.dif?.toFixed(2) || '--'}, DEM: ${latest.dem?.toFixed(2) || '--'}`,
                signal: getMacdSignal(),
                category: 'trend',
                description: '平滑異同移動平均線',
                interpretation: 'DIF > DEM 且 > 0 為多頭，DIF < DEM 且 < 0 為空頭'
            },
            {
                name: 'ADX',
                nameEn: 'Average Directional Index',
                value: latest.adx?.toFixed(2) || '--',
                signal: getAdxSignal(),
                category: 'trend',
                description: '平均趨向指數',
                interpretation: 'ADX > 25 表示趨勢強勁，+DI > -DI 為多頭'
            },
            {
                name: 'Parabolic SAR',
                nameEn: 'Stop and Reverse',
                value: latest.sar?.toFixed(2) || '--',
                signal: latest.sar && latest.close > latest.sar ? 'Bullish' : 'Bearish',
                category: 'trend',
                description: '拋物線轉向指標',
                interpretation: '價格 > SAR 為多頭，價格 < SAR 為空頭'
            },
            {
                name: '一目均衡表',
                nameEn: 'Ichimoku Cloud',
                value: `轉換: ${latest.tenkanSen?.toFixed(2) || '--'}, 基準: ${latest.kijunSen?.toFixed(2) || '--'}`,
                signal: latest.tenkanSen && latest.kijunSen && latest.tenkanSen > latest.kijunSen ? 'Bullish' : 'Bearish',
                category: 'trend',
                description: '一目均衡表',
                interpretation: '轉換線 > 基準線為多頭訊號'
            },
            {
                name: 'MA5',
                nameEn: '5-Day Moving Average',
                value: latest.ma5?.toFixed(2) || '--',
                signal: latest.ma5 && latest.close > latest.ma5 ? 'Bullish' : 'Bearish',
                category: 'trend',
                description: '5日移動平均線',
                interpretation: '價格 > MA5 為短期多頭'
            },
            {
                name: 'MA20',
                nameEn: '20-Day Moving Average',
                value: latest.ma20?.toFixed(2) || '--',
                signal: latest.ma20 && latest.close > latest.ma20 ? 'Bullish' : 'Bearish',
                category: 'trend',
                description: '20日移動平均線',
                interpretation: '價格 > MA20 為中期多頭'
            },
            {
                name: 'MA60',
                nameEn: '60-Day Moving Average',
                value: latest.ma60?.toFixed(2) || '--',
                signal: latest.ma60 && latest.close > latest.ma60 ? 'Bullish' : 'Bearish',
                category: 'trend',
                description: '60日移動平均線',
                interpretation: '價格 > MA60 為長期多頭'
            },

            // Oscillators
            {
                name: 'RSI',
                nameEn: 'Relative Strength Index',
                value: latest.rsi?.toFixed(2) || '--',
                signal: getSignal(latest.rsi, 70, 30),
                category: 'oscillator',
                description: '相對強弱指標',
                interpretation: 'RSI > 70 超買，RSI < 30 超賣'
            },
            {
                name: 'Stochastic RSI',
                nameEn: 'Stochastic RSI',
                value: `K: ${latest.stochRsiK?.toFixed(2) || '--'}`,
                signal: getSignal(latest.stochRsiK, 80, 20),
                category: 'oscillator',
                description: '隨機相對強弱指標',
                interpretation: 'K > 80 超買，K < 20 超賣'
            },
            {
                name: 'KD 指標',
                nameEn: 'Stochastic Oscillator',
                value: `K: ${latest.k?.toFixed(2) || '--'}, D: ${latest.d?.toFixed(2) || '--'}`,
                signal: getSignal(latest.k, 80, 20),
                category: 'oscillator',
                description: '隨機指標',
                interpretation: 'K > 80 超買，K < 20 超賣，K > D 黃金交叉'
            },
            {
                name: 'Williams %R',
                nameEn: 'Williams Percent Range',
                value: latest.williamsR?.toFixed(2) || '--',
                signal: getSignal(latest.williamsR, -20, -80),
                category: 'oscillator',
                description: '威廉指標',
                interpretation: '%R > -20 超買，%R < -80 超賣'
            },
            {
                name: 'CCI',
                nameEn: 'Commodity Channel Index',
                value: latest.cci?.toFixed(2) || '--',
                signal: getSignal(latest.cci, 100, -100),
                category: 'oscillator',
                description: '順勢指標',
                interpretation: 'CCI > 100 超買，CCI < -100 超賣'
            },

            // Volatility
            {
                name: '布林通道',
                nameEn: 'Bollinger Bands',
                value: `上: ${latest.bbUpper?.toFixed(2) || '--'}, 下: ${latest.bbLower?.toFixed(2) || '--'}`,
                signal: latest.bbUpper && latest.bbLower && latest.close > latest.bbUpper ? 'Overbought' :
                    latest.bbLower && latest.close < latest.bbLower ? 'Oversold' : 'Neutral',
                category: 'volatility',
                description: '布林通道',
                interpretation: '價格觸及上軌超買，觸及下軌超賣'
            },
            {
                name: 'ATR',
                nameEn: 'Average True Range',
                value: latest.atr?.toFixed(2) || '--',
                signal: 'Neutral',
                category: 'volatility',
                description: '真實波動幅度均值',
                interpretation: 'ATR 越高表示波動性越大'
            },

            // Volume
            {
                name: 'OBV',
                nameEn: 'On-Balance Volume',
                value: (latest.obv ? (latest.obv / 1000000).toFixed(2) + 'M' : '--'),
                signal: prev.obv && latest.obv && latest.obv > prev.obv ? 'Bullish' : 'Bearish',
                category: 'volume',
                description: '能量潮指標',
                interpretation: 'OBV 上升表示買盤力道增強'
            },
            {
                name: 'VWAP',
                nameEn: 'Volume Weighted Average Price',
                value: latest.vwap?.toFixed(2) || '--',
                signal: latest.vwap && latest.close > latest.vwap ? 'Bullish' : 'Bearish',
                category: 'volume',
                description: '成交量加權平均價',
                interpretation: '價格 > VWAP 表示買盤較強'
            },
            {
                name: 'MFI',
                nameEn: 'Money Flow Index',
                value: latest.mfi?.toFixed(2) || '--',
                signal: getSignal(latest.mfi, 80, 20),
                category: 'volume',
                description: '資金流量指標',
                interpretation: 'MFI > 80 超買，MFI < 20 超賣'
            },
            {
                name: 'CMF',
                nameEn: 'Chaikin Money Flow',
                value: latest.cmf?.toFixed(4) || '--',
                signal: latest.cmf && latest.cmf > 0 ? 'Bullish' : 'Bearish',
                category: 'volume',
                description: '蔡金資金流',
                interpretation: 'CMF > 0 買盤力道強，CMF < 0 賣盤力道強'
            },
        ];

        // Add institutional indicators if data available
        if (institutionalData) {
            const formatShares = (shares: number) => {
                if (Math.abs(shares) >= 1000) {
                    return (shares / 1000).toFixed(1) + 'K';
                }
                return shares.toString();
            };

            const getInstitutionalSignal = (value: number): SignalType => {
                if (value > 1000) return 'Bullish';
                if (value < -1000) return 'Bearish';
                return 'Neutral';
            };

            indicators.push(
                {
                    name: '外資買賣超',
                    nameEn: 'Foreign Investors Net Buy/Sell',
                    value: `${institutionalData.foreignInvestors >= 0 ? '+' : ''}${formatShares(institutionalData.foreignInvestors)} 股`,
                    signal: getInstitutionalSignal(institutionalData.foreignInvestors),
                    category: 'institutional',
                    description: '外資及陸資買賣超股數',
                    interpretation: '正值表示買超，負值表示賣超，絕對值越大影響力越強'
                },
                {
                    name: '投信買賣超',
                    nameEn: 'Investment Trust Net Buy/Sell',
                    value: `${institutionalData.investmentTrusts >= 0 ? '+' : ''}${formatShares(institutionalData.investmentTrusts)} 股`,
                    signal: getInstitutionalSignal(institutionalData.investmentTrusts),
                    category: 'institutional',
                    description: '投信買賣超股數',
                    interpretation: '投信買超通常代表中長期看好'
                },
                {
                    name: '自營商買賣超',
                    nameEn: 'Dealers Net Buy/Sell',
                    value: `${institutionalData.dealers >= 0 ? '+' : ''}${formatShares(institutionalData.dealers)} 股`,
                    signal: getInstitutionalSignal(institutionalData.dealers),
                    category: 'institutional',
                    description: '自營商買賣超股數',
                    interpretation: '自營商操作較為短線'
                },
                {
                    name: '三大法人合計',
                    nameEn: 'Total Institutional Net Buy/Sell',
                    value: `${institutionalData.total >= 0 ? '+' : ''}${formatShares(institutionalData.total)} 股`,
                    signal: getInstitutionalSignal(institutionalData.total),
                    category: 'institutional',
                    description: '三大法人買賣超總計',
                    interpretation: '三大法人同步買超為強烈多頭訊號'
                }
            );
        }

        return indicators;
    }, [data, institutionalData]);

    const filteredIndicators = useMemo(() => {
        if (selectedCategory === 'all') return indicators;
        return indicators.filter(ind => ind.category === selectedCategory);
    }, [indicators, selectedCategory]);

    const categories = [
        { id: 'all' as Category, name: '全部', icon: Activity },
        { id: 'trend' as Category, name: '趨勢', icon: TrendingUp },
        { id: 'oscillator' as Category, name: '震盪', icon: BarChart3 },
        { id: 'volatility' as Category, name: '波動', icon: Target },
        { id: 'volume' as Category, name: '成交量', icon: DollarSign },
        { id: 'institutional' as Category, name: '法人籌碼', icon: TrendingUp },
    ];

    const getSignalColor = (signal: SignalType) => {
        switch (signal) {
            case 'Bullish':
                return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
            case 'Bearish':
                return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
            case 'Overbought':
                return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800';
            case 'Oversold':
                return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
            default:
                return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700';
        }
    };

    const getSignalText = (signal: SignalType) => {
        const map: Record<SignalType, string> = {
            'Bullish': '多頭',
            'Bearish': '空頭',
            'Overbought': '超買',
            'Oversold': '超賣',
            'Neutral': '中性'
        };
        return map[signal];
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div>
                    <h1 className="text-3xl font-bold">技術指標儀表板</h1>
                    <p className="text-muted-foreground mt-1">
                        全面的技術分析指標 - 20+ 專業指標即時監控
                    </p>
                </div>

                {/* Stock Selector */}
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        className="border rounded-lg px-4 py-2 bg-background w-32"
                        placeholder="股票代號"
                    />
                    <button
                        onClick={() => setSymbol(symbol)}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                    >
                        分析
                    </button>
                    {loading && <span className="text-sm text-muted-foreground">載入中...</span>}
                </div>

                {/* Category Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {categories.map((cat) => {
                        const Icon = cat.icon;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all whitespace-nowrap ${selectedCategory === cat.id
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted border-border'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Indicators Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="bg-card rounded-xl border p-6 animate-pulse">
                            <div className="h-6 bg-muted rounded w-1/2 mb-4"></div>
                            <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-muted rounded w-full"></div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredIndicators.map((indicator, idx) => (
                        <div
                            key={idx}
                            className="bg-card rounded-xl border p-6 hover:shadow-lg transition-all"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-bold text-lg">{indicator.name}</h3>
                                    <p className="text-xs text-muted-foreground">{indicator.nameEn}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getSignalColor(indicator.signal)}`}>
                                    {getSignalText(indicator.signal)}
                                </span>
                            </div>

                            <div className="mb-3">
                                <div className="text-2xl font-bold font-mono text-foreground">
                                    {indicator.value}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">{indicator.description}</p>
                                <p className="text-xs text-muted-foreground/80 italic">
                                    {indicator.interpretation}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Summary */}
            {!loading && data.length > 0 && (
                <div className="bg-card rounded-xl border p-6">
                    <h3 className="font-bold text-lg mb-4">綜合分析</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {(['Bullish', 'Bearish', 'Overbought', 'Oversold', 'Neutral'] as SignalType[]).map(signal => {
                            const count = indicators.filter(ind => ind.signal === signal).length;
                            return (
                                <div key={signal} className={`p-4 rounded-lg border ${getSignalColor(signal)}`}>
                                    <div className="text-2xl font-bold">{count}</div>
                                    <div className="text-sm font-medium">{getSignalText(signal)}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
