/**
 * TaiwanStockJobOrchestrator
 *
 * Central dispatch layer for all taiwan-stock domain batch tasks.
 * Wraps existing batch functions with:
 *   - Idempotency key construction
 *   - JobOrchestrationService lifecycle (start / complete / fail)
 *   - Dry-run routing for supported tasks
 *   - Structured logging into JobRunLog
 *
 * Rules:
 *   - Do NOT add business logic here — only call existing engines
 *   - Do NOT add LLM dependencies
 *   - Do NOT modify DB schema
 */

import { JobOrchestrationService } from './JobOrchestrationService';
import {
  TAIWAN_STOCK_JOB_REGISTRY,
  buildTaiwanStockIdempotencyKey,
  getTaiwanStockTaskNextRunAt,
  getTaiwanStockTaskScheduleLabel,
  getScheduledForToday,
  type TaiwanStockTaskName,
} from './taiwanStockJobRegistry';
import type { JobRunLogRecord, JobTriggerSource } from './types';

// ─── Output Types ─────────────────────────────────────────────────

export interface TaskRunInput {
  taskName: TaiwanStockTaskName;
  dryRun?: boolean;
  scheduledFor?: Date;
  triggerSource?: JobTriggerSource;
  force?: boolean;
}

export interface TaskRunResult {
  jobRun: JobRunLogRecord;
  skipped: boolean;
  skipReason?: string;
  /** Task-specific output payload. null when skipped or on failure. */
  outcome: unknown;
}

// ─── Lazy imports — avoids loading heavy engines unless needed ────

async function getSyncService() {
  const { syncService } = await import('@/lib/services/syncService');
  return syncService;
}

async function getSyncAndStoreEvents() {
  const { syncAndStoreEvents } = await import('@/lib/events/EventIngestionService');
  return syncAndStoreEvents;
}

async function getCreateDailySnapshot() {
  const { createDailySnapshot } = await import('@/lib/report/DailySnapshotEngine');
  return createDailySnapshot;
}

async function getRunScreen() {
  const { runScreen } = await import('@/lib/screen/StrategyScreenEngine');
  return runScreen;
}

async function getGenerateDailyReport() {
  const { generateDailyReport } = await import('@/lib/report/DailyReportEngine');
  return generateDailyReport;
}

async function getRunQualityCheck() {
  const { runQualityCheck } = await import('@/lib/data/DataQualityChecker');
  return runQualityCheck;
}

// ─── Task Runners ─────────────────────────────────────────────────

async function runDataSyncHealth() {
  const svc = await getSyncService();
  const [basic, quotes, metrics, index, chip, revenue, events] = await Promise.allSettled([
    svc.syncBasicInfo(),
    svc.syncDailyQuotes(),
    svc.syncMetrics(),
    svc.syncMarketIndices(),
    svc.syncInstitutionalChip(),
    svc.syncRealRevenue(),
    (async () => {
      const syncAndStoreEvents = await getSyncAndStoreEvents();
      return syncAndStoreEvents({ includeRss: true, includeMock: false, dryRun: false, limit: 50 });
    })(),
  ]);

  const results = [
    { name: 'stock_master', result: basic },
    { name: 'stock_quote', result: quotes },
    { name: 'stock_metrics', result: metrics },
    { name: 'market_index', result: index },
    { name: 'institutional_chip', result: chip },
    { name: 'monthly_revenue', result: revenue },
    { name: 'event_sync', result: events },
  ];

  const successCount = results.filter(r => r.result.status === 'fulfilled').length;
  const failedCount = results.filter(r => r.result.status === 'rejected').length;

  return {
    summary: `資料同步完成：${successCount}/${results.length} 成功，${failedCount} 失敗`,
    metadata: {
      totalJobs: results.length,
      success: successCount,
      failed: failedCount,
      results: results.map(r => ({
        name: r.name,
        status: r.result.status,
        error: r.result.status === 'rejected' ? String((r.result as PromiseRejectedResult).reason) : undefined,
      })),
    },
    payload: results.map(r => ({ name: r.name, status: r.result.status })),
  };
}

async function runQuoteSync() {
  const svc = await getSyncService();
  const [quotes, index] = await Promise.all([
    svc.syncDailyQuotes(),
    svc.syncMarketIndices(),
  ]);
  const quotesCount = typeof quotes === 'number' ? quotes : 0;
  const indexCount = typeof index === 'number' ? index : 0;
  return {
    summary: `報價同步完成：quote=${quotesCount} 筆，index=${indexCount} 筆`,
    metadata: { quotesCount, indexCount },
    payload: { quotesCount, indexCount },
  };
}

async function runInstitutionalChipSync() {
  const svc = await getSyncService();
  const result = await svc.syncInstitutionalChip();
  return {
    summary: result.success
      ? `籌碼同步完成：${result.count} 筆，日期 ${result.date}`
      : `籌碼同步失敗：${String(result.error ?? '未知錯誤')}`,
    metadata: { count: result.count, date: result.date, success: result.success },
    payload: result,
  };
}

