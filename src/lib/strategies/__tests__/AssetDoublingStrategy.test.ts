
import { AssetDoublingStrategy } from '../AssetDoublingStrategy';
import { StockData } from '../types';

describe('AssetDoublingStrategy', () => {
    let strategy: AssetDoublingStrategy;

    beforeEach(() => {
        strategy = new AssetDoublingStrategy();
    });

    // Helper to create mock stock data
    const createMockStock = (
        id: string,
        revenueYoY: number,
        closes: number[],
        volumes: number[]
    ): StockData => {
        const quotes = closes.map((close, i) => ({
            date: new Date(2023, 0, i + 1).toISOString().split('T')[0].replace(/-/g, ''), // Mock dates
            close,
            open: close,
            high: close * 1.01,
            low: close * 0.99,
            volume: volumes[i] || 1000,
            transactions: 100,
            tradeValue: close * 1000,
            change: 0
        })).reverse(); // Mock DB returns Descending (Newest First)

        return {
            stockId: id,
            name: `Stock ${id}`,
            quotes,
            monthlyRevenues: [{
                year: 2023, month: 1, revenue: 1000, yoyGrowth: revenueYoY, momGrowth: 0, stockId: id, id: 1, createdAt: new Date()
            }],
            financialReports: [{
                year: 2023, quarter: 1, eps: 1.5, netIncome: 100, stockId: id, id: 1, createdAt: new Date(), grossMargin: 0, operatingMargin: 0
            }],
            institutionalChips: [{
                stockId: id, totalBuy: 100, date: '20230101', id: 1, createdAt: new Date(), foreignBuy: 0, trustBuy: 0, dealerBuy: 0
            }]
        } as any;
    };

    it('should filter out stocks with weak revenue growth', async () => {
        const stockStrong = createMockStock('1111', 35, Array(60).fill(100), Array(60).fill(1000));
        const stockWeak = createMockStock('2222', 10, Array(60).fill(100), Array(60).fill(1000));

        const results = await strategy.screen([stockStrong, stockWeak]);

        expect(results).toHaveLength(1);
        expect(results[0].stockId).toBe('1111');
    });

    it('should identify ignition signals (🚀) correctly', async () => {
        // Base volume 1000, Spike to 5000 (5x), Price stable
        const volumes = Array(59).fill(1000);
        volumes.push(5000); // Spike at the end (will be index 0 in Descending mock, but last in Ascending calculation)

        const closes = Array(60).fill(100);
        closes[59] = 105; // 5% gain (fresh)

        const stock = createMockStock('9999', 35, closes, volumes);
        const results = await strategy.screen([stock]);

        expect(results).toHaveLength(1);
        expect(results[0].potentialLabel).toContain('🚀');
        expect(results[0].potentialLabel).toContain('強勢發動');
    });

    it('should identify overheated stocks (⚠️) correctly', async () => {
        // Price climbed from 50 to 100 (>50% gain)
        const closes = Array(60).fill(50);
        for (let i = 30; i < 60; i++) closes[i] = 100; // Big jump

        const stock = createMockStock('8888', 35, closes, Array(60).fill(1000));
        const results = await strategy.screen([stock]);

        expect(results).toHaveLength(1);
        expect(results[0].potentialLabel).toContain('⚠️');
        expect(results[0].potentialLabel).toContain('過熱警戒');
    });

    it('should identify gems (💎) correctly', async () => {
        // Stable price, High Revenue
        const closes = Array(60).fill(100);
        const stock = createMockStock('7777', 40, closes, Array(60).fill(1000));

        const results = await strategy.screen([stock]);

        expect(results).toHaveLength(1);
        expect(results[0].potentialLabel).toContain('💎');
    });

    it('should calculate technical score roughly correctly', async () => {
        // Uptrend: MA10 > MA60, Close > MA10
        // Need > 60 points for valid MA60
        const closes = Array(80).fill(0).map((_, i) => 100 + i); // Linear growth

        const stock = createMockStock('6666', 35, closes, Array(80).fill(1000));
        const finalClose = closes[79];

        const results = await strategy.screen([stock]);

        expect(results).toHaveLength(1);
        expect(results[0].technicalScore).toBeGreaterThanOrEqual(75);
        expect(results[0].closePrice).toBe(finalClose);
    });

    it('should calculate risk score in detailed analyze', async () => {
        // Very volatile stock (would be filtered by ATR without skipFilters)
        const closes = Array(60).fill(0).map((_, i) => i % 2 === 0 ? 100 : 120); // Alternating
        const stock = createMockStock('5555', 35, closes, Array(60).fill(1000));

        // Use skipFilters to allow analyzing this volatile stock
        const debugStrategy = new AssetDoublingStrategy({ skipFilters: true });
        const result = await debugStrategy.analyze(stock);

        expect(result).not.toBeNull();
        expect(result?.riskScore).toBeGreaterThan(20); // High volatility
        expect(result?.riskLevel).not.toBe('Low');
    });
});
