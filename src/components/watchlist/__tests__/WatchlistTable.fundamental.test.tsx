import { render, screen } from '@testing-library/react';
import { WatchlistTable } from '../WatchlistTable';
import type { WatchlistRowViewModel } from '@/types/watchlist';

const makeRow = (overrides: Partial<WatchlistRowViewModel> = {}): WatchlistRowViewModel => ({
  symbol: '2330',
  name: '台積電',
  price: 998,
  change: 12,
  changePercent: 1.2,
  volume: 1000,
  weeklyChange: 2.4,
  volumeChange: 30,
  hasQuoteData: true,
  fundamentalOverlay: {
    riskLevel: 'moderate',
    strengths: [],
    pressures: [],
    valuationContext: '估值大致接近同組中位水準。',
    growthContext: '同組相對位置中性，尚無明確基本面優勢。',
    summary: '同組相對位置中性，尚無明顯基本面優勢。',
    limitations: [],
  },
  analysis: {
    stockId: '2330',
    name: '台積電',
    revenueYoY: 18.5,
    eps: 8.2,
    chipStrength: 70,
    technicalScore: 78,
    reason: '測試',
    closePrice: 998,
    priceChangePercent: 1.2,
    calculatedScore: 82,
    summary: '測試摘要',
    recommendation: '偏多',
    missingSources: [],
  },
  marketValue: 0,
  costBasis: 0,
  profitLoss: 0,
  profitLossPercent: 0,
  hasHoldings: false,
  ...overrides,
});

describe('WatchlistTable fundamental cue', () => {
  test('shows revenue YoY cue when basic fundamental data exists', () => {
    render(
      <WatchlistTable
        rows={[makeRow()]}
        totalCount={1}
        searchQuery=""
        sortConfig={{ key: 'symbol', dir: 'asc' }}
        onSearchChange={jest.fn()}
        onSort={jest.fn()}
        onEditHoldings={jest.fn()}
        onSetAlert={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText(/基本面：營收 YoY \+18.5% \/ EPS 8.20/i)).toBeInTheDocument();
  });

  test('shows degraded cue when revenue data is unavailable', () => {
    render(
      <WatchlistTable
        rows={[
          makeRow({
            analysis: {
              ...makeRow().analysis!,
              revenueYoY: null,
              eps: 0,
              missingSources: ['MonthlyRevenue（不足 13 個月，無法計算 YoY）'],
            },
          }),
        ]}
        totalCount={1}
        searchQuery=""
        sortConfig={{ key: 'symbol', dir: 'asc' }}
        onSearchChange={jest.fn()}
        onSort={jest.fn()}
        onEditHoldings={jest.fn()}
        onSetAlert={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText('基本面：營收資料不足')).toBeInTheDocument();
  });

  test('shows fundamental overlay badge and summary', () => {
    render(
      <WatchlistTable
        rows={[
          makeRow({
            fundamentalOverlay: {
              ...makeRow().fundamentalOverlay!,
              riskLevel: 'elevated',
              summary: '同組成長表現不差，但估值壓力偏高，宜保守看待追價風險。',
            },
          }),
        ]}
        totalCount={1}
        searchQuery=""
        sortConfig={{ key: 'symbol', dir: 'asc' }}
        onSearchChange={jest.fn()}
        onSort={jest.fn()}
        onEditHoldings={jest.fn()}
        onSetAlert={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText('基本面壓力')).toBeInTheDocument();
    expect(screen.getByText(/估值壓力偏高/)).toBeInTheDocument();
  });

  test('still shows overlay when analysis is unavailable', () => {
    render(
      <WatchlistTable
        rows={[
          makeRow({
            analysis: null,
          }),
        ]}
        totalCount={1}
        searchQuery=""
        sortConfig={{ key: 'symbol', dir: 'asc' }}
        onSearchChange={jest.fn()}
        onSort={jest.fn()}
        onEditHoldings={jest.fn()}
        onSetAlert={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText('基本面中性')).toBeInTheDocument();
    expect(screen.getByText(/同組相對位置中性/)).toBeInTheDocument();
  });
});