async function runDailyMarketSnapshot() {
  const createDailySnapshot = await getCreateDailySnapshot();
  const result = await createDailySnapshot({ forceRefresh: false });
  const totalRecords =
    (result.marketCreated ? 1 : 0) + result.candidatesCreated + result.watchlistCreated;
  return {
    summary: `快照完成：市場=${result.marketCreated ? '✓' : '已存在'}，候選=${result.candidatesCreated} 新增，自選=${result.watchlistCreated} 新增`,
    metadata: {
      marketCreated: result.marketCreated,
      candidatesCreated: result.candidatesCreated,
      candidatesUpdated: result.candidatesUpdated,
      watchlistCreated: result.watchlistCreated,
      watchlistUpdated: result.watchlistUpdated,
      limitations: result.limitations,
      totalRecords,
    },
    payload: result,
  };
}

async function runCandidateScreeningDryRun() {
  const runScreen = await getRunScreen();
  const result = await runScreen({ dryRun: true });
  return {
    summary: `篩選預覽（不寫入）：${result.candidates.length} 候選，市場 ${result.regime}（${(result.regimeConfidence * 100).toFixed(0)}%）`,
    metadata: {
      dryRun: true,
      candidateCount: result.candidates.length,
      regime: result.regime,
      regimeConfidence: result.regimeConfidence,
      topCandidates: result.candidates.slice(0, 5).map(c => ({
        symbol: c.symbol,
        name: c.name,
        alphaScore: c.alphaScore,
        screenBucket: c.screenBucket,
      })),
      limitations: result.limitations,
    },
    payload: result,
  };
}

async function runCandidateScreening() {
  // Screening with snapshot persistence: delegate to DailySnapshotEngine
  // which already handles the full runScreen + upsert flow
  const createDailySnapshot = await getCreateDailySnapshot();
  const result = await createDailySnapshot({ forceRefresh: false });
  return {
    summary: `候選股篩選完成：${result.candidatesCreated} 新增，${result.candidatesUpdated} 更新`,
    metadata: {
      candidatesCreated: result.candidatesCreated,
      candidatesUpdated: result.candidatesUpdated,
      limitations: result.limitations,
    },
    payload: result,
  };
}

async function runDailyReport() {
  const generateDailyReport = await getGenerateDailyReport();
  const report = await generateDailyReport({ includeWatchlist: true, candidateLimit: 50 });
  return {
    summary: `每日報告生成完成：${report.candidateSummary?.strongCandidates?.length ?? 0} 強勢候選，${report.eventSummary?.eventCount ?? 0} 事件`,
    metadata: {
      reportDate: report.reportDate,
      regime: report.marketSummary?.regime,
      strongCandidates: report.candidateSummary?.strongCandidates?.length ?? 0,
      watchCandidates: report.candidateSummary?.watchCandidates?.length ?? 0,
      eventCount: report.eventSummary?.eventCount ?? 0,
    },
    payload: { reportDate: report.reportDate, regime: report.marketSummary?.regime },
  };
}

async function runDataQualityCheck() {
  const runQualityCheck = await getRunQualityCheck();
  const report = await runQualityCheck();
  const grade = report.overallScore >= 80 ? 'A' : report.overallScore >= 60 ? 'B' : report.overallScore >= 40 ? 'C' : 'D';
  return {
    summary: `資料品質檢查：${report.overallScore}/100 (${grade})，${report.warnings.length} 個警告`,
    metadata: {
      overallScore: report.overallScore,
      grade,
      warningCount: report.warnings.length,
      warnings: report.warnings.slice(0, 5),
      tableCount: report.tables.length,
      coverageSummary: {
        totalStocks: report.coverageSummary.totalStocks,
        stocksWithQuotes: report.coverageSummary.stocksWithQuotes,
        backtestEligible: report.coverageSummary.backtestEligible,
        chipAgentActive: report.coverageSummary.chipAgentActive,
        quoteLatestDate: report.coverageSummary.quoteLatestDate,
      },
    },
    payload: { overallScore: report.overallScore, grade, warnings: report.warnings },
  };
}

// ─── Dispatch Map ─────────────────────────────────────────────────

const RUNNERS: Record<TaiwanStockTaskName, (dryRun: boolean) => Promise<{
  summary: string;
  metadata: Record<string, unknown>;
  payload: unknown;
}>> = {
  'twstock:data_sync_health': () => runDataSyncHealth(),
  'twstock:quote_sync': () => runQuoteSync(),
  'twstock:institutional_chip_sync': () => runInstitutionalChipSync(),
  'twstock:daily_market_snapshot': () => runDailyMarketSnapshot(),
  'twstock:candidate_screening_dry_run': () => runCandidateScreeningDryRun(),
  'twstock:candidate_screening': (dryRun) => dryRun ? runCandidateScreeningDryRun() : runCandidateScreening(),
  'twstock:daily_report': () => runDailyReport(),
  'twstock:data_quality_check': () => runDataQualityCheck(),
};

