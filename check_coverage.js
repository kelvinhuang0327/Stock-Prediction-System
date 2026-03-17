
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkQuotes() {
    try {
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

        console.log('Top Growth Stocks Quote Coverage:');
        stocks
            .sort((a, b) => b.monthlyRevenues[0].yoyGrowth - a.monthlyRevenues[0].yoyGrowth)
            .slice(0, 15)
            .forEach(s => {
                console.log(`[${s.id}] ${s.name}: Growth ${s.monthlyRevenues[0].yoyGrowth.toFixed(1)}% | Quotes: ${s._count.quotes}`);
            });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkQuotes();
