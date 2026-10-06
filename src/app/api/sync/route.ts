import { NextResponse } from 'next/server';
import { syncService } from '@/lib/services/syncService';

// Trigger full sync manually
export async function POST() {
    try {
        // Run sync in background (or await if we want to confirm completion)
        // For Vercel/Serverless lambda limits, usually we should return quickly.
        // But for local dev and simple sync, we can await.
        const result = await syncService.syncAll();

        return NextResponse.json({
            success: true,
            message: 'Sync completed',
            details: result
        });
    } catch (error) {
        console.error('API Sync Error:', error);
        return NextResponse.json(
            { success: false, error: 'Sync failed' },
            { status: 500 }
        );
    }
}
