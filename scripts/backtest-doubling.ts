import { doublingBacktestService } from '../src/lib/services/DoublingBacktestService';

async function verifyBacktest() {
    console.log('--- Asset Doubling Strategy Backtest ---');
    console.log('Window: 30 days, Horizon: 10 days');

    try {
        const results = await doublingBacktestService.runBacktest(30, 10);

        if (results.length === 0) {
            console.log('No windows matched criteria during the test period.');
            return;
        }

        let totalWins = 0;
        let totalReturn = 0;

        results.forEach(w => {
            console.log(`[${w.startDate}] Candidates: ${w.candidates.length}, Avg Return: ${w.averageReturn.toFixed(2)}%, Success: ${w.successRate.toFixed(1)}%`);
            totalReturn += w.averageReturn;
            if (w.averageReturn > 0) totalWins++;
        });

        console.log('\n--- Summary ---');
        console.log(`Windows: ${results.length}`);
        console.log(`Aggregated Avg Return: ${(totalReturn / results.length).toFixed(2)}%`);
        console.log(`Winning Windows: ${totalWins}/${results.length} (${((totalWins / results.length) * 100).toFixed(1)}%)`);

    } catch (error) {
        console.error('Backtest failed:', error);
    }
}

verifyBacktest().catch(console.error);
