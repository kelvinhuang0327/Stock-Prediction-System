
import React, { useState } from 'react';
import {
    Play,
    TrendingUp,
    ShieldAlert,
    Activity,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Loader2
} from 'lucide-react';
import { InteractiveLineChart } from '@/components/charts/InteractiveLineChart';

interface SimulationResult {
    history: any[];
    logs: string[];
    finalEquity: number;
    returnPercent: number;
    maxDrawdown: number;
    metrics: {
        sharpeRatio: number;
        winRate: number;
        totalTrades: number;
    }
}

export function ProTraderSimulation({ capital, maxDrawdown, style }: { capital: number, maxDrawdown: number, style: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<SimulationResult | null>(null);

    const runSimulation = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/strategy/pro-simulation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initialCapital: capital, maxDrawdown, style })
            });
            if (res.ok) {
                const data = await res.json();
                setResult(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    if (!result) {
        return (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                <div className="bg-red-500/20 p-4 rounded-full mb-4">
                    <Activity className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">啟動戰略推演 (War Game)</h3>
                <p className="text-slate-400 text-center max-w-sm mb-6">
                    系統將使用過去 1 年的市場數據與您的設定，
                    模擬執行「職業操盤手」的所有紀律與決策。
                </p>
                <button
                    onClick={runSimulation}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                    {isLoading ? '戰略推演中...' : '開始模擬 (Run Simulation)'}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">最終權益 (Final Equity)</div>
                    <div className={`text-2xl font-black ${result.returnPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${new Intl.NumberFormat('en-US', { notation: "compact" }).format(result.finalEquity)}
                    </div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">總報酬率 (Return)</div>
                    <div className="flex items-center gap-1">
                        {result.returnPercent >= 0 ? <ArrowUpRight className="w-5 h-5 text-green-500" /> : <ArrowDownRight className="w-5 h-5 text-red-500" />}
                        <span className={`text-2xl font-black ${result.returnPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {result.returnPercent.toFixed(1)}%
                        </span>
                    </div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">最大回撤 (MDD)</div>
                    <div className="flex items-center gap-1">
                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                        <span className="text-2xl font-black text-amber-400">
                            -{result.maxDrawdown.toFixed(1)}%
                        </span>
                    </div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">夏普比率 (Sharpe)</div>
                    <div className="flex items-center gap-1">
                        <Activity className="w-5 h-5 text-blue-500" />
                        <span className="text-2xl font-black text-white">
                            {result.metrics?.sharpeRatio.toFixed(2)}
                        </span>
                    </div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">勝率 (Win Rate)</div>
                    <div className="flex items-center gap-1">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        <span className="text-2xl font-black text-white">
                            {result.metrics?.winRate.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Equity Curve */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-red-400" />
                    資金曲線模擬 (Equity Curve)
                </h4>
                <div className="h-[300px] w-full">
                    <InteractiveLineChart
                        data={result.history.map((h: any) => ({
                            date: h.date.split('T')[0],
                            value: h.equity
                        }))}
                        dataKey="value"
                        height={300}
                        color="#ef4444"
                    />
                </div>
            </div>

            {/* Phase History / Regime Check */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h4 className="font-bold text-lg mb-4 text-slate-300">戰術執行紀錄 (Action Log)</h4>
                <div className="h-[200px] overflow-y-auto space-y-2 pr-2 font-mono text-xs">
                    {result.logs.length === 0 ? (
                        <div className="text-slate-500 italic text-center py-10">本次模擬無交易觸發</div>
                    ) : (
                        result.logs.map((log, idx) => (
                            <div key={idx} className="p-2 border-b border-slate-700/50 text-slate-400 hover:bg-white/5 transition-colors">
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="flex justify-center">
                <button
                    onClick={runSimulation}
                    className="text-sm text-slate-400 hover:text-white underline underline-offset-4"
                >
                    重新執行模擬
                </button>
            </div>
        </div>
    );
}
