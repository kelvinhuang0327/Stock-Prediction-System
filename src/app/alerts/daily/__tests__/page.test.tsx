import { fireEvent, render, screen } from '@testing-library/react';
import AlertsPage from '../page';

const mockUseApiData = jest.fn();

jest.mock('@/hooks/useApiData', () => ({
  useApiData: (...args: unknown[]) => mockUseApiData(...args),
}));

const alertTypes = [
  'market_regime_changed',
  'candidate_upgraded',
  'candidate_downgraded',
  'alpha_improved',
  'alpha_dropped',
  'watchlist_risk_escalated',
  'newly_insufficient_data',
  'data_quality_warning',
  'comparison_unavailable',
] as const;

const eventTypes = [
  'symbol_new_event',
  'watchlist_new_event',
  'candidate_new_event',
  'market_event_increase',
  'low_trust_event_cluster',
  'catalyst_watch',
  'no_recent_event',
  'topic_surging',
  'theme_diffusing',
  'low_trust_theme_noise',
] as const;

function report(overrides: Record<string, unknown> = {}) {
  return {
    reportDate: '2026-11-10',
    summary: 'Daily alert summary',
    overallSeverity: 'warning',
    alerts: alertTypes.map((type, index) => ({
      type,
      severity: (['warning', 'caution', 'info'] as const)[index % 3],
      title: `Alert ${type}`,
      message: `Message ${type}`,
      symbol: index === 0 ? '2330' : undefined,
      previousValue: index === 0 ? 'Bear' : undefined,
      currentValue: index === 0 ? 'Bull' : undefined,
      metadata: index === 0 ? { source: 'snapshot', score: 80 } : undefined,
    })),
    eventAlerts: eventTypes.map((type, index) => ({
      type,
      severity: (['warning', 'caution', 'info'] as const)[index % 3],
      title: `Event ${type}`,
      message: `Event message ${type}`,
      relatedSymbols: index === 0 ? ['2330', '2317'] : [],
      trustLevelSummary: index === 0 ? 'official sources' : undefined,
    })),
    eventAlertSummary: 'Event alert summary',
    comparisonAvailable: false,
    previousSnapshotDate: null,
    limitations: ['Limited event data'],
    generatedAt: '2026-11-10T00:00:00.000Z',
    ...overrides,
  };
}

function setApiState(state: { data: unknown; loading?: boolean; error?: string | null; refetch?: jest.Mock }) {
  mockUseApiData.mockReturnValue({
    data: state.data,
    loading: state.loading ?? false,
    error: state.error ?? null,
    refetch: state.refetch ?? jest.fn(),
  });
}

describe('AlertsPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the loading and retry states', () => {
    setApiState({ data: null, loading: true });
    const { rerender } = render(<AlertsPage />);
    expect(screen.getByText('產生每日提醒...')).toBeInTheDocument();

    const refetch = jest.fn();
    setApiState({ data: null, error: 'service unavailable', refetch });
    rerender(<AlertsPage />);
    expect(screen.getByText('service unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders alert severities and event kinds with filters and expandable evidence', () => {
    const refetch = jest.fn();
    setApiState({ data: report(), refetch });
    render(<AlertsPage />);

    expect(screen.getByText('Daily alert summary')).toBeInTheDocument();
    expect(screen.queryByText(/快照比較中/)).not.toBeInTheDocument();
    expect(screen.getByText('尚無前日快照，升降級提醒不可用。請至每日報告頁建立快照以啟用歷史比較。')).toBeInTheDocument();
    expect(screen.getByText('Event symbol_new_event')).toBeInTheDocument();
    expect(screen.getByText('個股新事件')).toBeInTheDocument();
    expect(screen.getByText('標的：2330, 2317')).toBeInTheDocument();
    expect(screen.getByText('來源可信度：official sources')).toBeInTheDocument();
    expect(screen.getByText('警告')).toBeInTheDocument();
    expect(screen.getByText('Alert market_regime_changed')).toBeInTheDocument();
    expect(screen.getByText('Bear')).toBeInTheDocument();
    expect(screen.getByText('Bull')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '詳細資訊' }));
    expect(screen.getByText('source:')).toBeInTheDocument();
    expect(screen.getByText('snapshot')).toBeInTheDocument();
    expect(screen.getByText('score:')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收起' }));
    expect(screen.queryByText('source:')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /警告/ }));
    expect(screen.queryByText('Alert candidate_upgraded')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /警告/ }));
    expect(screen.getByText('Alert candidate_upgraded')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /市場轉換/ }));
    expect(screen.getByText('Alert market_regime_changed')).toBeInTheDocument();
    expect(screen.queryByText('Alert candidate_upgraded')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /市場轉換/ }));
    fireEvent.click(screen.getByRole('button', { name: /全部 \(9\)/ }));
    fireEvent.click(screen.getByRole('button', { name: /更新/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('handles empty alerts and an unavailable event feed', () => {
    setApiState({ data: report({
      alerts: [],
      eventAlerts: undefined,
      eventAlertSummary: undefined,
      comparisonAvailable: true,
      previousSnapshotDate: '2026-11-09',
    }) });
    render(<AlertsPage />);

    expect(screen.getByText('✓ 與 2026-11-09 快照比較中')).toBeInTheDocument();
    expect(screen.getByText('事件提醒未提供。')).toBeInTheDocument();
    expect(screen.getByText('目前無可用事件提醒（已降級或無明顯變化）。')).toBeInTheDocument();
    expect(screen.getByText('今日無研究提醒')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /比較不可用/ })).not.toBeInTheDocument();
  });
});
