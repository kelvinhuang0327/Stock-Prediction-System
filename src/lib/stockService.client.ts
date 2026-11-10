import type { EconomicEvent, Stock } from '@/types/stock';
import type { SectorData } from './services/SectorAnalysisService';
import {
    POPULAR_STOCKS,
    SECTORS,
    generateEconomicEvents,
    generatePriceHistory,
} from './mockData';

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
    minRSI?: number;
    maxRSI?: number;
    macdSignal?: 'bullish' | 'bearish';
    maSignal?: 'priceAboveMA20' | 'priceAboveMA60' | 'bullishCross';
};

class ClientStockService {
    async searchStocks(query: string): Promise<Stock[]> {
        try {
            const res = await fetch(`/api/stocks?search=${encodeURIComponent(query)}&limit=10`);
            if (res.ok) {
                const json = await res.json();
                return json.data.map((stock: {
                    code: string;
                    name: string;
                    price?: number;
                    change?: number;
                    volume?: number;
                    industry?: string;
                    pe?: number;
                    yield?: number;
                }) => {
                    const price = stock.price || 0;
                    const change = stock.change || 0;
                    return {
                        symbol: stock.code,
                        name: stock.name,
                        price,
                        change,
                        changePercent: price > 0 && price !== change
                            ? (change / (price - change)) * 100
                            : 0,
                        volume: stock.volume || 0,
                        industry: stock.industry,
                        pe: stock.pe,
                        dividendYield: stock.yield,
                    };
                });
            }
        } catch (error) {
            console.warn('Client stock search failed, falling back to mock', error);
        }

        const normalizedQuery = query.toLowerCase();
        return POPULAR_STOCKS.filter(stock =>
            stock.symbol.toLowerCase().includes(normalizedQuery)
            || stock.name.toLowerCase().includes(normalizedQuery),
        ).slice(0, 10);
    }

    async getStock(symbol: string): Promise<Stock | null> {
        return POPULAR_STOCKS.find(stock => stock.symbol === symbol) || null;
    }

    async getSectors(): Promise<SectorData[]> {
        try {
            const res = await fetch('/api/sectors');
            if (res.ok) return await res.json() as SectorData[];
        } catch (error) {
            console.error(error);
        }
        return [];
    }

    async getStocksBySector(sectorId: string): Promise<Stock[]> {
        let normalizedSector = sectorId;
        try {
            normalizedSector = decodeURIComponent(sectorId);
        } catch {
            // Keep malformed or already-decoded route values as-is.
        }

        const matchedSector = SECTORS.find(
            sector => sector.id === normalizedSector || sector.name === normalizedSector,
        );
        const normalizedSectorId = matchedSector?.id ?? normalizedSector;
        const industryName = matchedSector?.name ?? normalizedSector;

        return POPULAR_STOCKS.filter(
            stock => stock.sector === normalizedSectorId || stock.industry === industryName,
        );
    }

    async filterStocks(filter: StockFilter): Promise<Stock[]> {
        let results = [...POPULAR_STOCKS];
        if (filter.sector) results = results.filter(stock => stock.sector === filter.sector);
        return results;
    }

    async getVolumeLeaders(limit = 10): Promise<Stock[]> {
        return [...POPULAR_STOCKS]
            .sort((left, right) => right.volume - left.volume)
            .slice(0, limit);
    }

    async getEconomicEvents(): Promise<EconomicEvent[]> {
        return generateEconomicEvents();
    }

    async getMarketBreadth() {
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

    async getForeignInvestorData() {
        return {
            netBuy: 8520,
            buyAmount: 45230,
            sellAmount: 36710,
            trend: 'buying' as const,
        };
    }

    async getSentimentData() {
        return {
            fearGreedIndex: 75,
            sentiment: 'bullish' as const,
            newsPositive: 70,
            newsNegative: 30,
            socialMediaBuzz: 60 + (Math.random() * 20),
            volatilityIndex: 15,
        };
    }

    async getPriceHistory(symbol: string, days = 60): Promise<unknown[]> {
        const stock = await this.getStock(symbol);
        return generatePriceHistory(days, stock?.price || 100);
    }

    async getPopularStocks(): Promise<Stock[]> {
        return POPULAR_STOCKS;
    }

    async getTopGainers(limit = 10): Promise<Stock[]> {
        return [...POPULAR_STOCKS].sort((left, right) => right.changePercent - left.changePercent).slice(0, limit);
    }

    async getTopLosers(limit = 10): Promise<Stock[]> {
        return [...POPULAR_STOCKS].sort((left, right) => left.changePercent - right.changePercent).slice(0, limit);
    }
}

export const stockService = new ClientStockService();
