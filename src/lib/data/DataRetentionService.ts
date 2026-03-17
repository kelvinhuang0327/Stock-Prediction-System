/**
 * DataRetentionService.ts
 *
 * Manages data lifecycle for snapshot and log tables to prevent unbounded growth.
 *
 * Safety guarantees:
 * - Minimum retention: 30 days (hard floor — cannot be overridden)
 * - Never deletes today's data
 * - dryRun mode: reports what WOULD be deleted without touching the DB
 * - All operations return a structured CleanupSummary for logging / audit
 *
 * Covered tables:
 *   DailyMarketSnapshot    — one row per day (snapshotDate: String YYYY-MM-DD)
 *   DailyCandidateSnapshot — many rows per day, keyed by (snapshotDate, symbol)
 *   DailyWatchlistSnapshot — many rows per day, keyed by (snapshotDate, symbol)
 *   NotificationDeliveryLog — one row per delivery attempt (sentAt: DateTime)
 *
 * Usage:
 *   import { DataRetentionService } from '@/lib/data/DataRetentionService';
 *   const svc = new DataRetentionService({ dryRun: true });
 *   const summary = await svc.runAll();
 */

import { prisma } from '@/lib/prisma';

// ─── Constants ────────────────────────────────────────────────────

/** Hard minimum: never delete data newer than this many days, regardless of config */
export const MIN_RETENTION_DAYS = 30;

/** Defaults applied when no per-type override is provided */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  dailyMarketSnapshot: 90,
  dailyCandidateSnapshot: 60,
  dailyWatchlistSnapshot: 60,
  notificationDeliveryLog: 90,
};

// ─── Types ────────────────────────────────────────────────────────

export interface RetentionPolicy {
  /** How many days of DailyMarketSnapshot rows to keep (default: 90) */
  dailyMarketSnapshot: number;
  /** How many days of DailyCandidateSnapshot rows to keep (default: 60) */
  dailyCandidateSnapshot: number;
  /** How many days of DailyWatchlistSnapshot rows to keep (default: 60) */
  dailyWatchlistSnapshot: number;
  /** How many days of NotificationDeliveryLog rows to keep (default: 90) */
  notificationDeliveryLog: number;
}

export interface TableCleanupResult {
  table: string;
  cutoffDate: string;        // ISO date / datetime used as cutoff
  scanned: number;           // rows older than cutoff
  deleted: number;           // rows actually removed (0 in dryRun)
  skipped: number;           // rows NOT removed (protected / error)
  dryRun: boolean;
  error?: string;
}

export interface CleanupSummary {
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  policy: RetentionPolicy;
  results: TableCleanupResult[];
  totalScanned: number;
  totalDeleted: number;
  totalSkipped: number;
  warnings: string[];
  limitations: string[];
}

export interface DataRetentionOptions {
  /** If true, calculate what would be deleted but don't touch DB (default: false) */
  dryRun?: boolean;
  /** Override retention days per table. Values below MIN_RETENTION_DAYS are clamped. */
  policy?: Partial<RetentionPolicy>;
}

// ─── Helpers ──────────────────────────────────────────────────────

