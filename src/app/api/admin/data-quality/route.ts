/**
 * GET /api/admin/data-quality
 *
 * Returns a comprehensive data quality report covering:
 * - StockQuote coverage (stocks with ≥20/60/100/250 days)
 * - MarketIndex freshness and day count
 * - InstitutionalChip coverage and staleness
 * - Analysis engine eligibility (backtest, chip, full)
 * - Overall quality score (0–100)
 *
 * This endpoint helps diagnose why analysis engines degrade:
 * - ChipAgent Insufficient  → chipCoveredStocks < 20
 * - Backtest unavailable    → stocksGe100Days = 0
 * - Regime unavailable      → marketIndexDays < 100
 */

import { NextResponse } from 'next/server';
import { runQualityCheck } from '@/lib/data/DataQualityChecker';

export const dynamic = 'force-dynamic';

export async function GET() {
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
