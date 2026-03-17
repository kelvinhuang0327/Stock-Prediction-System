"use client";

import React, { useState, useEffect } from 'react';
import {
    Target,
    Zap,
    ArrowUpRight,
    ShieldCheck,
    Search,
    TrendingUp,
    CheckCircle2,
    AlertCircle,
    Info,
    TrendingDown,
    Plus,
    Check,
    Loader2,
    Trophy
} from 'lucide-react';
import type { ScreeningResult } from '@/lib/services/StrategyScreeningService';
import { BacktestDashboard } from './BacktestDashboard';
import { InteractiveLineChart } from '@/components/charts/InteractiveLineChart';
import { SectorRotationMap } from '../analysis/SectorRotationMap';
import { ProTraderDashboard } from './ProTraderDashboard';
import { Brain } from 'lucide-react';

const STAGES = [
    { label: '第一階段', target: '200萬', multiplier: '2x', desc: '核心佈局' },
    { label: '第二階段', target: '400萬', multiplier: '4x', desc: '複利放大' },
    { label: '第三階段', target: '800萬', multiplier: '8x', desc: '資產躍遷' },
    { label: '第四階段', target: '1600萬', multiplier: '16x', desc: '最終目標' },
];

function ConcentrationSparkline({ data }: { data: number[] }) {
    if (!data || data.length === 0) return null;

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min;

    // Scale points to SVG space (100x30)
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 30 - ((val - min) / range) * 30;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox="0 0 100 30" className="w-full h-8 overflow-visible">
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
                className="text-purple-500 opacity-60"
            />
            {/* Last point highlight */}
            <circle
                cx="100"
                cy={30 - ((data[data.length - 1] - min) / range) * 30}
                r="3"
                className="fill-purple-600 shadow-sm"
            />
        </svg>
    );
}

