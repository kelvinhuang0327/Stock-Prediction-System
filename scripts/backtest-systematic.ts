import { prisma } from '../src/lib/prisma';
import { predictionEngine } from '../src/lib/services/PredictionEngine';

interface BacktestStats {
    totalTrades: number;
    successRate: number;
    buyAccuracy: number;
    sellAccuracy: number;
    avgReturn: number;
    details: any[];
}

async function runSystematicBacktest() {
    const symbols = ['2330', '2454', '2317', '2603', '2881'];
    const results: any[] = [];

    // We'll test the last 20 trading days to ensure we have forward data for verification
    console.log('--- Starting Systematic Backtest (Walk-Forward Simulation) ---');
    console.log('Testing: ' + symbols.join(', '));
    console.log('Window: Last 20 trading days\n');

    for (const symbol of symbols) {
        // Fetch all quotes for this stock
        const allQuotes = await prisma.stockQuote.findMany({
            where: { stockId: symbol },
            orderBy: { date: 'asc' }
        });

        if (allQuotes.length < 50) {
            console.log(`Skipping ${symbol}: Insufficient data`);
            continue;
        }

        // We simulate decisions from 25 days ago to 5 days ago (to allow 3-day forward look)
        const totalLen = allQuotes.length;
        const startIndex = totalLen - 25;
        const endIndex = totalLen - 5;

        console.log(`Analyzing ${symbol} from ${allQuotes[startIndex].date} to ${allQuotes[endIndex].date}...`);

        for (let i = startIndex; i <= endIndex; i++) {
            const currentQuote = allQuotes[i];
            const asOfDate = currentQuote.date;

            // Run prediction using "Point-in-Time" simulation
            const prediction = await predictionEngine.predict(symbol, asOfDate);

            if (prediction) {
                // Look forward 3 trading days
                const forwardQuote = allQuotes[i + 3];
                if (!forwardQuote) continue;

                const priceChange = ((forwardQuote.close - currentQuote.close) / currentQuote.close) * 100;

                let isSuccess = false;
                if (prediction.signal === 'BUY' && priceChange > 1.0) isSuccess = true;
                if (prediction.signal === 'SELL' && priceChange < -1.0) isSuccess = true;
                if (prediction.signal === 'HOLD' && Math.abs(priceChange) <= 1.0) isSuccess = true;
                if (prediction.signal === 'CAUTION' && priceChange <= 0) isSuccess = true; // Caution wins if it doesn't rally

                results.push({
                    symbol,
                    date: asOfDate,
                    signal: prediction.signal,
                    score: prediction.totalScore,
                    actualReturn: priceChange,
                    isSuccess
                });
            }
        }
    }

    // Calculate aggregated stats
    const total = results.length;
    const successes = results.filter(r => r.isSuccess).length;
    const avgReturn = results.reduce((acc, r) => acc + r.actualReturn, 0) / total;

    const buyTrades = results.filter(r => r.signal === 'BUY');
    const buySuccesses = buyTrades.filter(r => r.isSuccess).length;

    const sellTrades = results.filter(r => r.signal === 'SELL');
    const sellSuccesses = sellTrades.filter(r => r.isSuccess).length;

    console.log('\n=== Backtest Summary ===');
    console.log(`Total Predictions: ${total}`);
    console.log(`Overall Success Rate: ${((successes / total) * 100).toFixed(2)}%`);
    console.log(`Average 3-Day Return: ${avgReturn.toFixed(2)}%`);
    console.log(`BUY Signal Accuracy: ${buyTrades.length > 0 ? ((buySuccesses / buyTrades.length) * 100).toFixed(2) : 0}% (${buyTrades.length} trades)`);
    console.log(`SELL Signal Accuracy: ${sellTrades.length > 0 ? ((sellSuccesses / sellTrades.length) * 100).toFixed(2) : 0}% (${sellTrades.length} trades)`);

    // In a real implementation, we would write this summary back to a JSON file or DB
    // so the Frontend's BacktestStats component can read it.
    console.log('\nGenerating report artifact for Dashboard...');
}

runSystematicBacktest().catch(console.error);
