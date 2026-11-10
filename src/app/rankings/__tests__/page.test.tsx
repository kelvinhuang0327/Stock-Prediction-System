import { fireEvent, render, screen } from '@testing-library/react';
import RankingsPage from '../page';

const mockUseApiData = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('@/hooks/useApiData', () => ({
  useApiData: (url: string | null) => mockUseApiData(url),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: (...args: string[]) => mockRouterPush(...args) }) }));
jest.mock('@/components/ui/data-availability-guard', () => ({
  DataStatusBar: ({ mode }: { mode: string }) => <div>Status: {mode}</div>,
}));
jest.mock('@/components/ui/badges', () => ({
  BucketBadge: ({ bucket }: { bucket: string }) => <span>{bucket}</span>,
}));

const rankingData = [
  {
    symbol: 'AAA', name: 'Alpha Co', industry: 'Tech', price: 120, change: 4.5,
    changePercent: 3.75, volume: 9000, foreignBuy: 200, trustBuy: -10, dealerBuy: 0, totalBuy: null,
  },
  {
    symbol: 'BBB', name: 'Beta Bank', industry: '', price: null, change: -2,
    changePercent: -1.2, volume: 5000, foreignBuy: -50, trustBuy: 40, dealerBuy: -1, totalBuy: 10,
  },
  {
    symbol: 'CCC', name: 'Gamma Co', industry: 'Shipping', price: 0, change: 0,
    changePercent: null, volume: null, foreignBuy: 0, trustBuy: null, dealerBuy: 25, totalBuy: 25,
  },
];

const rankingResponse = {
  data: rankingData,
  source: 'database',
  type: 'volume',
  coverage: { stocks: 8, total: 10, dates: 4, limitations: [] as string[] },
  sample_size: 3,
  last_updated: '2026-03-03',
  updatedAt: '2026-03-03T08:00:00.000Z',
};

const makeAlpha = (overrides: Record<string, unknown> = {}) => ({
  symbol: 'AAA',
  name: 'Alpha Co',
  alphaScore: 80,
  recommendationBucket: 'BUY',
  screenBucket: 'STRONG_BUY',
  confidence: 80,
  technicalScore: 90,
  chipScore: 75,
  fundamentalScore: 85,
  riskLevel: 'Low',
  topFactors: ['trend'],
  keyRisks: [],
  whyIncluded: 'Strong market and fundamentals.',
  summary: 'High quality candidate.',
  usedSources: ['quotes', 'chips'],
  missingSources: ['eps'],
  limitations: [],
  ...overrides,
});

