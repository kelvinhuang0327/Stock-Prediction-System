import type {
  FinancialReportLike,
  MonthlyRevenueLike,
} from '../fundamentals/StockFundamentalSnapshot';
import type { FinancialStructureMetrics } from './FinancialStructureMetricsBuilder';

export type CapitalEfficiencyCoverage = 'full' | 'limited' | 'insufficient';
export type EarningsQualityLabel = 'strong' | 'mixed' | 'weak' | 'insufficient';
export type StabilityLabel = 'stable' | 'mixed' | 'volatile' | 'insufficient';

export interface CapitalEfficiencyMetrics {
  roe: number | null;
  roa: number | null;
  assetTurnover: number | null;
  cashflowConversion: number | null;
  earningsQuality: EarningsQualityLabel;
  marginStability: StabilityLabel;
  returnStability: StabilityLabel;
  roeRoaGap: number | null;
  ttmRevenue: number | null;
  dataCoverage: CapitalEfficiencyCoverage;
  limitations: string[];
}

export interface BuildCapitalEfficiencyMetricsInput {
  financialReports: FinancialReportLike[] | null | undefined;
  monthlyRevenues?: MonthlyRevenueLike[] | null | undefined;
  structureMetrics?: FinancialStructureMetrics | null | undefined;
}

export function buildCapitalEfficiencyMetrics(
  input: BuildCapitalEfficiencyMetricsInput,
): CapitalEfficiencyMetrics {
  const financialReports = [...(input.financialReports ?? [])].sort(compareReportDesc);
  const monthlyRevenues = [...(input.monthlyRevenues ?? [])].sort(compareRevenueDesc);
  const latest = financialReports[0] ?? null;
  const structureMetrics = input.structureMetrics ?? null;

  if (!latest) {
    return emptyMetrics(['缺少財報資料，暫無法建立資本效率 metrics。']);
  }

  const equity = structureMetrics?.equity ?? latest.equity ?? null;
  const totalAssets = structureMetrics?.totalAssets ?? latest.totalAssets ?? null;
  const operatingCashFlow = structureMetrics?.operatingCashFlow ?? latest.operatingCashFlow ?? null;
  const netIncome = latest.netIncome ?? null;
  const ttmRevenue = deriveTtmRevenue(monthlyRevenues);

  const roe = derivePercent(netIncome, equity);
  const roa = derivePercent(netIncome, totalAssets);
  const assetTurnover = deriveRatio(ttmRevenue, totalAssets);
  const cashflowConversion = deriveConversion(operatingCashFlow, netIncome);
  const roeRoaGap = roe !== null && roa !== null ? round2(roe - roa) : null;
  const earningsQuality = classifyEarningsQuality({
    netIncome,
    operatingCashFlow,
    cashflowConversion,
  });
  const marginStability = classifyMarginStability(financialReports);
  const returnStability = classifyReturnStability(financialReports);

  const limitations: string[] = [];
  if (equity === null || equity <= 0) {
    limitations.push('缺少有效 equity，無法穩定建立 ROE。');
  }
  if (totalAssets === null || totalAssets <= 0) {
    limitations.push('缺少有效 totalAssets，無法穩定建立 ROA / asset turnover。');
  }
  if (ttmRevenue === null) {
    limitations.push('月營收資料不足 12 個月，無法建立較穩定的 asset turnover。');
  }
  if (netIncome === null || netIncome <= 0) {
    limitations.push('缺少有效 netIncome，cashflow conversion 與獲利品質已保守處理。');
  }
  if (operatingCashFlow === null) {
    limitations.push('缺少 operatingCashFlow，無法驗證獲利是否有效轉成現金。');
  }
  if (marginStability === 'insufficient') {
    limitations.push('歷史財報期數不足，無法建立 margin stability。');
  }
  if (returnStability === 'insufficient') {
    limitations.push('歷史 ROE 樣本不足，無法建立 return stability。');
  }

  const categoryCount = [
    roe !== null || roa !== null,
    assetTurnover !== null,
    cashflowConversion !== null || earningsQuality !== 'insufficient',
  ].filter(Boolean).length;

  const dataCoverage: CapitalEfficiencyCoverage =
    categoryCount >= 3 ? 'full' : categoryCount >= 2 ? 'limited' : 'insufficient';

  return {
    roe,
    roa,
    assetTurnover,
    cashflowConversion,
    earningsQuality,
    marginStability,
    returnStability,
    roeRoaGap,
    ttmRevenue,
    dataCoverage,
    limitations,
  };
}

function emptyMetrics(limitations: string[]): CapitalEfficiencyMetrics {
  return {
    roe: null,
    roa: null,
    assetTurnover: null,
    cashflowConversion: null,
    earningsQuality: 'insufficient',
    marginStability: 'insufficient',
    returnStability: 'insufficient',
    roeRoaGap: null,
    ttmRevenue: null,
    dataCoverage: 'insufficient',
    limitations,
  };
}

function deriveTtmRevenue(monthlyRevenues: MonthlyRevenueLike[]): number | null {
  if (monthlyRevenues.length < 12) return null;
  const latest12 = monthlyRevenues.slice(0, 12);
  if (latest12.some((row) => row.revenue <= 0)) return null;
  return round2(latest12.reduce((sum, row) => sum + row.revenue, 0));
}

function derivePercent(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return round2((numerator / denominator) * 100);
}

function deriveRatio(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return round2(numerator / denominator);
}

function deriveConversion(
  operatingCashFlow: number | null | undefined,
  netIncome: number | null | undefined,
): number | null {
  if (operatingCashFlow == null || netIncome == null || netIncome <= 0) return null;
  return round2(operatingCashFlow / netIncome);
}

function classifyEarningsQuality(input: {
  netIncome: number | null;
  operatingCashFlow: number | null;
  cashflowConversion: number | null;
}): EarningsQualityLabel {
  if (input.netIncome == null || input.netIncome <= 0 || input.operatingCashFlow == null) {
    return 'insufficient';
  }
  if (input.operatingCashFlow <= 0) {
    return 'weak';
  }
  if (input.cashflowConversion == null) {
    return 'insufficient';
  }
  if (input.cashflowConversion >= 0.8 && input.cashflowConversion <= 1.5) {
    return 'strong';
  }
  if (input.cashflowConversion >= 0.5) {
    return 'mixed';
  }
  return 'weak';
}

function classifyMarginStability(financialReports: FinancialReportLike[]): StabilityLabel {
  const values = financialReports
    .slice(0, 4)
    .map((report) => report.operatingMargin)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (values.length < 3) return 'insufficient';
  const range = Math.max(...values) - Math.min(...values);
  if (range <= 2) return 'stable';
  if (range <= 5) return 'mixed';
  return 'volatile';
}

function classifyReturnStability(financialReports: FinancialReportLike[]): StabilityLabel {
  const values = financialReports
    .slice(0, 4)
    .map((report) => derivePercent(report.netIncome ?? null, report.equity ?? null))
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (values.length < 3) return 'insufficient';
  const range = Math.max(...values) - Math.min(...values);
  if (range <= 4) return 'stable';
  if (range <= 8) return 'mixed';
  return 'volatile';
}

function compareReportDesc(a: FinancialReportLike, b: FinancialReportLike): number {
  if (a.year !== b.year) return b.year - a.year;
  return b.quarter - a.quarter;
}

function compareRevenueDesc(a: MonthlyRevenueLike, b: MonthlyRevenueLike): number {
  if (a.year !== b.year) return b.year - a.year;
  return b.month - a.month;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
