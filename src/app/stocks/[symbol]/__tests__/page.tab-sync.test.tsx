import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StockDetailPage from '../page';

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
};

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
  let currentStockDetail = baseStockDetail;

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
    expect(screen.getByText('現金流 / 財務槓桿觀察')).toBeInTheDocument();
    expect(screen.getByText('資本效率 / 獲利品質觀察')).toBeInTheDocument();
    expect(screen.getByText('財務結構 / 效率同組比較')).toBeInTheDocument();
    expect(screen.getByText('完整基本面研究矩陣')).toBeInTheDocument();
    expect(screen.getByText('同組百分位明細')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /估值/ })[0]);
    expect(screen.getByText('P/E')).toBeInTheDocument();
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
});
