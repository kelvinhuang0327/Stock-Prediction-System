
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function triggerSyncs() {
    try {
        console.log('Finding top growth stocks to sync...');
        const stocks = await prisma.stock.findMany({
            where: {
                monthlyRevenues: {
                    some: { yoyGrowth: { gte: 25 } }
                }
            },
            include: {
                monthlyRevenues: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 1 },
                _count: { select: { quotes: true } }
            }
        });

        const targets = stocks
            .sort((a, b) => b.monthlyRevenues[0].yoyGrowth - a.monthlyRevenues[0].yoyGrowth)
            .filter(s => s._count.quotes < 20)
            .slice(0, 20);

        console.log(`Triggering analysis/sync for ${targets.length} stocks...`);

        for (const target of targets) {
            console.log(`Analyzing ${target.id} (${target.name})...`);
            try {
                const start = Date.now();
                const response = await fetch(`http://localhost:3000/api/strategy/analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: target.id })
                });
                const data = await response.json();
                console.log(`Done ${target.id}: Score ${data.technicalScore || 0}, Time: ${Date.now() - start}ms`);
            } catch (err) {
                console.error(`Error analyzing ${target.id}:`, err.message);
            }
            // Small delay to be nice to the server
            await new Promise(r => setTimeout(r, 500));
        }

        console.log('All triggers completed.');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

triggerSyncs();
