export type FundamentalDataCoverage = 'full' | 'limited' | 'insufficient';
export type RevenueTrend = 'accelerating' | 'improving' | 'stable' | 'weakening' | 'insufficient';

export interface MonthlyRevenueLike {
  year: number;
  month: number;
  revenue: number;
  yoyGrowth: number | null;
  momGrowth: number | null;
}

export interface FinancialReportLike {
  year: number;
  quarter: number;
  eps: number;
  netIncome: number;
  grossMargin: number | null;
  operatingMargin: number | null;
  operatingIncome?: number | null;
  operatingCashFlow?: number | null;
  capitalExpenditure?: number | null;
  freeCashFlow?: number | null;
  cashAndCashEquivalents?: number | null;
  currentAssets?: number | null;
  inventory?: number | null;
  currentLiabilities?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  equity?: number | null;
  totalDebt?: number | null;
  shortTermDebt?: number | null;
  longTermDebt?: number | null;
  interestExpense?: number | null;
  currentRatio?: number | null;
  quickRatio?: number | null;
  debtRatio?: number | null;
  liabilitiesRatio?: number | null;
  interestCoverage?: number | null;
}

export interface StockMetricsLike {
  date: string;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null;
}

export interface FundamentalRevenueSnapshot {
  latestMonth: string | null;
  revenue: number | null;
  yoyGrowth: number | null;
  momGrowth: number | null;
  trend: RevenueTrend;
  consecutivePositiveYoYMonths: number;
}

export interface FundamentalProfitabilitySnapshot {
  latestPeriod: string | null;
  eps: number | null;
  previousEps: number | null;
  epsQoQDelta: number | null;
  grossMargin: number | null;
  grossMarginDelta: number | null;
  operatingMargin: number | null;
  operatingMarginDelta: number | null;
}

export interface FundamentalValuationSnapshot {
  asOfDate: string | null;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null;
}

export interface StockFundamentalSnapshot {
  kind: 'stock' | 'etf';
  dataCoverage: FundamentalDataCoverage;
  revenue: FundamentalRevenueSnapshot;
  profitability: FundamentalProfitabilitySnapshot;
  valuation: FundamentalValuationSnapshot;
  keySignals: string[];
  keyRisks: string[];
  summary: string;
  limitations: string[];
}

export interface BuildStockFundamentalSnapshotInput {
  isETF: boolean;
  monthlyRevenues: MonthlyRevenueLike[];
  financialReports: FinancialReportLike[];
  stockMetrics: StockMetricsLike[];
}

