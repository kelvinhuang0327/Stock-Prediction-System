import { prisma } from '@/lib/prisma';
import { inferSectorFromIndustry } from '@/lib/data/SectorMapping';
import {
  buildStockFundamentalSnapshot,
  type FinancialReportLike,
  type MonthlyRevenueLike,
  type StockFundamentalSnapshot,
  type StockMetricsLike,
} from '@/lib/fundamentals/StockFundamentalSnapshot';
import {
  buildStockPeerComparison,
  type StockPeerComparison,
} from '@/lib/fundamentals/StockPeerComparison';
import {
  buildFundamentalRiskOverlay,
  type FundamentalRiskOverlay,
} from '@/lib/fundamental/FundamentalRiskOverlayEngine';
import {
  buildCashflowLeverageOverlay,
  type CashflowLeverageOverlay,
} from '@/lib/fundamental/CashflowLeverageOverlayEngine';
import {
  buildFinancialStructureMetrics,
  type FinancialStructureMetrics,
} from '@/lib/fundamental/FinancialStructureMetricsBuilder';
import {
  buildCapitalEfficiencyMetrics,
  type CapitalEfficiencyMetrics,
} from '@/lib/fundamental/CapitalEfficiencyMetricsBuilder';
import {
  buildCapitalEfficiencyOverlay,
  type CapitalEfficiencyOverlay,
} from '@/lib/fundamental/CapitalEfficiencyOverlayEngine';
import {
  buildFinancialStructurePeerComparison,
  type FinancialStructurePeerComparison,
  type FinancialStructurePeerRecord,
} from '@/lib/fundamental/FinancialStructurePeerComparisonEngine';
import {
  buildFullFundamentalComparisonMatrix,
  buildUnknownFundamentalComparisonMatrix,
  type FullFundamentalComparisonMatrix,
} from '@/lib/fundamental/FullFundamentalComparisonMatrixBuilder';
import {
  buildPeerPercentileDetailTable,
} from '@/lib/fundamental/PeerPercentileDetailTableBuilder';
import type { PeerPercentileDetailTable } from '@/lib/fundamental/types';
import { filterMonthlyRevenueAvailableAsOf } from '@/lib/onlineValidation/MonthlyRevenueAvailability';

export interface FundamentalResearchContext {
  fundamentals: StockFundamentalSnapshot;
  peerComparison: StockPeerComparison | null;
  overlay: FundamentalRiskOverlay;
  cashflowLeverageOverlay: CashflowLeverageOverlay;
  capitalEfficiencyOverlay: CapitalEfficiencyOverlay;
  financialStructurePeerComparison: FinancialStructurePeerComparison | null;
  fundamentalMatrix: FullFundamentalComparisonMatrix;
  peerPercentileDetailTable: PeerPercentileDetailTable;
}

export interface FundamentalOverlayContext {
  peerComparison: StockPeerComparison | null;
  overlay: FundamentalRiskOverlay;
  cashflowLeverageOverlay: CashflowLeverageOverlay;
  capitalEfficiencyOverlay: CapitalEfficiencyOverlay;
  financialStructurePeerComparison: FinancialStructurePeerComparison | null;
  fundamentalMatrix: FullFundamentalComparisonMatrix;
  peerPercentileDetailTable: PeerPercentileDetailTable;
}

