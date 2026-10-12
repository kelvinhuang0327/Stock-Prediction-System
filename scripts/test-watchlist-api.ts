
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testWatchlist() {
    console.log('--- Testing Watchlist Logic ---');

    // 1. Setup Mock Data
    const stockId = '2330'; // TSMC
    const entryPrice = 500;

    // Ensure stock exists (mocking dependencies if needed, but 2330 usually exists in seed)
    const stock = await prisma.stock.findUnique({ where: { id: stockId } });
    if (!stock) {
        console.log('Stock 2330 not found. Creating placeholder...');
        await prisma.stock.create({
            data: {
                id: stockId,
                name: '台積電',
                updatedAt: new Date()
            }
        });
    }

    // 2. Clean State
    await prisma.watchlist.deleteMany({ where: { stockId } });

    // 3. Test ADD
    console.log('1. Adding to Watchlist...');
    const added = await prisma.watchlist.create({
        data: {
            stockId,
            entryPrice,
            note: 'Verification Script Test'
        }
    });
    console.log('   - Added:', added.stockId, 'at', added.entryPrice);

    // 4. Test READ
    console.log('2. Reading Watchlist...');
    const list = await prisma.watchlist.findMany();
    const found = list.find(w => w.stockId === stockId);
    if (found && found.entryPrice === entryPrice) {
        console.log('   - ✅ Read Verification Passed');
    } else {
        console.error('   - ❌ Read Verification Failed');
        process.exit(1);
    }

    // 5. Test REMOVE
    console.log('3. Removing from Watchlist...');
    await prisma.watchlist.delete({ where: { stockId } });

    // 6. Confirm Removal
    const check = await prisma.watchlist.findUnique({ where: { stockId } });
    if (!check) {
        console.log('   - ✅ Delete Verification Passed');
    } else {
        console.error('   - ❌ Delete Verification Failed');
        process.exit(1);
    }

    console.log('--- All Tests Passed ---');
}

testWatchlist()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
