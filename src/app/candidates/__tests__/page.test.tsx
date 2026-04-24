import { fireEvent, render, screen } from '@testing-library/react';
import CandidatesPage from '../page';

const mockUseApiData = jest.fn();

jest.mock('@/hooks/useApiData', () => ({
  useApiData: (...args: unknown[]) => mockUseApiData(...args),
}));

const response = {
  regime: 'Bull',
  regimeConfidence: 82,
  candidates: [
    {
      symbol: '2330',
      name: '台積電',
      closePrice: 998,
      priceChangePercent: 1.2,
      isETF: false,
      alphaScore: 82,
      recommendationBucket: 'Observe',
      confidence: 78,
      technicalScore: 80,
      chipScore: 72,
      fundamentalScore: 75,
      marketAdjustment: 4,
      riskLevel: 'moderate',
      screenBucket: 'Strong Candidate',
      whyIncluded: '測試列入原因',
      topFactors: ['技術面強勢'],
      keyRisks: ['估值偏高'],
      dataCoverage: 'full',
      usedSources: ['quote', 'chip', 'fundamental'],
      missingSources: [],
      limitations: [],
      summary: '候選摘要',
      changeTags: ['new_today'],
      previousAlpha: null,
      previousBucket: null,
      alphaDelta: null,
      fundamentals: {
        kind: 'stock',
        dataCoverage: 'full',
        revenue: {
          latestMonth: '2026/03',
          revenue: 2100,
          yoyGrowth: 18.5,
          momGrowth: 2.2,
          trend: 'improving',
          consecutivePositiveYoYMonths: 4,
        },
        profitability: {
          latestPeriod: '2025 Q4',
          eps: 9.2,
          previousEps: 8.7,
          epsQoQDelta: 0.5,
          grossMargin: 54.1,
          grossMarginDelta: 1.1,
          operatingMargin: 42.3,
          operatingMarginDelta: 0.7,
        },
        valuation: {
          asOfDate: '2026-03-24',
          pe: 24.6,
          pb: 3.1,
          dividendYield: 2.2,
        },
        keySignals: ['營收年增維持雙位數'],
        keyRisks: ['估值偏高，需結合同業比較與成長性一併解讀。'],
        summary: '基本面整體穩定，營運訊號偏正向。',
        limitations: [],
      },
      peerComparison: {
        basis: 'industry',
        groupLabel: '半導體業',
        peerCount: 6,
        dataCoverage: 'limited',
        summary: '相較半導體業同組樣本，基本面優勢與壓力並存。',
        metrics: [],
        strengths: ['營收 YoY 相對同組偏強'],
        cautions: ['PE 相對同組偏高'],
        limitations: ['同 industry 樣本不足，已退回 sector 層級比較。'],
      },
      fundamentalOverlay: {
        riskLevel: 'elevated',
        strengths: ['同組成長表現偏強'],
        pressures: ['相對同組估值偏高'],
        valuationContext: 'PE / PB 相對同組偏高，後續需要成長持續性支撐。',
        growthContext: '同組成長表現偏強，但估值壓力較高。',
        summary: '同組成長表現偏強，但估值壓力較高。',
        limitations: ['同組樣本有限，解讀已保守處理。'],
      },
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
          growth: { title: '成長', status: 'strong', summary: '同組成長表現偏強，但估值壓力較高。', highlights: ['同組成長表現偏強'], warnings: [], basis: 'industry · 半導體業', peerSampleSize: 6, limitations: [] },
          valuation: { title: '估值', status: 'pressure', summary: 'PE / PB 相對同組偏高，後續需要成長持續性支撐。', highlights: [], warnings: ['相對同組估值偏高'], basis: 'industry · 半導體業', peerSampleSize: 6, limitations: [] },
          financialStructure: { title: '財務體質', status: 'pressure', summary: '營運成長不差，但現金流轉化仍偏弱，成長延續性需持續追蹤。', highlights: ['負債壓力不高'], warnings: ['流動性支撐偏弱'], basis: 'industry · 半導體業', peerSampleSize: 6, limitations: [] },
          efficiency: { title: '經營效率', status: 'pressure', summary: '帳面報酬不差，但部分表現可能受槓桿放大影響。', highlights: ['部分效率指標仍具支撐'], warnings: ['高 ROE 可能受槓桿放大影響'], basis: 'industry · 半導體業', peerSampleSize: 6, limitations: [] },
          peerPosition: { title: '同組位置', status: 'neutral', summary: '相較半導體業同組樣本，財務結構與效率優勢與壓力並存。', highlights: ['同組槓桿與流動性結構相對穩健'], warnings: ['資本報酬不差，但部分表現可能受槓桿放大'], basis: 'industry · 半導體業', peerSampleSize: 6, limitations: [] },
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
    },
    {
      symbol: '0050',
      name: '元大台灣50',
      closePrice: 190,
      priceChangePercent: 0.5,
      isETF: true,
      alphaScore: 70,
      recommendationBucket: 'Observe',
      confidence: 65,
      technicalScore: 68,
      chipScore: 55,
      fundamentalScore: 0,
      marketAdjustment: 2,
      riskLevel: 'moderate',
      screenBucket: 'Watch',
      whyIncluded: 'ETF 測試候選',
      topFactors: ['市場代表性'],
      keyRisks: ['ETF 僅做有限基本面解讀'],
      dataCoverage: 'limited',
      usedSources: ['quote', 'market'],
      missingSources: ['fundamental'],
      limitations: [],
      summary: 'ETF 候選摘要',
      changeTags: [],
      previousAlpha: 68,
      previousBucket: 'Neutral',
      alphaDelta: 2,
      fundamentals: {
        kind: 'etf',
        dataCoverage: 'limited',
        revenue: {
          latestMonth: null,
          revenue: null,
          yoyGrowth: null,
          momGrowth: null,
          trend: 'stable',
          consecutivePositiveYoYMonths: 0,
        },
        profitability: {
          latestPeriod: null,
          eps: null,
          previousEps: null,
          epsQoQDelta: null,
          grossMargin: null,
          grossMarginDelta: null,
          operatingMargin: null,
          operatingMarginDelta: null,
        },
        valuation: {
          asOfDate: '2026-03-24',
          pe: null,
          pb: null,
          dividendYield: 3.2,
        },
        keySignals: [],
        keyRisks: [],
        summary: 'ETF 以估值/收益視角解讀。',
        limitations: [],
      },
      peerComparison: null,
      fundamentalOverlay: {
        riskLevel: 'unknown',
        strengths: [],
        pressures: [],
        valuationContext: 'ETF 不適用公司營運式估值壓力解讀。',
        growthContext: 'ETF 不適用營收 / EPS / 毛利率式成長判讀。',
        summary: 'ETF 暫不做公司營運式基本面同組比較。',
        limitations: ['ETF 不適用公司營運式基本面風險 overlay。'],
      },
      cashflowLeverageOverlay: {
        riskLevel: 'unknown',
        cashflowContext: 'ETF 不適用公司營運式現金流與轉現能力判讀。',
        leverageContext: 'ETF 不適用公司負債 / 流動性結構判讀。',
        strengths: [],
        pressures: [],
        summary: 'ETF 暫不建立公司財務結構式的現金流 / 槓桿判讀。',
        limitations: ['ETF 不適用公司財務結構式 cashflow / leverage overlay。'],
      },
      capitalEfficiencyOverlay: {
        riskLevel: 'unknown',
        efficiencyContext: 'ETF 不適用公司資本使用效率與營運週轉判讀。',
        profitabilityContext: 'ETF 不適用公司 ROE / ROA 式經營效率判讀。',
        conversionContext: 'ETF 不適用公司獲利轉現品質判讀。',
        strengths: [],
        pressures: [],
        summary: 'ETF 暫不建立公司營運式的資本效率與獲利品質判讀。',
        limitations: ['ETF 不適用公司營運式 capital efficiency overlay。'],
      },
      financialStructurePeerComparison: {
        basis: 'none',
        groupLabel: null,
        peerSampleSize: 0,
        dataCoverage: 'insufficient',
        metrics: {},
        strengths: [],
        pressures: [],
        summary: 'ETF 暫不建立公司財務結構與效率的同組比較。',
        limitations: ['ETF 不適用公司財務結構 / 經營效率的同組相對位置判讀。'],
      },
      fundamentalMatrix: {
        overallSummary: 'ETF 暫不做公司營運式完整基本面矩陣判讀。',
        limitations: ['ETF 不適用公司營運式完整基本面矩陣判讀。'],
        sections: {
          growth: { title: '成長', status: 'unknown', summary: 'ETF 暫不做公司營運式完整基本面矩陣判讀。', highlights: [], warnings: [], limitations: ['ETF 不適用'] },
          valuation: { title: '估值', status: 'unknown', summary: 'ETF 暫不做公司營運式完整基本面矩陣判讀。', highlights: [], warnings: [], limitations: ['ETF 不適用'] },
          financialStructure: { title: '財務體質', status: 'unknown', summary: 'ETF 暫不做公司營運式完整基本面矩陣判讀。', highlights: [], warnings: [], limitations: ['ETF 不適用'] },
          efficiency: { title: '經營效率', status: 'unknown', summary: 'ETF 暫不做公司營運式完整基本面矩陣判讀。', highlights: [], warnings: [], limitations: ['ETF 不適用'] },
          peerPosition: { title: '同組位置', status: 'unknown', summary: 'ETF 暫不做公司營運式完整基本面矩陣判讀。', highlights: [], warnings: [], limitations: ['ETF 不適用'] },
        },
      },
      peerPercentileDetailTable: {
        basis: 'none',
        peerSampleSize: 0,
        limitations: ['ETF 不適用公司營運式同組百分位判讀。'],
        rows: [],
      },
    },
  ],
  excludedCount: 2,
  totalScanned: 20,
  dataCoverageSummary: { full: 1, limited: 1, insufficient: 0 },
  screenParams: {
    minAlphaScore: 60,
    minConfidence: 60,
    respectMarketRegime: true,
    appliedRegimeAdjustment: 'bull relaxed',
  },
  comparisonAvailable: true,
  previousSnapshotDate: '2026-03-23',
  strongCount: 1,
  watchCount: 1,
  neutralCount: 0,
  limitations: [],
  disclaimer: '測試用 disclaimer',
  last_updated: '2026-03-24T10:00:00.000Z',
};

