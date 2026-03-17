
import { AssetDoublingStrategy } from '../src/lib/strategies/AssetDoublingStrategy';
import { prisma } from '../src/lib/prisma';

async function testIgnition() {
    console.log('--- Testing Ignition & Overheated Logic ---');

    // Fetch specific active stocks
    const stocks = await prisma.stock.findMany({
        where: {
            id: { in: ['2330', '2317', '2454', '2603', '2609', '1316', '3231'] }
        },
        include: {
            monthlyRevenues: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 2 },
            financialReports: { orderBy: [{ year: 'desc' }, { quarter: 'desc' }], take: 1 },
            institutionalChips: { orderBy: { date: 'desc' }, take: 10 },
            quotes: { orderBy: { date: 'desc' }, take: 120 }
        }
    });

    console.log(`Fetched ${stocks.length} stocks. Running Strategy Screen...`);

    const strategy = new AssetDoublingStrategy({ skipFilters: true });

    // Map to StockData
    const stockData = stocks.map((s: any) => ({
        stockId: s.id,
        name: s.name,
        quotes: s.quotes,
        monthlyRevenues: s.monthlyRevenues,
        financialReports: s.financialReports,
        institutionalChips: s.institutionalChips,
        capital: s.capital ? Number(s.capital) : undefined
    }));

    const results = await strategy.screen(stockData);

    console.log(`\nScreened ${results.length} Candidates.\n`);
    console.log('--- Label Analysis ---');

    let rocketCount = 0;
    let warningCount = 0;
    let gemCount = 0;

    results.forEach(r => {
        const label = r.potentialLabel || 'None';
        if (label.includes('🚀')) rocketCount++;
        if (label.includes('⚠️')) warningCount++;
        if (label.includes('💎')) gemCount++;

        console.log(`[${r.stockId} ${r.name}] ${label} | Gain: ${r.climbPercent?.toFixed(1)}% | Score: ${r.technicalScore}`);
    });

    console.log('\n--- Summary ---');
    console.log(`🚀 Ignition: ${rocketCount}`);
    console.log(`⚠️ Overheated: ${warningCount}`);
    console.log(`💎 Gems: ${gemCount}`);
}

testIgnition().catch(console.error);
