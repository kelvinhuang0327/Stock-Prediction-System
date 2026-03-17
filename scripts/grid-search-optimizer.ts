
import { AssetDoublingStrategy, AssetDoublingConfig } from '../src/lib/strategies/AssetDoublingStrategy';
import { BacktestRunner } from '../src/lib/backtest/BacktestRunner';

interface OptimizationResult {
    params: AssetDoublingConfig;
    totalTrades: number;
    winRate: number;
    avgReturn: number;
    totalReturn: number;
    score: number; // Custom score to rank (e.g., WinRate * 0.7 + AvgReturn * 0.3)
    trailingStopActivation: number;
}

async function runOptimization() {
    console.log('--- Starting Grid Search Optimization ---');

    // 1. Define Parameter Grid (Standard Production Run)
    const revenueOptions = [20, 30, 40];
    const maShortOptions = [10, 20];
    const maLongOptions = [60];
    const trailingStopActivationOptions = [0.15, 0.20, 0.25, 0.30];

    // Total Combinations: 3 * 2 * 1 * 3 = 18 combinations (Manageable for local run)

    const runner = new BacktestRunner();

    // Set Time Window: Recent 6 months for better relevance
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 6);

    const results: OptimizationResult[] = [];

    let count = 1;
    const total = revenueOptions.length * maShortOptions.length * maLongOptions.length * trailingStopActivationOptions.length;

    for (const rev of revenueOptions) {
        for (const maS of maShortOptions) {
            for (const maL of maLongOptions) {
                for (const trailAct of trailingStopActivationOptions) {

                    const config: AssetDoublingConfig = {
                        minRevenueYoY: rev,
                        maShort: maS,
                        maLong: maL,
                        minTechnicalScore: 75,
                        atrFilterRatio: 5
                    };

                    console.log(`[${count}/${total}] Testing: Rev>${rev}%, MA${maS}/${maL}, Trail>${trailAct * 100}%`);

                    const strategy = new AssetDoublingStrategy(config);

                    try {
                        const tradeResults = await runner.run(strategy, {
                            startDate,
                            endDate,
                            stepDays: 14,
                            holdingPeriodDays: 60,
                            stopLoss: 0.10, // Fixed Stop Loss for now
                            trailingStopActivation: trailAct,
                            trailingStopCallback: 0.05 // Fixed 5% callback
                        });

                        const trades = tradeResults.length;
                        if (trades > 0) {
                            const wins = tradeResults.filter(t => t.returnPercent > 0).length;
                            const winRate = (wins / trades) * 100;
                            const totalRet = tradeResults.reduce((sum, t) => sum + t.returnPercent, 0);
                            const avgRet = totalRet / trades;

                            // Score: Emphasize Win Rate (Stability) but require decent return
                            // Score = WinRate (0-100) + AvgReturn (0-inf) * 2
                            const score = winRate + (avgRet * 2);

                            results.push({
                                params: config,
                                totalTrades: trades,
                                winRate,
                                avgReturn: avgRet,
                                totalReturn: totalRet,
                                score,
                                trailingStopActivation: trailAct
                            });
                        }

                    } catch (e) {
                        console.error('Error in iteration:', e);
                    }

                    count++;
                }
            }
        }
    }

    // Sort by Score
    results.sort((a, b) => b.score - a.score);

    console.log('\n--- Optimization Results (Top 5) ---');
    results.slice(0, 5).forEach((r, idx) => {
        console.log(`#${idx + 1} Score: ${r.score.toFixed(1)} | Win: ${r.winRate.toFixed(1)}% | AvgRet: ${r.avgReturn.toFixed(1)}% | Trades: ${r.totalTrades}`);
        console.log(`   Params: Rev>${r.params.minRevenueYoY}%, MA${r.params.maShort}/${r.params.maLong}, Trail>${(r.trailingStopActivation * 100).toFixed(0)}%`);
    });

    // Validating Parameter Sensitivity
    console.log('\n--- Parameter Sensitivity ---');
    console.log('Best Revenue Threshold:', results[0].params.minRevenueYoY + '%');
    console.log('Best MA Short:', results[0].params.maShort);

    // We didn't store trailing stop in params to print it out perfectly in the summary logic above easily without modifying the result struct.
    // But since we want to know the best trailing stop, let's just log detailed best result.

    // Save to file
    const fs = require('fs');
    fs.writeFileSync('scripts/optimization-results.json', JSON.stringify(results.slice(0, 5), null, 2));
    console.log('Results saved to scripts/optimization-results.json');
}

runOptimization().catch(console.error);
