import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IndicatorsPage from '../page';
import type { StockDataWithIndicators } from '@/types/stock';

const mockCalculateAllIndicators = jest.fn();

jest.mock('@/lib/technicalIndicators', () => ({
  calculateAllIndicators: (...args: unknown[]) => mockCalculateAllIndicators(...args),
  calculateIchimoku: (data: unknown) => data,
  calculateParabolicSAR: (data: unknown) => data,
  calculateADX: (data: unknown) => data,
  calculateStochRSI: (data: unknown) => data,
  calculateVWAP: (data: unknown) => data,
  calculateMFI: (data: unknown) => data,
  calculateCMF: (data: unknown) => data,
  calculatePivotPoints: (data: unknown) => data,
}));

const bullishRows: StockDataWithIndicators[] = [
  {
    date: '2026-03-02', open: 90, high: 110, low: 80, close: 90, volume: 1000,
    obv: 1_500_000,
  },
  {
    date: '2026-03-03', open: 95, high: 120, low: 85, close: 100, volume: 2000,
    dif: 2, dem: 1, adx: 30, plusDI: 35, minusDI: 20, sar: 90,
    tenkanSen: 60, kijunSen: 50, ma5: 95, ma20: 90, ma60: 80,
    rsi: 75, stochRsiK: 90, k: 85, d: 80, williamsR: -10, cci: 150,
    bbUpper: 110, bbLower: 90, atr: 3, obv: 2_500_000, vwap: 95, mfi: 10, cmf: 0.5,
  },
];

const bearishRows: StockDataWithIndicators[] = [
  {
    date: '2026-03-02', open: 105, high: 110, low: 90, close: 105, volume: 1000,
    obv: 2_000_000,
  },
  {
    date: '2026-03-03', open: 90, high: 100, low: 80, close: 100, volume: 2000,
    dif: -2, dem: -1, adx: 30, plusDI: 15, minusDI: 35, sar: 110,
    tenkanSen: 40, kijunSen: 50, ma5: 105, ma20: 110, ma60: 120,
    rsi: 30, stochRsiK: 10, k: 10, d: 20, williamsR: -90, cci: -150,
    bbUpper: 120, bbLower: 110, atr: 0, obv: 1_000_000, vwap: 105, mfi: 90, cmf: -0.25,
  },
];

function setupFetch(options: {
  historyOk?: boolean;
  history?: unknown;
  institutionalOk?: boolean;
  institutional?: unknown;
  institutionalError?: Error;
} = {}) {
  const fetchMock = jest.fn(async (input: string) => {
    if (input.includes('/history?months=3')) {
      return {
        ok: options.historyOk ?? true,
        status: 503,
        statusText: 'Unavailable',
        json: async () => options.history ?? [{ date: '2026-03-03', open: 95, high: 120, low: 85, close: 100, volume: 2000 }],
      };
    }
    if (input.endsWith('/institutional')) {
      if (options.institutionalError) throw options.institutionalError;
      return {
        ok: options.institutionalOk ?? true,
        json: async () => options.institutional ?? {
          success: true,
          data: { foreignInvestors: 1500, investmentTrusts: -2000, dealers: 0, total: 1000 },
        },
      };
    }
    return { ok: false, status: 404, statusText: 'Not found', json: async () => ({}) };
  });
  global.fetch = fetchMock;
  return fetchMock;
}

describe('IndicatorsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculateAllIndicators.mockImplementation(() => bullishRows);
  });

  it('renders bullish, overbought, oversold, and institutional indicators across categories', async () => {
    setupFetch();
    render(<IndicatorsPage />);

    expect(await screen.findByText('MACD')).toBeInTheDocument();
    expect(screen.getByText('DIF: 2.00, DEM: 1.00')).toBeInTheDocument();
    expect(screen.getByText('2.50M')).toBeInTheDocument();
    expect(screen.getByText('+1.5K 股')).toBeInTheDocument();
    expect(screen.getByText('-2.0K 股')).toBeInTheDocument();
    expect(screen.getAllByText('多頭').length).toBeGreaterThan(0);
    expect(screen.getAllByText('超買').length).toBeGreaterThan(0);
    expect(screen.getAllByText('超賣').length).toBeGreaterThan(0);
    expect(mockCalculateAllIndicators).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ date: '2026-03-03', close: 100 }),
    ]));

    fireEvent.click(screen.getByRole('button', { name: '法人籌碼' }));
    expect(screen.getByText('外資買賣超')).toBeInTheDocument();
    expect(screen.getByText('三大法人合計')).toBeInTheDocument();
    expect(screen.queryByText('MACD')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '趨勢' }));
    expect(screen.getByText('MACD')).toBeInTheDocument();
    expect(screen.queryByText('RSI')).not.toBeInTheDocument();
  });

  it('covers bearish and neutral signals, missing values, and non-positive flow metrics', async () => {
    mockCalculateAllIndicators.mockImplementation(() => bearishRows);
    const fetchMock = setupFetch({
      institutional: { success: true, data: { foreignInvestors: -1500, investmentTrusts: -1, dealers: 2000, total: -2000 } },
    });
    render(<IndicatorsPage />);

    expect((await screen.findAllByText('空頭')).length).toBeGreaterThan(0);
    expect(screen.getByText('外資買賣超')).toBeInTheDocument();
    expect(screen.getByText('-1.5K 股')).toBeInTheDocument();
    expect(screen.getAllByText('中性').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('股票代號'), { target: { value: '2317' } });
    fireEvent.click(screen.getByRole('button', { name: '分析' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/stocks/2317/history?months=3'));
    expect(mockCalculateAllIndicators).toHaveBeenCalledTimes(2);
  });

  it('handles missing market history and the no-indicator category state', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = setupFetch({ history: { data: [] } });
    render(<IndicatorsPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/stocks/2330/institutional'));
    expect(mockCalculateAllIndicators).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '全部' })).toBeInTheDocument();
    expect(screen.queryByText('MACD')).not.toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs history and institutional request failures without leaving the loading state active', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const fetchMock = setupFetch({ historyOk: false, institutionalError: new Error('offline') });
    render(<IndicatorsPage />);

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to fetch data: 503' })));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('載入中...')).not.toBeInTheDocument();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('silently skips unsuccessful institutional responses and logs institution transport errors', async () => {
    setupFetch({
      institutionalOk: false,
      institutional: { success: false, data: {} },
    });
    render(<IndicatorsPage />);
    expect(await screen.findByText('MACD')).toBeInTheDocument();
    expect(screen.queryByText('外資買賣超')).not.toBeInTheDocument();

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    setupFetch({ institutionalError: new Error('institution service offline') });
    fireEvent.change(screen.getByPlaceholderText('股票代號'), { target: { value: '2603' } });
    fireEvent.click(screen.getByRole('button', { name: '分析' }));
    await waitFor(() => expect(logSpy).toHaveBeenCalledWith('Institutional data not available'));
  });
});
