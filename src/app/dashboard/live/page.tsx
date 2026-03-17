
'use client';

import React, { useState, useEffect } from 'react';
import { LiveStockCardControlled } from '@/components/realtime/LiveStockCard';
import { RealTimeQuote } from '@/lib/services/RealTimeService';
import { CloudLightning, RefreshCw, Wifi, WifiOff } from 'lucide-react';

const WATCHLIST = ['2330', '2317', '2454', '2603', '2881', '6531', '2408', '2344'];
// TSMC, Foxconn, MediaTek, Evergreen, Fubon, AP Memory, Nanya, Winbond

export default function LiveDashboardPage() {
    const [quotes, setQuotes] = useState<Record<string, RealTimeQuote>>({});
    const [keyLevels, setKeyLevels] = useState<Record<string, any>>({});
    const [tags, setTags] = useState<Record<string, string[]>>({}); // Store tags keyed by stock code
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isPolling, setIsPolling] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchLevelsAndTags = async () => {
        const codes = WATCHLIST.join(',');
        try {
            // 1. Levels
            const resL = await fetch(`/api/analysis/key-levels?codes=${codes}`);
            if (resL.ok) {
                const json = await resL.json();
                if (json.success) setKeyLevels(json.data);
            }
            // 2. Tags (New)
            const resT = await fetch(`/api/analysis/tags?codes=${codes}`);
            if (resT.ok) {
                const json = await resT.json();
                if (json.success) setTags(json.data);
            }
        } catch (e) { console.error("Aux fetch failed", e); }
    };

    const fetchQuotes = async () => {
        try {
            const codes = WATCHLIST.join(',');
            const res = await fetch(`/api/realtime/quotes?codes=${codes}`);
            if (!res.ok) throw new Error('API Failed');

            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                // Map array to object for easy lookup
                const newQuotes: Record<string, RealTimeQuote> = {};
                json.data.forEach((q: RealTimeQuote) => {
                    newQuotes[q.code] = q;
                });
                setQuotes(newQuotes);
                setLastUpdated(new Date());
                setError(null);
            }
        } catch (err) {
            console.error(err);
            setError('Connection Lost');
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        // Initial fetch
        fetchLevelsAndTags();
        fetchQuotes();

        let interval: NodeJS.Timeout;
        if (isPolling) {
            interval = setInterval(fetchQuotes, 5000); // 5s refresh
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isPolling]);

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <CloudLightning className="text-yellow-400" />
                        Live Market Monitor
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full border border-red-500/50">
                            LIVE
                        </span>
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Real-time order book and price action monitor (TWSE MIS)
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        {isPolling ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-slate-600" />}
                        <span className="font-mono">
                            {lastUpdated ? lastUpdated.toLocaleTimeString() : '--:--:--'}
                        </span>
                    </div>

                    <button
                        onClick={() => setIsPolling(!isPolling)}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${isPolling ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}
                    >
                        <RefreshCw size={14} className={isPolling ? 'animate-spin-slow' : ''} />
                        {isPolling ? 'Polling ON' : 'Paused'}
                    </button>
                </div>
            </div>

            {/* Grid */}
            {isLoading && Object.keys(quotes).length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {WATCHLIST.map(id => (
                        <div key={id} className="bg-slate-800/50 h-64 rounded-xl animate-pulse"></div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {WATCHLIST.map(code => (
                        <LiveStockCardControlled
                            key={code}
                            quote={quotes[code] || null}
                            keyLevels={keyLevels[code]}
                            tags={tags[code]}
                        />
                    ))}
                </div>
            )}

            {error && (
                <div className="fixed bottom-6 right-6 bg-red-900/90 text-white px-4 py-3 rounded-lg shadow-xl border border-red-700 animate-bounce">
                    ⚠️ {error} - Retrying...
                </div>
            )}
        </div>
    );
}
