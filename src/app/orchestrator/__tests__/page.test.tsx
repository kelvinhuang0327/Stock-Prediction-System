import { render, screen } from '@testing-library/react';
import OrchestratorPage from '../page';

const mockGetOrchestratorSummary = jest.fn();
const mockGetOrchestratorTaskDetail = jest.fn();
const mockListOrchestratorTasks = jest.fn();

jest.mock('@/components/orchestrator/OrchestratorControlPanel', () => ({
  OrchestratorControlPanel: () => <div>Control panel</div>,
}));

jest.mock('@/lib/agent-orchestrator/service', () => ({
  getOrchestratorSummary: (...args: unknown[]) => mockGetOrchestratorSummary(...args),
  getOrchestratorTaskDetail: (...args: unknown[]) => mockGetOrchestratorTaskDetail(...args),
  listOrchestratorTasks: (...args: unknown[]) => mockListOrchestratorTasks(...args),
}));

const summary = {
  schedulerEnabled: true,
  plannerProvider: 'codex',
  workerProvider: 'copilot',
  latestTask: { taskId: 42 },
  taskCounts: {
    total: 8,
    queued: 1,
    running: 2,
    completed: 3,
    replanRequired: 1,
    failed: 1,
    failedRateLimit: 0,
  },
  nextPlannerRunAt: null,
  lastPlannerRunAt: '2026-11-10T00:00:00.000Z',
  nextWorkerRunAt: '2026-11-10T01:00:00.000Z',
  lastWorkerRunAt: null,
};

async function renderPage(tab?: string) {
  return render(await OrchestratorPage({ searchParams: Promise.resolve(tab ? { tab } : {}) }));
}

describe('OrchestratorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrchestratorSummary.mockResolvedValue(summary);
    mockListOrchestratorTasks.mockResolvedValue({
      rows: [
        { taskId: 1, slug: 'completed', updatedAt: 'now', status: 'COMPLETED', gateVerdict: 'PASS', latestProgressSummary: 'done' },
        { taskId: 2, slug: 'running', updatedAt: 'now', status: 'RUNNING', gateVerdict: 'FAIL', latestProgressSummary: 'working' },
        { taskId: 3, slug: 'limited', updatedAt: 'now', status: 'FAILED_RATE_LIMIT', gateVerdict: null, latestProgressSummary: 'paused' },
        { taskId: 4, slug: 'failed', updatedAt: 'now', status: 'FAILED', gateVerdict: 'UNKNOWN', latestProgressSummary: null },
        { taskId: 5, slug: 'replan', updatedAt: 'now', status: 'REPLAN_REQUIRED', gateVerdict: null, latestProgressSummary: null },
        { taskId: 6, slug: 'queued', updatedAt: 'now', status: 'QUEUED', gateVerdict: null, latestProgressSummary: null },
        { taskId: 7, slug: 'other', updatedAt: 'now', status: 'CUSTOM', gateVerdict: null, latestProgressSummary: null },
        { taskId: 8, slug: 'missing', updatedAt: 'now', status: null, gateVerdict: null, latestProgressSummary: null },
      ],
    });
    mockGetOrchestratorTaskDetail.mockResolvedValue({
      contract: { objective: 'Review generated work' },
      result: {
        gate_verdict: 'FAIL',
        gate_reason: 'Missing test evidence',
        acceptance_results: [
          { name: 'lint', passed: true },
          { name: 'coverage', passed: false },
        ],
      },
    });
  });

  it('renders scheduler, task statuses, gate verdicts, and latest task detail', async () => {
    await renderPage();

    expect(screen.getByText('scheduler enabled')).toBeInTheDocument();
    expect(screen.getByText('planner: codex')).toBeInTheDocument();
    expect(screen.getByText('worker: copilot')).toBeInTheDocument();
    expect(screen.getByText('Control panel')).toBeInTheDocument();
    expect(screen.getByText('Task Total')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Review generated work')).toBeInTheDocument();
    expect(screen.getByText('PASS · lint')).toBeInTheDocument();
    expect(screen.getByText('FAIL · coverage')).toBeInTheDocument();
    expect(screen.getByText('FAILED_RATE_LIMIT')).toBeInTheDocument();
    expect(screen.getByText('REPLAN_REQUIRED')).toBeInTheDocument();
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
    expect(mockGetOrchestratorTaskDetail).toHaveBeenCalledWith(42);
  });

  it('renders the backlog redirect card and empty state without a latest task', async () => {
    mockGetOrchestratorSummary.mockResolvedValue({ ...summary, schedulerEnabled: false, latestTask: null });
    mockListOrchestratorTasks.mockResolvedValue({ rows: [] });

    await renderPage('backlog');

    expect(screen.getByText('scheduler disabled')).toBeInTheDocument();
    expect(screen.getByText(/Backlog.*已移到 CTO flow/)).toBeInTheDocument();
    expect(screen.queryByText('Control panel')).not.toBeInTheDocument();
    expect(screen.queryByText('No tasks yet.')).not.toBeInTheDocument();
    expect(mockGetOrchestratorTaskDetail).not.toHaveBeenCalled();
  });

  it('renders empty task and detail states on the orchestration tab', async () => {
    mockGetOrchestratorSummary.mockResolvedValue({ ...summary, latestTask: null });
    mockListOrchestratorTasks.mockResolvedValue({ rows: [] });

    await renderPage();

    expect(screen.getByText('No tasks yet.')).toBeInTheDocument();
    expect(screen.getByText('No latest task detail available.')).toBeInTheDocument();
    expect(mockGetOrchestratorTaskDetail).not.toHaveBeenCalled();
  });

  it('uses fallback labels for incomplete task summaries and acceptance data', async () => {
    mockGetOrchestratorSummary.mockResolvedValue({
      ...summary,
      latestTask: { taskId: 99 },
      taskCounts: { ...summary.taskCounts, failedRateLimit: null },
      nextPlannerRunAt: null,
      lastPlannerRunAt: null,
      nextWorkerRunAt: null,
      lastWorkerRunAt: null,
    });
    mockGetOrchestratorTaskDetail.mockResolvedValue({
      contract: null,
      result: null,
    });
    mockListOrchestratorTasks.mockResolvedValue({ rows: [] });

    await renderPage();

    expect(screen.getAllByText('n/a').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('No acceptance result yet.')).toBeInTheDocument();
    expect(screen.getByText('No tasks yet.')).toBeInTheDocument();
    expect(mockGetOrchestratorTaskDetail).toHaveBeenCalledWith(99);
  });

  it('shows neither tab body when the tab key is unknown', async () => {
    await renderPage('unknown');

    expect(screen.queryByText('Control panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Backlog 已移到 CTO flow')).not.toBeInTheDocument();
    expect(screen.getByText('Task Orchestration Control Plane')).toBeInTheDocument();
  });
});
