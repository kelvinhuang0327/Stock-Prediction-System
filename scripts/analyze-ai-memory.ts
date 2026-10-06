
import { prisma } from '../src/lib/prisma';
import { syncService } from '../src/lib/services/syncService';
import { calculateAllIndicators } from '../src/lib/technicalIndicators';

// AI Memory Candidates
// 6531: 愛普* (3D Stacking/WoW for AI)
// 2408: 南亞科 (DDR5)
// 2344: 華邦電 (High Bandwidth/Edge AI)
// 8299: 群聯 (NAND Controllers/aiDAPTIV+)
// 4967: 十銓 (DDR5 Modules)
// 3260: 威剛 (DDR5 Modules)
// 5289: 宜鼎 (Edge AI)
// 3006: 晶豪科 (Specialty DRAM)

const CANDIDATES = [
    { id: '6531', name: '愛普*' },
    { id: '2408', name: '南亞科' },
    { id: '2344', name: '華邦電' },
    { id: '8299', name: '群聯' },
    { id: '4967', name: '十銓' },
    { id: '3260', name: '威剛' },
    { id: '5289', name: '宜鼎' },
    { id: '3006', name: '晶豪科' }
];

async function analyze() {
    console.log("🔄 Syncing data for AI Memory candidates...");

    // 1. Force Sync for candidates (to ensure we have today 2026-01-28 data if available)
    for (const c of CANDIDATES) {
        // Fetch last 3 months to be safe for indicators
        await syncService.syncStockHistory(c.id, 3);
    }

    // Also sync revenue for these? revenue sync is bulk. We assume bulk sync was done or will be done.
    // Let's just trust syncAll was done recently, or rely on what we have.

    console.log("\n📊 Analyzing candidates...");
    const results = [];

    for (const c of CANDIDATES) {
        const quotes = await prisma.stockQuote.findMany({
            where: { stockId: c.id },
            orderBy: { date: 'asc' }
        });

        if (quotes.length < 20) {
            console.log(`Skipping ${c.name} (${c.id}): Insufficient data (${quotes.length})`);
            continue;
        }

        const latest = quotes[quotes.length - 1];
        const dataForCalc = quotes.map(q => ({
            date: q.date,
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume
        }));

        const indicators = calculateAllIndicators(dataForCalc);
        const lastInd = indicators[indicators.length - 1];

        // Revenue (get latest)
        const revenue = await prisma.monthlyRevenue.findFirst({
            where: { stockId: c.id },
            orderBy: [{ year: 'desc' }, { month: 'desc' }]
        });

        // Simple Scoring Logic
        let score = 0;
        const reasons = [];

        // Trend
        if (lastInd.ma20 && latest.close > lastInd.ma20) {
            score += 20;
            reasons.push("股價 > 月線");
        }
        if (lastInd.ma60 && latest.close > lastInd.ma60) {
            score += 20;
            reasons.push("股價 > 季線");
        }

        // Momentum
        if (lastInd.rsi && lastInd.rsi > 50) {
            score += 10;
        }
        if (lastInd.rsi && lastInd.rsi > 70) {
            reasons.push("RSI強勢"); // But beware overbought
        }

        // Revenue
        if (revenue) {
            if (revenue.yoyGrowth && revenue.yoyGrowth > 0) {
                score += 20;
                reasons.push(`營收年增 ${revenue.yoyGrowth}%`);
            }
            if (revenue.yoyGrowth && revenue.yoyGrowth > 20) {
                score += 10; // Bonus for high growth
            }
        }

        results.push({
            id: c.id,
            name: c.name,
            price: latest.close,
            change: (latest.change / (latest.close - latest.change)) * 100,
            changeVal: latest.change,
            score,
            revenueYoY: revenue?.yoyGrowth,
            ma20: lastInd.ma20,
            rsi: lastInd.rsi,
            reasons: reasons.join(", ")
        });
    }

    // Sort by Score
    results.sort((a, b) => b.score - a.score);

    console.table(results.map(r => ({
        Name: `${r.name} (${r.id})`,
        Price: r.price,
        Score: r.score,
        Reasons: r.reasons,
        RevYoY: r.revenueYoY ? `${r.revenueYoY}%` : 'N/A'
    })));

    return results;
}

analyze().catch(console.error).finally(() => prisma.$disconnect());
