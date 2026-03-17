
import React from 'react';
import { RealTimeQuote } from '@/lib/services/RealTimeService';

interface OrderBookProps {
    quote: RealTimeQuote;
}

export function OrderBook({ quote }: OrderBookProps) {
    if (!quote.bestAskPrice || !quote.bestBidPrice) return <div className="text-slate-500 text-xs text-center p-4">暫無五檔報價</div>;

    // Calculate max volume for relative bars
    const maxVol = Math.max(
        ...quote.bestAskVolume,
        ...quote.bestBidVolume
    ) || 1;

    // Asks need to be reversed to show lowest ask at bottom (closest to spread)
    // Actually, usually Order Book is:
    // Ask 5 ...
    // Ask 1 (Best)
    // --- Spread ---
    // Bid 1 (Best)
    // Bid 5 ...

    // Incoming arrays are [Best, 2nd, 3rd...]
    // So for Asks, we want to render reversed (5th, 4th, ... Best)

    // Helper to create rows
    const renderRow = (price: number, vol: number, type: 'ask' | 'bid') => {
        const percent = (vol / maxVol) * 100;
        const colorClass = type === 'ask' ? 'bg-red-500/20' : 'bg-green-500/20';
        const textColor = type === 'ask' ? 'text-red-400' : 'text-green-400';

        return (
            <div className="flex items-center text-xs relative h-6 mb-0.5" key={`${type}-${price}`}>
                {/* Volume Bar Background */}
                <div
                    className={`absolute top-0 ${type === 'ask' ? 'right-0' : 'left-0'} h-full transition-all duration-300 ${colorClass}`}
                    style={{ width: `${percent}%` }}
                />

                {/* Content */}
                <div className="relative w-full flex justify-between px-2 z-10">
                    <span className={`font-mono font-bold ${textColor}`}>
                        {price.toFixed(2)}
                    </span>
                    <span className="text-slate-300 font-mono">
                        {vol}
                    </span>
                </div>
            </div>
        );
    };

    // Prepare lists
    // Asks: Show 5, 4, 3, 2, 1 (Best at bottom)
    const asks = quote.bestAskPrice.map((p, i) => ({ p, v: quote.bestAskVolume[i] })).reverse();
    // Bids: Show 1, 2, 3, 4, 5 (Best at top)
    const bids = quote.bestBidPrice.map((p, i) => ({ p, v: quote.bestBidVolume[i] }));

    return (
        <div className="w-full bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
            <h4 className="text-[10px] uppercase text-slate-500 font-bold mb-2 tracking-wider text-center">Order Book (Microstructure)</h4>

            {/* Asks */}
            <div className="flex flex-col justify-end">
                {asks.map((item, i) => renderRow(item.p, item.v, 'ask'))}
            </div>

            {/* Spread / Current Price Indicator */}
            <div className="py-2 flex justify-center items-center border-y border-slate-700/50 my-1 bg-slate-800/50">
                <span className={`text-lg font-bold font-mono ${quote.tradePrice > quote.open ? 'text-red-400' : quote.tradePrice < quote.open ? 'text-green-400' : 'text-slate-200'}`}>
                    {quote.tradePrice.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 ml-2">
                    Last
                </span>
            </div>

            {/* Bids */}
            <div className="flex flex-col">
                {bids.map((item, i) => renderRow(item.p, item.v, 'bid'))}
            </div>

            {/* Imbalance Indicator */}
            <div className="mt-3 text-[10px] flex justify-between text-slate-400 px-1">
                <div>Total Bid: <span className="text-green-400 font-bold">{quote.bestBidVolume.reduce((a, b) => a + b, 0)}</span></div>
                <div>Total Ask: <span className="text-red-400 font-bold">{quote.bestAskVolume.reduce((a, b) => a + b, 0)}</span></div>
            </div>
        </div>
    );
}
