'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Stock } from '@/lib/mockData';
import {
    PortfolioItem,
    QuoteSnapshotViewModel,
    DbWatchlistResponse,
    WatchlistRowViewModel,
    PortfolioSummary,
    SortConfig,
    WATCHLIST_VERSION,
    DEFAULT_WATCHLIST,
    ScreeningResult,
} from '@/types/watchlist';

const LS_KEY = 'tw-stock-watchlist';
const LS_VERSION_KEY = 'tw-stock-watchlist-version';

// ─── localStorage persistence ───────────────────────────────────

function loadFromStorage(): PortfolioItem[] {
    try {
        const savedVersion = localStorage.getItem(LS_VERSION_KEY);
        const saved = localStorage.getItem(LS_KEY);
        if (savedVersion !== WATCHLIST_VERSION || !saved) {
            localStorage.setItem(LS_KEY, JSON.stringify(DEFAULT_WATCHLIST));
            localStorage.setItem(LS_VERSION_KEY, WATCHLIST_VERSION);
            return DEFAULT_WATCHLIST;
        }
        return JSON.parse(saved);
    } catch {
        return DEFAULT_WATCHLIST;
    }
}

function saveToStorage(items: PortfolioItem[]) {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
}

// ─── DB quote overlay ───────────────────────────────────────────

async function fetchDbQuotes(): Promise<{ map: Record<string, QuoteSnapshotViewModel>; lastUpdated: string | null }> {
    try {
        const res = await fetch('/api/watchlist');
        const data: DbWatchlistResponse = await res.json();
        const map: Record<string, QuoteSnapshotViewModel> = {};
        data.data?.forEach(item => { map[item.stockId] = item; });
        return { map, lastUpdated: data.last_updated };
    } catch {
        return { map: {}, lastUpdated: null };
    }
}

// ─── Sorting / filtering ────────────────────────────────────────

function filterAndSort(
    items: PortfolioItem[],
    query: string,
    sort: SortConfig,
    analysisMap: Record<string, ScreeningResult>,
): PortfolioItem[] {
    let filtered = items;
    if (query.trim()) {
        const q = query.toLowerCase();
        filtered = items.filter(s =>
            s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
        );
    }
    if (!sort.key) return filtered;

    return [...filtered].sort((a, b) => {
        let va: number, vb: number;
        switch (sort.key) {
            case 'symbol':
                return sort.dir === 'asc'
                    ? a.symbol.localeCompare(b.symbol)
                    : b.symbol.localeCompare(a.symbol);
            case 'price': va = a.price || 0; vb = b.price || 0; break;
            case 'changePercent': va = a.changePercent || 0; vb = b.changePercent || 0; break;
            case 'volume': va = a.volume || 0; vb = b.volume || 0; break;
            case 'score':
                va = analysisMap[a.symbol]?.calculatedScore || 0;
                vb = analysisMap[b.symbol]?.calculatedScore || 0;
                break;
            default: return 0;
        }
        return sort.dir === 'asc' ? va - vb : vb - va;
    });
}

// ─── Row view model builder ─────────────────────────────────────

function buildRow(
    stock: PortfolioItem,
    analysis: ScreeningResult | null,
    dbQuote: QuoteSnapshotViewModel | null,
): WatchlistRowViewModel {
    const hasHoldings = !!(stock.avgCost && stock.quantity);
    const marketValue = hasHoldings ? stock.price * stock.quantity! : 0;
    const costBasis = hasHoldings ? stock.avgCost! * stock.quantity! : 0;
    const profitLoss = marketValue - costBasis;
    const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

    return {
        symbol: stock.symbol,
        name: stock.name,
        price: analysis?.closePrice || stock.price,
        change: stock.change,
        changePercent: analysis?.priceChangePercent ?? stock.changePercent,
        volume: stock.volume,
        avgCost: stock.avgCost,
        quantity: stock.quantity,
        weeklyChange: dbQuote?.hasQuoteData ? dbQuote.weeklyChange : null,
        volumeChange: dbQuote?.hasQuoteData ? dbQuote.volumeChange : null,
        hasQuoteData: dbQuote?.hasQuoteData ?? false,
        analysis,
        marketValue,
        costBasis,
        profitLoss,
        profitLossPercent,
        hasHoldings,
    };
}

// ─── Main hook ──────────────────────────────────────────────────

