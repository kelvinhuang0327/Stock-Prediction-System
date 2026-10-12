import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [watchlist, alerts] = await Promise.all([
            prisma.watchlist.findMany(),
            prisma.priceAlert.findMany()
        ]);

        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            data: {
                watchlist,
                alerts
            }
        };

        return new NextResponse(JSON.stringify(backup, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="sps-backup-${new Date().toISOString().slice(0, 10)}.json"`
            }
        });
    } catch (error) {
        console.error('Backup Failed:', error);
        return NextResponse.json({ error: 'Backup Failed' }, { status: 500 });
    }
}
