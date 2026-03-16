"use client";

import React, { useState } from 'react';
import {
    History,
    Play,
    CheckCircle2,
    XCircle,
    TrendingUp,
    Calendar,
    ArrowRight,
    Loader2,
    Trophy,
    Star
} from 'lucide-react';

interface BacktestResult {
    startDate: string;
    endDate: string;
    candidates: any[];
    averageReturn: number;
    successRate: number;
}

export function BacktestDashboard() {
    const [results, setResults] = useState<BacktestResult[]>([]);
    const [sandboxResults, setSandboxResults] = useState<any>(null);
    const [casesResults, setCasesResults] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'standard' | 'sandbox' | 'cases'>('standard');
    const [isLoading, setIsLoading] = useState(false);
    const [hasRun, setHasRun] = useState(false);

    const runBacktest = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/strategy/backtest?days=30&horizon=10');
            if (!response.ok) throw new Error('Backtest failed');
            const data = await response.json();
            setResults(data);
            setHasRun(true);
        } catch (error) {
            console.error('Backtest error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSandbox = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/strategy/sandbox');
            if (!response.ok) throw new Error('Sandbox fetch failed');
            const data = await response.json();
            setSandboxResults(data);
        } catch (error) {
            console.error('Sandbox error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCases = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/strategy/cases');
            if (!response.ok) throw new Error('Cases fetch failed');
            const data = await response.json();
            setCasesResults(data);
        } catch (error) {
            console.error('Cases fetch error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        if (activeTab === 'sandbox' && !sandboxResults) {
            fetchSandbox();
        } else if (activeTab === 'cases' && casesResults.length === 0) {
            fetchCases();
        }
    }, [activeTab]);

    const avgReturn = results.length > 0
        ? results.reduce((acc, curr) => acc + curr.averageReturn, 0) / results.length
        : 0;

    const winningWindows = results.filter(r => r.averageReturn > 0).length;
    const winRate = results.length > 0 ? (winningWindows / results.length) * 100 : 0;

    return (
        <div className="bg-card rounded-xl border shadow-sm h-full flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-muted/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-blue-500" />
                        <h3 className="font-bold text-lg">策略驗證實驗室</h3>
                    </div>
                </div>

                <div className="flex p-1 bg-muted rounded-lg">
                    <button
                        onClick={() => setActiveTab('standard')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'standard'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <span>標準回測</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('sandbox')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'sandbox'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <span>AI 沙盒發現</span>
                        <span className="bg-amber-100 text-amber-700 px-1.5 rounded-full text-[9px]">NEW</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('cases')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'cases'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <span>成功案例庫</span>
                    </button>
                </div>
            </div>

            <div className="p-6 flex-1 overflow-auto">
                {activeTab === 'standard' ? (
                    <>
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={runBacktest}
                                disabled={isLoading}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-md active:scale-95 w-full justify-center"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Play className="w-4 h-4 fill-current" />
                                )}
                                {isLoading ? '回測執行中...' : '執行 30 天滾動回測'}
                            </button>
                        </div>

                        {!hasRun ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center h-[300px]">
                                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full mb-4">
                                    <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <p className="text-muted-foreground font-medium">尚未執行回測數據</p>
                                <p className="text-xs text-muted-foreground mt-2 max-w-[250px]">
                                    點擊按鈕將模擬過去 30 個交易日的「資產翻倍策略」表現，持倉週期為 10 天。
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Summary Stats */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mb-1 uppercase tracking-wider">平均勝率</div>
                                        <div className="text-xl font-bold flex items-baseline gap-1">
                                            {winRate.toFixed(1)}%
                                            <span className="text-[10px] font-normal text-muted-foreground">({winningWindows}/{results.length})</span>
                                        </div>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800">
                                        <div className="text-[10px] text-green-600 dark:text-green-400 font-bold mb-1 uppercase tracking-wider">平均報酬</div>
                                        <div className={`text-xl font-bold ${avgReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {avgReturn > 0 ? '+' : ''}{avgReturn.toFixed(2)}%
                                        </div>
                                    </div>
                                </div>

                                {/* results List */}
                                <div className="space-y-2">
                                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">回測軌跡</div>
                                    <div className="space-y-2">
                                        {results.map((res, idx) => (
                                            <div key={idx} className="group flex items-center justify-between p-3 rounded-lg border bg-background hover:border-blue-500/30 hover:bg-blue-50/5 transition-all shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    {res.averageReturn > 0 ? (
                                                        <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-full">
                                                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                        </div>
                                                    ) : (
                                                        <div className="bg-red-100 dark:bg-red-900/30 p-1.5 rounded-full">
                                                            <XCircle className="w-4 h-4 text-red-600" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="text-xs font-bold flex items-center gap-1">
                                                            {res.startDate.slice(5)} <ArrowRight className="w-2 h-2" /> {res.endDate.slice(5)}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground">
                                                            {res.candidates.length} 個標的
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`text-sm font-black ${res.averageReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {res.averageReturn > 0 ? '+' : ''}{res.averageReturn.toFixed(1)}%
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : activeTab === 'cases' ? (
                    // Cases Content
                    <div className="space-y-6">
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            </div>
                        ) : casesResults.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <div className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-full mb-4 w-16 h-16 mx-auto flex items-center justify-center">
                                    <Trophy className="w-8 h-8 text-amber-500" />
                                </div>
                                <p className="font-bold">尚無歷史翻倍案例</p>
                                <p className="text-xs mt-2">請執行 HistoricalDoublingScanner 以建立資料庫</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-100">
                                    <h4 className="font-bold text-amber-900 text-lg flex items-center gap-2">
                                        <Trophy className="w-5 h-5 text-amber-600" />
                                        歷史翻倍案例 (回測參考)
                                    </h4>
                                    <p className="text-sm text-amber-800/80 mt-1">
                                        歷史上曾在一年內漲幅超過 100% 的股票。⚠️ 此為事後篩選 (生存者偏差)，不代表未來可複製。未含交易成本。
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {casesResults.map((c: any, idx: number) => (
                                        <div key={idx} className="border rounded-xl p-3 hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-lg">{c.stockName}</span>
                                                        <span className="text-xs font-mono text-muted-foreground">{c.stockId}</span>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground">
                                                        {c.doublingStartDate} → {c.doublingEndDate} ({c.doublingDays} days)
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-black text-red-600">+{c.maxGain.toFixed(0)}%</div>
                                                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Return</div>
                                                </div>
                                            </div>

                                            {/* Pre-surge Features */}
                                            <div className="flex gap-2 mt-2 pt-2 border-t border-dashed overflow-x-auto">
                                                <div className="bg-gray-100 px-2 py-1 rounded text-[10px] whitespace-nowrap">
                                                    YoY: <span className="font-bold">{c.preRevenueYoY}%</span>
                                                </div>
                                                <div className="bg-gray-100 px-2 py-1 rounded text-[10px] whitespace-nowrap">
                                                    Chip: <span className="font-bold">{c.preChipConcentration}</span>
                                                </div>
                                                <div className="bg-gray-100 px-2 py-1 rounded text-[10px] whitespace-nowrap">
                                                    For: <span className="font-bold">{c.preForeignHolding}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    // Sandbox Content
                    <div className="space-y-6">
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            </div>
                        ) : !sandboxResults || !sandboxResults.top_discoveries ? (
                            <div className="text-center py-12 text-muted-foreground">
                                尚無沙盒發現紀錄
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800">
                                    <div className="flex items-start gap-2">
                                        <TrendingUp className="w-5 h-5 text-amber-600 mt-0.5" />
                                        <div>
                                            <h4 className="font-bold text-amber-900 dark:text-amber-100 text-sm">AI 自動挖掘結果</h4>
                                            <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1">
                                                系統隨機生成策略變數，並透過回測引擎找出最佳參數組合。
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {sandboxResults.top_discoveries.map((discovery: any, idx: number) => (
                                        <div key={idx} className="border rounded-xl p-4 bg-card shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                            <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                                Rank #{idx + 1}
                                            </div>

                                            <div className="flex items-center gap-4 mb-3">
                                                <div className="bg-blue-50 dark:bg-blue-900/20 w-12 h-12 rounded-lg flex flex-col items-center justify-center border border-blue-100">
                                                    <span className="text-xl font-black text-blue-600">{discovery.metrics.win_rate}%</span>
                                                    <span className="text-[8px] text-muted-foreground uppercase">勝率</span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold">Variant {discovery.variant_id.slice(0, 8)}</div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                        <span>報酬率: <span className="text-green-600 font-bold">+{discovery.metrics.total_return.toFixed(1)}%</span></span>
                                                        <span>•</span>
                                                        <span>交易次數: {discovery.metrics.total_trades}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-3 rounded-lg border">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">停損 (SL)</span>
                                                    <span className="font-mono font-bold">{discovery.params.stop_loss}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">停利 (TP)</span>
                                                    <span className="font-mono font-bold">{discovery.params.take_profit}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">時間停損</span>
                                                    <span className="font-mono font-bold">{discovery.params.time_stop} 天</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">MA參數</span>
                                                    <span className="font-mono font-bold">{discovery.params.ma_short}/{discovery.params.ma_long}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-4 bg-muted/10 border-t">
                <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
                    <TrendingUp className="w-3 h-3 shrink-0" />
                    <span>指標說明：勝率為單次窗口平均報酬大於 0 的比例。測試標的已排除資本額大於 1500 億之大型權值股。</span>
                </div>
            </div>
        </div>
    );
}
