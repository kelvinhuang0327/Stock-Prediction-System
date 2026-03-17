
import { prisma } from '../src/lib/prisma';
import { calculateAllIndicators } from '../src/lib/technicalIndicators';

async function debugEvidence() {
    console.log('--- Debugging Logic ---');
    const symbol = '2330'; // TSMC

    // 1. Fetch Data
    const stock = await prisma.stock.findUnique({
        where: { id: symbol },
        include: {
            monthlyRevenues: {
                orderBy: [{ year: 'desc' }, { month: 'desc' }],
                take: 36
            },
            quotes: {
                orderBy: { date: 'desc' },
                take: 365
            }
        }
    });

    if (!stock) {
        console.log('Stock not found');
        return;
    }

    const revenues = stock.monthlyRevenues;
    const quotesAsc = [...stock.quotes].reverse();

    console.log(`Fetched ${quotesAsc.length} days of quotes.`);
    console.log(`Fetched ${revenues.length} revenue records.`);

    if (quotesAsc.length > 0) {
        console.log('First Quote Date:', quotesAsc[0].date);
        console.log('Last Quote Date:', quotesAsc[quotesAsc.length - 1].date);
    }

    const indicators = calculateAllIndicators(quotesAsc);
    console.log('Indicators calculated.');

    const lookLimit = indicators.length - 60;
    let foundCandidates = 0;

    for (let i = 60; i < lookLimit; i++) {
        const day = indicators[i];
        const dateStr = day.date as unknown as string; // Assume string per previous finding
        let yyyy = 0;
        let mm = 0;

        // Handle ROC Date (e.g., '1150116') or AD Date ('20260116') or 'YYYY-MM-DD'
        if (dateStr.length === 7) {
            // ROC Date: 115 + 01 + 16
            yyyy = parseInt(dateStr.substring(0, 3)) + 1911;
            mm = parseInt(dateStr.substring(3, 5));
        } else if (dateStr.length === 8) {
            // AD Date: 2026 + 01 + 16
            yyyy = parseInt(dateStr.substring(0, 4));
            mm = parseInt(dateStr.substring(4, 6));
        } else if (dateStr.includes('-')) {
            // YYYY-MM-DD
            yyyy = parseInt(dateStr.substring(0, 4));
            mm = parseInt(dateStr.substring(5, 7));
        } else {
            // Fallback
            yyyy = parseInt(dateStr.substring(0, 4));
            mm = parseInt(dateStr.substring(5, 7));
        }

        // Criteria 1: Technical
        if (!day.ma20 || !day.ma60) continue;
        if (day.close <= day.ma20 || day.ma20 <= day.ma60) continue;

        // Criteria 2: Revenue
        // Logic in service:
        // const yyyy = parseInt(date.substring(0, 4));
        // const mm = parseInt(date.substring(5, 7));

        // Determine target revenue month
        // We look for any revenue report from recent prior months that is > 30%
        // In the code I wrote: mm - 2 or mm - 1

        const targetRevenue = revenues.find(r => {
            if (r.year === yyyy && r.month === mm - 2) return true;
            if (r.year === yyyy && r.month === mm - 1) return true;
            // Handle yearwrap
            if (mm <= 2) {
                if (r.year === yyyy - 1 && r.month >= 11) return true;
            }
            return false;
        });

        if (!targetRevenue || (targetRevenue.yoyGrowth || 0) < 30) continue;

        foundCandidates++;
        console.log(`\n[SIGNAL FOUND] ${dateStr}`);
        console.log(`Technicals: Close ${day.close} > MA20 ${day.ma20} > MA60 ${day.ma60}`);
        console.log(`Revenue: ${targetRevenue.year}-${targetRevenue.month}, YoY: ${targetRevenue.yoyGrowth}%`);

        // Check forward gain
        const entryPrice = day.close;
        let maxPrice = -Infinity;
        let daysToMax = 0;

        for (let j = 1; j <= 60; j++) {
            const futureDay = indicators[i + j];
            if (futureDay.close > maxPrice) {
                maxPrice = futureDay.close;
                daysToMax = j;
            }
        }

        const gain = ((maxPrice - entryPrice) / entryPrice) * 100;
        console.log(`Result: Max Gain +${gain.toFixed(2)}% in ${daysToMax} days.`);
    }

    console.log(`Total signals found: ${foundCandidates}`);
}

debugEvidence().catch(console.error);
