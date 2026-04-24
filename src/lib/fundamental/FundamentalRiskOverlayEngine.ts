import type { StockPeerComparison } from '@/lib/fundamentals/StockPeerComparison';
import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import { formatFundamentalSummary } from './FundamentalWording';

export interface FundamentalRiskOverlay {
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'unknown';
  strengths: string[];
  pressures: string[];
  valuationContext: string;
  growthContext: string;
  summary: string;
  limitations: string[];
}

export interface BuildFundamentalRiskOverlayInput {
  fundamentals: StockFundamentalSnapshot | null | undefined;
  peerComparison: StockPeerComparison | null | undefined;
}

export function buildFundamentalRiskOverlay(
  input: BuildFundamentalRiskOverlayInput,
): FundamentalRiskOverlay {
  const fundamentals = input.fundamentals;
  const peerComparison = input.peerComparison;

  if (!fundamentals) {
    return unknownOverlay(['缺少基本面資料，無法建立基本面風險 overlay。']);
  }

  if (fundamentals.kind === 'etf') {
    return {
      riskLevel: 'unknown',
      strengths: [],
      pressures: [],
      valuationContext: 'ETF 不適用公司營運式估值壓力解讀。',
      growthContext: 'ETF 不適用營收 / EPS / 毛利率式成長判讀。',
      summary: 'ETF 僅能做有限的估值 / 收益觀察，暫不建立公司營運式基本面風險判斷。',
      limitations: [
        ...fundamentals.limitations,
        'ETF 不適用公司營運式基本面風險 overlay。',
      ],
    };
  }

  const limitations = [
    ...fundamentals.limitations,
    ...(peerComparison?.limitations ?? []),
  ];

  if (
    fundamentals.dataCoverage === 'insufficient' ||
    !peerComparison ||
    peerComparison.dataCoverage === 'insufficient'
  ) {
    return {
      riskLevel: 'unknown',
      strengths: [],
      pressures: [],
      valuationContext: '同組估值比較資料不足，暫無法判讀估值壓力。',
      growthContext: '基本面或同組樣本資料不足，暫無法建立可靠的成長比較。',
      summary: '基本面相對比較資料不足，目前僅能提供保守觀察。',
      limitations: unique([
        ...limitations,
        '同組樣本或核心基本面資料不足，已降級為 unknown。',
      ]),
    };
  }

  const metric = (key: StockPeerComparison['metrics'][number]['key']) =>
    peerComparison.metrics.find((item) => item.key === key);

  const revenuePct = metric('revenueYoY')?.percentile ?? null;
  const epsPct = metric('eps')?.percentile ?? null;
  const grossPct = metric('grossMargin')?.percentile ?? null;
  const operatingPct = metric('operatingMargin')?.percentile ?? null;
  const pePct = metric('pe')?.percentile ?? null;
  const pbPct = metric('pb')?.percentile ?? null;
  const dividendPct = metric('dividendYield')?.percentile ?? null;

  const strengths: string[] = [];
  const pressures: string[] = [];

  const strongMetrics = [revenuePct, epsPct, grossPct, operatingPct, dividendPct].filter(
    (value): value is number => value !== null && value >= 70,
  ).length;
  const weakMetrics = [revenuePct, epsPct, grossPct, operatingPct].filter(
    (value): value is number => value !== null && value <= 30,
  ).length;
  const valuationPressure = [pePct, pbPct].some((value) => value !== null && value <= 30);
  const valuationReasonable = [pePct, pbPct].some((value) => value !== null && value >= 70);
  const growthStrong =
    (fundamentals.revenue.yoyGrowth ?? Number.NEGATIVE_INFINITY) >= 15 ||
    (revenuePct !== null && revenuePct >= 70) ||
    (epsPct !== null && epsPct >= 70);
  const profitWeak =
    weakMetrics >= 2 ||
    (fundamentals.profitability.epsQoQDelta ?? 0) < 0 ||
    (fundamentals.profitability.operatingMarginDelta ?? 0) <= -1;
  const conservativeWeakValueCase = profitWeak && valuationReasonable;

  let riskScore = 1;

  let growthContext = formatFundamentalSummary({
    section: 'growth',
    status: 'neutral',
    detail: '目前尚無明確基本面優勢。',
  });
  if (conservativeWeakValueCase) {
    pressures.push('營運指標仍偏弱');
    strengths.push('估值相對保守');
    growthContext = formatFundamentalSummary({
      section: 'growth',
      status: 'pressure',
      detail: '估值相對保守，但營運指標仍偏弱。',
    });
    riskScore = Math.max(riskScore, 2);
  } else if (growthStrong && valuationPressure) {
    strengths.push('同組成長表現偏強');
    pressures.push('估值壓力較高');
    growthContext = formatFundamentalSummary({
      section: 'growth',
      status: 'strong',
      detail: '但估值壓力較高。',
    });
    riskScore = Math.max(riskScore, 2);
  } else if (growthStrong && valuationReasonable) {
    strengths.push('同組成長表現偏強');
    strengths.push('估值仍相對合理');
    growthContext = formatFundamentalSummary({
      section: 'growth',
      status: 'strong',
      detail: '且估值仍相對合理，基本面結構較健康。',
    });
    riskScore = 0;
  } else if (growthStrong) {
    strengths.push('同組成長表現偏強');
    growthContext = formatFundamentalSummary({
      section: 'growth',
      status: 'strong',
      detail: '成長動能相對同組更具支撐。',
    });
  } else if (profitWeak) {
    pressures.push('營運指標相對偏弱');
    growthContext = formatFundamentalSummary({
      section: 'growth',
      status: 'pressure',
      detail: '營收、EPS 或利潤率相對位置偏弱，需持續觀察。',
    });
    riskScore = Math.max(riskScore, 2);
  }

  let valuationContext = formatFundamentalSummary({
    section: 'valuation',
    status: 'neutral',
    detail: '估值大致接近同組中位水準。',
  });
  if (valuationPressure) {
    pressures.push('相對同組估值偏高');
    valuationContext = formatFundamentalSummary({
      section: 'valuation',
      status: 'pressure',
      detail: 'PE / PB 相對同組偏高，後續需要成長持續性支撐。',
    });
    riskScore += 1;
  } else if (valuationReasonable) {
    strengths.push('相對同組估值仍屬保守');
    valuationContext = formatFundamentalSummary({
      section: 'valuation',
      status: 'strong',
      detail: 'PE / PB 相對同組仍屬保守。',
    });
  }

  if (strongMetrics >= 3) {
    strengths.push('多數核心基本面 percentile 偏強');
    riskScore -= 1;
  }

  if (weakMetrics >= 3 && !conservativeWeakValueCase) {
    pressures.push('多數核心基本面 percentile 偏弱');
    riskScore += 1;
  }

  if (peerComparison.dataCoverage === 'limited' || fundamentals.dataCoverage === 'limited') {
    limitations.push('部分同組或基本面資料有限，結論已保守處理。');
    riskScore = Math.max(riskScore, 1);
  }

  const riskLevel = normalizeRiskScore(riskScore);

  return {
    riskLevel,
    strengths: unique(strengths).slice(0, 4),
    pressures: unique(pressures).slice(0, 4),
    valuationContext,
    growthContext,
    summary: buildSummary({
      riskLevel,
      growthContext,
      valuationContext,
      strongMetrics,
      weakMetrics,
      hasValuationPressure: valuationPressure,
    }),
    limitations: unique(limitations),
  };
}

