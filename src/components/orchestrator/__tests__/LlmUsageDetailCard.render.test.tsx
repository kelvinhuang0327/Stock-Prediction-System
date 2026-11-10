import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  LlmUsageDetailCard,
  type LlmRoleSummary,
  type LlmUsageTodayResponse,
  type UsageRecord,
} from '../LlmUsageDetailCard';
import type { UsageWarning } from '@/lib/agent-orchestrator/llmUsageWarnings';

function response(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function summary(overrides: Partial<LlmRoleSummary> = {}): LlmRoleSummary {
  return {
    preflightCount: 0,
    executionCount: 0,
    blockedCount: 0,
    failedCount: 0,
    premiumRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    ...overrides,
  };
}

function today(overrides: Partial<LlmUsageTodayResponse> = {}): LlmUsageTodayResponse {
  return {
    generatedAt: '2026-06-01T08:00:00Z',
    window: 'today',
    totals: summary(),
    byRole: {
      planner: summary(),
      worker: summary(),
      cto: summary(),
    },
    byProvider: {},
    recent: [],
    ...overrides,
  };
}

function usageRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    timestamp: '2026-06-01T08:00:00Z',
    phase: 'execution',
    event: 'provider_execution_success',
    caller: 'worker',
    triggerSource: 'manual',
    provider: 'copilot-daemon',
    model: null,
    taskId: 'task-1',
    jobName: null,
    decision: 'success',
    skipReason: null,
    errorCode: null,
    errorMessage: null,
    parsed: true,
    premiumRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    rateLimit: null,
    durationMs: 250,
    desiredModel: null,
    actualModel: null,
    modelPropagationStatus: null,
    noTaskReason: null,
    ...overrides,
  };
}

function warning(overrides: Partial<UsageWarning> = {}): UsageWarning {
  return {
    level: 'WARNING',
    code: 'COPILOT_FAILED_CALLS',
    message: 'Provider calls need attention.',
    provider: 'copilot-daemon',
    taskId: 'task-1',
    count: 1,
    action: 'Review the provider log.',
    ...overrides,
  };
}

