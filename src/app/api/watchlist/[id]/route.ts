
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const stockId = params.id;

        await prisma.watchlist.delete({
            where: { stockId }
        });

        apiCache.invalidate('watchlist:');
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 });
    }
}
