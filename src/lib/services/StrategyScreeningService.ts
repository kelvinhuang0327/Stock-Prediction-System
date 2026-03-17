
import { prisma } from '../prisma';
import { ScreeningResult } from '../strategies/types';
import { AssetDoublingStrategy } from '../strategies/AssetDoublingStrategy';
import { MomentumSwingStrategy } from '../strategies/MomentumSwingStrategy';
import { DayTradePrepStrategy } from '../strategies/DayTradePrepStrategy';
import { Strategy } from '../strategies/types';
import { marketStatusService } from './MarketStatusService';
import { simpleCacheService } from './SimpleCacheService';

export type { ScreeningResult };

export interface ScreeningCriteria {
    minRevenueYoY?: number;
    requirePositiveEPS?: boolean;
    minChipStrength?: number;
    technicalTrend?: 'bullish' | 'neutral' | 'any';
    maxCapital?: number; // In 100M
    asOfDate?: string; // YYYYMMDD
    strategy?: string;
}

export class StrategyScreeningService {
    private strategies: Record<string, Strategy> = {
        'AssetDoubling': new AssetDoublingStrategy(),
        'MomentumSwing': new MomentumSwingStrategy(),
        'DayTradePrep': new DayTradePrepStrategy()
    };

    private getStrategy(name?: string): Strategy {
        return this.strategies[name || 'AssetDoubling'] || this.strategies['AssetDoubling'];
    }

    /**
     * Finds stocks matching the strategy criteria
     */
    async screen(criteria: ScreeningCriteria = {}): Promise<ScreeningResult[]> {
        const asOfDate = criteria.asOfDate;
        const strategyName = criteria.strategy || 'AssetDoubling';
        const cleanDate = asOfDate ? asOfDate.replace(/-/g, '') : '';

        // 0. Check Database Cache (Pre-calculated Signals)
        if (cleanDate) {
            const cachedSignals = await prisma.strategySignal.findMany({
                where: {
                    date: cleanDate,
                    strategyName: strategyName
                }
            });

            if (cachedSignals.length > 0) {
                console.log(`[Database] Found ${cachedSignals.length} pre-calculated signals for ${cleanDate}`);
                return cachedSignals.map((s: any) => {
                    const metadata = s.metadata ? JSON.parse(s.metadata) : {};
                    return {
                        stockId: s.stockId,
                        name: s.stockId, // Name not stored in signal for space, client can fetch or use ID
                        revenueYoY: metadata.revenueYoY || 0,
                        eps: 0,
                        chipStrength: 0,
                        technicalScore: s.score || 0,
                        reason: s.reason || '',
                        potentialLabel: s.label || '',
                        climbPercent: metadata.climbPercent || 0,
                        rsScore: metadata.rsScore || 0,
                        closePrice: 0 // Placeholder
                    };
                });
            }
        }

        // 1. Check Memory Cache
        const cacheKey = `screening:${JSON.stringify(criteria)}`;
        const cached = simpleCacheService.get<ScreeningResult[]>(cacheKey);
        if (cached) {
            console.log(`[Cache] Hit for ${cacheKey}`);
            return cached;
        }

        const maxCap = criteria.maxCapital ?? 100; // Default 100亿
        const year = cleanDate ? parseInt(cleanDate.substring(0, 4)) : 0;
        const month = cleanDate ? parseInt(cleanDate.substring(4, 6)) : 0;

        // Date filters for point-in-time analysis
        const revenueFilter = asOfDate ? {
            OR: [
                { year: { lt: year } },
                {
                    AND: [
                        { year: year },
                        { month: { lte: month } }
                    ]
                }
            ]
        } : {};

        const reportFilter = asOfDate ? {
            OR: [
                { year: { lt: year } },
                {
                    AND: [
                        { year: year },
                        { quarter: { lte: Math.ceil(month / 3) } }
                    ]
                }
            ]
        } : {};

        // 1. Fetch stocks
        const stocks = await prisma.stock.findMany({
            where: {
                OR: [
                    { capital: { lte: maxCap * 100000000 } },
                    { capital: null }
                ]
            },
            include: {
                monthlyRevenues: {
                    where: revenueFilter,
                    orderBy: [{ year: 'desc' }, { month: 'desc' }],
                    take: 1
                },
                financialReports: {
                    where: reportFilter,
                    orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
                    take: 1
                },
                quotes: {
                    where: asOfDate ? { date: { lte: asOfDate } } : undefined,
                    orderBy: { date: 'desc' },
                    take: 20
                },
                institutionalChips: {
                    where: asOfDate ? { date: { lte: asOfDate } } : undefined,
                    orderBy: { date: 'desc' },
                    take: 10
                }
            }
        });

        // 1b. Fetch Market Data (TAIEX) for RS Calculation
        // Try 'TAIEX' or 'TSE' or '0050'
        const marketIndex = await prisma.marketIndex.findMany({
            where: {
                name: { in: ['TAIEX', 'TSE', '0050'] }, // Attempt to find main index
                ...(asOfDate ? { date: { lte: asOfDate } } : {})
            },
            orderBy: { date: 'asc' }, // Ascending for easy calculation
            take: 365
        });

        // Map Prisma result to StockData interface
        const stockData = stocks.map(s => ({
            stockId: s.id,
            name: s.name,
            quotes: s.quotes,
            monthlyRevenues: s.monthlyRevenues,
            financialReports: s.financialReports,
            institutionalChips: s.institutionalChips,
            capital: s.capital ? Number(s.capital) : undefined
        }));

        // 1c. Fetch Market Status for Risk Damping (Phase 20)
        const marketStatus = await marketStatusService.getStatus(asOfDate);

        // 2. Delegate to Strategy
        const selectedStrategy = this.getStrategy(criteria.strategy);
        const results = await selectedStrategy.screen(stockData, marketIndex, {
            scalingFactor: marketStatus.scalingFactor,
            regime: marketStatus.regime as any
        });

        // 3. Deep Analysis for Evidence (2-Stage Fetch)
        // Note: Strategy now handles evidence if data is present. 
        // Here we need to fetch deep data for the filtered candidates and re-run analysis/evidence check.

        const candidateIds = results.map(r => r.stockId);

        if (candidateIds.length > 0) {
            const deepStocks = await prisma.stock.findMany({
                where: { id: { in: candidateIds } },
                include: {
                    monthlyRevenues: {
                        orderBy: [{ year: 'desc' }, { month: 'desc' }],
                        take: 36
                    },
                    quotes: {
                        where: asOfDate ? { date: { lte: asOfDate } } : undefined,
                        orderBy: { date: 'desc' },
                        take: 365
                    },
                    financialReports: {
                        orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
                        take: 1
                    },
                    institutionalChips: {
                        orderBy: { date: 'desc' },
                        take: 10
                    }
                }
            });

            // Re-map deep data and re-analyze to get evidence
            const deepStockData = deepStocks.map(s => ({
                stockId: s.id,
                name: s.name,
                quotes: s.quotes,
                monthlyRevenues: s.monthlyRevenues,
                financialReports: s.financialReports,
                institutionalChips: s.institutionalChips
            }));

            // Re-run strategy screen on deep data (this efficiently calculates evidence too)
            const deepResults = await selectedStrategy.screen(deepStockData, marketIndex, {
                scalingFactor: marketStatus.scalingFactor,
                regime: marketStatus.regime as any
            });

            // Replace shallow results with deep results
            return deepResults;
        }

        // Cache the result for 30 minutes (1800s)
        simpleCacheService.set(cacheKey, results, 1800);
        return results;
    }