function buildSummary(input: {
  riskLevel: FundamentalRiskOverlay['riskLevel'];
  growthContext: string;
  valuationContext: string;
  strongMetrics: number;
  weakMetrics: number;
  hasValuationPressure: boolean;
}): string {
  if (input.riskLevel === 'low') {
    return formatFundamentalSummary({
      section: 'peerPosition',
      status: 'strong',
      detail: '且估值壓力尚可控，基本面風險較低。',
    });
  }
  if (input.riskLevel === 'high') {
    return formatFundamentalSummary({
      section: 'peerPosition',
      status: 'pressure',
      detail: '多數基本面指標偏弱，且缺少明確緩衝，基本面風險偏高。',
    });
  }
  if (input.hasValuationPressure && input.strongMetrics > 0) {
    return formatFundamentalSummary({
      section: 'peerPosition',
      status: 'pressure',
      detail: '成長表現不差，但估值壓力偏高，宜保守看待追價風險。',
    });
  }
  if (input.weakMetrics >= 2) {
    return formatFundamentalSummary({
      section: 'peerPosition',
      status: 'pressure',
      detail: '營運指標偏弱，即使估值不高也不代表基本面風險已解除。',
    });
  }
  return formatFundamentalSummary({
    section: 'peerPosition',
    status: 'neutral',
    detail: `${input.growthContext} ${input.valuationContext}`,
  });
}

function normalizeRiskScore(score: number): FundamentalRiskOverlay['riskLevel'] {
  if (!Number.isFinite(score)) return 'unknown';
  if (score <= 0) return 'low';
  if (score === 1) return 'moderate';
  if (score === 2) return 'elevated';
  return 'high';
}

function unknownOverlay(limitations: string[]): FundamentalRiskOverlay {
  return {
    riskLevel: 'unknown',
    strengths: [],
    pressures: [],
    valuationContext: formatFundamentalSummary({
      section: 'valuation',
      status: 'unknown',
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    growthContext: formatFundamentalSummary({
      section: 'growth',
      status: 'unknown',
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    summary: formatFundamentalSummary({
      section: 'peerPosition',
      status: 'unknown',
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    limitations,
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
