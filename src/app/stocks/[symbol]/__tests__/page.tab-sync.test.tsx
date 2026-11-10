import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StockDetailPage from '../page';
import type { StockDetailResponse } from '@/app/api/stocks/[id]/detail/route';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockPrefetch = jest.fn();
const mockBack = jest.fn();
const mockUseParams = jest.fn();
const mockUsePathname = jest.fn();
const mockUseSearchParams = jest.fn();
const mockUseRouter = jest.fn();
const mockUseApiData = jest.fn();
const mockUseApiPost = jest.fn();
const originalFetch = global.fetch;

jest.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => mockUseRouter(),
}));

jest.mock('@/hooks/useApiData', () => ({
  useApiData: (...args: unknown[]) => mockUseApiData(...args),
  useApiPost: () => mockUseApiPost(),
}));

jest.mock('@/components/relevance/RelevantInsightsPanel', () => ({
  RelevantInsightsPanel: () => <div>Mock Relevant Insights</div>,
}));

jest.mock('@/components/signals/StockSignalEffectivenessSection', () => ({
  StockSignalEffectivenessSection: ({ symbol }: { symbol: string }) => (
    <div id="stock-signal-effectiveness">Mock Signal Effectiveness {symbol}</div>
  ),
}));

const baseStockDetail = {
  symbol: '2330',
  name: '台積電',
  industry: 'Semiconductor',
  closePrice: 998,
  priceChangePercent: 1.2,
  isETF: false,
  dataPoints: 252,
  dataCoverage: 'full',
  lastUpdated: '2026-03-19',
  regime: {
    regime: 'Bull',
    confidence: 82,
    dataPoints: 180,
    samplePeriod: '180d',
    limitations: [],
  },
  fusion: {
    alphaScore: 81,
    recommendationBucket: 'Observe',
    confidence: 77,
    technicalScore: 79,
    chipScore: 72,
    fundamentalScore: 75,
    marketAdjustment: 4,
    usedSources: ['quote', 'chip'],
    missingSources: [],
    riskLevel: 'moderate',
    screenBucket: 'Strong Candidate',
    whyIncluded: '測試用候選',
    topFactors: ['alpha strong'],
    keyRisks: ['valuation'],
    summary: '測試摘要',
    limitations: [],
  },
  fundamentals: {
    kind: 'stock',
    dataCoverage: 'full',
    revenue: {
      latestMonth: '2026/03',
      revenue: 2100,
      yoyGrowth: 18.5,
      momGrowth: 3.2,
      trend: 'improving',
      consecutivePositiveYoYMonths: 4,
    },
    profitability: {
      latestPeriod: '2025 Q4',
      eps: 9.2,
      previousEps: 8.6,
      epsQoQDelta: 0.6,
      grossMargin: 54.1,
      grossMarginDelta: 1.2,
      operatingMargin: 42.3,
      operatingMarginDelta: 0.8,
    },
    valuation: {
      asOfDate: '2026-03-19',
      pe: 24.6,
      pb: 3.1,
      dividendYield: 2.1,
    },
    keySignals: ['營收年增維持雙位數'],
    keyRisks: [],
    summary: '基本面整體穩定，營運訊號偏正向。',
    limitations: [],
  },
  peerComparison: null,
  cashflowLeverageOverlay: {
    riskLevel: 'elevated',
    cashflowContext: '營運成長不差，但現金流轉化仍偏弱，後續需觀察成長品質。',
    leverageContext: '負債壓力不高，但流動性支撐仍偏弱，短期周轉能力需留意。',
    strengths: ['負債壓力不高'],
    pressures: ['成長延續需持續觀察現金流轉化能力', '流動性支撐偏弱'],
    summary: '營運成長不差，但現金流轉化仍偏弱，成長延續性需持續追蹤。',
    limitations: ['目前未提供穩定的營運現金流或槓桿欄位，部分情境僅能保守解讀。'],
  },
  capitalEfficiencyOverlay: {
    riskLevel: 'elevated',
    efficiencyContext: '部分效率指標不差，但尚未形成全面性的效率優勢。',
    profitabilityContext: '帳面報酬不差，但部分表現可能受槓桿放大影響。',
    conversionContext: '獲利存在，但現金流轉換品質偏弱，經營效率需保守解讀。',
    strengths: ['部分效率指標仍具支撐'],
    pressures: ['高 ROE 可能受槓桿放大影響', '獲利轉現品質偏弱'],
    summary: '帳面報酬不差，但部分表現可能受槓桿放大影響。',
    limitations: ['效率欄位僅部分可得，本區結論已保守處理。'],
  },
  financialStructurePeerComparison: {
    basis: 'industry',
    groupLabel: '半導體業',
    peerSampleSize: 6,
    dataCoverage: 'limited',
    metrics: {
      debtRatio: { value: 18, median: 24, percentile: 82, interpretation: '相對同組槓桿壓力不高。' },
      currentRatio: { value: 1.8, median: 1.5, percentile: 75, interpretation: '相對同組流動性支撐較佳。' },
      roe: { value: 18, median: 15, percentile: 78, interpretation: '優於多數同組樣本。' },
      cashflowConversion: { value: 0.88, median: 0.95, percentile: 42, interpretation: '接近同組中位水準。' },
    },
    strengths: ['同組槓桿與流動性結構相對穩健'],
    pressures: ['資本報酬不差，但部分表現可能受槓桿放大'],
    summary: '相較半導體業同組樣本，財務結構與效率優勢與壓力並存。',
    limitations: ['同 industry 樣本不足，已退回 sector 層級比較。'],
  },
  fundamentalMatrix: {
    overallSummary: '基本面優勢與壓力並存，建議搭配同組位置與後續財報持續追蹤。',
    limitations: ['同組樣本有限，解讀已保守處理。'],
    sections: {
      growth: {
        title: '成長',
        status: 'strong',
        summary: '同組成長表現偏強，但估值壓力較高。',
        highlights: ['同組成長表現偏強'],
        warnings: [],
        basis: 'industry · 半導體業',
        peerSampleSize: 6,
        limitations: [],
      },
      valuation: {
        title: '估值',
        status: 'pressure',
        summary: 'PE / PB 相對同組偏高，後續需要成長持續性支撐。',
        highlights: [],
        warnings: ['相對同組估值偏高'],
        basis: 'industry · 半導體業',
        peerSampleSize: 6,
        limitations: [],
      },
      financialStructure: {
        title: '財務體質',
        status: 'pressure',
        summary: '營運成長不差，但現金流轉化仍偏弱，成長延續性需持續追蹤。',
        highlights: ['負債壓力不高'],
        warnings: ['流動性支撐偏弱'],
        basis: 'industry · 半導體業',
        peerSampleSize: 6,
        limitations: [],
      },
      efficiency: {
        title: '經營效率',
        status: 'pressure',
        summary: '帳面報酬不差，但部分表現可能受槓桿放大影響。',
        highlights: ['部分效率指標仍具支撐'],
        warnings: ['高 ROE 可能受槓桿放大影響'],
        basis: 'industry · 半導體業',
        peerSampleSize: 6,
        limitations: [],
      },
      peerPosition: {
        title: '同組位置',
        status: 'neutral',
        summary: '相較半導體業同組樣本，財務結構與效率優勢與壓力並存。',
        highlights: ['同組槓桿與流動性結構相對穩健'],
        warnings: ['資本報酬不差，但部分表現可能受槓桿放大'],
        basis: 'industry · 半導體業',
        peerSampleSize: 6,
        limitations: [],
      },
    },
  },
  peerPercentileDetailTable: {
    basis: 'industry',
    peerSampleSize: 6,
    limitations: ['同組樣本有限，解讀已保守處理。'],
    rows: [
      {
        key: 'revenueYoY',
        label: '營收 YoY',
        category: 'growth',
        value: 18.5,
        median: 10.1,
        percentile: 83,
        interpretation: '同組相對偏強',
        basis: 'industry',
        peerSampleSize: 6,
        limitations: [],
        displayUnit: 'percent',
      },
    ],
  },
  signals: {
    signal: 'WATCH',
    strength: 64,
    signalDate: '2026-03-19',
    dataPeriod: '252d',
    dataPoints: 252,
    watchPrice: { price: 990, methodology: 'ma20' },
    buyPrice: { price: 980, methodology: 'support' },
    stopLoss: { price: 950, methodology: 'atr' },
    targetPrice: { price: 1050, methodology: 'resistance' },
    indicators: [
      { name: 'RSI', value: 58, signal: 'neutral', description: '中性' },
    ],
  },
  backtest: {
    available: true,
    dataPoints: 252,
    requiredDays: 100,
    buyAndHoldReturn: 0.18,
    period: '252d',
    unavailableReason: null,
  },
  backtestSummary: {
    available: true,
    strategy: 'MA Cross',
    totalReturn: 0.22,
    buyAndHoldReturn: 0.18,
    alphaToBuyAndHold: 0.04,
    maxDrawdown: -0.11,
    totalTrades: 12,
    period: '252d',
    dataPoints: 252,
    marketBenchmarkAvailable: true,
    marketReturn: 0.12,
    regimeAwareAvailable: true,
    regimeAwareReturn: 0.2,
    limitations: [],
    unavailableReason: null,
  },
  comparison: {
    available: false,
    previousDate: null,
    currentDate: '2026-03-19',
    alphaDelta: null,
    previousAlpha: null,
    currentAlpha: 81,
    bucketChanged: false,
    previousBucket: null,
    currentBucket: 'Observe',
    riskChanged: false,
    previousRisk: null,
    currentRisk: 'moderate',
    dataCoverageChanged: false,
    previousCoverage: 'full',
    newlyInsufficient: false,
    summaryNote: 'comparison unavailable',
  },
  candidateCtx: {
    isCandidate: true,
    screenBucket: 'Strong Candidate',
    whyIncluded: '測試用',
    topFactors: [],
    keyRisks: [],
    changeTags: [],
    snapshotDate: '2026-03-19',
  },
  watchlistCtx: {
    inWatchlist: true,
    watchlistId: 'w1',
    holdingShares: 100,
    holdingCost: 900,
    label: 'core',
  },
  coverageTier: {
    tier: 'A',
    tierLabel: 'A',
    quoteDays: 252,
    hasChip: true,
    capabilities: [],
    limitations: [],
  },
  limitations: [],
  disclaimer: '測試用 disclaimer',
  generatedAt: '2026-03-19T08:00:00.000Z',
} as unknown as StockDetailResponse;

