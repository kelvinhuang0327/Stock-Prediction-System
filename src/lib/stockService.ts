// Stock Service - Hybrid implementation (Prisma + Fallback)
import { prisma } from './prisma';
import {
    Stock,
    Sector,
    EconomicEvent,
    StockDataPoint
} from '@/types/stock';
import {
    POPULAR_STOCKS,
    SECTORS,
    generatePriceHistory,
    generateEconomicEvents,
} from './mockData';

// Helper to convert Prisma stock to Domain Stock
const convertPrismaToStock = (pStock: any): Stock => {
    const latestQuote = pStock.quotes?.[0];
    const metrics = pStock.metrics?.[0];

    return {
        symbol: pStock.id,
        name: pStock.name,
        price: latestQuote?.close || 0,
        change: latestQuote?.change || 0,
        // Calculate percent if prevClose is available? For now approx.
        changePercent: latestQuote?.change && latestQuote?.close
            ? (latestQuote.change / (latestQuote.close - latestQuote.change)) * 100
            : 0,
        volume: latestQuote?.volume || 0,
        open: latestQuote?.open,
        high: latestQuote?.high,
        low: latestQuote?.low,
        industry: pStock.industry || undefined,
        pe: metrics?.pe || undefined,
        dividendYield: metrics?.dividendYield || undefined,
        // Map other fields as available or modify Prisma schema to match
    };
};

export type StockFilter = {
    sector?: string;
    minPrice?: number;
    maxPrice?: number;
    minPE?: number;
    maxPE?: number;
    minDividendYield?: number;
    minVolume?: number;
    minChangePercent?: number;
    maxChangePercent?: number;
    // Technical Indicators
    minRSI?: number;
    maxRSI?: number;
    macdSignal?: 'bullish' | 'bearish';
    maSignal?: 'priceAboveMA20' | 'priceAboveMA60' | 'bullishCross';
};

class StockService {

    // Search stocks by symbol or name
    async searchStocks(query: string): Promise<Stock[]> {
        // Client-side: use API
        if (typeof window !== 'undefined') {
            try {
                const res = await fetch(`/api/stocks?search=${encodeURIComponent(query)}&limit=10`);
                if (res.ok) {
                    const json = await res.json();
                    return json.data.map((s: any) => {
                        const price = s.price || 0;
                        const change = s.change || 0;
                        const changePercent = (price > 0 && price !== change)
                            ? (change / (price - change)) * 100
                            : 0;

                        return {
                            symbol: s.code,
                            name: s.name,
                            price: price,
                            change: change,
                            changePercent: changePercent,
                            volume: s.volume || 0,
                            industry: s.industry,
                            pe: s.pe,
                            dividendYield: s.yield
                        };
                    });
                }
            } catch (error) {
                console.warn("Client stock search failed, falling back to mock", error);
            }
        }

        // Server-side or Fallback: try Prisma
        try {
            if (typeof window === 'undefined') {
                const stocks = await prisma.stock.findMany({
                    where: {
                        OR: [
                            { id: { contains: query } },
                            { name: { contains: query } }
                        ]
                    },
                    take: 10,
                    include: {
                        quotes: { orderBy: { date: 'desc' }, take: 1 },
                        metrics: { orderBy: { date: 'desc' }, take: 1 }
                    }
                });

                if (stocks.length > 0) {
                    return stocks.map(convertPrismaToStock);
                }
            }
        } catch (error) {
            console.warn("DB Search failed, falling back to mock", error);
        }

        // Final Fallback: mock data
        const q = query.toLowerCase();
        return POPULAR_STOCKS.filter(
            stock =>
                stock.symbol.toLowerCase().includes(q) ||
                stock.name.toLowerCase().includes(q)
        ).slice(0, 10);
    }

    // Get stock by symbol
    async getStock(symbol: string): Promise<Stock | null> {
        try {
            const stock = await prisma.stock.findUnique({
                where: { id: symbol },
                include: {
                    quotes: { orderBy: { date: 'desc' }, take: 1 },
                    metrics: { orderBy: { date: 'desc' }, take: 1 }
                }
            });

            if (stock) {
                return convertPrismaToStock(stock);
            }
        } catch (error) {
            console.warn("DB GetStock failed, falling back to mock", error);
        }

        return POPULAR_STOCKS.find(s => s.symbol === symbol) || null;
    }

    // Get all sectors - Hybrid
    async getSectors(): Promise<any[]> {
        // Client: Use API
        if (typeof window !== 'undefined') {
            try {
                const res = await fetch('/api/sectors');
                if (res.ok) return await res.json();
            } catch (e) { console.error(e); }
        } else {
            // Server: Dynamic Import
            try {
                const { SectorAnalysisService } = await import('./services/SectorAnalysisService');
                return await SectorAnalysisService.getSectorRotationData();
            } catch (e) {
                console.warn("Server sector fetch failed", e);
            }
        }
        return [];
    }

