/**
 * taiwanStockJobRegistry
 *
 * Task registry for the Taiwan-stock domain orchestration layer.
 * Each task wraps an existing batch function — no business logic lives here.
 *
 * Safe-run compatible: every task is idempotent or dry-run gated.
 * No LLM dependency.
 */

import type { AutonomousJobName } from './types';

// ─── Task Name Type ───────────────────────────────────────────────

export type TaiwanStockTaskName =
  | 'twstock:data_sync_health'
  | 'twstock:quote_sync'
  | 'twstock:institutional_chip_sync'
  | 'twstock:daily_market_snapshot'
  | 'twstock:candidate_screening_dry_run'
  | 'twstock:candidate_screening'
  | 'twstock:daily_report'
  | 'twstock:data_quality_check';

// ─── Registry Entry ───────────────────────────────────────────────

export interface TaiwanStockJobDefinition {
  /** Unique job name — also used as idempotency key prefix. */
  jobName: TaiwanStockTaskName;
  /** Human-readable label in Traditional Chinese. */
  label: string;
  /** Brief English description. */
  description: string;
  /** Scheduling cadence. daily = once per UTC day; on_demand = no automatic scheduling. */
  cadence: 'daily' | 'on_demand';
  /** Whether this task writes to the database. false = safe to run anytime. */
  writesToDb: boolean;
  /** Whether a dry-run mode is supported (no DB writes, returns preview only). */
  supportsDryRun: boolean;
  /** Maximum expected duration in seconds for UI timeout hints. */
  maxDurationSeconds: number;
}

export type TaiwanStockSchedulerJobName = Extract<
  AutonomousJobName,
  'training:tw-data-sync' | 'training:tw-snapshot' | 'training:tw-screen' | 'training:tw-report'
>;

// ─── Helpers ─────────────────────────────────────────────────────

function truncateToUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function getScheduledForToday(): Date {
  return truncateToUtcDay(new Date());
}

function truncateToUtcInterval(now: Date, minutes: number): Date {
  const bucket = Math.floor((now.getUTCHours() * 60 + now.getUTCMinutes()) / minutes) * minutes;
  const hours = Math.floor(bucket / 60);
  const mins = bucket % 60;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, mins));
}

function nextUtcInterval(now: Date, minutes: number): Date {
  return new Date(truncateToUtcInterval(now, minutes).getTime() + minutes * 60_000);
}

function nextUtcDailyTime(now: Date, hour: number, minute: number): Date {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute));
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

export function buildTaiwanStockIdempotencyKey(jobName: TaiwanStockTaskName, scheduledFor: Date): string {
  return `${jobName}:${scheduledFor.toISOString()}`;
}

export function getTaiwanStockTaskNames(): TaiwanStockTaskName[] {
  return Object.keys(TAIWAN_STOCK_JOB_REGISTRY) as TaiwanStockTaskName[];
}

export const TAIWAN_STOCK_TASK_SCHEDULER_MAP: Partial<Record<TaiwanStockTaskName, TaiwanStockSchedulerJobName>> = {
  'twstock:data_sync_health': 'training:tw-data-sync',
  'twstock:quote_sync': 'training:tw-data-sync',
  'twstock:daily_market_snapshot': 'training:tw-snapshot',
  'twstock:candidate_screening_dry_run': 'training:tw-screen',
  'twstock:daily_report': 'training:tw-report',
};

export function getTaiwanStockTaskScheduleLabel(taskName: TaiwanStockTaskName): string | null {
  switch (taskName) {
    case 'twstock:data_sync_health':
      return '每 30 分鐘';
    case 'twstock:quote_sync':
      return '每 1 小時';
    case 'twstock:daily_market_snapshot':
      return '每日 14:05 (Asia/Taipei)';
    case 'twstock:candidate_screening_dry_run':
      return '每日 14:10 (Asia/Taipei)';
    case 'twstock:daily_report':
      return '每日 21:10 (Asia/Taipei)';
    default:
      return null;
  }
}

