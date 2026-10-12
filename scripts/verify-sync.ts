
import { syncService } from '../src/lib/services/syncService';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('Starting verification sync...');

    // Mock valid API response if needed, or rely on real one?
    // We are hitting real API now.

    try {
        const result = await syncService.syncAll();
        console.log('Sync result:', JSON.stringify(result, null, 2));

        // Check DB
        const stockCount = await prisma.stock.count();
        const quoteCount = await prisma.stockQuote.count();
        const metricsCount = await prisma.stockMetrics.count();
        const indexCount = await prisma.marketIndex.count();
        const logs = await prisma.syncLog.findMany({ take: 5, orderBy: { syncedAt: 'desc' } });

        console.log('--- Database Stats ---');
        console.log(`Stocks: ${stockCount}`);
        console.log(`Quotes: ${quoteCount}`);
        console.log(`Metrics: ${metricsCount}`);
        console.log(`Indices: ${indexCount}`);

        console.log('--- Recent Logs ---');
        logs.forEach(log => {
            console.log(`[${log.status}] ${log.endpoint}: ${log.records} records (${log.duration}ms)`);
        });

    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