export function buildStockFundamentalSnapshot(
  input: BuildStockFundamentalSnapshotInput,
): StockFundamentalSnapshot {
  const monthlyRevenues = [...input.monthlyRevenues].sort(compareRevenueDesc);
  const financialReports = [...input.financialReports].sort(compareReportDesc);
  const stockMetrics = [...input.stockMetrics].sort((a, b) => b.date.localeCompare(a.date));

  const latestRevenue = monthlyRevenues[0] ?? null;
  const latestReport = financialReports[0] ?? null;
  const previousReport = financialReports[1] ?? null;
  const latestMetrics = stockMetrics[0] ?? null;

  const hasRevenue = !!latestRevenue;
  const hasProfitability = !input.isETF && !!latestReport;
  const hasValuation = !!latestMetrics && [latestMetrics.pe, latestMetrics.pb, latestMetrics.dividendYield].some((v) => v !== null);

  const recentYoys = monthlyRevenues
    .slice(0, 3)
    .map((r) => r.yoyGrowth)
    .filter((v): v is number => v !== null);

  const revenue = {
    latestMonth: latestRevenue ? formatRevenueMonth(latestRevenue.year, latestRevenue.month) : null,
    revenue: latestRevenue ? round2(latestRevenue.revenue) : null,
    yoyGrowth: latestRevenue?.yoyGrowth ?? null,
    momGrowth: latestRevenue?.momGrowth ?? null,
    trend: classifyRevenueTrend(recentYoys),
    consecutivePositiveYoYMonths: countConsecutivePositiveYoY(monthlyRevenues),
  };

  const profitability = {
    latestPeriod: latestReport ? formatQuarter(latestReport.year, latestReport.quarter) : null,
    eps: latestReport ? round2(latestReport.eps) : null,
    previousEps: previousReport ? round2(previousReport.eps) : null,
    epsQoQDelta:
      latestReport && previousReport ? round2(latestReport.eps - previousReport.eps) : null,
    grossMargin: latestReport?.grossMargin ?? null,
    grossMarginDelta: subtractNullable(latestReport?.grossMargin, previousReport?.grossMargin),
    operatingMargin: latestReport?.operatingMargin ?? null,
    operatingMarginDelta: subtractNullable(
      latestReport?.operatingMargin,
      previousReport?.operatingMargin,
    ),
  };

  const valuation = {
    asOfDate: latestMetrics?.date ?? null,
    pe: latestMetrics?.pe ?? null,
    pb: latestMetrics?.pb ?? null,
    dividendYield: latestMetrics?.dividendYield ?? null,
  };

  const keySignals: string[] = [];
  const keyRisks: string[] = [];
  const limitations: string[] = [];

  if (input.isETF) {
    limitations.push('ETF 不適用公司營收、EPS 與利潤率分析；本區僅提供可用的估值/收益資料。');
  }

  if (!hasRevenue) {
    limitations.push('缺少月營收資料，無法判讀營收趨勢。');
  } else {
    if ((revenue.yoyGrowth ?? 0) >= 10) keySignals.push(`最新月營收年增 ${fmtSigned(revenue.yoyGrowth)}，維持成長。`);
    if ((revenue.yoyGrowth ?? 0) < 0) keyRisks.push(`最新月營收年增 ${fmtSigned(revenue.yoyGrowth)}，營運動能轉弱。`);
    if (revenue.consecutivePositiveYoYMonths >= 3) keySignals.push(`營收年增連續 ${revenue.consecutivePositiveYoYMonths} 個月為正。`);
    if (revenue.trend === 'accelerating') keySignals.push('近三個月營收年增率持續加速。');
    if (revenue.trend === 'weakening') keyRisks.push('近三個月營收年增率走弱。');
  }

  if (!hasProfitability) {
    if (!input.isETF) limitations.push('缺少財報資料，無法判讀 EPS 與利潤率。');
  } else {
    if ((profitability.epsQoQDelta ?? 0) > 0) keySignals.push(`最新單季 EPS 較前季增加 ${profitability.epsQoQDelta?.toFixed(2)} 元。`);
    if ((profitability.epsQoQDelta ?? 0) < 0) keyRisks.push(`最新單季 EPS 較前季減少 ${Math.abs(profitability.epsQoQDelta ?? 0).toFixed(2)} 元。`);
    if ((profitability.grossMarginDelta ?? 0) >= 1) keySignals.push(`毛利率較前季提升 ${profitability.grossMarginDelta?.toFixed(2)} 個百分點。`);
    if ((profitability.grossMarginDelta ?? 0) <= -1) keyRisks.push(`毛利率較前季下降 ${Math.abs(profitability.grossMarginDelta ?? 0).toFixed(2)} 個百分點。`);
    if ((profitability.operatingMarginDelta ?? 0) >= 1) keySignals.push(`營益率較前季改善 ${profitability.operatingMarginDelta?.toFixed(2)} 個百分點。`);
    if ((profitability.operatingMarginDelta ?? 0) <= -1) keyRisks.push(`營益率較前季下滑 ${Math.abs(profitability.operatingMarginDelta ?? 0).toFixed(2)} 個百分點。`);
  }

  if (!hasValuation) {
    limitations.push('估值資料不足，無法提供 PE / PB / 殖利率參考。');
  } else {
    if ((valuation.dividendYield ?? 0) >= 3) keySignals.push(`殖利率 ${valuation.dividendYield?.toFixed(2)}%，具收益支撐。`);
    if ((valuation.pe ?? 0) >= 30 || (valuation.pb ?? 0) >= 4) {
      keyRisks.push('估值偏高，需結合同業比較與成長性一併解讀。');
    }
  }

  const coverageScore = [hasRevenue, hasProfitability, hasValuation].filter(Boolean).length;
  const dataCoverage: FundamentalDataCoverage = input.isETF
    ? hasValuation
      ? 'limited'
      : 'insufficient'
    : coverageScore >= 3
      ? 'full'
      : coverageScore >= 2
        ? 'limited'
        : 'insufficient';

  const summary = buildSummary({
    isETF: input.isETF,
    dataCoverage,
    signalCount: keySignals.length,
    riskCount: keyRisks.length,
    revenueTrend: revenue.trend,
  });

  return {
    kind: input.isETF ? 'etf' : 'stock',
    dataCoverage,
    revenue,
    profitability,
    valuation,
    keySignals,
    keyRisks,
    summary,
    limitations,
  };
}

