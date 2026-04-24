import { formatFundamentalSummary, formatPeerInterpretation } from './FundamentalWording';

export type FinancialStructurePeerComparisonBasis = 'industry' | 'sector' | 'none';
export type FinancialStructurePeerComparisonCoverage = 'full' | 'limited' | 'insufficient';

export interface FinancialStructurePeerRecord {
  symbol: string;
  name: string;
  debtRatio: number | null;
  liabilitiesRatio: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  roe: number | null;
  roa: number | null;
  assetTurnover: number | null;
  cashflowConversion: number | null;
}

export interface FinancialStructurePeerMetricComparison {
  value: number | null;
  median: number | null;
  percentile: number | null;
  interpretation: string;
}

export interface FinancialStructurePeerComparison {
  basis: FinancialStructurePeerComparisonBasis;
  groupLabel: string | null;
  peerSampleSize: number;
  dataCoverage: FinancialStructurePeerComparisonCoverage;
  metrics: {
    debtRatio?: FinancialStructurePeerMetricComparison;
    liabilitiesRatio?: FinancialStructurePeerMetricComparison;
    currentRatio?: FinancialStructurePeerMetricComparison;
    quickRatio?: FinancialStructurePeerMetricComparison;
    roe?: FinancialStructurePeerMetricComparison;
    roa?: FinancialStructurePeerMetricComparison;
    assetTurnover?: FinancialStructurePeerMetricComparison;
    cashflowConversion?: FinancialStructurePeerMetricComparison;
  };
  strengths: string[];
  pressures: string[];
  summary: string;
  limitations: string[];
}

export interface BuildFinancialStructurePeerComparisonInput {
  target: FinancialStructurePeerRecord;
  peers: FinancialStructurePeerRecord[];
  basis: Extract<FinancialStructurePeerComparisonBasis, 'industry' | 'sector'>;
  groupLabel: string;
  isETF?: boolean;
  baseLimitations?: string[];
}

type MetricKey =
  | 'debtRatio'
  | 'liabilitiesRatio'
  | 'currentRatio'
  | 'quickRatio'
  | 'roe'
  | 'roa'
  | 'assetTurnover'
  | 'cashflowConversion';

const METRIC_CONFIG: Array<{
  key: MetricKey;
  label: string;
  better: 'higher' | 'lower';
}> = [
  { key: 'debtRatio', label: '負債比', better: 'lower' },
  { key: 'liabilitiesRatio', label: '負債佔資產比', better: 'lower' },
  { key: 'currentRatio', label: '流動比率', better: 'higher' },
  { key: 'quickRatio', label: '速動比率', better: 'higher' },
  { key: 'roe', label: 'ROE', better: 'higher' },
  { key: 'roa', label: 'ROA', better: 'higher' },
  { key: 'assetTurnover', label: '資產周轉率', better: 'higher' },
  { key: 'cashflowConversion', label: '現金流轉換率', better: 'higher' },
];

