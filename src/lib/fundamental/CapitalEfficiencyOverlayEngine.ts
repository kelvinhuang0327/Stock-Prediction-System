import type { CashflowLeverageOverlay } from './CashflowLeverageOverlayEngine';
import type {
  CapitalEfficiencyMetrics,
} from './CapitalEfficiencyMetricsBuilder';
import type { StockPeerComparison } from '../fundamentals/StockPeerComparison';
import type { StockFundamentalSnapshot } from '../fundamentals/StockFundamentalSnapshot';
import { formatFundamentalSummary } from './FundamentalWording';

export interface CapitalEfficiencyOverlay {
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'unknown';
  efficiencyContext: string;
  profitabilityContext: string;
  conversionContext: string;
  strengths: string[];
  pressures: string[];
  summary: string;
  limitations: string[];
}

export interface BuildCapitalEfficiencyOverlayInput {
  metrics?: CapitalEfficiencyMetrics | null | undefined;
  fundamentals?: StockFundamentalSnapshot | null | undefined;
  peerComparison?: StockPeerComparison | null | undefined;
  cashflowLeverageOverlay?: CashflowLeverageOverlay | null | undefined;
  baseLimitations?: string[] | null | undefined;
}

export function buildCapitalEfficiencyOverlay(
  input: BuildCapitalEfficiencyOverlayInput,
): CapitalEfficiencyOverlay {
  const fundamentals = input.fundamentals;
  const metrics = input.metrics;
  const limitations = unique([
    ...(input.baseLimitations ?? []),
    ...(fundamentals?.limitations ?? []),
    ...(input.peerComparison?.limitations ?? []),
    ...(metrics?.limitations ?? []),
  ]);

  if (!fundamentals || !metrics) {
    return unknownOverlay([
      ...limitations,
      '缺少效率研究所需的基本面資料，暫無法建立資本效率判讀。',
    ]);
  }

  if (fundamentals.kind === 'etf') {
    return {
      riskLevel: 'unknown',
      efficiencyContext: 'ETF 不適用公司資本使用效率與營運週轉判讀。',
      profitabilityContext: 'ETF 不適用公司 ROE / ROA 式經營效率判讀。',
      conversionContext: 'ETF 不適用公司獲利轉現品質判讀。',
      strengths: [],
      pressures: [],
      summary: 'ETF 暫不建立公司營運式的資本效率與獲利品質判讀。',
      limitations: unique([
        ...limitations,
        'ETF 不適用公司營運式 capital efficiency overlay。',
      ]),
    };
  }

  if (metrics.dataCoverage === 'insufficient') {
    return unknownOverlay(unique([
      ...limitations,
      '效率指標資料不足，暫不做明確資本效率判讀。',
    ]));
  }

  const strengths: string[] = [];
  const pressures: string[] = [];
  let riskScore = 1;

  const roeStrong = metrics.roe != null && metrics.roe >= 15;
  const roaStrong = metrics.roa != null && metrics.roa >= 7;
  const roaWeak = metrics.roa != null && metrics.roa < 3;
  const assetTurnoverStrong = metrics.assetTurnover != null && metrics.assetTurnover >= 1;
  const assetTurnoverWeak = metrics.assetTurnover != null && metrics.assetTurnover < 0.5;
  const conversionStrong = metrics.cashflowConversion != null && metrics.cashflowConversion >= 0.8;
  const conversionWeak =
    metrics.cashflowConversion != null && metrics.cashflowConversion < 0.5;
  const leverageAmplifiedRoe =
    roeStrong && (
      roaWeak
      || (metrics.roeRoaGap != null && metrics.roeRoaGap >= 12)
      || hasLeveragePressure(input.cashflowLeverageOverlay)
    );

  let efficiencyContext = '資本使用效率大致中性，仍需結合後續財報持續觀察。';
  if (roeStrong && roaStrong && assetTurnoverStrong) {
    strengths.push('資本使用效率偏佳');
    efficiencyContext = formatFundamentalSummary({
      section: 'efficiency',
      status: 'strong',
      detail: 'ROE、ROA 與資產周轉率同步偏佳，資本使用效率相對完整。',
    });
    riskScore -= 1;
  } else if (assetTurnoverWeak) {
    pressures.push('資產周轉效率偏弱');
    efficiencyContext = formatFundamentalSummary({
      section: 'efficiency',
      status: 'pressure',
      detail: '資產周轉效率偏弱，資本投入轉為營運成果的速度仍待改善。',
    });
    riskScore += 1;
  } else if (roeStrong || roaStrong) {
    strengths.push('部分效率指標仍具支撐');
    efficiencyContext = formatFundamentalSummary({
      section: 'efficiency',
      status: 'neutral',
      detail: '部分效率指標不差，但尚未形成全面性的效率優勢。',
    });
  } else if (metrics.roe != null || metrics.roa != null) {
    pressures.push('資本使用效率暫未見明顯優勢');
    efficiencyContext = formatFundamentalSummary({
      section: 'efficiency',
      status: 'neutral',
      detail: 'ROE / ROA 目前大致中性，資本使用效率未形成明確優勢。',
    });
  } else {
    limitations.push('ROE / ROA 資料有限，效率結論已保守處理。');
  }

  let profitabilityContext = '帳面獲利效率大致中性，需搭配財務體質與後續季度觀察。';
  if (leverageAmplifiedRoe) {
    pressures.push('高 ROE 可能受槓桿放大影響');
    profitabilityContext = formatFundamentalSummary({
      section: 'efficiency',
      status: 'pressure',
      detail: '帳面報酬不差，但部分表現可能受槓桿放大影響。',
    });
    riskScore += 1;
  } else if (roeStrong && roaStrong) {
    strengths.push('帳面報酬效率相對穩定');
    profitabilityContext = formatFundamentalSummary({
      section: 'efficiency',
      status: 'strong',
      detail: 'ROE 與 ROA 同步偏佳，獲利效率不完全依賴財務放大。',
    });
    riskScore -= 1;
  } else if (roaWeak && metrics.roe != null && metrics.roe >= 10) {
    pressures.push('ROA 偏弱，報酬品質需再確認');
    profitabilityContext = formatFundamentalSummary({
      section: 'efficiency',
      status: 'pressure',
      detail: 'ROE 尚可，但 ROA 偏弱，獲利效率仍需拆解來源。',
    });
    riskScore += 1;
  }

  let conversionContext = '獲利轉現品質大致中性，仍需追蹤後續現金流表現。';
  if (metrics.earningsQuality === 'strong' && conversionStrong) {
    strengths.push('獲利轉現能力尚可');
    conversionContext = formatFundamentalSummary({
      section: 'efficiency',
      status: 'strong',
      detail: '營運現金流與帳面獲利大致一致，轉現品質相對健康。',
    });
    riskScore -= 1;
  } else if (metrics.earningsQuality === 'weak' || conversionWeak) {
    pressures.push('獲利轉現品質偏弱');
    conversionContext = formatFundamentalSummary({
      section: 'efficiency',
      status: 'pressure',
      detail: '獲利存在，但現金流轉換品質偏弱，經營效率需保守解讀。',
    });
    riskScore += 2;
  } else if (metrics.earningsQuality === 'mixed') {
    conversionContext = formatFundamentalSummary({
      section: 'efficiency',
      status: 'neutral',
      detail: '現金流與獲利大致同向，但轉現效率尚未形成明確優勢。',
    });
  } else {
    limitations.push('現金流 / netIncome 資料不足，轉現品質判讀已保守處理。');
  }

  if (metrics.marginStability === 'stable') {
    strengths.push('利潤率變動相對穩定');
  } else if (metrics.marginStability === 'volatile') {
    pressures.push('利潤率波動偏大');
    riskScore += 1;
  }

  if (metrics.returnStability === 'stable') {
    strengths.push('報酬效率延續性尚可');
  } else if (metrics.returnStability === 'volatile') {
    pressures.push('報酬效率波動偏大');
    riskScore += 1;
  }

  if (metrics.dataCoverage === 'limited') {
    limitations.push('效率欄位僅部分可得，本區結論已保守處理。');
    riskScore = Math.max(riskScore, 1);
  }

  const riskLevel = normalizeRiskScore(riskScore);

  return {
    riskLevel,
    efficiencyContext,
    profitabilityContext,
    conversionContext,
    strengths: unique(strengths).slice(0, 4),
    pressures: unique(pressures).slice(0, 4),
    summary: buildSummary({
      riskLevel,
      leverageAmplifiedRoe,
      conversionWeak: metrics.earningsQuality === 'weak' || conversionWeak,
      efficiencyStrong: roeStrong && roaStrong && assetTurnoverStrong,
    }),
    limitations: unique(limitations),
  };
}

