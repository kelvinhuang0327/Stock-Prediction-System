
import { prisma } from '../src/lib/prisma';
import { marketStatusService } from '../src/lib/services/MarketStatusService';
import { notificationService } from '../src/lib/services/NotificationService';
import { strategyScreeningService } from '../src/lib/services/StrategyScreeningService';

// Run the Monitor
async function run() {
    console.log("🔍 Starting System Watchdog...");
    const alerts: string[] = [];

    // 1. Check Market Regime
    try {
        const market = await marketStatusService.getStatus();
        console.log(`Market Status: ${market.status} (Index: ${market.indexClose})`);

        if (market.status === 'Bearish') {
            alerts.push(`⛔ **MARKET ALERT**: TAIEX entered BEAR Market (Index ${market.indexClose} < MA60 ${market.ma60.toFixed(0)}).\nSystem set to Safety Mode (Risk Damped to 25%).`);
        } else if (market.status === 'Correction') {
            alerts.push(`⚠️ **MARKET WARNING**: TAIEX in Correction (Index < MA20). Risk Damped to 50%.`);
        }
    } catch (e) {
        console.error("Failed to check market status:", e);
    }

    // 2. Check Portfolio Risks
    try {
        const watchlist = await prisma.watchlist.findMany();
        console.log(`Checking ${watchlist.length} portfolio positions...`);

        for (const item of watchlist) {
            // Analyze each stock to get current Stop Loss
            const analysis = await strategyScreeningService.analyzeStock(item.stockId);
            if (!analysis) continue;

            const currentPrice = analysis.closePrice || 0;
            const entryPrice = item.entryPrice || 0;
            const stopLoss = analysis.suggestedStopLoss || 0;

            if (entryPrice === 0 || currentPrice === 0) continue;

            const profit = ((currentPrice - entryPrice) / entryPrice) * 100;

            // Check Hard Stop Rule
            if (currentPrice < stopLoss) {
                alerts.push(`🚨 **SELL ALERT**: ${analysis.name} (${item.stockId}) broke Stop Loss!\nPrice: ${currentPrice} | Stop: ${stopLoss}\nP&L: ${profit.toFixed(1)}%`);
            }
            // Check Profit Taking (e.g., > 30%) - Optional notification
            else if (profit > 30) {
                // alerts.push(`💰 **WINNER**: ${analysis.name} is up +${profit.toFixed(1)}%! Consider trailing stop.`);
            }
        }
    } catch (e) {
        console.error("Failed to check portfolio:", e);
    }

    // 3. Send Notifications if any
    if (alerts.length > 0) {
        console.log(`Triggering ${alerts.length} alerts...`);
        const message = alerts.join('\n\n');
        await notificationService.sendLineMessage(message);
    } else {
        console.log("✅ System Nominal. No alerts triggered.");
    }
}

run()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