export function buildFinancialStructurePeerComparison(
  input: BuildFinancialStructurePeerComparisonInput,
): FinancialStructurePeerComparison {
  const baseLimitations = [...(input.baseLimitations ?? [])];

  if (input.isETF) {
    return {
      basis: 'none',
      groupLabel: null,
      peerSampleSize: 0,
      dataCoverage: 'insufficient',
      metrics: {},
      strengths: [],
      pressures: [],
      summary: 'ETF 暫不做公司財務結構與效率的同組比較。',
      limitations: [...baseLimitations, 'ETF 不適用公司財務結構 / 經營效率的同組相對位置判讀。'],
    };
  }

  if (input.peers.length === 0) {
    return {
      basis: input.basis,
      groupLabel: input.groupLabel,
      peerSampleSize: 0,
      dataCoverage: 'insufficient',
      metrics: {},
      strengths: [],
      pressures: [],
      summary: '財務結構同組資料不足，暫不做明確比較。',
      limitations: [...baseLimitations, '同組樣本不足，暫時無法建立可靠的財務結構 / 效率相對位置。'],
    };
  }

  const metrics = Object.fromEntries(
    METRIC_CONFIG.map((config) => {
      const targetValue = input.target[config.key];
      const peerValues = input.peers
        .map((peer) => peer[config.key])
        .filter((value): value is number => value !== null && Number.isFinite(value));

      if (targetValue === null || !Number.isFinite(targetValue) || peerValues.length < 3) {
        return [
          config.key,
          {
            value: targetValue,
            median: peerValues.length > 0 ? median(peerValues) : null,
            percentile: null,
            interpretation: '資料不足，暫不比較。',
          } satisfies FinancialStructurePeerMetricComparison,
        ];
      }

      const percentile = calculatePercentile(targetValue, peerValues, config.better);
      return [
        config.key,
        {
          value: round2(targetValue),
          median: median(peerValues),
          percentile,
          interpretation: interpretMetric(config.key, percentile),
        } satisfies FinancialStructurePeerMetricComparison,
      ];
    }),
  ) as FinancialStructurePeerComparison['metrics'];

  const assessableMetrics = Object.entries(metrics).filter(
    (entry): entry is [MetricKey, FinancialStructurePeerMetricComparison] =>
      !!entry[1] && entry[1].percentile !== null,
  );

  const strengths = buildStrengths(metrics);
  const pressures = buildPressures(metrics);

  if (input.peers.length < 3) {
    baseLimitations.push('可比較的同組樣本少於 3 檔，財務結構結論可信度有限。');
  }
  if (assessableMetrics.length < 3) {
    baseLimitations.push('可比較財務結構 / 效率指標不足，建議搭配絕對值與近期事件交叉判讀。');
  }

  const dataCoverage: FinancialStructurePeerComparisonCoverage =
    assessableMetrics.length >= 6 && input.peers.length >= 5
      ? 'full'
      : assessableMetrics.length >= 3
        ? 'limited'
        : 'insufficient';

  return {
    basis: input.basis,
    groupLabel: input.groupLabel,
    peerSampleSize: input.peers.length,
    dataCoverage,
    metrics,
    strengths: dedupe(strengths).slice(0, 4),
    pressures: dedupe(pressures).slice(0, 4),
    summary: buildSummary({
      groupLabel: input.groupLabel,
      assessableCount: assessableMetrics.length,
      strengths,
      pressures,
    }),
    limitations: dedupe(baseLimitations),
  };
}

function buildStrengths(
  metrics: FinancialStructurePeerComparison['metrics'],
): string[] {
  const strengths: string[] = [];

  pushByPercentile(metrics.debtRatio, '負債比相對同組偏低', strengths, 'strength');
  pushByPercentile(metrics.liabilitiesRatio, '負債結構相對同組偏低', strengths, 'strength');
  pushByPercentile(metrics.currentRatio, '流動性指標相對同組偏強', strengths, 'strength');
  pushByPercentile(metrics.quickRatio, '速動性支撐相對同組偏強', strengths, 'strength');
  pushByPercentile(metrics.roe, 'ROE 相對同組偏強', strengths, 'strength');
  pushByPercentile(metrics.roa, 'ROA 相對同組偏強', strengths, 'strength');
  pushByPercentile(metrics.assetTurnover, '資產周轉效率相對同組偏強', strengths, 'strength');
  pushByPercentile(metrics.cashflowConversion, '現金流轉換率相對同組偏強', strengths, 'strength');

  if (isStrong(metrics.debtRatio) && isStrong(metrics.liabilitiesRatio) && isStrong(metrics.currentRatio)) {
    strengths.unshift('同組槓桿與流動性結構相對穩健');
  }
  if (isStrong(metrics.roe) && isStrong(metrics.roa) && isStrong(metrics.cashflowConversion)) {
    strengths.unshift('同組資本報酬與轉現品質具一定支撐');
  }

  return strengths;
}

