/**
 * /api/data/status - 資料可用性即時檢查 API
 * 
 * 回傳每個資料來源的即時狀態，供前端決定功能模式。
 * 不依賴靜態計數，而是即時查詢 DB。
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface SourceStatus {
  id: string;
  table: string;
  rowCount: number;
  stockCount: number;
  dateRange: { min: string; max: string } | null;
  grade: 'A' | 'B' | 'C' | 'D';
  usable: boolean;
}

export async function GET() {
  try {
    const results: SourceStatus[] = [];

    // Stock master
    const stockCount = await prisma.stock.count();
    results.push({
      id: 'stock_master', table: 'Stock',
      rowCount: stockCount, stockCount,
      dateRange: null,
      grade: stockCount > 100 ? 'A' : stockCount > 0 ? 'B' : 'D',
      usable: stockCount > 0,
    });

    // StockQuote
    const quoteCount = await prisma.stockQuote.count();
    const quoteStocks = await prisma.stockQuote.groupBy({
      by: ['stockId'],
      _count: { _all: true },
      having: { stockId: { _count: { gte: 20 } } },
    });
    const quoteDates = quoteCount > 0 ? await prisma.stockQuote.aggregate({
      _min: { date: true }, _max: { date: true },
    }) : null;
    results.push({
      id: 'stock_quote', table: 'StockQuote',
      rowCount: quoteCount,
      stockCount: quoteStocks.length,
      dateRange: quoteDates ? {
        min: quoteDates._min.date ?? '',
        max: quoteDates._max.date ?? '',
      } : null,
      grade: quoteStocks.length >= 50 ? 'A' : quoteStocks.length >= 10 ? 'B' : quoteStocks.length > 0 ? 'C' : 'D',
      usable: quoteStocks.length > 0,
    });

    // InstitutionalChip
    const chipCount = await (prisma as any).institutionalChip.count();
    const chipStocks = chipCount > 0 ? await (prisma as any).institutionalChip.groupBy({
      by: ['stockId'],
    }) : [];
    results.push({
      id: 'institutional_chip', table: 'InstitutionalChip',
      rowCount: chipCount,
      stockCount: chipStocks.length,
      dateRange: null,
      grade: chipStocks.length >= 20 ? 'B' : chipStocks.length > 0 ? 'C' : 'D',
      usable: chipStocks.length > 0,
    });

    // MonthlyRevenue
    const revCount = await prisma.monthlyRevenue.count();
    const revStocks = revCount > 0
      ? (await prisma.monthlyRevenue.groupBy({ by: ['stockId'] })).length
      : 0;
    results.push({
      id: 'monthly_revenue', table: 'MonthlyRevenue',
      rowCount: revCount,
      stockCount: revStocks,
      dateRange: null,
      grade: revStocks >= 500 ? 'A' : revStocks > 0 ? 'B' : 'D',
      usable: revStocks > 0,
    });

    // StockMetrics
    const metricsCount = await prisma.stockMetrics.count();
    results.push({
      id: 'stock_metrics', table: 'StockMetrics',
      rowCount: metricsCount,
      stockCount: 0,
      dateRange: null,
      grade: metricsCount >= 1000 ? 'B' : metricsCount > 0 ? 'C' : 'D',
      usable: metricsCount > 0,
    });

    // MarketIndex
    const indexCount = await prisma.marketIndex.count();
    results.push({
      id: 'market_index', table: 'MarketIndex',
      rowCount: indexCount,
      stockCount: 0,
      dateRange: null,
      grade: indexCount >= 100 ? 'B' : indexCount > 0 ? 'C' : 'D',
      usable: indexCount > 0,
    });

    // FinancialReport
    const finCount = await prisma.financialReport.count();
    results.push({
      id: 'financial_report', table: 'FinancialReport',
      rowCount: finCount,
      stockCount: 0,
      dateRange: null,
      grade: finCount >= 50 ? 'B' : finCount > 0 ? 'C' : 'D',
      usable: finCount > 0,
    });

    // Empty tables (D grade)
    for (const [id, table] of [
      ['news_event', 'NewsEvent'],
      ['prediction', 'Prediction'],
      ['doubling_features', 'DoublingFeatures'],
      ['strategy_signal', 'StrategySignal'],
    ]) {
      try {
        const count = await (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)].count();
        results.push({
          id, table, rowCount: count, stockCount: 0, dateRange: null,
          grade: count > 0 ? 'C' : 'D', usable: count > 0,
        });
      } catch {
        results.push({
          id, table, rowCount: 0, stockCount: 0, dateRange: null,
          grade: 'D', usable: false,
        });
      }
    }

    // Feature availability
    const sourceMap = Object.fromEntries(results.map(r => [r.id, r]));
    const features = {
      rankings: checkFeature(['stock_master', 'stock_quote'], ['stock_master'], sourceMap),
      institutional: checkFeature(['institutional_chip', 'stock_master'], ['institutional_chip'], sourceMap),
      signals: checkFeature(['stock_quote', 'stock_master'], ['stock_quote'], sourceMap),
      backtest: checkFeature(['stock_quote'], ['stock_quote'], sourceMap),
      watchlist: checkFeature(['stock_master'], ['stock_master'], sourceMap),
    };

    return NextResponse.json({
      sources: results,
      features,
      summary: {
        gradeA: results.filter(r => r.grade === 'A').length,
        gradeB: results.filter(r => r.grade === 'B').length,
        gradeC: results.filter(r => r.grade === 'C').length,
        gradeD: results.filter(r => r.grade === 'D').length,
        usable: results.filter(r => r.usable).length,
        total: results.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Data status check error:', error);
    return NextResponse.json({ error: '資料狀態查詢失敗' }, { status: 500 });
  }
}

function checkFeature(
  required: string[],
  critical: string[],
  sources: Record<string, { usable: boolean }>
): { mode: 'full' | 'limited' | 'unavailable'; missing: string[] } {
  const criticalMissing = critical.filter(id => !sources[id]?.usable);
  if (criticalMissing.length > 0) {
    return { mode: 'unavailable', missing: criticalMissing };
  }
  const allMissing = required.filter(id => !sources[id]?.usable);
  if (allMissing.length > 0) {
    return { mode: 'limited', missing: allMissing };
  }
  return { mode: 'full', missing: [] };
}