// ─── Main Dispatch ────────────────────────────────────────────────

export async function runTaiwanStockTask(input: TaskRunInput): Promise<TaskRunResult> {
  const { taskName, dryRun = false, force = false } = input;
  const triggerSource: JobTriggerSource = input.triggerSource ?? 'api';

  const definition = TAIWAN_STOCK_JOB_REGISTRY[taskName];
  if (!definition) {
    throw new Error(`Unknown taiwan-stock task: ${taskName}`);
  }

  // For dry-run tasks, always use on-demand scheduledFor to avoid idempotency collision with live run
  const isDryRun = dryRun || taskName === 'twstock:candidate_screening_dry_run';
  const scheduledFor = input.scheduledFor ?? getScheduledForToday();
  // Dry-run uses a separate key so it doesn't block the live run
  const keyScheduledFor = isDryRun
    ? new Date(scheduledFor.getTime() + 1) // offset by 1ms for dry-run key isolation
    : scheduledFor;
  const idempotencyKey = buildTaiwanStockIdempotencyKey(
    isDryRun && taskName !== 'twstock:candidate_screening_dry_run'
      ? 'twstock:candidate_screening_dry_run'
      : taskName,
    keyScheduledFor,
  );

  const svc = new JobOrchestrationService();
  const startResult = await svc.startJobRun({
    jobName: taskName,
    scheduledFor: keyScheduledFor,
    triggerSource,
    runMode: 'live_run',
    idempotencyKey,
    summary: `${definition.label}${isDryRun ? '（預覽）' : ''}`,
    metadata: { dryRun: isDryRun, taskDefinition: definition.description },
    force,
  });

  if (!startResult.shouldRun) {
    return {
      jobRun: startResult.run,
      skipped: true,
      skipReason: startResult.reason,
      outcome: null,
    };
  }

  const runId = startResult.run.id ?? 0;

  try {
    const runner = RUNNERS[taskName];
    const result = await runner(isDryRun);

    const completed = await svc.completeJobRun(runId, {
      summary: result.summary,
      metadata: result.metadata,
    });

    return {
      jobRun: completed,
      skipped: false,
      outcome: result.payload,
    };
  } catch (error) {
    const failed = await svc.failJobRun(runId, {
      error,
      summary: `${definition.label} 執行失敗`,
      metadata: { dryRun: isDryRun },
    });
    return {
      jobRun: failed,
      skipped: false,
      outcome: null,
    };
  }
}

// ─── Status Query ─────────────────────────────────────────────────

export interface TaskStatus {
  taskName: TaiwanStockTaskName;
  label: string;
  cadence: string;
  scheduleLabel: string | null;
  writesToDb: boolean;
  supportsDryRun: boolean;
  nextRunAt: string | null;
  latestRun: {
    id: number | undefined;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    summary: string | null;
    errorMessage: string | null;
    durationMs: number | null;
    triggerSource: string;
  } | null;
  todayRan: boolean;
  todayStatus: string | null;
}

export async function getTaiwanStockTaskStatuses(): Promise<TaskStatus[]> {
  const { prisma } = await import('@/lib/prisma');
  const todayStart = getScheduledForToday();
  const now = new Date();

  const statuses: TaskStatus[] = [];
  for (const taskName of Object.keys(TAIWAN_STOCK_JOB_REGISTRY) as TaiwanStockTaskName[]) {
    const def = TAIWAN_STOCK_JOB_REGISTRY[taskName];
    const nextRunAt = getTaiwanStockTaskNextRunAt(taskName, now);

    // Get latest run (any time)
    const latestRow = await prisma.jobRunLog.findFirst({
      where: { jobName: taskName },
      orderBy: { createdAt: 'desc' },
    });

    // Check if ran today
    const todayRow = await prisma.jobRunLog.findFirst({
      where: {
        jobName: taskName,
        scheduledFor: { gte: todayStart },
        status: 'success',
      },
    });

    statuses.push({
      taskName,
      label: def.label,
      cadence: def.cadence,
      scheduleLabel: getTaiwanStockTaskScheduleLabel(taskName),
      writesToDb: def.writesToDb,
      supportsDryRun: def.supportsDryRun,
      nextRunAt: nextRunAt?.toISOString() ?? null,
      latestRun: latestRow
        ? {
            id: latestRow.id,
            status: latestRow.status,
            startedAt: latestRow.startedAt?.toISOString() ?? null,
            finishedAt: latestRow.finishedAt?.toISOString() ?? null,
            summary: latestRow.summary,
            errorMessage: latestRow.errorMessage,
            durationMs:
              latestRow.startedAt && latestRow.finishedAt
                ? latestRow.finishedAt.getTime() - latestRow.startedAt.getTime()
                : null,
            triggerSource: latestRow.triggerSource,
          }
        : null,
      todayRan: !!todayRow,
      todayStatus: todayRow?.status ?? null,
    });
  }

  return statuses;
}
