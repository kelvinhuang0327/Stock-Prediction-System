"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApiData } from '@/hooks/useApiData';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { Disclaimer } from '@/components/ui/disclaimer';
import { DataStatusBar } from '@/components/ui/data-availability-guard';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import {
    Activity, TrendingUp, TrendingDown, Minus,
    ChevronDown, ChevronUp, Target, Info, Calculator
} from 'lucide-react';

interface PriceLevel {
    price: number;
    methodology: string;
}

interface IndicatorDetail {
    name: string;
    value: number | string;
    signal: 'bullish' | 'bearish' | 'neutral';
    description: string;
}

interface SignalItem {
    symbol: string;
    name: string;
    industry: string;
    currentPrice: number;
    signal: 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
    strength: number;
    signalDate?: string;
    dataPeriod?: string;
    dataPoints?: number;
    watchPrice: PriceLevel;
    buyPrice: PriceLevel;
    stopLoss: PriceLevel;
    targetPrice: PriceLevel;
    indicators: IndicatorDetail[];
}

interface SignalResponse {
    data: SignalItem[];
    source: string;
    methodology: string;
    disclaimer: string;
    coverage?: { analyzed: number; sufficient: number; total: number; minDays: number; limitations: string[] };
    sample_size: number;
    last_updated: string | null;
    updatedAt: string;
}

const SIGNAL_CONFIG = {
    BUY: { label: '建議買進', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <TrendingUp className="w-3 h-3" /> },
    SELL: { label: '建議賣出', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <TrendingDown className="w-3 h-3" /> },
    HOLD: { label: '持有觀望', color: 'bg-muted/20 text-muted-foreground border-border/30', icon: <Minus className="w-3 h-3" /> },
    WATCH: { label: '觀察等待', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Activity className="w-3 h-3" /> },
};

const INDICATOR_SIGNAL_COLOR = {
    bullish: 'text-red-400',
    bearish: 'text-green-400',
    neutral: 'text-muted-foreground',
};