describe('RankingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApiData.mockReturnValue({ data: rankingResponse, loading: false, error: null });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) });
  });

  it('renders ranking metadata and switches across every standard ranking type', () => {
    render(<RankingsPage />);

    expect(screen.getByText('排行分析')).toBeInTheDocument();
    expect(screen.getByText('Status: full')).toBeInTheDocument();
    expect(screen.getByText('樣本數：3 檔')).toBeInTheDocument();
    expect(screen.getByText('最新資料日期：2026-03-03')).toBeInTheDocument();
    expect(screen.getByText('Alpha Co')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜尋股票代號或名稱...')).toBeInTheDocument();

    for (const [label, header] of [
      ['漲幅排行', '漲跌'],
      ['跌幅排行', '漲跌'],
      ['外資買超', '外資'],
      ['投信買超', '投信'],
      ['自營商買超', '自營商'],
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('columnheader', { name: new RegExp(header) })).toBeInTheDocument();
      expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
    }

    fireEvent.click(screen.getByRole('button', { name: '類股指數' }));
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getByRole('columnheader', { name: /漲跌點/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /成分股數/ })).toBeInTheDocument();
  });

  it('filters rows, sorts by columns, and navigates when a standard row is selected', () => {
    mockUseApiData.mockReturnValue({
      data: { ...rankingResponse, data: Array.from({ length: 23 }, (_, index) => ({
        ...rankingData[index % rankingData.length],
        symbol: `S${String(index).padStart(2, '0')}`,
        name: `Stock ${index}`,
        volume: index,
      })) },
      loading: false,
      error: null,
    });
    render(<RankingsPage />);

    expect(document.body.textContent).toContain('共 23 筆，第 1/2 頁');
    const search = screen.getByPlaceholderText('搜尋股票代號或名稱...');
    fireEvent.change(search, { target: { value: 'Stock 22' } });
    expect(screen.getByText('Stock 22')).toBeInTheDocument();
    expect(document.body.textContent).toContain('共 1 筆，第 1/1 頁');
    fireEvent.change(search, { target: { value: '' } });

    const next = screen.getAllByRole('button').find((button) => button.querySelector('svg.lucide-chevron-right'));
    expect(next).toBeDefined();
    fireEvent.click(next as HTMLButtonElement);
    expect(document.body.textContent).toContain('共 23 筆，第 2/2 頁');
    fireEvent.click(screen.getByRole('columnheader', { name: /代號/ }));
    expect(document.body.textContent).toContain('共 23 筆，第 2/2 頁');
    const firstPage = screen.getAllByRole('button').find((button) => button.querySelectorAll('svg.lucide-chevron-left').length > 1);
    expect(firstPage).toBeDefined();
    fireEvent.click(firstPage as HTMLButtonElement);
    expect(document.body.textContent).toContain('共 23 筆，第 1/2 頁');

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '10' } });
    expect(document.body.textContent).toContain('共 23 筆，第 1/3 頁');
    const firstRow = screen.getByRole('row', { name: /S00/ });
    fireEvent.click(firstRow);
    expect(mockRouterPush).toHaveBeenCalledWith('/stocks/S00');
  });

  it('shows unavailable and error states for missing or failed standard data', () => {
    mockUseApiData.mockReturnValueOnce({ data: null, loading: true, error: null });
    const view = render(<RankingsPage />);
    expect(view.container.querySelector('.animate-spin')).toBeInTheDocument();
    view.unmount();

    mockUseApiData.mockReturnValueOnce({
      data: { ...rankingResponse, source: 'empty', last_updated: null, coverage: { stocks: 0, total: 10, limitations: ['no quote data'] } },
      loading: false,
      error: null,
    });
    render(<RankingsPage />);
    expect(screen.getByText('Status: unavailable')).toBeInTheDocument();

    mockUseApiData.mockReturnValueOnce({ data: null, loading: false, error: 'offline' });
    render(<RankingsPage />);
    expect(screen.getByText('資料載入失敗：offline')).toBeInTheDocument();
  });

  it('loads alpha candidates, shows score bands, risk labels, metadata, and row navigation', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          makeAlpha({ symbol: 'AAA', alphaScore: 80, confidence: 70, riskLevel: 'Low' }),
          makeAlpha({ symbol: 'BBB', name: 'Beta Co', alphaScore: 60, confidence: 45, riskLevel: 'Medium' }),
          makeAlpha({ symbol: 'CCC', name: 'Gamma Co', alphaScore: 20, confidence: 10, riskLevel: 'High', usedSources: [], missingSources: [] }),
        ],
        regime: 'Bull', regimeConfidence: 75, totalScanned: 90, excludedCount: 87,
        screenParams: { appliedRegimeAdjustment: 'Bull market scaling' },
        limitations: ['Some source rows were unavailable.'],
      }),
    });
    render(<RankingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Alpha 候選' }));

    expect(await screen.findByText('掃描 90 檔')).toBeInTheDocument();
    expect(screen.getByText('候選 3 檔')).toBeInTheDocument();
    expect(screen.getByText('🐂 市場：Bull（75%）')).toBeInTheDocument();
    expect(screen.getByText('Bull market scaling')).toBeInTheDocument();
    expect(screen.getByText('AAA')).toBeInTheDocument();
    expect(screen.getByText('Beta Co')).toBeInTheDocument();
    expect(screen.getByText(/Some source rows were unavailable/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('row', { name: /AAA/ }));
    expect(mockRouterPush).toHaveBeenCalledWith('/stocks/AAA');
    expect(global.fetch).toHaveBeenCalledWith('/api/strategy/screen?maxResults=50');
  });

  it('handles empty and failed alpha screens, with fallback regime and limitation values', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [] }) });
    render(<RankingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Alpha 候選' }));
    expect(await screen.findByText('無 Alpha 候選資料')).toBeInTheDocument();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [makeAlpha({ symbol: 'DEF' })] }),
    });
    fireEvent.click(screen.getByRole('button', { name: '成交量排行' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alpha 候選' }));
    expect(await screen.findByText('無')).toBeInTheDocument();
    expect(document.body.textContent).toContain('❓ 市場：（%）');

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    fireEvent.click(screen.getByRole('button', { name: '成交量排行' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alpha 候選' }));
    expect(await screen.findByText('Alpha 分析失敗：候選股篩選失敗')).toBeInTheDocument();
  });
});
