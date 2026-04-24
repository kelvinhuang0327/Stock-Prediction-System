export type FundamentalWordingStatus = 'strong' | 'neutral' | 'pressure' | 'unknown';
export type FundamentalWordingSection =
  | 'growth'
  | 'valuation'
  | 'financialStructure'
  | 'efficiency'
  | 'peerPosition';

const SECTION_LEADS: Record<FundamentalWordingSection, string> = {
  growth: '同組成長表現',
  valuation: '估值水準',
  financialStructure: '財務結構',
  efficiency: '經營效率',
  peerPosition: '同組相對位置',
};

const STATUS_LABELS: Record<FundamentalWordingStatus, string> = {
  strong: '偏強',
  neutral: '中性',
  pressure: '承壓',
  unknown: '資料不足',
};

export function fundamentalWordingStatusLabel(status: FundamentalWordingStatus): string {
  return STATUS_LABELS[status] ?? STATUS_LABELS.unknown;
}

export function fundamentalWordingSectionLabel(section: FundamentalWordingSection): string {
  return SECTION_LEADS[section];
}

export function formatFundamentalSummary(input: {
  section: FundamentalWordingSection;
  status: FundamentalWordingStatus;
  detail?: string | null;
  isETF?: boolean;
  fallback?: string;
}): string {
  if (input.isETF) {
    return etfSummary(input.section);
  }

  if (input.status === 'unknown') {
    return input.fallback ?? '資料不足，暫不做完整基本面判讀。';
  }

  const detail = normalizeSentence(input.detail);
  if (!detail) {
    return `${SECTION_LEADS[input.section]}${STATUS_LABELS[input.status]}。`;
  }

  if (startsWithAny(detail, [SECTION_LEADS[input.section], STATUS_LABELS[input.status], '資料不足'])) {
    return detail;
  }

  return `${SECTION_LEADS[input.section]}${STATUS_LABELS[input.status]}，${detail}`;
}

export function formatPeerInterpretation(input: {
  percentile: number | null;
  isETF?: boolean;
}): string {
  if (input.isETF) {
    return 'ETF 不適用公司營運式同組比較。';
  }
  if (input.percentile === null || Number.isNaN(input.percentile)) {
    return '資料不足，暫不做同組比較。';
  }
  if (input.percentile > 80) return '同組相對偏強';
  if (input.percentile < 40) return '同組偏弱';
  return '同組中性';
}

export function formatFundamentalLimitation(input: {
  isETF?: boolean;
  hasSample?: boolean;
  message?: string;
}): string {
  if (input.message) return normalizeSentence(input.message);
  if (input.isETF) return 'ETF 不適用公司營運式基本面分析。';
  if (input.hasSample === false) return '同組樣本不足，相關比較需保守解讀。';
  return '資料不足，暫不做完整基本面判讀。';
}

export function formatFundamentalBullet(text: string): string {
  return normalizeSentence(text);
}

export function formatFundamentalSummaryHeader(input: {
  section: FundamentalWordingSection;
  status: FundamentalWordingStatus;
  detail?: string | null;
  isETF?: boolean;
  fallback?: string;
}): string {
  return formatFundamentalSummary(input);
}

function etfSummary(section: FundamentalWordingSection): string {
  switch (section) {
    case 'growth':
      return 'ETF 不適用公司營運式成長分析。';
    case 'valuation':
      return 'ETF 不適用公司營運式估值分析。';
    case 'financialStructure':
      return 'ETF 不適用公司營運式財務結構分析。';
    case 'efficiency':
      return 'ETF 不適用公司營運式效率分析。';
    case 'peerPosition':
    default:
      return 'ETF 不適用公司營運式同組相對位置判讀。';
  }
}

function normalizeSentence(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[。\.]+$/u, '')
    .trim();
}

function startsWithAny(text: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => text.startsWith(prefix));
}
