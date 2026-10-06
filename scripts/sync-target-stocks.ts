import { twseApi } from '../src/lib/api/twseApi';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('--- Syncing Target Stocks for Asset Doubling Plan ---');

    // List of stocks to update (Candidates + Major Players)
    // 1713 國泰化, 8374 羅昇, 1717 長興, 3051 力特, 2337 旺宏, 7610 聯友金屬
    // 1789 神隆, 3669 圓展, 4961 天鈺
    // Major: 2330 台積電, 2317 鴻海, 2454 聯發科, 2603 長榮, 2881 富邦金
    const targets = [
        '1713', '8374', '1717', '3051', '2337', '7610',
        '1789', '3669', '4961',
        '2330', '2317', '2454', '2603', '2881'
    ];

    console.log(`Target list: ${targets.join(', ')}`);

    for (const code of targets) {
        console.log(`Fetching history for ${code}...`);
        try {
            // Fetch 1 month of history to cover the gap since Jan 9
            const history = await twseApi.getHistorySeries(code, 1);

            if (history.length === 0) {
                console.log(`No data found for ${code}`);
                continue;
            }

            console.log(`Processing ${history.length} records for ${code}...`);

            for (const quote of history) {
                // Determine if this record update is needed? 
                // Upsert handles it.
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
            console.log(`Synced ${code} successfully.`);

            // Be nice to the API
            await new Promise(r => setTimeout(r, 1000));

        } catch (error) {
            console.error(`Failed to sync ${code}:`, error);
        }
    }

    console.log('--- Sync Compelte ---');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
