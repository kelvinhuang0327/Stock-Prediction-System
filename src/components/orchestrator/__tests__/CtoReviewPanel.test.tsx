import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { CtoReviewPanel } from '../CtoReviewPanel';

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const run = {
  id: 1,
  runId: 'run-123456789',
  frequencyMode: 'scheduled',
  startedAt: '2026-11-10T01:00:00.000Z',
  completedAt: null,
  candidateCount: 2,
  acceptedCount: 0,
  rejectedCount: 1,
  deferredCount: 1,
  reflectedCount: 0,
  summary: 'Review summary',
  isManual: false,
  runIntent: 'compare_regimes',
};

const reviews = [
  { proposalId: 10, symbol: '2330', setupType: 'momentum', conviction: 0.82, decision: 'REJECTED_ADJUST_SIGNAL', decisionReason: 'risk too high', finding_id: 'finding-new' },
  { proposalId: 11, symbol: '2317', decision: 'DEFERRED_REGIME_MISMATCH', finding_id: 'finding-existing' },
  { proposalId: 12, symbol: '2454', decision: 'ACCEPTED' },
  { proposalId: 13, symbol: '2308', decision: 'REFLECTED' },
  { decision: 'UNCLASSIFIED', conviction: 0 },
];

function response(payload: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => payload } as Response;
}

