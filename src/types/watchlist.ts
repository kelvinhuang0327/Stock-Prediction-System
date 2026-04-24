import { Stock } from '@/lib/mockData';
import type { PortfolioImpact } from '@/types/portfolio';

/** localStorage-based watchlist item with portfolio holdings */
export interface PortfolioItem extends Stock {
    avgCost?: number;
    quantity?: number;
}

/** DB-backed watchlist item returned by GET /api/watchlist */
export interface DbWatchlistItem {
    id: number;
    stockId: string;
    name: string;
    industry: string;
    entryPrice: number | null;
    quantity: number | null;
    note: string | null;
    tags: string | null;
    currentPrice: number;
    changePercent: number;
    dailyChange: number;
    weeklyChange: number;
    volume: number;
    volumeChange: number;
    addedAt: string;
    updatedAt: string;
    hasQuoteData: boolean;
    lastQuoteDate: string | null;
}

/** Strategy analysis result from /api/strategy/analyze */
export interface ScreeningResult {
    stockId: string;
    name: string;
    revenueYoY: number | null;
    eps: number;
    chipStrength: number;
    technicalScore: number;
    reason: string;
    closePrice: number;
    priceChangePercent: number;
    calculatedScore?: number;
    isETF?: boolean;
    riskScore?: number;
    riskLevel?: 'Low' | 'Medium' | 'High';
    // Rule-based analysis fields
    momentumScore?: number;
    overallScore?: number;
    recommendation?: '觀察' | '偏多' | '中性' | '偏空' | '資料不足';
    summary?: string;
    factors?: { name: string; value: number | string; impact: string; note: string }[];
    dataPoints?: number;
    samplePeriod?: string;
    usedSources?: string[];
    missingSources?: string[];
    limitations?: string[];
    dataCoverage?: 'full' | 'limited' | 'insufficient';
    last_updated?: string | null;
}

/** DB-sourced quote snapshot from /api/watchlist (legacy compat) */
export interface QuoteSnapshotViewModel {
    stockId: string;
    name: string;
    dailyChange: number;
    weeklyChange: number;
    volume: number;
    volumeChange: number;
    hasQuoteData: boolean;
    lastQuoteDate: string | null;
}

export interface DbWatchlistResponse {
    data: DbWatchlistItem[];
    last_updated: string | null;
    coverage: { total: number; withQuotes: number };
}

/** Migration result from bulk POST /api/watchlist */
export interface MigrationResult {
    success: boolean;
    migrated: number;
    skipped: number;
    errors: string[];
}

/** Computed view model for each row in the watchlist table */
export interface WatchlistRowViewModel {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    avgCost?: number;
    quantity?: number;
    // DB-sourced overlay
    weeklyChange: number | null;
    volumeChange: number | null;
    hasQuoteData: boolean;
    // Analysis overlay
    analysis: ScreeningResult | null;
    // Alpha fusion overlay
    alphaScore?: number;
    recommendationBucket?: string;
    alphaConfidence?: number;
    portfolioImpact?: PortfolioImpact;
    // Computed portfolio
    marketValue: number;
    costBasis: number;
    profitLoss: number;
    profitLossPercent: number;
    hasHoldings: boolean;
}

/** Portfolio summary totals */
export interface PortfolioSummary {
    totalValue: number;
    totalCost: number;
    totalPL: number;
    totalPLPercent: number;
    stockCount: number;
    attackCount: number; // score >= 90
}

export interface SortConfig {
    key: string;
    dir: 'asc' | 'desc';
}

/** Migration status */
export type MigrationStatus =
    | 'idle'
    | 'pending'     // localStorage has data, DB empty
    | 'migrating'
    | 'completed'
    | 'failed'
    | 'db-first';   // DB is primary, no migration needed

export const WATCHLIST_VERSION = '2025.01.09.v2';

export const DEFAULT_WATCHLIST: PortfolioItem[] = [
    { symbol: '2330', name: '台積電', price: 1025, change: 15, changePercent: 1.48, volume: 32000, pe: 28.5, dividendYield: 1.8, avgCost: 950, quantity: 2000 },
    { symbol: '2454', name: '聯發科', price: 1285, change: 35, changePercent: 2.79, volume: 5500, pe: 18.2, dividendYield: 3.5, avgCost: 1100, quantity: 1000 },
    { symbol: '2317', name: '鴻海', price: 215, change: 4.5, changePercent: 2.14, volume: 95000, pe: 15.3, dividendYield: 4.2, avgCost: 180, quantity: 5000 },
];