    // Get stocks by sector
    async getStocksBySector(sectorId: string): Promise<Stock[]> {
        // Find industry name from static list to match DB string
        const sectorName = SECTORS.find(s => s.id === sectorId)?.name;

        if (sectorName) {
            try {
                const stocks = await prisma.stock.findMany({
                    where: { industry: sectorName },
                    include: {
                        quotes: { orderBy: { date: 'desc' }, take: 1 },
                        metrics: { orderBy: { date: 'desc' }, take: 1 }
                    }
                });
                if (stocks.length > 0) return stocks.map(convertPrismaToStock);
            } catch (e) { }
        }

        return POPULAR_STOCKS.filter(s => s.sector === sectorId);
    }

    // Filter stocks - Complex, implementation limited for now
    // Filter stocks - Real DB Implementation
    async filterStocks(filter: StockFilter): Promise<Stock[]> {
        try {
            // 1. Build Base Query (Sector/Industry)
            const where: any = {};
            if (filter.sector) {
                // Try to match sector ID to industry name if possible due to mismatch in naming conventions
                // Or just assume input is industry name if ID match fails
                const sectorName = SECTORS.find(s => s.id === filter.sector)?.name || filter.sector;
                if (sectorName !== 'all' && filter.sector !== 'all') {
                    where.industry = sectorName;
                }
            }

            // 2. Fetch Candidates with Latest Data
            const stocks = await prisma.stock.findMany({
                where,
                include: {
                    quotes: { orderBy: { date: 'desc' }, take: 1 },
                    metrics: { orderBy: { date: 'desc' }, take: 1 }
                }
            });

            // 3. In-Memory Filter for Dynamic Fields (Price, PE, Volume...)
            return stocks
                .map(convertPrismaToStock)
                .filter(stock => {
                    // Price
                    if (filter.minPrice !== undefined && stock.price < filter.minPrice) return false;
                    if (filter.maxPrice !== undefined && stock.price > filter.maxPrice) return false;

                    // Volume
                    if (filter.minVolume !== undefined && stock.volume < filter.minVolume) return false;

                    // Change %
                    if (filter.minChangePercent !== undefined && stock.changePercent < filter.minChangePercent) return false;
                    if (filter.maxChangePercent !== undefined && stock.changePercent > filter.maxChangePercent) return false;

                    // PE
                    if (filter.minPE !== undefined) {
                        if (!stock.pe || stock.pe < filter.minPE) return false;
                    }
                    if (filter.maxPE !== undefined) {
                        if (!stock.pe || stock.pe > filter.maxPE) return false;
                    }

                    // Yield
                    if (filter.minDividendYield !== undefined) {
                        if (!stock.dividendYield || stock.dividendYield < filter.minDividendYield) return false;
                    }

                    return true;
                });

        } catch (error) {
            console.warn("DB Filter failed, falling back to mock", error);
            // Fallback logic
            let results = [...POPULAR_STOCKS];
            if (filter.sector) {
                results = results.filter(s => s.sector === filter.sector);
            }
            return results;
        }
    }

    // Get popular stocks
    async getPopularStocks(): Promise<Stock[]> {
        try {
            const stocks = await prisma.stock.findMany({
                take: 10,
                include: {
                    quotes: { orderBy: { date: 'desc' }, take: 1 },
                    metrics: { orderBy: { date: 'desc' }, take: 1 }
                }
            });
            if (stocks.length > 0) return stocks.map(convertPrismaToStock);
        } catch (e) { }

        return POPULAR_STOCKS;
    }

    // Get top gainers
    async getTopGainers(limit: number = 10): Promise<Stock[]> {
        try {
            // Requires Quotes join/sort, might be slow on SQLite without raw query
            // Simple fallback: Get reasonable batch and sort in memory
            const stocks = await prisma.stock.findMany({
                take: 50,
                include: {
                    quotes: { orderBy: { date: 'desc' }, take: 1 },
                }
            });
            const converted = stocks.map(convertPrismaToStock);
            return converted.sort((a, b) => b.changePercent - a.changePercent).slice(0, limit);
        } catch (e) { }

        return [...POPULAR_STOCKS]
            .sort((a, b) => b.changePercent - a.changePercent)
            .slice(0, limit);
    }

    // Get top losers
    async getTopLosers(limit: number = 10): Promise<Stock[]> {
        try {
            const stocks = await prisma.stock.findMany({
                take: 50,
                include: {
                    quotes: { orderBy: { date: 'desc' }, take: 1 },
                }
            });
            const converted = stocks.map(convertPrismaToStock);
            return converted.sort((a, b) => a.changePercent - b.changePercent).slice(0, limit);
        } catch (e) { }

        return [...POPULAR_STOCKS]
            .sort((a, b) => a.changePercent - b.changePercent)
            .slice(0, limit);
    }

    // Get volume leaders
    async getVolumeLeaders(limit: number = 10): Promise<Stock[]> {
        try {
            // In real app, order by quotes directly
            const stocks = await prisma.stock.findMany({
                take: 50,
                include: {
                    quotes: { orderBy: { date: 'desc' }, take: 1 },
                }
            });
            const converted = stocks.map(convertPrismaToStock);
            return converted.sort((a, b) => b.volume - a.volume).slice(0, limit);
        } catch (e) { }

        return [...POPULAR_STOCKS]
            .sort((a, b) => b.volume - a.volume)
            .slice(0, limit);
    }

