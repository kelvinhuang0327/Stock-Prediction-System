import type { StockPeerComparison } from '@/lib/fundamentals/StockPeerComparison';
import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { FinancialStructureMetrics } from '@/lib/fundamental/FinancialStructureMetricsBuilder';
import { formatFundamentalSummary } from './FundamentalWording';

export type CashflowLeverageMetrics = Partial<FinancialStructureMetrics>;

export interface CashflowLeverageOverlay {
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'unknown';
  cashflowContext: string;
  leverageContext: string;
  strengths: string[];
  pressures: string[];
  summary: string;
  limitations: string[];
}

export interface BuildCashflowLeverageOverlayInput {
  fundamentals: StockFundamentalSnapshot | null | undefined;
  peerComparison?: StockPeerComparison | null | undefined;
  metrics?: CashflowLeverageMetrics | null | undefined;
  baseLimitations?: string[] | null | undefined;
}

export function buildCashflowLeverageOverlay(
  input: BuildCashflowLeverageOverlayInput,
): CashflowLeverageOverlay {
  const fundamentals = input.fundamentals;
  const metrics = input.metrics ?? {};
  const limitations = unique([
    ...(input.baseLimitations ?? []),
    ...(fundamentals?.limitations ?? []),
    ...(input.peerComparison?.limitations ?? []),
  ]);

  if (!fundamentals) {
    return unknownOverlay([
      ...limitations,
      '缺少基本面資料，暫無法建立現金流 / 財務槓桿觀察。',
    ]);
  }

  if (fundamentals.kind === 'etf') {
    return {
      riskLevel: 'unknown',
      cashflowContext: 'ETF 不適用公司營運式現金流與轉現能力判讀。',
      leverageContext: 'ETF 不適用公司負債 / 流動性結構判讀。',
      strengths: [],
      pressures: [],
      summary: 'ETF 暫不建立公司財務結構式的現金流 / 槓桿判讀。',
      limitations: unique([
        ...limitations,
        'ETF 不適用公司財務結構式 cashflow / leverage overlay。',
      ]),
    };
  }

  const actualFieldCount = [
    metrics.operatingCashFlow,
    metrics.freeCashFlow,
    metrics.debtRatio,
    metrics.liabilitiesRatio,
    metrics.currentRatio,
    metrics.quickRatio,
    metrics.interestCoverage,
  ].filter((value) => value !== null && value !== undefined).length;

  if (actualFieldCount === 0) {
    return unknownOverlay(unique([
      ...limitations,
      '目前資料表未提供穩定的營運現金流、自由現金流或槓桿欄位，已降級為保守觀察。',
      ...(metrics.limitations ?? []),
    ]));
  }

  const strengths: string[] = [];
  const pressures: string[] = [];
  let riskScore = 1;

  const hasPositiveCashflow =
    positive(metrics.operatingCashFlow) && (metrics.freeCashFlow == null || positive(metrics.freeCashFlow));
  const cashflowWeak =
    negative(metrics.operatingCashFlow) || negative(metrics.freeCashFlow);
  const profitPositive =
    positive(metrics.netIncome) || positive(fundamentals.profitability.eps);
  const growthStillDecent = (fundamentals.revenue.yoyGrowth ?? Number.NEGATIVE_INFINITY) >= 10;

  let cashflowContext = '現金流資料大致中性，仍需配合後續季度持續追蹤。';
  if (hasPositiveCashflow) {
    strengths.push('現金流支撐相對穩定');
    cashflowContext = formatFundamentalSummary({
      section: 'financialStructure',
      status: 'strong',
      detail: '營運 / 自由現金流維持正值，現金流支撐度相對穩定。',
    });
    riskScore -= 1;
  } else if (cashflowWeak && growthStillDecent) {
    pressures.push('成長延續需持續觀察現金流轉化能力');
    cashflowContext = formatFundamentalSummary({
      section: 'financialStructure',
      status: 'pressure',
      detail: '營運成長不差，但現金流轉化仍偏弱，後續需觀察成長品質。',
    });
    riskScore += 1;
  } else if (cashflowWeak && profitPositive) {
    pressures.push('獲利存在，但現金流品質偏弱');
    cashflowContext = formatFundamentalSummary({
      section: 'financialStructure',
      status: 'pressure',
      detail: '帳面獲利仍在，但現金流未能同步支撐，轉現能力需持續觀察。',
    });
    riskScore += 1;
  } else if (cashflowWeak) {
    pressures.push('現金流支撐偏弱');
    cashflowContext = formatFundamentalSummary({
      section: 'financialStructure',
      status: 'pressure',
      detail: '營運 / 自由現金流偏弱，對後續營運支撐度需保守看待。',
    });
    riskScore += 1;
  } else if (!hasPositiveCashflow) {
    limitations.push('現金流欄位僅部分可用，現金流結論已保守處理。');
    cashflowContext = formatFundamentalSummary({
      section: 'financialStructure',
      status: 'unknown',
      detail: '目前只做保守的體質觀察。',
      fallback: '資料不足，暫不做完整基本面判讀。',
    });
  }

  const leverageLow =
    (metrics.debtRatio != null && metrics.debtRatio <= 30) ||
    (metrics.liabilitiesRatio != null && metrics.liabilitiesRatio <= 50);
  const leverageHigh =
    (metrics.debtRatio != null && metrics.debtRatio >= 55) ||
    (metrics.liabilitiesRatio != null && metrics.liabilitiesRatio >= 70) ||
    (metrics.interestCoverage != null && metrics.interestCoverage < 2);
  const liquidityStrong =
    (metrics.currentRatio != null && metrics.currentRatio >= 1.5) ||
    (metrics.quickRatio != null && metrics.quickRatio >= 1);
  const liquidityWeak =
    (metrics.currentRatio != null && metrics.currentRatio < 1) ||
    (metrics.quickRatio != null && metrics.quickRatio < 0.7);

  let leverageContext = '槓桿與流動性資料大致中性，需配合後續資料更新觀察。';
  if (leverageLow && liquidityStrong) {
    strengths.push('負債壓力不高，流動性相對穩定');
    leverageContext = formatFundamentalSummary({
      section: 'financialStructure',
      status: 'strong',
      detail: '負債壓力不高，且流動性比率尚可，財務結構相對穩健。',
    });
    riskScore -= 1;
  } else if (leverageHigh && liquidityWeak) {
    pressures.push('槓桿偏高且流動性支撐不足');
    leverageContext = formatFundamentalSummary({
      section: 'financialStructure',
      status: 'pressure',
      detail: '槓桿壓力偏高，且流動性支撐不足，財務結構需保守解讀。',
    });
    riskScore += 2;
  } else if (leverageHigh) {
    pressures.push('槓桿壓力偏高');
    leverageContext = formatFundamentalSummary({
      section: 'financialStructure',
      status: 'pressure',
      detail: '負債或利息承受能力偏緊，後續需留意財務結構風險。',
    });
    riskScore += 1;
  } else if (leverageLow && liquidityWeak) {
    strengths.push('負債壓力不高');
    pressures.push('流動性支撐偏弱');
    leverageContext = formatFundamentalSummary({
      section: 'financialStructure',
      status: 'pressure',
      detail: '負債壓力不高，但流動性支撐仍偏弱，短期周轉能力需留意。',
    });
    riskScore += 1;
  } else if (liquidityStrong) {
    strengths.push('流動性結構相對穩定');
    leverageContext = formatFundamentalSummary({
      section: 'financialStructure',
      status: 'neutral',
      detail: '流動性比率仍在可接受範圍，短期財務壓力暫未明顯升高。',
    });
  } else if (liquidityWeak) {
    pressures.push('流動性支撐偏弱');
    leverageContext = formatFundamentalSummary({
      section: 'financialStructure',
      status: 'pressure',
      detail: '流動性比率偏弱，若營運波動擴大，財務彈性可能受限。',
    });
    riskScore += 1;
  } else {
    limitations.push('槓桿與流動性欄位僅部分可用，結論已保守處理。');
  }

  if (input.peerComparison?.dataCoverage === 'limited') {
    limitations.push('同組比較樣本有限，本區以公司自身財務結構資料為主。');
    riskScore = Math.max(riskScore, 1);
  }
  if (metrics.dataCoverage === 'limited') {
    limitations.push('財務結構欄位僅部分可得，現金流 / 槓桿結論已保守處理。');
    riskScore = Math.max(riskScore, 1);
  }

  const riskLevel = normalizeRiskScore(riskScore);

  return {
    riskLevel,
    cashflowContext,
    leverageContext,
    strengths: unique(strengths).slice(0, 4),
    pressures: unique(pressures).slice(0, 4),
    summary: buildSummary({
      riskLevel,
      cashflowWeak,
      leverageHigh,
      growthStillDecent,
      hasPositiveCashflow,
      leverageLow,
    }),
    limitations: unique([
      ...limitations,
      ...(metrics.limitations ?? []),
    ]),
  };
}

