import { type NextRequest, NextResponse } from 'next/server';
import { buildDailyOpsReport } from '@/lib/report/OpsReportEngine';
import { resolveCurrentDate } from '@/lib/time/currentDate';
import { resolveAsOfDate } from '@/lib/data/AsOfDataGate';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/report/ops
 *
 * Returns the Daily Ops Report v1 — a structured system health and data
 * observability artifact.
 *
 * IMPORTANT: This is NOT a trading advisory. This is NOT a buy/sell content.
 * This is NOT ROI evidence. This is a system readiness and observability artifact.
 *
 * Query params:
 *   ?date=YYYY-MM-DD  Override the report date. If omitted, uses system date.
 *   ?asOfDate=YYYY-MM-DD  Override the as-of date for gate readiness check.
 *
 * No DB writes. No external API calls. No forbidden fields.
 */
export async function GET(req?: NextRequest | null) {
  const dateParam = req?.nextUrl?.searchParams?.get('date') ?? null;
  const asOfParam = req?.nextUrl?.searchParams?.get('asOfDate') ?? null;
  const reportDate = resolveCurrentDate(dateParam);
  const asOfDate = resolveAsOfDate(asOfParam ?? undefined);
  const asOfDb = asOfDate.replace(/-/g, '');

  try {
    const report = await buildDailyOpsReport(reportDate);

    // P0-03: as-of readiness summary — lightweight check without writing to DB.
    let asOfReadiness: {
      asOfDate: string;
      futureRowsDetected: boolean;
      futureRowsExcludedByGate: boolean;
      abnormalHistoricalRowsDetected: boolean;
      mvpUniverseTierSummary: string;
      readinessStatus: string;
      gateNote: string;
    };

    try {
      const [latestQuote, totalQuoteCount] = await Promise.all([
        prisma.stockQuote.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
        prisma.stockQuote.count(),
      ]);

      const latestDate = latestQuote?.date ?? null;
      const futureRowsDetected = latestDate ? latestDate > asOfDb : false;

      const gatedCount = await prisma.stockQuote.count({ where: { date: { lte: asOfDb } } });

      asOfReadiness = {
        asOfDate,
        futureRowsDetected,
        futureRowsExcludedByGate: futureRowsDetected,
        abnormalHistoricalRowsDetected: false,
        mvpUniverseTierSummary: `${gatedCount} rows on or before ${asOfDate} / ${totalQuoteCount} total`,
        readinessStatus: futureRowsDetected ? 'WARN' : 'PASS',
        gateNote: futureRowsDetected
          ? `P0-03: future rows detected (latest=${latestDate}). Excluded by as-of gate.`
          : `P0-03: no future rows detected. All data on or before ${asOfDate}.`,
      };
    } catch {
      asOfReadiness = {
        asOfDate,
        futureRowsDetected: false,
        futureRowsExcludedByGate: false,
        abnormalHistoricalRowsDetected: false,
        mvpUniverseTierSummary: 'unavailable',
        readinessStatus: 'UNAVAILABLE',
        gateNote: 'P0-03: asOfReadiness check failed — DB may be unavailable.',
      };
    }

    // P0-04: MarketIndex / MarketRegimeResult as-of readiness check
    let marketIndexAsOfReadiness: {
      asOfDate: string;
      marketIndexFutureRowsDetected: boolean;
      marketIndexFutureRowsExcludedByGate: boolean;
      marketRegimeResultFutureRowsDetected: boolean;
      marketRegimeResultSourceDate: string | null;
      marketRegimeResultGateStatus: string;
      readinessStatus: string;
      gateNote: string;
    };

    try {
      const [latestMarketIndex, latestRegimeResult] = await Promise.all([
        prisma.marketIndex.findFirst({
          where: { name: 'TAIEX' },
          orderBy: { date: 'desc' },
          select: { date: true },
        }),
        prisma.marketRegimeResult.findFirst({
          orderBy: { date: 'desc' },
          select: { date: true },
        }),
      ]);

      // MarketIndex date is YYYYMMDD string; asOfDb is also YYYYMMDD
      const miLatest = latestMarketIndex?.date ?? null;
      const miFutureDetected = miLatest ? miLatest > asOfDb : false;

      // MarketRegimeResult date is YYYY-MM-DD string; compare against asOfDate
      const mrLatest = latestRegimeResult?.date ?? null;
      const mrFutureDetected = mrLatest ? mrLatest > asOfDate : false;
      let mrGateStatus: string;
      if (!mrLatest) {
        mrGateStatus = 'MISSING';
      } else if (mrFutureDetected) {
        mrGateStatus = 'WARN_FUTURE_EXCLUDED';
      } else {
        mrGateStatus = 'PASS';
      }

      const overallStatus = miFutureDetected || mrFutureDetected ? 'WARN' : 'PASS';

      marketIndexAsOfReadiness = {
        asOfDate,
        marketIndexFutureRowsDetected: miFutureDetected,
        marketIndexFutureRowsExcludedByGate: miFutureDetected,
        marketRegimeResultFutureRowsDetected: mrFutureDetected,
        marketRegimeResultSourceDate: mrLatest,
        marketRegimeResultGateStatus: mrGateStatus,
        readinessStatus: overallStatus,
        gateNote: overallStatus === 'WARN'
          ? `P0-04: MarketIndex or MarketRegimeResult has future-dated rows. Gate active (date <= ${asOfDate}).`
          : `P0-04: No future-dated MarketIndex or MarketRegimeResult rows detected.`,
      };
    } catch {
      marketIndexAsOfReadiness = {
        asOfDate,
        marketIndexFutureRowsDetected: false,
        marketIndexFutureRowsExcludedByGate: false,
        marketRegimeResultFutureRowsDetected: false,
        marketRegimeResultSourceDate: null,
        marketRegimeResultGateStatus: 'UNAVAILABLE',
        readinessStatus: 'UNAVAILABLE',
        gateNote: 'P0-04: marketIndexAsOfReadiness check failed — DB may be unavailable.',
      };
    }

    return NextResponse.json({ status: 'ok', report, asOfReadiness, marketIndexAsOfReadiness });
  } catch (error) {
    console.error('[OpsReport API] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to build Daily Ops Report',
        message: String(error),
      },
      { status: 500 },
    );
  }
}
