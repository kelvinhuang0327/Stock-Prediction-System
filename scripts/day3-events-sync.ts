/**
 * Day 3 Events Sync Script
 * Fetches fresh RSS news events and persists to DB.
 */
import { syncAndStoreEvents } from '../src/lib/events/EventIngestionService';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('=== DAY 3 EVENTS SYNC ===');

  // Pre-sync state
  const before = await prisma.newsEvent.findFirst({ orderBy: { publishedAt: 'desc' } });
  const beforeCount = await prisma.newsEvent.count();
  console.log(`Before: count=${beforeCount}, latest=${before?.publishedAt?.toISOString()?.slice(0,10) ?? 'none'}`);

  // Run sync
  console.log('Running RSS sync (includeRss=true, includeMock=false)...');
  const result = await syncAndStoreEvents({
    includeRss: true,
    includeMock: false,
    dryRun: false,
    limit: 200,
  });

  console.log('Sync result:', JSON.stringify({
    rawCount: result.bundle.rawCount,
    dedupedCount: result.bundle.dedupedCount,
    toPersist: result.bundle.events.length,
    inserted: result.persist.inserted,
    skippedDuplicate: result.persist.skippedDuplicate,
    failed: result.persist.failed,
    limitations: result.bundle.limitations,
    sourceBreakdown: result.bundle.sourceBreakdown,
    latestInBundle: result.bundle.events[0]?.publishedAt?.slice(0, 10) ?? 'none',
  }, null, 2));

  // Post-sync state
  const after = await prisma.newsEvent.findFirst({ orderBy: { publishedAt: 'desc' } });
  const afterCount = await prisma.newsEvent.count();
  console.log(`After: count=${afterCount}, latest=${after?.publishedAt?.toISOString()?.slice(0,10) ?? 'none'}`);

  const freshnessDays = after
    ? Math.floor((Date.now() - after.publishedAt.getTime()) / 86400000)
    : null;
  console.log(`Events freshness: ${freshnessDays} days`);
  console.log(`Coverage state: ${freshnessDays != null && freshnessDays <= 1 ? 'fresh' : freshnessDays != null && freshnessDays <= 3 ? 'degraded' : 'stale'}`);

  await prisma.$disconnect();
}

main().catch(console.error);
