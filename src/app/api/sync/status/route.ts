import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const logs = await prisma.syncLog.findMany({
            orderBy: {
                syncedAt: 'desc',
            },
            take: 20,
        });

        return NextResponse.json({ logs });
    } catch {
        return NextResponse.json(
            { error: 'Failed to fetch logs' },
            { status: 500 }
        );
    }
}
