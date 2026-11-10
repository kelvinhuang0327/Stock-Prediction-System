import { render, screen } from '@testing-library/react';
import { TechnicalIndicators } from '../TechnicalIndicators';
import { calculateAllIndicators } from '@/lib/technicalIndicators';
import type { StockDataPoint, StockDataWithIndicators } from '@/types/stock';

jest.mock('@/lib/technicalIndicators', () => ({
  calculateAllIndicators: jest.fn(),
}));

const calculateAllIndicatorsMock = jest.mocked(calculateAllIndicators);
const input: StockDataPoint = {
  date: '2026-06-01',
  open: 100,
  high: 110,
  low: 90,
  close: 100,
  volume: 1000,
};

function renderWithIndicators(overrides: Partial<StockDataWithIndicators>) {
  const latest: StockDataWithIndicators = { ...input, ...overrides };
  calculateAllIndicatorsMock.mockReturnValue([latest]);
  return render(<TechnicalIndicators symbol="2330" data={[input]} />);
}

describe('TechnicalIndicators', () => {
  beforeEach(() => {
    calculateAllIndicatorsMock.mockReset();
  });

  it('shows the empty state when history is missing', () => {
    const { rerender } = render(<TechnicalIndicators symbol="2330" />);

    expect(screen.getByText('暫無足夠歷史數據進行技術分析')).toBeInTheDocument();
    expect(screen.getByText('Neutral')).toBeInTheDocument();

    rerender(<TechnicalIndicators symbol="2330" data={[]} />);
    expect(screen.getByText('暫無足夠歷史數據進行技術分析')).toBeInTheDocument();
    expect(calculateAllIndicatorsMock).not.toHaveBeenCalled();
  });

  it('keeps zero values, equal moving averages, and neutral MACD neutral', () => {
    renderWithIndicators({
      close: 0,
      rsi: 0,
      dif: 0,
      ma20: 0,
      ma60: 0,
      k: 0,
      d: 0,
      atr: 0,
      williamsR: 0,
      cci: 0,
    });

    expect(screen.getAllByText('0.00')).toHaveLength(7);
    expect(screen.getByText('K:0.0 D:0.0')).toBeInTheDocument();
    expect(screen.getAllByText('Oversold')).toHaveLength(2);
    expect(screen.getByText('Overbought')).toBeInTheDocument();
    expect(screen.getByText('AI 綜合分析')).toBeInTheDocument();
    expect(screen.getAllByText('Neutral')).toHaveLength(6);
  });

  it('renders bullish and overbought indicator signals', () => {
    renderWithIndicators({
      close: 110,
      rsi: 80,
      dif: 5,
      ma20: 100,
      ma60: 120,
      k: 85,
      d: 82,
      atr: 5,
      williamsR: -10,
      cci: 120,
    });

    expect(screen.getAllByText('Overbought')).toHaveLength(4);
    expect(screen.getAllByText('Bullish')).toHaveLength(3);
    expect(screen.getAllByText('Bearish')).toHaveLength(1);
    expect(screen.getByText(/技術指標顯示多頭趨勢/)).toBeInTheDocument();
  });

  it('renders bearish and oversold indicator signals', () => {
    renderWithIndicators({
      close: 90,
      rsi: 20,
      dif: -5,
      ma20: 100,
      ma60: 80,
      k: 10,
      d: 15,
      atr: 5,
      williamsR: -90,
      cci: -120,
    });

    expect(screen.getAllByText('Oversold')).toHaveLength(4);
    expect(screen.getAllByText('Bullish')).toHaveLength(1);
    expect(screen.getAllByText('Bearish')).toHaveLength(3);
    expect(screen.getByText(/技術指標顯示空頭趨勢/)).toBeInTheDocument();
  });

  it('reports a neutral sentiment when price equals both moving averages', () => {
    renderWithIndicators({
      close: 100,
      rsi: 50,
      dif: 0,
      ma20: 100,
      ma60: 100,
      k: 50,
      d: 50,
      atr: 0,
      williamsR: -50,
      cci: 0,
    });

    expect(screen.getAllByText('Neutral')).toHaveLength(9);
    expect(screen.getByText(/技術指標呈現中性/)).toBeInTheDocument();
  });

  it('uses N/A for unavailable measurements without treating them as sell signals', () => {
    renderWithIndicators({});

    expect(screen.getAllByText('N/A')).toHaveLength(7);
    expect(screen.getAllByText('Neutral')).toHaveLength(9);
  });
});
