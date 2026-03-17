
import { prisma } from '../prisma';
import { StrategyScreeningService } from './StrategyScreeningService';
import { AssetDoublingStrategy } from '../strategies/AssetDoublingStrategy';

export class SignalPrecalculationService {
    private screener: StrategyScreeningService;

    constructor() {
        this.screener = new StrategyScreeningService();
    }

    /**
     * Pre-calculates signals for all stocks for a specific date and strategy
     */
    async precomputeForDate(date: string, strategyName: string = 'AssetDoubling'): Promise<number> {
        console.log(`[SignalPrecalculation] Pre-computing ${strategyName} for ${date}...`);

        // 1. Run the screener for the specific date
        // Note: StrategyScreeningService.screen() returns only candidates.
        // We might need a modified version that returns ALL stocks with their scores 
        // OR we just store the candidates as TRUE and others as FALSE if we want a sparse index.
        // For performance, storing only candidates (Signal=TRUE) is better for space, 
        // but Signal=FALSE is useful for negative proof in backtests.
        // Let's store candidates for now.

        const results = await this.screener.screen({
            asOfDate: date,
            strategy: strategyName
        });

        if (results.length === 0) {
            console.log(`[SignalPrecalculation] No signals found for ${date}.`);
            return 0;
        }

        // 2. Persist to StrategySignal
        const yyyymmdd = date.replace(/-/g, '');
        const records = results.map(r => ({
            stockId: r.stockId,
            date: yyyymmdd,
            strategyName,
            isSignal: true,
            score: r.technicalScore,
            label: r.potentialLabel,
            reason: r.reason,
            metadata: JSON.stringify({
                revenueYoY: r.revenueYoY,
                climbPercent: r.climbPercent,
                rsScore: r.rsScore
            })
        }));

        // Use transaction for idempotency (SQLite compatible)
        const count = await prisma.$transaction([
            prisma.strategySignal.deleteMany({
                where: {
                    date: yyyymmdd,
                    strategyName
                }
            }),
            prisma.strategySignal.createMany({
                data: records
            })
        ]);

        console.log(`[SignalPrecalculation] Saved ${count[1].count} signals for ${date}.`);
        return count[1].count;
    }

    /**
     * Pre-calculates signals for a date range
     */
    async precomputeRange(startDate: string, endDate: string, strategyName: string = 'AssetDoubling'): Promise<void> {
        let current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0];
            await this.precomputeForDate(dateStr, strategyName);

            // Advance 1 day
            current.setDate(current.getDate() + 1);
        }
    }
}

export const signalPrecalculationService = new SignalPrecalculationService();
