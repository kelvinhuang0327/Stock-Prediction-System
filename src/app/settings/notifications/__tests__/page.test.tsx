import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import NotificationsSettingsPage from '../page';

const mockUseApiData = jest.fn();

jest.mock('@/hooks/useApiData', () => ({
  useApiData: (...args: unknown[]) => mockUseApiData(...args),
}));

const sentAt = new Date().toISOString();

function notificationStatus() {
  return {
    channels: [
      {
        channel: 'webhook', label: 'Webhook primary', payloadType: 'JSON', configured: true,
        targetMasked: 'https://hooks.example...', note: 'Test endpoint',
        lastDelivery: { status: 'failed', sentAt, alertCount: 2, retryCount: 1, errorMessage: 'timeout', reportDate: '2026-11-09' },
      },
      {
        channel: 'line_text', label: 'LINE Notify', payloadType: 'text', configured: false,
        targetMasked: null, lastDelivery: null,
      },
      {
        channel: 'email', label: 'Email', payloadType: 'HTML', configured: true,
        targetMasked: 'k***@example.com', smtpHost: 'smtp.example.com', smtpSecure: true,
        lastDelivery: { status: 'success', sentAt, alertCount: 1, retryCount: 0, errorMessage: null, reportDate: null },
      },
      {
        channel: 'custom', label: 'Custom', payloadType: 'custom', configured: false,
        targetMasked: 'configured (token hidden)', lastDelivery: null,
      },
    ],
    stats24h: { total: 9, success: 6, failed: 2, skipped: 1 },
    lastAlertDelivery: { sentAt, reportDate: '2026-11-09', alertCount: 4, status: 'success' },
    sendWhenEmpty: true,
    generatedAt: sentAt,
  };
}

function deliveryLogs(total = 16) {
  const targets = [
    'https://hooks.example.com/webhook?token=private',
    'test@example.com',
    'configured (token hidden)',
    'unconfigured',
    'http not a valid url',
  ];
  return {
    total,
    returned: total,
    stats: { byStatus: { success: 10, failed: 4, skipped: 2 }, byChannel: { webhook: 8, email: 5, line_text: 3 } },
    logs: Array.from({ length: total }, (_, index) => ({
      id: 100 + index,
      channel: ['webhook', 'email', 'line_text', 'custom'][index % 4],
      target: targets[index % targets.length],
      payloadType: 'daily_alert',
      status: ['failed', 'success', 'skipped'][index % 3],
      errorMessage: index === 0 ? 'remote rejected request' : null,
      sentAt,
      retryCount: index === 0 ? 2 : 0,
      alertCount: index + 1,
      reportDate: index === 0 ? null : '2026-11-09',
      metadata: index === 0 ? { source: 'daily-alert', attempt: 2 } : null,
    })),
  };
}

let statusState: Record<string, unknown>;
let logState: Record<string, unknown>;

function setApiStates(status: Record<string, unknown>, logs: Record<string, unknown>) {
  statusState = status;
  logState = logs;
  mockUseApiData.mockImplementation((url: string) => url.includes('/delivery-log') ? logState : statusState);
}

function fetchResponse(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload } as Response;
}

