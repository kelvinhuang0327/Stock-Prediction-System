import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SystemSettingsPage from '../page';

function response(data: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => data } as Response;
}

function health(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-11-10T01:00:00.000Z',
    overallStatus: 'degraded',
    dbSizeMb: '12.5 MB',
    dataSources: [
      { id: 'quotes', table: 'StockQuote', rowCount: 1234, lastDate: '2026-11-09', grade: 'A', usable: true },
      { id: 'financials', table: 'FinancialReport', rowCount: 0, lastDate: null, grade: 'D', usable: false },
    ],
    snapshots: [
      { type: 'daily', latestDate: '2026-11-09', rowCount: 20, fresh: true },
      { type: 'weekly', latestDate: null, rowCount: 0, fresh: false },
    ],
    recentSync: [],
    notificationChannels: [
      { channel: 'webhook', configured: true, lastStatus: 'success', lastSentAt: '2026-11-10T00:00:00Z' },
      { channel: 'email', configured: false, lastStatus: null, lastSentAt: null },
    ],
    last24hDelivery: { success: 4, failed: 1, skipped: 2 },
    knownLimitations: ['尚未匯入財報'],
    ...overrides,
  };
}

function tasks() {
  return {
    tasks: [
      {
        taskName: 'daily-sync', label: '每日同步', cadence: 'daily', scheduleLabel: null,
        writesToDb: true, supportsDryRun: true, nextRunAt: null, todayRan: true, todayStatus: 'success',
        latestRun: { id: 1, status: 'success', startedAt: '2026-11-10T00:00:00Z', finishedAt: null, summary: '同步完成', errorMessage: null, durationMs: 50, triggerSource: 'cron' },
      },
      {
        taskName: 'screen', label: '篩選', cadence: 'on-demand', scheduleLabel: '每小時',
        writesToDb: false, supportsDryRun: false, nextRunAt: '2026-11-10T02:00:00Z', todayRan: false, todayStatus: null,
        latestRun: { id: 2, status: 'failed', startedAt: null, finishedAt: null, summary: null, errorMessage: '資料源逾時', durationMs: 2500, triggerSource: 'manual' },
      },
      {
        taskName: 'running', label: '執行中任務', cadence: 'daily', scheduleLabel: '固定排程',
        writesToDb: false, supportsDryRun: false, nextRunAt: null, todayRan: false, todayStatus: 'running',
        latestRun: { id: 3, status: 'running', startedAt: 'bad-date', finishedAt: null, summary: '處理中', errorMessage: null, durationMs: null, triggerSource: 'cron' },
      },
      {
        taskName: 'old', label: '舊任務', cadence: 'weekly', scheduleLabel: null,
        writesToDb: false, supportsDryRun: false, nextRunAt: null, todayRan: false, todayStatus: null,
        latestRun: { id: 4, status: 'completed', startedAt: null, finishedAt: null, summary: null, errorMessage: null, durationMs: 0, triggerSource: 'cron' },
      },
      {
        taskName: 'never', label: '未執行任務', cadence: 'manual', scheduleLabel: null,
        writesToDb: false, supportsDryRun: false, nextRunAt: null, todayRan: false, todayStatus: null, latestRun: null,
      },
    ],
    generatedAt: '2026-11-10T01:00:00Z',
  };
}

function schedulerJobs() {
  return {
    jobs: [
      {
        jobName: 'training:tw-weekly-deep', status: 'completed', healthStatus: 'healthy', summary: '週訓練完成',
        failureStreak: 0, failureCount: 1, nextDueAt: '2026-11-11T00:00:00Z', skippedReason: null,
        generatedTaskCount: 2, generatedInsightCount: 3, schedulerOutcome: 'success',
        latestRun: { startedAt: '2026-11-10T00:00:00Z', finishedAt: null, status: 'success', summary: null, errorMessage: null, metadata: null },
      },
      {
        jobName: 'training:tw-weekly-failed', status: 'failed', healthStatus: 'degraded', summary: '背景摘要',
        failureStreak: 2, failureCount: 4, nextDueAt: '', skippedReason: '安全閘門未通過',
        generatedTaskCount: 0, generatedInsightCount: 0, schedulerOutcome: 'skipped', latestRun: null,
      },
      {
        jobName: 'training:tw-data-sync', status: 'success', healthStatus: 'healthy', summary: '',
        failureStreak: 0, failureCount: 0, nextDueAt: '', skippedReason: null,
        generatedTaskCount: 0, generatedInsightCount: 0, schedulerOutcome: 'success', latestRun: null,
      },
      {
        jobName: 'training:other', status: 'success', healthStatus: 'healthy', summary: '',
        failureStreak: 0, failureCount: 0, nextDueAt: '', skippedReason: null,
        generatedTaskCount: 0, generatedInsightCount: 0, schedulerOutcome: 'success', latestRun: null,
      },
    ],
  };
}

