'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Stock } from '@/lib/mockData';
import {
    PortfolioItem,
    DbWatchlistItem,
    DbWatchlistResponse,
    WatchlistRowViewModel,
    PortfolioSummary,
    SortConfig,
    MigrationStatus,
    MigrationResult,
    WATCHLIST_VERSION,
    DEFAULT_WATCHLIST,
    ScreeningResult,
} from '@/types/watchlist';

const LS_KEY = 'tw-stock-watchlist';
const LS_VERSION_KEY = 'tw-stock-watchlist-version';
const LS_MIGRATED_KEY = 'tw-stock-watchlist-migrated';

// ─── localStorage helpers ───────────────────────────────────────

function loadFromStorage(): PortfolioItem[] {
    try {
        const saved = localStorage.getItem(LS_KEY);
        if (!saved) return [];
        return JSON.parse(saved);
    } catch {
        return [];
    }
}

function saveToStorage(items: PortfolioItem[]) {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
    localStorage.setItem(LS_VERSION_KEY, WATCHLIST_VERSION);
}

function isMigrationDone(): boolean {
    try {
        return localStorage.getItem(LS_MIGRATED_KEY) === 'true';
    } catch {
        return false;
    }
}

function markMigrationDone() {
    try {
        localStorage.setItem(LS_MIGRATED_KEY, 'true');
    } catch { /* ignore */ }
}

// ─── DB API helpers ─────────────────────────────────────────────

async function fetchDbWatchlist(): Promise<{ items: DbWatchlistItem[]; lastUpdated: string | null }> {
    try {
        const res = await fetch('/api/watchlist');
        if (!res.ok) throw new Error(`${res.status}`);
        const data: DbWatchlistResponse = await res.json();
        return { items: data.data || [], lastUpdated: data.last_updated };
    } catch {
        return { items: [], lastUpdated: null };
    }
}

async function addToDb(stockId: string, entryPrice?: number, quantity?: number, note?: string) {
    const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockId, entryPrice: entryPrice ?? null, quantity: quantity ?? null, note: note ?? null }),
    });
    if (!res.ok) throw new Error('Failed to add');
    return res.json();
}

async function updateInDb(stockId: string, data: { entryPrice?: number; quantity?: number; note?: string }) {
    const res = await fetch('/api/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockId, ...data }),
    });
    if (!res.ok) throw new Error('Failed to update');
    return res.json();
}

