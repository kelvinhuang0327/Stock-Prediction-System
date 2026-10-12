
import { BacktestRunner } from '../src/lib/backtest/BacktestRunner';
import { AssetDoublingStrategy } from '../src/lib/strategies/AssetDoublingStrategy';

async function testBacktest() {
    console.log('--- Testing Backtest Runner ---');

    const runner = new BacktestRunner();
    const strategy = new AssetDoublingStrategy();

    // Set a window where we know we have data (TSMC has data from recent script runs)
    // Local data might be sparse, so let's try a recent window
    const endDate = new Date(); // Today
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 90); // Last 3 months

    console.log(`Running backtest for ${strategy.name}`);

    try {
        const results = await runner.run(strategy, {
            startDate,
            endDate,
            stepDays: 14, // Run every 2 weeks
            holdingPeriodDays: 60,
            stopLoss: 0.10, // 10% Stop Loss
            trailingStopActivation: 0.20, // Activate after 20% gain
            trailingStopCallback: 0.05 // Exit if drops 5% from high
        });

        console.log(`\nBacktest Complete.`);
        console.log(`Total Trades: ${results.length}`);

        let wins = 0;
        let totalReturn = 0;

        results.forEach(t => {
            console.log(`[Trade] ${t.stockId} Entry: ${t.entryDate} ($${t.entryPrice}) -> Exit: ${t.exitDate} ($${t.exitPrice}) Return: ${t.returnPercent.toFixed(2)}%`);
            if (t.returnPercent > 0) wins++;
            totalReturn += t.returnPercent;
        });

        if (results.length > 0) {
            console.log(`Win Rate: ${((wins / results.length) * 100).toFixed(1)}%`);
            console.log(`Avg Return: ${(totalReturn / results.length).toFixed(2)}%`);
        }

    } catch (error) {
        console.error('Error running backtest:', error);
    }
}

testBacktest().catch(console.error);
