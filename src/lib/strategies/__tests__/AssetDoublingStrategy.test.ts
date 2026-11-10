
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
        } as unknown as StockData;
    };

    it('should filter out stocks with weak revenue growth', async () => {
        const risingCloses = Array.from({ length: 60 }, (_, index) => 100 + index * 0.1);
        const stockStrong = createMockStock('1111', 35, risingCloses, Array(60).fill(1000));
        const stockWeak = createMockStock('2222', 10, risingCloses, Array(60).fill(1000));

        const results = await strategy.screen([stockStrong, stockWeak]);

        expect(results).toHaveLength(1);
        expect(results[0].stockId).toBe('1111');
    });

    it('should identify ignition signals (🚀) correctly', async () => {
        // Base volume 1000, Spike to 5000 (5x), Price stable
        const volumes = Array(59).fill(1000);
        volumes.push(5000); // Spike at the end (will be index 0 in Descending mock, but last in Ascending calculation)

        const closes = Array.from({ length: 60 }, (_, index) => 100 + index * 0.1);
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
        const closes = Array.from({ length: 60 }, (_, index) => 100 + index * 0.1);
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

    it.each([
        ['0050', Array.from({ length: 60 }, (_, index) => 100 + index * 0.1), 'Low'],
        ['5555', Array.from({ length: 60 }, (_, index) => index % 2 === 0 ? 100 : 106), 'Medium'],
    ] as const)('classifies risk for %s and computes its day-over-day return', async (symbol, closes, expectedRisk) => {
        const stock = createMockStock(symbol, 35, [...closes], Array(closes.length).fill(1000));
        const result = await new AssetDoublingStrategy({ skipFilters: true }).analyze(stock);

        expect(result).not.toBeNull();
        expect(result?.riskLevel).toBe(expectedRisk);
        expect(result?.riskScore).toBeGreaterThanOrEqual(0);
        expect(result?.priceChangePercent).toEqual(expect.any(Number));
        expect(result?.isETF).toBe(symbol === '0050');
    });

    it('returns no historical evidence when there are fewer than 100 ascending quotes', () => {
        const stock = createMockStock('4444', 35, Array(60).fill(100), Array(60).fill(1000));
        expect(strategy.getEvidence([...stock.quotes].reverse(), stock.monthlyRevenues)).toBeUndefined();
    });

    it('finds a profitable historical setup when a bullish signal matches monthly revenue', () => {
        const closes = Array.from({ length: 130 }, (_, index) => 100 + index);
        const stock = createMockStock('3333', 35, closes, Array(130).fill(1000));
        const quotesAsc = [...stock.quotes].reverse();

        const evidence = strategy.getEvidence(quotesAsc, [{ year: 2023, month: 3, yoyGrowth: 30 }]);

        expect(evidence).toBeDefined();
        expect(evidence?.date).toMatch(/^202303/);
        expect(evidence?.maxGain).toBeGreaterThan(0);
        expect(evidence?.duration).toBeGreaterThan(0);
    });

    it('supports Taiwanese year dates and rejects signals without a matching revenue record', () => {
        const closes = Array.from({ length: 130 }, (_, index) => 100 + index);
        const stock = createMockStock('3333', 35, closes, Array(130).fill(1000));
        const quotesAsc = [...stock.quotes].reverse();
        quotesAsc[60].date = '1120302';

        const evidence = strategy.getEvidence(quotesAsc, [{ year: 2023, month: 3, yoyGrowth: 30 }]);
        expect(evidence?.date).toBe('1120302');
        expect(strategy.getEvidence(quotesAsc, [{ year: 2023, month: 9, yoyGrowth: 30 }])).toBeUndefined();
    });

    it('returns no evidence when no historical date has a supported format', () => {
        const closes = Array.from({ length: 130 }, (_, index) => 100 + index);
        const stock = createMockStock('3333', 35, closes, Array(130).fill(1000));
        const quotesAsc = [...stock.quotes].reverse().map(quote => ({ ...quote, date: 'invalid' }));

        expect(strategy.getEvidence(quotesAsc, [{ year: 2023, month: 3, yoyGrowth: 30 }])).toBeUndefined();
    });

    it('returns undefined for a short ongoing-stop-loss history and a numeric stop for sufficient history', () => {
        const shortStock = createMockStock('2222', 10, Array(10).fill(100), Array(10).fill(1000));
        const longStock = createMockStock('2222', 30, Array.from({ length: 30 }, (_, index) => 100 + index), Array(30).fill(1000));

        expect(strategy.getOnGoingStopLoss(shortStock.quotes[0], shortStock.quotes)).toBeUndefined();
        expect(strategy.getOnGoingStopLoss(longStock.quotes[0], [...longStock.quotes].reverse())).toEqual(expect.any(Number));
    });

    it('applies regime-specific revenue, technical, and volatility chip thresholds', async () => {
        const closes = Array(60).fill(110);
        for (let index = 50; index < 59; index++) closes[index] = 90;
        closes[59] = 100;
        const stockWithModerateChips = createMockStock('3333', 24, closes, Array(60).fill(1000));
        const stockWithStrongChips = createMockStock('4444', 24, closes, Array(60).fill(1000));
        const bullRevenueButModerateTrend = createMockStock('5555', 26, closes, Array(60).fill(1000));
        for (const stock of [stockWithModerateChips, stockWithStrongChips, bullRevenueButModerateTrend]) {
            for (const quote of stock.quotes) {
                quote.high = quote.close * 1.1;
                quote.low = quote.close * 0.9;
            }
        }
        stockWithModerateChips.institutionalChips[0].totalBuy = 500; // strength 60
        stockWithStrongChips.institutionalChips[0].totalBuy = 1500; // strength 80
        bullRevenueButModerateTrend.institutionalChips[0].totalBuy = 1500;

        const bullRevenueBelowThreshold = await strategy.screen([stockWithStrongChips], undefined, { regime: 'BULL' });
        const bullTechnicalBelowThreshold = await strategy.screen([bullRevenueButModerateTrend], undefined, { regime: 'BULL' });
        const correction = await strategy.screen([stockWithModerateChips], undefined, { regime: 'CORRECTION' });
        const bearWithoutStrongSupport = await strategy.screen([stockWithModerateChips], undefined, { regime: 'BEAR' });
        const bearWithStrongSupport = await strategy.screen([stockWithStrongChips], undefined, { regime: 'BEAR' });

        expect(bullRevenueBelowThreshold).toEqual([]); // Revenue growth is below the bull threshold of 25%.
        expect(bullTechnicalBelowThreshold).toEqual([]); // The configured MA10/MA60 score is below 80.
        expect(correction).toHaveLength(1); // Correction thresholds allow 24% growth and chip strength 60.
        expect(correction[0].technicalScore).toBe(75);
        expect(bearWithoutStrongSupport).toEqual([]); // High ATR requires chip strength 80 in a bear regime.
        expect(bearWithStrongSupport).toHaveLength(1);
    });

    it('adds relative strength, institutional accumulation, and the top anomaly signal', async () => {
        const closes = Array.from({ length: 120 }, (_, index) => 100 + index * 0.1);
        const stock = createMockStock('6666', 40, closes, Array(120).fill(1000));
        stock.institutionalChips = Array.from({ length: 20 }, (_, index) => ({
            date: `2026-01-${String(index + 1).padStart(2, '0')}`,
            totalBuy: 200,
            foreignBuy: index < 5 ? 100 : 1,
            trustBuy: index < 5 ? 100 : 1,
            dealerBuy: 0,
        }));
        const marketData = Array.from({ length: 100 }, (_, index) => ({
            date: `2026-01-${String(index + 1).padStart(2, '0')}`,
            value: 100,
        }));

        const results = await strategy.screen([stock], marketData);

        expect(results).toHaveLength(1);
        expect(results[0].rsScore).toBeGreaterThan(50);
        expect(results[0].potentialLabel).toContain('+ 💎 投信認養');
        expect(results[0].anomaly).toMatchObject({
            type: 'CONCENTRATION_SURGE', severity: 'HIGH', score: 100,
        });
        expect(results[0].concentrationHistory).toHaveLength(10);
    });
});
