import { twseApi } from '../src/lib/api/twseApi';
import { newsService } from '../src/lib/services/NewsService';
import { majorPlayerService } from '../src/lib/services/MajorPlayerService';
import { predictionEngine } from '../src/lib/services/PredictionEngine';

async function comprehensiveTest() {
    const symbols = ['2330', '2454', '2603'];
    console.log(`=== Multi-Stock Comprehensive System Test ===\n`);

    for (const symbol of symbols) {
        console.log(`--- Testing Stock: ${symbol} ---`);

        // 1. Test TWSE API (Real-time Quote)
        console.log('[1/4] Testing TWSE Real-time Data...');
        const quote = await twseApi.getFullStockData(symbol);
        if (quote) {
            console.log(`✅ Quote OK: ${quote.name} Price: ${quote.close}, Change: ${quote.change}`);
        } else {
            console.log(`❌ Quote Failed`);
        }

        // 2. Test News Service (Live Headlines)
        console.log('\n[2/4] Testing Live News (Anue API)...');
        const news = await newsService.fetchLatestNews(symbol, 3);
        if (news && news.length > 0) {
            console.log(`✅ News OK: Found ${news.length} live headlines.`);
            news.slice(0, 2).forEach((n, i) => console.log(`   - [${i + 1}] ${n.title.substring(0, 40)}...`));
        } else {
            console.log(`❌ News Failed or empty`);
        }

        // 3. Test Major Player Analysis (Attribution)
        console.log('\n[3/4] Testing Major Player Analysis...');
        const chips = await majorPlayerService.analyze(symbol);
        if (chips) {
            console.log(`✅ Chips OK: Dominant Player: ${chips.dominantPlayer}`);
            console.log(`   Avg Cost: ${chips.averageCost}, Target: ${chips.targetPrice}`);
        } else {
            console.log(`❌ Chips Analysis Failed`);
        }

        // 4. Test Hybrid Prediction Engine (Final Signal)
        console.log('\n[4/4] Testing Final Hybrid AI Signal...');
        const result = await predictionEngine.predict(symbol);
        if (result) {
            const chipStrength = result.majorPlayer?.strength ?? 50;
            console.log(`✅ Signal OK: ${result.signal} (Total Score: ${result.totalScore})`);
            console.log(`   Breakdown -> Tech: ${result.technicalScore}, News: ${result.newsScore}, Chips: ${chipStrength}`);

            const expected = Math.round(
                (result.technicalScore * 0.5) +
                (result.newsScore * 0.3) +
                (chipStrength * 0.2)
            );
            if (Math.abs(result.totalScore - expected) <= 1) {
                console.log(`✅ Scoring Logic Verified`);
            } else {
                console.log(`❌ Scoring Logic Inconsistent: Expected ${expected}, Got ${result.totalScore}`);
            }
        } else {
            console.log(`❌ Prediction Engine Failed`);
        }
        console.log('\n');
    }

    console.log(`=== Multi-Stock Test Complete ===`);
    process.exit(0);
}

comprehensiveTest().catch(err => {
    console.error('Test Execution Error:', err);
    process.exit(1);
});