describe('/candidates page', () => {
  beforeEach(() => {
    mockUseApiData.mockReturnValue({
      data: response,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  afterEach(() => {
    mockUseApiData.mockReset();
  });

  it('renders candidate list with fundamental overlay cue without hiding core signals', () => {
    render(<CandidatesPage />);

    expect(screen.getByText('Alpha 候選股研究')).toBeInTheDocument();
    expect(screen.getByText('2330')).toBeInTheDocument();
    expect(screen.getByText('測試列入原因')).toBeInTheDocument();
    expect(screen.getByText('基本面壓力')).toBeInTheDocument();
    expect(screen.getByText('同組成長表現偏強，但估值壓力較高。')).toBeInTheDocument();
  });

  it('shows overlay detail panel content and keeps existing explainability sections', () => {
    render(<CandidatesPage />);

    fireEvent.click(screen.getByText('測試列入原因').closest('tr') as HTMLElement);

    expect(screen.getByText('基本面研究卡')).toBeInTheDocument();
    expect(screen.getByText('成長脈絡')).toBeInTheDocument();
    expect(screen.getByText('估值脈絡')).toBeInTheDocument();
    expect(screen.getByText('現金流 / 財務槓桿觀察')).toBeInTheDocument();
    expect(screen.getByText('資本效率 / 獲利品質觀察')).toBeInTheDocument();
    expect(screen.getByText('財務結構 / 效率同組比較')).toBeInTheDocument();
    expect(screen.getByText('完整基本面研究矩陣')).toBeInTheDocument();
    expect(screen.getByText('同組百分位明細')).toBeInTheDocument();
    expect(screen.getAllByText(/industry · 半導體業/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('6 檔').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('關鍵正向因子')).toBeInTheDocument();
    expect(screen.getByText('研究委員會觀點')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /成長/ })[0]);
    expect(screen.getByText('營收 YoY')).toBeInTheDocument();
  });

  it('renders ETF candidate as unknown overlay instead of pretending precise comparison', () => {
    render(<CandidatesPage />);

    expect(screen.getByText('ETF 測試候選')).toBeInTheDocument();
    expect(screen.getByText('基本面未知')).toBeInTheDocument();
    expect(screen.getByText('ETF 暫不做公司營運式基本面同組比較。')).toBeInTheDocument();
  });
});
