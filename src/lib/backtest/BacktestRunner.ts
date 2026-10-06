
import { Strategy, StockData } from '../strategies/types';
import { prisma } from '../prisma';
import { strategyScreeningService } from '../services/StrategyScreeningService';

export interface BacktestConfig {
    startDate: Date;
    endDate: Date;
    stepDays: number; // e.g. 7 for weekly rolling
    holdingPeriodDays: number;
    initialCapital?: number;
    trailingStopActivation?: number; // e.g. 0.20 (20%)
    trailingStopCallback?: number;   // e.g. 0.05 (5%)
    stopLoss?: number;               // e.g. 0.10 (10%)
}

export interface TradeResult {
    stockId: string;
    entryDate: string;
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    returnPercent: number;
    reason: string;
}

export class BacktestRunner {

    async run(strategy: Strategy, config: BacktestConfig): Promise<TradeResult[]> {
        const results: TradeResult[] = [];
        let currentDate = new Date(config.startDate);
        const endDate = new Date(config.endDate);

        console.log(`Starting Backtest from ${currentDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

        // Pre-fetch all stock basics to avoid repeated queries
        const allStocks = await prisma.stock.findMany({ select: { id: true, name: true, capital: true } });
        console.log(`Loaded ${allStocks.length} stocks for simulation.`);

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const asOfDate = dateStr.replace(/-/g, '');
            console.log(`Processing Date: ${dateStr}`);

            // 1. Fetch Candidates using Screening Service (Optimized with Database Cache)
            // Instead of fetching all raw data and screening manually, we use the service
            // which will check for previsouly computed StrategySignals.
            const candidates = await strategyScreeningService.screen({
                asOfDate: dateStr,
                strategy: strategy.name // Use the strategy's identifier
            });

            // 2. Simulate Trade for Candidates
            for (const candidate of candidates) {
                // Check if we already have an open trade? (Simplified: assume unlimited capital or just logging signals)

                // Simulate future outcome
                const trade = await this.simulateTrade(candidate.stockId, currentDate, config.holdingPeriodDays, config, strategy);
                if (trade) {
                    results.push({
                        ...trade,
                        reason: candidate.reason
                    });
                }
            }

            // Step forward
            currentDate.setDate(currentDate.getDate() + config.stepDays);
        }

        return results;
    }

    private async fetchPointInTimeData(asOfDate: string): Promise<StockData[]> {
        const year = parseInt(asOfDate.substring(0, 4));
        const month = parseInt(asOfDate.substring(4, 6));

        // Simplified fetch: Fetch last 60 days of quotes + recent revenues
        // This is a "Heavy" operation.
        const stocks = await prisma.stock.findMany({
            include: {
                monthlyRevenues: {
                    where: {
                        OR: [
                            { year: { lt: year } },
                            { AND: [{ year: year }, { month: { lte: month } }] }
                        ]
                    },
                    orderBy: [{ year: 'desc' }, { month: 'desc' }],
                    take: 6  // 6 months of revenue history
                },
                financialReports: {
                    orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
                    take: 2
                },
                quotes: {
                    where: { date: { lte: asOfDate } },
                    orderBy: { date: 'desc' },
                    take: 120 // Need 60 for MA60 + some buffer
                },
                institutionalChips: {
                    where: { date: { lte: asOfDate } },
                    orderBy: { date: 'desc' },
                    take: 20
                }
            }
        });

        return stocks.map(s => ({
            stockId: s.id,
            name: s.name,
            quotes: s.quotes,
            monthlyRevenues: s.monthlyRevenues,
            financialReports: s.financialReports,
            institutionalChips: s.institutionalChips,
            capital: s.capital ? Number(s.capital) : undefined
        }));
    }

    private async simulateTrade(stockId: string, entryDate: Date, holdingDays: number, config: BacktestConfig, strategy: Strategy): Promise<Omit<TradeResult, 'reason'> | null> {
        // Fetch future prices
        const entryDateStr = entryDate.toISOString().split('T')[0].replace(/-/g, '');

        // Calculate max exit date
        const maxExitDate = new Date(entryDate);
        maxExitDate.setDate(maxExitDate.getDate() + holdingDays);
        const maxExitDateStr = maxExitDate.toISOString().split('T')[0].replace(/-/g, '');

        // Fetch all quotes in the potential holding period
        const quotes = await prisma.stockQuote.findMany({
            where: {
                stockId: stockId,
                date: {
                    gte: entryDateStr,
                    lte: maxExitDateStr
                }
            },
            orderBy: { date: 'asc' }
        });

        if (quotes.length === 0) return null;

        const entryQuote = quotes[0];
        const entryPrice = entryQuote.close;
        let exitQuote = quotes[quotes.length - 1]; // Default to time-based exit

        // Trailing Stop Logic
        let highestPrice = entryPrice;
        let isTrailingActive = false;

        for (let i = 1; i < quotes.length; i++) {
            const quote = quotes[i];
            const currentPrice = quote.close;

            // Update High
            if (currentPrice > highestPrice) highestPrice = currentPrice;

            const currentGain = (currentPrice - entryPrice) / entryPrice;
            const dropFromHigh = (highestPrice - currentPrice) / highestPrice;

            // Dynamic Stop Loss from Strategy (Phase 11)
            // If strategy has intelligent risk management, use it.
            let dynamicStopPrice: number | undefined;
            if (strategy.getOnGoingStopLoss) {
                // Pass history up to current point i
                // Optimization: slice is somewhat expensive, but necessary for correct simulation.
                // We need decent history length for indicators (e.g. 60).
                const historyStart = Math.max(0, i - 100);
                const history = quotes.slice(historyStart, i + 1); // functional slice
                dynamicStopPrice = strategy.getOnGoingStopLoss(quote, history);
            }

            // Check Stop Trigger
            if (dynamicStopPrice && currentPrice < dynamicStopPrice) {
                exitQuote = quote;
                break;
            }

            // Fallback: Fixed PCT Stop Loss
            if (config.stopLoss && currentGain < -config.stopLoss) {
                exitQuote = quote;
                break;
            }

            // Check Trailing Stop Activation (Config based override)
            if (config.trailingStopActivation && currentGain >= config.trailingStopActivation) {
                isTrailingActive = true;
            }

            // Check Trailing Stop Trigger (Config based override)
            if (isTrailingActive && config.trailingStopCallback && dropFromHigh >= config.trailingStopCallback) {
                exitQuote = quote;
                break;
            }
        }

        const returnPercent = ((exitQuote.close - entryQuote.close) / entryQuote.close) * 100;

        return {
            stockId,
            entryDate: entryQuote.date,
            entryPrice: entryQuote.close,
            exitDate: exitQuote.date,
            exitPrice: exitQuote.close,
            returnPercent
        };
    }
}
