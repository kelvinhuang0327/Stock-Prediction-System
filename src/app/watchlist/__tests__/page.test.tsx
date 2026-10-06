import { render, screen } from '@testing-library/react';
import WatchlistPage from '../page';

jest.mock('@/hooks/useWatchlistData', () => ({
  useWatchlistData: () => ({
    watchlist: [{ symbol: '2330', name: '台積電' }],
    rows: [],
    searchQuery: '',
    setSearchQuery: jest.fn(),
    sortConfig: { key: 'symbol', direction: 'asc' },
    toggleSort: jest.fn(),
    isAnalyzing: false,
    dbLastUpdated: '2026-03-19T09:00:00.000Z',
    portfolioSummary: {
      totalCost: 0,
      marketValue: 0,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      holdingsCount: 1,
    },
    addStock: jest.fn(),
    removeStock: jest.fn(),
    updateHoldings: jest.fn(),
    refreshAnalysis: jest.fn(),
    migrationStatus: 'ready',
    migrationMessage: '',
    useDbSource: true,
  }),
}));

jest.mock('@/hooks/useWatchlistAlerts', () => ({
  useWatchlistAlerts: () => ({
    alerts: [],
    saveAlert: jest.fn(),
    deleteAlert: jest.fn(),
  }),
}));

jest.mock('@/hooks/useApiData', () => ({
  useApiData: () => ({ data: null }),
}));

jest.mock('@/components/watchlist/WatchlistToolbar', () => ({
  WatchlistToolbar: () => <div>WatchlistToolbar</div>,
}));

jest.mock('@/components/watchlist/WatchlistSummaryCards', () => ({
  WatchlistSummaryCards: () => <div>WatchlistSummaryCards</div>,
}));

jest.mock('@/components/watchlist/WatchlistTable', () => ({
  WatchlistTable: () => <div>WatchlistTable</div>,
}));

jest.mock('@/components/watchlist/WatchlistAlertsPanel', () => ({
  WatchlistAlertsPanel: () => <div>WatchlistAlertsPanel</div>,
}));

jest.mock('@/components/watchlist/AddStockDialog', () => ({
  AddStockDialog: () => null,
}));

jest.mock('@/components/watchlist/PriceAlertDialog', () => ({
  PriceAlertDialog: () => null,
}));

jest.mock('@/components/watchlist/EditHoldingsDialog', () => ({
  EditHoldingsDialog: () => null,
}));

jest.mock('@/components/relevance/RelevantInsightsPanel', () => ({
  RelevantInsightsPanel: ({ title, description }: { title: string; description: string }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

describe('/watchlist page', () => {
  it('renders the lightweight relevant insights section near portfolio context', () => {
    const { container } = render(<WatchlistPage />);

    expect(screen.getByText('組合風險與集中度')).toBeInTheDocument();
    expect(screen.getByText('持倉最值得關注')).toBeInTheDocument();
    expect(screen.getByText('WatchlistTable')).toBeInTheDocument();
    expect(container.querySelector('#watchlist-portfolio-context')).toBeInTheDocument();
  });

  it('does not crash when watchlist snapshot data is unavailable', () => {
    render(<WatchlistPage />);

    expect(screen.getByText('載入中...')).toBeInTheDocument();
    expect(screen.getByText('持倉最值得關注')).toBeInTheDocument();
  });
});