    async analyzeStock(symbol: string, asOfDate?: string, strategyName?: string): Promise<ScreeningResult | null> {
        const stocks = await prisma.stock.findMany({
            where: { id: symbol },
            include: {
                monthlyRevenues: {
                    orderBy: [{ year: 'desc' }, { month: 'desc' }],
                    take: 36
                },
                financialReports: {
                    orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
                    take: 5
                },
                quotes: {
                    where: asOfDate ? { date: { lte: asOfDate } } : undefined,
                    orderBy: { date: 'desc' },
                    take: 365
                },
                institutionalChips: {
                    where: asOfDate ? { date: { lte: asOfDate } } : undefined,
                    orderBy: { date: 'desc' },
                    take: 10
                }
            }
        });

        if (stocks.length === 0) return null;

        const stock = stocks[0];
        const stockData = {
            stockId: stock.id,
            name: stock.name,
            quotes: stock.quotes,
            monthlyRevenues: stock.monthlyRevenues,
            financialReports: stock.financialReports,
            institutionalChips: stock.institutionalChips
        };

        const selectedStrategy = this.getStrategy(strategyName);
        return selectedStrategy.analyze ? selectedStrategy.analyze(stockData) : null;
    }

    /**
     * Gets top rankings for a specific metric
     */
    async getMetricRankings(metric: string, limit: number = 3, asOfDate?: string): Promise<any[]> {
        const cacheKey = `rankings:${metric}:${asOfDate || 'latest'}`;
        const cached = simpleCacheService.get<any[]>(cacheKey);
        if (cached) return cached;

        // Perform screening with skipFilters for broader rankings
        const strategy = metric.toLowerCase() === 'revenue' ? 'AssetDoubling' : 'AssetDoubling'; // [TEMP] Re-use AssetDoubling with skipFilters
        const results = await this.screen({
            asOfDate,
            strategy,
            options: { skipFilters: true } // Pass skipFilters here
        });

        let sorted = [...results];

        switch (metric.toLowerCase()) {
            case 'rsi':
                // For RSI ranking, we actually want the RS Score as a proxy for momentum strength in this system
                sorted.sort((a, b) => (b.rsScore || 0) - (a.rsScore || 0));
                break;
            case 'revenue':
                sorted.sort((a, b) => (b.revenueYoY || 0) - (a.revenueYoY || 0));
                break;
            case 'rs':
                sorted.sort((a, b) => (b.rsScore || 0) - (a.rsScore || 0));
                break;
            case 'chip':
                sorted.sort((a, b) => (b.chipStrength || 0) - (a.chipStrength || 0));
                break;
            case 'technical':
            default:
                sorted.sort((a, b) => (b.technicalScore || 0) - (a.technicalScore || 0));
        }

        const top = sorted.slice(0, limit).map(r => ({
            stockId: r.stockId,
            name: r.name,
            value: metric.toLowerCase() === 'revenue' ? r.revenueYoY :
                metric.toLowerCase() === 'rs' ? r.rsScore :
                    r.technicalScore,
            label: r.potentialLabel
        }));

        simpleCacheService.set(cacheKey, top, 600); // 10 min cache
        return top;
    }
}

export const strategyScreeningService = new StrategyScreeningService();
