"use client";

import React, { useState, useMemo } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { useApiPost } from '@/hooks/useApiData';
import { DataStatusBar, DataAvailabilityGuard } from '@/components/ui/data-availability-guard';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { Disclaimer } from '@/components/ui/disclaimer';
import { GlassCard } from '@/components/ui/glass-card';
import { LoadingSpinner } from '@/components/ui/loading';
import {
    FlaskConical, TrendingUp, TrendingDown, BarChart3,
    ArrowRight, Calendar, AlertTriangle, Info, Scale
} from 'lucide-react';

interface EligibleStock {
    symbol: string;
    name: string;
    industry: string;
    dataPoints: number;
}

interface EligibleResponse {
    eligible: EligibleStock[];
    total: number;
    eligibleCount: number;
    minRequired: number;
    sample_size: number;
    last_updated: string | null;
}

interface Trade {
    entryDate: string;
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    returnPct: number;
    reason: string;
}

interface BacktestResult {
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
        cagr: number;
        sharpeRatio: number;
    };
    equityCurve: { date: string; value: number }[];
    methodology: string;
    source: string;
    coverage: { availableDays: number; requiredDays: number; message?: string };
    sample_size: number;
    last_updated: string | null;
    disclaimer: string;
    benchmark?: {
        buyAndHoldReturn: number;
        marketReturn: number | null;
        alphaVsBuyHold: number;
        alphaVsMarket: number | null;
        marketAvailable: boolean;
        marketUnavailableReason?: string;
    };
    samplePeriod?: string;
    dataLimitations?: string[];
}

const STRATEGIES = [
    { key: 'ma_cross', label: 'MA5/MA20 交叉', desc: 'MA5 向上穿越 MA20 買進，向下穿越賣出' },
    { key: 'rsi', label: 'RSI 超買超賣', desc: 'RSI<30 買進，RSI>70 賣出' },
    { key: 'bb', label: '布林通道', desc: '跌破下軌買進，突破上軌賣出' },
];

const MONTH_OPTIONS = [
    { value: 6, label: '6 個月' },
    { value: 12, label: '12 個月' },
    { value: 24, label: '24 個月' },
];

