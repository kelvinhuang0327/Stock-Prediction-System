
import { prisma } from '../src/lib/prisma';

async function checkStock() {
    const stockId = '8374';
    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        include: {
            quotes: {
                orderBy: { date: 'desc' },
                take: 10
            },
            monthlyRevenues: {
                orderBy: [{ year: 'desc' }, { month: 'desc' }],
                take: 5
            },
            metrics: {
                orderBy: { date: 'desc' },
                take: 1
            }
        }
    });

    if (!stock) {
        console.log(`Stock ${stockId} not found in database.`);
        return;
    }

    console.log('--- Stock Information ---');
    console.log(`Name: ${stock.name}`);
    console.log(`Industry: ${stock.industry || 'N/A'}`);
    if (stock.metrics && stock.metrics.length > 0) {
        console.log(`PE: ${stock.metrics[0].pe}`);
        console.log(`PB: ${stock.metrics[0].pb}`);
    }

    console.log('\n--- Recent Quotes ---');
    console.table(stock.quotes.map(q => ({
        Date: q.date,
        Close: q.close,
        Change: q.change,
        Volume: q.volume
    })));

    console.log('\n--- Recent Revenue ---');
    console.table(stock.monthlyRevenues.map(r => ({
        Period: `${r.year}-${r.month}`,
        Revenue: r.revenue,
        YoY: r.yoyGrowth ? `${r.yoyGrowth}%` : 'N/A'
    })));
}

checkStock().catch(console.error).finally(() => prisma.$disconnect());
