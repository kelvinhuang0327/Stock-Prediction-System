import { prisma } from '../prisma';
import { buildFinancialStructureMetrics } from './FinancialStructureMetricsBuilder';

export interface RawFinancialReportInput {
  stockId: string;
  year: number | string;
  quarter: number | string;
  eps: number | string;
  netIncome: number | string;
  grossMargin?: number | string | null;
  operatingMargin?: number | string | null;
  operatingIncome?: number | string | null;
  operatingCashFlow?: number | string | null;
  capitalExpenditure?: number | string | null;
  freeCashFlow?: number | string | null;
  cashAndCashEquivalents?: number | string | null;
  currentAssets?: number | string | null;
  inventory?: number | string | null;
  currentLiabilities?: number | string | null;
  totalAssets?: number | string | null;
  totalLiabilities?: number | string | null;
  equity?: number | string | null;
  totalDebt?: number | string | null;
  shortTermDebt?: number | string | null;
  longTermDebt?: number | string | null;
  interestExpense?: number | string | null;
  currentRatio?: number | string | null;
  quickRatio?: number | string | null;
  debtRatio?: number | string | null;
  liabilitiesRatio?: number | string | null;
  interestCoverage?: number | string | null;
}

export interface NormalizedFinancialReportInput {
  stockId: string;
  year: number;
  quarter: number;
  eps: number;
  netIncome: number;
  grossMargin: number | null;
  operatingMargin: number | null;
  operatingIncome: number | null;
  operatingCashFlow: number | null;
  capitalExpenditure: number | null;
  freeCashFlow: number | null;
  cashAndCashEquivalents: number | null;
  currentAssets: number | null;
  inventory: number | null;
  currentLiabilities: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  equity: number | null;
  totalDebt: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
  interestExpense: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  debtRatio: number | null;
  liabilitiesRatio: number | null;
  interestCoverage: number | null;
}

export function normalizeFinancialReportRecord(
  raw: RawFinancialReportInput,
): NormalizedFinancialReportInput {
  const normalizedBase: NormalizedFinancialReportInput = {
    stockId: String(raw.stockId).trim(),
    year: parseRequiredNumber(raw.year, 'year'),
    quarter: parseRequiredNumber(raw.quarter, 'quarter'),
    eps: parseRequiredNumber(raw.eps, 'eps'),
    netIncome: parseRequiredNumber(raw.netIncome, 'netIncome'),
    grossMargin: parseNullableNumber(raw.grossMargin),
    operatingMargin: parseNullableNumber(raw.operatingMargin),
    operatingIncome: parseNullableNumber(raw.operatingIncome),
    operatingCashFlow: parseNullableNumber(raw.operatingCashFlow),
    capitalExpenditure: parseNullableNumber(raw.capitalExpenditure),
    freeCashFlow: parseNullableNumber(raw.freeCashFlow),
    cashAndCashEquivalents: parseNullableNumber(raw.cashAndCashEquivalents),
    currentAssets: parseNullableNumber(raw.currentAssets),
    inventory: parseNullableNumber(raw.inventory),
    currentLiabilities: parseNullableNumber(raw.currentLiabilities),
    totalAssets: parseNullableNumber(raw.totalAssets),
    totalLiabilities: parseNullableNumber(raw.totalLiabilities),
    equity: parseNullableNumber(raw.equity),
    totalDebt: parseNullableNumber(raw.totalDebt),
    shortTermDebt: parseNullableNumber(raw.shortTermDebt),
    longTermDebt: parseNullableNumber(raw.longTermDebt),
    interestExpense: parseNullableNumber(raw.interestExpense),
    currentRatio: parseNullableNumber(raw.currentRatio),
    quickRatio: parseNullableNumber(raw.quickRatio),
    debtRatio: parseNullableNumber(raw.debtRatio),
    liabilitiesRatio: parseNullableNumber(raw.liabilitiesRatio),
    interestCoverage: parseNullableNumber(raw.interestCoverage),
  };

  const derived = buildFinancialStructureMetrics({
    financialReports: [normalizedBase],
  });

  return {
    ...normalizedBase,
    freeCashFlow: normalizedBase.freeCashFlow ?? derived.freeCashFlow,
    equity: normalizedBase.equity ?? derived.equity,
    totalDebt: normalizedBase.totalDebt ?? derived.totalDebt,
    currentRatio: normalizedBase.currentRatio ?? derived.currentRatio,
    quickRatio: normalizedBase.quickRatio ?? derived.quickRatio,
    debtRatio: normalizedBase.debtRatio ?? derived.debtRatio,
    liabilitiesRatio: normalizedBase.liabilitiesRatio ?? derived.liabilitiesRatio,
    interestCoverage: normalizedBase.interestCoverage ?? derived.interestCoverage,
  };
}

export async function upsertFinancialReports(
  rows: RawFinancialReportInput[],
): Promise<{ count: number; limitations: string[] }> {
  const normalizedRows = rows.map(normalizeFinancialReportRecord);
  let count = 0;

  for (const row of normalizedRows) {
    await prisma.financialReport.upsert({
      where: {
        stockId_year_quarter: {
          stockId: row.stockId,
          year: row.year,
          quarter: row.quarter,
        },
      },
      update: row,
      create: row,
    });
    count += 1;
  }

  const metricsCoverage = buildFinancialStructureMetrics({
    financialReports: normalizedRows,
  });

  return {
    count,
    limitations: metricsCoverage.limitations,
  };
}

function parseRequiredNumber(value: number | string, field: string): number {
  const parsed = parseNullableNumber(value);
  if (parsed === null) {
    throw new Error(`Financial report field "${field}" is required.`);
  }
  return parsed;
}

function parseNullableNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = String(value).replace(/,/g, '').trim();
  if (!cleaned || cleaned === '--' || cleaned === 'N/A') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
