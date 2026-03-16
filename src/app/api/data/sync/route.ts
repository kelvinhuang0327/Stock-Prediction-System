/**
 * /api/data/sync - 觸發資料同步
 * 
 * POST: 觸發全量或單一來源同步
 * GET: 查詢同步狀態
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAllSyncs, executeSyncJob, getLatestSyncStatus, type SyncJob } from '@/lib/data/SyncScheduler';
import { syncService } from '@/lib/services/syncService';

function buildSyncJobs(targets?: string[]): SyncJob[] {
  const allJobs: SyncJob[] = [
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
  ];

  if (targets && targets.length > 0) {
    return allJobs.filter(j => targets.includes(j.endpoint));
  }
  return allJobs;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targets = body.targets as string[] | undefined;
    const jobs = buildSyncJobs(targets);

    if (jobs.length === 0) {
      return NextResponse.json({ error: '無有效的同步目標' }, { status: 400 });
    }

    const results = await runAllSyncs(jobs);
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      summary: { total: results.length, success, failed },
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync trigger error:', error);
    return NextResponse.json({ error: '同步觸發失敗' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const status = await getLatestSyncStatus();
    return NextResponse.json({
      syncStatus: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json({ error: '同步狀態查詢失敗' }, { status: 500 });
  }
}
