
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log('--- Searching for High Growth / Low Base Stocks ---');

        // 1. Get stocks with YoY > 30% in the latest revenue data
        // Usually month is 11 or 12 for 2025/2024
        const stocks = await prisma.stock.findMany({
            where: {
                capital: { lte: 100 * 100000000 }, // Under 100B
                monthlyRevenues: {
                    some: {
                        yoyGrowth: { gte: 25 } // Moderate to high growth
                    }
                }
            },
            include: {
                monthlyRevenues: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 1 },
                quotes: { orderBy: { date: 'desc' }, take: 60 }
            }
        });

        console.log(`Initial pool: ${stocks.length} growth stocks.`);

        const candidates = [];

        for (const stock of stocks) {
            if (stock.quotes.length < 20) continue;

            const current = stock.quotes[0].close;
            const prices = stock.quotes.map(q => q.close);
            const min60 = Math.min(...prices);
            const max60 = Math.max(...prices);

            const climb = (current - min60) / min60;
            const rangePos = (current - min60) / (max60 - min60);

            candidates.push({
                id: stock.id,
                name: stock.name,
                yoy: stock.monthlyRevenues[0].yoyGrowth,
                climb: climb * 100,
                price: current,
                rangePos
            });
        }

        console.log('\n--- ALL GROWTH STOCKS (>25% YoY) ---\n');
        candidates
            .sort((a, b) => b.yoy - a.yoy)
            .slice(0, 20)
            .forEach(c => {
                const status = c.climb > 100 ? '🚀 SOARING (AVOID)' : c.climb < 20 ? '💎 POTENTIAL (LOW BASE)' : '👀 MID-STAGE';
                console.log(`[${c.id}] ${c.name} - ${status}`);
                console.log(`Growth: ${c.yoy.toFixed(1)}% | 60D Climb: +${c.climb.toFixed(1)}% | Price: ${c.price}`);
                console.log(`Range Position: ${c.rangePos.toFixed(2)}\n`);
            });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
