
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeRevenueCount } from '@/lib/prisma-safe';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [
            stockCount,
            quoteCount,
            revenueCount,
            syncLogs
        ] = await Promise.all([
            prisma.stock.count(),
            prisma.stockQuote.count(),
            safeRevenueCount(),
            prisma.syncLog.findMany({
                orderBy: { syncedAt: 'desc' },
                take: 5
            })
        ]);

        // DB Size Estimate (SQLite file size)
        let dbSize = 'Unknown';
        try {
            // Adjust path based on your prisma setup / env
            // Often prisma/dev.db
            const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
            if (fs.existsSync(dbPath)) {
                const stats = fs.statSync(dbPath);
                dbSize = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
            }
        } catch { }

        return NextResponse.json({
            status: 'ok',
            counts: {
                stocks: stockCount,
                quotes: quoteCount,
                revenues: revenueCount,
            },
            dbSize,
            lastSyncLogs: syncLogs
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