function buildPressures(
  metrics: FinancialStructurePeerComparison['metrics'],
): string[] {
  const pressures: string[] = [];

  pushByPercentile(metrics.debtRatio, '同組槓桿壓力偏高，財務結構需保守觀察', pressures, 'pressure');
  pushByPercentile(metrics.liabilitiesRatio, '同組負債結構偏重，財務彈性需保守觀察', pressures, 'pressure');
  pushByPercentile(metrics.currentRatio, '流動性指標相對同組中性偏弱', pressures, 'pressure');
  pushByPercentile(metrics.quickRatio, '速動性相對同組偏弱', pressures, 'pressure');
  pushByPercentile(metrics.assetTurnover, '資產周轉效率相對同組偏弱', pressures, 'pressure');
  pushByPercentile(metrics.cashflowConversion, '現金流轉換率相對同組偏弱', pressures, 'pressure');

  if (isStrong(metrics.roe) && isWeak(metrics.roa)) {
    pressures.push('資本報酬不差，但部分表現可能受槓桿放大');
  }
  if ((isWeak(metrics.currentRatio) || isWeak(metrics.quickRatio)) && !pressures.includes('流動性指標相對同組中性偏弱')) {
    pressures.push('流動性指標相對同組中性偏弱');
  }

  return pressures;
}

function buildSummary(input: {
  groupLabel: string;
  assessableCount: number;
  strengths: string[];
  pressures: string[];
}): string {
  if (input.assessableCount < 3) {
    return formatFundamentalSummary({
      section: 'financialStructure',
      status: 'unknown',
      detail: '同組資料不足，暫不做明確比較。',
      fallback: '資料不足，暫不做完整基本面判讀。',
    });
  }
  if (input.strengths.length >= 3 && input.pressures.length === 0) {
    return formatFundamentalSummary({
      section: 'financialStructure',
      status: 'strong',
      detail: `相較 ${input.groupLabel} 同組樣本，財務體質與經營效率相對位置偏強。`,
    });
  }
  if (input.pressures.length >= 3 && input.strengths.length === 0) {
    return formatFundamentalSummary({
      section: 'financialStructure',
      status: 'pressure',
      detail: `相較 ${input.groupLabel} 同組樣本，財務結構與效率壓力偏高。`,
    });
  }
  if (input.strengths.length > 0 && input.pressures.length > 0) {
    return formatFundamentalSummary({
      section: 'financialStructure',
      status: 'neutral',
      detail: `相較 ${input.groupLabel} 同組樣本，財務結構與效率優勢與壓力並存。`,
    });
  }
  return formatFundamentalSummary({
    section: 'financialStructure',
    status: 'neutral',
    detail: `相較 ${input.groupLabel} 同組樣本，財務結構與效率相對位置大致中性。`,
  });
}

function pushByPercentile(
  metric: FinancialStructurePeerMetricComparison | undefined,
  message: string,
  bucket: string[],
  mode: 'strength' | 'pressure',
) {
  if (!metric || metric.percentile === null) return;
  if (mode === 'strength' && metric.percentile > 80) {
    bucket.push(message);
  }
  if (mode === 'pressure' && metric.percentile < 40) {
    bucket.push(message);
  }
}

function isStrong(metric: FinancialStructurePeerMetricComparison | undefined): boolean {
  return (metric?.percentile ?? 0) > 80;
}

function isWeak(metric: FinancialStructurePeerMetricComparison | undefined): boolean {
  return (metric?.percentile ?? 100) < 40;
}

function calculatePercentile(
  targetValue: number,
  peerValues: number[],
  better: 'higher' | 'lower',
): number {
  const wins = peerValues.filter((value) =>
    better === 'higher' ? targetValue >= value : targetValue <= value,
  ).length;
  return Math.round((wins / peerValues.length) * 100);
}

function interpretMetric(key: MetricKey, percentile: number): string {
  const base = formatPeerInterpretation({ percentile });
  if (percentile > 80) {
    switch (key) {
      case 'debtRatio':
      case 'liabilitiesRatio':
        return '相對同組槓桿壓力不高。';
      case 'currentRatio':
      case 'quickRatio':
        return '相對同組流動性支撐較佳。';
      case 'cashflowConversion':
        return '相對同組轉現品質較佳。';
      default:
        return base;
    }
  }
  if (percentile < 40) {
    switch (key) {
      case 'debtRatio':
      case 'liabilitiesRatio':
        return '相對同組槓桿壓力偏高。';
      case 'currentRatio':
      case 'quickRatio':
        return '相對同組流動性偏弱。';
      case 'cashflowConversion':
        return '相對同組轉現品質偏弱。';
      default:
        return '同組偏弱';
    }
  }
  return '同組中性';
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return round2(sorted[mid]);
  return round2((sorted[mid - 1] + sorted[mid]) / 2);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