export function useWatchlistData() {
    const [watchlist, setWatchlist] = useState<PortfolioItem[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', dir: 'desc' });

    // DB overlay
    const [dbQuotes, setDbQuotes] = useState<Record<string, QuoteSnapshotViewModel>>({});
    const [dbLastUpdated, setDbLastUpdated] = useState<string | null>(null);

    // Analysis overlay
    const [analysisMap, setAnalysisMap] = useState<Record<string, ScreeningResult>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // ── Init ──
    useEffect(() => {
        setWatchlist(loadFromStorage());
        setIsLoaded(true);
    }, []);

    // ── Persist ──
    useEffect(() => {
        if (isLoaded) saveToStorage(watchlist);
    }, [watchlist, isLoaded]);

    // ── DB quotes ──
    useEffect(() => {
        fetchDbQuotes().then(({ map, lastUpdated }) => {
            setDbQuotes(map);
            setDbLastUpdated(lastUpdated);
        });
    }, []);

    // ── Analysis fetch ──
    const refreshAnalysis = useCallback(async () => {
        if (!isLoaded || watchlist.length === 0) return;
        setIsAnalyzing(true);
        const newData: Record<string, ScreeningResult> = {};

        const promises = watchlist.map(async (stock) => {
            try {
                const res = await fetch('/api/strategy/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: stock.symbol }),
                });
                if (res.ok) {
                    const analysis: ScreeningResult = await res.json();
                    // Use server-provided calculatedScore if available, otherwise compute client-side
                    if (analysis.calculatedScore == null) {
                        const revYoY = analysis.revenueYoY ?? 0;
                        const rawScore = analysis.isETF
                            ? (analysis.chipStrength / 100 * 50) + (analysis.technicalScore / 100 * 50)
                            : (Math.min(revYoY, 50) / 30 * 40) + (analysis.chipStrength / 100 * 30) + (analysis.technicalScore / 100 * 30);
                        analysis.calculatedScore = Math.round(Math.min(rawScore, 100));
                    }
                    newData[stock.symbol] = analysis;
                }
            } catch (e) {
                console.error(`Failed to analyze ${stock.symbol}`, e);
            }
        });

        await Promise.all(promises);
        setAnalysisMap(newData);

        // Sync real prices back
        setWatchlist(prev => prev.map(s => {
            if (newData[s.symbol]) {
                return { ...s, price: newData[s.symbol].closePrice, changePercent: newData[s.symbol].priceChangePercent };
            }
            return s;
        }));

        setIsAnalyzing(false);
    }, [watchlist.length, isLoaded]);

    // Auto-fetch on mount
    useEffect(() => { refreshAnalysis(); }, [refreshAnalysis]);

    // ── CRUD ──
    const addStock = useCallback((stock: Stock) => {
        setWatchlist(prev => {
            if (prev.find(s => s.symbol === stock.symbol)) return prev;
            return [...prev, stock];
        });
    }, []);

    const removeStock = useCallback((symbol: string) => {
        setWatchlist(prev => prev.filter(s => s.symbol !== symbol));
    }, []);

    const updateHoldings = useCallback((symbol: string, avgCost: number, quantity: number) => {
        setWatchlist(prev => prev.map(item =>
            item.symbol === symbol ? { ...item, avgCost, quantity } : item,
        ));
    }, []);

    // ── Sort toggle ──
    const toggleSort = useCallback((key: string) => {
        setSortConfig(prev => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
        }));
    }, []);

    // ── Derived: sorted rows ──
    const sortedItems = useMemo(
        () => filterAndSort(watchlist, searchQuery, sortConfig, analysisMap),
        [watchlist, searchQuery, sortConfig, analysisMap],
    );

    // ── Derived: view model rows ──
    const rows: WatchlistRowViewModel[] = useMemo(
        () => sortedItems.map(s => buildRow(s, analysisMap[s.symbol] || null, dbQuotes[s.symbol] || null)),
        [sortedItems, analysisMap, dbQuotes],
    );

    // ── Derived: portfolio summary ──
    const portfolioSummary: PortfolioSummary = useMemo(() => {
        const totalValue = watchlist.reduce((sum, item) => sum + (item.price * (item.quantity || 0)), 0);
        const totalCost = watchlist.reduce((sum, item) => sum + ((item.avgCost || 0) * (item.quantity || 0)), 0);
        const totalPL = totalValue - totalCost;
        return {
            totalValue,
            totalCost,
            totalPL,
            totalPLPercent: totalCost > 0 ? (totalPL / totalCost) * 100 : 0,
            stockCount: watchlist.length,
            attackCount: Object.values(analysisMap).filter(d => (d.calculatedScore || 0) >= 90).length,
        };
    }, [watchlist, analysisMap]);

    return {
        // Raw list (for dialog callbacks that need PortfolioItem)
        watchlist,
        isLoaded,
        // Sorted & enriched view-model rows
        rows,
        // State
        searchQuery,
        setSearchQuery,
        sortConfig,
        toggleSort,
        // Overlays
        analysisMap,
        isAnalyzing,
        dbLastUpdated,
        // Portfolio
        portfolioSummary,
        // Actions
        addStock,
        removeStock,
        updateHoldings,
        refreshAnalysis,
    };
}
