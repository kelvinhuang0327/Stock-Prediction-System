import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { LlmAuditPanel } from '../LlmAuditPanel';

function response(payload: unknown, ok = true): Response {
  return { ok, json: async () => payload } as Response;
}

const summary = {
  attemptCount: 2,
  resultSuccessCount: 1,
  resultFailedCount: 1,
  blockedCount: 1,
  totalDurationMs: 1500,
  inputTokens: 10,
  outputTokens: 5,
  cachedTokens: 2,
  premiumRequests: 1,
};

const auditToday = {
  ok: true,
  totals: summary,
  byRole: { planner: summary, worker: { ...summary, premiumRequests: 0 } },
  byProvider: { codex: summary },
  recentBlocked: [],
};

const recent = {
  ok: true,
  records: [
    {
      timestamp: '2026-11-10T02:03:04.000Z', correlation_id: 'attempt-1',
      event_type: 'LLM_CALL_ATTEMPT', runner_type: 'planner', usage_role: 'planner',
      provider: 'codex', model: null, task_id: null, run_id: null, trigger_source: 'manual',
      blocked: false, block_reason: null, success: null, error: null, duration_ms: null,
      input_tokens: 0, output_tokens: 0, cached_tokens: 0, total_tokens: 0, premium_requests: 0,
    },
    {
      timestamp: '2026-11-10T02:03:05.000Z', correlation_id: 'success-1',
      event_type: 'LLM_CALL_RESULT', runner_type: 'worker', usage_role: 'worker',
      provider: 'copilot', model: 'gpt-4o', task_id: 'task-1', run_id: 'run-1', trigger_source: 'scheduler',
      blocked: false, block_reason: null, success: true, error: null, duration_ms: 999,
      input_tokens: 10, output_tokens: 5, cached_tokens: 0, total_tokens: 15, premium_requests: 0,
    },
    {
      timestamp: '2026-11-10T02:03:06.000Z', correlation_id: 'failed-1',
      event_type: 'LLM_CALL_RESULT', runner_type: 'cto', usage_role: 'cto',
      provider: 'openai', model: 'gpt-5', task_id: 'task-2', run_id: 'run-2', trigger_source: 'manual',
      blocked: false, block_reason: null, success: false, error: 'provider unavailable', duration_ms: 1250,
      input_tokens: 4, output_tokens: 0, cached_tokens: 0, total_tokens: 4, premium_requests: 1,
    },
    {
      timestamp: '2026-11-10T02:03:07.000Z', correlation_id: 'blocked-1',
      event_type: 'LLM_CALL_BLOCKED', runner_type: 'ai_service', usage_role: 'ai_service',
      provider: 'codex', model: null, task_id: 'task-3', run_id: null, trigger_source: 'policy',
      blocked: true, block_reason: 'hard-off', success: null, error: null, duration_ms: 0,
      input_tokens: 0, output_tokens: 0, cached_tokens: 0, total_tokens: 0, premium_requests: 0,
    },
  ],
};

const usage = {
  ok: true,
  totals: {
    preflightCount: 4, executionCount: 2, blockedCount: 1, failedCount: 1,
    premiumRequests: 1, inputTokens: 14, outputTokens: 5, cachedTokens: 2,
  },
  byRole: {
    planner: { preflightCount: 1, executionCount: 1, blockedCount: 0, failedCount: 0, premiumRequests: 1, inputTokens: 5, outputTokens: 2, cachedTokens: 0 },
    worker: { preflightCount: 1, executionCount: 1, blockedCount: 0, failedCount: 0, premiumRequests: 0, inputTokens: 5, outputTokens: 3, cachedTokens: 2 },
    cto: { preflightCount: 1, executionCount: 0, blockedCount: 0, failedCount: 1, premiumRequests: 0, inputTokens: 4, outputTokens: 0, cachedTokens: 0 },
    ai_service: { preflightCount: 1, executionCount: 0, blockedCount: 1, failedCount: 0, premiumRequests: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0 },
  },
};

describe('LlmAuditPanel', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn((input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/today') && url.includes('llm-audit')) return Promise.resolve(response(auditToday));
      if (url.includes('llm-audit/recent')) return Promise.resolve(response(recent));
      return Promise.resolve(response(usage));
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
  });

  afterEach(() => jest.restoreAllMocks());

  it('renders usage, audit summaries, event badges and durations, and reloads all endpoints', async () => {
    render(<LlmAuditPanel llmMode="hard-off" schedulerEnabled />);

    expect((await screen.findAllByText('1 calls')).length).toBe(2);
    expect(screen.getByText('hard-off')).toHaveClass('bg-red-500/20');
    expect(screen.getByText('ON')).toBeInTheDocument();
    expect(screen.getByText('1 premium')).toBeInTheDocument();
    expect(screen.getAllByText('ATTEMPT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('RESULT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BLOCKED').length).toBeGreaterThan(0);
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText('999ms')).toBeInTheDocument();
    expect(screen.getByText('1.3s')).toBeInTheDocument();
    expect(screen.getByText('task-1')).toBeInTheDocument();
    expect(screen.getAllByText('codex').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '重新整理' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
  });

  it('shows empty states when endpoints return non-success responses', async () => {
    fetchMock.mockResolvedValue(response({}, false));
    render(<LlmAuditPanel schedulerEnabled={false} />);

    expect(await screen.findByText('無資料')).toBeInTheDocument();
    expect(screen.getByText(/無 Audit 資料/)).toBeInTheDocument();
    expect(screen.getByText(/尚無 Audit 紀錄/)).toBeInTheDocument();
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('shows the fetch error and can recover after a refresh', async () => {
    fetchMock.mockRejectedValueOnce(new Error('audit service unavailable'));
    render(<LlmAuditPanel />);

    expect(await screen.findByText('audit service unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新整理' }));
    expect((await screen.findAllByText('1 calls')).length).toBe(2);
    await waitFor(() => expect(screen.queryByText('audit service unavailable')).not.toBeInTheDocument());
  });
});