describe('NotificationsSettingsPage', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    setApiStates(
      { data: notificationStatus(), loading: false, error: null, refetch: jest.fn() },
      { data: deliveryLogs(), loading: false, refetch: jest.fn() },
    );
    global.fetch = jest.fn(async () => fetchResponse({ channels: [] }));
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('renders configured channel details, delivery activity, and masked destinations', () => {
    render(<NotificationsSettingsPage />);

    expect(screen.getByText('通知設定')).toBeInTheDocument();
    expect(screen.getByText('Webhook primary')).toBeInTheDocument();
    expect(screen.getAllByText('LINE Notify').length).toBeGreaterThan(0);
    expect(screen.getByText(/smtp\.example\.com:587/)).toBeInTheDocument();
    expect(screen.getByText(/smtp\.example\.com:587 \(SSL\)/)).toBeInTheDocument();
    expect(screen.getByText('timeout')).toBeInTheDocument();
    expect(screen.getByText(/重試 1 次/)).toBeInTheDocument();
    expect(screen.getByText('總計發送')).toBeInTheDocument();
    expect(screen.queryByText('6 天內無發送紀錄')).not.toBeInTheDocument();
    expect(screen.getByText('空 alerts 時發送：是（NOTIFY_SEND_EMPTY=true）')).toBeInTheDocument();
    expect(screen.getAllByText('https://hooks.exampl...').length).toBeGreaterThan(0);
    expect(screen.getAllByText('t***@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('configured (token hidden)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText(/token=private/)).not.toBeInTheDocument();
  });

  it('handles channel tests and all-channel test results, including missing response data', async () => {
    const refetchStatus = jest.fn();
    setApiStates(
      { data: notificationStatus(), loading: false, error: null, refetch: refetchStatus },
      { data: deliveryLogs(0), loading: false, refetch: jest.fn() },
    );
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(fetchResponse({ channels: [
        { channel: 'email', status: 'success', logId: 7 },
        { channel: 'line_text', status: 'skipped' },
        { channel: 'webhook', status: 'failed', error: 'bad endpoint' },
      ] }))
      .mockResolvedValueOnce(fetchResponse({ error: 'provider offline' }))
      .mockResolvedValueOnce(fetchResponse({}));
    global.fetch = fetchMock;
    render(<NotificationsSettingsPage />);

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: '發送測試' }));
    expect(await screen.findByText('bad endpoint')).toBeInTheDocument();
    expect(screen.getByText('Log #7')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/notify/send/test?channel=email');

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('button', { name: '發送測試' }));
    expect(await screen.findByText('provider offline')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/notify/send/test');

    fireEvent.click(screen.getAllByRole('button', { name: '測試發送' })[0]);
    await waitFor(() => expect(refetchStatus).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/notify/send/test?channel=webhook');
  });

  it('filters and paginates delivery logs and expands masked delivery details', async () => {
    const refetchLogs = jest.fn();
    setApiStates(
      { data: notificationStatus(), loading: false, error: null, refetch: jest.fn() },
      { data: deliveryLogs(), loading: false, refetch: refetchLogs },
    );
    const { container } = render(<NotificationsSettingsPage />);

    expect(screen.getByText('共 16 筆')).toBeInTheDocument();
    expect(screen.getAllByText('https://hooks.exampl...').length).toBeGreaterThan(0);
    expect(screen.getAllByText('t***@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('configured (token hidden)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('http not...').length).toBeGreaterThan(0);

    const firstRow = screen.getByText('100').closest('tr');
    expect(firstRow).not.toBeNull();
    fireEvent.click(within(firstRow as HTMLElement).getByRole('button'));
    expect(screen.getByText('remote rejected request')).toBeInTheDocument();
    expect(screen.getByText(/"source": "daily-alert"/)).toBeInTheDocument();
    fireEvent.click(within(firstRow as HTMLElement).getByRole('button'));
    expect(screen.queryByText('remote rejected request')).not.toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'email' } });
    fireEvent.change(selects[2], { target: { value: 'failed' } });
    const dateInput = container.querySelector('input[type="date"]');
    expect(dateInput).not.toBeNull();
    fireEvent.change(dateInput as HTMLInputElement, { target: { value: '2026-11-09' } });
    fireEvent.click(screen.getByRole('button', { name: '重整' }));
    expect(refetchLogs).toHaveBeenCalledTimes(1);
    expect(mockUseApiData).toHaveBeenCalledWith(expect.stringContaining('channel=email'), expect.anything());
    expect(mockUseApiData).toHaveBeenCalledWith(expect.stringContaining('status=failed'), expect.anything());
    expect(mockUseApiData).toHaveBeenCalledWith(expect.stringContaining('date=2026-11-09'), expect.anything());

    fireEvent.click(screen.getByRole('button', { name: '下一頁 →' }));
    await waitFor(() => expect(mockUseApiData).toHaveBeenCalledWith(expect.stringContaining('limit=30'), expect.anything()));
    expect(screen.getByText('第 2 頁')).toBeInTheDocument();
    expect(screen.getByText('115')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '← 上一頁' }));
    expect(screen.getByText('第 1 頁')).toBeInTheDocument();
  });

  it('renders loading, missing status, and empty delivery log states', () => {
    setApiStates(
      { data: null, loading: true, error: null, refetch: jest.fn() },
      { data: null, loading: true, refetch: jest.fn() },
    );
    const { rerender } = render(<NotificationsSettingsPage />);
    expect(screen.getAllByText('載入中...').length).toBeGreaterThan(0);

    setApiStates(
      { data: null, loading: false, error: null, refetch: jest.fn() },
      { data: { ...deliveryLogs(0), total: 0, logs: [] }, loading: false, refetch: jest.fn() },
    );
    rerender(<NotificationsSettingsPage />);
    expect(screen.getByText('無法取得 channel 狀態')).toBeInTheDocument();
    expect(screen.getByText('尚無發送紀錄')).toBeInTheDocument();
    expect(screen.queryByText('排程活動')).not.toBeInTheDocument();
  });
});
