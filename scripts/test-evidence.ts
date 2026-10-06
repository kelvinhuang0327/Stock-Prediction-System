
import { strategyScreeningService } from '../src/lib/services/StrategyScreeningService';

async function testEvidence() {
    console.log('--- Testing Backtest Evidence Logic ---');

    // Try a few hot stocks
    const symbols = ['2330', '2382', '3231', '3017', '6669'];

    for (const symbol of symbols) {
        console.log(`\nAnalyzing ${symbol}...`);

        try {
            const result = await strategyScreeningService.analyzeStock(symbol);

            if (!result) {
                console.log('Stock not found.');
                continue;
            }

            console.log(`Name: ${result.name}`);
            console.log(`Technical Score: ${result.technicalScore}`);
            console.log(`Revenue YoY: ${result.revenueYoY}%`);

            if (result.backtestEvidence) {
                console.log('✅ [SUCCESS] Backtest Evidence Found:');
                console.log(`Date: ${result.backtestEvidence.date}`);
                console.log(`Duration: ${result.backtestEvidence.duration} days`);
                console.log(`Max Gain: ${result.backtestEvidence.maxGain.toFixed(2)}%`);
                // Break after finding one success to save time? Nah, let's see them all.
            } else {
                console.log('❌ [INFO] No evidence found.');
            }

        } catch (error) {
            console.error('Error during test:', error);
        }
    }
}

testEvidence().catch(console.error);