const eventSummary = {
  symbol: '2330',
  eventCount: 0,
  rawCount: 0,
  dedupedCount: 0,
  recentThemes: [],
  recentEventTitles: [],
  catalystSummary: '近期無重大事件',
  sourceBreakdown: {},
  trustLevelSummary: {
    official: 0,
    mainstream: 0,
    secondary: 0,
    unknown: 0,
    dominant: 'mixed',
    note: '來源不足',
  },
  limitations: [],
  dataCoverage: 'insufficient',
  last_updated: '2026-03-19',
};

const eventAlerts = {
  summary: '無重大警示',
  alerts: [],
  limitations: [],
  generatedAt: '2026-03-19T08:00:00.000Z',
};

const topicSummary = {
  summary: '近期無主題升溫',
  topics: [],
  limitations: [],
  generatedAt: '2026-03-19T08:00:00.000Z',
};

describe('/stocks/[symbol] tab query sync', () => {
  let currentStockDetail: StockDetailResponse = baseStockDetail;

  beforeEach(() => {
    jest.clearAllMocks();
    currentStockDetail = baseStockDetail;
    mockUseParams.mockReturnValue({ symbol: '2330' });
    mockUsePathname.mockReturnValue('/stocks/2330');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: mockReplace,
      prefetch: mockPrefetch,
      back: mockBack,
    });
    mockUseApiData.mockImplementation((url: string | null) => {
      if (!url) return { data: null, loading: false, error: null, refetch: jest.fn() };
      if (url.includes('/api/stocks/2330/detail')) return { data: currentStockDetail, loading: false, error: null, refetch: jest.fn() };
      if (url.includes('/api/events/summary')) return { data: eventSummary, loading: false, error: null, refetch: jest.fn() };
      if (url.includes('/api/events/alerts')) return { data: eventAlerts, loading: false, error: null, refetch: jest.fn() };
      if (url.includes('/api/events/topics')) return { data: topicSummary, loading: false, error: null, refetch: jest.fn() };
      return { data: null, loading: false, error: null, refetch: jest.fn() };
    });
    mockUseApiPost.mockReturnValue({
      post: jest.fn().mockResolvedValue({ results: [] }),
      loading: false,
      error: null,
    });
    window.history.replaceState({}, '', '/stocks/2330');
    Object.defineProperty(window, 'requestAnimationFrame', {
      writable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      writable: true,
      value: jest.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    if (originalFetch) Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
    else delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  it('opens the signals tab directly from ?tab=signals', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=signals'));

    render(<StockDetailPage />);

    expect(screen.getByText('Mock Signal Effectiveness 2330')).toBeInTheDocument();
    expect(screen.queryByText('分析摘要')).not.toBeInTheDocument();
  });

  it('updates the URL when the user switches tabs manually', () => {
    render(<StockDetailPage />);

    fireEvent.click(screen.getByRole('button', { name: /技術指標/i }));

    expect(mockReplace).toHaveBeenCalledWith('/stocks/2330?tab=signals', { scroll: false });
  });

  it('keeps the same tab after re-rendering with the shared query link', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=signals'));

    const { unmount } = render(<StockDetailPage />);
    expect(screen.getByText('Mock Signal Effectiveness 2330')).toBeInTheDocument();

    unmount();
    render(<StockDetailPage />);
    expect(screen.getByText('Mock Signal Effectiveness 2330')).toBeInTheDocument();
  });

  it('aligns source drill-down links with the correct tab and anchor', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=signals'));
    window.history.replaceState({}, '', '/stocks/2330?tab=signals#stock-signal-effectiveness');

    render(<StockDetailPage />);

    await waitFor(() => {
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });
    expect(screen.getByText('Mock Signal Effectiveness 2330')).toBeInTheDocument();
  });

  it('falls back to the default tab when the query is invalid', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=bogus'));

    render(<StockDetailPage />);

    expect(screen.getByText('分析摘要')).toBeInTheDocument();
    expect(screen.queryByText('Mock Signal Effectiveness 2330')).not.toBeInTheDocument();
  });

  it('does not crash when a tab section has insufficient data', () => {
    currentStockDetail = {
      ...baseStockDetail,
      signals: null,
    };
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=signals'));

    render(<StockDetailPage />);

    expect(screen.getByText('技術指標不可用（歷史資料少於 20 天）')).toBeInTheDocument();
    expect(screen.getByText('Mock Signal Effectiveness 2330')).toBeInTheDocument();
  });

  it('renders the page-level loading and invalid-symbol states', () => {
    mockUseApiData.mockReturnValue({ data: null, loading: true, error: null, refetch: jest.fn() });
    render(<StockDetailPage />);
    expect(screen.getByText('載入個股研究資料中…')).toBeInTheDocument();

    mockUseParams.mockReturnValue({});
    const { unmount } = render(<StockDetailPage />);
    expect(screen.getByText('無效的股票代號')).toBeInTheDocument();
    unmount();
  });

  it('shows a recoverable detail error when loading has stopped', () => {
    mockUseApiData.mockImplementation((url: string | null) => url?.includes('/detail')
      ? { data: null, loading: false, error: 'upstream offline', refetch: jest.fn() }
      : { data: null, loading: false, error: null, refetch: jest.fn() });

    render(<StockDetailPage />);

    expect(screen.getByText('無法載入 2330 的研究資料')).toBeInTheDocument();
    expect(screen.getByText('upstream offline')).toBeInTheDocument();
    expect(screen.queryByText('分析摘要')).not.toBeInTheDocument();
  });

  it('renders degraded market and scoring sections without a quote or fusion result', () => {
    currentStockDetail = {
      ...baseStockDetail,
      closePrice: 0,
      priceChangePercent: 0,
      isETF: true,
      dataCoverage: 'insufficient',
      dataPoints: 0,
      lastUpdated: '',
      regime: null,
      fusion: null,
      coverageTier: { ...baseStockDetail.coverageTier, tier: 'C', tierLabel: 'C' },
      limitations: ['來源資料不足'],
    };

    render(<StockDetailPage />);

    expect(screen.getByText('無行情資料')).toBeInTheDocument();
    expect(screen.getByText('不足 (0天)')).toBeInTheDocument();
    expect(screen.getByText('Tier C')).toBeInTheDocument();
    expect(screen.getByText('市場環境資料不可用（TAIEX 歷史不足或分析引擎錯誤）')).toBeInTheDocument();
    expect(screen.getByText('綜合評分不可用（歷史資料不足或分析引擎暫時無法執行）')).toBeInTheDocument();
    expect(screen.getByText('分數細項不可用')).toBeInTheDocument();
    expect(screen.getByText(/來源資料不足/)).toBeInTheDocument();
  });

  it('shows backtest unavailable guidance when the required history is missing', () => {
    currentStockDetail = {
      ...baseStockDetail,
      backtest: {
        ...baseStockDetail.backtest,
        available: false,
        unavailableReason: null,
        dataPoints: 25,
        period: null,
      },
    };
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=backtest'));

    render(<StockDetailPage />);

    expect(screen.getByText('回測不可用')).toBeInTheDocument();
    expect(screen.getByText('歷史資料：25 天（需 ≥100 天才可回測）')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /前往回測頁查看更多設定/ })).toHaveAttribute('href', '/backtest?symbol=2330');
  });

  it('renders strategy performance, benchmarks, and expandable backtest limitations', () => {
    currentStockDetail = {
      ...baseStockDetail,
      backtestSummary: {
        ...baseStockDetail.backtestSummary,
        limitations: ['交易成本未納入', '樣本期間有限'],
      },
    };
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=backtest'));

    render(<StockDetailPage />);

    expect(screen.getByText('策略報酬（MA Cross）')).toBeInTheDocument();
    expect(screen.getByText('+0.22%')).toBeInTheDocument();
    expect(screen.getByText('+0.04%')).toBeInTheDocument();
    expect(screen.getByText(/可用 \+0\.12%/)).toBeInTheDocument();
    expect(screen.getByText(/可用 \+0\.20%/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '回測限制說明 (2)' }));
    expect(screen.getByText(/交易成本未納入/)).toBeInTheDocument();
    expect(screen.getByText(/樣本期間有限/)).toBeInTheDocument();
  });

  it('shows buy-and-hold history when the strategy backtest is unavailable', () => {
    currentStockDetail = {
      ...baseStockDetail,
      backtest: { ...baseStockDetail.backtest, available: true, dataPoints: 75, period: null, buyAndHoldReturn: -0.1 },
      backtestSummary: {
        ...baseStockDetail.backtestSummary,
        available: false,
        totalReturn: null,
        buyAndHoldReturn: null,
        alphaToBuyAndHold: null,
        unavailableReason: '策略樣本不足',
        period: null,
        limitations: [],
      },
    };
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=backtest'));

    render(<StockDetailPage />);

    expect(screen.getByText('策略樣本不足')).toBeInTheDocument();
    expect(screen.getByText('-0.10%')).toBeInTheDocument();
    expect(screen.getByText('75 天')).toBeInTheDocument();
  });

  it('shows both negative context states and the empty-context notice', () => {
    currentStockDetail = {
      ...baseStockDetail,
      candidateCtx: { ...baseStockDetail.candidateCtx, isCandidate: false, snapshotDate: '' },
      watchlistCtx: { ...baseStockDetail.watchlistCtx, inWatchlist: false },
    };
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=context'));

    render(<StockDetailPage />);

    expect(screen.getByText(/此股票目前不在候選池中/)).toBeInTheDocument();
    expect(screen.getByText(/此股票不在自選清單中/)).toBeInTheDocument();
    expect(screen.getByText('此股票目前不在候選池或自選股中。')).toBeInTheDocument();
  });

  it('expands a populated snapshot comparison and shows changed badges', () => {
    currentStockDetail = {
      ...baseStockDetail,
      comparison: {
        ...baseStockDetail.comparison,
        available: true,
        alphaDelta: 0,
        previousDate: null,
        currentDate: '2026-03-20',
        previousAlpha: null,
        currentAlpha: 0,
        bucketChanged: true,
        previousBucket: 'Observe',
        currentBucket: 'Buy',
        riskChanged: true,
        previousRisk: 'low',
        currentRisk: 'high',
        dataCoverageChanged: true,
        previousCoverage: 'limited',
        newlyInsufficient: true,
        summaryNote: '快照資料已更新',
      },
    };

    render(<StockDetailPage />);

    expect(screen.getByText('Alpha 0')).toBeInTheDocument();
    expect(screen.getByText('Observe → Buy')).toBeInTheDocument();
    expect(screen.getByText('風險 low → high')).toBeInTheDocument();
    expect(screen.getByText('資料轉為不足')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /展開/ }));
    expect(screen.getByText('今日 vs 前日快照比較')).toBeInTheDocument();
    expect(screen.getByText('2026-03-20')).toBeInTheDocument();
  });

  it('renders event, alert, and related-topic context when those sources are available', async () => {
    const populatedEvents = {
      ...eventSummary,
      eventCount: 3,
      rawCount: 4,
      dedupedCount: 3,
      recentThemes: ['AI', 'GPU'],
      recentEventTitles: ['Chip demand outlook', 'New capacity plan'],
      catalystSummary: 'AI demand remains a key market catalyst.',
      trustLevelSummary: { official: 2, mainstream: 1, secondary: 0, unknown: 0, dominant: 'official', note: '主要來源已確認' },
      dataCoverage: 'full',
      limitations: ['Revenue schedule may change'],
    };
    const populatedAlerts = {
      summary: '兩項事件提醒',
      alerts: [
        { type: 'earnings', severity: 'warning', title: 'Earnings update', message: 'Quarterly results are due.', trustLevelSummary: 'official' },
        { type: 'supply', severity: 'info', title: 'Supply update', message: 'Capacity is expanding.' },
      ],
      limitations: [],
      generatedAt: '2026-03-19T08:00:00.000Z',
    };
    const populatedTopics = {
      ...topicSummary,
      topics: [{
        topic: 'AI 晶片',
        surgeLevel: 'surging',
        diffusionLevel: 'broadening theme',
        relatedSymbols: ['2330', '2317'],
        trustLevelSummary: 'official 3 / mainstream 1 / secondary 0 / unknown 0',
        recentCount: 4,
        previousCount: 1,
        delta: 3,
      }],
    };
    mockUseApiData.mockImplementation((url: string | null) => {
      if (url?.includes('/api/stocks/2330/detail')) return { data: currentStockDetail, loading: false, error: null, refetch: jest.fn() };
      if (url?.includes('/api/events/summary')) return { data: populatedEvents, loading: false, error: null, refetch: jest.fn() };
      if (url?.includes('/api/events/alerts')) return { data: populatedAlerts, loading: false, error: null, refetch: jest.fn() };
      if (url?.includes('/api/events/topics?')) return { data: populatedTopics, loading: false, error: null, refetch: jest.fn() };
      if (url?.includes('/api/events/topic-momentum')) return {
        data: {
          topic: 'AI 晶片',
          momentum: { topic: 'AI 晶片', timeline: [], momentumType: 'rising', peak: 5, avg: 2, recentTrend: 1, limitations: [] },
          diffusion: { topic: 'AI 晶片', nodes: [{ symbol: '2330', eventCount: 5 }, { symbol: '2317', eventCount: 2 }], breadth: 2, diffusionType: 'broad', sourceDiversity: 3, limitations: [] },
          generatedAt: '2026-03-19T08:00:00.000Z',
          limitations: [],
        },
        loading: false, error: null, refetch: jest.fn(),
      };
      if (url?.includes('/api/events/theme-linkage')) return {
        data: {
          topic: 'AI 晶片',
          linkage: { topic: 'AI 晶片', linkedTopics: [], limitations: [] },
          graph: { topic: 'AI 晶片', nodes: [], edges: [], limitations: [] },
          generatedAt: '2026-03-19T08:00:00.000Z',
          limitations: [],
        },
        loading: false, error: null, refetch: jest.fn(),
      };
      if (url?.includes('/api/events/cross-market')) return {
        data: {
          topic: 'AI 晶片',
          crossMarket: {
            topic: 'AI 晶片', originCluster: { symbols: ['2330'], firstSeenDate: '2026-03-18' },
            spreadClusters: [{ symbols: ['2317'], firstSeenDate: '2026-03-19', spreadDelay: 1 }],
            spreadPattern: 'sector_expansion', spreadSpeed: 'fast', trustLevelSummary: 'official', limitations: [],
          },
          timeline: { topic: 'AI 晶片', timeline: [], stage: 'early', trend: 'expanding', limitations: [] },
          generatedAt: '2026-03-19T08:00:00.000Z', limitations: [],
        },
        loading: false, error: null, refetch: jest.fn(),
      };
      return { data: null, loading: false, error: null, refetch: jest.fn() };
    });
    mockUseApiPost.mockReturnValue({
      post: jest.fn().mockResolvedValue({
        results: [{
          symbol: '2330', topicContext: { topics: [] },
          crossMarketContext: { spreadPattern: 'early_cluster', spreadSpeed: 'fast', positionInChain: 'origin' },
          narrative: 'Market impact remains concentrated.', limitations: [],
        }],
      }),
      loading: false,
      error: null,
    });

    render(<StockDetailPage />);

    expect(screen.getByText('事件數量：3')).toBeInTheDocument();
    expect(screen.getByText('事件覆蓋較完整')).toBeInTheDocument();
    expect(screen.getByText('#AI')).toBeInTheDocument();
    expect(screen.getByText(/Chip demand outlook/)).toBeInTheDocument();
    expect(screen.getByText('Earnings update')).toBeInTheDocument();
    expect(screen.queryByText('事件提醒載入中…')).not.toBeInTheDocument();
    expect(screen.getByText('AI 晶片 · rising · broad · 主要')).toBeInTheDocument();
    expect(screen.getByText('目前無可用關聯主題資料。')).toBeInTheDocument();
    expect(screen.getByText('此股屬於 origin cluster')).toBeInTheDocument();
    expect(await screen.findByText('Market impact remains concentrated.')).toBeInTheDocument();
  });

  it('keeps independent event sections readable while sources load or fail', () => {
    mockUseApiData.mockImplementation((url: string | null) => {
      if (url?.includes('/api/stocks/2330/detail')) return { data: currentStockDetail, loading: false, error: null, refetch: jest.fn() };
      if (url?.includes('/api/events/summary')) return { data: null, loading: true, error: null, refetch: jest.fn() };
      if (url?.includes('/api/events/alerts')) return { data: null, loading: false, error: 'alerts unavailable', refetch: jest.fn() };
      if (url?.includes('/api/events/topics?')) return { data: null, loading: false, error: 'topics unavailable', refetch: jest.fn() };
      return { data: null, loading: false, error: null, refetch: jest.fn() };
    });

    render(<StockDetailPage />);

    expect(screen.getByText('事件資料載入中…')).toBeInTheDocument();
    expect(screen.getByText('事件提醒暫時不可用（已降級）。')).toBeInTheDocument();
    expect(screen.getByText('主題擴散資料暫時不可用（已降級）。')).toBeInTheDocument();
  });

  it('blocks multi-agent research when both fusion and usable history are missing', async () => {
    currentStockDetail = { ...baseStockDetail, fusion: null, dataPoints: 10 };
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=research'));

    render(<StockDetailPage />);

    expect(await screen.findByText('⚠ 資料不足 20 天，無法執行多 Agent 研究分析')).toBeInTheDocument();
  });

  it('renders research results, unknown labels, and expandable agent evidence', async () => {
    const researchResult = {
      consensus: 'Unrecognized',
      consensusConfidence: 61,
      viewpoints: [
        { name: 'TechnicalAgent', stance: 'Bullish', confidence: 80, rationale: 'Trend structure remains positive.', limitations: [], missingSources: [] },
        { name: 'NovelAgent', stance: 'Insufficient', confidence: 20, rationale: 'Quote history is missing.', limitations: ['Limited observations'], missingSources: ['daily quote'] },
      ],
      disagreementPoints: ['Growth and valuation diverge.'],
      keyRisks: ['High valuation'],
      scenarioNotes: ['Reassess after the next report.'],
      limitations: ['Some provider evidence is absent.'],
      disclaimer: 'Research support only.',
    };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => researchResult });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=research'));

    render(<StockDetailPage />);

    expect(await screen.findByText(/委員會共識：資料不足/)).toBeInTheDocument();
    expect(screen.getByText('情境說明')).toBeInTheDocument();
    expect(screen.getByText('High valuation')).toBeInTheDocument();
    expect(screen.getByText(/Growth and valuation diverge/)).toBeInTheDocument();
    expect(screen.getByText('Research support only.')).toBeInTheDocument();
    const technicalAgent = screen.getByRole('button', { name: /技術面/ });
    fireEvent.click(technicalAgent);
    expect(screen.getByText('Trend structure remains positive.')).toBeInTheDocument();
    fireEvent.click(technicalAgent);
    expect(screen.queryByText('Trend structure remains positive.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /NovelAgent/ }));
    expect(screen.getByText('資料缺口：daily quote')).toBeInTheDocument();
    expect(screen.getByText(/Limited observations/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/research/multi-agent', expect.objectContaining({ method: 'POST' }));
  });

  it('surfaces multi-agent request errors without losing the page context', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=research'));

    render(<StockDetailPage />);

    expect(await screen.findByText(/HTTP 503/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('研究委員會觀點')).toBeInTheDocument();
  });
});
