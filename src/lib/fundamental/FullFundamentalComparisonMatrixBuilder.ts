import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { StockPeerComparison } from '@/lib/fundamentals/StockPeerComparison';
import type { FundamentalRiskOverlay } from './FundamentalRiskOverlayEngine';
import type { CashflowLeverageOverlay } from './CashflowLeverageOverlayEngine';
import type { CapitalEfficiencyOverlay } from './CapitalEfficiencyOverlayEngine';
import type { FinancialStructurePeerComparison } from './FinancialStructurePeerComparisonEngine';
import {
  formatFundamentalBullet,
  formatFundamentalLimitation,
  formatFundamentalSummary,
  fundamentalWordingStatusLabel,
} from './FundamentalWording';

export type FundamentalMatrixStatus = 'strong' | 'neutral' | 'pressure' | 'unknown';

export interface FundamentalMatrixSection {
  title: string;
  status: FundamentalMatrixStatus;
  summary: string;
  highlights: string[];
  warnings: string[];
  basis?: string;
  peerSampleSize?: number | null;
  limitations: string[];
}

export interface FullFundamentalComparisonMatrix {
  sections: {
    growth: FundamentalMatrixSection;
    valuation: FundamentalMatrixSection;
    financialStructure: FundamentalMatrixSection;
    efficiency: FundamentalMatrixSection;
    peerPosition: FundamentalMatrixSection;
  };
  overallSummary: string;
  limitations: string[];
}

export interface BuildFullFundamentalComparisonMatrixInput {
  fundamentals: StockFundamentalSnapshot;
  peerComparison: StockPeerComparison | null;
  overlay: FundamentalRiskOverlay;
  cashflowLeverageOverlay: CashflowLeverageOverlay;
  capitalEfficiencyOverlay: CapitalEfficiencyOverlay;
  financialStructurePeerComparison: FinancialStructurePeerComparison | null;
}

export function buildFullFundamentalComparisonMatrix(
  input: BuildFullFundamentalComparisonMatrixInput,
): FullFundamentalComparisonMatrix {
  const growth = buildGrowthSection(input);
  const valuation = buildValuationSection(input);
  const financialStructure = buildFinancialStructureSection(input);
  const efficiency = buildEfficiencySection(input);
  const peerPosition = buildPeerPositionSection(input);

  const sections = {
    growth,
    valuation,
    financialStructure,
    efficiency,
    peerPosition,
  };

  const limitations = dedupe([
    ...growth.limitations,
    ...valuation.limitations,
    ...financialStructure.limitations,
    ...efficiency.limitations,
    ...peerPosition.limitations,
  ]).slice(0, 8);

  return {
    sections,
    overallSummary: buildOverallSummary(sections, input.fundamentals.kind === 'etf'),
    limitations,
  };
}

export function buildUnknownFundamentalComparisonMatrix(input?: {
  isETF?: boolean;
  limitation?: string;
}): FullFundamentalComparisonMatrix {
  const summary = input?.isETF
    ? 'ETF 暫不做公司營運式完整基本面矩陣判讀。'
    : '資料不足，暫不做完整基本面矩陣判讀。';
  const limitation = input?.limitation
    ?? (input?.isETF
      ? 'ETF 不適用公司營運式完整基本面矩陣判讀。'
      : '基本面矩陣資料不足，已降級為保守觀察。');

  const unknownSection = (title: string): FundamentalMatrixSection => ({
    title,
    status: 'unknown',
    summary,
    highlights: [],
    warnings: [],
    limitations: [limitation],
  });

  return {
    sections: {
      growth: unknownSection('成長'),
      valuation: unknownSection('估值'),
      financialStructure: unknownSection('財務體質'),
      efficiency: unknownSection('經營效率'),
      peerPosition: unknownSection('同組位置'),
    },
    overallSummary: summary,
    limitations: [limitation],
  };
}

