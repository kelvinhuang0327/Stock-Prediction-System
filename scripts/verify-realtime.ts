
import { realTimeService } from '../src/lib/services/RealTimeService';

async function verify() {
    console.log("🚀 Verifying RealTimeService...");

    const targets = ['6531']; // AP Memory
    console.log(`Fetching quotes for: ${targets.join(', ')}`);

    const start = Date.now();
    const quotes = await realTimeService.getQuotes(targets);
    const duration = Date.now() - start;

    console.log(`✅  Fetched ${quotes.length} quotes in ${duration}ms`);

    if (quotes.length === 0) {
        console.error("❌ No quotes returned. Market might be closed or API change.");
        // Even if closed, it usually returns "Yesterday Close"
    }

    for (const q of quotes) {
        console.log(`\n📄 Stock: ${q.name} (${q.code})`);
        console.log(`   Price: ${q.tradePrice}`);
        console.log(`   Time:  ${q.tradeTime}`);
        console.log(`   Vol:   ${q.accumulatedVolume}`);
        console.log(`   Bid:   ${q.bestBidPrice.join(', ')}`);
        console.log(`   Ask:   ${q.bestAskPrice.join(', ')}`);

        if (q.tradePrice <= 0) console.warn("   ⚠️ Price is zero or invalid");
    }

    // Double check cache
    console.log("\n🔄 Checking Cache (Immediate Retry)...");
    const start2 = Date.now();
    await realTimeService.getQuotes(targets); // Should be instant
    const duration2 = Date.now() - start2;
    console.log(`✅  Cache fetch took ${duration2}ms (Should be < 10ms)`);
}

verify().catch(console.error);
