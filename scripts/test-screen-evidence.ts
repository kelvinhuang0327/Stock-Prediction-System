
import { strategyScreeningService } from '../src/lib/services/StrategyScreeningService';

async function testScreenEvidence() {
    console.log('--- Testing Screen Evidence Batch Logic ---');

    // 1. Run Screen
    console.log('Running screen()...');
    const results = await strategyScreeningService.screen({
        minRevenueYoY: 30,
        technicalTrend: 'bullish'
    });

    console.log(`Found ${results.length} candidates.`);

    // 2. Check for evidence
    let evidenceCount = 0;
    results.forEach(r => {
        if (r.backtestEvidence) {
            evidenceCount++;
            console.log(`\n🏆 [Verified] ${r.stockId} ${r.name}`);
            console.log(`   Date: ${r.backtestEvidence.date}`);
            console.log(`   Gain: +${r.backtestEvidence.maxGain.toFixed(1)}% in ${r.backtestEvidence.duration} days`);
        } else {
            console.log(`\n- [No Evidence] ${r.stockId} ${r.name}`);
        }
    });

    console.log(`\nTotal verified candidates: ${evidenceCount} / ${results.length}`);
}

testScreenEvidence().catch(console.error);
