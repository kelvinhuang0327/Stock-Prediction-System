import { NextRequest, NextResponse } from 'next/server';
import { createDailySnapshot, getSnapshotStatus } from '@/lib/report/DailySnapshotEngine';

export async function GET() {
  try {
    const status = await getSnapshotStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('[Snapshot API] GET error:', error);
    return NextResponse.json(
      { error: '無法取得快照狀態', latestDate: null, totalMarketSnapshots: 0, totalCandidateSnapshots: 0, totalWatchlistSnapshots: 0, availableDates: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try { body = await request.json(); } catch { /* empty body is ok */ }

    const date = typeof body.date === 'string' ? body.date : undefined;
    const forceRefresh = body.forceRefresh === true;
    const includeWatchlist = body.includeWatchlist !== false;

    const result = await createDailySnapshot({ date, forceRefresh, includeWatchlist });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Snapshot API] POST error:', error);
    return NextResponse.json(
      {
        snapshotDate: new Date().toISOString().split('T')[0],
        success: false,
        marketCreated: false,
        candidatesCreated: 0,
        candidatesUpdated: 0,
        watchlistCreated: 0,
        watchlistUpdated: 0,
        limitations: [`系統錯誤: ${error instanceof Error ? error.message : String(error)}`],
      },
      { status: 500 }
    );
  }
}
