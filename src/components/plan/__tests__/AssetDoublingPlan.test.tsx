import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssetDoublingPlan } from '../AssetDoublingPlan';
import type { ScreeningResult } from '@/lib/strategies/types';

jest.mock('../BacktestDashboard', () => ({ BacktestDashboard: () => <div>Backtest dashboard</div> }));
jest.mock('../ProTraderDashboard', () => ({ ProTraderDashboard: () => <div>Pro trader dashboard</div> }));
jest.mock('@/components/analysis/SectorRotationMap', () => ({ SectorRotationMap: () => <div>Sector rotation map</div> }));
jest.mock('@/components/charts/InteractiveLineChart', () => ({
  InteractiveLineChart: ({ data }: { data: unknown[] }) => <div>History chart ({data.length})</div>,
}));

const makeCandidate = (overrides: Partial<ScreeningResult> = {}): ScreeningResult => ({
  stockId: '2330',
  name: '台積電',
  revenueYoY: 35,
  eps: 12,
  chipStrength: 82,
  technicalScore: 90,
  reason: 'Revenue and trend are improving.',
  closePrice: 998,
  potentialLabel: '💎 潛力珍珠',
  climbPercent: 12,
  rsScore: 88,
  suggestedPositionSize: 3,
  kellyPositionPct: 20,
  kellyRisk: 'LOW',
  riskPerShare: 25,
  concentrationHistory: [20, 30, 45],
  ...overrides,
});

const makeWatchlistItem = (stockId = '2330') => ({
  stockId,
  name: stockId === '2330' ? '台積電' : '鴻海',
  changePercent: 1.2,
  entryPrice: 950,
  currentPrice: 998,
});

function setupFetch() {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  let watchlist: ReturnType<typeof makeWatchlistItem>[] = [];
  let marketStatus: Record<string, unknown> | null = {
    status: 'Bull', scalingFactor: 1, indexClose: 20000, regime: 'BULL', ma20: 19800,
  };
  let screenPayload: unknown = { candidates: [makeCandidate()] };

  fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
    if (input === '/api/watchlist' && init?.method === 'POST') {
      watchlist = [makeWatchlistItem()];
      return { ok: false, json: async () => ({}) };
    }
    if (input === '/api/watchlist') return { ok: true, json: async () => watchlist };
    if (input === '/api/market-status') return { ok: marketStatus !== null, json: async () => marketStatus };
    if (input === '/api/strategy/screen') return { ok: true, json: async () => screenPayload };
    if (input === '/api/strategy/analyze') return { ok: true, json: async () => makeCandidate() };
    if (input.includes('/history?months=6')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { date: '2026-01-01', close: 100 },
            { date: '2026-02-01', close: 105 },
          ],
        }),
      };
    }
    if (input.startsWith('/api/sentiment/analyze')) {
      return { ok: true, json: async () => ({ score: 25, label: 'Positive', headline: 'Demand is improving', factors: ['Revenue growth'] }) };
    }
    if (input.startsWith('/api/watchlist/') && init?.method === 'DELETE') {
      watchlist = [];
      return { ok: false, json: async () => ({}) };
    }
    return { ok: false, json: async () => ({}) };
  });

  return {
    fetchMock,
    setWatchlist(value: ReturnType<typeof makeWatchlistItem>[]) { watchlist = value; },
    setMarketStatus(value: Record<string, unknown> | null) { marketStatus = value; },
    setScreenPayload(value: unknown) { screenPayload = value; },
  };
}

