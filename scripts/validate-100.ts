import { prisma } from '../src/lib/prisma';
import { predictionEngine } from '../src/lib/services/PredictionEngine';

async function run100TrialBacktest() {
    // 1. Get all stocks with enough data
    const allStocks = await prisma.stock.findMany({
        include: {
            _count: { select: { quotes: true } }
        }
    });

    const viableStocks = allStocks
        .filter(s => s._count.quotes >= 45)
        .sort(() => 0.5 - Math.random()) // Shuffle
        .slice(0, 200); // Pick 200 stocks

    const results: any[] = [];
    const MAX_TRIALS = 100;

    console.log(`--- Running Expanded 100-Trial Backtest ---`);
    console.log(`Testing up to 100 samples across ${viableStocks.length} stocks...\n`);

    for (const stock of viableStocks) {
        if (results.length >= MAX_TRIALS) break;

        const quotes = await prisma.stockQuote.findMany({
            where: { stockId: stock.id },
            orderBy: { date: 'asc' }
        });

        const totalLen = quotes.length;
        if (totalLen < 40) continue;

        // Test up to 15 separate dates per stock to ensure we hit the 100 cap quickly
        for (let j = 0; j < 15; j++) {
            if (results.length >= MAX_TRIALS) break;

            // Pick a random date that allows for both technical window (30) and forward window (3)
            const i = Math.floor(Math.random() * (totalLen - 35)) + 30;
            const currentQuote = quotes[i];

            // Check if we already tested this date for this stock
            if (results.some(r => r.symbol === stock.id && r.date === currentQuote.date)) continue;

            const asOfDate = currentQuote.date;
            const prediction = await predictionEngine.predict(stock.id, asOfDate);

            if (prediction) {
                const forwardQuote = quotes[i + 3];
                if (!forwardQuote) continue;

                const priceChange = ((forwardQuote.close - currentQuote.close) / currentQuote.close) * 100;

                let isSuccess = false;
                if (prediction.signal === 'BUY' && priceChange > 1.0) isSuccess = true;
                if (prediction.signal === 'SELL' && priceChange < -1.0) isSuccess = true;
                if (prediction.signal === 'HOLD' && Math.abs(priceChange) <= 1.0) isSuccess = true;
                if (prediction.signal === 'CAUTION' && priceChange <= 0) isSuccess = true;

                results.push({
                    symbol: stock.id,
                    date: asOfDate,
                    signal: prediction.signal,
                    actualReturn: priceChange,
                    isSuccess
                });
            }
        }
    }

    // Report
    const total = results.length;
    const successes = results.filter(r => r.isSuccess).length;
    const accuracy = (successes / total) * 100;

    const buyTrades = results.filter(r => r.signal === 'BUY');
    const buyAccuracy = buyTrades.length > 0 ? (buyTrades.filter(r => r.isSuccess).length / buyTrades.length) * 100 : 0;

    const sellTrades = results.filter(r => r.signal === 'SELL');
    const sellAccuracy = sellTrades.length > 0 ? (sellTrades.filter(r => r.isSuccess).length / sellTrades.length) * 100 : 0;

    console.log('\n=== 100-Trial Validation Summary ===');
    console.log(`Total Validations: ${total}`);
    console.log(`Average Accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`BUY Signal Accuracy: ${buyAccuracy.toFixed(2)}% (${buyTrades.length} trials)`);
    console.log(`SELL Signal Accuracy: ${sellAccuracy.toFixed(2)}% (${sellTrades.length} trials)`);
    console.log(`HOLD/CAUTION Frequency: ${(((total - buyTrades.length - sellTrades.length) / total) * 100).toFixed(1)}%`);
}

run100TrialBacktest().catch(console.error);
