import type { StockFundamentalSnapshot } from '@/lib/fundamentals/StockFundamentalSnapshot';
import type { StockPeerComparison, PeerMetricComparison } from '@/lib/fundamentals/StockPeerComparison';
import type { FinancialStructurePeerComparison } from './FinancialStructurePeerComparisonEngine';
import type { FullFundamentalComparisonMatrix } from './FullFundamentalComparisonMatrixBuilder';
import {
  formatFundamentalLimitation,
  formatPeerInterpretation,
} from './FundamentalWording';
import type {
  PeerPercentileDetailCategory,
  PeerPercentileDetailRow,
  PeerPercentileDetailTable,
} from './types';

export interface BuildPeerPercentileDetailTableInput {
  fundamentals: StockFundamentalSnapshot;
  peerComparison: StockPeerComparison | null;
  financialStructurePeerComparison: FinancialStructurePeerComparison | null;
  fundamentalMatrix?: FullFundamentalComparisonMatrix | null;
}

export function buildPeerPercentileDetailTable(
  input: BuildPeerPercentileDetailTableInput,
): PeerPercentileDetailTable {
  const stockMetricMap = new Map(
    (input.peerComparison?.metrics ?? []).map((metric) => [metric.key, metric] as const),
  );
  const structureMetrics = input.financialStructurePeerComparison?.metrics ?? {};
  const basis = input.financialStructurePeerComparison?.basis
    ?? input.peerComparison?.basis
    ?? 'none';
  const peerSampleSize = input.financialStructurePeerComparison?.peerSampleSize
    ?? input.peerComparison?.peerCount
    ?? null;

  const rows: PeerPercentileDetailRow[] = [
    buildStockRow({
      key: 'revenueYoY',
      label: '營收 YoY',
      category: 'growth',
      metric: stockMetricMap.get('revenueYoY') ?? null,
      value: input.fundamentals.revenue.yoyGrowth,
      displayUnit: 'percent',
      basis: input.peerComparison?.basis ?? basis,
      peerSampleSize: input.peerComparison?.peerCount ?? peerSampleSize,
    }),
    buildStockRow({
      key: 'eps',
      label: 'EPS',
      category: 'growth',
      metric: stockMetricMap.get('eps') ?? null,
      value: input.fundamentals.profitability.eps,
      displayUnit: 'currency',
      basis: input.peerComparison?.basis ?? basis,
      peerSampleSize: input.peerComparison?.peerCount ?? peerSampleSize,
    }),
    buildStockRow({
      key: 'grossMargin',
      label: '毛利率',
      category: 'growth',
      metric: stockMetricMap.get('grossMargin') ?? null,
      value: input.fundamentals.profitability.grossMargin,
      displayUnit: 'percent',
      basis: input.peerComparison?.basis ?? basis,
      peerSampleSize: input.peerComparison?.peerCount ?? peerSampleSize,
    }),
    buildStockRow({
      key: 'operatingMargin',
      label: '營益率',
      category: 'growth',
      metric: stockMetricMap.get('operatingMargin') ?? null,
      value: input.fundamentals.profitability.operatingMargin,
      displayUnit: 'percent',
      basis: input.peerComparison?.basis ?? basis,
      peerSampleSize: input.peerComparison?.peerCount ?? peerSampleSize,
    }),
    buildStockRow({
      key: 'pe',
      label: 'P/E',
      category: 'valuation',
      metric: stockMetricMap.get('pe') ?? null,
      value: input.fundamentals.valuation.pe,
      displayUnit: 'number',
      basis: input.peerComparison?.basis ?? basis,
      peerSampleSize: input.peerComparison?.peerCount ?? peerSampleSize,
    }),
    buildStockRow({
      key: 'pb',
      label: 'P/B',
      category: 'valuation',
      metric: stockMetricMap.get('pb') ?? null,
      value: input.fundamentals.valuation.pb,
      displayUnit: 'number',
      basis: input.peerComparison?.basis ?? basis,
      peerSampleSize: input.peerComparison?.peerCount ?? peerSampleSize,
    }),
    buildStructureRow('debtRatio', '負債比', 'financialStructure', structureMetrics.debtRatio, 'percent', basis, peerSampleSize),
    buildStructureRow('liabilitiesRatio', '負債佔資產比', 'financialStructure', structureMetrics.liabilitiesRatio, 'percent', basis, peerSampleSize),
    buildStructureRow('currentRatio', '流動比率', 'financialStructure', structureMetrics.currentRatio, 'ratio', basis, peerSampleSize),
    buildStructureRow('quickRatio', '速動比率', 'financialStructure', structureMetrics.quickRatio, 'ratio', basis, peerSampleSize),
    buildStructureRow('roe', 'ROE', 'efficiency', structureMetrics.roe, 'percent', basis, peerSampleSize),
    buildStructureRow('roa', 'ROA', 'efficiency', structureMetrics.roa, 'percent', basis, peerSampleSize),
    buildStructureRow('assetTurnover', '資產周轉率', 'efficiency', structureMetrics.assetTurnover, 'ratio', basis, peerSampleSize),
    buildStructureRow('cashflowConversion', '現金流轉換率', 'efficiency', structureMetrics.cashflowConversion, 'ratio', basis, peerSampleSize),
  ];

  const limitations = dedupe([
    ...(input.fundamentalMatrix?.limitations ?? []),
    ...(input.peerComparison?.limitations ?? []),
    ...(input.financialStructurePeerComparison?.limitations ?? []),
    ...(input.fundamentals.limitations ?? []),
  ]).slice(0, 8);

  return {
    rows,
    basis,
    peerSampleSize,
    limitations: limitations.length > 0
      ? limitations
      : ['資料不足，暫不做明確同組百分位判讀。'],
  };
}

