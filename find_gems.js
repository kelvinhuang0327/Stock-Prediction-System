
const { strategyScreeningService } = require('./src/lib/services/StrategyScreeningService');
const { prisma } = require('./src/lib/prisma');

async function findHiddenGems() {
    try {
        console.log('--- Initial 30/30/30 Market Screen ---');
        const results = await strategyScreeningService.screen({
            minRevenueYoY: 30,
            technicalTrend: 'any',
            maxCapital: 100 // Focus on small-to-mid caps
        });

        console.log(`Found ${results.length} stocks meeting basic 30/30/30 criteria.`);
        console.log('--- Filtering for Low-Base (Early Technical Stage) ---\n');

        for (const stock of results) {
            // Fetch last 60 days of quotes to check "climb"
            const quotes = await prisma.stockQuote.findMany({
                where: { stockId: stock.stockId },
                orderBy: { date: 'desc' },
                take: 60
            });

            if (quotes.length < 20) continue;

            const currentPrice = stock.closePrice;
            const prices = quotes.map(q => q.close);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);

            const climbRatio = currentPrice / minPrice;

            // Filter out stocks that have already climbed > 50% in last 60 days
            if (climbRatio > 1.5) continue;

            // Also check if it's "consolidating" (current price not at the very top of 60D range)
            const rangePos = (currentPrice - minPrice) / (maxPrice - minPrice);

            // Looking for stocks that are breaking out (rangePos > 0.6) but not overextended
            if (climbRatio < 1.3 && rangePos > 0.4) {
                console.log(`[${stock.stockId}] ${stock.name}`);
                console.log(`Growth: ${stock.revenueYoY.toFixed(1)}% | Chips: ${stock.chipStrength}% | Tech Score: ${stock.technicalScore}%`);
                console.log(`Climb from 60D Low: +${((climbRatio - 1) * 100).toFixed(1)}% (Low Base!)`);
                console.log(`Reason: ${stock.reason}\n`);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

findHiddenGems();
