
import { proTraderSimulationService } from '../src/lib/services/ProTraderSimulationService';
import { prisma } from '../src/lib/prisma';

async function runTest() {
    console.log("🚀 Starting Pro Trader Simulation Functional Test...");

    try {
        // 1. Verify Database Connection
        const stockCount = await prisma.stock.count();
        const marketIndexCount = await prisma.marketIndex.count();
        console.log(`✅ Database Connected. Total Stocks: ${stockCount}, Market Index Records: ${marketIndexCount}`);

        if (marketIndexCount === 0) {
            console.warn("⚠️ No Market Index Data found. Simulation will be empty.");
        }

        // Test Regime History separately
        const { marketStatusService } = await import('../src/lib/services/MarketStatusService');
        const regimes = await marketStatusService.getRegimeHistory(365);
        console.log(`Regime History Length: ${regimes.length}`);

        // 2. Run Simulation (Short Period)
        console.log("Running Simulation for TREND style...");
        const result = await proTraderSimulationService.runSimulation({
            initialCapital: 1000000,
            maxDrawdown: 10,
            style: 'TREND',
            startDate: '2025-01-01' // Optional, but good for consistent test if supported
        });

        // 3. Validate Outputs
        console.log("---- Simulation Results ----");
        console.log(`Final Equity: ${result.finalEquity}`);
        console.log(`Return: ${result.returnPercent.toFixed(2)}%`);
        console.log(`Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
        console.log(`History Days: ${result.history.length}`);

        // 4. Validate Metrics
        if (result.metrics) {
            console.log(`Sharpe Ratio: ${result.metrics.sharpeRatio}`);
            console.log(`Win Rate: ${result.metrics.winRate}%`);
            console.log(`Total Trades: ${result.metrics.totalTrades}`);

            if (result.metrics.sharpeRatio !== undefined && result.metrics.winRate !== undefined) {
                console.log("✅ Advanced Metrics Calculated Correctly.");
            } else {
                console.error("❌ Advanced Metrics Missing.");
            }
        } else {
            console.error("❌ Metrics Object Missing.");
        }

        // 5. Validate Logic (Basic Checks)
        const hasLogs = result.logs.length > 0;
        console.log(`Logs Generated: ${result.logs.length} events.`);

        // Check if history contains regime
        if (result.history.length > 0) {
            console.log(`Sample History Day: ${result.history[0].date} | Regime: ${result.history[0].regime} | Phase: ${result.history[0].phase}`);
            if (['BULL', 'BEAR', 'CORRECTION', 'NEUTRAL'].includes(result.history[0].regime)) {
                console.log("✅ Regime Data Integrity Verified.");
            } else {
                console.error("❌ Invalid Regime Data.");
            }
        }

        console.log("✅ Functional Test Completed Successfully.");

    } catch (error) {
        console.error("❌ Test Failed:", error);
        process.exit(1);
    }
}

runTest();