export function buildUnknownPeerPercentileDetailTable(input?: {
  isETF?: boolean;
  limitation?: string;
}): PeerPercentileDetailTable {
  const limitation = input?.limitation
    ?? (input?.isETF
      ? 'ETF 不適用公司營運式同組百分位判讀。'
      : '同組百分位資料不足，已降級為保守觀察。');
  const summary = input?.isETF
    ? 'ETF 暫不做公司營運式同組百分位判讀。'
    : '資料不足，暫不做同組百分位判讀。';
  const rows: PeerPercentileDetailRow[] = [
    ...buildUnknownRows('growth', ['營收 YoY', 'EPS', '毛利率', '營益率'], input?.isETF),
    ...buildUnknownRows('valuation', ['P/E', 'P/B'], input?.isETF),
    ...buildUnknownRows('financialStructure', ['負債比', '負債佔資產比', '流動比率', '速動比率'], input?.isETF),
    ...buildUnknownRows('efficiency', ['ROE', 'ROA', '資產周轉率', '現金流轉換率'], input?.isETF),
  ];

  return {
    rows,
    basis: 'none',
    peerSampleSize: 0,
    limitations: [summary, limitation],
  };
}

function buildStockRow(input: {
  key: string;
  label: string;
  category: PeerPercentileDetailCategory;
  metric: PeerMetricComparison | null;
  value: number | null;
  displayUnit: NonNullable<PeerPercentileDetailRow['displayUnit']>;
  basis: 'industry' | 'sector' | 'none';
  peerSampleSize: number | null;
}): PeerPercentileDetailRow {
  return {
    key: input.key,
    label: input.label,
    category: input.category,
    value: input.value,
    median: input.metric?.peerMedian ?? null,
    percentile: input.metric?.percentile ?? null,
    interpretation: buildInterpretation(input.metric?.percentile ?? null),
    basis: input.basis,
    peerSampleSize: input.peerSampleSize,
    limitations: input.metric?.percentile === null
      ? [formatFundamentalLimitation({ message: '資料不足，暫不做同組比較。' })]
      : [],
    displayUnit: input.displayUnit,
  };
}

function buildStructureRow(
  key: string,
  label: string,
  category: PeerPercentileDetailCategory,
  metric: FinancialStructurePeerComparison['metrics'][keyof FinancialStructurePeerComparison['metrics']] | undefined,
  displayUnit: NonNullable<PeerPercentileDetailRow['displayUnit']>,
  basis: 'industry' | 'sector' | 'none',
  peerSampleSize: number | null,
): PeerPercentileDetailRow {
  return {
    key,
    label,
    category,
    value: metric?.value ?? null,
    median: metric?.median ?? null,
    percentile: metric?.percentile ?? null,
    interpretation: buildInterpretation(metric?.percentile ?? null),
    basis,
    peerSampleSize,
    limitations: metric?.percentile === null
      ? [formatFundamentalLimitation({ message: '資料不足，暫不做同組比較。' })]
      : [],
    displayUnit,
  };
}

function buildUnknownRows(
  category: PeerPercentileDetailCategory,
  labels: string[],
  isETF?: boolean,
): PeerPercentileDetailRow[] {
  return labels.map((label) => ({
    key: `${category}:${label}`,
    label,
    category,
    value: null,
    median: null,
    percentile: null,
    interpretation: isETF
      ? 'ETF 不適用公司營運式同組比較。'
      : '資料不足，暫不做同組比較。',
    basis: 'none',
    peerSampleSize: 0,
    limitations: [
      isETF
        ? 'ETF 不適用公司營運式同組百分位判讀。'
        : '同組百分位資料不足，已降級為保守觀察。',
    ],
  }));
}

function buildInterpretation(percentile: number | null): string {
  return formatPeerInterpretation({ percentile });
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
