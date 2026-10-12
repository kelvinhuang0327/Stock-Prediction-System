export type StockTabKey = 'analysis' | 'signals' | 'backtest' | 'research' | 'context';
export type StockTabQuery = 'overview' | 'signals' | 'backtest' | 'research' | 'context';

const TAB_QUERY_TO_KEY: Record<string, StockTabKey> = {
  overview: 'analysis',
  analysis: 'analysis',
  signals: 'signals',
  backtest: 'backtest',
  research: 'research',
  context: 'context',
};

const TAB_KEY_TO_QUERY: Record<StockTabKey, StockTabQuery> = {
  analysis: 'overview',
  signals: 'signals',
  backtest: 'backtest',
  research: 'research',
  context: 'context',
};

export function parseStockTabQuery(value: string | null | undefined): StockTabKey {
  if (!value) return 'analysis';
  return TAB_QUERY_TO_KEY[value] ?? 'analysis';
}

export function isValidStockTabQuery(value: string | null | undefined): boolean {
  if (!value) return false;
  return Object.prototype.hasOwnProperty.call(TAB_QUERY_TO_KEY, value);
}

export function stockTabToQuery(tab: StockTabKey): StockTabQuery {
  return TAB_KEY_TO_QUERY[tab];
}

export function buildStockTabHref(params: {
  basePath: string;
  tab: StockTabKey;
  anchor?: string;
}): string {
  const tabQuery = stockTabToQuery(params.tab);
  const hash = params.anchor ? `#${params.anchor}` : '';
  return `${params.basePath}?tab=${tabQuery}${hash}`;
}