    // Get price history
    async getPriceHistory(symbol: string, days: number = 60): Promise<any[]> {
        try {
            const quotes = await prisma.stockQuote.findMany({
                where: { stockId: symbol },
                orderBy: { date: 'desc' },
                take: days
            });

            if (quotes.length > 0) {
                return quotes.reverse().map(q => ({
                    date: q.date, // format?
                    open: q.open,
                    high: q.high,
                    low: q.low,
                    close: q.close,
                    volume: q.volume
                }));
            }
        } catch (e) { }

        const stock = await this.getStock(symbol);
        return generatePriceHistory(days, stock?.price || 100);
    }

    // Get economic events
    async getEconomicEvents(): Promise<EconomicEvent[]> {
        // New: Try to fetch news events from DB? 
        try {
            const news = await prisma.newsEvent.findMany({
                orderBy: { publishedAt: 'desc' },
                take: 20
            });

            if (news.length > 0) {
                return news.map(n => ({
                    id: n.id.toString(),
                    date: n.publishedAt.toISOString().split('T')[0],
                    title: n.title,
                    type: 'economic', // Generic for now
                    importance: 'medium',
                    description: n.summary || undefined
                }));
            }
        } catch (e) { }

        return generateEconomicEvents();
    }

    // Get market breadth
    async getMarketBreadth() {
        // TODO: Calc from DB
        return {
            advancing: 892,
            declining: 543,
            unchanged: 165,
            advancingVolume: 125000,
            decliningVolume: 78000,
            totalVolume: 203000,
            newHighs: 45,
            newLows: 12,
        };
    }

    // Get foreign investor data
    async getForeignInvestorData() {
        return {
            netBuy: 8520, // Million TWD
            buyAmount: 45230,
            sellAmount: 36710,
            trend: 'buying' as const,
        };
    }

    // Get sentiment data (Bridged to MarketStatusService)
    async getSentimentData() {
        try {
            let status: any = { status: 'Bullish' };
            if (typeof window === 'undefined') {
                const { marketStatusService } = await import('./services/MarketStatusService');
                status = await marketStatusService.getStatus();
            } else {
                // For now client fallback is simplified or requires another API
                // Just default to Bullish or use mock
                // If we created a /api/market-status we could call it
                // Let's assume we do (though we only made /api/sectors)
                // Or just fallback to mock
            }

            // Map Market Status to "Fear & Greed" (Heuristic)
            let fearGreed = 50;
            let sentimentLabel: 'bullish' | 'bearish' | 'neutral' = 'neutral';

            if (status.status === 'Bullish') {
                fearGreed = 75;
                sentimentLabel = 'bullish';
            } else if (status.status === 'Bearish') {
                fearGreed = 25;
                sentimentLabel = 'bearish';
            } else {
                fearGreed = 45; // Correction
                sentimentLabel = 'neutral';
            }

            return {
                fearGreedIndex: fearGreed,
                sentiment: sentimentLabel,
                newsPositive: status.status === 'Bullish' ? 70 : 30, // Mock proportional
                newsNegative: status.status === 'Bearish' ? 70 : 30,
                socialMediaBuzz: 60 + (Math.random() * 20),
                volatilityIndex: status.status === 'Bearish' ? 25 : 15,
            };
        } catch (e) {
            // Fallback
            return {
                fearGreedIndex: 50,
                sentiment: 'neutral' as const,
                newsPositive: 50,
                newsNegative: 50,
                socialMediaBuzz: 50,
                volatilityIndex: 20,
            };
        }
    }

    // Get dividend history
    async getDividendHistory(symbol: string) {
        // TODO: Add Dividend model to DB
        const years = [2023, 2022, 2021, 2020, 2019];
        return years.map(year => ({
            year,
            cashDividend: Math.round((Math.random() * 5 + 1) * 100) / 100,
            stockDividend: Math.round((Math.random() * 0.5) * 100) / 100,
            exDividendDate: `${year}-08-15`,
            paymentDate: `${year}-09-20`,
            yield: Math.round((Math.random() * 6 + 2) * 100) / 100,
        }));
    }

    // Get stock comparison
    async getStockComparison(symbols: string[]) {
        const stocks = await Promise.all(symbols.map(s => this.getStock(s)));
        return stocks.map(stock => {
            if (!stock) return null;
            return {
                ...stock,
                revenue: Math.round(Math.random() * 100000 + 10000),
                netIncome: Math.round(Math.random() * 20000 + 2000),
                roe: Math.round((Math.random() * 20 + 5) * 100) / 100,
                roa: Math.round((Math.random() * 10 + 2) * 100) / 100,
                debtRatio: Math.round((Math.random() * 50 + 10) * 100) / 100,
            };
        }).filter(Boolean);
    }
}

// Export singleton instance
export const stockService = new StockService();

