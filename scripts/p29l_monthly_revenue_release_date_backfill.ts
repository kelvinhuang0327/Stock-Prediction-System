/**
 * P29L — MonthlyRevenue releaseDate Historical Backfill Script
 *
 * Backfills releaseDate, releaseDateSource, releaseDateConfidence for
 * MonthlyRevenue rows that have releaseDate = NULL (rows synced before P29K repair).
 *
 * SAFETY:
 * - dryRun = true by default — NEVER writes to DB unless explicitly set to false
 * - productionApply requires explicit --apply flag
 * - NOT run in P29L session — script is READY but NOT APPLIED
 *
 * DISCLAIMER: Structural DB maintenance only.
 * Does not constitute investment advice.
 * No profit, return, or investment performance claims.
 * MonthlyRevenue entersAlphaScore = false. ALWAYS.
 * Results must not be used as buy/sell/hold signals.
 *
 * Usage:
 *   npx ts-node scripts/p29l_monthly_revenue_release_date_backfill.ts         # dry-run (safe)
 *   npx ts-node scripts/p29l_monthly_revenue_release_date_backfill.ts --apply  # actual write (requires CTO auth)
 */

import { PrismaClient } from '@prisma/client';
import {
  computeBackfillRows,
  MONTHLY_REVENUE_BACKFILL_VERSION,
  MONTHLY_REVENUE_BACKFILL_DISCLAIMER,
  formatBackfillReleaseDateUtc,
  type NullReleaseDateRow,
} from '../src/lib/onlineValidation/p29l/MonthlyRevenueBackfillReadiness';

const prisma = new PrismaClient();

export interface BackfillRunOptions {
  /**
   * If true (default): query rows, compute dates, report — do NOT write to DB.
   * If false: actually write to DB. Requires explicit --apply flag or explicit opt-in.
   */
  dryRun: boolean;
  /** Max rows to process in one run (safety cap) */
  limit?: number;
}

export interface BackfillRunResult {
  dryRun: boolean;
  totalNullRows: number;
  processedRows: number;
  writtenRows: number;
  skippedRows: number;
  productionApplied: boolean;
  version: string;
  disclaimer: string;
  entersAlphaScore: false;
  sampleComputed: Array<{
    stockId: string;
    year: number;
    month: number;
    releaseDateIso: string;
    releaseDateSource: string;
    releaseDateConfidence: string;
  }>;
}

/**
 * Run the backfill.
 *
 * Default: dryRun=true. Will NOT write to DB unless dryRun=false.
 */
export async function runBackfill(options: BackfillRunOptions): Promise<BackfillRunResult> {
  const { dryRun = true, limit = 10000 } = options;

  console.log(`[p29l-backfill] Starting. dryRun=${dryRun}, limit=${limit}`);
  console.log(`[p29l-backfill] ${MONTHLY_REVENUE_BACKFILL_DISCLAIMER}`);

  // Query rows with NULL releaseDate
  const nullRows = await prisma.monthlyRevenue.findMany({
    where: { releaseDate: null },
    select: { stockId: true, year: true, month: true, releaseDate: true },
    take: limit,
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  }) as Array<{ stockId: string; year: number; month: number; releaseDate: null }>;

  const totalNullRows = nullRows.length;
  console.log(`[p29l-backfill] Found ${totalNullRows} rows with releaseDate = NULL`);

  const nullRowsTyped: NullReleaseDateRow[] = nullRows.map(r => ({
    ...r,
    releaseDate: null,
  }));

  const backfilled = computeBackfillRows(nullRowsTyped);
  const sampleComputed = backfilled.slice(0, 10).map(r => ({
    stockId: r.stockId,
    year: r.year,
    month: r.month,
    releaseDateIso: r.releaseDate.toISOString(),
    releaseDateSource: r.releaseDateSource,
    releaseDateConfidence: r.releaseDateConfidence,
  }));

  if (dryRun) {
    console.log(`[p29l-backfill] DRY-RUN — no writes. Would update ${totalNullRows} rows.`);
    console.log('[p29l-backfill] Sample (first 10):');
    for (const s of sampleComputed) {
      console.log(`  ${s.stockId} ${s.year}-${String(s.month).padStart(2,'0')} → ${formatBackfillReleaseDateUtc(new Date(s.releaseDateIso))}`);
    }
    return {
      dryRun: true,
      totalNullRows,
      processedRows: totalNullRows,
      writtenRows: 0,
      skippedRows: 0,
      productionApplied: false,
      version: MONTHLY_REVENUE_BACKFILL_VERSION,
      disclaimer: MONTHLY_REVENUE_BACKFILL_DISCLAIMER,
      entersAlphaScore: false,
      sampleComputed,
    };
  }

  // Actual write path — only reached if dryRun=false (requires explicit --apply)
  console.log(`[p29l-backfill] WRITE MODE — updating ${totalNullRows} rows`);
  let writtenRows = 0;
  let skippedRows = 0;

  const BATCH_SIZE = 100;
  for (let i = 0; i < backfilled.length; i += BATCH_SIZE) {
    const batch = backfilled.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      try {
        await prisma.monthlyRevenue.updateMany({
          where: {
            stockId: row.stockId,
            year: row.year,
            month: row.month,
            releaseDate: null,
          },
          data: {
            releaseDate: row.releaseDate,
            releaseDateSource: row.releaseDateSource,
            releaseDateConfidence: row.releaseDateConfidence,
          },
        });
        writtenRows++;
      } catch (err) {
        console.error(`[p29l-backfill] Failed row ${row.stockId} ${row.year}/${row.month}:`, err);
        skippedRows++;
      }
    }
    console.log(`[p29l-backfill] Progress: ${Math.min(i + BATCH_SIZE, backfilled.length)}/${backfilled.length}`);
  }

  console.log(`[p29l-backfill] Done. Written=${writtenRows}, Skipped=${skippedRows}`);
  return {
    dryRun: false,
    totalNullRows,
    processedRows: totalNullRows,
    writtenRows,
    skippedRows,
    productionApplied: true,
    version: MONTHLY_REVENUE_BACKFILL_VERSION,
    disclaimer: MONTHLY_REVENUE_BACKFILL_DISCLAIMER,
    entersAlphaScore: false,
    sampleComputed,
  };
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');

  if (!dryRun) {
    console.warn('[p29l-backfill] WARNING: --apply flag detected. Writing to DB.');
    console.warn('[p29l-backfill] This requires explicit CTO authorization per P29C contract.');
    console.warn('[p29l-backfill] Ensure you are NOT running on production DB.');
  }

  try {
    const result = await runBackfill({ dryRun });
    console.log('[p29l-backfill] Result:', JSON.stringify({
      ...result,
      sampleComputed: result.sampleComputed.slice(0, 3),
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

// Only run main if this is the entry script
if (require.main === module) {
  main().catch(err => {
    console.error('[p29l-backfill] Fatal error:', err);
    process.exit(1);
  });
}
