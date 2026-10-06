import { prisma } from '../prisma';
import type { AutonomousDataSnapshot, DataLayerStatus, DataFreshnessState } from './types';

function toIsoDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  if (/^\d{7}$/.test(raw)) {
    const year = Number(raw.slice(0, 3)) + 1911;
    return `${year}-${raw.slice(3, 5)}-${raw.slice(5, 7)}`;
  }
  return null;
}

function toMonthEndIso(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

function toQuarterEndIso(year: number, quarter: number): string {
  return quarter === 1
    ? toMonthEndIso(year, 3)
    : quarter === 2
      ? toMonthEndIso(year, 6)
      : quarter === 3
        ? toMonthEndIso(year, 9)
        : toMonthEndIso(year, 12);
}

function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const dt = new Date(`${isoDate}T00:00:00+08:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - dt.getTime()) / (24 * 60 * 60 * 1000)));
}

function freshnessState(days: number | null, freshThreshold: number, staleThreshold: number): DataFreshnessState {
  if (days == null) return 'missing';
  if (days <= freshThreshold) return 'fresh';
  if (days <= staleThreshold) return 'degraded';
  return 'stale';
}

async function buildTechnicalStatus(): Promise<DataLayerStatus> {
  const latestQuote = await prisma.stockQuote.findFirst({ orderBy: { date: 'desc' } });
  const latestIndex = await prisma.marketIndex.findFirst({ orderBy: { date: 'desc' } });
  const totalStocks = await prisma.stock.count();
  const quotedStocks = await prisma.stockQuote.groupBy({ by: ['stockId'], _count: { _all: true } });
  const coverage = totalStocks > 0 ? quotedStocks.length / totalStocks : 0;
  const latestTimestamp = latestQuote ? toIsoDate(latestQuote.date) : latestIndex?.date ?? null;
  const freshnessDays = daysSince(latestTimestamp);
  const state = freshnessState(freshnessDays, 2, 5);
  const limitations: string[] = [];
  if (quotedStocks.length < 20) limitations.push('技術覆蓋率偏低，研究樣本有限。');
  if (!latestTimestamp) limitations.push('缺少可用技術面最新時間戳。');
  if (freshnessDays != null && freshnessDays > 3) limitations.push(`技術資料已 ${freshnessDays} 天未更新。`);

  return {
    key: 'technical',
    source: 'StockQuote + MarketIndex',
    latestTimestamp,
    freshnessDays,
    coverage,
    rowCount: await prisma.stockQuote.count(),
    freshnessState: state,
    limitations,
  };
}

async function buildFundamentalStatus(): Promise<DataLayerStatus> {
  const latestRevenue = await prisma.monthlyRevenue.findFirst({ orderBy: [{ year: 'desc' }, { month: 'desc' }] });
  const latestReport = await prisma.financialReport.findFirst({ orderBy: [{ year: 'desc' }, { quarter: 'desc' }] });
  const totalStocks = await prisma.stock.count();
  const revenueStocks = await prisma.monthlyRevenue.groupBy({ by: ['stockId'], _count: { _all: true } });
  const reportStocks = await prisma.financialReport.groupBy({ by: ['stockId'], _count: { _all: true } });
  const coverage = totalStocks > 0 ? Math.max(revenueStocks.length, reportStocks.length) / totalStocks : 0;
  const latestRevenueIso = latestRevenue ? toMonthEndIso(latestRevenue.year, latestRevenue.month) : null;
  const latestReportIso = latestReport ? toQuarterEndIso(latestReport.year, latestReport.quarter) : null;
  const latestTimestamp = latestReportIso ?? latestRevenueIso;
  const freshnessDays = daysSince(latestTimestamp);
  const state = freshnessState(freshnessDays, 30, 120);
  const limitations: string[] = [];
  if (revenueStocks.length === 0) limitations.push('月營收資料缺口明顯。');
  if (reportStocks.length < 20) limitations.push('財報覆蓋率偏低，效率與體質比較需保守。');
  if (!latestTimestamp) limitations.push('缺少可用基本面最新時間戳。');

  return {
    key: 'fundamental',
    source: 'MonthlyRevenue + FinancialReport',
    latestTimestamp,
    freshnessDays,
    coverage,
    rowCount: (await prisma.monthlyRevenue.count()) + (await prisma.financialReport.count()),
    freshnessState: state,
    limitations,
  };
}

async function buildEventStatus(): Promise<DataLayerStatus> {
  const latestEvent = await prisma.newsEvent.findFirst({ orderBy: { publishedAt: 'desc' } });
  const rowCount = await prisma.newsEvent.count();
  const latestTimestamp = latestEvent ? latestEvent.publishedAt.toISOString() : null;
  const freshnessDays = daysSince(latestTimestamp ? latestTimestamp.slice(0, 10) : null);
  const coverage = Math.min(1, rowCount / 50);
  const state = freshnessState(freshnessDays, 1, 3);
  const limitations: string[] = [];
  if (rowCount < 10) limitations.push('事件資料筆數偏少。');
  if (!latestTimestamp) limitations.push('缺少可用事件最新時間戳。');

  return {
    key: 'events',
    source: 'NewsEvent',
    latestTimestamp,
    freshnessDays,
    coverage,
    rowCount,
    freshnessState: state,
    limitations,
  };
}

export async function buildAutonomousDataSnapshot(): Promise<AutonomousDataSnapshot> {
  const statuses = await Promise.all([
    buildTechnicalStatus(),
    buildFundamentalStatus(),
    buildEventStatus(),
  ]);

  const insufficient = statuses.filter((s) => s.freshnessState === 'missing' || s.freshnessState === 'stale').length;
  const degraded = statuses.filter((s) => s.freshnessState === 'degraded').length;
  const overallCoverage = insufficient > 0
    ? 'insufficient'
    : degraded > 0
      ? 'limited'
      : 'full';

  const limitations = [
    ...new Set(statuses.flatMap((s) => s.limitations)),
  ];

  return {
    generatedAt: new Date().toISOString(),
    statuses,
    overallCoverage,
    limitations,
  };
}
