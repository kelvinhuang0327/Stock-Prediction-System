/**
 * GET /api/admin/data-quality
 *
 * Returns a comprehensive data quality report covering:
 * - StockQuote coverage (stocks with ≥20/60/100/250 days)
 * - MarketIndex freshness and day count
 * - InstitutionalChip coverage and staleness
 * - Analysis engine eligibility (backtest, chip, full)
 * - Overall quality score (0–100)
 * - P0-02A: as-of readiness summary
 *
 * This endpoint helps diagnose why analysis engines degrade:
 * - ChipAgent Insufficient  → chipCoveredStocks < 20
 * - Backtest unavailable    → stocksGe100Days = 0
 * - Regime unavailable      → marketIndexDays < 100
 */

import { NextRequest, NextResponse } from 'next/server';
import { runQualityCheck } from '@/lib/data/DataQualityChecker';
import { resolveAsOfDate } from '@/lib/data/AsOfDataGate';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // P0-02A: resolve asOfDate for as-of readiness summary
  const asOfDateRaw = request.nextUrl.searchParams.get('asOfDate') ?? undefined;
  const asOfDate = resolveAsOfDate(asOfDateRaw);
  const asOfDateDb = asOfDate.replace(/-/g, '');

  try {
    const report = await runQualityCheck();

    // Build a human-readable diagnosis
    const diagnosis: string[] = [];
    const cs = report.coverageSummary;

    if (cs.chipAgentActive) {
      diagnosis.push(`ChipAgent 可用 — ${cs.chipCoveredStocks} 檔股票有法人資料`);
    } else {
      diagnosis.push(`⚠️ ChipAgent 不可用 — 法人資料覆蓋 ${cs.chipCoveredStocks} 檔（需 ≥20 檔）`);
    }

    if (cs.backtestEligible > 0) {
      diagnosis.push(`回測可用 — ${cs.backtestEligible} 檔股票有 ≥100 天歷史資料`);
    } else {
      diagnosis.push(`⚠️ 無任何股票滿足回測最低需求 (≥100 天)`);
    }

    if (cs.marketIndexDays >= 100) {
      diagnosis.push(`Regime 偵測可用 — TAIEX ${cs.marketIndexDays} 天`);
    } else {
      diagnosis.push(`⚠️ TAIEX 資料不足，Regime 偵測受限 (僅 ${cs.marketIndexDays} 天)`);
    }

    if (cs.fullAnalysisEligible > 0) {
      diagnosis.push(`完整分析可用 — ${cs.fullAnalysisEligible} 檔同時滿足回測 + 法人資料`);
    } else {
      diagnosis.push(`⚠️ 無任何股票同時滿足回測 + 法人資料條件`);
    }

    // Stale data warnings
    const quoteTable = report.tables.find(t => t.table === 'StockQuote');
    const chipTable = report.tables.find(t => t.table === 'InstitutionalChip');
    const indexTable = report.tables.find(t => t.table === 'MarketIndex');

    if (quoteTable && quoteTable.staleDays > 5) {
      diagnosis.push(`⚠️ 股票報價已 ${quoteTable.staleDays} 天未更新（最後：${quoteTable.latestDate}）`);
    }
    if (chipTable && chipTable.staleDays > 5) {
      diagnosis.push(`⚠️ 法人籌碼已 ${chipTable.staleDays} 天未更新（最後：${chipTable.latestDate}）`);
    }
    if (indexTable && indexTable.staleDays > 5) {
      diagnosis.push(`⚠️ 大盤指數已 ${indexTable.staleDays} 天未更新（最後：${indexTable.latestDate}）`);
    }

    // P0-02A: build as-of readiness summary (lightweight, no extra DB queries)
    const quoteLatest = quoteTable?.latestDate ?? null;
    const chipLatest = chipTable?.latestDate ?? null;
    const indexLatest = indexTable?.latestDate ?? null;

    // Check for potential future rows (latestDate > asOfDateDb indicates future rows in DB)
    const quoteFutureDetected = quoteLatest != null && quoteLatest > asOfDateDb;
    const chipFutureDetected = chipLatest != null && chipLatest > asOfDateDb;
    const indexFutureDetected = indexLatest != null && indexLatest > asOfDateDb;
    const futureRowsDetected = quoteFutureDetected || chipFutureDetected || indexFutureDetected;

    const asOfReadiness = {
      asOfDate,
      asOfDateDb,
      futureRowsDetected,
      futureRowsExcludedByGate: futureRowsDetected,
      futureRowsDetails: {
        stockQuoteFutureDetected: quoteFutureDetected,
        institutionalChipFutureDetected: chipFutureDetected,
        marketIndexFutureDetected: indexFutureDetected,
      },
      abnormalHistoricalRowsDetected: report.tables.some(t => t.issues.length > 0),
      mvpUniverseTierSummary: {
        walkForwardEligible: cs.stocksGe250Days, // 250+ days as walk-forward proxy
        tierAEligible: cs.stocksGe250Days,
        limitedEligible: cs.stocksGe60Days,
        backtestEligible: cs.backtestEligible,
        chipCoveredStocks: cs.chipCoveredStocks,
      },
      readinessStatus: futureRowsDetected ? 'WARN_FUTURE_ROWS_IN_DB' : 'READY',
      readinessNote: futureRowsDetected
        ? `Future rows detected in DB (latest > asOfDate=${asOfDate}). As-of gate API layer excludes them for screen/detail queries.`
        : `No future rows detected relative to asOfDate=${asOfDate}. Data gate OK.`,
      gateNote: 'P0-02A: as-of gate active on /api/strategy/screen and /api/stocks/[id]/detail. /api/stocks/[id]/history is external-proxy BLOCKED. Research tool only.',
    };

    return NextResponse.json({
      ...report,
      diagnosis,
      asOfReadiness,
    });
  } catch (error) {
    console.error('[data-quality] check failed:', error);
    return NextResponse.json(
      { error: 'Data quality check failed', detail: String(error) },
      { status: 500 }
    );
  }
}


    // Build a human-readable diagnosis
    const diagnosis: string[] = [];
    const cs = report.coverageSummary;

    if (cs.chipAgentActive) {
      diagnosis.push(`ChipAgent 可用 — ${cs.chipCoveredStocks} 檔股票有法人資料`);
    } else {
      diagnosis.push(`⚠️ ChipAgent 不可用 — 法人資料覆蓋 ${cs.chipCoveredStocks} 檔（需 ≥20 檔）`);
    }

    if (cs.backtestEligible > 0) {
      diagnosis.push(`回測可用 — ${cs.backtestEligible} 檔股票有 ≥100 天歷史資料`);
    } else {
      diagnosis.push(`⚠️ 無任何股票滿足回測最低需求 (≥100 天)`);
    }

    if (cs.marketIndexDays >= 100) {
      diagnosis.push(`Regime 偵測可用 — TAIEX ${cs.marketIndexDays} 天`);
    } else {
      diagnosis.push(`⚠️ TAIEX 資料不足，Regime 偵測受限 (僅 ${cs.marketIndexDays} 天)`);
    }

    if (cs.fullAnalysisEligible > 0) {
      diagnosis.push(`完整分析可用 — ${cs.fullAnalysisEligible} 檔同時滿足回測 + 法人資料`);
    } else {
      diagnosis.push(`⚠️ 無任何股票同時滿足回測 + 法人資料條件`);
    }

    // Stale data warnings
    const quoteTable = report.tables.find(t => t.table === 'StockQuote');
    const chipTable = report.tables.find(t => t.table === 'InstitutionalChip');
    const indexTable = report.tables.find(t => t.table === 'MarketIndex');

    if (quoteTable && quoteTable.staleDays > 5) {
      diagnosis.push(`⚠️ 股票報價已 ${quoteTable.staleDays} 天未更新（最後：${quoteTable.latestDate}）`);
    }
    if (chipTable && chipTable.staleDays > 5) {
      diagnosis.push(`⚠️ 法人籌碼已 ${chipTable.staleDays} 天未更新（最後：${chipTable.latestDate}）`);
    }
    if (indexTable && indexTable.staleDays > 5) {
      diagnosis.push(`⚠️ 大盤指數已 ${indexTable.staleDays} 天未更新（最後：${indexTable.latestDate}）`);
    }

    return NextResponse.json({
      ...report,
      diagnosis,
    });
  } catch (error) {
    console.error('[data-quality] check failed:', error);
    return NextResponse.json(
      { error: 'Data quality check failed', detail: String(error) },
      { status: 500 }
    );
  }
}
