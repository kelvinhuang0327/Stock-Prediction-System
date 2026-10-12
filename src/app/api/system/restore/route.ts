import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { BackupPayload } from '@/types/api-payloads';

export async function POST(request: NextRequest) {
    try {
        const backup: BackupPayload = await request.json();

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
                // Strip IDs — let DB auto-assign to avoid PK conflicts on empty table
                for (const w of backup.data.watchlist) {
                    // Check if stock exists first to avoid FK error
                    const stockExists = await tx.stock.findUnique({ where: { id: w.stockId } });
                    if (stockExists) {
                        await tx.watchlist.create({
                            data: {
                                stockId: w.stockId,
                                entryPrice: w.entryPrice ?? null,
                                quantity: w.quantity ?? null,
                                addedAt: w.addedAt ? new Date(w.addedAt) : undefined,
                                note: w.note ?? null,
                            },
                        });
                    }
                }
            }

            // 3. Restore Alerts
            if (backup.data.alerts.length > 0) {
                await tx.priceAlert.createMany({
                    data: backup.data.alerts.map((a) => ({
                        symbol: a.symbol,
                        type: a.type,
                        target: a.target,
                        isActive: a.isActive ?? true,
                        triggered: a.triggered ?? false,
                    })),
                });
            }
        });

        return NextResponse.json({ success: true, message: 'Restore Successful' });
    } catch (error) {
        console.error('Restore Failed:', error);
        return NextResponse.json({ error: 'Restore Failed' }, { status: 500 });
    }
}
