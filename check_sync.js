
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const targets = ['2408', '2236', '8478', '2548', '2528', '5522', '6224'];
    const counts = await prisma.stockQuote.groupBy({
        by: ['stockId'],
        _count: { _all: true },
        where: { stockId: { in: targets } }
    });
    console.table(counts);
    await prisma.$disconnect();
}
check();
