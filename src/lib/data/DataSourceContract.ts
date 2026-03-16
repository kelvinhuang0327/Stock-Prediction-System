/**
 * DataSourceContract - 資料來源合約定義
 * 
 * 每個資料來源必須實作此 interface，明確聲明：
 * - 來源與取得方式
 * - 資料品質等級
 * - 可用性狀態
 * - 缺失時的降級策略
 */

export type DataGrade = 'A' | 'B' | 'C' | 'D';
export type DataAvailability = 'available' | 'partial' | 'empty' | 'unavailable';

export interface DataSourceContract {
  /** 資料來源唯一識別 */
  id: string;
  /** 對應的 Prisma model / DB table */
  table: string;
  /** 資料說明 */
  description: string;

  // === Source ===
  source: string;
  frequency: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'manual' | 'none';
  syncScript?: string;

  // === Quality ===
  grade: DataGrade;
  availability: DataAvailability;
  currentRowCount: number;
  stockCoverage: number;
  dateRange: { start: string; end: string } | null;

  // === Capability ===
  backtestReady: boolean;
  realtimeReady: boolean;

  // === Null Policy ===
  nullRates: Record<string, number>;
  nullPolicy: 'reject' | 'default_zero' | 'interpolate' | 'hide_field' | 'show_unavailable';

  // === Fallback ===
  fallbackStrategy: string;
  hasMockFallback: boolean;
}

// ─── Grade A: 已穩定可用 ───

const STOCK_MASTER: DataSourceContract = {
  id: 'stock_master',
  table: 'Stock',
  description: '股票基本資料 (代號/名稱/產業/上市日)',
  source: 'TWSE OpenAPI /opendata/t187ap03_L',
  frequency: 'daily',
  syncScript: 'src/lib/services/syncService.ts',
  grade: 'A',
  availability: 'available',
  currentRowCount: 1340,
  stockCoverage: 1340,
  dateRange: null,
  backtestReady: true,
  realtimeReady: true,
  nullRates: { industry: 0.19, listingDate: 0.19, capital: 0.19 },
  nullPolicy: 'show_unavailable',
  fallbackStrategy: '顯示代號與名稱，產業欄位標示「未分類」',
  hasMockFallback: false,
};

const MONTHLY_REVENUE: DataSourceContract = {
  id: 'monthly_revenue',
  table: 'MonthlyRevenue',
  description: '月營收 (營收額/年增率/月增率)',
  source: 'TWSE OpenAPI /opendata/t187ap05_L',
  frequency: 'monthly',
  syncScript: 'src/lib/services/syncService.ts',
  grade: 'A',
  availability: 'available',
  currentRowCount: 2137,
  stockCoverage: 1067,
  dateRange: { start: '2025-01', end: '2025-12' },
  backtestReady: false,
  realtimeReady: false,
  nullRates: { yoyGrowth: 0.003 },
  nullPolicy: 'show_unavailable',
  fallbackStrategy: '無營收資料時隱藏營收欄位',
  hasMockFallback: false,
};

// ─── Grade B: 可用但需清洗/擴充 ───

const STOCK_QUOTE: DataSourceContract = {
  id: 'stock_quote',
  table: 'StockQuote',
  description: '日 K 線 (OHLCV/成交值/漲跌/筆數)',
  source: 'TWSE OpenAPI + twstock Python',
  frequency: 'daily',
  syncScript: 'src/lib/services/syncService.ts',
  grade: 'B',
  availability: 'partial',
  currentRowCount: 4480,
  stockCoverage: 24,
  dateRange: { start: '2025-01-27', end: '2026-02-10' },
  backtestReady: false,
  realtimeReady: false,
  nullRates: {},
  nullPolicy: 'reject',
  fallbackStrategy: '資料不足時顯示「歷史資料不足，請先同步」',
  hasMockFallback: false,
};

const INSTITUTIONAL_CHIP: DataSourceContract = {
  id: 'institutional_chip',
  table: 'InstitutionalChip',
  description: '三大法人買賣超',
  source: 'TWSE /rwd/zh/fund/T86',
  frequency: 'daily',
  syncScript: 'scripts/ai_agents/sync_institutional.py',
  grade: 'B',
  availability: 'partial',
  currentRowCount: 135,
  stockCoverage: 9,
  dateRange: { start: '2026-01-21', end: '2026-02-10' },
  backtestReady: false,
  realtimeReady: false,
  nullRates: { holders400: 1.0, holders1000: 1.0 },
  nullPolicy: 'hide_field',
  fallbackStrategy: '無籌碼資料時隱藏法人欄位',
  hasMockFallback: false,
};

