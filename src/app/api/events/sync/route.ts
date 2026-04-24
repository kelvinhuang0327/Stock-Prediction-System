import { NextRequest, NextResponse } from 'next/server';
import { syncAndStoreEvents } from '@/lib/events/EventIngestionService';

export async function POST(req: NextRequest) {
  let body: { dryRun?: boolean; limit?: number } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const dryRun = body.dryRun === true;
  const limit = Math.min(Math.max(body.limit ?? 30, 1), 200);

  try {
    const result = await syncAndStoreEvents({
      includeRss: true,
      includeMock: false,
      dryRun,
      limit,
    });

    return NextResponse.json({
      success: true,
      dryRun,
      limit,
      fetched: result.bundle.rawCount,
      dedupedInMemory: result.bundle.dedupedCount,
      toPersist: result.bundle.events.length,
      inserted: result.persist.inserted,
      skippedDuplicate: result.persist.skippedDuplicate,
      failed: result.persist.failed,
      trustLevelSummary: result.bundle.trustLevelSummary,
      sourceBreakdown: result.bundle.sourceBreakdown,
      limitations: result.bundle.limitations,
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'event sync failed',
        dryRun,
        limit,
        last_updated: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') ?? '30'), 1), 200);
  try {
    const result = await syncAndStoreEvents({
      includeRss: true,
      includeMock: false,
      dryRun,
      limit,
    });
    return NextResponse.json({
      success: true,
      dryRun,
      limit,
      fetched: result.bundle.rawCount,
      dedupedInMemory: result.bundle.dedupedCount,
      toPersist: result.bundle.events.length,
      inserted: result.persist.inserted,
      skippedDuplicate: result.persist.skippedDuplicate,
      failed: result.persist.failed,
      trustLevelSummary: result.bundle.trustLevelSummary,
      sourceBreakdown: result.bundle.sourceBreakdown,
      limitations: result.bundle.limitations,
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'event sync failed',
        dryRun,
        limit,
        last_updated: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
