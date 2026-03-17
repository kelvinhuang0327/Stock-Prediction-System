import { syncService } from '../src/lib/services/syncService';
import { twseApi } from '../src/lib/api/twseApi';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('--- Real-World Data Synchronization Start ---');

    // 1. Sync Basic Info (Capital, Industry, etc.)
    console.log('Step 1: Syncing Basic Info...');
    await syncService.syncBasicInfo();

    // 2. Sync Monthly Revenue Summary (Real data for all stocks)
    console.log('Step 2: Syncing Real Monthly Revenue Summary...');
    await syncService.syncRealRevenue();

    // 2.5 Sync Daily Statistics (Snapshot for ALL stocks today)
    console.log('Step 2.5: Syncing Daily Quotes & Metrics...');
    await syncService.syncDailyQuotes();
    await syncService.syncMetrics();
    await syncService.syncMarketIndices();

    // 3. Sync Historical Quotes for candidates
    // We pick TSMC and others as a start, or we can fetch TOP volume stocks
    console.log('Step 3: Syncing Historical Quotes for Top Stocks...');
    const topGainers = await twseApi.getTopGainers(10);
    const codes = [...new Set(['2330', '2317', '2454', '2603', '2881', ...topGainers.map(s => s.code)])];

    for (const code of codes) {
        console.log(`Syncing history for ${code}...`);
        const history = await twseApi.getHistorySeries(code, 3); // 3 months for indicators

        for (const quote of history) {
            await prisma.stockQuote.upsert({
                where: {
                    stockId_date: {
                        stockId: code,
                        date: quote.date
                    }
                },
                update: {
                    open: quote.open,
                    high: quote.high,
                    low: quote.low,
                    close: quote.close,
                    volume: quote.volume,
                    tradeValue: quote.tradeValue,
                    change: quote.change,
                    transactions: quote.transactions
                },
                create: {
                    stockId: code,
                    date: quote.date,
                    open: quote.open,
                    high: quote.high,
                    low: quote.low,
                    close: quote.close,
                    volume: quote.volume,
                    tradeValue: quote.tradeValue,
                    change: quote.change,
                    transactions: quote.transactions
                }
            });
        }
        console.log(`Done history for ${code} (${history.length} days).`);
        await new Promise(r => setTimeout(r, 500)); // Rate limit safety
    }

    console.log('--- Real-World Data Synchronization Complete ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
