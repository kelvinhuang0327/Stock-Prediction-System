import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { OrchestratorControlPanel } from '../OrchestratorControlPanel';

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const tasks = [
  { taskId: 1, title: 'Rate limit task', dayKey: '20261110', slug: 'rate-limit', status: 'FAILED_RATE_LIMIT', plannerProvider: 'codex', workerProvider: 'copilot', createdAt: 'invalid-date', updatedAt: null, lastOutputAt: null, changedFilesCount: 2, completedAt: null, durationMs: 65_000, latestProgressSummary: 'Waiting for provider reset' },
  { taskId: 2, dayKey: '20261110', slug: 'queued-task', status: 'QUEUED', plannerProvider: 'claude', workerProvider: 'codex', durationMs: null },
];

function response(payload: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => payload } as Response;
}

describe('OrchestratorControlPanel', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/summary')) return response({ ok: true, nextPlannerRunAt: 'invalid-date', nextWorkerRunAt: null, plannerProvider: 'codex', workerProvider: 'copilot', providerCooldowns: { copilot: { blockedUntil: '2026-11-10T00:00:00.000Z', reason: 'rate limited', resetHint: null, finalMessage: 'wait for reset', lastTaskId: 1, updatedAt: '2026-11-10T00:00:00.000Z' } } });
      if (url.includes('/tasks?')) return response({ ok: true, rows: tasks, total: 45 });
      if (url.endsWith('/runs?limit=50')) return response({ ok: true, runs: [
        { request_id: 'r1', runner: 'planner', outcome: 'NEW_TASK', task_id: '1', tick_at: '2026-11-10T00:00:00.000Z', message: 'started' },
        { request_id: 'r2', runner: 'worker', outcome: 'SKIPPED', task_id: null, tick_at: '', message: null },
        { request_id: 'r3', runner: 'worker', outcome: 'TIMEOUT', task_id: '3', tick_at: 'invalid', message: 'slow' },
        { request_id: 'r4', runner: 'planner', outcome: 'UNKNOWN', task_id: null, tick_at: '', message: null },
      ] });
      if (url.endsWith('/tasks/1')) return response({ ok: true, detail: {
        task: { ...tasks[0], promptPath: '/tmp/prompt.md', contractPath: '/tmp/contract.json', resultPath: '/tmp/result.json' },
        contract: { objective: 'Diagnose issue', scope: ['src'], constraints: ['local'], acceptance_tests: ['test'], required_outputs: ['report'], trigger_reason: 'manual', background: 'investigation' },
        result: { gate_verdict: 'FAIL', gate_reason: 'acceptance test missing', failure_provider: 'copilot', failure_reason: 'rate limit', reset_hint: 'wait 1 hour', final_message: 'retry later', duration_seconds: 65, changed_files: ['src/a.ts'], acceptance_results: [{ name: 'build', passed: true, evidence: 'ok' }, { name: 'test', passed: false, evidence: 'failed' }], next_action: 'retry' },
        promptContent: 'task prompt', completedContent: 'worker completion', workerLogTail: 'last log line',
      } });
      if (url.endsWith('/run-now') && method === 'POST') {
        const target = JSON.parse(String(init?.body)).target as string;
        return target === 'worker' ? response({ ok: true, request_id: 'worker-123' }) : response({ ok: false, error: 'queue unavailable' }, false, 503);
      }
      if (url.endsWith('/scheduler') && method === 'POST') return response({ ok: true });
      if (url.endsWith('/providers') && method === 'POST') return response({ ok: true });
      if (url.includes('/run-status')) return response({ ok: true, final: true, run: { request_id: 'r5', runner: 'planner', outcome: 'COMPLETED', task_id: '5', tick_at: '2026-11-10T00:00:00.000Z', message: 'complete' } });
      return response({ ok: false, error: 'not found' }, false, 404);
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads run and task data, changes providers, and executes worker/scheduler actions', async () => {
    render(<OrchestratorControlPanel schedulerEnabled={false} plannerProvider="codex" workerProvider="codex" />);

    expect(await screen.findByText('目前 provider 額度限制中')).toBeInTheDocument();
    expect(screen.getByText('請等待 reset，或切換到其他 worker provider。')).toBeInTheDocument();
    expect(screen.getByText('Rate limit task')).toBeInTheDocument();
    expect(screen.getByText('● 額度限制')).toBeInTheDocument();
    expect(screen.getByText('NEW_TASK')).toBeInTheDocument();
    expect(screen.getByText('SKIPPED')).toBeInTheDocument();
    expect(screen.getByText('TIMEOUT')).toBeInTheDocument();
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument();

    const providers = screen.getAllByRole('combobox');
    fireEvent.change(providers[0], { target: { value: 'claude' } });
    fireEvent.change(providers[1], { target: { value: 'copilot' } });
    fireEvent.change(screen.getByPlaceholderText('Copilot model (e.g. gpt-4o)'), { target: { value: 'gpt-4o-mini' } });
    fireEvent.click(screen.getByRole('button', { name: '套用' }));
    await screen.findByText('Providers updated.');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Worker 立即執行' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Worker 立即執行' }));
    await screen.findByText('Run worker queued.');
    fireEvent.click(screen.getByRole('button', { name: '啟用排程' }));
    await screen.findByText('Scheduler 已啟用.', {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: '停止排程' }));
    await screen.findByText('Scheduler 已停止.', {}, { timeout: 5000 });
  }, 15_000);

  it('filters tasks and displays the task prompt, contract, result, changed files, and worker output', async () => {
    render(<OrchestratorControlPanel schedulerEnabled={false} plannerProvider="codex" workerProvider="codex" />);
    expect(await screen.findByText('Rate limit task')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('日期 YYYYMMDD'), { target: { value: '20261110' } });
    fireEvent.change(screen.getByRole('option', { name: 'FAILED_RATE_LIMIT' }).parentElement as HTMLSelectElement, { target: { value: 'FAILED_RATE_LIMIT' } });
    fireEvent.click(screen.getByRole('button', { name: '篩選' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('date=20261110')));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('status=FAILED_RATE_LIMIT'));

    fireEvent.click(screen.getByText('Rate limit task'));
    fireEvent.click(await screen.findByRole('button', { name: /Prompt/ }));
    expect(await screen.findByText('task prompt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Task Contract/ }));
    expect(screen.getAllByText(/Diagnose issue/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Task Result/ }));
    expect(screen.getByText('✓ build')).toBeInTheDocument();
    expect(screen.getByText('✗ test')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /異動檔案/ }));
    expect(screen.getByText('src/a.ts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Worker 輸出/ }));
    expect(screen.getByText('last log line')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(screen.queryByText('task prompt')).not.toBeInTheDocument();
  });

  it('reports failed actions and supports task filtering, pagination, and empty data', async () => {
    render(<OrchestratorControlPanel schedulerEnabled={true} plannerProvider="claude" workerProvider="codex" />);
    expect(await screen.findByText(/1 \/ 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Planner 立即執行' }));
    await screen.findByText('Run planner failed: queue unavailable');
    fireEvent.click(screen.getByRole('button', { name: '執行全部' }));
    await screen.findByText('Run both failed: queue unavailable');
    fireEvent.click(screen.getByRole('button', { name: '套用' }));
    await screen.findByText('Providers updated.');

    fireEvent.click(screen.getByRole('button', { name: '›' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('page=2')));
    fireEvent.click(screen.getByRole('button', { name: '篩選' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/orchestrator/tasks?page=1&page_size=20'));
    fireEvent.click(screen.getByRole('button', { name: '重新整理' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/orchestrator/runs?limit=50'));
  });
});
