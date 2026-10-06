/**
 * /api/daily-report/regime
 *
 * Returns the latest persisted MarketRegimeResult from the DB.
 *
 * IMPORTANT: This endpoint provides market context information only.
 * It is NOT a trading recommendation, NOT a buy/sell signal, and does
 * NOT constitute investment advice or imply future performance.
 *
 * Query params:
 *   ?date=YYYY-MM-DD     Override the current date for freshness calculation.
 *                        If omitted, uses system date.
 *   ?asOfDate=YYYY-MM-DD P0-04: Upper bound for DB query (date <= asOfDate).
 *                        When provided, future-dated regime rows are excluded.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getLatestMarketRegimeContext, computeFreshnessAlert } from '@/lib/marketRegimeResult';
import { resolveCurrentDate } from '@/lib/time/currentDate';

const GUARDRAILS = {
  notTradingRecommendation: true,
  notBuySellSignal: true,
  notPerformanceEvidence: true,
  p004AsOfGateEnabled: true,
} as const;

export async function GET(req?: NextRequest | null) {
  const dateParam = req?.nextUrl?.searchParams?.get('date') ?? null;
  const asOfDateParam = req?.nextUrl?.searchParams?.get('asOfDate') ?? null;
  const reportDate = resolveCurrentDate(dateParam);
  const asOfDate = asOfDateParam ?? undefined;

  try {
    const ctx = await getLatestMarketRegimeContext(reportDate, asOfDate);

    if (!ctx.isAvailable) {
      return NextResponse.json({
        status: 'missing',
        reportDate,
        asOfDate: asOfDate ?? null,
        asOfGateStatus: asOfDate ? 'ACTIVE' : 'NOT_APPLIED',
        regime: null,
        freshnessAlert: computeFreshnessAlert(ctx, reportDate),
        guardrails: GUARDRAILS,
      });
    }

    return NextResponse.json({
      status: 'ok',
      reportDate,
      asOfDate: asOfDate ?? null,
      asOfGateStatus: asOfDate ? 'ACTIVE' : 'NOT_APPLIED',
      regime: {
        date: ctx.date,
        sourceDate: ctx.date,
        regimeLabel: ctx.regimeLabel,
        confidence: ctx.confidence,
        taiexClose: ctx.taiexClose,
        source: ctx.source,
        version: ctx.version,
        freshnessStatus: ctx.freshnessStatus,
        freshnessLagDays: ctx.freshnessLagDays,
        warning: ctx.warning,
      },
      freshnessAlert: computeFreshnessAlert(ctx, reportDate),
      guardrails: GUARDRAILS,
    });
  } catch (error) {
    console.error('[daily-report/regime] Unexpected error:', error);
    return NextResponse.json(
      {
        status: 'error',
        reportDate,
        asOfDate: asOfDate ?? null,
        asOfGateStatus: 'ERROR',
        regime: null,
        freshnessAlert: {
          alertLevel: 'MISSING',
          freshnessLagDays: null,
          lastRegimeDate: null,
          currentDate: reportDate,
          message: 'Internal server error prevented freshness check.',
          requiresAction: true,
        },
        guardrails: GUARDRAILS,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
