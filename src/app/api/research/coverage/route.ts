/**
 * GET /api/research/coverage
 *
 * Returns a unified Research Coverage / Gaps Report reflecting the current
 * state of all research modules. This is a RESEARCH TRANSPARENCY endpoint
 * only — it never produces trading signals or modifies core scores.
 *
 * Data sources (all read-only):
 *   - SignalEffectivenessBatchService (signal metrics)
 *   - MarketIndex table count (TAIEX availability check)
 *   - DailyMarketSnapshot table count (regime history check)
 *   - EventSummaryEngine (event source quality)
 *
 * Cache: 300s (5 minutes). Results change only when underlying data changes.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildSignalEffectivenessBatch,
  buildDegradedSignalEffectivenessBatch,
} from '@/lib/signals/SignalEffectivenessBatchService';
import { getMarketEventSummary } from '@/lib/events/EventSummaryEngine';
import { buildResearchGapsReport } from '@/lib/research/ResearchCoverageEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch all data sources in parallel
    const [signalBatch, taiexRowCount, regimeSnapshotCount, eventRes] = await Promise.all([
      buildSignalEffectivenessBatch({ window: 5 }).catch(() =>
        buildDegradedSignalEffectivenessBatch(5, undefined, 'signal batch unavailable for coverage report'),
      ),
      prisma.marketIndex.count({ where: { name: 'TAIEX' } }).catch(() => 0),
      prisma.dailyMarketSnapshot.count().catch(() => 0),
      getMarketEventSummary({ days: 1, limit: 30 }).catch(() => null),
    ]);

    const eventSourceQuality = eventRes?.summary.sourceQuality ?? null;

    const report = buildResearchGapsReport({
      signalBatch,
      eventSourceQuality,
      taiexRowCount,
      regimeSnapshotCount,
    });

    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    // Return a fully degraded report rather than a 500 error
    const degradedReport = buildResearchGapsReport({
      signalBatch: buildDegradedSignalEffectivenessBatch(5, undefined, 'coverage report fetch failed'),
      eventSourceQuality: null,
      taiexRowCount: 0,
      regimeSnapshotCount: 0,
    });

    return NextResponse.json(
      {
        ...degradedReport,
        limitations: [
          'coverage report 資料取得失敗，回傳保守降級結果',
          error instanceof Error ? error.message : '未知錯誤',
          ...degradedReport.limitations,
        ],
      },
      {
        status: 200, // Return 200 to allow the UI to still render the degraded state
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
