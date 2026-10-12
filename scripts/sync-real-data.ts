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

    // --- OHLC Integrity Assertions ---
    // Query recent rows and assert basic OHLC invariants. Do NOT change data, only fail loudly so sync pipeline surfaces issues.
    async function checkOHLCIntegrity() {
        // Check last 7 days of quotes
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const sinceStr = since.toISOString().slice(0,10).replace(/-/g,'');

        const badRows = await prisma.$queryRaw`
            SELECT stockId, date, open, high, low, close, volume
            FROM StockQuote
            WHERE date >= ${sinceStr}
              AND (
                high < low
                OR open > high
                OR open < low
                OR close > high
                OR close < low
                OR open <= 0
                OR high <= 0
                OR low <= 0
                OR close <= 0
              )
            LIMIT 100
        ` as any[];

        if (badRows.length > 0) {
            console.error('OHLC integrity check FAILED. Sample bad rows:', badRows.slice(0,10));
            // Also write a SyncLog entry for visibility
            await prisma.syncLog.create({ data: {
                endpoint: 'stock_quote_integrity_check',
                status: 'failed',
                records: badRows.length,
                duration: 0,
                error: 'OHLC invariants violated in recent quotes',
                metadata: JSON.stringify({ sample: badRows.slice(0,10) })
            }});
            // Fail loudly so CI/pipeline can capture
            throw new Error('OHLC integrity violations detected during sync. See SyncLog entry.');
        } else {
            await prisma.syncLog.create({ data: {
                endpoint: 'stock_quote_integrity_check',
                status: 'success',
                records: 0,
                duration: 0,
                metadata: JSON.stringify({ checked_since: sinceStr })
            }});
            console.log('OHLC integrity check passed.');
        }
    }

    await checkOHLCIntegrity();

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