function buildSummary(input: {
  riskLevel: CashflowLeverageOverlay['riskLevel'];
  cashflowWeak: boolean;
  leverageHigh: boolean;
  growthStillDecent: boolean;
  hasPositiveCashflow: boolean;
  leverageLow: boolean;
}): string {
  if (input.riskLevel === 'unknown') {
    return formatFundamentalSummary({
      section: 'financialStructure',
      status: 'unknown',
      detail: '暫不做明確現金流與槓桿判讀。',
      fallback: '資料不足，暫不做完整基本面判讀。',
    });
  }
  if (input.cashflowWeak && input.leverageHigh) {
    return formatFundamentalSummary({
      section: 'financialStructure',
      status: 'pressure',
      detail: '現金流支撐偏弱且槓桿壓力偏高，財務體質需保守解讀。',
    });
  }
  if (input.growthStillDecent && input.cashflowWeak) {
    return formatFundamentalSummary({
      section: 'financialStructure',
      status: 'pressure',
      detail: '營運成長不差，但現金流轉化仍偏弱，成長延續性需持續追蹤。',
    });
  }
  if (input.hasPositiveCashflow && input.leverageLow) {
    return formatFundamentalSummary({
      section: 'financialStructure',
      status: 'strong',
      detail: '現金流支撐與槓桿結構大致穩健，財務體質風險相對較低。',
    });
  }
  if (input.riskLevel === 'high') {
    return formatFundamentalSummary({
      section: 'financialStructure',
      status: 'pressure',
      detail: '財務結構承壓，現金流或槓桿面缺少明確緩衝。',
    });
  }
  if (input.riskLevel === 'elevated') {
    return formatFundamentalSummary({
      section: 'financialStructure',
      status: 'pressure',
      detail: '財務體質存在一定壓力，需搭配後續現金流與流動性變化持續觀察。',
    });
  }
  return formatFundamentalSummary({
    section: 'financialStructure',
    status: 'neutral',
    detail: '現金流與槓桿結構目前偏中性，建議配合後續財報更新持續追蹤。',
  });
}

function normalizeRiskScore(score: number): CashflowLeverageOverlay['riskLevel'] {
  if (!Number.isFinite(score)) return 'unknown';
  if (score <= 0) return 'low';
  if (score === 1) return 'moderate';
  if (score === 2) return 'elevated';
  return 'high';
}

function unknownOverlay(limitations: string[]): CashflowLeverageOverlay {
  return {
    riskLevel: 'unknown',
    cashflowContext: formatFundamentalSummary({
      section: 'financialStructure',
      status: 'unknown',
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    leverageContext: formatFundamentalSummary({
      section: 'financialStructure',
      status: 'unknown',
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    strengths: [],
    pressures: [],
    summary: formatFundamentalSummary({
      section: 'financialStructure',
      status: 'unknown',
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    limitations: unique(limitations),
  };
}

function positive(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value > 0;
}

function negative(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value < 0;
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
