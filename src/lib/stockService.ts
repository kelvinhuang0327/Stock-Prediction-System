// Stock Service - Simulates API calls with mock data
import {
    Stock,
    Sector,
    POPULAR_STOCKS,
    SECTORS,
    generateStockList,
    generatePriceHistory,
    generateEconomicEvents,
    getMarketBreadth,
    getForeignInvestorData,
    getSentimentData,
    getDividendHistory,
    getStockComparison,
} from './mockData';

// Simulate API delay
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

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
    macdSignal?: 'bullish' | 'bearish'; // bullish: MACD > 0, bearish: MACD < 0
    maSignal?: 'priceAboveMA20' | 'priceAboveMA60' | 'bullishCross'; // bullishCross: MA20 > MA60
};

class StockService {
    private allStocks: Stock[] = generateStockList(200);

    // Search stocks by symbol or name
    async searchStocks(query: string): Promise<Stock[]> {
        await delay(200);
        const q = query.toLowerCase();
        return this.allStocks.filter(
            stock =>
                stock.symbol.toLowerCase().includes(q) ||
                stock.name.toLowerCase().includes(q)
        ).slice(0, 10);
    }

    // Get stock by symbol
    async getStock(symbol: string): Promise<Stock | null> {
        await delay(100);
        return this.allStocks.find(s => s.symbol === symbol) || null;
    }

    // Get all sectors
    async getSectors(): Promise<Sector[]> {
        await delay(100);
        return SECTORS;
    }

    // Get stocks by sector
    async getStocksBySector(sectorId: string): Promise<Stock[]> {
        await delay(200);
        return this.allStocks.filter(s => s.sector === sectorId);
    }

    // Filter stocks
    async filterStocks(filter: StockFilter): Promise<Stock[]> {
        await delay(300);
        let results = [...this.allStocks];

        if (filter.sector) {
            results = results.filter(s => s.sector === filter.sector);
        }

        if (filter.minPrice !== undefined) {
            results = results.filter(s => s.price >= filter.minPrice!);
        }

        if (filter.maxPrice !== undefined) {
            results = results.filter(s => s.price <= filter.maxPrice!);
        }

        if (filter.minPE !== undefined) {
            results = results.filter(s => s.pe && s.pe >= filter.minPE!);
        }

        if (filter.maxPE !== undefined) {
            results = results.filter(s => s.pe && s.pe <= filter.maxPE!);
        }

        if (filter.minDividendYield !== undefined) {
            results = results.filter(s => s.dividendYield && s.dividendYield >= filter.minDividendYield!);
        }

        if (filter.minVolume !== undefined) {
            results = results.filter(s => s.volume >= filter.minVolume!);
        }

        if (filter.minChangePercent !== undefined) {
            results = results.filter(s => s.changePercent >= filter.minChangePercent!);
        }

        if (filter.maxChangePercent !== undefined) {
            results = results.filter(s => s.changePercent <= filter.maxChangePercent!);
        }

        // Technical Indicator Filters
        if (filter.minRSI !== undefined) {
            results = results.filter(s => s.rsi !== undefined && s.rsi >= filter.minRSI!);
        }

        if (filter.maxRSI !== undefined) {
            results = results.filter(s => s.rsi !== undefined && s.rsi <= filter.maxRSI!);
        }

        if (filter.macdSignal) {
            if (filter.macdSignal === 'bullish') {
                results = results.filter(s => s.macd !== undefined && s.macd > 0);
            } else {
                results = results.filter(s => s.macd !== undefined && s.macd < 0);
            }
        }

        if (filter.maSignal) {
            if (filter.maSignal === 'priceAboveMA20') {
                results = results.filter(s => s.ma20 !== undefined && s.price > s.ma20);
            } else if (filter.maSignal === 'priceAboveMA60') {
                results = results.filter(s => s.ma60 !== undefined && s.price > s.ma60);
            } else if (filter.maSignal === 'bullishCross') {
                results = results.filter(s => s.ma20 !== undefined && s.ma60 !== undefined && s.ma20 > s.ma60);
            }
        }

        return results;
    }

    // Get popular stocks
    async getPopularStocks(): Promise<Stock[]> {
        await delay(100);
        return POPULAR_STOCKS;
    }

    // Get top gainers
    async getTopGainers(limit: number = 10): Promise<Stock[]> {
        await delay(100);
        return [...this.allStocks]
            .sort((a, b) => b.changePercent - a.changePercent)
            .slice(0, limit);
    }

    // Get top losers
    async getTopLosers(limit: number = 10): Promise<Stock[]> {
        await delay(100);
        return [...this.allStocks]
            .sort((a, b) => a.changePercent - b.changePercent)
            .slice(0, limit);
    }

    // Get volume leaders
    async getVolumeLeaders(limit: number = 10): Promise<Stock[]> {
        await delay(100);
        return [...this.allStocks]
            .sort((a, b) => b.volume - a.volume)
            .slice(0, limit);
    }

    // Get price history
    async getPriceHistory(symbol: string, days: number = 60): Promise<any[]> {
        await delay(200);
        const stock = await this.getStock(symbol);
        return generatePriceHistory(days, stock?.price || 100);
    }

    // Get economic events
    async getEconomicEvents() {
        await delay(200);
        return generateEconomicEvents();
    }

    // Get market breadth
    async getMarketBreadth() {
        await delay(100);
        return getMarketBreadth();
    }

    // Get foreign investor data
    async getForeignInvestorData() {
        await delay(100);
        return getForeignInvestorData();
    }

    // Get sentiment data
    async getSentimentData() {
        await delay(150);
        return getSentimentData();
    }

    // Get dividend history
    async getDividendHistory(symbol: string) {
        await delay(150);
        return getDividendHistory(symbol);
    }

    // Get stock comparison
    async getStockComparison(symbols: string[]) {
        await delay(200);
        return getStockComparison(symbols);
    }
}

// Export singleton instance
export const stockService = new StockService();