export function getTaiwanStockTaskNextRunAt(taskName: TaiwanStockTaskName, now: Date): Date | null {
  switch (taskName) {
    case 'twstock:data_sync_health':
      return nextUtcInterval(now, 30);
    case 'twstock:quote_sync':
      return nextUtcInterval(now, 60);
    case 'twstock:daily_market_snapshot':
      return nextUtcDailyTime(now, 6, 5);
    case 'twstock:candidate_screening_dry_run':
      return nextUtcDailyTime(now, 6, 10);
    case 'twstock:daily_report':
      return nextUtcDailyTime(now, 13, 10);
    default:
      return null;
  }
}

// ─── Registry ────────────────────────────────────────────────────

export const TAIWAN_STOCK_JOB_REGISTRY: Record<TaiwanStockTaskName, TaiwanStockJobDefinition> = {
  'twstock:data_sync_health': {
    jobName: 'twstock:data_sync_health',
    label: '全量資料同步',
    description: 'Run all SyncScheduler jobs: stock master, daily quotes, metrics, market index, institutional chip, monthly revenue, events.',
    cadence: 'daily',
    writesToDb: true,
    supportsDryRun: false,
    maxDurationSeconds: 120,
  },

  'twstock:quote_sync': {
    jobName: 'twstock:quote_sync',
    label: '每日報價同步',
    description: 'Sync daily stock quotes and market index only. Faster than full sync.',
    cadence: 'daily',
    writesToDb: true,
    supportsDryRun: false,
    maxDurationSeconds: 60,
  },

  'twstock:institutional_chip_sync': {
    jobName: 'twstock:institutional_chip_sync',
    label: '三大法人籌碼同步',
    description: 'Sync institutional chip data (foreign, trust, dealer buy/sell) for today.',
    cadence: 'daily',
    writesToDb: true,
    supportsDryRun: false,
    maxDurationSeconds: 60,
  },

  'twstock:daily_market_snapshot': {
    jobName: 'twstock:daily_market_snapshot',
    label: '每日市場快照',
    description: 'Create DailyMarketSnapshot + DailyCandidateSnapshot + DailyWatchlistSnapshot for today. Upsert-safe.',
    cadence: 'daily',
    writesToDb: true,
    supportsDryRun: false,
    maxDurationSeconds: 90,
  },

  'twstock:candidate_screening_dry_run': {
    jobName: 'twstock:candidate_screening_dry_run',
    label: '候選股篩選（預覽）',
    description: 'Run StrategyScreenEngine in dry-run mode. Returns candidate list without writing to DailyCandidateSnapshot.',
    cadence: 'on_demand',
    writesToDb: false,
    supportsDryRun: true,
    maxDurationSeconds: 45,
  },

  'twstock:candidate_screening': {
    jobName: 'twstock:candidate_screening',
    label: '候選股篩選（寫入）',
    description: 'Run StrategyScreenEngine and persist results to DailyCandidateSnapshot.',
    cadence: 'daily',
    writesToDb: true,
    supportsDryRun: false,
    maxDurationSeconds: 60,
  },

  'twstock:daily_report': {
    jobName: 'twstock:daily_report',
    label: '每日研究報告生成',
    description: 'Run DailyReportEngine to produce a full daily report. Result is returned in metadata; not separately persisted.',
    cadence: 'daily',
    writesToDb: false,
    supportsDryRun: false,
    maxDurationSeconds: 60,
  },

  'twstock:data_quality_check': {
    jobName: 'twstock:data_quality_check',
    label: '資料品質檢查',
    description: 'Run DataQualityChecker. Returns overallScore (0-100) and warnings. Does not modify data.',
    cadence: 'daily',
    writesToDb: false,
    supportsDryRun: false,
    maxDurationSeconds: 30,
  },
};
