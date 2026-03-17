/**
 * /api/cron/daily-sync - Vercel Cron Job 每日自動同步
 * 
 * 由 Vercel Cron 或外部排程器觸發
 * 執行每日資料同步：基本資料、報價、指標、指數、營收
 * 
 * 安全機制：驗證 CRON_SECRET header
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAllSyncs, type SyncJob } from '@/lib/data/SyncScheduler';
import { syncService } from '@/lib/services/syncService';
import { createDailySnapshot } from '@/lib/report/DailySnapshotEngine';

export const maxDuration = 300; // Allow up to 5 minutes
export const dynamic = 'force-dynamic';

function buildDailySyncJobs(): SyncJob[] {
  return [
    {
      endpoint: 'stock_master',
      priority: 1,
      description: '股票基本資料',
      execute: async () => {
        const result = await syncService.syncBasicInfo();
        return { records: typeof result === 'number' ? result : 0 };
      },
    },
    {
      endpoint: 'stock_quote',
      priority: 2,
      description: '每日報價',
      execute: async () => {
        const result = await syncService.syncDailyQuotes();
        return { records: typeof result === 'number' ? result : 0 };
      },
    },
    {
      endpoint: 'stock_metrics',
      priority: 3,
      description: '估值指標',
      execute: async () => {
        const result = await syncService.syncMetrics();
        return { records: typeof result === 'number' ? result : 0 };
      },
    },
    {
      endpoint: 'market_index',
      priority: 4,
      description: '大盤指數',
      execute: async () => {
        const result = await syncService.syncMarketIndices();
        return { records: typeof result === 'number' ? result : 0 };
      },
    },
    {
      endpoint: 'monthly_revenue',
      priority: 5,
      description: '月營收',
      execute: async () => {
        const result = await syncService.syncRealRevenue();
        return { records: typeof result === 'number' ? result : 0 };
      },
    },
    {
      endpoint: 'daily_snapshot',
      priority: 6,
      description: '每日快照 (市場、候選、自選)',
      execute: async () => {
        const result = await createDailySnapshot({ forceRefresh: false });
        const records = (result.marketCreated ? 1 : 0) + result.candidatesCreated + result.watchlistCreated;
        return { records, metadata: { success: result.success, limitations: result.limitations } };
      },
    },
  ];
}

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (optional security layer)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Daily sync triggered at', new Date().toISOString());

    const jobs = buildDailySyncJobs();
    const results = await runAllSyncs(jobs);

    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const totalRecords = results.reduce((sum, r) => sum + (r.records || 0), 0);

    console.log(`[CRON] Daily sync complete: ${success}/${results.length} success, ${totalRecords} records`);

    return NextResponse.json({
      ok: true,
      summary: { total: results.length, success, failed, totalRecords },
      results: results.map(r => ({
        endpoint: r.endpoint,
        status: r.status,
        records: r.records,
        duration: r.duration,
        error: r.error,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Daily sync failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Daily sync failed', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