export default function SignalsPage() {
    const router = useRouter();
    const [signalFilter, setSignalFilter] = useState<string>('');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const url = `/api/signals?limit=50`;
    const { data: response, loading, error, refetch } = useApiData<SignalResponse>(url);

    const filteredData = useMemo(() => {
        if (!response?.data) return [];
        if (!signalFilter) return response.data;
        return response.data.filter(item => item.signal === signalFilter);
    }, [response, signalFilter]);

    const columns: ColumnDef<SignalItem>[] = useMemo(() => [
        {
            key: 'symbol', header: '代號', sortable: true,
            render: (item) => (
                <span className="font-mono font-medium text-primary">{item.symbol}</span>
            ),
        },
        {
            key: 'name', header: '名稱', sortable: true,
            render: (item) => <span className="font-medium">{item.name}</span>,
        },
        {
            key: 'currentPrice', header: '現價', sortable: true, align: 'right',
            accessor: (item) => item.currentPrice,
            render: (item) => `$${item.currentPrice.toLocaleString()}`,
        },
        {
            key: 'signal', header: '訊號', sortable: true, align: 'center',
            render: (item) => {
                const config = SIGNAL_CONFIG[item.signal];
                return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${config.color}`}>
                        {config.icon}
                        {config.label}
                    </span>
                );
            },
        },
        {
            key: 'strength', header: '強度', sortable: true, align: 'center',
            accessor: (item) => item.strength,
            render: (item) => (
                <div className="flex items-center justify-center gap-1">
                    <div className="w-12 h-2 rounded-full bg-muted/30 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${
                                item.strength >= 75 ? 'bg-red-500' :
                                item.strength >= 50 ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${item.strength}%` }}
                        />
                    </div>
                    <span className="text-xs font-mono w-8">{item.strength}%</span>
                </div>
            ),
        },
        {
            key: 'buyPrice', header: '建議買價', sortable: true, align: 'right', hideOnMobile: true,
            accessor: (item) => item.buyPrice.price,
            render: (item) => (
                <span className="text-red-400 font-mono">${item.buyPrice.price}</span>
            ),
        },
        {
            key: 'stopLoss', header: '停損價', sortable: true, align: 'right', hideOnMobile: true,
            accessor: (item) => item.stopLoss.price,
            render: (item) => (
                <span className="text-green-400 font-mono">${item.stopLoss.price}</span>
            ),
        },
        {
            key: 'targetPrice', header: '目標價', sortable: true, align: 'right', hideOnMobile: true,
            accessor: (item) => item.targetPrice.price,
            render: (item) => (
                <span className="text-primary font-mono">${item.targetPrice.price}</span>
            ),
        },
        {
            key: 'expand', header: '', align: 'center',
            render: (item) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpandedRow(expandedRow === item.symbol ? null : item.symbol);
                    }}
                    className="p-1 hover:bg-muted/20 rounded transition-colors"
                    title="展開計算依據"
                >
                    {expandedRow === item.symbol
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />}
                </button>
            ),
        },
    ], [expandedRow]);

    return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Target className="w-6 h-6 text-primary" />
                        技術指標交易建議
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        整合 MA/RSI/MACD/KD/BB/成交量 計算建議價位，每個價位均附計算依據
                    </p>
                </div>
                <button
                    onClick={refetch}
                    className="px-4 py-2 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                    重新計算
                </button>
            </div>

            {/* Warning */}
            <GlassCard className="p-4 border-yellow-500/30">
                <div className="flex items-start gap-3">
                    <Calculator className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium text-yellow-500">計算依據說明</p>
                        <p className="text-muted-foreground mt-1">
                            所有建議價位均由技術指標公式計算得出，<strong>非人為主觀判斷</strong>。
                            建議買價基於支撐位（布林下軌/MA），停損價為進場價 - 2×ATR，目標價為壓力位（布林上軌/MA）。
                            點擊展開按鈕可查看每支股票的完整計算依據。
                        </p>
                    </div>
                </div>
            </GlassCard>

            {/* Signal filters */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setSignalFilter('')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        !signalFilter ? 'bg-primary text-primary-foreground' : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                    }`}
                >
                    全部
                </button>
                {Object.entries(SIGNAL_CONFIG).map(([key, config]) => (
                    <button
                        key={key}
                        onClick={() => setSignalFilter(key)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-all inline-flex items-center gap-1 ${
                            signalFilter === key ? 'bg-primary text-primary-foreground' : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                        }`}
                    >
                        {config.icon}
                        {config.label}
                    </button>
                ))}
            </div>

            {/* Data Status */}
            {response && (
                <DataStatusBar
                    mode={response.source === 'empty' || response.source === 'error' ? 'unavailable' : response.coverage?.limitations?.length ? 'limited' : 'full'}
                    coverage={response.coverage ? { stocks: response.coverage.sufficient, total: response.coverage.total } : undefined}
                    lastUpdated={response.last_updated || new Date(response.updatedAt).toLocaleString('zh-TW')}
                    limitations={response.coverage?.limitations}
                />
            )}
            {response && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground px-4">
                    <span>共 {filteredData.length} 支股票有交易信號</span>
                    <span>樣本：{response.sample_size} 檔</span>
                    {response.coverage && response.coverage.sufficient > 0 && (
                        <span>（需 ≥{response.coverage.minDays} 天歷史資料才可分析）</span>
                    )}
                </div>
            )}

            {error && (
                <GlassCard className="p-4 text-destructive text-sm">載入失敗：{error}</GlassCard>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <LoadingSpinner size="lg" />
                    <p className="text-sm text-muted-foreground">計算技術指標中...</p>
                </div>
            )}

            {/* Table */}
            {!loading && response && (
                <>
                    <DataTable
                        data={filteredData}
                        columns={columns}
                        searchable
                        searchPlaceholder="搜尋股票代號或名稱..."
                        searchKeys={['symbol', 'name']}
                        defaultSort={{ key: 'strength', direction: 'desc' }}
                        pageSize={20}
                        onRowClick={(item) => router.push(`/stock/${item.symbol}`)}
                        getRowKey={(item) => item.symbol}
                        emptyMessage="無交易信號"
                        emptyDescription="目前無符合條件的交易信號"
                    />

                    {/* Expanded detail */}
                    {expandedRow && filteredData.find(d => d.symbol === expandedRow) && (
                        <GlassCard className="p-4 space-y-4">
                            {(() => {
                                const item = filteredData.find(d => d.symbol === expandedRow)!;
                                return (
                                    <>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-bold text-lg">{item.symbol} {item.name}</span>
                                            <span className="text-xs text-muted-foreground">— 計算依據</span>
                                        </div>

                                        {/* Data period info */}
                                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                                            {item.dataPeriod && <span>📅 資料區間：{item.dataPeriod}</span>}
                                            {item.dataPoints && <span>📊 資料點數：{item.dataPoints} 天</span>}
                                            {item.signalDate && <span>🔔 訊號日期：{item.signalDate}</span>}
                                        </div>

                                        {/* Price levels with methodology */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <PriceLevelCard label="觀察價" priceLevel={item.watchPrice} color="text-blue-400" />
                                            <PriceLevelCard label="建議買價" priceLevel={item.buyPrice} color="text-red-400" />
                                            <PriceLevelCard label="停損價" priceLevel={item.stopLoss} color="text-green-400" />
                                            <PriceLevelCard label="目標價" priceLevel={item.targetPrice} color="text-primary" />
                                        </div>

                                        {/* Indicator details */}
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium flex items-center gap-1">
                                                <Info className="w-4 h-4" />
                                                各指標分析明細
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {item.indicators.map((ind, idx) => (
                                                    <div key={idx} className="flex items-start gap-2 p-2 rounded bg-muted/10 text-sm">
                                                        <span className={`font-mono text-xs w-16 shrink-0 ${INDICATOR_SIGNAL_COLOR[ind.signal]}`}>
                                                            {ind.name}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-xs">{ind.value}</span>
                                                                <Badge className={`text-[10px] px-1 ${
                                                                    ind.signal === 'bullish' ? 'bg-red-500/20 text-red-400' :
                                                                    ind.signal === 'bearish' ? 'bg-green-500/20 text-green-400' :
                                                                    'bg-muted/20 text-muted-foreground'
                                                                }`}>
                                                                    {ind.signal === 'bullish' ? '偏多' : ind.signal === 'bearish' ? '偏空' : '中性'}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-0.5">{ind.description}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </GlassCard>
                    )}
                </>
            )}

            {/* Disclaimer */}
            <Disclaimer
                variant="detailed"
                source={response?.source || 'TWSE 歷史行情資料'}
                methodology="建議買價 = 主要支撐位（布林下軌/MA60/MA20 中最近者）。停損價 = 進場價 - 2×ATR(14日)。目標價 = 主要壓力位（布林上軌/MA 中最近者）。RSI/MACD/KD/BB/成交量 綜合評分。"
                warning="所有建議價位均為技術指標公式計算結果，僅供參考，不構成投資建議。技術分析無法預測未來走勢。實際交易請自行評估風險。"
            />
        </div>
    );
}

function PriceLevelCard({ label, priceLevel, color }: { label: string; priceLevel: PriceLevel; color: string }) {
    return (
        <div className="p-3 rounded-lg bg-muted/10 border border-border/30">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={`text-xl font-bold font-mono ${color}`}>${priceLevel.price}</div>
            <div className="text-[10px] text-muted-foreground mt-1 flex items-start gap-1">
                <Calculator className="w-3 h-3 mt-0.5 shrink-0" />
                {priceLevel.methodology}
            </div>
        </div>
    );
}