const STOCK_METRICS: DataSourceContract = {
  id: 'stock_metrics',
  table: 'StockMetrics',
  description: '本益比/淨值比/殖利率',
  source: 'TWSE OpenAPI /exchangeReport/BWIBBU_ALL',
  frequency: 'daily',
  syncScript: 'src/lib/services/syncService.ts',
  grade: 'B',
  availability: 'partial',
  currentRowCount: 5318,
  stockCoverage: 1067,
  dateRange: { start: '2026-01-15', end: '2026-01-29' },
  backtestReady: false,
  realtimeReady: false,
  nullRates: { pe: 0.23, dividendYield: 0.19 },
  nullPolicy: 'show_unavailable',
  fallbackStrategy: '無估值資料時顯示「—」',
  hasMockFallback: false,
};

const MARKET_INDEX: DataSourceContract = {
  id: 'market_index',
  table: 'MarketIndex',
  description: '大盤與類股指數',
  source: 'TWSE OpenAPI /exchangeReport/MI_INDEX',
  frequency: 'daily',
  syncScript: 'src/lib/services/syncService.ts',
  grade: 'B',
  availability: 'partial',
  currentRowCount: 538,
  stockCoverage: 0,
  dateRange: { start: '2026-01-15', end: '2026-01-29' },
  backtestReady: false,
  realtimeReady: false,
  nullRates: {},
  nullPolicy: 'show_unavailable',
  fallbackStrategy: '無指數資料時隱藏 regime 判斷',
  hasMockFallback: false,
};

// ─── Grade C: 品質不穩 ───

const FINANCIAL_REPORT: DataSourceContract = {
  id: 'financial_report',
  table: 'FinancialReport',
  description: '季度財報 (EPS/淨利/毛利率)',
  source: 'TWSE (手動)',
  frequency: 'quarterly',
  grade: 'C',
  availability: 'partial',
  currentRowCount: 14,
  stockCoverage: 7,
  dateRange: { start: '2025-Q2', end: '2025-Q3' },
  backtestReady: false,
  realtimeReady: false,
  nullRates: { grossMargin: 1.0, operatingMargin: 1.0 },
  nullPolicy: 'hide_field',
  fallbackStrategy: '無財報時隱藏 EPS 欄位',
  hasMockFallback: false,
};

const REALTIME_QUOTE: DataSourceContract = {
  id: 'realtime_quote',
  table: '(in-memory)',
  description: '即時報價 (盤中價/五檔)',
  source: 'TWSE MIS API',
  frequency: 'realtime',
  syncScript: 'src/lib/services/RealTimeService.ts',
  grade: 'C',
  availability: 'available',
  currentRowCount: 0,
  stockCoverage: 0,
  dateRange: null,
  backtestReady: false,
  realtimeReady: true,
  nullRates: {},
  nullPolicy: 'show_unavailable',
  fallbackStrategy: '顯示最近收盤價並標示「非即時」',
  hasMockFallback: false,
};

// ─── Grade D: 尚未取得 ───

const NEWS_EVENT: DataSourceContract = {
  id: 'news_event',
  table: 'NewsEvent',
  description: '新聞事件與情緒分析',
  source: 'Cnyes API',
  frequency: 'none',
  grade: 'D',
  availability: 'empty',
  currentRowCount: 0,
  stockCoverage: 0,
  dateRange: null,
  backtestReady: false,
  realtimeReady: false,
  nullRates: {},
  nullPolicy: 'show_unavailable',
  fallbackStrategy: '隱藏新聞區塊',
  hasMockFallback: false,
};

const PREDICTION: DataSourceContract = {
  id: 'prediction',
  table: 'Prediction',
  description: '預測記錄',
  source: 'internal (PredictionEngine)',
  frequency: 'none',
  grade: 'D',
  availability: 'empty',
  currentRowCount: 0,
  stockCoverage: 0,
  dateRange: null,
  backtestReady: false,
  realtimeReady: false,
  nullRates: {},
  nullPolicy: 'show_unavailable',
  fallbackStrategy: '顯示「尚無預測資料」',
  hasMockFallback: false,
};

