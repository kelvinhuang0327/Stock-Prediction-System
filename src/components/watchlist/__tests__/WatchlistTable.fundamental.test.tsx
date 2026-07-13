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
        rows={[
          makeRow(),
          makeRow({
            symbol: '2317',
            name: '鴻海',
            analysis: {
              ...makeRow().analysis!,
              stockId: '2317',
              name: '鴻海',
              revenueYoY: 0,
              eps: 0,
            },
          }),
        ]}
        totalCount={2}
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
    expect(screen.getByText('基本面：營收 YoY 0.0% / EPS 0.00')).toBeInTheDocument();
  });

  test('shows revenue cue with explicit EPS-unavailable state', () => {
    render(
      <WatchlistTable
        rows={[
          makeRow({
            analysis: {
              ...makeRow().analysis!,
              revenueYoY: 18.5,
              eps: null,
            } as unknown as NonNullable<WatchlistRowViewModel['analysis']>,
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

    expect(screen.getByText('基本面：營收 YoY +18.5% / EPS 資料不足')).toBeInTheDocument();
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

  test('shows a negative revenue cue alongside the analysis summary', () => {
    render(
      <WatchlistTable
        rows={[
          makeRow({
            analysis: {
              ...makeRow().analysis!,
              revenueYoY: -6.4,
              recommendation: '偏空',
              summary: '營收成長承壓，估值壓力偏高。',
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

    expect(screen.getByText('基本面：營收 YoY -6.4% / EPS 8.20')).toBeInTheDocument();
    expect(screen.getByText(/估值壓力偏高/)).toBeInTheDocument();
  });

  test('shows an explicit fundamental state when analysis is unavailable', () => {
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

    expect(screen.getByText('基本面：分析資料不足')).toBeInTheDocument();
    expect(screen.getByText('分析中...')).toBeInTheDocument();
  });
});