export async function buildFundamentalResearchContextForSymbol(input: {
  symbol: string;
  name: string;
  industry: string;
  asOf?: string; // P17: PIT gate — filter MonthlyRevenue by releaseDate <= asOf
}): Promise<FundamentalResearchContext> {
  const [monthlyRevenuesRaw, financialReports, stockMetrics] = await Promise.all([
    prisma.monthlyRevenue.findMany({
      where: { stockId: input.symbol },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 18,
    }),
    prisma.financialReport.findMany({
      where: { stockId: input.symbol },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
      take: 6,
    }),
    prisma.stockMetrics.findMany({
      where: { stockId: input.symbol },
      orderBy: { date: 'desc' },
      take: 3,
    }),
  ]);

  // P17: PIT gate — only include MonthlyRevenue records available as of asOf
  const monthlyRevenues = input.asOf
    ? filterMonthlyRevenueAvailableAsOf(monthlyRevenuesRaw, input.asOf, { allowInferredReleaseDate: true })
    : monthlyRevenuesRaw;

  const fundamentals = buildStockFundamentalSnapshot({
    isETF: isEtfSymbol(input.symbol, input.name),
    monthlyRevenues,
    financialReports,
    stockMetrics,
  });

  const {
    peerComparison,
    financialStructurePeerComparison,
  } = await buildPeerComparisonsForSymbol(input);
  const overlay = buildFundamentalRiskOverlay({
    fundamentals,
    peerComparison,
  });
  const structureMetrics = buildCashflowLeverageMetricsFromReports(financialReports);
  const cashflowLeverageOverlay = buildCashflowLeverageOverlay({
    fundamentals,
    peerComparison,
    metrics: structureMetrics,
  });
  const capitalEfficiencyOverlay = buildCapitalEfficiencyOverlay({
    fundamentals,
    peerComparison,
    cashflowLeverageOverlay,
    metrics: buildCapitalEfficiencyMetricsFromResearchContext({
      monthlyRevenues,
      financialReports,
      structureMetrics,
    }),
  });
  const fundamentalMatrix = buildFullFundamentalComparisonMatrix({
    fundamentals,
    peerComparison,
    overlay,
    cashflowLeverageOverlay,
    capitalEfficiencyOverlay,
    financialStructurePeerComparison,
  });
  const peerPercentileDetailTable = buildPeerPercentileDetailTable({
    fundamentals,
    peerComparison,
    financialStructurePeerComparison,
    fundamentalMatrix,
  });

  return {
    fundamentals,
    peerComparison,
    overlay,
    cashflowLeverageOverlay,
    capitalEfficiencyOverlay,
    financialStructurePeerComparison,
    fundamentalMatrix,
    peerPercentileDetailTable,
  };
}

export async function buildFundamentalOverlayForSymbol(input: {
  symbol: string;
  name: string;
  industry: string;
  fundamentals: StockFundamentalSnapshot;
  monthlyRevenues?: MonthlyRevenueLike[];
  financialReports?: FinancialReportLike[];
}): Promise<FundamentalOverlayContext> {
  const {
    peerComparison,
    financialStructurePeerComparison,
  } = await buildPeerComparisonsForSymbol(input);
  const overlay = buildFundamentalRiskOverlay({
    fundamentals: input.fundamentals,
    peerComparison,
  });
  const structureMetrics = buildCashflowLeverageMetricsFromReports(input.financialReports);
  const cashflowLeverageOverlay = buildCashflowLeverageOverlay({
    fundamentals: input.fundamentals,
    peerComparison,
    metrics: structureMetrics,
  });
  const capitalEfficiencyOverlay = buildCapitalEfficiencyOverlay({
    fundamentals: input.fundamentals,
    peerComparison,
    cashflowLeverageOverlay,
    metrics: buildCapitalEfficiencyMetricsFromResearchContext({
      monthlyRevenues: input.monthlyRevenues,
      financialReports: input.financialReports,
      structureMetrics,
    }),
  });
  const fundamentalMatrix = buildFullFundamentalComparisonMatrix({
    fundamentals: input.fundamentals,
    peerComparison,
    overlay,
    cashflowLeverageOverlay,
    capitalEfficiencyOverlay,
    financialStructurePeerComparison,
  });
  const peerPercentileDetailTable = buildPeerPercentileDetailTable({
    fundamentals: input.fundamentals,
    peerComparison,
    financialStructurePeerComparison,
    fundamentalMatrix,
  });

  return {
    peerComparison,
    overlay,
    cashflowLeverageOverlay,
    capitalEfficiencyOverlay,
    financialStructurePeerComparison,
    fundamentalMatrix,
    peerPercentileDetailTable,
  };
}

export async function buildPeerComparisonForSymbol(input: {
  symbol: string;
  name: string;
  industry: string;
}): Promise<StockPeerComparison | null> {
  const comparisons = await buildPeerComparisonsForSymbol(input);
  return comparisons.peerComparison;
}

export async function buildFinancialStructurePeerComparisonForSymbol(input: {
  symbol: string;
  name: string;
  industry: string;
}): Promise<FinancialStructurePeerComparison | null> {
  const comparisons = await buildPeerComparisonsForSymbol(input);
  return comparisons.financialStructurePeerComparison;
}