describe('AssetDoublingPlan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders market conditions, candidates, filters, stages, and professional mode', async () => {
    const api = setupFetch();
    api.setScreenPayload([
      makeCandidate(),
      makeCandidate({ stockId: '2317', name: '鴻海', potentialLabel: '🚀 強勢發動', revenueYoY: 20, climbPercent: 25 }),
      makeCandidate({
        stockId: '2603', name: '長榮', potentialLabel: '投信連續買超', kellyRisk: 'HIGH',
        anomaly: { type: 'TRUST_ACCUMULATION', severity: 'MEDIUM', score: 0, description: 'Trust buying is increasing.' },
      }),
      makeCandidate({ stockId: '2881', name: '富邦金', potentialLabel: '⚠️ 注意風險', kellyRisk: 'EXTREME' }),
      makeCandidate({ stockId: '0050', name: '元大台灣50', potentialLabel: undefined, isETF: true, concentrationHistory: [] }),
    ]);

    render(<AssetDoublingPlan />);

    expect(await screen.findByText('台積電')).toBeInTheDocument();
    expect(screen.getByText('Market Climate')).toBeInTheDocument();
    expect(screen.getByText('TAIEX: 20000 (MA20: 19800)')).toBeInTheDocument();
    expect(screen.getAllByText(/🥇35/).length).toBeGreaterThan(0);
    expect(screen.getByText('分析中')).toBeInTheDocument();
    expect(screen.getByText('Score: 0')).toBeInTheDocument();

    fireEvent.click(screen.getByText('第二階段'));
    fireEvent.click(screen.getByRole('button', { name: '💎 潛力珍珠' }));
    expect(screen.getByText('台積電')).toBeInTheDocument();
    expect(screen.queryByText('鴻海')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '🚀 強勢發動' }));
    expect(screen.getByText('鴻海')).toBeInTheDocument();
    expect(screen.queryByText('台積電')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Pro Mode' }));
    expect(screen.getByText('Pro trader dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Sector rotation map')).not.toBeInTheDocument();
    expect(api.fetchMock).toHaveBeenCalledWith('/api/strategy/screen', expect.objectContaining({ method: 'POST' }));
  });

  it('handles wrapped candidate data, screening failures, and empty filtered results', async () => {
    const api = setupFetch();
    api.setScreenPayload({ candidates: [] });
    const view = render(<AssetDoublingPlan />);

    expect(await screen.findByText('查無符合條件之標的')).toBeInTheDocument();
    api.fetchMock.mockImplementation(async (input: string) => {
      if (input === '/api/watchlist') return { ok: true, json: async () => [] };
      if (input === '/api/market-status') return { ok: false, json: async () => ({}) };
      if (input === '/api/strategy/screen') return { ok: false, json: async () => ({}) };
      return { ok: false, json: async () => ({}) };
    });
    view.unmount();
    render(<AssetDoublingPlan />);

    expect(await screen.findByText('Failed to fetch candidates')).toBeInTheDocument();
    expect(screen.queryByText('Market Climate')).not.toBeInTheDocument();
  });

  it('analyzes a symbol and displays its score, evidence, sentiment, and history', async () => {
    const api = setupFetch();
    api.fetchMock.mockImplementation(async (input: string) => {
      if (input === '/api/watchlist') return { ok: true, json: async () => [] };
      if (input === '/api/market-status') return { ok: false, json: async () => ({}) };
      if (input === '/api/strategy/screen') return { ok: true, json: async () => [] };
      if (input === '/api/strategy/analyze') {
        return {
          ok: true,
          json: async () => makeCandidate({
            name: '分析標的',
            revenueYoY: 60,
            isETF: false,
            chipStrength: 80,
            technicalScore: 75,
            riskScore: 0,
            riskLevel: 'High',
            rsScore: 0,
            backtestEvidence: { date: '2025-11-01', duration: 20, maxGain: 18.5 },
          }),
        };
      }
      if (input.includes('/history?months=6')) return {
        ok: true,
        json: async () => ({
          data: [
            { date: '2026-01-01', close: 100 },
            { date: '2026-02-01', close: 105 },
          ],
        }),
      };
      if (input.startsWith('/api/sentiment/analyze')) {
        return { ok: true, json: async () => ({ score: 25, label: 'Positive', headline: 'Demand is improving', factors: ['Revenue growth'] }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    render(<AssetDoublingPlan />);
    const input = screen.getByPlaceholderText('輸入股票代號 (如: 2330)');
    fireEvent.change(input, { target: { value: '2330' } });
    fireEvent.click(screen.getByRole('button', { name: '開始分析' }));

    expect(await screen.findByText('分析標的')).toBeInTheDocument();
    expect(screen.getByText('18.5%', { exact: false })).toBeInTheDocument();
    expect(await screen.findByText(/AI Analyst Insight/)).toBeInTheDocument();
    expect(screen.getByText('History chart (2)')).toBeInTheDocument();
    expect(screen.getByText(/Score: 25/)).toBeInTheDocument();
    expect(screen.getByText(/回測模擬報酬/)).toBeInTheDocument();
  });

  it('reports analysis errors and tolerates missing history and sentiment data', async () => {
    const api = setupFetch();
    api.fetchMock.mockImplementation(async (input: string) => {
      if (input === '/api/watchlist') return { ok: true, json: async () => [] };
      if (input === '/api/market-status') return { ok: false, json: async () => ({}) };
      if (input === '/api/strategy/screen') return { ok: true, json: async () => [] };
      if (input === '/api/strategy/analyze') return { ok: false, json: async () => ({ error: 'Symbol is unavailable' }) };
      return { ok: false, json: async () => ({}) };
    });
    render(<AssetDoublingPlan />);
    fireEvent.change(screen.getByPlaceholderText('輸入股票代號 (如: 2330)'), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: '開始分析' }));
    expect(await screen.findByText('Symbol is unavailable')).toBeInTheDocument();

    api.fetchMock.mockImplementation(async (input: string) => {
      if (input === '/api/watchlist') return { ok: true, json: async () => [] };
      if (input === '/api/market-status') return { ok: false, json: async () => ({}) };
      if (input === '/api/strategy/screen') return { ok: true, json: async () => [] };
      if (input === '/api/strategy/analyze') return { ok: true, json: async () => makeCandidate({ name: '0050 ETF', isETF: true, revenueYoY: 0, chipStrength: 60, technicalScore: 40 }) };
      return { ok: false, json: async () => ({}) };
    });
    fireEvent.change(screen.getByPlaceholderText('輸入股票代號 (如: 2330)'), { target: { value: '0050' } });
    fireEvent.click(screen.getByRole('button', { name: '開始分析' }));
    expect(await screen.findByText('0050 ETF')).toBeInTheDocument();
    expect(screen.queryByText('AI Analyst Insight')).not.toBeInTheDocument();
    expect(screen.queryByText('History chart (0)')).not.toBeInTheDocument();
  });

  it('adds and removes an analyzed stock from the watchlist and handles portfolio selections', async () => {
    const api = setupFetch();
    api.setWatchlist([makeWatchlistItem('2317')]);
    render(<AssetDoublingPlan />);
    expect(await screen.findByText('1 Positions')).toBeInTheDocument();

    fireEvent.click(screen.getByText('鴻海'));
    await waitFor(() => expect(api.fetchMock).toHaveBeenCalledWith('/api/strategy/analyze', expect.objectContaining({
      body: JSON.stringify({ symbol: '2317' }),
    })));

    fireEvent.change(screen.getByPlaceholderText('輸入股票代號 (如: 2330)'), { target: { value: '2330' } });
    fireEvent.click(screen.getByRole('button', { name: '開始分析' }));
    expect(await screen.findByRole('button', { name: '加入自選' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加入自選' }));
    expect(await screen.findByRole('button', { name: '已加入自選' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '已加入自選' }));
    await waitFor(() => expect(api.fetchMock).toHaveBeenCalledWith('/api/watchlist/2330', { method: 'DELETE' }));
    expect(await screen.findByRole('button', { name: '加入自選' })).toBeInTheDocument();
  });

  it('captures common-data and analysis network errors without crashing', async () => {
    const api = setupFetch();
    api.fetchMock.mockImplementation(async (input: string) => {
      if (input === '/api/watchlist' || input === '/api/market-status') throw new Error('network down');
      if (input === '/api/strategy/screen') throw new Error('screen down');
      if (input === '/api/strategy/analyze') throw new Error('analysis down');
      return { ok: false, json: async () => ({}) };
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<AssetDoublingPlan />);
    expect(await screen.findByText('screen down')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('輸入股票代號 (如: 2330)'), { target: { value: '2330' } });
    fireEvent.click(screen.getByRole('button', { name: '開始分析' }));
    expect(await screen.findByText('analysis down')).toBeInTheDocument();
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Failed to fetch common data', expect.any(Error)));
    expect(api.fetchMock).toHaveBeenCalled();
  });
});
