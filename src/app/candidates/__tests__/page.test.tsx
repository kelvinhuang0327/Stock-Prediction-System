import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('renders candidate list with core signals and the fundamental score cue', () => {
    render(<CandidatesPage />);

    expect(screen.getByText('Alpha 候選股研究')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '基本面' })).toBeInTheDocument();

    const stockRow = screen.getByText('測試列入原因').closest('tr') as HTMLElement;
    expect(within(stockRow).getByText('2330')).toBeInTheDocument();
    expect(within(stockRow).getByText('台積電')).toBeInTheDocument();
    expect(within(stockRow).getByText('Strong')).toBeInTheDocument();
    expect(within(stockRow).getByText('82')).toBeInTheDocument();
    expect(within(stockRow).getByText('75')).toBeInTheDocument();
    expect(within(stockRow).getByText('完整')).toBeInTheDocument();
  });

  it('expands the selected row and keeps the established explainability sections', () => {
    render(<CandidatesPage />);

    fireEvent.click(screen.getByText('測試列入原因').closest('tr') as HTMLElement);

    const detail = within(screen.getByText('為何列入候選').closest('td') as HTMLElement);
    expect(detail.getByText('候選摘要')).toBeInTheDocument();
    expect(detail.getByText('關鍵正向因子')).toBeInTheDocument();
    expect(detail.getByText('技術面強勢')).toBeInTheDocument();
    expect(detail.getByText('主要風險')).toBeInTheDocument();
    expect(detail.getByText('估值偏高')).toBeInTheDocument();
    expect(detail.getByText('分數細項')).toBeInTheDocument();
    expect(detail.getByText('基本面')).toBeInTheDocument();
    expect(detail.getByText('資料來源狀態')).toBeInTheDocument();
    expect(detail.getByText('fundamental')).toBeInTheDocument();
    expect(detail.getByText('研究委員會觀點')).toBeInTheDocument();
  });

  it('renders ETF candidate with explicit limited and missing fundamental states', () => {
    render(<CandidatesPage />);

    const etfRow = screen.getByText('ETF 測試候選').closest('tr') as HTMLElement;
    expect(within(etfRow).getByText('0050')).toBeInTheDocument();
    expect(within(etfRow).getByText('元大台灣50')).toBeInTheDocument();
    expect(within(etfRow).getByText('ETF')).toBeInTheDocument();
    expect(within(etfRow).getByText('部分')).toBeInTheDocument();

    fireEvent.click(etfRow);

    const detail = within(screen.getByText('ETF 候選摘要').closest('td') as HTMLElement);
    expect(detail.getByText('ETF 僅做有限基本面解讀')).toBeInTheDocument();
    expect(detail.getByText('fundamental (缺失)')).toBeInTheDocument();
  });
});
