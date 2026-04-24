
import { strategyScreeningService } from '../src/lib/services/StrategyScreeningService';
import { prisma } from '../src/lib/prisma';

async function analyzeTargetStocks(symbols: string[]) {
    console.log('--- Target Stock Analysis ---');

    for (const symbol of symbols) {
        console.log(`\nAnalyzing ${symbol}...`);

        try {
            const result = await strategyScreeningService.analyzeStock(symbol);

            if (!result) {
                console.log('Stock not found in screening service.');
                continue;
            }

            // Get latest quote for price reference
            const latestQuote = await prisma.stockQuote.findFirst({
                where: { stockId: symbol },
                orderBy: { date: 'desc' }
            });

            console.log(`Name: ${result.name}`);
            console.log(`Current Price: ${latestQuote?.close}`);
            console.log(`Technical Score: ${result.technicalScore}`);
            console.log(`RS Score: ${result.rsScore}`);
            console.log(`RS Score: ${result.rsScore ?? 'N/A'}`);

            // Analyze for Buy/Sell recommendation
            if (result.technicalScore > 70) {
                console.log('Recommendation: BUY (Strong Momentum)');
                console.log(`Entry Suggestion: ${latestQuote?.close}`);
                console.log(`Stop Loss: ${(latestQuote?.close || 0) * 0.93}`);
                console.log(`Take Profit: ${(latestQuote?.close || 0) * 1.15}`);
            } else if (result.technicalScore < 40) {
                console.log('Recommendation: SELL/AVOID (Weakness)');
            } else {
                console.log('Recommendation: HOLD/WATCH');
            }

        } catch (error) {
            console.error(`Error analyzing ${symbol}:`, error);
        }
    }
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
    analyzeTargetStocks(['2337', '2014', '2330']);
} else {
    analyzeTargetStocks(targets);
}