const DOUBLING_FEATURES: DataSourceContract = {
  id: 'doubling_features',
  table: 'DoublingFeatures',
  description: '歷史翻倍股特徵',
  source: 'HistoricalDoublingScanner.py',
  frequency: 'none',
  grade: 'D',
  availability: 'empty',
  currentRowCount: 0,
  stockCoverage: 0,
  dateRange: null,
  backtestReady: false,
  realtimeReady: false,
  nullRates: {},
  nullPolicy: 'show_unavailable',
  fallbackStrategy: '隱藏歷史案例區塊',
  hasMockFallback: false,
};

const STRATEGY_SIGNAL: DataSourceContract = {
  id: 'strategy_signal',
  table: 'StrategySignal',
  description: '策略選股訊號',
  source: 'internal',
  frequency: 'none',
  grade: 'D',
  availability: 'empty',
  currentRowCount: 0,
  stockCoverage: 0,
  dateRange: null,
  backtestReady: false,
  realtimeReady: false,
  nullRates: {},
  nullPolicy: 'show_unavailable',
  fallbackStrategy: '顯示「尚未產生訊號」',
  hasMockFallback: false,
};

// ─── Export All ───

export const DATA_SOURCES: DataSourceContract[] = [
  STOCK_MASTER, MONTHLY_REVENUE,
  STOCK_QUOTE, INSTITUTIONAL_CHIP, STOCK_METRICS, MARKET_INDEX,
  FINANCIAL_REPORT, REALTIME_QUOTE,
  NEWS_EVENT, PREDICTION, DOUBLING_FEATURES, STRATEGY_SIGNAL,
];

// ─── Feature Data Requirements ───

export const FEATURE_REQUIREMENTS = {
  rankings: {
    description: '排行分析頁',
    full: ['stock_master', 'stock_quote', 'institutional_chip', 'monthly_revenue', 'stock_metrics'],
    limited: ['stock_master', 'stock_quote'],
    unavailable_without: ['stock_master'],
  },
  institutional: {
    description: '主力控盤偵測頁',
    full: ['stock_master', 'institutional_chip', 'stock_quote'],
    limited: ['stock_master', 'institutional_chip'],
    unavailable_without: ['institutional_chip'],
  },
  signals: {
    description: '技術指標交易建議頁',
    full: ['stock_master', 'stock_quote', 'stock_metrics'],
    limited: ['stock_master', 'stock_quote'],
    unavailable_without: ['stock_quote'],
  },
  backtest: {
    description: '回測頁',
    full: ['stock_quote', 'monthly_revenue', 'institutional_chip', 'market_index'],
    limited: ['stock_quote'],
    unavailable_without: ['stock_quote'],
  },
  watchlist: {
    description: '自選股票追蹤頁',
    full: ['stock_master', 'stock_quote', 'stock_metrics', 'institutional_chip'],
    limited: ['stock_master'],
    unavailable_without: ['stock_master'],
  },
} as const;

// ─── Availability Checker ───

export type FeatureMode = 'full' | 'limited' | 'unavailable';

export function checkFeatureMode(
  featureKey: keyof typeof FEATURE_REQUIREMENTS
): { mode: FeatureMode; available: string[]; missing: string[]; message: string } {
  const req = FEATURE_REQUIREMENTS[featureKey];
  const sourceMap = Object.fromEntries(DATA_SOURCES.map(s => [s.id, s]));

  const isUsable = (id: string) => {
    const s = sourceMap[id];
    return s && s.availability !== 'empty' && s.availability !== 'unavailable';
  };

  const fullMissing = req.full.filter(id => !isUsable(id));
  const limitedMissing = req.limited.filter(id => !isUsable(id));
  const criticalMissing = req.unavailable_without.filter(id => !isUsable(id));

  if (criticalMissing.length > 0) {
    return {
      mode: 'unavailable',
      available: req.full.filter(isUsable),
      missing: criticalMissing,
      message: `核心資料不足: ${criticalMissing.join(', ')}。功能無法使用。`,
    };
  }

  if (fullMissing.length === 0) {
    return {
      mode: 'full',
      available: [...req.full],
      missing: [],
      message: '所有資料已就緒，可使用完整功能。',
    };
  }

  return {
    mode: 'limited',
    available: req.full.filter(isUsable),
    missing: fullMissing,
    message: `部分資料不足 (${fullMissing.join(', ')})，以精簡模式運行。`,
  };
}
