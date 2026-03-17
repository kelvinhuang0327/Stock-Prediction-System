
import React, { useEffect, useState } from 'react';
import { RealTimeQuote } from '@/lib/services/RealTimeService';
import { OrderBook } from './OrderBook';
import { ArrowUp, ArrowDown, Activity, Zap } from 'lucide-react';

interface KeyLevels {
    pivot: number;
    r1: number;
    s1: number;
    ma5: number | null;
    ma20: number | null;
    ma60: number | null;
}

interface LiveStockCardProps {
    symbol: string;
    initialQuote?: RealTimeQuote;
}

export function LiveStockCard({ symbol, initialQuote }: LiveStockCardProps) {
    // Determine color based on open price (Taiwan: Red is Up, Green is Down)
    // If no open price (e.g. pre-market), default to gray.

    // Note: In a real app we'd fetch inside here or receive props. 
    // To minimize API calls, the parent page should fetch batch and pass props.
    // So this component will assume it receives the LATEST quote via props.
    // Let's refactor slightly to accept 'quote' directly, or handle SWR here?
    // Batch fetching is better. Let's make this controlled.

    return null; // Placeholder to switch to Controlled Pattern
}

// Redefine as presentation component mostly
export function LiveStockCardControlled({ quote, keyLevels, tags }: { quote: RealTimeQuote | null, keyLevels?: KeyLevels, tags?: string[] }) {
    if (!quote) return (
        <div className="bg-slate-800 rounded-xl p-6 animate-pulse flex flex-col gap-4">
            <div className="h-6 w-24 bg-slate-700 rounded"></div>
            <div className="h-10 w-32 bg-slate-700 rounded"></div>
            <div className="flex-1 bg-slate-700 rounded opacity-20"></div>
        </div>
    );

    const isUp = quote.tradePrice > quote.open;
    const isDown = quote.tradePrice < quote.open;
    const colorClass = isUp ? 'text-red-400' : isDown ? 'text-green-400' : 'text-slate-200';
    const bgClass = isUp ? 'from-red-500/10' : isDown ? 'from-green-500/10' : 'from-slate-500/10';

    // Calculate Change (approximate if API doesn't give explicit change val, we use Open as reference)
    // MIS API doesn't give "change" directly in simple fields often, but we have 'o' and 'y' (yesterday).
    // Let's assume we can compare to 'y' (Yesterday Close) usually available in MIS 'y' field?
    // RealTimeService parses 'y' into nothing currently? Let's check RealTimeService.ts... 
    // It doesn't returning 'y' explicitly in the interface.
    // Let's use 'open' as reference for intraday change for now.

    const changeAmount = quote.tradePrice - quote.open;
    const changePercent = (changeAmount / quote.open) * 100;

    return (
        <div className={`relative overflow-hidden rounded-xl border border-slate-700 bg-gradient-to-br ${bgClass} to-slate-900 backdrop-blur-sm p-5 transition-all hover:border-slate-500/50 shadow-lg`}>

            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                        {quote.name}
                        <span className="text-sm font-normal text-slate-400 font-mono">{quote.code}</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Activity size={12} /> Vol: {quote.accumulatedVolume.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                            {quote.tradeTime}
                        </span>
                    </div>
                </div>
                <div className={`text-right ${colorClass}`}>
                    <div className="text-3xl font-bold font-mono tracking-tight flex items-center justify-end">
                        {quote.isWhale && <span className="animate-bounce mr-2 text-2xl" title="Whale Alert: >50 Lots">🐋</span>}
                        {isUp && <ArrowUp size={24} className="mr-1" />}
                        {isDown && <ArrowDown size={24} className="mr-1" />}
                        {quote.tradePrice.toLocaleString()}
                    </div>
                    <div className="text-sm font-bold font-mono">
                        {changeAmount > 0 ? '+' : ''}{changeAmount.toFixed(2)} ({changePercent.toFixed(2)}%)
                    </div>
                </div>
            </div>

            {/* AI Signal: Order Imbalance Pressure Bar */}
            {quote.bidAskImbalance !== undefined && (
                <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Sell Pressure</span>
                        <span className={quote.bidAskImbalance > 0 ? 'text-green-400' : 'text-red-400'}>
                            {Math.abs(quote.bidAskImbalance * 100).toFixed(0)}% {quote.bidAskImbalance > 0 ? 'Bullish' : 'Bearish'}
                        </span>
                        <span>Buy Pressure</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden flex">
                        {/* Red Part (Sell Pressure) */}
                        <div
                            className="h-full bg-red-500/50 transition-all duration-300"
                            style={{ width: `${50 - (quote.bidAskImbalance * 50)}%` }}
                        />
                        {/* Green Part (Buy Pressure) */}
                        <div
                            className="h-full bg-green-500/50 transition-all duration-300 flex-1"
                        />
                    </div>
                </div>
            )}

            {/* Depth Chart / Order Book */}
            <div className="mt-4">
                <OrderBook quote={quote} />
            </div>

        </div>
    );
}