function isEtfSymbol(symbol: string, name: string): boolean {
  return /^00\d/.test(symbol) || name.includes('ETF');
}

function dedupeStocks<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function groupByStock<T extends { stockId: string }>(rows: T[]): Record<string, T[]> {
  return rows.reduce<Record<string, T[]>>((acc, row) => {
    acc[row.stockId] ||= [];
    acc[row.stockId].push(row);
    return acc;
  }, {});
}

async function buildPeerComparisonsForSymbol(input: {
  symbol: string;
  name: string;
  industry: string;
}): Promise<{
  peerComparison: StockPeerComparison | null;
  financialStructurePeerComparison: FinancialStructurePeerComparison | null;
}> {
  const peerDataset = await loadPeerDatasetForSymbol(input);
  if (!peerDataset) {
    return {
      peerComparison: null,
      financialStructurePeerComparison: buildFinancialStructurePeerComparison({
        target: emptyFinancialStructurePeerRecord(input),
        peers: [],
        basis: 'industry',
        groupLabel: input.industry.trim(),
        isETF: isEtfSymbol(input.symbol, input.name),
        baseLimitations: input.industry.trim()
          ? ['財務結構同組資料不足，暫不做明確比較。']
          : ['缺少 industry / sector 資料，暫無法建立財務結構同組比較。'],
      }),
    };
  }

  const peerRecords = peerDataset.sampledStocks.map((stock) => {
    const snapshot = buildStockFundamentalSnapshot({
      isETF: isEtfSymbol(stock.id, stock.name),
      monthlyRevenues: peerDataset.revenuesByStock[stock.id] ?? [],
      financialReports: peerDataset.reportsByStock[stock.id] ?? [],
      stockMetrics: peerDataset.metricsByStock[stock.id] ?? [],
    });

    return {
      symbol: stock.id,
      name: stock.name,
      revenueYoY: snapshot.revenue.yoyGrowth,
      eps: snapshot.profitability.eps,
      grossMargin: snapshot.profitability.grossMargin,
      operatingMargin: snapshot.profitability.operatingMargin,
      pe: snapshot.valuation.pe,
      pb: snapshot.valuation.pb,
      dividendYield: snapshot.valuation.dividendYield,
    };
  });

  const structurePeerRecords = peerDataset.sampledStocks.map((stock) =>
    buildFinancialStructurePeerRecord({
      symbol: stock.id,
      name: stock.name,
      monthlyRevenues: peerDataset.revenuesByStock[stock.id] ?? [],
      financialReports: peerDataset.reportsByStock[stock.id] ?? [],
    }),
  );

  const target = peerRecords.find((record) => record.symbol === input.symbol) ?? null;
  const targetStructure = structurePeerRecords.find((record) => record.symbol === input.symbol) ?? null;

  return {
    peerComparison: target
      ? buildStockPeerComparison({
          target,
          peers: peerRecords.filter((record) => record.symbol !== input.symbol),
          basis: peerDataset.basis,
          groupLabel: peerDataset.groupLabel,
          baseLimitations: peerDataset.baseLimitations,
        })
      : null,
    financialStructurePeerComparison: targetStructure
      ? buildFinancialStructurePeerComparison({
          target: targetStructure,
          peers: structurePeerRecords.filter((record) => record.symbol !== input.symbol),
          basis: peerDataset.basis,
          groupLabel: peerDataset.groupLabel,
          isETF: isEtfSymbol(input.symbol, input.name),
          baseLimitations: peerDataset.baseLimitations,
        })
      : null,
  };
}

