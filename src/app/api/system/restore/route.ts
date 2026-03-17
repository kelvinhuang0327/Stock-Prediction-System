import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const backup = await request.json();

        if (!backup.data || !backup.data.watchlist || !backup.data.alerts) {
            return NextResponse.json({ error: 'Invalid Backup Format' }, { status: 400 });
        }

        // Transactional Restore
        await prisma.$transaction(async (tx) => {
            // 1. Clear existing
            await tx.watchlist.deleteMany();
            await tx.priceAlert.deleteMany();

            // 2. Restore Watchlist
            if (backup.data.watchlist.length > 0) {
                // We need to omit 'id' to let auto-increment work, OR keep 'id' if we want exact clone.
                // Better to let DB handle IDs to avoid conflicts if sequence didn't reset, 
                // but for full restore, keeping IDs might be okay if table is empty.
                // Let's strip IDs for safety.
                const watchlistData = backup.data.watchlist.map((w: any) => ({
                    stockId: w.stockId,
                    entryPrice: w.entryPrice,
                    addedAt: w.addedAt, // Prisma handles string -> Date mapping usually, but let's be safe
                    note: w.note
                }));

                // createMany is not supported for SQLite in some Prisma versions for relations? 
                // Watchlist relates to Stock. If Stock doesn't exist, this fails.
                // We assume Stocks exist. If not, we skip? 
                // Actually, createMany is fine.
                for (const item of watchlistData) {
                    // Check if stock exists first to avoid FK error
                    const stockExists = await tx.stock.findUnique({ where: { id: item.stockId } });
                    if (stockExists) {
                        await tx.watchlist.create({ data: item });
                    }
                }
            }

            // 3. Restore Alerts
            if (backup.data.alerts.length > 0) {
                const alertsData = backup.data.alerts.map((a: any) => ({
                    symbol: a.symbol,
                    type: a.type,
                    target: a.target,
                    isActive: a.isActive,
                    triggered: a.triggered
                }));
                await tx.priceAlert.createMany({ data: alertsData });
            }
        });

        return NextResponse.json({ success: true, message: 'Restore Successful' });
    } catch (error) {
        console.error('Restore Failed:', error);
        return NextResponse.json({ error: 'Restore Failed' }, { status: 500 });
    }
}
