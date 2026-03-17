
import { PrismaClient } from '@prisma/client';
import { AssetDoublingStrategy } from '../src/lib/strategies/AssetDoublingStrategy';
import { StrategyScreeningService } from '../src/lib/services/StrategyScreeningService';
import { SectorAnalysisService } from '../src/lib/services/SectorAnalysisService';
import { newsSentimentService } from '../src/lib/services/NewsSentimentService';
import { notificationService } from '../src/lib/services/NotificationService';


const prisma = new PrismaClient();
const strategy = new AssetDoublingStrategy();
const screener = new StrategyScreeningService();

async function generateBriefing() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Generating Daily Briefing for ${today}...\n`);

    const report: string[] = [];
    report.push(`# 🌅 Daily Asset Doubling Briefing`);
    report.push(`**Date**: ${today}\n`);

    // 1. Market Pulse (Sectors)
    try {
        const sectors = await SectorAnalysisService.getSectorRotationData();
        const topSectors = sectors.slice(0, 3);
        const bottomSectors = sectors.slice(-3).reverse();

        report.push(`## 🌊 Market Pulse (Sector Rotation)`);
        report.push(`**Leading Sectors** (Money Flow In):`);
        topSectors.forEach(s => {
            report.push(`- **${s.name}**: +${s.changePercent.toFixed(2)}% (Vol: ${(s.volume / 1000000).toFixed(0)}M)`);
        });
        report.push(`\n**Lagging Sectors**: ${bottomSectors.map(s => s.name).join(', ')}\n`);
    } catch (e) {
        report.push(`> ⚠️ Failed to fetch sector data.`);
    }

    // 2. New Candidates (Signals)
    try {
        const candidates = await screener.screen({});
        report.push(`## 🚀 New Buy Signals (${candidates.length})`);

        if (candidates.length === 0) {
            report.push(`_No stocks met the strict Asset Doubling criteria today._`);
        } else {
            // Process top 5 with Sentiment
            const topCandidates = candidates.slice(0, 5);
            for (const c of topCandidates) {
                const sentiment = await newsSentimentService.analyze(c.stockId);
                const label = c.potentialLabel || 'New Entry';

                report.push(`- **${c.name} (${c.stockId})** | ${label}`);
                report.push(`  - Rev YoY: ${c.revenueYoY.toFixed(0)}% | Strength: ${c.technicalScore}%`);
                report.push(`  - ⚖️ **Sizing**: Buy **${c.suggestedPositionSize || 0}** lots (Risk: ~$${(c.riskPerShare || 0).toFixed(1)}/share)`);
                report.push(`  - 🤖 **AI Insight**: ${sentiment.label} (Score: ${sentiment.score})`);
                report.push(`    > "${sentiment.headline}"`);
            }
            if (candidates.length > 5) report.push(`  - ... and ${candidates.length - 5} more.`);
        }
        report.push(``);
    } catch (e) {
        report.push(`> ⚠️ Failed to screen for new candidates.`);
    }

    // 3. Portfolio Watch (Risk Management)
    try {
        const watchlist = await prisma.watchlist.findMany({
            include: {
                stock: { include: { quotes: { orderBy: { date: 'desc' }, take: 100 } } }
            }
        });

        report.push(`## 🛡️ Portfolio Watch (${watchlist.length} Positions)`);

        if (watchlist.length > 0) {
            let alerts = 0;
            for (const item of watchlist) {
                const quotes = item.stock.quotes;
                if (quotes.length === 0) continue;

                const currentQuote = quotes[0];
                const currentPrice = currentQuote.close;
                const entryPrice = item.entryPrice || currentPrice;
                const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;

                // Check Dynamic Stop
                const stopPrice = strategy.getOnGoingStopLoss
                    ? strategy.getOnGoingStopLoss(currentQuote, quotes)
                    : undefined;

                const isStopHit = stopPrice && currentPrice < stopPrice;

                let statusIcon = pnl >= 0 ? '🟢' : '🔴';
                if (isStopHit) {
                    statusIcon = '🚨 STOP HIT';
                    alerts++;
                }

                report.push(`- **${item.stock.name}**: ${statusIcon} ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}%`);
                if (isStopHit) {
                    report.push(`  - ⚠️ **Action Required**: Close below dynamic stop (${stopPrice?.toFixed(1)})`);
                }
            }
            if (alerts === 0) report.push(`\n_All positions are safe._`);
        } else {
            report.push(`_Watchlist is empty._`);
        }
    } catch (e) {
        report.push(`> ⚠️ Failed to check watchlist.`);
    }

    // Output Final Report
    const finalReport = report.join('\n');
    console.log(finalReport);

    // Send Notification
    await notificationService.sendLineMessage(finalReport);
}

generateBriefing()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
