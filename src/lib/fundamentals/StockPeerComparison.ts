export type PeerComparisonBasis = 'industry' | 'sector';
export type PeerComparisonCoverage = 'full' | 'limited' | 'insufficient';

export interface PeerFundamentalRecord {
  symbol: string;
  name: string;
  revenueYoY: number | null;
  eps: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null;
}

export interface PeerMetricComparison {
  key:
    | 'revenueYoY'
    | 'eps'
    | 'grossMargin'
    | 'operatingMargin'
    | 'pe'
    | 'pb'
    | 'dividendYield';
  label: string;
  targetValue: number | null;
  peerMedian: number | null;
  percentile: number | null;
  interpretation: string;
}

export interface StockPeerComparison {
  basis: PeerComparisonBasis;
  groupLabel: string;
  peerCount: number;
  dataCoverage: PeerComparisonCoverage;
  summary: string;
  metrics: PeerMetricComparison[];
  strengths: string[];
  cautions: string[];
  limitations: string[];
}

export interface BuildStockPeerComparisonInput {
  target: PeerFundamentalRecord;
  peers: PeerFundamentalRecord[];
  basis: PeerComparisonBasis;
  groupLabel: string;
  baseLimitations?: string[];
}

const METRIC_CONFIG = [
  { key: 'revenueYoY', label: '營收 YoY', better: 'higher' as const },
  { key: 'eps', label: 'EPS', better: 'higher' as const },
  { key: 'grossMargin', label: '毛利率', better: 'higher' as const },
  { key: 'operatingMargin', label: '營益率', better: 'higher' as const },
  { key: 'pe', label: 'PE', better: 'lower' as const },
  { key: 'pb', label: 'PB', better: 'lower' as const },
  { key: 'dividendYield', label: '殖利率', better: 'higher' as const },
] as const;

export function buildStockPeerComparison(
  input: BuildStockPeerComparisonInput,
): StockPeerComparison {
  const baseLimitations = [...(input.baseLimitations ?? [])];

  if (input.peers.length === 0) {
    return {
      basis: input.basis,
      groupLabel: input.groupLabel,
      peerCount: 0,
      dataCoverage: 'insufficient',
      summary: '目前缺少足夠的同組樣本，無法建立可靠的相對比較。',
      metrics: [],
      strengths: [],
      cautions: [],
      limitations: [...baseLimitations, '同組樣本不足，暫時無法做相對位置判讀。'],
    };
  }

  const metrics = METRIC_CONFIG.map((config) => {
    const targetValue = input.target[config.key];
    const peerValues = input.peers
      .map((peer) => peer[config.key])
      .filter((value): value is number => value !== null);

    if (targetValue === null || peerValues.length < 3) {
      return {
        key: config.key,
        label: config.label,
        targetValue,
        peerMedian: peerValues.length > 0 ? median(peerValues) : null,
        percentile: null,
        interpretation: '資料不足，暫不比較。',
      };
    }

    const percentile = calculatePercentile(targetValue, peerValues, config.better);
    return {
      key: config.key,
      label: config.label,
      targetValue,
      peerMedian: median(peerValues),
      percentile,
      interpretation: interpretPercentile(percentile, config.better),
    };
  });

  const assessableMetrics = metrics.filter((metric) => metric.percentile !== null);
  const strengths = assessableMetrics
    .filter((metric) => (metric.percentile ?? 0) >= 70)
    .map((metric) => `${metric.label}相對同組偏強`);
  const cautions = assessableMetrics
    .filter((metric) => (metric.percentile ?? 100) <= 30)
    .map((metric) => `${metric.label}相對同組偏弱`);

  if (input.peers.length < 3) {
    baseLimitations.push('可比較的同組樣本少於 3 檔，結論可信度有限。');
  }
  if (assessableMetrics.length < 3) {
    baseLimitations.push('可比較指標不足，建議搭配絕對值與事件面交叉判讀。');
  }

  const dataCoverage: PeerComparisonCoverage =
    assessableMetrics.length >= 5 && input.peers.length >= 5
      ? 'full'
      : assessableMetrics.length >= 3
        ? 'limited'
        : 'insufficient';

  return {
    basis: input.basis,
    groupLabel: input.groupLabel,
    peerCount: input.peers.length,
    dataCoverage,
    summary: buildSummary({
      groupLabel: input.groupLabel,
      strengthCount: strengths.length,
      cautionCount: cautions.length,
      assessableCount: assessableMetrics.length,
    }),
    metrics,
    strengths: strengths.slice(0, 3),
    cautions: cautions.slice(0, 3),
    limitations: baseLimitations,
  };
}

function buildSummary(input: {
  groupLabel: string;
  strengthCount: number;
  cautionCount: number;
  assessableCount: number;
}): string {
  if (input.assessableCount < 3) {
    return `同組樣本仍不足，目前僅能對 ${input.groupLabel} 做有限的相對比較。`;
  }
  if (input.strengthCount >= 3 && input.cautionCount === 0) {
    return `相較 ${input.groupLabel} 同組樣本，基本面相對位置偏強。`;
  }
  if (input.cautionCount >= 3 && input.strengthCount === 0) {
    return `相較 ${input.groupLabel} 同組樣本，基本面相對位置偏弱。`;
  }
  if (input.strengthCount > 0 && input.cautionCount > 0) {
    return `相較 ${input.groupLabel} 同組樣本，基本面優勢與壓力並存。`;
  }
  return `相較 ${input.groupLabel} 同組樣本，基本面相對位置大致中性。`;
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

function interpretPercentile(
  percentile: number,
  better: 'higher' | 'lower',
): string {
  if (percentile >= 70) {
    return better === 'lower' ? '相對同組估值不高。' : '優於多數同組樣本。';
  }
  if (percentile <= 30) {
    return better === 'lower' ? '相對同組估值偏高。' : '落後多數同組樣本。';
  }
  return '接近同組中位水準。';
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
