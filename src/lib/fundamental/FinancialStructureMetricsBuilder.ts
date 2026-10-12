import type { FinancialReportLike } from '../fundamentals/StockFundamentalSnapshot';

export type FinancialStructureCoverage = 'full' | 'limited' | 'insufficient';

export interface FinancialStructureMetrics {
  netIncome: number | null;
  previousNetIncome: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  cashAndCashEquivalents: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalDebt: number | null;
  currentAssets: number | null;
  inventory: number | null;
  currentLiabilities: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  equity: number | null;
  debtRatio: number | null;
  liabilitiesRatio: number | null;
  interestCoverage: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
  dataCoverage: FinancialStructureCoverage;
  limitations: string[];
}

export interface BuildFinancialStructureMetricsInput {
  financialReports: FinancialReportLike[] | null | undefined;
}

export function buildFinancialStructureMetrics(
  input: BuildFinancialStructureMetricsInput,
): FinancialStructureMetrics {
  const sorted = [...(input.financialReports ?? [])].sort(compareReportDesc);
  const latest = sorted[0] ?? null;
  const previous = sorted[1] ?? null;

  if (!latest) {
    return emptyMetrics(['缺少財報資料，暫無法建立財務結構 metrics。']);
  }

  const operatingCashFlow = latest.operatingCashFlow ?? null;
  const freeCashFlow = latest.freeCashFlow
    ?? deriveFreeCashFlow(latest.operatingCashFlow, latest.capitalExpenditure);
  const cashAndCashEquivalents = latest.cashAndCashEquivalents ?? null;
  const currentAssets = latest.currentAssets ?? null;
  const inventory = latest.inventory ?? null;
  const currentLiabilities = latest.currentLiabilities ?? null;
  const totalAssets = latest.totalAssets ?? null;
  const totalLiabilities = latest.totalLiabilities ?? null;
  const totalDebt = latest.totalDebt
    ?? sumNullable(latest.shortTermDebt, latest.longTermDebt);
  const shortTermDebt = latest.shortTermDebt ?? null;
  const longTermDebt = latest.longTermDebt ?? null;
  const equity = latest.equity ?? deriveEquity(totalAssets, totalLiabilities);
  const currentRatio = latest.currentRatio
    ?? deriveRatio(currentAssets, currentLiabilities);
  const quickRatio = latest.quickRatio
    ?? deriveRatio(subtractNullable(currentAssets, inventory), currentLiabilities);
  const debtRatio = latest.debtRatio
    ?? derivePercent(totalDebt, totalAssets);
  const liabilitiesRatio = latest.liabilitiesRatio
    ?? derivePercent(totalLiabilities, totalAssets);
  const interestCoverage = latest.interestCoverage
    ?? deriveInterestCoverage(latest.operatingIncome ?? null, latest.interestExpense ?? null);

  const limitations: string[] = [];
  if (operatingCashFlow === null) limitations.push('缺少 operatingCashFlow，無法直接驗證營運現金流支撐。');
  if (freeCashFlow === null) limitations.push('缺少 freeCashFlow / capitalExpenditure，無法完整判讀自由現金流。');
  if (currentRatio === null) limitations.push('缺少 currentAssets/currentLiabilities，無法建立 current ratio。');
  if (quickRatio === null) limitations.push('缺少 inventory/currentAssets/currentLiabilities，無法建立 quick ratio。');
  if (debtRatio === null) limitations.push('缺少 totalDebt/totalAssets，無法建立 debt ratio。');
  if (liabilitiesRatio === null) limitations.push('缺少 totalLiabilities/totalAssets，無法建立 liabilities ratio。');
  if (interestCoverage === null) limitations.push('缺少 operatingIncome/interestExpense，無法建立 interest coverage。');

  const categoryCount = [
    operatingCashFlow !== null || freeCashFlow !== null,
    debtRatio !== null || liabilitiesRatio !== null || totalDebt !== null,
    currentRatio !== null || quickRatio !== null || cashAndCashEquivalents !== null,
  ].filter(Boolean).length;

  const dataCoverage: FinancialStructureCoverage =
    categoryCount >= 3 ? 'full' : categoryCount >= 2 ? 'limited' : 'insufficient';

  return {
    netIncome: latest.netIncome ?? null,
    previousNetIncome: previous?.netIncome ?? null,
    operatingCashFlow,
    freeCashFlow,
    cashAndCashEquivalents,
    totalAssets,
    totalLiabilities,
    totalDebt,
    currentAssets,
    inventory,
    currentLiabilities,
    currentRatio,
    quickRatio,
    equity,
    debtRatio,
    liabilitiesRatio,
    interestCoverage,
    shortTermDebt,
    longTermDebt,
    dataCoverage,
    limitations,
  };
}

function emptyMetrics(limitations: string[]): FinancialStructureMetrics {
  return {
    netIncome: null,
    previousNetIncome: null,
    operatingCashFlow: null,
    freeCashFlow: null,
    cashAndCashEquivalents: null,
    totalAssets: null,
    totalLiabilities: null,
    totalDebt: null,
    currentAssets: null,
    inventory: null,
    currentLiabilities: null,
    currentRatio: null,
    quickRatio: null,
    equity: null,
    debtRatio: null,
    liabilitiesRatio: null,
    interestCoverage: null,
    shortTermDebt: null,
    longTermDebt: null,
    dataCoverage: 'insufficient',
    limitations,
  };
}

function deriveFreeCashFlow(
  operatingCashFlow: number | null | undefined,
  capitalExpenditure: number | null | undefined,
): number | null {
  if (operatingCashFlow == null || capitalExpenditure == null) return null;
  return round2(operatingCashFlow - Math.abs(capitalExpenditure));
}

function deriveEquity(
  totalAssets: number | null | undefined,
  totalLiabilities: number | null | undefined,
): number | null {
  if (totalAssets == null || totalLiabilities == null) return null;
  return round2(totalAssets - totalLiabilities);
}

function deriveRatio(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return round2(numerator / denominator);
}

function derivePercent(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return round2((numerator / denominator) * 100);
}

function deriveInterestCoverage(
  operatingIncome: number | null | undefined,
  interestExpense: number | null | undefined,
): number | null {
  if (operatingIncome == null || interestExpense == null || interestExpense === 0) return null;
  return round2(operatingIncome / Math.abs(interestExpense));
}

function sumNullable(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null && b == null) return null;
  return round2((a ?? 0) + (b ?? 0));
}

function subtractNullable(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null) return null;
  return round2(a - (b ?? 0));
}

function compareReportDesc(a: FinancialReportLike, b: FinancialReportLike): number {
  if (a.year !== b.year) return b.year - a.year;
  return b.quarter - a.quarter;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