export default function BacktestPage() {
    const [selectedStock, setSelectedStock] = useState('');
    const [selectedStrategy, setSelectedStrategy] = useState('ma_cross');
    const [selectedMonths, setSelectedMonths] = useState(12);

    const { data: eligibleRes, loading: loadingEligible } = useApiData<EligibleResponse>(
        '/api/stocks/backtest'
    );
    const { post: executeBacktest, loading: loadingBacktest } = useApiPost<{ symbol: string; strategy: string; months: number }, BacktestResult>();
    const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);

    const handleRunBacktest = async () => {
        if (!selectedStock) return;
        const result = await executeBacktest('/api/stocks/backtest', { symbol: selectedStock, strategy: selectedStrategy, months: selectedMonths });
        if (result) setBacktestResult(result);
    };

    const eligibleMode = !eligibleRes ? 'unavailable'
        : eligibleRes.eligibleCount === 0 ? 'unavailable'
        : eligibleRes.eligibleCount < 20 ? 'limited'
        : 'full';

    const stockColumns: ColumnDef<EligibleStock>[] = useMemo(() => [
        {
            key: 'symbol', header: '代號', sortable: true,
            render: (item) => (
                <span className="font-mono font-medium text-primary">{item.symbol}</span>
            ),
        },
        { key: 'name', header: '名稱', sortable: true },
        { key: 'industry', header: '產業', sortable: true, hideOnMobile: true },
        {
            key: 'dataPoints', header: '資料天數', sortable: true, align: 'right',
            accessor: (item) => item.dataPoints,
            render: (item) => (
                <span className={item.dataPoints >= 250 ? 'text-emerald-400' : 'text-amber-400'}>
                    {item.dataPoints} 天
                </span>
            ),
        },
    ], []);

    const tradeColumns: ColumnDef<Trade>[] = useMemo(() => [
        { key: 'entryDate', header: '進場日', sortable: true },
        {
            key: 'entryPrice', header: '進場價', sortable: true, align: 'right',
            accessor: (item) => item.entryPrice,
            render: (item) => `$${item.entryPrice}`,
        },
        { key: 'exitDate', header: '出場日', sortable: true },
        {
            key: 'exitPrice', header: '出場價', sortable: true, align: 'right',
            accessor: (item) => item.exitPrice,
            render: (item) => `$${item.exitPrice}`,
        },
        {
            key: 'returnPct', header: '報酬率', sortable: true, align: 'right',
            accessor: (item) => item.returnPct,
            render: (item) => (
                <span className={item.returnPct > 0 ? 'text-red-400' : item.returnPct < 0 ? 'text-green-400' : ''}>
                    {item.returnPct > 0 ? '+' : ''}{item.returnPct}%
                </span>
            ),
        },
        {
            key: 'reason', header: '交易原因', hideOnMobile: true,
            render: (item) => (
                <span className="text-xs text-muted-foreground truncate block max-w-[300px]" title={item.reason}>
                    {item.reason}
                </span>
            ),
        },
    ], []);

    return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <FlaskConical className="w-6 h-6 text-primary" />
                    策略回測
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    選擇股票與策略進行歷史回測，僅限有 ≥100 天歷史資料的股票
                </p>
            </div>

            {/* Data Status */}
            {eligibleRes && (
                <DataStatusBar
                    mode={eligibleMode as 'full' | 'limited' | 'unavailable'}
                    coverage={{ stocks: eligibleRes.eligibleCount, total: eligibleRes.total }}
                    lastUpdated={eligibleRes.last_updated || undefined}
                    limitations={
                        eligibleRes.eligibleCount < eligibleRes.total
                            ? [`${eligibleRes.total - eligibleRes.eligibleCount} 檔股票資料不足 ${eligibleRes.minRequired} 天`]
                            : undefined
                    }
                />
            )}

            {/* Controls */}
            <GlassCard className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {/* Stock selector */}
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">選擇股票</label>
                        <select
                            value={selectedStock}
                            onChange={(e) => setSelectedStock(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                        >
                            <option value="">-- 選擇 --</option>
                            {eligibleRes?.eligible.map(s => (
                                <option key={s.symbol} value={s.symbol}>
                                    {s.symbol} {s.name} ({s.dataPoints}天)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Strategy selector */}
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">策略</label>
                        <select
                            value={selectedStrategy}
                            onChange={(e) => setSelectedStrategy(e.target.value)}
                            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                        >
                            {STRATEGIES.map(s => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Months selector */}
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">回測期間</label>
                        <select
                            value={selectedMonths}
                            onChange={(e) => setSelectedMonths(Number(e.target.value))}
                            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                        >
                            {MONTH_OPTIONS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Run button */}
                    <div className="flex items-end">
                        <button
                            onClick={handleRunBacktest}
                            disabled={!selectedStock || loadingBacktest}
                            className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                        >
                            {loadingBacktest ? <LoadingSpinner size="sm" /> : <FlaskConical className="w-4 h-4" />}
                            執行回測
                        </button>
                    </div>
                </div>

                {/* Strategy description */}
                <div className="mt-2 text-xs text-muted-foreground">
                    策略說明：{STRATEGIES.find(s => s.key === selectedStrategy)?.desc}
                </div>
            </GlassCard>

            {/* Backtest Results */}
            {loadingBacktest && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <LoadingSpinner size="lg" />
                    <p className="text-sm text-muted-foreground">回測計算中...</p>
                </div>
            )}

            {backtestResult && !loadingBacktest && (
                <>
                    {backtestResult.source === 'insufficient_data' ? (
                        <DataAvailabilityGuard mode="unavailable" message={backtestResult.coverage?.message || '資料不足以執行回測'}>
                            <div />
                        </DataAvailabilityGuard>
                    ) : (
                        <div className="space-y-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                                <SummaryCard label="總報酬" value={`${backtestResult.summary.totalReturn > 0 ? '+' : ''}${backtestResult.summary.totalReturn}%`} color={backtestResult.summary.totalReturn > 0 ? 'text-red-400' : 'text-green-400'} />
                                <SummaryCard label="CAGR" value={`${backtestResult.summary.cagr > 0 ? '+' : ''}${backtestResult.summary.cagr}%`} color={backtestResult.summary.cagr > 0 ? 'text-red-400' : 'text-green-400'} />
                                <SummaryCard label="最大回撤" value={`-${backtestResult.summary.maxDrawdown}%`} color="text-amber-400" />
                                <SummaryCard label="勝率" value={`${backtestResult.summary.winRate}%`} />
                                <SummaryCard label="交易次數" value={`${backtestResult.summary.totalTrades}`} />
                                <SummaryCard label="平均報酬" value={`${backtestResult.summary.avgReturn}%`} />
                                <SummaryCard label="Sharpe" value={`${backtestResult.summary.sharpeRatio}`} />
                            </div>

                            {/* Benchmark Comparison */}
                            {backtestResult.benchmark && (
                                <BenchmarkComparison
                                    strategyReturn={backtestResult.summary.totalReturn}
                                    benchmark={backtestResult.benchmark}
                                />
                            )}

                            {/* Data Limitations */}
                            {backtestResult.dataLimitations && backtestResult.dataLimitations.length > 0 && (
                                <GlassCard className="p-4">
                                    <div className="flex items-start gap-2">
                                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                        <div>
                                            <div className="text-xs font-medium text-blue-400 mb-1">資料限制</div>
                                            <ul className="text-xs text-muted-foreground space-y-0.5">
                                                {backtestResult.dataLimitations.map((l, i) => (
                                                    <li key={i}>• {l}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </GlassCard>
                            )}

                            {/* Period info */}
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-1">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    回測區間：{backtestResult.period}
                                </span>
                                <span>策略：{backtestResult.methodology}</span>
                                <span>可用資料：{backtestResult.coverage.availableDays} 天</span>
                            </div>

                            {/* Warning */}
                            <div className="flex items-start gap-2 p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 rounded-lg text-xs">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <span className="text-amber-700 dark:text-amber-400">
                                    {backtestResult.disclaimer}
                                </span>
                            </div>

                            {/* Trade List */}
                            {backtestResult.trades.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5" />
                                        交易明細
                                    </h3>
                                    <DataTable
                                        data={backtestResult.trades}
                                        columns={tradeColumns}
                                        defaultSort={{ key: 'entryDate', direction: 'asc' }}
                                        pageSize={10}
                                        searchable={false}
                                        getRowKey={(item) => `${item.entryDate}-${item.exitDate}`}
                                        emptyMessage="無交易紀錄"
                                        emptyDescription="策略未產生任何交易信號"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Eligible stocks list (shown when no backtest result yet) */}
            {!backtestResult && !loadingBacktest && (
                <div>
                    <h3 className="text-lg font-semibold mb-3">可回測股票</h3>
                    {loadingEligible ? (
                        <div className="flex items-center justify-center py-12">
                            <LoadingSpinner size="lg" />
                        </div>
                    ) : eligibleRes && eligibleRes.eligible.length > 0 ? (
                        <DataTable
                            data={eligibleRes.eligible}
                            columns={stockColumns}
                            searchable
                            searchPlaceholder="搜尋代號或名稱..."
                            searchKeys={['symbol', 'name']}
                            defaultSort={{ key: 'dataPoints', direction: 'desc' }}
                            pageSize={15}
                            onRowClick={(item) => setSelectedStock(item.symbol)}
                            getRowKey={(item) => item.symbol}
                            emptyMessage="無可回測股票"
                            emptyDescription="目前無股票有足夠歷史資料（需 ≥100 天）"
                        />
                    ) : (
                        <DataAvailabilityGuard mode="unavailable" message="目前無股票有足夠歷史資料（需 ≥100 天）進行回測">
                            <div />
                        </DataAvailabilityGuard>
                    )}
                </div>
            )}

            <Disclaimer
                source="TWSE 歷史行情資料"
                methodology="回測基於歷史資料模擬策略執行結果，不含交易成本與滑價"
                warning="回測結果僅供研究參考，不代表未來績效。過去表現不保證未來報酬。"
            />
        </div>
    );
}

function BenchmarkComparison({ strategyReturn, benchmark }: {
    strategyReturn: number;
    benchmark: NonNullable<BacktestResult['benchmark']>;
}) {
    const outperformsBH = strategyReturn > benchmark.buyAndHoldReturn;
    const outperformsMarket = benchmark.marketReturn !== null && strategyReturn > benchmark.marketReturn;

    return (
        <GlassCard className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
                <Scale className="w-4 h-4 text-primary" />
                Benchmark 比較
            </div>

            {/* Comparison grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <CompareCard
                    label="策略報酬"
                    value={`${strategyReturn > 0 ? '+' : ''}${strategyReturn}%`}
                    color={strategyReturn > 0 ? 'text-red-400' : 'text-green-400'}
                />
                <CompareCard
                    label="Buy & Hold"
                    value={`${benchmark.buyAndHoldReturn > 0 ? '+' : ''}${benchmark.buyAndHoldReturn}%`}
                    color={benchmark.buyAndHoldReturn > 0 ? 'text-red-400' : 'text-green-400'}
                    subtitle="同股同期持有"
                />
                <CompareCard
                    label="Alpha vs B&H"
                    value={`${benchmark.alphaVsBuyHold > 0 ? '+' : ''}${benchmark.alphaVsBuyHold}%`}
                    color={benchmark.alphaVsBuyHold > 0 ? 'text-red-400' : 'text-green-400'}
                />
                {benchmark.marketAvailable && benchmark.marketReturn !== null ? (
                    <>
                        <CompareCard
                            label="大盤報酬"
                            value={`${benchmark.marketReturn > 0 ? '+' : ''}${benchmark.marketReturn}%`}
                            color={benchmark.marketReturn > 0 ? 'text-red-400' : 'text-green-400'}
                            subtitle="TAIEX 同期"
                        />
                        <CompareCard
                            label="Alpha vs 大盤"
                            value={`${benchmark.alphaVsMarket! > 0 ? '+' : ''}${benchmark.alphaVsMarket}%`}
                            color={benchmark.alphaVsMarket! > 0 ? 'text-red-400' : 'text-green-400'}
                        />
                    </>
                ) : (
                    <div className="col-span-2 flex items-center gap-2 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        {benchmark.marketUnavailableReason || '大盤 benchmark 不可用'}
                    </div>
                )}
            </div>

            {/* Interpretation */}
            <div className="flex flex-wrap gap-2 text-xs">
                <span className={`px-2 py-1 rounded-full font-medium ${outperformsBH ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'}`}>
                    {outperformsBH ? '✓ 策略優於 Buy & Hold' : '✗ 策略劣於 Buy & Hold'}
                </span>
                {benchmark.marketAvailable && benchmark.marketReturn !== null && (
                    <span className={`px-2 py-1 rounded-full font-medium ${outperformsMarket ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'}`}>
                        {outperformsMarket ? '✓ 策略優於大盤' : '✗ 策略劣於大盤'}
                    </span>
                )}
            </div>
        </GlassCard>
    );
}

function CompareCard({ label, value, color = 'text-foreground', subtitle }: {
    label: string; value: string; color?: string; subtitle?: string;
}) {
    return (
        <div className="p-2.5 bg-muted/20 rounded-lg text-center">
            <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
            <div className={`text-base font-bold font-mono mt-0.5 ${color}`}>{value}</div>
            {subtitle && <div className="text-[9px] text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
    );
}

function SummaryCard({ label, value, color = 'text-foreground' }: { label: string; value: string; color?: string }) {
    return (
        <GlassCard className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
            <div className={`text-lg font-bold font-mono mt-1 ${color}`}>{value}</div>
        </GlassCard>
    );
}
