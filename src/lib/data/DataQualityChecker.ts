/**
 * DataQualityChecker - 資料品質檢查服務
 * 
 * 檢查項目：
 * 1. 覆蓋率 (有多少股票有多少天的資料)
 * 2. 空值率 (哪些欄位 NULL 比例高)
 * 3. 日期一致性 (是否有混合格式)
 * 4. 資料新鮮度 (最後更新距今多久)
 */

import { prisma } from '@/lib/prisma';
import { detectDateFormat, toISO, type DateFormat } from './DateAdapter';

export interface QualityReport {
  timestamp: string;
  tables: TableQuality[];
  overallScore: number; // 0-100
  warnings: string[];
}

export interface TableQuality {
  table: string;
  rowCount: number;
  stockCoverage: number;
  dateFormats: Partial<Record<DateFormat, number>>;
  latestDate: string | null;
  staleDays: number;
  nullRates: Record<string, number>;
  score: number; // 0-100
  issues: string[];
}

export async function runQualityCheck(): Promise<QualityReport> {
  const tables: TableQuality[] = [];
  const warnings: string[] = [];

  // === StockQuote ===
  try {
    const quoteCount = await prisma.stockQuote.count();
    const quoteDates = await prisma.stockQuote.findMany({ select: { date: true }, distinct: ['date'] });
    const dateFormats = countDateFormats(quoteDates.map(q => q.date));
    const stockGroups = await prisma.stockQuote.groupBy({ by: ['stockId'], _count: { _all: true } });
    const stocks60 = stockGroups.filter(g => g._count._all >= 60).length;
    const stocks100 = stockGroups.filter(g => g._count._all >= 100).length;
    const latestDate = findLatestDate(quoteDates.map(q => q.date));
    const staleDays = latestDate ? daysSince(latestDate) : 999;

    const issues: string[] = [];
    if (Object.keys(dateFormats).length > 1) issues.push(`混合日期格式: ${JSON.stringify(dateFormats)}`);
    if (stocks60 < 20) issues.push(`僅 ${stocks60} 檔股票有 ≥60 天資料 (技術指標最低門檻)`);
    if (stocks100 < 10) issues.push(`僅 ${stocks100} 檔股票有 ≥100 天資料 (回測最低門檻)`);
    if (staleDays > 3) issues.push(`資料已 ${staleDays} 天未更新`);

    tables.push({
      table: 'StockQuote',
      rowCount: quoteCount,
      stockCoverage: stockGroups.length,
      dateFormats,
      latestDate,
      staleDays,
      nullRates: {},
      score: calculateScore(quoteCount, stockGroups.length, staleDays, issues.length),
      issues,
    });
  } catch (e) {
    warnings.push(`StockQuote check failed: ${e}`);
  }

  // === Stock (master) ===
  try {
    const stockCount = await prisma.stock.count();
    const nullIndustry = await prisma.stock.count({ where: { industry: null } });
    tables.push({
      table: 'Stock',
      rowCount: stockCount,
      stockCoverage: stockCount,
      dateFormats: {},
      latestDate: null,
      staleDays: 0,
      nullRates: { industry: stockCount > 0 ? nullIndustry / stockCount : 0 },
      score: stockCount >= 1000 ? 90 : stockCount >= 100 ? 70 : 30,
      issues: nullIndustry > stockCount * 0.1 ? [`${(nullIndustry / stockCount * 100).toFixed(0)}% 股票缺少產業分類`] : [],
    });
  } catch (e) {
    warnings.push(`Stock check failed: ${e}`);
  }

  // === MonthlyRevenue ===
  try {
    const revCount = await prisma.monthlyRevenue.count();
    const revStocks = (await prisma.monthlyRevenue.groupBy({ by: ['stockId'] })).length;
    tables.push({
      table: 'MonthlyRevenue',
      rowCount: revCount,
      stockCoverage: revStocks,
      dateFormats: {},
      latestDate: null,
      staleDays: 0,
      nullRates: {},
      score: revStocks >= 500 ? 85 : revStocks >= 100 ? 60 : 30,
      issues: [],
    });
  } catch (e) {
    warnings.push(`MonthlyRevenue check failed: ${e}`);
  }

  // === StockMetrics ===
  try {
    const metricsCount = await prisma.stockMetrics.count();
    const metricsDates = await prisma.stockMetrics.findMany({ select: { date: true }, distinct: ['date'] });
    const dateFormats = countDateFormats(metricsDates.map(m => m.date));
    const latestDate = findLatestDate(metricsDates.map(m => m.date));
    const staleDays = latestDate ? daysSince(latestDate) : 999;
    tables.push({
      table: 'StockMetrics',
      rowCount: metricsCount,
      stockCoverage: 0,
      dateFormats,
      latestDate,
      staleDays,
      nullRates: {},
      score: metricsCount >= 5000 ? 60 : metricsCount >= 1000 ? 40 : 20,
      issues: Object.keys(dateFormats).length > 1 ? [`混合日期格式`] : [],
    });
  } catch (e) {
    warnings.push(`StockMetrics check failed: ${e}`);
  }

  // === MarketIndex ===
  try {
    const indexCount = await prisma.marketIndex.count();
    const indexDates = await prisma.marketIndex.findMany({ select: { date: true }, distinct: ['date'] });
    const dateFormats = countDateFormats(indexDates.map(i => i.date));
    const latestDate = findLatestDate(indexDates.map(i => i.date));
    tables.push({
      table: 'MarketIndex',
      rowCount: indexCount,
      stockCoverage: 0,
      dateFormats,
      latestDate,
      staleDays: latestDate ? daysSince(latestDate) : 999,
      nullRates: {},
      score: indexCount >= 200 ? 50 : indexCount >= 50 ? 30 : 10,
      issues: Object.keys(dateFormats).length > 1 ? [`混合日期格式`] : [],
    });
  } catch (e) {
    warnings.push(`MarketIndex check failed: ${e}`);
  }

  const overallScore = tables.length > 0
    ? Math.round(tables.reduce((sum, t) => sum + t.score, 0) / tables.length)
    : 0;

  return {
    timestamp: new Date().toISOString(),
    tables,
    overallScore,
    warnings,
  };
}

// ─── Helpers ───

function countDateFormats(dates: string[]): Partial<Record<DateFormat, number>> {
  const counts: Partial<Record<DateFormat, number>> = {};
  for (const d of dates) {
    const fmt = detectDateFormat(d);
    counts[fmt] = (counts[fmt] || 0) + 1;
  }
  return counts;
}

function findLatestDate(dates: string[]): string | null {
  if (dates.length === 0) return null;
  let latest: string | null = null;
  for (const d of dates) {
    const iso = toISO(d);
    if (iso && (!latest || iso > latest)) latest = iso;
  }
  return latest;
}

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function calculateScore(rows: number, stocks: number, staleDays: number, issues: number): number {
  let score = 50;
  if (rows >= 10000) score += 20; else if (rows >= 1000) score += 10;
  if (stocks >= 50) score += 15; else if (stocks >= 20) score += 10;
  if (staleDays <= 1) score += 15; else if (staleDays <= 7) score += 5;
  score -= issues * 5;
  return Math.max(0, Math.min(100, score));
}