export function AssetDoublingPlan() {
    const [currentStage, setCurrentStage] = useState(0);
    const [candidates, setCandidates] = useState<ScreeningResult[]>([]);
    const [loading, setLoading] = useState(true); // Changed from isLoading to loading
    const [error, setError] = useState<string | null>(null);
    const [selectedFilter, setSelectedFilter] = useState<'all' | 'gems' | 'momentum'>('all'); // Added
    const [selectedStrategy, setSelectedStrategy] = useState<'AssetDoubling' | 'MomentumSwing' | 'DayTradePrep'>('AssetDoubling'); // Added
    const [isProMode, setIsProMode] = useState(false);

    // New states for custom analysis
    const [searchQuery, setSearchQuery] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<ScreeningResult | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [sentimentResult, setSentimentResult] = useState<any | null>(null);
    const [isAdded, setIsAdded] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'gems' | 'momentum'>('all');

    const [watchlist, setWatchlist] = useState<any[]>([]);
    const [marketStatus, setMarketStatus] = useState<{ status: string; scalingFactor: number; indexClose: number; regime?: 'BULL' | 'NEUTRAL' | 'CORRECTION' | 'BEAR'; ma20?: number } | null>(null);

    // Fetch Watchlist & Market Status on Mount
    const fetchCommonData = async () => {
        try {
            // Watchlist
            const res = await fetch('/api/watchlist');
            if (res.ok) {
                const data = await res.json();
                setWatchlist(data);
                if (analysisResult) {
                    setIsAdded(data.some((item: any) => item.stockId === analysisResult.stockId));
                }
            }

            // Market Status
            const mRes = await fetch('/api/market-status');
            if (mRes.ok) {
                const mData = await mRes.json();
                setMarketStatus(mData);
            }
        } catch (e) {
            console.error("Failed to fetch common data", e);
        }
    };

    useEffect(() => {
        fetchCommonData();
    }, []);

    // Sync isAdded state when analysisResult changes
    useEffect(() => {
        if (analysisResult) {
            setIsAdded(watchlist.some((s: any) => s.stockId === analysisResult.stockId));
        }
    }, [analysisResult, watchlist]);

    useEffect(() => {
        const runScreening = async () => { // Renamed from fetchCandidates
            setLoading(true); // Changed from setIsLoading to setLoading
            try {
                const response = await fetch('/api/strategy/screen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ strategy: selectedStrategy }) // Use selectedStrategy
                });
                if (!response.ok) throw new Error('Failed to fetch candidates');
                const data = await response.json();
                // Support both new ScreenResult format and legacy array
                setCandidates(Array.isArray(data) ? data : data.candidates || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        runScreening();
    }, [selectedStrategy]); // Re-run when strategy changes

    const handleAnalyze = async (e: React.FormEvent, manualSymbol?: string) => {
        e.preventDefault();
        const symbol = manualSymbol || searchQuery;
        if (!symbol.trim()) return;

        try {
            setIsAnalyzing(true);
            setAnalysisError(null);
            setAnalysisError(null);
            setAnalysisResult(null);
            setSentimentResult(null);
            setHistoryData([]);
            // setIsAdded(false); // Let useEffect handle sync
            const response = await fetch('/api/strategy/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: symbol.trim() })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '分析失敗');
            }

            const data = await response.json();
            setAnalysisResult(data);

            // Fetch 6 months history for chart
            const historyResponse = await fetch(`/api/stocks/${symbol.trim()}/history?months=6`);
            if (historyResponse.ok) {
                const history = await historyResponse.json();
                setHistoryData(history.map((h: any) => ({
                    date: h.date,
                })));
            }

            // Fetch Sentiment
            const sentimentResponse = await fetch(`/api/sentiment/analyze?symbol=${symbol.trim()}`);
            if (sentimentResponse.ok) {
                const sentiment = await sentimentResponse.json();
                setSentimentResult(sentiment);
            }
        } catch (err: any) {
            setAnalysisError(err.message);
            setAnalysisResult(null);
            setHistoryData([]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAddToWatchlist = async () => {
        if (!analysisResult) return;

        try {
            if (isAdded) {
                // Remove (DELETE)
                await fetch(`/api/watchlist/${analysisResult.stockId}`, { method: 'DELETE' });
                setIsAdded(false);
            } else {
                // Add (POST)
                // Use current close as entry price
                await fetch('/api/watchlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        stockId: analysisResult.stockId,
                        entryPrice: analysisResult.closePrice,
                        note: 'Added from Asset Doubling Plan'
                    })
                });
                setIsAdded(true);
            }
            fetchCommonData();
        } catch (e) {
            console.error("Watchlist operation failed", e);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header / Goal Overview */}
            <div className="bg-gradient-to-br from-red-600 to-red-800 text-white rounded-2xl p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap className="w-48 h-48" />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Target className="w-6 h-6 text-red-200" />
                            <h2 className="text-2xl font-bold">資產翻倍研究計劃 (模型推估)</h2>
                        </div>
                        <button
                            onClick={() => setIsProMode(!isProMode)}
                            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${isProMode
                                ? 'bg-white text-red-900 shadow-lg scale-105'
                                : 'bg-red-800/30 text-red-200 hover:bg-red-800/50'
                                }`}
                        >
                            {isProMode ? <Brain className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                            {isProMode ? 'PRO TRADER MODE' : 'Switch to Pro Mode'}
                        </button>
                    </div>

                    {!isProMode ? (
                        <>
                            <p className="text-red-100 max-w-2xl mb-8">
                                此計劃旨在透過集中火力於「高成長、籌碼優、多頭強勢」的三合一飆股，
                                達成四次資產翻倍，將 100 萬資產推向 1600 萬的頂峰。
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {STAGES.map((stage, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setCurrentStage(idx)}
                                        className={`
                                            cursor-pointer p-4 rounded-xl border transition-all
                                            ${idx <= currentStage ? 'bg-white/10 border-white/40 ring-2 ring-white/20' : 'bg-black/10 border-white/10 opacity-50'}
                                        `}
                                    >
                                        <div className="text-xs text-white/60 mb-1">{stage.label}</div>
                                        <div className="text-xl font-bold flex items-center justify-between">
                                            {stage.target}
                                            <span className="text-xs bg-red-400/30 px-2 py-0.5 rounded-full">{stage.multiplier}</span>
                                        </div>
                                        <div className="text-xs mt-2 text-white/80">{stage.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="bg-black/20 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                            <p className="text-white/90 font-medium flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-400" />
                                您已進入專業操盤模式。此模式隱藏了基礎目標引導，專注於市場狀態判讀與資金控管紀律。
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {isProMode ? (
                <ProTraderDashboard
                    marketStatus={marketStatus}
                    candidates={candidates}
                />
            ) : (
                marketStatus && (
                    <div className="bg-card rounded-xl border shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${marketStatus.regime === 'BULL' ? 'bg-red-100 text-red-600' :
                                marketStatus.regime === 'NEUTRAL' ? 'bg-orange-100 text-orange-600' :
                                    marketStatus.regime === 'CORRECTION' ? 'bg-blue-100 text-blue-600' :
                                        'bg-green-100 text-green-600' // Bearish often Green in TW stocks for drop? No, Stick to Red=Bull (Up) Green=Bear (Down)? TW: Red=Up, Green=Down. 
                                // Standardize: Bull (Red/Fire), Bear (Green/Ice) for TW context.
                                }`}>
                                {marketStatus.regime === 'BULL' ? <TrendingUp className="w-6 h-6" /> :
                                    marketStatus.regime === 'NEUTRAL' ? <Info className="w-6 h-6" /> :
                                        marketStatus.regime === 'CORRECTION' ? <AlertCircle className="w-6 h-6" /> :
                                            <TrendingDown className="w-6 h-6" />}
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Market Climate</div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-black">{marketStatus.regime || marketStatus.status}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${marketStatus.scalingFactor === 1 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                        }`}>
                                        Position Scale: {marketStatus.scalingFactor * 100}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 w-full md:w-auto flex items-center gap-2">
                            {/* Mini Metter */}
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                <div className={`h-full ${marketStatus.regime === 'BEAR' ? 'bg-green-500 opacity-100' : 'bg-green-200 opacity-30'} w-1/4 transition-all`} />
                                <div className={`h-full ${marketStatus.regime === 'CORRECTION' ? 'bg-blue-500 opacity-100' : 'bg-blue-200 opacity-30'} w-1/4 transition-all`} />
                                <div className={`h-full ${marketStatus.regime === 'NEUTRAL' ? 'bg-orange-500 opacity-100' : 'bg-orange-200 opacity-30'} w-1/4 transition-all`} />
                                <div className={`h-full ${marketStatus.regime === 'BULL' ? 'bg-red-500 opacity-100' : 'bg-red-200 opacity-30'} w-1/4 transition-all`} />
                            </div>
                            <div className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                                TAIEX: {marketStatus.indexClose.toFixed(0)} (MA20: {marketStatus.ma20?.toFixed(0) || '-'})
                            </div>
                        </div>

                        {marketStatus.scalingFactor < 1 && (
                            <div className="text-xs bg-amber-50 text-amber-900 px-3 py-2 rounded-lg border border-amber-100 max-w-xs">
                                <span className="font-bold mr-1">⚠️ Risk Control:</span>
                                Market is below optimal trend. Reduce position sizing to protect capital.
                            </div>
                        )}
                    </div>
                ))}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Sector Analysis */}
                    {!isProMode && (
                        <div className="bg-card rounded-xl border shadow-sm p-6 overflow-hidden">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-purple-500" />
                                資金輪動地圖 (Sector Rotation)
                            </h3>
                            <div className="min-h-[300px]">
                                <SectorRotationMap />
                            </div>
                        </div>
                    )}

                    {/* Portfolio Dashboard */}
                    {watchlist.length > 0 && (
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-xl shadow-lg p-6 border border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-green-400" />
                                    我的資產組合 (My Portfolio)
                                </h3>
                                <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-300">
                                    {watchlist.length} Positions
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {watchlist.map((item) => (
                                    <div key={item.stockId} className="bg-white/5 p-3 rounded-lg hover:bg-white/10 transition-colors border border-white/5 hover:border-white/20 cursor-pointer"
                                        onClick={() => {
                                            setSearchQuery(item.stockId);
                                            // Trigger analyze manually? Or just set query
                                            handleAnalyze({ preventDefault: () => { } } as any, item.stockId);
                                        }}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-bold text-sm">{item.name}</div>
                                                <div className="text-xs text-gray-400 font-mono">{item.stockId}</div>
                                            </div>
                                            <div className={`text-sm font-bold ${item.changePercent >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(1)}%
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-end text-xs text-gray-400">
                                            <div>Entry: {item.entryPrice?.toFixed(1) || '-'}</div>
                                            <div>Curr: <span className="text-white font-bold">{item.currentPrice?.toFixed(1)}</span></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom Analysis Search */}
                    <div className="bg-card rounded-xl border shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Zap className="w-5 h-5 text-amber-500" />
                            <h3 className="font-bold text-lg">個股翻倍潛力分析</h3>
                        </div>
                        <form onSubmit={handleAnalyze} className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="輸入股票代號 (如: 2330)"
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isAnalyzing || !searchQuery}
                                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isAnalyzing && <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />}
                                開始分析
                            </button>
                        </form>

                        {analysisError && (
                            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {analysisError}
                            </div>
                        )}

                        {isAnalyzing && <SkeletonAnalysis />}

                        {analysisResult && (
                            <div className="mt-6 p-6 rounded-xl border-2 border-red-500/20 bg-red-50/5 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold">{analysisResult.stockId}</span>
                                            <h4 className="font-bold text-xl">{analysisResult.name}</h4>
                                            <button
                                                onClick={handleAddToWatchlist}
                                                className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isAdded
                                                    ? 'bg-green-100 text-green-700 border-green-200'
                                                    : 'bg-white hover:bg-accent border-gray-200 text-gray-700 shadow-sm'
                                                    }`}
                                            >
                                                {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                                {isAdded ? '已加入自選' : '加入自選'}
                                            </button>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{analysisResult.reason}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-muted-foreground uppercase mb-1 tracking-wider font-bold">翻倍得分</div>
                                        <div className="text-4xl font-black text-red-600">
                                            {(() => {
                                                const rawScore = analysisResult.isETF
                                                    ? (analysisResult.chipStrength / 100 * 50) + (analysisResult.technicalScore / 100 * 50)
                                                    : (Math.min(analysisResult.revenueYoY, 50) / 30 * 40) + (analysisResult.chipStrength / 100 * 30) + (analysisResult.technicalScore / 100 * 30);
                                                return Math.round(Math.min(rawScore, 100));
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <AnalysisMetric
                                        label="營收動能"
                                        value={`+${analysisResult.revenueYoY.toFixed(1)}%`}
                                        status={analysisResult.revenueYoY >= 30 ? 'success' : 'warning'}
                                        desc="目標: YoY > 30%"
                                    />
                                    <AnalysisMetric
                                        label="籌碼強度"
                                        value={`${analysisResult.chipStrength}%`}
                                        status={analysisResult.chipStrength >= 70 ? 'success' : 'warning'}
                                        desc="大戶持續加碼中"
                                    />
                                    <AnalysisMetric
                                        label="技術位階"
                                        value={`${analysisResult.technicalScore}%`}
                                        status={analysisResult.technicalScore >= 75 ? 'success' : 'warning'}
                                        desc="多頭排列檢視"
                                    />
                                    <AnalysisMetric
                                        label="風險係數"
                                        value={`${analysisResult.riskScore || 0}%`}
                                        status={analysisResult.riskLevel === 'High' ? 'danger' : analysisResult.riskLevel === 'Low' ? 'success' : 'warning'}
                                        desc={`波動等級: ${analysisResult.riskLevel || 'Medium'}`}
                                    />
                                    <AnalysisMetric
                                        label="相對強度 (RS)"
                                        value={`${analysisResult.rsScore || 50}`}
                                        status={(analysisResult.rsScore || 50) >= 80 ? 'success' : (analysisResult.rsScore || 50) >= 50 ? 'warning' : 'danger'}
                                        desc="領先大盤指數"
                                    />
                                </div>

                                {analysisResult.backtestEvidence && (
                                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100">
                                        <div className="p-2 bg-amber-100 rounded-full shrink-0">
                                            <Trophy className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-amber-800 text-sm flex items-center gap-2">
                                                歷史回測參考
                                                <span className="text-[10px] bg-amber-200/50 text-amber-700 px-2 py-0.5 rounded-full">過去表現 ≠ 未來結果</span>
                                            </h5>
                                            <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                                                系統回溯過去一年數據發現，此標的曾在 <span className="font-mono font-bold mx-0.5">{analysisResult.backtestEvidence.date}</span> 出現相似進攻訊號，
                                                隨後在 <span className="font-bold">{analysisResult.backtestEvidence.duration}</span> 天內創下
                                                <span className="text-base font-black text-red-600 mx-1">+{analysisResult.backtestEvidence.maxGain.toFixed(1)}%</span>
                                                的回測模擬報酬 (未含實際交易成本與滑價，僅供參考)。
                                            </p>
                                        </div>
                                    </div>


                                )}
                                {sentimentResult && (
                                    <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
                                        <div className="p-2 bg-indigo-100 rounded-full shrink-0">
                                            <Zap className="w-5 h-5 text-indigo-600" />
                                            {/* Using Chart icon as proxy for 'Brain/AI' if Brain not available, or Info */}
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-indigo-800 text-sm flex items-center gap-2">
                                                🤖 AI Analyst Insight
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${sentimentResult.score >= 20 ? 'bg-green-100 text-green-700 border-green-200' :
                                                    sentimentResult.score <= -20 ? 'bg-red-100 text-red-700 border-red-200' :
                                                        'bg-gray-100 text-gray-700 border-gray-200'
                                                    }`}>
                                                    {sentimentResult.label} (Score: {sentimentResult.score})
                                                </span>
                                            </h5>
                                            <p className="text-indigo-900 text-sm mt-1 font-bold">
                                                "{sentimentResult.headline}"
                                            </p>
                                            <ul className="mt-2 space-y-1">
                                                {sentimentResult.factors.map((f: string, idx: number) => (
                                                    <li key={idx} className="text-xs text-indigo-700 flex items-center gap-1.5">
                                                        <div className="w-1 h-1 bg-indigo-400 rounded-full" />
                                                        {f}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                {historyData.length > 0 && (
                                    <div className="mt-6 border-t pt-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-bold flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4 text-primary" />
                                                半年價格趨勢
                                            </h4>
                                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                                技術位階視覺化
                                            </span>
                                        </div>
                                        <div className="bg-muted/30 rounded-xl overflow-hidden">
                                            <InteractiveLineChart
                                                data={historyData}
                                                dataKey="value"
                                                height={200}
                                                color="rgb(220, 38, 38)"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Candidate Machine */}
                    <div className="bg-card rounded-xl border shadow-sm flex flex-col">
                        <div className="p-6 border-b flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Search className="w-5 h-5 text-red-500" />
                                <h3 className="font-bold text-lg">AI 選股候選艙</h3>
                            </div>
                            <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground tracking-tight">基於進攻型篩選邏輯</span>
                        </div>

                        <div className="p-6 flex-1 flex flex-col min-h-[400px]">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <TrendingUp className="w-6 h-6 text-red-600" />
                                    當前候選標的
                                </h3>
                                <div className="flex bg-muted p-1 rounded-lg gap-1 self-start">
                                    <button
                                        onClick={() => setFilterType('all')}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${filterType === 'all' ? 'bg-white shadow-sm font-bold' : 'hover:bg-white/50'}`}
                                    >
                                        全部
                                    </button>
                                    <button
                                        onClick={() => setFilterType('gems')}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${filterType === 'gems' ? 'bg-white shadow-sm font-bold' : 'hover:bg-white/50'}`}
                                    >
                                        💎 潛力珍珠
                                    </button>
                                    <button
                                        onClick={() => setFilterType('momentum')}
                                        className={`px-3 py-1 text-xs rounded-md transition-all ${filterType === 'momentum' ? 'bg-white shadow-sm font-bold' : 'hover:bg-white/50'}`}
                                    >
                                        🚀 強勢發動
                                    </button>
                                </div>
                            </div>

                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
                                    ))}
                                </div>
                            ) : error ? (
                                <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    {error}
                                </div>
                            ) : candidates.filter(s => {
                                if (filterType === 'gems') return s.potentialLabel?.includes('💎');
                                if (filterType === 'momentum') return s.potentialLabel?.includes('🚀');
                                return true;
                            }).length === 0 ? (
                                <div className="text-center py-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center">
                                    <Search className="w-12 h-12 text-muted-foreground opacity-20 mb-4" />
                                    <p className="text-muted-foreground">查無符合條件之標的</p>
                                    <p className="text-xs text-muted-foreground mt-2">嘗試切換不同篩選標籤</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-2">
                                    {candidates.filter(s => {
                                        if (filterType === 'gems') return s.potentialLabel?.includes('💎');
                                        if (filterType === 'momentum') return s.potentialLabel?.includes('🚀');
                                        return true;
                                    }).map((stock) => (
                                        <div
                                            key={stock.stockId}
                                            onClick={() => {
                                                setSearchQuery(stock.stockId);
                                                const event = { preventDefault: () => { } } as React.FormEvent;
                                                handleAnalyze(event, stock.stockId);
                                            }}
                                            className="group p-4 rounded-xl border hover:border-red-500/50 hover:bg-red-50/10 transition-all cursor-pointer bg-card"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xl font-black">{stock.name}</span>
                                                        <span className="text-sm font-mono text-muted-foreground">{stock.stockId}</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stock.potentialLabel?.includes('💎') ? 'bg-amber-100 text-amber-700' :
                                                            stock.potentialLabel?.includes('🚀') ? 'bg-red-600 text-white animate-pulse' :
                                                                stock.potentialLabel?.includes('投信') ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                                                    stock.potentialLabel?.includes('⚠️') ? 'bg-gray-100 text-gray-700' :
                                                                        'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {stock.potentialLabel || '分析中'}
                                                        </span>
                                                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-medium">
                                                            60D 漲幅: {stock.climbPercent?.toFixed(1)}%
                                                        </span>
                                                        {stock.backtestEvidence && (
                                                            <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-200">
                                                                <Trophy className="w-3 h-3" />
                                                                已驗證
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-3">
                                                    <div className="flex flex-col items-end">
                                                        <div className="text-[10px] text-muted-foreground italic font-bold uppercase tracking-wider">Alpha Score</div>
                                                        <div className="text-2xl font-black text-red-600 flex items-center gap-1">
                                                            {stock.revenueYoY >= 30 && stock.climbPercent! < 20 ? '🥇' : ''}
                                                            {stock.revenueYoY.toFixed(0)}
                                                        </div>
                                                    </div>
                                                    <ArrowUpRight className="w-5 h-5 text-red-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                <div className="bg-muted/30 p-2 rounded-lg border border-transparent group-hover:border-red-100 transition-all">
                                                    <div className="text-[9px] text-muted-foreground uppercase font-bold">相對強度 (RS)</div>
                                                    <div className={`text-sm font-semibold ${(stock.rsScore || 50) >= 80 ? 'text-red-600' : ''}`}>{stock.rsScore || 50}</div>
                                                </div>
                                                <div className="bg-muted/30 p-2 rounded-lg border border-transparent group-hover:border-red-100 transition-all flex flex-col justify-between">
                                                    <div>
                                                        <div className="text-[9px] text-muted-foreground uppercase font-bold">籌碼強度</div>
                                                        <div className="text-sm font-semibold">{stock.chipStrength}%</div>
                                                    </div>
                                                    <div className="mt-1">
                                                        <ConcentrationSparkline data={stock.concentrationHistory || []} />
                                                    </div>
                                                </div>
                                                <div className="bg-muted/30 p-2 rounded-lg border border-transparent group-hover:border-red-100 transition-all">
                                                    <div className="text-[9px] text-muted-foreground uppercase font-bold">技術位階</div>
                                                    <div className="text-sm font-semibold">{stock.technicalScore}%</div>
                                                </div>
                                                {/* Kelly Position Sizing Display */}
                                                <div className={`p-2 rounded-lg border transition-all ${stock.kellyRisk === 'EXTREME' ? 'bg-red-100 border-red-200' :
                                                    stock.kellyRisk === 'HIGH' ? 'bg-amber-50 border-amber-200' :
                                                        'bg-blue-50 border-blue-200'
                                                    }`}>
                                                    <div className="text-[9px] text-muted-foreground uppercase font-bold flex items-center justify-between">
                                                        建議倉位
                                                        <span className="text-[8px] opacity-70">Kelly</span>
                                                    </div>
                                                    <div className="text-sm font-bold flex items-baseline gap-1">
                                                        {stock.suggestedPositionSize ?? 0}
                                                        <span className="text-xs font-normal opacity-80">張</span>
                                                        <span className="text-[10px] ml-auto font-mono opacity-50">
                                                            ({stock.kellyPositionPct ?? 0}%)
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Chip Anomaly Alert */}
                                            {stock.anomaly && (
                                                <div className={`mt-3 p-2 rounded-lg text-xs font-bold border flex items-center gap-2 ${stock.anomaly.severity === 'HIGH' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                                    stock.anomaly.severity === 'MEDIUM' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                                        'bg-gray-100 text-gray-800 border-gray-200'
                                                    }`}>
                                                    <Zap className="w-3 h-3 fill-current" />
                                                    <span>
                                                        {stock.anomaly.type === 'CONCENTRATION_SURGE' ? '籌碼急速集中' :
                                                            stock.anomaly.type === 'TRUST_ACCUMULATION' ? '投信連續認養' :
                                                                stock.anomaly.description}
                                                    </span>
                                                    <span className="ml-auto opacity-70 font-normal">
                                                        Score: {stock.anomaly.score}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground border-t pt-2 border-dashed">
                                                <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 col-span-2">
                                                    <Info className="w-3.5 h-3.5 text-red-400" />
                                                    {stock.reason}
                                                </div>
                                                <div className="flex items-center gap-1.5 font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded">
                                                    <span>Risk: ${stock.riskPerShare?.toFixed(1) ?? '-'}/share</span>
                                                </div>
                                                {stock.kellyReasoning && (
                                                    <div className="col-span-2 text-[10px] text-blue-600/80 italic mt-1 bg-blue-50/50 p-1 rounded">
                                                        "{stock.kellyReasoning}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Strategy Sidebar */}
                <div className="space-y-6">
                    {/* Backtest Dashboard */}
                    <BacktestDashboard />

                    <div className="bg-card rounded-xl border p-6 shadow-sm">
                        <h4 className="font-bold mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-green-500" />
                            進攻型交易規則
                        </h4>
                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <CheckCircle2 className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <span className="font-bold block mb-1">營收炸裂</span>
                                    單月營收 YoY &gt; 30% 且趨勢向上。
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <CheckCircle2 className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <span className="font-bold block mb-1">法人認同</span>
                                    三大法人（特別是投信）連續買超 3-5 日。
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <CheckCircle2 className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <span className="font-bold block mb-1">多頭發散</span>
                                    股價站穩 MA20 且 MA20 &gt; MA60。
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <span className="font-bold block mb-1 text-red-600">停損守則</span>
                                    收盤跌破 MA20 或 MA60 必須無條件減碼。
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <span className="font-bold block mb-1 text-amber-600">位階控管</span>
                                    單一標的投入不超過總資產 30%，保留三次打擊機會。
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-red-50/80 rounded-xl p-6 border-2 border-red-100 shadow-sm relative overflow-hidden backdrop-blur-sm">
                        <div className="absolute -top-4 -right-4 opacity-5">
                            <TrendingDown className="w-24 h-24 text-red-600" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3 text-red-700">
                                <TrendingDown className="w-5 h-5" />
                                <h4 className="font-bold text-sm">AI 實戰回測警示</h4>
                            </div>
                            <p className="text-xs text-red-600 leading-relaxed font-medium">
                                此策略具有高波動特性。根據歷史模擬，單次標的可能出現較大回落。
                                建議嚴格遵守停損守則。
                            </p>
                        </div>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-6 border border-dashed text-center">
                        <TrendingUp className="w-10 h-10 text-primary/40 mx-auto mb-3" />
                        <h5 className="font-bold text-sm">複利的力量</h5>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                            翻倍目標需在嚴格風控下長期累積複利。年化 100% 報酬在現實中極為罕見，請以合理預期管理風險。
840.                         </p>
841.                         <p className="text-[10px] text-muted-foreground/60 mt-1">
842.                             ⚠️ 所有回測均為歷史模擬，不構成投資建議。實際交易涉及成本、滑價、流動性等風險。
                        </p>
                    </div>
                </div>
            </div>
        </div >
    );
}

function AnalysisMetric({ label, value, status, desc }: { label: string, value: string, status: 'success' | 'warning' | 'danger', desc: string }) {
    return (
        <div className="bg-background border rounded-lg p-3">
            <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{label}</div>
            <div className={`text-xl font-bold mb-1 ${status === 'success' ? 'text-green-600' : status === 'warning' ? 'text-amber-600' : 'text-red-600'}`}>
                {value}
            </div>
            <div className="text-[10px] text-muted-foreground">{desc}</div>
        </div>
    );
}

function SkeletonAnalysis() {
    return (
        <div className="mt-6 p-6 rounded-xl border-2 border-muted bg-muted/5 animate-pulse">
            <div className="flex items-center justify-between mb-6">
                <div className="space-y-2">
                    <div className="h-6 w-48 bg-muted rounded" />
                    <div className="h-4 w-64 bg-muted rounded" />
                </div>
                <div className="text-right space-y-2">
                    <div className="h-3 w-16 bg-muted rounded ml-auto" />
                    <div className="h-10 w-24 bg-muted rounded ml-auto" />
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-20 bg-muted rounded-lg" />
                ))}
            </div>
            <div className="mt-6 pt-6 border-t">
                <div className="h-4 w-32 bg-muted rounded mb-4" />
                <div className="h-40 bg-muted rounded-xl" />
            </div>
        </div>
    );
}
