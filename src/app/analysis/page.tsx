'use client';

import React, { useEffect, useState } from 'react';
import { HybridPrediction } from '@/components/analysis/HybridPrediction';
import { SectorRotationMap } from '@/components/analysis/SectorRotationMap';
import { SentimentAnalysis } from '@/components/analysis/SentimentAnalysis';
import { TechnicalIndicatorPanel } from '@/components/analysis/TechnicalIndicatorPanel';
import { calculateAllIndicators } from '@/lib/technicalIndicators';
import { StockDataWithIndicators } from '@/types/stock';
import { Search } from 'lucide-react';

interface StockHistoryPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface StockHistoryResponse {
    data: StockHistoryPoint[];
}

export default function AnalysisPage() {
    const [symbol, setSymbol] = useState('2330'); // Default to TSMC
    const [inputSymbol, setInputSymbol] = useState('2330');
    const [data, setData] = useState<StockDataWithIndicators[]>([]);
    const [loading, setLoading] = useState(true);
    const [, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch 6 months of history
                const res = await fetch(`/api/stocks/${symbol}/history?months=6`);
                if (!res.ok) throw new Error('Failed to fetch data');

                const json: StockHistoryResponse = await res.json();
                const historyData = json.data.map((item) => ({
                    date: item.date,
                    open: item.open,
                    high: item.high,
                    low: item.low,
                    close: item.close,
                    volume: item.volume,
                }));

                if (historyData.length > 0) {
                    const withIndicators = calculateAllIndicators(historyData);
                    setData(withIndicators);
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load stock data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [symbol]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSymbol(inputSymbol);
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-20">
            {/* Header / Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-2">
                        🧠 AI 智能分析師 (AI Analyst)
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Deep dive into any stock with Institutional-Grade AI Models.
                    </p>
                </div>

                <form onSubmit={handleSearch} className="flex items-center gap-2 bg-white p-1.5 rounded-xl border shadow-sm">
                    <Search className="w-5 h-5 text-slate-400 ml-2" />
                    <input
                        type="text"
                        value={inputSymbol}
                        onChange={(e) => setInputSymbol(e.target.value)}
                        className="border-none outline-none bg-transparent px-2 py-1 w-32 font-bold uppercase placeholder:font-normal"
                        placeholder="Stock Code"
                    />
                    <button
                        type="submit"
                        className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all"
                    >
                        Analyze
                    </button>
                </form>
            </div>

            {/* Main Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: AI Logic */}
                <div className="lg:col-span-2 space-y-8">
                    {/* 1. Hybrid Prediction Engine */}
                    <HybridPrediction symbol={symbol} />

                    {/* 2. Technical Chart */}
                    {data.length > 0 ? (
                        <TechnicalIndicatorPanel data={data} symbol={symbol} />
                    ) : (
                        <div className="p-12 text-center text-muted-foreground border rounded-2xl border-dashed">
                            {loading ? 'Loading Market Data...' : `No market data available for ${symbol}`}
                        </div>
                    )}
                </div>

                {/* Right Column: Context */}
                <div className="space-y-8">
                    {/* 3. Market Sentiment Context */}
                    <div className="relative">
                        <div className="absolute -left-4 top-4 w-1 h-8 bg-orange-500 rounded-full" />
                        <h3 className="text-xl font-bold mb-4 ml-2">Market Context</h3>
                        <SentimentAnalysis />
                    </div>

                    {/* 4. Sector Context */}
                    <div className="relative">
                        <div className="absolute -left-4 top-4 w-1 h-8 bg-purple-500 rounded-full" />
                        <h3 className="text-xl font-bold mb-4 ml-2">Sector Flow</h3>
                        <SectorRotationMap />
                    </div>
                </div>
            </div>
        </div>
    );
}
