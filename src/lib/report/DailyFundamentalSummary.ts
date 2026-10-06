import {
  buildStockFundamentalSnapshot,
  type FinancialReportLike,
  type MonthlyRevenueLike,
  type StockFundamentalSnapshot,
  type StockMetricsLike,
} from '@/lib/fundamentals/StockFundamentalSnapshot';

export interface DailyFundamentalCandidateInput {
  symbol: string;
  name: string;
}

export interface DailyFundamentalItem {
  symbol: string;
  name: string;
  dataCoverage: StockFundamentalSnapshot['dataCoverage'];
  summary: string;
  keySignals: string[];
  keyRisks: string[];
  revenueYoY: number | null;
  eps: number | null;
  pe: number | null;
  pb: number | null;
}

export interface DailyFundamentalSummary {
  items: DailyFundamentalItem[];
  highlights: string[];
  risks: string[];
  summary: string;
  dataCoverage: 'full' | 'limited' | 'insufficient';
  limitations: string[];
}

export interface BuildDailyFundamentalSummaryInput {
  candidates: DailyFundamentalCandidateInput[];
  monthlyRevenuesByStock: Record<string, MonthlyRevenueLike[]>;
  financialReportsByStock: Record<string, FinancialReportLike[]>;
  stockMetricsByStock: Record<string, StockMetricsLike[]>;
  maxItems?: number;
}

export function buildDailyFundamentalSummary(
  input: BuildDailyFundamentalSummaryInput,
): DailyFundamentalSummary {
  const candidates = input.candidates.slice(0, input.maxItems ?? 6);

  if (candidates.length === 0) {
    return {
      items: [],
      highlights: [],
      risks: [],
      summary: '今日候選股不足，暫無可整理的基本面重點。',
      dataCoverage: 'insufficient',
      limitations: ['今日無 strong/watch 候選股可供整理基本面摘要。'],
    };
  }

  const items = candidates.map((candidate) => {
    const snapshot = buildStockFundamentalSnapshot({
      isETF: isEtfSymbol(candidate.symbol),
      monthlyRevenues: input.monthlyRevenuesByStock[candidate.symbol] ?? [],
      financialReports: input.financialReportsByStock[candidate.symbol] ?? [],
      stockMetrics: input.stockMetricsByStock[candidate.symbol] ?? [],
    });

    return {
      symbol: candidate.symbol,
      name: candidate.name,
      dataCoverage: snapshot.dataCoverage,
      summary: snapshot.summary,
      keySignals: snapshot.keySignals.slice(0, 3),
      keyRisks: snapshot.keyRisks.slice(0, 3),
      revenueYoY: snapshot.revenue.yoyGrowth,
      eps: snapshot.profitability.eps,
      pe: snapshot.valuation.pe,
      pb: snapshot.valuation.pb,
      snapshot,
    };
  });

  const highlights = uniqueFlatMap(items, (item) => item.keySignals).slice(0, 4);
  const risks = uniqueFlatMap(items, (item) => item.keyRisks).slice(0, 4);

  const insufficientCount = items.filter((item) => item.dataCoverage === 'insufficient').length;
  const fullCount = items.filter((item) => item.dataCoverage === 'full').length;

  const limitations: string[] = [];
  if (insufficientCount > 0) {
    limitations.push(`${insufficientCount} 檔候選股基本面資料不足，相關結論需保守解讀。`);
  }
  if (items.some((item) => item.snapshot.kind === 'etf')) {
    limitations.push('ETF 候選不適用公司營運式基本面解讀，應以估值、收益與市場結構輔助判讀。');
  }
  if (highlights.length === 0) {
    limitations.push('目前缺少足夠的正向基本面支撐，建議搭配技術面與事件面交叉確認。');
  }

  const dataCoverage: DailyFundamentalSummary['dataCoverage'] =
    fullCount === items.length
      ? 'full'
      : fullCount > 0 || items.some((item) => item.dataCoverage === 'limited')
        ? 'limited'
        : 'insufficient';

  return {
    items: items.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      dataCoverage: item.dataCoverage,
      summary: item.summary,
      keySignals: item.keySignals,
      keyRisks: item.keyRisks,
      revenueYoY: item.revenueYoY,
      eps: item.eps,
      pe: item.pe,
      pb: item.pb,
    })),
    highlights,
    risks,
    summary: buildSummary({
      candidateCount: items.length,
      highlightCount: highlights.length,
      riskCount: risks.length,
      dataCoverage,
    }),
    dataCoverage,
    limitations,
  };
}

function buildSummary(input: {
  candidateCount: number;
  highlightCount: number;
  riskCount: number;
  dataCoverage: DailyFundamentalSummary['dataCoverage'];
}): string {
  if (input.dataCoverage === 'insufficient') {
    return `已整理 ${input.candidateCount} 檔候選股，但基本面資料仍偏不足，僅能提供局部觀察。`;
  }
  if (input.highlightCount >= 3 && input.riskCount <= 1) {
    return `候選股基本面整體偏正向，已整理 ${input.candidateCount} 檔值得持續追蹤的營運亮點。`;
  }
  if (input.riskCount >= 3 && input.highlightCount === 0) {
    return `候選股基本面風險訊號偏多，需避免只因技術或題材偏強就忽略體質變化。`;
  }
  if (input.highlightCount > 0 && input.riskCount > 0) {
    return `候選股基本面呈現分歧，適合把營收、獲利與估值風險一起納入日報觀察。`;
  }
  return `已整理 ${input.candidateCount} 檔候選股的基本面概況，可作為今日研究的補充視角。`;
}

function uniqueFlatMap<T>(items: T[], selector: (item: T) => string[]): string[] {
  return [...new Set(items.flatMap(selector).filter(Boolean))];
}

function isEtfSymbol(symbol: string): boolean {
  return symbol.length >= 4 && (symbol.startsWith('00') || symbol.startsWith('01'));
}
