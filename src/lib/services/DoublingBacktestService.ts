import { BacktestRunner } from '../backtest/BacktestRunner';
import { AssetDoublingStrategy } from '../strategies/AssetDoublingStrategy';

export interface BacktestWindow {
    startDate: string;
    endDate: string;
    candidates: any[];
    averageReturn: number;
    successRate: number; // % of stocks with positive return
}

export class DoublingBacktestService {
    private runner: BacktestRunner;
    private strategy: AssetDoublingStrategy;

    constructor() {
        this.runner = new BacktestRunner();
        this.strategy = new AssetDoublingStrategy();
    }

    /**
     * Runs backtest for the asset doubling strategy
     */
    async runBacktest(days: number = 30, horizon: number = 10): Promise<BacktestWindow[]> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days - horizon); // Ensure we cover the window

        const config = {
            startDate: startDate,
            endDate: endDate,
            stepDays: 3, // Overlapping windows every 3 days
            holdingPeriodDays: horizon,
            stopLoss: 0.1, // 10% Hard Stop fallback
        };

        // Run the rigorous backtest
        // Note: runner.run returns TradeResult[] which is a flat list of trades.
        // We need to group them by 'Window' to match UI expectation, or adapt the UI.
        // For 'BacktestDashboard', it expects "Windows". 

        // Strategy: We will run the runner, then group trades by EntryDate.
        const trades = await this.runner.run(this.strategy, config);

        // Group by Entry Date to simulate "Windows"
        const grouped: Record<string, typeof trades> = {};
        for (const trade of trades) {
            if (!grouped[trade.entryDate]) grouped[trade.entryDate] = [];
            grouped[trade.entryDate].push(trade);
        }

        // Convert to BacktestWindow[]
        const windows: BacktestWindow[] = Object.entries(grouped).map(([date, windowTrades]) => {
            if (windowTrades.length === 0) return null;

            const totalReturn = windowTrades.reduce((sum, t) => sum + t.returnPercent, 0);
            const wins = windowTrades.filter(t => t.returnPercent > 0).length;

            // Approximate End Date (Logic: Entry + Horizon)
            // Note: Trade.exitDate might be earlier due to Stop Loss.
            // We use the 'theoretical' end date for the window label.

            return {
                startDate: date,
                endDate: `${date} +${horizon}d`,
                candidates: windowTrades.map(t => ({
                    stockId: t.stockId,
                    returnPercent: t.returnPercent,
                    reason: t.reason,
                    exitReason: t.returnPercent < 0 ? 'Stop Loss' : 'Target/Time'
                })),
                averageReturn: totalReturn / windowTrades.length,
                successRate: (wins / windowTrades.length) * 100
            };
        }).filter(Boolean) as BacktestWindow[];

        // Sort by date desc
        return windows.sort((a, b) => b.startDate.localeCompare(a.startDate));
    }
}

export const doublingBacktestService = new DoublingBacktestService();