function buildSummary(input: {
  riskLevel: CapitalEfficiencyOverlay['riskLevel'];
  leverageAmplifiedRoe: boolean;
  conversionWeak: boolean;
  efficiencyStrong: boolean;
}): string {
  if (input.riskLevel === 'unknown') {
    return formatFundamentalSummary({
      section: 'efficiency',
      status: 'unknown',
      detail: '暫不做明確資本效率判讀。',
      fallback: '資料不足，暫不做完整基本面判讀。',
    });
  }
  if (input.leverageAmplifiedRoe) {
    return formatFundamentalSummary({
      section: 'efficiency',
      status: 'pressure',
      detail: '帳面報酬不差，但部分表現可能受槓桿放大影響。',
    });
  }
  if (input.conversionWeak) {
    return formatFundamentalSummary({
      section: 'efficiency',
      status: 'pressure',
      detail: '獲利存在，但現金流轉換品質偏弱，經營效率需保守解讀。',
    });
  }
  if (input.efficiencyStrong && input.riskLevel === 'low') {
    return formatFundamentalSummary({
      section: 'efficiency',
      status: 'strong',
      detail: '資本使用效率偏佳，且獲利轉現能力尚可。',
    });
  }
  if (input.riskLevel === 'high') {
    return formatFundamentalSummary({
      section: 'efficiency',
      status: 'pressure',
      detail: '經營效率與獲利品質承壓，後續需觀察報酬與現金流是否同步修復。',
    });
  }
  return formatFundamentalSummary({
    section: 'efficiency',
    status: 'neutral',
    detail: '資本效率與獲利品質大致中性，建議搭配後續財報持續追蹤。',
  });
}

function hasLeveragePressure(
  overlay: CashflowLeverageOverlay | null | undefined,
): boolean {
  if (!overlay) return false;
  if (overlay.riskLevel === 'elevated' || overlay.riskLevel === 'high') return true;
  return overlay.pressures.some((item) => item.includes('槓桿'));
}

function normalizeRiskScore(score: number): CapitalEfficiencyOverlay['riskLevel'] {
  if (!Number.isFinite(score)) return 'unknown';
  if (score <= 0) return 'low';
  if (score === 1) return 'moderate';
  if (score === 2) return 'elevated';
  return 'high';
}

function unknownOverlay(limitations: string[]): CapitalEfficiencyOverlay {
  return {
    riskLevel: 'unknown',
    efficiencyContext: formatFundamentalSummary({
      section: 'efficiency',
      status: 'unknown',
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    profitabilityContext: formatFundamentalSummary({
      section: 'efficiency',
      status: 'unknown',
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    conversionContext: formatFundamentalSummary({
      section: 'efficiency',
      status: 'unknown',
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    strengths: [],
    pressures: [],
    summary: formatFundamentalSummary({
      section: 'efficiency',
      status: 'unknown',
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    limitations: unique(limitations),
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