async function removeFromDb(stockId: string) {
    const res = await fetch(`/api/watchlist/${stockId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    return res.json();
}

async function bulkMigrateToDb(items: { stockId: string; entryPrice?: number; quantity?: number }[]): Promise<MigrationResult> {
    const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
    });
    return res.json();
}

// ─── Row view model builder ─────────────────────────────────────

function buildRowFromDb(
    dbItem: DbWatchlistItem,
    analysis: ScreeningResult | null,
): WatchlistRowViewModel {
    const avgCost = dbItem.entryPrice ?? undefined;
    const quantity = dbItem.quantity ?? undefined;
    const hasHoldings = !!(avgCost && quantity);
    const price = analysis?.closePrice || dbItem.currentPrice;
    const marketValue = hasHoldings ? price * quantity! : 0;
    const costBasis = hasHoldings ? avgCost! * quantity! : 0;
    const profitLoss = marketValue - costBasis;
    const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

    return {
        symbol: dbItem.stockId,
        name: dbItem.name,
        price,
        change: 0,
        changePercent: analysis?.priceChangePercent ?? dbItem.dailyChange,
        volume: dbItem.volume,
        avgCost,
        quantity,
        weeklyChange: dbItem.hasQuoteData ? dbItem.weeklyChange : null,
        volumeChange: dbItem.hasQuoteData ? dbItem.volumeChange : null,
        hasQuoteData: dbItem.hasQuoteData,
        analysis,
        marketValue,
        costBasis,
        profitLoss,
        profitLossPercent,
        hasHoldings,
    };
}

function buildRowFromLocal(
    stock: PortfolioItem,
    analysis: ScreeningResult | null,
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
        weeklyChange: null,
        volumeChange: null,
        hasQuoteData: false,
        analysis,
        marketValue,
        costBasis,
        profitLoss,
        profitLossPercent,
        hasHoldings,
    };
}

// ─── Sorting / filtering ────────────────────────────────────────

function filterAndSortRows(
    rows: WatchlistRowViewModel[],
    query: string,
    sort: SortConfig,
): WatchlistRowViewModel[] {
    let filtered = rows;
    if (query.trim()) {
        const q = query.toLowerCase();
        filtered = rows.filter(r =>
            r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
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
                va = a.analysis?.calculatedScore || 0;
                vb = b.analysis?.calculatedScore || 0;
                break;
            case 'alphaScore':
                va = a.alphaScore || 0;
                vb = b.alphaScore || 0;
                break;
            default: return 0;
        }
        return sort.dir === 'asc' ? va - vb : vb - va;
    });
}

// ─── Main hook ──────────────────────────────────────────────────

export function useWatchlistData() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', dir: 'desc' });

    // Data sources
    const [dbItems, setDbItems] = useState<DbWatchlistItem[]>([]);
    const [localItems, setLocalItems] = useState<PortfolioItem[]>([]);
    const [useDbSource, setUseDbSource] = useState(false);
    const [dbLastUpdated, setDbLastUpdated] = useState<string | null>(null);

    // Migration
    const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>('idle');
    const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

    // Analysis overlay
    const [analysisMap, setAnalysisMap] = useState<Record<string, ScreeningResult>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Alpha fusion overlay
    const [alphaMap, setAlphaMap] = useState<Record<string, { alphaScore: number; recommendationBucket: string; confidence: number }>>({});

    // ── Init: try DB first, fallback to localStorage ──
    useEffect(() => {
        let cancelled = false;

        async function init() {
            // 1. Try DB
            const { items: dbData, lastUpdated } = await fetchDbWatchlist();

            if (cancelled) return;

            if (dbData.length > 0) {
                // DB has data — use as primary source
                setDbItems(dbData);
                setDbLastUpdated(lastUpdated);
                setUseDbSource(true);
                setMigrationStatus('db-first');
                setIsLoaded(true);
                return;
            }

            // 2. DB empty — check localStorage
            const localData = loadFromStorage();

            if (localData.length > 0 && !isMigrationDone()) {
                // localStorage has data that hasn't been migrated
                setLocalItems(localData);
                setUseDbSource(false);
                setMigrationStatus('pending');
                setIsLoaded(true);

                // Auto-migrate
                setMigrationStatus('migrating');
                setMigrationMessage('正在將本機自選清單匯入資料庫...');
                try {
                    const migrationItems = localData.map(s => ({
                        stockId: s.symbol,
                        entryPrice: s.avgCost,
                        quantity: s.quantity,
                    }));
                    const result = await bulkMigrateToDb(migrationItems);

                    if (cancelled) return;

                    if (result.success && result.migrated > 0) {
                        markMigrationDone();
                        // Re-fetch from DB to get enriched data
                        const { items: freshDb, lastUpdated: freshLu } = await fetchDbWatchlist();
                        if (freshDb.length > 0) {
                            setDbItems(freshDb);
                            setDbLastUpdated(freshLu);
                            setUseDbSource(true);
                            setMigrationStatus('completed');
                            setMigrationMessage(`已匯入 ${result.migrated} 檔股票至資料庫${result.skipped > 0 ? `（${result.skipped} 檔略過）` : ''}`);
                        } else {
                            // DB still empty after migration — stay local
                            setMigrationStatus('failed');
                            setMigrationMessage('匯入後資料庫無資料，暫時使用本機模式');
                        }
                    } else {
                        setMigrationStatus('failed');
                        setMigrationMessage(`匯入失敗：${result.errors?.join(', ') || '未知錯誤'}，暫時使用本機資料`);
                    }
                } catch (err) {
                    if (cancelled) return;
                    setMigrationStatus('failed');
                    setMigrationMessage('資料庫連線失敗，暫時使用本機資料');
                }
            } else if (localData.length > 0 && isMigrationDone()) {
                // Already migrated before but DB is empty (data deleted?) — show local as fallback
                setLocalItems(localData);
                setUseDbSource(false);
                setMigrationStatus('db-first');
                setDbLastUpdated(lastUpdated);
                setIsLoaded(true);
            } else {
                // Both empty — new user, seed DB with defaults
                setLocalItems(DEFAULT_WATCHLIST);
                setUseDbSource(false);
                setMigrationStatus('migrating');

                try {
                    const seedItems = DEFAULT_WATCHLIST.map(s => ({
                        stockId: s.symbol,
                        entryPrice: s.avgCost,
                        quantity: s.quantity,
                    }));
                    await bulkMigrateToDb(seedItems);
                    const { items: freshDb, lastUpdated: freshLu } = await fetchDbWatchlist();
                    if (freshDb.length > 0) {
                        setDbItems(freshDb);
                        setDbLastUpdated(freshLu);
                        setUseDbSource(true);
                        setMigrationStatus('db-first');
                    }
                    markMigrationDone();
                    saveToStorage(DEFAULT_WATCHLIST);
                } catch {
                    saveToStorage(DEFAULT_WATCHLIST);
                    setMigrationStatus('failed');
                    setMigrationMessage('資料庫連線失敗，使用預設清單（本機模式）');
                }
                setIsLoaded(true);
            }
        }

        init();
        return () => { cancelled = true; };
    }, []);

    // ── Refresh DB data ──
    const refreshDb = useCallback(async () => {
        const { items, lastUpdated } = await fetchDbWatchlist();
        if (items.length > 0) {
            setDbItems(items);
            setDbLastUpdated(lastUpdated);
            setUseDbSource(true);
        }
    }, []);

    // ── Analysis fetch ──
    const symbols = useMemo(() => {
        if (useDbSource) return dbItems.map(i => i.stockId);
        return localItems.map(i => i.symbol);
    }, [useDbSource, dbItems, localItems]);

    const refreshAnalysis = useCallback(async () => {
        if (!isLoaded || symbols.length === 0) return;
        setIsAnalyzing(true);
        const newData: Record<string, ScreeningResult> = {};

        const promises = symbols.map(async (symbol) => {
            try {
                const res = await fetch('/api/strategy/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol }),
                });
                if (res.ok) {
                    const analysis: ScreeningResult = await res.json();
                    if (analysis.calculatedScore == null) {
                        const revYoY = analysis.revenueYoY ?? 0;
                        const rawScore = analysis.isETF
                            ? (analysis.chipStrength / 100 * 50) + (analysis.technicalScore / 100 * 50)
                            : (Math.min(revYoY, 50) / 30 * 40) + (analysis.chipStrength / 100 * 30) + (analysis.technicalScore / 100 * 30);
                        analysis.calculatedScore = Math.round(Math.min(rawScore, 100));
                    }
                    newData[symbol] = analysis;
                }
            } catch (e) {
                console.error(`Failed to analyze ${symbol}`, e);
            }
        });

        await Promise.all(promises);
        setAnalysisMap(newData);

        // If local mode: sync prices back
        if (!useDbSource) {
            setLocalItems(prev => prev.map(s => {
                if (newData[s.symbol]) {
                    return { ...s, price: newData[s.symbol].closePrice, changePercent: newData[s.symbol].priceChangePercent };
                }
                return s;
            }));
        }

        // Fetch alpha fusion scores (batch)
        try {
            const res = await fetch('/api/alpha/fusion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols }),
            });
            if (res.ok) {
                const fusionRes = await res.json();
                const newAlpha: Record<string, { alphaScore: number; recommendationBucket: string; confidence: number }> = {};
                for (const item of fusionRes.data || []) {
                    newAlpha[item.symbol] = {
                        alphaScore: item.alphaScore,
                        recommendationBucket: item.recommendationBucket,
                        confidence: item.confidence,
                    };
                }
                setAlphaMap(newAlpha);
            }
        } catch (e) {
            console.error('Failed to fetch alpha fusion', e);
        }

        setIsAnalyzing(false);
    }, [symbols, isLoaded, useDbSource]);

    // Auto-fetch analysis on mount
    useEffect(() => { refreshAnalysis(); }, [refreshAnalysis]);

    // ── CRUD ──
    const addStock = useCallback(async (stock: Stock) => {
        if (useDbSource) {
            // Check duplicate
            if (dbItems.find(i => i.stockId === stock.symbol)) return;
            try {
                await addToDb(stock.symbol);
                await refreshDb();
            } catch {
                // Fallback: add to local
                setLocalItems(prev => {
                    if (prev.find(s => s.symbol === stock.symbol)) return prev;
                    return [...prev, stock];
                });
            }
        } else {
            setLocalItems(prev => {
                if (prev.find(s => s.symbol === stock.symbol)) return prev;
                const next = [...prev, stock];
                saveToStorage(next);
                return next;
            });
        }
    }, [useDbSource, dbItems, refreshDb]);

    const removeStock = useCallback(async (symbol: string) => {
        if (useDbSource) {
            try {
                await removeFromDb(symbol);
                setDbItems(prev => prev.filter(i => i.stockId !== symbol));
            } catch {
                // silent fail
            }
        } else {
            setLocalItems(prev => {
                const next = prev.filter(s => s.symbol !== symbol);
                saveToStorage(next);
                return next;
            });
        }
    }, [useDbSource]);

    const updateHoldings = useCallback(async (symbol: string, avgCost: number, quantity: number) => {
        if (useDbSource) {
            try {
                await updateInDb(symbol, { entryPrice: avgCost, quantity });
                setDbItems(prev => prev.map(i =>
                    i.stockId === symbol ? { ...i, entryPrice: avgCost, quantity } : i
                ));
            } catch {
                // silent fail
            }
        } else {
            setLocalItems(prev => {
                const next = prev.map(item =>
                    item.symbol === symbol ? { ...item, avgCost, quantity } : item,
                );
                saveToStorage(next);
                return next;
            });
        }
    }, [useDbSource]);

    // ── Sort toggle ──
    const toggleSort = useCallback((key: string) => {
        setSortConfig(prev => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
        }));
    }, []);

    // ── Derived: raw rows ──
    const rawRows: WatchlistRowViewModel[] = useMemo(() => {
        let baseRows: WatchlistRowViewModel[];
        if (useDbSource) {
            baseRows = dbItems.map(item => buildRowFromDb(item, analysisMap[item.stockId] || null));
        } else {
            baseRows = localItems.map(s => buildRowFromLocal(s, analysisMap[s.symbol] || null));
        }
        // Overlay alpha fusion data
        return baseRows.map(row => {
            const alpha = alphaMap[row.symbol];
            if (alpha) {
                return { ...row, alphaScore: alpha.alphaScore, recommendationBucket: alpha.recommendationBucket, alphaConfidence: alpha.confidence };
            }
            return row;
        });
    }, [useDbSource, dbItems, localItems, analysisMap, alphaMap]);

    // ── Derived: sorted & filtered rows ──
    const rows = useMemo(
        () => filterAndSortRows(rawRows, searchQuery, sortConfig),
        [rawRows, searchQuery, sortConfig],
    );

    // ── Derived: portfolio summary ──
    const portfolioSummary: PortfolioSummary = useMemo(() => {
        const totalValue = rawRows.reduce((sum, r) => sum + r.marketValue, 0);
        const totalCost = rawRows.reduce((sum, r) => sum + r.costBasis, 0);
        const totalPL = totalValue - totalCost;
        return {
            totalValue,
            totalCost,
            totalPL,
            totalPLPercent: totalCost > 0 ? (totalPL / totalCost) * 100 : 0,
            stockCount: rawRows.length,
            attackCount: Object.values(analysisMap).filter(d => (d.calculatedScore || 0) >= 90).length,
        };
    }, [rawRows, analysisMap]);

    // ── Compat: watchlist as PortfolioItem[] for dialogs ──
    const watchlist: PortfolioItem[] = useMemo(() => {
        if (!useDbSource) return localItems;
        return dbItems.map(i => ({
            symbol: i.stockId,
            name: i.name,
            price: i.currentPrice,
            change: 0,
            changePercent: i.dailyChange,
            volume: i.volume,
            avgCost: i.entryPrice ?? undefined,
            quantity: i.quantity ?? undefined,
        }));
    }, [useDbSource, dbItems, localItems]);

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
        // Migration
        migrationStatus,
        migrationMessage,
        useDbSource,
        // Actions
        addStock,
        removeStock,
        updateHoldings,
        refreshAnalysis,
    };
}
