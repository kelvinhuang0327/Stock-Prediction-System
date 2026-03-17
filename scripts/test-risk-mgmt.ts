
import { AssetDoublingStrategy } from '../src/lib/strategies/AssetDoublingStrategy';

async function testRiskManagement() {
    console.log('--- Testing Phase 10: Realistic Backtest (Stop Loss Simulation) ---');

    console.log('1. Testing Suggested Stop Loss (Current)');
    // 120 Days of history
    // Scenario: Uptrend then Crash.
    // Days 0-99: Uptrend. Price 100 -> 200.
    // Days 100-119: Crash. Price 200 -> 150.

    // Logic: 
    // If we run screen on Day 119 (Today), we should see a Stop suggestion.
    // If we run screen on Day 80 (Backtest), we should see a high max gain.
    // If we run screen on Day 100 (Backtest), we should see a stop out shortly after?

    // Construct Data ASC (Oldest First) for clarity
    // Day 0-59: Flat 100
    // Day 60-99: Rally 100 -> 180 (+2 per day) -> Signal should be found here
    // Day 100-119: Peak/Chop 180
    // Day 120-149: Crash 180 -> 100

    const quotesAsc = Array.from({ length: 150 }, (_, i) => {
        let close = 100;
        if (i < 60) close = 100;
        else if (i < 100) close = 100 + (i - 59) * 2;
        else if (i < 120) close = 180;
        else close = 180 - (i - 119) * 3;

        // Date ASC: Jan 1 + i days
        const date = new Date(2024, 0, 1 + i);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');

        return {
            date: `${yyyy}${mm}${dd}`,
            close: close,
            high: close + 2,
            low: close - 2, // Low is close - 2. Stop logic uses Low. 
            open: close,
            volume: 1000
        };
    });

    const quotes = quotesAsc.reverse(); // Strategy expects DESC

    // Monthly Revenue for all months to ensure matching
    // Need match for Jan, Feb, Mar 2024 etc.
    const monthlyRevenues = Array.from({ length: 12 }, (_, i) => ({
        year: 2024,
        month: i + 1,
        yoyGrowth: 50
    }));

    // Mock Market
    const marketData = Array.from({ length: 150 }, (_, i) => ({
        date: `2024${String(i).padStart(3, '0')}`,
        value: 100
    }));

    const stock = {
        stockId: 'REAL_TEST',
        name: 'Realistic Corp',
        monthlyRevenues: monthlyRevenues,
        quotes: quotes,
        institutionalChips: []
    };

    const strategy = new AssetDoublingStrategy({ skipFilters: true });

    // @ts-ignore
    const results = await strategy.screen([stock], marketData);
    const result = results[0];

    console.log('Current Analysis (Day 150):');
    console.log(`- Close: ${result.closePrice}`);
    console.log(`- Stop Loss: ${result.suggestedStopLoss}`);
    console.log(`- Reason: ${result.stopLossReason}`);

    if (result.backtestEvidence) {
        console.log('\nBacktest Evidence (Simulated):');
        console.log(`- Date: ${result.backtestEvidence.date}`);
        console.log(`- Max Gain (Risk Adjusted): ${result.backtestEvidence.maxGain.toFixed(1)}%`);
        console.log(`- Duration: ${result.backtestEvidence.duration} days`);

        // Expected behavior:
        // The backtest looks at historical signals starting from >60 days ago.
        // Our data is 150 days long.
        // It skips first 60 days (recent).
        // Checks days 60...end.
        // In our DESC array, index 60 is Day 90 (150-60). Price ~190.
        // Trend is UP.
        // It simulates 60 days forward.
        // Day 90 (Price 190) -> Day 30 (Price ~140). It hits peak then crashes.
        // Should find a signal that rode the uptrend?
        // Or if it picked a signal right before the crash, it should stop out.

        if (result.backtestEvidence.maxGain > 0) {
            console.log('✅ Evidence Found (Risk Adjusted).');
        }
    } else {
        console.log('⚠️ No Evidence Found (Might be data parsing or trend issues).');
    }
}

testRiskManagement();
