import { getErrorMessage } from '@/lib/error-utils';

import { NextResponse } from 'next/server';
import { syncService } from '@/lib/services/syncService';

export const maxDuration = 300; // 5 minutes

export async function POST() {
    try {
        // Trigger sync
        // Note: For a real app, this should be async/background queue.
        // But for this single-user app, we can await or fire-and-forget.
        // We'll await basic info but maybe full sync takes too long.
        // Let's run full sync and hope it finishes within timeout or user waits.
        // Or better: Just trigger basic info + daily quotes (the fast part).
        // History takes too long.

        const result = await syncService.syncDailyQuotes();
        await syncService.syncMetrics();
        await syncService.syncMarketIndices();
        await syncService.syncRealRevenue(); // Fast
        await syncService.syncFinancialReportsFromLocalFile();

        return NextResponse.json({ success: true, message: 'Daily Sync Completed', details: result });
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
