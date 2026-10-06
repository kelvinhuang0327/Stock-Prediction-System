
import { AssetDoublingStrategy } from '../src/lib/strategies/AssetDoublingStrategy';

async function testPhase8() {
    console.log('--- Testing Phase 8: Smart Money & RS ---');

    // 1. Mock Market Data (Generic Uptrend +10% over 60 days)
    const marketData = Array.from({ length: 120 }, (_, i) => ({
        date: `2024${String(i).padStart(3, '0')}`,
        value: 100 * (1 + (i / 120) * 0.1) // Ends at 110 (+10%)
    }));

    // 2. Mock Leader Stock (Strong Uptrend +50%, Trust Buying)
    // Quotes should be DESC (Newest First) to match Service
    const leaderQuotes = Array.from({ length: 120 }, (_, i) => ({
        date: `2024${String(119 - i).padStart(3, '0')}`,
        close: 100 * (1 + ((119 - i) / 120) * 0.5), // Ends at 150
        volume: 1000,
        high: 160, low: 90, open: 100
    }));

    const leaderStock = {
        stockId: 'LEAD',
        name: 'Leader Corp',
        monthlyRevenues: [{ year: 2024, month: 12, yoyGrowth: 50 }],
        quotes: leaderQuotes,
        institutionalChips: [
            { date: '2024120', trustBuy: 100, totalBuy: 100 },
            { date: '2024119', trustBuy: 100, totalBuy: 100 },
            { date: '2024118', trustBuy: 100, totalBuy: 100 }, // 3-day streak
            { date: '2024117', trustBuy: -50, totalBuy: -50 },
        ]
    };

    // 3. Mock Laggard Stock (Downtrend -10%, No Trust)
    const laggardQuotes = Array.from({ length: 120 }, (_, i) => ({
        date: `2024${String(119 - i).padStart(3, '0')}`,
        close: 100 * (1 - ((119 - i) / 120) * 0.1), // Ends at 90
        volume: 1000,
        high: 110, low: 80, open: 100
    }));

    const laggardStock = {
        stockId: 'LAG',
        name: 'Laggard Inc',
        monthlyRevenues: [{ year: 2024, month: 12, yoyGrowth: 50 }],
        quotes: laggardQuotes,
        institutionalChips: []
    };

    const strategy = new AssetDoublingStrategy({ skipFilters: true });

    // @ts-expect-error test fixture uses minimal ad-hoc structure for strategy input
    const results = await strategy.screen([leaderStock, laggardStock], marketData);

    console.table(results.map(r => ({
        Name: r.name,
        RS_Score: r.rsScore,
        Label: r.potentialLabel,
        PriceChg: ((r.closePrice! - 100) / 100 * 100).toFixed(1) + '%'
    })));

    // Verification
    const leader = results.find(r => r.stockId === 'LEAD');
    const lag = results.find(r => r.stockId === 'LAG');

    if (leader && leader.rsScore! > 60 && leader.potentialLabel?.includes('投信認養')) {
        console.log('✅ Leader Logic Verified: High RS & Trust Badge.');
    } else {
        console.error('❌ Leader Logic Failed', leader);
    }

    if (lag && lag.rsScore! < 50) {
        console.log('✅ Laggard Logic Verified: Low RS.');
    } else {
        console.error('❌ Laggard Logic Failed', lag);
    }
}

testPhase8();
