
import { strategyScreeningService } from './src/lib/services/StrategyScreeningService';

async function test() {
    try {
        console.log("Screening stocks...");
        const results = await strategyScreeningService.screen({});

        console.log("Top 5 Results:");
        results.slice(0, 5).forEach(r => {
            console.log(`Stock: ${r.name} (${r.stockId})`);
            console.log(`- Revenue YoY: ${r.revenueYoY}%`);
            console.log(`- Chip Strength: ${r.chipStrength}%`);
            console.log(`- Technical Score: ${r.technicalScore}%`);
            console.log(`- Potential: ${r.potentialLabel}`);
            console.log(`- Climb: ${r.climbPercent}%`);
            console.log("---");
        });
    } catch (e) {
        console.error(e);
    }
}

test();