function buildSummary(input: {
  isETF: boolean;
  dataCoverage: FundamentalDataCoverage;
  signalCount: number;
  riskCount: number;
  revenueTrend: RevenueTrend;
}): string {
  if (input.isETF) {
    return input.dataCoverage === 'insufficient'
      ? 'ETF 基本面資料不足，目前僅能提供有限參考。'
      : 'ETF 不適用公司營運財報式基本面判讀，請以估值、收益與市場結構解讀。';
  }

  if (input.dataCoverage === 'insufficient') {
    return '基本面資料不足，目前僅能提供局部觀察，需保守解讀。';
  }
  if (input.signalCount >= 2 && input.riskCount === 0) {
    return input.revenueTrend === 'accelerating'
      ? '營收與獲利結構同步改善，基本面偏正向。'
      : '基本面整體穩定，營運訊號偏正向。';
  }
  if (input.riskCount >= 2 && input.signalCount === 0) {
    return '營收或獲利出現轉弱跡象，基本面需保守解讀。';
  }
  if (input.signalCount > 0 && input.riskCount > 0) {
    return '基本面訊號分歧，需持續觀察營收、EPS 與利潤率變化。';
  }
  return '基本面目前偏中性，建議結合技術面與事件面交叉判讀。';
}

function classifyRevenueTrend(yoys: number[]): RevenueTrend {
  if (yoys.length < 2) return 'insufficient';
  if (yoys.length >= 3 && yoys[0] > yoys[1] && yoys[1] > yoys[2]) return 'accelerating';
  if (yoys[0] > yoys[1] && yoys[0] > 0) return 'improving';
  if (yoys[0] < yoys[1]) return 'weakening';
  return 'stable';
}

function countConsecutivePositiveYoY(monthlyRevenues: MonthlyRevenueLike[]): number {
  let count = 0;
  for (const item of monthlyRevenues) {
    if ((item.yoyGrowth ?? Number.NEGATIVE_INFINITY) > 0) count += 1;
    else break;
  }
  return count;
}

function compareRevenueDesc(a: MonthlyRevenueLike, b: MonthlyRevenueLike): number {
  if (a.year !== b.year) return b.year - a.year;
  return b.month - a.month;
}

function compareReportDesc(a: FinancialReportLike, b: FinancialReportLike): number {
  if (a.year !== b.year) return b.year - a.year;
  return b.quarter - a.quarter;
}

function formatRevenueMonth(year: number, month: number): string {
  return `${year}/${String(month).padStart(2, '0')}`;
}

function formatQuarter(year: number, quarter: number): string {
  return `${year} Q${quarter}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function subtractNullable(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  return round2(a - b);
}

function fmtSigned(value: number | null): string {
  if (value === null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
