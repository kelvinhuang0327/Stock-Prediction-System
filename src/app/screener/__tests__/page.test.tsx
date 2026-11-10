import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ScreenerPage from '../page';
import type { Stock } from '@/lib/mockData';

const mockFilterStocks = jest.fn();

jest.mock('@/lib/stockService', () => ({
  stockService: { filterStocks: (...args: unknown[]) => mockFilterStocks(...args) },
}));

const stocks: Stock[] = [
  {
    symbol: '2330', name: '台積電', price: 1000, change: 10, changePercent: 1,
    volume: 2000, pe: 0, dividendYield: 0, rsi: 0, macd: 0,
  },
  {
    symbol: '2317', name: '鴻海', price: 200, change: -5, changePercent: -2.5,
    volume: 5000, pe: 15.25, dividendYield: 3.2, rsi: 75, macd: 1.5,
  },
  {
    symbol: '2603', name: '長榮', price: 150, change: 0, changePercent: 0,
    volume: 100, pe: undefined, dividendYield: undefined, rsi: 25, macd: -1.25,
  },
];

describe('ScreenerPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFilterStocks.mockResolvedValue(stocks);
  });

  it('loads stocks, formats optional metrics, and supports ascending and descending sorting', async () => {
    render(<ScreenerPage />);

    expect(await screen.findByText('台積電')).toBeInTheDocument();
    expect(screen.queryByText('沒有符合條件的股票')).not.toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    expect(screen.getByText('+1.00%')).toBeInTheDocument();
    expect(screen.getByText('-2.50%')).toBeInTheDocument();

    const body = screen.getByRole('table').querySelector('tbody');
    expect(body).not.toBeNull();
    expect(within(body as HTMLElement).getAllByRole('row').map((row) => row.firstChild?.textContent)).toEqual([
      '2330', '2603', '2317',
    ]);

    fireEvent.click(screen.getByRole('columnheader', { name: /漲跌幅/ }));
    expect(within(body as HTMLElement).getAllByRole('row').map((row) => row.firstChild?.textContent)).toEqual([
      '2317', '2603', '2330',
    ]);
    fireEvent.click(screen.getByRole('columnheader', { name: /漲跌幅/ }));
    expect(within(body as HTMLElement).getAllByRole('row').map((row) => row.firstChild?.textContent)).toEqual([
      '2330', '2603', '2317',
    ]);
    fireEvent.click(screen.getByRole('columnheader', { name: /代號/ }));
    expect(within(body as HTMLElement).getAllByRole('row').map((row) => row.firstChild?.textContent)).toEqual([
      '2603', '2330', '2317',
    ]);
    fireEvent.click(screen.getByRole('columnheader', { name: /代號/ }));
    expect(within(body as HTMLElement).getAllByRole('row').map((row) => row.firstChild?.textContent)).toEqual([
      '2317', '2330', '2603',
    ]);
    for (const label of ['成交價', '成交量', '本益比', '殖利率', 'RSI', 'MACD']) {
      fireEvent.click(screen.getByRole('columnheader', { name: new RegExp(label) }));
    }
  });

  it('submits selected filters and restores the original result set on reset', async () => {
    render(<ScreenerPage />);
    await screen.findByText('台積電');

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'semiconductor' } });
    const minimums = screen.getAllByPlaceholderText('最低');
    const maximums = screen.getAllByPlaceholderText('最高');
    fireEvent.change(minimums[0], { target: { value: '100' } });
    fireEvent.change(maximums[0], { target: { value: '2000' } });
    fireEvent.change(minimums[1], { target: { value: '5' } });
    fireEvent.change(maximums[1], { target: { value: '30' } });
    fireEvent.change(screen.getByPlaceholderText('例: 3'), { target: { value: '2' } });
    fireEvent.change(screen.getByPlaceholderText('例: 1000'), { target: { value: '500' } });
    fireEvent.change(minimums[2], { target: { value: '-5' } });
    fireEvent.change(maximums[2], { target: { value: '10' } });
    fireEvent.change(minimums[3], { target: { value: '20' } });
    fireEvent.change(maximums[3], { target: { value: '80' } });
    fireEvent.change(screen.getByDisplayValue('MACD 訊號'), { target: { value: 'bullish' } });
    fireEvent.change(screen.getByDisplayValue('均線訊號'), { target: { value: 'bullishCross' } });
    fireEvent.click(screen.getByRole('button', { name: '搜尋' }));

    await waitFor(() => expect(mockFilterStocks).toHaveBeenLastCalledWith(expect.objectContaining({
      sector: 'semiconductor', minPrice: 100, maxPrice: 2000, minPE: 5, maxPE: 30,
      minDividendYield: 2, minVolume: 500, minChangePercent: -5, maxChangePercent: 10,
      minRSI: 20, maxRSI: 80, macdSignal: 'bullish', maSignal: 'bullishCross',
    })));

    fireEvent.click(screen.getByRole('button', { name: '重置' }));
    expect(screen.getByDisplayValue('全部類股')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('篩選結果 (3 檔股票)')).toBeInTheDocument());
  });

  it('shows empty states and exports the visible rows as CSV', async () => {
    mockFilterStocks.mockResolvedValueOnce([]);
    const emptyView = render(<ScreenerPage />);
    expect(await screen.findByText('沒有符合條件的股票')).toBeInTheDocument();

    emptyView.unmount();
    mockFilterStocks.mockResolvedValue(stocks);
    render(<ScreenerPage />);
    expect(await screen.findByText('台積電')).toBeInTheDocument();

    const createObjectURL = jest.fn(() => 'blob:screen-results');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: '匯出 CSV' }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toMatch(/^stock-screener-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
