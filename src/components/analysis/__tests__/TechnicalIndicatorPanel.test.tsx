import { fireEvent, render, screen } from '@testing-library/react';
import { TechnicalIndicatorPanel } from '../TechnicalIndicatorPanel';
import {
  calculateADX,
  calculateAllIndicators,
  calculateCMF,
  calculateIchimoku,
  calculateMFI,
  calculateParabolicSAR,
  calculatePivotPoints,
  calculateStochRSI,
  calculateVWAP,
} from '@/lib/technicalIndicators';
import type { StockDataWithIndicators } from '@/types/stock';

jest.mock('@/lib/technicalIndicators', () => ({
  calculateAllIndicators: jest.fn(),
  calculateIchimoku: jest.fn(),
  calculateParabolicSAR: jest.fn(),
  calculateADX: jest.fn(),
  calculateStochRSI: jest.fn(),
  calculateVWAP: jest.fn(),
  calculateMFI: jest.fn(),
  calculateCMF: jest.fn(),
  calculatePivotPoints: jest.fn(),
}));

const calculations = [
  calculateAllIndicators,
  calculateIchimoku,
  calculateParabolicSAR,
  calculateADX,
  calculateStochRSI,
  calculateVWAP,
  calculateMFI,
  calculateCMF,
  calculatePivotPoints,
].map((calculate) => jest.mocked(calculate));

const base: StockDataWithIndicators = {
  date: '2026-06-01',
  open: 100,
  high: 110,
  low: 90,
  close: 100,
  volume: 1000,
};

function renderPanel(overrides: Partial<StockDataWithIndicators> = {}) {
  for (const calculate of calculations) {
    calculate.mockReturnValue([{ ...base, ...overrides }]);
  }
  return render(<TechnicalIndicatorPanel data={[base]} symbol="2330" />);
}

describe('TechnicalIndicatorPanel', () => {
  beforeEach(() => {
    for (const calculate of calculations) calculate.mockReset();
  });

  it('shows the empty state without calling indicator calculators', () => {
    render(<TechnicalIndicatorPanel data={[]} />);

    expect(screen.getByText('無法載入技術指標資料')).toBeInTheDocument();
    expect(calculateAllIndicators).not.toHaveBeenCalled();
  });

  it('covers missing measurements and the neutral MACD and ADX paths', () => {
    renderPanel();

    expect(screen.getByText('技術指標分析')).toBeInTheDocument();
    expect(screen.getByText('2330 · 共 19 項指標')).toBeInTheDocument();
    expect(screen.getByText('綜合訊號').parentElement).toHaveTextContent('Sell');
    expect(screen.getAllByText('--').length).toBeGreaterThan(10);
    expect(screen.getByText('💡 技術指標僅供參考，請搭配基本面與市場情緒綜合判斷')).toBeInTheDocument();
  });

  it('renders the indicator categories and filters each category tab', () => {
    renderPanel({
      ma5: 90,
      ma20: 80,
      ma60: 120,
      tenkanSen: 110,
      kijunSen: 130,
      sar: 80,
      adx: 30,
      vwap: 90,
      rsi: 50,
      stochRsiK: 50,
      k: 50,
      d: 50,
      williamsR: -50,
      cci: 0,
      dif: 2,
      dem: 1,
      osc: 2,
      obv: 2_000_000,
      mfi: 50,
      cmf: 0.2,
      atr: 3,
      bbUpper: 90,
      bbMiddle: 100,
      bbLower: 110,
      pivotPoint: 100,
      pivotR1: 110,
      pivotR2: 120,
      pivotS1: 90,
      pivotS2: 80,
    });

    expect(screen.getByText('趨勢指標')).toBeInTheDocument();
    expect(screen.getByText('動量指標')).toBeInTheDocument();
    expect(screen.getByText('成交量指標')).toBeInTheDocument();
    expect(screen.getByText('波動指標')).toBeInTheDocument();
    expect(screen.getByText('支撐/阻力位')).toBeInTheDocument();
    expect(screen.getByText('Buy')).toBeInTheDocument();
    expect(screen.getByText('Overbought')).toBeInTheDocument();
    expect(screen.getByText('2.00M')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '趨勢' }));
    expect(screen.getByText('MA5')).toBeInTheDocument();
    expect(screen.queryByText('RSI (14)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '動量' }));
    expect(screen.getByText('RSI (14)')).toBeInTheDocument();
    expect(screen.queryByText('成交量指標')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '成交量' }));
    expect(screen.getByText('OBV')).toBeInTheDocument();
    expect(screen.queryByText('波動指標')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '波動' }));
    expect(screen.getByText('布林上軌')).toBeInTheDocument();
    expect(screen.queryByText('支撐/阻力位')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '支撐/阻力' }));
    expect(screen.getByText('Pivot Point')).toBeInTheDocument();
    expect(screen.queryByText('動量指標')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    expect(screen.getByText('動量指標')).toBeInTheDocument();
    expect(screen.getByText('支撐/阻力位')).toBeInTheDocument();
  });

  it('handles zero and below-threshold values, oversold inputs, and neutral trend strength', () => {
    renderPanel({
      close: 0,
      ma5: -1,
      ma20: -1,
      ma60: -1,
      tenkanSen: -1,
      kijunSen: -1,
      sar: -1,
      adx: 25,
      vwap: -1,
      rsi: 0,
      stochRsiK: 0,
      k: 0,
      d: 0,
      williamsR: 0,
      cci: 0,
      dif: 0,
      dem: 0,
      osc: 0,
      obv: 0,
      mfi: 0,
      cmf: 0,
      atr: 0,
      bbUpper: 0,
      bbMiddle: 0,
      bbLower: 0,
      pivotPoint: 0,
      pivotR1: 0,
      pivotR2: 0,
      pivotS1: 0,
      pivotS2: 0,
    });

    expect(screen.getByText('Buy')).toBeInTheDocument();
    expect(screen.getAllByText('Oversold').length).toBeGreaterThan(2);
    expect(screen.getAllByText('Bearish').length).toBeGreaterThan(0);
    expect(screen.getByText('K值').parentElement).toHaveTextContent('Oversold');
  });

  it('keeps indicator signals neutral between thresholds and bearish for a falling MACD', () => {
    renderPanel({
      ma5: 110,
      ma20: 110,
      ma60: 110,
      tenkanSen: 110,
      kijunSen: 110,
      sar: 110,
      adx: 10,
      vwap: 110,
      rsi: 50,
      stochRsiK: 50,
      k: 50,
      d: 50,
      williamsR: -50,
      cci: 0,
      dif: -2,
      dem: -1,
      osc: -1,
      obv: 1,
      mfi: 50,
      cmf: -0.2,
      bbUpper: 150,
      bbLower: 50,
    });

    expect(screen.getByText('Sell')).toBeInTheDocument();
    expect(screen.getAllByText('Bearish').length).toBeGreaterThan(2);
    expect(screen.getAllByText('Neutral').length).toBeGreaterThan(5);
  });
});