describe('SystemSettingsPage', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/system/health') return response(health());
      if (url === '/api/tasks/status') return response(tasks());
      if (url === '/api/autonomous/jobs/status') return response(schedulerJobs());
      if (url === '/api/tasks/run') return response({ summary: '任務完成' });
      throw new Error(`Unexpected request: ${url}`);
    }) as jest.Mock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders system health, data sources, snapshots, empty sync, channels, delivery, and limitations', async () => {
    render(<SystemSettingsPage />);

    expect(await screen.findByText('整體狀態')).toBeInTheDocument();
    expect(screen.getByText('StockQuote')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();
    expect(screen.getByText('daily')).toBeInTheDocument();
    expect(screen.getByText(/最新日期：無快照/)).toBeInTheDocument();
    expect(screen.getByText('尚無同步紀錄')).toBeInTheDocument();
    expect(screen.getByText('webhook')).toBeInTheDocument();
    expect(screen.getByText('尚未匯入財報')).toBeInTheDocument();
    expect(screen.getByText('近 24 小時通知發送')).toBeInTheDocument();
    expect(screen.getByText(/此頁面僅供系統巡檢使用，不顯示任何敏感設定值/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '通知管理 →' })).toHaveAttribute('href', '/settings/notifications');
  });

  it('renders task heartbeat variants and filters the autonomous job list', async () => {
    render(<SystemSettingsPage />);

    expect(await screen.findByText('每日同步')).toBeInTheDocument();
    expect(screen.getByTitle('今日已成功執行')).toBeInTheDocument();
    expect(screen.getByTitle('最近執行失敗')).toBeInTheDocument();
    expect(screen.getByTitle('執行中')).toBeInTheDocument();
    expect(screen.getByTitle('今日尚未執行')).toBeInTheDocument();
    expect(screen.getByTitle('從未執行')).toBeInTheDocument();
    expect(screen.getByText('從未執行過')).toBeInTheDocument();
    expect(screen.getByText('同步完成')).toBeInTheDocument();
    expect(screen.getByText('資料源逾時')).toBeInTheDocument();
    expect(screen.getByText('每小時')).toBeInTheDocument();
    expect(screen.getByText('每日')).toBeInTheDocument();
    expect(await screen.findByText('training:tw-weekly-deep')).toBeInTheDocument();
    expect(screen.getByText(/上次結果：週訓練完成/)).toBeInTheDocument();
    expect(screen.getByText(/上次結果：背景摘要/)).toBeInTheDocument();
    expect(screen.getByText('略過原因：安全閘門未通過')).toBeInTheDocument();
    expect(screen.queryByText('training:tw-data-sync')).not.toBeInTheDocument();
    expect(screen.queryByText('training:other')).not.toBeInTheDocument();
    expect(screen.getByText('失敗次數：4｜連續失敗：2')).toBeInTheDocument();
  });

  it('runs tasks, previews supported tasks, displays skipped and failed responses, and refreshes statuses on success', async () => {
    const fetchMock = global.fetch as jest.Mock;
    render(<SystemSettingsPage />);
    const immediateButtons = await screen.findAllByRole('button', { name: '立即執行' });
    const previewButtons = screen.getAllByRole('button', { name: '預覽執行' });

    fetchMock.mockResolvedValueOnce(response({ summary: '排程任務已完成' }));
    fireEvent.click(immediateButtons[0]);
    expect(await screen.findByText('排程任務已完成')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks/run', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ taskName: 'daily-sync', dryRun: false }),
    }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/tasks/status'));

    fetchMock.mockResolvedValueOnce(response({ skipped: true, skipReason: '今日額度已滿' }));
    fireEvent.click(previewButtons[0]);
    expect(await screen.findByText('略過：今日額度已滿')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(response({ skipped: true }));
    fireEvent.click(previewButtons[0]);
    expect(await screen.findByText('略過：已執行過')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(response({ error: '權限不足' }, false, 403));
    fireEvent.click(immediateButtons[1]);
    expect(await screen.findByText('權限不足')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(response({}, false, 418));
    fireEvent.click(immediateButtons[1]);
    expect(await screen.findByText('HTTP 418')).toBeInTheDocument();

    fetchMock.mockRejectedValueOnce(new Error('網路中斷'));
    fireEvent.click(immediateButtons[2]);
    expect(await screen.findByText('網路中斷')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(response({ status: 'queued' }));
    fireEvent.click(immediateButtons[2]);
    expect(await screen.findByText('queued')).toBeInTheDocument();

    fetchMock.mockRejectedValueOnce('unknown failure');
    fireEvent.click(immediateButtons[3]);
    expect(await screen.findByText('執行失敗')).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(response({}));
    fireEvent.click(immediateButtons[3]);
    expect(await screen.findByText('完成')).toBeInTheDocument();
  });

  it('shows loading and independent request errors, then recovers after refresh', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({}, false, 503))
      .mockResolvedValueOnce(response({}, false, 502))
      .mockRejectedValueOnce('scheduler unavailable')
      .mockResolvedValueOnce(response(health({ overallStatus: 'ok', knownLimitations: [] })))
      .mockResolvedValueOnce(response({ tasks: [], generatedAt: '' }))
      .mockResolvedValueOnce(response({ jobs: [] }))
      .mockRejectedValueOnce('health unavailable')
      .mockRejectedValueOnce('tasks unavailable')
      .mockResolvedValueOnce(response({}, false, 500));
    global.fetch = fetchMock;

    render(<SystemSettingsPage />);
    expect(screen.getAllByText(/載入中/).length).toBeGreaterThanOrEqual(3);
    expect(await screen.findByText('HTTP 503')).toBeInTheDocument();
    expect(await screen.findByText('HTTP 502')).toBeInTheDocument();
    expect(await screen.findByText('無法取得自我優化排程狀態')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '重新整理' })[0]);
    expect(await screen.findByText('整體狀態')).toBeInTheDocument();
    expect(screen.queryByText('HTTP 503')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '重新整理' })[1]);
    await waitFor(() => expect(screen.queryByText('HTTP 502')).not.toBeInTheDocument());
    expect(screen.queryByText('HTTP 502')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '重新整理' })[2]);
    await waitFor(() => expect(screen.queryByText('無法取得自我優化排程狀態')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(6);

    fireEvent.click(screen.getAllByRole('button', { name: '重新整理' })[0]);
    expect(await screen.findByText('無法取得系統健康資料')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '重新整理' })[1]);
    expect(await screen.findByText('無法取得任務狀態')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '重新整理' })[2]);
    expect(await screen.findByText('HTTP 500')).toBeInTheDocument();
  });

  it('renders populated sync records, healthy status, and an empty limitations panel', async () => {
    const fetchMock = global.fetch as jest.Mock;
    const originalToLocaleString = Date.prototype.toLocaleString;
    jest.spyOn(Date.prototype, 'toLocaleString').mockImplementation(function (this: Date) {
      if (this.getTime() === new Date('2026-11-10T01:00:00.000Z').getTime()) {
        throw new Error('date formatting unavailable');
      }
      return originalToLocaleString.call(this);
    });
    fetchMock.mockResolvedValueOnce(response(health({
      overallStatus: 'ok',
      recentSync: [{ jobType: 'quote-sync', lastRun: '2026-11-10T00:00:00Z', status: null }],
      knownLimitations: [],
    })));

    render(<SystemSettingsPage />);
    expect(await screen.findByText('quote-sync')).toBeInTheDocument();
    expect(screen.queryByText('尚無同步紀錄')).not.toBeInTheDocument();
    expect(screen.queryByText('已知限制')).not.toBeInTheDocument();
    expect(screen.getByText('通知頻道狀態')).toBeInTheDocument();
    expect(screen.getByText(/最後更新：2026-11-10T01:00:00\.000Z/)).toBeInTheDocument();
  });
});
