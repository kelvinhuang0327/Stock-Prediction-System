/**
 * SyncScheduler - 資料同步排程器
 * 
 * 功能：
 * 1. 依優先順序同步各資料來源
 * 2. 紀錄每次同步結果到 SyncLog
 * 3. 失敗自動重試 (最多 3 次)
 * 4. 提供同步狀態查詢
 * 
 * 注意：此排程器是被動觸發式 (由 API endpoint 或 cron job 呼叫)，
 * 不自帶 timer loop，以避免 serverless 環境問題。
 */

import { prisma } from '@/lib/prisma';

export interface SyncJob {
  endpoint: string;
  priority: number; // 1 = highest
  description: string;
  execute: () => Promise<{ records: number; metadata?: Record<string, unknown> }>;
}

export interface SyncResult {
  endpoint: string;
  status: 'success' | 'failed' | 'partial';
  records: number;
  duration: number;
  error?: string;
  metadata?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 執行單一同步任務並記錄到 SyncLog */
export async function executeSyncJob(job: SyncJob): Promise<SyncResult> {
  const start = Date.now();
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await job.execute();
      const duration = Date.now() - start;
      const logEntry = {
        endpoint: job.endpoint,
        status: 'success',
        records: result.records,
        duration,
        metadata: result.metadata ? JSON.stringify(result.metadata) : null,
      };

      await prisma.syncLog.create({ data: logEntry });
      return {
        endpoint: logEntry.endpoint,
        status: 'success' as const,
        records: logEntry.records,
        duration,
        metadata: logEntry.metadata ?? undefined,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[SyncScheduler] ${job.endpoint} attempt ${attempt}/${MAX_RETRIES} failed: ${lastError}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  const duration = Date.now() - start;
  const failResult: SyncResult = {
    endpoint: job.endpoint,
    status: 'failed',
    records: 0,
    duration,
    error: lastError,
  };

  await prisma.syncLog.create({
    data: {
      endpoint: job.endpoint,
      status: 'failed',
      records: 0,
      duration,
      error: lastError,
    },
  });

  return failResult;
}

/** 依優先順序執行所有同步任務 */
export async function runAllSyncs(jobs: SyncJob[]): Promise<SyncResult[]> {
  const sorted = [...jobs].sort((a, b) => a.priority - b.priority);
  const results: SyncResult[] = [];

  for (const job of sorted) {
    const result = await executeSyncJob(job);
    results.push(result);
  }

  return results;
}

/** 取得最近的同步紀錄 */
export async function getLatestSyncStatus(): Promise<Record<string, {
  status: string;
  records: number;
  syncedAt: Date;
  error?: string;
}>> {
  const logs = await prisma.syncLog.findMany({
    orderBy: { syncedAt: 'desc' },
    take: 50,
  });

  const latest: Record<string, { status: string; records: number; syncedAt: Date; error?: string }> = {};
  for (const log of logs) {
    if (!latest[log.endpoint]) {
      latest[log.endpoint] = {
        status: log.status,
        records: log.records,
        syncedAt: log.syncedAt,
        error: log.error ?? undefined,
      };
    }
  }

  return latest;
}

/** 檢查特定資料源距上次成功同步的天數 */
export async function daysSinceLastSync(endpoint: string): Promise<number> {
  const last = await prisma.syncLog.findFirst({
    where: { endpoint, status: 'success' },
    orderBy: { syncedAt: 'desc' },
  });
  if (!last) return 999;
  return Math.floor((Date.now() - last.syncedAt.getTime()) / (1000 * 60 * 60 * 24));
}
