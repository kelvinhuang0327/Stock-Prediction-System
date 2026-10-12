import { NextRequest, NextResponse } from 'next/server';
import { generateDailyAlerts, type AlertSeverity } from '@/lib/notify/DailyAlertEngine';
import { AutonomousAlertNotificationAdapter } from '@/lib/jobs/AutonomousAlertNotificationAdapter';
import { apiCache } from '@/lib/cache';

const CACHE_TTL = 180; // 3 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeWatchlist = searchParams.get('includeWatchlist') !== 'false';
    const minSeverity = (searchParams.get('minSeverity') as AlertSeverity | null) ?? undefined;
    const maxItems = searchParams.has('maxItems') ? Number(searchParams.get('maxItems')) : 50;
    const includeDataWarnings = searchParams.get('includeDataWarnings') !== 'false';
    const includeEventAlerts = searchParams.get('includeEventAlerts') !== 'false';

    const cacheKey = `notify:daily:wl=${includeWatchlist}:ms=${minSeverity ?? 'all'}:max=${maxItems}:dw=${includeDataWarnings}:ea=${includeEventAlerts}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [result, autonomousDigest] = await Promise.all([
      generateDailyAlerts({
        includeWatchlist,
        minSeverity,
        maxItems,
        includeDataWarnings,
        includeEventAlerts,
      }),
      new AutonomousAlertNotificationAdapter().buildDigest(),
    ]);

    const mergedResult = autonomousDigest.shouldAttach
      ? { ...result, autonomousAlerts: autonomousDigest }
      : result;
    apiCache.set(cacheKey, mergedResult, CACHE_TTL);

    return NextResponse.json(mergedResult);
  } catch (error) {
    console.error('[DailyAlert API] error:', error);
    return NextResponse.json(
      {
        reportDate: new Date().toISOString().split('T')[0],
        summary: '提醒產生失敗',
        overallSeverity: 'warning',
        alerts: [],
        eventAlerts: [],
        eventAlertSummary: '事件提醒產生失敗',
        comparisonAvailable: false,
        previousSnapshotDate: null,
        limitations: ['系統錯誤'],
        generatedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