export function fundamentalMatrixStatusLabel(status: FundamentalMatrixStatus): string {
  return fundamentalWordingStatusLabel(status);
}

function buildGrowthSection(
  input: BuildFullFundamentalComparisonMatrixInput,
): FundamentalMatrixSection {
  if (input.fundamentals.kind === 'etf') {
    return {
      title: '成長',
      status: 'unknown',
      summary: formatFundamentalSummary({
        section: 'growth',
        status: 'unknown',
        isETF: true,
      }),
      highlights: [],
      warnings: [],
      limitations: [formatFundamentalLimitation({ isETF: true, message: 'ETF 不適用公司成長 / 獲利品質矩陣判讀。' })],
    };
  }

  const growthStrengths = [
    ...(input.fundamentals.keySignals.filter((item) => item.includes('營收') || item.includes('EPS') || item.includes('毛利率') || item.includes('營益率'))),
    ...input.overlay.strengths.filter((item) => item.includes('成長') || item.includes('營收') || item.includes('毛利') || item.includes('EPS')),
    ...input.peerComparison?.strengths.filter((item) => item.includes('營收') || item.includes('EPS') || item.includes('毛利') || item.includes('營益率')) ?? [],
  ];
  const growthWarnings = [
    ...(input.fundamentals.keyRisks.filter((item) => item.includes('營收') || item.includes('EPS') || item.includes('毛利率') || item.includes('營益率'))),
    ...input.overlay.pressures.filter((item) => item.includes('成長') || item.includes('營收') || item.includes('毛利') || item.includes('EPS')),
    ...input.peerComparison?.cautions.filter((item) => item.includes('營收') || item.includes('EPS') || item.includes('毛利') || item.includes('營益率')) ?? [],
  ];

  const hasCoreGrowthData =
    input.fundamentals.revenue.yoyGrowth !== null || input.fundamentals.profitability.eps !== null;

  let status: FundamentalMatrixStatus = 'neutral';
  if (!hasCoreGrowthData) {
    status = 'unknown';
  } else if (
    (input.fundamentals.revenue.yoyGrowth ?? -999) < 0 ||
    (input.fundamentals.profitability.epsQoQDelta ?? 0) < 0 ||
    growthWarnings.length >= 2
  ) {
    status = 'pressure';
  } else if (
    (input.fundamentals.revenue.yoyGrowth ?? 0) >= 10 &&
    (input.fundamentals.profitability.epsQoQDelta ?? 0) >= 0 &&
    growthStrengths.length > growthWarnings.length
  ) {
    status = 'strong';
  }

  return {
    title: '成長',
    status,
    summary: formatFundamentalSummary({
      section: 'growth',
      status,
      detail: input.overlay.growthContext,
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    highlights: dedupe(growthStrengths.map((item) => formatFundamentalBullet(item))).slice(0, 3),
    warnings: dedupe(growthWarnings.map((item) => formatFundamentalBullet(item))).slice(0, 3),
    basis: input.peerComparison ? `${input.peerComparison.basis} · ${input.peerComparison.groupLabel}` : undefined,
    peerSampleSize: input.peerComparison?.peerCount ?? null,
    limitations: dedupe([
      ...input.fundamentals.limitations.filter((item) => item.includes('月營收') || item.includes('財報')),
      ...(input.peerComparison?.limitations ?? []),
    ]),
  };
}

function buildValuationSection(
  input: BuildFullFundamentalComparisonMatrixInput,
): FundamentalMatrixSection {
  const hasValuation = input.fundamentals.valuation.pe !== null || input.fundamentals.valuation.pb !== null;
  const valuationWarnings = dedupe([
    ...input.overlay.pressures.filter((item) => item.includes('估值') || item.includes('PE') || item.includes('PB')),
    ...input.peerComparison?.cautions.filter((item) => item.includes('PE') || item.includes('PB') || item.includes('殖利率')) ?? [],
  ]);
  const valuationHighlights = dedupe([
    ...input.overlay.strengths.filter((item) => item.includes('估值') || item.includes('殖利率')),
    ...input.peerComparison?.strengths.filter((item) => item.includes('PE') || item.includes('PB') || item.includes('殖利率')) ?? [],
  ]);

  let status: FundamentalMatrixStatus = 'neutral';
  if (!hasValuation) {
    status = 'unknown';
  } else if (valuationWarnings.length > 0 || input.overlay.riskLevel === 'elevated' || input.overlay.riskLevel === 'high') {
    status = 'pressure';
  } else if (valuationHighlights.length > 0 || input.overlay.riskLevel === 'low') {
    status = 'strong';
  }

  return {
    title: '估值',
    status,
    summary: formatFundamentalSummary({
      section: 'valuation',
      status,
      detail: input.overlay.valuationContext,
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    highlights: valuationHighlights.map((item) => formatFundamentalBullet(item)).slice(0, 3),
    warnings: valuationWarnings.map((item) => formatFundamentalBullet(item)).slice(0, 3),
    basis: input.peerComparison ? `${input.peerComparison.basis} · ${input.peerComparison.groupLabel}` : undefined,
    peerSampleSize: input.peerComparison?.peerCount ?? null,
    limitations: dedupe([
      ...input.fundamentals.limitations.filter((item) => item.includes('估值')),
      ...(input.peerComparison?.limitations ?? []),
    ]),
  };
}

function buildFinancialStructureSection(
  input: BuildFullFundamentalComparisonMatrixInput,
): FundamentalMatrixSection {
  return {
    title: '財務體質',
    status: mapOverlayRiskToSectionStatus(input.cashflowLeverageOverlay.riskLevel),
    summary: formatFundamentalSummary({
      section: 'financialStructure',
      status: mapOverlayRiskToSectionStatus(input.cashflowLeverageOverlay.riskLevel),
      detail: input.cashflowLeverageOverlay.summary,
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    highlights: input.cashflowLeverageOverlay.strengths.map((item) => formatFundamentalBullet(item)).slice(0, 3),
    warnings: input.cashflowLeverageOverlay.pressures.map((item) => formatFundamentalBullet(item)).slice(0, 3),
    basis: input.financialStructurePeerComparison && input.financialStructurePeerComparison.basis !== 'none' && input.financialStructurePeerComparison.groupLabel
      ? `${input.financialStructurePeerComparison.basis} · ${input.financialStructurePeerComparison.groupLabel}`
      : undefined,
    peerSampleSize: input.financialStructurePeerComparison?.peerSampleSize ?? null,
    limitations: dedupe([
      ...input.cashflowLeverageOverlay.limitations,
      ...(input.financialStructurePeerComparison?.limitations ?? []),
    ]),
  };
}

function buildEfficiencySection(
  input: BuildFullFundamentalComparisonMatrixInput,
): FundamentalMatrixSection {
  return {
    title: '經營效率',
    status: mapOverlayRiskToSectionStatus(input.capitalEfficiencyOverlay.riskLevel),
    summary: formatFundamentalSummary({
      section: 'efficiency',
      status: mapOverlayRiskToSectionStatus(input.capitalEfficiencyOverlay.riskLevel),
      detail: input.capitalEfficiencyOverlay.summary,
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    highlights: input.capitalEfficiencyOverlay.strengths.map((item) => formatFundamentalBullet(item)).slice(0, 3),
    warnings: input.capitalEfficiencyOverlay.pressures.map((item) => formatFundamentalBullet(item)).slice(0, 3),
    basis: input.financialStructurePeerComparison && input.financialStructurePeerComparison.basis !== 'none' && input.financialStructurePeerComparison.groupLabel
      ? `${input.financialStructurePeerComparison.basis} · ${input.financialStructurePeerComparison.groupLabel}`
      : undefined,
    peerSampleSize: input.financialStructurePeerComparison?.peerSampleSize ?? null,
    limitations: dedupe([
      ...input.capitalEfficiencyOverlay.limitations,
      ...(input.financialStructurePeerComparison?.limitations ?? []),
    ]),
  };
}

function buildPeerPositionSection(
  input: BuildFullFundamentalComparisonMatrixInput,
): FundamentalMatrixSection {
  const comparison = input.financialStructurePeerComparison;
  if (!comparison || comparison.basis === 'none') {
    return {
      title: '同組位置',
      status: 'unknown',
      summary: formatFundamentalSummary({
        section: 'peerPosition',
        status: 'unknown',
        fallback: '資料不足，暫不做完整基本面判讀。',
      }),
      highlights: [],
      warnings: [],
      basis: comparison && comparison.groupLabel ? comparison.groupLabel : undefined,
      peerSampleSize: comparison?.peerSampleSize ?? null,
      limitations: comparison?.limitations ?? ['缺少可靠 peer group，暫無法建立同組位置矩陣。'],
    };
  }

  const status: FundamentalMatrixStatus =
    comparison.dataCoverage === 'insufficient'
      ? 'unknown'
      : comparison.strengths.length > comparison.pressures.length
        ? 'strong'
        : comparison.pressures.length > comparison.strengths.length
          ? 'pressure'
          : 'neutral';

  return {
    title: '同組位置',
    status,
    summary: formatFundamentalSummary({
      section: 'peerPosition',
      status,
      detail: comparison.summary,
      fallback: '資料不足，暫不做完整基本面判讀。',
    }),
    highlights: comparison.strengths.map((item) => formatFundamentalBullet(item)).slice(0, 3),
    warnings: comparison.pressures.map((item) => formatFundamentalBullet(item)).slice(0, 3),
    basis: `${comparison.basis} · ${comparison.groupLabel}`,
    peerSampleSize: comparison.peerSampleSize,
    limitations: comparison.limitations,
  };
}

function buildOverallSummary(
  sections: FullFundamentalComparisonMatrix['sections'],
  isETF: boolean,
): string {
  if (isETF) {
    return formatFundamentalSummary({
      section: 'peerPosition',
      status: 'unknown',
      isETF: true,
    });
  }

  const statuses = Object.values(sections).map((section) => section.status);
  const strongCount = statuses.filter((status) => status === 'strong').length;
  const pressureCount = statuses.filter((status) => status === 'pressure').length;
  const unknownCount = statuses.filter((status) => status === 'unknown').length;

  if (unknownCount >= 3) {
    return formatFundamentalSummary({
      section: 'peerPosition',
      status: 'unknown',
      fallback: '資料不足，暫不做完整基本面判讀。',
    });
  }
  if (strongCount >= 3 && pressureCount === 0) {
    return formatFundamentalSummary({
      section: 'peerPosition',
      status: 'strong',
      detail: '基本面多數面向偏強，整體研究脈絡相對穩健。',
    });
  }
  if (pressureCount >= 3 && strongCount === 0) {
    return formatFundamentalSummary({
      section: 'peerPosition',
      status: 'pressure',
      detail: '基本面多數面向承壓，研究上宜保守解讀後續營運延續性。',
    });
  }
  if (strongCount > 0 && pressureCount > 0) {
    return formatFundamentalSummary({
      section: 'peerPosition',
      status: 'neutral',
      detail: '基本面優勢與壓力並存，建議搭配同組位置與後續財報持續追蹤。',
    });
  }
  return formatFundamentalSummary({
    section: 'peerPosition',
    status: 'neutral',
    detail: '基本面多數面向中性，尚無明確相對優勢。',
  });
}

function mapOverlayRiskToSectionStatus(
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'unknown',
): FundamentalMatrixStatus {
  switch (riskLevel) {
    case 'low':
      return 'strong';
    case 'moderate':
      return 'neutral';
    case 'elevated':
    case 'high':
      return 'pressure';
    case 'unknown':
    default:
      return 'unknown';
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