describe('LlmUsageDetailCard rendering', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows loading states, then the empty report and no-warning state', async () => {
    let resolveToday!: (value: Response) => void;
    let resolveRecent!: (value: Response) => void;
    fetchMock
      .mockReturnValueOnce(new Promise((resolve) => { resolveToday = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveRecent = resolve; }));

    render(<LlmUsageDetailCard />);
    expect(screen.getByRole('button', { name: '載入中…' })).toBeDisabled();
    expect(screen.getAllByText('載入中…').length).toBeGreaterThan(1);
    expect(screen.queryByText('Top Tasks — Copilot 消耗 (Q4)')).not.toBeInTheDocument();

    await act(async () => {
      resolveToday(response(today()));
      resolveRecent(response({ ok: true, records: [] }));
    });

    expect(await screen.findByText('今日（UTC）尚無 LLM 呼叫紀錄')).toBeInTheDocument();
    expect(screen.getByText('目前未偵測到異常外部 LLM 使用')).toBeInTheDocument();
    expect(screen.getByText('近期無 Copilot / GitHub Copilot 呼叫紀錄')).toBeInTheDocument();
    expect(screen.getByText('尚無任何 Usage 紀錄')).toBeInTheDocument();
    expect(screen.getAllByText('今日尚無任何 LLM 呼叫紀錄')).toHaveLength(3);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/system/llm-usage');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/orchestrator/llm-usage/recent?limit=20');
  });

  it('shows fetch errors and can recover through the refresh control', async () => {
    fetchMock
      .mockResolvedValueOnce(response({}, false, 503))
      .mockResolvedValueOnce(response({ ok: true, records: [] }))
      .mockResolvedValueOnce(response(today()))
      .mockResolvedValueOnce(response({ ok: true, records: [] }));

    render(<LlmUsageDetailCard />);
    expect(await screen.findByText('/api/system/llm-usage: HTTP 503')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新整理' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '重新整理' }));
    expect(await screen.findByText('今日（UTC）尚無 LLM 呼叫紀錄')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('renders populated role, provider, warning, task, and recent-record details', async () => {
    const populatedToday = today({
      totals: summary({
        preflightCount: 2,
        executionCount: 5,
        blockedCount: 1,
        failedCount: 1,
        premiumRequests: 1.25,
        inputTokens: 1200,
        outputTokens: 700,
        cachedTokens: 300,
      }),
      byRole: {
        planner: summary({ preflightCount: 1, executionCount: 2, blockedCount: 1, failedCount: 1, inputTokens: 1000, outputTokens: 500 }),
        worker: summary({ preflightCount: 2, executionCount: 2, blockedCount: 1, failedCount: 1 }),
        cto: summary(),
      },
      byProvider: {
        'copilot-daemon': summary({ preflightCount: 2, executionCount: 2, inputTokens: 382500, outputTokens: 7900, cachedTokens: 330500, premiumRequests: 1 }),
        openai: summary({ executionCount: 1, inputTokens: 1200, outputTokens: 300 }),
        'local-planner': summary({ preflightCount: 1 }),
      },
      warnings: [
        warning({ level: 'CRITICAL', code: 'COPILOT_EXECUTION_HIGH', message: 'High execution count', count: 11 }),
        warning({ level: 'WARNING', code: 'COPILOT_FAILED_CALLS', taskId: null, message: 'Failed call', provider: '', count: 2 }),
        warning({ level: 'INFO', code: 'COPILOT_MISSING_TASK_ID', message: 'Missing task attribution', action: 'Add a task id.' }),
      ],
    });

    const recent = [
      usageRecord({
        taskId: 'task-1',
        inputTokens: 3800,
        outputTokens: 700,
        cachedTokens: 900,
        premiumRequests: 1,
        rateLimit: 'remaining 20',
        desiredModel: 'gpt-5',
        actualModel: 'gpt-5-codex',
        modelPropagationStatus: 'propagated',
      }),
      usageRecord({
        timestamp: '2026-06-01T09:00:00Z',
        taskId: 'task-1',
        inputTokens: 100,
        outputTokens: 50,
        premiumRequests: 0.5,
        desiredModel: 'gpt-5',
        actualModel: 'copilot-managed',
        modelPropagationStatus: 'provider-managed',
      }),
      usageRecord({
        phase: 'preflight',
        event: 'provider_preflight',
        provider: 'github-copilot',
        taskId: null,
        noTaskReason: 'scheduler_disabled',
        parsed: false,
        inputTokens: 800,
        outputTokens: 100,
        decision: 'allow',
      }),
      usageRecord({
        timestamp: '2026-06-01T10:00:00Z',
        provider: 'openai',
        taskId: null,
        noTaskReason: null,
        parsed: false,
        decision: 'block',
        phase: 'blocked',
        event: '',
      }),
      usageRecord({
        provider: 'github-cli',
        taskId: 'task-2',
        parsed: true,
        decision: 'skip',
        phase: 'fallback',
        noTaskReason: 'policy_blocked',
        skipReason: 'policy denied provider call',
      }),
      usageRecord({
        provider: 'copilot-daemon',
        taskId: null,
        noTaskReason: 'legacy-idle-reason',
        decision: 'unknown-decision',
        phase: 'unknown-phase',
        errorCode: 'E_PROVIDER',
        errorMessage: 'provider unavailable',
        rateLimit: null,
      }),
      usageRecord({ provider: 'github-copilot', taskId: 'task-3', inputTokens: 50, outputTokens: 25 }),
      usageRecord({ provider: 'github-cli', taskId: 'task-4', inputTokens: 25, outputTokens: 25 }),
      usageRecord({ provider: 'copilot-daemon', taskId: 'task-5', inputTokens: 10, outputTokens: 10 }),
      usageRecord({ provider: 'copilot-daemon', taskId: 'task-6', inputTokens: 1, outputTokens: 1 }),
      usageRecord({ provider: 'copilot-daemon', taskId: 'task-7' }),
      usageRecord({ provider: 'local-planner', taskId: 'not-a-copilot-task', inputTokens: 90000, outputTokens: 90000 }),
    ];

    fetchMock
      .mockResolvedValueOnce(response(populatedToday))
      .mockResolvedValueOnce(response({ ok: true, records: recent }));

    render(<LlmUsageDetailCard />);

    expect(await screen.findByText('今日 By Provider')).toBeInTheDocument();
    expect(screen.getByText('High execution count')).toBeInTheDocument();
    expect(screen.getByText(/WARNING\s*×\s*1/)).toBeInTheDocument();
    expect(screen.getByText(/INFO\s*×\s*1/)).toBeInTheDocument();
    expect(screen.getByText(/外部 LLM 今日 2 次/)).toBeInTheDocument();
    expect(screen.getByText(/今日無外部 LLM 呼叫/)).toBeInTheDocument();
    expect(screen.getByText('2 exec')).toBeInTheDocument();
    expect(screen.getAllByText('↑382.5k / ↓7.9k / cached 330.5k')).toHaveLength(2);
    expect(screen.getByText('Task #task-1')).toBeInTheDocument();
    expect(screen.getByText('provider-managed')).toBeInTheDocument();
    expect(screen.getByText('no taskId')).toBeInTheDocument();
    expect(screen.getByText('⚠️ missing')).toBeInTheDocument();
    expect(screen.getByText('Scheduler disabled')).toBeInTheDocument();
    expect(screen.getByText('Policy blocked')).toBeInTheDocument();
    expect(screen.getByText('legacy-idle-reason')).toBeInTheDocument();
    expect(screen.getByText('unknown-decision')).toBeInTheDocument();
    expect(screen.getByText('unknown-phase')).toBeInTheDocument();
    expect(screen.getByText('— (unavail)')).toBeInTheDocument();
    expect(screen.getByText('premium 1.00')).toBeInTheDocument();
    expect(screen.getByText('Task #task-5')).toBeInTheDocument();
    expect(screen.queryByText('Task #task-6')).not.toBeInTheDocument();
    expect(screen.queryByText('Task #task-7')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('偵測到 3 個警示')).toBeInTheDocument());
  });
});
