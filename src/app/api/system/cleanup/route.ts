/**
 * /api/system/cleanup — Data retention cleanup endpoint
 *
 * Query params:
 *   dryRun=true|false          — default: true (safe by default)
 *   retentionDays=N            — applies to all tables (overridable per-table below)
 *   marketDays=N               — DailyMarketSnapshot retention (default: 90)
 *   candidateDays=N            — DailyCandidateSnapshot retention (default: 60)
 *   watchlistDays=N            — DailyWatchlistSnapshot retention (default: 60)
 *   portfolioImpactDays=N      — PortfolioImpactSnapshot retention (default: 180)
 *   logDays=N                  — NotificationDeliveryLog retention (default: 90)
 *
 * Safety:
 *   - Default is dryRun=true — must explicitly pass dryRun=false to delete
 *   - Minimum retention is always 30 days (enforced in service layer)
 *   - Today's data is never deleted
 *
 * Returns: CleanupSummary
 */

import { NextRequest, NextResponse } from 'next/server';
import { DataRetentionService, DEFAULT_RETENTION_POLICY, MIN_RETENTION_DAYS } from '@/lib/data/DataRetentionService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Default to dryRun=true for safety — require explicit opt-in to real deletes
  const dryRun = searchParams.get('dryRun') !== 'false';

  // Global override (applied to all tables if per-table not specified)
  const globalDays = searchParams.has('retentionDays')
    ? Math.max(parseInt(searchParams.get('retentionDays')!, 10), MIN_RETENTION_DAYS)
    : undefined;

  const policy = {
    dailyMarketSnapshot: searchParams.has('marketDays')
      ? parseInt(searchParams.get('marketDays')!, 10)
      : globalDays ?? DEFAULT_RETENTION_POLICY.dailyMarketSnapshot,
    dailyCandidateSnapshot: searchParams.has('candidateDays')
      ? parseInt(searchParams.get('candidateDays')!, 10)
      : globalDays ?? DEFAULT_RETENTION_POLICY.dailyCandidateSnapshot,
    dailyWatchlistSnapshot: searchParams.has('watchlistDays')
      ? parseInt(searchParams.get('watchlistDays')!, 10)
      : globalDays ?? DEFAULT_RETENTION_POLICY.dailyWatchlistSnapshot,
    portfolioImpactSnapshot: searchParams.has('portfolioImpactDays')
      ? parseInt(searchParams.get('portfolioImpactDays')!, 10)
      : globalDays ?? DEFAULT_RETENTION_POLICY.portfolioImpactSnapshot,
    notificationDeliveryLog: searchParams.has('logDays')
      ? parseInt(searchParams.get('logDays')!, 10)
      : globalDays ?? DEFAULT_RETENTION_POLICY.notificationDeliveryLog,
  };

  try {
    const svc = new DataRetentionService({ dryRun, policy });
    const summary = await svc.runAll();

    return NextResponse.json({
      ok: true,
      ...summary,
    });
  } catch (error) {
    console.error('[Cleanup API] Error:', error);
    return NextResponse.json(
      { ok: false, error: '清理程序執行失敗', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