function cutoffDateString(retentionDays: number): string {
  const days = Math.max(retentionDays, MIN_RETENTION_DAYS);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function cutoffDateTime(retentionDays: number): Date {
  const days = Math.max(retentionDays, MIN_RETENTION_DAYS);
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Service ──────────────────────────────────────────────────────

export class DataRetentionService {
  private readonly dryRun: boolean;
  private readonly policy: RetentionPolicy;

  constructor(options: DataRetentionOptions = {}) {
    this.dryRun = options.dryRun ?? false;

    // Merge with defaults, clamping each value to MIN_RETENTION_DAYS
    const overrides = options.policy ?? {};
    this.policy = {
      dailyMarketSnapshot: Math.max(
        overrides.dailyMarketSnapshot ?? DEFAULT_RETENTION_POLICY.dailyMarketSnapshot,
        MIN_RETENTION_DAYS
      ),
      dailyCandidateSnapshot: Math.max(
        overrides.dailyCandidateSnapshot ?? DEFAULT_RETENTION_POLICY.dailyCandidateSnapshot,
        MIN_RETENTION_DAYS
      ),
      dailyWatchlistSnapshot: Math.max(
        overrides.dailyWatchlistSnapshot ?? DEFAULT_RETENTION_POLICY.dailyWatchlistSnapshot,
        MIN_RETENTION_DAYS
      ),
      notificationDeliveryLog: Math.max(
        overrides.notificationDeliveryLog ?? DEFAULT_RETENTION_POLICY.notificationDeliveryLog,
        MIN_RETENTION_DAYS
      ),
    };
  }

  // ── Public entry points ─────────────────────────────────────────

  /** Run cleanup for all configured tables and return a full summary. */
  async runAll(): Promise<CleanupSummary> {
    const startedAt = new Date().toISOString();
    const warnings: string[] = [];
    const limitations: string[] = [
      'Minimum retention is always 30 days regardless of policy settings.',
      'Today\'s data is never deleted.',
    ];

    const results = await Promise.all([
      this.cleanDailyMarketSnapshot(),
      this.cleanDailyCandidateSnapshot(),
      this.cleanDailyWatchlistSnapshot(),
      this.cleanNotificationDeliveryLog(),
    ]);

    // Warn if any table had errors
    for (const r of results) {
      if (r.error) {
        warnings.push(`[${r.table}] cleanup error: ${r.error}`);
      }
    }

    // Warn if nothing was deleted despite large scanned count in non-dryRun
    if (!this.dryRun) {
      const bigScanned = results.filter(r => r.scanned > 0 && r.deleted === 0 && !r.error);
      for (const r of bigScanned) {
        warnings.push(`[${r.table}] ${r.scanned} rows matched cutoff but 0 deleted — check for errors.`);
      }
    }

    const totalScanned = results.reduce((s, r) => s + r.scanned, 0);
    const totalDeleted = results.reduce((s, r) => s + r.deleted, 0);
    const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);

    return {
      dryRun: this.dryRun,
      startedAt,
      completedAt: new Date().toISOString(),
      policy: this.policy,
      results,
      totalScanned,
      totalDeleted,
      totalSkipped,
      warnings,
      limitations,
    };
  }

  // ── Per-table cleaners ──────────────────────────────────────────

  /** DailyMarketSnapshot — keyed by snapshotDate (String YYYY-MM-DD) */
  async cleanDailyMarketSnapshot(): Promise<TableCleanupResult> {
    const cutoff = cutoffDateString(this.policy.dailyMarketSnapshot);
    const todayStr = today();
    const table = 'DailyMarketSnapshot';

    try {
      // Count rows older than cutoff (excluding today as safety net)
      const scanned = await prisma.dailyMarketSnapshot.count({
        where: {
          snapshotDate: { lt: cutoff, not: todayStr },
        },
      });

      if (this.dryRun || scanned === 0) {
        return { table, cutoffDate: cutoff, scanned, deleted: 0, skipped: scanned, dryRun: this.dryRun };
      }

      const { count: deleted } = await prisma.dailyMarketSnapshot.deleteMany({
        where: {
          snapshotDate: { lt: cutoff, not: todayStr },
        },
      });

      return { table, cutoffDate: cutoff, scanned, deleted, skipped: scanned - deleted, dryRun: false };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      console.error(`[DataRetention] ${table} error:`, err);
      return { table, cutoffDate: cutoff, scanned: 0, deleted: 0, skipped: 0, dryRun: this.dryRun, error: err };
    }
  }

  /** DailyCandidateSnapshot — keyed by (snapshotDate, symbol) */
  async cleanDailyCandidateSnapshot(): Promise<TableCleanupResult> {
    const cutoff = cutoffDateString(this.policy.dailyCandidateSnapshot);
    const todayStr = today();
    const table = 'DailyCandidateSnapshot';

    try {
      const scanned = await prisma.dailyCandidateSnapshot.count({
        where: {
          snapshotDate: { lt: cutoff, not: todayStr },
        },
      });

      if (this.dryRun || scanned === 0) {
        return { table, cutoffDate: cutoff, scanned, deleted: 0, skipped: scanned, dryRun: this.dryRun };
      }

      const { count: deleted } = await prisma.dailyCandidateSnapshot.deleteMany({
        where: {
          snapshotDate: { lt: cutoff, not: todayStr },
        },
      });

      return { table, cutoffDate: cutoff, scanned, deleted, skipped: scanned - deleted, dryRun: false };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      console.error(`[DataRetention] ${table} error:`, err);
      return { table, cutoffDate: cutoff, scanned: 0, deleted: 0, skipped: 0, dryRun: this.dryRun, error: err };
    }
  }

  /** DailyWatchlistSnapshot — keyed by (snapshotDate, symbol) */
  async cleanDailyWatchlistSnapshot(): Promise<TableCleanupResult> {
    const cutoff = cutoffDateString(this.policy.dailyWatchlistSnapshot);
    const todayStr = today();
    const table = 'DailyWatchlistSnapshot';

    try {
      const scanned = await prisma.dailyWatchlistSnapshot.count({
        where: {
          snapshotDate: { lt: cutoff, not: todayStr },
        },
      });

      if (this.dryRun || scanned === 0) {
        return { table, cutoffDate: cutoff, scanned, deleted: 0, skipped: scanned, dryRun: this.dryRun };
      }

      const { count: deleted } = await prisma.dailyWatchlistSnapshot.deleteMany({
        where: {
          snapshotDate: { lt: cutoff, not: todayStr },
        },
      });

      return { table, cutoffDate: cutoff, scanned, deleted, skipped: scanned - deleted, dryRun: false };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      console.error(`[DataRetention] ${table} error:`, err);
      return { table, cutoffDate: cutoff, scanned: 0, deleted: 0, skipped: 0, dryRun: this.dryRun, error: err };
    }
  }

  /** NotificationDeliveryLog — keyed by sentAt (DateTime) */
  async cleanNotificationDeliveryLog(): Promise<TableCleanupResult> {
    const cutoffDt = cutoffDateTime(this.policy.notificationDeliveryLog);
    const cutoffIso = cutoffDt.toISOString();
    const table = 'NotificationDeliveryLog';

    try {
      // Use dynamic prisma access since NotificationDeliveryLog was added via db push
      const model = (prisma as any).notificationDeliveryLog;
      if (!model) {
        return {
          table, cutoffDate: cutoffIso, scanned: 0, deleted: 0, skipped: 0,
          dryRun: this.dryRun, error: 'Model not available — run prisma db push',
        };
      }

      const scanned: number = await model.count({
        where: { sentAt: { lt: cutoffDt } },
      });

      if (this.dryRun || scanned === 0) {
        return { table, cutoffDate: cutoffIso, scanned, deleted: 0, skipped: scanned, dryRun: this.dryRun };
      }

      const { count: deleted } = await model.deleteMany({
        where: { sentAt: { lt: cutoffDt } },
      });

      return { table, cutoffDate: cutoffIso, scanned, deleted, skipped: scanned - deleted, dryRun: false };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      console.error(`[DataRetention] ${table} error:`, err);
      return { table, cutoffDate: cutoffIso, scanned: 0, deleted: 0, skipped: 0, dryRun: this.dryRun, error: err };
    }
  }
}