async function loadPeerDatasetForSymbol(input: {
  symbol: string;
  name: string;
  industry: string;
}): Promise<{
  basis: 'industry' | 'sector';
  groupLabel: string;
  baseLimitations: string[];
  sampledStocks: Array<{ id: string; name: string; industry: string | null }>;
  revenuesByStock: Record<string, MonthlyRevenueLike[]>;
  reportsByStock: Record<string, FinancialReportLike[]>;
  metricsByStock: Record<string, StockMetricsLike[]>;
} | null> {
  const industry = input.industry.trim();
  const sector = inferSectorFromIndustry(industry);
  const baseLimitations: string[] = [];
  let basis: 'industry' | 'sector' = 'industry';
  let groupLabel = industry;
  let peerStocks: Array<{ id: string; name: string; industry: string | null }> = [];

  if (industry) {
    peerStocks = await prisma.stock.findMany({
      where: { industry },
      select: { id: true, name: true, industry: true },
    });
  }

  if (peerStocks.length < 4 && sector) {
    const sectorStocks = await prisma.stock.findMany({
      where: { industry: { not: null } },
      select: { id: true, name: true, industry: true },
    });
    const filtered = sectorStocks.filter((stock) => inferSectorFromIndustry(stock.industry) === sector);
    if (filtered.length > peerStocks.length) {
      peerStocks = filtered;
      basis = 'sector';
      groupLabel = sector;
      baseLimitations.push(`同 industry 樣本不足，已退回 ${sector} 層級比較。`);
    }
  }

  if (!groupLabel) return null;

  const sampledStocks = dedupeStocks([
    { id: input.symbol, name: input.name, industry: input.industry || null },
    ...peerStocks,
  ]).slice(0, 24);
  const symbols = sampledStocks.map((stock) => stock.id);

  const [monthlyRevenues, financialReports, stockMetrics] = await Promise.all([
    prisma.monthlyRevenue.findMany({
      where: { stockId: { in: symbols } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    }),
    prisma.financialReport.findMany({
      where: { stockId: { in: symbols } },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
    }),
    prisma.stockMetrics.findMany({
      where: { stockId: { in: symbols } },
      orderBy: { date: 'desc' },
    }),
  ]);

  return {
    basis,
    groupLabel,
    baseLimitations,
    sampledStocks,
    revenuesByStock: groupByStock(monthlyRevenues),
    reportsByStock: groupByStock(financialReports),
    metricsByStock: groupByStock(stockMetrics),
  };
}

function buildFinancialStructurePeerRecord(input: {
  symbol: string;
  name: string;
  monthlyRevenues: MonthlyRevenueLike[];
  financialReports: FinancialReportLike[];
}): FinancialStructurePeerRecord {
  const structureMetrics = buildFinancialStructureMetrics({
    financialReports: input.financialReports,
  });
  const capitalMetrics = buildCapitalEfficiencyMetrics({
    monthlyRevenues: input.monthlyRevenues,
    financialReports: input.financialReports,
    structureMetrics,
  });

  return {
    symbol: input.symbol,
    name: input.name,
    debtRatio: structureMetrics.debtRatio,
    liabilitiesRatio: structureMetrics.liabilitiesRatio,
    currentRatio: structureMetrics.currentRatio,
    quickRatio: structureMetrics.quickRatio,
    roe: capitalMetrics.roe,
    roa: capitalMetrics.roa,
    assetTurnover: capitalMetrics.assetTurnover,
    cashflowConversion: capitalMetrics.cashflowConversion,
  };
}

function emptyFinancialStructurePeerRecord(input: {
  symbol: string;
  name: string;
}): FinancialStructurePeerRecord {
  return {
    symbol: input.symbol,
    name: input.name,
    debtRatio: null,
    liabilitiesRatio: null,
    currentRatio: null,
    quickRatio: null,
    roe: null,
    roa: null,
    assetTurnover: null,
    cashflowConversion: null,
  };
}

export function buildCashflowLeverageMetricsFromReports(
  financialReports: FinancialReportLike[] | undefined,
): FinancialStructureMetrics {
  return buildFinancialStructureMetrics({
    financialReports,
  });
}

export function buildCapitalEfficiencyMetricsFromResearchContext(input: {
  monthlyRevenues: MonthlyRevenueLike[] | undefined;
  financialReports: FinancialReportLike[] | undefined;
  structureMetrics?: FinancialStructureMetrics | undefined;
}): CapitalEfficiencyMetrics {
  return buildCapitalEfficiencyMetrics({
    monthlyRevenues: input.monthlyRevenues,
    financialReports: input.financialReports,
    structureMetrics: input.structureMetrics,
  });
}

export type {
  MonthlyRevenueLike,
  FinancialReportLike,
  StockMetricsLike,
};
export {
  buildUnknownFundamentalComparisonMatrix,
  type FullFundamentalComparisonMatrix,
};