describe('CtoReviewPanel', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/summary')) return response({ ok: true, pending_count: 2, accepted_count: 3, rejected_count: 1, deferred_count: 1, reflected_count: 1, frequency_mode: 'daily', latest_run_at: '2026-11-10T00:00:00.000Z', next_run_at: new Date(Date.now() + 120_000).toISOString(), scheduler_enabled: true, latest_run_summary: 'last run' });
      if (url.includes('/runs?')) return response({ ok: true, runs: [run] });
      if (url.endsWith('/pending')) return response({ ok: true, rows: [{ task_id: 'task-1', task_title: 'Candidate task', integration_group: 'signal', review_priority: 'HIGH', source_branch: 'feature/x', commit_sha: 'abc123', conviction: 0.9, state: 'pending' }] });
      if (url.endsWith('/adaptive-policy') && method === 'GET') return response({ ok: true, policy: { overallAcceptRate: 0.6, resubmitMergeRate: 0.3, compareApproveRate: 0.5, forceLearningRate: 0.2, runsAnalyzed: 10, policyConfidence: 'medium', suggestions: [{ level: 'warn', text: 'review risks' }, { level: 'recommend', text: 'add evidence' }, { level: 'info', text: 'keep watching' }], computedAt: '2026-11-10T00:00:00.000Z' } });
      if (url.endsWith('/providers') && method === 'GET') return response({ ok: true, planner_provider: 'codex', planner_model: 'gpt-6', planner_provider_label: 'Codex', planner_options: [{ value: 'codex', label: 'Codex CLI' }], planner_model_presets: ['gpt-6'] });
      if (url.endsWith('/backlog/policy') && method === 'GET') return response({ ok: true, mode: 'balanced', queue_by_level: { P0: 2, P1: 0, P2: 1, P3: 0 }, queue_by_category: { signal: 2 }, recent_selections: [{ level: 'P0', category: 'signal' }, { level: 'P9', category: 'other' }], consecutive_high: 2, consecutive_category: 'signal', consecutive_category_count: 1, aging_items_count: 2, policy_constants: { fairness_every_n: 7 } });
      if (url.endsWith('/runs/run-123456789')) return response({ ok: true, run, reviews });
      if (url.endsWith('/reports/run-123456789')) return response({ ok: true, report_json: { signal_state: {}, candidates: [] }, backlog_items: [
        { findingId: 'finding-existing', status: 'OPEN', priorityLevel: 'P0', category: 'signal', suggestedAction: null, urgency: 'SOON' },
        { findingId: 'run-123456789-12', status: 'IN_PROGRESS', priorityLevel: 'P1', category: 'model', suggestedAction: null, urgency: 'SOON' },
        { findingId: 'run-123456789-13', status: 'DONE', priorityLevel: 'P2', category: 'data', suggestedAction: null, urgency: 'LATER' },
      ] });
      if (url.endsWith('/backlog?cto_run_id=run-123456789')) return response({ ok: true, items: [] });
      if (url.endsWith('/run-now') && method === 'POST') return response({ ok: true });
      if (url.endsWith('/scheduler') && method === 'POST') return response({ ok: true });
      if (url.endsWith('/providers') && method === 'POST') return response({ ok: true, planner_provider_label: 'Codex CLI', planner_model: 'gpt-6' });
      if (url.endsWith('/backlog/batch')) return response({ ok: true, count: 2 });
      if (url.endsWith('/backlog/aging')) return response({ ok: true, aged_count: 4 });
      if (url.endsWith('/adaptive-policy') && method === 'POST') return response({ ok: true, policy: { overallAcceptRate: 0.1, resubmitMergeRate: 0.1, compareApproveRate: 0.1, forceLearningRate: 0.1, runsAnalyzed: 1, policyConfidence: 'high', suggestions: [], computedAt: null } });
      if (url.endsWith('/backlog/policy') && method === 'POST') return response({ ok: true });
      if (url.endsWith('/backlog') && method === 'POST') return response({ ok: true });
      return response({ ok: false, error: 'unhandled' });
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads panels, filters runs, executes review and updates providers, scheduler and policies', async () => {
    render(<CtoReviewPanel schedulerEnabled signalState={{ state: 'NORMAL', confidenceLabel: 'high', reason: 'healthy' }} latestRun={{ runId: 'latest', candidateCount: 2, acceptedCount: 1, rejectedCount: 1, deferredCount: 0, reflectedCount: 0, summary: 'latest summary', isManual: true, createdAt: '2026-11-10T00:00:00.000Z' }} />);

    expect(await screen.findByText('2', { selector: '.text-lg.font-bold' })).toBeInTheDocument();
    expect(screen.getByText('daily')).toBeInTheDocument();
    expect(screen.getByText('NORMAL')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('review risks')).toBeInTheDocument();
    expect(screen.getByText(/m \d{2}s/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '停止排程' }));
    await screen.findByText('CTO scheduler 已停止');
    fireEvent.click(screen.getByRole('button', { name: '啟用排程' }));
    await screen.findByText('CTO scheduler 已啟用');

    fireEvent.change(screen.getByPlaceholderText('例如 auto'), { target: { value: 'gpt-6' } });
    fireEvent.click(screen.getByRole('button', { name: '套用組合' }));
    await screen.findByText('已套用：Codex CLI / gpt-6');

    fireEvent.click(screen.getByLabelText('強制重跑 (force)'));
    fireEvent.change(screen.getByRole('option', { name: 'Force Learning' }).parentElement as HTMLSelectElement, { target: { value: 'force_learning' } });
    fireEvent.click(screen.getByRole('button', { name: '立即執行 CTO Review' }));
    await screen.findByText('Review complete');
    const runRequest = fetchMock.mock.calls.find(([url]) => String(url) === '/api/orchestrator/cto/run-now');
    expect(runRequest).toBeDefined();
    expect(runRequest?.[1]?.method).toBe('POST');
    expect(JSON.parse(runRequest?.[1]?.body ?? 'null')).toEqual({ force: true, run_intent: 'force_learning' });

    fireEvent.change(screen.getByPlaceholderText('日期 YYYYMMDD'), { target: { value: '20261110' } });
    fireEvent.change(screen.getByRole('option', { name: 'manual' }).parentElement as HTMLSelectElement, { target: { value: 'manual' } });
    fireEvent.click(screen.getByRole('button', { name: '篩選' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('date=20261110')));

    fireEvent.click(screen.getByText('Review summary'));
    expect(await screen.findByText('Run run-1234… 詳情')).toBeInTheDocument();
    expect(screen.getByText('backlog: OPEN')).toBeInTheDocument();
    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('P2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /加入全部高優先 backlog/ }));
    await screen.findByText('✓ 已批次加入 2 筆到 backlog');

    fireEvent.click(screen.getAllByRole('button', { name: '＋ 加入 backlog' })[0]);
    await screen.findByText('✓ 已加入');
    fireEvent.click(screen.getByRole('button', { name: '＋ 加入 backlog' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/orchestrator/cto/backlog', expect.objectContaining({ method: 'POST' })));
    fireEvent.change(screen.getByRole('option', { name: 'fairness ♻' }).parentElement as HTMLSelectElement, { target: { value: 'fairness' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存模式' }));
    fireEvent.click(screen.getByRole('button', { name: '⏫ 觸發 Aging' }));
    await screen.findByText('⏫ 4 筆已更新 aging bonus');
    fireEvent.click(screen.getByRole('button', { name: '重新計算' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/orchestrator/cto/adaptive-policy', { method: 'POST' }));
  });

  it('shows empty panels and fallback provider and API response states', async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/summary')) return response({ ok: false });
      if (url.includes('/runs?')) return response({ ok: true });
      if (url.endsWith('/pending')) return response({ ok: true });
      if (url.endsWith('/adaptive-policy')) return response({ ok: false });
      if (url.endsWith('/providers')) return response({ ok: false });
      if (url.endsWith('/backlog/policy')) return response({ ok: false });
      if (url.endsWith('/run-now')) return response({ error: 'run blocked' });
      if (url.endsWith('/scheduler')) return response({ ok: false });
      if (url.endsWith('/backlog/aging')) return response({ ok: false });
      return response({ ok: false });
    });

    render(<CtoReviewPanel schedulerEnabled={false} signalState={null} latestRun={null} />);
    expect(await screen.findByText('無執行記錄')).toBeInTheDocument();
    expect(screen.getByText('尚無 adaptive policy 資料 — 點擊「重新計算」生成')).toBeInTheDocument();
    expect(screen.getByText('Claude CLI')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '立即執行 CTO Review' }));
    await screen.findByText('Error: run blocked');
    fireEvent.click(screen.getByRole('button', { name: '停止排程' }));
    fireEvent.click(screen.getByRole('button', { name: '⏫ 觸發 Aging' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/orchestrator/cto/backlog/aging', { method: 'POST' }));
  });

  it('formats elapsed and upcoming countdowns and supports every signal-state tone', async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => (
      String(input).endsWith('/summary')
        ? response({ ok: true, next_run_at: '2020-01-01T00:00:00.000Z' })
        : response({ ok: false })
    ));
    const initial = render(<CtoReviewPanel schedulerEnabled={false} signalState={{ state: 'SIGNAL_SATURATED', confidenceLabel: 'medium', reason: 'saturated' }} latestRun={null} />);
    expect(await screen.findByText('即將執行')).toBeInTheDocument();
    expect(screen.getByText('SIGNAL_SATURATED')).toBeInTheDocument();

    for (const state of ['COLD_REGIME', 'TRUE_EXHAUSTED', 'UNKNOWN_STATE']) {
      initial.rerender(<CtoReviewPanel schedulerEnabled={false} signalState={{ state, confidenceLabel: 'low', reason: state }} latestRun={null} />);
      expect(screen.getAllByText(state).length).toBeGreaterThan(0);
    }
  });
});
