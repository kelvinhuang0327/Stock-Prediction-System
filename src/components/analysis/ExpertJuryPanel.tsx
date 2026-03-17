
"use client";

import React, { useState, useEffect } from 'react';
import { Shield, Target, Cpu, TrendingUp, AlertTriangle, CheckCircle2, Search } from 'lucide-react';

interface ExpertResult {
    role: string;
    conclusion: string;
    report: string;
}

interface JuryData {
    id: string;
    name: string;
    conviction: number;
    experts: ExpertResult[];
    metrics: {
        vcp: number;
        vol_mult: number;
        inst_concentration: number;
        atr_percent: number;
    };
    error?: string;
}

export const ExpertJuryPanel: React.FC = () => {
    const [symbol, setSymbol] = useState('2330');
    const [data, setData] = useState<JuryData | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchJuryAnalysis = async (code: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/strategy/jury?symbol=${code}`);
            const result = await res.json();
            setData(result);
        } catch (error) {
            console.error('Failed to fetch jury data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJuryAnalysis('2330');
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (symbol) fetchJuryAnalysis(symbol);
    };

    const getExpertIcon = (role: string) => {
        if (role.includes('方法理論')) return <Target className="w-5 h-5 text-blue-400" />;
        if (role.includes('技術務實')) return <TrendingUp className="w-5 h-5 text-emerald-400" />;
        if (role.includes('程式架構')) return <Cpu className="w-5 h-5 text-purple-400" />;
        return <Shield className="w-5 h-5 text-slate-400" />;
    };

    return (
        <div className="space-y-6">
            {/* Header & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[100px] -ml-32 -mb-32"></div>

                <div className="relative z-10">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
                        <Shield className="w-8 h-8 text-blue-500" />
                        台股 AI 專家審評會決議
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        由三位不同背景的 AI 產品設計師組成的虛擬評審團，針對「資產翻倍」潛力進行深度評核。
                    </p>
                </div>

                <form onSubmit={handleSearch} className="relative z-10 flex gap-2">
                    <div className="relative">
                        <input
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value)}
                            placeholder="輸入股票代號 (如: 2330)"
                            className="w-full md:w-48 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2 pl-10 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        />
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        {loading ? '分析中...' : '提交審查'}
                    </button>
                </form>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 bg-slate-900/50 border border-slate-800 rounded-3xl"></div>
                    ))}
                </div>
            ) : data?.error ? (
                <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-200">無法生成審查報告</h3>
                    <p className="text-slate-400 mt-2">{data.error}</p>
                </div>
            ) : data && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="p-6 bg-slate-900/40 backdrop-blur-lg border border-slate-800 rounded-3xl relative group overflow-hidden transition-all hover:border-blue-500/30">
                            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                                <TrendingUp className="w-10 h-10 text-blue-500" />
                            </div>
                            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">總體信心指數</span>
                            <div className="mt-2 flex items-end gap-2">
                                <span className={`text-4xl font-black ${data.conviction >= 70 ? 'text-emerald-400' : (data.conviction >= 50 ? 'text-blue-400' : 'text-slate-400')}`}>
                                    {data.conviction}%
                                </span>
                            </div>
                            <div className="mt-4 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-1000 ease-out ${data.conviction >= 70 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                                    style={{ width: `${data.conviction}%` }}
                                ></div>
                            </div>
                        </div>

                        {[
                            { label: 'VCP 壓縮度', value: `${data.metrics.vcp}%`, icon: <Target className="w-4 h-4" />, color: data.metrics.vcp < 3 ? 'text-emerald-400' : 'text-slate-300' },
                            { label: '成交量倍數', value: `${data.metrics.vol_mult}x`, icon: <TrendingUp className="w-4 h-4" />, color: data.metrics.vol_mult > 3 ? 'text-amber-400' : 'text-slate-300' },
                            { label: '法人集中度', value: `${data.metrics.inst_concentration}%`, icon: <CheckCircle2 className="w-4 h-4" />, color: data.metrics.inst_concentration > 5 ? 'text-blue-400' : 'text-slate-300' }
                        ].map((m, i) => (
                            <div key={i} className="p-6 bg-slate-900/40 backdrop-blur-lg border border-slate-800 rounded-3xl transition-all hover:bg-slate-800/40">
                                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">
                                    {m.icon}
                                    {m.label}
                                </div>
                                <div className={`text-3xl font-black ${m.color}`}>
                                    {m.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Jury Members */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {data.experts.map((expert, i) => (
                            <div key={i} className="flex flex-col bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden transition-all hover:translate-y-[-4px] hover:shadow-2xl">
                                <div className="p-5 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-700 shadow-inner">
                                            {getExpertIcon(expert.role)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-100">{expert.role}</h4>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${expert.conclusion === 'BULLISH' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    expert.conclusion === 'NEUTRAL' ? 'bg-slate-800 text-slate-400' : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {expert.conclusion}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`w-3 h-3 rounded-full ${expert.conclusion === 'BULLISH' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,1)]' : 'bg-slate-700'
                                        }`}></div>
                                </div>
                                <div className="p-6 flex-grow">
                                    <div className="prose prose-invert prose-sm">
                                        <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-sm italic">
                                            {expert.report.split('\n').filter(line => line.length > 0 && !line.startsWith('---')).map((line, idx) => (
                                                <span key={idx} className="block mb-2 last:mb-0">
                                                    {line.startsWith('👉') ? (
                                                        <span className="flex gap-2 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 not-italic text-blue-300 font-medium">
                                                            {line}
                                                        </span>
                                                    ) : line}
                                                </span>
                                            ))}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
