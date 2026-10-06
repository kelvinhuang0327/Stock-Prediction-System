
import { prisma } from '../prisma';
import { marketEnvironmentFilter, MarketRegime } from '../risk/RiskDefenseModule';


export type MarketStatus = 'Bullish' | 'Correction' | 'Bearish';

export class MarketStatusService {
    async getStatus(asOfDate?: string): Promise<{
        status: MarketStatus;
        regime: MarketRegime;
        scalingFactor: number;
        indexClose: number;
        ma20: number;
        ma60: number
    }> {
        // Fetch Market Index Data (Try TAIEX then 0050)
        // Order by Date ASC for technical calculation
        const marketData = await prisma.marketIndex.findMany({
            where: {
                name: { in: ['TAIEX', 'TSE', '0050'] },
                ...(asOfDate ? { date: { lte: asOfDate } } : {})
            },
            orderBy: { date: 'asc' },
            take: 100 // Need enough for MA60
        });

        if (marketData.length < 60) {
            // Default to Bullish/1.0 if no market data (fallback)
            return {
                status: 'Bullish',
                regime: 'BULL',
                scalingFactor: 1.0,
                indexClose: 0,
                ma20: 0,
                ma60: 0
            };
        }

        const quotes = marketData.map(d => ({ close: d.value })); // Adapter for calculator
        const lastIdx = quotes.length - 1;

        // Calculate MA20 and MA60
        const ma20 = this.simpleMA(quotes, 20);
        const ma60 = this.simpleMA(quotes, 60);
        const currentClose = quotes[lastIdx].close;

        // Use MarketEnvironmentFilter for consistent regime detection
        const environment = marketEnvironmentFilter.assessMarketRegime(
            currentClose,
            ma20,
            ma60
        );

        // Map regime to legacy status for backward compatibility
        let status: MarketStatus = 'Bullish';
        if (environment.regime === 'BEAR') status = 'Bearish';
        else if (environment.regime === 'CORRECTION') status = 'Correction';
        else status = 'Bullish';

        return {
            status,
            regime: environment.regime,
            scalingFactor: environment.scalingFactor,
            indexClose: currentClose,
            ma20,
            ma60
        };
    }

    private simpleMA(data: { close: number }[], period: number): number {
        if (data.length < period) return 0;
        const slice = data.slice(-period);
        const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
        return sum / period;
    }

    async getRegimeHistory(days: number = 365): Promise<{ date: string; regime: MarketRegime; scalingFactor: number; index: number; ma20: number; ma60: number }[]> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days - 100); // Buffer for MA

        const marketData = await prisma.marketIndex.findMany({
            where: {
                name: { in: ['TAIEX', 'TSE', '0050'] },
                date: { gte: startDate.toISOString().split('T')[0] }
            },
            orderBy: { date: 'asc' }
        });

        if (marketData.length < 60) return [];

        const quotes = marketData.map(d => ({ close: d.value, date: d.date }));
        const results = [];

        // Start from where we have enough data for MA60
        const resultStartDate = new Date();
        resultStartDate.setDate(endDate.getDate() - days);
        const startStr = resultStartDate.toISOString().split('T')[0];

        for (let i = 60; i < quotes.length; i++) {
            const date = quotes[i].date;
            if (date < startStr) continue;

            const slice = quotes.slice(0, i + 1);
            const ma20 = this.simpleMA(slice, 20);
            const ma60 = this.simpleMA(slice, 60);
            const currentClose = quotes[i].close;

            const env = marketEnvironmentFilter.assessMarketRegime(currentClose, ma20, ma60);

            results.push({
                date,
                regime: env.regime,
                scalingFactor: env.scalingFactor,
                index: currentClose,
                ma20,
                ma60
            });
        }

        return results;
    }
}

export const marketStatusService = new MarketStatusService();
